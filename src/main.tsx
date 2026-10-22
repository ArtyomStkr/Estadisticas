import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installController, registerServiceWorker } from './pwa'
import './index.css'
import App from './App.tsx'

installController.start()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
