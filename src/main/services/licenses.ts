import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import log from './logger'

const LICENSE_CANDIDATES = ['resources/THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_LICENSES.txt']

export async function readLicenses(): Promise<string> {
  for (const candidate of LICENSE_CANDIDATES) {
    try {
      return await readFile(join(app.getAppPath(), candidate), 'utf8')
    } catch {
      // Try the next location.
    }
  }
  log.warn('Third-party license file was not found')
  return 'License information is not available in this build.'
}
