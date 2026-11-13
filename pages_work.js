/* Пули активів, плани дій (CRM), судові рішення, оцінки, товариства (корпоративні права). */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S, dd = A.dd;
  function same(a, b) { return (a === null || a === undefined ? '' : String(a)) === (b === null || b === undefined ? '' : String(b)); }
  function words(q) { return (q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6); }
  function match(s, w) { s = s.toLowerCase(); return w.every(function (x) { return s.indexOf(x) >= 0; }); }
  function nos(text) { return (text || '').split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function diffPut(tx, t, old, rec, v) { var p = {id: old.id}, n = 0; Object.keys(rec).forEach(function (k) { if (k !== 'id' && !same(old[k], rec[k])) { p[k] = rec[k]; n++; } }); if (n) tx.put(t, p, v); return n; }
  function clean(d, numf) {
    var o = {}; Object.keys(d).forEach(function (k) { var v = typeof d[k] === 'string' ? d[k].trim() : d[k]; if (v === '') v = null;
      if (v !== null && numf && numf.indexOf(k) >= 0) { var n = A.parseNum(v); if (n === null) throw new Error('Поле «' + k + '»: потрібне число'); v = n; } o[k] = v; });
    return o;
  }
  function actionsBar(cancel, label) { return '<div class="form-actions"><a class="btn plain" href="' + cancel + '">Скасувати</a><button class="btn gold">' + esc(label || 'Зберегти') + '</button></div>'; }

  // ================================================================ пули
  A.poolAssets = function (p) { return (A.indexes.poolAssets[p.id] || []).filter(A.inScope); };
  A.poolSummary = function (p) {
    var as = A.indexes.poolAssets[p.id] || [], area = 0, ha = 0, val = 0, regions = {}, cats = {};
    as.forEach(function (a) { var d = a.details || {}; area += Number(d.area_sqm) || 0; ha += Number(d.area_ha) || 0; val += a.val_amount || 0; if (a.region) regions[a.region] = 1; cats[a.category] = (cats[a.category] || 0) + 1; });
    return {count: as.length, area: area, ha: ha, val: val, regions: Object.keys(regions), cats: cats};
  };
  // v2.10: розділ «Пули і складні активи» — повноцінний пошук, вибір і звіти XLSX за набором пулів або активів
  var poolSel = {};
  function poolPurpose(p) {
    if (p.mgmt_contract_id || p.transfer_way === 'manager_contract' || p.status === 'mgmt') return 'mgmt';
    if (p.transfer_way === 'realization' || (A.indexes.salesByPool && (A.indexes.salesByPool[p.id] || []).length)) return 'sale';
    return 'other';
  }
  var PURPOSE = [['mgmt', 'Договори управління'], ['sale', 'Реалізація'], ['other', 'Інші (пошук управителя, формування)']];
  A.poolsFilter = function (f) {
    var w = words(f.q), noRx = /^\d{1,7}\/\d{4}\/\d{4}$/;
    return A.T('pools').filter(function (p) {
      var as = A.indexes.poolAssets[p.id] || [];
      if (w.length) {
        var byNo = w.filter(function (x) { return noRx.test(x); }), txt = w.filter(function (x) { return !noRx.test(x); });
        if (byNo.length && !byNo.every(function (n) { return as.some(function (a) { return a.asset_no === n; }); })) return false;
        var c = p.mgmt_contract_id && A.get('mgmt_contracts', p.mgmt_contract_id), sl = (A.indexes.salesByPool && A.indexes.salesByPool[p.id]) || [];
        if (txt.length && !match([p.code, p.name, p.description, p.region, p.prozorro_id, p.court_basis, p.mgmt_contract, c ? c.manager_name + ' ' + A.contractCode(c) : '', sl.map(function (x) { return x.uid; }).join(' ')].join(' '), txt)) return false;
      }
      if (f.dept && (f.dept === '__none__' ? p.dept_code : p.dept_code !== f.dept)) return false;
      if (f.publish === '1' && !p.publish) return false; if (f.publish === '0' && p.publish) return false;
      if (f.way && p.transfer_way !== f.way) return false; if (f.category && p.category !== f.category) return false;
      if (f.kind === 'complex' && p.complexity !== 'complex') return false; if (f.kind === 'pool' && p.complexity === 'complex') return false;
      if (f.pstatus && (p.status || 'active') !== f.pstatus) return false; if (!f.pstatus && (p.status === 'closed') && !f.all) return false;
      if (f.purpose && poolPurpose(p) !== f.purpose) return false;
      if (f.contract && String(p.mgmt_contract_id || '') !== f.contract) return false;
      if (f.zone && !as.some(function (a) { return a.zone === f.zone; })) return false;
      if (f.mtu && !as.some(function (a) { return a.mtu_code === f.mtu; })) return false;
      if (f.region && p.region !== f.region && !as.some(function (a) { return a.region === f.region; })) return false;
      if (f.prio && !(A.indexes.bizByTarget ? ((A.indexes.salesByPool[p.id] || []).some(function (sl) { return (A.indexes.bizByTarget['sale:' + sl.id] || []).some(function (b) { return b.priority === f.prio; }); }) || (A.indexes.bizByTarget['pool:' + p.id] || []).some(function (b) { return b.priority === f.prio; })) : false)) return false;
      if (f.val === 'yes' && !p.val_amount) return false; if (f.val === 'no' && p.val_amount) return false;
      return true;
    }).sort(function (a, b) { return f.sort === 'size' ? (A.indexes.poolAssets[b.id] || []).length - (A.indexes.poolAssets[a.id] || []).length : f.sort === 'code' ? String(a.code).localeCompare(String(b.code)) : (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id; });
  };
  function poolTabs(f) {
    var t = f.tab === 'assets' ? 'assets' : 'pools';
    return '<div class="tabs" style="margin-bottom:12px"><a href="' + A.link('/pools', {}) + '"' + (t === 'pools' ? ' class="on"' : '') + '>Пули і складні активи (картки)</a><a href="' + A.link('/pools', {tab: 'assets', cxp: '1'}) + '"' + (t === 'assets' ? ' class="on"' : '') + '>Активи у пулах і складні активи</a></div>';
  }
  A.on(/^\/pools$/, function (f) {
    if (f.tab === 'assets') {   // активи у пулах / складні — фільтри Реєстру, масові дії, XLSX за фільтром
      var ff = Object.assign({}, f, {cxp: '1'}), list = A.filterAssets(ff), pg2 = A.pageOf(list, f), q2 = Object.assign({}, ff); delete q2.page;
      var h2 = poolTabs(f) + A.filtersForm(ff, '/pools', null, '/pools?tab=assets&cxp=1') + '<p class="mini">Знайдено активів: <b>' + A.num(list.length) + '</b> (у пулах, складні активи / ЄМК).</p>' + A.pager(list.length, pg2.page, '/pools', q2) + A.assetTable(pg2.rows) + A.pager(list.length, pg2.page, '/pools', q2);
      return A.render(A.shell('Пули і складні активи', 'Активи, що входять до пулів, і складні активи (ЄМК). Пошук і фільтри — як у Реєстрі; обрані активи — для звіту або масових дій',
        (A.can('export') ? '<a class="btn" href="#" data-click="xlsx-assets" data-q="' + esc(JSON.stringify(ff)) + '">XLSX за фільтром</a><a class="btn" href="#" data-click="xlsx-basket">XLSX обраних активів</a>' : ''), h2), A.keep);
    }
    var list = A.poolsFilter(f), pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    var nAs = list.reduce(function (s, p) { return s + (A.indexes.poolAssets[p.id] || []).length; }, 0), nSel = Object.keys(poolSel).length;
    var h = poolTabs(f) + '<form class="filters" data-act="filter" data-base="/pools"><input name="q" value="' + esc(f.q || '') + '" placeholder="Код, назва, опис, область, Prozorro, № договору / управитель, № лоту, № активу у пулі" style="flex:1;min-width:300px">' +
      A.sel('purpose', PURPOSE, f.purpose, 'Призначення') + A.sel('kind', [['complex', 'Складні активи (ЄМК)'], ['pool', 'Пули']], f.kind, 'Пули і складні активи') + A.sel('dept', A.OPT.DEPT.concat([['__none__', 'Не закріплено']]), f.dept, 'Усі відділи ДМА') + A.sel('category', A.OPT.CAT, f.category, 'Усі категорії') +
      '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/pools">Скинути все</button>' +
      '<details style="width:100%"' + (f.zone || f.mtu || f.contract || f.way || f.publish || f.pstatus || f.region || f.prio || f.val || f.sort ? ' open' : '') + '><summary class="mini" style="cursor:pointer;margin:4px 0 8px">Додаткові фільтри</summary><div class="filters" style="margin:0">' +
      A.sel('zone', D.ZONES, f.zone, 'Зона активів') + A.sel('mtu', A.OPT.MTU, f.mtu, 'МТУ активів') + A.sel('region', D.REGIONS, f.region, 'Область') +
      (A.contractOptions ? A.sel('contract', A.T('mgmt_contracts').map(function (c) { return [String(c.id), A.contractCode(c) + ' — ' + (c.manager_name || '').slice(0, 40)]; }), f.contract, 'Договір управління') : '') +
      A.sel('prio', [['0', 'У процесі реалізації'], ['I', 'I — пріоритетні 2026'], ['II', 'II — 2026–2027'], ['III', 'III — не пріоритетні'], ['IV', 'IV — безперспективні']], f.prio, 'Пріоритет реалізації') +
      A.sel('way', D.TRANSFER_WAYS, f.way, 'Спосіб передачі') + A.sel('val', [['yes', 'Є оцінка'], ['no', 'Немає оцінки']], f.val, 'Оцінка') + A.sel('publish', [['1', 'Опубліковані'], ['0', 'Не опубліковані']], f.publish, 'Публікація') +
      A.sel('pstatus', D.POOL_STATUS.map(function (x) { return [x[0], x[1].split(' — ')[0]]; }), f.pstatus, 'Стан (крім закритих)') + A.sel('sort', [['code', 'за кодом'], ['size', 'за кількістю активів']], f.sort, 'Сортування: нові') + '</div></details></form>' +
      '<div class="grid g4">' + A.kpi('Пулів і складних активів', A.num(list.length), 'за умовами пошуку') + A.kpi('Активів у них', A.num(nAs), '') +
      A.kpi('Договори управління', A.num(list.filter(function (p) { return poolPurpose(p) === 'mgmt'; }).length), 'пулів «ДУ-…» і пулів з договором') + A.kpi('Реалізація', A.num(list.filter(function (p) { return poolPurpose(p) === 'sale'; }).length), 'пули реалізації і лоти') + '</div>' +
      '<div class="sel-bar" style="margin-top:12px"><span class="mini">Обрано пулів: <b data-psel>' + nSel + '</b></span><button type="button" class="btn sm plain" data-click="pools-sel-page">Обрати всі на сторінці</button><button type="button" class="btn sm plain" data-click="pools-sel-clear">Очистити вибір</button>' +
      (A.can('export') ? '<button type="button" class="btn sm gold" data-click="pools-xlsx" data-mode="sel">XLSX: обрані пули + їх активи</button><button type="button" class="btn sm" data-click="pools-xlsx" data-mode="filter" data-q="' + esc(JSON.stringify(q)) + '">XLSX: усі за фільтром</button>' : '') + '</div>' +
      A.pager(list.length, pg.page, '/pools', q) + '<div class="wrap-tbl"><table><thead><tr><th style="width:26px"></th><th>Код</th><th>Назва</th><th class="num">Активів</th><th>Відділ ДМА</th><th>Договір / лот</th><th>Спосіб передачі</th><th class="num">Оцінка</th><th>План дій</th><th>Сайт</th></tr></thead><tbody>' +
      pg.rows.map(function (p) { var n = (A.indexes.poolAssets[p.id] || []).length, pl = A.plansOf('pool', p.id).filter(function (x) { return x.status === 'active'; })[0], c = p.mgmt_contract_id && A.get('mgmt_contracts', p.mgmt_contract_id), sl = (A.indexes.salesByPool && A.indexes.salesByPool[p.id]) || [];
        return '<tr><td><input type="checkbox" data-pool-sel value="' + p.id + '"' + (poolSel[p.id] ? ' checked' : '') + ' style="width:auto"></td><td class="nowrap"><a class="id" href="#/pool/' + p.id + '">' + esc(p.code) + '</a><span class="sub">' + (p.complexity === 'complex' ? 'складний актив' : 'пул') + '</span></td><td style="max-width:400px"><span class="clip" title="' + esc(p.name) + '">' + esc(p.name || '') + '</span><span class="sub">' + esc(N.CAT[p.category] || '') + (p.region ? ' · ' + esc(p.region) : '') + '</span></td><td class="num">' + n + '</td>' +
          '<td class="mini">' + esc(N.DMA_SHORT[p.dept_code] || '—') + (p.dma_manager ? '<br>' + esc(p.dma_manager) : '') + '<span class="sub">' + esc((A.map(D.POOL_STATUS)[p.status || 'active'] || p.status || '').split(' — ')[0]) + '</span></td>' +
          '<td class="mini">' + (c ? '<a href="#/contract/' + c.id + '">' + esc(A.contractCode(c)) + '</a><span class="sub">' + esc((c.manager_name || '').slice(0, 40)) + '</span>' : '') + sl.map(function (x) { return '<a href="#/sale/' + x.id + '">' + esc(x.uid) + '</a>'; }).join(' ') + (!c && !sl.length ? '—' : '') + '</td>' +
          '<td class="mini">' + esc(N.WAY[p.transfer_way] || '—') + '</td><td class="num">' + (p.val_amount ? A.money(p.val_amount) : '—') + '</td>' +
          '<td class="mini">' + (pl ? esc(N.PROC[pl.process]) : '—') + '</td><td>' + (p.publish ? '<span class="tag t-gold">опубліковано</span>' : '') + (p.prozorro_id ? ' ' + A.prozorroBtn(p) : '') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="10"><div class="empty">Пулів не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/pools', q);
    A.render(A.shell('Пули і складні активи', 'Складний актив — об’єкти одного єдиного майнового комплексу (ЄМК) або скомпоновані активи договору управління («ДУ-…»); пул — активи, об’єднані за функціональною ознакою або для реалізації («ПУЛ-ПР-…»). Спільна оцінка, план дій і публікація', A.can('manage_pools') ? '<a class="btn gold" href="#/pool/new?kind=complex">+ Складний актив (ЄМК)</a><a class="btn" href="#/pool/new">+ Новий пул</a>' : '', h), A.keep);
    document.querySelectorAll('[data-pool-sel]').forEach(function (b) { b.addEventListener('change', function () { if (b.checked) poolSel[b.value] = 1; else delete poolSel[b.value]; var e = document.querySelector('[data-psel]'); if (e) e.textContent = Object.keys(poolSel).length; }); });
  });
  A.CLICK['pools-sel-page'] = function () { document.querySelectorAll('[data-pool-sel]').forEach(function (b) { b.checked = true; poolSel[b.value] = 1; }); var e = document.querySelector('[data-psel]'); if (e) e.textContent = Object.keys(poolSel).length; };
  A.CLICK['pools-sel-clear'] = function () { poolSel = {}; A.route(true); };
  A.CLICK['pools-xlsx'] = function (t) {
    if (!A.can('export')) return A.deny();
    var ps = t.dataset.mode === 'sel' ? Object.keys(poolSel).map(function (i) { return A.get('pools', +i); }).filter(Boolean) : A.poolsFilter(A.json(t.dataset.q, {}));
    if (!ps.length) return A.toast('Оберіть пули (позначки зліва) або скористайтеся «XLSX: усі за фільтром»', 'err');
    var C = A.ASSET_COLS || [], as = [];
    ps.forEach(function (p) { (A.indexes.poolAssets[p.id] || []).forEach(function (a) { as.push([p, a]); }); });
    var zones = function (p) { var o = {}; (A.indexes.poolAssets[p.id] || []).forEach(function (a) { o[a.zone || '—'] = (o[a.zone || '—'] || 0) + 1; }); return Object.keys(o).map(function (k) { return k.replace(' зона', '') + ': ' + o[k]; }).join('; '); };
    var prio = function (p) { var r = []; ((A.indexes.salesByPool || {})[p.id] || []).forEach(function (sl) { (A.indexes.bizByTarget['sale:' + sl.id] || []).forEach(function (b) { if (b.priority) r.push(b.priority); }); }); (A.indexes.bizByTarget['pool:' + p.id] || []).forEach(function (b) { if (b.priority) r.push(b.priority); }); return r.join(', ') || null; };
    return A.xl('Пули_і_складні_активи', [
      {name: 'Пули', title: 'Пули і складні активи · ' + (t.dataset.mode === 'sel' ? 'обрані' : 'за фільтром') + ' · ' + A.dt(A.today()) + ' · пулів: ' + ps.length + ', активів: ' + as.length,
        cols: [['Код', 18], ['Назва', 60], ['Вид', 14], ['Призначення', 18], ['Категорія', 16], ['Активів', 9], ['Зони активів', 30], ['Відділ ДМА', 24], ['Менеджер ДМА', 22], ['Спосіб передачі', 22], ['Стан', 18], ['Договір управління', 20], ['Управитель', 30], ['Лот реалізації', 16], ['Стан реалізації', 18], ['Пріоритет реалізації', 10], ['Оцінка, грн', 16], ['Дата оцінки', 12], ['Очікуваний дохід на рік, грн', 16], ['Область', 16], ['Підстава (судове рішення)', 50], ['Джерело', 30]].map(function (c) { return {h: c[0], w: c[1]}; }),
        rows: ps.map(function (p) { var c = p.mgmt_contract_id && A.get('mgmt_contracts', p.mgmt_contract_id), sl = (A.indexes.salesByPool || {})[p.id] || [];
          return [p.code, p.name, p.complexity === 'complex' ? 'складний актив' : 'пул', A.map(PURPOSE)[poolPurpose(p)], N.CAT[p.category] || null, (A.indexes.poolAssets[p.id] || []).length, zones(p), N.DMA[p.dept_code] || null, p.dma_manager || null, N.WAY[p.transfer_way] || null,
            (A.map(D.POOL_STATUS)[p.status || 'active'] || '').split(' — ')[0], c ? A.contractCode(c) : (p.mgmt_contract || null), c ? c.manager_name : null, sl.map(function (x) { return x.uid; }).join(', ') || null, sl.map(function (x) { return x.status; }).join(', ') || null, prio(p),
            p.val_amount || null, p.val_date ? A.dt(p.val_date) : null, p.expected_income_year || null, p.region || null, p.court_basis || null, p.source || null]; })},
      {name: 'Активи', title: 'Активи обраних пулів і складних активів', cols: [{h: 'Код пулу', w: 18}].concat(C.map(function (c) { return {h: c[0], w: c[1]}; })),
        rows: as.map(function (x) { return [x[0].code].concat(C.map(function (c) { var v = c[2](x[1]); return v === '—' ? null : v; })); })}]);
  };
  A.CLICK['xlsx-basket'] = function () {
    var ids = A.basket.get(); if (!ids.length) return A.toast('Оберіть активи позначками в таблиці', 'err');
    var C = A.ASSET_COLS || [], list = ids.map(function (i) { return A.get('assets', i); }).filter(Boolean);
    return A.xl('Обрані_активи', [{name: 'Активи', title: 'Обрані активи · ' + A.dt(A.today()) + ' · записів: ' + list.length, cols: C.map(function (c) { return {h: c[0], w: c[1]}; }), rows: list.map(function (a) { return C.map(function (c) { var v = c[2](a); return v === '—' ? null : v; }); })}]);
  };
  function poolForm(p, isNew, ids) {
    var F = A.field, S2 = A.fsel, mg = A.users(function (u) { return u.dept_code; });
    return '<form data-act="pool-save" data-id="' + (p.id || '') + '" data-ids="' + esc((ids || []).join(',')) + '"><fieldset><legend>Пул</legend><div class="form-grid">' +
      F('Код пулу', 'code', p.code, 'text', 1, 'наприклад, П-2026-015') + F('Назва', 'name', p.name, 'text', 1, '', 'wide') + S2('Складність', 'complexity', D.COMPLEXITY, p.complexity || 'pool') + S2(A.KIND_LABEL, 'report_kind', D.REPORT_KINDS, p.report_kind, 0, A.KIND_HINT) +
      S2('Категорія', 'category', A.OPT.CAT, p.category) + S2('Область', 'region', D.REGIONS, p.region) + S2('Відділ ДМА', 'dept_code', A.OPT.DEPT, p.dept_code) +
      S2('Менеджер-куратор', 'dma_manager_id', mg.map(function (u) { return [u.id, u.full_name + ' — ' + (N.DMA_SHORT[u.dept_code] || '')]; }), p.dma_manager_id) + S2('Спосіб передачі', 'transfer_way', D.TRANSFER_WAYS, p.transfer_way) +
      S2('Інвестиційна привабливість', 'invest_grade', D.INVEST_GRADES, p.invest_grade) + F('Підстава (судове рішення)', 'court_basis', p.court_basis, 'text', 0, '', 'wide') + F('Опис пулу', 'description', p.description, 'textarea', 0, '', 'wide') +
      F('Очікуваний дохід / міс., грн', 'expected_income_month', p.expected_income_month) + F('Очікуваний дохід / рік, грн', 'expected_income_year', p.expected_income_year) + F('Стан орієнтовного плану управління', 'mgmt_plan_status', p.mgmt_plan_status, 'text', 0, 'напр., Розробляється / Погоджено / Затверджено') +
      F('Дата плану управління', 'mgmt_plan_date', p.mgmt_plan_date, 'date') + F('Закупівля / конкурс', 'procurement_info', p.procurement_info) + F('Договір управління', 'mgmt_contract', p.mgmt_contract) + S2('Стан пулу', 'status', D.POOL_STATUS, p.status || 'active', 0, 'Впливає на фільтр «Стан» у переліку, лічильники огляду портфеля (закриті не враховуються) і звіти; змінюється вручну за перебігом робіт') +
      F('Ідентифікатор лоту Prozorro', 'prozorro_id', p.prozorro_id) + F('Посилання на лот Prozorro', 'prozorro_url', p.prozorro_url, 'url', 0, '', 'wide') + '</div></fieldset>' +
      '<fieldset' + (A.can('manage_public') ? '' : ' disabled') + '><legend>Публічний сайт — зведена картка пулу</legend><p class="mini" style="margin-top:0">На сайті публікується пул як єдиний лот: характеристики, фото активів і контакти. Окремі активи пулу на сайті не показуються.</p><div class="form-grid">' +
      F('Заголовок на сайті', 'public_title', p.public_title, 'text', 0, '', 'wide') + F('Опис на сайті', 'public_description', p.public_description, 'textarea', 0, 'без персональних даних', 'wide') + F('Відео YouTube', 'video_urls', p.video_urls, 'textarea', 0, 'посилання на відео YouTube, кожне з нового рядка', 'wide') +
      F('Підрозділ для звернень', 'public_dept', p.public_dept) + F('Телефон', 'public_phone', p.public_phone) + F('E-mail', 'public_email', p.public_email, 'email') + S2('Опублікувати', 'publish', [['0', 'Ні'], ['1', 'Так']], p.publish ? '1' : '0', 0, '', '', '', null) + '</div></fieldset>' +
      (isNew ? '<fieldset><legend>Активи пулу</legend><div class="form-grid">' + F('Номери активів у Реєстрі', 'asset_nos', '', 'textarea', 0, 'Оберіть з Реєстру (пошук і фільтри, зокрема № справи, провадження, ЄРДР) або введіть через кому, пробіл чи з нового рядка' + (ids && ids.length ? '. Обрано в реєстрі: ' + ids.length : ''), 'wide') + '<div class="field"><label>&nbsp;</label><button type="button" class="btn" data-click="pick" data-into="asset_nos" data-multi="1">🔎 Обрати з Реєстру</button></div></div></fieldset>' : '') +
      actionsBar(isNew ? '#/pools' : '#/pool/' + p.id, isNew ? 'Створити пул' : 'Зберегти') + '</form>';
  }
  A.on(/^\/pool\/new$/, function (f) {
    if (!A.can('manage_pools')) return A.deny();
    var cx = f.kind === 'complex', pre = cx ? 'СА-' : 'П-', ids = (f.ids || '').split(',').filter(Boolean).map(Number), y = new Date().getFullYear(), n = A.T('pools').filter(function (p) { return (p.code || '').indexOf(pre + y) === 0; }).length + 1;
    var first = ids.length && A.get('assets', ids[0]);
    A.render(A.shell(cx ? 'Новий складний актив (єдиний майновий комплекс, ЄМК)' : 'Новий пул активів', (cx ? 'Об’єкти одного ЄМК, що управляються як один актив · ' : 'Об’єднання активів за функціональною ознакою · ') + (ids.length ? 'обрано в реєстрі: ' + ids.length : ''), '', poolForm({code: pre + y + '-' + ('00' + n).slice(-3), complexity: cx ? 'complex' : 'pool', dept_code: (first && first.dept_code) || (S.user && S.user.dept_code), category: first && first.category, region: first && first.region}, true, ids)));
  });
  A.on(/^\/pool\/(\d+)\/edit$/, function (id) { var p = A.get('pools', +id); if (!p) return A.notFound(); if (!A.can('manage_pools') && !A.can('manage_public')) return A.deny(); A.render(A.shell('Редагування пулу ' + p.code, p.name || '', '', poolForm(p, false))); });
  A.ACT['pool-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('pools', +form.dataset.id), rec = clean(d, ['expected_income_month', 'expected_income_year']), assetNos = rec.asset_nos; delete rec.asset_nos;
    if (!rec.code || !rec.name) throw new Error('Вкажіть код і назву пулу');
    if (A.T('pools').some(function (p) { return p.code === rec.code && p.id !== old.id; })) throw new Error('Пул з кодом ' + rec.code + ' уже існує');
    if ('dma_manager_id' in rec) { rec.dma_manager_id = rec.dma_manager_id ? +rec.dma_manager_id : null; var u = rec.dma_manager_id && A.get('users', rec.dma_manager_id); rec.dma_manager = u ? u.full_name : null; }
    if ('publish' in rec) rec.publish = +rec.publish || 0;
    var tx = A.tx(), pid;
    if (isNew) { pid = A.tmpId(); rec.id = pid; rec.source = 'Створено в системі'; tx.put('pools', rec); }
    else { pid = old.id; diffPut(tx, 'pools', old, rec); }
    var ids = (form.dataset.ids || '').split(',').filter(Boolean).map(Number), miss = [];
    nos(assetNos).forEach(function (no) { var a = A.indexes.byNo[no]; if (a) ids.push(a.id); else miss.push(no); });
    var seen = {}; ids.forEach(function (i) { if (seen[i]) return; seen[i] = 1; var a = A.get('assets', i); if (a && a.pool_id !== pid) tx.put('assets', {id: a.id, pool_id: pid, complexity: rec.complexity === 'complex' ? 'complex' : 'pool'}, a.updated_at); });
    tx.log(isNew ? 'Створено пул' : 'Змінено пул', 'pool', isNew ? null : pid, {code: rec.code, assets: Object.keys(seen).length});
    return tx.commit().then(function (r) { if (miss.length) A.toast('Не знайдено активів: ' + miss.join(', '), 'err'); if (isNew) A.basket.set([]); A.toast(isNew ? 'Пул створено' : 'Пул збережено'); A.go('#/pool/' + r.id('pools', pid)); });
  };
  A.on(/^\/pool\/(\d+)$/, function (id) {
    var p = A.get('pools', +id); if (!p) return A.notFound();
    A.loadMedia();
    var as = A.poolAssets(p), ed = A.can('manage_pools'), sm = A.poolSummary(p), lg = A.grp(as, 'legal_status');
    var act = (ed || A.can('manage_public') ? '<a class="btn gold" href="#/pool/' + p.id + '/edit">Редагувати пул</a>' : '') + (A.can('edit_valuations') ? '<a class="btn" href="' + A.link('/valuation/new', {tt: 'pool', tid: p.id}) + '">+ Оцінка пулу</a>' : '') +
      (A.can('export') ? '<a class="btn" href="#" data-click="xlsx-assets" data-q="' + esc(JSON.stringify({pool: String(p.id)})) + '">XLSX активів пулу</a>' : '') + (A.can('delete_records') ? '<button class="btn danger" data-click="pool-del" data-id="' + p.id + '" data-confirm="Видалити пул? Активи залишаться в реєстрі без пулу.">Видалити</button>' : '') + '<a class="btn plain" href="#/pools">До пулів</a>';
    var h = '<div class="grid g4">' + A.kpi('Активів у пулі', A.num(sm.count), lg.map(function (x) { return (N.LS[x[0]] || x[0]) + ': ' + x[1]; }).join(' · ')) +
      A.kpi('Оцінка пулу', p.val_amount ? A.money(p.val_amount) : '—', p.val_date ? 'станом на ' + A.dt(p.val_date) : 'оцінки немає') + A.kpi('Очікуваний дохід', p.expected_income_year ? A.money(p.expected_income_year) : '—', 'на рік') +
      A.kpi('Орієнтовний план управління', esc(p.mgmt_plan_status || 'Не розроблено'), p.mgmt_plan_date ? A.dt(p.mgmt_plan_date) : '') + '</div>';
    if (A.mgmtLinks) h += A.mgmtLinks('pool', p);
    h += '<div class="tabs" data-tabbar="pool" style="margin-top:14px"><a href="#" data-tab="p-info">Відомості</a><a href="#" data-tab="p-assets">Активи <span class="pill">' + as.length + '</span></a><a href="#" data-tab="p-plan">План дій</a><a href="#" data-tab="p-val">Оцінки</a><a href="#" data-tab="p-docs">Документи</a><a href="#" data-tab="p-pub">Публікація і досьє</a></div>';
    h += '<div class="tabpane" id="p-info" data-group="pool"><div class="panel"><dl class="kv">' + dd('Код пулу', '<span class="mono">' + esc(p.code) + '</span>', true) + dd('Назва', p.name) +
      dd('Категорія / вид', [N.CAT[p.category], N.KIND[p.report_kind], N.CX[p.complexity]].filter(Boolean).join(' · ')) + dd('Область', p.region || sm.regions.join(', ')) + dd('Відділ ДМА', N.DMA[p.dept_code] || 'Не закріплено') + dd('Менеджер-куратор', p.dma_manager || '—') +
      dd('Інвестиційна привабливість', A.invest(p.invest_grade), true) + dd('Спосіб передачі', N.WAY[p.transfer_way] || '—') + dd('Підстава (судове рішення)', p.court_basis || '—') + dd('Опис', p.description || '—') +
      dd('Стан пулу', A.map(D.POOL_STATUS)[p.status || 'active'] || p.status) + dd('Закупівля / конкурс', p.procurement_info) + dd('Договір управління', p.mgmt_contract) + dd('Prozorro.Продажі', A.prozorroBtn(p), true) + dd('Джерело', (p.source || '—') + ' · створено ' + (p.created_at || '—') + (p.created_by ? ' · ' + p.created_by : '')) + '</dl></div></div>';
    h += '<div class="tabpane" id="p-assets" data-group="pool"><form data-act="pool-assets" data-id="' + p.id + '"><div class="wrap-tbl"><table><thead><tr>' + (ed ? '<th style="width:26px"></th>' : '') + '<th>№ активу</th><th>Найменування</th><th>Регіон / МТУ</th><th>Правовий стан</th><th class="num">Оцінка</th><th class="num">Фото</th></tr></thead><tbody>' +
      as.map(function (a) { return '<tr>' + (ed ? '<td><input type="checkbox" name="rm" value="' + a.id + '" style="width:auto"></td>' : '') + '<td class="nowrap"><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a><span class="sub">' + A.zone(a.zone, true) + '</span></td><td><span class="clip" title="' + esc(a.name) + '">' + esc(a.name || '') + '</span><span class="sub">' + esc(N.CAT[a.category] || '') + '</span></td>' +
        '<td class="mini">' + esc(a.region || '—') + '<br>' + esc(N.MTU[a.mtu_code] || '') + '</td><td>' + A.legal(a.legal_status) + '</td><td class="num">' + (a.val_amount ? A.money(a.val_amount) : '—') + '</td><td class="num">' + (a.photo_count || '—') + '</td></tr>'; }).join('') +
      (as.length ? '' : '<tr><td colspan="7"><div class="empty">У пулі немає активів (або вони поза вашою зоною видимості).</div></td></tr>') + '</tbody></table></div>' +
      (ed ? '<div class="sel-bar"><button type="button" class="btn gold" data-click="pick" data-into="asset_nos" data-multi="1">🔎 Обрати з Реєстру</button><input name="asset_nos" placeholder="або номери через кому: 123/0102/2024, …" style="flex:1;min-width:260px"><button class="btn" name="do" value="add">Додати</button><button class="btn danger" name="do" value="remove">Вилучити позначені</button></div>' : '') + '</form></div>';
    h += '<div class="tabpane" id="p-plan" data-group="pool">' + A.planBlock('pool', p.id, ed || A.can('crm_edit'), p.dept_code) + '</div>';
    h += '<div class="tabpane" id="p-val" data-group="pool"><div class="panel"><h3>Оцінки пулу</h3>' + A.valTable(A.valRows('pool', p.id)) + '</div></div>';
    h += '<div class="tabpane" id="p-docs" data-group="pool">' + A.docsBlock('pool', p.id, ed, ['mgmt_plan', 'valuation_report', 'mgmt_contract', 'lease_contract', 'storage_contract', 'court_scan', 'registry_extract', 'ident_conclusion', 'other']) + '<div style="margin-top:12px">' + A.photosBlock('pool', p.id, ed) + '</div></div>';
    var cats = Object.keys(sm.cats).map(function (c) { return (N.CAT[c] || c) + ': ' + sm.cats[c]; }).join(', '), photos = as.reduce(function (s, a) { return s + (a.photo_count || 0); }, 0) + A.filesOf('pool', p.id).filter(function (l) { return l.doc_type === 'photo'; }).length;
    h += '<div class="tabpane" id="p-pub" data-group="pool"><div class="panel"><h3>Зведена картка пулу для публічного сайту ' + (p.publish ? '<span class="tag t-gold">опубліковано</span>' : '<span class="tag t-unk">не опубліковано</span>') + '</h3><dl class="kv">' +
      dd('Заголовок', p.public_title || p.name) + dd('Опис', p.public_description || p.description) + dd('Склад', sm.count + ' активів · ' + cats) + (sm.area ? dd('Загальна площа будівель', A.num(sm.area, 1) + ' м²') : '') + (sm.ha ? dd('Площа земельних ділянок', A.num(sm.ha, 4) + ' га') : '') +
      dd('Області', sm.regions.join(', ')) + dd('Фото для сайту', photos + ' (фото пулу та фото активів у складі)') + dd('Контакти', [p.public_dept, p.public_phone, p.public_email].filter(Boolean).join(' · ') || 'не вказано — будуть загальні контакти АРМА') + dd('Prozorro', A.prozorroBtn(p), true) + '</dl>' +
      (A.can('manage_public') ? '<p><button class="btn ' + (p.publish ? 'plain' : 'gold') + '" data-click="pool-publish" data-id="' + p.id + '" data-v="' + (p.publish ? 0 : 1) + '">' + (p.publish ? 'Зняти з публікації' : 'Опублікувати пул') + '</button></p>' : '') + A.pubReqBlock('pool', p, A.can('manage_pools')) + '</div>' + A.dossierBlock('pool', p, A.can('manage_pools')) + '</div>';
    A.render(A.shell((p.complexity === 'complex' ? 'Складний актив ' : 'Пул ') + p.code, p.name || '', act, h), A.keep);
  });
  A.ACT['pool-assets'] = function (f, d, btn) {
    var p = A.get('pools', +f.dataset.id), tx = A.tx(), n = 0;
    if (d.do === 'add') { nos(d.asset_nos).forEach(function (no) { var a = A.indexes.byNo[no]; if (a && a.pool_id !== p.id) { tx.put('assets', {id: a.id, pool_id: p.id}, a.updated_at); n++; } }); }
    else A.arr(d.rm).forEach(function (i) { var a = A.get('assets', +i); if (a) { tx.put('assets', {id: a.id, pool_id: null}, a.updated_at); n++; } });
    if (!n) return A.toast('Немає змін (перевірте номери або позначки)', 'err');
    tx.log(d.do === 'add' ? 'Додано активи до пулу' : 'Вилучено активи з пулу', 'pool', p.id, {count: n});
    return tx.commit().then(function () { A.toast('Оновлено активів: ' + n); A.route(true); });
  };
  A.CLICK['pool-publish'] = function (t) { var p = A.get('pools', +t.dataset.id), tx = A.tx(); tx.put('pools', {id: p.id, publish: +t.dataset.v}); tx.log(+t.dataset.v ? 'Пул опубліковано' : 'Пул знято з публікації', 'pool', p.id); return tx.commit().then(function () { A.route(true); }); };
  A.CLICK['pool-del'] = function (t) { var tx = A.tx(); tx.del('pools', +t.dataset.id); tx.log('Видалено пул', 'pool', +t.dataset.id); return tx.commit().then(function () { A.go('#/pools'); }); };

  // ================================================================ плани дій
  A.targetOf = function (tt, id) {
    if (tt === 'asset') { var a = A.get('assets', id); return a ? {href: '#/asset/' + a.id, code: a.asset_no, name: a.name, rec: a} : null; }
    if (tt === 'pool') { var p = A.get('pools', id); return p ? {href: '#/pool/' + p.id, code: p.code, name: p.name, rec: p} : null; }
    if (tt === 'ident') { var r = A.get('ident_records', id); return r ? {href: '#/ident/' + r.id, code: 'Ідент. ' + (r.row_no ? 'р. ' + r.row_no : '#' + r.id), name: r.asset_desc, rec: r} : null; }
    if (tt === 'ident_appeal') { var ap = A.get('ident_appeals', id); return ap ? {href: '#/ident/appeal/' + ap.id, code: 'Звернення ' + (ap.seq || ap.id), name: (ap.reg_no ? '№ ' + ap.reg_no + ' · ' : '') + (N.IBODY ? N.IBODY[ap.body] || '' : ''), rec: ap} : null; }
    if (tt === 'ident_group') { var g = A.get('ident_groups', id); return g ? {href: '#/ident/group/' + g.id, code: g.code, name: g.name, rec: g} : null; }
    return null;
  };
  A.on(/^\/plans$/, function (f) {
    var t = A.today(), rows = [];
    A.T('plans').forEach(function (p) {
      if (f.process && p.process !== f.process) return; if (f.dept && p.dept_code !== f.dept) return; if ((f.status || 'active') !== 'all' && p.status !== (f.status || 'active')) return; if (p.status === 'cancelled' && !(f.status === 'cancelled' && A.canCancelPlan())) return;   // v2.7: скасовані плани зі сторінки зникають
      var tg = A.targetOf(p.target_type, p.target_id); if (!tg) return; if (p.target_type === 'asset' && !A.inScope(tg.rec)) return;
      if (f.mine && !(S.user && (p.manager_id === S.user.id || p.created_by === S.user.login))) return;
      var steps = A.indexes.stepsByPlan[p.id] || [], cur = steps.filter(function (s) { return s.status === 'active' || s.status === 'review'; });
      if (f.step && !cur.some(function (s) { return String(s.ord) === f.step; })) return;
      var over = cur.some(function (s) { return s.due_date && s.due_date < t; }), rev = cur.some(function (s) { return s.status === 'review'; });
      if (f.state === 'overdue' && !over) return; if (f.state === 'review' && !rev) return;
      rows.push({p: p, tg: tg, cur: cur, over: over, done: steps.filter(function (s) { return s.status === 'done' || s.status === 'skipped'; }).length, total: steps.length});
    });
    rows.sort(function (a, b) { return (b.over - a.over) || (b.p.id - a.p.id); });
    var pg = A.pageOf(rows, f), q = Object.assign({}, f); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="/plans">' + A.sel('process', D.PROCESSES.map(function (p) { return [p[0], p[1]]; }), f.process, 'Усі процеси') + A.sel('dept', A.OPT.DEPT, f.dept, 'Усі відділи') +
      A.sel('state', [['overdue', 'Є прострочені кроки'], ['review', 'Очікують підтвердження']], f.state, 'Стан кроків') + A.sel('status', [['active', 'Діючі'], ['done', 'Завершені'], ].concat(A.canCancelPlan() ? [['cancelled', 'Скасовані (архів)']] : []).concat([['all', 'Усі']]), f.status || 'active', null) +
      A.sel('mine', [['1', 'Мої плани']], f.mine, 'Усі менеджери') + (f.step ? '<input type="hidden" name="step" value="' + esc(f.step) + '">' : '') + '<button class="btn">Показати</button><button type="button" class="btn plain" data-click="reset" data-base="/plans">Скинути все</button></form>' +
      (f.step && f.process ? '<div class="flash info">Крок ' + esc(f.step) + ': ' + esc(((N.STEPS[f.process] || [])[+f.step - 1] || [])[0] || '') + '</div>' : '') + A.pager(rows.length, pg.page, '/plans', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Об’єкт</th><th>Процес</th><th>Поточні кроки</th><th>Строк</th><th>Прогрес</th><th>Відповідальні</th></tr></thead><tbody>' + pg.rows.map(function (r) {
        return '<tr><td style="max-width:320px"><a class="id" href="' + r.tg.href + '">' + esc(r.tg.code) + '</a><span class="sub clip" title="' + esc(r.tg.name) + '">' + esc((r.tg.name || '').slice(0, 90)) + '</span></td><td class="mini">' + esc(N.PROC[r.p.process]) + '</td>' +
          '<td class="mini">' + r.cur.map(function (s) { return (/^\d/.test(s.name || '') ? '' : s.ord + '. ') + esc(s.name) + (s.status === 'review' ? ' <span class="tag t-unk">на підтвердженні</span>' : ''); }).join('<br>') + '<details class="plan-steps mini"><summary>усі кроки (' + r.total + ')</summary><ol class="steps-mini">' + (A.indexes.stepsByPlan[r.p.id] || []).map(function (s) { return '<li class="st-' + s.status + '">' + esc(s.name) + ' <span class="sub">' + esc(s.responsible || '') + ' · ' + esc({pending: 'очікує', active: 'у роботі', review: 'на погодженні', done: 'виконано', skipped: 'пропущено'}[s.status] || s.status) + '</span></li>'; }).join('') + '</ol></details>' + (r.p.status !== 'active' ? esc({done: 'завершено', cancelled: 'скасовано'}[r.p.status] || '') : '') + '</td>' +
          '<td class="mini ' + (r.over ? 'overdue' : '') + '">' + r.cur.map(function (s) { return s.due_date ? A.dt(s.due_date) : ''; }).join('<br>') + '</td><td><div class="prog" style="width:90px"><div style="width:' + (r.total ? r.done * 100 / r.total : 0) + '%"></div></div><span class="mini">' + r.done + '/' + r.total + '</span></td>' +
          '<td class="mini">' + esc(r.p.manager || '—') + '<br>' + esc(N.DMA_SHORT[r.p.dept_code] || '') + '</td></tr>'; }).join('') + (rows.length ? '' : '<tr><td colspan="6"><div class="empty">Планів не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Плани дій (CRM)', 'Етапи робіт за бізнес-процесами; паралельні кроки виконуються одночасно', '', h), A.keep);
  });

  // ================================================================ погодження (вхідні запити на підтвердження кроків)
  A.on(/^\/approvals$/, function () {
    var me = S.user || {}, row = function (s, mine) {
      var p = A.get('plans', s.plan_id) || {}, tg = A.targetOf(p.target_type, p.target_id) || {href: '#', code: '—', name: ''}, hs = A.json(s.history, []);
      var last = Array.isArray(hs) ? hs.filter(function (x) { return /подано/.test(x.a); }).slice(-1)[0] : null;
      return '<tr><td><a class="id" href="' + tg.href + '">' + esc(tg.code) + '</a><span class="sub clip">' + esc((tg.name || '').slice(0, 90)) + '</span></td><td class="mini">' + esc(N.PROC[p.process] || '') + '</td>' +
        '<td><b>' + (/^\d/.test(s.name || '') ? '' : s.ord + '. ') + esc(s.name) + '</b><span class="sub">' + esc(s.responsible || '') + '</span></td><td class="mini">' + esc((last && last.name) || s.done_by || '') + '<br>' + esc((s.requested_at || s.done_at || '').slice(0, 16)) + (last && last.c ? '<br>«' + esc(last.c) + '»' : '') + '</td>' +
        '<td class="mini">' + esc(A.approverNames(s)) + '</td><td class="actions-inline">' + (mine ? '<span class="mini">очікує</span>' : '<button class="btn sm gold" data-click="step" data-a="confirm" data-id="' + s.id + '">Погодити</button><button class="btn sm plain" data-click="step" data-a="return" data-id="' + s.id + '">Повернути</button>') + '</td></tr>';
    };
    var ex = A.myExecSteps ? A.myExecSteps() : [];
    var exH = '<h2>Кроки до виконання моїм підрозділом <span class="mini">' + ex.length + '</span></h2><p class="mini">Крок плану потрапляє сюди, якщо у графі «Відповідальний» зазначено ваш підрозділ (або ваше МТУ) — навіть якщо план відкрив інший відділ. Відкрийте об’єкт і натисніть «Виконано» / «На підтвердження».</p><div class="wrap-tbl"><table><thead><tr><th>Об’єкт</th><th>Процес</th><th>Крок</th><th>Строк</th><th></th></tr></thead><tbody>' + ex.map(function (s) {
      var p = A.get('plans', s.plan_id) || {}, tg = A.targetOf(p.target_type, p.target_id) || {href: '#', code: '—', name: ''};
      return '<tr><td><a class="id" href="' + tg.href + '">' + esc(tg.code) + '</a><span class="sub clip">' + esc((tg.name || '').slice(0, 90)) + '</span></td><td class="mini">' + esc(N.PROC[p.process] || '') + '<br>' + esc(N.DMA_SHORT[p.dept_code] || '') + '</td><td><b>' + esc(s.name) + '</b><span class="sub">' + esc(s.responsible || '') + '</span></td><td class="mini ' + (s.due_date && s.due_date < A.today() ? 'overdue' : '') + '">' + (s.due_date ? A.dt(s.due_date) : '') + '</td>' +
        '<td class="actions-inline"><button class="btn sm gold" data-click="step" data-a="done" data-id="' + s.id + '">' + (s.needs_confirm ? 'На підтвердження' : 'Виконано') + '</button></td></tr>'; }).join('') + (ex.length ? '' : '<tr><td colspan="5"><div class="empty">Немає кроків для вашого підрозділу.</div></td></tr>') + '</tbody></table></div>';
    var inbox = A.myApprovals(), mine = A.T('plan_steps').filter(function (s) { return s.status === 'review' && s.done_by === me.login; });
    var doneByMe = A.T('plan_steps').filter(function (s) { return s.confirmed_by === me.login; }).sort(function (a, b) { return (b.confirmed_at || '').localeCompare(a.confirmed_at || ''); }).slice(0, 30);
    var th = '<thead><tr><th>Об’єкт</th><th>Процес</th><th>Крок</th><th>Подав</th><th>Погоджує</th><th></th></tr></thead>';
    var h = '<div class="flash info">Як працює погодження: виконавець натискає «На підтвердження» — крок отримує статус «Очікує погодження» і з’являється тут у користувачів ролі-погоджувача (за відповідальним підрозділом кроку: напр. «Погодження з УВКБ» — Управління внутрішнього контролю та безпеки, «Підписання висновку» — Керівництво АРМА; кроки відділів ДМА — керівник відділу, за яким закріплено план, або директор Департаменту менеджменту активів; кроки Відділу координації управління та реалізації — його начальник). Роль «Керівник підрозділу» погоджує лише кроки свого підрозділу (підрозділ — у картці користувача); роль «Перегляд» погоджень не має. Погодити власний крок неможливо. Після погодження стає активним наступний крок; «Повернути» повертає крок виконавцю з коментарем. Уся історія зберігається в кроці.</div>' +
      '<h2>Очікують мого погодження <span class="mini">' + inbox.length + '</span></h2><div class="wrap-tbl"><table>' + th + '<tbody>' + inbox.map(function (s) { return row(s, false); }).join('') + (inbox.length ? '' : '<tr><td colspan="6"><div class="empty">Немає запитів на погодження.</div></td></tr>') + '</tbody></table></div>' +
      exH + '<h2>Мої подання на погодження <span class="mini">' + mine.length + '</span></h2><div class="wrap-tbl"><table>' + th + '<tbody>' + mine.map(function (s) { return row(s, true); }).join('') + (mine.length ? '' : '<tr><td colspan="6"><div class="empty">Немає.</div></td></tr>') + '</tbody></table></div>' +
      '<h2>Погоджено мною</h2><div class="wrap-tbl"><table><thead><tr><th>Крок</th><th>Погоджено</th></tr></thead><tbody>' + doneByMe.map(function (s) { var p = A.get('plans', s.plan_id) || {}, tg = A.targetOf(p.target_type, p.target_id) || {href: '#', code: '—'};
        return '<tr><td><a href="' + tg.href + '">' + esc(tg.code) + '</a> · ' + (/^\d/.test(s.name || '') ? '' : s.ord + '. ') + esc(s.name) + '</td><td class="mini">' + esc((s.confirmed_at || '').slice(0, 16)) + '</td></tr>'; }).join('') + (doneByMe.length ? '' : '<tr><td colspan="2"><div class="empty">—</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Погодження', 'Запити на підтвердження кроків планів дій — від виконавців до погоджувачів', '', h), A.keep);
  });

  // ================================================================ судові рішення
  A.decFilter = function (f) {
    var w = words(f.q);
    return A.T('decisions').filter(function (d) {
      if (w.length && !match([d.case_no, d.proceeding_no, d.court, d.summary, d.assets_text, A.can('view_internal') ? d.erdr_no : ''].join(' '), w)) return false;
      if (f.dtype && d.dtype !== f.dtype) return false; if (f.effect && (d.effect || N.DECEFF[d.dtype]) !== f.effect) return false;
      if (f.from && (d.decision_date || '') < f.from) return false; if (f.to && (d.decision_date || '') > f.to) return false;
      if (f.nolink && (A.indexes.assetsByDec[d.id] || []).length) return false;
      return true;
    }).sort(function (a, b) { return (b.decision_date || '').localeCompare(a.decision_date || '') || b.id - a.id; });
  };
  A.on(/^\/decisions$/, function (f) {
    var list = A.decFilter(f);
    var pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="/decisions"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ справи, провадження, суд, текст" style="flex:1;min-width:240px">' + A.sel('dtype', D.DECISION_TYPES.map(function (x) { return [x[0], x[1]]; }), f.dtype, 'Усі види рішень') +
      A.sel('effect', Object.keys(D.EFFECT_NAME).map(function (k) { return [k, D.EFFECT_NAME[k]]; }), f.effect, 'Наслідок') + '<input type="date" name="from" value="' + esc(f.from || '') + '" title="Дата рішення з"><input type="date" name="to" value="' + esc(f.to || '') + '" title="по">' +
      A.sel('nolink', [['1', 'Не пов’язані з активами']], f.nolink, 'Зв’язок') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/decisions">Скинути все</button></form>' + A.pager(list.length, pg.page, '/decisions', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Дата</th><th>Вид рішення</th><th>Суд / справа</th><th>Активи</th><th>Виконання</th><th></th></tr></thead><tbody>' + pg.rows.map(function (d) { var ls = A.indexes.assetsByDec[d.id] || [];
        return '<tr><td class="nowrap">' + A.dt(d.decision_date) + '</td><td><a href="#/decision/' + d.id + '">' + esc(N.DEC[d.dtype] || d.dtype) + '</a><span class="sub">' + esc(N.EFF[d.effect || N.DECEFF[d.dtype]] || '') + '</span></td><td class="mini">' + esc(d.court || '') + (d.case_no ? '<br>справа ' + esc(d.case_no) : '') + '</td>' +
          '<td class="mini">' + ls.slice(0, 3).map(function (l) { var a = A.get('assets', l.asset_id); return a ? '<a href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a>' : ''; }).join(', ') + (ls.length > 3 ? ' +' + (ls.length - 3) : '') + (ls.length ? '' : '<span class="tag t-lim">не пов’язано</span>') + '</td><td class="mini">' + esc(d.execution || '') + '</td>' +
          '<td class="nowrap">' + (A.can('edit_decisions') ? '<a class="btn sm" href="#/decision/' + d.id + '/edit">Редагувати</a>' : '') + '</td></tr>'; }).join('') + (list.length ? '' : '<tr><td colspan="6"><div class="empty">Рішень не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Судові рішення', 'Реєстр ухвал і рішень; правовий стан активів визначається за хронологією', (A.can('edit_decisions') ? '<a class="btn gold" href="#/decision/new">+ Судове рішення</a>' : '') +
      (A.can('export') ? '<a class="btn" href="#" data-click="xlsx-decisions" data-q="' + esc(JSON.stringify(q)) + '" title="Рішення за поточним фільтром з номерами пов’язаних активів">XLSX за фільтром</a><a class="btn" href="#" data-click="xlsx-decisions" data-full="1" data-q="' + esc(JSON.stringify(q)) + '" title="Кожне рішення — з повним переліком і описом активів">XLSX розширений (з описом активів)</a>' : ''), h), A.keep);
  });
  A.on(/^\/decision\/(\d+)$/, function (id) {
    var d = A.get('decisions', +id); if (!d) return A.notFound();
    var ls = (A.indexes.assetsByDec[d.id] || []).map(function (l) { return [l, A.get('assets', l.asset_id)]; }).filter(function (x) { return x[1] && A.inScope(x[1]); });
    var act = (A.can('edit_decisions') ? '<a class="btn gold" href="#/decision/' + d.id + '/edit">Редагувати</a>' : '') + (A.can('delete_records') ? '<button class="btn danger" data-click="dec-del" data-id="' + d.id + '" data-confirm="Видалити судове рішення? Правовий стан пов’язаних активів буде перераховано.">Видалити</button>' : '') + '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = '<div class="panel"><dl class="kv">' + dd('Вид рішення', N.DEC[d.dtype] || d.dtype) + dd('Наслідок для управління', N.EFF[d.effect || N.DECEFF[d.dtype]]) + dd('Обсяг арешту', N.SCOPE[d.arrest_scope]) + dd('Суд', d.court) + dd('Інстанція', d.instance) +
      dd('№ справи', d.case_no) + dd('№ провадження', d.proceeding_no) + (A.can('view_internal') ? dd('№ ЄРДР', d.erdr_no) : '') + dd('Дата рішення', A.dt(d.decision_date), true) + dd('Набрало законної сили', A.dt(d.effective_date), true) + dd('Надійшло до АРМА', A.dt(d.received_date), true) +
      dd('Вхідний №', d.inbox_no) + dd('Виконання', d.execution) + dd('Виконавець', d.executor) + dd('Орган прокуратури', d.prosecutor_body) + dd('Короткий зміст', d.summary) + dd('Активи (текст рішення)', d.assets_text) +
      (d.edrsr_url ? dd('ЄДРСР', '<a href="' + esc(d.edrsr_url) + '" target="_blank" rel="noopener">відкрити рішення</a>', true) : '') + dd('Примітка', d.note) + dd('Джерело', (d.source || '—') + (d.created_by ? ' · ' + d.created_by : '') + (d.created_at ? ' · ' + d.created_at : '')) + '</dl></div>' +
      '<h2>Пов’язані активи <span class="pill">' + ls.length + '</span></h2><div class="wrap-tbl"><table><thead><tr><th>№ активу</th><th>Найменування</th><th>Наслідок для активу</th><th>Правовий стан зараз</th></tr></thead><tbody>' + ls.map(function (x) { var a = x[1];
        return '<tr><td><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a></td><td><span class="clip3" title="' + esc(a.name || '') + '">' + esc(a.name || '') + '</span></td><td class="mini">' + esc(N.EFF[x[0].effect || d.effect || N.DECEFF[d.dtype]] || '') + '</td><td>' + A.legal(a.legal_status) + '</td></tr>'; }).join('') + (ls.length ? '' : '<tr><td colspan="4"><div class="empty">Не пов’язано з активами.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell(N.DEC[d.dtype] || 'Судове рішення', [A.dt(d.decision_date), d.court, d.case_no].filter(Boolean).join(' · '), act, h));
  });
  function decForm(d, aNos, back) {
    var F = A.field, S2 = A.fsel;
    return '<form data-act="dec-save" data-id="' + (d.id || '') + '" data-back="' + esc(back) + '"><fieldset><legend>Судове рішення</legend><div class="form-grid">' +
      S2('Вид рішення', 'dtype', D.DECISION_TYPES.map(function (x) { return [x[0], x[1]]; }), d.dtype, 1, '', 'wide') +
      S2('Наслідок для управління', 'effect', Object.keys(D.EFFECT_NAME).map(function (k) { return [k, D.EFFECT_NAME[k]]; }), d.effect, 0, 'Порожньо — за видом рішення', '', '', 'За видом рішення') + S2('Обсяг арешту', 'arrest_scope', D.ARREST_SCOPES, d.arrest_scope) +
      F('Суд', 'court', d.court) + F('Інстанція', 'instance', d.instance) + F('№ справи', 'case_no', d.case_no) + F('№ провадження', 'proceeding_no', d.proceeding_no) + (A.can('view_internal') ? F('№ ЄРДР', 'erdr_no', d.erdr_no) : '') +
      F('Дата рішення', 'decision_date', d.decision_date, 'date', 1) + F('Набрало законної сили', 'effective_date', d.effective_date, 'date') + F('Надійшло до АРМА', 'received_date', d.received_date, 'date') + F('Вхідний №', 'inbox_no', d.inbox_no) +
      S2('Виконання', 'execution', D.EXECUTION, d.execution) + F('Виконавець', 'executor', d.executor) + F('Орган прокуратури', 'prosecutor_body', d.prosecutor_body) + F('Посилання на ЄДРСР', 'edrsr_url', d.edrsr_url, 'url', 0, '', 'wide') +
      F('Короткий зміст', 'summary', d.summary, 'textarea', 0, '', 'wide') + F('Активи (як у тексті рішення)', 'assets_text', d.assets_text, 'textarea', 0, '', 'wide') + F('Примітка', 'note', d.note, 'textarea', 0, '', 'wide') + '</div></fieldset>' +
      '<fieldset><legend>Пов’язані активи</legend><div class="form-grid">' + '<div class="field wide"><label>&nbsp;</label><button type="button" class="btn" data-click="pick" data-into="asset_nos" data-multi="1">🔎 Обрати з Реєстру</button></div>' + F('Номери активів у Реєстрі', 'asset_nos', aNos.join('\n'), 'textarea', 0, 'Оберіть з Реєстру або по одному в рядку / через кому. Після збереження правовий стан цих активів буде перераховано за хронологією рішень.', 'wide') + '</div></fieldset>' +
      actionsBar(back, d.id ? 'Зберегти рішення' : 'Додати рішення') + '</form>';
  }
  A.on(/^\/decision\/new$/, function (f) {
    if (!A.can('edit_decisions')) return A.deny();
    var a = f.asset && A.get('assets', +f.asset);
    A.render(A.shell('Нове судове рішення', a ? 'для активу ' + a.asset_no : '', '', decForm({}, a ? [a.asset_no] : [], a ? '#/asset/' + a.id : '#/decisions')));
  });
  A.on(/^\/decision\/(\d+)\/edit$/, function (id, f) {
    if (!A.can('edit_decisions')) return A.deny(); var d = A.get('decisions', +id); if (!d) return A.notFound();
    var nosL = (A.indexes.assetsByDec[d.id] || []).map(function (l) { var a = A.get('assets', l.asset_id); return a && a.asset_no; }).filter(Boolean);
    A.render(A.shell('Редагування судового рішення', [A.dt(d.decision_date), d.court].filter(Boolean).join(' · '), '', decForm(d, nosL, f.back && /^\/asset\/\d+$/.test(f.back) ? '#' + f.back : '#/decision/' + d.id)));
  });
  A.ACT['dec-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('decisions', +form.dataset.id), rec = clean(d), list = nos(rec.asset_nos); delete rec.asset_nos;
    if (!rec.dtype || !rec.decision_date) throw new Error('Вкажіть вид і дату рішення');
    var want = {}, miss = [], linkedByNo = {};
    if (!isNew) (A.indexes.assetsByDec[old.id] || []).forEach(function (l) { var la = A.get('assets', l.asset_id); if (la) linkedByNo[la.asset_no] = la; });
    // номер, уже пов’язаний з рішенням, лишається за тим самим активом (у Реєстрі бувають повтори номерів)
    list.forEach(function (no) { var a = linkedByNo[no] || A.indexes.byNo[no]; if (a) want[a.id] = 1; else miss.push(no); });
    if (miss.length && !confirm('Не знайдено в Реєстрі: ' + miss.join(', ') + '. Зберегти без них?')) return;
    var tx = A.tx(), did, links = isNew ? [] : (A.indexes.assetsByDec[old.id] || []), have = {}, affected = {};
    if (isNew) { did = A.tmpId(); rec.id = did; rec.source = 'Внесено вручну'; tx.put('decisions', rec); } else { did = old.id; diffPut(tx, 'decisions', old, rec); }
    links.forEach(function (l) { have[l.asset_id] = 1; affected[l.asset_id] = 1; if (!want[l.asset_id]) tx.del('decision_assets', l.id); });
    Object.keys(want).forEach(function (aid) { affected[aid] = 1; if (!have[aid]) tx.put('decision_assets', {id: A.tmpId(), decision_id: did, asset_id: +aid}); });
    tx.log(isNew ? 'Додано судове рішення' : 'Змінено судове рішення', 'decision', isNew ? null : did, {dtype: rec.dtype, assets: Object.keys(want).length});
    if (!tx.size()) { A.toast('Змін немає', 'info'); return A.go(form.dataset.back); }
    return tx.commit().then(function (r) { form.classList.remove('dirty'); return A.recalcLegal(Object.keys(affected).map(Number)).then(function (n) {
      A.toast('Рішення збережено' + (n ? '; правовий стан змінено для активів: ' + n : '')); A.go(isNew && !/asset/.test(form.dataset.back) ? '#/decision/' + r.id('decisions', did) : form.dataset.back); }); });
  };

  // ================================================================ оцінки
  A.valTarget = function (v) {
    if (v.target_type === 'group') return {href: '#/valuation/' + v.id, code: 'Групова', name: (A.indexes.vaByVal[v.id] || []).length + ' активів'};
    return A.targetOf(v.target_type, v.target_id) || {href: '#/valuation/' + v.id, code: v.asset_nos || '—', name: v.lot_name || ''};
  };
  A.on(/^\/valuations$/, function (f) {
    var w = words(f.q), list = A.T('valuations').filter(function (v) {
      if (w.length && !match([v.asset_nos, v.lot_name, v.procurement_id, v.report_no, v.appraiser, v.valuer_entity, v.reviewer, v.winner].join(' '), w)) return false;
      if (f.status && v.status !== f.status) return false; if (f.cur === '1' && !v.is_current) return false; if (f.cur === '0' && v.is_current) return false;
      if (f.state && A.valState(v.value_date) !== f.state) return false; if (f.tt && (f.tt === 'none' ? v.target_type : v.target_type !== f.tt)) return false;
      if (f.src === 'inv' && !/^Інвентаризація/.test(v.source || '')) return false; if (f.src === 'rep' && /^Інвентаризація/.test(v.source || '')) return false;
      return true;
    }).sort(function (a, b) { return (b.value_date || b.procurement_date || '').localeCompare(a.value_date || a.procurement_date || '') || b.id - a.id; });
    var inv = function (v) { return /^Інвентаризація/.test(v.source || ''); }, cur = list.filter(function (v) { return v.is_current && v.value_uah; });
    var tot = cur.filter(function (v) { return !inv(v); }).reduce(function (s, v) { return s + v.value_uah; }, 0), totInv = cur.filter(inv).reduce(function (s, v) { return s + v.value_uah; }, 0), pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    var h = '<div class="grid g5">' + A.kpi('Оцінок за фільтром', A.num(list.length), 'усього записів') + A.kpi('Портфель за актуальними оцінками', A.num(tot, 2) + ' ₴', 'звіти про оцінку (модуль оцінок); те саме значення — на «Огляді портфеля»') +
      A.kpi('Вартість з інвентаризації', A.num(totInv, 2) + ' ₴', 'довідково: суми з колонки оцінки в інвентаризації; у підсумок портфеля не входять, щоб не рахувати ті самі активи двічі', A.link('/valuations', {src: 'inv'})) +
      A.kpi('Чинні (до 6 міс.)', A.num(list.filter(function (v) { return A.valState(v.value_date) === 'valid'; }).length), 'звіт не старший 6 місяців', A.link('/valuations', {state: 'valid'})) +
      A.kpi('Прострочені', A.num(list.filter(function (v) { return A.valState(v.value_date) === 'expired'; }).length), 'потрібна нова оцінка', A.link('/valuations', {state: 'expired'}), 'overdue') + '</div>' +
      '<form class="filters" data-act="filter" data-base="/valuations" style="margin-top:14px"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ активів, лот, закупівля, звіт, оцінювач" style="flex:1;min-width:240px">' + A.sel('status', D.VALUATION_STATUS, f.status, 'Статус') +
      A.sel('tt', [['asset', 'Актив'], ['pool', 'Пул'], ['group', 'Групова'], ['none', 'Не прив’язані до об’єкта']], f.tt, 'Об’єкт оцінки') + A.sel('cur', [['1', 'Актуальні'], ['0', 'Попередні']], f.cur, 'Актуальність') + A.sel('state', [['valid', 'Чинні'], ['expired', 'Понад 6 міс.'], ['none', 'Без дати']], f.state, 'Строк') + A.sel('src', [['rep', 'Звіти про оцінку'], ['inv', 'З інвентаризації (довідково)']], f.src, 'Джерело') +
      '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/valuations">Скинути все</button></form>' + A.pager(list.length, pg.page, '/valuations', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Об’єкт</th><th>Дата, станом на яку оцінено</th><th class="num">Вартість без ПДВ</th><th>Закупівля / лот</th><th>Лист про звіт / суб’єкт оцінки</th><th>Статус</th><th></th></tr></thead><tbody>' + pg.rows.map(function (v) { var tg = A.valTarget(v), st = A.valState(v.value_date);
        return '<tr><td style="max-width:300px"><a class="id" href="' + tg.href + '">' + esc(tg.code) + '</a><span class="sub clip">' + esc((tg.name || '').slice(0, 80)) + '</span></td><td class="nowrap">' + A.dt(v.value_date) + (st === 'expired' ? '<span class="sub overdue">понад 6 міс.</span>' : '') + '</td>' +
          '<td class="num nowrap">' + (v.value_uah ? A.money(v.value_uah, true) : '—') + '</td><td class="mini">' + esc(v.procurement_id || '') + (v.lot_no ? ' · лот ' + esc(v.lot_no) : '') + '<br>' + esc((v.lot_name || '').slice(0, 60)) + '</td><td class="mini">' + esc(v.report_no || '') + '<br>' + esc(v.valuer_entity || v.appraiser || '') + '</td>' +
          '<td class="mini">' + esc(v.status || '') + (v.is_current ? ' <span class="tag t-ok">актуальна</span>' : '') + '</td><td class="nowrap"><a class="btn sm plain" href="#/valuation/' + v.id + '">Відкрити</a>' + (A.can('edit_valuations') ? ' <a class="btn sm" href="#/valuation/' + v.id + '/edit">Ред.</a>' : '') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="7"><div class="empty">Оцінок не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Оцінки', 'Закупівлі послуг з оцінки, звіти, актуальна вартість активів і пулів', A.can('edit_valuations') ? '<a class="btn gold" href="#/valuation/new">+ Оцінка</a>' : '', h), A.keep);
  });
  A.on(/^\/valuation\/(\d+)$/, function (id) {
    var v = A.get('valuations', +id); if (!v) return A.notFound(); var tg = A.valTarget(v), st = A.valState(v.value_date);
    var grp = (A.indexes.vaByVal[v.id] || []).map(function (l) { return A.get('assets', l.asset_id); }).filter(function (a) { return a && A.inScope(a); });
    var act = (A.can('edit_valuations') ? '<a class="btn gold" href="#/valuation/' + v.id + '/edit">Редагувати</a>' : '') + (A.can('edit_valuations') || A.can('delete_records') ? '<button class="btn danger" data-click="val-del" data-id="' + v.id + '" data-confirm="Видалити оцінку?">Видалити</button>' : '') + '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = '<div class="grid g3">' + A.kpi('Вартість', v.value_uah ? A.money(v.value_uah, true) : '—', v.value_date ? 'станом на ' + A.dt(v.value_date) : '') + A.kpi('Строк дії', st === 'valid' ? 'Чинна' : st === 'expired' ? 'Понад 6 міс.' : '—', 'звіт не старший 6 місяців', null, st === 'expired' ? 'overdue' : '') +
      A.kpi('Об’єкт', '<a href="' + tg.href + '">' + esc(tg.code) + '</a>', tg.name || '') + '</div><div class="panel" style="margin-top:14px"><dl class="kv">' + dd('Статус', (v.status || '—') + (v.is_current ? ' · актуальна' : ' · попередня')) + dd('Номери активів', v.asset_nos) + dd('№ лоту', v.lot_no) + dd('Конкретна назва закупівлі', v.lot_name) +
      dd('Ідентифікатор закупівлі', v.procurement_id) + dd('Дата оприлюднення', A.dt(v.procurement_date), true) + dd('Учасники', v.participants) +
      dd('Очікувана вартість закупівлі, грн з ПДВ', v.expected_cost_vat ? A.money(v.expected_cost_vat, true) : '') + dd('Очікувана вартість закупівлі, грн без ПДВ', v.expected_cost ? A.money(v.expected_cost, true) : '') + dd('Вартість договору', v.contract_cost ? A.money(v.contract_cost, true) : '') + dd('Переможець', v.winner) + (A.can('view_internal') ? dd('Контакти переможця', v.winner_contacts) : '') + dd('Реквізити договору', v.contract_req) +
      dd('Суб’єкт оціночної діяльності', v.valuer_entity) + dd('Рецензент', v.reviewer) + dd('Реквізити листа про надходження звіту та рецензії до АРМА', v.report_no) +
      dd('Дата прийняття послуг з оцінки', A.dt(v.decision_date), true) + dd('Вартість активу за попереднім звітом, грн без ПДВ', v.prev_value ? A.money(v.prev_value, true) : '') + dd('Дата прийняття послуг з попередньої оцінки', A.dt(v.prev_date), true) + dd('Строк надання послуг', v.service_term) +
      dd('Примітка', v.note) + dd('Джерело', v.source) + '</dl></div>';
    if (v.target_type === 'group') h += '<h2>Активи групової оцінки <span class="pill">' + grp.length + '</span></h2>' + A.assetTable(grp);
    A.render(A.shell('Оцінка · ' + tg.code, v.lot_name || '', act, h));
  });
  function valForm(v, back) {
    var F = A.field, S2 = A.fsel, tgt = v.target_type === 'pool' ? (A.get('pools', v.target_id) || {}).code : v.target_type === 'asset' ? (A.get('assets', v.target_id) || {}).asset_no : '';
    var grpNos = (A.indexes.vaByVal[v.id] || []).map(function (l) { var a = A.get('assets', l.asset_id); return a && a.asset_no; }).filter(Boolean);
    return '<form data-act="val-save" data-id="' + (v.id || '') + '" data-back="' + esc(back) + '"><fieldset><legend>Об’єкт оцінки</legend><div class="form-grid">' +
      S2('Тип об’єкта', 'target_type', [['asset', 'Актив'], ['pool', 'Пул активів'], ['group', 'Групова оцінка (кілька активів)']], v.target_type || 'asset', 1) + F('№ активу або код пулу', 'target_code', tgt, 'text', 0, 'для активу або пулу') + '<div class="field"><label>&nbsp;</label><span class="row-actions"><button type="button" class="btn" data-click="pick" data-into="target_code" data-multi="0" data-set-type="target_type">🔎 Актив</button><button type="button" class="btn" data-click="pick" data-into="target_code" data-multi="0" data-pools="only" data-set-type="target_type">🔎 Пул</button></span></div>' +
      F('Номери активів (групова оцінка)', 'group_nos', grpNos.join('\n'), 'textarea', 0, 'для групової оцінки — по одному в рядку', 'wide') + '<div class="field"><label>&nbsp;</label><button type="button" class="btn" data-click="pick" data-into="group_nos" data-multi="1">🔎 Активи групи з Реєстру</button></div>' + '</div></fieldset>' +
      '<fieldset><legend>Закупівля послуг з оцінки</legend><div class="form-grid">' + F('№ лоту', 'lot_no', v.lot_no, 'text', 0, 'номер лоту в закупівлі послуг з оцінки на Prozorro (закупівля може складатися з кількох лотів — по лоту на актив / групу); переноситься з таблиці оцінок або вноситься з оголошення закупівлі') +
      F('Конкретна назва закупівлі', 'lot_name', v.lot_name, 'text', 0, '', 'wide') + F('Ідентифікатор закупівлі', 'procurement_id', v.procurement_id) + F('Дата оприлюднення', 'procurement_date', v.procurement_date, 'date') +
      F('Учасники', 'participants', v.participants, 'textarea', 0, '', 'wide') + F('Очікувана вартість закупівлі, грн з ПДВ', 'expected_cost_vat', v.expected_cost_vat, 'text', 0, '', '', 'inputmode="decimal"') + F('Очікувана вартість закупівлі, грн без ПДВ', 'expected_cost', v.expected_cost, 'text', 0, '', '', 'inputmode="decimal"') +
      F('Вартість договору, грн', 'contract_cost', v.contract_cost, 'text', 0, '', '', 'inputmode="decimal"') + F('Переможець', 'winner', v.winner) + (A.can('view_internal') ? F('Контакти переможця', 'winner_contacts', v.winner_contacts) : '') + F('Реквізити договору', 'contract_req', v.contract_req) + F('Строк надання послуг', 'service_term', v.service_term) + '</div></fieldset>' +
      '<fieldset><legend>Результат оцінки</legend><div class="form-grid">' + F('Суб’єкт оціночної діяльності', 'valuer_entity', v.valuer_entity, 'text', 0, '', 'wide') + F('Рецензент', 'reviewer', v.reviewer, 'text', 0, '', 'wide') +
      F('Вартість активу за звітом, грн без ПДВ', 'value_uah', v.value_uah, 'text', 0, '', '', 'inputmode="decimal"') + F('Дата, станом на яку проводилась оцінка', 'value_date', v.value_date, 'date') + F('Реквізити листа про надходження звіту та рецензії до АРМА', 'report_no', v.report_no, 'text', 0, '', 'wide') +
      F('Дата прийняття послуг з оцінки', 'decision_date', v.decision_date, 'date') + F('Вартість активу за попереднім звітом, грн без ПДВ', 'prev_value', v.prev_value, 'text', 0, '', '', 'inputmode="decimal"') + F('Дата прийняття послуг з попередньої оцінки', 'prev_date', v.prev_date, 'date') + S2('Статус', 'status', D.VALUATION_STATUS, v.status) +
      S2('Актуальна оцінка', 'is_current', [['1', 'Так — використовувати як поточну вартість'], ['0', 'Ні — попередня / довідкова']], v.is_current === 0 ? '0' : '1', 0, '', '', '', null) + F('Примітка', 'note', v.note, 'textarea', 0, '', 'wide') + '</div></fieldset>' +
      actionsBar(back, v.id ? 'Зберегти оцінку' : 'Додати оцінку') + '</form>';
  }
  A.on(/^\/valuation\/new$/, function (f) {
    if (!A.can('edit_valuations')) return A.deny();
    var v = {target_type: f.tt || 'asset', target_id: f.tid ? +f.tid : null, is_current: 1}, back = f.tt === 'pool' ? '#/pool/' + f.tid : f.tt === 'asset' ? '#/asset/' + f.tid : '#/valuations';
    A.render(A.shell('Нова оцінка', '', '', valForm(v, back)));
  });
  A.on(/^\/valuation\/(\d+)\/edit$/, function (id) { if (!A.can('edit_valuations')) return A.deny(); var v = A.get('valuations', +id); if (!v) return A.notFound(); A.render(A.shell('Редагування оцінки', v.lot_name || '', '', valForm(v, '#/valuation/' + v.id))); });
  A.ACT['val-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('valuations', +form.dataset.id), rec = clean(d, ['value_uah', 'expected_cost', 'expected_cost_vat', 'contract_cost', 'prev_value']);
    var code = rec.target_code, gn = nos(rec.group_nos); delete rec.target_code; delete rec.group_nos; rec.is_current = +rec.is_current;
    var tt = rec.target_type, tid = null, ids = [];
    if (tt === 'asset') { var a = A.indexes.byNo[code]; if (!a) throw new Error('Актив «' + (code || '') + '» не знайдено'); tid = a.id; rec.asset_nos = a.asset_no; }
    else if (tt === 'pool') { var p = A.T('pools').filter(function (x) { return x.code === code; })[0]; if (!p) throw new Error('Пул «' + (code || '') + '» не знайдено'); tid = p.id; }
    else { gn.forEach(function (no) { var x = A.indexes.byNo[no]; if (x) ids.push(x.id); }); if (!ids.length) throw new Error('Вкажіть номери активів групової оцінки'); rec.asset_nos = gn.join(', '); rec.assets_count = ids.length; }
    rec.target_id = tid;
    var tx = A.tx(), vid;
    if (isNew) { vid = A.tmpId(); rec.id = vid; rec.source = 'Внесено вручну'; tx.put('valuations', rec); } else { vid = old.id; diffPut(tx, 'valuations', old, rec); }
    if (rec.is_current && tt !== 'group') A.T('valuations').forEach(function (x) { if (x.id !== old.id && x.target_type === tt && x.target_id === tid && x.is_current && rec.value_uah) tx.put('valuations', {id: x.id, is_current: 0}); });
    var affected = {}; if (tt === 'group' || old.target_type === 'group') {
      var cur = {}; (A.indexes.vaByVal[old.id] || []).forEach(function (l) { cur[l.asset_id] = l; affected[l.asset_id] = 1; });
      ids.forEach(function (i) { affected[i] = 1; if (!cur[i]) tx.put('valuation_assets', {id: A.tmpId(), valuation_id: vid, asset_id: i}); else delete cur[i]; });
      Object.keys(cur).forEach(function (k) { tx.del('valuation_assets', cur[k].id); });
    }
    tx.log(isNew ? 'Додано оцінку' : 'Змінено оцінку', 'valuation', isNew ? null : vid, {value: rec.value_uah});
    return tx.commit().then(function (r) {
      form.classList.remove('dirty');
      var jobs = [A.refreshValCache(tt, tid)]; if (old.target_type && (old.target_type !== tt || old.target_id !== tid)) jobs.push(A.refreshValCache(old.target_type, old.target_id));
      Object.keys(affected).forEach(function (i) { jobs.push(A.refreshValCache('asset', +i)); });
      return jobs.reduce(function (p, j) { return p.then(function () { return j; }); }, Promise.resolve()).then(function () { A.toast('Оцінку збережено'); A.go(isNew && form.dataset.back === '#/valuations' ? '#/valuation/' + r.id('valuations', vid) : form.dataset.back); });
    });
  };

  // ================================================================ товариства (корпоративні права)
  var CS_CSS = D.COMPANY_STATUS_CSS || {};
  A.companyStatus = function (s) { return s ? '<span class="tag t-' + (CS_CSS[s] || 'unk') + '">' + esc(s) + '</span>' : '<span class="tag t-unk">Не визначено</span>'; };
  // арештовані частки В товаристві (товариство — обʼєкт) і частки, що НАЛЕЖАТЬ товариству (воно — засновник)
  function companyAssets(code) { return A.T('assets').filter(function (a) { return a.company_code === code && A.inScope(a); }); }
  function ownedAssets(code) { return A.T('assets').filter(function (a) { return a.category === 'corporate' && (a.details || {}).founder_code === code && a.company_code !== code && A.inScope(a); }); }
  A.founderOf = function (a) { var d = a.details || {}; return d.founder_name ? d.founder_name + (d.founder_code ? ' (ЄДРПОУ ' + d.founder_code + ')' : '') : d.founder_person ? d.founder_person : ''; };
  A.on(/^\/companies$/, function (f) {
    A.render(A.shell('Товариства (корпоративні права)', 'Картки юридичних осіб, частки в яких передано АРМА', '', A.companiesBlock(f, '/companies')), A.keep);
  });
  // v2.6: той самий перелік — вкладка «Картки компаній» у розділі «Корпоративні права»
  A.companiesBlock = function (f, base) {
    var cnt = {}; A.T('assets').forEach(function (a) { if (a.company_code && A.inScope(a)) cnt[a.company_code] = (cnt[a.company_code] || 0) + 1; });
    var list = A.T('companies').slice(), have = {}; list.forEach(function (c) { have[c.edrpou] = 1; });
    Object.keys(cnt).forEach(function (k) { if (!have[k]) { var a = A.T('assets').filter(function (x) { return x.company_code === k; })[0]; list.push({id: null, edrpou: k, name: (a.details || {}).company_name || a.name, status: null}); } });
    var w = words(f.q);
    list = list.filter(function (c) { if (w.length && !match([c.edrpou, c.name, c.kved, c.kved_name, c.director, c.address].join(' '), w)) return false;
      if (f.dup && !(c.share_total > 100.01)) return false;
      if (f.cstatus && (c.status || 'Не визначено') !== f.cstatus) return false; if (f.dept && c.dept_code !== f.dept) return false; if (f.kved && (c.kved || '').slice(0, 2) !== f.kved) return false; return true; })
      .sort(function (a, b) { return (cnt[b.edrpou] || 0) - (cnt[a.edrpou] || 0) || (a.name || '').localeCompare(b.name || ''); });
    var pg = A.pageOf(list, f), q = Object.assign({}, f), divs = A.json(S.settings.kved_divisions); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="' + base + '">' + (base !== '/companies' ? '<input type="hidden" name="tab" value="companies">' : '') + '<input name="q" value="' + esc(f.q || '') + '" placeholder="ЄДРПОУ, назва, КВЕД, керівник, адреса" style="flex:1;min-width:240px">' + A.sel('cstatus', D.COMPANY_STATUS, f.cstatus, 'Стан юридичної особи') + A.sel('dept', A.OPT.DEPT, f.dept, 'Відділ ДМА') + A.sel('dup', [['1', 'Сума часток > 100 % (задвоєння)']], f.dup, 'Перевірка часток') +
      (f.kved ? '<input type="hidden" name="kved" value="' + esc(f.kved) + '">' : '') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="' + base + (base !== '/companies' ? '?tab=companies' : '') + '">Скинути все</button>' + ((A.can('system') || A.can('delete_records')) && A.mode === 'server' ? '<a class="btn plain" href="#/companies/check">Перевірка ЄДРПОУ</a>' : '') + '</form>' + A.pager(list.length, pg.page, base, q) +
      '<div class="wrap-tbl"><table><thead><tr><th>ЄДРПОУ</th><th>Найменування</th><th>Стан</th><th>КВЕД</th><th class="num">Частка АРМА</th><th class="num" title="Чистий дохід за останній звітний рік і оцінки YouControl (MarketScore / FinScore / Експрес-аналіз)">Виручка · оцінки YC</th><th class="num">Активів</th><th>Відділ ДМА</th></tr></thead><tbody>' + pg.rows.map(function (c) {
        return '<tr><td class="mono"><a href="#/company/' + esc(c.edrpou) + '">' + esc(c.edrpou) + '</a></td><td><span class="clip" title="' + esc(c.name) + '">' + esc(c.name || '') + '</span>' + (c.foreign_country ? '<span class="sub">' + esc(c.foreign_country) + '</span>' : '') + '</td><td>' + A.companyStatus(c.status) + '</td>' +
          '<td class="mini">' + esc(c.kved || '') + (c.kved_name ? '<br>' + esc(c.kved_name) : c.kved ? '<br>' + esc(divs[(c.kved || '').slice(0, 2)] || '') : '') + '</td><td class="num">' + (c.share_total ? A.num(c.share_total, 2) + ' %' : '—') + (c.share_total > 100.01 ? '<span class="sub"><span class="tag t-lost" title="Сума часток за записами Реєстру перевищує 100 % — ймовірне задвоєння записів">перевірити</span></span>' : '') + '</td><td class="num nowrap">' + A.ycCell(c) + '</td><td class="num"><a href="' + A.link('/assets', {company: c.edrpou}) + '">' + (cnt[c.edrpou] || 0) + '</a></td><td class="mini">' + esc(N.DMA_SHORT[c.dept_code] || '—') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="8"><div class="empty">Товариств не знайдено.</div></td></tr>') + '</tbody></table></div>';
    return h;
  };
  A.on(/^\/company\/([^/]+)$/, function (code) {
    code = decodeURIComponent(code); var c = A.indexes.comp[code], as = companyAssets(code), own0 = ownedAssets(code);
    if (!c && !as.length && !own0.length) return A.notFound();
    c = c || {edrpou: code, name: ((as[0] || {}).details || {}).company_name || ((own0[0] || {}).details || {}).founder_name || code};
    var ed = A.can('edit_corp_extra'), divs = A.json(S.settings.kved_divisions), counted = as.filter(function (a) { return !(a.details || {}).corp_dup; }), share = counted.reduce(function (s, a) { return s + (Number((a.details || {}).share_pct) || 0); }, 0);
    // власники арештованих часток / акцій — з описів активів («що належать: …», «корпоративні права <особа> у вигляді …»)
    var owned = ownedAssets(code), hold = {}, persons = 0, unknown = 0, qtyRe = /у\s+кількості\s+([\d\s]+)\s*(?:шт|штук)/i;
    counted.forEach(function (a) { var d = a.details || {}, m = (a.name || '').match(qtyRe), q = m ? +m[1].replace(/\s/g, '') : 0;
      if (d.founder_name) { var k = d.founder_name + (d.founder_code ? ' (ЄДРПОУ ' + d.founder_code + ')' : ''); hold[k] = hold[k] || {n: 0, pct: 0, qty: 0}; hold[k].n++; hold[k].pct += Number(d.share_pct) || 0; hold[k].qty += q; }
      else if (d.founder_person || /належ[а-яіїєґ]*\s*:?\s*(?:гр\.\s*|громадян[а-яіїєґ]*\s+)?[А-ЯІЇЄҐ][а-яіїєґʼ'’-]+\s+[А-ЯІЇЄҐ][а-яіїєґʼ'’-]+/.test(a.name || '')) persons++; else unknown++; });
    var holdK = Object.keys(hold).sort(function (x, y) { return hold[y].n - hold[x].n || hold[y].qty - hold[x].qty; }), isShares = counted.some(function (a) { return /акці/i.test(a.name || ''); });
    var adm = A.can('system') || A.can('delete_records'), yc = c.yc || {};
    var act = (ed ? '<a class="btn gold" href="#/company/' + esc(code) + '/edit">Редагувати картку</a>' : '') + '<button class="btn" data-click="company-dossier" data-code="' + esc(code) + '">Досьє XLSX</button>' +
      (adm && A.mode === 'server' ? '<button class="btn plain" data-click="company-fix" data-code="' + esc(code) + '">Виправити / об’єднати ЄДРПОУ</button>' : '') +
      (adm && c.id ? '<button class="btn plain" data-click="company-del" data-id="' + c.id + '" data-n="' + as.length + '">Видалити картку</button>' : '') + '<a class="btn" href="' + esc(D.YOUCONTROL_URL.replace('{}', code)) + '" target="_blank" rel="noopener">YouControl</a><a class="btn plain" href="#/companies">До переліку</a>';
    var kp = '<div class="grid g4">' + A.kpi('Стан юридичної особи', A.companyStatus(c.status), yc.date ? 'за даними YouControl на ' + A.dt(yc.date) : 'вноситься вручну за даними ЄДР / YouControl') + A.kpi('Частка АРМА', (c.share_total || share) > 100.01 ? '<span class="overdue">' + A.num(c.share_total || share, 2) + ' %</span>' : c.share_total ? A.num(c.share_total, 2) + ' %' : share ? A.num(share, 2) + ' %' : '—', (c.share_total || share) > 100.01 ? 'сума за записами перевищує 100 % — ймовірне задвоєння записів, перевірте перелік нижче' : 'у статутному капіталі') +
      A.kpi('Статутний капітал', c.capital ? A.money(c.capital, true) : '—', '') + A.kpi('Записів у Реєстрі', A.num(as.length), 'арештовані частки в товаристві' + (owned.length ? '; ще ' + owned.length + ' — частки, що належать товариству' : '')) + '</div>';
    var info =
      '<div class="grid g2" style="margin-top:14px"><div class="panel"><h3>Реєстраційні відомості</h3><dl class="kv">' + dd('Код ЄДРПОУ', '<span class="mono">' + esc(code) + '</span>', true) + dd('Найменування', c.name) + dd('Організаційно-правова форма', c.legal_form) + dd('Дата реєстрації', A.dt(c.reg_date), true) +
      dd('Статутний капітал', c.capital ? A.money(c.capital, true) : '') + dd('Основний КВЕД', [c.kved, c.kved_name || divs[(c.kved || '').slice(0, 2)]].filter(Boolean).join(' — ')) + dd('Види діяльності', c.activities) + dd('Юридична адреса', c.address) + dd('Країна (для нерезидентів)', c.foreign_country) + '</dl></div>' +
      '<div class="panel"><h3>Управління і контроль</h3><dl class="kv">' + dd('Керівник', c.director) + dd('Кінцеві бенефіціари', c.beneficiaries) + dd('Кількість працівників', c.employees) + dd('Фінансові показники', c.finance) + dd('Ризики', c.risks) +
      dd('Відділ ДМА', N.DMA[c.dept_code] || 'Не закріплено') + dd('Аналітична довідка', c.analytics_note) + dd('Додатково', c.extra) + dd('Оновлено', (c.updated_at || '—') + (c.updated_by ? ' · ' + c.updated_by : '')) + '</dl></div></div>';
    var hold =
      (holdK.length || persons ? '<div class="panel" style="margin-top:14px"><h3>' + (isShares ? 'Власники арештованих акцій' : 'Засновники / власники арештованих часток') + ' <span>за описами ' + A.num(counted.length) + ' записів Реєстру</span></h3>' +
        '<p class="mini">Визначено автоматично з тексту опису активу («…що належать: <i>особа</i>…», «корпоративні права <i>особи</i> у вигляді частки…»). Це не перелік засновників за ЄДР: для акціонерних товариств — власники арештованих пакетів акцій. Фізичні особи показуються лише кількістю (персональні дані — у картках активів).</p>' +
        '<table><thead><tr><th>Власник</th><th class="num">Записів</th><th class="num">' + (isShares ? 'Акцій, шт.' : 'Частка, %') + '</th></tr></thead><tbody>' + holdK.slice(0, 15).map(function (k) { var x = hold[k]; return '<tr><td>' + esc(k) + '</td><td class="num">' + x.n + '</td><td class="num">' + (isShares ? (x.qty ? A.num(x.qty) : '—') : (x.pct ? A.num(x.pct, 3) + ' %' : '—')) + '</td></tr>'; }).join('') +
        (holdK.length > 15 ? '<tr><td colspan="3" class="mini">… ще ' + (holdK.length - 15) + ' юридичних осіб</td></tr>' : '') +
        (persons ? '<tr><td>Фізичні особи</td><td class="num">' + A.num(persons) + '</td><td class="num">—</td></tr>' : '') + (unknown ? '<tr><td class="mini">Власника в описі не визначено</td><td class="num">' + A.num(unknown) + '</td><td class="num">—</td></tr>' : '') + '</tbody></table></div>' : '');
    var reg =
      '<h2>Арештовані частки в цьому товаристві <span class="pill">' + as.length + '</span></h2><p class="mini">Активи Реєстру, де обʼєктом є це товариство (частка в його статутному капіталі). Записи, вилучені звіркою як дублі, позначені і в частці не враховуються.</p>' + A.assetTable(as.slice(0, 200)) + (as.length > 200 ? '<p><a href="' + A.link('/assets', {company: code}) + '">Усі ' + as.length + ' активів →</a></p>' : '') +
      (owned.length ? '<h2>Частки, що належать цьому товариству (воно — засновник) <span class="pill">' + owned.length + '</span></h2><p class="mini">Корпоративні права цього товариства в інших юридичних особах, у т. ч. нерезидентах. У частку АРМА в цьому товаристві не входять.</p><div class="wrap-tbl"><table><thead><tr><th>№ у Реєстрі</th><th>Обʼєкт (товариство)</th><th class="num">Частка</th><th>Правовий стан</th></tr></thead><tbody>' +
        owned.map(function (a) { var d = a.details || {}; return '<tr><td><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a></td><td>' + (a.company_code ? '<a href="#/company/' + esc(a.company_code) + '">' + esc(d.company_name || a.company_code) + '</a> <span class="mono mini">' + esc(a.company_code) + '</span>' : esc(d.foreign_company || d.company_name || '—') + (d.foreign_country ? ' <span class="tag t-unk">нерезидент · ' + esc(d.foreign_country) + '</span>' : '')) + '</td><td class="num">' + (d.share_pct ? A.num(d.share_pct, 3) + ' %' : '—') + '</td><td>' + A.legal(a.legal_status) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '');
    var docs =
      (c.id ? '<div style="margin-top:14px">' + A.docsBlock('company', c.id, ed, ['registry_extract', 'mgmt_contract', 'valuation_report', 'other']) + '</div>' : '');
    // v2.9: картка у вкладках; дані YouControl — окремими вкладками «Фінанси» і «Ризики та діяльність»
    var F = yc.f || {}, hasF = Object.keys(F).length > 0;
    var h = kp + A.ycKpis(yc) + '<div class="tabs" data-tabbar="comp" style="margin-top:14px"><a href="#" data-tab="c-info">Загальні відомості</a>' + (hasF ? '<a href="#" data-tab="c-fin">Фінанси</a>' : '') +
      (yc.date ? '<a href="#" data-tab="c-risk">Ризики та діяльність</a>' : '') + '<a href="#" data-tab="c-reg">Частки в товаристві <span class="pill">' + (as.length + owned.length) + '</span></a><a href="#" data-tab="c-all">Усі активи товариства <span class="pill">' + A.companyAllAssets(code).length + '</span></a>' + (c.id ? '<a href="#" data-tab="c-docs">Документи</a>' : '') + '</div>' +
      '<div class="tabpane" id="c-info" data-group="comp">' + info + A.ycOwners(yc) + (hold ? '<div style="margin-top:14px">' + hold + '</div>' : '') + '</div>' +
      (hasF ? '<div class="tabpane" id="c-fin" data-group="comp">' + A.ycInvestorHtml(yc) + A.ycFinance(yc) + '</div>' : '') +
      (yc.date ? '<div class="tabpane" id="c-risk" data-group="comp">' + A.ycRisks(yc) + '</div>' : '') +
      '<div class="tabpane" id="c-reg" data-group="comp">' + reg + '</div>' + '<div class="tabpane" id="c-all" data-group="comp">' + A.companyAllHtml(code) + '</div>' + (c.id ? '<div class="tabpane" id="c-docs" data-group="comp">' + docs + '</div>' : '') +
      (yc.date ? '<p class="mini yc-src">Джерело даних вкладок «Фінанси» і «Ризики та діяльність», реєстраційних відомостей: YouControl, вивантаження від ' + A.dt(yc.date) + (yc.src ? ' (' + esc(yc.src) + ')' : '') + '. Контактні дані (телефони, e-mail, контактні особи) не імпортуються.</p>' : '');
    if (!A.edrpouOk(code) && !c.foreign_country) h = '<div class="flash warn">Код ЄДРПОУ ' + esc(code) + ' не відповідає формату (8 цифр з контрольною цифрою). Можливо, втрачено провідні нулі або цифру.' + (adm && A.mode === 'server' ? ' Скористайтеся «Виправити / об’єднати ЄДРПОУ».' : '') + '</div>' + h;
    A.render(A.shell(c.name || code, 'ЄДРПОУ ' + code, act, h));
  });
  A.on(/^\/company\/([^/]+)\/edit$/, function (code) {
    if (!A.can('edit_corp_extra')) return A.deny(); code = decodeURIComponent(code); var c = A.indexes.comp[code] || {edrpou: code, name: ((companyAssets(code)[0] || {}).details || {}).company_name};
    var F = A.field, S2 = A.fsel;
    var h = '<form data-act="company-save" data-code="' + esc(code) + '"><fieldset><legend>Реєстраційні відомості</legend><div class="form-grid">' + F('Найменування', 'name', c.name, 'text', 1, '', 'wide') + S2('Стан юридичної особи', 'status', D.COMPANY_STATUS, c.status, 0, 'діюча / в стані припинення / банкрутство / припинено') +
      F('Організаційно-правова форма', 'legal_form', c.legal_form) + F('Дата реєстрації', 'reg_date', c.reg_date, 'date') + F('Статутний капітал, грн', 'capital', c.capital) + F('Частка АРМА, %', 'share_total', c.share_total) + F('Основний КВЕД (код)', 'kved', c.kved, 'text', 0, 'напр., 68.20') +
      F('Назва КВЕД', 'kved_name', c.kved_name) + F('Види діяльності', 'activities', c.activities, 'textarea', 0, '', 'wide') + F('Юридична адреса', 'address', c.address, 'text', 0, '', 'wide') + F('Країна (для нерезидентів)', 'foreign_country', c.foreign_country) + '</div></fieldset>' +
      '<fieldset><legend>Управління і контроль</legend><div class="form-grid">' + F('Керівник', 'director', c.director) + F('Кінцеві бенефіціари', 'beneficiaries', c.beneficiaries, 'textarea', 0, '', 'wide') + F('Кількість працівників', 'employees', c.employees) + S2('Відділ ДМА', 'dept_code', D.DMA, c.dept_code) +
      F('Фінансові показники', 'finance', c.finance, 'textarea', 0, '', 'wide') + F('Ризики', 'risks', c.risks, 'textarea', 0, '', 'wide') + F('Аналітична довідка', 'analytics_note', c.analytics_note, 'textarea', 0, '', 'wide big') + F('Додатково', 'extra', c.extra, 'textarea', 0, '', 'wide') + '</div></fieldset>' +
      actionsBar('#/company/' + esc(code), 'Зберегти картку') + '</form>';
    A.render(A.shell('Картка товариства', 'ЄДРПОУ ' + code, '', h));
  });
  A.ACT['company-save'] = function (form, d) {
    var code = form.dataset.code, c = A.indexes.comp[code], rec = clean(d, ['capital', 'share_total']), tx = A.tx();
    rec.updated_by = S.user && S.user.login; rec.updated_at = A.nowS();
    if (c) diffPut(tx, 'companies', c, rec); else { rec.id = A.tmpId(); rec.edrpou = code; tx.put('companies', rec); }
    tx.log('Змінено картку товариства', 'company', code);
    return tx.commit().then(function () { form.classList.remove('dirty'); A.toast('Картку збережено'); A.go('#/company/' + encodeURIComponent(code)); });
  };

  // ================================================================ v2.8: ЄДРПОУ — перевірка, виправлення, видалення; досьє товариства
  A.edrpouOk = function (code) {
    code = String(code || ''); if (!/^\d{8}$/.test(code)) return false;
    var d = code.split('').map(Number), n = +code, w = n >= 30000000 && n <= 60000000 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
    var sum = function (k) { return d.slice(0, 7).reduce(function (s, x, i) { return s + x * (w[i] + k); }, 0) % 11; }, r = sum(0);
    if (r === 10) { r = sum(2); if (r === 10) r = 0; } return r === d[7];
  };
  function fixCodes(items) {
    A.busy(true);
    return A.http('POST', '/api/admin/company-fix', {items: items}).then(function (r) { A.busy(false); return A.pollNow().then(function () { return r; }); }, function (e) { A.busy(false); throw e; });
  }
  A.CLICK['company-fix'] = function (t) {
    var from = t.dataset.code, v = prompt('Правильний код ЄДРПОУ для «' + from + '» (8 цифр). Якщо картка з таким кодом уже є — картки буде об’єднано, усі активи перенесено, хибну картку видалено:', from.length < 8 ? from.padStart(8, '0') : from);
    if (v === null) return; v = v.trim();
    if (!/^\d{8}$|^\d{10}$/.test(v)) return A.toast('Код має містити 8 цифр (нерезиденти — 10)', 'err');
    if (v.length === 8 && !A.edrpouOk(v) && !confirm('Код ' + v + ' не проходить перевірку контрольної цифри. Продовжити?')) return;
    return fixCodes([{from: from, to: v}]).then(function (r) { var x = r.done[0]; A.toast((x.mode === 'merge' ? 'Картки об’єднано' : x.mode === 'rename' ? 'Код виправлено' : 'Посилання активів виправлено') + '; активів оновлено: ' + x.assets); A.go('#/company/' + encodeURIComponent(v)); });
  };
  A.CLICK['company-del'] = function (t) {
    if (+t.dataset.n) return A.toast('До картки прив’язано активів: ' + t.dataset.n + '. Спершу скористайтеся «Виправити / об’єднати ЄДРПОУ».', 'err');
    if (!confirm('Видалити картку товариства? Дію не можна скасувати.')) return;
    var tx = A.tx(); tx.del('companies', +t.dataset.id); tx.log('Видалено картку товариства', 'company', t.dataset.id);
    return tx.commit().then(function () { A.toast('Картку видалено'); A.go('#/companies'); });
  };
  A.on(/^\/companies\/check$/, function () {
    if (!(A.can('system') || A.can('delete_records')) || A.mode !== 'server') return A.deny();
    A.render(A.shell('Перевірка кодів ЄДРПОУ', 'Товариства з некоректними кодами: пропозиції виправлення', '', '<div class="empty">Перевіряю…</div>'));
    A.http('GET', '/api/admin/company-check').then(function (r) {
      var it = r.items, M = {merge: 'об’єднати з наявною карткою', rename: 'виправити код', manual: 'вручну'};
      var h = '<p class="mini">Код ЄДРПОУ перевіряється за довжиною (8 цифр) і контрольною цифрою. Пропозиція формується так: доповнення провідними нулями, відновлення останньої цифри, наявна картка з правильним кодом, код у тексті опису активу. «Об’єднати» — перенести активи, документи і заповнені відомості на правильну картку та видалити хибну. Нерезиденти (10 цифр або країна в картці) не перевіряються.</p>' +
        '<div class="grid g3">' + A.kpi('Об’єднати', A.num(it.filter(function (x) { return x.mode === 'merge'; }).length), 'хибні картки-дублікати') + A.kpi('Виправити код', A.num(it.filter(function (x) { return x.mode === 'rename'; }).length), 'картка одна, код неповний') + A.kpi('Вручну', A.num(it.filter(function (x) { return x.mode === 'manual'; }).length), 'потрібне рішення користувача') + '</div>' +
        '<p style="margin:12px 0"><button class="btn gold" data-click="company-fix-sel">Виправити вибрані</button> <label class="mini"><input type="checkbox" data-allfix checked> вибрати всі автоматичні</label></p>' +
        '<div class="wrap-tbl"><table><thead><tr><th></th><th>Код зараз</th><th>Найменування</th><th class="num">Активів</th><th>Дія</th><th>Правильний код</th><th>Картка з правильним кодом</th><th>Підстава</th></tr></thead><tbody>' + it.map(function (x, i) {
          return '<tr><td>' + (x.mode !== 'manual' ? '<input type="checkbox" data-fix="' + i + '" checked>' : '') + '</td><td class="mono"><a href="#/company/' + esc(x.edrpou) + '">' + esc(x.edrpou) + '</a></td><td class="mini">' + esc(x.name || '—') + '</td><td class="num">' + x.assets + '</td><td class="mini">' + M[x.mode] + '</td>' +
            '<td><input class="mono" style="width:110px" data-to="' + i + '" value="' + esc(x.target || '') + '" placeholder="8 цифр"></td><td class="mini">' + (x.target_name ? '<a href="#/company/' + esc(x.target) + '">' + esc(x.target_name) + '</a>' : '') + '</td><td class="mini">' + esc(x.why) + '</td></tr>'; }).join('') +
        (it.length ? '' : '<tr><td colspan="8"><div class="empty">Некоректних кодів не знайдено.</div></td></tr>') + '</tbody></table></div>';
      A.render(A.shell('Перевірка кодів ЄДРПОУ', 'Знайдено записів: ' + it.length, '<a class="btn plain" href="#/companies">До переліку</a>', h));
      A._fixItems = it;
      var all = document.querySelector('[data-allfix]'); if (all) all.onchange = function () { document.querySelectorAll('[data-fix]').forEach(function (c) { c.checked = all.checked; }); };
    }).catch(function (e) { A.toast(e.message, 'err'); });
  });
  A.CLICK['company-fix-sel'] = function () {
    var items = []; document.querySelectorAll('[data-fix]').forEach(function (c) { if (!c.checked) return; var i = +c.dataset.fix, to = (document.querySelector('[data-to="' + i + '"]') || {}).value || ''; if (/^\d{8}$/.test(to.trim())) items.push({from: A._fixItems[i].edrpou, to: to.trim()}); });
    document.querySelectorAll('[data-to]').forEach(function (inp) { var i = +inp.dataset.to, x = A._fixItems[i]; if (x.mode === 'manual' && /^\d{8}$/.test(inp.value.trim())) items.push({from: x.edrpou, to: inp.value.trim()}); });
    if (!items.length) return A.toast('Нічого не вибрано', 'err');
    if (!confirm('Виправити коди: ' + items.length + '? Активи буде перенесено на правильні картки, хибні картки-дублікати видалено.')) return;
    return fixCodes(items).then(function (r) { var m = r.done.filter(function (x) { return x.mode === 'merge'; }).length, n = r.done.reduce(function (s, x) { return s + x.assets; }, 0);
      A.toast('Виправлено: ' + r.done.length + ' (об’єднано ' + m + '), активів оновлено: ' + n); A.route(true); });
  };
  // зведення по товариству: активи, хронологія ухвал, № КП, МТУ / відділи — для звітів
  A.companySummary = function (code) {
    var as = A.T('assets').filter(function (a) { return a.company_code === code && A.inScope(a); }), decs = {}, erdr = {}, uniq = function (f) { var o = {}; as.forEach(function (a) { var v = f(a); if (v) o[v] = 1; }); return Object.keys(o).join('\n'); };
    as.forEach(function (a) { A.decisionsOfAsset(a).forEach(function (d) { (decs[d.id] = decs[d.id] || {d: d, nos: []}).nos.push(a.asset_no); if (d.erdr_no && A.can('view_internal')) erdr[d.erdr_no] = 1; }); });
    var dl = Object.keys(decs).map(function (k) { return decs[k]; }).sort(function (x, y) { return (x.d.decision_date || '').localeCompare(y.d.decision_date || '') || x.d.id - y.d.id; });
    return {assets: as, decisions: dl, erdr: Object.keys(erdr).join('\n'),
      rulings: dl.map(function (x) { var d = x.d; return [A.dt(d.decision_date), N.DEC[d.dtype] || d.dtype, d.court, d.case_no ? 'справа ' + d.case_no : '', d.proceeding_no ? 'провадження ' + d.proceeding_no : ''].filter(Boolean).join(', '); }).join('\n'),
      mtu: uniq(function (a) { return N.MTU[a.mtu_code]; }), mtuMgr: uniq(function (a) { return a.mtu_manager; }), dept: uniq(function (a) { return N.DMA[a.dept_code]; }), dmaMgr: uniq(function (a) { return a.dma_manager; })};
  };
  A.CLICK['company-dossier'] = function (t) {
    var code = t.dataset.code, c = A.indexes.comp[code] || {edrpou: code}, x = A.companySummary(code), divs = A.json(S.settings.kved_divisions), v = function (y) { return y === undefined || y === '' ? null : y; };
    var card = [['Код ЄДРПОУ', code], ['Найменування', c.name], ['Стан', c.status], ['Дата реєстрації', c.reg_date ? A.dt(c.reg_date) : null], ['Організаційно-правова форма', c.legal_form], ['Статутний капітал, грн', c.capital],
      ['Основний КВЕД', [c.kved, c.kved_name || divs[(c.kved || '').slice(0, 2)]].filter(Boolean).join(' — ')], ['Види діяльності', c.activities], ['Юридична адреса', c.address], ['Країна', c.foreign_country], ['Керівник', c.director],
      ['Кінцеві бенефіціари', c.beneficiaries], ['Кількість працівників', c.employees], ['Фінансові показники', c.finance], ['Ризики', c.risks], ['Частка АРМА, %', c.share_total], ['Відділ ДМА (картка)', N.DMA[c.dept_code]],
      ['Відділи ДМА (активи)', x.dept], ['Менеджери ДМА', x.dmaMgr], ['МТУ', x.mtu], ['Виконавці МТУ', x.mtuMgr], ['Записів у Реєстрі', x.assets.length], ['Ухвал і рішень', x.decisions.length], ['№ кримінальних проваджень в ЄРДР', x.erdr],
      ['Аналітична довідка', c.analytics_note], ['Додатково', c.extra], ['Оновлено', [c.updated_at, c.updated_by].filter(Boolean).join(' · ')]].map(function (r) { return [r[0], v(r[1])]; });
    var docs = c.id ? A.T('file_links').filter(function (l) { return l.target_type === 'company' && l.target_id === c.id; }).map(function (l) { return [l.title || (A.get('files', l.file_id) || {}).name, l.doc_type, l.created_at ? A.dt(l.created_at.slice(0, 10)) : null]; }) : [];
    A.busy(true);
    return window.XLSX.table([
      {name: 'Картка', title: 'Досьє товариства · ' + (c.name || code) + ' · ЄДРПОУ ' + code + ' · ' + A.dt(A.today()), cols: [{h: 'Показник', w: 34}, {h: 'Значення', w: 90}], rows: card},
      {name: 'Активи', title: 'Арештовані частки / акції в товаристві', cols: ['№ у Реєстрі', 'Найменування', 'Частка, %', 'Власник / засновник', 'Правовий стан', 'Зона', 'МТУ', 'Виконавець МТУ', 'Відділ ДМА', 'Менеджер ДМА', 'Оцінка, грн', 'Ухвали і рішення (хронологія)', '№ КП в ЄРДР']
        .map(function (h, i) { return {h: h, w: [16, 60, 10, 30, 22, 14, 22, 22, 22, 22, 16, 60, 24][i]}; }),
        rows: x.assets.map(function (a) { var d = a.details || {}, val = A.assetValuation(a); return [a.asset_no, a.name, v(d.share_pct), v(A.founderOf(a)), N.LS[a.legal_status], a.zone, N.MTU[a.mtu_code], v(a.mtu_manager), N.DMA[a.dept_code], v(a.dma_manager), val ? val.v.value_uah : v(a.val_amount), v(A.rulingsLine(a)), v(A.erdrLine(a))]; })},
      {name: 'Ухвали', title: 'Ухвали і рішення суду щодо часток товариства — у хронологічному порядку', cols: ['Дата', 'Вид рішення', 'Суд', 'Справа', 'Провадження', '№ КП в ЄРДР', 'Наслідок', 'Активи (№ у Реєстрі)'].map(function (h, i) { return {h: h, w: [12, 26, 34, 18, 18, 24, 20, 40][i]}; }),
        rows: x.decisions.map(function (y) { var d = y.d; return [A.dt(d.decision_date), N.DEC[d.dtype] || d.dtype, v(d.court), v(d.case_no), v(d.proceeding_no), A.can('view_internal') ? v(d.erdr_no) : null, v(N.EFF[d.effect || N.DECEFF[d.dtype]]), y.nos.join(', ')]; })},
    , {name: 'Усі активи', title: 'Усі активи Реєстру, пов’язані з товариством (частки / акції в ньому, майно товариства, його частки в інших юрособах)', cols: ['№ у Реєстрі', 'Найменування', 'Категорія', 'Зв’язок з товариством', 'Частка, %', 'Власник (боржник)', 'Код власника', 'Зона', 'Інвестиційна привабливість', 'Відділ ДМА', 'Менеджер ДМА', 'МТУ', 'Виконавець МТУ', 'Правовий стан', 'Оцінка, грн', 'Ухвали і рішення (хронологія)', '№ КП в ЄРДР']
        .map(function (h, i) { return {h: h, w: [16, 60, 18, 26, 10, 30, 12, 12, 14, 22, 22, 22, 22, 22, 16, 60, 24][i]}; }),
        rows: A.companyAllAssets(code).map(function (y) { var a = y.a, d = a.details || {}, val = A.assetValuation(a); return [a.asset_no, a.name, N.CAT[a.category] || a.category, y.rel, v(d.share_pct), v(a.owner_name), A.can('view_internal') ? v(a.owner_code) : null, a.zone, v({attractive: 'Привабливий', conditional: 'Умовно', unattractive: 'Не привабливий', na: 'Не застосовно'}[a.invest_grade] || null), N.DMA[a.dept_code], v(a.dma_manager), N.MTU[a.mtu_code], v(a.mtu_manager), N.LS[a.legal_status], val ? val.v.value_uah : v(a.val_amount), v(A.rulingsLine(a)), v(A.erdrLine(a))]; })}
    ].concat(A.ycInvestorSheets(c)).concat([
      {name: 'Документи', title: 'Документи картки товариства', cols: [{h: 'Документ', w: 60}, {h: 'Тип', w: 20}, {h: 'Додано', w: 14}], rows: docs}
    ])).then(function (b) { A.busy(false); window.XLSX.download(b, 'Досьє_' + code + '_' + A.today() + '.xlsx'); A.audit('Вивантажено досьє товариства', 'company', code); }, function (e) { A.busy(false); A.toast(e.message, 'err'); });
  };
  // ---------------------------------------------------------------- v2.9: дані YouControl у картці товариства
  var YCF = [
    ['Звіт про фінансові результати', [['rev', 'Чистий дохід від реалізації'], ['gr', 'Приріст виручки, %', '%'], ['inc', 'Загальний дохід'], ['cogs', 'Собівартість реалізованої продукції'], ['gp', 'Валовий прибуток'], ['ebitda', 'EBITDA / EBIT'],
      ['ooi', 'Інші операційні доходи'], ['adm', 'Адміністративні витрати'], ['sell', 'Витрати на збут'], ['ooe', 'Інші операційні витрати'], ['op', 'Результат від операційної діяльності'], ['exp', 'Разом витрати'],
      ['ebt', 'Результат до оподаткування'], ['tax', 'Податок на прибуток'], ['np', 'Чистий прибуток (збиток)'], ['wage', 'Витрати на оплату праці'], ['emp', 'Кількість працівників', 'n']]],
    ['Баланс', [['ta', 'Активи'], ['fa', 'Основні засоби'], ['lfi', 'Довгострокові фінансові інвестиції'], ['cash', 'Гроші та їх еквіваленти'], ['ar', 'Поточна дебіторська заборгованість'], ['lar', 'Довгострокова дебіторська заборгованість'],
      ['ltl', 'Довгострокові зобов’язання'], ['lbank', 'Довгострокові кредити банків'], ['cl', 'Поточні зобов’язання'], ['sbank', 'Короткострокові кредити банків'], ['ap', 'Кредиторська заборгованість'], ['nd', 'Чистий борг'], ['nde', 'Чистий борг / EBITDA', 'x']]],
    ['Рентабельність, %', [['roa', 'ROA — рентабельність активів', '%'], ['roe', 'ROE — рентабельність власного капіталу', '%'], ['rca', 'RCA — рентабельність оборотних активів', '%'], ['npm', 'NPM — чиста маржа', '%'], ['rota', 'ROTA — рентабельність загальних активів', '%'],
      ['gmc', 'Валова рентабельність собівартості', '%'], ['ope', 'Рентабельність операційних витрат', '%'], ['nce', 'Чиста рентабельність витрат', '%']]]
  ];
  A.YCF = YCF;
  // аркуші досьє XLSX: «YouControl» і «Фінанси»
  A.ycSheets = function (c) {
    var yc = (c || {}).yc || {}; if (!yc.date) return [];
    var t = yc.tenders || {}, pb = yc.pub || {}, nv = function (y) { return y === undefined || y === '' ? null : y; };
    var kv = [['Дата вивантаження YouControl', A.dt(yc.date)], ['Файл', yc.src], ['Стан у ЄДР', yc.status], ['Дата припинення', yc.end_date ? A.dt(yc.end_date) : null], ['Сфера діяльності', yc.sphere], ['Категорія за звітністю', yc.size],
      ['Регіон', yc.region], ['Район', yc.district], ['Громада', yc.hromada], ['Населений пункт', yc.settlement], ['Додаткові КВЕД', yc.kved_add], ['Головна юрособа (для підрозділу)', yc.parent], ['Резидент Дія.City з', yc.diia ? A.dt(yc.diia) : null],
      ['Особа, що підписує звітність', yc.accountant], ['Засновники / учасники', yc.founders], ['Кінцевий бенефіціарний власник', yc.ubo], ['Власники крупних пакетів акцій', yc.holders],
      ['MarketScore', yc.ms], ['FinScore', yc.fs], ['Експрес-аналіз', yc.ea], ['Санкції', yc.sanctions], ['Коди УКТ ЗЕД', yc.zed], ['Експорт 2025, грн (інтервал)', yc.export], ['Імпорт 2025, грн (інтервал)', yc.import], ['Транспорт у власності, од.', yc.transport],
      ['Перемог у тендерах', t.won], ['Поданих пропозицій', t.bids], ['Організовано тендерів', t.org], ['Активних тендерів', t.active], ['Завершених тендерів', t.done], ['Скасованих / не відбулися', t.cancel],
      ['Одержувач публічних коштів: транзакцій 2023–2026', pb.rec_n], ['Одержувач публічних коштів: сума, грн', pb.rec_sum], ['Розпорядник публічних коштів: транзакцій 2023–2026', pb.pay_n], ['Розпорядник публічних коштів: сума, грн', pb.pay_sum],
      ['Чинні ліцензії на перевезення', (yc.lic || []).join('; ')]].map(function (r) { return [r[0], nv(r[1])]; });
    var per = A.ycYears(yc), F = yc.f || {}, rows = [];
    YCF.forEach(function (g) { var rs = g[1].filter(function (r) { return F[r[0]]; }); if (!rs.length) return; rows.push(['— ' + g[0]].concat(per.map(function () { return null; })));
      rs.forEach(function (r) { rows.push([r[1] + (r[2] === '%' ? '' : r[2] === 'n' ? ', осіб' : r[2] === 'x' ? ', разів' : ', грн')].concat(per.map(function (p) { var v = F[r[0]][p]; return v === undefined ? null : v; }))); }); });
    var out = [{name: 'YouControl', title: 'Дані YouControl · ' + (c.name || c.edrpou) + ' · станом на ' + A.dt(yc.date), cols: [{h: 'Показник', w: 44}, {h: 'Значення', w: 90}], rows: kv}];
    if (rows.length) out.push({name: 'Фінанси', title: 'Фінансова звітність (YouControl), грн · ' + (c.name || c.edrpou), cols: [{h: 'Показник', w: 46}].concat(per.map(function (p) { return {h: A.ycPer(p), w: 15}; })), rows: rows});
    return out;
  };
  A.ycCell = function (c) { var yc = c.yc || {}; if (!yc.date) return '<span class="mini">—</span>'; var r = A.ycLast(yc, 'rev');
    return (r ? '<span title="Чистий дохід за ' + r.y + ' рік">' + ycv(r.v) + '</span><span class="sub">' + r.y + '</span>' : '<span class="mini">звітність відсутня</span>') + '<span class="sub yc-mini-sc">' + [yc.ms, yc.fs, yc.ea].map(function (x) { return x || '·'; }).join(' / ') + '</span>'; };
  A.ycYears = function (yc) { var o = {}; Object.keys((yc || {}).f || {}).forEach(function (k) { Object.keys(yc.f[k]).forEach(function (p) { o[p] = 1; }); });
    return Object.keys(o).sort(function (a, b) { return (a.slice(0, 4) + (a.slice(4) || 'Z')).localeCompare(b.slice(0, 4) + (b.slice(4) || 'Z')); }); };
  A.ycPer = function (p) { return p.length > 4 ? ({Q1: 'I кв.', Q2: 'II кв.', Q3: 'III кв.', Q4: 'IV кв.'}[p.slice(4)] || p.slice(4)) + ' ' + p.slice(0, 4) : p; };
  A.ycLast = function (yc, k) { var s = ((yc || {}).f || {})[k] || {}, ys = Object.keys(s).filter(function (p) { return p.length === 4; }).sort(); var y = ys[ys.length - 1]; return y ? {y: y, v: s[y], prev: s[String(+y - 1)]} : null; };
  A.ycScore = function (v, title) { if (!v) return '<span class="tag t-unk" title="' + esc(title) + '">—</span>'; var c = {A: 'ok', B: 'ok', C: 'lim', D: 'lost', E: 'lost'}[String(v).charAt(0).toUpperCase()] || 'unk'; return '<span class="tag t-' + c + ' yc-score" title="' + esc(title) + '">' + esc(v) + '</span>'; };
  function ycv(v, u) { if (v === null || v === undefined || v === '') return '—'; if (u === '%') return A.num(v, 1) + ' %'; if (u === 'x') return A.num(v, 2); if (u === 'n') return A.num(v); var a = Math.abs(v);
    return a >= 1e9 ? A.num(v / 1e9, 2) + ' млрд' : a >= 1e6 ? A.num(v / 1e6, 1) + ' млн' : a >= 1e3 ? A.num(v / 1e3, 0) + ' тис.' : A.num(v); }
  A.ycv = ycv;
  function delta(x, u) { if (!x || x.prev === undefined || x.prev === null || !x.prev) return ''; var d = (x.v - x.prev) / Math.abs(x.prev) * 100; if (!isFinite(d)) return '';
    return ' <span class="yc-d ' + (d >= 0 ? 'up' : 'dn') + '" title="зміна до попереднього року">' + (d >= 0 ? '▲' : '▼') + ' ' + (Math.abs(d) >= 1000 ? '>999' : A.num(Math.abs(d), d > -10 && d < 10 ? 1 : 0)) + ' %</span>'; }
  A.ycKpis = function (yc) {
    if (!yc || !yc.date) return '';
    var rev = A.ycLast(yc, 'rev'), np = A.ycLast(yc, 'np'), ta = A.ycLast(yc, 'ta'), emp = A.ycLast(yc, 'emp');
    var k = function (t, x, u, cls) { return A.kpi(t, x ? ycv(x.v, u) + (u === 'n' ? '' : ' <small>₴</small>') + delta(x, u) : '—', x ? 'за ' + x.y + ' рік' + (x.prev !== undefined && x.prev !== null ? ' · ' + (+x.y - 1) + ': ' + ycv(x.prev, u) : '') : 'звітність не подавалась / відсутня', null, x && cls && x.v < 0 ? 'overdue' : ''); };
    return '<div class="grid g5 yc-kpis" style="margin-top:14px">' + k('Чистий дохід (виручка)', rev) + k('Чистий прибуток (збиток)', np, null, 1) + k('Активи', ta) + k('Працівників', emp, 'n') +
      '<div class="panel kpi"><h3>Оцінки YouControl</h3><div class="v yc-scores">' + A.ycScore(yc.ms, 'MarketScore — ринкова позиція') + A.ycScore(yc.fs, 'FinScore — фінансовий стан') + A.ycScore(yc.ea, 'Експрес-аналіз ризиків') + '</div><div class="d">MarketScore · FinScore · Експрес-аналіз' + (yc.sanctions && /наявн/i.test(yc.sanctions) ? ' · <span class="overdue">є санкції</span>' : '') + '</div></div></div>';
  };
  function pre(t) { return t ? '<div class="yc-pre">' + esc(t).replace(/\n\s*\n/g, '<hr>').replace(/\n/g, '<br>') + '</div>' : ''; }
  A.ycOwners = function (yc) {
    if (!yc || !yc.date) return '';
    var place = [yc.settlement, yc.hromada, yc.district, yc.region].filter(Boolean).join(', ');
    return '<div class="grid g2" style="margin-top:14px"><div class="panel"><h3>Додаткові відомості <span>YouControl · ' + A.dt(yc.date) + '</span></h3><dl class="kv">' + dd('Сфера діяльності', yc.sphere) + dd('Категорія за звітністю', yc.size) + dd('Місцезнаходження', place) +
      dd('Стан у ЄДР', yc.status) + (yc.end_date ? dd('Дата припинення', A.dt(yc.end_date), true) : '') + (yc.parent ? dd('Головна юрособа (для підрозділу)', yc.parent) : '') + (yc.diia ? dd('Резидент Дія.City з', A.dt(yc.diia), true) : '') +
      dd('Особа, що підписує звітність', yc.accountant) + '</dl></div>' +
      '<div class="panel"><h3>Власність і контроль <span>за ЄДР</span></h3><dl class="kv">' + dd('Засновники / учасники', pre(yc.founders), true) + dd('Кінцевий бенефіціарний власник', pre(yc.ubo), true) + dd('Власники крупних пакетів акцій', pre(yc.holders), true) + '</dl></div></div>';
  };
  A.ycFinance = function (yc) {
    var F = yc.f || {}, per = A.ycYears(yc), yrs = per.filter(function (p) { return p.length === 4; }), g = function (k) { return yrs.map(function (y) { var v = (F[k] || {})[y]; return v === undefined ? null : v; }); };
    var sumv = function (a, b) { return yrs.map(function (y) { var x = (F[a] || {})[y], z = (F[b] || {})[y]; return x === undefined && z === undefined ? null : (x || 0) + (z || 0); }); };
    var eq = yrs.map(function (y) { var t = (F.ta || {})[y]; if (t === undefined) return null; return t - ((F.cl || {})[y] || 0) - ((F.ltl || {})[y] || 0); });
    var ch = function (d) { return '<div class="chart yc-chart" data-chart=\'' + JSON.stringify(Object.assign({type: 'combo', labels: yrs, unit: 'money', height: 250}, d)).replace(/&/g, '&amp;').replace(/'/g, '&#39;') + '\'></div>'; };
    var h = '<div class="grid g2" style="margin-top:14px"><div class="panel"><h3>Виручка і прибуток <span>' + esc(yrs[0] + '–' + yrs[yrs.length - 1]) + ', грн</span></h3>' +
      ch({series: [{name: 'Чистий дохід', values: g('rev'), color: 'cyan', total: false}, {name: 'Валовий прибуток', values: g('gp'), color: 'violet', total: false}, {name: 'Чистий прибуток (збиток)', values: g('np'), color: 'gold', kind: 'line', total: false}]}) + '</div>' +
      '<div class="panel"><h3>Активи і зобов’язання <span>грн</span></h3>' +
      ch({series: [{name: 'Активи', values: g('ta'), color: 'blue', total: false}, {name: 'Зобов’язання (поточні + довгострокові)', values: sumv('cl', 'ltl'), color: 'lim', total: false}, {name: 'Власний капітал (розрахунково)', values: eq, color: 'ok', kind: 'line', total: false}]}) + '</div>' +
      '<div class="panel"><h3>Витрати і EBITDA <span>грн</span></h3>' +
      ch({series: [{name: 'Собівартість', values: g('cogs'), color: 'grey', total: false}, {name: 'Адміністративні витрати', values: g('adm'), color: 'violet', total: false}, {name: 'Оплата праці', values: g('wage'), color: 'blue', total: false}, {name: 'EBITDA / EBIT', values: g('ebitda'), color: 'gold', kind: 'line', total: false}]}) + '</div>' +
      '<div class="panel"><h3>Гроші і розрахунки <span>грн</span></h3>' +
      ch({series: [{name: 'Гроші та еквіваленти', values: g('cash'), color: 'cyan', total: false}, {name: 'Дебіторська заборгованість', values: g('ar'), color: 'violet', total: false}, {name: 'Кредиторська заборгованість', values: g('ap'), color: 'lost', total: false}]}) +
      (g('emp').some(function (v) { return v; }) ? '<div class="mini yc-emp">Працівників: ' + yrs.map(function (y, i) { var v = g('emp')[i]; return v === null ? '' : '<b>' + y + '</b> ' + A.num(v); }).filter(Boolean).join(' · ') + '</div>' : '') + '</div></div>';
    h += '<h2>Фінансова звітність <span class="pill">' + per.length + ' періодів</span></h2><p class="mini">Суми — у гривнях (скорочено: тис. / млн / млрд). Квартальні дані 2026 року — за поданою проміжною звітністю. Наведіть курсор на значення — повна сума.</p>' +
      '<div class="wrap-tbl yc-tbl"><table><thead><tr><th>Показник</th>' + per.map(function (p) { return '<th class="num' + (p.length > 4 ? ' q' : '') + '">' + esc(A.ycPer(p)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      YCF.map(function (gr) { var rows = gr[1].filter(function (r) { return F[r[0]]; }); if (!rows.length) return '';
        return '<tr class="grp"><td colspan="' + (per.length + 1) + '">' + esc(gr[0]) + '</td></tr>' + rows.map(function (r) { var s = F[r[0]];
          return '<tr><td>' + esc(r[1]) + '</td>' + per.map(function (p) { var v = s[p]; return '<td class="num' + (p.length > 4 ? ' q' : '') + (v < 0 ? ' neg' : '') + '"' + (v !== undefined && !r[2] ? ' title="' + A.num(v) + ' ₴"' : '') + '>' + (v === undefined ? '<span class="mini">·</span>' : ycv(v, r[2])) + '</td>'; }).join('') + '</tr>'; }).join(''); }).join('') + '</tbody></table></div>';
    return h;
  };
  A.ycRisks = function (yc) {
    var t = yc.tenders || {}, pb = yc.pub || {}, row = function (a, b) { return '<tr><td>' + esc(a) + '</td><td class="num">' + b + '</td></tr>'; };
    var h = '<div class="grid g3" style="margin-top:14px"><div class="panel"><h3>Оцінки і санкції</h3><table class="yc-mini"><tbody>' +
      '<tr><td>MarketScore <span class="sub">ринкова позиція</span></td><td class="num">' + A.ycScore(yc.ms, 'MarketScore') + '</td></tr>' + '<tr><td>FinScore <span class="sub">фінансовий стан</span></td><td class="num">' + A.ycScore(yc.fs, 'FinScore') + '</td></tr>' +
      '<tr><td>Експрес-аналіз <span class="sub">ризики контрагента</span></td><td class="num">' + A.ycScore(yc.ea, 'Експрес-аналіз') + '</td></tr>' +
      '<tr><td>Санкції</td><td class="num">' + (yc.sanctions ? '<span class="tag t-' + (/наявн/i.test(yc.sanctions) ? 'lost' : 'ok') + '">' + esc(yc.sanctions) + '</span>' : '—') + '</td></tr></tbody></table>' +
      '<p class="mini">Оцінки — за методикою YouControl (шкала A–E). Детальні підстави санкцій — у профілі товариства на YouControl.</p></div>' +
      '<div class="panel"><h3>Публічні закупівлі <span>Prozorro</span></h3><table class="yc-mini"><tbody>' + row('Перемог у тендерах', A.num(t.won || 0)) + row('Поданих пропозицій', A.num(t.bids || 0)) + row('Організовано тендерів (замовник)', A.num(t.org || 0)) +
      row('Активних', A.num(t.active || 0)) + row('Завершених', A.num(t.done || 0)) + row('Скасованих / не відбулися', A.num(t.cancel || 0)) + '</tbody></table></div>' +
      '<div class="panel"><h3>Публічні кошти <span>2023–2026</span></h3><table class="yc-mini"><tbody>' + row('Одержувач: транзакцій', A.num(pb.rec_n || 0)) + row('Одержувач: сума', pb.rec_sum ? A.money(pb.rec_sum) : '—') +
      row('Розпорядник: транзакцій', A.num(pb.pay_n || 0)) + row('Розпорядник: сума', pb.pay_sum ? A.money(pb.pay_sum) : '—') + '</tbody></table></div></div>';
    h += '<div class="grid g2" style="margin-top:14px"><div class="panel"><h3>Зовнішньоекономічна діяльність</h3><dl class="kv">' + dd('Експорт 2025, грн', yc.export ? esc(String(yc.export).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')) : 'не здійснювався / немає даних', true) +
      dd('Імпорт 2025, грн', yc.import ? esc(String(yc.import).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')) : 'не здійснювався / немає даних', true) + dd('Коди УКТ ЗЕД', yc.zed) + '</dl><p class="mini">YouControl наводить обсяги ЗЕД інтервалом.</p></div>' +
      '<div class="panel"><h3>Транспорт і ліцензії</h3><dl class="kv">' + dd('Транспорт у власності', yc.transport ? A.num(yc.transport) + ' од.' : '—', true) + dd('Чинні ліцензії на перевезення', (yc.lic || []).length ? '<ul class="yc-ul">' + yc.lic.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '—', true) + '</dl></div></div>';
    return h;
  };
  // ---------------------------------------------------------------- v2.9.1: інвестиційний аналіз фінансів (для картки і досьє)
  A.ycAnalysis = function (yc) {
    var F = (yc || {}).f || {}, yrs = A.ycYears(yc).filter(function (p) { return p.length === 4; });
    var g = function (k, y) { var v = (F[k] || {})[y]; return v === undefined || v === null ? null : Number(v); };
    var div = function (a, b) { return a === null || b === null || !b ? null : a / b; };
    var eq = function (y) { var t = g('ta', y); return t === null ? null : t - (g('cl', y) || 0) - (g('ltl', y) || 0); };
    var ser = function (f) { var o = {}; yrs.forEach(function (y) { o[y] = f(y); }); return o; };
    var key = [
      ['Чистий дохід (виручка)', ser(function (y) { return g('rev', y); }), 'uah'], ['Валовий прибуток', ser(function (y) { return g('gp', y); }), 'uah'],
      ['EBITDA / EBIT', ser(function (y) { return g('ebitda', y); }), 'uah'], ['Операційний прибуток', ser(function (y) { return g('op', y); }), 'uah'],
      ['Чистий прибуток (збиток)', ser(function (y) { return g('np', y); }), 'uah'], ['Активи', ser(function (y) { return g('ta', y); }), 'uah'],
      ['Власний капітал (розрахунково: активи − зобов’язання)', ser(eq), 'uah'], ['Зобов’язання (поточні + довгострокові)', ser(function (y) { var a = g('cl', y), b = g('ltl', y); return a === null && b === null ? null : (a || 0) + (b || 0); }), 'uah'],
      ['Чистий борг', ser(function (y) { return g('nd', y); }), 'uah'], ['Гроші та еквіваленти', ser(function (y) { return g('cash', y); }), 'uah'], ['Працівники, осіб', ser(function (y) { return g('emp', y); }), 'n']];
    var ratios = [
      ['Рентабельність', null],
      ['Валова маржа', ser(function (y) { return div(g('gp', y), g('rev', y)); }), '%', 'Валовий прибуток / виручка. Запас на покриття операційних витрат'],
      ['EBITDA-маржа', ser(function (y) { return div(g('ebitda', y), g('rev', y)); }), '%', 'Операційна прибутковість до амортизації; база для оцінки бізнесу за мультиплікатором EV/EBITDA'],
      ['Операційна маржа', ser(function (y) { return div(g('op', y), g('rev', y)); }), '%', 'Результат операційної діяльності / виручка'],
      ['Чиста маржа', ser(function (y) { return div(g('np', y), g('rev', y)); }), '%', 'Чистий прибуток / виручка'],
      ['ROA — рентабельність активів', ser(function (y) { return div(g('np', y), g('ta', y)); }), '%', 'Чистий прибуток / активи'],
      ['ROE — рентабельність власного капіталу', ser(function (y) { var e = eq(y); return e && e > 0 ? div(g('np', y), e) : null; }), '%', 'Чистий прибуток / власний капітал (лише за додатного капіталу)'],
      ['Фінансова стійкість', null],
      ['Чистий борг / EBITDA', ser(function (y) { var e = g('ebitda', y); return e && e > 0 ? div(g('nd', y), e) : null; }), 'x', 'Років операційного прибутку на погашення боргу: до 2 — комфортно, 2–3 — помірно, понад 3 — високе навантаження'],
      ['Зобов’язання / активи', ser(function (y) { var a = g('cl', y), b = g('ltl', y); return a === null && b === null ? null : div((a || 0) + (b || 0), g('ta', y)); }), '%', 'Частка боргового фінансування; понад 100 % — від’ємний власний капітал'],
      ['Власний капітал / активи (автономія)', ser(function (y) { return div(eq(y), g('ta', y)); }), '%', 'Понад 50 % — фінансово незалежна компанія'],
      ['Кредити банків / активи', ser(function (y) { var a = g('lbank', y), b = g('sbank', y); return a === null && b === null ? null : div((a || 0) + (b || 0), g('ta', y)); }), '%', 'Залежність від банківського фінансування (застави майна)'],
      ['Ліквідність', null],
      ['Грошова ліквідність', ser(function (y) { return div(g('cash', y), g('cl', y)); }), 'x', 'Гроші / поточні зобов’язання; норматив 0,2–0,35'],
      ['Швидка ліквідність (гроші + дебіторська)', ser(function (y) { var c = g('cash', y), a = g('ar', y); return c === null && a === null ? null : div((c || 0) + (a || 0), g('cl', y)); }), 'x', 'Наближено: без запасів; норматив 0,7–1,0'],
      ['Ефективність', null],
      ['Оборотність активів', ser(function (y) { return div(g('rev', y), g('ta', y)); }), 'x', 'Виручка на 1 грн активів'],
      ['Виручка на працівника, грн', ser(function (y) { return div(g('rev', y), g('emp', y)); }), 'uah', 'Продуктивність персоналу'],
      ['Середня зарплата, грн / міс.', ser(function (y) { var w = div(g('wage', y), g('emp', y)); return w === null ? null : w / 12; }), 'uah', 'Витрати на оплату праці / працівники / 12'],
      ['Оборот дебіторської заборгованості, днів', ser(function (y) { var r = div(g('ar', y), g('rev', y)); return r === null ? null : r * 365; }), 'd', 'Скільки днів у середньому чекають оплати від покупців'],
      ['Оборот кредиторської заборгованості, днів', ser(function (y) { var r = div(g('ap', y), g('cogs', y)); return r === null ? null : r * 365; }), 'd', 'Скільки днів компанія розраховується з постачальниками']];
    var cagr = function (o, n) { var ys = yrs.filter(function (y) { return o[y] !== null; }); if (ys.length < 2) return null; var y1 = ys[ys.length - 1], y0 = String(+y1 - n); if (o[y0] === null || o[y0] === undefined || o[y0] <= 0 || o[y1] <= 0) return null; return Math.pow(o[y1] / o[y0], 1 / n) - 1; };
    var last = function (o) { var ys = yrs.filter(function (y) { return o[y] !== null; }); return ys.length ? {y: ys[ys.length - 1], v: o[ys[ys.length - 1]], p: o[String(+ys[ys.length - 1] - 1)]} : null; };
    // висновки
    var fl = [], R = key[0][1], NP = key[4][1], EQ = key[6][1], lr = last(R), ln = last(NP), le = last(EQ), pct = function (v) { return A.num(v * 100, 1) + ' %'; };
    var lastY = yrs.length ? yrs[yrs.length - 1] : null;
    if (!yrs.length) fl.push(['bad', 'Фінансова звітність у YouControl відсутня — оцінка фінансового стану неможлива; потрібні дані з ДПС / балансу або запит до товариства.']);
    if (lastY && +lastY < 2024) fl.push(['bad', 'Остання доступна звітність — за ' + lastY + ' рік: товариство не звітує, дані застарілі.']);
    if (lr) { var c3 = cagr(R, 3), c5 = cagr(R, 5); if (c3 !== null) fl.push([c3 >= 0.05 ? 'good' : c3 <= -0.1 ? 'bad' : 'warn', 'Виручка ' + lr.y + ': ' + ycv(lr.v) + ' грн; середньорічна зміна за 3 роки (CAGR) ' + pct(c3) + (c5 !== null ? ', за 5 років ' + pct(c5) : '') + '.']);
      else if (lr.p) fl.push([lr.v >= lr.p ? 'good' : 'warn', 'Виручка ' + lr.y + ': ' + ycv(lr.v) + ' грн (' + (lr.v >= lr.p ? '+' : '') + pct((lr.v - lr.p) / Math.abs(lr.p)) + ' до попереднього року).']); }
    else if (yrs.length) fl.push(['warn', 'Виручка у звітності відсутня — товариство не веде операційної діяльності або звітує за спрощеною формою.']);
    if (ln) { var l3 = yrs.slice(-3).filter(function (y) { return NP[y] !== null && NP[y] < 0; }).length; fl.push([ln.v > 0 && !l3 ? 'good' : l3 >= 2 ? 'bad' : 'warn', 'Чистий ' + (ln.v >= 0 ? 'прибуток' : 'збиток') + ' ' + ln.y + ': ' + ycv(ln.v) + ' грн' + (l3 ? '; збиткових років з останніх трьох: ' + l3 : '; останні три роки прибуткові') + '.']); }
    if (le) fl.push([le.v < 0 ? 'bad' : 'good', le.v < 0 ? 'Власний капітал від’ємний (' + ycv(le.v) + ' грн у ' + le.y + '): зобов’язання перевищують активи — ризик неплатоспроможності; вартість частки може бути близькою до нуля.' : 'Власний капітал ' + le.y + ': ' + ycv(le.v) + ' грн (орієнтир балансової вартості 100 % статутного капіталу).']);
    var leb = last(key[2][1]), lnd = last(key[8][1]), nde = leb && leb.v > 0 && ratios[8][1][leb.y] !== null ? {y: leb.y, v: ratios[8][1][leb.y]} : null;
    if (leb && leb.v <= 0) fl.push([lnd && lnd.v > 0 ? 'bad' : 'warn', 'EBITDA ' + leb.y + ' від’ємна (' + ycv(leb.v) + ' грн)' + (lnd && lnd.v > 0 ? ' за наявності чистого боргу ' + ycv(lnd.v) + ' грн — борг не обслуговується операційним прибутком.' : ' — операційна діяльність збиткова.')]);
    if (nde) fl.push([nde.v <= 2 ? 'good' : nde.v <= 3 ? 'warn' : 'bad', 'Чистий борг / EBITDA ' + nde.y + ': ' + A.num(nde.v, 2) + ' — ' + (nde.v <= 0 ? 'чистий борг відсутній.' : nde.v <= 2 ? 'боргове навантаження комфортне.' : nde.v <= 3 ? 'помірне боргове навантаження.' : 'високе боргове навантаження.')]);
    var ql = last(ratios[14][1]); if (ql) fl.push([ql.v >= 0.7 ? 'good' : ql.v >= 0.4 ? 'warn' : 'bad', 'Швидка ліквідність ' + ql.y + ': ' + A.num(ql.v, 2) + (ql.v < 0.4 ? ' — низька: ризик неплатежів за поточними зобов’язаннями.' : ql.v < 0.7 ? ' — нижче нормативу.' : ' — у межах нормативу.')]);
    var em = last(key[10][1]); if (em && em.p) fl.push([em.v >= em.p ? 'good' : (em.v - em.p) / em.p < -0.2 ? 'bad' : 'warn', 'Працівників ' + em.y + ': ' + A.num(em.v) + ' (' + A.num(em.p) + ' у ' + (+em.y - 1) + ').']);
    if (yc && /банкрут/i.test(yc.status || '')) fl.push(['bad', 'Стан у ЄДР: ' + yc.status + '.']); else if (yc && /припин/i.test(yc.status || '') && !/не перебуває/i.test(yc.status || '')) fl.push(['bad', 'Стан у ЄДР: ' + yc.status + '.']);
    if (yc && /наявн/i.test(yc.sanctions || '')) fl.push(['bad', 'YouControl має інформацію про санкції щодо товариства або пов’язаних осіб.']);
    if (yc && (yc.fs || yc.ms || yc.ea)) fl.push([/^[AB]/.test(yc.fs || '') ? 'good' : /^[DE]/.test(yc.fs || '') ? 'bad' : 'warn', 'Оцінки YouControl: FinScore ' + (yc.fs || '—') + ', MarketScore ' + (yc.ms || '—') + ', Експрес-аналіз ' + (yc.ea || '—') + '.']);
    return {years: yrs, key: key, ratios: ratios, flags: fl, cagr: cagr, last: last};
  };
  function rv(v, u) { if (v === null || v === undefined || !isFinite(v)) return '—'; if (u === '%') return A.num(v * 100, 1) + ' %'; if (u === 'x') return A.num(v, 2); if (u === 'd') return A.num(v); if (u === 'n') return A.num(v); return ycv(v); }
  A.ycInvestorHtml = function (yc) {
    var an = A.ycAnalysis(yc), ys = an.years.slice(-6); if (!ys.length) return '';
    var FL = {good: 'ok', warn: 'lim', bad: 'lost'};
    return '<div class="grid g2 yc-inv" style="margin-top:14px"><div class="panel"><h3>Інвестиційний огляд <span>автоматичні висновки за звітністю</span></h3><ul class="yc-flags">' + an.flags.map(function (f) { return '<li class="f-' + FL[f[0]] + '">' + esc(f[1]) + '</li>'; }).join('') + '</ul>' +
      '<p class="mini">Висновки сформовано автоматично за даними YouControl і не є оцінкою вартості. Для оцінки частки — звіт суб’єкта оціночної діяльності.</p></div>' +
      '<div class="panel"><h3>Ключові коефіцієнти</h3><div class="yc-tbl"><table class="yc-kt"><thead><tr><th>Коефіцієнт</th>' + ys.map(function (y) { return '<th class="num">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' +
      an.ratios.map(function (r) { if (!r[1]) return '<tr class="grp"><td colspan="' + (ys.length + 1) + '">' + esc(r[0]) + '</td></tr>'; if (!ys.some(function (y) { return r[1][y] !== null; })) return '';
        return '<tr><td title="' + esc(r[3] || '') + '">' + esc(r[0]) + '</td>' + ys.map(function (y) { var v = r[1][y]; return '<td class="num' + (v < 0 ? ' neg' : '') + '">' + rv(v, r[2]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><p class="mini">Наведіть курсор на назву коефіцієнта — пояснення і норматив.</p></div></div>';
  };
  // аркуші досьє: «Інвестиційний огляд», «Фінанси» (звітність), «YouControl»
  A.ycInvestorSheets = function (c) {
    var yc = (c || {}).yc || {}; if (!yc.date) return [];
    var an = A.ycAnalysis(yc), ys = an.years, per = A.ycYears(yc), F = yc.f || {}, n = function (v) { return v === null || v === undefined || !isFinite(v) ? null : v; };
    var NF = {uah: 6, n: 6, '%': 7, x: 8, d: 6}, W = ys.length + 4, rows = [];
    var SEC = function (t, w) { var r = [{v: t, s: 5}]; for (var i = 1; i < w; i++) r.push({v: null, s: 5}); r.merge = [0, w - 1]; return r; };
    var ML = function (r, a, ht) { r.merge = [a, W - 1]; if (ht) r.ht = ht; return r; };
    rows.push(ML([{v: 'Товариство: ' + (c.name || c.edrpou) + ' · ЄДРПОУ ' + c.edrpou, s: 9}], 0));
    rows.push(ML([{v: 'Стан: ' + (c.status || yc.status || '—') + ' · Сфера: ' + (yc.sphere || '—') + ' · Категорія: ' + (yc.size || '—') + ' · КВЕД ' + (c.kved || '') + ' ' + (c.kved_name || ''), s: 10}], 0, 26));
    rows.push(ML([{v: 'Оцінки YouControl: MarketScore ' + (yc.ms || '—') + ' · FinScore ' + (yc.fs || '—') + ' · Експрес-аналіз ' + (yc.ea || '—') + ' · Санкції: ' + (yc.sanctions || '—') + ' · Частка АРМА: ' + (c.share_total ? A.num(c.share_total, 2) + ' %' : '—'), s: 10}], 0, 26));
    rows.push([]);
    rows.push(SEC('1. ВИСНОВКИ', W));
    an.flags.forEach(function (f) { var r = [{v: {good: '▲ позитивно', warn: '● увага', bad: '▼ ризик'}[f[0]], s: {good: 11, warn: 12, bad: 13}[f[0]]}, {v: f[1], s: 2}]; for (var i = 2; i < W; i++) r.push({v: null, s: 2}); rows.push(ML(r, 1, Math.max(15, Math.ceil(f[1].length / 105) * 14))); });
    rows.push([]);
    rows.push(SEC('2. КЛЮЧОВІ ПОКАЗНИКИ, грн', W));
    rows.push([{v: 'Показник', s: 1}].concat(ys.map(function (y) { return {v: y, s: 1}; })).concat([{v: 'Зміна за останній рік', s: 1}, {v: 'CAGR 3 роки', s: 1}, {v: 'CAGR 5 років', s: 1}]));
    an.key.forEach(function (k) { var o = k[1], l = an.last(o); if (!l) return;
      rows.push([{v: k[0], s: 9}].concat(ys.map(function (y) { return {v: n(o[y]), s: NF[k[2]]}; })).concat([{v: l.p ? n((l.v - l.p) / Math.abs(l.p)) : null, s: 7}, {v: n(an.cagr(o, 3)), s: 7}, {v: n(an.cagr(o, 5)), s: 7}])); });
    rows.push([]);
    rows.push(SEC('3. КОЕФІЦІЄНТИ', W));
    rows.push(ML([{v: 'Коефіцієнт', s: 1}].concat(ys.map(function (y) { return {v: y, s: 1}; })).concat([{v: 'Як читати / норматив', s: 1}, {v: null, s: 1}, {v: null, s: 1}]), ys.length + 1));
    an.ratios.forEach(function (r) { if (!r[1]) { rows.push(SEC(r[0], W)); return; }
      if (!ys.some(function (y) { return r[1][y] !== null; })) return;
      rows.push(ML([{v: r[0], s: 9}].concat(ys.map(function (y) { return {v: n(r[1][y]), s: NF[r[2]]}; })).concat([{v: r[3], s: 10}]), ys.length + 1, (r[3] || '').length > 70 ? 28 : null)); });
    rows.push([]);
    rows.push([{v: 'Джерело: YouControl (YC.Market), вивантаження від ' + A.dt(yc.date) + '. Суми — у гривнях; власний капітал розраховано як активи − поточні − довгострокові зобов’язання; швидка ліквідність — без запасів (у вивантаженні відсутні). Висновки сформовано автоматично і не є оцінкою вартості.', s: 10}]);
    rows[rows.length - 1] = ML(rows[rows.length - 1], 0, 40);
    var cols = [{h: 'Показник', w: 44}].concat(ys.map(function () { return {h: '', w: 14}; })).concat([{h: '', w: 14}, {h: '', w: 12}, {h: '', w: 12}]); cols[cols.length - 1].w = 12;
    var inv = {name: 'Інвестиційний огляд', title: 'Інвестиційний огляд · ' + (c.name || c.edrpou) + ' · дані YouControl на ' + A.dt(yc.date), cols: cols, rows: rows, noFilter: true, noHead: true};
    // звітність
    var fr = [];
    YCF.forEach(function (gr) { var rs = gr[1].filter(function (r) { return F[r[0]]; }); if (!rs.length) return; fr.push([{v: gr[0], s: 5}].concat(per.map(function () { return {v: null, s: 5}; })));
      rs.forEach(function (r) { fr.push([{v: r[1] + (r[2] === '%' ? '' : r[2] === 'n' ? ', осіб' : r[2] === 'x' ? ', разів' : ', грн'), s: 2}].concat(per.map(function (p) { var v = F[r[0]][p]; return {v: v === undefined ? null : r[2] === '%' ? v / 100 : v, s: r[2] === '%' ? 7 : r[2] === 'x' ? 8 : 6}; }))); }); });
    var fin = fr.length ? {name: 'Фінансова звітність', title: 'Фінансова звітність (YouControl), грн · ' + (c.name || c.edrpou), cols: [{h: 'Показник', w: 46}].concat(per.map(function (p) { return {h: A.ycPer(p), w: 15}; })), rows: fr, noFilter: true} : null;
    return [inv].concat(fin ? [fin] : []).concat(A.ycSheets(c).slice(0, 1));
  };
  // усі активи Реєстру, пов’язані з товариством (як у вибірці за переліком ЄДРПОУ 10.11.2026)
  var allIdx = null, allKey = null;
  A.companyAllAssets = function (code) {
    var T = A.T('assets'), now = Date.now();
    if (!allIdx || now - allKey > 3000 || allIdx._t !== T) {   // перебудова не частіше ніж раз на 3 с (звіт по всіх товариствах — один прохід)   // індекс ЄДРПОУ → пов’язані активи (один прохід по Реєстру)
      allIdx = {_t: T}; allKey = now;
      var add = function (c, a) { if (c) (allIdx['k' + c] = allIdx['k' + c] || []).push(a); };
      T.forEach(function (a) { if (!A.inScope(a)) return; var d = a.details || {}; add(a.company_code, a); if (a.owner_code && a.owner_code !== a.company_code) add(a.owner_code, a); if (a.category === 'corporate' && d.founder_code && d.founder_code !== a.company_code && d.founder_code !== a.owner_code) add(String(d.founder_code), a); });
    }
    var out = [], seen = {};
    (allIdx['k' + code] || []).forEach(function (a) { var d = a.details || {}, rel = [];
      if (a.company_code === code) rel.push(/акці|цінн/i.test(a.name || '') ? 'акції товариства' : 'частка в товаристві');
      if (a.owner_code === code && a.company_code !== code) rel.push('майно товариства (власник / боржник)');
      if (a.category === 'corporate' && String(d.founder_code || '') === code && a.company_code !== code && a.owner_code !== code) rel.push('частка товариства в іншій юрособі');
      if (rel.length && !seen[a.id]) { seen[a.id] = 1; out.push({a: a, rel: rel.join('; ')}); } });
    return out.sort(function (x, y) { return (x.rel > y.rel ? 1 : x.rel < y.rel ? -1 : 0) || String(x.a.asset_no).localeCompare(String(y.a.asset_no)); });
  };
  A.companyAllHtml = function (code) {
    var L = A.companyAllAssets(code); if (!L.length) return '<div class="empty">Активів Реєстру, пов’язаних з товариством, не знайдено.</div>';
    var cnt = function (f) { var o = {}; L.forEach(function (x) { var k = f(x); o[k] = (o[k] || 0) + 1; }); return o; }, byRel = cnt(function (x) { return x.rel; }), byCat = cnt(function (x) { return N.CAT[x.a.category] || x.a.category || '—'; }), byZ = cnt(function (x) { return x.a.zone || 'без зони'; });
    var chips = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return '<span class="pill yc-chip">' + esc(k) + ' · ' + o[k] + '</span>'; }).join(' '); };
    var val = L.reduce(function (s, x) { var v = A.assetValuation(x.a); return s + ((v && v.v && v.v.value_uah) || 0); }, 0);
    return '<div class="grid g4" style="margin-top:14px">' + A.kpi('Усього записів', A.num(L.length), 'пов’язаних з товариством') + A.kpi('Частки / акції в товаристві', A.num((byRel['частка в товаристві'] || 0) + (byRel['акції товариства'] || 0)), 'корпоративні права') +
      A.kpi('Майно товариства', A.num(L.filter(function (x) { return /майно/.test(x.rel); }).length), 'товариство — власник / боржник') + A.kpi('Оцінка (актуальні звіти)', val ? A.money(val) : '—', 'сума за пов’язаними активами') + '</div>' +
      '<div class="panel" style="margin-top:14px"><dl class="kv">' + dd('За зв’язком', chips(byRel), true) + dd('За категоріями', chips(byCat), true) + dd('За зонами', chips(byZ), true) + '</dl></div>' +
      '<div class="wrap-tbl" style="margin-top:14px"><table><thead><tr><th>№ у Реєстрі</th><th>Найменування</th><th>Категорія</th><th>Зв’язок з товариством</th><th class="num">Частка</th><th>Зона</th><th>Відділ ДМА / МТУ</th><th>Правовий стан</th><th>Ухвали і рішення</th></tr></thead><tbody>' +
      L.slice(0, 500).map(function (x) { var a = x.a, d = a.details || {}; return '<tr><td class="nowrap"><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a></td><td><span class="clip" title="' + esc(a.name) + '">' + esc(a.name || '') + '</span>' + (a.owner_name && !/частка|акції/.test(x.rel) ? '' : '') + '</td><td class="mini">' + esc(N.CAT[a.category] || '') + '</td><td class="mini">' + esc(x.rel) + '</td>' +
        '<td class="num">' + (d.share_pct ? A.num(d.share_pct, 3) + ' %' : '—') + '</td><td>' + A.zone(a.zone, true) + '</td><td class="mini">' + esc([N.DMA_SHORT[a.dept_code], N.MTU[a.mtu_code]].filter(Boolean).join(' · ')) + '</td><td>' + A.legal(a.legal_status) + '</td><td class="mini">' + esc(String(A.rulingsLine(a) || '').split('\n').slice(-2).join('\n')) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (L.length > 500 ? '<p class="mini">Показано 500 з ' + L.length + '; повний перелік — у «Досьє XLSX», аркуш «Усі активи».</p>' : '');
  };
})();
