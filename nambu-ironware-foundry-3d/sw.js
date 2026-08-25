'use strict';
const PREFIX='nambu-foundry-';
const CACHE='nambu-foundry-v1.2.0-continuous-surface';
const SHELL=['./','index.html','styles.css','manifest.webmanifest','icons/icon.svg','icons/maskable.svg','js/bootstrap.js','js/data.js','js/core.js','js/models.js','js/gesture.js','js/game.js','js/progressive.js','js/ui.js','js/main.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys(),hadPrevious=keys.some(key=>key.startsWith(PREFIX)&&key!==CACHE);
  await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  if(hadPrevious){const clients=await self.clients.matchAll({type:'window'});await Promise.all(clients.map(client=>client.navigate(client.url).catch(()=>null)))}
})()));
async function networkFirst(request){
  try{const response=await fetch(request);if(response.ok||response.type==='opaque'){const cache=await caches.open(CACHE);cache.put(request,response.clone()).catch(()=>{})}return response}catch(error){const hit=await caches.match(request);if(hit)return hit;if(request.mode==='navigate'){const fallback=await caches.match('index.html');if(fallback)return fallback}throw error}
}
async function cacheFirst(request){const hit=await caches.match(request);if(hit)return hit;return networkFirst(request)}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;const url=new URL(event.request.url),same=url.origin===self.location.origin,critical=same&&(event.request.mode==='navigate'||event.request.destination==='script'||event.request.destination==='style'||event.request.destination==='document');event.respondWith(critical?networkFirst(event.request):cacheFirst(event.request));
});
