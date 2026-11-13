/* Публічний сайт активів АРМА (маркетплейс): каталог за типами активів, пошук і фільтри, картка лота, пули як
   зведені лоти, вподобання, обране, кабінет відвідувача, запити на документи, зворотний зв’язок.
   Той самий файл працює на сервері (API /api/public/…) і в дзеркалі GitHub (data-public.json, дії — у браузері). */
(function () {
  'use strict';
  var MODE = window.ARMA_MODE || 'static', API = window.ARMA_API || '', CSRF = window.ARMA_CSRF || '', ST = window.ARMA_STATIC || '';
  var $ = document.getElementById('pub'), esc = function (s) { return s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); };
  var CATS = [['realestate', 'Нерухомість', '🏢'], ['land', 'Земельні ділянки', '🌾'], ['transport', 'Транспорт і техніка', '🚚'], ['property', 'Рухоме майно', '📦'], ['corporate', 'Корпоративні права', '🏭'], ['pool', 'Комплекси і пули', '🧩']];
  var CN = {}; CATS.forEach(function (c) { CN[c[0]] = c; });
  // тип угоди: АРМА не здає активи в оренду — лише передає в управління (пошук управителя як закупівля послуг на
  // Prozorro) або реалізує (Prozorro.Продажі)
  var DEALS = [['sale', 'Продаж', 'Prozorro.Продажі', 'sale'], ['management', 'Передача в управління', 'пошук управителя · Prozorro', 'mgmt'], ['in_management', 'В управлінні', 'управителя визначено', 'done']];
  var DN = {}; DEALS.forEach(function (d) { DN[d[0]] = d; });
  var DOS = (window.D && window.D.DOSSIER) || [];
  function dealOf(it) { return it.deal || (/Реаліз/.test(it.way || '') ? 'sale' : /Пошук/.test(it.way || '') ? 'management' : /договор/.test(it.way || '') ? 'in_management' : ''); }
  function dealBadge(it) { var d = DN[dealOf(it)]; return d ? '<span class="deal ' + d[3] + '">' + esc(d[1]) + '</span>' : '<span class="deal prep">Готується до передачі</span>'; }
  // доступність: розмір тексту і контраст (зберігаються в браузері)
  var A11Y = (function () { try { return JSON.parse(localStorage.getItem('arma-a11y') || '{}'); } catch (e) { return {}; } })();
  function applyA11y() { var z = (A11Y.fs || 100) / 100; document.documentElement.style.fontSize = ''; if (document.body) { document.body.style.zoom = z === 1 ? '' : String(z); } var fsl = document.querySelector('[data-a11y-fs]'); if (fsl) fsl.textContent = (A11Y.fs || 100) + '%'; document.documentElement.classList.toggle('hc', !!A11Y.hc); try { localStorage.setItem('arma-a11y', JSON.stringify(A11Y)); } catch (e) {} }
  applyA11y();
  var REGIONS = (window.D && window.D.REGIONS) || [];
  var DATA = null, ME = {user: null, likes: [], favorites: [], requests: []}, MEDIA = {thumbs: null, views: null};
  var PER = 24, LAST = null;
  function num(v, d) { if (v === null || v === undefined || v === '') return '—'; v = Number(v); if (isNaN(v)) return esc(v); var s = v.toFixed(d || 0).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return s.join(','); }
  function money(v) { if (!v) return null; v = Number(v); if (v >= 1e9) return num(v / 1e9, 2) + ' млрд ₴'; if (v >= 1e6) return num(v / 1e6, 2) + ' млн ₴'; return num(v) + ' ₴'; }
  function dt(v) { var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function toast(m) { var b = document.querySelector('.p-toast'); if (!b) { b = document.createElement('div'); b.className = 'p-toast'; document.body.appendChild(b); } var d = document.createElement('div'); d.textContent = m; b.appendChild(d); setTimeout(function () { d.remove(); }, 4500); }
  function params() { var q = location.hash.split('?')[1] || '', o = {}; q.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); o[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); }); return o; }
  function link(path, o) { var p = []; for (var k in o) if (o[k] !== undefined && o[k] !== null && o[k] !== '') p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); return '#' + path + (p.length ? '?' + p.join('&') : ''); }
  function setting(k, d) { return (DATA && DATA.settings && DATA.settings[k]) || d; }

  // ---------------------------------------------------------------- джерело даних (сервер / дзеркало)
  var LS = {get: function () { try { return JSON.parse(localStorage.getItem('arma-pub') || '{}'); } catch (e) { return {}; } }, set: function (o) { try { localStorage.setItem('arma-pub', JSON.stringify(o)); } catch (e) { /* приватний режим */ } }};
  var src = MODE === 'server' ? {
    catalog: function () { return fetch(API + '/api/public/catalog', {credentials: 'same-origin'}).then(function (r) { return r.json(); }); },
    me: function () { return fetch(API + '/api/public/me', {credentials: 'same-origin'}).then(function (r) { return r.json(); }); },
    post: function (p, b) { return fetch(API + '/api/public/' + p, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-CSRF': CSRF}, body: JSON.stringify(b || {})}).then(function (r) { return r.json().catch(function () { return {ok: false, error: 'Помилка ' + r.status}; }); }); },
    photo: function (id, v) { return API + '/api/public/photo/' + id + '/' + v; },
    doc: function () { return null; }
  } : {
    catalog: function () { return fetch(ST + 'data-public.json', {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error('data-public.json'); return r.json(); }); },
    me: function () { var s = LS.get(); return Promise.resolve({user: s.user || null, likes: s.likes || [], favorites: s.user ? s.favorites || [] : [], requests: s.user ? s.requests || [] : []}); },
    post: function (p, b) {
      var s = LS.get(), k = function (x) { return x.item_type === b.type && x.item_id === b.id; };
      s.likes = s.likes || []; s.favorites = s.favorites || []; s.requests = s.requests || []; var res = {ok: true};
      if (p === 'like') { var had = s.likes.some(k); s.likes = had ? s.likes.filter(function (x) { return !k(x); }) : s.likes.concat([{item_type: b.type, item_id: b.id}]); res.liked = !had; var it = find(b.type, b.id); if (it) { it.likes = Math.max(0, (it.likes || 0) + (had ? -1 : 1)); res.likes = it.likes; } }
      else if (p === 'fav') { if (!s.user) return Promise.resolve({ok: false, error: 'Увійдіть до кабінету, щоб додавати лоти в обране'}); var hf = s.favorites.some(k); s.favorites = hf ? s.favorites.filter(function (x) { return !k(x); }) : s.favorites.concat([{item_type: b.type, item_id: b.id}]); res.fav = !hf; }
      else if (p === 'register' || p === 'login') { if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(b.email || '')) return Promise.resolve({ok: false, error: 'Вкажіть коректний e-mail'}); if (p === 'register' && !b.consent) return Promise.resolve({ok: false, error: 'Потрібна згода на обробку персональних даних'}); s.user = {email: b.email, name: b.name || (s.user || {}).name || '', org: b.org || '', phone: b.phone || ''}; }
      else if (p === 'logout') s.user = null;
      else if (p === 'request') { if (!s.user) return Promise.resolve({ok: false, error: 'Увійдіть до кабінету, щоб запросити документи'}); s.requests.unshift({id: Date.now(), item_type: b.type, item_id: b.id, message: b.message, status: 'new', created_at: new Date().toISOString().slice(0, 16).replace('T', ' ')}); }
      else if (p === 'feedback') { if (!b.consent) return Promise.resolve({ok: false, error: 'Потрібна згода на обробку персональних даних'}); res.mirror = true; }
      LS.set(s); return Promise.resolve(res);
    },
    photo: function (id, v) { var m = v === 'thumb' ? MEDIA.thumbs : MEDIA.views; return (m && m[id]) || (MEDIA.thumbs && MEDIA.thumbs[id]) || ''; },
    doc: function () { return null; }
  };
  function loadMedia() { if (MODE === 'server' || MEDIA.thumbs) return Promise.resolve(); var g = function (f) { return fetch(ST + f).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); };
    return Promise.all([g('data-thumbs.json'), g('data-views.json')]).then(function (r) { MEDIA.thumbs = r[0]; MEDIA.views = r[1]; }); }
  function find(t, id) { return (DATA.items || []).filter(function (x) { return x.type === t && x.id === id; })[0]; }
  function has(list, it) { return (list || []).some(function (x) { return x.item_type === it.type && x.item_id === it.id; }); }
  function refreshMe() { return src.me().then(function (m) { ME = m; }); }

  // ---------------------------------------------------------------- каркас
  function shell(content, cat) {
    var f = params(), u = ME.user, favN = (ME.favorites || []).length;
    return (MODE === 'static' ? '<div class="mirror-note">Дзеркало публічного сайту для перевірки. Дані знеособлено; реєстрація, обране і запити зберігаються лише у вашому браузері.' + (DATA && DATA.demo ? ' Лоти — демонстраційна вибірка з активів, публічних за критерієм (на робочому сайті показуються лише опубліковані адміністратором).' : '') + '</div>' : '') +
      '<header class="top"><div class="wrap"><button class="burger" data-drawer aria-label="Меню"><span></span><span></span><span></span></button><a class="logo" href="#/"><img src="' + ST + 'logo.png" alt="АРМА"><span>Активи АРМА<small>Національне агентство з питань виявлення, розшуку та управління активами</small></span></a>' +
      '<form class="top-search" data-f="search"><input name="q" value="' + esc(f.q || '') + '" placeholder="Пошук: офіс Київ, майновий комплекс, земля…" aria-label="Пошук"><button>Знайти</button></form><div class="top-act">' +
      '<span class="a11y" role="group" aria-label="Доступність"><button class="pbtn sm" data-a11y="-" title="Менший текст">A−</button><button class="pbtn sm" data-a11y="+" title="Більший текст">A+</button><span class="mini" data-a11y-fs style="min-width:34px;text-align:center;font-size:12px;opacity:.7">' + (A11Y.fs || 100) + '%</span><button class="pbtn sm" data-a11y="hc" title="Висока контрастність" aria-label="Висока контрастність">🌓</button></span>' +
      '<a class="pbtn sm" href="#/cabinet?tab=fav" title="Обране">♥ <span class="cnt"' + (favN ? '' : ' style="display:none"') + '>' + favN + '</span></a>' +
      (u ? '<a class="pbtn sm" href="#/cabinet">👤 ' + esc((u.name || u.email).split(' ')[0]) + '</a>' : '<a class="pbtn sm main" href="#/login">Увійти</a>') + '<button class="pbtn sm m-search" data-msearch aria-label="Пошук">🔍</button></div></div>' +
      // v2.7: мобільний пошук (розгортається під шапкою) і бокове меню-«гамбургер»
      '<form class="m-search-bar" data-f="search"><input name="q" value="' + esc(f.q || '') + '" placeholder="Що шукаєте? офіс Київ, земля, комплекс…" aria-label="Пошук"><select name="cat" aria-label="Тип активу"><option value="">Усі типи</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('') + '</select><button class="pbtn gold">Знайти</button></form></header>' +
      '<div class="drawer" data-drawer-box aria-hidden="true"><div class="drawer-in"><div class="drawer-h"><b>Меню</b><button class="pbtn sm" data-drawer aria-label="Закрити">✕</button></div>' +
      '<form class="drawer-search" data-f="search"><input name="q" placeholder="Пошук лотів…" aria-label="Пошук"><button class="pbtn gold">🔍</button></form>' +
      '<a href="#/">🏠 Головна</a>' + CATS.map(function (c) { return '<a href="' + link('/search', {cat: c[0]}) + '">' + c[2] + ' ' + esc(c[1]) + '</a>'; }).join('') +
      '<div class="drawer-sep"></div>' + DEALS.map(function (d) { return '<a href="' + (d[0] === 'in_management' ? link('/structure', {deal: 'in_management'}) : link('/search', {deal: d[0]})) + '">' + esc(d[1]) + '</a>'; }).join('') +
      (dashOn() ? '<a href="#/structure">📊 Структура активів</a>' : '') + '<div class="drawer-sep"></div><a href="#/cabinet?tab=fav">♥ Обране' + (favN ? ' (' + favN + ')' : '') + '</a>' + (u ? '<a href="#/cabinet">👤 Кабінет</a>' : '<a href="#/login">Увійти / зареєструватися</a>') + '<a href="#/feedback">✉ Зворотний зв’язок</a>' +
      '<div class="drawer-a11y"><button class="pbtn sm" data-a11y="-">A−</button><button class="pbtn sm" data-a11y="+">A+</button><button class="pbtn sm" data-a11y="hc">🌓 Контраст</button></div></div></div>' +
      '<nav class="cats"><div class="wrap"><a href="#/" class="' + (!cat && /^#?\/?$/.test(location.hash.split('?')[0].replace('#', '')) ? 'on' : '') + '">Головна</a>' + CATS.map(function (c) { return '<a href="' + link('/search', {cat: c[0]}) + '" class="' + (cat === c[0] ? 'on' : '') + '">' + c[2] + ' ' + esc(c[1]) + '</a>'; }).join('') +
      '<a href="#/feedback">Зворотний зв’язок</a></div></nav><main>' + content + '</main>' +
      '<footer><div class="wrap"><div><b>Національне агентство з питань виявлення, розшуку та управління активами, одержаними від корупційних та інших злочинів (АРМА)</b><br>Каталог активів, переданих в управління АРМА' + (DATA && DATA.built ? ' · дані на ' + esc(DATA.built) : '') + '</div>' +
      '<div><a href="' + esc(setting('public_contacts_url', 'https://arma.gov.ua/contacts')) + '" target="_blank" rel="noopener">Контакти АРМА</a><br><a href="' + esc(setting('public_privacy_url', 'https://arma.gov.ua/page/obrobka-personalnih-danih-subektiv-dani-yakih-obroblyayutsya-v-arma')) + '" target="_blank" rel="noopener">Обробка персональних даних</a><br><a href="#/feedback">Форма зворотного зв’язку</a></div></div></footer>';
  }
  function render(h, cat) { $.innerHTML = shell(h, cat); window.scrollTo(0, 0); bind(); }
  function catOf(it) { return it.type === 'pool' ? 'pool' : it.category; }
  function photo(it, v) { var id = (it.photos || [])[0]; return id ? src.photo(id, v || 'thumb') : ''; }
  function card(it) {
    var c = CN[catOf(it)] || ['', '', '🏷'], ph = photo(it), pr = money(it.price), liked = has(ME.likes, it), fav = has(ME.favorites, it);
    var area = it.area_sqm ? num(it.area_sqm, 1) + ' м²' : it.area_ha ? num(it.area_ha, 4) + ' га' : '';
    return '<a class="card" href="#/lot/' + it.type + '/' + it.id + '"><div class="ph">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy">' : '<span class="ico">' + c[2] + '</span>') + dealBadge(it) +
      '<button class="heart ' + (fav ? 'on' : '') + '" data-fav="' + it.type + ':' + it.id + '" title="В обране" aria-label="В обране">' + (fav ? '♥' : '♡') + '</button>' + ((it.photos || []).length > 1 ? '<span class="nph">📷 ' + it.photos.length + '</span>' : '') + '</div>' +
      '<div class="bd"><div class="kind">' + esc(it.type === 'pool' ? 'Комплекс · ' + (it.count || '') + ' об’єктів' : c[1]) + ' · ' + (it.complexity === 'complex' ? 'складний' : 'простий') + '</div><div class="tt" title="' + esc(it.title) + '">' + esc(it.title) + '</div><div class="pl">📍 ' + esc(it.place || it.region || 'Україна') + '</div>' +
      '<div class="chips">' + (area ? '<span class="chip">' + area + '</span>' : '') + (it.controlling ? '<span class="chip">контрольна частка</span>' : '') + (it.count ? '<span class="chip">' + it.count + ' активів</span>' : '') + '</div>' +
      '<div class="pr">' + (pr ? pr + '<small>оціночна вартість' + (it.price_date ? ' на ' + dt(it.price_date) : '') + '</small>' : '<small>' + (dealOf(it) === 'sale' ? 'стартова ціна — в оголошенні на Prozorro.Продажі' : 'умови — в оголошенні') + '</small>') + '</div>' +
      '<div class="meta"><span>👁 ' + (it.views || 0) + '</span><span>' + (liked ? '❤' : '🤍') + ' ' + (it.likes || 0) + '</span>' + (it.sale_url || it.tender_url ? '<span class="pz">Prozorro ↗</span>' : '') + '</div></div></a>';
  }
  function filterItems(f) {
    var w = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean), favs = f.fav ? ME.favorites : null;
    var l = (DATA.items || []).filter(function (it) { if (dealOf(it) === 'in_management') return false;   // v2.7: активи в управлінні — лише узагальнено

      if (f.cat && catOf(it) !== f.cat) return false; if (f.region && it.region !== f.region) return false;
      if (f.deal && (f.deal === 'prep' ? dealOf(it) : dealOf(it) !== f.deal)) return false; if (f.cx && it.complexity !== f.cx) return false; if (f.ctrl && !it.controlling) return false;
      if (f.ph && !(it.photos || []).length) return false; if (f.pz && !(it.sale_url || it.tender_url)) return false;
      if (f.pmin && (it.price || 0) < +f.pmin) return false; if (f.pmax && (!it.price || it.price > +f.pmax)) return false;
      if (f.amin && (it.area_sqm || (it.area_ha || 0) * 10000 || 0) < +f.amin) return false;
      if (favs && !has(favs, it)) return false;
      if (w.length) { var s = it._s || (it._s = [it.title, it.description, it.place, it.region, it.no, it.vid, (it.props || []).map(function (p) { return p.join(' '); }).join(' '), (CN[catOf(it)] || [])[1], (DN[dealOf(it)] || [])[1]].join(' ').toLowerCase()); if (!w.every(function (x) { return s.indexOf(x) >= 0; })) return false; }
      return true;
    });
    var s = f.sort || 'new';
    l.sort(function (a, b) { return s === 'price_asc' ? (a.price || 9e15) - (b.price || 9e15) : s === 'price_desc' ? (b.price || 0) - (a.price || 0) : s === 'popular' ? (b.views + b.likes * 5) - (a.views + a.likes * 5) : s === 'region' ? (a.region || 'я').localeCompare(b.region || 'я') || (b.price || 0) - (a.price || 0) : s === 'area' ? ((b.area_sqm || (b.area_ha || 0) * 1e4) - (a.area_sqm || (a.area_ha || 0) * 1e4)) : (b.updated || '').localeCompare(a.updated || '') || b.id - a.id; });
    return l;
  }
  function home() {
    var items = DATA.items || [], cnt = {}; items.forEach(function (it) { var c = catOf(it); cnt[c] = (cnt[c] || 0) + 1; });
    items = items.filter(function (it) { return dealOf(it) !== 'in_management'; });
    var withPh = items.filter(function (it) { return (it.photos || []).length; }), fresh = items.slice().sort(function (a, b) { return (b.updated || '').localeCompare(a.updated || ''); }).slice(0, 6);
    var pop = items.slice().sort(function (a, b) { return (b.views + b.likes * 5) - (a.views + a.likes * 5); }).slice(0, 6);
    var ht = setting('public_hero_title', ''), hs = setting('public_hero_sub', '');
    if (!ht || /оренд/i.test(ht)) ht = 'Активи АРМА: передача в управління та реалізація';
    if (!hs || /оренд/i.test(hs)) hs = 'Майнові комплекси, нерухомість, земля, транспорт і корпоративні права, передані в управління АРМА. Управителів визначають через закупівлю послуг на Prozorro, реалізацію проводять на Prozorro.Продажі.';
    var nd = function (d) { return items.filter(function (it) { return dealOf(it) === d; }).length; };
    var h = '<section class="hero"><div class="hero-glow"></div><div class="wrap"><p class="hero-eyebrow">Каталог активів АРМА · ' + num(items.length) + ' лотів</p><h1>' + esc(ht).replace(/:\s*/, ':<br><em>') + (/:/.test(ht) ? '</em>' : '') + '</h1><p>' + esc(hs) + '</p>' +
      '<form class="hero-search" data-f="search"><input name="q" placeholder="Що шукаєте? Наприклад: нежитлове приміщення Київ"><select name="cat"><option value="">Усі типи активів</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('') + '</select>' +
      '<select name="region"><option value="">Уся Україна</option>' + REGIONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select><button class="pbtn gold">Знайти</button></form>' +
      '<div class="hero-kpi"><div><b>' + num(items.length) + '</b><span>лотів у каталозі</span></div><div><b>' + num(items.filter(function (i) { return i.complexity === 'complex'; }).length) + '</b><span>складних активів і комплексів</span></div><div><b>' + num(nd('management')) + '</b><span>шукають управителя</span></div><div><b>' + num(nd('sale')) + '</b><span>на продаж</span></div></div></div></section>' +
      '<div class="wrap"><section class="blk deals">' +
      '<a class="deal-tile glass mgmt" href="' + link('/search', {deal: 'management'}) + '"><b>Стати управителем</b><span>Складні активи (майнові комплекси, корпоративні права) і прості активи. Управителя визначають за результатами закупівлі послуг з управління на Prozorro.</span><i>' + num(nd('management')) + ' лотів →</i></a>' +
      '<a class="deal-tile glass sale" href="' + link('/search', {deal: 'sale'}) + '"><b>Придбати актив</b><span>Реалізація активів відбувається на електронних аукціонах Prozorro.Продажі — відкрито та конкурентно.</span><i>' + num(nd('sale')) + ' лотів →</i></a>' +
      '<a class="deal-tile glass done" href="' + link('/structure', {deal: 'in_management'}) + '"><b>Уже в управлінні</b><span>Активи, передані управителям: узагальнена статистика — скільки активів, їх структура, надходження до бюджету.</span><i>' + (DATA.info && DATA.info.mgmt ? num(DATA.info.mgmt.active) + ' діючих договорів' : 'статистика') + ' →</i></a></section></div>' +
      '<div class="wrap"><section class="blk"><h2>Типи активів</h2><div class="cat-tiles">' + CATS.map(function (c) { return '<a class="cat-tile" href="' + link('/search', {cat: c[0]}) + '"><i>' + c[2] + '</i><b>' + esc(c[1]) + '</b><span>' + num(cnt[c[0]] || 0) + ' лотів</span></a>'; }).join('') + '</div></section>';
    if (!items.length) h += '<div class="empty-p">Наразі опублікованих лотів немає. Загляньте пізніше.</div>';
    else h += '<section class="blk"><h2>Нові лоти <small><a href="' + link('/search', {sort: 'new'}) + '">усі →</a></small></h2><div class="cards">' + fresh.map(card).join('') + '</div></section>' +
      (pop.some(function (x) { return x.views || x.likes; }) ? '<section class="blk"><h2>Найпопулярніші <small><a href="' + link('/search', {sort: 'popular'}) + '">усі →</a></small></h2><div class="cards">' + pop.map(card).join('') + '</div></section>' : '');
    if (items.length && dashOn()) h += '<section class="blk"><a class="map-cta glass" href="#/structure"><span class="mc-ic">📊</span><span><b>Структура активів на сайті</b><small>розподіл лотів за типом угоди, видом активу, областю, складністю і вартістю</small></span><span class="mc-go">Переглянути →</span></a></section>';
    var ag = DATA.agg || {};
    if (ag.money || ag.crypto) {
      h += '<section class="blk"><h2>Фінансові активи в управлінні АРМА <small>узагальнені показники</small></h2><div class="agg">';
      if (ag.money) h += '<div class="box"><h3>Кошти, банківські метали, ОВДП</h3><div class="price">' + (money(ag.money.total) || '0 ₴') + '<small>гривневий еквівалент · записів ' + num(ag.money.count) + '</small></div><div class="kp">' + Object.keys(ag.money.by).map(function (k) { return '<div><b>' + (money(ag.money.by[k]) || '0 ₴') + '</b><span>' + esc(k) + '</span></div>'; }).join('') + '</div></div>';
      if (ag.crypto) h += '<div class="box"><h3>Криптоактиви</h3><div class="price">' + (money(ag.crypto.total) || num(ag.crypto.count) + ' записів') + '<small>' + (ag.crypto.total ? 'ринкова вартість' : 'вартість буде показано після внесення курсів') + ' · записів ' + num(ag.crypto.count) + '</small></div><div class="kp">' + Object.keys(ag.crypto.by).map(function (k) { return '<div><b>' + (money(ag.crypto.by[k]) || '0 ₴') + '</b><span>' + esc(k) + '</span></div>'; }).join('') + '</div></div>';
      h += '</div></section>';
    }
    render(h + '</div>');
  }
  function search(f) {
    if (f.deal === 'in_management') { location.hash = link('/structure', {deal: 'in_management'}); return; }   // v2.7: лише агрегована статистика
    var l = filterItems(f), page = Math.max(1, +f.page || 1), pages = Math.max(1, Math.ceil(l.length / PER)), rows = l.slice((page - 1) * PER, page * PER), c = CN[f.cat];
    var sel = function (n, opts, v, e, attr) { return '<select name="' + n + '" ' + (attr || '') + ' aria-label="' + esc(e) + '"><option value="">' + esc(e) + '</option>' + opts.map(function (o) { o = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(o[0]) + '"' + (String(v || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var base = function (o) { return link('/search', Object.assign({}, f, {page: ''}, o)); }, all = filterItems(Object.assign({}, f, {deal: '', cx: ''}));
    var cntD = function (d) { return all.filter(function (it) { return d === 'prep' ? !dealOf(it) : dealOf(it) === d; }).length; };
    var chip = function (k, v, label, n) { return '<a class="fchip' + ((f[k] || '') === v ? ' on' : '') + '" href="' + base(Object.assign({}, (function () { var o = {}; o[k] = v; return o; })())) + '">' + esc(label) + (n !== undefined ? ' <i>' + n + '</i>' : '') + '</a>'; };
    var more = f.region || f.pmin || f.pmax || f.amin || f.ctrl || f.ph || f.pz;
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › ' + esc(f.fav ? 'Обране' : c ? c[1] : 'Каталог') + '</div>' +
      '<div class="fbar glass"><div class="frow">' + chip('deal', '', 'Усі', all.length) + DEALS.map(function (d) { return chip('deal', d[0], d[1], cntD(d[0])); }).join('') + chip('deal', 'prep', 'Готуються', cntD('prep')) +
      '<span class="sep"></span>' + chip('cx', '', 'Будь-які') + chip('cx', 'complex', 'Складні') + chip('cx', 'simple', 'Прості') + '</div>' +
      '<form class="frow" data-f="filter">' + ['q', 'fav', 'deal', 'cx'].map(function (k) { return f[k] ? '<input type="hidden" name="' + k + '" value="' + esc(f[k]) + '">' : ''; }).join('') +
      sel('cat', CATS.map(function (x) { return [x[0], x[1]]; }), f.cat, 'Усі типи активів') + sel('region', REGIONS, f.region, 'Уся Україна') +
      sel('sort', [['new', 'Спочатку нові'], ['price_asc', 'Дешевші'], ['price_desc', 'Дорожчі'], ['area', 'Більша площа'], ['region', 'За областю'], ['popular', 'Популярні']], f.sort || 'new', 'Сортування') +
      '<details class="more"' + (more ? ' open' : '') + '><summary>Більше фільтрів</summary><div class="frow">' +
      '<label>Вартість, ₴<span class="row2"><input name="pmin" value="' + esc(f.pmin || '') + '" placeholder="від" inputmode="numeric"><input name="pmax" value="' + esc(f.pmax || '') + '" placeholder="до" inputmode="numeric"></span></label>' +
      '<label>Площа від, м²<input name="amin" value="' + esc(f.amin || '') + '" inputmode="numeric"></label>' +
      '<label class="ck"><input type="checkbox" name="ctrl" value="1"' + (f.ctrl ? ' checked' : '') + '> контрольна частка (≥ 50 %)</label><label class="ck"><input type="checkbox" name="ph" value="1"' + (f.ph ? ' checked' : '') + '> з фото</label><label class="ck"><input type="checkbox" name="pz" value="1"' + (f.pz ? ' checked' : '') + '> оголошено на Prozorro</label></div></details>' +
      '<button class="pbtn main">Показати</button><a class="pbtn" href="' + (f.fav ? '#/search?fav=1' : '#/search') + '">Скинути</a></form></div>' +
      (f.cat === 'land' ? (function () { var ng = (DATA.items || []).filter(function (it) { return (it.geo || []).length; }).length; return ng ? '<a class="map-cta glass" href="' + link('/map', {region: f.region, deal: f.deal && f.deal !== 'prep' ? f.deal : ''}) + '"><span class="mc-ic">🗺</span><span><b>Карта земельних ділянок</b><small>' + num(ng) + ' лотів на карті · контури ділянок, супутник, шар Публічної кадастрової карти · вибір області</small></span><span class="mc-go">Відкрити карту →</span></a>' : ''; })() : '') +
      '<div class="list-head"><b>' + (f.q ? 'За запитом «' + esc(f.q) + '»: ' : '') + num(l.length) + ' лотів</b>' + (f.deal && DN[f.deal] ? '<span class="hint">' + esc(DN[f.deal][2]) + '</span>' : '') + '</div>' +
      (rows.length ? '<div class="cards">' + rows.map(card).join('') + '</div>' : '<div class="empty-p">' + (f.fav ? 'В обраному поки немає лотів. Натискайте ♡ на картках.' : 'За умовами пошуку лотів не знайдено. Спробуйте змінити фільтри.') + '</div>');
    if (pages > 1) { h += '<div class="pager-p">'; for (var i = Math.max(1, page - 4); i <= Math.min(pages, page + 4); i++) h += i === page ? '<span>' + i + '</span>' : '<a href="' + link('/search', Object.assign({}, f, {page: i})) + '">' + i + '</a>'; h += '</div>'; }
    render(h + '</div>', f.cat);
  }
  function lot(t, id) {
    var it = find(t, +id); if (!it) return render('<div class="wrap"><div class="empty-p" style="margin-top:30px">Лот не знайдено або знято з публікації. <a href="#/">На головну</a></div></div>');
    src.post('view', {type: it.type, id: it.id}); LAST = location.hash;
    var c = CN[catOf(it)] || ['', '', '🏷'], phs = it.photos || [], liked = has(ME.likes, it), fav = has(ME.favorites, it), ct = it.contacts || {}, reqs = (ME.requests || []).filter(function (r) { return r.item_type === it.type && r.item_id === it.id; });
    var today = new Date().toISOString().slice(0, 10), okReq = reqs.filter(function (r) { return r.status === 'approved'; });
    var approved = okReq.some(function (r) { return !r.access_until || r.access_until.slice(0, 10) >= today; }), expired = !approved && okReq.length > 0;
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › <a href="' + link('/search', {cat: catOf(it)}) + '">' + esc(c[1]) + '</a> › ' + esc(it.no) + '</div><div class="lot"><div>' +
      '<div class="gal"><div class="main">' + (phs.length ? '<img id="gmain" src="' + esc(src.photo(phs[0], 'view')) + '" alt="">' : c[2]) + '</div>' + (phs.length > 1 ? '<div class="th">' + phs.map(function (p, i) { return '<img src="' + esc(src.photo(p, 'thumb')) + '" data-big="' + esc(src.photo(p, 'view')) + '" class="' + (i ? '' : 'on') + '" alt="">'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="box" style="margin-top:14px"><h3>Характеристики</h3><div class="props"><div>Тип</div><div>' + esc(it.type === 'pool' ? 'Комплекс активів (передається одним лотом)' : c[1]) + '</div>' + (it.vid ? '<div>Вид</div><div>' + esc(it.vid) + '</div>' : '') + '<div>Розташування</div><div>' + esc(it.place || it.region || '—') + '</div>' +
      (it.props || []).map(function (p) { return '<div>' + esc(p[0]) + '</div><div>' + esc(typeof p[1] === 'number' ? num(p[1], p[1] % 1 ? 2 : 0) : p[1]) + '</div>'; }).join('') + '<div>Тип угоди</div><div>' + esc((DN[dealOf(it)] || [0, 'готується до передачі'])[1]) + '</div>' + '<div>Номер лота в каталозі</div><div>' + esc(it.no) + '</div></div></div>' +
      (it.description ? '<div class="box"><h3>Опис</h3><div style="white-space:pre-wrap">' + esc(it.description) + '</div></div>' : '') +
      videoBox(it) + geoBox(it) + dossier(it) + ((it.docs || []).length ? '<div class="box"><h3>Документи лота</h3><p style="color:var(--muted);font-size:14px;margin-top:0">Документи надаються після погодження запиту; перегляд — лише в захищеному переглядачі сайту, з водяними знаками, протягом строку ознайомлення.</p>' + it.docs.map(function (d) {
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line)"><span>📄 ' + esc(d.name) + '</span>' + (approved ? (MODE === 'server' ? '<button class="pbtn sm main" data-view="' + d.id + '">Переглянути</button>' : '<span style="color:var(--muted)">перегляд — на робочому сайті</span>') : expired ? '<span style="color:var(--muted)">строк ознайомлення завершився</span>' : '<span style="color:var(--muted)">за запитом</span>') + '</div>'; }).join('') + '</div>' : '') +
      '</div><aside><div class="box"><h1>' + esc(it.title) + '</h1><div style="color:var(--muted);margin-bottom:12px">📍 ' + esc(it.place || it.region || 'Україна') + '</div><div class="price">' + (money(it.price) || 'Ціна — на аукціоні') + '<small>' + (it.price ? 'оціночна вартість' + (it.price_date ? ' станом на ' + dt(it.price_date) : '') : 'стартова ціна визначається в оголошенні') + '</small></div>' +
      '<div class="deal-line">' + dealBadge(it) + ' <span>' + (it.complexity === 'complex' ? 'Складний актив' : 'Простий актив') + '</span></div>' + cta(it) +
      '<div style="display:flex;gap:8px;margin-top:10px"><button class="pbtn" data-like="' + it.type + ':' + it.id + '" style="flex:1;justify-content:center">' + (liked ? '❤' : '🤍') + ' <span>' + (it.likes || 0) + '</span></button><button class="pbtn" data-fav="' + it.type + ':' + it.id + '" style="flex:1;justify-content:center">' + (fav ? '♥ В обраному' : '♡ В обране') + '</button><button class="pbtn" data-share title="Скопіювати посилання">🔗</button></div>' +
      '<div style="color:var(--muted);font-size:13px;margin-top:10px">👁 ' + (it.views || 0) + ' переглядів' + (it.updated ? ' · оновлено ' + dt(it.updated) : '') + '</div></div>' +
      '<div class="box"><h3>Контакти щодо лота</h3><div><b>' + esc(ct.dept || 'АРМА') + '</b></div>' + (ct.phone ? '<div>☎ <a href="tel:' + esc(ct.phone.replace(/[^\d+]/g, '')) + '">' + esc(ct.phone) + '</a></div>' : '') + (ct.email ? '<div>✉ <a href="mailto:' + esc(ct.email) + '?subject=' + encodeURIComponent('Лот ' + it.no) + '">' + esc(ct.email) + '</a></div>' : '') +
      '<p style="margin-bottom:0"><a class="pbtn sm" href="' + link('/feedback', {item: it.no, t: it.type, id: it.id}) + '">Поставити запитання</a></p></div>' +
      '<div class="box"><h3>Документи і огляд</h3>' + (reqs.length ? reqs.map(function (r) { return '<div>Запит від ' + esc(r.created_at || '') + ': <span class="req-st ' + esc(r.status) + '">' + esc({new: 'на розгляді', approved: 'погоджено', rejected: 'відхилено'}[r.status] || r.status) + '</span>' + (r.admin_note ? '<div style="font-size:13px;color:var(--muted)">' + esc(r.admin_note) + '</div>' : '') + '</div>'; }).join('') : '<p style="color:var(--muted);font-size:14px;margin-top:0">Запросіть документи лота (акт огляду, техпаспорт, витяги, звіт про оцінку). Потрібен вхід до кабінету.</p>') +
      (reqs.some(function (r) { return r.status === 'new'; }) ? '' : '<button class="pbtn main" data-req="' + it.type + ':' + it.id + '" style="margin-top:8px">Запросити документи</button>') + '</div></aside></div>';
    var sim = (DATA.items || []).filter(function (x) { return x !== it && catOf(x) === catOf(it); }).sort(function (a, b) { return (a.region === it.region ? 0 : 1) - (b.region === it.region ? 0 : 1); }).slice(0, 3);
    if (sim.length) h += '<section class="blk"><h2>Схожі лоти</h2><div class="cards">' + sim.map(card).join('') + '</div></section>';
    render(h + '</div>', catOf(it));
    var g = document.getElementById('gmain'); document.querySelectorAll('.gal .th img').forEach(function (im) { im.addEventListener('click', function () { g.src = im.dataset.big; document.querySelectorAll('.gal .th img').forEach(function (x) { x.classList.toggle('on', x === im); }); }); });
  }
  // дія за типом угоди: продаж — Prozorro.Продажі; передача в управління — закупівля послуг з управління на Prozorro
  function cta(it) {
    var d = dealOf(it), b = function (u, t) { return '<p><a class="pbtn gold wide" href="' + esc(u) + '" target="_blank" rel="noopener">' + t + '</a></p>'; };
    if (d === 'sale') return it.sale_url ? b(it.sale_url, 'Аукціон на Prozorro.Продажі →') : '<p class="note">Аукціон готується. Додайте лот в обране — ми повідомимо в кабінеті. Оголошення з’явиться на <a href="https://prozorro.sale/" target="_blank" rel="noopener">Prozorro.Продажі</a>.</p>';
    if (d === 'management') return it.tender_url ? b(it.tender_url, 'Закупівля послуг з управління на Prozorro →') : '<p class="note">Закупівля послуг з управління (' + (it.complexity === 'complex' ? 'складний' : 'простий') + ' актив) готується. Оголошення буде на <a href="https://prozorro.gov.ua/" target="_blank" rel="noopener">Prozorro</a>; поставте запитання або запросіть документи.</p>';
    if (d === 'in_management') return '<p class="note">Актив передано управителю. Лот показано для інформації.</p>';
    return '<p class="note">Спосіб передачі визначається. Підпишіться на лот (♡), щоб дізнатися про оголошення.</p>';
  }
  function dval(v) { if (Array.isArray(v)) return v.map(esc).join(', '); if (v === 'yes') return 'так'; if (v === 'no') return 'ні'; if (v === 'unknown') return 'невідомо'; if (typeof v === 'number') return num(v, v % 1 ? 2 : 0); return esc(v); }
  // досьє лота: 8 розділів — автоматичні відомості з Реєстру + стандартизовані поля, заповнені менеджером ДМА
  function dossier(it) {
    var au = it.auto || {}, man = it.dossier || {}, out = '', secN = 0;
    DOS.forEach(function (sec, i) {
      var rows = '', a = au[sec[0]] || [];
      if (sec[0] === 'scope') {
        if (a.length) rows += '<div class="objs">' + a.slice(0, 40).map(function (o) { return '<div class="obj"><b>' + esc(o.name) + '</b><span>' + [o.category, o.place, o.area, o.cadastral ? 'кадастровий № ' + o.cadastral : '', o.company ? o.company + (o.edrpou ? ' (ЄДРПОУ ' + o.edrpou + ')' : '') : '', o.share !== undefined && o.share !== null ? 'частка ' + num(o.share, o.share % 1 ? 2 : 0) + ' %' : ''].filter(Boolean).map(esc).join(' · ') + '</span></div>'; }).join('') + (a.length > 40 ? '<div class="mini">… та ще ' + (a.length - 40) + '</div>' : '') + '</div>';
      } else a.forEach(function (x) { rows += '<div>' + esc(x[0]) + '</div><div>' + dval(x[1]) + '</div>'; });
      var mrows = '';
      sec[2].forEach(function (fd) { var v = man[sec[0] + '.' + fd[0]]; if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return; mrows += '<div>' + esc(fd[1]) + '</div><div' + (fd[2] === 'text' ? ' class="pre"' : '') + '>' + dval(v) + '</div>'; });
      if (!rows && !mrows) return;
      secN++;
      out += '<details class="dos"' + (secN < 3 ? ' open' : '') + '><summary><span class="n">' + secN + '</span>' + esc(sec[1]) + '</summary>' + (sec[0] === 'scope' ? rows + (mrows ? '<div class="props">' + mrows + '</div>' : '') : '<div class="props">' + rows + mrows + '</div>') + '</details>';
    });
    return out ? '<div class="box"><h3>Досьє активу</h3>' + out + '</div>' : '';
  }
  function videoBox(it) {
    var v = it.videos || []; if (!v.length) return '';
    return '<div class="box"><h3>Відео</h3>' + v.map(function (id) { return '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '" title="Відео лота" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'; }).join('') + '</div>';
  }
  function geoBox(it) { return (it.geo || []).length ? '<div class="box"><h3>Розташування на карті</h3><div data-pmap="lot"></div></div>' : ''; }
  function geoData(items) {
    var pts = [], polys = [], COL = {sale: '#D68A00', management: '#1F4FD8', in_management: '#14A463'};
    items.forEach(function (it) { (it.geo || []).forEach(function (g) { var col = COL[dealOf(it)] || '#5B6B88', lab = it.title.slice(0, 80) + (g.cadastral ? ' · ' + g.cadastral : '') + (g.area_ha ? ' · ' + num(g.area_ha, 4) + ' га' : '');
      if (g.geometry) (g.geometry.type === 'MultiPolygon' ? g.geometry.coordinates : [g.geometry.coordinates]).forEach(function (pl) { polys.push({rings: pl, color: col, id: it.type + ':' + it.id, label: lab}); });
      if (g.lat && g.lon) pts.push({lat: g.lat, lon: g.lon, color: col, id: it.type + ':' + it.id, label: lab, hasPoly: !!g.geometry}); }); });
    return [pts, polys];
  }
  function mountMap(el, items, fit) {
    if (!el || !window.ArmaMap) return null;
    var m = new window.ArmaMap(el, {base: 'sat', carto: {key: setting('public_map_carto_key', ''), style: setting('public_map_carto_style', '')}, cadastre: setting('public_map_cadastre', '') || null, onClick: function (p) { var r = String(p.id).split(':'); location.hash = '#/lot/' + r[0] + '/' + r[1]; }});
    var d = geoData(items); if (items.length === 1) d[1].forEach(function (pg) { pg.fill = '33'; pg.width = 3; }); m.setData(d[0], d[1]); if (fit !== false) m.fitPoints(items.length === 1);
    return m;
  }
  // карта земельних ділянок: Україна або область; зміна області оновлює лише карту і перелік
  function landMap(f) {
    var lands = (DATA.items || []).filter(function (it) { return (it.geo || []).length; });
    var regs = {}; lands.forEach(function (it) { if (it.region) regs[it.region] = (regs[it.region] || 0) + 1; });
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › <a href="#/search?cat=land">Земельні ділянки</a> › Карта</div><div class="fbar glass"><div class="frow"><b>Карта земель</b>' +
      '<select data-lmreg aria-label="Область"><option value="">Уся Україна (' + lands.length + ')</option>' + Object.keys(regs).sort().map(function (r) { return '<option' + (f.region === r ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>' +
      '<select data-lmdeal aria-label="Тип угоди"><option value="">Будь-яка угода</option>' + DEALS.map(function (d) { return '<option value="' + d[0] + '"' + (f.deal === d[0] ? ' selected' : '') + '>' + esc(d[1]) + '</option>'; }).join('') + '</select>' +
      '<span class="hint">клік на ділянці — картка лота; «Кадастр» — шар Публічної кадастрової карти</span></div></div><div class="box"><div data-pmap="land"></div><div class="map-legend-p">' + DEALS.map(function (d) { return '<span><i class="lg ' + d[3] + '"></i>' + esc(d[1]) + '</span>'; }).join('') + '</div></div><div data-lmlist></div></div>';
    render(h, 'land');
    var el = document.querySelector('[data-pmap="land"]'), m = mountMap(el, [], false);
    function upd(fit) { var rg = document.querySelector('[data-lmreg]').value, dl = document.querySelector('[data-lmdeal]').value;
      var l = lands.filter(function (it) { return (!rg || it.region === rg) && (!dl || dealOf(it) === dl); }), d = geoData(l); if (m) { m.setData(d[0], d[1]); if (fit) { if (rg || dl) m.fitPoints(); else m.fit(44.3, 22, 52.4, 40.3); } }
      document.querySelector('[data-lmlist]').innerHTML = '<div class="list-head"><b>' + num(l.length) + ' лотів із земельними ділянками' + (rg ? ' · ' + esc(rg) : '') + '</b></div>' + (l.length ? '<div class="cards">' + l.slice(0, 48).map(card).join('') + '</div>' : '<div class="empty-p">Немає лотів за умовами.</div>');
      try { history.replaceState(null, '', link('/map', {region: rg, deal: dl})); } catch (e) { /* ок */ } bindCards(); }
    document.querySelectorAll('[data-lmreg],[data-lmdeal]').forEach(function (x) { x.addEventListener('change', function () { upd(true); }); });
    upd(true);
  }
  // сторінка-дашборд «Структура активів на сайті» (одна; вмикається / вимикається в налаштуваннях сайту, як фінансові показники)
  function dashOn() { return setting('public_show_dashboard', '1') !== '0'; }
  function bars(rows, total, linkFn) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    return '<div class="pbars">' + rows.map(function (r) { return '<a class="pbar" href="' + (linkFn ? linkFn(r[2] || r[0]) : '#/structure') + '"><span>' + esc(r[0]) + '</span><i style="width:' + (r[1] * 100 / max).toFixed(1) + '%"></i><b>' + num(r[1]) + (total ? ' · ' + Math.round(r[1] * 100 / total) + '%' : '') + '</b></a>'; }).join('') + '</div>';
  }
  function group(items, fn, names) { var c = {}; items.forEach(function (it) { var k = fn(it) || '—'; c[k] = (c[k] || 0) + 1; }); return Object.keys(c).map(function (k) { return [names && names[k] ? names[k] : k, c[k], k]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  // v2.6: узагальнена статистика активів, що вже перебувають в управлінні (з показників інфографіки, без переліків і сторін договорів)
  function mbars(v) { var MN = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'], mx = Math.max.apply(null, v.concat([1]));
    return '<div class="pbars">' + v.map(function (x, i) { return x ? '<div class="pbar"><span>' + MN[i] + '</span><i style="width:' + (x * 100 / mx).toFixed(1) + '%"></i><b>' + (money(x) || '0 ₴') + '</b></div>' : ''; }).join('') + '</div>'; }
  function mgmtBlock() {
    var I = DATA.info; if (!I || !I.mgmt) return '';
    var M = I.mgmt, y = I.year, k = Object.keys(M.kinds || {}).map(function (x) { return [x, M.kinds[x]]; }).sort(function (a, b) { return b[1] - a[1]; }), tot = k.reduce(function (s, x) { return s + x[1]; }, 0);
    var yr = (M.by_month || {})[y] || [], got = yr.reduce(function (s, v) { return s + (v || 0); }, 0);
    return '<section class="blk">' + (location.hash.indexOf('in_management') < 0 ? '<h2>Активи в управлінні АРМА</h2>' : '') + '<p class="pintro">Активи, які вже передані управителям за договорами. Узагальнені показники — без переліку активів і сторін договорів.</p>' +
      '<div class="dash-kpi">' + [['Діючих договорів управління', num(M.active)]].concat(M.assets ? [['Активів Реєстру в договорах', num(M.assets)]] : []).concat([['Гарантійні платежі на місяць', money(M.guarantee) || '—'], ['Надійшло до бюджету за ' + y, money(got) || '—'], ['Перераховано з початку дії договорів', money(M.transferred_total) || '—']]).map(function (x) { return '<div class="glass"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="dash-grid">' + (k.length ? '<div class="box"><h3>Структура активів в управлінні <small>за видом активу, договорів</small></h3>' + bars(k, tot) + '</div>' : '') +
      (yr.length ? '<div class="box"><h3>Надходження до бюджету за ' + y + ' <small>за даними казначейства, за місяцями</small></h3>' + mbars(yr) + '</div>' : '') + '</div>' +
      '<p class="pintro" style="font-size:13px">Показано лише узагальнені показники. Відомості про конкретні активи і договори управління на сайті не публікуються.</p></section>';
  }
  function dashPage(f) {
    if (!dashOn()) return home();
    var all = DATA.items || [], items = all.filter(function (it) { return (!f.deal || (f.deal === 'prep' ? !dealOf(it) : dealOf(it) === f.deal)) && true; });
    var val = items.reduce(function (s, it) { return s + (it.price || 0); }, 0), area = items.reduce(function (s, it) { return s + (it.area_sqm || 0); }, 0), ha = items.reduce(function (s, it) { return s + (it.area_ha || 0); }, 0);
    var cn = {}, dn = {prep: 'Готуються'}; CATS.forEach(function (c) { cn[c[0]] = c[1]; }); DEALS.forEach(function (d) { dn[d[0]] = d[1]; });
    var L = function (k) { return function (x) { var o = {}; o[k] = x === '—' || x === 'не вказано' ? '' : x; if (f.deal && k !== 'deal' && f.deal !== 'prep') o.deal = f.deal; return link('/search', o); }; };
    var chip = function (k, v, label) { var o = Object.assign({}, f); o[k] = v; return '<a class="fchip' + ((f[k] || '') === v ? ' on' : '') + '" href="' + link('/structure', o) + '">' + esc(label) + '</a>'; };
    // v2.7: «В управлінні» — лише агрегована статистика (без переліку конкретних активів і договорів)
    if (f.deal === 'in_management') return render('<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › <a href="#/structure">Структура активів</a> › В управлінні</div><section class="blk"><h1 class="ptitle">Активи в управлінні АРМА</h1>' +
      '<div class="fbar glass"><div class="frow">' + chip('deal', '', 'Усі угоди') + DEALS.map(function (d) { return chip('deal', d[0], d[1]); }).join('') + chip('deal', 'prep', 'Готуються') + '</div></div></section>' + (mgmtBlock() || '<div class="empty-p">Узагальнена статистика з’явиться після синхронізації з робочою системою.</div>') + '</div>');
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › Структура активів</div><section class="blk"><h1 class="ptitle">Структура активів на сайті</h1><p class="pintro">Усі опубліковані лоти АРМА: тип угоди, вид активу, області, складність і вартість. Клік на рядку — перелік відповідних лотів.</p>' +
      '<div class="fbar glass"><div class="frow">' + chip('deal', '', 'Усі угоди') + DEALS.map(function (d) { return chip('deal', d[0], d[1]); }).join('') + chip('deal', 'prep', 'Готуються') + '</div></div>' +
      '<div class="dash-kpi">' + [['Лотів', num(items.length)], ['Оціночна вартість', money(val) || '—'], ['Площа будівель', area ? num(area) + ' м²' : '—'], ['Земельні ділянки', ha ? num(ha, 1) + ' га' : '—'], ['Складних активів', num(items.filter(function (i) { return i.complexity === 'complex'; }).length)], ['Простих активів', num(items.filter(function (i) { return i.complexity !== 'complex'; }).length)]].map(function (k) { return '<div class="glass"><b>' + k[1] + '</b><span>' + k[0] + '</span></div>'; }).join('') + '</div>' +
      (items.length ? '<div class="dash-grid"><div class="box"><h3>Тип угоди</h3>' + bars(group(items, function (i) { return dealOf(i) || 'prep'; }, dn), items.length, L('deal')) + '</div>' +
      '<div class="box"><h3>Вид активу</h3>' + bars(group(items, catOf, cn), items.length, L('cat')) + '</div>' +
      '<div class="box"><h3>Області <small>топ-12</small></h3>' + bars(group(items, function (i) { return i.region || 'не вказано'; }).slice(0, 12), items.length, L('region')) + '</div>' +
      '<div class="box"><h3>Складність</h3>' + bars(group(items, function (i) { return i.complexity; }, {complex: 'Складні', simple: 'Прості'}), items.length, L('cx')) + '</div>' +
      '<div class="box"><h3>Вартість лотів</h3>' + bars(group(items, function (i) { var p = i.price || 0; return !p ? 'ще не визначено' : p < 1e6 ? 'до 1 млн ₴' : p < 1e7 ? '1–10 млн ₴' : p < 1e8 ? '10–100 млн ₴' : 'понад 100 млн ₴'; }), items.length) + '</div></div>' +
      '<p><a class="pbtn main" href="' + link('/search', {deal: f.deal && f.deal !== 'prep' ? f.deal : ''}) + '">Перейти до каталогу лотів →</a></p>' : '<div class="empty-p">Немає лотів за умовами.</div>') + '</section></div>';
    render(h);
  }
  // захищений перегляд документа: сторінки-зображення з водяними знаками, без завантаження, копіювання і друку
  function viewer(lid) {
    fetch(API + '/api/public/docview/' + lid, {credentials: 'same-origin'}).then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); }).then(function (x) {
      if (x[0] !== 200 || !x[1].ok) return toast(x[0] === 410 ? 'Строк ознайомлення завершився. Подайте новий запит.' : (x[1].error || 'Документ недоступний'));
      var j = x[1], bg = document.createElement('div'); bg.className = 'pviewer'; bg.setAttribute('oncontextmenu', 'return false');
      var imgs = ''; for (var i = 1; i <= j.pages; i++) imgs += '<img src="' + API + '/api/public/docview/' + lid + '/' + i + '.png" alt="Сторінка ' + i + '" draggable="false" loading="lazy">';
      bg.innerHTML = '<div class="pv-bar"><b>' + esc(j.name || 'Документ') + '</b><span>лише перегляд' + (j.until ? ' · доступ до ' + dt(j.until) : '') + ' · ' + j.pages + ' стор.</span><button class="pbtn sm" data-close>Закрити</button></div><div class="pv-pages">' + imgs + '</div>';
      document.body.appendChild(bg); document.body.classList.add('pv-open');
      bg.querySelector('[data-close]').addEventListener('click', close);
      function close() { bg.remove(); document.body.classList.remove('pv-open'); document.removeEventListener('keydown', key, true); }
      function key(e) { if ((e.ctrlKey || e.metaKey) && /^[psc]$/i.test(e.key)) { e.preventDefault(); toast('Друк, збереження і копіювання недоступні'); } if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', key, true);
    });
  }
  function bindCards() { document.querySelectorAll('[data-fav]').forEach(function (b) { if (b.dataset.bound) return; b.dataset.bound = 1; b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var r = ref(b.dataset.fav); src.post('fav', r).then(function (x) { if (!x.ok) { toast(x.error || 'Помилка'); if (!ME.user) location.hash = '#/login'; return; } toast(x.fav ? 'Додано в обране' : 'Видалено з обраного'); refreshMe().then(route); }); }); }); }
  function authPage(kind) {
    var reg = kind === 'register', priv = setting('public_privacy_url', 'https://arma.gov.ua/page/obrobka-personalnih-danih-subektiv-dani-yakih-obroblyayutsya-v-arma');
    render('<div class="wrap"><form class="form-p" data-f="' + kind + '"><h1>' + (reg ? 'Реєстрація в кабінеті' : 'Вхід до кабінету') + '</h1><div class="msg info">' + (reg ? 'Кабінет дає змогу зберігати обрані лоти, запитувати документи та стежити за відповіддю.' : 'Увійдіть, щоб додавати лоти в обране і запитувати документи.') + '</div>' +
      (reg ? '<label>Ім’я та прізвище</label><input name="name" required maxlength="120"><label>Організація (необов’язково)</label><input name="org" maxlength="200"><label>Телефон (необов’язково)</label><input name="phone" maxlength="40">' : '') +
      '<label>E-mail</label><input name="email" type="email" required autocomplete="email"><label>Пароль' + (reg ? ' (щонайменше 8 символів)' : '') + '</label><input name="password" type="password" required minlength="' + (reg ? 8 : 1) + '" autocomplete="' + (reg ? 'new-password' : 'current-password') + '">' +
      (reg ? '<label class="chk"><input type="checkbox" name="consent" value="1" required> <span>Надаю згоду на обробку персональних даних відповідно до <a href="' + esc(priv) + '" target="_blank" rel="noopener">порядку обробки персональних даних в АРМА</a></span></label>' : '') +
      '<div id="fmsg"></div><p><button class="pbtn main" style="width:100%;justify-content:center">' + (reg ? 'Зареєструватися' : 'Увійти') + '</button></p><p style="text-align:center;font-size:14px">' + (reg ? 'Уже маєте кабінет? <a href="#/login">Увійти</a>' : 'Ще немає кабінету? <a href="#/register">Зареєструватися</a>') + '</p></form></div>');
  }
  function feedback(f) {
    var priv = setting('public_privacy_url', 'https://arma.gov.ua/page/obrobka-personalnih-danih-subektiv-dani-yakih-obroblyayutsya-v-arma'), u = ME.user || {};
    render('<div class="wrap"><form class="form-p" data-f="feedback"' + (f.id ? ' data-id="' + esc(f.id) + '" data-t="' + esc(f.t || '') + '"' : '') + '><h1>Зворотний зв’язок</h1>' + (f.item ? '<div class="msg info">Запитання щодо лота ' + esc(f.item) + '</div><input type="hidden" name="item" value="Лот ' + esc(f.item) + '">' : '') +
      '<label>Ім’я</label><input name="name" value="' + esc(u.name || '') + '" maxlength="120"><label>E-mail для відповіді</label><input name="email" type="email" required value="' + esc(u.email || '') + '"><label>Звернення</label><textarea name="message" required minlength="5" maxlength="2500"></textarea>' +
      '<label class="chk"><input type="checkbox" name="consent" value="1" required> <span>Надаю згоду на обробку персональних даних відповідно до <a href="' + esc(priv) + '" target="_blank" rel="noopener">порядку обробки персональних даних в АРМА</a></span></label>' +
      '<div id="fmsg"></div><p><button class="pbtn main" style="width:100%;justify-content:center">Надіслати</button></p><p style="font-size:13px;color:var(--muted)">Інші способи зв’язку — на сторінці <a href="' + esc(setting('public_contacts_url', 'https://arma.gov.ua/contacts')) + '" target="_blank" rel="noopener">контактів АРМА</a>.</p></form></div>');
  }
  function cabinet(f) {
    if (!ME.user) return authPage('login');
    var tab = f.tab || 'fav', favs = (DATA.items || []).filter(function (it) { return has(ME.favorites, it); }), reqs = ME.requests || [];
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › Кабінет</div><section class="blk"><h2>Кабінет · ' + esc(ME.user.name || ME.user.email) + ' <small>' + esc(ME.user.email) + '</small> <button class="pbtn sm" data-logout style="margin-left:auto">Вийти</button></h2>' +
      '<nav class="cats" style="border:0;background:none"><div style="display:flex;gap:4px"><a href="#/cabinet?tab=fav" class="' + (tab === 'fav' ? 'on' : '') + '">♥ Обране (' + favs.length + ')</a><a href="#/cabinet?tab=req" class="' + (tab === 'req' ? 'on' : '') + '">📄 Запити на документи (' + reqs.length + ')</a></div></nav>';
    if (tab === 'fav') h += favs.length ? '<div class="cards" style="margin-top:12px">' + favs.map(card).join('') + '</div>' : '<div class="empty-p">В обраному поки немає лотів. Натискайте ♡ на картках лотів.</div>';
    else h += reqs.length ? '<div class="box" style="margin-top:12px">' + reqs.map(function (r) { var it = find(r.item_type, r.item_id);
      return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;gap:10px;justify-content:space-between"><a href="#/lot/' + r.item_type + '/' + r.item_id + '">' + esc(it ? it.title : 'Лот ' + r.item_id) + '</a><span class="req-st ' + esc(r.status) + '">' + esc({new: 'на розгляді', approved: 'погоджено', rejected: 'відхилено'}[r.status] || r.status) + '</span></div>' +
        '<div style="font-size:13px;color:var(--muted)">' + esc(r.created_at || '') + (r.message ? ' · ' + esc(r.message) : '') + (r.admin_note ? ' · відповідь: ' + esc(r.admin_note) : '') + '</div>' + (r.status === 'approved' && it && (it.docs || []).length ? (function () { var exp = r.access_until && r.access_until.slice(0, 10) < new Date().toISOString().slice(0, 10);
          return '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + (exp ? '<span style="color:var(--muted);font-size:13px">Строк ознайомлення завершився ' + esc(dt(r.access_until)) + '. Подайте новий запит на сторінці лота.</span>' : MODE !== 'server' ? '<span style="color:var(--muted);font-size:13px">Перегляд документів — на робочому сайті</span>' :
            it.docs.map(function (d) { return '<button class="pbtn sm" data-view="' + d.id + '">📄 ' + esc(d.name) + '</button>'; }).join('') + (r.access_until ? '<span style="color:var(--muted);font-size:13px">перегляд до ' + esc(dt(r.access_until)) + ', лише у переглядачі сайту</span>' : '')) + '</div>'; })() : '') + '</div>'; }).join('') + '</div>' : '<div class="empty-p">Запитів ще немає. Запросити документи можна на сторінці лота.</div>';
    render(h + '</section></div>');
  }
  function route() {
    var path = location.hash.replace(/^#/, '').split('?')[0] || '/', f = params(), m;
    if (path === '/' || path === '') return home();
    if (path === '/search') return search(f);
    if ((m = path.match(/^\/lot\/(asset|pool)\/(\d+)$/))) return lot(m[1], m[2]);
    if (path === '/login' || path === '/register') return authPage(path.slice(1));
    if (path === '/cabinet') return cabinet(f);
    if (path === '/feedback') return feedback(f);
    if (path === '/map') return landMap(f);
    if (path === '/structure' || /^\/page\//.test(path)) return dashPage(f);
    home();
  }

  // ---------------------------------------------------------------- події
  function ref(s) { var p = s.split(':'); return {type: p[0], id: +p[1]}; }
  function bind() {
    $.querySelectorAll('form[data-f]').forEach(function (fm) { fm.addEventListener('submit', function (e) { e.preventDefault(); var d = {}; new FormData(fm).forEach(function (v, k) { d[k] = typeof v === 'string' ? v.trim() : v; }); submit(fm, fm.dataset.f, d); }); });
    // v2.7: меню-«гамбургер» і мобільний пошук
    $.querySelectorAll('[data-drawer]').forEach(function (b) { b.addEventListener('click', function () { var o = !document.body.classList.contains('drawer-open'); document.body.classList.toggle('drawer-open', o); var bx = $.querySelector('[data-drawer-box]'); if (bx) bx.setAttribute('aria-hidden', o ? 'false' : 'true'); }); });
    var dbx = $.querySelector('[data-drawer-box]'); if (dbx) dbx.addEventListener('click', function (e) { if (e.target === dbx || e.target.closest('a')) { document.body.classList.remove('drawer-open'); } });
    var ms = $.querySelector('[data-msearch]'); if (ms) ms.addEventListener('click', function () { var hd = $.querySelector('header.top'); hd.classList.toggle('ms-open'); if (hd.classList.contains('ms-open')) { var i = hd.querySelector('.m-search-bar input'); if (i) i.focus(); } });
    $.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { viewer(+b.dataset.view); }); });
    var lm = $.querySelector('[data-pmap="lot"]'); if (lm) { var cur = location.hash.match(/^#\/lot\/(asset|pool)\/(\d+)/); if (cur) mountMap(lm, [find(cur[1], +cur[2])]); }
    $.querySelectorAll('[data-a11y]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.a11y; if (k === 'hc') A11Y.hc = !A11Y.hc; else A11Y.fs = Math.max(90, Math.min(140, (A11Y.fs || 100) + (k === '+' ? 10 : -10))); applyA11y(); }); });
    $.querySelectorAll('.fbar select').forEach(function (sl) { sl.addEventListener('change', function () { var fm = sl.form; if (fm) fm.requestSubmit ? fm.requestSubmit() : fm.dispatchEvent(new Event('submit')); }); });
    var so = $.querySelector('select[data-sort]'); if (so) so.addEventListener('change', function () { location.hash = link('/search', Object.assign({}, params(), {sort: so.value, page: ''})); });
    $.querySelectorAll('[data-fav]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var r = ref(b.dataset.fav);
      src.post('fav', r).then(function (x) { if (!x.ok) { toast(x.error || 'Помилка'); if (!ME.user) location.hash = '#/login'; return; } toast(x.fav ? 'Додано в обране' : 'Видалено з обраного'); refreshMe().then(route); }); }); });
    $.querySelectorAll('[data-like]').forEach(function (b) { b.addEventListener('click', function () { var r = ref(b.dataset.like); src.post('like', r).then(function (x) { if (!x.ok) return toast(x.error || 'Помилка'); var it = find(r.type, r.id); if (it && x.likes !== undefined) it.likes = x.likes; refreshMe().then(route); }); }); });
    $.querySelectorAll('[data-req]').forEach(function (b) { b.addEventListener('click', function () { var r = ref(b.dataset.req); if (!ME.user) { toast('Увійдіть до кабінету, щоб запросити документи'); location.hash = '#/login'; return; }
      var msg = prompt('Мета запиту / коментар (необов’язково):', ''); if (msg === null) return; src.post('request', Object.assign(r, {message: msg})).then(function (x) { if (!x.ok) return toast(x.error || 'Помилка'); toast('Запит надіслано. Відповідь з’явиться в кабінеті.'); refreshMe().then(route); }); }); });
    var sh = $.querySelector('[data-share]'); if (sh) sh.addEventListener('click', function () { var u = location.href; if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('Посилання скопійовано'); }); else prompt('Посилання на лот:', u); });
    var lo = $.querySelector('[data-logout]'); if (lo) lo.addEventListener('click', function () { src.post('logout').then(function () { refreshMe().then(function () { location.hash = '#/'; }); }); });
  }
  function submit(fm, kind, d) {
    var msg = fm.querySelector('#fmsg'), show = function (t, k) { if (msg) msg.innerHTML = '<div class="msg ' + (k || 'err') + '">' + esc(t) + '</div>'; };
    if (kind === 'search') { location.hash = link('/search', {q: d.q, cat: d.cat, region: d.region}); return; }
    if (kind === 'filter') { var o = {}; for (var k in d) if (d[k]) o[k] = d[k]; location.hash = link('/search', o); return; }
    if (kind === 'login' || kind === 'register') { d.consent = !!d.consent; src.post(kind, d).then(function (x) { if (!x.ok) return show(x.error || 'Помилка'); refreshMe().then(function () { toast(kind === 'register' ? 'Кабінет створено' : 'Вітаємо!'); location.hash = LAST || '#/cabinet'; }); }); return; }
    if (kind === 'feedback') { d.consent = !!d.consent; if (fm.dataset.id) { d.id = +fm.dataset.id; d.t = fm.dataset.t || 'asset'; } var back = fm.dataset.id ? '#/lot/' + (fm.dataset.t || 'asset') + '/' + fm.dataset.id : (LAST || '');
      src.post('feedback', d).then(function (x) { if (!x.ok) return show(x.error || 'Помилка'); fm.reset(); toast(x.mirror ? 'У дзеркалі звернення не надсилається — на робочому сайті його отримає АРМА.' : 'Дякуємо! Звернення надіслано, відповідь надійде на вказаний e-mail.');
        if (back) setTimeout(function () { location.hash = back; }, 600); else show('Звернення надіслано.', 'ok'); }); }
  }
  // ---------------------------------------------------------------- запуск
  $.innerHTML = '<div style="padding:60px;text-align:center;color:#5F6B84">Завантаження каталогу…</div>';
  Promise.all([src.catalog(), refreshMe(), loadMedia()]).then(function (r) { DATA = r[0] || {items: []}; window.addEventListener('hashchange', route); route(); })
    .catch(function (e) { $.innerHTML = '<div style="padding:60px;text-align:center">Не вдалося завантажити каталог. ' + esc(e.message) + '</div>'; });
})();
