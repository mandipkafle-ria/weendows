import { Menu, Tray, nativeImage, type NativeImage } from 'electron'
import { readFileSync } from 'node:fs'
import { APP_NAME } from '../shared/constants'
import trayIcon16 from '../../resources/tray.png?asset'
import trayIcon32 from '../../resources/tray@2x.png?asset'

function toDataUrl(path: string): string {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

function createTrayImage(): NativeImage {
  const image = nativeImage.createEmpty()
  image.addRepresentation({ scaleFactor: 1, dataURL: toDataUrl(trayIcon16) })
  image.addRepresentation({ scaleFactor: 2, dataURL: toDataUrl(trayIcon32) })
  return image
}

export function createTray(onOpenSettings: () => void, onQuit: () => void): Tray {
  const tray = new Tray(createTrayImage())
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open settings', click: onOpenSettings },
      { type: 'separator' },
      { label: 'Quit', click: onQuit }
    ])
  )
  return tray
}
