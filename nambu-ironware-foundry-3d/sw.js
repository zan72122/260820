'use strict';
const CACHE='nambu-foundry-v1.0.0-release';
const SHELL=['./','index.html','styles.css','manifest.webmanifest','icons/icon.svg','icons/maskable.svg','js/bootstrap.js','js/data.js','js/core.js','js/models.js','js/game.js','js/ui.js','js/main.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok||response.type==='opaque'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{})}return response}).catch(()=>event.request.mode==='navigate'?caches.match('index.html'):Response.error())));
});
