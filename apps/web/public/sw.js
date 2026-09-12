// Service worker только для Web Push — не занимается офлайн-кэшированием
// страниц/ассетов, только принимает пуши и открывает нужную ссылку по клику.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Yoz", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Yoz", {
      body: data.body || "",
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const origin = self.location.origin;
      const existing = clientsArr.find((c) => c.url.startsWith(origin));
      if (existing) {
        existing.focus();
        if ("navigate" in existing) return existing.navigate(url);
        return;
      }
      return self.clients.openWindow(url);
    })
  );
});
