import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import App from './App'
import { AppProvider } from './ctx'
import { InstallPrompt } from './components/InstallPrompt'
import { registerServiceWorker } from './lib/install'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
        <InstallPrompt />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
