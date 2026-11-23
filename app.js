'use strict';
/* DOES - shop management */
const KEY = 'does_db_v1', AUTHKEY = 'does_auth_v1', PREVKEY = 'does_db_prev';
const $ = s => document.querySelector(s);
const bd = s => '<bdi>' + esc(s) + '</bdi>';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const num = v => { v = String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.').trim(); const n = parseFloat(v); return isFinite(n) ? n : 0; };
const M = n => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const dur = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dmy = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const dt = t => dmy(t) + ' ' + hm(t);
const CUR = 'ج.م';
const TYPES = { ps: 'بلايستيشن', billiard: 'بلياردو', pong: 'بنج بونج', tv: 'نتفليكس' };
const CATS = { drink: 'مشروبات', food: 'أكل', snack: 'سناكس', other: 'حاجات تانية' };

/* ---------- storage ---------- */
let DB, USER = null;
function seed() {
  const P = (name, cat, price, stock, cost) => ({ id: uid(), name, cat, price, vip: 0, stock, track: true, cost: cost || 0, on: true });
  return {
    v: 1,
    settings: { shop: 'DOES', step: 1, roundTo: 1, dayStart: 6, lowStock: 5, footer: 'شكراً لزيارتكم DOES', wa: '', blockZero: false, lastNo: 0 },
    users: [],
    stations: [
      { id: 'st1', name: 'Room Marvel PS4', type: 'ps', price: 50, vip: 0, on: true },
      { id: 'st2', name: 'Room Porsche PS4', type: 'ps', price: 40, vip: 0, on: true },
      { id: 'st3', name: 'Room 5 PS4', type: 'ps', price: 40, vip: 0, on: true },
      { id: 'st4', name: 'Galaxy Room VIP PS5', type: 'ps', price: 70, vip: 0, on: true },
      { id: 'st5', name: 'Blue billiard table', type: 'billiard', price: 50, vip: 0, on: true },
      { id: 'st6', name: 'Red billiard table', type: 'billiard', price: 50, vip: 0, on: true },
      { id: 'st7', name: 'King pong room', type: 'pong', price: 50, vip: 0, on: true },
      { id: 'st8', name: 'Netflix room', type: 'tv', price: 80, vip: 0, on: true }
    ],
    products: [
      P('شاي', 'drink', 15, 40), P('قهوة', 'drink', 25, 30), P('نسكافيه', 'drink', 25, 30), P('مياه', 'drink', 10, 48),
      P('بيبسي', 'drink', 20, 36), P('ريد بول', 'drink', 60, 12), P('عصير', 'drink', 25, 24),
      P('شيبسي', 'snack', 15, 30), P('بسكويت', 'snack', 10, 30), P('ساندوتش جبنة', 'food', 30, 15), P('بيتزا صغيرة', 'food', 70, 8)
    ],
    invoices: [], expenses: [], stockLog: [], closings: []
  };
}
function load() {
  try { const r = localStorage.getItem(KEY); if (r) { DB = JSON.parse(r); return; } } catch (e) { console.error(e); }
  DB = seed();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('تحذير: مش قادر يحفظ البيانات (المساحة ممتلئة)'); }
}
function dailyBackup() {
  try { const d = dmy(Date.now()); if (localStorage.getItem(PREVKEY + '_day') !== d) { const cur = localStorage.getItem(KEY); if (cur) { localStorage.setItem(PREVKEY, cur); localStorage.setItem(PREVKEY + '_day', d); } } } catch (e) { }
}
async function hash(p, salt) {
  const s = salt + '|' + p;
  try { if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } } catch (e) { }
  let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'f' + h;
}
async function ensureAdmin() {
  if (!DB.users.length) { const salt = uid(); DB.users.push({ id: uid(), u: 'admin', salt, h: await hash('123456', salt), role: 'admin', name: 'المدير', def: true }); save(); }
}

/* ---------- helpers ---------- */
const isAdmin = () => USER && USER.role === 'admin';
const prod = id => DB.products.find(p => p.id === id);
const station = id => DB.stations.find(s => s.id === id);
const inv = id => DB.invoices.find(i => i.id === id);
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
function bday(ts) { return dmy(ts - (DB.settings.dayStart || 0) * 3600e3); }
function dayRange(ymd) { const [y, m, d] = ymd.split('-').map(Number); const a = new Date(y, m - 1, d, DB.settings.dayStart || 0).getTime(); return [a, new Date(y, m - 1, d + 1, DB.settings.dayStart || 0).getTime()]; }
function logInv(i, msg) { (i.log = i.log || []).push({ t: Date.now(), by: USER ? USER.name || USER.u : '', msg }); }

/* ---------- billing ---------- */
function segMin(sg, now) { return Math.max(0, ((sg.to || now) - sg.from) / 60000); }
function segCost(sg, now) { let m = segMin(sg, now); const st = DB.settings.step || 1; if (st > 1) m = Math.ceil(m / st) * st; return sg.rate * m / 60; }
function timeCost(i, now) {
  if (i.final) return i.final.timeGross;
  if (i.kind !== 'session') return 0; now = now || Date.now();
  const raw = i.segs.reduce((a, s) => a + segCost(s, now), 0); const r = DB.settings.roundTo || 0;
  return r > 0 ? Math.round(raw / r) * r : Math.round(raw * 100) / 100;
}
const merchCost = i => i.final ? i.final.merchGross : i.items.reduce((a, x) => a + x.qty * x.unit, 0);
function discAmt(i, gross) { const d = i.disc || { type: 'amt', val: 0 }; let a = d.type === 'pct' ? gross * d.val / 100 : d.val; return Math.max(0, Math.min(gross, Math.round(a * 100) / 100)); }
function totals(i, now) {
  if (i.final) return i.final;
  const t = timeCost(i, now), m = merchCost(i), g = t + m, d = discAmt(i, g), tot = g - d;
  const tm = g ? Math.round((t - d * t / g) * 100) / 100 : 0;
  return { timeGross: t, merchGross: m, gross: g, disc: d, total: tot, timeMoney: tm, merchMoney: Math.round((tot - tm) * 100) / 100 };
}
function elapsedMs(i, now) { now = now || Date.now(); return i.segs.reduce((a, s) => a + ((s.to || now) - s.from), 0); }
const openInvs = () => DB.invoices.filter(i => i.status === 'open');
const invAt = sid => DB.invoices.find(i => i.status === 'open' && i.kind === 'session' && i.sid === sid);
function newInvoice(kind, extra) {
  DB.settings.lastNo++; const i = Object.assign({ id: uid(), no: DB.settings.lastNo, kind, status: 'open', createdAt: Date.now(), customer: '', vip: false, segs: [], items: [], disc: { type: 'amt', val: 0 }, log: [], by: USER ? USER.name || USER.u : '' }, extra || {});
  DB.invoices.push(i); return i;
}
function startSession(sid, o) {
  const s = station(sid); if (!s || invAt(sid)) return null;
  const vip = !!(o.vip && s.vip > 0);
  const i = newInvoice('session', { sid, sname: s.name, vip, customer: o.customer || '', target: o.target || 0, paused: false });
  i.segs.push({ sid, name: s.name, rate: vip ? s.vip : s.price, vip, from: Date.now(), to: null });
  logInv(i, 'بدأ الوقت على ' + s.name + (vip ? ' (سعر VIP)' : '')); save(); return i;
}
function closeSeg(i, now) { const sg = i.segs[i.segs.length - 1]; if (sg && !sg.to) sg.to = now || Date.now(); }
function openSeg(i, s, vip) { i.segs.push({ sid: s.id, name: s.name, rate: vip ? s.vip : s.price, vip, from: Date.now(), to: null }); }
function transfer(i, sid) {
  const s = station(sid); if (!s || invAt(sid)) return false; const old = i.sname;
  const vip = !!(i.vip && s.vip > 0);
  if (!i.paused) { closeSeg(i); openSeg(i, s, vip); }
  i.sid = sid; i.sname = s.name; i.pendingVip = vip;
  logInv(i, 'نقل من ' + old + ' إلى ' + s.name + ' (نفس الفاتورة)'); save(); return true;
}
function pauseToggle(i) {
  if (!i.paused) { closeSeg(i); i.paused = true; logInv(i, 'إيقاف مؤقت'); }
  else { const s = station(i.sid); const vip = !!(i.vip && s && s.vip > 0); openSeg(i, s || { id: i.sid, name: i.sname, price: i.segs[i.segs.length - 1].rate, vip: 0 }, vip); i.paused = false; logInv(i, 'استئناف'); }
  save();
}
function setRateVip(i, vip) {
  const s = station(i.sid); if (!s) return; if (vip && !(s.vip > 0)) { toast('مفيش سعر VIP للمكان ده'); return; }
  i.vip = vip; if (!i.paused && i.kind === 'session') { closeSeg(i); openSeg(i, s, vip); }
  logInv(i, vip ? 'تحويل الوقت لسعر VIP' : 'تحويل الوقت للسعر العادي'); save();
}
function addItem(i, pid) {
  const p = prod(pid); if (!p) return;
  if (p.track && p.stock <= 0 && DB.settings.blockZero) { toast('المخزون خلص: ' + p.name); return; }
  const vip = !!(i.vip && p.vip > 0); const unit = vip ? p.vip : p.price;
  let it = i.items.find(x => x.pid === pid && x.unit === unit && !!x.vip === vip);
  if (it) it.qty++; else i.items.push({ id: uid(), pid, name: p.name, qty: 1, unit, vip, cost: p.cost || 0 });
  if (p.track) { p.stock--; if (p.stock < 0) toast('تنبيه: المخزون بقى بالسالب (' + p.name + ')'); else if (p.stock <= DB.settings.lowStock) toast('المخزون قرب يخلص: ' + p.name + ' (' + p.stock + ')'); }
  save();
}
function qtyItem(i, itId, d) {
  const it = i.items.find(x => x.id === itId); if (!it) return; const p = prod(it.pid);
  if (d > 0) { if (p && p.track && p.stock <= 0 && DB.settings.blockZero) { toast('المخزون خلص'); return; } it.qty++; if (p && p.track) p.stock--; }
  else { it.qty--; if (p && p.track) p.stock++; if (it.qty <= 0) { i.items = i.items.filter(x => x !== it); logInv(i, 'مرتجع/حذف: ' + it.name); } }
  save();
}
function removeItem(i, itId) {
  const it = i.items.find(x => x.id === itId); if (!it) return; const p = prod(it.pid);
  if (p && p.track) p.stock += it.qty; i.items = i.items.filter(x => x !== it); logInv(i, 'مرتجع/حذف: ' + it.name + ' ×' + it.qty); save();
}
function toggleItemVip(i, itId) {
  const it = i.items.find(x => x.id === itId); const p = it && prod(it.pid); if (!p) return;
  if (!(p.vip > 0)) { toast('مفيش سعر VIP للمنتج ده'); return; }
  it.vip = !it.vip; it.unit = it.vip ? p.vip : p.price; logInv(i, it.name + (it.vip ? ' بسعر VIP' : ' بالسعر العادي')); save();
}
function closeInvoice(i, method, customer) {
  const now = Date.now(); if (i.kind === 'session') closeSeg(i, now);
  const t = totals(i, now); i.final = t; i.closedAt = now; i.status = method === 'credit' ? 'credit' : 'paid';
  if (method === 'credit') i.customer = customer; i.method = method; logInv(i, method === 'credit' ? 'قفل آجل على ' + customer : 'قفل ودفع كاش'); save();
}
function voidInvoice(i) {
  i.items.forEach(it => { const p = prod(it.pid); if (p && p.track) p.stock += it.qty; });
  if (i.kind === 'session') closeSeg(i); i.status = 'void'; i.closedAt = Date.now(); logInv(i, 'إلغاء الفاتورة'); save();
}
function periodInvoices(a, b) { return DB.invoices.filter(i => (i.status === 'paid' || i.status === 'credit') && i.closedAt >= a && i.closedAt < b); }
function report(a, b) {
  const L = periodInvoices(a, b); const R = { n: L.length, time: 0, merch: 0, total: 0, disc: 0, credit: 0, cash: 0, units: 0, cost: 0, prods: {}, sts: {} };
  L.forEach(i => {
    const f = i.final; R.time += f.timeMoney; R.merch += f.merchMoney; R.total += f.total; R.disc += f.disc;
    if (i.status === 'credit') R.credit += f.total; else R.cash += f.total;
    i.items.forEach(it => { R.units += it.qty; R.cost += it.qty * (it.cost || 0); const o = R.prods[it.pid] = R.prods[it.pid] || { name: it.name, q: 0, m: 0 }; o.q += it.qty; o.m += it.qty * it.unit; });
    if (i.kind === 'session') {
      i.segs.forEach(sg => { const o = R.sts[sg.sid] = R.sts[sg.sid] || { name: sg.name, min: 0, money: 0, n: 0 }; o.min += segMin(sg, i.closedAt); });
      const f1 = i.final.timeMoney; const tot = i.segs.reduce((x, sg) => x + segCost(sg, i.closedAt), 0) || 1;
      i.segs.forEach(sg => { R.sts[sg.sid].money += f1 * segCost(sg, i.closedAt) / tot; });
      const last = R.sts[i.segs[i.segs.length - 1].sid]; if (last) last.n++;
    }
  });
  const E = DB.expenses.filter(e => e.at >= a && e.at < b); R.exp = E.reduce((x, e) => x + e.amount, 0); R.net = R.total - R.exp;
  return R;
}
function stockUnits() { return DB.products.filter(p => p.on && p.track).reduce((a, p) => a + Math.max(0, p.stock), 0); }
function stockMove(pid, delta, why) { const p = prod(pid); if (!p) return; p.stock += delta; DB.stockLog.push({ t: Date.now(), pid, name: p.name, delta, why, by: USER ? USER.u : '' }); if (DB.stockLog.length > 2000) DB.stockLog.shift(); save(); }

/* ---------- UI state ---------- */
const UI = { page: 'home', ptab: 'st', q: '', cat: 'all', rangeDay: null, rangeMode: 'day', invFilter: 'all', invQ: '', invDay: null, sid: null };
const PAGES = [
  ['home', 'الرئيسية', '🎮'], ['counter', 'كاشير', '🧾'], ['invoices', 'الفواتير', '📋'], ['prices', 'الأسعار', '💲'], ['stock', 'المخزون', '📦'],
  ['report', 'التقرير', '📊'], ['expenses', 'المصروفات', '💸'], ['settings', 'الإعدادات', '⚙️']
];
const STAFF_PAGES = ['home', 'counter', 'invoices'];
const pages = () => PAGES.filter(p => isAdmin() || STAFF_PAGES.includes(p[0]));
function render() {
  if (!USER) { renderLogin(); return; }
  if (!pages().some(p => p[0] === UI.page)) UI.page = 'home';
  const nav = (cls) => pages().map(p => `<button class="nav ${UI.page === p[0] ? 'on' : ''}" data-act="go" data-p="${p[0]}"><span class="ic">${p[2]}</span><span>${p[1]}</span></button>`).join('');
  const P = { home: pHome, counter: pCounter, invoices: pInvoices, prices: pPrices, stock: pStock, report: pReport, expenses: pExpenses, settings: pSettings }[UI.page];
  $('#root').innerHTML = `<div class="app"><aside class="side"><div class="brand"><img src="icons/logo.png" alt="DOES"></div>${nav()}<div class="sp"></div><div class="mut" style="font-size:12px;text-align:center">${esc(USER.name || USER.u)}</div><button class="nav" data-act="logout"><span class="ic">🚪</span><span>خروج</span></button></aside>
  <main class="main"><div class="top"><img class="mlogo" src="icons/logo.png" alt="DOES"><h1>${esc(PAGES.find(p => p[0] === UI.page)[1])}</h1><div class="sp"></div><span class="mut" id="clock"></span></div>${P()}</main>
  <nav class="bar">${nav()}</nav></div>`;
  tick();
}
function renderLogin(err) {
  $('#root').innerHTML = `<div class="login"><div class="box"><img src="icons/logo.png" alt="DOES"><div class="card"><form id="lf" autocomplete="on"><label class="f">اسم المستخدم</label><input id="lu" autocomplete="username" autocapitalize="off" required><label class="f">كلمة السر</label><input id="lp" type="password" autocomplete="current-password" required>
  <label class="row" style="margin:12px 0"><input type="checkbox" id="lr" checked style="width:auto;min-height:0"><span>فضّلني مسجّل دخول</span></label>${err ? `<div class="rd" style="font-weight:700;margin-bottom:8px">${esc(err)}</div>` : ''}<button class="btn pri blk" type="submit">دخول</button></form></div></div></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const u = $('#lu').value.trim().toLowerCase(), p = $('#lp').value;
    const x = DB.users.find(z => z.u.toLowerCase() === u);
    if (x && (await hash(p, x.salt)) === x.h) { USER = x; if ($('#lr').checked) localStorage.setItem(AUTHKEY, JSON.stringify({ id: x.id })); else localStorage.removeItem(AUTHKEY); UI.page = 'home'; render(); }
    else renderLogin('اسم المستخدم أو كلمة السر غلط');
  };
}

/* ---------- pages ---------- */
function liveStats() { const [a, b] = dayRange(bday(Date.now())); return report(a, b); }
function pHome() {
  const R = liveStats(); const open = openInvs();
  const def = isAdmin() && USER.def ? `<div class="warn">لسه بتستخدم الباسورد الافتراضي. غيّره من الإعدادات.</div>` : '';
  const stats = isAdmin() ? `<div class="grid g-stat"><div class="stat"><div class="l">مفتوح دلوقتي</div><div class="v">${open.filter(i => i.kind === 'session').length}</div></div><div class="stat"><div class="l">فلوس الوقت النهارده</div><div class="v">${M(R.time)}</div></div><div class="stat"><div class="l">فلوس المنتجات النهارده</div><div class="v">${M(R.merch)}</div></div><div class="stat big"><div class="l">إجمالي المحل النهارده</div><div class="v">${M(R.total)} <small>${CUR}</small></div></div></div>` : `<div class="grid g-stat"><div class="stat"><div class="l">جلسات مفتوحة</div><div class="v">${open.filter(i => i.kind === 'session').length}</div></div></div>`;
  let h = def + stats;
  for (const [tp, nm] of Object.entries(TYPES)) {
    const L = DB.stations.filter(s => s.on && s.type === tp); if (!L.length) continue;
    h += `<div class="sec">${nm}</div><div class="grid g-st">${L.map(stCard).join('')}</div>`;
  }
  const co = open.filter(i => i.kind === 'counter');
  if (co.length) h += `<div class="sec">فواتير كاشير مفتوحة</div><div class="grid g-st">${co.map(i => `<div class="st busy" data-act="openinv" data-id="${i.id}"><div class="nm">فاتورة <bdi>#${i.no}</bdi></div><div class="pr">${esc(i.customer || 'بيع مباشر')}</div><div class="tm" style="font-size:22px" data-live="${i.id}:tot"></div></div>`).join('')}</div>`;
  return h;
}
function stCard(s) {
  const i = invAt(s.id);
  if (!i) return `<div class="st free" data-act="startmodal" data-id="${s.id}"><div class="row sb"><span class="nm">${bd(s.name)}</span><span class="badge gr">فاضي</span></div><div class="pr">${M(s.price)} ${CUR}/ساعة${s.vip > 0 ? ` · VIP ${M(s.vip)}` : ''}</div><div class="sp"></div><button class="btn pri blk">ابدأ الوقت</button></div>`;
  return `<div class="st busy ${i.paused ? 'paused' : ''}" id="card-${i.id}" data-act="openinv" data-id="${i.id}"><div class="row sb"><span class="nm">${bd(s.name)}</span><span class="badge ${i.paused ? 'am' : 'pk'}">${i.paused ? 'موقوف' : 'شغال'}${i.vip ? ' · VIP' : ''}</span></div>
  <div class="tm" data-live="${i.id}:el">00:00:00</div><div class="row sb"><span class="mut">وقت <b class="pk" data-live="${i.id}:tc"></b></span><span class="mut">منتجات <b data-live="${i.id}:mc"></b></span></div><div class="row sb"><span class="mut">${esc(i.customer || '')}</span><b data-live="${i.id}:tot" class="cy"></b></div></div>`;
}
function pCounter() {
  const open = openInvs().filter(i => i.kind === 'counter');
  return `<div class="card"><p class="mut" style="margin-top:0">بيع منتجات بدون وقت (زبون ماشي أو طلب سريع). كل فاتورة بتتسجّل في الفواتير ومفصولة عن فلوس الوقت.</p><button class="btn pri" data-act="newcounter">+ فاتورة بيع جديدة</button></div>
  ${open.length ? `<div class="sec">مفتوحة</div><div class="grid g-st">${open.map(i => `<div class="st busy" data-act="openinv" data-id="${i.id}"><div class="nm">فاتورة <bdi>#${i.no}</bdi></div><div class="pr">${esc(i.customer || '')}</div><div class="tm" style="font-size:22px" data-live="${i.id}:tot"></div></div>`).join('')}</div>` : ''}`;
}
const stLabel = { open: ['مفتوحة', 'pk'], paid: ['مدفوعة', 'gr'], credit: ['آجل', 'am'], void: ['ملغية', 'rd'] };
function pInvoices() {
  const day = UI.invDay || bday(Date.now()); const [a, b] = dayRange(day);
  let L = DB.invoices.filter(i => i.status === 'open' || (i.closedAt >= a && i.closedAt < b) || (UI.invFilter === 'credit' && i.status === 'credit'));
  if (UI.invFilter !== 'all') L = L.filter(i => i.status === UI.invFilter);
  if (UI.invQ) { const q = UI.invQ.toLowerCase(); L = L.filter(i => String(i.no) === q || (i.customer || '').toLowerCase().includes(q) || (i.sname || '').toLowerCase().includes(q)); }
  L = L.sort((x, y) => y.no - x.no);
  const sum = L.filter(i => i.final && i.status !== 'void').reduce((s, i) => s + i.final.total, 0);
  const credit = DB.invoices.filter(i => i.status === 'credit');
  return `<div class="card"><div class="row"><input type="date" style="width:auto" value="${day}" data-chg="invday"><select style="width:auto" data-chg="invfilter">${[['all', 'الكل'], ['open', 'مفتوحة'], ['paid', 'مدفوعة'], ['credit', 'آجل'], ['void', 'ملغية']].map(x => `<option value="${x[0]}" ${UI.invFilter === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select><input placeholder="رقم الفاتورة / الاسم" style="flex:1;min-width:140px" value="${esc(UI.invQ)}" data-chg="invq"></div>
  <div class="row sb" style="margin-top:8px"><span class="mut">${L.length} فاتورة</span><b>الإجمالي ${M(sum)} ${CUR}</b></div>${credit.length ? `<div class="am" style="margin-top:6px;font-weight:700">آجل لسه متحصّلش: ${M(credit.reduce((s, i) => s + i.final.total, 0))} ${CUR} (${credit.length} فاتورة)</div>` : ''}</div>
  <div class="tw" style="margin-top:12px"><table><thead><tr><th>#</th><th>المكان</th><th>وقت</th><th>منتجات</th><th>الإجمالي</th><th>الحالة</th><th></th></tr></thead><tbody>${L.length ? L.map(i => { const t = totals(i); return `<tr><td><b>${i.no}</b></td><td>${bd(i.kind === 'session' ? i.sname : 'كاشير')}${i.customer ? `<div class="mut" style="font-size:12px">${esc(i.customer)}</div>` : ''}<div class="mut" style="font-size:12px">${dt(i.closedAt || i.createdAt)}</div></td><td>${M(t.timeMoney != null && i.final ? t.timeMoney : t.timeGross)}</td><td>${M(i.final ? t.merchMoney : t.merchGross)}</td><td><b>${M(t.total)}</b></td><td><span class="badge ${stLabel[i.status][1]}">${stLabel[i.status][0]}</span></td><td><button class="btn sm" data-act="openinv" data-id="${i.id}">فتح</button></td></tr>`; }).join('') : `<tr><td colspan="7" class="empty">مفيش فواتير</td></tr>`}</tbody></table></div>`;
}
function pPrices() {
  const tabs = `<div class="tabs"><span class="tab ${UI.ptab === 'st' ? 'on' : ''}" data-act="ptab" data-t="st">أسعار الجلسات (الوقت)</span><span class="tab ${UI.ptab === 'pr' ? 'on' : ''}" data-act="ptab" data-t="pr">أسعار المنتجات</span></div>`;
  if (UI.ptab === 'st') return tabs + `<div class="card"><p class="mut" style="margin:0 0 8px">سعر الساعة لكل مكان. سعر VIP اختياري: اكتبه لو عايز تبيع الوقت بسعر مختلف، واتركه فاضي لو مفيش.</p><div class="row" style="margin-bottom:8px"><button class="btn pri" data-act="editst" data-id="">+ إضافة مكان</button></div></div>
  <div class="tw" style="margin-top:12px"><table><thead><tr><th>الاسم</th><th>النوع</th><th>سعر الساعة</th><th>سعر VIP (للساعة)</th><th></th></tr></thead><tbody>${DB.stations.map(s => `<tr style="${s.on ? '' : 'opacity:.5'}"><td><b>${bd(s.name)}</b></td><td>${TYPES[s.type]}</td><td><input type="number" inputmode="decimal" value="${s.price}" data-chg="stprice" data-id="${s.id}"></td><td><input type="number" inputmode="decimal" placeholder="—" value="${s.vip || ''}" data-chg="stvip" data-id="${s.id}"></td><td><button class="btn sm" data-act="editst" data-id="${s.id}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`;
  return tabs + `<div class="card"><p class="mut" style="margin:0 0 8px">أسعار الأكل والمشروبات (منفصلة عن الوقت). سعر VIP اختياري لكل منتج، وبتختار وقت البيع تبيع بالعادي ولا VIP.</p><button class="btn pri" data-act="editpr" data-id="">+ إضافة منتج</button></div>
  <div class="tw" style="margin-top:12px"><table><thead><tr><th>المنتج</th><th>القسم</th><th>السعر</th><th>سعر VIP</th><th></th></tr></thead><tbody>${DB.products.map(p => `<tr style="${p.on ? '' : 'opacity:.5'}"><td><b>${bd(p.name)}</b></td><td>${CATS[p.cat] || ''}</td><td><input type="number" inputmode="decimal" value="${p.price}" data-chg="prprice" data-id="${p.id}"></td><td><input type="number" inputmode="decimal" placeholder="—" value="${p.vip || ''}" data-chg="prvip" data-id="${p.id}"></td><td><button class="btn sm" data-act="editpr" data-id="${p.id}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`;
}
function pStock() {
  const low = DB.products.filter(p => p.on && p.track && p.stock <= DB.settings.lowStock);
  const val = DB.products.reduce((s, p) => s + (p.track ? Math.max(0, p.stock) * (p.cost || 0) : 0), 0);
  return `${low.length ? `<div class="warn">قرب يخلص: ${low.map(p => esc(p.name) + ' (' + p.stock + ')').join('، ')}</div>` : ''}<div class="grid g-stat"><div class="stat"><div class="l">عدد الأصناف</div><div class="v">${DB.products.filter(p => p.on).length}</div></div><div class="stat"><div class="l">إجمالي القطع في المخزون</div><div class="v">${stockUnits()}</div></div><div class="stat"><div class="l">قيمة المخزون بسعر التكلفة</div><div class="v">${M(val)}</div></div></div>
  <div class="tw" style="margin-top:12px"><table><thead><tr><th>المنتج</th><th>المتبقي</th><th>تتبّع</th><th></th></tr></thead><tbody>${DB.products.map(p => `<tr style="${p.on ? '' : 'opacity:.5'}"><td><b>${bd(p.name)}</b><div class="mut" style="font-size:12px">${CATS[p.cat] || ''}</div></td><td>${p.track ? `<b class="${p.stock <= 0 ? 'rd' : p.stock <= DB.settings.lowStock ? 'am' : 'gr'}" style="font-size:18px">${p.stock}</b>` : '<span class="mut">غير متتبع</span>'}</td><td><input type="checkbox" style="width:22px;min-height:0" ${p.track ? 'checked' : ''} data-chg="track" data-id="${p.id}"></td><td class="row"><button class="btn sm ok" data-act="restock" data-id="${p.id}">+ توريد</button><button class="btn sm" data-act="setstock" data-id="${p.id}">جرد</button></td></tr>`).join('')}</tbody></table></div>`;
}
function rangeOf() {
  const d = UI.rangeDay || bday(Date.now()); let a, b, lbl;
  if (UI.rangeMode === 'day') { [a, b] = dayRange(d); lbl = d; }
  else if (UI.rangeMode === 'week') { const [x, y] = dayRange(bday(Date.now())); a = x - 6 * 864e5; b = y; lbl = 'آخر 7 أيام'; }
  else { const [y, m] = d.split('-').map(Number); const f = dmy(new Date(y, m - 1, 1)); a = dayRange(f)[0]; b = dayRange(dmy(new Date(y, m, 1)))[0]; lbl = 'شهر ' + y + '-' + pad(m); }
  return [a, b, lbl];
}
function pReport() {
  const [a, b, lbl] = rangeOf(); const R = report(a, b);
  const prods = Object.values(R.prods).sort((x, y) => y.m - x.m), sts = Object.values(R.sts).sort((x, y) => y.money - x.money);
  const bars = []; const [t0] = dayRange(bday(Date.now())); for (let k = 6; k >= 0; k--) { const r = report(t0 - k * 864e5, t0 - k * 864e5 + 864e5); bars.push([dmy(t0 - k * 864e5 + 3600e3).slice(5), r.total]); }
  const mx = Math.max(1, ...bars.map(x => x[1]));
  const cl = DB.closings.slice(-6).reverse();
  return `<div class="card"><div class="row"><div class="tabs" style="margin:0"><span class="tab ${UI.rangeMode === 'day' ? 'on' : ''}" data-act="rmode" data-m="day">يوم</span><span class="tab ${UI.rangeMode === 'week' ? 'on' : ''}" data-act="rmode" data-m="week">7 أيام</span><span class="tab ${UI.rangeMode === 'month' ? 'on' : ''}" data-act="rmode" data-m="month">شهر</span></div><input type="date" style="width:auto" value="${UI.rangeDay || bday(Date.now())}" data-chg="rday"><div class="sp"></div><button class="btn sm" data-act="printrep">طباعة</button><button class="btn sm" data-act="warep">واتساب</button></div><div class="mut" style="margin-top:6px">${esc(lbl)} · ${R.n} فاتورة</div></div>
  <div class="grid g-stat" style="margin-top:12px"><div class="stat"><div class="l">فلوس الوقت</div><div class="v pk">${M(R.time)}</div></div><div class="stat"><div class="l">فلوس المنتجات</div><div class="v cy">${M(R.merch)}</div></div><div class="stat big"><div class="l">إجمالي المحل</div><div class="v">${M(R.total)} ${CUR}</div></div><div class="stat"><div class="l">مصروفات</div><div class="v rd">${M(R.exp)}</div></div><div class="stat"><div class="l">الصافي بعد المصروفات</div><div class="v gr">${M(R.net)}</div></div></div>
  <div class="grid g-stat" style="margin-top:12px"><div class="stat"><div class="l">كاش اتحصّل</div><div class="v">${M(R.cash)}</div></div><div class="stat"><div class="l">آجل</div><div class="v am">${M(R.credit)}</div></div><div class="stat"><div class="l">خصومات</div><div class="v">${M(R.disc)}</div></div><div class="stat"><div class="l">منتجات اتباعت (قطعة)</div><div class="v">${R.units}</div></div><div class="stat"><div class="l">ربح المنتجات (لو التكلفة متسجلة)</div><div class="v">${M(R.merch - R.cost)}</div></div></div>
  <div class="sec">المنتجات: المباع والمخزون</div><div class="tw"><table><thead><tr><th>المنتج</th><th>اتباع</th><th>فلوسه</th><th>المتبقي في المخزون</th></tr></thead><tbody>${DB.products.filter(p => p.on).map(p => { const o = R.prods[p.id]; return `<tr><td>${esc(p.name)}</td><td>${o ? o.q : 0}</td><td>${o ? M(o.m) : 0}</td><td>${p.track ? `<b class="${p.stock <= DB.settings.lowStock ? 'am' : ''}">${p.stock}</b>` : '<span class="mut">—</span>'}</td></tr>`; }).join('')}<tr><td><b>الإجمالي</b></td><td><b>${R.units}</b></td><td><b>${M(R.merch)}</b></td><td><b>${stockUnits()} قطعة</b></td></tr></tbody></table></div>
  <div class="sec">الوقت حسب المكان</div><div class="tw"><table><thead><tr><th>المكان</th><th>جلسات</th><th>ساعات</th><th>فلوس</th></tr></thead><tbody>${sts.length ? sts.map(o => `<tr><td>${esc(o.name)}</td><td>${o.n}</td><td>${(o.min / 60).toFixed(1)}</td><td>${M(o.money)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">مفيش جلسات</td></tr>'}</tbody></table></div>
  <div class="sec">آخر 7 أيام (الإجمالي)</div><div class="card"><div class="bars">${bars.map(x => `<div><span>${M(x[1])}</span><i style="height:${Math.round(x[1] / mx * 80)}px"></i><span>${x[0]}</span></div>`).join('')}</div></div>
  <div class="sec">إقفال اليوم</div><div class="card"><p class="mut" style="margin-top:0">بيحفظ نسخة من ملخص اليوم المعروض ويعمل نسخة احتياطية للبيانات.</p><button class="btn pri" data-act="closeday">إقفال وحفظ الملخص</button>${cl.length ? `<table style="margin-top:10px"><tbody>${cl.map(c => `<tr><td>${esc(c.lbl)}</td><td>وقت ${M(c.time)}</td><td>منتجات ${M(c.merch)}</td><td><b>${M(c.total)}</b></td></tr>`).join('')}</tbody></table>` : ''}</div>`;
}
function pExpenses() {
  const day = UI.invDay || bday(Date.now()); const [a, b] = dayRange(day);
  const L = DB.expenses.filter(e => e.at >= a && e.at < b).sort((x, y) => y.at - x.at);
  return `<div class="card"><div class="row"><input type="date" style="width:auto" value="${day}" data-chg="invday"><div class="sp"></div><button class="btn pri" data-act="addexp">+ مصروف</button></div><div style="margin-top:8px;font-weight:800">إجمالي مصروفات اليوم: <span class="rd">${M(L.reduce((s, e) => s + e.amount, 0))} ${CUR}</span></div></div>
  <div class="tw" style="margin-top:12px"><table><tbody>${L.length ? L.map(e => `<tr><td>${hm(e.at)}</td><td><b>${esc(e.title)}</b></td><td>${M(e.amount)}</td><td><button class="btn sm dn" data-act="delexp" data-id="${e.id}">حذف</button></td></tr>`).join('') : '<tr><td class="empty">مفيش مصروفات</td></tr>'}</tbody></table></div>`;
}
function pSettings() {
  const S = DB.settings;
  const opt = (v, arr) => arr.map(x => `<option value="${x[0]}" ${String(v) === String(x[0]) ? 'selected' : ''}>${x[1]}</option>`).join('');
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
  <div class="card"><h3>حسابي</h3><p class="mut" style="margin:4px 0">المستخدم الحالي: <b>${esc(USER.u)}</b></p><button class="btn pri" data-act="myacct">تغيير اسم المستخدم والباسورد</button></div>
  <div class="card"><h3>إعدادات المحل</h3><label class="f">اسم المحل (على الفاتورة)</label><input value="${esc(S.shop)}" data-chg="s_shop"><label class="f">تقريب وقت الحساب</label><select data-chg="s_step">${opt(S.step, [[1, 'بالدقيقة بالظبط'], [5, 'كل 5 دقايق'], [10, 'كل 10 دقايق'], [15, 'كل ربع ساعة'], [30, 'كل نص ساعة']])}</select><label class="f">تقريب الفلوس لأقرب</label><select data-chg="s_roundTo">${opt(S.roundTo, [[0, 'بدون تقريب'], [1, '1 جنيه'], [5, '5 جنيه'], [10, '10 جنيه']])}</select><label class="f">بداية يوم الشغل (الساعة)</label><select data-chg="s_dayStart">${opt(S.dayStart, [0, 3, 4, 5, 6, 7, 8, 10, 12].map(x => [x, x + ':00']))}</select><label class="f">تنبيه المخزون عند أقل من</label><input type="number" value="${S.lowStock}" data-chg="s_lowStock"><label class="f">رقم واتساب لإرسال الملخص (اختياري، بكود الدولة)</label><input value="${esc(S.wa)}" placeholder="2010xxxxxxxx" data-chg="s_wa"><label class="f">سطر آخر الفاتورة</label><input value="${esc(S.footer)}" data-chg="s_footer"><label class="row" style="margin-top:10px"><input type="checkbox" style="width:22px;min-height:0" ${S.blockZero ? 'checked' : ''} data-chg="s_blockZero"><span>امنع بيع المنتج لما المخزون يوصل صفر</span></label></div>
  <div class="card"><h3>المستخدمين</h3><table><tbody>${DB.users.map(u => `<tr><td><b>${esc(u.u)}</b><div class="mut" style="font-size:12px">${u.role === 'admin' ? 'مدير' : 'كاشير'}</div></td><td class="row">${u.id !== USER.id ? `<button class="btn sm" data-act="resetuser" data-id="${u.id}">باسورد جديد</button><button class="btn sm dn" data-act="deluser" data-id="${u.id}">حذف</button>` : '<span class="mut">أنت</span>'}</td></tr>`).join('')}</tbody></table><button class="btn" style="margin-top:8px" data-act="adduser">+ إضافة كاشير (صلاحيات محدودة)</button></div>
  <div class="card"><h3>نسخة احتياطية</h3><p class="mut" style="margin:4px 0">البيانات محفوظة على الجهاز ده. خد نسخة كل يوم، وتقدر ترجّعها على أي جهاز تاني.</p><div class="row"><button class="btn pri" data-act="export">تصدير نسخة</button><button class="btn" data-act="import">استرجاع نسخة</button></div></div>
  <div class="card"><h3>تثبيت التطبيق</h3><div id="inst"><button class="btn pri" data-act="install">تثبيت على الجهاز</button></div><p class="mut" style="margin:8px 0 0;font-size:14px">آيفون: افتح الرابط في Safari ← زر المشاركة ← إضافة إلى الشاشة الرئيسية.<br>لابتوب/أندرويد: من متصفح Chrome ← تثبيت التطبيق.</p></div>
  <div class="card"><h3>بدء تشغيل جديد</h3><p class="mut" style="margin:4px 0">يمسح كل الفواتير والمصروفات والتقارير ويحتفظ بالأسعار والمنتجات والمستخدمين. استخدمه بعد التجربة قبل البداية الفعلية.</p><button class="btn dn" data-act="wipe">مسح بيانات التجربة</button></div></div>`;
}

/* ---------- modals ---------- */
function showModal(html, cls) { const m = $('#modal'); m.innerHTML = `<div class="sheet ${cls || ''}">${html}</div>`; m.hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; UI.sid = null; }
function formModal(title, fields, onSave, saveLabel) {
  UI.formBack = !$('#modal').hidden && !!inv(UI.sid);
  showModal(`<button class="x" data-act="close">×</button><h2>${esc(title)}</h2><form id="mf">${fields.map(f => `<label class="f">${esc(f.l)}</label>${f.t === 'select' ? `<select name="${f.k}">${f.o.map(o => `<option value="${esc(o[0])}" ${String(f.v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : `<input name="${f.k}" type="${f.t || 'text'}" ${f.t === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(f.v == null ? '' : f.v)}" placeholder="${esc(f.p || '')}" ${f.req ? 'required' : ''} autocomplete="off">`}`).join('')}<button class="btn pri blk" style="margin-top:14px" type="submit">${saveLabel || 'حفظ'}</button></form>`, 'sm');
  $('#mf').onsubmit = e => { e.preventDefault(); const o = {}; fields.forEach(f => o[f.k] = e.target.elements[f.k].value); if (onSave(o) !== false) { const fb = UI.formBack; UI.formBack = false; if (fb && inv(UI.sid)) renderInvModal(); else closeModal(); render(); } };
  const f0 = $('#mf input,#mf select'); if (f0 && !('ontouchstart' in window)) f0.focus();
}
function startModal(sid) {
  const s = station(sid); const O = { vip: false, target: 0 };
  showModal(`<button class="x" data-act="close">×</button><h2>${bd(s.name)}</h2><div class="mut">${M(s.price)} ${CUR}/ساعة${s.vip > 0 ? ` · VIP ${M(s.vip)}` : ''}</div>
  ${s.vip > 0 ? `<label class="f">سعر الوقت</label><div class="tabs" id="vt"><span class="tab on" data-v="0">عادي ${M(s.price)}</span><span class="tab" data-v="1">VIP ${M(s.vip)}</span></div>` : ''}
  <label class="f">مدة محددة (اختياري، هيرن لما تخلص)</label><div class="tabs" id="tt">${[[0, 'مفتوح'], [30, '30د'], [60, 'ساعة'], [90, '90د'], [120, 'ساعتين']].map((x, k) => `<span class="tab ${k ? '' : 'on'}" data-t="${x[0]}">${x[1]}</span>`).join('')}</div>
  <label class="f">اسم الزبون (اختياري)</label><input id="cn" autocomplete="off"><button class="btn pri blk" style="margin-top:14px" id="go">ابدأ الوقت</button>`, 'sm');
  $('#vt') && $('#vt').addEventListener('click', e => { const t = e.target.closest('[data-v]'); if (!t) return; O.vip = t.dataset.v === '1'; [...$('#vt').children].forEach(c => c.classList.toggle('on', c === t)); });
  $('#tt').addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (!t) return; O.target = +t.dataset.t; [...$('#tt').children].forEach(c => c.classList.toggle('on', c === t)); });
  $('#go').onclick = () => { const i = startSession(sid, { vip: O.vip, target: O.target, customer: $('#cn').value.trim() }); closeModal(); if (i) { render(); openInv(i.id); } };
}
function openInv(id) { UI.sid = id; UI.q = ''; UI.cat = 'all'; renderInvModal(); }
function renderInvModal() {
  UI.formBack = false; const i = inv(UI.sid); if (!i) { closeModal(); return; }
  const live = i.status === 'open'; const t = totals(i); const s = station(i.sid);
  const cats = ['all', ...Object.keys(CATS).filter(c => DB.products.some(p => p.on && p.cat === c))];
  const sess = i.kind === 'session';
  let h = `<button class="x" data-act="close">×</button><h2>فاتورة <bdi>#${i.no}</bdi> ${sess ? '· ' + bd(i.sname) : '· كاشير'} <span class="badge ${stLabel[i.status][1]}">${stLabel[i.status][0]}</span></h2>
  <div class="mut">${dt(i.createdAt)}${i.customer ? ' · ' + esc(i.customer) : ''}${i.by ? ' · ' + esc(i.by) : ''}</div>`;
  if (sess) {
    h += `<div class="card" style="margin-top:10px"><div class="tm" data-live="${i.id}:el">${dur(elapsedMs(i))}</div><div class="row sb"><span>تكلفة الوقت</span><b class="pk" style="font-size:20px" data-live="${i.id}:tc">${M(t.timeGross)}</b></div>
    <div class="mut" style="font-size:13px">${i.segs.map(sg => `<span>${bd(sg.name)} <bdi>${M(sg.rate)}</bdi>/س${sg.vip ? ' VIP' : ''}: <bdi>${hm(sg.from)}</bdi> ← <bdi>${sg.to ? hm(sg.to) : 'الآن'}</bdi></span>`).join(' | ')}</div>${i.target && live ? `<div class="am" style="font-weight:700">المدة المحددة: ${i.target} دقيقة</div>` : ''}
    ${live ? `<div class="row" style="margin-top:8px"><button class="btn sm ${i.paused ? 'ok' : ''}" data-act="pause">${i.paused ? '▶ استئناف' : '⏸ إيقاف مؤقت'}</button><button class="btn sm" data-act="transfer">⇄ نقل لمكان تاني</button>${s && s.vip > 0 ? `<button class="btn sm" data-act="ratevip">${i.vip ? 'رجّع للسعر العادي' : 'حوّل لسعر VIP'}</button>` : ''}<button class="btn sm" data-act="extend">+30 د مدة</button></div>` : ''}</div>`;
  }
  if (live) {
    h += `<div class="sec">إضافة منتجات</div><div class="row" style="margin-bottom:6px"><input id="pq" placeholder="دوّر على منتج" value="${esc(UI.q)}" style="flex:1">${DB.products.some(p => p.vip > 0) ? `<label class="row" style="white-space:nowrap"><input type="checkbox" style="width:22px;min-height:0" ${i.vip ? 'checked' : ''} data-act="custvip"><span class="pk" style="font-weight:700">زبون VIP</span></label>` : ''}</div>
    <div class="chips">${cats.map(c => `<span class="chip ${UI.cat === c ? 'on' : ''}" data-act="cat" data-c="${c}">${c === 'all' ? 'الكل' : CATS[c]}</span>`).join('')}</div><div class="tiles" id="tiles">${tilesHtml(i)}</div>`;
  }
  h += `<div class="sec">المنتجات في الفاتورة</div><div id="items">${itemsHtml(i, live)}</div>`;
  h += `<div class="sum"><div class="r"><span>وقت</span><b data-live="${i.id}:tc2">${M(i.final ? t.timeMoney : t.timeGross)}</b></div><div class="r"><span>منتجات</span><b data-live="${i.id}:mc2">${M(i.final ? t.merchMoney : t.merchGross)}</b></div>${t.disc ? `<div class="r"><span>خصم</span><b class="rd">-${M(t.disc)}</b></div>` : ''}<div class="r t"><span>الإجمالي</span><b data-live="${i.id}:tot2">${M(t.total)} ${CUR}</b></div></div>`;
  if (live) {
    h += `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="disc">🏷 خصم${i.disc && i.disc.val ? ' (' + i.disc.val + (i.disc.type === 'pct' ? '%' : '') + ')' : ''}</button><button class="btn sm" data-act="cust">👤 اسم الزبون</button><button class="btn sm" data-act="print">🖨 طباعة</button></div>
    <div class="row" style="margin-top:10px"><button class="btn ok sp" data-act="pay">✔ قفل ودفع كاش</button><button class="btn sp" data-act="credit">آجل</button>${isAdmin() || !sess ? `<button class="btn dn" data-act="void">إلغاء</button>` : ''}</div>`;
  } else {
    h += `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="print">🖨 طباعة</button>${i.status === 'credit' ? `<button class="btn ok sm" data-act="settle">تحصيل الآجل</button>` : ''}${i.status !== 'void' && isAdmin() ? `<button class="btn dn sm" data-act="void">إلغاء الفاتورة</button>` : ''}</div>`;
  }
  if (i.log && i.log.length) h += `<details style="margin-top:12px"><summary class="mut">سجل الفاتورة</summary>${i.log.map(l => `<div class="mut" style="font-size:13px">${hm(l.t)} · ${esc(l.msg)}${l.by ? ' (' + esc(l.by) + ')' : ''}</div>`).join('')}</details>`;
  const m = $('#modal'); const keep = m.querySelector('.sheet') ? m.querySelector('.sheet').scrollTop : 0;
  showModal(h); $('#modal .sheet').scrollTop = keep; tick();
}
function tilesHtml(i) {
  const q = UI.q.trim().toLowerCase();
  const L = DB.products.filter(p => p.on && (UI.cat === 'all' || p.cat === UI.cat) && (!q || p.name.toLowerCase().includes(q)));
  if (!L.length) return '<div class="empty" style="grid-column:1/-1">مفيش منتجات</div>';
  return L.map(p => { const v = i.vip && p.vip > 0; return `<div class="tile ${p.track && p.stock <= 0 ? 'out' : p.track && p.stock <= DB.settings.lowStock ? 'low' : ''}" data-act="add" data-id="${p.id}">${bd(p.name)}<small>${M(v ? p.vip : p.price)} ${CUR}${v ? ' VIP' : ''}</small>${p.track ? `<small>متبقي <b>${p.stock}</b></small>` : ''}</div>`; }).join('');
}
function itemsHtml(i, live) {
  if (!i.items.length) return '<div class="empty">مفيش منتجات</div>';
  return i.items.map(it => { const p = prod(it.pid); return `<div class="it"><div class="n">${bd(it.name)}${it.vip ? ' <span class="badge pk">VIP</span>' : ''}<div class="mut" style="font-size:12px">${M(it.unit)} × ${it.qty}</div></div>
  ${live ? `${p && p.vip > 0 ? `<button class="btn sm" data-act="itvip" data-id="${it.id}">${it.vip ? 'عادي' : 'VIP'}</button>` : ''}<div class="q"><button data-act="qm" data-id="${it.id}">−</button><b>${it.qty}</b><button data-act="qp" data-id="${it.id}">+</button></div>` : `<b>×${it.qty}</b>`}<b style="min-width:60px;text-align:left">${M(it.unit * it.qty)}</b>${live ? `<button class="btn sm dn" data-act="rm" data-id="${it.id}" title="مرتجع">↩</button>` : ''}</div>`; }).join('');
}

/* ---------- live ticking ---------- */
let audioCtx;
function beep() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); [0, .35, .7].forEach(d => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(.2, audioCtx.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + d + .3); o.start(audioCtx.currentTime + d); o.stop(audioCtx.currentTime + d + .32); }); navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { } }
function tick() {
  if (!USER) return; const now = Date.now(); const c = $('#clock'); if (c) c.textContent = hm(now) + ' · ' + bday(now);
  document.querySelectorAll('[data-live]').forEach(el => {
    const [id, k] = el.dataset.live.split(':'); const i = inv(id); if (!i) return; const t = totals(i, now);
    el.textContent = k === 'el' ? dur(elapsedMs(i, now)) : k === 'tc' || k === 'tc2' ? M(i.final ? t.timeMoney : t.timeGross) : k === 'mc' || k === 'mc2' ? M(i.final ? t.merchMoney : t.merchGross) : M(t.total) + (k === 'tot2' ? ' ' + CUR : '');
  });
  openInvs().forEach(i => { if (i.kind === 'session' && i.target && !i.paused && !i.alerted && elapsedMs(i, now) >= i.target * 60000) { i.alerted = true; save(); beep(); toast('⏰ خلصت مدة ' + i.sname + ' (فاتورة #' + i.no + ')'); const c2 = document.getElementById('card-' + i.id); c2 && c2.classList.add('alarm'); } });
}
setInterval(tick, 1000);

/* ---------- actions ---------- */
function printInvoice(i) {
  const t = totals(i); const S = DB.settings;
  $('#print').className = ''; $('#print').innerHTML = `<h2>${esc(S.shop)}</h2><div class="c">فاتورة #${i.no}<br>${dt(i.closedAt || Date.now())}${i.customer ? '<br>' + esc(i.customer) : ''}</div><hr>
  ${i.kind === 'session' ? `<table>${i.segs.map(sg => `<tr><td>${esc(sg.name)}${sg.vip ? ' VIP' : ''}<br>${hm(sg.from)} - ${sg.to ? hm(sg.to) : hm(Date.now())} (${Math.round(segMin(sg, i.closedAt || Date.now()))} د)</td><td>${M(sg.rate)}/س</td></tr>`).join('')}<tr><td><b>مجموع الوقت</b></td><td><b>${M(t.timeGross)}</b></td></tr></table>` : ''}
  ${i.items.length ? `<table>${i.items.map(it => `<tr><td>${esc(it.name)}${it.vip ? ' VIP' : ''} ×${it.qty}</td><td>${M(it.unit * it.qty)}</td></tr>`).join('')}<tr><td><b>مجموع المنتجات</b></td><td><b>${M(t.merchGross)}</b></td></tr></table>` : ''}
  ${t.disc ? `<div>خصم: -${M(t.disc)}</div>` : ''}<h2>الإجمالي ${M(t.total)} ${CUR}</h2><div class="c">${esc(S.footer)}</div>`;
  window.print();
}
function reportText() {
  const [a, b, lbl] = rangeOf(); const R = report(a, b);
  return `${DB.settings.shop} - ملخص ${lbl}\nفلوس الوقت: ${M(R.time)}\nفلوس المنتجات: ${M(R.merch)}\nإجمالي المحل: ${M(R.total)} ${CUR}\nمصروفات: ${M(R.exp)}\nالصافي: ${M(R.net)}\nآجل: ${M(R.credit)}\nقطع اتباعت: ${R.units} | المتبقي في المخزون: ${stockUnits()} قطعة\nعدد الفواتير: ${R.n}`;
}
function doExport() {
  const txt = JSON.stringify(DB); const name = 'DOES-backup-' + dmy(Date.now()) + '.json';
  try { const f = new File([txt], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: name }).catch(() => { }); return; } } catch (e) { }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('تم تنزيل النسخة');
}
function askPass(title, cb) {
  formModal(title, [{ l: 'كلمة السر بتاعتك', k: 'p', t: 'password', req: true }], o => { hash(o.p, USER.salt).then(h => { if (h === USER.h) cb(); else toast('كلمة السر غلط'); }); }, 'تأكيد');
}
let deferredInstall;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });

const ACT = {
  go: d => { UI.page = d.p; closeModal(); render(); window.scrollTo(0, 0); },
  logout: () => { localStorage.removeItem(AUTHKEY); USER = null; render(); },
  close: () => { if (UI.formBack && inv(UI.sid)) { UI.formBack = false; renderInvModal(); return; } UI.formBack = false; closeModal(); render(); },
  startmodal: d => startModal(d.id),
  openinv: d => openInv(d.id),
  newcounter: () => { const i = newInvoice('counter'); save(); render(); openInv(i.id); },
  ptab: d => { UI.ptab = d.t; render(); },
  rmode: d => { UI.rangeMode = d.m; render(); },
  cat: d => { UI.cat = d.c; renderInvModal(); },
  add: d => { const i = inv(UI.sid); addItem(i, d.id); renderInvModal(); },
  qp: d => { qtyItem(inv(UI.sid), d.id, 1); renderInvModal(); },
  qm: d => { qtyItem(inv(UI.sid), d.id, -1); renderInvModal(); },
  rm: d => { removeItem(inv(UI.sid), d.id); renderInvModal(); toast('اتحذف وارجع للمخزون'); },
  itvip: d => { toggleItemVip(inv(UI.sid), d.id); renderInvModal(); },
  custvip: () => { const i = inv(UI.sid); i.vip = !i.vip; save(); renderInvModal(); },
  pause: () => { pauseToggle(inv(UI.sid)); renderInvModal(); render0(); },
  ratevip: () => { const i = inv(UI.sid); setRateVip(i, !i.vip); renderInvModal(); },
  extend: () => { const i = inv(UI.sid); i.target = (i.target || Math.ceil(elapsedMs(i) / 60000)) + 30; i.alerted = false; save(); renderInvModal(); },
  transfer: () => {
    const i = inv(UI.sid); const free = DB.stations.filter(s => s.on && !invAt(s.id));
    showModal(`<button class="x" data-act="back">×</button><h2>نقل الفاتورة #${i.no}</h2><p class="mut">من ${esc(i.sname)} لمكان فاضي. الفاتورة والمنتجات والوقت بيكملوا زي ما هم، والوقت بيتحسب بسعر المكان الجديد من لحظة النقل.</p>${free.length ? free.map(s => `<button class="btn blk" style="margin-bottom:8px" data-act="dotransfer" data-id="${s.id}">${esc(s.name)} · ${M(s.price)}/س</button>`).join('') : '<div class="empty">مفيش أماكن فاضية</div>'}`, 'sm');
  },
  back: () => renderInvModal(),
  dotransfer: d => { const i = inv(UI.sid); if (transfer(i, d.id)) { toast('اتنقل لـ ' + i.sname); } renderInvModal(); },
  disc: () => { const i = inv(UI.sid); formModal('خصم على الفاتورة', [{ l: 'النوع', k: 't', t: 'select', v: i.disc.type, o: [['amt', 'مبلغ بالجنيه'], ['pct', 'نسبة %']] }, { l: 'القيمة (0 لإلغاء الخصم)', k: 'v', t: 'number', v: i.disc.val || 0 }], o => { i.disc = { type: o.t, val: Math.max(0, num(o.v)) }; logInv(i, 'خصم ' + o.v + (o.t === 'pct' ? '%' : '')); save(); setTimeout(renderInvModal, 0); return true; }); },
  cust: () => { const i = inv(UI.sid); formModal('اسم الزبون', [{ l: 'الاسم', k: 'n', v: i.customer }], o => { i.customer = o.n.trim(); save(); setTimeout(renderInvModal, 0); }); },
  print: () => printInvoice(inv(UI.sid)),
  pay: () => { const i = inv(UI.sid); const t = totals(i); if (!confirm('قفل الفاتورة #' + i.no + ' ودفع ' + M(t.total) + ' ' + CUR + ' كاش؟')) return; closeInvoice(i, 'cash'); renderInvModal(); render0(); toast('اتقفلت: ' + M(i.final.total) + ' ' + CUR); },
  credit: () => { const i = inv(UI.sid); formModal('فاتورة آجل', [{ l: 'اسم الزبون (مطلوب)', k: 'n', v: i.customer, req: true }], o => { if (!o.n.trim()) return false; closeInvoice(i, 'credit', o.n.trim()); setTimeout(() => { renderInvModal(); render0(); }, 0); }, 'قفل آجل'); },
  settle: () => { const i = inv(UI.sid); if (!confirm('تأكيد تحصيل ' + M(i.final.total) + ' ' + CUR + ' من ' + i.customer + '؟')) return; i.status = 'paid'; i.method = 'cash'; i.paidAt = Date.now(); logInv(i, 'تحصيل الآجل'); save(); renderInvModal(); render0(); },
  void: () => { const i = inv(UI.sid); if (!confirm('إلغاء الفاتورة #' + i.no + '؟ المنتجات هترجع للمخزون.')) return; voidInvoice(i); renderInvModal(); render0(); },
  editst: d => {
    const s = d.id ? station(d.id) : { name: '', type: 'ps', price: '', vip: '', on: true };
    formModal(d.id ? 'تعديل المكان' : 'إضافة مكان', [{ l: 'الاسم', k: 'n', v: s.name, req: true }, { l: 'النوع', k: 't', t: 'select', v: s.type, o: Object.entries(TYPES) }, { l: 'سعر الساعة', k: 'p', t: 'number', v: s.price, req: true }, { l: 'سعر VIP للساعة (اختياري)', k: 'v', t: 'number', v: s.vip || '' }, { l: 'الحالة', k: 'on', t: 'select', v: s.on ? 1 : 0, o: [[1, 'شغال'], [0, 'مخفي']] }], o => {
      if (!o.n.trim()) return false; const x = d.id ? s : { id: uid() }; Object.assign(x, { name: o.n.trim(), type: o.t, price: num(o.p), vip: num(o.v), on: o.on === '1' }); if (!d.id) DB.stations.push(x); save();
    });
  },
  editpr: d => {
    const p = d.id ? prod(d.id) : { name: '', cat: 'drink', price: '', vip: '', cost: '', on: true };
    formModal(d.id ? 'تعديل المنتج' : 'إضافة منتج', [{ l: 'الاسم', k: 'n', v: p.name, req: true }, { l: 'القسم', k: 'c', t: 'select', v: p.cat, o: Object.entries(CATS) }, { l: 'سعر البيع', k: 'p', t: 'number', v: p.price, req: true }, { l: 'سعر VIP (اختياري)', k: 'v', t: 'number', v: p.vip || '' }, { l: 'سعر التكلفة (اختياري، لحساب الربح)', k: 'k', t: 'number', v: p.cost || '' }, ...(d.id ? [] : [{ l: 'الكمية الحالية في المخزون', k: 's', t: 'number', v: 0 }]), { l: 'الحالة', k: 'on', t: 'select', v: p.on ? 1 : 0, o: [[1, 'ظاهر'], [0, 'مخفي']] }], o => {
        if (!o.n.trim()) return false; const x = d.id ? p : { id: uid(), track: true, stock: Math.round(num(o.s)) }; Object.assign(x, { name: o.n.trim(), cat: o.c, price: num(o.p), vip: num(o.v), cost: num(o.k), on: o.on === '1' }); if (!d.id) DB.products.push(x); save();
      });
  },
  restock: d => { const p = prod(d.id); formModal('توريد: ' + p.name, [{ l: 'الكمية الواصلة', k: 'q', t: 'number', req: true }], o => { const q = Math.round(num(o.q)); if (q <= 0) return false; stockMove(p.id, q, 'توريد'); toast('اتضاف ' + q); }); },
  setstock: d => { const p = prod(d.id); formModal('جرد: ' + p.name, [{ l: 'الكمية الفعلية دلوقتي', k: 'q', t: 'number', v: p.stock, req: true }], o => { const q = Math.round(num(o.q)); stockMove(p.id, q - p.stock, 'جرد'); }); },
  addexp: () => formModal('مصروف جديد', [{ l: 'البيان', k: 't', req: true, p: 'كهرباء، تنضيف، ...' }, { l: 'المبلغ', k: 'a', t: 'number', req: true }], o => { const a = num(o.a); if (!o.t.trim() || a <= 0) return false; DB.expenses.push({ id: uid(), at: Date.now(), title: o.t.trim(), amount: a, by: USER.u }); save(); }),
  delexp: d => { if (confirm('حذف المصروف؟')) { DB.expenses = DB.expenses.filter(e => e.id !== d.id); save(); render(); } },
  closeday: () => { const [a, b, lbl] = rangeOf(); const R = report(a, b); DB.closings.push({ id: uid(), at: Date.now(), lbl, time: R.time, merch: R.merch, total: R.total, exp: R.exp }); save(); dailyBackupForce(); toast('اتحفظ ملخص ' + lbl); render(); },
  printrep: () => { $('#print').className = 'rep'; $('#print').innerHTML = `<h2>${esc(DB.settings.shop)}</h2><pre style="font-family:inherit;white-space:pre-wrap;font-size:14px">${esc(reportText())}</pre>`; window.print(); },
  warep: () => { const n = (DB.settings.wa || '').replace(/\D/g, ''); window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(reportText()), '_blank'); },
  myacct: () => formModal('تغيير بيانات الدخول', [{ l: 'اسم المستخدم الجديد', k: 'u', v: USER.u, req: true }, { l: 'كلمة السر الجديدة (6 حروف على الأقل)', k: 'p', t: 'password', req: true }, { l: 'تأكيد كلمة السر', k: 'p2', t: 'password', req: true }, { l: 'كلمة السر الحالية', k: 'c', t: 'password', req: true }], o => {
    if (o.p !== o.p2) { toast('كلمتين السر مش زي بعض'); return false; } if (o.p.length < 6) { toast('كلمة السر أقصر من 6'); return false; }
    const nu = o.u.trim(); if (DB.users.some(x => x.id !== USER.id && x.u.toLowerCase() === nu.toLowerCase())) { toast('الاسم مستخدم'); return false; }
    hash(o.c, USER.salt).then(async h => { if (h !== USER.h) { toast('كلمة السر الحالية غلط'); return; } USER.u = nu; USER.salt = uid(); USER.h = await hash(o.p, USER.salt); USER.def = false; save(); toast('اتغيّرت بيانات الدخول'); render(); });
    return true;
  }),
  adduser: () => formModal('إضافة كاشير', [{ l: 'اسم المستخدم', k: 'u', req: true }, { l: 'كلمة السر', k: 'p', t: 'password', req: true }, { l: 'الاسم الظاهر', k: 'n' }], o => { const nu = o.u.trim(); if (!nu || o.p.length < 4) { toast('كلمة السر أقصر من 4'); return false; } if (DB.users.some(x => x.u.toLowerCase() === nu.toLowerCase())) { toast('الاسم مستخدم'); return false; } const salt = uid(); hash(o.p, salt).then(h => { DB.users.push({ id: uid(), u: nu, salt, h, role: 'staff', name: o.n || nu }); save(); render(); }); }),
  resetuser: d => { const u = DB.users.find(x => x.id === d.id); formModal('باسورد جديد: ' + u.u, [{ l: 'كلمة السر الجديدة', k: 'p', t: 'password', req: true }], o => { if (o.p.length < 4) { toast('قصيرة'); return false; } u.salt = uid(); hash(o.p, u.salt).then(h => { u.h = h; save(); toast('اتغيّر'); }); }); },
  deluser: d => { if (confirm('حذف المستخدم؟')) { DB.users = DB.users.filter(x => x.id !== d.id); save(); render(); } },
  export: () => doExport(),
  import: () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => { const r = new FileReader(); r.onload = () => { try { const x = JSON.parse(r.result); if (!x.stations || !x.users) throw 0; if (!confirm('هيتم استبدال كل البيانات الحالية بالنسخة دي. متأكد؟')) return; DB = x; save(); USER = null; localStorage.removeItem(AUTHKEY); render(); toast('اترجّعت النسخة، سجّل دخول'); } catch (e) { toast('الملف مش نسخة صالحة'); } }; r.readAsText(f.files[0]); }; f.click(); },
  install: async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('على آيفون: مشاركة ← إضافة إلى الشاشة الرئيسية. على الكمبيوتر: أيقونة التثبيت في شريط العنوان.'); },
  wipe: () => askPass('تأكيد مسح بيانات التجربة', () => { if (!confirm('هيتمسح كل الفواتير والمصروفات والتقارير. متأكد؟')) return; dailyBackupForce(); DB.invoices = []; DB.expenses = []; DB.closings = []; DB.stockLog = []; DB.settings.lastNo = 0; save(); toast('اتمسحت. الأسعار والمنتجات زي ما هي'); render(); })
};
function dailyBackupForce() { try { const cur = localStorage.getItem(KEY); if (cur) localStorage.setItem(PREVKEY, cur); } catch (e) { } }
function render0() { if (!$('#modal').hidden) { } render(); if (!$('#modal').hidden && inv(UI.sid)) { /* keep modal */ } }

const CHG = {
  stprice: (d, v) => { const s = station(d.id); s.price = num(v); save(); toast('اتحفظ'); },
  stvip: (d, v) => { const s = station(d.id); s.vip = num(v); save(); toast(s.vip > 0 ? 'اتحفظ سعر VIP' : 'اتشال سعر VIP'); },
  prprice: (d, v) => { const p = prod(d.id); p.price = num(v); save(); toast('اتحفظ'); },
  prvip: (d, v) => { const p = prod(d.id); p.vip = num(v); save(); toast(p.vip > 0 ? 'اتحفظ سعر VIP' : 'اتشال سعر VIP'); },
  track: (d, v, el) => { const p = prod(d.id); p.track = el.checked; save(); render(); },
  invday: (d, v) => { UI.invDay = v; render(); }, invfilter: (d, v) => { UI.invFilter = v; render(); }, invq: (d, v) => { UI.invQ = v.trim(); render(); },
  rday: (d, v) => { UI.rangeDay = v; render(); },
  s_shop: (d, v) => { DB.settings.shop = v.trim() || 'DOES'; save(); }, s_step: (d, v) => { DB.settings.step = +v; save(); }, s_roundTo: (d, v) => { DB.settings.roundTo = +v; save(); }, s_dayStart: (d, v) => { DB.settings.dayStart = +v; save(); },
  s_lowStock: (d, v) => { DB.settings.lowStock = Math.max(0, Math.round(num(v))); save(); }, s_wa: (d, v) => { DB.settings.wa = v.trim(); save(); }, s_footer: (d, v) => { DB.settings.footer = v; save(); }, s_blockZero: (d, v, el) => { DB.settings.blockZero = el.checked; save(); }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) { if (e.target.id === 'modal') ACT.close(); return; }
  if (b.tagName === 'INPUT') return; const f = ACT[b.dataset.act]; if (f) f(b.dataset);
});
document.addEventListener('change', e => {
  const el = e.target; if (el.dataset.act === 'custvip') { ACT.custvip(); return; }
  const k = el.dataset.chg; if (k && CHG[k]) CHG[k](el.dataset, el.value, el);
});
document.addEventListener('input', e => {
  if (e.target.id === 'pq') { UI.q = e.target.value; const i = inv(UI.sid); const t = $('#tiles'); if (i && t) t.innerHTML = tilesHtml(i); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) ACT.close(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ---------- boot ---------- */
(async function boot() {
  load(); await ensureAdmin(); dailyBackup();
  try { const a = JSON.parse(localStorage.getItem(AUTHKEY) || 'null'); if (a) USER = DB.users.find(u => u.id === a.id) || null; } catch (e) { }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  render();
  window.__DOES = { get DB() { return DB; }, startSession, addItem, transfer, closeInvoice, report, totals, voidInvoice, qtyItem, removeItem, setRateVip, pauseToggle, newInvoice, set USER(u) { USER = u; }, hash };
})();
