self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'Alerta do Aura Run!',
        icon: data.icon || '/logo.png',
        badge: '/logo.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/races'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Aura Run', options)
      );
    } catch (e) {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('Aura Run', {
          body: text,
          icon: '/logo.png',
          data: { url: '/races' }
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/races', self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
