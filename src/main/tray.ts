import {
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron'
import { readFileSync } from 'node:fs'
import { APP_NAME } from '../shared/constants'
import { t } from './i18n'
import trayIcon16 from '../../resources/tray.png?asset'
import trayIcon32 from '../../resources/tray@2x.png?asset'

export interface TrayWidgetOption {
  type: string
  name: string
}

export interface TrayActions {
  version: string
  openSettings: () => void
  quit: () => void
  getEditMode: () => boolean
  toggleEditMode: () => void
  getAddableWidgets: () => TrayWidgetOption[]
  addWidget: (builtinType: string) => void
  getLiveWallpaperPaused?: () => boolean
  toggleLiveWallpaperPause?: () => void
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
  const widgets = actions.getAddableWidgets()
  const addWidgetItems: MenuItemConstructorOptions[] =
    widgets.length > 0
      ? widgets.map((widget) => ({
          label: widget.name,
          click: () => actions.addWidget(widget.type)
        }))
      : [{ label: t('tray.noWidgets'), enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: t('tray.editLayout'),
      type: 'checkbox',
      checked: actions.getEditMode(),
      click: actions.toggleEditMode
    },
    { label: t('tray.addWidget'), submenu: addWidgetItems }
  ]

  if (actions.getLiveWallpaperPaused && actions.toggleLiveWallpaperPause) {
    template.push(
      { type: 'separator' },
      {
        label: t('tray.pauseLiveWallpaper'),
        type: 'checkbox',
        checked: actions.getLiveWallpaperPaused(),
        click: () => actions.toggleLiveWallpaperPause?.()
      }
    )
  }

  template.push(
    { type: 'separator' },
    { label: t('tray.settings'), click: actions.openSettings },
    { type: 'separator' },
    { label: t('tray.quit'), click: actions.quit }
  )

  return Menu.buildFromTemplate(template)
}

export function createTray(actions: TrayActions): TrayController {
  const tray = new Tray(createTrayImage())
  tray.setToolTip(`${APP_NAME} ${actions.version}`)

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
