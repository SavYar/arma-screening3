/* Реєстр активів АРМА — ядро єдиного інтерфейсу.
   Працює у двох режимах з однаковим кодом сторінок:
   • server — дані з сервера (API, PostgreSQL), усі зміни зберігаються на сервері для всіх користувачів;
   • static — дзеркало на GitHub Pages: дані зі статичних файлів, зміни — лише в браузері (IndexedDB). */
(function () {
  'use strict';
  var A = window.A = {};
  var D = window.D;
  A.mode = window.ARMA_MODE || 'static';
  A.APPVER = '2.1';      // версія формату локальних змін дзеркала; при зміні локальні зміни попередньої версії скидаються
  A.api = window.ARMA_API || '';
  A.csrf = window.ARMA_CSRF || '';
  var S = A.S = {t: {}, ix: {}, user: null, perms: [], settings: {}, last: 0, fv: '1'};
  var $app = document.getElementById('app');

  // ================================================================ утиліти
  var esc = A.esc = function (s) { return s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); };
  A.num = function (v, d) { if (v === null || v === undefined || v === '') return '—'; v = Number(v); if (isNaN(v)) return '—'; var s = v.toFixed(d || 0).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return s.join(','); };
  A.money = function (v, full) { if (!v) return '—'; v = Number(v); if (full) return A.num(v, 2) + ' ₴'; if (Math.abs(v) >= 1e9) return A.num(v / 1e9, 2) + ' млрд ₴'; if (Math.abs(v) >= 1e6) return A.num(v / 1e6, 1) + ' млн ₴'; return A.num(v) + ' ₴'; };
  A.dt = function (v) { if (!v) return '—'; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : esc(v); };
  A.today = function () { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  A.nowS = function () { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().replace('T', ' ').slice(0, 19); };
  A.map = function (pairs) { var o = {}; (pairs || []).forEach(function (p) { o[p[0]] = p[1]; }); return o; };
  A.addWorkdays = function (d, n) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return d.toISOString().slice(0, 10); };
  A.qs = function (o) { var p = []; for (var k in o) if (o[k] !== undefined && o[k] !== null && o[k] !== '') p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); return p.length ? '?' + p.join('&') : ''; };
  A.link = function (path, o) { return '#' + path + A.qs(o || {}); };
  A.json = function (s, d) { if (s && typeof s === 'object') return s; try { return s ? JSON.parse(s) : (d || {}); } catch (e) { return d || {}; } };
  A.clip = function (s, n) { s = s || ''; return s.length > n ? '<span title="' + esc(s) + '">' + esc(s.slice(0, n)) + '…</span>' : esc(s); };
  A.parseNum = function (v) { if (v === null || v === undefined || v === '') return null; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };

  // ================================================================ словники
  var N = A.N = {
    MTU: A.map(D.MTU.map(function (m) { return [m[0], m[1]]; })), DMA: A.map(D.DMA), DMA_SHORT: D.DMA_SHORT,
    CAT: A.map(D.CATEGORIES.map(function (c) { return [c[0], c[1]]; })), KIND: A.map(D.REPORT_KINDS), CX: A.map(D.COMPLEXITY),
    INV: A.map(D.INVEST_GRADES), POS: A.map(D.MGMT_POSSIBLE), REASON: A.map(D.IMPOSSIBLE_REASONS), WAY: A.map(D.TRANSFER_WAYS),
    LEGAL: A.map(D.LEGAL.map(function (l) { return [l[0], l[1]]; })), LS: D.LEGAL_SHORT, LCSS: A.map(D.LEGAL.map(function (l) { return [l[0], l[2]]; })),
    DEC: A.map(D.DECISION_TYPES.map(function (x) { return [x[0], x[1]]; })), DECEFF: A.map(D.DECISION_TYPES.map(function (x) { return [x[0], x[2]]; })),
    EFF: D.EFFECT_NAME, SCOPE: A.map(D.ARREST_SCOPES), DOC: A.map(D.DOC_TYPES),
    PROC: A.map(D.PROCESSES.map(function (p) { return [p[0], p[1]]; })), STEPS: A.map(D.PROCESSES.map(function (p) { return [p[0], p[3]]; })),
    PERM: A.map(D.PERMISSIONS), ZCSS: D.ZONE_CSS
  };
  A.OPT = {
    MTU: D.MTU.map(function (m) { return [m[0], m[1]]; }), CAT: D.CATEGORIES.map(function (c) { return [c[0], c[1]]; }),
    LEGAL: D.LEGAL.map(function (l) { return [l[0], l[1]]; }), STATUS: D.ASSET_STATUS_ZONE.map(function (s) { return s[0]; }),
    // v2.7: у фільтрах і закріпленні активів — лише підрозділи, що працюють з активами (4 відділи ДМА, грошові кошти, реалізація, конкурсні відбори, ДМС)
    DEPT: D.DMA.filter(function (d) { return ['dma1', 'dma2', 'dma3', 'dma4', 'dma_money', 'realization', 'tender', 'dms'].indexOf(d[0]) >= 0; })
  };
  A.FIN = D.FINANCIAL_CATEGORIES;
  A.zoneForStatus = function (st) {
    var s = (st || '').toLowerCase().replace(/\s+/g, ' ').trim(); if (!s) return 'Сіра зона';
    for (var i = 0; i < D.ASSET_STATUS_ZONE.length; i++) if (D.ASSET_STATUS_ZONE[i][0].toLowerCase().replace(/\s+/g, ' ').trim() === s) return D.ASSET_STATUS_ZONE[i][1];
    return null;
  };

  // ================================================================ дані
  var JSONCOLS = {details: 1, data: 1, perms: 1, dossier: 1, yc: 1};
  A.unpack = function (p) {
    if (!p || !p.cols) return [];
    var dec = p.cols.map(function (c) { return (p.dicts && p.dicts[c]) || null; });
    return p.rows.map(function (r) {
      var o = {};
      for (var i = 0; i < p.cols.length; i++) {
        var v = dec[i] ? dec[i][r[i]] : r[i], c = p.cols[i];
        if (JSONCOLS[c] && typeof v === 'string') v = A.json(v, c === 'perms' ? [] : {});
        o[c] = v === undefined ? null : v;
      }
      return o;
    });
  };
  A.T = function (t) { return S.t[t] || (S.t[t] = []); };
  A.get = function (t, id) { return (S.ix[t] || {})[id]; };
  function indexTable(t) { var ix = S.ix[t] = {}; A.T(t).forEach(function (r) { ix[r.id] = r; }); }
  A.indexes = {};
  A.reindex = function (tables) {
    (tables || Object.keys(S.t)).forEach(function (t) { if (t !== 'audit') indexTable(t); });
    var I = A.indexes = {};
    I.byNo = {}; A.T('assets').forEach(function (a) { if (!I.byNo[a.asset_no]) I.byNo[a.asset_no] = a; });
    function grp(t, k) { var o = {}; A.T(t).forEach(function (r) { var v = r[k]; (o[v] = o[v] || []).push(r); }); return o; }
    I.decByAsset = grp('decision_assets', 'asset_id'); I.assetsByDec = grp('decision_assets', 'decision_id');
    I.vaByAsset = grp('valuation_assets', 'asset_id'); I.vaByVal = grp('valuation_assets', 'valuation_id');
    I.stepsByPlan = grp('plan_steps', 'plan_id'); for (var k in I.stepsByPlan) I.stepsByPlan[k].sort(function (a, b) { return a.ord - b.ord; });
    I.files = {}; A.T('file_links').forEach(function (f) { var k = f.target_type + ':' + f.target_id; (I.files[k] = I.files[k] || []).push(f); });
    I.plans = {}; A.T('plans').forEach(function (p) { var k = p.target_type + ':' + p.target_id; (I.plans[k] = I.plans[k] || []).push(p); });
    I.comp = {}; A.T('companies').forEach(function (c) { I.comp[c.edrpou] = c; });
    I.rate = {}; A.T('rates').forEach(function (r) { I.rate[r.token] = r; });
    I.poolAssets = grp('assets', 'pool_id');
    I.identByGroup = grp('ident_records', 'group_id'); I.identByAppeal = grp('ident_records', 'appeal_id'); I.identByRuling = grp('ident_records', 'ruling_id');
    I.rulingsByAppeal = grp('ident_rulings', 'appeal_id');
    // v2.5: управління і реалізація активів
    I.monthlyByContract = grp('mgmt_monthly', 'contract_id'); I.assetsByContract = grp('assets', 'mgmt_contract_id'); I.poolsByContract = grp('pools', 'mgmt_contract_id');
    I.salesMonthly = grp('sales_monthly', 'sale_id'); I.bizByTarget = {}; A.T('biz_plans').forEach(function (b) { var k = b.target_type + ':' + b.target_id; (I.bizByTarget[k] = I.bizByTarget[k] || []).push(b); });
    I.salesByAsset = grp('sales', 'asset_id'); I.salesByPool = grp('sales', 'pool_id');
    I.decText = null;   // текст рішень за активом (№ справи, провадження, ЄРДР) — будується за потреби
  };
  // № справ, проваджень і КП в ЄРДР за кожним активом (для пошуку в реєстрі)
  A.decTextOf = function (a) {
    var I = A.indexes;
    if (!I.decText) { I.decText = {}; var internal = A.can('view_internal');
      A.T('decision_assets').forEach(function (l) { var d = A.get('decisions', l.decision_id); if (!d) return; I.decText[l.asset_id] = (I.decText[l.asset_id] || '') + ' ' + [d.case_no, d.proceeding_no, internal ? d.erdr_no : ''].join(' '); }); }
    return I.decText[a.id] || '';
  };
  // ухвали в хронологічному порядку та № КП в ЄРДР за активом (для звітів XLSX)
  // v2.7: окрема функція (A.decisionsOf перевизначається в pages_asset.js і приймає id) — через конфлікт імен колонки «Ухвали» і «ЄРДР» у звітах були порожні
  A.decisionsOfAsset = function (a) { return (A.indexes.decByAsset[a.id] || []).map(function (l) { return A.get('decisions', l.decision_id); }).filter(Boolean).sort(function (x, y) { return (x.decision_date || '').localeCompare(y.decision_date || '') || x.id - y.id; }); };
  A.rulingsLine = function (a) { return A.decisionsOfAsset(a).map(function (d) { return [A.dt(d.decision_date), N.DEC[d.dtype] || d.dtype, d.court, d.case_no ? 'справа ' + d.case_no : '', d.proceeding_no ? 'провадження ' + d.proceeding_no : ''].filter(Boolean).join(', '); }).join('\n'); };
  // v2.7: актуальна оцінка активу — власна, у складі пулу або групова (для звітів і карток); {v, kind: 'asset'|'pool'|'group', code}
  A.assetValuation = function (a) {
    var I = A.indexes;
    if (!I.valCur) { I.valCur = {asset: {}, pool: {}, group: {}};
      A.T('valuations').filter(function (v) { return v.is_current && v.value_uah; }).sort(function (x, y) { return (x.value_date || '').localeCompare(y.value_date || ''); }).forEach(function (v) {
        if (v.target_type === 'asset' || v.target_type === 'pool') I.valCur[v.target_type][v.target_id] = v;
        else if (v.target_type === 'group') (I.vaByVal[v.id] || []).forEach(function (l) { I.valCur.group[l.asset_id] = v; }); }); }
    var v = I.valCur.asset[a.id]; if (v) return {v: v, kind: 'asset', code: a.asset_no};
    if (a.pool_id && (v = I.valCur.pool[a.pool_id])) { var p = A.get('pools', a.pool_id); return {v: v, kind: 'pool', code: p ? p.code : ''}; }
    if ((v = I.valCur.group[a.id])) return {v: v, kind: 'group', code: 'групова' + (v.lot_no ? ', лот ' + v.lot_no : '')};
    return null;
  };
  // v2.7: сума актуальних оцінок для набору активів — кожна оцінка (активу, пулу, групова) рахується один раз
  A.valuationSum = function (list) { var seen = {}, t = 0; list.forEach(function (a) { var x = A.assetValuation(a); if (x && !seen[x.v.id] && !/^Інвентаризація/.test(x.v.source || '')) { seen[x.v.id] = 1; t += x.v.value_uah || 0; } }); return t; };
  A.erdrLine = function (a) { var seen = {}; return A.decisionsOfAsset(a).map(function (d) { return A.can('view_internal') ? d.erdr_no : null; }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).join('\n'); };

  // ================================================================ сховище браузера (режим дзеркала)
  var idb = null;
  function idbOpen() { return new Promise(function (res) { try { var r = indexedDB.open('arma-mirror', 2); r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = function () { idb = r.result; res(); }; r.onerror = function () { res(); }; } catch (e) { res(); } }); }
  function idbGet(k) { return new Promise(function (res) { if (!idb) return res(null); try { var r = idb.transaction('kv').objectStore('kv').get(k); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  function idbPut(k, v) { if (!idb) return; try { idb.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { console.warn(e); } }
  A.idbClear = function () { return new Promise(function (res) { if (!idb) return res(); var t = idb.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = res; t.onerror = res; }); };
  var CH = {assets: {}, tables: {}, deleted: {}};
  var dirty = {}, saveT = null;
  function persist(tables) {
    tables.forEach(function (t) { dirty[t] = 1; });
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      Object.keys(dirty).forEach(function (t) {
        if (t === 'assets') { idbPut('assets', CH.assets); idbPut('assets_del', CH.deleted.assets || []); }
        else if (t === 'settings') { CH.tables.settings = 1; idbPut('t:settings', S.settings); }
        else { CH.tables[t] = 1; idbPut('t:' + t, S.t[t]); }
      });
      dirty = {};
      idbPut('meta', {tables: Object.keys(CH.tables), fv: S.fv, app: A.APPVER, saved: A.nowS()});
    }, 250);
  }
  A.changesSummary = function () { return {assets: Object.keys(CH.assets).length, tables: Object.keys(CH.tables)}; };
  A.exportChanges = function () { var t = {}; Object.keys(CH.tables).forEach(function (k) { t[k] = S.t[k]; }); return {assets: CH.assets, deleted: CH.deleted, tables: t, fv: S.fv}; };

  // ================================================================ запити до сервера
  A.http = function (method, url, body, isForm) {
    var opt = {method: method, credentials: 'same-origin', headers: {'X-CSRF': A.csrf}};
    if (body !== undefined) { if (isForm) opt.body = body; else { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; } }
    return fetch(A.api + url, opt).then(function (r) {
      if (r.status === 401 || r.redirected && /login/.test(r.url)) { location.href = A.api + '/login'; throw new Error('Сесія завершилась'); }
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('json') < 0) { if (!r.ok) throw new Error('Помилка сервера ' + r.status); return r.blob(); }
      return r.json().then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || ('Помилка ' + r.status)); return j; });
    });
  };
  function loadJSON(u) { return fetch(u, {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); }); }

  // ================================================================ завантаження
  A.boot = function () {
    busy(true, 'Завантаження реєстру…');
    var p = A.mode === 'server' ? bootServer() : bootStatic();
    return p.then(function () {
      A.reindex();
      busy(false);
      window.addEventListener('hashchange', A.route);
      A.route();
      if (A.mode === 'server') setInterval(poll, 60000);
    }).catch(function (e) {
      busy(false);
      $app.innerHTML = '<div class="boot"><img src="' + A.asset('logo.png') + '" alt=""><b>Не вдалося завантажити дані</b><div class="mini">' + esc(e.message) + '</div>' +
        (A.mode === 'static' ? '<div class="mini">Дзеркало відкривається через GitHub Pages або вебсервер (не подвійним кліком по файлу).</div>' : '') + '</div>';
      console.error(e);
    });
  };
  A.asset = function (f) { return (window.ARMA_STATIC || '') + f; };
  function bootServer() {
    return A.http('GET', '/api/boot').then(function (b) {
      S.user = b.user; S.perms = b.perms; S.settings = b.settings || {}; S.last = b.last_change; S.fv = b.full_version; S.version = b.version || ''; A.csrf = b.csrf || A.csrf;
      return Promise.all(b.tables.map(function (t) { return A.http('GET', '/api/table/' + t).then(function (p) { S.t[t] = A.unpack(p); }); }));
    }).then(function () { S.t.audit = []; });
  }
  function bootStatic() {
    return Promise.all([idbOpen(), loadJSON(A.asset('data-boot.json')), loadJSON(A.asset('data-base.json'))]).then(function (r) {
      var boot = r[1], base = r[2];
      S.settings = boot.settings || {}; S.fv = boot.full_version; S.built = boot.built; S.version = boot.version || '';
      Object.keys(base).forEach(function (t) { S.t[t] = A.unpack(base[t]); });
      return Promise.all(boot.parts.map(function (p) { return loadJSON(A.asset(p)); })).then(function (parts) {
        S.t.assets = [].concat.apply([], parts.map(A.unpack));
        return idbGet('meta');
      });
    }).then(function (meta) {
      S.t.audit = [];
      if (!meta || meta.fv !== S.fv || meta.app !== A.APPVER) {               // нові дані з сервера — локальні зміни попередньої версії скидаються
        if (meta) A.toast('Дзеркало оновлено новими даними з сервера (' + (S.built || '') + '). Попередні локальні зміни скинуто.', 'info');
        return A.idbClear();
      }
      var tabs = meta.tables || [];
      return Promise.all([idbGet('assets'), idbGet('assets_del')].concat(tabs.map(function (t) { return idbGet('t:' + t); }))).then(function (res) {
        CH.assets = res[0] || {}; CH.deleted.assets = res[1] || [];
        tabs.forEach(function (t, i) { if (!res[i + 2]) return; CH.tables[t] = 1; if (t === 'settings') Object.assign(S.settings, res[i + 2]); else S.t[t] = res[i + 2]; });
        var del = {}; CH.deleted.assets.forEach(function (id) { del[id] = 1; });
        var byId = {}; S.t.assets = S.t.assets.filter(function (a) { byId[a.id] = a; return !del[a.id]; });
        Object.keys(CH.assets).forEach(function (id) { var rec = CH.assets[id]; if (byId[id]) Object.assign(byId[id], rec); else S.t.assets.push(rec); });
      });
    }).then(function () {
      var u = sessionStorage.getItem('mirror-user');
      S.user = u ? A.T('users').filter(function (x) { return x.login === u; })[0] || null : null;
      setPerms();
    });
  }
  function setPerms() { var r = S.user && A.T('roles').filter(function (x) { return x.code === S.user.role_code; })[0]; S.perms = (r && r.perms) || []; }
  A.setUser = function (login) { S.user = A.T('users').filter(function (u) { return u.login === login; })[0] || null; if (S.user) sessionStorage.setItem('mirror-user', login); else sessionStorage.removeItem('mirror-user'); setPerms(); };
  function poll() {
    return A.http('GET', '/api/changes' + A.qs({after: S.last, fv: S.fv})).then(function (r) {
      if (r.reload) { A.toast('Адміністратор оновив дані. Сторінку буде перезавантажено.', 'info'); setTimeout(function () { location.reload(); }, 2500); return; }
      S.last = r.last; var touched = applyRemote(r.tables, r.deleted);
      if (touched.length && !document.querySelector('form.dirty')) { A.reindex(touched); A.route(true); }
    }).catch(function () {});
  }
  A.pollNow = function () { return poll(); };
  function upsertLocal(t, rec) {
    var arr = A.T(t), ix = S.ix[t] || (S.ix[t] = {}), cur = ix[rec.id];
    if (cur) { Object.keys(cur).forEach(function (k) { if (!(k in rec)) delete cur[k]; }); Object.assign(cur, rec); }
    else { arr.push(rec); ix[rec.id] = rec; }
    return ix[rec.id];
  }
  function deleteLocal(t, id) { S.t[t] = A.T(t).filter(function (r) { return r.id !== id; }); if (S.ix[t]) delete S.ix[t][id]; }
  function applyRemote(tables, deleted) {
    var touched = {};
    Object.keys(tables || {}).forEach(function (t) { A.unpack(tables[t]).forEach(function (r) { upsertLocal(t, r); }); touched[t] = 1; });
    Object.keys(deleted || {}).forEach(function (t) { deleted[t].forEach(function (id) { deleteLocal(t, id); }); touched[t] = 1; });
    return Object.keys(touched);
  }

  // ================================================================ транзакції змін
  var tmp = -1;
  A.tmpId = function () { return tmp--; };
  var FK = {decision_assets: {decision_id: 'decisions', asset_id: 'assets'}, valuation_assets: {valuation_id: 'valuations', asset_id: 'assets'},
    plan_steps: {plan_id: 'plans'}, assets: {pool_id: 'pools', mgmt_contract_id: 'mgmt_contracts'}, mgmt_monthly: {contract_id: 'mgmt_contracts'}, sales_monthly: {sale_id: 'sales'}, sales: {asset_id: 'assets', pool_id: 'pools'}, ident_records: {group_id: 'ident_groups', asset_id: 'assets', appeal_id: 'ident_appeals', ruling_id: 'ident_rulings'},
    ident_rulings: {appeal_id: 'ident_appeals'}, ident_groups: {pool_id: 'pools'}, pools: {ident_group_id: 'ident_groups', mgmt_contract_id: 'mgmt_contracts'}};
  var TARGET = {asset: 'assets', pool: 'pools', ident_group: 'ident_groups', ident: 'ident_records', ident_appeal: 'ident_appeals', company: 'companies', contract: 'mgmt_contracts', sale: 'sales', vaks: 'vaks_cases'};
  var DYN = {plans: 1, valuations: 1, file_links: 1, biz_plans: 1, pub_pubreq: 1};
  var CASCADE = {decisions: [['decision_assets', 'decision_id']], valuations: [['valuation_assets', 'valuation_id']], plans: [['plan_steps', 'plan_id']], mgmt_contracts: [['mgmt_monthly', 'contract_id']], sales: [['sales_monthly', 'sale_id']],
    assets: [['decision_assets', 'asset_id'], ['valuation_assets', 'asset_id']]};
  A.tx = function () {
    var ops = [], logs = [];
    var t = {
      put: function (table, rec, v) { ops.push({t: table, op: 'upsert', rec: rec, v: v}); return rec; },
      del: function (table, id) { ops.push({t: table, op: 'delete', rec: {id: id}}); },
      log: function (action, entity, id, details) { logs.push({action: action, entity: entity, id: id, details: details}); },
      size: function () { return ops.length; },
      commit: function () { return A.mode === 'server' ? commitServer(ops, logs) : commitStatic(ops, logs); }
    };
    return t;
  };
  function remap(table, rec, idmap) {
    var f = FK[table] || {};
    Object.keys(f).forEach(function (k) { var v = rec[k]; if (typeof v === 'number' && v < 0 && idmap[f[k] + ':' + v]) rec[k] = idmap[f[k] + ':' + v]; });
    if (DYN[table]) { var ref = TARGET[rec.target_type]; if (ref && rec.target_id < 0 && idmap[ref + ':' + rec.target_id]) rec.target_id = idmap[ref + ':' + rec.target_id]; }
  }
  function commitStatic(ops, logs) {
    var idmap = {}, touched = {}, user = S.user ? S.user.login : 'demo';
    function nextId(t) { var m = 0; A.T(t).forEach(function (r) { if (r.id > m) m = r.id; }); return m + 1; }
    function cascade(t, id) {
      (CASCADE[t] || []).forEach(function (c) { A.T(c[0]).filter(function (r) { return r[c[1]] === id; }).forEach(function (r) { deleteLocal(c[0], r.id); touched[c[0]] = 1; }); });
      var tt = {assets: 'asset', pools: 'pool'}[t];
      if (tt) {
        A.T('plans').filter(function (p) { return p.target_type === tt && p.target_id === id; }).forEach(function (p) { cascade('plans', p.id); });
        A.T('file_links').filter(function (f) { return f.target_type === tt && f.target_id === id; }).forEach(function (f) { deleteLocal('file_links', f.id); touched.file_links = 1; });
      }
      if (t === 'pools') A.T('assets').forEach(function (a) { if (a.pool_id === id) { a.pool_id = null; CH.assets[a.id] = a; touched.assets = 1; } });
      if (t === 'ident_groups') A.T('ident_records').forEach(function (r) { if (r.group_id === id) { r.group_id = null; touched.ident_records = 1; } });
      deleteLocal(t, id); touched[t] = 1;
      if (t === 'assets') { delete CH.assets[id]; (CH.deleted.assets = CH.deleted.assets || []).push(id); }
    }
    ops.forEach(function (o) {
      var rec = Object.assign({}, o.rec), id = rec.id;
      if (o.op === 'delete') { id = idmap[o.t + ':' + id] || id; if (A.get(o.t, id)) cascade(o.t, id); return; }
      if (o.t === 'settings') { S.settings[rec.key] = rec.value; touched.settings = 1; return; }
      if (o.t === 'rates') { var ex = A.T('rates').filter(function (r) { return r.token === rec.token; })[0]; delete rec.id; if (ex) Object.assign(ex, rec); else A.T('rates').push(rec); touched.rates = 1; return; }
      remap(o.t, rec, idmap);
      // зміна існуючого запису — це часткове оновлення: зливаємо з поточним записом (інакше поля, яких немає в зміні, зникають)
      var prev = id !== undefined && id !== null && id > 0 ? A.get(o.t, id) : null;
      if (prev) rec = Object.assign({}, prev, rec);
      if (o.t === 'assets') { rec.updated_at = A.nowS(); rec.updated_by = user; delete rec._s; }
      if (id === undefined || id === null || id < 0) {
        var nid = nextId(o.t); if (id < 0) idmap[o.t + ':' + id] = nid; rec.id = nid;
        if (!rec.created_at) rec.created_at = A.nowS(); if (!rec.created_by) rec.created_by = user;
      }
      var cur = upsertLocal(o.t, rec); touched[o.t] = 1;
      if (o.t === 'assets') CH.assets[cur.id] = cur;
    });
    logs.forEach(function (l) { A.T('audit').unshift({id: A.T('audit').length + 1, ts: A.nowS(), login: user, action: l.action, entity: l.entity || '', entity_id: l.id || '', details: l.details ? JSON.stringify(l.details).slice(0, 500) : ''}); });
    if (logs.length) touched.audit = 1;
    var tl = Object.keys(touched); A.reindex(tl.filter(function (x) { return x !== 'settings'; })); persist(tl);
    return Promise.resolve({idmap: idmap, id: function (t, tid) { return idmap[t + ':' + tid] || tid; }});
  }
  function commitServer(ops, logs) {
    busy(true);
    return A.http('POST', '/api/save', {ops: ops, log: logs}).then(function (r) {
      busy(false);
      ops.forEach(function (o) { if (o.t === 'settings') S.settings[o.rec.key] = o.rec.value; });
      A.applyServer(r);
      return {idmap: r.idmap || {}, id: function (t, tid) { return (r.idmap || {})[t + ':' + tid] || tid; }};
    }, function (e) { busy(false); throw e; });
  }
  // застосувати записи, повернуті сервером (збереження, завантаження файлів)
  A.applyServer = function (r) {
    var touched = {};
    Object.keys(r.records || {}).forEach(function (t) { r.records[t].forEach(function (rec) {
      Object.keys(rec).forEach(function (k) { if (JSONCOLS[k] && typeof rec[k] === 'string') rec[k] = A.json(rec[k], k === 'perms' ? [] : {}); });
      upsertLocal(t, rec); }); touched[t] = 1; });
    Object.keys(r.deleted || {}).forEach(function (t) { r.deleted[t].forEach(function (id) { deleteLocal(t, id); }); touched[t] = 1; });
    A.reindex(Object.keys(touched));
    return Object.keys(touched);
  };
  A.audit = function (action, entity, id, details) {
    if (A.mode === 'server') { pendingLog.push({action: action, entity: entity, id: id, details: details}); clearTimeout(logT); logT = setTimeout(flushLog, 3000); }
    else { var tx = A.tx(); tx.log(action, entity, id, details); tx.commit(); }
  };
  var pendingLog = [], logT = null;
  function flushLog() { var ev = pendingLog; pendingLog = []; if (ev.length) A.http('POST', '/api/log', {events: ev}).catch(function () {}); }
  window.addEventListener('beforeunload', function () { if (pendingLog.length && navigator.sendBeacon) { /* журнал переглядів — не критичний */ } });

  // ================================================================ права і видимість
  A.can = function (p) { return S.perms.indexOf(p) >= 0; };
  A.role = function () { return A.T('roles').filter(function (x) { return S.user && x.code === S.user.role_code; })[0] || {}; };
  A.inScope = function (a) {
    if (A.can('view_all')) return true; var u = S.user || {};
    if (u.mtu_code) return (!a.mtu_code || a.mtu_code === u.mtu_code) && A.FIN.indexOf(a.category) < 0;
    if (u.dept_code) return !a.dept_code || a.dept_code === u.dept_code;
    return false;
  };
  A.canEdit = function (a, section) {
    if (A.can('edit_any_asset')) return true; var u = S.user || {}, fin = A.FIN.indexOf(a.category) >= 0;
    if (section === 'main' && fin) return A.can('edit_money');
    var od = !!u.dept_code && (!a.dept_code || a.dept_code === u.dept_code), om = !!u.mtu_code && (!a.mtu_code || a.mtu_code === u.mtu_code);
    if (section === 'screening') { if (fin) return false; return (A.can('edit_screening') && om) || (A.can('edit_assets') && (od || om)); }
    return A.can('edit_assets') && od;
  };
  A.catAllowed = function (code) { return !(S.user && S.user.mtu_code && !A.can('view_all') && A.FIN.indexOf(code) >= 0); };

  // ================================================================ правовий стан (та сама логіка, що на сервері)
  var RANK = {closed: 4, lost: 3, limited: 2, full: 1, unknown: 0};
  function effOf(r) { return r.effect || N.DECEFF[r.dtype] || 'none'; }
  A.legalFromDecisions = function (rows) {
    var rel = rows.filter(function (r) { return effOf(r) !== 'none'; });
    if (!rel.length) return null;
    rel.sort(function (a, b) { return (a.decision_date || '').localeCompare(b.decision_date || '') || (a.id - b.id); });
    var e = effOf(rel[rel.length - 1]);
    if (e === 'close') return 'closed'; if (e === 'terminate') return 'lost'; if (e === 'restrict') return 'limited';
    var sc = rel.filter(function (r) { return r.arrest_scope; }).map(function (r) { return r.arrest_scope; });
    if (sc.length && sc[sc.length - 1] === 'disposal_only') return 'limited';
    return rel.some(function (r) { return (r.dtype || '').indexOf('transfer') === 0; }) ? 'full' : null;
  };
  A.decisionsOf = function (aid) {
    return (A.indexes.decByAsset[aid] || []).map(function (l) { var d = A.get('decisions', l.decision_id); return d && Object.assign({}, d, {effect: l.effect || d.effect, link_id: l.id}); }).filter(Boolean)
      .sort(function (a, b) { return (a.decision_date || '').localeCompare(b.decision_date || '') || a.id - b.id; });
  };
  A.legalCompute = function (a, rows, manual) {
    var src = a.legal_src || 'unknown', LS = N.LS; rows = rows || A.decisionsOf(a.id);
    var dec = rows.length ? A.legalFromDecisions(rows) : null, last = rows.reduce(function (m, r) { return (r.decision_date || '') > m ? r.decision_date : m; }, '') || null;
    var base = {decisions_count: rows.length, last_decision_date: last, legal_dec: dec};
    manual = manual === undefined ? a.legal_manual : manual;
    if (manual) { var auto = dec || src; return Object.assign(base, {legal_status: manual, legal_basis: 'manual', legal_note: auto && auto !== manual && auto !== 'unknown' ? 'Стан встановлено вручну. Автоматично визначений стан — «' + LS[auto] + '».' : null}); }
    if (!dec) return Object.assign(base, {legal_status: src, legal_basis: 'inventory', legal_note: null});
    if (src === 'unknown' || src === dec) return Object.assign(base, {legal_status: dec, legal_basis: src === 'unknown' ? 'decisions' : 'combined', legal_note: null});
    var effs = rows.filter(function (r) { return effOf(r) !== 'none'; }).map(effOf), regrant = effs.length && (effs[effs.length - 1] === 'grant' || effs[effs.length - 1] === 'confirm') && effs.slice(0, -1).indexOf('terminate') >= 0;
    var st = (regrant && (dec === 'full' || dec === 'limited') && src === 'lost') ? dec : (RANK[dec] >= RANK[src] ? dec : src);
    var note = st === src ? null : 'Розбіжність джерел: за хронологією судових рішень — «' + LS[dec] + '», за інвентаризацією — «' + LS[src] + '». Встановлено «' + LS[st] + '». Перевірте та за потреби скоригуйте стан вручну.';
    return Object.assign(base, {legal_status: st, legal_basis: st === dec ? 'decisions' : 'inventory', legal_note: note});
  };

  // ================================================================ інтерфейс: дрібні елементи
  A.opts = function (options, value, empty) {
    var h = empty === null ? '' : '<option value="">' + esc(empty || '— не обрано —') + '</option>';
    (options || []).forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      h += '<option value="' + esc(v) + '"' + (value !== null && value !== undefined && String(value) === String(v) ? ' selected' : '') + ' title="' + esc(t) + '">' + esc(t) + '</option>'; });
    return h;
  };
  A.sel = function (name, options, value, empty, attrs) { return '<select name="' + name + '" ' + (attrs || '') + ' title="' + esc(empty || '') + '">' + A.opts(options, value, empty) + '</select>'; };
  // v2.6: числа в полях вводу — з розділенням тисяч (52 500,00); перед збереженням пробіли прибираються, кома → крапка (A.fd)
  A.fmtIn = function (v) { if (v === null || v === undefined || v === '') return ''; var n = A.parseNum(v); if (n === null || /[^\d\s.,\-]/.test(String(v))) return v; var p = String(n).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join(','); };
  A.field = function (label, name, value, type, req, hint, cls, attrs) {
    var v = value === null || value === undefined ? '' : value;
    if (attrs && attrs.indexOf('inputmode="decimal"') >= 0) { v = A.fmtIn(v); attrs = attrs + ' data-num'; }
    var inp = type === 'textarea' ? '<textarea name="' + name + '" class="' + (cls && cls.indexOf('big') >= 0 ? 'big' : '') + '" ' + (attrs || '') + '>' + esc(v) + '</textarea>'
      : '<input type="' + (type || 'text') + '" name="' + name + '" value="' + esc(v) + '"' + (type === 'number' ? ' step="any"' : '') + (req ? ' required' : '') + ' ' + (attrs || '') + '>';
    return '<div class="field ' + (cls || '') + '"><label class="' + (req ? 'req' : '') + '" title="' + esc(label) + '">' + esc(label) + '</label>' + inp + (hint ? '<div class="mini">' + esc(hint) + '</div>' : '') + '</div>';
  };
  A.fsel = function (label, name, options, value, req, hint, cls, attrs, empty) {
    return '<div class="field ' + (cls || '') + '"><label class="' + (req ? 'req' : '') + '" title="' + esc(label) + '">' + esc(label) + '</label>' + A.sel(name, options, value, empty, (attrs || '') + (req ? ' required' : '')) + (hint ? '<div class="mini">' + esc(hint) + '</div>' : '') + '</div>';
  };
  A.chart = function (type, s, color, colors, extra) {
    var d = Object.assign({type: type, labels: s[0], values: s[1], links: s[2] || null, color: color || null, colors: colors || null}, extra || {});
    return '<div class="chart" data-chart=\'' + JSON.stringify(d).replace(/&/g, '&amp;').replace(/'/g, '&#39;') + '\'></div>';
  };
  A.legal = function (code, long) { return '<span class="tag t-' + (N.LCSS[code] || 'unk') + '" title="' + esc(N.LEGAL[code] || '') + '">' + esc((long ? N.LEGAL : N.LS)[code] || 'Уточнюється') + '</span>'; };
  A.zone = function (z, short) { if (!z) return ''; var c = N.ZCSS[z] || 'grey'; return '<span class="z z-' + c + '" title="' + esc(z) + '">' + esc(short ? z.replace(' зона', '') : z) + '</span>'; };
  A.invest = function (code) {
    return code === 'attractive' ? '<span class="tag t-gold">Привабливий</span>' : code === 'conditional' ? '<span class="tag t-lim">Умовно</span>'
      : code === 'unattractive' ? '<span class="tag t-unk">Не привабливий</span>' : code === 'na' ? '<span class="mini">—</span>' : '<span class="mini">не оцінено</span>';
  };
  A.kpi = function (title, value, desc, href, cls) {
    return '<div class="panel kpi"><h3 title="' + esc(title) + '">' + esc(title) + '</h3>' + (href ? '<a class="v ' + (cls || '') + '" href="' + href + '">' + value + '</a>' : '<div class="v ' + (cls || '') + '">' + value + '</div>') + '<div class="d">' + esc(desc || '') + '</div></div>';
  };
  A.PER = 50;
  A.pager = function (total, page, base, params) {
    var pages = Math.max(1, Math.ceil(total / A.PER));
    if (pages <= 1) return '<div class="pager"><span>Записів: ' + A.num(total) + '</span></div>';
    var h = '<div class="pager"><span>Записів: ' + A.num(total) + '</span>';
    function a(p, t) { return '<a href="' + A.link(base, Object.assign({}, params, {page: p})) + '">' + t + '</a>'; }
    if (page > 1) h += a(1, '«') + a(page - 1, '‹');
    for (var i = Math.max(1, page - 3); i <= Math.min(pages, page + 3); i++) h += i === page ? '<span class="cur">' + i + '</span>' : a(i, i);
    if (page < pages) h += a(page + 1, '›') + a(pages, '»');
    return h + '<span>сторінка ' + page + ' з ' + pages + '</span></div>';
  };
  A.pageOf = function (list, f) { var p = Math.max(1, parseInt(f.page || 1, 10)); return {page: p, rows: list.slice((p - 1) * A.PER, p * A.PER)}; };
  A.grp = function (list, key) { var c = {}; list.forEach(function (a) { var k = typeof key === 'function' ? key(a) : a[key]; k = k === null || k === undefined || k === '' ? '' : k; c[k] = (c[k] || 0) + 1; }); return Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (x, y) { return y[1] - x[1]; }); };
  A.sum = function (list, key, val) { var c = {}; list.forEach(function (a) { var k = typeof key === 'function' ? key(a) : a[key]; k = k === null || k === undefined || k === '' ? '' : k; c[k] = (c[k] || 0) + (Number(val(a)) || 0); }); return Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (x, y) { return y[1] - x[1]; }); };
  A.series = function (arr, names, linkFn, limit) {
    arr = limit ? arr.slice(0, limit) : arr;
    return [arr.map(function (x) { return x[0] === '' ? 'Не визначено' : ((names && names[x[0]]) || x[0]); }), arr.map(function (x) { return x[1]; }), arr.map(function (x) { return linkFn ? linkFn(x[0] === '' ? '__none__' : x[0]) : null; })];
  };
  A.fullAddress = function (a) {
    var p = [];
    if (a.region) p.push(/^(м\.|АР)/.test(a.region) ? a.region : a.region + ' обл.');
    if (a.district) p.push(a.district + ' р-н'); if (a.hromada) p.push(a.hromada + ' громада');
    if (a.settl_name && !(a.region && a.region.indexOf(a.settl_name) >= 0)) p.push(((a.settl_type || '') + ' ' + a.settl_name).trim());
    if (a.street_name) p.push(((a.street_type || '') + ' ' + a.street_name).trim() + (a.building ? ', ' + a.building : ''));
    return p.join(', ');
  };
  A.valState = function (d) { if (!d) return 'none'; return (Date.now() - new Date(d).getTime()) / 864e5 > D.VALUATION_MAX_AGE_DAYS ? 'expired' : 'valid'; };
  A.critLabel = function (c) { if (!c || c === '#N/A' || c === '#Н/Д') return '<span class="tag t-ok">публічний</span>'; return esc(c); };

  // ================================================================ повідомлення, очікування, модальні вікна
  var toastBox = null;
  A.toast = function (msg, kind) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toast'; document.body.appendChild(toastBox); }
    var d = document.createElement('div'); d.className = kind || 'ok'; d.textContent = msg; toastBox.appendChild(d);
    setTimeout(function () { d.remove(); }, kind === 'err' ? 9000 : 5000);
  };
  var busyEl = null;
  function busy(on) { if (on) { if (!busyEl) { busyEl = document.createElement('div'); busyEl.className = 'busy'; document.body.appendChild(busyEl); } } else if (busyEl) { busyEl.remove(); busyEl = null; } }
  A.busy = busy;
  A.modal = function (title, html, onMount) {
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal"><h3>' + esc(title) + '</h3>' + html + '</div>';
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) { e.preventDefault(); bg.remove(); } });
    document.body.appendChild(bg); if (onMount) onMount(bg.querySelector('.modal'), function () { bg.remove(); });
    return bg;
  };
  A.confirm = function (msg) { return window.confirm(msg); };

  // ================================================================ каркас сторінки
  A.NAV = [];   // [{group, items:[{href,label,match,show()}]}] — заповнюють модулі
  A.shell = function (title, sub, actions, content) {
    var r = location.hash.slice(1).split('?')[0] || '/', u = S.user || {}, ro = A.role();
    var h = '<div class="shell"><aside class="rail"><div class="brand"><img src="' + A.asset('logo.png') + '" alt="АРМА"><div><b>Реєстр активів</b><span>АРМА · ' + (A.mode === 'server' ? 'робоча система' : 'дзеркало для перевірки') + '</span></div></div><nav>';
    A.NAV.forEach(function (g) {
      var items = g.items.filter(function (i) { return !i.show || i.show(); });
      if (!items.length) return;
      h += '<div class="grp">' + esc(g.group) + '</div>' + items.map(function (i) {
        var on = i.match ? r.indexOf(i.match) === 0 : r === i.href;
        var bd = i.badge ? i.badge() : 0;
        return '<a href="#' + i.href + '" class="' + (on ? 'on' : '') + '" title="' + esc(i.label) + '">' + esc(i.label) + (bd ? ' <span class="nbadge">' + bd + '</span>' : '') + '</a>';
      }).join('');
    });
    h += '</nav><div class="who"><b>' + esc(u.full_name || '') + '</b>' + esc(ro.name || '') + (u.mtu_code ? ' · ' + esc(N.MTU[u.mtu_code]) : u.dept_code ? ' · ' + esc(N.DMA_SHORT[u.dept_code]) : '') +
      '<div style="margin-top:6px">' + (A.mode === 'server' ? '<a href="' + A.api + '/password">Пароль</a> · <a href="' + A.api + '/logout">Вийти</a>' : '<a href="#/login" data-click="logout">Змінити користувача</a>') + '</div>' + (S.version ? '<div class="app-ver" title="Версія програми «Портал „Реєстр активів АРМА“»">Версія ' + esc(S.version) + '</div>' : '') + '</div></aside><main>' +
      '<div class="topbar"><div style="min-width:0"><h1>' + esc(title) + '</h1><p class="sub">' + esc(sub || '') + '</p></div><div class="row-actions">' + (actions || '') +
      (A.mode === 'static' ? '<div class="demo" title="Дзеркало для перевірки: дані знеособлено, зміни зберігаються лише у вашому браузері">Дзеркало' + (S.built ? ' · дані на ' + esc(S.built) : '') + '</div>' : '') + '</div></div>';
    flashQ.forEach(function (f) { h += '<div class="flash ' + f[0] + '">' + esc(f[1]) + '</div>'; }); flashQ = [];
    return h + content + '</main></div>';
  };
  var flashQ = [];
  A.flash = function (msg, kind) { flashQ.push([kind || 'ok', msg]); };
  A.render = function (html, keepScroll) {
    var y = window.scrollY; $app.innerHTML = html; if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    window.ArmaCharts.render($app); A.initTabs(); A.initSel(); A.initForms();
    A.afterRender.forEach(function (f) { try { f($app); } catch (e) { console.error(e); } });
  };
  A.afterRender = [];
  // v2.5 (зауваження 21.10.2026, п. 6): якщо заголовок або текст не вміщується — при наведенні показується повний текст
  (function () {
    var tip = null, cur = null, SEL = 'h1,h2,h3,h4,legend,th,td,label,.clip,.clip3,.sub,.tile span,.tile b,.kpi h3,.kpi .d,.nm,.tabs a,.chips-filter a,.pill,.tag,dt,dd,a';
    function over(el) { return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2; }
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest(SEL); if (!el || el === cur) return; cur = el;
      if (tip) { tip.remove(); tip = null; }
      if (el.hasAttribute('title') || !over(el)) return;
      var text = (el.innerText || '').trim(); if (!text || text.length < 4) return;
      tip = document.createElement('div'); tip.className = 'full-tip'; tip.textContent = text; document.body.appendChild(tip);
      var r = el.getBoundingClientRect(), w = Math.min(520, window.innerWidth - 24); tip.style.maxWidth = w + 'px';
      var left = Math.max(12, Math.min(r.left, window.innerWidth - tip.offsetWidth - 12)), top = r.bottom + 6;
      if (top + tip.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - tip.offsetHeight - 6);
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    });
    document.addEventListener('mouseout', function (e) { if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) { cur = null; if (tip) { tip.remove(); tip = null; } } });
    window.addEventListener('scroll', function () { if (tip) { tip.remove(); tip = null; cur = null; } }, true);
  })();
  A.initTabs = function () {
    document.querySelectorAll('[data-tabbar]').forEach(function (bar) {
      var g = bar.dataset.tabbar, links = bar.querySelectorAll('a[data-tab]');
      function show(id) {
        links.forEach(function (a) { a.classList.toggle('on', a.dataset.tab === id); });
        document.querySelectorAll('.tabpane[data-group="' + g + '"]').forEach(function (p) { p.classList.toggle('on', p.id === id); });
        window.ArmaCharts.render($app); A.afterRender.forEach(function (f) { try { f($app); } catch (e) { console.error(e); } });
      }
      links.forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); show(a.dataset.tab); }); });
      show(bar.dataset.start && bar.querySelector('a[data-tab="' + bar.dataset.start + '"]') ? bar.dataset.start : links[0].dataset.tab);   // картка завжди відкривається з першої вкладки
    });
  };
  // кошик обраних активів — зберігається між пошуками (масові дії над усіма обраними)
  A.basket = {
    get: function () { try { return JSON.parse(sessionStorage.getItem('basket') || '[]'); } catch (e) { return []; } },
    set: function (ids) { sessionStorage.setItem('basket', JSON.stringify(ids)); },
    has: function (id) { return A.basket.get().indexOf(id) >= 0; },
    toggle: function (id, on) { var b = A.basket.get(), i = b.indexOf(id); if (on && i < 0) b.push(id); if (!on && i >= 0) b.splice(i, 1); A.basket.set(b); }
  };
  A.initSel = function () {
    var all = document.querySelector('[data-select-all]'), boxes = document.querySelectorAll('input[data-row]');
    function upd() {
      var n = A.basket.get().length;
      document.querySelectorAll('[data-sel-count]').forEach(function (c) { c.textContent = n; });
      document.querySelectorAll('[data-need-sel]').forEach(function (b) { b.disabled = n === 0; });
    }
    boxes.forEach(function (b) { b.checked = A.basket.has(+b.value); b.addEventListener('change', function () { A.basket.toggle(+b.value, b.checked); upd(); }); });
    if (all) all.addEventListener('change', function () { boxes.forEach(function (b) { b.checked = all.checked; A.basket.toggle(+b.value, all.checked); }); upd(); });
    upd();
  };
  // v2.7: вибір місяця і року — «вертушка»: ▲▼ біля місяця і року, коліщатко миші над місяцем / роком, клавіші ↑↓ (місяць) і PgUp/PgDn (рік),
  // календар (кнопка 📅): рік зі стрілками і сітка 12 місяців. Значення — у прихованому полі name (YYYY-MM); data-auto — застосувати без кнопки.
  var MPN = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  A.monthPick = function (name, value, auto) {
    var m = String(value || A.today().slice(0, 7)).match(/^(\d{4})-(\d{2})/) || [0, A.today().slice(0, 4), A.today().slice(5, 7)];
    return '<span class="mpick" tabindex="0"' + (auto ? ' data-auto="1"' : '') + ' title="Коліщатко миші або ↑↓ — місяць; PgUp/PgDn — рік; 📅 — календар"><input type="hidden" name="' + esc(name) + '" value="' + m[1] + '-' + m[2] + '">' +
      '<span class="mp-part" data-p="m"><b>' + MPN[+m[2] - 1] + '</b><span class="mp-ar"><i data-d="1">▲</i><i data-d="-1">▼</i></span></span>' +
      '<span class="mp-part" data-p="y"><b>' + m[1] + '</b><span class="mp-ar"><i data-d="1">▲</i><i data-d="-1">▼</i></span></span><button type="button" class="mp-cal" aria-label="Календар">📅</button></span>';
  };
  function mpSet(el, y, mo, fire) {
    while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; }
    var inp = el.querySelector('input'); inp.value = y + '-' + ('0' + mo).slice(-2);
    el.querySelector('[data-p="m"] b').textContent = MPN[mo - 1]; el.querySelector('[data-p="y"] b').textContent = y;
    if (fire !== false) { inp.dispatchEvent(new Event('change', {bubbles: true})); var f = el.closest('form');
      if (el.dataset.auto && f) { clearTimeout(f._mpT); f._mpT = setTimeout(function () { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true})); }, 900); } }
  }
  function mpGet(el) { var v = el.querySelector('input').value.split('-'); return [+v[0], +v[1]]; }
  function mpCal(el) {
    document.querySelectorAll('.mp-pop').forEach(function (x) { x.remove(); });
    var cur = mpGet(el), y = cur[0], pop = document.createElement('div'); pop.className = 'mp-pop';
    function draw() { pop.innerHTML = '<div class="mp-yh"><button type="button" data-y="-1">◀</button><b>' + y + '</b><button type="button" data-y="1">▶</button></div><div class="mp-grid">' + MPN.map(function (n, i) { return '<button type="button" data-m="' + (i + 1) + '" class="' + (y === cur[0] && i + 1 === cur[1] ? 'on' : '') + '">' + n.slice(0, 3) + '</button>'; }).join('') + '</div>'; }
    draw(); document.body.appendChild(pop);
    var r = el.getBoundingClientRect(); pop.style.left = Math.min(r.left, innerWidth - 250) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
    pop.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; e.stopPropagation(); if (b.dataset.y) { y += +b.dataset.y; draw(); return; } mpSet(el, y, +b.dataset.m); pop.remove(); });
    pop.addEventListener('wheel', function (e) { e.preventDefault(); y += e.deltaY > 0 ? 1 : -1; draw(); }, {passive: false});
    setTimeout(function () { document.addEventListener('click', function off(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', off); } }); }, 0);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.mpick'); if (!el) return;
    var ar = e.target.closest('[data-d]'), c = mpGet(el);
    if (ar) { var p = ar.closest('[data-p]').dataset.p; mpSet(el, c[0] + (p === 'y' ? +ar.dataset.d : 0), c[1] + (p === 'm' ? +ar.dataset.d : 0)); return; }
    if (e.target.closest('.mp-cal')) { e.preventDefault(); mpCal(el); }
  });
  document.addEventListener('wheel', function (e) {
    var part = e.target.closest && e.target.closest('.mpick [data-p]'); if (!part) return; e.preventDefault();
    var el = part.closest('.mpick'), c = mpGet(el), d = e.deltaY < 0 ? 1 : -1;
    if (part.dataset.p === 'y' || e.shiftKey) mpSet(el, c[0] + d, c[1]); else mpSet(el, c[0], c[1] + d);
  }, {passive: false});
  document.addEventListener('keydown', function (e) {
    var el = e.target.closest && e.target.closest('.mpick'); if (!el) return; var c = mpGet(el);
    var k = {ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [0, 1], ArrowLeft: [0, -1], PageUp: [1, 0], PageDown: [-1, 0]}[e.key];
    if (k) { e.preventDefault(); mpSet(el, c[0] + k[0], c[1] + k[1]); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mpCal(el); }
  });
  A.initForms = function () {
    document.querySelectorAll('form[data-act]').forEach(function (f) { f.addEventListener('input', function () { f.classList.add('dirty'); }); });
    document.querySelectorAll('input[data-num]').forEach(function (x) { x.addEventListener('blur', function () { x.value = A.fmtIn(x.value); }); });
  };

  // ================================================================ маршрути
  var routes = [];
  A.on = function (re, fn) { routes.push([re, fn]); };
  A.params = function () { var q = location.hash.split('?')[1] || '', o = {}; q.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); o[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); }); return o; };
  A.route = function (keepScroll) {
    window.ArmaCharts.hideTip();
    document.querySelectorAll('.modal-bg').forEach(function (m) { if (!keepScroll) m.remove(); });
    var path = location.hash.slice(1).split('?')[0] || '/';
    if (!S.user && path !== '/login' && path.indexOf('/public') !== 0) { location.hash = '#/login'; return; }
    for (var i = 0; i < routes.length; i++) {
      var m = path.match(routes[i][0]);
      if (m) {
        try { A.keep = keepScroll === true; return routes[i][1].apply(null, m.slice(1).concat([A.params()])); }
        catch (e) { console.error(e); return A.render(A.shell('Помилка', '', '', '<div class="flash err">' + esc(e.message) + '</div>')); }
      }
    }
    A.render(A.shell('Сторінку не знайдено', '', '', '<div class="empty">Немає такої сторінки. <a href="#/">На головну</a></div>'));
  };
  A.go = function (h) { if (location.hash === h) A.route(); else location.hash = h; };
  A.deny = function () { A.render(A.shell('Недостатньо прав', '', '', '<div class="flash err">Ваша роль не має права на цю дію.</div>')); };
  A.notFound = function () { A.render(A.shell('Запис не знайдено', '', '', '<div class="empty">Запис не знайдено або його видалено. <a href="#/">На головну</a></div>')); };

  // ================================================================ дії форм і кнопок
  A.ACT = {}; A.CLICK = {};
  A.fd = function (form) { var o = {}, nums = {}; form.querySelectorAll('[data-num][name]').forEach(function (x) { nums[x.name] = 1; });
    new FormData(form).forEach(function (v, k) { if (v instanceof File) return; if (nums[k] && typeof v === 'string' && /^[\d\s.,\-]+$/.test(v.trim())) v = v.replace(/\s/g, '').replace(',', '.'); if (o[k] !== undefined) { if (!Array.isArray(o[k])) o[k] = [o[k]]; o[k].push(v); } else o[k] = v; }); return o; };
  A.arr = function (v) { return v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]; };
  document.addEventListener('submit', function (e) {
    var form = e.target, act = form.dataset.act; if (!act) return; e.preventDefault();
    var d = A.fd(form), btn = e.submitter; if (btn && btn.name) d[btn.name] = btn.value;
    var h = A.ACT[act]; if (!h) return;
    try { var r = h(form, d, btn); if (r && r.catch) r.catch(function (err) { A.toast(err.message, 'err'); }); } catch (err) { console.error(err); A.toast(err.message, 'err'); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-click]'); if (!t) return;
    var h = A.CLICK[t.dataset.click]; if (!h) return;
    e.preventDefault(); e.stopPropagation();
    if (t.dataset.confirm && !window.confirm(t.dataset.confirm)) return;
    try { var r = h(t, e); if (r && r.catch) r.catch(function (err) { A.toast(err.message, 'err'); }); } catch (err) { console.error(err); A.toast(err.message, 'err'); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.modal-bg,.lightbox').forEach(function (b) { b.remove(); }); });
  // «Скинути» — очищає пошук і всі фільтри панелі
  A.CLICK.reset = function (t) { var f = t.closest('form'); if (f) { f.reset(); f.querySelectorAll('input:not([type=hidden]),select').forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }); } A.go('#' + (t.dataset.base || '/')); };
  A.CLICK.back = function () { history.back(); };
})();
