const V='does-v2';
const FILES=['./','index.html','style.css','app.js','manifest.json','icons/logo.png','icons/icon-192.png','icons/icon-512.png','fonts/cairo-400.ttf','fonts/cairo-700.ttf','fonts/cairo-800.ttf'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url); if(u.origin!==location.origin)return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r&&r.status===200){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp));}return r}).catch(()=>hit);
    return hit||net;
  }));
});
