/* eslint-disable @typescript-eslint/explicit-function-return-type */
;(function () {
  'use strict'

  var port = null
  var seq = 0
  var pending = new Map()
  var queue = []
  var listeners = { theme: [], resize: [], editmode: [], apps: [] }

  window.addEventListener('message', function (event) {
    if (port || event.source !== window.parent || !event.data || event.data.type !== 'hl-init') {
      return
    }
    var nextPort = event.ports && event.ports[0]
    if (!nextPort) {
      return
    }

    port = nextPort
    port.onmessage = function (message) {
      var data = message.data
      if (!data || typeof data !== 'object') {
        return
      }
      if (data.type === 'hl-ping') {
        port.postMessage({ type: 'hl-pong', id: data.id })
        return
      }
      if (data.event) {
        var handlers = listeners[data.event] || []
        for (var index = 0; index < handlers.length; index += 1) {
          handlers[index](data.data)
        }
        return
      }

      var entry = pending.get(data.id)
      if (!entry) {
        return
      }
      pending.delete(data.id)
      clearTimeout(entry.timer)
      if (data.ok) {
        entry.resolve(data.result)
      } else {
        var error = data.error || {}
        entry.reject(
          Object.assign(new Error(error.message || 'Widget API call failed'), {
            code: error.code || 'internal'
          })
        )
      }
    }

    if (typeof port.start === 'function') {
      port.start()
    }
    queue.splice(0).forEach(function (message) {
      port.postMessage(message)
    })
  })

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = ++seq
      var timer = setTimeout(function () {
        if (pending.delete(id)) {
          reject(Object.assign(new Error('timeout'), { code: 'timeout' }))
        }
      }, 15000)

      pending.set(id, { resolve: resolve, reject: reject, timer: timer })
      var message = { id: id, method: method, params: params }
      if (port) {
        port.postMessage(message)
      } else {
        queue.push(message)
      }
    })
  }

  function on(name) {
    return function (callback) {
      if (typeof callback !== 'function') {
        return function () {
          return undefined
        }
      }
      listeners[name].push(callback)
      return function () {
        listeners[name] = listeners[name].filter(function (item) {
          return item !== callback
        })
      }
    }
  }

  window.hl = Object.freeze({
    ready: function () {
      return call('ready')
    },
    getContext: function () {
      return call('getContext')
    },
    onTheme: on('theme'),
    onResize: on('resize'),
    onEditMode: on('editmode'),
    onApps: on('apps'),
    log: function (level, message) {
      return call('log', { level: level, message: String(message).slice(0, 500) })
    },
    system: {
      getStats: function () {
        return call('system.getStats')
      },
      getBattery: function () {
        return call('system.getBattery')
      }
    },
    storage: {
      get: function (key) {
        return call('storage.get', { key: key })
      },
      set: function (key, value) {
        return call('storage.set', { key: key, value: value })
      },
      remove: function (key) {
        return call('storage.remove', { key: key })
      },
      keys: function () {
        return call('storage.keys')
      }
    },
    net: {
      fetch: function (url, opts) {
        return call('net.fetch', { url: url, opts: opts }).then(function (response) {
          return Object.assign({}, response, {
            json: function () {
              return JSON.parse(response.text)
            }
          })
        })
      }
    },
    launch: {
      app: function (appId) {
        return call('launch.app', { appId: appId })
      }
    },
    apps: {
      list: function () {
        return call('apps.list')
      },
      refresh: function () {
        return call('apps.refresh')
      }
    },
    grid: {
      getState: function () {
        return call('grid.getState')
      },
      renameTitle: function (title) {
        return call('grid.renameTitle', { title: title })
      },
      addApps: function (appIds) {
        return call('grid.addApps', { appIds: appIds })
      },
      removeApp: function (appId) {
        return call('grid.removeApp', { appId: appId })
      },
      move: function (from, to) {
        return call('grid.move', { from: from, to: to })
      },
      merge: function (appId, targetKey) {
        return call('grid.merge', { appId: appId, targetKey: targetKey })
      },
      openBundle: function (bundleId, rect) {
        return call('grid.openBundle', { bundleId: bundleId, rect: rect })
      }
    },
    openLink: function (url) {
      return call('openLink', { url: url })
    }
  })

  window.addEventListener('error', function (event) {
    window.hl.log('error', event.message).catch(function () {
      return undefined
    })
  })
  window.addEventListener('unhandledrejection', function (event) {
    window.hl.log('error', String(event.reason)).catch(function () {
      return undefined
    })
  })
})()
