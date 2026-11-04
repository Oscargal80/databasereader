import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

// Global error catcher for debugging white screens in production
window.onerror = function (message, source, lineno, colno, error) {
  // Browsers report this as an error although nothing is broken
  if (String(message).includes('ResizeObserver')) return true;

  const errorMsg = `ERROR: ${message} at ${source}:${lineno}:${colno}`;
  console.error(errorMsg);
  // Optional: add a visual indicator if it's really white
  const root = document.getElementById('root');
  if (root) {
    const box = document.createElement('div');
    box.style.cssText = 'padding: 20px; background: white; color: red;';
    const title = document.createElement('h1');
    title.textContent = 'Initialization Error';
    const detail = document.createElement('p');
    detail.textContent = errorMsg;
    box.append(title, detail);
    root.replaceChildren(box);
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
