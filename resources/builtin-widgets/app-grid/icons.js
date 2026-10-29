/*
 * HomeLayer app icon kit.
 *
 * App icons on Windows are extracted by the main process and cached as PNGs, so
 * most tiles show the real application icon. This file only covers the cases
 * where no icon could be extracted (UWP packages, broken shortcuts, portable
 * apps). Instead of showing a single letter we draw a glyph inside a tinted
 * "app plate":
 *
 *   1. A brand glyph for well known apps. The path data is taken from Tabler
 *      Icons (MIT) and Lucide (ISC), both free and open source. Names are
 *      trademarks of their owners and are used only to identify the app.
 *   2. A category glyph guessed from the app name (gamepad, browser, media...).
 *   3. A neutral 2x2 "apps" glyph with a colour derived from the name.
 *
 * Every glyph is stroked with currentColor, so the plate colour controls it.
 */
;(function () {
  'use strict'

  var STROKE = {
    fill: 'none',
    width: '1.7',
    linecap: 'round',
    linejoin: 'round'
  }

  // Brand glyphs: Tabler Icons, outline set, MIT licence.
  var BRANDS = [
    {
      key: 'chrome',
      re: /google chrome|chromium|\bchrome\b/i,
      a: '#6d9bff',
      b: '#1b46c9',
      paths: [
        'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
        'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
        'M12 9h8.4',
        'M14.598 13.5l-4.2 7.275',
        'M9.402 13.5l-4.2 -7.275'
      ]
    },
    {
      key: 'edge',
      re: /microsoft edge|\bedge\b/i,
      a: '#4fd3c2',
      b: '#0b6f9c',
      paths: [
        'M20.978 11.372a9 9 0 1 0 -1.593 5.773',
        'M20.978 11.372c.21 2.993 -5.034 2.413 -6.913 1.486c1.392 -1.6 .402 -4.038 -2.274 -3.851c-1.745 .122 -2.927 1.157 -2.784 3.202c.28 3.99 4.444 6.205 10.36 4.79',
        'M3.022 12.628c-.283 -4.043 8.717 -7.228 11.248 -2.688',
        'M12.628 20.978c-2.993 .21 -5.162 -4.725 -3.567 -9.748'
      ]
    },
    {
      key: 'firefox',
      re: /firefox/i,
      a: '#ff9a3d',
      b: '#a12ec0',
      paths: [
        'M4.028 7.82a9 9 0 1 0 12.823 -3.4c-1.636 -1.02 -3.064 -1.02 -4.851 -1.02h-1.647',
        'M4.914 9.485c-1.756 -1.569 -.805 -5.38 .109 -6.17c.086 .896 .585 1.208 1.111 1.685c.88 -.275 1.313 -.282 1.867 0c.82 -.91 1.694 -2.354 2.628 -2.093c-1.082 1.741 -.07 3.733 1.371 4.173c-.17 .975 -1.484 1.913 -2.76 2.686c-1.296 .938 -.722 1.85 0 2.234c.949 .506 3.611 -1 4.545 .354c-1.698 .102 -1.536 3.107 -3.983 2.727c2.523 .957 4.345 .462 5.458 -.34c1.965 -1.52 2.879 -3.542 2.879 -5.557c-.014 -1.398 .194 -2.695 -1.26 -4.75'
      ]
    },
    {
      key: 'vscode',
      re: /visual studio code|vs ?code|\bcode\b.*editor|code - insiders/i,
      a: '#4aa3ff',
      b: '#1052b8',
      paths: [
        'M16 3v18l4 -2.5v-13z',
        'M9.165 13.903l-4.165 3.597l-2 -1l4.333 -4.5m1.735 -1.802l6.932 -7.198v5l-4.795 4.141',
        'M16 16.5l-11 -10l-2 1l13 13.5'
      ]
    },
    {
      key: 'discord',
      re: /discord/i,
      a: '#8891ff',
      b: '#4149c9',
      paths: [
        'M8 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0',
        'M14 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0',
        'M15.5 17c0 1 1.5 3 2 3c1.5 0 2.833 -1.667 3.5 -3c.667 -1.667 .5 -5.833 -1.5 -11.5c-1.457 -1.015 -3 -1.34 -4.5 -1.5l-.972 1.923a11.913 11.913 0 0 0 -4.053 0l-.975 -1.923c-1.5 .16 -3.043 .485 -4.5 1.5c-2 5.667 -2.167 9.833 -1.5 11.5c.667 1.333 2 3 3.5 3c.5 0 2 -2 2 -3',
        'M7 16.5c3.5 1 6.5 1 10 0'
      ]
    },
    {
      key: 'steam',
      re: /steam/i,
      a: '#5a7ea0',
      b: '#16232f',
      paths: [
        'M16.5 5a4.5 4.5 0 1 1 -.653 8.953l-4.347 3.009l0 .038a3 3 0 0 1 -2.824 3l-.176 0a3 3 0 0 1 -2.94 -2.402l-2.56 -1.098v-3.5l3.51 1.755a2.989 2.989 0 0 1 2.834 -.635l2.727 -3.818a4.5 4.5 0 0 1 4.429 -5.302z',
        'M16.5 9.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'
      ]
    },
    {
      key: 'spotify',
      re: /spotify/i,
      a: '#3ddc7f',
      b: '#0a7a3d',
      paths: [
        'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
        'M8 11.973c2.5 -1.473 5.5 -.973 7.5 .527',
        'M9 15c1.5 -1 4 -1 5 .5',
        'M7 9c2 -1 6 -2 10 .5'
      ]
    },
    {
      key: 'figma',
      re: /figma/i,
      a: '#ff7a59',
      b: '#9b3ce0',
      paths: [
        'M15 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
        'M6 3m0 3a3 3 0 0 1 3 -3h6a3 3 0 0 1 3 3v0a3 3 0 0 1 -3 3h-6a3 3 0 0 1 -3 -3z',
        'M9 9a3 3 0 0 0 0 6h3m-3 0a3 3 0 1 0 3 3v-15'
      ]
    },
    {
      key: 'github',
      re: /github/i,
      a: '#8b95a5',
      b: '#2c313a',
      paths: [
        'M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5'
      ]
    }
  ]

  // Category glyphs: Lucide (ISC licence) and Tabler (MIT).
  var CATEGORIES = [
    {
      key: 'browser',
      re: /browser|internet|web|navigator|opera|brave|vivaldi|tor|safari/i,
      a: '#6f9dff',
      b: '#2a4fa8',
      paths: [
        'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18',
        'M3.6 9h16.8',
        'M3.6 15h16.8',
        'M12 3c2.4 2.4 3.6 5.4 3.6 9s-1.2 6.6 -3.6 9c-2.4 -2.4 -3.6 -5.4 -3.6 -9s1.2 -6.6 3.6 -9'
      ]
    },
    {
      key: 'folder',
      re: /file|folder|explorer|finder|drive|disk|documents|onedrive|dropbox/i,
      a: '#f7c76a',
      b: '#a8702a',
      paths: ['M22 19a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h5l2 3h9a2 2 0 0 1 2 2z']
    },
    {
      key: 'game',
      re: /game|steam|epic|battle|origin|uplay|playstation|xbox|minecraft|roblox|unity|unreal|riot|league|valorant|fortnite|mmo|arcade/i,
      a: '#b18cff',
      b: '#4b2c9e',
      paths: [
        'M6 11h4M8 9v4',
        'M15 12h.01M18 10h.01',
        'M17.32 5H6.68a4 4 0 0 0 -3.98 3.59c-.006 .05 -.01 .1 -.017 .15C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5 -.5 2 -1l1.41 -1.41a2 2 0 0 1 1.42 -.59h4.34a2 2 0 0 1 1.42 .59L17 18c.5 .5 1 1 2 1a3 3 0 0 0 3 -3c0 -1.55 -.6 -6.58 -.69 -7.26A4 4 0 0 0 17.32 5z'
      ]
    },
    {
      key: 'music',
      re: /music|audio|song|sound|spotify|itunes|podcast|radio|vlc|foobar|winamp|audacity/i,
      a: '#59d2b0',
      b: '#12705c',
      paths: [
        'M9 18V5l12-2v13',
        'M9 18a3 3 0 1 1 -6 0a3 3 0 0 1 6 0',
        'M21 16a3 3 0 1 1 -6 0a3 3 0 0 1 6 0'
      ]
    },
    {
      key: 'video',
      re: /video|movie|player|netflix|youtube|plex|kodi|mpc|obs|handbrake|stream/i,
      a: '#ff8f8f',
      b: '#9c2b3c',
      paths: [
        'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z',
        'M10 9l5 3l-5 3z'
      ]
    },
    {
      key: 'code',
      re: /code|dev|program|studio|terminal|shell|command|cmd|powershell|git|python|node|docker|android studio|intellij|pycharm|sublime|notepad\+\+|vim|emacs|postman|insomnia/i,
      a: '#71c7ff',
      b: '#1a5a8a',
      paths: ['M16 18l6 -6l-6 -6', 'M8 6l-6 6l6 6']
    },
    {
      key: 'doc',
      re: /word|writer|docs|document|note|memo|text|write|edit|todo|task|excel|sheet|calc|powerpoint|slide|office|onenote|obsidian|notion|evernote/i,
      a: '#8fb6ff',
      b: '#2f4b96',
      paths: [
        'M14 3H6a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V9z',
        'M14 3v6h6',
        'M8 13h8M8 17h5'
      ]
    },
    {
      key: 'chat',
      re: /chat|message|msg|mail|slack|teams|zoom|telegram|whatsapp|signal|discord|outlook|thunderbird|skype/i,
      a: '#7dd3fc',
      b: '#1c6f96',
      paths: ['M21 15a2 2 0 0 1 -2 2H7l-4 4V5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2z', 'M8 9h8M8 13h5']
    },
    {
      key: 'settings',
      re: /setting|pref|config|option|control|tweak|system|registry|driver/i,
      a: '#a7b3c6',
      b: '#3a4457',
      paths: [
        'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0 -6',
        'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06 .06a2 2 0 1 1 -2.83 2.83l-.06 -.06a1.65 1.65 0 0 0 -1.82 -.33a1.65 1.65 0 0 0 -1 1.51V21a2 2 0 1 1 -4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0 -1.82 .33l-.06 .06a2 2 0 1 1 -2.83 -2.83l.06 -.06a1.65 1.65 0 0 0 .33 -1.82a1.65 1.65 0 0 0 -1.51 -1H3a2 2 0 1 1 0 -4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 -.33 -1.82l-.06 -.06a2 2 0 1 1 2.83 -2.83l.06 .06a1.65 1.65 0 0 0 1.82 .33H9a1.65 1.65 0 0 0 1 -1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51a1.65 1.65 0 0 0 1.82 -.33l.06 -.06a2 2 0 1 1 2.83 2.83l-.06 .06a1.65 1.65 0 0 0 -.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0 -1.51 1z'
      ]
    },
    {
      key: 'photo',
      re: /photo|image|picture|paint|draw|design|canva|photoshop|illustrator|lightroom|gimp|inkscape|krita|blender|3d|render/i,
      a: '#ffb37a',
      b: '#a34a1e',
      paths: ['M4 4h16v16H4z', 'M4 15l4 -4l4 4l3 -3l5 5', 'M14.5 7.5h.01']
    },
    {
      key: 'shop',
      re: /store|shop|market|amazon|ebay|cart|steam shop|purchase/i,
      a: '#f9b45e',
      b: '#98610f',
      paths: [
        'M6 2l-3 6v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2V8l-3 -6z',
        'M3 8h18',
        'M16 12a4 4 0 0 1 -8 0'
      ]
    },
    {
      key: 'chart',
      re: /stat|chart|report|finance|money|bank|budget|monitor|task manager|performance|bench/i,
      a: '#7ee0b0',
      b: '#1d6f52',
      paths: ['M4 20V10M10 20V4M16 20v-7M22 20H2']
    },
    {
      key: 'cloud',
      re: /cloud|backup|sync|storage|mega|drive sync|wetransfer/i,
      a: '#9ec7ff',
      b: '#33599a',
      paths: ['M7 18a4.5 4.5 0 0 1 -.5 -8.97A6 6 0 0 1 17.9 10a4 4 0 0 1 -.4 8z']
    },
    {
      key: 'security',
      re: /security|antivirus|defender|vpn|password|keeper|bitwarden|proxy|firewall/i,
      a: '#8fd0c4',
      b: '#245f57',
      paths: ['M12 3l8 4v6c0 4.5 -3.2 7.6 -8 8c-4.8 -.4 -8 -3.5 -8 -8V7z', 'M9 12l2 2l4 -4']
    },
    {
      key: 'calculator',
      re: /calc|numbers?/i,
      a: '#a0b4d8',
      b: '#3c4a63',
      paths: [
        'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2V5a2 2 0 0 1 2 -2z',
        'M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01'
      ]
    }
  ]

  var DEFAULT_PATHS = ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z']

  function hashHue(name) {
    var hash = 0
    var text = typeof name === 'string' ? name : ''
    for (var index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0
    }
    return hash % 360
  }

  function matches(entry, name) {
    return entry.re.test(name)
  }

  function findBrand(name) {
    for (var index = 0; index < BRANDS.length; index += 1) {
      if (matches(BRANDS[index], name)) {
        return BRANDS[index]
      }
    }
    return null
  }

  function findCategory(name) {
    for (var index = 0; index < CATEGORIES.length; index += 1) {
      if (matches(CATEGORIES[index], name)) {
        return CATEGORIES[index]
      }
    }
    return null
  }

  function svg(paths, size) {
    var parts = []
    for (var index = 0; index < paths.length; index += 1) {
      parts.push('<path d="' + paths[index] + '"/>')
    }
    return (
      '<svg viewBox="0 0 24 24" width="' +
      size +
      '" height="' +
      size +
      '" fill="' +
      STROKE.fill +
      '" stroke="currentColor" stroke-width="' +
      STROKE.width +
      '" stroke-linecap="' +
      STROKE.linecap +
      '" stroke-linejoin="' +
      STROKE.linejoin +
      '" aria-hidden="true" focusable="false">' +
      parts.join('') +
      '</svg>'
    )
  }

  function palette(name) {
    var text = typeof name === 'string' ? name.trim() : ''
    var brand = findBrand(text)
    if (brand) {
      return { brand: brand.key, a: brand.a, b: brand.b, hue: hashHue(text) }
    }
    var category = findCategory(text)
    if (category) {
      return { brand: null, a: category.a, b: category.b, hue: hashHue(text) }
    }
    var hue = hashHue(text || 'app')
    return {
      brand: null,
      a: 'hsl(' + hue + ' 46% 46%)',
      b: 'hsl(' + ((hue + 34) % 360) + ' 52% 24%)',
      hue: hue
    }
  }

  function glyph(name, size) {
    var text = typeof name === 'string' ? name : ''
    var brand = findBrand(text)
    if (brand) {
      return svg(brand.paths, size)
    }
    var category = findCategory(text)
    if (category) {
      return svg(category.paths, size)
    }
    return svg(DEFAULT_PATHS, size)
  }

  window.HLIcons = {
    palette: palette,
    glyph: glyph,
    brands: BRANDS.map(function (entry) {
      return entry.key
    }),
    categories: CATEGORIES.map(function (entry) {
      return entry.key
    })
  }
})()
