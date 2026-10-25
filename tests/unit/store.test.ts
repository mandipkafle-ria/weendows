import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { JsonStore, writeAtomicJson } from '../../src/main/services/store'

const testSchema = z
  .object({
    schema: z.literal(1),
    items: z.array(z.object({ id: z.string() }).passthrough())
  })
  .passthrough()

type TestData = z.infer<typeof testSchema>

function defaults(): TestData {
  return { schema: 1, items: [] }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const directories: string[] = []
const stores: JsonStore<TestData>[] = []

async function makeStore(debounceMs = 20): Promise<{
  store: JsonStore<TestData>
  file: string
  directory: string
}> {
  const directory = await mkdtemp(join(tmpdir(), 'homelayer-store-'))
  directories.push(directory)
  const file = join(directory, 'layout.json')
  const store = new JsonStore<TestData>({
    file,
    schema: testSchema,
    defaults,
    debounceMs
  })
  stores.push(store)
  return { store, file, directory }
}

afterEach(async () => {
  for (const store of stores.splice(0)) {
    await store.close()
  }
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
  vi.restoreAllMocks()
})

describe('JsonStore', () => {
  it('starts from defaults when the file is missing', async () => {
    const { store } = await makeStore()
    const data = await store.load()

    expect(data).toEqual(defaults())
    expect(store.hadFile).toBe(false)
    expect(store.recovered).toBe(false)
  })

  it('flushes updated data to disk', async () => {
    const { store, file } = await makeStore()

    await store.load()
    store.update((data) => {
      data.items.push({ id: 'clock' })
    })
    await store.flush()

    const written: unknown = JSON.parse(await readFile(file, 'utf8'))
    expect(written).toEqual({ schema: 1, items: [{ id: 'clock' }] })
  })

  it('debounces scheduled writes and keeps the latest data', async () => {
    const { store, file } = await makeStore(25)

    await store.load()
    store.update((data) => {
      data.items.push({ id: 'first' })
    })
    store.update((data) => {
      data.items.push({ id: 'second' })
    })
    await wait(70)

    const written: unknown = JSON.parse(await readFile(file, 'utf8'))
    expect(written).toEqual({ schema: 1, items: [{ id: 'first' }, { id: 'second' }] })
  })

  it('recovers a corrupt file and keeps a timestamped backup', async () => {
    const { file, directory } = await makeStore()
    const onCorrupt = vi.fn()
    const corruptStore = new JsonStore<TestData>({
      file,
      schema: testSchema,
      defaults,
      debounceMs: 20,
      onCorrupt
    })
    stores.push(corruptStore)

    await writeFile(file, '{not valid json', 'utf8')
    const data = await corruptStore.load()

    expect(data).toEqual(defaults())
    expect(corruptStore.recovered).toBe(true)
    expect(corruptStore.hadFile).toBe(true)
    expect(onCorrupt).toHaveBeenCalledTimes(1)

    const entries = await readdir(directory)
    expect(entries.some((entry) => entry.includes('.corrupt-'))).toBe(true)
  })

  it('recovers data that does not match the schema', async () => {
    const { file } = await makeStore()
    await writeFile(file, JSON.stringify({ schema: 2, items: [] }), 'utf8')

    const store = new JsonStore<TestData>({
      file,
      schema: testSchema,
      defaults,
      debounceMs: 20
    })
    stores.push(store)

    const data = await store.load()
    expect(data).toEqual(defaults())
    expect(store.recovered).toBe(true)
  })

  it('preserves unknown fields at every object level', async () => {
    const { store, file } = await makeStore()
    await writeFile(
      file,
      JSON.stringify({
        schema: 1,
        items: [{ id: 'clock', extra: 'keep' }],
        extraRoot: 'keep-root'
      }),
      'utf8'
    )

    await store.load()
    store.update((data) => {
      data.items.push({ id: 'date' })
    })
    await store.flush()

    const written = JSON.parse(await readFile(file, 'utf8')) as TestData
    expect(written['extraRoot']).toBe('keep-root')
    expect(written.items[0]?.['extra']).toBe('keep')
  })

  it('writes atomically through a temporary file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'homelayer-atomic-'))
    directories.push(directory)
    const file = join(directory, 'nested', 'data.json')

    await writeAtomicJson(file, { value: 1 })
    await writeAtomicJson(file, { value: 2 })

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ value: 2 })
    const entries = await readdir(join(directory, 'nested'))
    expect(entries).toEqual(['data.json'])
  })
})
