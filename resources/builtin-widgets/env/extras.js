/* ==========================================================================
   HomeLayer extras kit — shared helpers for the extras widget pack.
   Exposes window.HLW. Safe inside the sandboxed widget frame: storage uses
   the widget SDK when available and a guarded localStorage fallback otherwise.
   ========================================================================== */
;(() => {
  'use strict'

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]
  const MONTH_LETTERS = 'JFMAMJJASOND'

  const pad = (n) => String(n).padStart(2, '0')
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  function isoWeek(date) {
    const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    return Math.ceil(((t - yearStart) / 864e5 + 1) / 7)
  }

  function doyOf(date) {
    const year = date.getFullYear()
    return Math.round(
      (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 0)) / 864e5
    )
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  function dateInfo(date) {
    const year = date.getFullYear()
    const doy = doyOf(date)
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    const hours = date.getHours()
    return {
      hh: String(hours % 12 || 12),
      hh24: pad(hours),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
      ampm: hours < 12 ? 'AM' : 'PM',
      time24: `${pad(hours)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
      weekday: DAYS[date.getDay()],
      weekdayShort: DAYS[date.getDay()].slice(0, 3),
      wd3: DAYS[date.getDay()].slice(0, 3),
      day: String(date.getDate()),
      dayOrd: ordinal(date.getDate()),
      month: String(date.getMonth() + 1),
      monthLong: MONTHS[date.getMonth()],
      monthShort: MONTHS[date.getMonth()].slice(0, 3),
      mon3: MONTHS[date.getMonth()].slice(0, 3),
      monthLetter: MONTH_LETTERS[date.getMonth()],
      year: String(year),
      doy: String(doy),
      week: String(isoWeek(date)),
      daysLeft: String((leap ? 366 : 365) - doy),
      time: `${pad(hours)}:${pad(date.getMinutes())}`
    }
  }

  function fmt12(hours, minutes) {
    const h = hours % 12 || 12
    return `${h}:${pad(minutes)} ${hours < 12 ? 'AM' : 'PM'}`
  }

  function dur(mins) {
    const total = Math.max(0, Math.round(mins))
    const h = Math.floor(total / 60)
    const m = total % 60
    return h ? `${h}h ${pad(m)}m` : `${m}m`
  }

  const setVn = (element, value) => {
    element.style.setProperty('--vn', clamp(value, 0, 1).toFixed(4))
  }

  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))

  let readyPromise = null
  function ready() {
    if (!readyPromise) {
      readyPromise = new Promise((resolve) => {
        if (window.hl && typeof window.hl.ready === 'function') {
          window.hl
            .ready()
            .then(() => resolve(true))
            .catch(() => resolve(false))
        } else {
          resolve(false)
        }
      })
    }
    return readyPromise
  }

  const memory = new Map()
  const store = {
    async get(key) {
      try {
        if (window.hl && window.hl.storage) {
          await ready()
          return await window.hl.storage.get(key)
        }
      } catch {
        /* fall through */
      }
      if (memory.has(key)) return memory.get(key)
      try {
        const raw = localStorage.getItem(`hlx-${key}`)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    async set(key, value) {
      memory.set(key, value)
      try {
        if (window.hl && window.hl.storage) {
          await ready()
          await window.hl.storage.set(key, value)
          return true
        }
      } catch {
        /* fall through */
      }
      try {
        localStorage.setItem(`hlx-${key}`, JSON.stringify(value))
        return true
      } catch {
        return false
      }
    }
  }

  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.mode = dark ? 'dark' : 'light'
  }

  function initTheme() {
    if (!window.hl) return
    ready()
      .then((ok) => (ok ? window.hl.getContext() : null))
      .then((ctx) => {
        if (ctx && typeof ctx.dark === 'boolean') applyTheme(ctx.dark)
      })
      .catch(() => {})
    window.hl.onTheme((state) => {
      if (state && typeof state.dark === 'boolean') applyTheme(state.dark)
    })
  }

  function initEnv(defaultVariant) {
    const params = new URLSearchParams(location.search)
    const variant = params.get('variant') || defaultVariant || ''
    if (variant) document.documentElement.dataset.variant = variant
    const env = params.get('env')
    if (env) document.documentElement.dataset.env = env
    const theme = params.get('theme') || 'dark'
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.mode = theme
    return { variant, env, theme, params }
  }

  function content() {
    try {
      const raw = new URLSearchParams(location.search).get('content')
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  function every(fn, ms = 1000) {
    const loop = () => {
      try {
        fn()
      } catch (error) {
        console.error(error)
      }
      const remainder = Date.now() % ms
      setTimeout(loop, ms - remainder + 5)
    }
    loop()
  }

  window.HLW = Object.freeze({
    DAYS,
    MONTHS,
    MONTH_LETTERS,
    pad,
    clamp,
    ordinal,
    isoWeek,
    doyOf,
    dayKey,
    dateInfo,
    fmt12,
    dur,
    setVn,
    $$,
    ready,
    store,
    initEnv,
    content,
    initTheme,
    every
  })
})()
