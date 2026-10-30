import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {
    build: {
      isolatedEntries: true,
      externalizeDeps: false,
      rollupOptions: {
        input: {
          'settings-preload': resolve('src/preload/settings-preload.ts'),
          'shell-preload': resolve('src/preload/shell-preload.ts'),
          'badge-preload': resolve('src/preload/badge-preload.ts'),
          'bundle-preload': resolve('src/preload/bundle-preload.ts'),
          'wallpaper-preload': resolve('src/preload/wallpaper-preload.ts'),
          'taskbar-preload': resolve('src/preload/taskbar-preload.ts')
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
          'widget-shell': resolve('src/renderer/widget-shell/index.html'),
          'wallpaper-host': resolve('src/renderer/wallpaper-host/index.html'),
          'wallpaper-thumbnail': resolve('src/renderer/wallpaper-thumbnail/index.html'),
          taskbar: resolve('src/renderer/taskbar/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
