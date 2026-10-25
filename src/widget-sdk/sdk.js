/* eslint-disable @typescript-eslint/explicit-function-return-type */
;(function () {
  'use strict'

  var listeners = []
  var pending = false
  var context = null

  function currentContext() {
    if (!context) {
      context = {
        id: location.hostname,
        locale: navigator.language,
        theme: 'dark',
        surface: 'desktop'
      }
    }
    return context
  }

  function flush() {
    pending = false
    var snapshot = listeners.slice()
    var ctx = currentContext()
    for (var i = 0; i < snapshot.length; i += 1) {
      try {
        snapshot[i](ctx)
      } catch (error) {
        console.error('HomeLayer ready listener failed', error)
      }
    }
  }

  function schedule() {
    if (pending) return
    pending = true
    setTimeout(flush, 0)
  }

  function ready(callback) {
    if (typeof callback === 'function') {
      listeners.push(callback)
      schedule()
    }
    return Promise.resolve(currentContext())
  }

  function getContext() {
    return currentContext()
  }

  Object.defineProperty(window, 'hl', {
    value: Object.freeze({
      version: 1,
      ready: ready,
      getContext: getContext
    }),
    writable: false,
    configurable: false
  })
})()
