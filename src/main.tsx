import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { initializeTelegram } from './telegram/init'
import { isTelegramLaunchHash } from './telegram/location'
import './styles.css'
import './responsive.css'
import './dark-theme.css'

initializeTelegram()
if (isTelegramLaunchHash(window.location.hash)) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><App /></HashRouter></StrictMode>)
