import { useState, useSyncExternalStore } from 'react'
import { installController } from './pwa'

export default function InstallApp() {
  const state = useSyncExternalStore(installController.subscribe, installController.getSnapshot)
  const [help, setHelp] = useState(false)
  if (state.installed) return null
  const install = async () => {
    if (state.busy) return
    if (state.available) { setHelp(false); await installController.install() }
    else setHelp(value => !value)
  }
  return <section className="install-panel" aria-label="Instalar aplicación">
    <div className="install-intro"><img src={`${import.meta.env.BASE_URL}branding/icon-192.png`} width="36" height="36" alt=""/><div><strong>Tu centro de control, a un toque.</strong><p>Añádelo a tu pantalla de inicio para abrirlo como aplicación.</p></div></div>
    <button className="button primary" disabled={state.busy} onClick={() => void install()} aria-expanded={help} aria-controls="install-instructions">{state.busy ? 'Abriendo instalación…' : 'Instalar aplicación'}</button>
    {state.message && <p className="install-message" role="status">{state.message}</p>}
    {help && <div className="install-instructions" id="install-instructions"><strong>Desde Chrome, Edge o un navegador compatible:</strong><ol><li>Abre el menú del navegador (⋮).</li><li>Selecciona «Instalar aplicación» o «Añadir a pantalla de inicio».</li><li>Confirma la instalación.</li></ol><p>Si aún no aparece, vuelve a visitar la web después de navegar por ella. La opción depende del navegador y de si ya está instalada.</p><p>En iPhone: abre la web en Safari y usa Compartir → Añadir a pantalla de inicio.</p>{!window.isSecureContext && <p>Para instalarla, abre la web publicada mediante HTTPS.</p>}</div>}
  </section>
}
