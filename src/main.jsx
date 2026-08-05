import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: 'https://13a131956b538c408575efe1763c2d5b@o4511853982121984.ingest.us.sentry.io/4511854062796800',
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
