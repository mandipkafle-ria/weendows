import { Menu, Tray, nativeImage, type NativeImage } from 'electron'
import { readFileSync } from 'node:fs'
import { APP_NAME } from '../shared/constants'
import trayIcon16 from '../../resources/tray.png?asset'
import trayIcon32 from '../../resources/tray@2x.png?asset'

export interface TrayActions {
  openSettings: () => void
  quit: () => void
  getEditMode: () => boolean
  toggleEditMode: () => void
}

export interface TrayController {
  tray: Tray
  refresh: () => void
  destroy: () => void
}

function toDataUrl(path: string): string {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

function createTrayImage(): NativeImage {
  const image = nativeImage.createEmpty()
  image.addRepresentation({ scaleFactor: 1, dataURL: toDataUrl(trayIcon16) })
  image.addRepresentation({ scaleFactor: 2, dataURL: toDataUrl(trayIcon32) })
  return image
}

function buildMenu(actions: TrayActions): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Edit layout',
      type: 'checkbox',
      checked: actions.getEditMode(),
      click: actions.toggleEditMode
    },
    { type: 'separator' },
    { label: 'Open settings', click: actions.openSettings },
    { type: 'separator' },
    { label: 'Quit', click: actions.quit }
  ])
}

export function createTray(actions: TrayActions): TrayController {
  const tray = new Tray(createTrayImage())
  tray.setToolTip(APP_NAME)

  const refresh = (): void => {
    tray.setContextMenu(buildMenu(actions))
  }

  tray.on('click', () => actions.openSettings())
  refresh()

  return {
    tray,
    refresh,
    destroy: () => tray.destroy()
  }
}
