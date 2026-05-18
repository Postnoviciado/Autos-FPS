import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </StrictMode>
)

// Registrar Service Worker para notificaciones en background
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((reg) => {
      console.log('[App] Service Worker registered:', reg)
      
      // Pedir permiso para notificaciones push en background
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            console.log('[App] Notification permission granted')
          }
        })
      }
    })
    .catch((err) => {
      console.warn('[App] Service Worker registration failed:', err)
    })
}
