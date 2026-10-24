import { describe, expect, it } from 'vitest'
import { IPC } from '../../src/shared/ipc'

describe('IPC channels', () => {
  it('uses unique names', () => {
    const channels = Object.values(IPC)
    expect(new Set(channels).size).toBe(channels.length)
  })

  it('namespaces every channel', () => {
    for (const channel of Object.values(IPC)) {
      expect(channel).toMatch(/^[a-z]+:[a-z-]+$/)
    }
  })
})
