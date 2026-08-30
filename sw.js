/* Arabify — service worker
   إستراتيجية: Network-first لصفحات HTML (لتجنّب تعليق نسخة قديمة من
   الموقع للمستخدمين كما حدث بالإصدار السابق)، Cache-first للأصول
   الثابتة (CSS/JS/صور) لتسريع الزيارات المتكررة والعمل دون اتصال جزئيًا. */
const CACHE = "arabify-v3"; // ⚠️ يجب رفع الرقم مع كل نشر جديد لإجبار تفريغ الكاش القديم
const STATIC_ASSETS = [
  "./css/tokens.css",
  "./css/editor.css",
  "./js/app.js",
  "./js/editor.js",
  "./js/supabase-client.js",
  "./manifest.json",
  "./assets/default-avatar.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isNavigation = e.request.mode === "navigate" || e.request.destination === "document";

  if (isNavigation) {
    // Network-first: يضمن دائمًا أحدث نسخة من الصفحة، ويرجع للكاش فقط عند انقطاع الاتصال
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // الأصول الثابتة: Cache-first مع تحديث في الخلفية
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
