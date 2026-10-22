export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
type InstallState = { installed: boolean; available: boolean; busy: boolean; message: string }
const initialState: InstallState = { installed: false, available: false, busy: false, message: '' }

// Estado compartido: captura el evento antes de montar la interfaz.
export function createInstallController(target: Window) {
  let state = initialState
  let promptEvent: InstallPromptEvent | null = null
  let started = false
  const listeners = new Set<() => void>()
  const display = target.matchMedia('(display-mode: standalone)')
  const isInstalled = () => display.matches || !!(target.navigator as Navigator & { standalone?: boolean }).standalone
  const update = (patch: Partial<InstallState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  const beforeInstall = (event: Event) => {
    event.preventDefault()
    promptEvent = event as InstallPromptEvent
    update({ available: true, message: '' })
  }
  const installed = () => { promptEvent = null; update({ installed: true, available: false, busy: false, message: '' }) }
  const displayChanged = () => { if (isInstalled()) installed(); else update({ installed: false }) }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      if (started) return
      started = true
      update({ installed: isInstalled() })
      target.addEventListener('beforeinstallprompt', beforeInstall)
      target.addEventListener('appinstalled', installed)
      display.addEventListener('change', displayChanged)
    },
    async install() {
      const event = promptEvent
      if (!event || state.busy || state.installed) return false
      promptEvent = null
      update({ busy: true, available: false, message: '' })
      try {
        await event.prompt()
        const result = await event.userChoice
        if (!state.installed) update({ message: result.outcome === 'accepted' ? 'Instalación solicitada. Confírmala en el navegador.' : 'Puedes instalar la aplicación más adelante desde el menú del navegador.' })
      } catch { update({ message: 'No se pudo abrir la instalación. Utiliza el menú del navegador.' }) }
      finally { update({ busy: false }) }
      return true
    },
  }
}
