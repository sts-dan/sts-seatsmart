import './App.css' // This triggers the processing
import React from 'react'
import { createRoot } from 'react-dom/client' // FIX 1: Import createRoot specifically
import App from './App'

// FIX 2: Use React.StrictMode or import { StrictMode } from 'react'
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)