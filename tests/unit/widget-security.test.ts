import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import dns from 'node:dns'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertAllowedUrl,
  createSafeLookup,
  hostIsAllowed,
  isBlockedAddress,
  isBlockedHostname
} from '../../src/main/services/net-proxy'
import { WidgetRateLimitRegistry } from '../../src/main/services/rate-limiter'
import {
  hostIsApproved,
  isPermissionGranted,
  withPermission
} from '../../src/main/services/widget-permissions'
import {
  jsonByteSize,
  storageFilePath,
  validateStorageKey,
  WidgetStorageService
} from '../../src/main/services/widget-storage'
import type { WidgetManifest } from '../../src/shared/types'

const allowedHosts = ['api.open-meteo.com', 'geocoding-api.open-meteo.com']

describe('network address rules', () => {
  it('blocks private, loopback and special IPv4 ranges', () => {
    for (const address of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.10.20',
      '172.16.5.5',
      '192.168.1.10',
      '224.0.0.1'
    ]) {
      expect(isBlockedAddress(address), address).toBe(true)
    }
  })

  it('blocks loopback and private IPv6 ranges', () => {
    for (const address of ['::1', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1']) {
      expect(isBlockedAddress(address), address).toBe(true)
    }
  })

  it('allows public addresses and rejects non-addresses', () => {
    expect(isBlockedAddress('93.184.216.34')).toBe(false)
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false)
    expect(isBlockedAddress('not-an-ip')).toBe(true)
  })

  it('blocks local and literal hosts before DNS', () => {
    for (const host of ['localhost', 'printer.local', 'router.internal', '127.0.0.1', '[::1]']) {
      expect(isBlockedHostname(host), host).toBe(true)
    }
    expect(isBlockedHostname('api.open-meteo.com')).toBe(false)
  })

  it('matches allowed hosts exactly and case-insensitively', () => {
    expect(hostIsAllowed('API.Open-Meteo.com', allowedHosts)).toBe(true)
    expect(hostIsAllowed('evil-open-meteo.com', allowedHosts)).toBe(false)
    expect(hostIsAllowed('open-meteo.com', allowedHosts)).toBe(false)
  })
})

describe('assertAllowedUrl', () => {
  it('accepts an https URL on an approved host', () => {
    expect(
      assertAllowedUrl('https://api.open-meteo.com/v1/forecast?x=1', allowedHosts).hostname
    ).toBe('api.open-meteo.com')
  })

  it('blocks http, credentials, IP literals and unapproved hosts', () => {
    for (const url of [
      'http://api.open-meteo.com/v1/forecast',
      'https://user:pass@api.open-meteo.com/v1/forecast',
      'https://127.0.0.1/v1/forecast',
      'https://localhost/v1/forecast',
      'https://example.com/v1/forecast'
    ]) {
      expect(() => assertAllowedUrl(url, allowedHosts), url).toThrowError(
        expect.objectContaining({ code: 'network_blocked' })
      )
    }
  })

  it('rejects malformed URLs with invalid_args', () => {
    expect(() => assertAllowedUrl('not a url', allowedHosts)).toThrowError(
      expect.objectContaining({ code: 'invalid_args' })
    )
  })
})

describe('createSafeLookup', () => {
  const publicAddress = { address: '93.184.216.34', family: 4 }

  it('returns the first checked address for single lookups', () => {
    const lookup = (() => {
      const fake = (
        _host: string,
        _options: dns.LookupOptions,
        callback: (error: NodeJS.ErrnoException | null, address: dns.LookupAddress[]) => void
      ): void => callback(null, [publicAddress])
      return createSafeLookup(fake as unknown as typeof dns.lookup)
    })()

    let result: { address?: string | dns.LookupAddress[]; family?: number } = {}
    lookup('api.open-meteo.com', {}, (error, address, family) => {
      expect(error).toBeNull()
      result = { address, family }
    })
    expect(result).toEqual({ address: publicAddress.address, family: publicAddress.family })
  })

  it('returns every checked address when all is true', () => {
    const lookup = createSafeLookup(((
      _host: string,
      _options: dns.LookupOptions,
      callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
    ) => {
      callback(null, [publicAddress, { address: '1.1.1.1', family: 4 }])
    }) as unknown as typeof dns.lookup)

    lookup('api.open-meteo.com', { all: true }, (error, address) => {
      expect(error).toBeNull()
      expect(address).toEqual([publicAddress, { address: '1.1.1.1', family: 4 }])
    })
  })

  it('rejects a host that resolves to a private address', () => {
    const lookup = createSafeLookup(((
      _host: string,
      _options: dns.LookupOptions,
      callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
    ) => {
      callback(null, [{ address: '192.168.1.5', family: 4 }])
    }) as unknown as typeof dns.lookup)

    lookup('api.open-meteo.com', {}, (error) => {
      expect(error).toMatchObject({ code: 'network_blocked' })
    })
  })

  it('rejects a mixed result if any address is private', () => {
    const lookup = createSafeLookup(((
      _host: string,
      _options: dns.LookupOptions,
      callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
    ) => {
      callback(null, [publicAddress, { address: '10.0.0.2', family: 4 }])
    }) as unknown as typeof dns.lookup)

    lookup('api.open-meteo.com', { all: true }, (error) => {
      expect(error).toMatchObject({ code: 'network_blocked' })
    })
  })
})

describe('WidgetRateLimitRegistry', () => {
  it('allows 30 calls per second and rejects the next one', () => {
    let now = 0
    const registry = new WidgetRateLimitRegistry(() => now)
    for (let index = 0; index < 30; index += 1) {
      expect(registry.check('clock', false).ok).toBe(true)
    }
    expect(registry.check('clock', false)).toEqual({ ok: false, net: false })

    now = 1000
    expect(registry.check('clock', false).ok).toBe(true)
  })

  it('limits network calls to 60 per minute', () => {
    let now = 0
    const registry = new WidgetRateLimitRegistry(() => now)
    for (let index = 0; index < 30; index += 1) {
      expect(registry.check('weather', true).ok).toBe(true)
    }

    now = 1000
    for (let index = 0; index < 30; index += 1) {
      expect(registry.check('weather', true).ok).toBe(true)
    }

    now = 2000
    expect(registry.check('weather', true)).toEqual({ ok: false, net: true })
    expect(registry.check('weather', false).ok).toBe(true)
  })

  it('keeps separate budgets per widget', () => {
    const registry = new WidgetRateLimitRegistry(() => 0)
    for (let index = 0; index < 30; index += 1) {
      registry.check('clock', false)
    }
    expect(registry.check('clock', false).ok).toBe(false)
    expect(registry.check('date', false).ok).toBe(true)
  })
})

describe('permission helpers', () => {
  const manifest = {
    grantedPermissions: ['storage', 'system.stats'],
    allowedHosts: ['api.open-meteo.com']
  } as Pick<WidgetManifest, 'grantedPermissions' | 'allowedHosts'>

  it('checks granted permissions', () => {
    expect(isPermissionGranted(manifest, 'storage')).toBe(true)
    expect(isPermissionGranted(manifest, 'network')).toBe(false)
  })

  it('matches approved hosts case-insensitively', () => {
    expect(hostIsApproved(manifest, 'API.open-meteo.com')).toBe(true)
    expect(hostIsApproved(manifest, 'example.com')).toBe(false)
  })

  it('adds and removes permissions without duplicates', () => {
    const granted = withPermission(
      { ...manifest, permissions: ['storage', 'network'] } as WidgetManifest,
      'network',
      true
    )
    expect(granted.grantedPermissions).toEqual(['storage', 'system.stats', 'network'])

    const revoked = withPermission(granted, 'storage', false)
    expect(revoked.grantedPermissions).toEqual(['system.stats', 'network'])
  })
})

describe('widget storage guards', () => {
  let widgetsDir: string

  beforeEach(async () => {
    widgetsDir = await mkdtemp(join(tmpdir(), 'homelayer-storage-'))
  })

  afterEach(async () => {
    await rm(widgetsDir, { recursive: true, force: true })
  })

  it('rejects widget ids that escape the widgets root', () => {
    expect(storageFilePath(widgetsDir, '../outside')).toBeNull()
    expect(storageFilePath(widgetsDir, 'a/../../outside')).toBeNull()
    expect(storageFilePath(widgetsDir, '..\\outside')).toBeNull()
    expect(storageFilePath(widgetsDir, 'Clock')).toBeNull()
    expect(storageFilePath(widgetsDir, 'clock')).toBe(resolve(widgetsDir, 'clock', 'storage.json'))
  })

  it('validates storage keys and JSON sizes', () => {
    expect(validateStorageKey('note')).toBe('note')
    expect(() => validateStorageKey('')).toThrowError(
      expect.objectContaining({ code: 'invalid_args' })
    )
    expect(() => validateStorageKey('a'.repeat(65))).toThrowError(
      expect.objectContaining({ code: 'invalid_args' })
    )
    expect(jsonByteSize({ a: 1 })).toBe(7)
    expect(jsonByteSize(undefined)).toBeNull()

    const circular: Record<string, unknown> = {}
    circular['self'] = circular
    expect(jsonByteSize(circular)).toBeNull()
  })

  it('saves, reads, lists and removes JSON values', async () => {
    const storage = new WidgetStorageService(widgetsDir)
    expect(await storage.get('notes', 'note')).toBeNull()
    expect(await storage.set('notes', 'note', { text: 'hello' })).toBe(true)
    expect(await storage.get('notes', 'note')).toEqual({ text: 'hello' })
    expect(await storage.keys('notes')).toEqual(['note'])
    expect(await storage.remove('notes', 'note')).toBe(true)
    expect(await storage.get('notes', 'note')).toBeNull()
    expect(await storage.remove('notes', 'note')).toBe(false)
  })

  it('enforces the value and total size limits', async () => {
    const storage = new WidgetStorageService(widgetsDir)
    await expect(storage.set('notes', 'big', 'a'.repeat(65 * 1024))).rejects.toMatchObject({
      code: 'too_large'
    })

    for (const key of ['a', 'b', 'c', 'd']) {
      expect(await storage.set('notes', key, 'x'.repeat(60000))).toBe(true)
    }
    await expect(storage.set('notes', 'e', 'x'.repeat(60000))).rejects.toMatchObject({
      code: 'too_large'
    })
  })

  it('backs up a corrupt storage file and starts empty', async () => {
    const storage = new WidgetStorageService(widgetsDir)
    const file = storageFilePath(widgetsDir, 'notes')
    expect(file).not.toBeNull()
    await mkdir(join(widgetsDir, 'notes'), { recursive: true })
    await writeFile(file as string, '{broken', 'utf8')

    expect(await storage.get('notes', 'note')).toBeNull()
    const files = await readdir(join(widgetsDir, 'notes'))
    expect(files.some((name) => name.startsWith('storage.json.corrupt-'))).toBe(true)
  })
})
