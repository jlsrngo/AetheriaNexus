import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, getStoredTheme } from './lib/theme'
import { initDesktopBridge } from './lib/desktopBridge'
import { disableDefaultWebBehaviors } from './lib/webBehaviors'

// Initial desktop bridge & theme on boot
initDesktopBridge();
applyTheme(getStoredTheme());

// Disable default web browser behaviors
disableDefaultWebBehaviors(window, false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
