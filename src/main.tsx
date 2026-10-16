import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { seededRng, setRng } from './engine/rng.ts'
import './styles.css'

const seed = new URLSearchParams(window.location.search).get('seed')
if (seed !== null && Number.isFinite(Number(seed))) setRng(seededRng(Number(seed)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
