/* Інтерактивна карта без бібліотек і платних API (внутрішній портал і публічний сайт).
   v2.3 (зауваження 16.10.2026): підкладки «Схема» (CARTO), «Супутник» (Esri World Imagery), OpenStreetMap або власний
   сервер плиток з налаштувань; шар «Кадастр» — WMS Публічної кадастрової карти або інший сервер (налаштування
   map_cadastre); контури ділянок (GeoJSON) і точки на canvas; групування точок при малому масштабі; перетягування,
   масштаб колесом / кнопками / двома пальцями. Якщо підкладка недоступна — автоматично наступна; якщо жодна — схема.
   Причина помилки «403 Access blocked» на сервері: OpenStreetMap вимагає заголовок Referer, а сервер віддавав
   Referrer-Policy same-origin. Тепер плитки запитуються з політикою strict-origin-when-cross-origin, а за замовчуванням
   використовується CARTO / Esri, які таких обмежень не мають. */
(function () {
  'use strict';
  var CITIES = [['Київ', 50.45, 30.52], ['Львів', 49.84, 24.03], ['Одеса', 46.48, 30.73], ['Харків', 49.99, 36.23], ['Дніпро', 48.46, 35.05], ['Запоріжжя', 47.84, 35.14], ['Вінниця', 49.23, 28.47], ['Житомир', 50.25, 28.66], ['Чернігів', 51.49, 31.29],
    ['Суми', 50.91, 34.8], ['Полтава', 49.59, 34.55], ['Черкаси', 49.44, 32.06], ['Кропивницький', 48.51, 32.26], ['Миколаїв', 46.97, 31.99], ['Херсон', 46.64, 32.61], ['Луцьк', 50.75, 25.33], ['Рівне', 50.62, 26.25], ['Тернопіль', 49.55, 25.59],
    ['Хмельницький', 49.42, 26.99], ['Івано-Франківськ', 48.92, 24.71], ['Ужгород', 48.62, 22.29], ['Чернівці', 48.29, 25.94], ['Донецьк', 48.0, 37.8], ['Луганськ', 48.57, 39.31], ['Сімферополь', 44.95, 34.1]];
  var BASES = [
    {id: 'scheme', name: 'Схема', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', sub: 'abcd', attr: '© OpenStreetMap contributors © CARTO'},
    {id: 'sat', name: 'Супутник', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Зображення © Esri, Maxar, Earthstar Geographics',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'},
    {id: 'osm', name: 'OSM', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap contributors'}
  ];
  // CARTO: стиль + ключ / токен облікового запису або повний шаблон адреси плиток з кабінету CARTO
  var CARTO_STYLES = {voyager: 'rastertiles/voyager', positron: 'light_all', dark: 'dark_all', 'voyager_nolabels': 'rastertiles/voyager_nolabels'};
  function cartoUrl(c) {
    if (!c || (!c.key && !c.style)) return null;
    var k = String(c.key || '').trim();
    if (/\{z\}/.test(k)) return k;                                   // повний шаблон з кабінету CARTO
    var u = 'https://{s}.basemaps.cartocdn.com/' + (CARTO_STYLES[c.style] || CARTO_STYLES.voyager) + '/{z}/{x}/{y}{r}.png';
    return k ? u + '?api_key=' + encodeURIComponent(k) : u;
  }
  var CADASTRE = 'https://map.land.gov.ua/geowebcache/service/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=kadastr&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:900913&WIDTH=256&HEIGHT=256&BBOX={bbox}';
  function lon2x(lon, z) { return (lon + 180) / 360 * 256 * Math.pow(2, z); }
  function lat2y(lat, z) { var s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); }
  function tileBBox(x, y, z) { var n = Math.pow(2, z), R = 6378137 * Math.PI, w = 2 * R / n; return [-R + x * w, R - (y + 1) * w, -R + (x + 1) * w, R - y * w].map(function (v) { return v.toFixed(2); }).join(','); }
  function tileUrl(tpl, z, x, y, sub) {
    var s = sub ? sub[(x + y) % sub.length] : 'a';
    return tpl.replace('{s}', s).replace('{r}', (window.devicePixelRatio || 1) > 1.5 ? '@2x' : '').replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{bbox}', tileBBox(x, y, z)).replace('{-y}', Math.pow(2, z) - 1 - y);
  }

  function Map(el, opt) {
    var self = this; opt = opt || {};
    this.el = el; this.points = []; this.polys = []; this.onClick = opt.onClick; this.opt = opt;
    this.bases = BASES.slice(); var cu = cartoUrl(opt.carto); if (cu) this.bases[0] = {id: 'scheme', name: 'Схема', url: cu, sub: /\{s\}/.test(cu) ? 'abcd' : null, attr: '© OpenStreetMap contributors © CARTO'};
    if (opt.tiles) this.bases.unshift({id: 'custom', name: 'Свій сервер', url: opt.tiles, attr: ''});
    this.base = 0; try { var sv = localStorage.getItem('arma-map-base'); this.bases.forEach(function (b, i) { if (b.id === sv) self.base = i; }); } catch (e) { /* без збереження */ }
    if (opt.base) this.bases.forEach(function (b, i) { if (b.id === opt.base) self.base = i; });
    this.cadUrl = opt.cadastre === '-' ? null : (opt.cadastre || CADASTRE); this.cadOn = !!opt.cadastreOn; this.cadFail = 0;
    el.classList.add('map-wrap');
    el.innerHTML = '<div class="map-tiles"></div><div class="map-tiles map-lbl"></div><div class="map-tiles map-cad"></div><canvas></canvas>' +
      '<div class="map-ctrl"><button type="button" data-z="1" title="Наблизити">+</button><button type="button" data-z="-1" title="Віддалити">−</button><button type="button" data-z="0" title="Уся Україна">⌂</button></div>' +
      '<div class="map-layers">' + this.bases.map(function (b, i) { return '<button type="button" data-base="' + i + '">' + b.name + '</button>'; }).join('') + (this.cadUrl ? '<button type="button" data-cad="1" title="Шар Публічної кадастрової карти (видно з масштабу 12)">Кадастр</button>' : '') + '</div>' +
      '<div class="map-attr"></div><div class="map-tip" hidden></div>';
    this.tilesEl = el.querySelector('.map-tiles'); this.lblEl = el.querySelector('.map-lbl'); this.cadEl = el.querySelector('.map-cad');
    this.cv = el.querySelector('canvas'); this.ctx = this.cv.getContext('2d'); this.tip = el.querySelector('.map-tip');
    this.failed = 0; this.dead = false;
    this.fit(44.3, 22, 52.4, 40.3);
    el.querySelectorAll('[data-z]').forEach(function (b) { b.addEventListener('click', function () { var z = +b.dataset.z; if (z === 0) { if (self.home) self.fit(self.home[0], self.home[1], self.home[2], self.home[3]); else self.fit(44.3, 22, 52.4, 40.3); } else self.zoomAt(self.w / 2, self.h / 2, z); }); });
    el.querySelectorAll('[data-base]').forEach(function (b) { b.addEventListener('click', function () { self.setBase(+b.dataset.base, true); }); });
    var cb = el.querySelector('[data-cad]'); if (cb) cb.addEventListener('click', function () { self.cadOn = !self.cadOn; self.cadFail = 0; self.cadEl.innerHTML = ''; self.syncButtons(); self.draw(); });
    var ptrs = {}, last = null, pinch = null, moved = false;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('.map-ctrl,.map-layers')) return; el.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.offsetX, e.offsetY]; last = [e.clientX, e.clientY]; moved = false;
      var k = Object.keys(ptrs); if (k.length === 2) pinch = dist(ptrs[k[0]], ptrs[k[1]]); });
    el.addEventListener('pointermove', function (e) {
      if (ptrs[e.pointerId]) {
        var k = Object.keys(ptrs); ptrs[e.pointerId] = [e.offsetX, e.offsetY];
        if (k.length === 2 && pinch) { var d = dist(ptrs[k[0]], ptrs[k[1]]); if (Math.abs(Math.log2(d / pinch)) > 0.5) { self.zoomAt((ptrs[k[0]][0] + ptrs[k[1]][0]) / 2, (ptrs[k[0]][1] + ptrs[k[1]][1]) / 2, d > pinch ? 1 : -1); pinch = d; } return; }
        var dx = e.clientX - last[0], dy = e.clientY - last[1]; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        last = [e.clientX, e.clientY]; self.cx -= dx; self.cy -= dy; self.draw();
      } else if (!e.target.closest('.map-ctrl,.map-layers')) self.hover(e.offsetX, e.offsetY);
    });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; if (!moved && e.type === 'pointerup' && !e.target.closest('.map-ctrl,.map-layers')) self.click(e.offsetX, e.offsetY); }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', function () { self.tip.hidden = true; });
    el.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1 : -1); }, {passive: false});
    window.addEventListener('resize', function () { self.resize(); self.draw(); });
    this.syncButtons();
  }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; }
  Map.prototype.syncButtons = function () {
    var self = this;
    this.el.querySelectorAll('[data-base]').forEach(function (b) { b.classList.toggle('on', +b.dataset.base === self.base && !self.dead); });
    var cb = this.el.querySelector('[data-cad]'); if (cb) cb.classList.toggle('on', this.cadOn);
    var b = this.bases[this.base];
    this.el.querySelector('.map-attr').textContent = this.dead ? 'Схема (підкладки карти недоступні в цій мережі)' : (b.attr || '') + (this.cadOn ? ' · Кадастр: Держгеокадастр' : '') + (this.cadOn && this.z < 12 ? ' (наблизьте до масштабу 12)' : '');
  };
  Map.prototype.setBase = function (i, user) {
    if (user) this.tried = 0;
    this.base = i; this.failed = 0; this.dead = false; this.tilesEl.innerHTML = ''; this.lblEl.innerHTML = '';
    if (user) { try { localStorage.setItem('arma-map-base', this.bases[i].id); } catch (e) { /* без збереження */ } }
    this.syncButtons(); this.draw();
  };
  Map.prototype.resize = function () { var r = this.el.getBoundingClientRect(); this.w = r.width || 800; this.h = r.height || 500; var dpr = window.devicePixelRatio || 1; this.cv.width = this.w * dpr; this.cv.height = this.h * dpr; this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px'; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  Map.prototype.fit = function (lat0, lon0, lat1, lon1) {
    this.resize();
    var dx = Math.max(lon2x(lon1, 0) - lon2x(lon0, 0), 1e-9), dy = Math.max(lat2y(lat0, 0) - lat2y(lat1, 0), 1e-9);
    var z = Math.max(3, Math.min(18.5, Math.log(Math.min(this.w * 0.92 / dx, this.h * 0.92 / dy)) / Math.LN2));
    this.z = z; this.cx = (lon2x(lon0, z) + lon2x(lon1, z)) / 2; this.cy = (lat2y(lat0, z) + lat2y(lat1, z)) / 2; this.draw();
  };
  // показати всі точки і контури цілком: межі з невеликим відступом; для однієї ділянки — масштаб «як на кадастровій карті»
  Map.prototype.bounds = function () {
    var a = 90, b = 180, c = -90, d = -180, n = 0;
    function add(lat, lon) { if (!(lat && lon)) return; n++; if (lat < a) a = lat; if (lat > c) c = lat; if (lon < b) b = lon; if (lon > d) d = lon; }
    this.polys.forEach(function (p) { p.rings.forEach(function (r) { r.forEach(function (pt) { add(pt[1], pt[0]); }); }); });
    this.points.forEach(function (p) { if (!p.hasPoly) add(p.lat, p.lon); });
    if (!n) this.points.forEach(function (p) { add(p.lat, p.lon); });
    return n || this.points.length ? [a, b, c, d] : null;
  };
  Map.prototype.fitPoints = function (keepHome) {
    var bb = this.bounds(); if (!bb) { this.home = null; return this.fit(44.3, 22, 52.4, 40.3); }
    var a = bb[0], b = bb[1], c = bb[2], d = bb[3], minS = 0.0012;
    if (c - a < minS) { a -= (minS - (c - a)) / 2; c = a + minS; } if (d - b < minS * 1.5) { b -= (minS * 1.5 - (d - b)) / 2; d = b + minS * 1.5; }
    var pa = (c - a) * 0.08, pd = (d - b) * 0.08;
    if (keepHome) { this.home = [a - pa, b - pd, c + pa, d + pd]; var hb = this.el.querySelector('[data-z="0"]'); if (hb) { hb.textContent = '⤢'; hb.title = 'Показати ділянку цілком'; } }
    this.fit(a - pa, b - pd, c + pa, d + pd);
  };
  Map.prototype.zoomAt = function (px, py, dz) {
    var nz = Math.max(3, Math.min(19, this.z + dz)); if (nz === this.z) return;
    var wx = this.cx - this.w / 2 + px, wy = this.cy - this.h / 2 + py, k = Math.pow(2, nz - this.z);
    this.cx = wx * k - px + this.w / 2; this.cy = wy * k - py + this.h / 2; this.z = nz; this.syncButtons(); this.draw();
  };
  Map.prototype.px = function (lat, lon) { return [lon2x(lon, this.z) - this.cx + this.w / 2, lat2y(lat, this.z) - this.cy + this.h / 2]; };
  Map.prototype.setData = function (points, polys) { this.points = points || []; this.polys = polys || []; this.draw(); };
  Map.prototype.layer = function (box, tpl, sub, x0, y0, n, z, onFail, cls) {
    // дробовий масштаб: плитки рівня floor(z), розтягнуті в 2^(z - floor(z)) раза — ділянка заповнює карту без «стрибків» масштабу
    z = Math.min(19, Math.floor(z + 1e-9)); var k = Math.pow(2, this.z - z), ts = 256 * k; n = Math.pow(2, z);
    var want = {}, tx0 = Math.floor(x0 / ts), ty0 = Math.floor(y0 / ts), tx1 = Math.floor((x0 + this.w) / ts), ty1 = Math.floor((y0 + this.h) / ts);
    for (var tx = tx0; tx <= tx1; tx++) for (var ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= n) continue; var wx = ((tx % n) + n) % n, key = z + '/' + wx + '/' + ty + '/' + tx; want[key] = 1;
      var img = box.querySelector('img[data-k="' + key + '"]');
      if (!img) { img = document.createElement('img'); img.dataset.k = key; img.alt = ''; img.draggable = false; img.referrerPolicy = 'strict-origin-when-cross-origin'; img.decoding = 'async';
        img.onerror = onFail; img.src = tileUrl(tpl, z, wx, ty, sub); box.appendChild(img); }
      img.style.left = (tx * ts - x0) + 'px'; img.style.top = (ty * ts - y0) + 'px'; img.style.width = img.style.height = (ts + 0.5) + 'px';
    }
    box.querySelectorAll('img').forEach(function (i) { if (!want[i.dataset.k]) i.remove(); });
  };
  Map.prototype.draw = function () {
    var self = this, z = this.z, n = Math.pow(2, z), x0 = this.cx - this.w / 2, y0 = this.cy - this.h / 2, b = this.bases[this.base];
    if (!this.dead) {
      this.layer(this.tilesEl, b.url, b.sub, x0, y0, n, z, function () {
        self.failed++;
        if (self.failed >= 4) { self.tried = (self.tried || 0) + 1;
          if (self.tried < self.bases.length) self.setBase((self.base + 1) % self.bases.length);     // автоматично наступна підкладка
          else { self.dead = true; self.tilesEl.innerHTML = ''; self.lblEl.innerHTML = ''; self.syncButtons(); self.draw(); } }
      });
      if (b.labels) this.layer(this.lblEl, b.labels, null, x0, y0, n, z, function () {}); else this.lblEl.innerHTML = '';
    }
    if (this.cadOn && this.cadUrl && z >= 12 && this.cadFail < 6) this.layer(this.cadEl, this.cadUrl, null, x0, y0, n, z, function () { self.cadFail++; if (self.cadFail >= 6) { self.cadEl.innerHTML = ''; self.el.querySelector('.map-attr').textContent = 'Шар кадастру недоступний з цієї мережі (сервер Держгеокадастру не відповідає)'; } });
    else this.cadEl.innerHTML = '';
    var c = this.ctx; c.clearRect(0, 0, this.w, this.h);
    if (this.dead) {
      c.fillStyle = '#5B6B88'; c.font = '11px sans-serif';
      CITIES.forEach(function (ct) { var p = self.px(ct[1], ct[2]); c.beginPath(); c.arc(p[0], p[1], 2, 0, 7); c.fill(); c.fillText(ct[0], p[0] + 5, p[1] - 4); });
    }
    this.screen = []; this.screenPoly = [];
    this.polys.forEach(function (pg) {
      c.beginPath(); var bb = [1e9, 1e9, -1e9, -1e9];
      pg.rings.forEach(function (ring) { ring.forEach(function (pt, i) { var p = self.px(pt[1], pt[0]); if (p[0] < bb[0]) bb[0] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[0] > bb[2]) bb[2] = p[0]; if (p[1] > bb[3]) bb[3] = p[1]; if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); });
      c.fillStyle = (pg.color || '#F5C518') + (pg.fill || '66'); c.strokeStyle = pg.stroke || pg.color || '#F5C518'; c.lineWidth = pg.width || (z >= 14 ? 2.5 : 1.5); c.fill(); c.stroke();
      if (bb[2] - bb[0] < 6 && bb[3] - bb[1] < 6) { c.beginPath(); c.arc((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, 4, 0, 7); c.fillStyle = pg.color || '#F5C518'; c.fill(); }
      self.screenPoly.push([bb, pg]);
    });
    var pts = this.points, cluster = pts.length > 300 && z < 10, r = z >= 13 ? 7 : z >= 10 ? 5 : 3.6;
    if (cluster) {
      var cell = 46, grid = {};
      pts.forEach(function (pt) { var p = self.px(pt.lat, pt.lon); if (p[0] < -20 || p[1] < -20 || p[0] > self.w + 20 || p[1] > self.h + 20) return; var k = Math.floor(p[0] / cell) + ':' + Math.floor(p[1] / cell); (grid[k] = grid[k] || {x: 0, y: 0, n: 0, list: [], col: {}}); var g = grid[k]; g.x += p[0]; g.y += p[1]; g.n++; g.list.push(pt); g.col[pt.color] = (g.col[pt.color] || 0) + 1; });
      Object.keys(grid).forEach(function (k) { var g = grid[k], x = g.x / g.n, y = g.y / g.n, col = Object.keys(g.col).sort(function (a, b2) { return g.col[b2] - g.col[a]; })[0];
        if (g.n === 1) { dot(x, y, g.list[0].color, r); if (g.list[0].approx) { c.beginPath(); c.arc(x, y, Math.max(1.6, r * 0.45), 0, 7); c.fillStyle = '#fff'; c.fill(); } self.screen.push([x, y, g.list[0]]); return; }
        var rr = Math.min(26, 10 + Math.log2(g.n) * 3); c.beginPath(); c.arc(x, y, rr, 0, 7); c.fillStyle = col + 'CC'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
        c.fillStyle = '#0B1220'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.n > 999 ? Math.round(g.n / 100) / 10 + 'k' : g.n, x, y); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        self.screen.push([x, y, {cluster: true, n: g.n, list: g.list, label: g.n + ' ділянок — наблизьте'}]); });
    } else pts.forEach(function (pt) { var p = self.px(pt.lat, pt.lon); if (p[0] < -10 || p[1] < -10 || p[0] > self.w + 10 || p[1] > self.h + 10) return; if (pt.hasPoly && z >= 13) return; dot(p[0], p[1], pt.color, r); if (pt.approx) { c.beginPath(); c.arc(p[0], p[1], Math.max(1.6, r * 0.45), 0, 7); c.fillStyle = '#fff'; c.fill(); } self.screen.push([p[0], p[1], pt]); });
    function dot(x, y, col, rad) { c.beginPath(); c.arc(x, y, rad, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke(); }
  };
  Map.prototype.find = function (x, y) {
    var best = null, bd = 260; (this.screen || []).forEach(function (s) { var d = (s[0] - x) * (s[0] - x) + (s[1] - y) * (s[1] - y), lim = s[2].cluster ? 700 : 260; if (d < lim && d < (best ? bd : lim)) { bd = d; best = s[2]; } });
    if (best) return best;
    var hit = null; (this.screenPoly || []).forEach(function (s) { var b = s[0]; if (x >= b[0] - 3 && x <= b[2] + 3 && y >= b[1] - 3 && y <= b[3] + 3) hit = s[1]; });
    return hit;
  };
  Map.prototype.hover = function (x, y) {
    var p = this.find(x, y); this.el.style.cursor = p ? 'pointer' : 'grab';
    if (p && p.label) { this.tip.hidden = false; this.tip.textContent = p.label; this.tip.style.left = Math.min(x + 12, this.w - 260) + 'px'; this.tip.style.top = (y + 12) + 'px'; } else this.tip.hidden = true;
  };
  Map.prototype.click = function (x, y) {
    var p = this.find(x, y); if (!p) return;
    if (p.cluster) { this.zoomAt(x, y, 2); return; }
    if (this.onClick) this.onClick(p);
  };
  window.ArmaMap = Map;
})();
