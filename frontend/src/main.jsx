import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

// Global error catcher for debugging white screens in production
window.onerror = function (message, source, lineno, colno, error) {
  const errorMsg = `ERROR: ${message} at ${source}:${lineno}:${colno}`;
  console.error(errorMsg);
  // Optional: add a visual indicator if it's really white
  if (document.getElementById('root')) {
    document.getElementById('root').innerHTML = `<div style="padding: 20px; background: white; color: red;"><h1>Initialization Error</h1><p>${errorMsg}</p></div>`;
  }
};

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  console.error('React Root Render Error:', e);
}
