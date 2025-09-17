// Polyfills for Node.js globals - must be first
import { Buffer } from 'buffer'
import process from 'process'

// Make polyfills available globally
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer
  globalThis.process = process
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
  window.process = process
}

// Verify polyfills are loaded (remove in production)
console.log('Polyfills loaded:', { 
  Buffer: typeof window.Buffer !== 'undefined', 
  process: typeof window.process !== 'undefined' 
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
