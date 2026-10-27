/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const packages = [
  ['Electron', 'electron'],
  ['React', 'react'],
  ['React DOM', 'react-dom'],
  ['Scheduler', 'scheduler'],
  ['electron-log', 'electron-log'],
  ['koffi', 'koffi'],
  ['zod', 'zod']
]

const licenseFiles = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'license', 'license.txt']

/**
 * @param {string} packageName
 * @returns {Promise<string>}
 */
async function readPackageLicense(packageName) {
  const directory = join('node_modules', packageName)
  for (const fileName of licenseFiles) {
    try {
      return await readFile(join(directory, fileName), 'utf8')
    } catch {
      // Try the next license filename.
    }
  }
  throw new Error(`No license file found for ${packageName}`)
}

const sections = [
  'HomeLayer third-party licenses',
  '==============================',
  '',
  'HomeLayer itself is licensed under the MIT License (see LICENSE).',
  '',
  'Electron and Chromium license files are also included next to the installed app',
  '(LICENSE.electron.txt and LICENSES.chromium.html).',
  ''
]

for (const [label, packageName] of packages) {
  const text = await readPackageLicense(packageName)
  sections.push(
    `${label} (${packageName})`,
    '-'.repeat(label.length + packageName.length + 3),
    text.trim(),
    ''
  )
}

sections.push(
  'DotGothic16 font',
  '----------------',
  (await readFile(join('resources', 'fonts', 'OFL.txt'), 'utf8')).trim(),
  ''
)

await writeFile(join('resources', 'THIRD_PARTY_LICENSES.txt'), sections.join('\n'), 'utf8')
console.log('Wrote resources/THIRD_PARTY_LICENSES.txt')
