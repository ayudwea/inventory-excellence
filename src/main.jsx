import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MIRARoot from './MIRARoot.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MIRARoot />
  </StrictMode>,
)
