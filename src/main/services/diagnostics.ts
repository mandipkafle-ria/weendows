import { app, shell } from 'electron'
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import os from 'node:os'
import type { DiagnosticsExport } from '../../shared/types'
import log from './logger'

const LOG_FILE_LIMIT = 3

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function recentLogFiles(logsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(logsDir, { withFileTypes: true })
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const path = join(logsDir, entry.name)
          try {
            const info = await stat(path)
            return { name: entry.name, path, modified: info.mtimeMs }
          } catch {
            return null
          }
        })
    )
    return files
      .filter((file): file is { name: string; path: string; modified: number } => file !== null)
      .sort((left, right) => right.modified - left.modified)
      .slice(0, LOG_FILE_LIMIT)
      .map((file) => file.path)
  } catch {
    return []
  }
}

function versionsText(): string {
  return [
    `HomeLayer: ${app.getVersion()}`,
    `Windows: ${os.release()} (${os.version()})`,
    `Electron: ${process.versions.electron ?? 'unknown'}`,
    `Chromium: ${process.versions.chrome ?? 'unknown'}`,
    `Node: ${process.versions.node}`,
    `Architecture: ${process.arch}`
  ].join('\r\n')
}

export async function exportDiagnostics(): Promise<DiagnosticsExport> {
  const folder = join(app.getPath('userData'), 'diagnostics', `homelayer-${timestamp()}`)
  await mkdir(folder, { recursive: true })

  const copied: string[] = []
  for (const source of await recentLogFiles(join(app.getPath('userData'), 'logs'))) {
    const target = join(folder, source.split(/[\\/]/).pop() ?? 'main.log')
    await copyFile(source, target)
    copied.push(target)
  }

  const versionsFile = join(folder, 'versions.txt')
  await writeFile(versionsFile, versionsText(), 'utf8')

  log.info('Diagnostics exported', { folder, files: [...copied, versionsFile] })
  await shell.openPath(folder)
  return { folder, files: [...copied, versionsFile] }
}
