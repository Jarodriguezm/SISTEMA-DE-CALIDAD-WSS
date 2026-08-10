import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { iniciarMonitor } from './lib/monitor'

// Captura de errores del navegador → tabla errores_app
iniciarMonitor()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
