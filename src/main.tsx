import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { armChunkRecovery } from '@/lib/lazyRoute'

// The app booted, so whatever chunk problem caused a recovery reload earlier in
// this tab is behind us. Clearing the flag re-arms the one-shot reload for a
// deploy that lands later in the same session — otherwise a user who kept a tab
// open across two deploys would get the error screen on the second one.
armChunkRecovery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
