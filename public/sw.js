/* Service Worker para notificaciones en background */

const CACHE_NAME = 'autosfps-v1'
const NOTIFICATION_CHECK_INTERVAL = 60 * 60 * 1000 // 1 hora

/**
 * Instalación del SW: cachear archivos críticos
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  self.skipWaiting()
})

/**
 * Activación del SW
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(self.clients.claim())
})

/**
 * Sincronización en background (requiere permiso)
 * Verifica recordatorios cada cierto tiempo
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders())
  }
})

/**
 * Manejador de notificaciones pushadas (del servidor)
 * Aún no lo implementamos, pero está listo
 */
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  try {
    const data = event.data.json()
    const options = {
      body: data.body || 'Nuevo recordatorio',
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: data.tag || 'reminder',
      requireInteraction: true, // Mantener hasta que el usuario interactúe
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Recordatorio', options)
    )
  } catch (err) {
    console.warn('[SW] Error processing push:', err)
  }
})

/**
 * Clic en la notificación: abrir la app
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Si ya existe una ventana abierta, enfocarse en ella
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus()
        }
      }
      // Si no existe, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow('/')
      }
    })
  )
})

/**
 * Función para verificar recordatorios
 * En el futuro, aquí llamarías a una API para traer recordatorios pendientes
 */
async function checkReminders() {
  console.log('[SW] Checking reminders...')
  
  // Aquí puedes agregar lógica para:
  // 1. Llamar a una API para traer recordatorios pendientes
  // 2. Mostrar notificaciones con self.registration.showNotification()
  
  // Por ahora solo es un placeholder
}

/**
 * Fetch: estrategia network-first para datos, cache-first para assets
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // No cachear llamadas a APIs
  if (url.pathname.includes('/api/') || url.pathname.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Si falla la red, puedes devolver una respuesta vacía o cached
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    return
  }
  
  // Cache para assets estáticos
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache)
        })
        
        return response
      })
    })
  )
})

/**
 * Sincronización periódica (experimental, requiere permiso)
 */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-reminders') {
    event.waitUntil(checkReminders())
  }
})
