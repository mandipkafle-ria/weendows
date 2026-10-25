import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        input: {
          'settings-preload': resolve('src/preload/settings-preload.ts'),
          'shell-preload': resolve('src/preload/shell-preload.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer')
      }
    },
    build: {
      rollupOptions: {
        input: {
          settings: resolve('src/renderer/settings/index.html'),
          'widget-shell': resolve('src/renderer/widget-shell/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
