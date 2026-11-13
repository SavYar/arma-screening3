/* Інфографіка «Активи АРМА у цифрах» — окремий лендінг відкритих даних (зауваження 21.10.2026, п. 15; 26.10.2026).
   Мета — узагальнена аналітика портфеля для суспільства і партнерів (не пошук інвесторів, тому без переходів у каталог лотів).
   Дані — /api/public/infographics (сервер, зовнішній VPS після синхронізації) або data-public.json (дзеркало).
   Лише агреговані показники, без переліків активів, сторін договорів і персональних даних.
   Інтерактивність: перемикач «Усі / Інвестиційно привабливі», розгортання категорії зі зведеною аналітикою, підсвітка сегментів
   діаграм з підказкою і зміною підсумку в центрі. Вбудовування: <iframe src="…/page/dashboard/?embed=1">. */
(function () {
  'use strict';
  var MODE = window.ARMA_MODE || 'static', API = window.ARMA_API || '', ST = window.ARMA_STATIC || '', D = window.D || {};
  var $ = document.getElementById('ig'), Q = new URLSearchParams(location.search), EMBED = Q.get('embed') === '1';
  var MON = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'], MONF = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  var CAT = {}, ICON = {realestate: '🏢', land: '🌾', transport: '🚚', property: '📦', corporate: '🏭', money: '💰', crypto: '₿'};
  (D.CATEGORIES || []).forEach(function (c) { CAT[c[0]] = c[1]; });
  var LEG = {}; (D.LEGAL || []).forEach(function (l) { LEG[l[0]] = l[1].split(' — ')[0]; });
  var LEGC = {full: '#14A463', limited: '#F5B70A', lost: '#E5484D', closed: '#6E7F9E', unknown: '#B8C2D6'};
  var PAL = ['#1F4FD8', '#F5B70A', '#14A463', '#7B61FF', '#E5484D', '#00A3C4', '#F07B3F', '#6E7F9E', '#C04CC8', '#8BA3D9'];
  var SST = {preparation: 'Підготовка до продажу', announced: 'Аукціон оголошено', repeat: 'Повторні торги', sold: 'Реалізовано', not_sold: 'Не реалізовано', withdrawn: 'Знято з реалізації'};
  var DATA = null, SC = 'all', OPEN = null;
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function num(v, d) { v = Number(v) || 0; var s = v.toFixed(d || 0).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return s.join(','); }
  function money(v, short) { v = Number(v) || 0; if (v >= 1e9) return num(v / 1e9, 2) + (short ? ' млрд' : ' млрд ₴'); if (v >= 1e6) return num(v / 1e6, 1) + (short ? ' млн' : ' млн ₴'); if (v >= 1e3) return num(v / 1e3, 0) + (short ? ' тис' : ' тис ₴'); return num(v) + (short ? '' : ' ₴'); }
  function full(v) { return num(v, 2) + ' ₴'; }
  function ent(o) { return Object.keys(o || {}).map(function (k) { return [k, o[k]]; }); }
  function sumA(a) { return (a || []).reduce(function (s, x) { return s + (Number(x) || 0); }, 0); }
  function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }

  // ------------------------------------------------------------ підказка
  var tip = document.createElement('div'); tip.className = 'ig-tip'; document.body.appendChild(tip);
  function showTip(e, html) { tip.innerHTML = html; tip.style.display = 'block'; var x = e.clientX + 14, y = e.clientY + 14; if (x + tip.offsetWidth > innerWidth - 8) x = e.clientX - tip.offsetWidth - 14; if (y + tip.offsetHeight > innerHeight - 8) y = e.clientY - tip.offsetHeight - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  function hideTip() { tip.style.display = 'none'; }

  // ------------------------------------------------------------ діаграми (SVG, без бібліотек)
  // інтерактивне кільце: наведення / клік на сегмент або рядок легенди — сегмент висувається, інші тьмяніють, у центрі — значення і частка
  function donut(rows, colors, centerSub, fmt) {
    rows = rows.filter(function (r) { return r[1] > 0; });
    var tot = rows.reduce(function (s, r) { return s + r[1]; }, 0) || 1, a = -Math.PI / 2, R = 72, r = 47, paths = '', f0 = fmt || num;
    rows.forEach(function (x, i) {
      var f = x[1] / tot, b = a + f * Math.PI * 2, big = f > 0.5 ? 1 : 0, c = colors[i % colors.length], mid = (a + b) / 2;
      var d = f >= 0.9999 ? 'M80 8A72 72 0 1 1 79.99 8L79.99 33A47 47 0 1 0 80 33Z' : 'M' + (80 + R * Math.cos(a)) + ' ' + (80 + R * Math.sin(a)) + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + (80 + R * Math.cos(b)) + ' ' + (80 + R * Math.sin(b)) + 'L' + (80 + r * Math.cos(b)) + ' ' + (80 + r * Math.sin(b)) + 'A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + (80 + r * Math.cos(a)) + ' ' + (80 + r * Math.sin(a)) + 'Z';
      paths += '<path class="seg" data-i="' + i + '" data-dx="' + (Math.cos(mid) * 6).toFixed(2) + '" data-dy="' + (Math.sin(mid) * 6).toFixed(2) + '" d="' + d + '" fill="' + c + '"/>';
      a = b;
    });
    var payload = esc(JSON.stringify({rows: rows, tot: tot, sub: centerSub || '', money: fmt === money}));
    return '<div class="ig-donut" data-donut="' + payload + '"><svg viewBox="0 0 160 160" role="img" aria-label="Кругова діаграма">' + paths + '<text x="80" y="78" text-anchor="middle" class="t1">' + esc(f0(tot)) + '</text><text x="80" y="96" text-anchor="middle" class="t2">' + esc(centerSub || '') + '</text></svg>' +
      '<ul>' + rows.map(function (x, i) { return '<li data-i="' + i + '"><i style="background:' + colors[i % colors.length] + '"></i><span>' + esc(x[0]) + '</span><b>' + f0(x[1]) + '</b><em>' + num(pct(x[1], tot), 1) + '%</em></li>'; }).join('') + '</ul></div>';
  }
  function bindDonuts(root) {
    root.querySelectorAll('[data-donut]').forEach(function (box) {
      var p = JSON.parse(box.getAttribute('data-donut')), f0 = p.money ? money : num, t1 = box.querySelector('.t1'), t2 = box.querySelector('.t2'), lock = null;
      function hl(i) {
        box.querySelectorAll('.seg').forEach(function (s) { var on = +s.dataset.i === i; s.classList.toggle('dim', i !== null && !on); s.style.transform = on ? 'translate(' + s.dataset.dx + 'px,' + s.dataset.dy + 'px)' : ''; });
        box.querySelectorAll('li').forEach(function (l) { l.classList.toggle('on', +l.dataset.i === i); l.classList.toggle('dim', i !== null && +l.dataset.i !== i); });
        if (i === null) { t1.textContent = f0(p.tot); t2.textContent = p.sub; } else { t1.textContent = f0(p.rows[i][1]); t2.textContent = num(pct(p.rows[i][1], p.tot), 1) + '% · ' + String(p.rows[i][0]).slice(0, 22); }
      }
      box.addEventListener('mouseover', function (e) { var el = e.target.closest('[data-i]'); if (!el) return; var i = +el.dataset.i; hl(i); showTip(e, '<b>' + esc(p.rows[i][0]) + '</b><br>' + (p.money ? full(p.rows[i][1]) : num(p.rows[i][1])) + ' · ' + num(pct(p.rows[i][1], p.tot), 1) + '%'); });
      box.addEventListener('mousemove', function (e) { if (e.target.closest('[data-i]')) showTip(e, tip.innerHTML); });
      box.addEventListener('mouseleave', function () { hideTip(); hl(lock); });
      box.addEventListener('click', function (e) { var el = e.target.closest('[data-i]'); if (!el) { lock = null; hl(null); return; } lock = lock === +el.dataset.i ? null : +el.dataset.i; hl(lock); });
      box._reset = function () { if (lock === null) return; lock = null; hl(null); };
    });
  }
  // v2.7: натискання поза діаграмою (комп’ютер і телефон) — повернення до початкового вигляду всіх діаграм
  document.addEventListener('click', function (e) { document.querySelectorAll('[data-donut]').forEach(function (b) { if (!b.contains(e.target) && b._reset) b._reset(); }); hideTip(); }, true);
  function hbars(rows, fmt, color) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1])), tot = sumA(rows.map(function (r) { return r[1]; }));
    return '<div class="ig-hbars">' + rows.map(function (r) { return '<div class="hb" data-tip="' + esc('<b>' + esc(r[0]) + '</b><br>' + (fmt ? fmt(r[1]) : num(r[1])) + (tot ? ' · ' + num(pct(r[1], tot), 1) + '%' : '')) + '"><span>' + esc(r[0]) + '</span><i><s style="width:' + (r[1] * 100 / max).toFixed(1) + '%;background:' + (color || 'var(--ig-blue)') + '"></s></i><b>' + (fmt ? fmt(r[1]) : num(r[1])) + '</b></div>'; }).join('') + '</div>';
  }
  function axl(v) { var f = function (x) { return String(Math.round(x * 10) / 10).replace('.', ','); }; return v >= 1e9 ? f(v / 1e9) + ' млрд' : v >= 1e6 ? f(v / 1e6) + ' млн' : v >= 1e3 ? f(v / 1e3) + ' тис' : f(v); }
  // стовпчики за місяцями: смуги місяців, наведення — підсвітка місяця і підказка зі значеннями
  function columns(series, labels, fullLabels) {
    var W = 680, H = 240, pl = 64, pr = 8, pb = 26, pt = 10, n = labels.length, g = (W - pl - pr) / n, k = series.length, bw = Math.min(22, (g - 8) / k);
    var max = Math.max.apply(null, [1].concat.apply([], series.map(function (s) { return s.values; })));
    var raw = max / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(function (q) { return q * p10; }).filter(function (v) { return v >= raw; })[0]; max = step * 4;
    var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ig-cols" role="img" aria-label="Стовпчикова діаграма">';
    for (var j = 0; j < n; j++) h += '<rect class="band' + (j % 2 ? ' odd' : '') + '" data-j="' + j + '" x="' + (pl + g * j) + '" y="' + pt + '" width="' + g + '" height="' + (H - pt - pb) + '"/>';
    for (var i = 0; i <= 4; i++) { var y = pt + (H - pt - pb) * (1 - i / 4); h += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="' + (pl - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="ax">' + axl(step * i) + '</text>'; }
    labels.forEach(function (l, j) {
      var x0 = pl + g * j + (g - bw * k) / 2;
      series.forEach(function (s, si) { var v = s.values[j] || 0, hh = (H - pt - pb) * v / max; if (v > 0) h += '<rect class="bar" x="' + (x0 + si * bw + 1) + '" y="' + (H - pb - hh) + '" width="' + (bw - 2) + '" height="' + Math.max(hh, 1.5) + '" rx="3" fill="' + s.color + '"/>'; });
      h += '<text x="' + (pl + g * j + g / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="ax">' + esc(l) + '</text>';
    });
    var info = esc(JSON.stringify({labels: fullLabels || labels, series: series.map(function (s) { return {name: s.name, values: s.values}; })}));
    return '<div class="ig-colwrap" data-cols="' + info + '">' + h + '</svg></div><div class="ig-leg">' + series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + ' · ' + money(sumA(s.values)) + '</span>'; }).join('') + '</div>';
  }
  function bindCols(root) {
    root.querySelectorAll('[data-cols]').forEach(function (box) {
      var p = JSON.parse(box.getAttribute('data-cols'));
      box.addEventListener('mousemove', function (e) { var b = e.target.closest('.band'); box.querySelectorAll('.band.hl').forEach(function (x) { if (x !== b) x.classList.remove('hl'); }); if (!b) return hideTip(); b.classList.add('hl'); var j = +b.dataset.j;
        showTip(e, '<b>' + esc(p.labels[j]) + '</b>' + p.series.map(function (s) { return '<br>' + esc(s.name) + ': ' + full(s.values[j] || 0); }).join('')); });
      box.addEventListener('mouseleave', function () { hideTip(); box.querySelectorAll('.band.hl').forEach(function (x) { x.classList.remove('hl'); }); });
    });
  }
  function qsort(o) { o = Object.assign({}, o); Object.keys(o).forEach(function (k) { if (!o[k]) delete o[k]; }); return ent(o).sort(function (a, b) { var x = a[0].match(/(\d) кв\. (\d{4})/), y = b[0].match(/(\d) кв\. (\d{4})/); return (+x[2] - +y[2]) || (+x[1] - +y[1]); }); }
  function kpi(v, l, sub, raw) { return '<div class="ig-kpi"><b' + (raw !== undefined ? ' data-count="' + raw + '"' : '') + '>' + v + '</b><span>' + esc(l) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }
  function legalRows(L) { return ['full', 'limited', 'lost', 'closed', 'unknown'].filter(function (k) { return L[k]; }).map(function (k) { return [LEG[k] || k, L[k], k]; }); }

  // ------------------------------------------------------------ розділи
  function portfolio() {
    var I = DATA.info, P = I[SC === 'att' ? 'attractive' : 'portfolio'] || I.portfolio, A = I.portfolio, att = SC === 'att', lg = legalRows(P.legal);
    var h = '<div class="ig-switch" role="tablist"><button data-sc="all" class="' + (att ? '' : 'on') + '">Усі активи · ' + num(A.total) + '</button><button data-sc="att" class="' + (att ? 'on' : '') + '">Інвестиційно привабливі · ' + num((I.attractive || {}).total || 0) + '</button></div>';
    h += '<div class="ig-row r5">' + kpi(num(P.total), att ? 'інвестиційно привабливих активів' : 'активів у Реєстрі', att ? num(pct(P.total, A.total), 1) + '% від усіх ' + num(A.total) : 'усіх категорій', P.total) +
      kpi(num(P.simple), 'з них простих', num(pct(P.simple, P.total), 1) + '%', P.simple) + kpi(num(P.complex), 'складних', 'потребують комплексного управління', P.complex) +
      kpi(num(P.pools), 'пулів і ЄМК', 'у т.ч. активів у них: ' + num(P.in_pools), P.pools) + kpi(money(P.value), 'оціночна вартість', 'за наявними звітами про оцінку') + '</div>';
    h += '<div class="ig-grid g3"><div class="ig-card"><h3>Правовий стан</h3>' + donut(lg.map(function (x) { return [x[0], x[1]]; }), lg.map(function (x) { return LEGC[x[2]]; }), att ? 'привабливих' : 'активів') + '<p class="ig-note">«Повний обсяг» — арешт і передача в управління чинні; «Вибув» — реалізовано, конфісковано або повернуто.</p></div>' +
      '<div class="ig-card"><h3>Прості і складні</h3>' + donut([['Прості активи', P.simple], ['Складні активи', P.complex]], ['#1F4FD8', '#F5B70A'], att ? 'привабливих' : 'активів') + '<p class="ig-note">Складні — об’єкти єдиного майнового комплексу, товариства, групи майна. Об’єднуються в пули і ЄМК для спільної оцінки та передачі.</p></div>' +
      '<div class="ig-card"><h3>Області <small>топ-12, без фінансових активів</small></h3>' + hbars(P.regions.slice(0, 12)) + '</div></div>';
    return h;
  }
  function catDetail(k) {
    var I = DATA.info, P = I[SC === 'att' ? 'attractive' : 'portfolio'] || I.portfolio, c = (P.cats || {})[k], ag = DATA.agg || {}; if (!c) return '';
    var area = k === 'realestate' ? [num(c.area) + ' м²', 'загальна площа (' + num(c.area_n) + ' об’єктів з площею' + (c.area_n ? ', у середньому ' + num(c.area / c.area_n) + ' м²' : '') + ')'] : k === 'land' ? [num(c.area, 2) + ' га', 'площа ділянок (' + num(c.area_n) + ' з площею' + (c.area_n ? ', у середньому ' + num(c.area / c.area_n, 2) + ' га' : '') + ')'] : null;
    var val = k === 'money' && ag.money && SC === 'all' ? [money(ag.money.total), 'гривневий еквівалент'] : k === 'crypto' && ag.crypto && SC === 'all' ? [money(ag.crypto.total), 'за поточним курсом'] : [c.v ? money(c.v) : '—', 'оціночна вартість'];
    var tl = {realestate: 'Типи нерухомості', land: 'Цільове призначення', transport: 'Види транспорту і техніки', property: 'Види майна', corporate: 'Розмір частки АРМА в товаристві'}[k], lg = legalRows(c.legal);
    var h = '<div class="ig-detail"><div class="ig-dh"><em>' + (ICON[k] || '•') + '</em><div><h3>' + esc(CAT[k]) + (SC === 'att' ? ' · інвестиційно привабливі' : '') + '</h3><small>зведена аналітика категорії — без переліку активів</small></div><button class="ig-x" data-close-cat aria-label="Закрити">×</button></div>' +
      '<div class="ig-row r4">' + kpi(num(c.n), 'активів', num(pct(c.n, P.total), 1) + '% портфеля') + kpi(val[0], val[1]) + (area ? kpi(area[0], area[1]) : kpi(num(c.cx), 'складних', num(pct(c.cx, c.n), 1) + '% категорії')) + kpi(num(c.n - c.cx), 'простих', 'складних: ' + num(c.cx)) + '</div>' +
      '<div class="ig-grid g3">' + (tl && c.types.length ? '<div class="ig-card"><h3>' + tl + '</h3>' + donut(c.types, PAL, 'активів') + '</div>' : '') +
      '<div class="ig-card"><h3>Правовий стан</h3>' + donut(lg.map(function (x) { return [x[0], x[1]]; }), lg.map(function (x) { return LEGC[x[2]]; }), 'активів') + '</div>' +
      (c.regions.length ? '<div class="ig-card"><h3>Області <small>топ-10</small></h3>' + hbars(c.regions) + '</div>' : '') + '</div></div>';
    return h;
  }
  function cats() {
    var I = DATA.info, P = I[SC === 'att' ? 'attractive' : 'portfolio'] || I.portfolio, ag = DATA.agg || {}, tot = P.total || 1;
    var cs = ent(P.cats).filter(function (c) { return CAT[c[0]]; }).sort(function (a, b) { return b[1].n - a[1].n; });
    return '<div class="ig-tiles">' + cs.map(function (c) {
      var k = c[0], v = c[1], extra = k === 'money' && ag.money && SC === 'all' ? money(ag.money.total) + ' — гривневий еквівалент' : k === 'crypto' && ag.crypto && SC === 'all' ? money(ag.crypto.total) + ' — за курсом' : k === 'realestate' && v.area ? num(v.area) + ' м² · ' + (v.v ? money(v.v) : 'оцінка уточнюється') : k === 'land' && v.area ? num(v.area, 2) + ' га · ' + (v.v ? money(v.v) : 'оцінка уточнюється') : v.v ? money(v.v) + ' — оціночна вартість' : 'оцінка уточнюється';
      return '<button class="ig-tile' + (OPEN === k ? ' on' : '') + '" data-cat="' + k + '"><em>' + (ICON[k] || '•') + '</em><b data-count="' + v.n + '">' + num(v.n) + '</b><span>' + esc(CAT[k]) + '</span><i><s style="width:' + Math.max(1.5, v.n * 100 / tot).toFixed(1) + '%"></s></i><small>' + num(pct(v.n, tot), 1) + '% · ' + esc(extra) + '</small><u>' + (OPEN === k ? 'згорнути ▲' : 'детальніше ▼') + '</u></button>';
    }).join('') + '</div>' + (OPEN ? catDetail(OPEN) : '');
  }
  function render() {
    var I = DATA.info, ag = DATA.agg || {};
    if (!I) { $.innerHTML = '<div class="ig-wrap"><div class="ig-empty">Інфографіку тимчасово вимкнено.</div></div>'; return; }
    var A0 = I.portfolio, M = I.mgmt, R = I.sales, y = I.year, h = '';
    if (!EMBED) h += '<header class="ig-top"><div class="ig-wrap"><a class="ig-logo" href="https://arma.gov.ua" target="_blank" rel="noopener"><img src="' + ST + 'logo.png" alt=""><span>АРМА<small>Агентство з розшуку та менеджменту активів</small></span></a><nav><a href="#portfolio">Портфель</a><a href="#cats">Категорії</a><a href="#mgmt">Управління</a><a href="#sales">Реалізація</a>' + ((DATA.agg || {}).money || (DATA.agg || {}).crypto ? '<a href="#fin">Фінансові</a>' : '') + '<a class="ig-cta" href="https://arma.gov.ua" target="_blank" rel="noopener">Про АРМА ↗</a></nav></div></header>';
    var yr = M.by_month || {}, cy = sumA(yr[y]);
    h += '<section class="ig-hero"><div class="ig-wrap"><p class="ig-eyebrow">Відкриті дані · станом на ' + esc((I.updated || '').slice(0, 10).split('-').reverse().join('.')) + '</p><h1>Активи під управлінням АРМА<br><em>у цифрах</em></h1><p class="ig-lead">Узагальнена аналітика Реєстру арештованих активів: структура портфеля, правовий стан, категорії, управління активами і надходження до державного бюджету, реалізація на електронних аукціонах.</p>' +
      '<div class="ig-hk">' + kpi(num(A0.total), 'активів у Реєстрі', 'усіх категорій', A0.total) + kpi(num((I.attractive || {}).total || 0), 'інвестиційно привабливих', num(pct((I.attractive || {}).total || 0, A0.total), 1) + '% портфеля', (I.attractive || {}).total || 0) + kpi(num(M.active), 'діючих договорів управління', num(M.contracts) + ' в обліку', M.active) +
      kpi(money(cy), 'надійшло до бюджету за ' + y, 'від управління (казначейство)') + kpi(money(M.transferred_total), 'з початку дії договорів', 'перераховано до бюджету') + '</div></div><div class="ig-glow"></div></section>';
    h += '<section class="ig-sec" id="portfolio"><div class="ig-wrap"><h2><span>01</span>Портфель активів</h2><p class="ig-sub">Скільки активів передано в управління АРМА, у якому вони правовому стані та де розташовані. Перемикач показує всю статистику для всіх або лише для інвестиційно привабливих активів.</p><div data-part="portfolio">' + portfolio() + '</div></div></section>';
    h += '<section class="ig-sec alt" id="cats"><div class="ig-wrap"><h2><span>02</span>Категорії активів</h2><p class="ig-sub">Кількість, частка, вартість і площа за видами активів. Натисніть на категорію — відкриється зведена аналітика (типи, правовий стан, області).</p><div data-part="cats">' + cats() + '</div></div></section>';
    var ser = []; if (yr[y - 1]) ser.push({name: String(y - 1), values: yr[y - 1], color: '#B8C7EE'}); if (yr[y]) ser.push({name: String(y), values: yr[y], color: '#1F4FD8'});
    var mk = ent(M.kinds).sort(function (a, b) { return b[1] - a[1]; }), mf = qsort(M.forecast);
    h += '<section class="ig-sec" id="mgmt"><div class="ig-wrap"><h2><span>03</span>Управління активами</h2><p class="ig-sub">Активи, передані управителям за договорами, приносять щомісячні надходження до державного бюджету: гарантійні платежі та частку доходу від управління.</p>' +
      '<div class="ig-row">' + kpi(num(M.active), 'діючих договорів', 'з ' + num(M.contracts) + ' укладених', M.active) + kpi(money(M.guarantee), 'гарантійних платежів на місяць', 'за умовами діючих договорів') + kpi(money(cy), 'надійшло до бюджету за ' + y, 'за даними казначейства') + kpi(money(M.transferred_total), 'усього перераховано', 'з початку дії договорів') + '</div>' +
      '<div class="ig-grid g21"><div class="ig-card"><h3>Надходження до бюджету за місяцями <small>казначейство</small></h3>' + (ser.length ? columns(ser, MON, MON.map(function (m, i) { return MONF[i]; })) : '<p class="ig-note">Дані з’являться після внесення звітів.</p>') + '</div>' +
      '<div class="ig-card"><h3>Договори за видом активу</h3>' + (mk.length ? donut(mk, PAL, 'договорів') : '<p class="ig-note">—</p>') + '</div></div>' +
      (mf.length ? '<div class="ig-card"><h3>Очікувані надходження за планами управління <small>прогноз за кварталами</small></h3>' + hbars(mf, money, 'var(--ig-gold)') + '</div>' : '') + '</div></section>';
    var rs = ent(R.status).map(function (x) { return [SST[x[0]] || x[0], x[1]]; }).sort(function (a, b) { return b[1] - a[1]; }), rk = ent(R.kinds).sort(function (a, b) { return b[1] - a[1]; }), rf = qsort(R.forecast), sy = R.by_month || {};
    h += '<section class="ig-sec alt" id="sales"><div class="ig-wrap"><h2><span>04</span>Реалізація активів</h2><p class="ig-sub">Активи, щодо яких ухвалено рішення про реалізацію, продаються на електронних аукціонах; кошти зараховуються до бюджету або на депозитний рахунок.</p>' +
      '<div class="ig-row">' + kpi(num(R.in_work), 'лотів у роботі', 'підготовка, торги, повторні торги', R.in_work) + kpi(money(R.expected), 'очікувані надходження', 'за лотами в роботі') + kpi(num(R.sold), 'активів реалізовано', 'за даними обліку', R.sold) + kpi(money(R.received), 'отримано від реалізації', 'за реалізованими лотами') + '</div>' +
      '<div class="ig-grid g3"><div class="ig-card"><h3>Стан реалізації</h3>' + (rs.length ? donut(rs, ['#6E7F9E', '#F5B70A', '#F07B3F', '#14A463', '#E5484D', '#B8C2D6'], 'лотів') : '<p class="ig-note">—</p>') + '</div>' +
      '<div class="ig-card"><h3>Вид активу <small>лоти в роботі</small></h3>' + (rk.length ? hbars(rk.slice(0, 8), null, 'var(--ig-gold)') : '<p class="ig-note">—</p>') + '</div>' +
      '<div class="ig-card"><h3>Прогноз надходжень <small>за планами реалізації</small></h3>' + (rf.length ? hbars(rf, money, 'var(--ig-green)') : '<p class="ig-note">Прогнозні строки ще не визначено.</p>') + '</div></div>' +
      (sumA(sy[y]) ? '<div class="ig-card"><h3>Надходження від реалізації за місяцями ' + y + '</h3>' + columns([{name: String(y), values: sy[y], color: '#14A463'}], MON, MONF) + '</div>' : '') + '</div></section>';
    h += finance();
    if (!EMBED) h += '<footer class="ig-foot"><div class="ig-wrap"><p>Джерело: Реєстр активів, на які накладено арешт у кримінальному провадженні, АРМА. Показники оновлюються автоматично після змін у робочій системі АРМА. Наведено лише узагальнені дані — без переліків активів, сторін договорів і персональних даних.</p><p class="ig-upd">Оновлено: ' + esc(I.updated || '') + '</p></div></footer>';
    $.innerHTML = h; bindAll($); countUp($);
    if (EMBED) { try { parent.postMessage({armaInfographicsHeight: document.body.scrollHeight}, '*'); } catch (e) { /* ок */ } }
  }
  // v2.7: фінансові активи — кошти (депозити за валютами, ОВДП, метали) і криптоактиви (ринкова вартість, стейблкоїни / волатильні, кількість у криптовалюті);
  // кожен модуль вимикається в налаштуваннях сайту; дані — автоматично з Реєстру або підсумки, внесені вручну
  function finance() {
    var ag = DATA.agg || {}, M = ag.money, C = ag.crypto; if (!M && !C) return '';
    var h = '<section class="ig-sec" id="fin"><div class="ig-wrap"><h2><span>05</span>Фінансові активи</h2><p class="ig-sub">Арештовані кошти, державні облігації (ОВДП), банківські метали і криптоактиви — лише узагальнені суми, без рахунків і гаманців.</p><div class="ig-grid g2f">';
    if (M) { var dep = ent(M.deposits || {}).sort(function (a, b) { return b[1].uah - a[1].uah; }), by = ent(M.by).filter(function (x) { return x[1] > 0; });
      h += '<div class="ig-card"><h3>Кошти, ОВДП, банківські метали' + (M.as_of ? ' <small>станом на ' + esc(String(M.as_of).split('-').reverse().join('.')) + '</small>' : '') + '</h3><div class="ig-row r2">' + kpi(money(M.total), 'гривневий еквівалент усього') + kpi(num(M.count), 'записів') + '</div>' +
        (by.length ? donut(by, ['#1F4FD8', '#14A463', '#F5B70A', '#6E7F9E'], 'гривень', money) : '') +
        (dep.length ? '<h4 class="ig-h4">Депозити за валютами</h4>' + hbars(dep.map(function (x) { return [x[0] + (x[0] !== 'UAH' && x[1].amount ? ' · ' + num(x[1].amount) + ' ' + x[0] : ''), x[1].uah]; }), money) : '') + '</div>'; }
    if (C) { var tk = (C.tokens || []).filter(function (t) { return t[1]; });
      h += '<div class="ig-card"><h3>Криптоактиви' + (C.as_of ? ' <small>станом на ' + esc(String(C.as_of).split('-').reverse().join('.')) + '</small>' : '') + '</h3><div class="ig-row r2">' + kpi(money(C.total), 'поточна ринкова вартість', C.total_usd ? '≈ $ ' + num(C.total_usd) : '') + kpi(num(C.count), 'записів криптоактивів') + '</div>' +
        ((C.stable || C.volatile) ? donut([['Стейблкоїни (USDT, USDC)', C.stable || 0], ['Волатильні (BTC, ETH та ін.)', C.volatile || 0]], ['#14A463', '#7B61FF'], 'гривень', money) : '') +
        (tk.length ? '<h4 class="ig-h4">Кількість у криптовалюті</h4><div class="ig-toks">' + tk.map(function (t) { return '<div><b>' + num(t[1], t[1] >= 1000 ? 2 : 6).replace(/,?0+$/, '') + '</b><span>' + esc(t[0]) + '</span>' + (t[2] ? '<small>≈ ' + money(t[2]) + '</small>' : '') + '</div>'; }).join('') + '</div>' : '') + '</div>'; }
    return h + '</div></div></section>';
  }
  function bindAll(root) { bindDonuts(root); bindCols(root); }
  function rerender(part) { var el = $.querySelector('[data-part="' + part + '"]'); if (!el) return; el.innerHTML = part === 'portfolio' ? portfolio() : cats(); bindAll(el); countUp(el); }
  $.addEventListener('click', function (e) {
    var sc = e.target.closest('[data-sc]'); if (sc) { SC = sc.dataset.sc; rerender('portfolio'); rerender('cats'); return; }
    if (e.target.closest('[data-close-cat]')) { OPEN = null; rerender('cats'); return; }
    var t = e.target.closest('[data-cat]'); if (t) { OPEN = OPEN === t.dataset.cat ? null : t.dataset.cat; rerender('cats'); if (OPEN) { var d = $.querySelector('.ig-detail'); if (d) d.scrollIntoView({behavior: 'smooth', block: 'nearest'}); } }
  });
  $.addEventListener('mousemove', function (e) { var b = e.target.closest('[data-tip]'); if (b) showTip(e, b.getAttribute('data-tip')); else if (!e.target.closest('[data-donut],[data-cols]')) hideTip(); });
  function countUp(root) {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); var el = e.target, end = +el.dataset.count, t0 = performance.now();
      (function step(t) { var k = Math.min(1, (t - t0) / 900); el.textContent = num(Math.round(end * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); })(t0); }); }, {threshold: 0.4});
    root.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
  }
  if (EMBED) document.documentElement.classList.add('embed');
  var url = MODE === 'server' ? API + '/api/public/infographics' : ST + 'data-public.json';
  fetch(url, {cache: 'no-cache', credentials: 'same-origin'}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { DATA = d; render(); }, function () { $.innerHTML = '<div class="ig-wrap"><div class="ig-empty">Не вдалося завантажити дані. Спробуйте оновити сторінку.</div></div>'; });
})();
