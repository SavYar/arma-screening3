/* Розділ «Ідентифікація» (v2.2, зауваження 13.10.2026): електронна форма замість ручного ведення таблиці «БАЗОВА».
   Звернення → ухвали → активи (записи). Лічильники (кол. A, B, E, F, K, L, P, Q, AK–AO, AQ) рахуються автоматично —
   під час аналітики і вивантаження у XLSX у структурі файлу. Типовий процес обирається з загальних бізнес-процесів;
   місія Управління ідентифікації завершується етапом 09 «Внесено до Реєстру активів» — далі оцінка, зберігання,
   пошук управителя та реалізація ведуться в картці активу. МТУ вносить результати огляду, фото й документи; після
   внесення до Реєстру ці матеріали переносяться до документів і фото активу. */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S, dd = A.dd;
  var M2 = function (l) { return A.map((l || []).map(function (x) { return [x[0], x[1]]; })); };
  var OPT = function (l) { return (l || []).map(function (x) { return [x[0], x[1]]; }); };
  N.IBODY = M2(D.IDENT_BODIES); N.IRESTR = M2(D.IDENT_RESTRICTIONS); N.IKIND = M2(D.IDENT_KINDS); N.IUSE = M2(D.IDENT_USAGE);
  N.ITECH = M2(D.IDENT_TECH); N.IREASON = M2(D.IDENT_REASONS); N.IRES = M2(D.IDENT_RESULTS); N.IUSER = M2(D.IDENT_USER_STATUS);
  var KIND_CAT = {}, RES_POS = {}; (D.IDENT_KINDS || []).forEach(function (k) { KIND_CAT[k[0]] = k[2]; }); (D.IDENT_RESULTS || []).forEach(function (r) { RES_POS[r[0]] = r[2]; });
  var TERMS = D.IDENT_TERMS || {conclusion_days: 30, mtu_days: 10};
  var BASIS = [['ident', 'Право власності / інше речове право'], ['lease', 'Договір оренди'], ['loan', 'Договір позички'], ['other_contract', 'Інший договір'], ['none', 'Без правових підстав'], ['unknown', 'Не встановлено']];
  var STAGES = [['registered', '01 Звернення зареєстровано'], ['executor', '02 Визначено виконавця'], ['mtu', '03 Доручення МТУ'], ['inspected', '04 Огляд проведено'], ['draft', '05 Проєкт висновку'],
    ['agreed', '06 Погоджено УВКБ'], ['conclusion', '07 Висновок підписано / направлено'], ['accepted', '08 Прийнято в управління'], ['registry', '09 Внесено до Реєстру активів']];
  var STG = A.map(STAGES), ORD = {}; STAGES.forEach(function (s, i) { ORD[s[0]] = i + 1; });
  var MONTHS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
  var MONTHS_F = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  var BASES = [['reg', 'Дата реєстрації звернення'], ['ruling', 'Дата ухвали суду'], ['concl', 'Дата підписання висновку'], ['due', 'Строк висновку (у т. ч. майбутні)'], ['mtu', 'Строк огляду МТУ (у т. ч. майбутні)']];

  A.identStage = function (s, possible) { return '<span class="stage ' + esc(s || '') + (possible === 'no' ? ' impossible' : '') + '">' + esc(STG[s] || 'Не визначено') + (possible === 'no' && ORD[s] >= 7 ? ' · неможливе' : '') + '</span>'; };
  function canE() { return A.can('ident_edit'); }
  function canMtu(r) { return !canE() && A.can('ident_mtu') && S.user && S.user.mtu_code && r && r.mtu_code === S.user.mtu_code; }
  function canView() { return A.can('ident_view') || A.can('ident_edit') || A.can('ident_mtu'); }
  function isoDate(s) { if (!s) return null; s = String(s); var m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/); if (m) return m[3] + '-' + m[2] + '-' + m[1]; m = s.match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : null; }
  function addDays(d, n) { if (!d) return null; var x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
  function appealOf(r) { return r && r.appeal_id ? A.get('ident_appeals', r.appeal_id) : null; }
  function rulingOf(r) { return r && r.ruling_id ? A.get('ident_rulings', r.ruling_id) : null; }
  function recsOfAppeal(id) { return (A.indexes.identByAppeal || {})[id] || []; }
  function recsOfRuling(id) { return (A.indexes.identByRuling || {})[id] || []; }
  function rulingsOf(id) { return ((A.indexes.rulingsByAppeal || {})[id] || []).slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0) || a.id - b.id; }); }
  function unitKey(r) { return r.group_id ? 'g' + r.group_id : 'r' + r.id; }
  function cplx(r) { return r.complexity || (/складн/i.test(r.atype || '') ? 'complex' : 'simple'); }
  function apLabel(ap) { return ap ? 'Звернення ' + (ap.seq || '#' + ap.id) + (ap.reg_date ? ' від ' + A.dt(ap.reg_date) : '') + (ap.reg_no ? ' № ' + ap.reg_no : '') : '—'; }
  function ruLabel(ru) { return ru ? 'Ухвала ' + (ru.seq || '#' + ru.id) + ' · ' + (ru.court || '') + (ru.ruling_date ? ' від ' + A.dt(ru.ruling_date) : '') + (ru.case_no ? ', справа № ' + ru.case_no : '') : '—'; }
  function bodyName(ap) { return ap ? (ap.body && ap.body !== 'other' ? N.IBODY[ap.body] : '') || (ap.body_text || '').split(/\s+від|\n/)[0] || N.IBODY[ap.body] || '—' : '—'; }

  // етап за заповненими полями (та сама логіка, що app/ident.py stage_of)
  A.identStageOf = function (r, ap) {
    var d = r.data || {}, st = 'registered';
    if (ap && (ap.executor || ap.executor_id)) st = 'executor';
    if (r.mtu_order_date || d.c27) st = 'mtu';
    if (r.inspect_date || r.usage_state || r.tech_state || d.c32 || d.c31) st = 'inspected';
    if (r.draft_date || r.result_code || r.reason_code) st = 'draft';
    if (r.agreed_date) st = 'agreed';
    if (r.conclusion_date) st = 'conclusion';
    if (r.possible !== 'no') {
      if (r.accepted_date || d.c44 || d.c49 || d.c44n || d.c49n) st = 'accepted';
      if (r.asset_id && st === 'accepted') st = 'registry';     // 09 — лише після передачі в управління АРМА (08)
    }
    return st;
  };
  // підтипи як у зведенні «Інформація про опрацювання звернень» (Аркуш2 файлу)
  var SUB_C = ['Земельні ділянки у складі майнового комплексу', 'Майнові комплекси', 'Готельний комплекс / розважальні заклади', 'Нежитлові будівлі', 'Транспорт у складі майнового комплексу', 'Корпоративні права', 'Інше (складні)'];
  var SUB_S = ['Квартири', 'Будинки', 'Гаражі / машиномісця', 'Транспорт', 'Земельні ділянки', 'Об’єкти нежитлової нерухомості', 'Інше (прості)'];
  function subtype(r) {
    var t = ((r.asset_desc || '') + ' ' + (N.IKIND[r.category] || r.kind || '')).toLowerCase();
    if (cplx(r) === 'complex') {
      if (/корпоратив|частк[аиу] в статутн|акці/.test(t)) return SUB_C[5]; if (/транспорт|автомоб|причіп|вагон|трактор/.test(t)) return SUB_C[4];
      if (/земельн|кадастров/.test(t)) return SUB_C[0]; if (/готел|розважальн|ресторан|санатор/.test(t)) return SUB_C[2]; if (/майнов\w* комплекс|цілісн/.test(t)) return SUB_C[1];
      if (/нежитл|будівл|приміщен/.test(t)) return SUB_C[3]; return SUB_C[6];
    }
    if (/квартир/.test(t)) return SUB_S[0]; if (/будинок|котедж/.test(t) && !/нежитл/.test(t)) return SUB_S[1]; if (/гараж|машиномісц|паркомісц/.test(t)) return SUB_S[2];
    if (/транспорт|автомоб|мотоцикл|причіп/.test(t)) return SUB_S[3]; if (/земельн|кадастров/.test(t)) return SUB_S[4]; if (/нежитл|приміщен|будівл/.test(t)) return SUB_S[5]; return SUB_S[6];
  }
  A.identSub = subtype;

  // ================================================================ період: роки / місяці (минулі й майбутні), база дати
  function bdate(r, basis) {
    var ap = appealOf(r) || {}, ru = rulingOf(r) || {};
    return basis === 'ruling' ? ru.ruling_date : basis === 'concl' ? r.conclusion_date : basis === 'due' ? (r.conclusion_date ? null : ap.due_date) : basis === 'mtu' ? (r.inspect_date ? null : r.mtu_due) : (ap.reg_date || r.appeal_date);
  }
  function inPer(d, f) {
    if (f.from && (!d || d < f.from)) return false; if (f.to && (!d || d > f.to)) return false;
    if (!f.y) return true; if (!d) return false; if (d.slice(0, 4) !== String(f.y)) return false;
    return !f.m || +d.slice(5, 7) === +f.m;
  }
  function years() {
    var ys = {}, cy = +A.today().slice(0, 4); for (var yy = cy; yy <= Math.max(2030, cy + 4); yy++) ys[yy] = 1;
    A.T('ident_appeals').forEach(function (a) { if (a.reg_date) ys[a.reg_date.slice(0, 4)] = 1; if (a.due_date) ys[a.due_date.slice(0, 4)] = 1; });
    A.T('ident_records').forEach(function (r) { if (r.conclusion_date) ys[r.conclusion_date.slice(0, 4)] = 1; });
    return Object.keys(ys).sort();
  }
  function periodBar(base, f, keep) {
    var q = function (o) { return A.link(base, Object.assign({}, keep || {}, {basis: f.basis}, o)); }, cy = A.today().slice(0, 4), cm = +A.today().slice(5, 7);
    var h = '<div class="panel period"><div class="chips"><span class="mini">Рік:</span><a class="chip' + (!f.y ? ' on' : '') + '" href="' + q({}) + '">Усі</a>' +
      years().map(function (y) { return '<a class="chip' + (String(f.y) === y ? ' on' : '') + (y > cy ? ' future' : '') + '" href="' + q({y: y}) + '">' + y + (y > cy ? ' ⏵' : '') + '</a>'; }).join('') + '</div>';
    if (f.y) h += '<div class="chips"><span class="mini">Місяць:</span><a class="chip' + (!f.m ? ' on' : '') + '" href="' + q({y: f.y}) + '">Увесь рік</a>' + MONTHS.map(function (m, i) {
      var fut = f.y > cy || (String(f.y) === cy && i + 1 > cm); return '<a class="chip' + (+f.m === i + 1 ? ' on' : '') + (fut ? ' future' : '') + '" href="' + q({y: f.y, m: i + 1}) + '">' + m + '</a>'; }).join('') + '</div>';
    h += '<form class="filters" data-act="filter" data-base="' + base + '" style="margin:6px 0 0">' + Object.keys(keep || {}).map(function (k) { return keep[k] ? '<input type="hidden" name="' + k + '" value="' + esc(keep[k]) + '">' : ''; }).join('') +
      (f.y ? '<input type="hidden" name="y" value="' + esc(f.y) + '">' : '') + (f.m ? '<input type="hidden" name="m" value="' + esc(f.m) + '">' : '') +
      '<span class="mini">Рахувати за датою:</span>' + A.sel('basis', BASES, f.basis || 'reg', null) + '<span class="mini">або довільний період</span><input type="date" name="from" value="' + esc(f.from || '') + '"><input type="date" name="to" value="' + esc(f.to || '') + '"><button class="btn sm">Застосувати</button></form></div>';
    return h;
  }
  function tabs(cur) {
    var t = [['/ident', 'Аналітика'], ['/ident/appeals', 'Звернення'], ['/ident/list', 'Активи (записи)']];
    return '<div class="tabs static">' + t.map(function (x) { return '<a href="#' + x[0] + '" class="' + (cur === x[0] ? 'on' : '') + '">' + x[1] + '</a>'; }).join('') + '</div>';
  }
  function perText(f) { return (f.m ? MONTHS_F[f.m - 1] + ' ' : '') + (f.y || '') + (f.from || f.to ? ' ' + (f.from ? 'з ' + A.dt(f.from) : '') + (f.to ? ' по ' + A.dt(f.to) : '') : '') || 'увесь період'; }
  function visible() { return A.T('ident_records'); }

  // ================================================================ аналітика
  A.on(/^\/ident$/, function (f) {
    if (!canView()) return A.deny();
    f.basis = f.basis || 'reg';
    var all = visible().filter(function (r) { return inPer(bdate(r, f.basis), f); }), L = function (o) { return A.link('/ident/list', Object.assign({y: f.y, m: f.m, from: f.from, to: f.to, basis: f.basis}, o)); };
    var ap = {}, ru = {}, units = {}, concl = {};
    all.forEach(function (r) { if (r.appeal_id) ap[r.appeal_id] = 1; if (r.ruling_id) ru[r.ruling_id] = 1; var k = unitKey(r); if (!units[k]) units[k] = r; if (r.conclusion_date) concl[(r.appeal_id || r.appeal_no) + ':' + r.conclusion_date] = 1; });
    var U = Object.keys(units).map(function (k) { return units[k]; }), cnt = function (fn) { return U.filter(fn).length; }, t = A.today();
    var overdue = A.T('ident_appeals').filter(function (a) { return a.due_date && a.due_date < t && recsOfAppeal(a.id).some(function (r) { return !r.conclusion_date; }); });
    var h = tabs('/ident') + periodBar('/ident', f);
    h += '<div class="grid g5">' + A.kpi('Звернень', A.num(Object.keys(ap).length), perText(f), A.link('/ident/appeals', {y: f.y, m: f.m, basis: f.basis})) + A.kpi('Ухвал суду', A.num(Object.keys(ru).length), 'у зверненнях') +
      A.kpi('Активів', A.num(U.length), 'складних ' + cnt(function (r) { return cplx(r) === 'complex'; }) + ' · простих ' + cnt(function (r) { return cplx(r) === 'simple'; }) + ' · записів ' + all.length, L({})) +
      A.kpi('Висновків', A.num(Object.keys(concl).length), 'підписано', L({stage_min: 'conclusion'})) + A.kpi('Строк висновку минув', A.num(overdue.length), 'звернень без висновку (на сьогодні)', A.link('/ident/appeals', {status: 'overdue'}), 'overdue') + '</div><div class="grid g5" style="margin-top:14px">' +
      A.kpi('Управління можливе', A.num(cnt(function (r) { return r.possible === 'yes'; })), 'активів за висновком', L({possible: 'yes'})) + A.kpi('Управління неможливе', A.num(cnt(function (r) { return r.possible === 'no'; })), 'активів за висновком', L({possible: 'no'})) +
      A.kpi('08 Прийнято в управління', A.num(cnt(function (r) { return ORD[r.stage] >= 8; })), 'ухвала / акт', L({stage_min: 'accepted'})) + A.kpi('09 Внесено до Реєстру', A.num(cnt(function (r) { return r.stage === 'registry'; })), 'місію ідентифікації завершено', L({stage: 'registry'})) +
      A.kpi('На огляді МТУ', A.num(cnt(function (r) { return r.stage === 'mtu'; })), 'доручено, огляд не внесено', L({stage: 'mtu'})) + '</div>';
    // динаміка за місяцями (обраний рік — 12 місяців, у т. ч. майбутні; без року — останні 18 місяців)
    var mm;
    if (f.y) mm = MONTHS.map(function (_, i) { return f.y + '-' + (i < 9 ? '0' : '') + (i + 1); });
    else { var ks = {}; visible().forEach(function (r) { var d = bdate(r, f.basis); if (d) ks[d.slice(0, 7)] = 1; }); mm = Object.keys(ks).sort().slice(-18); }
    var byM = function (fn) { return mm.map(function (m) { var u = {}; visible().forEach(function (r) { var d = fn(r); if (d && d.slice(0, 7) === m) u[unitKey(r)] = 1; }); return Object.keys(u).length; }); };
    var mLinks = mm.map(function (m) { return L({y: m.slice(0, 4), m: +m.slice(5, 7), from: null, to: null}); });
    var stg = A.series(A.grp(U, 'stage'), STG, function (v) { return L({stage: v}); }), mtu = A.series(A.grp(U, 'mtu_code'), N.MTU, function (v) { return L({mtu: v}); });
    var kinds = A.series(A.grp(U, 'category'), N.IKIND, function (v) { return L({kind: v}); }), res = A.series(A.grp(U, 'result_code'), N.IRES, function (v) { return L({result: v}); });
    var subC = A.grp(U.filter(function (r) { return cplx(r) === 'complex'; }), subtype), subS = A.grp(U.filter(function (r) { return cplx(r) === 'simple'; }), subtype);
    h += '<h2>Аналітика <span class="mini">за ' + esc(perText(f)) + ' · база: ' + esc(A.map(BASES)[f.basis]) + '</span></h2><div class="grid g3">' +
      '<div class="panel"><h3>' + esc(A.map(BASES)[f.basis]) + ' <span>активів за місяцями</span></h3>' + A.chart('barv', [mm.map(function (m) { return MONTHS[+m.slice(5, 7) - 1] + '.' + m.slice(2, 4); }), byM(function (r) { return bdate(r, f.basis); }), mLinks], 'cyan') + '</div>' +
      '<div class="panel"><h3>Етап процесу 01–09</h3>' + A.chart('barh', stg, 'violet') + '</div>' +
      '<div class="panel"><h3>Результат ідентифікації</h3>' + A.chart('donut', res, null, ['#3DD68C', '#F0524E', '#F5C518', '#8B7BF7', '#6E7F9E']) + '</div>' +
      '<div class="panel"><h3>Вид активу</h3>' + A.chart('barh', kinds, 'gold') + '</div><div class="panel"><h3>За МТУ</h3>' + A.chart('barh', mtu, 'cyan') + '</div>' +
      '<div class="panel"><h3>Складні / прості <span>за видами</span></h3>' + A.chart('barh', A.series(subC.concat(subS), null, function (v) { return L({sub: v}); }), 'ok') + '</div></div>';
    // календар строків: місяці обраного (або поточного) року, з майбутніми строками
    var cy = f.y || A.today().slice(0, 4), cmo = A.today().slice(0, 7);
    var rows = MONTHS.map(function (_, i) {
      var m = cy + '-' + (i < 9 ? '0' : '') + (i + 1), inM = function (d) { return d && d.slice(0, 7) === m; };
      var aps = A.T('ident_appeals').filter(function (a) { return inM(a.reg_date); }), rus = A.T('ident_rulings').filter(function (x) { return inM(x.ruling_date); });
      var recs = visible().filter(function (r) { return inM((appealOf(r) || {}).reg_date || r.appeal_date); }), cs = {}, due = 0, dueOver = 0, mt = 0, mtD = 0;
      visible().forEach(function (r) { if (inM(r.conclusion_date)) cs[(r.appeal_id || '') + ':' + r.conclusion_date] = 1; if (inM(r.mtu_order_date)) mt++; if (inM(r.mtu_due) && !r.inspect_date) mtD++; });
      A.T('ident_appeals').forEach(function (a) { if (inM(a.due_date) && recsOfAppeal(a.id).some(function (r) { return !r.conclusion_date; })) { due++; if (a.due_date < A.today()) dueOver++; } });
      var u = {}; recs.forEach(function (r) { u[unitKey(r)] = 1; });
      return '<tr class="' + (m > cmo ? 'future' : m === cmo ? 'now' : '') + '"><td><a href="' + A.link('/ident', {y: cy, m: i + 1, basis: f.basis}) + '">' + MONTHS_F[i] + '</a>' + (m > cmo ? ' <span class="mini">майбутній</span>' : '') + '</td><td class="num">' + (aps.length || '') + '</td><td class="num">' + (rus.length || '') + '</td><td class="num">' + (Object.keys(u).length || '') + '</td>' +
        '<td class="num">' + (mt || '') + '</td><td class="num">' + (mtD || '') + '</td><td class="num">' + (Object.keys(cs).length || '') + '</td><td class="num">' + (due ? '<a href="' + A.link('/ident/appeals', {due: m}) + '">' + due + '</a>' : '') + '</td><td class="num">' + (dueOver ? '<b style="color:#FF8A86">' + dueOver + '</b>' : '') + '</td></tr>';
    });
    h += '<h2>Календар ' + esc(cy) + ' <span class="mini">надходження і строки — минулі та майбутні місяці</span></h2><div class="wrap-tbl"><table class="cal"><thead><tr><th>Місяць</th><th class="num">Звернень</th><th class="num">Ухвал</th><th class="num">Активів</th><th class="num">Доручень МТУ</th><th class="num">Строк огляду МТУ</th><th class="num">Висновків</th><th class="num">Строк висновку</th><th class="num">з них минув</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    // зведення за зверненнями (структура «Інформація про опрацювання звернень»)
    var byA = {}; all.forEach(function (r) { var k = r.appeal_id || 'x' + (r.appeal_no || ''); (byA[k] = byA[k] || []).push(r); });
    h += '<h2>Опрацювання звернень <span class="mini">лічильники рахуються автоматично</span></h2>' + appealsTable(Object.keys(byA).map(function (k) { return {ap: A.get('ident_appeals', +k), rs: byA[k]}; }));
    var act = (canE() ? '<a class="btn gold" href="#/ident/appeal/new">+ Звернення</a>' : '') + (A.can('export') ? '<a class="btn" href="#" data-click="ident-xlsx" data-q="' + esc(JSON.stringify({y: f.y, m: f.m, from: f.from, to: f.to, basis: f.basis})) + '">XLSX «БАЗОВА» за період</a>' : '');
    A.render(A.shell('Ідентифікація активів', 'Звернення прокурорів, ухвали, огляд МТУ, висновки · етапи 01–09 до внесення в Реєстр активів', act, h), A.keep);
  });
  function appealsTable(items) {
    var t = A.today();
    items = items.filter(function (x) { return x.ap || x.rs.length; }).sort(function (a, b) { return ((b.ap || {}).reg_date || '').localeCompare((a.ap || {}).reg_date || '') || ((b.ap || {}).seq || 0) - ((a.ap || {}).seq || 0); });
    return '<div class="wrap-tbl"><table><thead><tr><th>№</th><th>Реєстрація в АРМА</th><th>Орган</th><th>Провадження</th><th class="num">Ухвал</th><th class="num">Складні</th><th class="num">Прості</th><th class="num">Записів</th><th class="num">Можливе</th><th class="num">Неможливе</th><th>Етап (найменший)</th><th>Строк висновку</th><th>Виконавець</th></tr></thead><tbody>' +
      items.map(function (x) {
        var ap = x.ap || {}, rs = x.rs, u = {}, rl = {}; rs.forEach(function (r) { if (!u[unitKey(r)]) u[unitKey(r)] = r; if (r.ruling_id) rl[r.ruling_id] = 1; });
        var us = Object.keys(u).map(function (k) { return u[k]; }), n = function (fn) { return us.filter(fn).length; };
        var minSt = rs.reduce(function (m, r) { return ORD[r.stage] && ORD[r.stage] < m ? ORD[r.stage] : m; }, 99), open = rs.some(function (r) { return !r.conclusion_date; });
        var over = open && ap.due_date && ap.due_date < t;
        return '<tr><td>' + (ap.id ? '<a class="id" href="#/ident/appeal/' + ap.id + '">' + esc(ap.seq || ap.id) + '</a>' : '—') + '</td><td class="nowrap">' + A.dt(ap.reg_date) + '<span class="sub">№ ' + esc(ap.reg_no || '—') + '</span></td><td class="mini" style="max-width:220px">' + esc(bodyName(ap)) + '</td>' +
          '<td class="mini mono">' + esc(ap.proceeding_no || '') + '</td><td class="num">' + (Object.keys(rl).length || (ap.id ? rulingsOf(ap.id).length : 0)) + '</td><td class="num">' + n(function (r) { return cplx(r) === 'complex'; }) + '</td><td class="num">' + n(function (r) { return cplx(r) === 'simple'; }) + '</td><td class="num"><b>' + rs.length + '</b></td>' +
          '<td class="num">' + n(function (r) { return r.possible === 'yes'; }) + '</td><td class="num">' + n(function (r) { return r.possible === 'no'; }) + '</td><td>' + (minSt < 99 ? A.identStage(STAGES[minSt - 1][0]) : '—') + '</td>' +
          '<td class="nowrap">' + (ap.due_date ? (over ? '<b style="color:#FF8A86">' + A.dt(ap.due_date) + '</b><span class="sub">минув</span>' : A.dt(ap.due_date) + (open ? '' : '<span class="sub">висновок є</span>')) : '—') + '</td><td class="mini">' + esc(ap.executor || '') + '</td></tr>';
      }).join('') + (items.length ? '' : '<tr><td colspan="13"><div class="empty">Звернень за умовами не знайдено.</div></td></tr>') + '</tbody></table></div>';
  }

  // ================================================================ звернення: перелік
  A.on(/^\/ident\/appeals$/, function (f) {
    if (!canView()) return A.deny();
    f.basis = f.basis || 'reg';
    var w = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean), t = A.today();
    var aps = A.T('ident_appeals').filter(function (a) {
      var rs = recsOfAppeal(a.id);
      if (A.can('ident_mtu') && !canE() && !rs.length) return false;
      var d = f.basis === 'due' ? a.due_date : f.basis === 'ruling' ? (rulingsOf(a.id)[0] || {}).ruling_date : f.basis === 'concl' ? (rs.filter(function (r) { return r.conclusion_date; })[0] || {}).conclusion_date : a.reg_date;
      if (!inPer(d, f)) return false;
      if (f.due && (a.due_date || '').slice(0, 7) !== f.due) return false;
      if (f.body && a.body !== f.body) return false;
      var open = rs.some(function (r) { return !r.conclusion_date; }) || !rs.length;
      if (f.status === 'open' && !open) return false; if (f.status === 'closed' && open) return false; if (f.status === 'overdue' && !(open && a.due_date && a.due_date < t)) return false;
      if ((f.due || f.status === 'overdue') && !open) return false;
      if (w.length) { var s = [a.seq, a.reg_no, a.body_text, N.IBODY[a.body], a.proceeding_no, a.articles, a.executor, a.note].concat(rulingsOf(a.id).map(function (x) { return x.court + ' ' + x.case_no; })).join(' ').toLowerCase(); if (!w.every(function (x) { return s.indexOf(x) >= 0; })) return false; }
      return true;
    });
    var h = tabs('/ident/appeals') + periodBar('/ident/appeals', f, {q: f.q, body: f.body, status: f.status}) +
      '<form class="filters" data-act="filter" data-base="/ident/appeals"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ звернення, орган, провадження, суд, справа" style="flex:1;min-width:240px">' +
      A.sel('body', OPT(D.IDENT_BODIES), f.body, 'Усі органи') + A.sel('status', [['open', 'Без висновку'], ['overdue', 'Строк висновку минув'], ['closed', 'Висновок є за всіма активами']], f.status, 'Усі стани') +
      ['y', 'm', 'basis', 'from', 'to', 'due'].map(function (k) { return f[k] ? '<input type="hidden" name="' + k + '" value="' + esc(f[k]) + '">' : ''; }).join('') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/ident/appeals">Скинути</button></form>' +
      appealsTable(aps.map(function (a) { return {ap: a, rs: recsOfAppeal(a.id)}; }));
    A.render(A.shell('Ідентифікація · звернення', 'Звернень за умовами: ' + aps.length, canE() ? '<a class="btn gold" href="#/ident/appeal/new">+ Звернення</a>' : '', h), A.keep);
  });

  // ================================================================ звернення: картка і форма
  function IDPROC() { return D.PROCESSES.filter(function (p) { return /^identification/.test(p[0]); }).map(function (p) { return [p[0], p[1]]; }); }
  function mtuOfAppeal(id) { var m = {}; recsOfAppeal(id).forEach(function (r) { if (r.mtu_code) m[r.mtu_code] = 1; }); return Object.keys(m); }
  function planOpt(ap) { var ms = mtuOfAppeal(ap.id || 0), ex = ap.executor || null;
    var a = {}; a['Управління ідентифікації, оцінки та збереження активів'] = ex;
    return {assign: a, mtu: ms.join(',') || null, mtuNames: ms.map(function (c) { return N.MTU[c]; }).join(', ') || 'МТУ за місцезнаходженням активів'}; }
  A.identPlanOpt = planOpt;
  function identUsers() { return A.T('users').filter(function (u) { return u.is_active !== 0 && (u.role_code === 'ident' || u.role_code === 'admin'); }).map(function (u) { return [u.id, u.full_name + (u.position ? ' — ' + u.position : '')]; }); }
  function appealForm(ap, edit) {
    var F = A.field, S2 = A.fsel, fs = function (t, body) { return '<fieldset' + (edit ? '' : ' disabled') + '><legend>' + t + '</legend><div class="form-grid">' + body + '</div></fieldset>'; };
    var h = '<form data-act="ident-appeal-save" data-id="' + (ap.id || '') + '">' +
      fs('Реєстрація в АРМА (кол. A–C)', F('Дата надходження', 'reg_date', ap.reg_date, 'date', 1) + F('Вхідний реєстраційний №', 'reg_no', ap.reg_no, 'text', 1, 'наприклад, 2474/27-26') +
        F('№ з/п звернення', 'seq', ap.seq, 'number', 0, 'присвоюється автоматично') + F('Строк підготовки висновку', 'due_date', ap.due_date, 'date', 0, 'порожньо — дата надходження + ' + TERMS.conclusion_days + ' дн.')) +
      fs('Орган, що надіслав звернення (кол. D)', S2('Орган', 'body', OPT(D.IDENT_BODIES), ap.body, 1) + F('Вихідна дата', 'out_date', ap.out_date, 'date') + F('Вихідний №', 'out_no', ap.out_no) +
        (ap.body === 'other' || (ap.body_text && !ap.body) ? F('Найменування органу (для «Інший орган»)', 'body_text', ap.body_text, 'text', 0, '', 'wide') : '<input type="hidden" name="body_text" value="' + esc(ap.body_text || '') + '">')) +
      fs('Кримінальне провадження (кол. H)', F('№ кримінального провадження (ЄРДР)', 'proceeding_no', ap.proceeding_no, 'text', 0, '17 цифр', '', 'pattern="\\d{17}" inputmode="numeric"') + F('Дата внесення до ЄРДР', 'proceeding_date', ap.proceeding_date, 'date') +
        F('Правова кваліфікація', 'articles', ap.articles, 'text', 0, 'наприклад, ч. 3 ст. 209 КК України', 'wide')) +
      fs('Виконання', S2('Виконавець (Управління ідентифікації)', 'executor_id', identUsers(), ap.executor_id, 0, 'зі списку користувачів управління') +
        S2('Типовий бізнес-процес', 'process', IDPROC(), ap.process || 'identification', 0, 'Ідентифікація за зверненням прокурора; план дій створюється автоматично, куратор — виконавець, огляд — МТУ активів', '', '', null) + F('Примітка', 'note', ap.note, 'textarea', 0, '', 'wide'));
    if (edit) h += '<div class="form-actions"><a class="btn plain" href="' + (ap.id ? '#/ident/appeal/' + ap.id : '#/ident/appeals') + '">Скасувати</a><button class="btn gold">Зберегти звернення</button></div>';
    return h + '</form>';
  }
  function rulingForm(ru, apId) {
    var F = A.field;
    return '<form class="ruling-form" data-act="ident-ruling-save" data-id="' + (ru.id || '') + '" data-appeal="' + apId + '"><div class="form-grid">' +
      F('Суд', 'court', ru.court, 'text', 1, 'оберіть зі списку або введіть повну назву', 'wide', 'list="ident-courts"') + F('Дата ухвали', 'ruling_date', ru.ruling_date, 'date', 1) + F('№ справи', 'case_no', ru.case_no, 'text', 0, 'наприклад, 757/12345/26-к') +
      F('№ провадження в суді', 'court_proc_no', ru.court_proc_no, 'text', 0, '1-кс/…') + A.fsel('Обмеження щодо активу (кол. I)', 'restriction', OPT(D.IDENT_RESTRICTIONS), ru.restriction, 1) + F('Примітка', 'note', ru.note, 'text', 0, '', 'wide') +
      '</div><datalist id="ident-courts">' + (D.IDENT_COURTS || []).concat(A.T('ident_rulings').map(function (x) { return x.court; })).filter(function (v, i, arr) { return v && arr.indexOf(v) === i; }).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
      '<div class="form-actions"><button class="btn gold sm">' + (ru.id ? 'Зберегти ухвалу' : 'Додати ухвалу') + '</button></div></form>';
  }
  A.on(/^\/ident\/appeal\/new$/, function () { if (!canE()) return A.deny(); A.render(A.shell('Нове звернення', 'Реєстрація звернення прокурора · далі — ухвали та активи', '', tabs('') + appealForm({}, true))); });
  A.on(/^\/ident\/appeal\/(\d+)$/, function (id, f) {
    if (!canView()) return A.deny();
    var ap = A.get('ident_appeals', +id); if (!ap) return A.notFound();
    var rs = recsOfAppeal(ap.id), rus = rulingsOf(ap.id), t = A.today(), edit = canE() && f.edit, u = {};
    rs.forEach(function (r) { u[unitKey(r)] = r; });
    var open = rs.some(function (r) { return !r.conclusion_date; }) || !rs.length, over = open && ap.due_date && ap.due_date < t;
    var minSt = rs.reduce(function (m, r) { return ORD[r.stage] < m ? ORD[r.stage] : m; }, 99);
    var h = tabs('') + '<div class="grid g5">' + A.kpi('Ухвал', A.num(rus.length), 'у зверненні') + A.kpi('Активів', A.num(Object.keys(u).length), 'записів ' + rs.length) +
      A.kpi('Етап', minSt < 99 ? esc(STAGES[minSt - 1][1].slice(0, 2)) : '01', minSt < 99 ? STAGES[minSt - 1][1].slice(3) : 'активи ще не внесено') +
      A.kpi('Строк висновку', A.dt(ap.due_date), over ? 'минув' : open ? 'висновок не підписано' : 'висновок підписано', null, over ? 'overdue' : '') +
      A.kpi('Виконавець', esc((ap.executor || '—').split(' ')[0]), ap.executor || 'не визначено') + '</div>';
    h += '<div class="card-grid" style="margin-top:14px"><div>';
    if (edit) h += appealForm(ap, true);
    else h += '<div class="panel"><h3>Звернення <span>' + (canE() ? '<a href="' + A.link('/ident/appeal/' + ap.id, {edit: 1}) + '">редагувати</a>' : '') + '</span></h3><dl class="kv">' +
      dd('Реєстрація в АРМА', A.dt(ap.reg_date) + ' № ' + esc(ap.reg_no || '—'), true) + dd('Орган', esc(bodyName(ap)) + (ap.out_date || ap.out_no ? ' · від ' + A.dt(ap.out_date) + ' № ' + esc(ap.out_no || '—') : ''), true) +
      dd('Кримінальне провадження', '<span class="mono">' + esc(ap.proceeding_no || '—') + '</span>' + (ap.proceeding_date ? ' від ' + A.dt(ap.proceeding_date) : '') + (ap.articles ? ' · ' + esc(ap.articles) : ''), true) +
      dd('Процес', N.PROC[ap.process] || '—') + dd('Примітка', ap.note) + '</dl></div>';
    h += '<h2>Ухвали суду та активи <span class="mini">№ з/п ухвал і лічильники рахуються автоматично</span></h2>';
    rus.forEach(function (ru) {
      var rr = recsOfRuling(ru.id).slice().sort(function (a, b) { return (a.row_no || 1e9) - (b.row_no || 1e9) || a.id - b.id; });
      h += '<div class="panel ruling"><h3>' + esc(ruLabel(ru)) + ' <span>' + esc(N.IRESTR[ru.restriction] || ru.restriction_text || '') + '</span></h3>' +
        (canE() ? '<details><summary class="mini">Редагувати ухвалу</summary>' + rulingForm(ru, ap.id) + (rr.length ? '' : '<button class="btn sm danger" data-click="ident-ruling-del" data-id="' + ru.id + '" data-confirm="Видалити ухвалу?">Видалити ухвалу</button>') + '</details>' : '') +
        '<div class="wrap-tbl"><table><thead><tr><th>Запис</th><th>Актив</th><th>Вид / складність</th><th>МТУ</th><th>Етап</th><th>Реєстр</th></tr></thead><tbody>' + rr.map(recRow).join('') +
        (rr.length ? '' : '<tr><td colspan="6"><div class="empty mini">Активів ще не внесено</div></td></tr>') + '</tbody></table></div>' +
        (canE() ? '<p><a class="btn sm gold" href="' + A.link('/ident/new', {ruling: ru.id}) + '">+ Актив за цією ухвалою</a></p>' : '') + '</div>';
    });
    if (canE()) h += '<details class="panel"' + (rus.length ? '' : ' open') + '><summary><b>+ Ухвала суду</b> <span class="mini">до цього звернення</span></summary>' + rulingForm({}, ap.id) + '</details>';
    var plans = A.plansOf('ident_appeal', ap.id);
    h += '<h2>План дій <span class="mini">типовий процес · куратор — ' + esc(ap.executor || 'виконавець не визначений') + ' · огляд — ' + esc(planOpt(ap).mtuNames) + '</span></h2>' +
      (plans.length ? A.planBlock('ident_appeal', ap.id, canE() || A.can('crm_edit') || A.can('crm_confirm'), 'ident', {processes: IDPROC().map(function (x) { return x[0]; }), process: 'identification', hideDept: true}).replace(/<form class="panel filters plan-new"[\s\S]*?<\/form>/, '') :
        (canE() && A.can('crm_edit') ? '<form class="panel filters" data-act="ident-plan" data-id="' + ap.id + '">' + A.sel('process', IDPROC(), ap.process || 'identification', null) + '<button class="btn gold">Створити план ідентифікації</button></form>' : '<div class="panel"><div class="empty">План не створено.</div></div>'));
    h += '</div><aside class="side">' + A.docsBlock('ident_appeal', ap.id, canE(), ['court_scan', 'ident_conclusion', 'other'], 'Звернення, ухвали, листування з прокуратурою') + '</aside></div>';
    var act = (canE() && !rs.length && !rus.length ? '<button class="btn danger" data-click="ident-appeal-del" data-id="' + ap.id + '" data-confirm="Видалити звернення?">Видалити</button>' : '') + (A.can('export') ? '<a class="btn" href="#" data-click="ident-xlsx" data-q="' + esc(JSON.stringify({appeal_id: ap.id})) + '">XLSX «БАЗОВА»</a>' : '') + '<a class="btn plain" href="#/ident/appeals">До переліку</a>';
    A.render(A.shell(apLabel(ap), bodyName(ap), act, h), A.keep);
  });
  function recRow(r) {
    var g = r.group_id && A.get('ident_groups', r.group_id);
    return '<tr><td class="nowrap"><a class="id" href="#/ident/' + r.id + '">' + (r.row_no ? 'р. ' + r.row_no : '#' + r.id) + '</a>' + (g ? '<span class="sub"><a href="#/ident/group/' + g.id + '">' + esc(g.code) + '</a></span>' : '') + '</td>' +
      '<td style="max-width:420px"><span class="clip" title="' + esc(r.asset_desc) + '">' + esc(r.asset_desc || '—') + '</span><span class="sub">' + esc([r.owner_name || (r.owner || '').slice(0, 60), r.owner_code].filter(Boolean).join(', ')) + '</span></td>' +
      '<td class="mini">' + esc(N.IKIND[r.category] || r.kind || '') + '<br>' + (cplx(r) === 'complex' ? 'Складний' : 'Простий') + '</td><td class="mini">' + esc(N.MTU[r.mtu_code] || '—') + '</td><td>' + A.identStage(r.stage, r.possible) + '</td>' +
      '<td class="mini">' + (r.asset_id ? '<a href="#/asset/' + r.asset_id + '">' + esc(r.asset_no) + '</a><br><span class="mini">' + esc(r.match_level || '') + '</span>' : '<span class="tag t-lim">не в Реєстрі</span>') + '</td></tr>';
  }
  function nextSeq(t) { var m = 0; A.T(t).forEach(function (x) { if ((x.seq || 0) > m) m = x.seq; }); return m + 1; }
  A.ACT['ident-appeal-save'] = function (form, d) {
    var isNew = !form.dataset.id, ap = isNew ? {} : A.get('ident_appeals', +form.dataset.id), tx = A.tx(), u = d.executor_id && A.get('users', +d.executor_id);
    if (d.proceeding_no && !/^\d{17}$/.test(d.proceeding_no.trim())) throw new Error('№ кримінального провадження — 17 цифр');
    var rec = {id: isNew ? A.tmpId() : ap.id, seq: d.seq ? +d.seq : (ap.seq || nextSeq('ident_appeals')), reg_date: d.reg_date || null, reg_no: (d.reg_no || '').trim() || null, body: d.body || null, body_text: d.body === 'other' ? (d.body_text || '').trim() || null : (d.body_text || null),
      out_date: d.out_date || null, out_no: (d.out_no || '').trim() || null, proceeding_no: (d.proceeding_no || '').trim() || null, proceeding_date: d.proceeding_date || null, articles: (d.articles || '').trim() || null,
      executor_id: u ? u.id : null, executor: u ? u.full_name : null, process: d.process || 'identification', due_date: d.due_date || addDays(d.reg_date, TERMS.conclusion_days), note: (d.note || '').trim() || null, updated_by: S.user && S.user.login, updated_at: A.nowS()};
    if (isNew) rec.created_by = S.user && S.user.login;
    if (A.T('ident_appeals').some(function (x) { return x.id !== rec.id && x.reg_no && x.reg_no === rec.reg_no && x.reg_date === rec.reg_date; })) throw new Error('Звернення з таким № і датою вже зареєстровано');
    tx.put('ident_appeals', rec);
    if (!isNew) recsOfAppeal(ap.id).forEach(function (r) { var st = A.identStageOf(r, rec); if (r.appeal_no !== String(rec.seq) || r.appeal_date !== rec.reg_date || r.stage !== st) tx.put('ident_records', {id: r.id, appeal_no: String(rec.seq), appeal_date: rec.reg_date, proceeding_no: rec.proceeding_no, stage: st}); });
    if (isNew && rec.process && A.can('crm_edit')) A.createPlan(tx, 'ident_appeal', rec.id, rec.process, 'ident', u || null, planOpt(rec));
    tx.log(isNew ? 'Зареєстровано звернення (ідентифікація)' : 'Змінено звернення (ідентифікація)', 'ident_appeal', isNew ? null : ap.id);
    return tx.commit().then(function (res) { form.classList.remove('dirty'); A.toast('Звернення збережено'); A.go('#/ident/appeal/' + (isNew ? res.id('ident_appeals', rec.id) : ap.id)); });
  };
  A.ACT['ident-ruling-save'] = function (form, d) {
    var isNew = !form.dataset.id, ru = isNew ? {} : A.get('ident_rulings', +form.dataset.id), tx = A.tx();
    var rec = {id: isNew ? A.tmpId() : ru.id, appeal_id: +form.dataset.appeal, seq: ru.seq || nextSeq('ident_rulings'), court: (d.court || '').trim() || null, ruling_date: d.ruling_date || null, case_no: (d.case_no || '').trim() || null,
      court_proc_no: (d.court_proc_no || '').trim() || null, restriction: d.restriction || null, note: (d.note || '').trim() || null, updated_by: S.user && S.user.login, updated_at: A.nowS()};
    tx.put('ident_rulings', rec);
    if (!isNew) recsOfRuling(ru.id).forEach(function (r) { tx.put('ident_records', {id: r.id, ruling_no: String(rec.seq), case_no: rec.case_no}); });
    tx.log(isNew ? 'Додано ухвалу (ідентифікація)' : 'Змінено ухвалу (ідентифікація)', 'ident_appeal', rec.appeal_id);
    return tx.commit().then(function () { A.toast('Ухвалу збережено'); A.route(true); });
  };
  A.ACT['ident-plan'] = function (f, d) { var ap = A.get('ident_appeals', +f.dataset.id), tx = A.tx(), u = ap.executor_id && A.get('users', ap.executor_id);
    A.createPlan(tx, 'ident_appeal', ap.id, d.process, 'ident', u || null, planOpt(ap)); tx.put('ident_appeals', {id: ap.id, process: d.process});
    return tx.commit().then(function () { return identSyncPlan(ap.id); }).then(function () { A.toast('План дій створено'); A.route(true); }); };
  A.CLICK['ident-ruling-del'] = function (t) { var tx = A.tx(); tx.del('ident_rulings', +t.dataset.id); return tx.commit().then(function () { A.route(true); }); };
  A.CLICK['ident-appeal-del'] = function (t) { var tx = A.tx(); rulingsOf(+t.dataset.id).forEach(function (r) { tx.del('ident_rulings', r.id); }); tx.del('ident_appeals', +t.dataset.id); tx.log('Видалено звернення', 'ident_appeal', +t.dataset.id); return tx.commit().then(function () { A.go('#/ident/appeals'); }); };

  // кроки типового плану (01–09) відмічаються автоматично за етапом усіх активів звернення
  function identSyncPlan(apId) {
    if (!A.can('crm_edit')) return Promise.resolve();
    var plan = A.plansOf('ident_appeal', apId).filter(function (p) { return p.status === 'active' && /^identification/.test(p.process); })[0];
    var rs = recsOfAppeal(apId); if (!plan || !rs.length) return Promise.resolve();
    var minSt = rs.reduce(function (m, r) { return Math.min(m, ORD[r.stage] || 1); }, 99), steps = A.indexes.stepsByPlan[plan.id] || [], tx = A.tx(), t = A.today(), now = A.nowS(), nextSet = false, po = planOpt(A.get('ident_appeals', apId) || {id: apId});
    steps.forEach(function (s) { if (s.responsible === 'МТУ' && po.mtu && s.assignee_mtu !== po.mtu) tx.put('plan_steps', {id: s.id, assignee_mtu: po.mtu, assignee: po.mtuNames}); });
    steps.forEach(function (s) {
      var n = parseInt(String(s.name).slice(0, 2), 10) || s.ord;
      // кроки з погодженням не закриваються автоматично — подаються на погодження відповідній ролі
      if (n <= minSt && s.needs_confirm && (s.status === 'active' || s.status === 'pending')) tx.put('plan_steps', {id: s.id, status: 'review', done_at: now, done_by: (S.user && S.user.login) || 'auto', requested_at: now, approver: s.approver || A.approversFor(s.responsible).join(','),
        history: JSON.stringify((A.json(s.history, []) || []).concat([{at: now, by: S.user && S.user.login, name: S.user && S.user.full_name, a: 'подано на погодження (за етапом активів)', c: null}]))});
      else if (n <= minSt && !s.needs_confirm && s.status !== 'done' && s.status !== 'skipped') tx.put('plan_steps', {id: s.id, status: 'done', done_at: now, done_by: 'авто: етап активів'});
      else if (n > minSt && !nextSet) { nextSet = true; if (s.status === 'pending') tx.put('plan_steps', {id: s.id, status: 'active', started_at: t, due_date: A.addWorkdays(t, s.norm_days || 1)}); }
    });
    if (minSt >= 9 || (rs.every(function (r) { return r.possible === 'no' && ORD[r.stage] >= 7; }))) tx.put('plans', {id: plan.id, status: 'done', finished_at: t});
    return tx.size() ? tx.commit().catch(function () {}) : Promise.resolve();
  }
  A.identSyncPlan = identSyncPlan;

  // ================================================================ записи (активи): перелік
  var SEL = {get: function () { try { return JSON.parse(sessionStorage.getItem('ident-sel') || '[]'); } catch (e) { return []; } }, set: function (a) { try { sessionStorage.setItem('ident-sel', JSON.stringify(a)); } catch (e) {} }};
  A.identFilter = function (f) {
    var w = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean), basis = f.basis || 'reg';
    return visible().filter(function (r) {
      if (!inPer(bdate(r, basis), f)) return false;
      if (w.length) { var ap = appealOf(r) || {}, s = r._s || (r._s = [r.appeal_no, ap.reg_no, r.asset_desc, r.owner, r.owner_name, r.owner_code, r.location, r.region, r.settl_name, r.street_name, r.case_no, r.proceeding_no, r.asset_no, r.cadastral, r.reg_number, N.IKIND[r.category], r.result].join(' ').toLowerCase()); if (!w.every(function (x) { return s.indexOf(x) >= 0; })) return false; }
      if (f.stage && r.stage !== f.stage) return false; if (f.stage_min && (ORD[r.stage] || 0) < ORD[f.stage_min]) return false;
      if (f.possible && r.possible !== f.possible) return false; if (f.result && (r.result_code || '') !== (f.result === '__none__' ? '' : f.result)) return false;
      if (f.mtu && (f.mtu === '__none__' ? r.mtu_code : r.mtu_code !== f.mtu)) return false; if (f.kind && (r.category || '') !== (f.kind === '__none__' ? '' : f.kind)) return false;
      if (f.match && (r.match_level || 'Не знайдено') !== f.match) return false; if (f.linked === 'yes' && !r.asset_id) return false; if (f.linked === 'no' && r.asset_id) return false;
      if (f.appeal_id && r.appeal_id !== +f.appeal_id) return false; if (f.appeal && r.appeal_no !== f.appeal) return false; if (f.ruling && r.ruling_id !== +f.ruling) return false; if (f.sub && subtype(r) !== f.sub) return false;
      if (f.region && r.region !== f.region) return false; if (f.group && String(r.group_id) !== f.group) return false; if (f.cx && cplx(r) !== f.cx) return false; if (f.sel && SEL.get().indexOf(r.id) < 0) return false;
      return true;
    }).sort(function (a, b) { var x = appealOf(a) || {}, y = appealOf(b) || {}; return (y.reg_date || '').localeCompare(x.reg_date || '') || (x.seq || 0) - (y.seq || 0) || (a.row_no || 1e9) - (b.row_no || 1e9) || a.id - b.id; });
  };
  A.on(/^\/ident\/list$/, function (f) {
    if (!canView()) return A.deny();
    f.basis = f.basis || 'reg';
    var list = A.identFilter(f), pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page; var sel = SEL.get();
    var keep = {}; ['q', 'stage', 'stage_min', 'possible', 'result', 'mtu', 'kind', 'linked', 'cx', 'region', 'appeal_id', 'ruling', 'sub', 'match', 'group', 'sel'].forEach(function (k) { if (f[k]) keep[k] = f[k]; });
    var h = tabs('/ident/list') + periodBar('/ident/list', f, keep) +
      '<form class="filters" data-act="filter" data-base="/ident/list"><input name="q" value="' + esc(f.q || '') + '" placeholder="Опис, власник, ЄДРПОУ/РНОКПП, адреса, кадастровий №, справа, № у Реєстрі" style="flex:1;min-width:260px">' +
      A.sel('stage', STAGES, f.stage, 'Усі етапи') + A.sel('possible', [['yes', 'Можливе'], ['no', 'Неможливе']], f.possible, 'Можливість управління') + A.sel('kind', OPT(D.IDENT_KINDS), f.kind, 'Усі види') + A.sel('cx', [['complex', 'Складні'], ['simple', 'Прості']], f.cx, 'Складність') +
      A.sel('mtu', A.OPT.MTU.concat([['__none__', 'Без МТУ']]), f.mtu, 'Усі МТУ') + A.sel('region', D.REGIONS, f.region, 'Усі області') + A.sel('linked', [['yes', 'Є в Реєстрі'], ['no', 'Ще не в Реєстрі']], f.linked, 'Зіставлення') +
      ['y', 'm', 'basis', 'from', 'to', 'appeal_id', 'ruling', 'sub', 'match', 'group', 'sel', 'stage_min', 'result'].map(function (k) { return f[k] ? '<input type="hidden" name="' + k + '" value="' + esc(f[k]) + '">' : ''; }).join('') +
      '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/ident/list">Скинути все</button></form>' +
      (sel.length ? '<div class="sel-basket">Обрано записів: <b>' + sel.length + '</b> · <a href="' + A.link('/ident/list', {sel: 1}) + '">показати обрані</a> · <a href="#" data-click="ident-sel-clear">очистити</a></div>' : '') +
      A.pager(list.length, pg.page, '/ident/list', q) + '<div class="wrap-tbl"><table><thead><tr><th style="width:26px"></th><th>Звернення / ухвала</th><th>Запис</th><th>Актив</th><th>Вид / складність</th><th>МТУ</th><th>Етап</th><th>Реєстр</th></tr></thead><tbody>' +
      pg.rows.map(function (r) { var ap = appealOf(r), ru = rulingOf(r);
        return '<tr><td><input type="checkbox" data-isel value="' + r.id + '"' + (sel.indexOf(r.id) >= 0 ? ' checked' : '') + ' style="width:auto"></td><td class="nowrap mini">' + (ap ? '<a href="#/ident/appeal/' + ap.id + '">зв. ' + esc(ap.seq || ap.id) + '</a> · ' + A.dt(ap.reg_date) : 'зв. ' + esc(r.appeal_no || '—')) + '<span class="sub">ухв. ' + esc(ru ? ru.seq || ru.id : r.ruling_no || '—') + (ru && ru.ruling_date ? ' · ' + A.dt(ru.ruling_date) : '') + '</span></td>' + recRow(r).replace(/^<tr>/, '').replace(/<\/tr>$/, '') + '</tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="8"><div class="empty">Записів не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/ident/list', q) +
      (canE() ? '<form class="sel-bar" data-act="ident-bulk"><span class="mini">Обрано: <b>' + sel.length + '</b></span><select name="action"><option value="">— дія з обраними —</option><option value="group">Об’єднати в складний актив (групу записів)</option><option value="ungroup">Вилучити з групи</option><option value="mtu">Доручити МТУ (дата доручення — сьогодні)</option></select>' +
        A.sel('mtu_v', A.OPT.MTU, null, '— МТУ —') + '<input name="order_no" placeholder="№ доручення" style="width:140px"><button class="btn gold"' + (sel.length ? '' : ' disabled') + '>Застосувати</button></form>' : '');
    var act = (A.can('export') ? '<a class="btn" href="#" data-click="ident-xlsx" data-q="' + esc(JSON.stringify(q)) + '">XLSX «БАЗОВА» (за фільтром)</a>' : '');
    A.render(A.shell('Ідентифікація · активи (записи)', 'Записів за умовами: ' + list.length + ' · ' + perText(f), act, h), A.keep);
  });
  A.afterRender.push(function (root) { root.querySelectorAll('input[data-isel]').forEach(function (b) { b.addEventListener('change', function () { var s = SEL.get(), i = s.indexOf(+b.value); if (b.checked && i < 0) s.push(+b.value); if (!b.checked && i >= 0) s.splice(i, 1); SEL.set(s); var c = root.querySelector('.sel-bar b'); if (c) c.textContent = s.length; var btn = root.querySelector('form[data-act="ident-bulk"] button'); if (btn) btn.disabled = !s.length; }); }); });
  A.CLICK['ident-sel-clear'] = function () { SEL.set([]); A.route(true); };
  A.ACT['ident-bulk'] = function (f, d) {
    var ids = SEL.get(), rs = ids.map(function (i) { return A.get('ident_records', i); }).filter(Boolean), tx = A.tx();
    if (!rs.length || !d.action) return A.toast('Оберіть записи і дію', 'err');
    if (d.action === 'group') {
      var gid = A.tmpId(), first = rs[0], y = new Date().getFullYear();
      tx.put('ident_groups', {id: gid, code: 'ІД-' + (first.appeal_no || 0) + '-' + y + '-' + (A.T('ident_groups').length + 1), name: (first.asset_desc || '').slice(0, 200), appeal_no: first.appeal_no, ruling: ruLabel(rulingOf(first)).slice(0, 500)});
      rs.forEach(function (r) { tx.put('ident_records', {id: r.id, group_id: gid, complexity: 'complex'}); });
      tx.log('Створено групу записів ідентифікації', 'ident_group', null, {records: rs.length});
      return tx.commit().then(function (res) { SEL.set([]); A.toast('Групу створено'); A.go('#/ident/group/' + res.id('ident_groups', gid)); });
    }
    rs.forEach(function (r) {
      if (d.action === 'ungroup') tx.put('ident_records', {id: r.id, group_id: null});
      if (d.action === 'mtu' && d.mtu_v) { var p = {id: r.id, mtu_code: d.mtu_v, mtu_order_date: r.mtu_order_date || A.today(), mtu_order_no: d.order_no || r.mtu_order_no || null}; p.mtu_due = r.mtu_due || addDays(p.mtu_order_date, TERMS.mtu_days); p.stage = A.identStageOf(Object.assign({}, r, p), appealOf(r)); tx.put('ident_records', p); }
    });
    if (!tx.size()) return A.toast('Вкажіть значення', 'err');
    tx.log('Масова дія (ідентифікація): ' + d.action, 'ident', null, {count: rs.length});
    return tx.commit().then(function () { var aps = {}; rs.forEach(function (r) { if (r.appeal_id) aps[r.appeal_id] = 1; }); return Promise.all(Object.keys(aps).map(function (k) { return identSyncPlan(+k); })); }).then(function () { A.toast('Оновлено записів: ' + rs.length); A.route(true); });
  };

  // ================================================================ запис (актив): етапи, форма, Реєстр, фото і документи МТУ
  A.identLifecycle = function (r) {
    var cur = ORD[r.stage] || 1, a = r.asset_id && A.get('assets', r.asset_id), ap = appealOf(r) || {}, d = r.data || {};
    var info = {registered: A.dt(ap.reg_date) + (ap.reg_no ? ' № ' + ap.reg_no : ''), executor: ap.executor, mtu: r.mtu_order_date ? A.dt(r.mtu_order_date) + (r.mtu_order_no ? ' № ' + r.mtu_order_no : '') + (r.mtu_due && !r.inspect_date ? ' · огляд до ' + A.dt(r.mtu_due) : '') : '',
      inspected: r.inspect_date ? A.dt(r.inspect_date) + ' · ' + (N.ITECH[r.tech_state] || '') : '', draft: N.IRES[r.result_code] || '', agreed: r.agreed_date ? A.dt(r.agreed_date) : '',
      conclusion: r.conclusion_date ? A.dt(r.conclusion_date) + (r.sent_date ? ' · до прокуратури ' + A.dt(r.sent_date) : '') : ap.due_date ? 'строк ' + A.dt(ap.due_date) : '', accepted: r.accepted_date ? A.dt(r.accepted_date) : d.c49 || d.c44 || '',
      registry: a ? '<a href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a>' : ''};
    return '<ol class="steps">' + STAGES.map(function (s, i) {
      var n = i + 1, skip = r.possible === 'no' && n > 7, cls = skip ? 'skip' : n <= cur ? 'done' : n === cur + 1 ? 'now' : '';
      return '<li class="' + cls + '"><span class="n">' + (n < 10 ? '0' : '') + n + '</span><div><div class="t">' + esc(s[1].slice(3)) + '</div>' + (info[s[0]] ? '<div class="s">' + (String(info[s[0]]).indexOf('<') >= 0 ? info[s[0]] : esc(info[s[0]])) + '</div>' : '') + '</div><div class="s">' + (skip ? 'не застосовується' : n <= cur ? 'виконано' : n === cur + 1 ? '<b style="color:var(--gold)">наступний</b>' : '') + '</div><div></div><div></div></li>';
    }).join('') + '</ol>' + (r.possible === 'no' ? '<p class="mini">За висновком управління активом неможливе — етапи 08–09 не застосовуються.</p>' : '') +
      '<p class="mini">Після етапу 09 оцінка, зберігання, пошук управителя та реалізація ведуться в картці активу Реєстру за їх бізнес-процесами.</p>';
  };
  function registryPanel(r) {
    var a = r.asset_id && A.get('assets', r.asset_id), h = '<div class="panel"><h3>09 · Реєстр активів</h3>';
    if (a) {
      h += '<dl class="kv">' + dd('№ у Реєстрі', '<a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a> ' + A.zone(a.zone, true), true) + dd('Внесено / зіставлено', (r.registry_date ? A.dt(r.registry_date) + ' · ' : '') + (r.match_level || '') + (r.match_note ? ' · ' + r.match_note : '')) +
        dd('Правовий стан', A.legal(a.legal_status), true) + dd('Відділ ДМА', N.DMA[a.dept_code] || 'не закріплено') + dd('Оцінка', a.val_amount ? A.money(a.val_amount) + ' · ' + A.dt(a.val_date) : 'ведеться в картці активу') + dd('Зберігач', a.custodian_name) + dd('Управитель', a.manager_name) + '</dl>' +
        '<p class="mini">Інвестиційну привабливість і закріплення за відділом ДМА визначає ДМА в картці активу.</p>';
    } else h += '<p class="mini">Актив ще не внесено до Реєстру. Після прийняття в управління (етап 08) заведіть картку активу — поля заповняться з цього запису, а фото й документи МТУ буде перенесено до картки.</p>';
    var acc = A.identAccepted(r), sg = ((r.data || {}).suggest || []).filter(function (x) { return x.asset_id !== r.asset_id; });
    if (!acc) h += '<p class="mini warn-note">Відомостей про передачу в управління АРМА (розділ 9) ще немає — актив не прив’язується до Реєстру автоматично. Прив’язати вручну можна, якщо ви впевнені (напр. актив раніше вже був в управлінні АРМА); етап 09 настане після передачі.</p>';
    if (canE()) {
      if (r.asset_id) h += '<p><button class="btn sm danger" data-click="ident-unlink" data-id="' + r.id + '" data-confirm="Відв’язати запис від активу ' + esc(r.asset_no) + '?">Відв’язати від ' + esc(r.asset_no) + '</button></p>';
      if (!r.asset_id && acc && (A.can('create_assets') || A.can('edit_any_asset'))) h += '<p><a class="btn sm gold" href="' + A.link('/asset/new', {ident: r.id}) + '">Внести новий актив до Реєстру (етап 09) →</a></p>';
      if (sg.length) h += '<h4 style="margin:10px 0 4px">Можливі активи Реєстру <span class="mini">знайдено автоматично — перевірте</span></h4>' + sg.map(function (x) {
        return '<div class="docrow"><span><a class="id" href="#/asset/' + x.asset_id + '" target="_blank">' + esc(x.asset_no) + '</a> <span class="tag t-unk">' + esc(x.level) + '</span><span class="sub">' + esc(N.CAT[x.category] || '') + ' · ' + esc((x.name || '').slice(0, 110)) + '</span><span class="sub">' + esc(x.note || '') + '</span></span>' +
          '<button class="btn sm" data-click="ident-pick" data-id="' + r.id + '" data-aid="' + x.asset_id + '"' + (acc ? '' : ' data-confirm="Передачі в АРМА за цим записом ще немає. Прив’язати до ' + esc(x.asset_no) + '?"') + '>Прив’язати</button></div>'; }).join('');
      h += '<form class="filters" data-act="ident-search" data-id="' + r.id + '" style="margin-top:8px"><input name="q" placeholder="Пошук у Реєстрі: № активу, VIN, держномер, кадастровий №, опис" style="flex:1;min-width:200px"><button class="btn sm">Знайти</button><button type="button" class="btn sm gold" data-click="pick" data-multi="0" data-cb="ident" data-id="' + r.id + '"' + (acc ? '' : ' data-confirm="Передачі в АРМА за цим записом ще немає. Прив’язати до активу Реєстру?"') + '>🔎 Обрати з Реєстру (усі фільтри)</button></form><div class="ident-found" data-for="' + r.id + '"></div>';
    }
    return h + '</div>';
  }
  A.identAccepted = function (r) { var d = r.data || {}; return !!(r.accepted_date || d.c44 || d.c49 || d.c44n || d.c44d || d.c49n || d.c49d); };
  var COMPAT = {immovable: ['realestate', 'land'], land: ['land', 'realestate'], immovable_emk: ['realestate', 'land'], emk: ['realestate', 'land', 'property'], vehicle: ['transport'], vehicle_emk: ['transport'],
    movable: ['property', 'transport'], corp: ['corporate'], securities: ['money', 'corporate'], money: ['money'], crypto: ['crypto'], other: ['property', 'realestate', 'transport', 'land']};
  A.ACT['ident-search'] = function (f, d) {
    var r = A.get('ident_records', +f.dataset.id), cats = COMPAT[r.category] || null, w = (d.q || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), box = document.querySelector('.ident-found[data-for="' + r.id + '"]');
    if (!w.length) return;
    var found = A.T('assets').filter(function (a) { if (cats && cats.indexOf(a.category) < 0) return false; var t = a._ss || (a._ss = [a.asset_no, a.name, a.cadastral, (a.details || {}).vin, (a.details || {}).plate].join(' ').toLowerCase()); return w.every(function (x) { return t.indexOf(x) >= 0; }); }).slice(0, 15);
    box.innerHTML = (found.length ? found.map(function (a) { return '<div class="docrow"><span><a class="id" href="#/asset/' + a.id + '" target="_blank">' + esc(a.asset_no) + '</a> ' + A.zone(a.zone, true) + '<span class="sub">' + esc(N.CAT[a.category] || '') + ' · ' + esc((a.name || '').slice(0, 120)) + '</span></span><button class="btn sm" data-click="ident-pick" data-id="' + r.id + '" data-aid="' + a.id + '"' + (A.identAccepted(r) ? '' : ' data-confirm="Передачі в АРМА за цим записом ще немає. Прив’язати до ' + esc(a.asset_no) + '?"') + '>Прив’язати</button></div>'; }).join('') :
      '<div class="empty mini">Нічого не знайдено' + (cats ? ' серед категорій: ' + cats.map(function (c) { return N.CAT[c]; }).join(', ') : '') + '</div>');
    return Promise.resolve();
  };
  A.PICK_CB = A.PICK_CB || {};
  A.PICK_CB.ident = function (t, r) { var a = r.assets[0]; if (!a) return; return A.CLICK['ident-pick']({dataset: {id: t.dataset.id, aid: a.id}}); };
  A.CLICK['ident-pick'] = function (t) {
    var r = A.get('ident_records', +t.dataset.id), a = A.get('assets', +t.dataset.aid), tx = A.tx(); if (!r || !a) return;
    var n = A.identLinkTx(tx, r, a);
    return tx.commit().then(function () { return identSyncPlan(r.appeal_id); }).then(function () { A.toast('Прив’язано до ' + a.asset_no + (n ? '; перенесено файлів: ' + n : '')); A.route(true); });
  };
  A.CLICK['ident-unlink'] = function (t) {
    var r = A.get('ident_records', +t.dataset.id), tx = A.tx(), p = {id: r.id, asset_id: null, asset_no: null, match_level: 'Не знайдено', match_note: 'відв’язано вручну ' + (S.user ? S.user.login : '') + ' ' + A.today(), registry_date: null};
    p.stage = A.identStageOf(Object.assign({}, r, p), appealOf(r)); tx.put('ident_records', p); tx.log('Відв’язано запис ідентифікації від активу ' + r.asset_no, 'ident', r.id);
    return tx.commit().then(function () { A.toast('Відв’язано'); A.route(true); });
  };
  // поля нової картки активу з запису ідентифікації (етап 09)
  A.identPrefill = function (r) {
    var o = {name: (r.asset_desc || '').slice(0, 1000), category: KIND_CAT[r.category] || 'realestate', complexity: cplx(r), mtu_code: r.mtu_code, owner_name: r.owner_name, owner_code: r.owner_code, cadastral: r.cadastral, inspect_date: r.inspect_date, source: 'ident'};
    ['region', 'district', 'hromada', 'settl_type', 'settl_name', 'street_type', 'street_name', 'building', 'unit'].forEach(function (k) { if (r[k]) o[k] = r[k]; });
    if (!o.settl_name && (r.data || {}).addr_raw) o.address_raw = r.data.addr_raw;
    return o;
  };
  // прив’язка до активу Реєстру + перенесення фото і документів (запису, його групи та звернення) до картки активу
  A.identLinkTx = function (tx, r, asset) {
    var have = {}; A.filesOf('asset', asset.id).forEach(function (l) { have[l.file_id] = 1; });
    var src = A.filesOf('ident', r.id).concat(r.group_id ? A.filesOf('ident_group', r.group_id) : []).concat(r.appeal_id ? A.filesOf('ident_appeal', r.appeal_id) : []), ph = 0, dc = 0;
    src.forEach(function (l) { if (have[l.file_id]) return; have[l.file_id] = 1; tx.put('file_links', {id: A.tmpId(), file_id: l.file_id, target_type: 'asset', target_id: asset.id, doc_type: l.doc_type, title: l.title, shared_from: 'Ідентифікація ' + (r.row_no ? 'р. ' + r.row_no : '#' + r.id)}); if (l.doc_type === 'photo') ph++; else dc++; });
    if (asset.id < 0) { asset.photo_count = (asset.photo_count || 0) + ph; asset.doc_count = (asset.doc_count || 0) + dc; }
    else if (ph || dc) tx.put('assets', {id: asset.id, photo_count: (asset.photo_count || 0) + ph, doc_count: (asset.doc_count || 0) + dc}, asset.updated_at);
    var p = {id: r.id, asset_id: asset.id, asset_no: asset.asset_no, match_level: 'Вручну', match_note: 'внесено ' + (S.user ? S.user.login : '') + ' ' + A.today(), registry_date: A.today()};
    p.stage = A.identStageOf(Object.assign({}, r, p), appealOf(r)); tx.put('ident_records', p);
    tx.log('Ідентифікація: актив внесено до Реєстру (етап 09)', 'ident', r.id, {asset_no: asset.asset_no, files: ph + dc});
    return ph + dc;
  };
  var F = function (lab, name, v, type, req, hint, cls, attrs) { return A.field(lab, name, v, type, req, hint, cls, attrs); };
  function noDate(lab, k, d) { return '<div class="field wide"><label>' + esc(lab) + '</label><div class="nd"><input name="d_' + k + 'n" value="' + esc(d[k + 'n'] || '') + '" placeholder="№"><input type="date" name="d_' + k + 'd" value="' + esc(d[k + 'd'] || '') + '"></div>' + (d[k] && !d[k + 'n'] && !d[k + 'd'] ? '<div class="mini">у файлі: ' + esc(d[k]) + '</div>' : '') + '</div>'; }
  function recForm(r, mode) {
    // mode: 'edit' — Управління ідентифікації; 'mtu' — МТУ (лише огляд і користувач); 'view'
    var d = r.data || {}, ed = mode === 'edit', em = ed || mode === 'mtu', ap = appealOf(r), ru = rulingOf(r);
    var fs = function (t, cols, on, body, note) { return '<details class="ident-sec" open><summary>' + t + ' <span class="mini">' + cols + '</span></summary><fieldset' + (on ? '' : ' disabled') + ' style="border:0;margin:0;padding:0;background:none"><div class="form-grid">' + body + '</div>' + (note ? '<p class="mini">' + note + '</p>' : '') + '</fieldset></details>'; };
    var aps = A.T('ident_appeals').slice().sort(function (a, b) { return (b.seq || 0) - (a.seq || 0); }).map(function (a) { return [a.id, apLabel(a)]; });
    var rus = ap ? rulingsOf(ap.id).map(function (x) { return [x.id, ruLabel(x)]; }) : [];
    var h = '<form data-act="ident-save" data-id="' + (r.id || '') + '" data-mode="' + mode + '">';
    h += fs('1. Звернення та ухвала', 'A–I', ed, A.fsel('Звернення', 'appeal_id', aps, r.appeal_id, 1, '', 'wide') + A.fsel('Ухвала суду', 'ruling_id', rus, r.ruling_id, 1, ap ? '' : 'оберіть звернення і збережіть — список ухвал оновиться', 'wide'),
      'Номери з/п звернень, ухвал, записів і активів (кол. A, B, E, F, K, L) рахуються автоматично.');
    h += fs('2. Відомості про актив', 'J–Q', ed, F('Опис активу', 'asset_desc', r.asset_desc, 'textarea', 1, '', 'wide') + A.fsel('Вид активу', 'category', OPT(D.IDENT_KINDS), r.category, 1) +
      A.fsel('Складність', 'complexity', [['simple', 'Простий'], ['complex', 'Складний']], cplx(r), 1, 'складний — майновий комплекс, корпоративні права, група об’єктів', '', '', null) +
      F('Кадастровий номер', 'cadastral', r.cadastral, 'text', 0, '0000000000:00:000:0000', '', 'pattern="\\d{10}:\\d{2}:\\d{3}:\\d{4}"') + F('Реєстраційний № об’єкта / VIN / держномер', 'reg_number', r.reg_number));
    h += fs('3. Власник', 'R', ed, F('Найменування юридичної особи / ПІБ', 'owner_name', r.owner_name || (!r.owner_code && r.owner ? r.owner : ''), 'text', 0, '', 'wide') +
      F('Код ЄДРПОУ / РНОКПП / реєстр. № нерезидента', 'owner_code', r.owner_code, 'text', 0, '8 цифр — ЄДРПОУ, 10 — РНОКПП', '', 'pattern="\\d{8}|\\d{10}|[A-ZА-ЯІЇЄ0-9][A-ZА-ЯІЇЄ0-9 \\-]{3,19}"') + (r.owner && (r.owner_name || r.owner_code) && r.owner.length > (r.owner_name || '').length + 20 ? '<div class="mini wide">у файлі: ' + esc(r.owner) + '</div>' : ''));
    h += fs('4. Місцезнаходження та МТУ', 'S–T', ed, A.fsel('Область', 'region', D.REGIONS, r.region) + F('Район', 'district', r.district) + F('Громада', 'hromada', r.hromada) + A.fsel('Тип населеного пункту', 'settl_type', D.SETTLEMENT_TYPES, r.settl_type) + F('Населений пункт', 'settl_name', r.settl_name) +
      A.fsel('Тип вулиці', 'street_type', D.STREET_TYPES, r.street_type) + F('Вулиця', 'street_name', r.street_name) + F('Будинок', 'building', r.building) + F('Квартира / приміщення', 'unit', r.unit) +
      A.fsel('МТУ (юрисдикція)', 'mtu_code', A.OPT.MTU, r.mtu_code, 0, 'порожньо — за областю') + (d.addr_raw ? '<div class="mini wide">адреса у файлі: ' + esc(d.addr_raw) + '</div>' : ''));
    h += fs('5. Користувач / орендар', 'U–AA · заповнює МТУ', em, A.fsel('Статус користувача', 'd_c20', OPT(D.IDENT_USER_STATUS), d.c20 && N.IUSER[d.c20] ? d.c20 : '') + F('Найменування / ПІБ користувача', 'd_c21', d.c21) + F('ЄДРПОУ / РНОКПП користувача', 'd_c21code', d.c21code) +
      F('Місцезнаходження / місце проживання', 'd_c22', d.c22, 'text', 0, '', 'wide') + A.fsel('Підстава користування', 'd_c23', BASIS, A.map(BASIS)[d.c23] ? d.c23 : '') + F('Реквізити документа', 'd_c24', d.c24) +
      F('Початок користування', 'd_c25from', d.c25from, 'date') + F('Закінчення користування', 'd_c25to', d.c25to, 'date') + F('Контактні дані', 'd_c26', d.c26) +
      (d.c20 && !N.IUSER[d.c20] ? '<div class="mini wide">у файлі: ' + esc([d.c20, d.c23, d.c25].filter(Boolean).join(' · ')) + '</div>' : ''));
    h += fs('6. Доручення МТУ і контроль виконання', 'AB–AD', ed, F('Дата доручення МТУ', 'mtu_order_date', r.mtu_order_date, 'date') + F('№ доручення', 'mtu_order_no', r.mtu_order_no) + F('Строк огляду', 'mtu_due', r.mtu_due, 'date', 0, 'порожньо — дата доручення + ' + TERMS.mtu_days + ' дн.') +
      F('Продовження доручення до', 'd_c28d', d.c28d || isoDate(d.c28), 'date') + F('Листування з державними органами', 'd_c29', d.c29, 'textarea', 0, '', 'wide'));
    h += fs('7. Огляд і фактичний стан', 'AE–AH · заповнює МТУ', em, F('Дата огляду', 'inspect_date', r.inspect_date, 'date') + A.fsel('Використання активу', 'usage_state', OPT(D.IDENT_USAGE), r.usage_state) + A.fsel('Фізичний стан', 'tech_state', OPT(D.IDENT_TECH), r.tech_state) +
      F('Заходи реагування', 'd_c33', d.c33, 'textarea', 0, '', 'wide') + F('Звіт МТУ (стисло)', 'd_mtu_report', d.mtu_report, 'textarea', 0, 'фото й акт огляду — у блоках праворуч', 'wide') +
      (d.c30 || d.c31 ? '<div class="mini wide">у файлі: ' + esc([d.c30, d.c31].filter(Boolean).join(' · ')) + '</div>' : ''));
    h += fs('8. Висновок і результат', 'AI–AR', ed, F('Проєкт висновку підготовлено', 'draft_date', r.draft_date, 'date') + F('Погоджено УВКБ', 'agreed_date', r.agreed_date, 'date') + A.fsel('Причини, що унеможливлюють управління', 'reason_code', OPT(D.IDENT_REASONS), r.reason_code, 0, '', 'wide') +
      A.fsel('Результат ідентифікації', 'result_code', OPT(D.IDENT_RESULTS), r.result_code) + F('Дата підписання висновку', 'conclusion_date', r.conclusion_date, 'date') + F('№ висновку', 'conclusion_no', r.conclusion_no) +
      F('Дата направлення до прокуратури', 'sent_date', r.sent_date, 'date') + F('Вихідний № листа', 'sent_no', r.sent_no) + (d.c34 && !r.reason_code ? '<div class="mini wide">у файлі: ' + esc(d.c34) + '</div>' : ''));
    h += fs('9. Прийняття в управління АРМА', 'AS–AX', ed, noDate('Звернення прокурора / ухвала суду про взяття в управління', 'c44', d) + noDate('Доручення АРМА МТУ про огляд і акт приймання-передачі', 'c45', d) + noDate('Супровідний лист з актом до прокуратури', 'c46', d) +
      noDate('Лист щодо повернення акту з прокуратури', 'c47', d) + noDate('Лист прокуратури щодо підписання акту', 'c48', d) + noDate('Акт приймання-передачі від прокурора до АРМА', 'c49', d), 'Дата прийняття (етап 08) — за актом приймання-передачі або ухвалою.');
    h += '<p class="mini">Розділи «Проведення оцінки» та «Зберігання і передача в управління» (кол. AY–BP) у вивантаженні заповнюються з картки активу Реєстру — після етапу 09 їх ведуть у картці активу.</p>';
    if (em) h += '<div class="form-actions"><a class="btn plain" href="' + (r.id ? '#/ident/' + r.id : ru ? '#/ident/appeal/' + ru.appeal_id : '#/ident/list') + '">Скасувати</a><button class="btn gold">' + (mode === 'mtu' ? 'Зберегти результати огляду' : 'Зберегти запис') + '</button></div>';
    return h + '</form>';
  }
  A.on(/^\/ident\/new$/, function (f) {
    if (!canE()) return A.deny();
    var ru = f.ruling && A.get('ident_rulings', +f.ruling), ap = ru ? A.get('ident_appeals', ru.appeal_id) : f.appeal && A.get('ident_appeals', +f.appeal);
    var r = {data: {}, appeal_id: ap ? ap.id : null, ruling_id: ru ? ru.id : null, complexity: 'simple'};
    A.render(A.shell('Новий актив у зверненні', ap ? apLabel(ap) + (ru ? ' · ' + ruLabel(ru) : '') : 'Оберіть звернення та ухвалу', '', tabs('') + recForm(r, 'edit')));
  });
  A.on(/^\/ident\/(\d+)$/, function (id) {
    if (!canView()) return A.deny();
    var r = A.get('ident_records', +id); if (!r) return A.notFound(); var g = r.group_id && A.get('ident_groups', r.group_id), ap = appealOf(r), ru = rulingOf(r);
    var mode = canE() ? 'edit' : canMtu(r) ? 'mtu' : 'view', upl = canE() || canMtu(r);
    var act = (A.can('delete_records') || canE() ? '<button class="btn danger" data-click="ident-del" data-id="' + r.id + '" data-confirm="Видалити запис ідентифікації?">Видалити</button>' : '') + (canE() && ru ? '<a class="btn" href="' + A.link('/ident/new', {ruling: ru.id}) + '">+ Ще актив за ухвалою</a>' : '') + '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = tabs('') + '<div class="card-grid"><div>' + (ap ? '<div class="banner"><a href="#/ident/appeal/' + ap.id + '"><b>' + esc(apLabel(ap)) + '</b></a> · ' + esc(bodyName(ap)) + (ru ? '<br>' + esc(ruLabel(ru)) + ' · ' + esc(N.IRESTR[ru.restriction] || '') : '') + '</div>' : '') +
      (g ? '<div class="banner">Запис входить до складного активу <a href="#/ident/group/' + g.id + '"><b>' + esc(g.code) + '</b></a>.</div>' : '') +
      '<div class="panel"><h3>Етап процесу <span>' + A.identStage(r.stage, r.possible) + '</span></h3>' + A.identLifecycle(r) + '</div><h2>Електронна форма запису</h2>' + recForm(r, mode) + '</div><aside class="side">' +
      registryPanel(r) + A.photosBlock('ident', r.id, upl, null) + docsFor(r, upl) + '</aside></div>';
    A.render(A.shell('Ідентифікація · ' + (r.row_no ? 'рядок ' + r.row_no : 'запис ' + r.id), (r.asset_desc || ''), act, h), A.keep);
  });
  function docsFor(r, upl) {
    // A.docsBlock показує форму завантаження лише за правом upload_files — у МТУ воно є
    return A.docsBlock('ident', r.id, upl, ['inspection_act', 'ident_conclusion', 'court_scan', 'other'], 'Акт огляду, звіт МТУ, висновок. Після внесення до Реєстру документи і фото переносяться до картки активу.');
  }
  var STRUCT = ['appeal_id', 'ruling_id', 'asset_desc', 'category', 'complexity', 'cadastral', 'reg_number', 'owner_name', 'owner_code', 'region', 'district', 'hromada', 'settl_type', 'settl_name', 'street_type', 'street_name', 'building', 'unit', 'mtu_code',
    'mtu_order_date', 'mtu_order_no', 'mtu_due', 'inspect_date', 'usage_state', 'tech_state', 'draft_date', 'agreed_date', 'reason_code', 'result_code', 'conclusion_date', 'conclusion_no', 'sent_date', 'sent_no'];
  var MTU_STRUCT = ['inspect_date', 'usage_state', 'tech_state'];
  // колонки файлу, які після редагування в електронній формі будуються зі структурованих полів (старий текст прибирається)
  var SUPERSEDE = {asset_desc: [9], category: [12], complexity: [13], owner_name: [17], owner_code: [17], region: [18], settl_name: [18], street_name: [18], mtu_code: [19], mtu_order_date: [27], usage_state: [30], tech_state: [31], inspect_date: [32],
    reason_code: [34], conclusion_date: [35], result_code: [41], sent_date: [43], d_c20: [20], d_c23: [23], d_c25from: [25], d_c25to: [25], d_c28d: [28]};
  function mtuByRegion(reg) { var m = (D.MTU || []).filter(function (x) { return (x[3] || []).indexOf(reg) >= 0; })[0]; return m ? m[0] : null; }
  A.ACT['ident-save'] = function (form, d) {
    var mode = form.dataset.mode, isNew = !form.dataset.id, r = isNew ? {data: {}} : A.get('ident_records', +form.dataset.id), data = Object.assign({}, r.data || {}), rec = {id: isNew ? A.tmpId() : r.id};
    var fields = mode === 'mtu' ? MTU_STRUCT : STRUCT, changed = {};
    fields.forEach(function (k) { if (!(k in d)) return; var v = typeof d[k] === 'string' ? d[k].trim() : d[k]; if (v === '') v = null; if (k === 'appeal_id' || k === 'ruling_id') v = v ? +v : null; if (isNew || String(r[k] === undefined || r[k] === null ? '' : r[k]) !== String(v === null ? '' : v)) { rec[k] = v; changed[k] = 1; } });
    Object.keys(d).forEach(function (k) { if (k.indexOf('d_') !== 0) return; var key = k.slice(2), v = typeof d[k] === 'string' ? d[k].trim() : d[k];
      if (mode === 'mtu' && ['c20', 'c21', 'c21code', 'c22', 'c23', 'c24', 'c25from', 'c25to', 'c26', 'c33', 'mtu_report'].indexOf(key) < 0) return;
      if ((data[key] || '') !== (v || '')) { changed[k] = 1; if (v) data[key] = v; else delete data[key]; } });
    Object.keys(changed).forEach(function (k) { (SUPERSEDE[k] || []).forEach(function (i) { delete data['c' + i]; }); if (k === 'region' || k === 'street_name' || k === 'settl_name') delete data.addr_raw; });
    if (mode === 'mtu') { data.mtu_by = S.user && S.user.login; data.mtu_at = A.nowS(); }
    rec.data = data;
    var m = Object.assign({}, r, rec);
    if (mode !== 'mtu') {
      if (!m.asset_desc) throw new Error('Заповніть опис активу');
      if (!m.appeal_id || !m.ruling_id) throw new Error('Оберіть звернення та ухвалу суду');
      var ru = A.get('ident_rulings', m.ruling_id); if (!ru || ru.appeal_id !== m.appeal_id) throw new Error('Ухвала не належить обраному зверненню');
      if (m.owner_code && /^\d+$/.test(m.owner_code) && [8, 10].indexOf(m.owner_code.length) < 0) throw new Error('Код ЄДРПОУ — 8 цифр, РНОКПП — 10 цифр');
      if (!m.mtu_code && m.region) rec.mtu_code = m.mtu_code = mtuByRegion(m.region);
      if (m.mtu_order_date && !m.mtu_due) rec.mtu_due = m.mtu_due = addDays(m.mtu_order_date, TERMS.mtu_days);
      if ('result_code' in rec) rec.possible = m.possible = m.result_code ? RES_POS[m.result_code] : null;
      var acc = data.c49d || data.c44d || null; if ((r.accepted_date || null) !== acc) rec.accepted_date = m.accepted_date = acc;
      var ap = A.get('ident_appeals', m.appeal_id); rec.appeal_no = String(ap.seq || ''); rec.appeal_date = ap.reg_date; rec.ruling_no = String(ru.seq || ''); rec.case_no = ru.case_no; rec.proceeding_no = ap.proceeding_no;
      rec.kind = N.IKIND[m.category] || r.kind || null; rec.atype = m.complexity === 'complex' ? 'Складний' : 'Простий';
      rec.owner = [m.owner_name, m.owner_code].filter(Boolean).join(', ') || r.owner || null; var adr = A.fullAddress(m); if (adr) rec.location = adr;
      rec.result = N.IRES[m.result_code] || r.result || null;
    }
    rec.stage = A.identStageOf(Object.assign({}, r, rec), appealOf(m));
    rec.updated_by = S.user && S.user.login; rec.updated_at = A.nowS();
    if (isNew) rec.created_by = S.user && S.user.login;
    var tx = A.tx(); tx.put('ident_records', rec); tx.log(isNew ? 'Додано актив у зверненні (ідентифікація)' : mode === 'mtu' ? 'МТУ: результати огляду' : 'Змінено запис ідентифікації', 'ident', isNew ? null : r.id);
    return tx.commit().then(function (res) { form.classList.remove('dirty'); var nid = isNew ? res.id('ident_records', rec.id) : r.id; return identSyncPlan(m.appeal_id).then(function () { A.toast('Збережено · етап: ' + STG[rec.stage]); A.go('#/ident/' + nid); }); });
  };
  A.ACT['ident-link'] = function (f, d) {
    var r = A.get('ident_records', +f.dataset.id), tx = A.tx(), n = 0;
    if (d.unlink) { var p = {id: r.id, asset_id: null, asset_no: null, match_level: 'Не знайдено', match_note: 'відв’язано вручну', registry_date: null}; p.stage = A.identStageOf(Object.assign({}, r, p), appealOf(r)); tx.put('ident_records', p); tx.log('Відв’язано від Реєстру', 'ident', r.id); }
    else { var a = A.indexes.byNo[(d.asset_no || '').trim()]; if (!a) return A.toast('Актив з номером «' + (d.asset_no || '') + '» у Реєстрі не знайдено', 'err'); n = A.identLinkTx(tx, r, a); }
    return tx.commit().then(function () { return identSyncPlan(r.appeal_id); }).then(function () { A.toast(d.unlink ? 'Відв’язано' : 'Прив’язано до активу Реєстру' + (n ? '; перенесено файлів: ' + n : '')); A.route(true); });
  };
  A.CLICK['ident-del'] = function (t) { var tx = A.tx(); tx.del('ident_records', +t.dataset.id); tx.log('Видалено запис ідентифікації', 'ident', +t.dataset.id); return tx.commit().then(function () { A.go('#/ident/list'); }); };

  // ================================================================ складний актив (група записів)
  A.on(/^\/ident\/group\/(\d+)$/, function (id) {
    if (!canView()) return A.deny();
    var g = A.get('ident_groups', +id); if (!g) return A.notFound(); var rs = (A.indexes.identByGroup[g.id] || []).slice().sort(function (a, b) { return (a.row_no || 0) - (b.row_no || 0); });
    var linked = rs.filter(function (r) { return r.asset_id; }), pool = g.pool_id && A.get('pools', g.pool_id);
    var act = (canE() ? '<button class="btn danger" data-click="ident-group-del" data-id="' + g.id + '" data-confirm="Розформувати групу? Записи залишаться.">Розформувати</button>' : '') + '<a class="btn plain" href="' + A.link('/ident/list', {group: g.id}) + '">Записи групи в переліку</a>';
    var h = tabs('') + '<div class="grid g4">' + A.kpi('Записів', A.num(rs.length), 'об’єктів складного активу') + A.kpi('У Реєстрі', A.num(linked.length), 'зіставлено / внесено') + A.kpi('Етап', esc((STG[(rs[0] || {}).stage] || '—').slice(0, 2)), STG[(rs[0] || {}).stage] || '') +
      A.kpi('Пул у Реєстрі', pool ? '<a href="#/pool/' + pool.id + '">' + esc(pool.code) + '</a>' : '—', pool ? pool.name : 'можна створити з внесених активів') + '</div>' +
      '<div class="panel" style="margin-top:14px"><dl class="kv">' + dd('Код групи', g.code) + dd('Назва', g.name) + dd('Звернення', g.appeal_no) + dd('Ухвала', g.ruling) + dd('Примітка', g.note) + '</dl>' +
      (canE() ? '<form class="filters" data-act="ident-group-save" data-id="' + g.id + '" style="margin-top:10px"><input name="name" value="' + esc(g.name || '') + '" placeholder="Назва складного активу" style="flex:1;min-width:260px"><input name="note" value="' + esc(g.note || '') + '" placeholder="Примітка"><button class="btn gold">Зберегти</button></form>' : '') +
      (!pool && linked.length && A.can('manage_pools') ? '<p><button class="btn" data-click="ident-group-pool" data-id="' + g.id + '">Створити пул у Реєстрі з внесених активів (' + linked.length + ')</button></p>' : '') + '</div>' +
      '<h2>Об’єкти</h2><div class="wrap-tbl"><table><thead><tr><th>Запис</th><th>Актив</th><th>Вид / складність</th><th>МТУ</th><th>Етап</th><th>Реєстр</th></tr></thead><tbody>' + rs.map(recRow).join('') + '</tbody></table></div>' +
      '<div style="margin-top:14px">' + A.photosBlock('ident_group', g.id, canE(), null) + A.docsBlock('ident_group', g.id, canE(), ['ident_conclusion', 'inspection_act', 'court_scan', 'other']) + '</div>';
    A.render(A.shell('Складний актив ' + g.code, (g.name || ''), act, h), A.keep);
  });
  A.ACT['ident-group-save'] = function (f, d) { var tx = A.tx(); tx.put('ident_groups', {id: +f.dataset.id, name: d.name || null, note: d.note || null}); return tx.commit().then(function () { A.toast('Збережено'); A.route(true); }); };
  A.CLICK['ident-group-del'] = function (t) { var tx = A.tx(); tx.del('ident_groups', +t.dataset.id); tx.log('Розформовано групу ідентифікації', 'ident_group', +t.dataset.id); return tx.commit().then(function () { A.go('#/ident/list'); }); };
  A.CLICK['ident-group-pool'] = function (t) {
    var g = A.get('ident_groups', +t.dataset.id), rs = (A.indexes.identByGroup[g.id] || []).filter(function (r) { return r.asset_id; }), tx = A.tx(), pid = A.tmpId(), y = new Date().getFullYear();
    tx.put('pools', {id: pid, code: 'П-' + y + '-ІД' + g.id, name: g.name || g.code, complexity: 'pool', dept_code: g.dept_code, court_basis: g.ruling, source: 'Ідентифікація ' + g.code, ident_group_id: g.id});
    tx.put('ident_groups', {id: g.id, pool_id: pid});
    rs.forEach(function (r) { var a = A.get('assets', r.asset_id); if (a && !a.pool_id) tx.put('assets', {id: a.id, pool_id: pid}, a.updated_at); });
    tx.log('Створено пул з групи ідентифікації', 'ident_group', g.id);
    return tx.commit().then(function (r) { A.toast('Пул створено'); A.go('#/pool/' + r.id('pools', pid)); });
  };

  // ================================================================ вивантаження у структурі «БАЗОВА Ідентифікація» з автоматичними лічильниками
  function regFill(r) {
    var a = r.asset_id && A.get('assets', r.asset_id); if (!a) return {};
    var v = A.T('valuations').filter(function (x) { return x.is_current && x.value_uah && ((x.target_type === 'asset' && x.target_id === a.id) || (a.pool_id && x.target_type === 'pool' && x.target_id === a.pool_id)); })[0];
    var o = {50: v ? A.dt(v.value_date) : a.val_date ? A.dt(a.val_date) : null, 51: v && (v.valuer_entity || v.appraiser), 52: v && A.can('view_internal') ? v.appraiser_code : null, 53: v ? Math.round(v.value_uah / 10) / 100 : a.val_amount ? Math.round(a.val_amount / 10) / 100 : null,
      55: [a.storage_contract_no, a.storage_contract_date && A.dt(a.storage_contract_date)].filter(Boolean).join(' від ') || null, 56: a.custodian_name, 57: A.can('view_internal') ? a.custodian_code : null, 58: a.storage_kind, 59: a.storage_place,
      60: a.storage_cost_month, 61: a.storage_contract_date ? A.dt(a.storage_contract_date) : null, 62: a.storage_until ? A.dt(a.storage_until) : null, 65: a.mgmt_contract, 66: a.manager_name, 67: A.can('view_internal') ? a.manager_code : null};
    Object.keys(o).forEach(function (k) { if (o[k] === '—' || o[k] === undefined) o[k] = null; });
    return o;
  }
  function nd(no, d) { return [d ? A.dt(d) : '', no ? '№ ' + no : ''].filter(Boolean).join(' ') || null; }
  A.identRows = function (list) {
    list = list.slice().sort(function (a, b) { var x = appealOf(a) || {}, y = appealOf(b) || {}, p = rulingOf(a) || {}, q = rulingOf(b) || {};
      return (x.seq || 1e9) - (y.seq || 1e9) || (p.seq || 1e9) - (q.seq || 1e9) || (a.group_id || 0) - (b.group_id || 0) || (a.row_no || 1e9) - (b.row_no || 1e9) || a.id - b.id; });
    var seenA = {}, seenR = {}, seenU = {}, seenC = {}, unitRecs = {};
    list.forEach(function (r) { (unitRecs[unitKey(r)] = unitRecs[unitKey(r)] || []).push(r); });
    return list.map(function (r) {
      var d = r.data || {}, f = regFill(r), ap = appealOf(r) || {}, ru = rulingOf(r) || {}, uk = unitKey(r), firstA = !seenA[r.appeal_id || r.appeal_no], firstR = !seenR[r.ruling_id || (r.appeal_no + '/' + r.ruling_no)], firstU = !seenU[uk];
      seenA[r.appeal_id || r.appeal_no] = seenR[r.ruling_id || (r.appeal_no + '/' + r.ruling_no)] = seenU[uk] = 1;
      var u0 = unitRecs[uk][0], cx = cplx(u0), concl = !!u0.conclusion_date, ck = (r.appeal_id || r.appeal_no) + ':' + (r.conclusion_date || ''), firstC = r.conclusion_date && !seenC[ck]; if (r.conclusion_date) seenC[ck] = 1;
      var g = r.group_id && A.get('ident_groups', r.group_id);
      var c = {0: ap.seq || r.appeal_no, 1: firstA ? 1 : null, 2: ap.id ? [ap.reg_date ? A.dt(ap.reg_date) : '', ap.reg_no ? '№ ' + ap.reg_no : ''].filter(Boolean).join('\n') : d.c2,
        3: ap.id ? (ap.body && ap.body !== 'other' ? N.IBODY[ap.body] : (ap.body_text || '').split(/\s+від/)[0]) + (ap.out_date || ap.out_no ? ' від ' + nd(ap.out_no, ap.out_date) : '') : d.c3,
        4: ru.seq || r.ruling_no, 5: firstR ? 1 : null, 6: ru.id ? [ru.court, ru.ruling_date ? 'від ' + A.dt(ru.ruling_date) : '', ru.case_no ? 'справа № ' + ru.case_no : '', ru.court_proc_no ? 'провадження № ' + ru.court_proc_no : ''].filter(Boolean).join(', ').replace(', від', ' від') : d.c6,
        7: ap.id ? [ap.proceeding_date ? A.dt(ap.proceeding_date) : '', ap.proceeding_no ? '№ ' + ap.proceeding_no + (ap.articles ? ', ' + ap.articles : '') : ''].filter(Boolean).join('\n') : d.c7,
        8: ru.id ? (ru.restriction && ru.restriction !== 'other' ? N.IRESTR[ru.restriction] : ru.restriction_text || N.IRESTR[ru.restriction]) : d.c8,
        9: r.asset_desc, 10: 1, 11: firstU ? 1 : null, 12: d.c12 || N.IKIND[r.category] || r.kind, 13: d.c13 || (cplx(r) === 'complex' ? 'Складний' : 'Простий'), 14: g ? g.code : null, 15: firstU && cx === 'complex' ? 1 : null, 16: firstU && cx === 'simple' ? 1 : null,
        17: d.c17 || [r.owner_name, r.owner_code ? (/^\d{10}$/.test(r.owner_code) ? 'РНОКПП ' : /^\d{8}$/.test(r.owner_code) ? 'ЄДРПОУ ' : '') + r.owner_code : ''].filter(Boolean).join(', ') || r.owner, 18: d.c18 || A.fullAddress(r) || d.addr_raw || r.location, 19: d.c19 || N.MTU[r.mtu_code],
        20: N.IUSER[d.c20] || d.c20, 21: [d.c21, d.c21code].filter(Boolean).join(', ') || null, 22: d.c22, 23: A.map(BASIS)[d.c23] || d.c23, 24: d.c24, 25: d.c25from || d.c25to ? [d.c25from ? A.dt(d.c25from) : '…', d.c25to ? A.dt(d.c25to) : '…'].join(' – ') : d.c25, 26: d.c26,
        27: d.c27 || nd(r.mtu_order_no, r.mtu_order_date), 28: d.c28d ? A.dt(d.c28d) : d.c28, 29: d.c29, 30: d.c30 || N.IUSE[r.usage_state], 31: d.c31 || N.ITECH[r.tech_state], 32: d.c32 ? A.dt(isoDate(d.c32) || d.c32) : r.inspect_date ? A.dt(r.inspect_date) : null, 33: d.c33,
        34: d.c34 || N.IREASON[r.reason_code], 35: r.conclusion_date ? A.dt(r.conclusion_date) : d.c35, 36: firstU && concl && cx === 'complex' ? 1 : null, 37: firstU && concl && cx === 'simple' ? 1 : null, 39: firstU && u0.possible === 'yes' ? 1 : null, 40: firstU && u0.possible === 'no' ? 1 : null,
        41: d.c41 || N.IRES[r.result_code] || r.result, 42: firstC ? 1 : null, 43: d.c43 || nd(r.sent_no, r.sent_date)};
      [44, 45, 46, 47, 48, 49].forEach(function (i) { c[i] = d['c' + i + 'n'] || d['c' + i + 'd'] ? nd(d['c' + i + 'n'], d['c' + i + 'd']) : d['c' + i]; });
      var row = [];
      for (var i = 0; i < 68; i++) { var v = i in c ? c[i] : d['c' + i]; if ((v === undefined || v === null || v === '') && f[i] !== undefined && f[i] !== null) v = f[i];
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = A.dt(v); row.push(v === undefined || v === '' ? null : v); }
      return row;
    });
  };
  A.CLICK['ident-xlsx'] = function (t) {
    var f = A.json(t.dataset.q, {}), list = A.identFilter(f);
    if (!list.length) return A.toast('Немає записів для вивантаження', 'err');
    A.busy(true);
    return fetch(A.asset('ident_template.xlsx'), {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error('Шаблон не знайдено'); return r.arrayBuffer(); }).then(function (buf) {
      return window.XLSX.fillTemplate(buf, {sheet: 'Аркуш1', protoRow: 7, firstRow: 7, cols: 68, rows: A.identRows(list), formulas: {38: 'AK{r}+AL{r}'},
        extraSheets: {'Аркуш1': [['A2', 'Електронна таблиця\nданих про ідентифікацію активів станом на ' + A.dt(A.today())]]}});
    }).then(function (blob) { A.busy(false); window.XLSX.download(blob, 'БАЗОВА_Ідентифікація_' + A.today() + '.xlsx'); A.audit('Вивантажено ідентифікацію XLSX', 'ident', null, {rows: list.length}); }, function (e) { A.busy(false); throw e; });
  };
})();
