/* Управління активами (договори управління, звіти управителів, справи ВАКС, плани управління) і реалізація активів
   (лоти, аукціони, помісячний облік надходжень, плани реалізації) — зауваження 21.10.2026, пп. 12-13.
   Структура полів — за Методичними рекомендаціями щодо обліку надходжень від управління активами (графи 1-245)
   і щодо обліку надходжень від реалізації арештованих активів (графи 1-168); звіти — у формі додатків до наказів. */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S, dd = A.dd;
  var MON = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  var MON3 = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  function nz(v) { return Number(v) || 0; }
  function sumf(list, f) { return list.reduce(function (s, r) { return s + nz(typeof f === 'function' ? f(r) : r[f]); }, 0); }
  function words(q) { return (q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6); }
  function match(s, w) { s = (s || '').toLowerCase(); return w.every(function (x) { return s.indexOf(x) >= 0; }); }
  function yearNow() { return +A.today().slice(0, 4); }
  function years() { var y = yearNow(), out = []; for (var i = 2025; i <= Math.max(2030, y + 1); i++) out.push(i); return out; }
  function same(a, b) { return (a === null || a === undefined ? '' : String(a)) === (b === null || b === undefined ? '' : String(b)); }
  function money(v) { return v ? A.money(v) : '—'; }
  function canMgmt() { return A.can('mgmt_edit'); }
  function canSales() { return A.can('sales_edit'); }
  function seeMgmt() { return ['mgmt_view', 'mgmt_edit', 'mgmt_monitor', 'mgmt_legal', 'vaks_edit', 'system'].some(A.can); }
  function seeSales() { return ['sales_view', 'sales_edit', 'system'].some(A.can); }

  A.NAV.push({group: 'Управління і реалізація', items: [
    {href: '/mgmt', label: 'Управління активами', match: '/mgmt', show: seeMgmt},
    {href: '/sales', label: 'Реалізація активів', match: '/sales', show: seeSales}]});

  // ================================================================ поля (графи форми)
  // [поле, назва, тип (text|num|int|date|area|sel), опції]
  var CF = {
    info: [['seq_no', '1. № з/п у формі обліку', 'int'], ['contract_title', '2. Договір управління (номер, дата укладання)', 'area'], ['addenda', '2. Додаткові угоди (номери, дати)', 'area'],
      ['manager_name', '3. Управитель (найменування / ПІБ)', 'text'], ['manager_code', '3. Код ЄДРПОУ / РНОКПП управителя', 'text'], ['asset_description', '4. Актив (характеристика, місцезнаходження, реєстраційні номери)', 'area'],
      ['asset_type', 'Вид активу', 'text'], ['asset_location', 'Місцезнаходження активу', 'text'], ['asset_count', 'Кількість активів', 'int'], ['estimated_value', 'Оціночна вартість, грн', 'num'],
      ['ruling', '5. Ухвала (підстава передачі в управління): суд, дата, справа', 'area'], ['rulings_count', 'Кількість ухвал', 'int'], ['validity', '6. Термін дії договору (або дата припинення)', 'text'], ['validity_date', '6. Дата закінчення дії договору', 'date'],
      ['conclusion_date', '7. Дата укладання договору', 'date'], ['transfer_date', '8. Дата фактичної передачі активу в управління', 'text'], ['transfer_note', '8. Заходи щодо підписання актів приймання-передачі', 'area'],
      ['program_status', '9. Програма управління / орієнтовний план (є, немає, зауваження, реквізити листа)', 'area'], ['remuneration_terms', '10. Винагорода управителя (на місяць)', 'text'],
      ['planned_monthly_budget', '11. Запланований обсяг надходжень до бюджету на місяць (умова договору)', 'text'], ['planned_monthly', '11. Запланований обсяг надходжень, грн / міс (число — для плану на графіках)', 'num'],
      ['guarantee_monthly', '12. Гарантійний платіж, грн / міс', 'num'], ['total_transferred_start', '13. Перераховано до бюджету за весь період станом на 01.01.2026, грн', 'num'],
      ['debt_start', '14. Заборгованість на 01.01.2026 по надходженнях до бюджету, грн', 'num'], ['owner', 'Власник активу', 'text'], ['is_foreign', 'Актив за кордоном (розділ IV)', 'sel', [['0', 'Ні'], ['1', 'Так']]],
      ['status', 'Стан договору', 'sel', [['active', 'Діючий'], ['terminated', 'Припинено'], ['archived', 'Архів']]], ['close_date', 'Дата припинення', 'date'], ['close_reason', 'Підстава припинення', 'text'], ['termination_info', 'Відомості про припинення / розірвання', 'area'], ['note', 'Примітка', 'area']],
    monitor: [['prescription_ref', '231. Винесено припис / вимогу (номер, дата)', 'area'], ['prescription_debt_total', '232. Сума заборгованості — всього, грн', 'num'], ['prescription_debt_guarantee', '233. у т.ч. сума гарантійного платежу, грн', 'num'],
      ['prescription_debt_sanctions', '234. у т.ч. штрафні та фінансові санкції, грн', 'num'], ['prescription_execution', '235. Виконання припису (платіжне доручення, дата, номер, сума)', 'area']],
    legal: [['lawsuit_ref', '236. Направлено позов до суду (номер, дата)', 'area'], ['claim_total', '237. Загальна сума до стягнення, грн', 'num'], ['claim_debt', '238. у т.ч. заборгованість, грн', 'num'],
      ['claim_sanctions', '239. у т.ч. штрафні та фінансові санкції, грн', 'num'], ['case_status', '240. Стан розгляду справи (ухвала, рішення тощо)', 'area'], ['execution_status', '241. Стан виконання судового рішення', 'area']],
    resp: [['resp_dma', '242. Відповідальний виконавець від Департаменту менеджменту активів (ПІБ, телефон)', 'text'], ['resp_ukem', '243. … від Управління з контролю за ефективністю менеджменту', 'text'],
      ['resp_dpz', '244. … від Департаменту правового забезпечення', 'text'], ['resp_dms', '245. … від Департаменту міжнародного співробітництва (активи за кордоном)', 'text']]
  };
  var MF = {
    report: [['income_report', '15. Дохід за звітом управителя'], ['expenses_report', '16. Витрати за звітом'], ['expenses_approved', '17. Погоджені з АРМА витрати'], ['remuneration_report', '18. Винагорода управителя'],
      ['transferred_total_report', '19. Перераховано до бюджету — всього'], ['transferred_guarantee', '20. у т.ч. гарантований платіж'], ['transferred_mgmt', '21. у т.ч. надходження за результатами періоду']],
    budget: [['guarantee_deviation', '22. Відхилення сплати гарант. платежу від договору'], ['treasury_transferred', '23. Перераховано за даними казначейства'], ['forecast_budget', 'Прогноз надходжень на наступний місяць'], ['note', 'Пояснення', 'text']],
    debt: [['debt_date_info', '24. Дата виникнення заборгованості / інші показники', 'text'], ['debt_total', '25. Заборгованість — всього'], ['debt_guarantee', '26. у т.ч. гарантійний платіж'], ['debt_inflation', '27. у т.ч. інфляційні втрати'],
      ['debt_penalty', '28. у т.ч. пеня'], ['debt_interest', '29. у т.ч. % річних'], ['debt_fine', '30. у т.ч. % штрафу']],
    monitor: [['monitoring_debt_sum', '31. Заборгованість за результатами моніторингу, сума'], ['monitoring_debt_period', '32. Період, за який встановлено', 'text']]
  };
  var MF_ALL = [].concat(MF.report, MF.budget.slice(0, 2), MF.debt, MF.monitor);   // графи 15-32 у порядку форми
  function canGroup(g) {
    if (A.can('system')) return true;
    if (g === 'monitor') return A.can('mgmt_monitor');
    if (g === 'legal') return A.can('mgmt_legal');
    return canMgmt();
  }
  // v2.6: картка відкривається в режимі перегляду (без полів вводу); поля — лише після «Редагувати»
  function viewVal(f, v) {
    if (v === null || v === undefined || v === '') return '<span class="mini">—</span>';
    if (f[2] === 'sel') { var o = f[3].filter(function (x) { return String(x[0]) === String(v); })[0]; return esc(o ? o[1] : v); }
    if (f[2] === 'num') return A.num(v, 2);
    if (f[2] === 'int') return A.num(v);
    if (f[2] === 'date') return A.dt(v);
    return '<span class="pre">' + esc(v) + '</span>';
  }
  function formFields(rec, list, editable) {
    var F = A.field, S2 = A.fsel;
    if (!editable) return '<dl class="vgrid">' + list.map(function (f) { return '<div class="' + (f[2] === 'area' ? 'wide' : '') + '"><dt>' + esc(f[1]) + '</dt><dd>' + viewVal(f, rec[f[0]]) + '</dd></div>'; }).join('') + '</dl>';
    return '<div class="form-grid">' + list.map(function (f) {
      var v = rec[f[0]];
      if (f[2] === 'sel') return S2(f[1], f[0], f[3], v === null || v === undefined ? f[3][0][0] : String(v), 0, '', '', '', null);
      if (f[2] === 'area') return F(f[1], f[0], v, 'textarea', 0, '', 'wide', '');
      return F(f[1], f[0], v, f[2] === 'date' ? 'date' : 'text', 0, '', '', (f[2] === 'num' || f[2] === 'int' ? 'inputmode="decimal"' : ''));
    }).join('') + '</div>';
  }
  function cleanRec(d, list) {
    var o = {}; list.forEach(function (f) { if (!(f[0] in d)) return; var v = typeof d[f[0]] === 'string' ? d[f[0]].trim() : d[f[0]]; if (v === '') v = null;
      if (v !== null && (f[2] === 'num' || f[2] === 'int')) { var n = A.parseNum(v); if (n === null) throw new Error('«' + f[1] + '»: потрібне число'); v = f[2] === 'int' ? Math.round(n) : n; }
      if (v !== null && f[2] === 'sel' && /^\d+$/.test(v) && f[0] === 'is_foreign') v = +v;
      o[f[0]] = v; });
    return o;
  }
  function diffPut(tx, t, old, rec) { var p = {id: old.id}, n = 0; Object.keys(rec).forEach(function (k) { if (!same(old[k], rec[k])) { p[k] = rec[k]; n++; } }); if (n) { p.updated_at = A.nowS(); p.updated_by = S.user && S.user.login; tx.put(t, p); } return n; }

  // ================================================================ розрахунки
  // Факт надходжень до бюджету — ЛИШЕ графа 23 «за даними казначейства» (звітність верхнього рівня); графа 19 — для порівняння
  function monthly(cid, y) { return (A.indexes.monthlyByContract[cid] || []).filter(function (m) { return !y || m.year === y; }); }
  function mrec(cid, y, m) { return (A.indexes.monthlyByContract[cid] || []).filter(function (r) { return r.year === y && r.month === m; })[0]; }
  function fact(r) { return r ? nz(r.treasury_transferred) : 0; }
  function factRep(r) { return r ? nz(r.transferred_total_report) : 0; }
  function planOf(c) { return nz(c.planned_monthly) || nz(c.guarantee_monthly); }
  function isActive(c) { return (c.status || 'active') === 'active'; }
  function mkey(y, m) { return y * 100 + m; }
  function monthsOf(c) { return A.indexes.monthlyByContract[c.id] || []; }
  // діяв у місяці: укладений не пізніше кінця місяця і не припинений до його початку; архівний / припинений без дати — не діяв
  function activeIn(c, y, m) {
    var ms = y + '-' + ('0' + m).slice(-2), st = c.status || 'active';
    if (c.conclusion_date && c.conclusion_date.slice(0, 7) > ms) return false;
    if (c.close_date) return c.close_date.slice(0, 7) >= ms;
    return st === 'active';
  }
  function moneyIn(c, P) { return P.months.some(function (x) { return fact(mrec(c.id, x.y, x.m)) > 0; }); }
  function activeInPeriod(c, P) { return P.months.some(function (x) { return activeIn(c, x.y, x.m); }) || moneyIn(c, P); }
  function lastDebt(c, upto) { var rs = monthsOf(c).filter(function (r) { return r.debt_total !== null && r.debt_total !== undefined && (!upto || mkey(r.year, r.month) <= upto); }).sort(function (a, b) { return b.year - a.year || b.month - a.month; }); return rs.length ? rs[0] : null; }
  function debtOf(r) { return r ? (r.debt_total !== null && r.debt_total !== undefined ? nz(r.debt_total) : nz(r.debt_guarantee) + nz(r.debt_inflation) + nz(r.debt_penalty) + nz(r.debt_interest) + nz(r.debt_fine)) : 0; }
  // перераховано з початку дії договору: графа 13 (на 01.01.2026) + казначейство з січня 2026 по кінець періоду
  function cumOf(c, upto) { return nz(c.total_transferred_start) + sumf(monthsOf(c).filter(function (r) { return r.year >= 2026 && mkey(r.year, r.month) <= upto; }), fact); }
  A.contractCode = function (c) { return (c.contract_no && !/^row\d+$/.test(c.contract_no) ? c.contract_no : 'ДУ-' + ('00' + (c.seq_no || c.id)).slice(-3)); };
  function cTitle(c) { return (c.contract_title || '').replace(/^Договір управління (активами|майном) ?(\((майном|активами)\))? ?/i, 'Договір '); }
  function vaksOf(c) { return (c.vaks_ids || '').split(',').filter(Boolean).map(function (i) { return A.get('vaks_cases', +i); }).filter(Boolean); }
  function contractsOfVaks(v) { return A.T('mgmt_contracts').filter(function (c) { return (',' + (c.vaks_ids || '') + ',').indexOf(',' + v.id + ',') >= 0; }); }
  function mgrKey(c) { var m = String(c.manager_code || '').match(/\d{8,10}/); return m ? m[0] : (c.manager_name || '—').trim().toLowerCase(); }

  // ---------------------------------------------------------------- період (з місяця по місяць, до 24 місяців)
  function ym(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})$/); return m ? [+m[1], +m[2]] : null; }
  A.mgmtPeriod = function (f, maxLen) {
    var t = A.today(), cy = +t.slice(0, 4), cm = +t.slice(5, 7), a = ym(f.from) || [cy, 1], b = ym(f.to) || [cy, cm];
    if (mkey(a[0], a[1]) > mkey(b[0], b[1])) { var x = a; a = b; b = x; }
    var months = [], y = a[0], m = a[1];
    while (mkey(y, m) <= mkey(b[0], b[1]) && months.length < (maxLen || 24)) { months.push({y: y, m: m, label: MON3[m - 1] + ' ' + String(y).slice(2), full: MON[m - 1] + ' ' + y}); m++; if (m > 12) { m = 1; y++; } }
    var last = months[months.length - 1];
    return {months: months, from: a[0] + '-' + ('0' + a[1]).slice(-2), to: last.y + '-' + ('0' + last.m).slice(-2), end: mkey(last.y, last.m), title: months.length === 1 ? months[0].full : months[0].full + ' — ' + last.full};
  };
  function periodBar(base, f, P, extra) {
    var cy = +A.today().slice(0, 4), cm = +A.today().slice(5, 7), q = function (o) { return A.link(base, Object.assign({}, f, o, {page: null})); };
    var pp = [['Поточний рік', cy + '-01', cy + '-' + ('0' + cm).slice(-2)], ['Минулий рік', (cy - 1) + '-01', (cy - 1) + '-12'], ['I кв.', cy + '-01', cy + '-03'], ['II кв.', cy + '-04', cy + '-06'], ['III кв.', cy + '-07', cy + '-09'], ['IV кв.', cy + '-10', cy + '-12']];
    return '<form class="filters period-bar" data-act="filter" data-base="' + base + '">' + Object.keys(f).filter(function (k) { return ['from', 'to', 'page'].indexOf(k) < 0 && f[k]; }).map(function (k) { return '<input type="hidden" name="' + esc(k) + '" value="' + esc(f[k]) + '">'; }).join('') +
      '<span class="mini">Період:</span><label class="mini">з ' + A.monthPick('from', P.from, true) + '</label><label class="mini">по ' + A.monthPick('to', P.to, true) + '</label><button class="btn sm">Показати</button>' +
      '<span class="chips-filter">' + pp.map(function (p) { return '<a href="' + q({from: p[1], to: p[2]}) + '" class="' + (P.from === p[1] && P.to === p[2] ? 'on' : '') + '">' + p[0] + '</a>'; }).join('') + '</span>' + (extra || '') + '</form>';
  }
  function series(list, P) {   // план / прогноз / факт / звіти / дохід / витрати за місяцями періоду
    var o = {plan: [], forecast: [], fact: [], rep: [], income: [], exp: []};
    P.months.forEach(function (x) {
      var p = 0, fc = 0, fa = 0, rp = 0, inc = 0, ex = 0;
      list.forEach(function (c) { if (activeIn(c, x.y, x.m)) p += planOf(c); var prev = x.m === 1 ? mrec(c.id, x.y - 1, 12) : mrec(c.id, x.y, x.m - 1); fc += prev ? nz(prev.forecast_budget) : 0;
        var r = mrec(c.id, x.y, x.m); fa += fact(r); rp += factRep(r); if (r) { inc += nz(r.income_report); ex += nz(r.expenses_report); } });
      o.plan.push(Math.round(p)); o.forecast.push(Math.round(fc)); o.fact.push(Math.round(fa * 100) / 100); o.rep.push(Math.round(rp * 100) / 100); o.income.push(Math.round(inc)); o.exp.push(Math.round(ex));
    });
    return o;
  }
  function tot(a) { return a.reduce(function (s, v) { return s + (Number(v) || 0); }, 0); }

  // ================================================================ розділ «Управління активами»
  A.on(/^\/mgmt$/, function (f) {
    if (!seeMgmt()) return A.deny();
    var tab = f.tab || 'analytics', all = A.T('mgmt_contracts'), P = A.mgmtPeriod(f), act = all.filter(isActive), on = f.act === '1', L = on ? act : all;
    var T = function (k, l, n) { return '<a href="' + A.link('/mgmt', Object.assign(k === 'analytics' ? {} : {tab: k}, on ? {act: 1} : {}, f.from ? {from: f.from, to: f.to} : {})) + '" class="' + (tab === k ? 'on' : '') + '">' + l + (n !== undefined ? ' <span class="pill">' + A.num(n) + '</span>' : '') + '</a>'; };
    var fa = sumf(L, function (c) { return sumf(P.months, function (x) { return fact(mrec(c.id, x.y, x.m)); }); }), rp = sumf(L, function (c) { return sumf(P.months, function (x) { return factRep(mrec(c.id, x.y, x.m)); }); });
    var g13 = sumf(L, 'total_transferred_start'), cum = sumf(L, function (c) { return cumOf(c, P.end); });
    var debt = sumf(L, function (c) { var r = lastDebt(c, P.end); return r ? debtOf(r) : nz(c.debt_start); });
    var base = Object.assign({}, f); delete base.act; delete base.page;
    var h = '<div class="grid g5">' +
      '<div class="panel kpi kpi-ct' + (on ? ' on' : '') + '"><h3>Договори управління</h3><div class="kpi-pair"><a href="' + A.link('/mgmt', base) + '" class="' + (on ? '' : 'sel') + '" title="Показати аналітику за всіма договорами"><b>' + A.num(all.length) + '</b><small>усього</small></a>' +
        '<a href="' + A.link('/mgmt', Object.assign({}, base, {act: 1})) + '" class="act' + (on ? ' sel' : '') + '" title="Натисніть — аналітика лише за діючими договорами"><b>' + A.num(act.length) + '</b><small>діючих</small></a></div><div class="d">' + (on ? 'показано діючі договори · натисніть «усього», щоб повернути всі' : 'натисніть «діючих» — аналітика за діючими') + '</div></div>' +
      A.kpi('Перераховано до бюджету за період', money(fa), 'казначейство (гр. 23) · ' + P.title + ' · за звітами управителів (гр. 19): ' + money(rp)) +
      A.kpi('Перераховано з початку дії договорів', money(cum), 'гр. 13 на 01.01.2026 (' + money(g13) + ') + казначейство з січня 2026 по ' + P.months[P.months.length - 1].full) +
      A.kpi('Гарантійні платежі', money(sumf(L.filter(isActive), 'guarantee_monthly')), 'на місяць за діючими договорами (гр. 12)') +
      A.kpi('Заборгованість управителів', money(debt), 'на кінець періоду (гр. 25)', A.link('/mgmt', {tab: 'contracts', debt: 1}), 'overdue') + '</div>';
    h += '<div class="tabs cat-tabs" style="margin:16px 0 12px">' + T('analytics', 'Аналітика') + T('contracts', 'Договори', L.length) + T('vaks', 'ВАКС', A.T('vaks_cases').length) + T('plans', 'Плани управління', A.T('biz_plans').filter(function (b) { return b.kind === 'mgmt'; }).length) + T('reports', 'Звіти') + '</div>';
    if (tab === 'analytics') h += periodBar('/mgmt', f, P) + mgmtAnalytics(L, P, on);
    if (tab === 'contracts') h += contractsList(L, f, P);
    if (tab === 'vaks') h += vaksList(f);
    if (tab === 'plans') h += plansList('mgmt', f);
    if (tab === 'reports') h += mgmtReports(f);
    A.render(A.shell('Управління активами', 'Договори управління, щомісячні звіти управителів, надходження до бюджету, заборгованість, справи ВАКС і плани управління', canMgmt() ? '<a class="btn gold" href="#/contract/new">+ Договір управління</a>' : '', h), A.keep);
  });
  function yearChips(base, f, y) { return '<div class="chips-filter" style="margin:0 0 10px"><span class="mini" style="align-self:center">Рік:</span>' + years().map(function (yy) { return '<a href="' + A.link(base, Object.assign({}, f, {y: yy})) + '" class="' + (yy === y ? 'on' : '') + '">' + yy + '</a>'; }).join('') + '</div>'; }
  function combo(labels, ser, extra) { return A.chart('combo', [labels, []], null, null, Object.assign({series: ser, unit: 'money'}, extra || {})); }
  function mgmtAnalytics(all, P, on) {
    var s = series(all, P), lab = P.months.map(function (x) { return x.label; }), full = P.months.map(function (x) { return x.full; }), h = '';
    h += '<div class="panel"><h3>Надходження до бюджету · ' + esc(P.title) + (on ? ' · діючі договори' : '') + ' <span>план (гр. 11 / 12 договорів) · прогноз (внесений у попередньому місяці) · факт (казначейство, гр. 23)</span></h3>' +
      combo(lab, [{name: 'План за договорами', values: s.plan, color: '#5B7DB1'}, {name: 'Прогноз', values: s.forecast, color: '#F5C518', dashed: true}, {name: 'Факт (казначейство)', values: s.fact, color: '#3DD68C'}, {name: 'За звітами управителів (гр. 19)', values: s.rep, color: '#B9C4D8', kind: 'line'}], {fullLabels: full}) + '</div>';
    h += '<div class="panel" style="margin-top:14px"><h3>Дохід та витрати за звітами управителів · ' + esc(P.title) + ' <span>гр. 15 «дохід від управління» і гр. 16 «витрати від управління»</span></h3>' +
      combo(lab, [{name: 'Дохід (гр. 15)', values: s.income, color: '#2FA36B'}, {name: 'Витрати (гр. 16)', values: s.exp, color: '#C2453A'}], {fullLabels: full}) + '</div>';
    // найбільші надходження — сукупно за управителем (ЄДРПОУ), без номерів договорів
    var by = {}; all.forEach(function (c) { var k = mgrKey(c), v = sumf(P.months, function (x) { return fact(mrec(c.id, x.y, x.m)); }); if (!by[k]) by[k] = {name: (c.manager_name || '—').split(/[,(]/)[0].trim(), code: /^\d+$/.test(k) ? k : '', v: 0, n: 0}; by[k].v += v; by[k].n++; });
    var top = Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 12);
    var dz = {'Гарантійний платіж': 0, 'Інфляційні втрати': 0, 'Пеня': 0, '% річних': 0, '% штрафу': 0};
    all.forEach(function (c) { var r = lastDebt(c, P.end); if (!r) return; dz['Гарантійний платіж'] += nz(r.debt_guarantee); dz['Інфляційні втрати'] += nz(r.debt_inflation); dz['Пеня'] += nz(r.debt_penalty); dz['% річних'] += nz(r.debt_interest); dz['% штрафу'] += nz(r.debt_fine); });
    var types = A.grp(all, function (c) { var t = (c.asset_type || '').toLowerCase(); return /корпорат|акці/.test(t) ? 'Корпоративні права' : /нерух/.test(t) ? 'Нерухоме майно' : /судн|вагон|залізн|тз|транспорт/.test(t) ? 'Транспорт, судна, вагони' : /рух|обладн/.test(t) ? 'Рухоме майно, обладнання' : t ? 'Інше' : 'Не визначено'; });
    var st = A.grp(all, function (c) { return {active: 'Діючі', terminated: 'Припинені', archived: 'Архів'}[c.status || 'active'] || c.status; });
    h += '<div class="grid g3" style="margin-top:14px"><div class="panel"><h3>Найбільші надходження за період <span>сукупно за управителем (ЄДРПОУ)</span></h3>' + A.chart('barh', [top.map(function (x) { return x.name + (x.n > 1 ? ' (' + x.n + ' дог.)' : ''); }), top.map(function (x) { return Math.round(x.v); }), top.map(function (x) { return A.link('/mgmt', {tab: 'contracts', q: x.code || x.name}); })], 'ok', null, {unit: 'money'}) + '</div>' +
      '<div class="panel"><h3>Структура заборгованості <span>на кінець періоду</span></h3>' + A.chart('donut', [Object.keys(dz), Object.keys(dz).map(function (k) { return Math.round(dz[k]); })], null, ['#F0524E', '#F5A524', '#8B7BF7', '#4C8DF6', '#E58FB4'], {unit: 'money'}) + '</div>' +
      '<div class="panel"><h3>Договори за видом активу</h3>' + A.chart('donut', A.series(types, null, null), null, null) + '</div>' +
      '<div class="panel"><h3>Стан договорів</h3>' + A.chart('donut', A.series(st, null, function (v) { return A.link('/mgmt', {tab: 'contracts', st: {'Діючі': 'active', 'Припинені': 'terminated', 'Архів': 'archived'}[v]}); }), null, ['#3DD68C', '#F0524E', '#6E7F9E']) + '</div>' +
      '<div class="panel"><h3>Пов’язано зі справами ВАКС</h3>' + A.chart('donut', [['З привʼязкою до справ ВАКС', 'Без привʼязки'], [all.filter(function (c) { return c.vaks_ids; }).length, all.filter(function (c) { return !c.vaks_ids; }).length], [A.link('/mgmt', {tab: 'contracts', vaks: 1}), A.link('/mgmt', {tab: 'contracts', vaks: 0})]], null, ['#F5C518', '#6E7F9E']) + '</div>' +
      '<div class="panel"><h3>Активи Реєстру в пулах договорів</h3><div class="kpi-pair" style="margin:10px 0"><span><b>' + A.num(A.T('assets').filter(function (a) { return a.mgmt_contract_id; }).length) + '</b><small>активів привʼязано</small></span><span><b>' + A.num(all.filter(function (c) { return (A.indexes.assetsByContract[c.id] || []).length; }).length) + '</b><small>договорів з активами</small></span></div><p class="mini">Менеджери відділів ДМА добирають активи Реєстру до договору у вкладці «Активи договору».</p></div></div>';
    return h;
  }
  function contractsList(all, f, P) {
    var w = words(f.q), list = all.filter(function (c) {
      if (w.length && !match([A.contractCode(c), c.contract_title, c.manager_name, c.manager_code, c.asset_description, c.ruling, c.vaks, c.asset_location].join(' '), w)) return false;
      if (f.st && (c.status || 'active') !== f.st) return false; if (f.dept && c.dept_code !== f.dept) return false;
      if (f.debt) { var r = lastDebt(c); if (!(r && debtOf(r) > 0)) return false; }
      if (f.vaks === '1' && !c.vaks_ids) return false; if (f.vaks === '0' && c.vaks_ids) return false;
      return true;
    }).sort(function (a, b) { return (a.seq_no || 1e6) - (b.seq_no || 1e6) || a.id - b.id; });
    var pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    return '<form class="filters" data-act="filter" data-base="/mgmt"><input type="hidden" name="tab" value="contracts">' + (f.act ? '<input type="hidden" name="act" value="1">' : '') + '<input name="q" value="' + esc(f.q || '') + '" placeholder="№, договір, управитель, ЄДРПОУ, актив, ухвала, справа ВАКС" style="flex:1;min-width:260px">' +
      A.sel('st', [['active', 'Діючі'], ['terminated', 'Припинені'], ['archived', 'Архів']], f.st, 'Усі стани') + A.sel('dept', A.OPT.DEPT, f.dept, 'Усі відділи') +
      A.sel('debt', [['1', 'Є заборгованість']], f.debt, 'Заборгованість') + A.sel('vaks', [['1', 'Привʼязано до справ ВАКС'], ['0', 'Без справ ВАКС']], f.vaks, 'ВАКС') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/mgmt?tab=contracts">Скинути</button>' +
      (A.can('export') ? '<a class="btn" href="#" data-click="mgmt-xlsx-list">XLSX переліку</a>' : '') + '</form>' + A.pager(list.length, pg.page, '/mgmt', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>№</th><th>Договір</th><th>Управитель</th><th>Актив</th><th class="num">Гарантійний / міс</th><th class="num">Казначейство ' + esc(P.title) + '</th><th class="num">З початку дії</th><th class="num">Заборгованість</th><th>Пул / ВАКС</th>' + (canMgmt() ? '<th></th>' : '') + '</tr></thead><tbody>' +
      pg.rows.map(function (c) { var r = lastDebt(c), n = (A.indexes.assetsByContract[c.id] || []).length, vk = vaksOf(c), arch = c.status === 'archived';
        return '<tr' + (arch ? ' class="muted-row"' : '') + '><td class="nowrap"><a class="id" href="#/contract/' + c.id + '">' + esc(A.contractCode(c)) + '</a><span class="sub">' + ({active: '<span class="tag t-ok">діючий</span>', terminated: '<span class="tag t-lost">припинено</span>', archived: '<span class="tag t-unk">архів</span>'}[c.status || 'active'] || '') + '</span></td>' +
          '<td style="max-width:260px"><span class="clip3">' + esc(cTitle(c)) + '</span><span class="sub">укладено ' + A.dt(c.conclusion_date) + (c.validity_date ? ' · до ' + A.dt(c.validity_date) : '') + '</span></td><td class="mini" style="max-width:200px"><span class="clip3">' + esc(c.manager_name || '') + '</span></td>' +
          '<td style="max-width:320px"><span class="clip3">' + esc(c.asset_description || '') + '</span><span class="sub">' + esc(c.asset_type || '') + '</span></td><td class="num">' + money(c.guarantee_monthly) + '</td><td class="num">' + money(sumf(P.months, function (x) { return fact(mrec(c.id, x.y, x.m)); })) + '</td><td class="num">' + money(cumOf(c, P.end)) + '</td>' +
          '<td class="num' + (r && debtOf(r) > 0 ? ' overdue' : '') + '">' + (r ? money(debtOf(r)) : money(c.debt_start)) + (r ? '<span class="sub">на ' + MON3[r.month - 1] + ' ' + r.year + '</span>' : '') + '</td>' +
          '<td class="mini">' + (n ? n + ' акт.' : '—') + (vk.length ? '<br>' + vk.map(function (v) { return '<a href="#/vaks/' + v.id + '">' + esc(v.uid) + '</a>'; }).join(', ') : '') + '</td>' +
          (canMgmt() ? '<td class="nowrap"><button class="btn sm plain" data-click="contract-arch" data-id="' + c.id + '" data-confirm="' + (arch ? 'Повернути договір з архіву в діючі?' : 'Перенести договір в архів? Він не враховуватиметься серед діючих; дані і звіти зберігаються.') + '" title="' + (arch ? 'Повернути з архіву' : 'Перенести в архів') + '">' + (arch ? '↩ з архіву' : '🗄 в архів') + '</button></td>' : '') + '</tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="10"><div class="empty">Договорів не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/mgmt', q);
  }
  A.CLICK['contract-arch'] = function (t) {
    var c = A.get('mgmt_contracts', +t.dataset.id), arch = c.status === 'archived', tx = A.tx();
    tx.put('mgmt_contracts', {id: c.id, status: arch ? 'active' : 'archived', updated_at: A.nowS(), updated_by: S.user && S.user.login});
    tx.log(arch ? 'Договір повернуто з архіву' : 'Договір перенесено в архів', 'contract', c.id);
    return tx.commit().then(function () { A.toast(arch ? 'Договір повернуто в діючі' : 'Договір перенесено в архів'); A.route(true); });
  };
  // ---------------------------------------------------------------- картка договору (вкладки — блоки форми обліку)
  A.on(/^\/contract\/(\d+)$/, function (id, f) {
    if (!seeMgmt()) return A.deny();
    var c = A.get('mgmt_contracts', +id); if (!c) return A.notFound();
    var y = +f.y || yearNow(), ms = monthly(c.id, y), edit = f.edit === '1', anyEd = canMgmt() || A.can('mgmt_monitor') || A.can('mgmt_legal') || A.can('system');
    var ed = canMgmt() && edit, as = (A.indexes.assetsByContract[c.id] || []), pls = (A.indexes.poolsByContract[c.id] || []);
    var r = lastDebt(c), vk = vaksOf(c), plans = (A.indexes.bizByTarget['contract:' + c.id] || []), arch = c.status === 'archived', tabQ = f.tab || 'c-info';
    var act = (anyEd ? (edit ? '<a class="btn gold" href="' + A.link('/contract/' + c.id, {tab: tabQ, y: f.y}) + '">✓ Завершити редагування</a>' : '<a class="btn gold" href="' + A.link('/contract/' + c.id, {tab: tabQ, y: f.y, edit: 1}) + '" title="Відкрити поля для внесення змін">✎ Редагувати</a>') : '') +
      (canMgmt() ? '<button class="btn" data-click="contract-arch" data-id="' + c.id + '" data-confirm="' + (arch ? 'Повернути договір з архіву в діючі?' : 'Перенести договір в архів?') + '">' + (arch ? '↩ Повернути з архіву' : '🗄 В архів') + '</button>' : '') +
      (A.can('export') ? '<a class="btn" href="#" data-click="mgmt-form" data-ids="' + c.id + '" data-y="' + y + '">XLSX за формою</a>' : '') + (A.can('delete_records') && edit ? '<button class="btn danger" data-click="contract-del" data-id="' + c.id + '" data-confirm="Видалити договір разом із щомісячними записами? Активи залишаться в Реєстрі.">Видалити</button>' : '') + '<a class="btn plain" href="#/mgmt?tab=contracts">До переліку</a>';
    var t0 = mkey(yearNow(), 12);
    var h = (edit ? '<div class="flash info edit-flag">Режим редагування: поля відкриті для змін. Після внесення — «Зберегти» у відповідному блоці, потім «Завершити редагування».</div>' : '') +
      (arch ? '<div class="flash warn">Договір в архіві — не враховується серед діючих.</div>' : '') +
      '<div class="grid g5">' + A.kpi('Гарантійний платіж', money(c.guarantee_monthly), 'на місяць (гр. 12)') + A.kpi('Запланований обсяг', money(c.planned_monthly), c.planned_monthly_budget ? String(c.planned_monthly_budget) : 'на місяць (гр. 11)') +
      A.kpi('Казначейство за ' + y, money(sumf(ms, fact)), 'гр. 23 · за звітами (гр. 19): ' + money(sumf(ms, factRep))) + A.kpi('З початку дії договору', money(cumOf(c, t0)), 'гр. 13 на 01.01.2026 + казначейство з 2026') +
      A.kpi('Заборгованість', r ? money(debtOf(r)) : money(c.debt_start), r ? 'на ' + MON[r.month - 1] + ' ' + r.year : 'на 01.01.2026', null, r && debtOf(r) > 0 ? 'overdue' : '') + '</div>';
    var tabs = [['c-info', 'Договір (гр. 1-14)'], ['c-budget', 'Надходження (19-23)'], ['c-report', 'Звіти управителя (15-21)'], ['c-debt', 'Заборгованість (24-30)'], ['c-monitor', 'Моніторинг і приписи (31-32, 231-235)'], ['c-legal', 'Позовна робота (236-241)'], ['c-assets', 'Активи договору'], ['c-plan', 'План управління'], ['c-vaks', 'ВАКС'], ['c-docs', 'Документи']];
    h += '<div class="tabs" data-tabbar="contract" data-start="' + esc(tabQ) + '" style="margin-top:14px">' + tabs.map(function (t) { return '<a href="#" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'c-assets' ? ' <span class="pill">' + as.length + '</span>' : t[0] === 'c-vaks' && vk.length ? ' <span class="pill">' + vk.length + '</span>' : '') + '</a>'; }).join('') + '</div>';
    var DEPT = D.DMA.filter(function (x) { return /^dma\d|realization|dma_money|dam/.test(x[0]); }), edResp = edit && (canMgmt() || A.can('mgmt_monitor') || A.can('mgmt_legal'));
    h += '<div class="tabpane" id="c-info" data-group="contract"><form data-act="contract-save" data-id="' + c.id + '" data-grp="info"><fieldset><legend>Графи 1-14 форми обліку</legend>' + formFields(c, CF.info, ed) +
      (ed ? '<div class="form-grid">' + A.fsel('Відділ ДМА (відповідальний)', 'dept_code', DEPT, c.dept_code) + '</div>' : '<dl class="vgrid"><div><dt>Відділ ДМА (відповідальний)</dt><dd>' + esc(N.DMA[c.dept_code] || c.dept_code || '—') + '</dd></div></dl>') + '</fieldset>' +
      '<fieldset><legend>Графи 242-245: відповідальні за внесення виконавці</legend>' + formFields(c, CF.resp, edResp) + '</fieldset>' +
      (ed || edResp ? '<div class="form-actions"><button class="btn gold">Зберегти договір</button></div>' : '') + '</form><p class="mini">Оновлено: ' + esc(c.updated_at || '—') + (c.updated_by ? ' · ' + esc(c.updated_by) : '') + '. Графи 13-14 фіксуються станом на 01.01.2026 (п. 14-15 Методичних рекомендацій).</p></div>';
    var yq = function (t) { return yearChips('/contract/' + c.id, Object.assign({tab: t}, edit ? {edit: 1} : {}), y); };
    h += '<div class="tabpane" id="c-report" data-group="contract">' + yq('c-report') + monthTable(c, y, MF.report, edit && canGroup('report'), 'Щомісячні показники за звітом управителя (примірна форма звіту — наказ АРМА від 12.02.2025 № 51). Управитель до 20 числа місяця, наступного за звітним, перераховує остаточну суму надходжень (у грудні — до 31 числа).') + '</div>';
    // графіки договору: виконання (казначейство vs гарантійний платіж, дохід управителя) і план / прогноз / факт
    var Py = {months: MON.map(function (x, i) { return {y: y, m: i + 1, label: MON3[i], full: MON[i] + ' ' + y}; })}, sy = series([c], Py), g = nz(c.guarantee_monthly), now = mkey(yearNow(), +A.today().slice(5, 7));
    var tre = Py.months.map(function (x) { return fact(mrec(c.id, x.y, x.m)); }), below = Py.months.map(function (x, i) { var has = !!mrec(c.id, x.y, x.m); return g && has && tre[i] < g && mkey(x.y, x.m) < now; });
    var lowN = below.filter(Boolean).length;
    h += '<div class="tabpane" id="c-budget" data-group="contract">' + yq('c-budget') +
      '<div class="panel"><h3>Виконання договору ' + y + ' — динаміка та гарантійний платіж <span>казначейство (гр. 23) проти гарантійного платежу (гр. 12); лінія — дохід від управління за звітом (гр. 15)</span></h3>' +
      combo(MON3, [{name: 'Казначейство (гр. 23)', values: tre, color: '#D9A514', colors: below.map(function (b) { return b ? '#C2453A' : null; })}, {name: 'Дохід від управління (гр. 15)', values: sy.income, color: '#2FA36B', kind: 'line'}],
        {hlines: g ? [{value: g, name: 'Гарантійний платіж (гр. 12)', color: '#E8EDF7'}] : [], legendExtra: g ? [{name: 'місяць нижче гарантії', color: '#C2453A'}] : [], fullLabels: Py.months.map(function (x) { return x.full; })}) +
      (g ? '<p class="mini">Місяців нижче гарантійного платежу: <b class="' + (lowN ? 'overdue' : '') + '">' + lowN + '</b>' + (lowN ? ' — підстава для претензійної роботи (гр. 22, 24-30)' : '') + '.</p>' : '') + '</div>' +
      '<div class="panel" style="margin-top:14px"><h3>План, прогноз і факт за ' + y + ' рік</h3>' + combo(MON3, [{name: 'План (гр. 11 / 12)', values: sy.plan, color: '#5B7DB1'}, {name: 'Прогноз', values: sy.forecast, color: '#F5C518', dashed: true}, {name: 'Факт (казначейство)', values: sy.fact, color: '#3DD68C'}]) + '</div>' +
      monthTable(c, y, MF.budget, edit && canGroup('budget'), 'Графа 22 — відхилення фактичної сплати гарантованого платежу від визначеного договором (якщо не заповнено — рахується автоматично: графа 20 мінус графа 12). Графа 23 — офіційна сума для звітності верхнього рівня. «Прогноз надходжень на наступний місяць» — для графіків «план / прогноз / факт» і звітів.') + '</div>';
    h += '<div class="tabpane" id="c-debt" data-group="contract">' + yq('c-debt') + monthTable(c, y, MF.debt, edit && canGroup('debt'), 'Прострочена заборгованість виникає одразу після граничного терміну платежу; щомісяця на звітну дату розраховуються пеня, штрафи, % річних та інфляційні втрати (пп. 33-35). Графа 25 — якщо не заповнено, сума граф 26-30.') + '</div>';
    h += '<div class="tabpane" id="c-monitor" data-group="contract">' + yq('c-monitor') + monthTable(c, y, MF.monitor, edit && canGroup('monitor'), 'Заповнює Управління з контролю за ефективністю менеджменту (розділ V, п. 8).') +
      '<form data-act="contract-save" data-id="' + c.id + '" data-grp="monitor" style="margin-top:14px"><fieldset><legend>Графи 231-235: приписи / вимоги про усунення порушень</legend>' + formFields(c, CF.monitor, edit && canGroup('monitor')) + '</fieldset>' + (edit && canGroup('monitor') ? '<div class="form-actions"><button class="btn gold">Зберегти</button></div>' : '') + '</form></div>';
    h += '<div class="tabpane" id="c-legal" data-group="contract"><form data-act="contract-save" data-id="' + c.id + '" data-grp="legal"><fieldset><legend>Графи 236-241: стягнення в судовому порядку (Департамент правового забезпечення)</legend>' + formFields(c, CF.legal, edit && canGroup('legal')) + '</fieldset>' + (edit && canGroup('legal') ? '<div class="form-actions"><button class="btn gold">Зберегти</button></div>' : '') + '</form></div>';
    var edA = edit && (canMgmt() || A.can('manage_pools'));
    h += '<div class="tabpane" id="c-assets" data-group="contract"><p class="mini">Активи Реєстру, передані в управління за цим договором. Добирають менеджери відділів ДМА або адміністратор — з Реєстру (пошук і фільтри, зокрема за № справи, провадження, ЄРДР), за кодом пулу або масовою дією в Реєстрі.' + (anyEd && !edit ? ' Для змін натисніть «Редагувати».' : '') + '</p>' +
      '<form data-act="contract-assets" data-id="' + c.id + '"><div class="wrap-tbl"><table><thead><tr>' + (edA ? '<th style="width:26px"></th>' : '') + '<th>№ активу</th><th>Найменування</th><th>Категорія / складність</th><th>Правовий стан</th><th class="num">Оцінка</th></tr></thead><tbody>' +
      as.map(function (a) { return '<tr>' + (edA ? '<td><input type="checkbox" name="rm" value="' + a.id + '" style="width:auto"></td>' : '') + '<td class="nowrap"><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a><span class="sub">' + A.zone(a.zone, true) + '</span></td><td style="max-width:440px"><span class="clip3">' + esc(a.name || '') + '</span></td><td class="mini">' + esc(N.CAT[a.category] || '') + '<br>' + esc(N.CX[a.complexity] || '') + '</td><td>' + A.legal(a.legal_status) + '</td><td class="num">' + money(a.val_amount) + '</td></tr>'; }).join('') +
      (as.length ? '' : '<tr><td colspan="6"><div class="empty">Активи ще не добрано.</div></td></tr>') + '</tbody></table></div>' +
      (edA ? '<div class="sel-bar"><button type="button" class="btn gold" data-click="pick" data-into="asset_nos" data-pools="1" data-multi="1">🔎 Обрати з Реєстру / пулу</button><input name="asset_nos" placeholder="або номери активів / код пулу через кому" style="flex:1;min-width:260px"><button class="btn" name="do" value="add">Додати</button><button class="btn danger" name="do" value="remove">Вилучити позначені</button></div>' : '') + '</form>' +
      (pls.length ? '<p class="mini">Пули договору: ' + pls.map(function (p) { return '<a href="#/pool/' + p.id + '">' + esc(p.code) + '</a>'; }).join(', ') + '</p>' : '') + '</div>';
    h += '<div class="tabpane" id="c-plan" data-group="contract">' + planTable(plans, 'mgmt') + (canMgmt() ? '<p><a class="btn gold" href="' + A.link('/bizplan/new', {kind: 'mgmt', tt: 'contract', tid: c.id}) + '">+ План управління до договору</a></p>' : '') + '</div>';
    var edV = edit && (A.can('vaks_edit') || canMgmt());
    h += '<div class="tabpane" id="c-vaks" data-group="contract"><div class="panel"><h3>Справи ВАКС, привʼязані до договору</h3>' + (vk.length ? '<ul class="plain-list">' + vk.map(function (v) { return '<li><a href="#/vaks/' + v.id + '">' + esc(v.uid) + '</a> · ' + esc(v.case_no || '') + (v.defendant ? ' · ' + esc(String(v.defendant).split('\n')[0]) : '') + (edV ? ' <button class="btn sm plain" data-click="vaks-unlink" data-c="' + c.id + '" data-v="' + v.id + '">відвʼязати</button>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="empty">Не привʼязано.</div>') +
      (c.vaks ? '<p class="mini">З бази договорів: ' + esc(c.vaks) + '</p>' : '') +
      (edV ? '<form class="filters" data-act="vaks-link" data-id="' + c.id + '" style="margin-top:10px"><input name="q" list="vaks-dl" placeholder="№ справи ВАКС (991/…) або ВАКС-NNN" style="flex:1;min-width:260px"><datalist id="vaks-dl">' + A.T('vaks_cases').map(function (v) { return '<option value="' + esc(v.uid) + '">' + esc(v.case_no || '') + '</option>'; }).join('') + '</datalist><button class="btn">Привʼязати</button><a class="btn plain" href="#/vaks/new?c=' + c.id + '">+ Нова справа (реквізити)</a></form>' : '') + '</div></div>';
    h += '<div class="tabpane" id="c-docs" data-group="contract">' + A.docsBlock('contract', c.id, canMgmt() || A.can('mgmt_monitor') || A.can('mgmt_legal'), ['mgmt_contract', 'transfer_act', 'mgmt_program', 'mgmt_report', 'prescription', 'lawsuit', 'court_scan', 'other']) + '</div>';
    A.render(A.shell(A.contractCode(c) + ' · ' + (c.manager_name || ''), cTitle(c), act, h), A.keep);
  });
  A.on(/^\/contract\/new$/, function () {
    if (!canMgmt()) return A.deny();
    var n = A.T('mgmt_contracts').reduce(function (m, c) { return Math.max(m, c.seq_no || 0); }, 0) + 1;
    A.render(A.shell('Новий договір управління', 'Графи 1-14 форми обліку надходжень від управління активами', '', '<form data-act="contract-save" data-grp="info"><fieldset><legend>Договір</legend>' + formFields({seq_no: n, status: 'active', is_foreign: 0}, CF.info, true) +
      '<div class="form-grid">' + A.fsel('Відділ ДМА (відповідальний)', 'dept_code', D.DMA.filter(function (x) { return /^dma\d|realization|dma_money|dam/.test(x[0]); }), S.user && S.user.dept_code) + '</div></fieldset><fieldset><legend>Відповідальні (242-245)</legend>' + formFields({}, CF.resp, true) + '</fieldset>' +
      '<div class="form-actions"><a class="btn plain" href="#/mgmt?tab=contracts">Скасувати</a><button class="btn gold">Створити договір</button></div></form>'));
  });
  A.ACT['contract-save'] = function (form, d) {
    var isNew = !form.dataset.id, g = form.dataset.grp, old = isNew ? {} : A.get('mgmt_contracts', +form.dataset.id);
    var list = g === 'info' ? CF.info.concat(CF.resp) : CF[g], rec = cleanRec(d, list);
    if (g === 'info' && 'dept_code' in d) rec.dept_code = d.dept_code || null;
    if (g === 'info' && !(rec.contract_title || old.contract_title)) throw new Error('Вкажіть реквізити договору (графа 2)');
    var tx = A.tx(), cid;
    if (isNew) { cid = A.tmpId(); rec.id = cid; rec.created_at = A.nowS(); rec.updated_by = S.user && S.user.login; tx.put('mgmt_contracts', rec); }
    else { cid = old.id; if (!diffPut(tx, 'mgmt_contracts', old, rec)) return A.toast('Змін немає', 'info'); }
    tx.log(isNew ? 'Створено договір управління' : 'Змінено договір управління (' + g + ')', 'contract', isNew ? null : cid);
    return tx.commit().then(function (r) { A.toast('Збережено'); A.go('#/contract/' + r.id('mgmt_contracts', cid) + '?tab=c-' + (g || 'info') + (isNew ? '' : '&edit=1')); });
  };
  A.CLICK['contract-del'] = function (t) { var tx = A.tx(); tx.del('mgmt_contracts', +t.dataset.id); tx.log('Видалено договір управління', 'contract', +t.dataset.id); return tx.commit().then(function () { A.go('#/mgmt?tab=contracts'); }); };
  // таблиця місяців для групи граф: перегляд (числа з розділенням тисяч) або редагування
  function monthTable(c, y, fields, editable, note) {
    var h = '<form data-act="mm-save" data-id="' + c.id + '" data-y="' + y + '" data-f="' + fields.map(function (x) { return x[0]; }).join(',') + '"><div class="wrap-tbl"><table class="mm' + (editable ? ' editing' : '') + '"><thead><tr><th>Місяць ' + y + '</th>' + fields.map(function (x) { return '<th class="num"><span class="clip3">' + esc(x[1]) + '</span></th>'; }).join('') + '</tr></thead><tbody>';
    var tot = {};
    for (var m = 1; m <= 12; m++) {
      var r = mrec(c.id, y, m) || {};
      h += '<tr' + (m % 2 ? '' : ' class="alt"') + '><td class="nowrap">' + MON[m - 1] + '</td>' + fields.map(function (x) {
        var v = r[x[0]], text = x[2] === 'text', ph = '';
        if (!text) tot[x[0]] = (tot[x[0]] || 0) + nz(v);
        if (x[0] === 'guarantee_deviation' && (v === null || v === undefined) && r.transferred_guarantee !== undefined && r.transferred_guarantee !== null && c.guarantee_monthly) ph = A.num(nz(r.transferred_guarantee) - nz(c.guarantee_monthly), 2);
        if (x[0] === 'debt_total' && (v === null || v === undefined)) { var s2 = nz(r.debt_guarantee) + nz(r.debt_inflation) + nz(r.debt_penalty) + nz(r.debt_interest) + nz(r.debt_fine); if (s2) ph = A.num(s2, 2); }
        return '<td' + (text ? '' : ' class="num"') + '>' + (editable ? '<input name="v_' + m + '_' + x[0] + '" value="' + esc(v === null || v === undefined ? '' : (text ? v : A.fmtIn(v))) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (text ? '' : ' inputmode="decimal" data-num') + ' style="width:100%;min-width:' + (text ? 160 : 110) + 'px">' : (text ? esc(v || '') : (v === null || v === undefined ? (ph ? '<span class="mini">' + ph + '</span>' : '') : A.num(v, 2)))) + '</td>';
      }).join('') + '</tr>';
    }
    h += '<tr class="total"><td><b>Разом за рік</b></td>' + fields.map(function (x) { return '<td class="num"><b>' + (x[2] === 'text' || /^debt_|monitoring/.test(x[0]) ? '' : A.num(tot[x[0]] || 0, 2)) + '</b></td>'; }).join('') + '</tr></tbody></table></div>' +
      (editable ? '<div class="form-actions"><button class="btn gold">Зберегти ' + y + ' рік</button></div>' : '') + '</form>' + (note ? '<p class="mini">' + note + '</p>' : '');
    return h;
  }
  A.ACT['mm-save'] = function (form, d) {
    var cid = +form.dataset.id, y = +form.dataset.y, flds = form.dataset.f.split(','), tx = A.tx(), n = 0, c = A.get('mgmt_contracts', cid);
    var textF = {debt_date_info: 1, monitoring_debt_period: 1, note: 1};
    for (var m = 1; m <= 12; m++) {
      var old = mrec(cid, y, m), rec = {};
      flds.forEach(function (k) { var key = 'v_' + m + '_' + k; if (!(key in d)) return; var v = (d[key] || '').trim(); if (v === '') v = null;
        else if (!textF[k]) { var nn = A.parseNum(v); if (nn === null) throw new Error(MON[m - 1] + ': «' + v + '» — потрібне число'); v = nn; } rec[k] = v; });
      if ('guarantee_deviation' in rec && rec.guarantee_deviation === null && old && old.transferred_guarantee !== null && old.transferred_guarantee !== undefined && c.guarantee_monthly) rec.guarantee_deviation = Math.round((nz(old.transferred_guarantee) - nz(c.guarantee_monthly)) * 100) / 100;
      if (old) { var p = {id: old.id}, k2 = 0; Object.keys(rec).forEach(function (k) { if (!same(old[k], rec[k])) { p[k] = rec[k]; k2++; } }); if (k2) { p.updated_at = A.nowS(); p.updated_by = S.user && S.user.login; tx.put('mgmt_monthly', p); n++; } }
      else if (Object.keys(rec).some(function (k) { return rec[k] !== null; })) { tx.put('mgmt_monthly', Object.assign({id: A.tmpId(), contract_id: cid, year: y, month: m, created_at: A.nowS(), updated_by: S.user && S.user.login}, rec)); n++; }
    }
    if (!n) return A.toast('Змін немає', 'info');
    tx.log('Щомісячні показники договору: ' + y, 'contract', cid, {months: n});
    return tx.commit().then(function () { A.toast('Збережено місяців: ' + n); A.route(true); });
  };
  A.ACT['contract-assets'] = function (form, d) {
    var cid = +form.dataset.id, tx = A.tx(), n = 0;
    if (d.do === 'add') {
      (d.asset_nos || '').split(/[\s,;]+/).filter(Boolean).forEach(function (no) {
        var a = A.indexes.byNo[no], p = !a && A.T('pools').filter(function (x) { return x.code === no; })[0];
        if (a && a.mgmt_contract_id !== cid) { tx.put('assets', {id: a.id, mgmt_contract_id: cid}, a.updated_at); n++; }
        if (p) { if (p.mgmt_contract_id !== cid) tx.put('pools', {id: p.id, mgmt_contract_id: cid}); (A.indexes.poolAssets[p.id] || []).forEach(function (x) { if (x.mgmt_contract_id !== cid) { tx.put('assets', {id: x.id, mgmt_contract_id: cid}, x.updated_at); n++; } }); }
      });
    } else A.arr(d.rm).forEach(function (i) { var a = A.get('assets', +i); if (a) { tx.put('assets', {id: a.id, mgmt_contract_id: null}, a.updated_at); n++; } });
    if (!n) return A.toast('Немає змін (перевірте номери активів або код пулу)', 'err');
    tx.log(d.do === 'add' ? 'Додано активи до договору управління' : 'Вилучено активи з договору управління', 'contract', cid, {count: n});
    return tx.commit().then(function () { A.toast('Оновлено активів: ' + n); A.route(true); });
  };
  A.ACT['vaks-link'] = function (form, d) {
    var c = A.get('mgmt_contracts', +form.dataset.id), q = (d.q || '').trim(), key = (q.match(/991\/\d+\/\d{2}/) || [])[0];
    var v = A.T('vaks_cases').filter(function (x) { return x.uid === q || (key && (x.case_no || '').indexOf(key) >= 0); })[0];
    if (!v) return A.toast('Справу не знайдено. Додайте нову справу з реквізитами.', 'err');
    var ids = (c.vaks_ids || '').split(',').filter(Boolean); if (ids.indexOf(String(v.id)) >= 0) return A.toast('Уже привʼязано', 'info'); ids.push(String(v.id));
    var tx = A.tx(); tx.put('mgmt_contracts', {id: c.id, vaks_ids: ids.join(','), updated_at: A.nowS(), updated_by: S.user && S.user.login}); tx.log('Привʼязано справу ВАКС ' + v.uid, 'contract', c.id);
    return tx.commit().then(function () { A.route(true); });
  };
  A.CLICK['vaks-unlink'] = function (t) { var c = A.get('mgmt_contracts', +t.dataset.c), ids = (c.vaks_ids || '').split(',').filter(function (x) { return x && x !== t.dataset.v; }); var tx = A.tx(); tx.put('mgmt_contracts', {id: c.id, vaks_ids: ids.join(',') || null, updated_at: A.nowS(), updated_by: S.user && S.user.login}); return tx.commit().then(function () { A.route(true); }); };

  // ---------------------------------------------------------------- ВАКС
  var VF = [['uid', 'Ідентифікатор', 'text'], ['case_no', '№ судової справи', 'text'], ['proceeding_no', '№ провадження', 'text'], ['court', 'Суд', 'text'], ['defendant', 'Відповідач / підсанкційна особа', 'area'], ['parties', 'Сторони спору', 'area'],
    ['vaks_decision', 'Рішення ВАКС (є / немає)', 'text'], ['status', 'Статус справи', 'text'], ['minjust_status', 'Стан розгляду (Мінʼюст)', 'area'], ['assets_overview', 'Орієнтовний перелік активів', 'area'], ['assets_recovered', 'Активи, що стягуються / стягнуті', 'area'],
    ['assets_privatization', 'Активи на приватизацію', 'area'], ['law_enforcement', 'Правоохоронний орган', 'area'], ['criminal_proc', 'Кримінальне провадження', 'area'], ['arrest_info', 'Арешт (ухвала)', 'area'], ['transfer_info', 'Передача в АРМА (ухвала)', 'area'],
    ['current_state', 'Поточний стан роботи з активом', 'area'], ['known_issues', 'Відома проблематика', 'area'], ['valuation_stage', 'Стадія оцінки', 'text'], ['step1', 'Крок 1', 'text'], ['step2', 'Крок 2', 'text'], ['step3', 'Крок 3', 'text'], ['step4', 'Крок 4', 'text'], ['transfer_to_manager', 'Передача управителю', 'area']];
  function vaksList(f) {
    var w = words(f.q), list = A.T('vaks_cases').filter(function (v) { return !w.length || match([v.uid, v.case_no, v.proceeding_no, v.defendant, v.sanctioned_person, v.status, v.minjust_status].join(' '), w); }).sort(function (a, b) { return (a.seq || 1e6) - (b.seq || 1e6) || a.id - b.id; });
    var pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    return '<form class="filters" data-act="filter" data-base="/mgmt"><input type="hidden" name="tab" value="vaks"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ справи, ВАКС-NNN, відповідач, статус" style="flex:1;min-width:260px"><button class="btn">Знайти</button>' + (A.can('vaks_edit') ? '<a class="btn gold" href="#/vaks/new">+ Справа ВАКС</a>' : '') + '</form>' +
      '<p class="mini">База справ ВАКС: справи з бази договорів управління та таблиці «Рішення ВАКС». Справа привʼязується до договору управління в картці договору (вкладка «ВАКС»); решта справ — для довідки та подальшої привʼязки. ' + (A.mode !== 'server' ? 'У дзеркалі показано лише номери справ.' : '') + '</p>' + A.pager(list.length, pg.page, '/mgmt', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Ідентифікатор</th><th>№ справи</th><th>Відповідач</th><th>Стан</th><th>Договори</th></tr></thead><tbody>' + pg.rows.map(function (v) { var cs = contractsOfVaks(v);
        return '<tr><td class="nowrap"><a class="id" href="#/vaks/' + v.id + '">' + esc(v.uid) + '</a><span class="sub">' + esc(v.source || '') + '</span></td><td class="mini">' + esc(v.case_no || '') + (v.proceeding_no ? '<br>пров. ' + esc(v.proceeding_no) : '') + '</td><td style="max-width:320px"><span class="clip3">' + esc(v.defendant || v.sanctioned_person || '') + '</span></td>' +
          '<td style="max-width:320px"><span class="clip3 mini">' + esc(v.minjust_status || v.status || '') + '</span></td><td class="mini">' + cs.map(function (c) { return '<a href="#/contract/' + c.id + '?tab=c-vaks">' + esc(A.contractCode(c)) + '</a>'; }).join(', ') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="5"><div class="empty">Справ не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/mgmt', q);
  }
  A.on(/^\/vaks\/(new|\d+)$/, function (id, f) {
    if (!seeMgmt()) return A.deny();
    var isNew = id === 'new', v = isNew ? {uid: 'ВАКС-Н' + ('00' + (A.T('vaks_cases').length + 1)).slice(-3), court: 'Вищий антикорупційний суд', source: 'Внесено в порталі'} : A.get('vaks_cases', +id); if (!v) return A.notFound();
    var can = A.can('vaks_edit') || canMgmt(), ed = can && (isNew || f.edit === '1'), cs = isNew ? [] : contractsOfVaks(v);
    var h = (cs.length ? '<div class="flash info">Привʼязано до договорів: ' + cs.map(function (c) { return '<a href="#/contract/' + c.id + '?tab=c-vaks">' + esc(A.contractCode(c)) + ' · ' + esc((c.manager_name || '').slice(0, 50)) + '</a>'; }).join('; ') + '</div>' : '') +
      '<form data-act="vaks-save" data-id="' + (v.id || '') + '" data-c="' + esc(f.c || '') + '"><fieldset><legend>Справа ВАКС</legend>' + formFields(v, VF, ed) + '</fieldset>' + (ed ? '<div class="form-actions"><a class="btn plain" href="#/mgmt?tab=vaks">Скасувати</a><button class="btn gold">' + (isNew ? 'Додати справу' : 'Зберегти') + '</button></div>' : '') + '</form>';
    A.render(A.shell(isNew ? 'Нова справа ВАКС' : 'Справа ' + v.uid, v.case_no || '', (can && !isNew ? (ed ? '<a class="btn gold" href="#/vaks/' + v.id + '">✓ Завершити редагування</a>' : '<a class="btn gold" href="#/vaks/' + v.id + '?edit=1">✎ Редагувати</a>') : '') + '<a class="btn plain" href="#/mgmt?tab=vaks">До справ ВАКС</a>', h));
  });
  A.ACT['vaks-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('vaks_cases', +form.dataset.id), rec = cleanRec(d, VF), tx = A.tx(), vid;
    if (!rec.case_no) throw new Error('Вкажіть № судової справи');
    if (isNew) { vid = A.tmpId(); rec.id = vid; rec.source = 'Внесено в порталі'; rec.created_at = A.nowS(); rec.updated_by = S.user && S.user.login; tx.put('vaks_cases', rec); }
    else { vid = old.id; if (!diffPut(tx, 'vaks_cases', old, rec)) return A.toast('Змін немає', 'info'); }
    var cid = +form.dataset.c;
    return tx.commit().then(function (r) {
      var nid = r.id('vaks_cases', vid);
      if (cid) { var c = A.get('mgmt_contracts', cid), ids = (c.vaks_ids || '').split(',').filter(Boolean); ids.push(String(nid)); var t2 = A.tx(); t2.put('mgmt_contracts', {id: cid, vaks_ids: ids.join(','), updated_at: A.nowS(), updated_by: S.user && S.user.login}); return t2.commit().then(function () { A.go('#/contract/' + cid + '?tab=c-vaks'); }); }
      A.toast('Збережено'); A.go('#/vaks/' + nid);
    });
  };

  // ---------------------------------------------------------------- плани управління / реалізації
  var PRIO = [['0', 'У процесі реалізації (протокол / акти)'], ['I', 'I — пріоритетні, до кінця 2026'], ['II', 'II — реалізація у 2026–2027'], ['III', 'III — не пріоритетні (механізм передачі, потреби ЗСУ)'], ['IV', 'IV — безперспективні']];
  A.PRIO = PRIO;
  var PST = [['planned', 'Заплановано'], ['listed', 'Оголошено / виконується'], ['done', 'Виконано'], ['failed', 'Не відбулось'], ['cancelled', 'Скасовано']];
  function tgtOf(b) {
    if (b.target_type === 'contract') { var c = A.get('mgmt_contracts', b.target_id); return c ? {href: '#/contract/' + c.id + '?tab=c-plan', code: A.contractCode(c)} : null; }
    if (b.target_type === 'sale') { var s = A.get('sales', b.target_id); return s ? {href: '#/sale/' + s.id, code: s.uid || ('Лот ' + s.id)} : null; }
    return A.targetOf(b.target_type, b.target_id);
  }
  function planTable(rows, kind) {
    if (!rows.length) return '<div class="empty">Планів немає.</div>';
    return '<div class="wrap-tbl"><table><thead><tr><th>№ плану</th><th>Об’єкт</th><th>Найменування</th><th>Прогноз строку</th><th class="num">Очікувані надходження</th><th>Стан</th><th class="num">Результат</th></tr></thead><tbody>' + rows.map(function (b) { var t = tgtOf(b);
      return '<tr><td class="nowrap"><a class="id" href="#/bizplan/' + b.id + '">' + esc(b.uid || '#' + b.id) + '</a>' + (b.strategic ? '<span class="sub"><span class="tag t-gold">стратегічний</span></span>' : '') + (b.priority ? '<span class="sub" title="' + esc(A.map(PRIO)[b.priority] || '') + '">пріоритет ' + esc(b.priority === '0' ? 'у процесі' : b.priority) + '</span>' : '') + '</td><td class="mini">' + (t ? '<a href="' + t.href + '">' + esc(t.code) + '</a>' : '<span class="tag t-lim">не привʼязано</span>') + '</td>' +
        '<td style="max-width:380px"><span class="clip3" title="' + esc(b.name || '') + '">' + esc(b.name || '') + '</span><span class="sub">' + esc(b.asset_type || '') + '</span></td><td class="nowrap">' + (b.plan_month ? MON[b.plan_month - 1] + ' ' : '') + (b.plan_year || '') + '</td><td class="num">' + money(b.expected_revenue) + '</td>' +
        '<td class="mini">' + esc(A.map(PST)[b.status] || b.status || '') + '</td><td class="num">' + money(b.result_amount) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function plansList(kind, f) {
    var w = words(f.q), y = f.py ? +f.py : null, list = A.T('biz_plans').filter(function (b) { return b.kind === kind && (!w.length || match([b.uid, b.name, b.ident, b.location, b.comment, b.resp_dma].join(' '), w)) && (!y || b.plan_year === y) && (!f.ps || b.status === f.ps) && (!f.nolink || !b.target_id) && (!f.pr || b.priority === f.pr); })
      .sort(function (a, b) { return (a.plan_year || 9999) - (b.plan_year || 9999) || (a.plan_month || 13) - (b.plan_month || 13) || (a.seq || 0) - (b.seq || 0); });
    var base = kind === 'mgmt' ? '/mgmt' : '/sales', ed = kind === 'mgmt' ? canMgmt() : canSales();
    var byM = {}; list.forEach(function (b) { if (b.plan_year && b.plan_month) { var k = b.plan_year + '-' + ('0' + b.plan_month).slice(-2); byM[k] = (byM[k] || 0) + nz(b.expected_revenue); } });
    var ks = Object.keys(byM).sort();
    return '<form class="filters" data-act="filter" data-base="' + base + '"><input type="hidden" name="tab" value="plans"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ плану, назва, ідентифікатори, місцезнаходження" style="flex:1;min-width:260px">' + A.sel('py', years().map(function (x) { return [x, x]; }), f.py, 'Усі роки') + A.sel('ps', PST, f.ps, 'Усі стани') + A.sel('nolink', [['1', 'Не привʼязані до активу / пулу']], f.nolink, 'Привʼязка') + (kind === 'sale' ? A.sel('pr', PRIO.map(function (x) { return [x[0], x[1].split(' (')[0]]; }), f.pr, 'Пріоритет') : '') +
      '<button class="btn">Знайти</button>' + (ed ? '<a class="btn gold" href="' + A.link('/bizplan/new', {kind: kind}) + '">+ План ' + (kind === 'mgmt' ? 'управління' : 'реалізації') + '</a>' : '') + '</form>' +
      (ks.length ? '<div class="panel"><h3>Очікувані надходження за прогнозними строками</h3>' + A.chart('barv', [ks.map(function (k) { return MON3[+k.slice(5) - 1] + ' ' + k.slice(2, 4); }), ks.map(function (k) { return Math.round(byM[k]); })], kind === 'mgmt' ? 'blue' : 'gold', null, {unit: 'money'}) + '</div>' : '') + planTable(list, kind);
  }
  var BF = [['uid', '№ плану', 'text'], ['name', 'Найменування активу / пулу', 'area'], ['asset_type', 'Вид активу', 'text'], ['ident', 'Ідентифікаційні дані', 'area'], ['location', 'Місцезнаходження', 'text'], ['owner', 'Власник', 'area'],
    ['phys_state', 'Фізичний стан', 'text'], ['valuation', 'Оцінка (вартість, реквізити звіту)', 'text'], ['mgmt_state', 'Стан управління / закупівлі', 'area'], ['legal_proc', 'Правові процедури', 'area'],
    ['plan_month', 'Прогноз строку: місяць', 'sel', MON.map(function (m, i) { return [String(i + 1), m]; })], ['plan_year', 'Прогноз строку: рік', 'sel', years().map(function (x) { return [String(x), String(x)]; })], ['auction_term', 'Строк (текстом)', 'text'],
    ['expected_revenue', 'Очікувані надходження, грн', 'num'], ['strategic', 'Стратегічний актив', 'sel', [['0', 'Ні'], ['1', 'Так']]], ['priority', 'Пріоритет реалізації (перелік «Активи в реалізації»)', 'sel', [['', '—']].concat(PRIO)], ['status', 'Стан', 'sel', PST], ['listed_date', 'Дата оголошення / початку', 'date'], ['finished_date', 'Дата завершення', 'date'],
    ['result_type', 'Тип результату', 'text'], ['result_amount', 'Фактичний результат, грн', 'num'], ['result_note', 'Примітка до результату', 'area'], ['resp_dma', 'Відповідальний виконавець', 'text'], ['vaks', 'Справа ВАКС (за наявності)', 'text'], ['comment', 'Коментар', 'area']];
  function bpForm(b, isNew, edit) {
    var kind = b.kind, ed = (kind === 'mgmt' ? canMgmt() : canSales()) && (isNew || edit), t = tgtOf(b);
    if (!ed) return '<dl class="vgrid"><div><dt>Об’єкт плану</dt><dd>' + (t ? '<a href="' + t.href + '">' + esc(t.code) + '</a>' : 'не привʼязано') + '</dd></div></dl>' + formFields(b, BF, false);
    var tgtOpts = kind === 'mgmt' ? [['contract', 'Договір управління'], ['asset', 'Актив Реєстру'], ['pool', 'Пул / складний актив']] : [['sale', 'Лот реалізації'], ['asset', 'Актив Реєстру'], ['pool', 'Пул / складний актив']];
    return '<form data-act="bp-save" data-id="' + (b.id || '') + '" data-kind="' + kind + '"><fieldset><legend>Привʼязка</legend><div class="form-grid">' + A.fsel('Тип об’єкта', 'target_type', tgtOpts, b.target_type || tgtOpts[0][0], 0, '', '', '') +
      A.field('Код об’єкта', 'target_code', t ? t.code : '', 'text', 0, 'код договору (ДУ-…), № активу, код пулу або № лоту', '', '') + '<div class="field"><label>&nbsp;</label><span class="row-actions"><button type="button" class="btn" data-click="pick" data-into="target_code" data-multi="0" data-set-type="target_type">🔎 Актив з Реєстру</button><button type="button" class="btn" data-click="pick" data-into="target_code" data-pools="only" data-set-type="target_type">🔎 Пул</button></span></div></div></fieldset><fieldset><legend>План ' + (kind === 'mgmt' ? 'управління' : 'реалізації') + '</legend>' + formFields(b, BF, ed) + '</fieldset>' +
      (ed ? '<div class="form-actions"><a class="btn plain" href="#/' + (kind === 'mgmt' ? 'mgmt' : 'sales') + '?tab=plans">Скасувати</a><button class="btn gold">' + (isNew ? 'Створити план' : 'Зберегти') + '</button></div>' : '') + '</form>';
  }
  A.on(/^\/bizplan\/new$/, function (f) {
    var kind = f.kind === 'sale' ? 'sale' : 'mgmt'; if (!(kind === 'mgmt' ? canMgmt() : canSales())) return A.deny();
    var y = yearNow(), pre = kind === 'mgmt' ? 'ПУ-' : 'ПР-', n = A.T('biz_plans').filter(function (b) { return (b.uid || '').indexOf(pre + y) === 0; }).length + 1;
    var b = {kind: kind, uid: pre + y + '-' + ('00' + n).slice(-3), status: 'planned', plan_year: y, target_type: f.tt || (kind === 'mgmt' ? 'contract' : 'sale'), target_id: f.tid ? +f.tid : null, strategic: 0};
    A.render(A.shell(kind === 'mgmt' ? 'Новий план управління' : 'Новий план реалізації', 'Привʼязка до активу / пулу / ' + (kind === 'mgmt' ? 'договору' : 'лота') + ', прогноз строку і очікуваних надходжень', '', bpForm(b, true)));
  });
  A.on(/^\/bizplan\/(\d+)$/, function (id, f) { var b = A.get('biz_plans', +id); if (!b) return A.notFound(); if (!(b.kind === 'mgmt' ? seeMgmt() : seeSales())) return A.deny(); var can = b.kind === 'mgmt' ? canMgmt() : canSales(), edit = can && f.edit === '1';
    A.render(A.shell((b.kind === 'mgmt' ? 'План управління ' : 'План реалізації ') + (b.uid || ''), (b.name || ''), (can ? (edit ? '<a class="btn gold" href="#/bizplan/' + b.id + '">✓ Завершити редагування</a>' : '<a class="btn gold" href="#/bizplan/' + b.id + '?edit=1">✎ Редагувати</a>') : '') + '<a class="btn plain" href="#/' + (b.kind === 'mgmt' ? 'mgmt' : 'sales') + '?tab=plans">До планів</a>', bpForm(b, false, edit))); });
  A.ACT['bp-save'] = function (form, d) {
    var isNew = !form.dataset.id, kind = form.dataset.kind, old = isNew ? {} : A.get('biz_plans', +form.dataset.id), rec = cleanRec(d, BF);
    ['plan_month', 'plan_year', 'strategic'].forEach(function (k) { if (rec[k] !== null && rec[k] !== undefined) rec[k] = +rec[k]; });
    var tt = d.target_type, code = (d.target_code || '').trim(), tid = null;
    if (code) {
      if (tt === 'asset') { var a = A.indexes.byNo[code]; if (!a) throw new Error('Актив «' + code + '» не знайдено'); tid = a.id; }
      else if (tt === 'pool') { var p = A.T('pools').filter(function (x) { return x.code === code; })[0]; if (!p) throw new Error('Пул «' + code + '» не знайдено'); tid = p.id; }
      else if (tt === 'contract') { var c = A.T('mgmt_contracts').filter(function (x) { return A.contractCode(x) === code || x.contract_no === code; })[0]; if (!c) throw new Error('Договір «' + code + '» не знайдено'); tid = c.id; }
      else if (tt === 'sale') { var s = A.T('sales').filter(function (x) { return x.uid === code; })[0]; if (!s) throw new Error('Лот «' + code + '» не знайдено'); tid = s.id; }
    }
    rec.target_type = code ? tt : null; rec.target_id = tid; rec.kind = kind;
    var tx = A.tx(), bid;
    if (isNew) { bid = A.tmpId(); rec.id = bid; rec.created_at = A.nowS(); rec.updated_by = S.user && S.user.login; rec.dept_code = S.user && S.user.dept_code; tx.put('biz_plans', rec); }
    else { bid = old.id; if (!diffPut(tx, 'biz_plans', old, rec)) return A.toast('Змін немає', 'info'); }
    tx.log(isNew ? 'Створено план ' + (kind === 'mgmt' ? 'управління' : 'реалізації') : 'Змінено план', 'bizplan', isNew ? null : bid);
    return tx.commit().then(function (r) { A.toast('Збережено'); A.go('#/bizplan/' + r.id('biz_plans', bid)); });
  };

  // ---------------------------------------------------------------- звіти: форма додатка до наказу (управління)
  // v2.6: у звіті — лише місяці обраного періоду (до 12), обраний договір або договори, що діяли в періоді хоча б один місяць / мали надходження
  var MONG = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  function periodForm(act, f, extra) {
    var P = A.mgmtPeriod(f, 12);
    return '<form class="filters" data-act="' + act + '"><label class="mini">з місяця ' + A.monthPick('from', P.from) + '</label><label class="mini">по місяць ' + A.monthPick('to', P.to) + '</label>' + (extra || '') + '</form>';
  }
  function contractOpts() { return A.T('mgmt_contracts').slice().sort(function (a, b) { return (a.seq_no || 1e6) - (b.seq_no || 1e6); }).map(function (c) { return '<option value="c' + c.id + '">' + esc(A.contractCode(c) + ' · ' + (c.manager_name || '').slice(0, 50)) + (c.status === 'archived' ? ' (архів)' : '') + '</option>'; }).join(''); }
  function mgmtReports(f) {
    return '<div class="grid g2"><div class="panel"><h3>Облік надходжень від управління активом <span>форма додатка до Методичних рекомендацій</span></h3><p class="mini">Форма один в один як у наказі: графи 1-14, помісячні графи 15-32 — <b>лише за місяці обраного періоду</b> (до 12), графи 231-245, рядок «РАЗОМ». До звіту входять договори, що діяли в періоді хоча б один місяць або за якими надходили кошти до бюджету; або один обраний договір.</p>' +
      periodForm('mgmt-form-run', f, '<label class="mini">Договори <select name="scope"><option value="period">що діяли в періоді / мали надходження</option><option value="all">усі в обліку</option><optgroup label="Один договір">' + contractOpts() + '</optgroup></select></label><button class="btn gold">Сформувати XLSX за формою</button>') + '</div>' +
      '<div class="panel"><h3>Зведені звіти</h3><p class="mini">Перелік договорів з надходженнями (казначейство, гр. 23, і звіти управителів, гр. 19), заборгованість на кінець періоду, план / прогноз / факт.</p>' +
      periodForm('mgmt-sum-run', f, '<select name="kind"><option value="list">Перелік договорів з надходженнями</option><option value="debt">Заборгованість за договорами</option><option value="plan">План / прогноз / факт за місяцями</option></select><button class="btn">Сформувати XLSX</button>') + '</div></div>';
  }
  // opt: {path, cols, rows, total, keep, cells: [[адреса, текст]], name, period}
  function fillForm(opt) {
    if (!opt.rows.length) return A.toast('Немає записів за умовами звіту', 'err');
    A.busy(true);
    return fetch(A.asset(opt.path), {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error('Шаблон форми недоступний'); return r.arrayBuffer(); }).then(function (buf) {
      return window.XLSX.fillTemplate(buf, {sheet: 'надходження', protoRow: 12, firstRow: 12, cols: opt.cols, rows: opt.rows, total: opt.total, totalRow: 13, keepCols: opt.keep, extraSheets: {'надходження': opt.cells}, freeze: 'E12'});
    }).then(function (b) { A.busy(false); window.XLSX.download(b, opt.name + '_' + opt.period.from + '_' + opt.period.to + '.xlsx'); A.audit('Вивантажено XLSX за формою: ' + opt.name, 'export', null, {rows: opt.rows.length, period: opt.period.title}); }, function (e) { A.busy(false); A.toast(e.message, 'err'); });
  }
  // підсумковий рядок «РАЗОМ» — формули SUM по стовпцях даних (Excel перераховує при відкритті); skip — текстові графи
  function sumRow(rows, cols, skip) { var t = [], cl = window.XLSX.col, last = 12 + rows.length - 1; for (var k = 0; k < cols; k++) { if (skip(k)) { t.push(null); continue; } var any = rows.some(function (r) { return typeof r[k] === 'number' || (r[k] && r[k].f); }); t.push(any ? {f: 'SUM(' + cl(k) + '12:' + cl(k) + last + ')'} : null); } t[1] = 'РАЗОМ'; return t; }
  // v2.7: формули у рядку договору — гр. 13 = значення на 01.01.2026 (з казначейством 2026 до початку періоду) + казначейство (гр. 23) місяців періоду;
  // гр. 22 = гр. 20 − гр. 12; гр. 25 = сума граф 26-30 (якщо внесено складові). Номер рядка Excel — 12 + i.
  function mgmtRow(c, i, P) {
    var cl = window.XLSX.col, rn = 12 + i, first = P.months[0], startKey = mkey(first.y, first.m);
    var base = nz(c.total_transferred_start) + sumf(monthsOf(c).filter(function (r) { return r.year >= 2026 && mkey(r.year, r.month) < startKey; }), fact);
    var tre = P.months.filter(function (x) { return x.y >= 2026; }).map(function (x) { return cl(14 + 18 * (x.m - 1) + 8) + rn; });
    var row = [i + 1, [c.contract_title, c.addenda].filter(Boolean).join('\n'), [c.manager_name, c.manager_code ? 'код ' + c.manager_code : ''].filter(Boolean).join(', '), c.asset_description, c.ruling, c.validity || (c.validity_date ? 'до ' + A.dt(c.validity_date) : null),
      c.conclusion_date ? A.dt(c.conclusion_date) : null, c.transfer_date ? (/^\d{4}-\d\d-\d\d$/.test(c.transfer_date) ? A.dt(c.transfer_date) : c.transfer_date) + (c.transfer_note ? '\n' + c.transfer_note : '') : c.transfer_note, c.program_status, c.remuneration_terms,
      c.planned_monthly || c.planned_monthly_budget || null, c.guarantee_monthly, {f: [String(Math.round(base * 100) / 100)].concat(tre).join('+')}, c.debt_start];
    var blocks = {}; P.months.forEach(function (x) { blocks[x.m] = mrec(c.id, x.y, x.m) || null; });
    for (var m = 1; m <= 12; m++) {
      var r = blocks[m], b = 14 + 18 * (m - 1);
      MF_ALL.forEach(function (x, k) { var v = r ? r[x[0]] : null; if (v === undefined) v = null;
        if (r && k === 7 && r.transferred_guarantee !== null && r.transferred_guarantee !== undefined && c.guarantee_monthly) v = {f: cl(b + 5) + rn + '-' + cl(11) + rn};
        if (r && k === 10 && [r.debt_guarantee, r.debt_inflation, r.debt_penalty, r.debt_interest, r.debt_fine].some(function (z) { return z !== null && z !== undefined; })) v = {f: 'SUM(' + cl(b + 11) + rn + ':' + cl(b + 15) + rn + ')'};
        row.push(v); });
    }
    return row.concat([c.prescription_ref, c.prescription_debt_total, c.prescription_debt_guarantee, c.prescription_debt_sanctions, c.prescription_execution, c.lawsuit_ref, c.claim_total, c.claim_debt, c.claim_sanctions, c.case_status, c.execution_status, c.resp_dma, c.resp_ukem, c.resp_dpz, c.resp_dms]);
  }
  function mgmtFormRun(list, P, name) {
    var rows = list.map(function (c, i) { return mgmtRow(c, i, P); }), keep = [], cells = [], cl = window.XLSX.col, last = P.months[P.months.length - 1];
    for (var k = 0; k < 14; k++) keep.push(k);
    P.months.forEach(function (x) { var b = 14 + 18 * (x.m - 1); for (var j = 0; j < 18; j++) keep.push(b + j); cells.push([cl(b) + '7', 'за ' + MON[x.m - 1] + ' ' + x.y + ' року']); });
    for (k = 230; k < 245; k++) keep.push(k);
    cells.push(['M7', 'перераховано до державного бюджету за весь період дії договору станом на кінець ' + MONG[last.m - 1] + ' ' + last.y + ' року'], ['N7', 'заборгованість на 01.01.2026 по надходженнях до бюджету'], ['B4', '(грн) · звітний період: ' + P.title]);
    var skip = function (k) { if (k < 10) return true; if (k >= 14 && k < 230) { var off = (k - 14) % 18; return off === 9 || off === 17; } return [230, 234, 235, 239, 240, 241, 242, 243, 244].indexOf(k) >= 0; };
    return fillForm({path: 'forms/mgmt_form.xlsx', cols: 245, rows: rows, total: sumRow(rows, 245, skip), keep: keep, cells: cells, name: name, period: P});
  }
  A.ACT['mgmt-form-run'] = function (form, d) {
    var P = A.mgmtPeriod(d, 12), sc = d.scope || 'period', all = A.T('mgmt_contracts').slice().sort(function (a, b) { return (a.seq_no || 1e6) - (b.seq_no || 1e6) || a.id - b.id; });
    var list = sc[0] === 'c' ? all.filter(function (c) { return 'c' + c.id === sc; }) : sc === 'all' ? all : all.filter(function (c) { return activeInPeriod(c, P); });
    return mgmtFormRun(list, P, list.length === 1 ? 'Облік_надходжень_' + A.contractCode(list[0]) : 'Облік_надходжень_від_управління');
  };
  A.CLICK['mgmt-form'] = function (t) { var c = A.get('mgmt_contracts', +t.dataset.ids), y = +t.dataset.y, cy = yearNow(), P = A.mgmtPeriod({from: y + '-01', to: y + '-' + (y === cy ? ('0' + A.today().slice(5, 7)).slice(-2) : '12')}, 12); return mgmtFormRun([c], P, 'Облік_надходжень_' + A.contractCode(c)); };
  A.ACT['mgmt-sum-run'] = function (form, d) {
    var P = A.mgmtPeriod(d, 24), all = A.T('mgmt_contracts').slice().sort(function (a, b) { return (a.seq_no || 1e6) - (b.seq_no || 1e6); }), inP = all.filter(function (c) { return activeInPeriod(c, P); });
    if (d.kind === 'debt') return A.xl('Заборгованість_договорів', [{name: 'Заборгованість', title: 'Заборгованість за договорами управління станом на кінець ' + P.months[P.months.length - 1].full, cols: ['№', 'Договір', 'Управитель', 'Актив', 'Дата укладання', 'Перераховано з початку дії', 'Гарантійний платіж', 'Інфляційні втрати', 'Пеня', '% річних', '% штрафу', 'Заборгованість всього', 'За результатами моніторингу', 'Дата виникнення / примітки', 'Припис / вимога', 'Судовий розгляд'].map(function (h) { return {h: h, w: 18}; }),
      rows: all.map(function (c) { var r = lastDebt(c, P.end) || {}; return [0, c.contract_title, c.manager_name, c.asset_description, A.dt(c.conclusion_date), cumOf(c, P.end), r.debt_guarantee, r.debt_inflation, r.debt_penalty, r.debt_interest, r.debt_fine, debtOf(r.id ? r : null) || null, r.monitoring_debt_sum, r.debt_date_info, c.prescription_ref, [c.lawsuit_ref, c.case_status, c.execution_status].filter(Boolean).join('\n')]; }).filter(function (r) { return nz(r[11]) || nz(r[6]); }).map(function (r, i) { r[0] = i + 1; return r; })}]);
    if (d.kind === 'plan') { var s = series(all, P); return A.xl('План_прогноз_факт_управління', [{name: 'План-факт', title: 'Надходження до бюджету від управління активами: план / прогноз / факт · ' + P.title, cols: ['Місяць', 'План за договорами, грн', 'Прогноз, грн', 'Факт — казначейство (гр. 23), грн', 'За звітами управителів (гр. 19), грн', 'Відхилення факту від плану, грн'].map(function (h) { return {h: h, w: 22}; }), rows: P.months.map(function (x, i) { return [x.full, s.plan[i], s.forecast[i], s.fact[i], s.rep[i], Math.round((s.fact[i] - s.plan[i]) * 100) / 100]; })}]); }
    var cols = ['№', 'Договір управління', 'Управитель', 'ЄДРПОУ / РНОКПП', 'Актив', 'Ухвала', 'Термін дії', 'Дата укладання', 'Гарантійний платіж / міс', 'Стан'];
    P.months.forEach(function (x) { cols.push('Дохід (гр. 15) — ' + x.full); }); P.months.forEach(function (x) { cols.push('Казначейство (гр. 23) — ' + x.full); }); cols.push('Казначейство за період', 'За звітами (гр. 19) за період', 'З початку дії договору', 'Прогноз на наступний місяць');
    return A.xl('Перелік_договорів_управління', [{name: 'Договори', title: 'Перелік договорів управління · ' + P.title + ' · договорів: ' + inP.length, cols: cols.map(function (h) { return {h: h, w: 16}; }),
      rows: inP.map(function (c, i) { var row = [i + 1, c.contract_title, c.manager_name, c.manager_code, c.asset_description, c.ruling, c.validity, A.dt(c.conclusion_date), c.guarantee_monthly, {active: 'діючий', terminated: 'припинено', archived: 'архів'}[c.status || 'active']];
        P.months.forEach(function (x) { var r = mrec(c.id, x.y, x.m); row.push(r ? r.income_report : null); }); P.months.forEach(function (x) { row.push(fact(mrec(c.id, x.y, x.m)) || null); });
        row.push(sumf(P.months, function (x) { return fact(mrec(c.id, x.y, x.m)); }), sumf(P.months, function (x) { return factRep(mrec(c.id, x.y, x.m)); }), cumOf(c, P.end)); var lr = mrec(c.id, P.months[P.months.length - 1].y, P.months[P.months.length - 1].m); row.push(lr ? lr.forecast_budget : null); return row; })}]);
  };
  A.CLICK['mgmt-xlsx-list'] = function () { var f = A.params(); return A.ACT['mgmt-sum-run'](null, {from: f.from, to: f.to, kind: 'list'}); };

  // ================================================================ розділ «Реалізація активів»
  var SST = [['preparation', 'Підготовка (оцінка, лоти)'], ['announced', 'Аукціон оголошено'], ['repeat', 'Повторний / голландський аукціон'], ['sold', 'Реалізовано'], ['not_sold', 'Не реалізовано'], ['withdrawn', 'Знято з реалізації']];
  var SF = {
    asset: [['seq_no', '1. № з/п', 'int'], ['uid', '2. Унікальний ідентифікаційний номер активу', 'text'], ['plan_no', '3. № у плані реалізації', 'text'], ['ruling', '4. Ухвала (підстава передачі на реалізацію) / згода власника', 'area'],
      ['ruling_date', 'Дата отримання ухвали / згоди (для контролю строків)', 'date'], ['accept_date', 'Дата прийняття активу (акт приймання-передачі)', 'date'], ['asset_kind', '5. Вид активу', 'sel', [['', '—'], ['Корпоративні права', 'Корпоративні права'], ['Нерухоме майно', 'Нерухоме майно'], ['Єдиний (цілісний) майновий комплекс', 'Єдиний (цілісний) майновий комплекс'], ['Земельні ділянки', 'Земельні ділянки'], ['Рухоме майно', 'Рухоме майно'], ['Транспортний засіб', 'Транспортний засіб'], ['Криптовалюта', 'Криптовалюта'], ['Інше', 'Інше']]],
      ['name', '6. Найменування активу (лаконічний опис)', 'area'], ['qty', '7. Кількість одиниць', 'num'], ['unit', '8. Одиниця виміру', 'text'], ['ident_data', '9. Ідентифікаційні дані (реєстр. №, кадастровий №, IMO, VIN, гаманець)', 'area'],
      ['reg_state', '10. Стан державної реєстрації', 'area'], ['location', '11. Місцезнаходження', 'text'], ['phys_state', '12. Фізичний стан / придатність', 'text'], ['status', 'Стан реалізації', 'sel', SST], ['note', 'Примітка', 'area']],
    val: [['val_prev', '13. Вартість за попередньою оцінкою, грн без ПДВ', 'num'], ['val_prev_report', '14. Реквізити звіту (попередня оцінка): дата, №', 'text'], ['val_prev_review', '15. Реквізити рецензії (попередня оцінка)', 'text'],
      ['val_last', '16. Вартість за останньою оцінкою, грн без ПДВ', 'num'], ['val_last_report', '17. Реквізити звіту (остання оцінка)', 'text'], ['val_last_review', '18. Реквізити рецензії (остання оцінка)', 'text'],
      ['val_other', '19. Вартість з інших джерел, грн', 'num'], ['val_other_source', '19. Джерело вартості', 'text'], ['val_expiry', '20. Дата завершення дії звіту про оцінку', 'date'], ['val_cost', '21. Вартість послуг з оцінки і рецензування, грн', 'num']],
    exp: [['exp_total', '22. Очікувані надходження — всього, грн', 'num'], ['exp_sale', '23. отримано від реалізації (без ПДВ, митних платежів, відшкодувань)', 'num'], ['exp_customs', '24. митні платежі до сплати', 'num'], ['exp_other', '25. інші платежі до сплати', 'num'], ['exp_refund', '26. відшкодування витрат переможцем', 'num']],
    auc: [['order_ref', '27. Наказ АРМА про реалізацію і затвердження оголошення', 'text'], ['a1_pub', '28. Дата публікації оголошення (1-й аукціон)', 'date'], ['a1_lot', '28. ID лота (1-й аукціон)', 'text'], ['a1_result', '29. Відбувся / не відбувся', 'sel', [['', '—'], ['відбувся', 'відбувся'], ['не відбувся', 'не відбувся']]], ['a1_date', '29. Дата аукціону', 'date'], ['a1_start', '30. Стартова ціна', 'num'], ['a1_price', '31. Вартість реалізації (0 — не реалізовано)', 'num'],
      ['a2_decision', '32. Рішення АРМА щодо другого аукціону', 'text'], ['a2_pub', '33. Дата публікації (2-й аукціон)', 'date'], ['a2_lot', '33. ID лота (2-й аукціон)', 'text'], ['a2_result', '34. Відбувся / не відбувся', 'sel', [['', '—'], ['відбувся', 'відбувся'], ['не відбувся', 'не відбувся']]], ['a2_date', '34. Дата аукціону', 'date'], ['a2_start', '35. Стартова ціна (−50 %)', 'num'], ['a2_price', '36. Вартість реалізації', 'num'],
      ['a3_decision', '37. Рішення АРМА щодо голландського аукціону', 'text'], ['a3_pub', '38. Дата публікації (голландський)', 'date'], ['a3_lot', '38. ID лота (голландський)', 'text'], ['a3_result', '39. Відбувся / не відбувся', 'sel', [['', '—'], ['відбувся', 'відбувся'], ['не відбувся', 'не відбувся']]], ['a3_date', '39. Дата аукціону', 'date'], ['a3_start', '40. Стартова ціна', 'num'], ['a3_price', '41. Вартість реалізації', 'num']],
    res: [['protocol_ref', '42. Протокол про результати аукціону (лот, дата, №)', 'text'], ['funds_date', '43. Дата надходження коштів', 'date'], ['funds_sum', '44. Сума надходження коштів, грн', 'num'], ['act_ref', '45. Акт про реалізацію активу', 'text'], ['contract_ref', '46. Договір купівлі-продажу', 'text'],
      ['resp_kur', '167. Відповідальний від Відділу координації управління та реалізації (ПІБ, телефон)', 'text'], ['resp_money', '168. Відповідальний від Відділу управління грошовими коштами та банківськими металами', 'text']]
  };
  var SMF = [['plan_sum', '47. Очікувані надходження (план)'], ['fact_total', '48. Фактично — всього'], ['fact_sale', '49. у т.ч. отримано від реалізації'], ['fact_customs', '50. у т.ч. митні платежі'], ['fact_other', '51. у т.ч. інші платежі'], ['fact_refund', '52. у т.ч. відшкодування витрат'],
    ['explanation', '54. Пояснення відхилення / причини нереалізації і заходи', 'text'], ['budget_sum', '55. Перераховано до бюджету (митні / інші платежі)'], ['budget_date', '56. Дата перерахування', 'text']];
  function smrec(sid, y, m) { return (A.indexes.salesMonthly[sid] || []).filter(function (r) { return r.year === y && r.month === m; })[0]; }
  function saleFact(s) { return nz(s.funds_sum) || sumf(A.indexes.salesMonthly[s.id] || [], 'fact_total'); }
  A.on(/^\/sales$/, function (f) {
    if (!seeSales()) return A.deny();
    var tab = f.tab || 'analytics', all = A.T('sales'), h = '', P = A.mgmtPeriod(f);
    var T = function (k, l, n) { return '<a href="' + A.link('/sales', k === 'analytics' ? {} : {tab: k}) + '" class="' + (tab === k ? 'on' : '') + '">' + l + (n !== undefined ? ' <span class="pill">' + A.num(n) + '</span>' : '') + '</a>'; };
    var sold = all.filter(function (s) { return s.status === 'sold'; }), inwork = all.filter(function (s) { return ['preparation', 'announced', 'repeat'].indexOf(s.status || 'preparation') >= 0; });
    h += '<div class="grid g5">' + A.kpi('Лотів на реалізації', A.num(inwork.length), 'з ' + all.length + ' в обліку', A.link('/sales', {tab: 'lots'})) + A.kpi('Аукціон оголошено', A.num(all.filter(function (s) { return s.status === 'announced' || s.status === 'repeat'; }).length), 'зокрема повторні / голландські', A.link('/sales', {tab: 'lots', st: 'announced'})) +
      A.kpi('Очікувані надходження', money(sumf(inwork, 'exp_total')), 'графа 22 за лотами в роботі') + A.kpi('Реалізовано', A.num(sold.length), 'отримано ' + money(sumf(sold, saleFact)), A.link('/sales', {tab: 'lots', st: 'sold'})) +
      A.kpi('Строки за наказом', A.num(all.filter(function (s) { return deadlines(s).some(function (x) { return x.over; }); }).length), 'лотів з простроченими кроками', A.link('/sales', {tab: 'lots', over: 1}), 'overdue') + '</div>';
    h += '<div class="tabs cat-tabs" style="margin:16px 0 12px">' + T('analytics', 'Аналітика') + T('lots', 'Облік лотів', all.length) + T('plans', 'Плани реалізації', A.T('biz_plans').filter(function (b) { return b.kind === 'sale'; }).length) + T('reports', 'Звіти') + '</div>';
    if (tab === 'analytics') {
      var plan = [], fa = [], pl = A.T('biz_plans').filter(function (b) { return b.kind === 'sale'; });
      P.months.forEach(function (x) { var y = x.y, m = x.m; var p = sumf(all, function (s) { var r = smrec(s.id, y, m); return r ? r.plan_sum : 0; }) || sumf(pl.filter(function (b) { return b.plan_year === y && b.plan_month === m; }), 'expected_revenue'); plan.push(Math.round(p)); fa.push(Math.round(sumf(all, function (s) { var r = smrec(s.id, y, m); return r ? r.fact_total : (s.funds_date && s.funds_date.slice(0, 7) === y + '-' + ('0' + m).slice(-2) ? s.funds_sum : 0); }))); });
      h += periodBar('/sales', f, P) + '<div class="panel"><h3>Надходження від реалізації · ' + esc(P.title) + ' <span>план (гр. 47 або план реалізації) · факт (гр. 48 / 44)</span></h3>' + combo(P.months.map(function (x) { return x.label; }), [{name: 'Очікувані (план)', values: plan, color: '#F5C518'}, {name: 'Фактично', values: fa, color: '#3DD68C'}], {fullLabels: P.months.map(function (x) { return x.full; })}) + '</div>';
      h += '<div class="grid g3" style="margin-top:14px"><div class="panel"><h3>Стан реалізації</h3>' + A.chart('donut', A.series(A.grp(all, function (s) { return A.map(SST)[s.status || 'preparation']; }), null, null), null, ['#6E7F9E', '#F5C518', '#F5A524', '#3DD68C', '#F0524E', '#8B7BF7']) + '</div>' +
        '<div class="panel"><h3>Вид активу</h3>' + A.chart('barh', A.series(A.grp(all, function (s) { return s.asset_kind || 'Не визначено'; }), null, null), 'gold') + '</div>' +
        '<div class="panel"><h3>Очікувані надходження за видом</h3>' + A.chart('barh', A.series(A.sum(inwork, function (s) { return s.asset_kind || 'Не визначено'; }, function (s) { return s.exp_total; }), null, null), 'cyan', null, {unit: 'money'}) + '</div></div>';
    }
    if (tab === 'lots') h += salesList(all, f);
    if (tab === 'plans') h += plansList('sale', f);
    if (tab === 'reports') h += '<div class="grid g2"><div class="panel"><h3>Облік надходжень від реалізації арештованих активів (додаток до Методичних рекомендацій)</h3><p class="mini">Форма один в один як у наказі: графи 1-46, помісячні графи 47-56 — <b>лише за місяці обраного періоду</b>, графи 167-168, рядок «РАЗОМ». Строк внесення — щомісяця до 1 числа; Управління з оцінки ризиків інформує Голову АРМА до 10 числа.</p>' +
      periodForm('sales-form-run', f, '<label class="mini">Лоти <select name="scope"><option value="period">у роботі та з обліком / надходженнями в періоді</option><option value="all">усі в обліку</option><optgroup label="Один лот">' + A.T('sales').map(function (s) { return '<option value="s' + s.id + '">' + esc((s.uid || 'Лот ' + s.id) + ' · ' + (s.name || '').slice(0, 50)) + '</option>'; }).join('') + '</optgroup></select></label><button class="btn gold">Сформувати XLSX за формою</button>') + '</div>' +
      '<div class="panel"><h3>Контроль строків за наказом</h3><p class="mini">Перелік лотів із контрольними строками кроків (від дати ухвали / прийняття / протоколу / надходження коштів) і простроченнями.</p><button class="btn" data-click="sales-deadlines-xlsx">XLSX строків</button></div></div>';
    A.render(A.shell('Реалізація активів', 'Облік лотів, аукціонів і надходжень від реалізації; плани реалізації; контроль строків за наказом. Відповідальний — Відділ координації управління та реалізації', canSales() ? '<a class="btn gold" href="#/sale/new">+ Лот реалізації</a>' : '', h), A.keep);
  });
  function salesList(all, f) {
    var w = words(f.q), list = all.filter(function (s) { return (!w.length || match([s.uid, s.plan_no, s.name, s.ident_data, s.location, s.a1_lot, s.a2_lot, s.a3_lot, s.ruling].join(' '), w)) && (!f.st || (f.st === 'announced' ? s.status === 'announced' || s.status === 'repeat' : (s.status || 'preparation') === f.st)) && (!f.over || deadlines(s).some(function (x) { return x.over; })); })
      .sort(function (a, b) { return (a.seq_no || 1e6) - (b.seq_no || 1e6) || a.id - b.id; });
    var pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    return '<form class="filters" data-act="filter" data-base="/sales"><input type="hidden" name="tab" value="lots"><input name="q" value="' + esc(f.q || '') + '" placeholder="№, найменування, ідентифікатори, ID лота, ухвала" style="flex:1;min-width:260px">' + A.sel('st', SST, f.st, 'Усі стани') + A.sel('over', [['1', 'Є прострочені строки']], f.over, 'Строки') + '<button class="btn">Знайти</button></form>' + A.pager(list.length, pg.page, '/sales', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>№ / план</th><th>Найменування</th><th>Вид</th><th class="num">Оцінка</th><th class="num">Очікувані надходження</th><th>Аукціон</th><th class="num">Отримано</th><th>Стан</th></tr></thead><tbody>' +
      pg.rows.map(function (s) { var a = s.asset_id && A.get('assets', s.asset_id), ov = deadlines(s).filter(function (x) { return x.over; }).length, last = s.a3_lot || s.a2_lot || s.a1_lot;
        return '<tr><td class="nowrap"><a class="id" href="#/sale/' + s.id + '">' + esc(s.uid || 'Лот ' + s.id) + '</a><span class="sub">' + esc(s.plan_no && s.plan_no !== s.uid ? s.plan_no : '') + (a ? ' <a href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a>' : '') + '</span></td><td style="max-width:380px"><span class="clip3" title="' + esc(s.name || '') + '">' + esc(s.name || '') + '</span></td>' +
          '<td class="mini">' + esc(s.asset_kind || '') + '</td><td class="num">' + money(s.val_last || s.val_prev || s.val_other) + '</td><td class="num">' + money(s.exp_total) + '</td><td class="mini">' + esc(last || '—') + '</td><td class="num">' + money(saleFact(s)) + '</td>' +
          '<td class="mini">' + esc(A.map(SST)[s.status || 'preparation'] || s.status) + (ov ? '<br><span class="tag t-lost">прострочено: ' + ov + '</span>' : '') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="8"><div class="empty">Лотів не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/sales', q);
  }
  // контрольні строки за Методичними рекомендаціями (розділ III) — робочі дні від події
  function addWd(d, n) { return d ? A.addWorkdays(d, n) : null; }
  function deadlines(s) {
    var t = A.today(), out = [];
    function k(name, from, n, doneDate, doneFlag) { if (!from) return; var due = addWd(from, n), done = doneDate || doneFlag; out.push({name: name, due: due, done: done, over: !done && due < t}); }
    k('Призначення відповідального, внесення до Дашборду (3 р. дн. з ухвали / згоди)', s.ruling_date, 3, null, s.resp_kur);
    k('Доручення МТУ (наступний р. день після звернення з ухвалою)', s.ruling_date, 1, null, s.accept_date);
    k('Підписаний акт приймання-передачі від прокурора (10 р. дн. з звернення)', s.ruling_date, 10, s.accept_date);
    k('Заходи з оцінки і запит до Держмитслужби (3 р. дн. з прийняття)', s.accept_date, 3, null, s.val_last || s.val_prev || s.val_last_report);
    k('Оприлюднення оголошення на сайті АРМА (наступний р. день після наказу)', s.order_ref ? (s.a1_pub || t) : null, 0, s.a1_pub);
    if (s.a1_result === 'не відбувся') k('Доповідна Голові і повторний аукціон (наступний день після аукціону)', s.a1_date, 1, s.a2_pub || s.a2_decision);
    if (s.a2_result === 'не відбувся') k('Доповідна Голові і голландський аукціон (наступний день)', s.a2_date, 1, s.a3_pub || s.a3_decision);
    var aucDate = s.a3_result === 'відбувся' ? s.a3_date : s.a2_result === 'відбувся' ? s.a2_date : s.a1_result === 'відбувся' ? s.a1_date : null;
    k('Підписання протоколу з переможцем (10 р. дн. з формування)', aucDate, 10, null, s.protocol_ref);
    k('Акт про реалізацію (3 р. дн. з надходження коштів)', s.funds_date, 3, null, s.act_ref);
    if (s.status !== 'sold' && s.status !== 'withdrawn') { var mm = t.slice(0, 8) + '01', rr = smrec(s.id, +t.slice(0, 4), +t.slice(5, 7) === 1 ? 12 : +t.slice(5, 7) - 1); out.push({name: 'Щомісячне внесення до Дашборду (до 1 числа) — попередній місяць', due: mm, done: !!rr, over: !rr && t > mm}); }
    return out;
  }
  A.saleDeadlines = deadlines;
  A.on(/^\/sale\/(new|\d+)$/, function (id, f) {
    if (!seeSales()) return A.deny();
    var isNew = id === 'new'; if (isNew && !canSales()) return A.deny();
    var s = isNew ? {seq_no: A.T('sales').reduce(function (m, x) { return Math.max(m, x.seq_no || 0); }, 0) + 1, status: 'preparation', dept_code: 'realization'} : A.get('sales', +id); if (!s) return A.notFound();
    var edit = f.edit === '1', ed = canSales() && (edit || isNew), y = +f.y || yearNow();
    if (isNew) return A.render(A.shell('Новий лот реалізації', 'Графи 1-12 форми обліку надходжень від реалізації', '', saleForm(s, 'asset', true, true)));
    var a = s.asset_id && A.get('assets', s.asset_id), p = s.pool_id && A.get('pools', s.pool_id), dl = deadlines(s), plans = (A.indexes.bizByTarget['sale:' + s.id] || []);
    var h = (edit ? '<div class="flash info edit-flag">Режим редагування: поля відкриті для змін. Після внесення — «Зберегти» у відповідному блоці, потім «Завершити редагування».</div>' : '') + '<div class="grid g5">' + A.kpi('Оцінка', money(s.val_last || s.val_prev || s.val_other), s.val_last ? 'остання оцінка' : s.val_prev ? 'попередня' : 'з інших джерел') + A.kpi('Очікувані надходження', money(s.exp_total), 'графа 22') + A.kpi('Отримано', money(saleFact(s)), s.funds_date ? 'кошти ' + A.dt(s.funds_date) : 'графи 44 / 48') +
      A.kpi('Стан', esc(A.map(SST)[s.status || 'preparation'] || ''), s.a3_lot || s.a2_lot || s.a1_lot || '') + A.kpi('Строки', A.num(dl.filter(function (x) { return x.over; }).length), 'прострочених кроків', null, dl.some(function (x) { return x.over; }) ? 'overdue' : '') + '</div>';
    var tabs = [['s-asset', 'Актив і підстава (1-12)'], ['s-val', 'Оцінка (13-21)'], ['s-exp', 'Очікувані надходження (22-26)'], ['s-auc', 'Аукціони (27-41)'], ['s-res', 'Результат (42-46, 167-168)'], ['s-month', 'Помісячний облік (47-56)'], ['s-dead', 'Строки за наказом'], ['s-plan', 'План реалізації'], ['s-docs', 'Документи']];
    h += '<div class="tabs" data-tabbar="sale" data-start="' + esc(f.tab || 's-asset') + '" style="margin-top:14px">' + tabs.map(function (t) { return '<a href="#" data-tab="' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div>';
    h += '<div class="tabpane" id="s-asset" data-group="sale">' + saleForm(s, 'asset', ed, false) + '</div>';
    ['val', 'exp', 'auc', 'res'].forEach(function (g) { h += '<div class="tabpane" id="s-' + g + '" data-group="sale">' + saleForm(s, g, ed, false) + '</div>'; });
    h += '<div class="tabpane" id="s-month" data-group="sale">' + yearChips('/sale/' + s.id, Object.assign({tab: 's-month'}, edit ? {edit: 1} : {}), y) + saleMonthTable(s, y, ed) + '</div>';
    h += '<div class="tabpane" id="s-dead" data-group="sale"><div class="wrap-tbl"><table><thead><tr><th>Крок (Методичні рекомендації, розділ III)</th><th>Контрольний строк</th><th>Стан</th></tr></thead><tbody>' + dl.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="nowrap">' + A.dt(x.due) + '</td><td>' + (x.done ? '<span class="tag t-ok">виконано</span>' : x.over ? '<span class="tag t-lost">прострочено</span>' : '<span class="tag t-lim">у строк</span>') + '</td></tr>'; }).join('') +
      (dl.length ? '' : '<tr><td colspan="3"><div class="empty">Внесіть дату отримання ухвали / згоди і дату прийняття активу — строки розрахуються автоматично.</div></td></tr>') + '</tbody></table></div><p class="mini">Ті самі кроки й нормативи — у типовому бізнес-процесі «Реалізація активу на електронних торгах» (план дій активу / пулу).</p></div>';
    h += '<div class="tabpane" id="s-plan" data-group="sale">' + planTable(plans, 'sale') + (canSales() ? '<p><a class="btn gold" href="' + A.link('/bizplan/new', {kind: 'sale', tt: 'sale', tid: s.id}) + '">+ План реалізації лота</a></p>' : '') + '</div>';
    h += '<div class="tabpane" id="s-docs" data-group="sale">' + A.docsBlock('sale', s.id, ed, ['sale_order', 'auction_protocol', 'sale_act', 'sale_contract', 'valuation_report', 'transfer_act', 'court_scan', 'other']) + '</div>';
    var tq = f.tab || 's-asset', act = (canSales() ? (edit ? '<a class="btn gold" href="' + A.link('/sale/' + s.id, {tab: tq, y: f.y}) + '">✓ Завершити редагування</a>' : '<a class="btn gold" href="' + A.link('/sale/' + s.id, {tab: tq, y: f.y, edit: 1}) + '">✎ Редагувати</a>') : '') +
      (A.can('export') ? '<a class="btn" href="#" data-click="sale-form" data-id="' + s.id + '" data-y="' + y + '">XLSX за формою</a>' : '') + (a ? '<a class="btn" href="#/asset/' + a.id + '">Актив ' + esc(a.asset_no) + '</a>' : '') + (p ? '<a class="btn" href="#/pool/' + p.id + '">Пул ' + esc(p.code) + '</a>' : '') + (A.can('delete_records') && edit ? '<button class="btn danger" data-click="sale-del" data-id="' + s.id + '" data-confirm="Видалити лот реалізації з помісячним обліком?">Видалити</button>' : '') + '<a class="btn plain" href="#/sales?tab=lots">До переліку</a>';
    A.render(A.shell('Лот реалізації ' + (s.uid || s.id), (s.name || ''), act, h), A.keep);
  });
  function saleForm(s, g, ed, isNew) {
    var extra = '';
    var an = (s.asset_id && (A.get('assets', s.asset_id) || {}).asset_no) || '', pc = (s.pool_id && (A.get('pools', s.pool_id) || {}).code) || '';
    if (g === 'asset') extra = ed ? '<div class="form-grid">' + A.field('№ активу в Реєстрі (привʼязка)', 'asset_no', an, 'text', 0, 'для лота з одного активу — оберіть з Реєстру', '', '') + A.field('Код пулу (привʼязка)', 'pool_code', pc, 'text', 0, 'для лота з пулу / складного активу', '', '') +
      '<div class="field"><label>&nbsp;</label><span class="row-actions"><button type="button" class="btn" data-click="pick" data-into="asset_no" data-multi="0">🔎 Актив з Реєстру</button><button type="button" class="btn" data-click="pick" data-into="pool_code" data-pools="only">🔎 Пул</button></span></div></div>'
      : '<dl class="vgrid"><div><dt>Актив Реєстру</dt><dd>' + (an ? '<a href="#/asset/' + s.asset_id + '">' + esc(an) + '</a>' : '—') + '</dd></div><div><dt>Пул / складний актив</dt><dd>' + (pc ? '<a href="#/pool/' + s.pool_id + '">' + esc(pc) + '</a>' : '—') + '</dd></div></dl>';
    return '<form data-act="sale-save" data-id="' + (s.id || '') + '" data-grp="' + g + '"><fieldset><legend>' + {asset: 'Графи 1-12', val: 'Графи 13-21: вартість активу (без ПДВ)', exp: 'Графи 22-26: очікувані надходження', auc: 'Графи 27-41: аукціони', res: 'Графи 42-46 і 167-168'}[g] + '</legend>' + extra + formFields(s, SF[g], ed) + '</fieldset>' +
      (ed ? '<div class="form-actions">' + (isNew ? '<a class="btn plain" href="#/sales?tab=lots">Скасувати</a>' : '') + '<button class="btn gold">' + (isNew ? 'Створити лот' : 'Зберегти') + '</button></div>' : '') + '</form>';
  }
  A.ACT['sale-save'] = function (form, d) {
    var isNew = !form.dataset.id, g = form.dataset.grp, old = isNew ? {} : A.get('sales', +form.dataset.id), rec = cleanRec(d, SF[g]);
    if (g === 'asset') {
      var no = (d.asset_no || '').trim(), pc = (d.pool_code || '').trim();
      if (no) { var a = A.indexes.byNo[no]; if (!a) throw new Error('Актив «' + no + '» не знайдено'); rec.asset_id = a.id; if (!rec.name && isNew) rec.name = a.name; } else rec.asset_id = null;
      if (pc) { var p = A.T('pools').filter(function (x) { return x.code === pc; })[0]; if (!p) throw new Error('Пул «' + pc + '» не знайдено'); rec.pool_id = p.id; } else rec.pool_id = null;
      if (!rec.uid && !old.uid) rec.uid = no || ('ПР-' + yearNow() + '-' + ('00' + (A.T('sales').length + 1)).slice(-3));
    }
    if (g === 'exp' && rec.exp_total === null && (rec.exp_sale || rec.exp_customs || rec.exp_other || rec.exp_refund)) rec.exp_total = nz(rec.exp_sale) + nz(rec.exp_customs) + nz(rec.exp_other) + nz(rec.exp_refund);
    var tx = A.tx(), sid;
    if (isNew) { sid = A.tmpId(); rec.id = sid; rec.dept_code = 'realization'; rec.created_at = A.nowS(); rec.updated_by = S.user && S.user.login; tx.put('sales', rec); }
    else { sid = old.id; if (!diffPut(tx, 'sales', old, rec)) return A.toast('Змін немає', 'info'); }
    tx.log(isNew ? 'Створено лот реалізації' : 'Змінено лот реалізації (' + g + ')', 'sale', isNew ? null : sid);
    return tx.commit().then(function (r) { A.toast('Збережено'); A.go('#/sale/' + r.id('sales', sid) + (isNew ? '' : '?tab=s-' + g + '&edit=1')); });
  };
  A.CLICK['sale-del'] = function (t) { var tx = A.tx(); tx.del('sales', +t.dataset.id); tx.log('Видалено лот реалізації', 'sale', +t.dataset.id); return tx.commit().then(function () { A.go('#/sales?tab=lots'); }); };
  function saleMonthTable(s, y, ed) {
    var h = '<form data-act="sm-save" data-id="' + s.id + '" data-y="' + y + '"><div class="wrap-tbl"><table class="mm"><thead><tr><th>Місяць ' + y + '</th>' + SMF.map(function (x) { return '<th class="num" title="' + esc(x[1]) + '"><span class="clip3">' + esc(x[1]) + '</span></th>'; }).join('') + '<th class="num">53. Відхилення факт − план</th></tr></thead><tbody>';
    var tp = 0, tf = 0;
    for (var m = 1; m <= 12; m++) {
      var r = smrec(s.id, y, m) || {}; tp += nz(r.plan_sum); tf += nz(r.fact_total);
      h += '<tr' + (m % 2 ? '' : ' class="alt"') + '><td class="nowrap">' + MON[m - 1] + '</td>' + SMF.map(function (x) { var v = r[x[0]], text = x[2] === 'text';
        return '<td' + (text ? '' : ' class="num"') + '>' + (ed ? '<input name="v_' + m + '_' + x[0] + '" value="' + esc(v === null || v === undefined ? '' : (text ? v : A.fmtIn(v))) + '"' + (text ? '' : ' inputmode="decimal" data-num') + ' style="width:100%;min-width:' + (text ? 170 : 110) + 'px">' : (text ? esc(v || '') : (v === null || v === undefined ? '' : A.num(v, 2)))) + '</td>'; }).join('') +
        '<td class="num">' + (r.plan_sum !== undefined && r.plan_sum !== null || r.fact_total !== undefined && r.fact_total !== null ? A.num(nz(r.fact_total) - nz(r.plan_sum), 2) : '') + '</td></tr>';
    }
    h += '<tr class="total"><td><b>Разом за рік</b></td><td class="num"><b>' + A.num(tp, 2) + '</b></td><td class="num"><b>' + A.num(tf, 2) + '</b></td><td colspan="' + (SMF.length - 2) + '"></td><td class="num"><b>' + A.num(tf - tp, 2) + '</b></td></tr></tbody></table></div>' +
      (ed ? '<div class="form-actions"><button class="btn gold">Зберегти ' + y + ' рік</button></div>' : '') + '</form><p class="mini">Дашборд заповнюється щомісяця; помісячні очікувані суми не виключаються, зокрема якщо аукціон не відбувся (п. 70). Якщо актив не реалізовано — у графі 48 зазначається 0, у графі 54 — причини і заходи (повторний аукціон, повторна оцінка, реклама).</p>';
    return h;
  }
  A.ACT['sm-save'] = function (form, d) {
    var sid = +form.dataset.id, y = +form.dataset.y, tx = A.tx(), n = 0;
    for (var m = 1; m <= 12; m++) {
      var old = smrec(sid, y, m), rec = {};
      SMF.forEach(function (x) { var key = 'v_' + m + '_' + x[0]; if (!(key in d)) return; var v = (d[key] || '').trim(); if (v === '') v = null; else if (x[2] !== 'text') { var nn = A.parseNum(v); if (nn === null) throw new Error(MON[m - 1] + ': «' + v + '» — потрібне число'); v = nn; } rec[x[0]] = v; });
      if (old) { var p = {id: old.id}, k2 = 0; Object.keys(rec).forEach(function (k) { if (!same(old[k], rec[k])) { p[k] = rec[k]; k2++; } }); if (k2) { p.updated_at = A.nowS(); p.updated_by = S.user && S.user.login; tx.put('sales_monthly', p); n++; } }
      else if (Object.keys(rec).some(function (k) { return rec[k] !== null; })) { tx.put('sales_monthly', Object.assign({id: A.tmpId(), sale_id: sid, year: y, month: m, created_at: A.nowS(), updated_by: S.user && S.user.login}, rec)); n++; }
    }
    if (!n) return A.toast('Змін немає', 'info');
    tx.log('Помісячний облік реалізації: ' + y, 'sale', sid, {months: n});
    return tx.commit().then(function () { A.toast('Збережено місяців: ' + n); A.route(true); });
  };
  function aucCell(res, dt) { return [res, A.dt(dt)].filter(function (x) { return x && x !== '—'; }).join(', ') || null; }
  // v2.7: формули — гр. 22 = сума 23-26 (якщо внесено складові); гр. 48 = сума 49-52 (якщо внесено складові); гр. 53 = гр. 48 − гр. 47
  function saleRow(s, i, P) {
    var dt = function (v) { return v ? A.dt(v) : null; }, cl = window.XLSX.col, rn = 12 + i, has = function (a) { return a.some(function (z) { return z !== null && z !== undefined && z !== ''; }); };
    var row = [i + 1, s.uid, s.plan_no, s.ruling, s.asset_kind, s.name, s.qty, s.unit, s.ident_data, s.reg_state, s.location, s.phys_state, s.val_prev, s.val_prev_report, s.val_prev_review, s.val_last, s.val_last_report, s.val_last_review,
      s.val_other ? s.val_other : null, dt(s.val_expiry), s.val_cost, has([s.exp_sale, s.exp_customs, s.exp_other, s.exp_refund]) ? {f: 'SUM(W' + rn + ':Z' + rn + ')'} : s.exp_total, s.exp_sale, s.exp_customs, s.exp_other, s.exp_refund, s.order_ref,
      [dt(s.a1_pub), s.a1_lot].filter(Boolean).join(', ') || null, aucCell(s.a1_result, s.a1_date), s.a1_start, s.a1_price, s.a2_decision, [dt(s.a2_pub), s.a2_lot].filter(Boolean).join(', ') || null, aucCell(s.a2_result, s.a2_date), s.a2_start, s.a2_price,
      s.a3_decision, [dt(s.a3_pub), s.a3_lot].filter(Boolean).join(', ') || null, aucCell(s.a3_result, s.a3_date), s.a3_start, s.a3_price, s.protocol_ref, dt(s.funds_date), s.funds_sum, s.act_ref, s.contract_ref];
    var blocks = {}; P.months.forEach(function (x) { blocks[x.m] = smrec(s.id, x.y, x.m) || null; });
    for (var m = 1; m <= 12; m++) { var r = blocks[m], b = 46 + 10 * (m - 1), P0 = cl(b) + rn, F0 = cl(b + 1) + rn;
      row.push(r ? r.plan_sum : null, r ? (has([r.fact_sale, r.fact_customs, r.fact_other, r.fact_refund]) ? {f: 'SUM(' + cl(b + 2) + rn + ':' + cl(b + 5) + rn + ')'} : r.fact_total) : null, r ? r.fact_sale : null, r ? r.fact_customs : null, r ? r.fact_other : null, r ? r.fact_refund : null,
        r && (has([r.plan_sum, r.fact_total, r.fact_sale])) ? {f: F0 + '-' + P0} : null, r ? r.explanation : null, r ? r.budget_sum : null, r ? r.budget_date : null); }
    return row.concat([s.resp_kur, s.resp_money]);
  }
  function salesFormRun(list, P, name) {
    var rows = list.map(function (s, i) { return saleRow(s, i, P); }), keep = [], cells = [], cl = window.XLSX.col;
    for (var k = 0; k < 46; k++) keep.push(k);
    P.months.forEach(function (x) { var b = 46 + 10 * (x.m - 1); for (var j = 0; j < 10; j++) keep.push(b + j); cells.push([cl(b) + '7', 'за ' + MON[x.m - 1] + ' ' + x.y + ' року']); });
    keep.push(166, 167); cells.push(['B4', '(грн) · звітний період: ' + P.title]);
    var skip = function (k) { if (k < 12) return k !== 6; if ([13, 14, 16, 17, 19, 26, 27, 28, 31, 32, 33, 36, 37, 38, 41, 42, 44, 45].indexOf(k) >= 0) return true; if (k >= 46 && k < 166) { var off = (k - 46) % 10; return off === 7 || off === 9; } return k >= 166; };
    return fillForm({path: 'forms/sales_form.xlsx', cols: 168, rows: rows, total: sumRow(rows, 168, skip), keep: keep, cells: cells, name: name, period: P});
  }
  A.ACT['sales-form-run'] = function (form, d) {
    var P = A.mgmtPeriod(d, 12), sc = d.scope || 'period', all = A.T('sales').slice().sort(function (a, b) { return (a.seq_no || 1e6) - (b.seq_no || 1e6) || a.id - b.id; });
    var inP = function (s) { var mm = P.months.some(function (x) { return !!smrec(s.id, x.y, x.m); }), fd = s.funds_date && P.months.some(function (x) { return s.funds_date.slice(0, 7) === x.y + '-' + ('0' + x.m).slice(-2); });
      return mm || fd || ['preparation', 'announced', 'repeat'].indexOf(s.status || 'preparation') >= 0; };
    var list = sc[0] === 's' ? all.filter(function (s) { return 's' + s.id === sc; }) : sc === 'all' ? all : all.filter(inP);
    return salesFormRun(list, P, list.length === 1 ? 'Облік_реалізації_' + (list[0].uid || list[0].id) : 'Облік_надходжень_від_реалізації');
  };
  A.CLICK['sale-form'] = function (t) { var s = A.get('sales', +t.dataset.id), y = +t.dataset.y, cy = yearNow(); return salesFormRun([s], A.mgmtPeriod({from: y + '-01', to: y + '-' + (y === cy ? A.today().slice(5, 7) : '12')}, 12), 'Облік_реалізації_' + (s.uid || s.id)); };
  A.CLICK['sales-deadlines-xlsx'] = function () {
    var rows = []; A.T('sales').forEach(function (s) { deadlines(s).forEach(function (x) { rows.push([s.uid, s.name, A.map(SST)[s.status || 'preparation'], x.name, A.dt(x.due), x.done ? 'виконано' : x.over ? 'прострочено' : 'у строк', s.resp_kur]); }); });
    return A.xl('Строки_реалізації', [{name: 'Строки', title: 'Контроль строків реалізації за Методичними рекомендаціями · ' + A.dt(A.today()), cols: ['Лот', 'Найменування', 'Стан', 'Крок', 'Контрольний строк', 'Стан кроку', 'Відповідальний'].map(function (h) { return {h: h, w: h === 'Найменування' || h === 'Крок' ? 50 : 18}; }), rows: rows}]);
  };

  // посилання з картки активу / пулу на договір управління, лоти і плани (зауваження 21.10.2026, п. 12)
  A.mgmtLinks = function (tt, o) {
    var out = [], cid = o.mgmt_contract_id;
    if (cid && seeMgmt()) { var c = A.get('mgmt_contracts', cid); if (c) out.push('Договір управління <a href="#/contract/' + c.id + '"><b>' + esc(A.contractCode(c)) + '</b> — ' + esc((c.manager_name || '').slice(0, 70)) + '</a>'); }
    if (seeSales()) (A.indexes[tt === 'pool' ? 'salesByPool' : 'salesByAsset'][o.id] || []).forEach(function (s) { out.push('Лот реалізації <a href="#/sale/' + s.id + '"><b>' + esc(s.uid || s.id) + '</b></a> · ' + esc(A.map(SST)[s.status || 'preparation'] || '')); });
    (A.indexes.bizByTarget[tt + ':' + o.id] || []).forEach(function (b) { if (b.kind === 'mgmt' ? seeMgmt() : seeSales()) out.push((b.kind === 'mgmt' ? 'План управління' : 'План реалізації') + ' <a href="#/bizplan/' + b.id + '"><b>' + esc(b.uid || b.id) + '</b></a>' + (b.plan_year ? ' · прогноз ' + (b.plan_month ? MON[b.plan_month - 1] + ' ' : '') + b.plan_year : '') + (b.expected_revenue ? ' · ' + A.money(b.expected_revenue) : '')); });
    return out.length ? '<div class="flash info">' + out.join('<br>') + '</div>' : '';
  };
  // масова дія в реєстрі: додати обрані активи до договору управління
  A.contractOptions = function () { return A.T('mgmt_contracts').filter(isActive).map(function (c) { return ['c' + c.id, A.contractCode(c) + ' — ' + (c.manager_name || '').slice(0, 40)]; }); };
})();
