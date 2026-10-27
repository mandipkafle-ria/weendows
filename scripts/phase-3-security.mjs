/* eslint-disable @typescript-eslint/explicit-function-return-type, no-empty */
import { _electron as electron } from 'playwright'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const repo = process.cwd()
const userData = join(process.env.APPDATA ?? '', 'HomeLayer')
const widgetsDir = join(userData, 'widgets')
const probeId = 'security-probe'
const livenessProbeId = 'security-liveness-probe'
const openLinkProbeId = 'security-openlink-probe'
const openLinkDeniedProbeId = 'security-openlink-denied'
const openLinkNoPermissionProbeId = 'security-openlink-none'
const layoutPath = join(userData, 'layout.json')
const results = []
const createdProbeDirs = []
let app = null
let originalLayout = null
let layoutModified = false

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function record(name, pass, evidence) {
  const result = pass ? 'PASS' : 'FAIL'
  results.push({ name, result, evidence })
  console.log(`${result} | ${name} | ${evidence}`)
}

function probeHtml(title, liveness = false) {
  const body = liveness
    ? `<div id="tick">0</div><script>let tick = 0; setInterval(() => { tick += 1; document.getElementById('tick').textContent = String(tick) }, 250)</script>`
    : `<div>${title}</div>`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="color-scheme" content="dark" />
<title>${title}</title>
<style>
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #111; color: #eee; font: 14px system-ui, sans-serif; }
body { display: grid; place-items: center; }
</style>
</head>
<body>${body}</body>
</html>`
}

async function findProbeById(widgetId) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    for (const page of app.windows().filter((window) => window.url().includes('widget-shell'))) {
      for (const frame of page.frames()) {
        if (!frame.url().startsWith(`widget://${widgetId}/`)) {
          continue
        }
        try {
          const ready = await frame.evaluate(() => Boolean(window.hl && window.hl.ready))
          if (ready) {
            return { page, frame }
          }
        } catch {
          continue
        }
      }
    }
    await sleep(100)
  }
  return null
}

async function findProbe() {
  return findProbeById(probeId)
}

async function waitBadge(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const badge = app.windows().find((window) => window.url().startsWith('data:text/html'))
    if (badge) {
      return badge
    }
    await sleep(100)
  }
  return null
}

async function callOpenLink(frame, url) {
  return frame.evaluate(async (target) => {
    try {
      await window.hl.openLink(target)
      return { ok: true }
    } catch (error) {
      return { ok: false, code: error.code || error.name, message: error.message }
    }
  }, url)
}

async function getOpenLinkState() {
  return app.evaluate(() => globalThis.__hlOpenLink)
}

async function waitForFrameText(page, prefix, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const frame = page.frames().find((candidate) => candidate.url().startsWith(prefix))
    if (frame) {
      try {
        const text = await frame.evaluate(() =>
          document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 80)
        )
        if (text.length > 0) {
          return text
        }
      } catch {
        continue
      }
    }
    await sleep(100)
  }
  return null
}

try {
  if (existsSync(layoutPath)) {
    originalLayout = await readFile(layoutPath, 'utf8')
  }
  const allPermissions = [
    'system.stats',
    'system.battery',
    'storage',
    'network',
    'launch',
    'openLink'
  ]
  const probeSpecs = [
    {
      id: probeId,
      name: 'Security Probe',
      permissions: allPermissions,
      x: 900,
      y: 900,
      focusable: false
    },
    {
      id: livenessProbeId,
      name: 'Liveness Probe',
      permissions: [],
      x: 900,
      y: 100,
      focusable: false,
      liveness: true
    },
    {
      id: openLinkProbeId,
      name: 'OpenLink Probe',
      permissions: ['openLink'],
      x: 900,
      y: 700,
      focusable: true
    },
    {
      id: openLinkDeniedProbeId,
      name: 'OpenLink Denied Probe',
      permissions: ['openLink'],
      x: 900,
      y: 500,
      focusable: true
    },
    {
      id: openLinkNoPermissionProbeId,
      name: 'OpenLink No Permission Probe',
      permissions: [],
      x: 900,
      y: 300,
      focusable: true
    }
  ]

  for (const spec of probeSpecs) {
    const dir = join(widgetsDir, spec.id)
    if (existsSync(dir)) {
      throw new Error(`Probe widget already exists: ${dir}`)
    }
  }

  const layout = originalLayout ? JSON.parse(originalLayout) : { schema: 1, placements: [] }
  const displayId = layout.placements?.[0]?.displayId ?? '0'
  const now = new Date().toISOString()

  for (const [index, spec] of probeSpecs.entries()) {
    const dir = join(widgetsDir, spec.id)
    const manifest = {
      schema: 1,
      id: spec.id,
      name: spec.name,
      kind: 'imported',
      width: 280,
      height: 200,
      minWidth: 200,
      minHeight: 160,
      focusable: spec.focusable,
      permissions: spec.permissions,
      grantedPermissions: spec.permissions,
      allowedHosts:
        spec.id === probeId ? ['api.open-meteo.com', 'geocoding-api.open-meteo.com'] : [],
      createdAt: now,
      updatedAt: now
    }

    await mkdir(dir, { recursive: true })
    createdProbeDirs.push(dir)
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await writeFile(join(dir, 'index.html'), probeHtml(spec.name, spec.liveness))
    layout.placements = (layout.placements ?? []).filter(
      (placement) => placement.widgetId !== spec.id
    )
    layout.placements.push({
      widgetId: spec.id,
      displayId,
      x: spec.x,
      y: spec.y,
      width: 280,
      height: 200,
      zOrder: 999 + index,
      locked: false,
      enabled: true,
      opacity: 1
    })
  }

  await writeFile(layoutPath, JSON.stringify(layout, null, 2))
  layoutModified = true

  const executablePath = process.env.HOMELAYER_EXE
  app = await electron.launch(
    executablePath
      ? { executablePath, args: [], cwd: repo, timeout: 60000 }
      : { args: ['.'], cwd: repo, timeout: 60000 }
  )

  let settings = null
  for (let attempt = 0; attempt < 100 && !settings; attempt += 1) {
    settings = app.windows().find((page) => page.url().includes('settings/index.html')) ?? null
    if (!settings) {
      await sleep(100)
    }
  }
  if (settings) {
    await settings.waitForSelector('.widget-card')
  }

  const probe = await findProbe()
  if (!probe) {
    throw new Error('Probe widget did not load')
  }
  await probe.frame.evaluate(() => window.hl.ready())

  const consoleMessages = []
  probe.page.on('console', (message) => consoleMessages.push(message.text()))

  const csp = await probe.frame.evaluate(async () => {
    const out = {}
    try {
      await fetch('https://example.com/?secret=1')
      out.fetch = 'ALLOWED'
    } catch (error) {
      out.fetch = `${error.name}: ${error.message}`
    }
    out.image = await new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve('LOADED')
      image.onerror = () => resolve('BLOCKED')
      image.src = 'https://example.com/pixel.png?secret=1'
      setTimeout(() => resolve('TIMEOUT'), 3000)
    })
    return out
  })
  record(
    'fetch("https://example.com") is blocked by CSP',
    csp.fetch !== 'ALLOWED' &&
      (consoleMessages.some((message) => message.includes('Content Security Policy')) ||
        csp.fetch.startsWith('TypeError')),
    JSON.stringify(csp)
  )

  const sandbox = await probe.frame.evaluate(() => {
    const out = {}
    try {
      void window.parent.document
      out.parent = 'NO_THROW'
    } catch (error) {
      out.parent = error.name
    }
    try {
      localStorage.setItem('a', 'b')
      out.localStorage = 'NO_THROW'
    } catch (error) {
      out.localStorage = error.name
    }
    out.require = typeof require
    out.process = typeof process
    out.electron = typeof window.electron
    try {
      out.open = window.open('https://example.com') === null ? 'NULL' : 'WINDOW'
    } catch (error) {
      out.open = error.name
    }
    return out
  })
  record('new Image() remote URL is blocked', csp.image === 'BLOCKED', csp.image)
  record(
    'window.parent.document throws SecurityError',
    sandbox.parent === 'SecurityError',
    sandbox.parent
  )
  record(
    'window.open is blocked',
    sandbox.open === 'NULL' || sandbox.open === 'SecurityError',
    sandbox.open
  )
  record('localStorage throws', sandbox.localStorage === 'SecurityError', sandbox.localStorage)
  record(
    'require, process and window.electron are undefined',
    sandbox.require === 'undefined' &&
      sandbox.process === 'undefined' &&
      sandbox.electron === 'undefined',
    JSON.stringify({
      require: sandbox.require,
      process: sandbox.process,
      electron: sandbox.electron
    })
  )

  const topResult = await probe.frame.evaluate(() => {
    try {
      window.top.location.href = 'https://example.com/'
      return 'SET'
    } catch (error) {
      return error.name
    }
  })
  await sleep(1000)
  record(
    'window.top.location is blocked',
    topResult === 'SecurityError' || probe.page.url().startsWith('file://'),
    `${topResult}; top=${probe.page.url()}`
  )

  const net = await probe.frame.evaluate(async () => {
    const urls = {
      http: 'http://api.open-meteo.com/v1/forecast',
      loopback: 'https://127.0.0.1/v1/forecast',
      localhost: 'https://localhost/v1/forecast',
      unapproved: 'https://example.com/v1/forecast'
    }
    const out = {}
    for (const [name, url] of Object.entries(urls)) {
      try {
        await window.hl.net.fetch(url)
        out[name] = 'OK'
      } catch (error) {
        out[name] = error.code || error.name
      }
    }
    return out
  })
  record(
    'hl.net.fetch blocks http, loopback, localhost and unapproved hosts',
    Object.values(net).every((value) => value === 'network_blocked'),
    JSON.stringify(net)
  )

  const storage = await probe.frame.evaluate(async () => {
    try {
      await window.hl.storage.set('big', 'a'.repeat(300 * 1024))
      return 'OK'
    } catch (error) {
      return error.code || error.name
    }
  })
  record('hl.storage.set 300 KB returns too_large', storage === 'too_large', storage)

  const rate = await probe.frame.evaluate(async () => {
    const calls = await Promise.allSettled(
      Array.from({ length: 100 }, () => window.hl.getContext())
    )
    return {
      ok: calls.filter((call) => call.status === 'fulfilled').length,
      limited: calls.filter(
        (call) => call.status === 'rejected' && call.reason?.code === 'rate_limited'
      ).length
    }
  })
  record('100 hl calls in one second are rate limited', rate.limited > 0, JSON.stringify(rate))

  await sleep(1100)
  const launch = await probe.frame.evaluate(async () => {
    const out = {}
    try {
      await window.hl.launch.app('C:\\Windows\\notepad.exe')
      out.path = 'OK'
    } catch (error) {
      out.path = error.code || error.name
    }
    try {
      await window.hl.launch.app('definitely-not-installed')
      out.unknown = 'OK'
    } catch (error) {
      out.unknown = error.code || error.name
    }
    return out
  })
  record(
    'hl.launch.app rejects paths and unknown app ids',
    (launch.path === 'invalid_args' || launch.path === 'not_found') &&
      launch.unknown === 'not_found',
    JSON.stringify(launch)
  )

  const openLinkProbe = await findProbeById(openLinkProbeId)
  const openLinkDeniedProbe = await findProbeById(openLinkDeniedProbeId)
  const openLinkNoPermissionProbe = await findProbeById(openLinkNoPermissionProbeId)
  if (!openLinkProbe || !openLinkDeniedProbe || !openLinkNoPermissionProbe) {
    throw new Error('One or more openLink probes did not load')
  }

  await app.evaluate(({ dialog, shell }) => {
    const state = { dialogs: [], opened: [], response: 1 }
    globalThis.__hlOpenLink = state
    dialog.showMessageBox = async (...args) => {
      const options = args.length > 1 ? args[1] : args[0]
      state.dialogs.push({ message: options.message, detail: options.detail })
      return { response: state.response, checkboxChecked: false }
    }
    shell.openExternal = async (url) => {
      state.opened.push(url)
    }
  })

  const approvedLink = await callOpenLink(openLinkProbe.frame, 'https://example.com/one')
  const approvedState = await getOpenLinkState()
  record(
    'hl.openLink prompts once and opens the approved URL',
    approvedLink.ok === true &&
      approvedState.dialogs.length === 1 &&
      String(approvedState.dialogs[0]?.message).includes('example.com') &&
      approvedState.opened.length === 1 &&
      approvedState.opened[0] === 'https://example.com/one',
    JSON.stringify({ approvedLink, ...approvedState })
  )

  const limitedLink = await callOpenLink(openLinkProbe.frame, 'https://example.org/two')
  const limitedState = await getOpenLinkState()
  record(
    'hl.openLink enforces the 3-second limit',
    limitedLink.code === 'rate_limited' &&
      limitedState.dialogs.length === 1 &&
      limitedState.opened.length === 1,
    JSON.stringify({ limitedLink, ...limitedState })
  )

  await sleep(3100)
  const cachedLink = await callOpenLink(openLinkProbe.frame, 'https://example.org/three')
  const cachedState = await getOpenLinkState()
  record(
    'hl.openLink caches approval per widget after the first prompt',
    cachedLink.ok === true &&
      cachedState.dialogs.length === 1 &&
      cachedState.opened.length === 2 &&
      cachedState.opened[1] === 'https://example.org/three',
    JSON.stringify({ cachedLink, ...cachedState })
  )

  const invalidLinks = []
  for (const url of [
    'ftp://example.com/file',
    'file:///C:/Windows/notepad.exe',
    'https://user:secret@example.com/'
  ]) {
    invalidLinks.push(await callOpenLink(openLinkProbe.frame, url))
  }
  const invalidState = await getOpenLinkState()
  record(
    'hl.openLink rejects non-http and credential URLs',
    invalidLinks.every((result) => result.code === 'invalid_args') &&
      invalidState.dialogs.length === 1 &&
      invalidState.opened.length === 2,
    JSON.stringify({ invalidLinks, ...invalidState })
  )

  await app.evaluate(() => {
    globalThis.__hlOpenLink.response = 0
  })
  const deniedLink = await callOpenLink(openLinkDeniedProbe.frame, 'https://example.com/denied')
  const deniedState = await getOpenLinkState()
  record(
    'hl.openLink returns permission_denied when the prompt is cancelled',
    deniedLink.code === 'permission_denied' &&
      deniedLink.message === 'opening links was not approved' &&
      deniedState.dialogs.length === 2 &&
      deniedState.opened.length === 2,
    JSON.stringify({ deniedLink, ...deniedState })
  )

  const noPermissionLink = await callOpenLink(
    openLinkNoPermissionProbe.frame,
    'https://example.com/no-permission'
  )
  const noPermissionState = await getOpenLinkState()
  record(
    'hl.openLink requires the openLink permission',
    noPermissionLink.code === 'permission_denied' &&
      noPermissionLink.message === 'permission not granted: openLink' &&
      noPermissionState.dialogs.length === 2 &&
      noPermissionState.opened.length === 2,
    JSON.stringify({ noPermissionLink, ...noPermissionState })
  )

  await app.evaluate(
    ({ BrowserWindow }, ids) => {
      for (const win of BrowserWindow.getAllWindows()) {
        const url = win.webContents.getURL()
        if (ids.some((id) => url.includes(id))) {
          win.destroy()
        }
      }
    },
    [openLinkProbeId, openLinkDeniedProbeId, openLinkNoPermissionProbeId]
  )
  await sleep(500)

  const sessionResult = await app.evaluate(async ({ BrowserWindow }) => {
    const events = []
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        partition: 'homelayer-widget',
        sandbox: true,
        contextIsolation: true
      }
    })
    win.webContents.on('did-fail-load', (_event, code, description, url) => {
      events.push({ code, description, url })
    })
    const html = '<!doctype html><meta http-equiv="refresh" content="0;url=https://example.com/">'
    await win
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      .catch((error) => events.push({ loadError: String(error) }))
    await new Promise((resolve) => setTimeout(resolve, 2500))
    win.destroy()
    return events
  })
  record(
    'meta refresh is cancelled by the widget session',
    sessionResult.some((event) => event.code === -20 && event.url === 'https://example.com/'),
    JSON.stringify(sessionResult)
  )

  const senderResult = await app.evaluate(
    async ({ BrowserWindow }, preload) => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false }
      })
      await win.loadURL('data:text/html,<html><body>not a widget shell</body></html>')
      const response = await win.webContents.executeJavaScript(
        "window.shellApi.invoke('widget-api', { method: 'ready', params: {} })"
      )
      win.destroy()
      return response
    },
    join(repo, 'out', 'preload', 'shell-preload.js')
  )
  record(
    'widget API rejects a non-widget shell sender',
    senderResult?.error?.code === 'permission_denied',
    JSON.stringify(senderResult)
  )

  const liveness = await findProbeById(livenessProbeId)
  if (!liveness) {
    throw new Error('Liveness probe did not load')
  }
  const livenessBefore = await liveness.frame.evaluate(
    () => document.getElementById('tick')?.textContent ?? null
  )
  const firstProbe = await findProbe()
  if (!firstProbe) {
    throw new Error('Probe disappeared before freeze test')
  }
  firstProbe.frame
    .evaluate(() => {
      while (true) {}
    })
    .catch(() => undefined)
  const badge = await waitBadge()
  record(
    'while(true) shows the unresponsive badge',
    Boolean(badge),
    badge ? (await badge.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ') : 'no badge'
  )
  await sleep(3000)
  const livenessAfter = await liveness.frame.evaluate(
    () => document.getElementById('tick')?.textContent ?? null
  )
  record(
    'other widgets keep running while one is frozen',
    livenessBefore !== null &&
      livenessAfter !== null &&
      Number(livenessAfter) > Number(livenessBefore),
    `before=${livenessBefore} after=${livenessAfter}`
  )

  if (badge) {
    await badge.click('#reload')
    await sleep(1000)
    const reloaded = await findProbe()
    const recoveredText = reloaded
      ? await waitForFrameText(reloaded.page, `widget://${probeId}/`)
      : null
    record(
      'badge Reload restores the widget',
      Boolean(reloaded) && recoveredText !== null,
      recoveredText ?? 'no probe frame'
    )

    const secondProbe = reloaded
    if (secondProbe) {
      secondProbe.frame
        .evaluate(() => {
          while (true) {}
        })
        .catch(() => undefined)
      const secondBadge = await waitBadge()
      if (secondBadge) {
        await secondBadge.click('#disable')
        await sleep(1000)
      }
      const probeGone = !(await findProbe())
      const notice = settings ? await settings.evaluate(() => document.body.innerText) : ''
      record(
        'badge Disable removes the widget',
        Boolean(secondBadge) && probeGone && notice.includes('was disabled'),
        `badge=${Boolean(secondBadge)} gone=${probeGone} notice=${notice.includes('was disabled')}`
      )
    } else {
      record('badge Disable removes the widget', false, 'no reloaded probe')
    }
  } else {
    record('badge Reload restores the widget', false, 'no badge')
    record('badge Disable removes the widget', false, 'no badge')
  }

  console.log('\nSecurity table summary:')
  for (const result of results) {
    console.log(`${result.result} | ${result.name}`)
  }
  if (results.some((result) => result.result === 'FAIL')) {
    process.exitCode = 1
  }
} finally {
  if (app) {
    await app.close().catch(() => undefined)
  }
  for (const dir of createdProbeDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  if (layoutModified) {
    if (originalLayout === null) {
      await rm(layoutPath, { force: true })
    } else {
      await writeFile(layoutPath, originalLayout)
    }
  }
}
