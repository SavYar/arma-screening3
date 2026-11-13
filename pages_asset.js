/* Картка активу: огляд, скринінг, управління, правовий стан і рішення, оцінки, план дій, документи, фото;
   редагування, заведення нового активу. Спільні помічники: файли, план дій, перерахунок правового стану й оцінки. */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S;
  var DT = A.map(D.DOC_TYPES), DOCX = ['pdf'];   // документи — лише PDF
  A.isFin = function (a) { return A.FIN.indexOf(a.category) >= 0; };
  A.CUSTODY = ['realestate', 'land', 'transport', 'property'];
  A.KIND_LABEL = 'Тип майна для звітності';
  A.KIND_HINT = 'Класифікація активу у звітах за наказом АРМА про ефективне управління: рухоме чи нерухоме майно, земельна ділянка, корпоративні права, єдиний майновий комплекс, грошові кошти або інше майно.';
  A.q = function (title) { return '<span class="hint-q" title="' + esc(title) + '">?</span>'; };
  function dd(label, v, raw) { return v === null || v === undefined || v === '' ? '' : '<dt title="' + esc(label) + '">' + esc(label) + '</dt><dd>' + (raw ? v : esc(v)) + '</dd>'; }
  A.dd = dd;
  function users(fn) { return A.T('users').filter(function (u) { return u.is_active !== 0 && fn(u); }); }
  A.users = users;

  // ================================================================ файли
  var media = {thumbs: null, views: null, loading: null};
  A.loadMedia = function () {
    if (A.mode === 'server' || media.thumbs) return Promise.resolve();
    if (!media.loading) {
      var get = function (f) { return fetch(A.asset(f), {cache: 'no-cache'}).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); };
      media.loading = Promise.all([get('data-thumbs.json'), get('data-views.json')]).then(function (r) { media.thumbs = r[0]; media.views = r[1]; });
    }
    return media.loading;
  };
  // v2.6: перегляд документа у вікні порталу (PDF — вбудованим переглядачем браузера, зображення — як є); «Завантажити» — збереження файла
  A.CLICK.docview = function (t) {
    var bg = document.createElement('div'), ext = t.dataset.ext, img = /^(jpe?g|png|webp|gif)$/.test(ext);
    bg.className = 'docview'; bg.innerHTML = '<div class="dv-bar"><b title="' + esc(t.dataset.name) + '">' + esc(t.dataset.name) + '</b><a class="btn sm" href="' + esc(t.dataset.dl) + '" download>Завантажити</a><a class="btn sm plain" href="' + esc(t.dataset.url) + '" target="_blank" rel="noopener">Нова вкладка</a><button class="btn sm gold" data-x>Закрити</button></div>' +
      (img ? '<div class="dv-body img"><img src="' + esc(t.dataset.url) + '" alt=""></div>' : '<iframe class="dv-body" src="' + esc(t.dataset.url) + '#view=FitH" title="Перегляд документа"></iframe>');
    document.body.appendChild(bg); document.body.style.overflow = 'hidden';
    function close() { bg.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    bg.querySelector('[data-x]').addEventListener('click', close); bg.addEventListener('click', function (e) { if (e.target === bg) close(); }); document.addEventListener('keydown', key);
  };
  A.fileUrl = function (l, variant) {
    if (l.data_url) return l.data_url;
    if (A.mode === 'server') return A.api + '/files/media/' + l.file_id + '/' + (variant || 'orig');
    var m = variant === 'thumb' ? media.thumbs : media.views;
    return (m && m[l.id]) || (media.thumbs && media.thumbs[l.id]) || null;
  };
  A.filesOf = function (tt, id) { return (A.indexes.files[tt + ':' + id] || []).slice().sort(function (a, b) { return (a.created_at || '').localeCompare(b.created_at || '') || a.id - b.id; }); };
  function isPhoto(ext) { return ['jpg', 'jpeg', 'png', 'webp', 'heic'].indexOf((ext || '').toLowerCase()) >= 0; }
  function shrink(file) {   // фото в дзеркалі зменшуються до 1600 px (зберігаються в браузері)
    return new Promise(function (res, rej) {
      var rd = new FileReader(); rd.onerror = function () { rej(new Error('Не вдалося прочитати ' + file.name)); };
      rd.onload = function () {
        var img = new Image(); img.onerror = function () { rej(new Error(file.name + ': файл не є зображенням')); };
        img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  function readUrl(file) { return new Promise(function (res, rej) { var rd = new FileReader(); rd.onload = function () { res(rd.result); }; rd.onerror = function () { rej(new Error('Не вдалося прочитати ' + file.name)); }; rd.readAsDataURL(file); }); }
  A.upload = function (tt, tid, docType, title, files) {
    files = [].slice.call(files || []).filter(function (f) { return f && f.name; });
    if (!files.length) return Promise.reject(new Error('Оберіть файли'));
    if (A.mode === 'server') {
      var fd = new FormData(); fd.append('target_type', tt); fd.append('target_id', tid); fd.append('doc_type', docType); fd.append('title', title || '');
      files.forEach(function (f) { fd.append('files', f); });
      A.busy(true);
      return A.http('POST', '/api/upload', fd, true).then(function (r) { A.busy(false); A.applyServer(r); (r.errors || []).forEach(function (e) { A.toast(e, 'err'); }); return r.added || 0; }, function (e) { A.busy(false); throw e; });
    }
    var errs = [];
    return Promise.all(files.map(function (f) {
      var ext = (f.name.split('.').pop() || '').toLowerCase(), photo = docType === 'photo';
      if (photo && !isPhoto(ext)) { errs.push(f.name + ': для фото дозволено JPG, PNG, WEBP'); return null; }
      if (!photo && DOCX.indexOf(ext) < 0) { errs.push(f.name + ': документи завантажуються лише у форматі PDF'); return null; }
      if (!photo && f.size > 8 * 1048576) { errs.push(f.name + ': у дзеркалі документи до 8 МБ (на сервері — до ' + D.MAX_DOC_MB + ' МБ)'); return null; }
      return (photo ? shrink(f) : readUrl(f)).then(function (url) { return {f: f, ext: ext, url: url, photo: photo}; }, function (e) { errs.push(e.message); return null; });
    })).then(function (res) {
      res = res.filter(Boolean); errs.forEach(function (e) { A.toast(e, 'err'); });
      if (!res.length) return 0;
      var tx = A.tx();
      res.forEach(function (x) { tx.put('file_links', {id: A.tmpId(), file_id: null, target_type: tt, target_id: tid, doc_type: docType, title: title || null, orig_name: x.f.name, ext: x.ext, size: x.f.size, kind: x.photo ? 'photo' : 'doc', mime: x.f.type, data_url: x.url}); });
      if (tt === 'asset') { var a = A.get('assets', tid); if (a) tx.put('assets', docType === 'photo' ? {id: tid, photo_count: (a.photo_count || 0) + res.length} : {id: tid, doc_count: (a.doc_count || 0) + res.length}, a.updated_at); }
      tx.log('Завантажено файли', tt, tid, {count: res.length, type: docType});
      return tx.commit().then(function () { return res.length; });
    });
  };
  A.unlink = function (lid) {
    var l = A.get('file_links', lid); if (!l) return Promise.resolve();
    if (A.mode === 'server') return A.http('POST', '/api/unlink/' + lid, {}).then(function (r) { A.applyServer(r); });
    var tx = A.tx(); tx.del('file_links', lid);
    if (l.target_type === 'asset') { var a = A.get('assets', l.target_id); if (a) tx.put('assets', l.doc_type === 'photo' ? {id: a.id, photo_count: Math.max(0, (a.photo_count || 1) - 1)} : {id: a.id, doc_count: Math.max(0, (a.doc_count || 1) - 1)}, a.updated_at); }
    tx.log('Відв’язано файл', l.target_type, l.target_id); return tx.commit();
  };
  // блок документів: розділ за типами документів, завантаження, перегляд, завантаження на комп’ютер
  A.docsBlock = function (tt, tid, editable, types, note) {
    var links = A.filesOf(tt, tid).filter(function (l) { return l.doc_type !== 'photo'; }), by = {};
    links.forEach(function (l) { (by[l.doc_type] = by[l.doc_type] || []).push(l); });
    types = types || D.DOC_TYPES.map(function (d) { return d[0]; }).filter(function (c) { return c !== 'photo'; });
    var h = '<div class="panel"><h3>Документи <span>' + links.length + '</span></h3>' + (note ? '<p class="mini">' + esc(note) + '</p>' : '');
    types.concat(Object.keys(by).filter(function (k) { return types.indexOf(k) < 0; })).forEach(function (t) {
      var ls = by[t] || [];
      h += '<div class="doc-group"><h4>' + esc(DT[t] || t) + ' <span class="mini">' + (ls.length || '') + '</span></h4>' + (ls.length ? '<div class="doclist">' + ls.map(function (l) {
        var url = A.fileUrl(l, 'orig'), ext = (l.ext || '').toUpperCase();
        return '<div class="docrow"><span><b>' + esc(l.title || l.orig_name || DT[t]) + '</b><span class="sub">' + esc(l.orig_name || '') + (ext ? ' · ' + ext : '') + (l.size ? ' · ' + A.num(l.size / 1048576, 1) + ' МБ' : '') + (l.created_at ? ' · ' + A.dt(l.created_at) : '') + (l.created_by ? ' · ' + esc(l.created_by) : '') + (l.shared_from ? ' · з активу ' + esc(l.shared_from) : '') + '</span></span><span class="actions-inline">' +
          (url ? '<button type="button" class="btn sm" data-click="docview" data-url="' + esc(A.mode === 'server' ? A.fileUrl(l, 'inline') : url) + '" data-dl="' + esc(url) + '" data-name="' + esc(l.title || l.orig_name || 'Документ') + '" data-ext="' + esc((l.ext || '').toLowerCase()) + '" title="Відкрити у вікні перегляду порталу, без збереження файла">Переглянути</button><a class="btn sm plain" href="' + url + '" download="' + esc(l.orig_name || 'document') + '" title="Зберегти файл на комп’ютер">Завантажити</a>' : '<span class="mini" title="Документи робочої системи в дзеркало не копіюються">файл на сервері</span>') +
          (editable ? '<button type="button" class="btn sm danger" data-click="unlink" data-id="' + l.id + '" data-confirm="Відв’язати документ «' + esc(l.orig_name || '') + '»?">×</button>' : '') + '</span></div>';
      }).join('') + '</div>' : '<div class="empty mini">Не додано</div>') + '</div>';
    });
    if (editable && A.can('upload_files')) {
      h += '<form class="filters" data-act="upload" data-tt="' + tt + '" data-tid="' + tid + '" style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">' +
        A.sel('doc_type', D.DOC_TYPES.filter(function (d) { return d[0] !== 'photo' && types.indexOf(d[0]) >= 0; }), types[0], null) +
        '<input name="title" placeholder="Назва документа (необов’язково)" style="min-width:220px"><input type="file" name="files" multiple accept=".pdf,application/pdf">' +
        '<button class="btn gold">Завантажити документ</button></form><p class="mini">Лише PDF · до ' + D.MAX_DOC_MB + ' МБ на файл.</p>';
    }
    return h + '</div>';
  };
  A.photosBlock = function (tt, tid, editable, blocked) {
    var ph = A.filesOf(tt, tid).filter(function (l) { return l.doc_type === 'photo'; });
    var h = '<div class="panel"><h3>Фотографії <span>' + ph.length + '</span></h3>';
    if (ph.length) {
      h += '<div class="gallery" data-gallery>' + ph.map(function (l, i) { var th = A.fileUrl(l, 'thumb'), v = A.fileUrl(l, 'view');
        return '<a href="#" data-click="lightbox" data-i="' + i + '" data-src="' + esc(v || th || '') + '" title="' + esc(l.title || l.orig_name || '') + '">' + (th ? '<img src="' + esc(th) + '" alt="" loading="lazy">' : '<div class="empty mini" style="height:86px">фото на сервері</div>') +
          (editable ? '<button type="button" class="btn sm danger del" data-click="unlink" data-id="' + l.id + '" data-confirm="Видалити фото?">×</button>' : '') + '</a>'; }).join('') + '</div>';
    } else h += '<div class="empty">Фото не додано.</div>';
    if (blocked) h += '<div class="flash info" style="margin-top:10px">' + esc(blocked) + '</div>';
    else if (editable && A.can('upload_files')) h += '<form class="filters" data-act="upload" data-tt="' + tt + '" data-tid="' + tid + '" style="margin-top:10px"><input type="hidden" name="doc_type" value="photo"><input type="file" name="files" multiple accept="image/*"><button class="btn gold">Додати фото</button><span class="mini">JPG, PNG, WEBP · до ' + D.MAX_PHOTO_MB + ' МБ</span></form>';
    return h + '</div>';
  };
  A.ACT.upload = function (f, d) {
    var inp = f.querySelector('input[type=file]');
    return A.upload(f.dataset.tt, +f.dataset.tid, d.doc_type || 'other', d.title, inp && inp.files).then(function (n) { if (n) A.toast('Додано файлів: ' + n); A.route(true); });
  };
  A.CLICK.unlink = function (t) { return A.unlink(+t.dataset.id).then(function () { A.toast('Файл відв’язано'); A.route(true); }); };
  A.CLICK.lightbox = function (t) {
    var items = [].slice.call(t.closest('[data-gallery]').querySelectorAll('[data-src]')), i = +t.dataset.i;
    var lb = document.createElement('div'); lb.className = 'lightbox';
    function show() { var s = items[i].dataset.src; lb.innerHTML = (s ? '<img src="' + esc(s) + '" alt="">' : '<div class="empty">Зображення недоступне</div>') +
      '<div class="lb-bar"><button class="btn sm" data-lb="-1">‹</button><span>' + (i + 1) + ' / ' + items.length + '</span><button class="btn sm" data-lb="1">›</button><button class="btn sm plain" data-lb="0">Закрити (Esc)</button></div>'; }
    lb.addEventListener('click', function (e) { var b = e.target.closest('[data-lb]'); if (b) { var k = +b.dataset.lb; if (!k) return lb.remove(); i = (i + k + items.length) % items.length; show(); } else if (e.target === lb) lb.remove(); });
    show(); document.body.appendChild(lb);
  };

  // ================================================================ правовий стан, оцінка — перерахунок кешу в картці
  var LKEYS = ['legal_status', 'legal_note', 'legal_basis', 'legal_dec', 'decisions_count', 'last_decision_date'];
  function same(a, b) { return (a === null || a === undefined ? '' : String(a)) === (b === null || b === undefined ? '' : String(b)); }
  A.legalPatch = function (a, manual) { var r = A.legalCompute(a, null, manual), p = {}; LKEYS.forEach(function (k) { p[k] = r[k] === undefined ? null : r[k]; }); return p; };
  A.recalcLegal = function (ids) {
    var tx = A.tx(), n = 0;
    ids.forEach(function (id) { var a = A.get('assets', id); if (!a) return; var p = A.legalPatch(a), ch = LKEYS.some(function (k) { return !same(a[k], p[k]); });
      if (ch) { tx.put('assets', Object.assign({id: a.id}, p), a.updated_at); n++; } });
    return n ? tx.commit().then(function () { return n; }) : Promise.resolve(0);
  };
  A.refreshValCache = function (tt, tid) {
    if (tt !== 'asset' && tt !== 'pool') return Promise.resolve();
    var t = tt === 'pool' ? 'pools' : 'assets', rec = A.get(t, tid); if (!rec) return Promise.resolve();
    var v = A.T('valuations').filter(function (x) { return x.target_type === tt && x.target_id === tid && x.value_uah && x.is_current; })
      .sort(function (a, b) { return (b.value_date || '').localeCompare(a.value_date || '') || b.id - a.id; })[0];
    var p = {id: tid, val_amount: v ? v.value_uah : null, val_date: v ? v.value_date : null};
    if (tt === 'asset') { var grp = (A.indexes.vaByAsset[tid] || []).some(function (l) { var g = A.get('valuations', l.valuation_id); return g && g.is_current; });
      p.val_source = v ? (/^Інвентаризація/.test(v.source || '') ? 'Інвентаризація' : 'Модуль оцінок') : grp ? 'Групова оцінка' : null; }
    if (Object.keys(p).every(function (k) { return same(rec[k], p[k]); })) return Promise.resolve();
    var tx = A.tx(); tx.put(t, p, rec.updated_at); return tx.commit();
  };

  // ================================================================ план дій (CRM): кроки з паралельними групами
  A.plansOf = function (tt, id) { return (A.indexes.plans[tt + ':' + id] || []).slice().sort(function (a, b) { return b.id - a.id; }); };
  A.approversFor = function (responsible) { return (D.APPROVERS || {})[(responsible || '').trim()] || ['leadership']; };
  // opt: {assign: {відповідальний: ПІБ}, mtu: 'коди МТУ', mtuNames: 'назви МТУ'} — виконавці кроків (куратор, МТУ огляду)
  A.createPlan = function (tx, tt, tid, process, dept, mgr, opt) {
    var pr = D.PROCESSES.filter(function (p) { return p[0] === process; })[0]; if (!pr) throw new Error('Невідомий процес');
    var pid = A.tmpId(), t = A.today(), first = pr[3][0][4] || 1; opt = opt || {};
    tx.put('plans', {id: pid, target_type: tt, target_id: tid, process: process, dept_code: dept || null, manager_id: mgr ? mgr.id : null, manager: mgr ? mgr.full_name : null, status: 'active', started_at: t, created_by: S.user && S.user.login});
    pr[3].forEach(function (s, i) { var g = s[4] || i + 1, act = g === first, isMtu = s[1] === 'МТУ';
      tx.put('plan_steps', {id: A.tmpId(), plan_id: pid, ord: i + 1, grp: g, name: s[0], responsible: s[1], norm_days: s[2], needs_confirm: s[3] ? 1 : 0, status: act ? 'active' : 'pending', started_at: act ? t : null, due_date: act ? A.addWorkdays(t, s[2]) : null,
        approver: s[3] ? A.approversFor(s[1]).join(',') : null, assignee: isMtu ? (opt.mtuNames || null) : ((opt.assign || {})[s[1]] || null), assignee_mtu: isMtu ? (opt.mtu || null) : null}); });
    tx.log('Створено план дій', tt, tid, {process: pr[1]});
    return pid;
  };
  // зміна стану кроку + активація наступної групи (та сама логіка, що на сервері)
  A.stepAction = function (sid, action, comment) {
    var s = A.get('plan_steps', sid); if (!s) return Promise.reject(new Error('Крок не знайдено'));
    var plan = A.get('plans', s.plan_id), steps = (A.indexes.stepsByPlan[s.plan_id] || []).map(function (x) { return Object.assign({}, x); }), me = steps.filter(function (x) { return x.id === sid; })[0];
    var login = S.user && S.user.login, now = A.nowS(), t = A.today(), changed = {};
    function set(x, p) { Object.assign(x, p); changed[x.id] = x; }
    var hist = A.json(me.history, []); if (!Array.isArray(hist)) hist = [];
    function addH(a, c) { hist.push({at: now, by: login, name: S.user && S.user.full_name, a: a, c: c || null}); set(me, {history: JSON.stringify(hist)}); }
    if (action === 'done') { if (me.status !== 'active') throw new Error('Крок не в роботі'); set(me, me.needs_confirm ? {status: 'review', done_at: now, done_by: login, requested_at: now, approver: me.approver || A.approversFor(me.responsible).join(',')} : {status: 'done', done_at: now, done_by: login}); addH(me.needs_confirm ? 'подано на погодження' : 'виконано', comment); }
    else if (action === 'confirm' || action === 'return') {
      var why = A.whyCantApprove(me); if (why) throw new Error(why);
      if (action === 'confirm') { set(me, {status: 'done', confirmed_at: now, confirmed_by: login}); addH('погоджено', comment); }
      else { set(me, {status: 'active', done_at: null, done_by: null, comment: 'Повернуто на доопрацювання (' + login + '): ' + (comment || '')}); addH('повернуто на доопрацювання', comment); comment = null; }
    }
    else if (action === 'skip') { if (!A.can('crm_confirm')) throw new Error('Пропускати кроки може менеджер ДМА'); set(me, {status: 'skipped', done_at: now, done_by: login}); }
    if (comment) set(me, {comment: comment});
    var planPatch = null;
    if (!steps.some(function (x) { return x.status === 'active' || x.status === 'review'; })) {
      var pend = steps.filter(function (x) { return x.status === 'pending'; });
      if (!pend.length) planPatch = {id: plan.id, status: 'done', finished_at: t};
      else { var g = pend[0].grp || pend[0].ord; pend.forEach(function (x) { if ((x.grp || x.ord) === g) set(x, {status: 'active', started_at: t, due_date: A.addWorkdays(t, x.norm_days || 1)}); }); }
    }
    var tx = A.tx();
    Object.keys(changed).forEach(function (id) { var x = changed[id], orig = A.get('plan_steps', +id), p = {id: +id};
      Object.keys(x).forEach(function (k) { if (!same(orig[k], x[k])) p[k] = x[k]; }); tx.put('plan_steps', p); });
    if (planPatch) tx.put('plans', planPatch);
    tx.log({done: 'Крок виконано', confirm: 'Крок підтверджено', 'return': 'Крок повернуто', skip: 'Крок пропущено'}[action] || action, plan.target_type, plan.target_id, {step: me.name});
    return tx.commit();
  };
  // хто може погодити крок: роль зі списку погоджувачів (або адміністратор) і не автор подання
  function rn(r) { if (r.indexOf('head:') === 0) { var un = r.slice(5); return 'Керівник ' + (un === '@plan' ? 'відділу, за яким закріплено план' : (N.DMA_SHORT[un] || un)); } return (D.ROLE_NAME_SHORT || {})[r] || r; }
  function approverOk(u, roles, s) {
    return roles.some(function (r) { if (r === u.role_code) return true; if (r.indexOf('head:') !== 0 || u.role_code !== 'head') return false;
      var un = r.slice(5); if (un === '@plan') { var pl = A.get('plans', s.plan_id); un = (pl && pl.dept_code) || 'dam'; } return u.dept_code === un; });
  }
  A.approverRoles = function (s) { var roles = (s.approver || '').split(',').filter(Boolean); return roles.length ? roles : A.approversFor(s.responsible); };
  A.approverNames = function (s) { return A.approverRoles(s).map(rn).join(', '); };
  A.whyCantApprove = function (s) {
    var u = S.user || {}, roles = A.approverRoles(s);
    if (s.status !== 'review') return 'Крок не очікує погодження';
    if (s.done_by && s.done_by === u.login) return 'Не можна погоджувати власний крок — запит надіслано: ' + A.approverNames(s);
    if (u.role_code !== 'admin' && (!approverOk(u, roles, s) || !A.can('crm_confirm'))) return 'Погоджує: ' + A.approverNames(s);
    return null;
  };
  A.myApprovals = function () { return A.T('plan_steps').filter(function (s) { return s.status === 'review' && !A.whyCantApprove(s); }); };
  // v2.7: маршрутизація ВИКОНАННЯ кроку до підрозділу, зазначеного у графі «Відповідальний» (D.APPROVERS → підрозділ):
  // роль-код — користувачі цієї ролі; «head:X» — усі працівники підрозділу X; «head:@plan» — відділ ДМА, за яким закріплено план;
  // «МТУ» — виконавці МТУ, обраного для кроку (assignee_mtu) або закріпленого за активом.
  A.isStepExecutor = function (s, u) {
    u = u || S.user || {}; if (!u.login || !A.can('crm_edit')) return false;
    var pl = A.get('plans', s.plan_id) || {}, resp = (s.responsible || '').trim();
    if (resp === 'МТУ') { if (u.role_code !== 'mtu' || !u.mtu_code) return false; var tg = pl.target_type === 'asset' ? A.get('assets', pl.target_id) : null;
      return (s.assignee_mtu || '').split(/[,;\s]+/).indexOf(u.mtu_code) >= 0 || (!s.assignee_mtu && tg && tg.mtu_code === u.mtu_code); }
    return A.approversFor(resp).some(function (r) { if (r === u.role_code && r !== 'leadership') return true; if (r.indexOf('head:') !== 0) return false;
      var un = r.slice(5); if (un === '@plan') un = pl.dept_code || 'dam'; return u.dept_code === un; });
  };
  A.myExecSteps = function () { return A.T('plan_steps').filter(function (s) { if (s.status !== 'active') return false; var pl = A.get('plans', s.plan_id); return pl && pl.status === 'active' && A.isStepExecutor(s); }); };
  // скасувати план можуть лише керівництво ДМА (керівник Департаменту менеджменту активів) і адміністратор
  A.canCancelPlan = function () { var u = S.user || {}; return u.role_code === 'admin' || A.can('system') || (u.role_code === 'head' && u.dept_code === 'dam'); };
  var SST = A.map(D.STEP_STATUS || [['pending', 'Очікує'], ['active', 'У роботі'], ['review', 'Очікує підтвердження'], ['done', 'Виконано'], ['skipped', 'Пропущено']]);
  // opt: {processes: [коди], process: типовий процес, depts: [[код, назва]], hideDept: true}
  A.planBlock = function (tt, tid, editable, dept, opt) {
    opt = opt || {};
    var plans = A.plansOf(tt, tid), t = A.today(), h = '';
    plans.forEach(function (p) {
      var steps = A.indexes.stepsByPlan[p.id] || [], done = steps.filter(function (s) { return s.status === 'done' || s.status === 'skipped'; }).length, grpN = {};
      steps.forEach(function (s) { grpN[s.grp || s.ord] = (grpN[s.grp || s.ord] || 0) + 1; });
      h += '<div class="panel" style="margin-bottom:12px"><h3>' + esc(N.PROC[p.process] || p.process) + ' <span>' + ({active: 'діє', done: 'завершено', cancelled: 'скасовано'}[p.status] || p.status) + ' · з ' + A.dt(p.started_at) + (p.manager ? ' · ' + esc(p.manager) : '') + (p.dept_code ? ' · ' + esc(N.DMA_SHORT[p.dept_code] || '') : '') + '</span></h3>' +
        '<div class="prog"><div style="width:' + (steps.length ? done * 100 / steps.length : 0).toFixed(0) + '%"></div></div><div class="mini" style="margin:4px 0 10px">Виконано кроків: ' + done + ' з ' + steps.length + '</div><details class="plan-steps"' + (p.status === 'active' ? ' open' : '') + '><summary>Кроки плану (' + steps.length + ') <span class="mini">— натисніть, щоб згорнути / розгорнути</span></summary><ol class="steps">';
      steps.forEach(function (s) {
        var over = (s.status === 'active' || s.status === 'review') && s.due_date && s.due_date < t, par = grpN[s.grp || s.ord] > 1;
        var cls = s.status === 'done' ? 'done' : s.status === 'active' ? 'now' : s.status === 'review' ? 'review' : s.status === 'skipped' ? 'skip' : '';
        var acts = '';
        var ex = p.status === 'active' && A.isStepExecutor(s);
        if ((editable || ex) && p.status === 'active' && A.can('crm_edit')) {
          if (s.status === 'active') acts += '<button class="btn sm gold" data-click="step" data-a="done" data-id="' + s.id + '">' + (s.needs_confirm ? 'На підтвердження' : 'Виконано') + '</button>';
          if (s.status === 'review' && !A.whyCantApprove(s)) acts += '<button class="btn sm gold" data-click="step" data-a="confirm" data-id="' + s.id + '">Погодити</button><button class="btn sm plain" data-click="step" data-a="return" data-id="' + s.id + '">Повернути</button>';
          else if (s.status === 'review') acts += '<span class="mini" title="' + esc(A.whyCantApprove(s)) + '">чекає погодження: ' + esc(A.approverNames(s)) + '</span>';
          if ((s.status === 'active' || s.status === 'pending') && A.can('crm_confirm')) acts += '<button class="btn sm plain" data-click="step" data-a="skip" data-id="' + s.id + '" data-confirm="Пропустити крок «' + esc(s.name) + '»?" title="Пропустити крок">⤼</button>';
        }
        h += '<li class="' + cls + '" style="' + (par ? 'border-style:dashed' : '') + '"><span class="n">' + s.ord + '</span><div><div class="t" title="' + esc(s.name) + '">' + esc(s.name) + (par ? ' <span class="tag t-unk" title="Виконується паралельно з іншими кроками цієї групи">паралельно</span>' : '') + '</div><div class="s">' + esc(s.responsible || '') + (s.assignee ? ' · виконавець: ' + esc(s.assignee) : '') + ' · норматив ' + (s.norm_days || '—') + ' р. дн.' + (s.needs_confirm ? ' · погоджує: ' + esc(A.approverNames(s)) : '') + '</div>' + (s.comment ? '<div class="s">' + esc(s.comment) + '</div>' : '') + histHtml(s) + '</div>' +
          '<div class="s">' + esc(SST[s.status] || s.status) + (s.done_by ? '<br>' + esc(s.done_by) : '') + '</div><div class="s ' + (over ? 'overdue' : '') + '">' + (s.due_date ? 'до ' + A.dt(s.due_date) : '') + (s.done_at ? '<br>виконано ' + A.dt(s.done_at) : '') + '</div><div class="actions-inline">' + acts + '</div></li>';
      });
      h += '</ol></details>' + ((editable && (A.can('crm_confirm') || A.can('delete_records'))) || (p.status === 'active' && A.canCancelPlan()) ? '<div class="actions-inline" style="margin-top:10px">' + (p.status === 'active' && A.canCancelPlan() ? '<button class="btn sm plain" data-click="plan-cancel" data-id="' + p.id + '" data-confirm="Скасувати план дій?">Скасувати план</button>' : '') +
        (A.can('delete_records') ? '<button class="btn sm danger" data-click="plan-del" data-id="' + p.id + '" data-confirm="Видалити план дій з усіма кроками?">Видалити план</button>' : '') + '</div>' : '') + '</div>';
    });
    if (!plans.length) h += '<div class="panel"><div class="empty">План дій ще не створено.</div></div>';
    if (editable && A.can('crm_edit')) {
      var mg = users(function (u) { return u.dept_code && (!dept || u.dept_code === dept); });
      var procs = D.PROCESSES.filter(function (p) { return !opt.processes || opt.processes.indexOf(p[0]) >= 0; }).map(function (p) { return [p[0], p[1]]; });
      h += '<form class="panel filters plan-new" data-act="plan-new" data-tt="' + tt + '" data-tid="' + tid + '" style="margin-top:12px"><b style="width:100%">Новий план дій</b>' + A.sel('process', procs, opt.process || null, opt.process ? null : 'Бізнес-процес', 'required') +
        (opt.hideDept ? '<input type="hidden" name="dept" value="' + esc(dept || '') + '">' : A.sel('dept', opt.depts || D.DMA, dept, 'Відповідальний підрозділ')) + A.sel('manager', mg.map(function (u) { return [u.id, u.full_name + ' — ' + (N.DMA_SHORT[u.dept_code] || '')]; }), S.user && S.user.dept_code && (!dept || S.user.dept_code === dept) ? S.user.id : null, 'Менеджер-куратор') + '<button class="btn gold">Створити план</button></form>';
    }
    return h;
  };
  function histHtml(s) { var hs = A.json(s.history, []); if (!Array.isArray(hs) || !hs.length) return '';
    return '<details class="s"><summary>історія (' + hs.length + ')</summary>' + hs.map(function (x) { return '<div>' + esc((x.at || '').slice(0, 16)) + ' · ' + esc(x.name || x.by) + ': ' + esc(x.a) + (x.c ? ' — ' + esc(x.c) : '') + '</div>'; }).join('') + '</details>'; }
  A.ACT['plan-new'] = function (f, d) {
    if (!d.process) return A.toast('Оберіть бізнес-процес', 'err');
    var tt = f.dataset.tt, tid = +f.dataset.tid;
    if (A.plansOf(tt, tid).some(function (p) { return p.status === 'active' && p.process === d.process; }) && !confirm('Такий план уже діє. Створити ще один?')) return;
    var tx = A.tx(); A.createPlan(tx, tt, tid, d.process, d.dept, d.manager ? A.get('users', +d.manager) : null);
    return tx.commit().then(function () { A.toast('План дій створено'); A.route(true); });
  };
  A.CLICK.step = function (t) {
    var a = t.dataset.a, c = null;
    if (a === 'return') { c = prompt('Причина повернення на доопрацювання:'); if (c === null) return; }
    if (a === 'done') { c = prompt('Коментар до виконання (необов’язково):', ''); if (c === null) return; }
    return A.stepAction(+t.dataset.id, a, c).then(function () { A.route(true); });
  };
  A.CLICK['plan-cancel'] = function (t) { if (!A.canCancelPlan()) return A.toast('Скасувати план можуть лише керівництво ДМА і адміністратор', 'err'); var tx = A.tx(), p = A.get('plans', +t.dataset.id); tx.put('plans', {id: p.id, status: 'cancelled', finished_at: A.today()}); tx.log('План дій скасовано', p.target_type, p.target_id); return tx.commit().then(function () { A.route(true); }); };
  A.CLICK['plan-del'] = function (t) { var tx = A.tx(), p = A.get('plans', +t.dataset.id); tx.del('plans', p.id); tx.log('План дій видалено', p.target_type, p.target_id); return tx.commit().then(function () { A.route(true); }); };

  // ================================================================ картка активу
  var REQ = ['mtu_code', 'dept_code', 'dma_manager', 'region', 'settl_name', 'inspect_date', 'tech_state', 'usage_state', 'invest_grade', 'mgmt_possible', 'transfer_way', 'description'];
  A.completeness = function (a) { var f = A.isFin(a) ? REQ.filter(function (k) { return ['region', 'settl_name', 'inspect_date', 'tech_state', 'usage_state', 'mtu_code'].indexOf(k) < 0; }) : REQ;
    var n = f.filter(function (k) { return a[k] !== null && a[k] !== undefined && a[k] !== '' && a[k] !== 'unknown' && a[k] !== 'none'; }).length + (A.isFin(a) || a.photo_count ? 1 : 0); return Math.round(n * 100 / (f.length + 1)); };
  A.prozorroUrl = function (o) { return o.prozorro_url || (o.prozorro_id ? 'https://prozorro.sale/auction/' + encodeURIComponent(o.prozorro_id) : ''); };
  A.prozorroBtn = function (o) { var u = A.prozorroUrl(o); return u ? '<a class="btn sm gold prozorro" href="' + esc(u) + '" target="_blank" rel="noopener" title="Відкрити лот на Prozorro.Продажі">Prozorro · ' + esc(o.prozorro_id || 'лот') + '</a>' : ''; };
  function detailsList(a) {
    var fields = D.CATEGORY_FIELDS[a.category] || [], det = a.details || {}, h = '';
    fields.forEach(function (f) { var k = f[0], v = det[k]; if (v === null || v === undefined || v === '') return; if (D.INTERNAL_DETAIL_KEYS.indexOf(k) >= 0 && !A.can('view_internal')) return;
      h += dd(f[1], f[2] === 'date' ? A.dt(v) : f[2] === 'num' && !isNaN(v) ? A.num(v, 2) : '<span class="' + (/vin|wallet|tx_hash|plate|isin|reg_no/.test(k) ? 'mono' : '') + '">' + esc(v) + '</span>' + (D.INTERNAL_DETAIL_KEYS.indexOf(k) >= 0 ? ' <span class="mini">· службово</span>' : ''), true); });
    if (a.category === 'corporate') {
      h += dd('Товариство (обʼєкт — частка в статутному капіталі)', a.company_code ? '<a href="#/company/' + esc(a.company_code) + '">' + esc(det.company_name || a.company_code) + '</a> <span class="mono mini">ЄДРПОУ ' + esc(a.company_code) + '</span>' : esc(det.foreign_company || det.company_name || '—') + (det.foreign_country ? ' <span class="tag t-unk">нерезидент · ' + esc(det.foreign_country) + (det.foreign_reg ? ' · рег. № ' + esc(det.foreign_reg) : '') + '</span>' : ''), true);
      var fo = A.founderOf ? A.founderOf(a) : ''; if (fo) h += dd('Засновник / власник частки', det.founder_code ? '<a href="#/company/' + esc(det.founder_code) + '">' + esc(fo) + '</a>' : esc(fo), true);
      if (det.code_fix) h += dd('Виправлення коду', '<span class="mini">' + esc(det.code_fix) + '</span>', true);
      if (det.company_code_registry) h += dd('Код у Реєстрі (до звірки)', det.company_code_registry);
      if (det.corp_dup) h += dd('Звірка', '<span class="tag t-lost">' + esc(det.dup_note || 'Дубль — не враховується') + '</span>', true);
      else if (det.corp_unverified) h += dd('Звірка', '<span class="tag t-unk" title="Запису немає у вивіреному переліку аналітики корпоративних прав; частку визначено з опису">частку не звірено</span>', true);
    }
    if (a.category === 'realestate') h += dd('Тип нерухомості (для аналітики)', A.reType(a));
    if (a.category === 'land' && det.area_calc_ha) h += dd('Площа за контуром, га', A.num(det.area_calc_ha, 4));
    if (a.category === 'crypto') { var r = A.indexes.rate[det.token]; if (r && det.units) h += dd('Вартість за поточним курсом', '<b>' + A.money(Number(det.units) * r.uah) + '</b> <span class="mini">1 ' + esc(det.token) + ' = ' + A.num(r.uah, 2) + ' ₴ · ' + esc(r.fetched_at || '') + '</span>', true); }
    if (a.category === 'money') h += dd('Сума в гривневому еквіваленті', A.money(A.moneyUAH(a), true));
    return h;
  }
  function decTimeline(a) {
    var rows = A.decisionsOf(a.id), canE = A.can('edit_decisions');
    if (!rows.length) return '<div class="empty">Рішень щодо активу не зафіксовано.</div>';
    return '<ul class="timeline">' + rows.map(function (x) {
      var e = x.effect || N.DECEFF[x.dtype];
      return '<li class="e-' + esc(e) + '"><div class="date">' + A.dt(x.decision_date) + (x.effective_date ? ' · набрало сили ' + A.dt(x.effective_date) : '') + '</div>' +
        '<div class="what"><a href="#/decision/' + x.id + '">' + esc(N.DEC[x.dtype] || x.dtype) + '</a></div>' +
        '<div class="meta">' + esc([x.court, x.case_no && 'справа ' + x.case_no, x.proceeding_no && 'пров. ' + x.proceeding_no, A.can('view_internal') && x.erdr_no && 'ЄРДР ' + x.erdr_no].filter(Boolean).join(' · ')) + '</div>' +
        '<div class="meta">' + esc([N.EFF[e], x.arrest_scope && N.SCOPE[x.arrest_scope], x.execution].filter(Boolean).join(' · ')) + '</div>' + (x.summary ? '<div class="meta">' + A.clip(x.summary, 300) + '</div>' : '') +
        (canE ? '<div class="actions-inline" style="margin-top:4px"><a class="btn sm" href="' + A.link('/decision/' + x.id + '/edit', {back: '/asset/' + a.id}) + '">Редагувати</a><button class="btn sm plain" data-click="dec-unlink" data-id="' + x.link_id + '" data-aid="' + a.id + '" data-confirm="Відв’язати рішення від цього активу? Саме рішення залишиться в реєстрі.">Відв’язати від активу</button>' +
          (A.can('delete_records') ? '<button class="btn sm danger" data-click="dec-del" data-id="' + x.id + '" data-confirm="Видалити судове рішення повністю (для всіх пов’язаних активів)?">Видалити</button>' : '') + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  A.CLICK['dec-unlink'] = function (t) { var tx = A.tx(), aid = +t.dataset.aid; tx.del('decision_assets', +t.dataset.id); tx.log('Рішення відв’язано від активу', 'asset', aid);
    return tx.commit().then(function () { return A.recalcLegal([aid]); }).then(function () { A.toast('Рішення відв’язано, правовий стан перераховано'); A.route(true); }); };
  A.CLICK['dec-del'] = function (t) { var id = +t.dataset.id, ids = (A.indexes.assetsByDec[id] || []).map(function (l) { return l.asset_id; }), tx = A.tx(); tx.del('decisions', id); tx.log('Видалено судове рішення', 'decision', id);
    return tx.commit().then(function () { return A.recalcLegal(ids); }).then(function () { A.toast('Рішення видалено'); if (/^#\/decision\//.test(location.hash)) A.go('#/decisions'); else A.route(true); }); };
  A.valRows = function (tt, tid, aid) {
    var vs = A.T('valuations').filter(function (v) { return v.target_type === tt && v.target_id === tid; });
    if (aid) (A.indexes.vaByAsset[aid] || []).forEach(function (l) { var v = A.get('valuations', l.valuation_id); if (v && vs.indexOf(v) < 0) vs.push(v); });
    return vs.sort(function (a, b) { return (b.value_date || b.procurement_date || '').localeCompare(a.value_date || a.procurement_date || ''); });
  };
  A.valTable = function (vs, ro) {
    if (!vs.length) return '<div class="empty">Оцінок немає.</div>';
    return '<div class="wrap-tbl"><table><thead><tr><th>Дата, станом на яку оцінено</th><th class="num">Вартість без ПДВ</th><th>Лист про звіт / суб’єкт оцінки</th><th>Закупівля</th><th>Статус</th><th></th></tr></thead><tbody>' + vs.map(function (v) {
      var st = A.valState(v.value_date);
      return '<tr><td>' + A.dt(v.value_date) + (st === 'expired' ? '<span class="sub overdue">понад 6 міс.</span>' : st === 'valid' ? '<span class="sub" style="color:var(--ok)">чинна</span>' : '') + '</td><td class="num">' + (v.value_uah ? A.money(v.value_uah, true) : '—') + '</td>' +
        '<td class="mini">' + esc(v.report_no || '—') + ((v.valuer_entity || v.appraiser) ? '<br>' + esc(v.valuer_entity || v.appraiser) : '') + '</td><td class="mini">' + esc(v.procurement_id || '') + (v.lot_no ? ' · лот ' + esc(v.lot_no) : '') + (v.winner ? '<br>' + esc(v.winner) : '') + '</td>' +
        '<td class="mini">' + esc(v.status || '—') + (v.is_current ? ' <span class="tag t-ok">актуальна</span>' : '') + (v.target_type === 'group' ? '<br><span class="tag t-lim">групова: ' + (v.assets_count || (A.indexes.vaByVal[v.id] || []).length) + ' акт.</span>' : '') + '</td>' +
        '<td class="nowrap"><a class="btn sm plain" href="#/valuation/' + v.id + '">Відкрити</a>' + (A.can('edit_valuations') && ro !== true ? ' <a class="btn sm" href="#/valuation/' + v.id + '/edit">Редагувати</a>' : '') +
        ((A.can('delete_records') || A.can('edit_valuations')) && ro !== true ? ' <button class="btn sm danger" data-click="val-del" data-id="' + v.id + '" data-confirm="Видалити оцінку?">×</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  };
  A.CLICK['val-del'] = function (t) { var v = A.get('valuations', +t.dataset.id), tx = A.tx(); tx.del('valuations', v.id); tx.log('Видалено оцінку', 'valuation', v.id);
    return tx.commit().then(function () { return A.refreshValCache(v.target_type, v.target_id); }).then(function () { A.toast('Оцінку видалено'); if (/^#\/valuation\//.test(location.hash)) A.go('#/valuations'); else A.route(true); }); };

  A.on(/^\/asset\/(\d+)$/, function (id) {
    var a = A.get('assets', +id); if (!a) return A.notFound(); if (!A.inScope(a)) return A.deny();
    A.loadMedia().then(function () { if (!document.querySelector('[data-gallery] img') && A.mode === 'static' && A.filesOf('asset', a.id).length && !A._mediaShown) { A._mediaShown = 1; A.route(true); } });
    var fin = A.isFin(a), red = a.zone === 'Червона зона', edM = A.canEdit(a, 'main'), edS = A.canEdit(a, 'screening'), pool = a.pool_id && A.get('pools', a.pool_id);
    var comp = a.company_code && A.indexes.comp[a.company_code], det = a.details || {};
    if (A.mode === 'server') A.audit('Перегляд картки активу', 'asset', a.id);
    var act = (edM || edS || A.can('manage_public') || A.can('edit_legal') ? '<a class="btn gold" href="#/asset/' + a.id + '/edit">Редагувати</a>' : '') +
      (A.can('edit_decisions') ? '<a class="btn" href="' + A.link('/decision/new', {asset: a.id}) + '">+ Судове рішення</a>' : '') +
      (A.can('edit_valuations') && !pool && !red ? '<a class="btn" href="' + A.link('/valuation/new', {tt: 'asset', tid: a.id}) + '">+ Оцінка</a>' : '') +
      '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = '';
    if (pool) h += '<div class="banner">Актив входить до пулу <a href="#/pool/' + pool.id + '"><b>' + esc(pool.code) + '</b> — ' + esc(pool.name || '') + '</a>. Оцінка, план дій та план управління ведуться в картці пулу. <a class="btn sm gold" href="#/pool/' + pool.id + '">До картки пулу →</a></div>';
    if (A.mgmtLinks) h += A.mgmtLinks('asset', a);
    if (a.legal_note) h += '<div class="flash info">' + esc(a.legal_note) + '</div>';
    if (a.needs_review) h += '<div class="flash info">Дані щодо можливості ефективного управління визначено автоматично з інвентаризації — потребують перевірки менеджером ДМА.</div>';
    var tabs = [['t-ov', 'Огляд']].concat(fin ? [] : [['t-sc', 'Скринінг МТУ']]).concat([['t-mg', 'Ефективне управління'], ['t-lg', 'Правовий стан і рішення <span class="pill">' + (a.decisions_count || 0) + '</span>'], ['t-vl', 'Оцінки'], ['t-pl', 'План дій'], ['t-dc', 'Документи <span class="pill">' + (a.doc_count || 0) + '</span>']])
      .concat(fin ? [] : [['t-ph', 'Фото <span class="pill">' + (a.photo_count || 0) + '</span>']]).concat((A.can('manage_public') || edM) && !fin ? [['t-pb', 'Публікація і досьє']] : []);
    h += '<div class="card-grid"><div><div class="tabs" data-tabbar="card">' + tabs.map(function (t) { return '<a href="#" data-tab="' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div>';
    // ---- огляд
    h += '<div class="tabpane" id="t-ov" data-group="card"><div class="panel"><h3>Загальні відомості</h3><dl class="kv">' +
      dd('№ активу в Реєстрі', '<span class="mono">' + esc(a.asset_no) + '</span> ' + A.zone(a.zone), true) + dd('Найменування', a.name) +
      dd('Категорія', esc(N.CAT[a.category] || '—') + (a.vid ? ' · <span class="mini">' + esc(a.vid) + '</span>' : ''), true) +
      dd(A.KIND_LABEL, esc(N.KIND[a.report_kind] || '—') + A.q(A.KIND_HINT), true) + dd('Складність', N.CX[a.complexity]) +
      dd('Стан активу', esc(a.proposal || '—') + A.confirmBadge(a), true) +
      (a.owner_name || a.owner_code ? dd('Власник / боржник', esc(a.owner_name || '') + (a.owner_code && A.can('view_internal') ? ' <span class="mono mini">' + esc(a.owner_code) + '</span>' : ''), true) : '') +
      (a.company_code ? dd('Товариство', '<a href="#/company/' + esc(a.company_code) + '">' + esc((comp && comp.name) || det.company_name || a.company_code) + '</a> <span class="mono mini">' + esc(a.company_code) + '</span>', true) : '') +
      dd('Вартість за Реєстром', a.value_registry ? A.money(a.value_registry, true) + (a.currency && a.currency !== 'UAH' ? ' (' + esc(a.currency) + ')' : '') : '—', true) +
      dd('Критерій критичності', A.critLabel(a.crit) + (a.publish ? ' <span class="tag t-gold">опубліковано</span>' : ''), true) +
      (fin ? '' : dd('Адреса', A.fullAddress(a) || a.address_raw || '—')) + (a.cadastral ? dd('Кадастровий номер', '<span class="mono">' + esc(a.cadastral) + '</span>', true) : '') +
      (!fin && a.lat && a.lon ? dd('Координати', '<span class="mono">' + A.num(a.lat, 5) + ', ' + A.num(a.lon, 5) + '</span>' + (a.coords_checked ? ' <span class="tag t-ok">перевірено</span>' : '') + ' <a href="https://www.openstreetmap.org/?mlat=' + a.lat + '&mlon=' + a.lon + '#map=16/' + a.lat + '/' + a.lon + '" target="_blank" rel="noopener">на карті</a>', true) : '') +
      (a.prozorro_id || a.prozorro_url ? dd('Prozorro.Продажі', A.prozorroBtn(a), true) : '') + '</dl></div>';
    var dl = detailsList(a);
    if ((a.category === 'land' || a.category === 'realestate') && (a.lat || (a.details || {}).geometry)) h += '<div class="panel" style="margin-top:12px"><h3>' + (a.category === 'land' ? 'Ділянка' : 'Об’єкт') + ' на карті <span>' + ((a.details || {}).geometry ? 'контур ' + ((a.details || {}).geometry_src === 'manual' ? 'внесено вручну' : 'з бази контурів') + ((a.details || {}).area_calc_ha ? ' · ' + A.num(a.details.area_calc_ha, 4) + ' га за контуром' : '') : (a.category === 'land' ? 'лише точка — внесіть GeoJSON контуру в «Редагувати → Адреса і координати»' : 'точка за координатами' + (a.coords_checked ? ' · перевірено' : ''))) + '</span></h3><div data-amap="' + a.id + '" style="height:460px"></div></div>';
    if (dl) h += '<div class="panel" style="margin-top:12px"><h3>Характеристики — ' + esc(N.CAT[a.category] || '') + '</h3><dl class="kv">' + dl + '</dl></div>';
    if (a.public_phone || a.public_email || a.public_dept) h += '<div class="panel" style="margin-top:12px"><h3>Контакти для публічного сайту</h3><dl class="kv">' + dd('Підрозділ', a.public_dept) + dd('Телефон', a.public_phone) + dd('E-mail', a.public_email) + '</dl></div>';
    h += '<div class="panel" style="margin-top:12px"><h3>Дані інвентаризації <span>первинне джерело, лише для читання</span></h3><dl class="kv">' + dd('Статус інвентаризації', a.inv_status) + dd('Тип управління', a.mgmt_type_src) +
      dd('Правовий стан за інвентаризацією', N.LS[a.legal_src]) + dd('Рішення (текст)', a.decisions_src ? A.clip(a.decisions_src, 1200) : '', true) + dd('Арешт', a.arrest_src) + (a.mtu_src ? dd('МТУ за інвентаризацією', a.mtu_src) : '') + (a.dept_src ? dd('Відділ за інвентаризацією', a.dept_src) : '') + '</dl></div></div>';
    // ---- скринінг
    if (!fin) {
      h += '<div class="tabpane" id="t-sc" data-group="card"><div class="panel"><h3>Скринінг активу <span>' + esc(N.MTU[a.mtu_code] || 'МТУ не закріплено — доступно всім МТУ') + (a.screening_date ? ' · оновлено ' + A.dt(a.screening_date) : '') + '</span></h3><dl class="kv">' +
        dd('Виконавець МТУ', esc(a.mtu_manager || 'не призначено') + (a.mtu_manager_contact ? '<br><span class="mini">' + esc(a.mtu_manager_contact) + '</span>' : ''), true) + dd('Дата огляду', A.dt(a.inspect_date), true) + dd('Технічний стан', a.tech_state || a.phys_src || '—') + dd('Стан використання', a.usage_state || a.usage_src || '—') +
        dd('Ризик місцезнаходження', a.location_risk || '—') + dd('Висновок огляду', a.inspect_conclusion || a.conclusion_src || '—') + dd('Опис', a.description || '—') + dd('Ключові характеристики', a.key_features || '—') + '</dl></div>';
      h += A.custodyPanel(a) + '</div>';
    }
    // ---- управління
    h += '<div class="tabpane" id="t-mg" data-group="card"><div class="panel"><h3>Ефективне управління</h3><dl class="kv">' + dd('Можливість ефективного управління', N.POS[a.mgmt_possible] || '—') +
      (a.impossible_reason ? dd('Причина неможливості', '<span class="tag t-lost">' + esc(N.REASON[a.impossible_reason]) + '</span>' + (a.procedural_decision ? '<div class="mini" style="margin-top:4px">Яке рішення потрібне: ' + esc(a.procedural_decision) + '</div>' : ''), true) : '') +
      dd('Інвестиційна привабливість', A.invest(a.invest_grade), true) + dd('Спосіб передачі', N.WAY[a.transfer_way] || '—') + dd('Економічний потенціал', a.economic_potential ? '<div style="white-space:pre-wrap">' + esc(a.economic_potential) + '</div>' : '—', true) +
      dd('Збереження вартості', a.value_preserved || '—') + dd('Очікуваний дохід', (a.expected_income_month ? A.money(a.expected_income_month, true) : '—') + ' / міс. · ' + (a.expected_income_year ? A.money(a.expected_income_year, true) : '—') + ' / рік') + '</dl></div>' +
      '<div class="panel" style="margin-top:12px"><h3>Управитель / реалізація</h3><dl class="kv">' + dd('Управитель', esc(a.manager_name || '—') + (a.manager_code && A.can('view_internal') ? ' <span class="mono mini">' + esc(a.manager_code) + '</span>' : ''), true) +
      dd('Договір управління', (a.mgmt_contract || '—') + (a.mgmt_start ? ' · з ' + A.dt(a.mgmt_start) : '') + (a.mgmt_end ? ' до ' + A.dt(a.mgmt_end) : '')) + dd('Акт приймання-передачі', a.act_signed) +
      dd('Реалізація', [a.realization_measure, a.realization_id, a.realization_date && A.dt(a.realization_date), a.realization_sum && A.money(a.realization_sum, true)].filter(Boolean).join(' · ')) +
      dd('Конкурсний відбір', [a.tender_id, a.tender_date && A.dt(a.tender_date)].filter(Boolean).join(' · ')) + dd('Prozorro.Продажі', A.prozorroBtn(a), true) + dd('Стан коштів', a.money_state) + '</dl></div>' +
      (fin ? A.custodyPanel(a) : '') + '</div>';
    // ---- правовий стан
    var lc = A.legalCompute(a);
    h += '<div class="tabpane" id="t-lg" data-group="card"><div class="panel"><h3>Правовий стан <span>' + esc(D.LEGAL_BASIS[a.legal_basis] || '') + '</span></h3><div style="font-size:15px;margin:4px 0 8px">' + A.legal(a.legal_status, true) + '</div>' +
      '<dl class="kv">' + dd('За хронологією рішень', lc.legal_dec ? N.LS[lc.legal_dec] : 'рішень з правовими наслідками немає') + dd('За інвентаризацією', N.LS[a.legal_src] || '—') + dd('Останнє рішення', A.dt(a.last_decision_date), true) +
      (!a.legal_manual && lc.legal_dec && lc.legal_dec !== a.legal_status ? dd('Чому такий стан', 'За хронологією рішень — «' + esc(N.LS[lc.legal_dec]) + '», за інвентаризацією — «' + esc(N.LS[a.legal_src] || '—') + '». Джерела розходяться, тому встановлено більш обмежувальний стан «' + esc(N.LS[a.legal_status]) + '». Якщо інвентаризація застаріла — скоригуйте стан вручну нижче.', true) : '') +
      (a.legal_manual ? dd('Встановлено вручну', esc(N.LS[a.legal_manual]) + (a.legal_manual_by ? ' · ' + esc(a.legal_manual_by) : '') + (a.legal_manual_at ? ' · ' + A.dt(a.legal_manual_at) : '') + (a.legal_manual_note ? '<div class="mini">' + esc(a.legal_manual_note) + '</div>' : ''), true) : '') + '</dl>' +
      (A.can('edit_legal') ? '<form class="filters" data-act="legal-manual" data-id="' + a.id + '" style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><b style="width:100%">Скоригувати правовий стан</b>' +
        A.sel('legal_manual', A.OPT.LEGAL, a.legal_manual, 'Автоматично (за рішеннями та інвентаризацією)') + '<input name="note" value="' + esc(a.legal_manual_note || '') + '" placeholder="Підстава коригування (обов’язково при ручному стані)" style="flex:1;min-width:260px"><button class="btn gold">Зберегти</button></form>' : '') + '</div>' +
      '<div class="panel" style="margin-top:12px"><h3>Хронологія судових рішень <span>від найдавнішого до останнього</span></h3>' + decTimeline(a) + (A.can('edit_decisions') ? '<p><a class="btn" href="' + A.link('/decision/new', {asset: a.id}) + '">+ Додати судове рішення</a></p>' : '') + '</div></div>';
    // ---- оцінки
    var redMsg = function (what) { return '<div class="flash info">Актив у Червоній зоні — ' + what + ' неактивний(-і). Після зміни стану активу (і зони) розділ стане доступним; переглядати наявні дані можна.</div>'; };
    h += '<div class="tabpane" id="t-vl" data-group="card">' + (red ? redMsg('розділ «Оцінки»') : '') + (pool ? '<div class="flash info">Оцінка ведеться на рівні пулу ' + esc(pool.code) + '.</div>' : '') + '<div class="panel' + (red ? ' is-off' : '') + '"><h3>Оцінки та закупівлі послуг з оцінки</h3>' + A.valTable(A.valRows(pool ? 'pool' : 'asset', pool ? pool.id : a.id, a.id), red) +
      (A.can('edit_valuations') && !red ? '<p><a class="btn" href="' + A.link('/valuation/new', pool ? {tt: 'pool', tid: pool.id} : {tt: 'asset', tid: a.id}) + '">+ Нова оцінка</a></p>' : '') + '</div></div>';
    // ---- план дій
    h += '<div class="tabpane" id="t-pl" data-group="card">' + (red ? redMsg('план дій') + '<div class="is-off">' + A.planBlock(pool ? 'pool' : 'asset', pool ? pool.id : a.id, false, a.dept_code) + '</div>' : pool ? '<div class="flash info">План дій ведеться на рівні пулу ' + esc(pool.code) + ' — нижче показано план пулу.</div>' + A.planBlock('pool', pool.id, false, pool.dept_code) : A.planBlock('asset', a.id, edM || edS, a.dept_code)) + '</div>';
    // ---- документи
    var types = fin ? ['court_scan', 'registry_extract', 'valuation_report', 'mgmt_contract', 'ident_conclusion', 'other'] : ['inspection_act', 'mgmt_plan', 'tech_passport', 'land_docs', 'registry_extract', 'valuation_report', 'mgmt_contract', 'lease_contract', 'storage_contract', 'court_scan', 'ident_conclusion', 'other'];
    h += '<div class="tabpane" id="t-dc" data-group="card">' + (red ? redMsg('завантаження документів') : '') + A.docsBlock('asset', a.id, (edM || edS) && !red, types) + (pool ? '<div style="margin-top:12px">' + A.docsBlock('pool', pool.id, false, null, 'Документи пулу ' + pool.code) + '</div>' : '') + '</div>';
    // ---- фото
    if (!fin) h += '<div class="tabpane" id="t-ph" data-group="card">' + A.photosBlock('asset', a.id, edM || edS, red ? 'Актив у Червоній зоні — додавання фото вимкнено. Після зміни стану активу (і зони) завантаження стане доступним.' : null) + '</div>';
    // ---- публікація
    if ((A.can('manage_public') || edM) && !fin) {
      h += '<div class="tabpane" id="t-pb" data-group="card"><div class="panel"><h3>Публікація на сайті</h3><p class="mini">' + (a.zone === 'Червона зона' ? 'Актив у Червоній зоні — публікація на сайті недоступна до зміни стану активу (як і завантаження фото та документів).' : a.public_candidate ? 'Актив публічний за критерієм критичності.' : 'Актив не є публічним за критерієм критичності — публікація недоступна.') + (pool && pool.publish ? ' Актив публікується у складі пулу ' + esc(pool.code) + '.' : '') + '</p><dl class="kv">' +
        dd('Стан', a.publish ? '<span class="tag t-gold">опубліковано</span>' : 'не опубліковано', true) + dd('Заголовок', a.public_title || a.name) + dd('Опис', a.public_description) + dd('Переглядів на сайті', A.num(a.public_views || 0)) + '</dl>' +
        (a.public_candidate && A.can('manage_public') && (a.zone !== 'Червона зона' || a.publish) ? '<p><button class="btn ' + (a.publish ? 'plain' : 'gold') + '" data-click="publish" data-id="' + a.id + '" data-v="' + (a.publish ? 0 : 1) + '">' + (a.publish ? 'Зняти з публікації' : 'Опублікувати') + '</button> <a class="btn plain" href="#/asset/' + a.id + '/edit">Редагувати текст і контакти</a></p>' : '') +
        (!A.can('manage_public') && edM ? '<p><a class="btn plain" href="#/asset/' + a.id + '/edit">Заповнити відомості для сайту</a></p>' : '') + A.pubReqBlock('asset', a, edM && a.public_candidate && a.zone !== 'Червона зона' && !pool) + '</div>' +
        (pool ? '<p class="mini">Досьє ведеться в картці пулу.</p>' : A.dossierBlock('asset', a, edM || A.can('manage_public'))) + '</div>';
    }
    h += '</div><aside class="side">' + A.sidePanels(a, pool) + '</aside></div>';
    A.render(A.shell(a.asset_no + ' · ' + (a.name || ''), (N.CAT[a.category] || '') + (a.region ? ' · ' + a.region : ''), act, h), A.keep);
  });
  A.custodyPanel = function (a) {
    if (A.CUSTODY.indexOf(a.category) < 0 && !a.custodian_name) return '';
    return '<div class="panel" style="margin-top:12px"><h3>Зберігач і зберігання</h3><dl class="kv">' + dd('Зберігач', esc(a.custodian_name || '—') + (a.custodian_code && A.can('view_internal') ? ' <span class="mono mini">' + esc(a.custodian_code) + '</span>' : ''), true) +
      dd('Договір зберігання', (a.storage_contract_no || '—') + (a.storage_contract_date ? ' від ' + A.dt(a.storage_contract_date) : '') + (a.storage_until ? ' · до ' + A.dt(a.storage_until) : '')) +
      dd('Вартість зберігання / міс.', a.storage_cost_month ? A.money(a.storage_cost_month, true) : '—') + dd('Місце зберігання', a.storage_place || '—') + dd('Вид зберігання', a.storage_kind) + '</dl></div>';
  };
  A.sidePanels = function (a, pool) {
    var edM = A.canEdit(a, 'main'), st = A.OPT.STATUS.slice(); if (a.proposal && st.indexOf(a.proposal) < 0) st.unshift(a.proposal);
    var h = '<div class="panel"><h3>Зона і стан активу</h3><div style="margin-bottom:6px">' + (a.zone ? A.zone(a.zone).replace('class="z ', 'class="z zone-big ') : '—') + (a.zone_manual ? ' <span class="mini" title="Зону встановлено вручну">вручну</span>' : '') + '</div><div class="mini">' + esc(a.proposal || 'Стан не вказано') + '</div>';
    if (edM) h += '<form data-act="status" data-id="' + a.id + '" style="margin-top:8px">' + A.sel('proposal', st, a.proposal, '— стан активу —') + '<div style="display:flex;gap:6px;margin-top:6px">' + A.sel('zone', D.ZONES, a.zone_manual ? a.zone : '', 'Зона — автоматично за станом') + '<button class="btn sm gold">OK</button></div><div class="mini" style="margin-top:4px">Зона змінюється автоматично за станом; оберіть зону вручну лише у виняткових випадках.</div></form>';
    h += '</div><div class="panel"><h3>Правовий стан</h3><div style="font-size:15px;margin:4px 0 8px">' + A.legal(a.legal_status) + '</div><div class="mini">' + esc(D.LEGAL_BASIS[a.legal_basis] || '') + '</div><div class="mini">Рішень: ' + (a.decisions_count || 0) + (a.last_decision_date ? ' · останнє ' + A.dt(a.last_decision_date) : '') + '</div><div class="mini">За інвентаризацією: ' + esc(N.LS[a.legal_src] || '—') + '</div></div>';
    if (!A.isFin(a)) h += '<div class="panel"><h3>Відповідальний МТУ <span>скринінг</span></h3><div><b>' + esc(N.MTU[a.mtu_code] || 'Не закріплено') + '</b></div><div class="mini">' + esc(a.mtu_manager || 'Виконавця не призначено') + (a.mtu_manager_contact ? '<br>' + esc(a.mtu_manager_contact) : '') + (!a.mtu_code ? '<br>Не закріплений актив бачать і можуть опрацювати всі МТУ.' : '') + '</div></div>';
    h += '<div class="panel"><h3>Відділ ДМА і менеджер-куратор</h3><div><b>' + esc(N.DMA[a.dept_code] || 'Не закріплено') + '</b></div><div class="mini">' + esc(a.dma_manager || 'Менеджера не призначено') + (a.dma_manager_contact ? '<br>' + esc(a.dma_manager_contact) : '') + (!a.dept_code ? '<br>Не закріплений актив бачать усі відділи ДМА.' : '') + '</div></div>';
    var src = pool || a, grp = !pool && !a.val_amount && (A.indexes.vaByAsset[a.id] || []).map(function (l) { return A.get('valuations', l.valuation_id); }).filter(function (v) { return v && v.is_current; })[0];
    h += '<div class="panel kpi"><h3>Актуальна оцінка</h3>' + (grp ? '<div class="v" style="font-size:20px">' + A.money(grp.value_uah) + '</div><div class="d">групова оцінка на ' + (grp.assets_count || '') + ' активів · ' + A.dt(grp.value_date) + ' · <a href="#/valuation/' + grp.id + '">деталі</a></div>'
      : '<div class="v" style="font-size:20px">' + (src.val_amount ? A.money(src.val_amount) : '—') + '</div><div class="d">' + (src.val_date ? 'станом на ' + A.dt(src.val_date) + (A.valState(src.val_date) === 'expired' ? ' · <span class="overdue">понад 6 міс.</span>' : '') : 'оцінки немає') + (pool ? ' · оцінка пулу' : '') + '</div>') + '</div>';
    if (A.CUSTODY.indexOf(a.category) >= 0) h += '<div class="panel"><h3>Зберігач</h3><div><b>' + esc(a.custodian_name || 'Не визначено') + '</b></div><div class="mini">' + (a.storage_contract_no ? 'Договір ' + esc(a.storage_contract_no) + (a.storage_until ? ' до ' + A.dt(a.storage_until) : '') : 'договір зберігання не внесено') + '</div></div>';
    if (a.prozorro_id || a.prozorro_url) h += '<div class="panel"><h3>Prozorro.Продажі</h3>' + A.prozorroBtn(a) + '</div>';
    var c = A.completeness(a);
    h += '<div class="panel"><h3>Повнота картки</h3><div class="prog"><div style="width:' + c + '%"></div></div><div class="mini" style="margin-top:4px">' + c + '% обов’язкових полів заповнено</div></div>';
    h += '<div class="panel"><h3>Службове</h3><div class="mini">Оновлено: ' + esc(a.updated_at || a.created_at || '—') + (a.updated_by ? ' · ' + esc(a.updated_by) : '') + '</div>' + (a.source === 'manual' ? '<div class="mini">Заведено вручну</div>' : '') +
      (A.can('delete_records') ? '<button class="btn sm danger" style="margin-top:8px" data-click="asset-del" data-id="' + a.id + '" data-confirm="Видалити актив ' + esc(a.asset_no) + ' разом із зв’язками (рішення залишаться, зв’язки з активом — ні)? Дію не можна скасувати.">Видалити актив</button>' : '') + '</div>';
    return h;
  };
  A.ACT.status = function (f, d) {
    var a = A.get('assets', +f.dataset.id), z = d.zone || A.zoneForStatus(d.proposal) || a.zone, tx = A.tx();
    tx.put('assets', {id: a.id, proposal: d.proposal || null, zone: z, zone_manual: d.zone ? 1 : 0}, a.updated_at);
    tx.log('Змінено стан активу', 'asset', a.id, {proposal: d.proposal, zone: z});
    return tx.commit().then(function () { A.toast('Стан збережено. Зона: ' + z); A.route(true); });
  };
  A.ACT['legal-manual'] = function (f, d) {
    var a = A.get('assets', +f.dataset.id), m = d.legal_manual || null;
    if (m && !(d.note || '').trim()) return A.toast('Вкажіть підставу ручного коригування', 'err');
    var p = Object.assign({id: a.id, legal_manual: m, legal_manual_note: m ? d.note : null, legal_manual_by: m ? S.user.login : null, legal_manual_at: m ? A.nowS() : null}, A.legalPatch(a, m));
    var tx = A.tx(); tx.put('assets', p, a.updated_at); tx.log(m ? 'Правовий стан скориговано вручну' : 'Скасовано ручний правовий стан', 'asset', a.id, {legal: m, note: d.note});
    return tx.commit().then(function () { A.toast('Правовий стан: ' + N.LS[p.legal_status]); A.route(true); });
  };
  // v2.7: запит менеджера ДМА до Управління комунікації на публікацію активу / пулу; рішення — в «Керування сайтом → Запити на публікацію»
  A.pubReqBlock = function (tt, o, canAsk) {
    var rs = A.T('pub_pubreq').filter(function (r) { return r.target_type === tt && r.target_id === o.id; }).sort(function (x, y) { return (y.requested_at || '').localeCompare(x.requested_at || ''); });
    var open = rs.filter(function (r) { return r.status === 'new'; })[0], ST = {new: 'на розгляді', published: 'опубліковано', rejected: 'відхилено', withdrawn: 'відкликано'};
    var h = rs.length ? '<div class="mini" style="margin-top:8px"><b>Запити на публікацію:</b>' + rs.slice(0, 5).map(function (r) { return '<div>' + esc(r.requested_at || '') + ' · ' + esc(r.requested_by || '') + ' · <span class="tag ' + (r.status === 'published' ? 't-ok' : r.status === 'rejected' ? 't-lost' : 't-lim') + '">' + ST[r.status] + '</span>' + (r.decision_note ? ' · ' + esc(r.decision_note) : '') + (r.message ? '<br><i>' + esc(r.message) + '</i>' : '') +
      (r.status === 'new' && A.can('manage_public') ? ' <button class="btn sm gold" data-click="pubreq-decide" data-id="' + r.id + '" data-v="published">Опублікувати</button><button class="btn sm plain" data-click="pubreq-decide" data-id="' + r.id + '" data-v="rejected">Відхилити</button>' : '') +
      (r.status === 'new' && S.user && r.requested_by === S.user.login ? ' <button class="btn sm plain" data-click="pubreq-decide" data-id="' + r.id + '" data-v="withdrawn">Відкликати</button>' : '') + '</div>'; }).join('') + '</div>' : '';
    if (canAsk && !o.publish && !open && !A.can('manage_public')) h += '<p><button class="btn gold" data-click="pubreq" data-tt="' + tt + '" data-id="' + o.id + '">📨 Запит на публікацію до Управління комунікації</button></p><p class="mini">Перед запитом заповніть заголовок, опис, контакти і досьє для сайту. Публікує Управління комунікації.</p>';
    return h;
  };
  A.CLICK.pubreq = function (t) {
    var msg = prompt('Коментар для Управління комунікації (необов’язково):', ''); if (msg === null) return;
    var o = A.get(t.dataset.tt === 'pool' ? 'pools' : 'assets', +t.dataset.id), tx = A.tx();
    tx.put('pub_pubreq', {id: A.tmpId(), target_type: t.dataset.tt, target_id: o.id, dept_code: o.dept_code || (S.user && S.user.dept_code) || null, message: msg || null, status: 'new', requested_by: S.user && S.user.login, requested_at: A.nowS(), created_at: A.nowS()});
    tx.log('Запит на публікацію на сайті', t.dataset.tt, o.id);
    return tx.commit().then(function () { A.toast('Запит надіслано до Управління комунікації'); A.route(true); });
  };
  A.CLICK['pubreq-decide'] = function (t) {
    var r = A.get('pub_pubreq', +t.dataset.id), v = t.dataset.v, note = v === 'rejected' ? prompt('Причина відхилення (бачить ініціатор):', '') : ''; if (note === null) return;
    var tx = A.tx(), tbl = r.target_type === 'pool' ? 'pools' : 'assets', o = A.get(tbl, r.target_id);
    if (v === 'published' && o) { if (o.zone === 'Червона зона') return A.toast('Актив у Червоній зоні не публікується', 'err'); tx.put(tbl, {id: o.id, publish: 1}, tbl === 'assets' ? o.updated_at : undefined); }
    tx.put('pub_pubreq', {id: r.id, status: v, decided_by: S.user && S.user.login, decided_at: A.nowS(), decision_note: note || null, updated_at: A.nowS()});
    tx.log('Запит на публікацію: ' + v, r.target_type, r.target_id);
    return tx.commit().then(function () { A.toast({published: 'Опубліковано', rejected: 'Запит відхилено', withdrawn: 'Запит відкликано'}[v]); A.route(true); });
  };
  // v2.7: підтвердження статусу активу (інвентаризації) — для контролю актуалізації даних керівництвом ДМА
  A.confirmBadge = function (a) {
    var can = A.canEdit(a, 'main') || A.canEdit(a, 'screening');
    return (a.status_confirmed_at ? ' <span class="tag t-ok" title="' + esc('Підтвердив: ' + (a.status_confirmed_by || '') + ' · ' + a.status_confirmed_at) + '">✔ статус підтверджено ' + A.dt(a.status_confirmed_at.slice(0, 10)) + '</span>' : ' <span class="tag t-lim">статус не підтверджено</span>') +
      (can ? ' <button class="btn sm ' + (a.status_confirmed_at ? 'plain' : 'gold') + '" data-click="status-confirm" data-id="' + a.id + '" title="Підтвердити, що стан активу і зону звірено з інвентаризацією">' + (a.status_confirmed_at ? 'Підтвердити повторно' : 'Підтвердити статус') + '</button>' : '') +
      (a.zone_prev ? '<span class="sub">Попередня зона: ' + esc(a.zone_prev) + (a.zone_changed_at ? ' · змінено ' + A.dt(a.zone_changed_at.slice(0, 10)) : '') + '</span>' : '');
  };
  A.CLICK['status-confirm'] = function (t) {
    var ids = t.dataset.ids ? t.dataset.ids.split(',').map(Number) : [+t.dataset.id], tx = A.tx(), n = 0;
    if (ids.length > 1 && !confirm('Підтвердити статус для ' + ids.length + ' активів?')) return;
    ids.forEach(function (id) { var a = A.get('assets', id); if (a && (A.canEdit(a, 'main') || A.canEdit(a, 'screening'))) { tx.put('assets', {id: a.id, status_confirmed_at: A.nowS(), status_confirmed_by: S.user && S.user.login}, a.updated_at); n++; } });
    if (!n) return A.toast('Немає активів, статус яких ви можете підтвердити', 'err');
    tx.log('Підтверджено статус активу (інвентаризація)' + (n > 1 ? ': ' + n : ''), 'asset', ids.length === 1 ? ids[0] : '');
    return tx.commit().then(function () { A.toast('Статус підтверджено: ' + n); A.route(true); });
  };
  A.CLICK.publish = function (t) { var a = A.get('assets', +t.dataset.id), tx = A.tx(); tx.put('assets', {id: a.id, publish: +t.dataset.v}, a.updated_at); tx.log(+t.dataset.v ? 'Опубліковано на сайті' : 'Знято з публікації', 'asset', a.id); return tx.commit().then(function () { A.route(true); }); };
  A.CLICK['asset-del'] = function (t) { var id = +t.dataset.id, tx = A.tx(); tx.del('assets', id); tx.log('Видалено актив', 'asset', id); return tx.commit().then(function () { A.basket.toggle(id, false); A.toast('Актив видалено'); A.go('#/assets'); }); };

  // ================================================================ редагування та новий актив
  function v0(x) { return x === null || x === undefined ? '' : x; }
  function detField(f, det, canInternal) {
    var k = f[0], label = f[1], t = f[2], v = det[k], name = 'det_' + k, hidden = D.INTERNAL_DETAIL_KEYS.indexOf(k) >= 0 && !canInternal;
    if (Array.isArray(t)) { var o = t.slice(); if (v && o.indexOf(v) < 0) o.unshift(v); return A.fsel(label, name, o, v, f[3], f[4]); }
    var type = t === 'date' ? 'date' : t === 'num' || t === 'int' || t === 'year' ? 'text' : 'text';
    var attrs = t === 'vin' ? 'maxlength="17" style="text-transform:uppercase;font-family:IBM Plex Mono,monospace" pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" title="17 символів: латинські літери (крім I, O, Q) і цифри"' : t === 'int' || t === 'year' ? 'inputmode="numeric"' : t === 'num' ? 'inputmode="decimal"' : '';
    return A.field(label + (hidden ? ' (службово)' : ''), name, hidden ? '' : v, type, f[3], hidden && v ? 'Значення внесено і приховано; введіть нове, щоб замінити' : f[4], '', attrs + (hidden ? ' placeholder="приховано"' : ''));
  }
  A.assetForm = function (a, isNew) {
    var edM = isNew || A.canEdit(a, 'main'), edS = isNew || A.canEdit(a, 'screening'), pubC = A.can('manage_public'), pub = pubC || edM, fin = A.isFin(a), det = a.details || {};
    var u = S.user || {}, st = A.OPT.STATUS.slice(); if (a.proposal && st.indexOf(a.proposal) < 0) st.unshift(a.proposal);
    var mtuUsers = users(function (x) { return x.role_code === 'mtu' || x.mtu_code; }).filter(function (x) { return !a.mtu_code || x.mtu_code === a.mtu_code || x.id === a.mtu_manager_id; });
    var dmaUsers = users(function (x) { return x.dept_code; }).filter(function (x) { return !a.dept_code || x.dept_code === a.dept_code || x.id === a.dma_manager_id; });
    function fs(legend, on, body, note) { return '<fieldset' + (on ? '' : ' disabled title="Недостатньо прав для цього розділу"') + '><legend>' + esc(legend) + (on ? '' : ' · лише перегляд') + '</legend>' + (note ? '<p class="mini" style="margin-top:0">' + esc(note) + '</p>' : '') + '<div class="form-grid">' + body + '</div></fieldset>'; }
    var F = A.field, S2 = A.fsel, h = '<form data-act="asset-save" data-id="' + (a.id || '') + '" data-v="' + esc(a.updated_at || '') + '">';
    h += fs('Основні відомості', edM,
      (isNew ? F('№ активу в Реєстрі', 'asset_no', a.asset_no, 'text', 1, 'Присвоюється вручну за журналом Реєстру; має бути унікальним', '', 'autocomplete="off"') : '') +
      S2('Категорія', 'category', A.OPT.CAT, a.category, 1) + F('Найменування', 'name', a.name, 'textarea', 1, '', 'wide') + F('Вид (за Реєстром)', 'vid', a.vid) +
      S2(A.KIND_LABEL, 'report_kind', D.REPORT_KINDS, a.report_kind, 0, A.KIND_HINT) + S2('Складність', 'complexity', D.COMPLEXITY, a.complexity) +
      F('Власник / боржник', 'owner_name', a.owner_name) + F('Код власника (ЄДРПОУ / РНОКПП)', 'owner_code', A.can('view_internal') ? a.owner_code : '', 'text', 0, A.can('view_internal') ? '' : 'приховано') +
      F('ЄДРПОУ товариства (корпоративні права)', 'company_code', a.company_code) + F('Вартість за Реєстром', 'value_registry', a.value_registry, 'text', 0, '', '', 'inputmode="decimal"') + S2('Валюта', 'currency', ['UAH', 'USD', 'EUR', 'GBP', 'CHF'], a.currency || 'UAH') +
      F('Критерій критичності', 'crit', a.crit === '#N/A' ? '' : a.crit, 'text', 0, 'Порожньо — актив публічний') +
      S2('Стан активу (зона — автоматично)', 'proposal', st, a.proposal, 0, '', 'wide') + S2('Зона (вручну, у виняткових випадках)', 'zone_manual_v', D.ZONES, a.zone_manual ? a.zone : '', 0, 'Порожньо — за станом активу', '', '', 'Автоматично за станом'));
    h += fs('Закріплення', edM,
      S2('МТУ (скринінг)', 'mtu_code', A.OPT.MTU, a.mtu_code, 0, fin ? 'Фінансові активи на скринінг МТУ не передаються' : 'Не закріплений актив бачать усі МТУ', '', '', 'Не закріплено') +
      S2('Відділ ДМА', 'dept_code', A.OPT.DEPT, a.dept_code, 0, 'Не закріплений актив бачать усі відділи ДМА', '', '', 'Не закріплено') +
      S2('Менеджер-куратор ДМА', 'dma_manager_id', dmaUsers.map(function (x) { return [x.id, x.full_name + ' — ' + (N.DMA_SHORT[x.dept_code] || '')]; }), a.dma_manager_id, 0, 'зі списку зареєстрованих користувачів ДМА') +
      F('Контакти менеджера ДМА', 'dma_manager_contact', a.dma_manager_contact));
    if (!fin) {
      h += fs('Скринінг МТУ', edS,
        S2('Виконавець МТУ', 'mtu_manager_id', mtuUsers.map(function (x) { return [x.id, x.full_name + ' — ' + (N.MTU[x.mtu_code] || '')]; }), a.mtu_manager_id, 0, 'зі списку зареєстрованих користувачів МТУ') + F('Контакти виконавця', 'mtu_manager_contact', a.mtu_manager_contact, 'text', 0, 'якщо порожньо — з облікового запису') +
        F('Дата огляду', 'inspect_date', a.inspect_date, 'date') + S2('Технічний стан', 'tech_state', D.TECH_STATE, a.tech_state) + S2('Стан використання', 'usage_state', D.USAGE_STATE, a.usage_state) + S2('Ризик місцезнаходження', 'location_risk', D.LOCATION_RISK, a.location_risk) +
        F('Висновок огляду', 'inspect_conclusion', a.inspect_conclusion, 'textarea', 0, '', 'wide') + F('Опис активу', 'description', a.description, 'textarea', 0, '', 'wide') + F('Ключові характеристики', 'key_features', a.key_features, 'textarea', 0, '', 'wide'),
        'Не закріплений за МТУ актив може опрацювати будь-яке МТУ' + (u.mtu_code && !a.mtu_code ? ' — після збереження його буде закріплено за вашим МТУ.' : '.'));
      h += fs('Адреса і координати', edS,
        S2('Область', 'region', D.REGIONS, a.region) + F('Район', 'district', a.district) + F('Громада', 'hromada', a.hromada) + S2('Тип населеного пункту', 'settl_type', D.SETTLEMENT_TYPES, a.settl_type) + F('Населений пункт', 'settl_name', a.settl_name) +
        S2('Тип вулиці', 'street_type', D.STREET_TYPES, a.street_type) + F('Вулиця', 'street_name', a.street_name) + F('Будинок', 'building', a.building) + F('Корпус', 'block', a.block) + F('Квартира / приміщення', 'unit', a.unit) + F('Індекс', 'postal', a.postal) +
        F('Кадастровий номер', 'cadastral', a.cadastral, 'text', 0, '0000000000:00:000:0000') + F('Широта', 'lat', a.lat, 'text', 0, '', '', 'inputmode="decimal"') + F('Довгота', 'lon', a.lon, 'text', 0, '', '', 'inputmode="decimal"') +
        S2('Координати перевірено', 'coords_checked', [['1', 'Так'], ['0', 'Ні']], a.coords_checked ? '1' : '0', 0, '', '', '', null) +
        (A.isFin(a) ? '' : '<div class="field"><label>&nbsp;</label><button type="button" class="btn" data-click="geocode" title="Визначити координати за адресою (OpenStreetMap Nominatim, запит із вашого браузера)">Координати за адресою</button><span class="hint">заповнить широту і довготу; перевірте точку на карті</span></div>') +
        (a.category === 'land' ? '<div class="field wide"><label>Контур ділянки (GeoJSON)</label><textarea name="geojson" rows="4" class="mono" style="font-size:12px" placeholder=\'{"type":"Polygon","coordinates":[[[30.52,50.45],[30.53,50.45],[30.53,50.46],[30.52,50.45]]]}\'>' + esc(det.geometry ? JSON.stringify(det.geometry) : '') + '</textarea>' +
          '<span class="hint">Polygon / MultiPolygon у WGS84 (довгота, широта) або Feature / FeatureCollection; можна <label class="linkish" style="cursor:pointer;text-decoration:underline">завантажити файл .geojson<input type="file" accept=".geojson,.json" data-geofile style="display:none"></label>. ' +
          (det.geometry ? 'Зараз: ' + (det.geometry_src === 'manual' ? 'внесено вручну' : 'з бази контурів (land.json)') + (det.area_calc_ha ? ', площа за контуром ' + A.num(det.area_calc_ha, 4) + ' га' : '') + '. Очистіть поле, щоб видалити контур.' : 'Контуру ще немає — його покаже карта після збереження.') + ' Контур, внесений вручну, не перезаписується імпортом.</span></div>' : ''));
    }
    var cf = D.CATEGORY_FIELDS[a.category] || [];
    if (cf.length) h += fs('Характеристики — ' + (N.CAT[a.category] || ''), fin ? edM : (edM || edS), cf.map(function (f) { return detField(f, det, A.can('view_internal')); }).join(''), a.category === 'transport' ? 'VIN-код — 17 символів (латинські літери, крім I, O, Q, та цифри).' : '');
    else if (isNew) h += '<p class="mini">Характеристики категорії (VIN, площа, частка тощо) з’являться після збереження — відкрийте «Редагувати».</p>';
    if (A.CUSTODY.indexOf(a.category) >= 0 || a.custodian_name) h += fs('Зберігач і зберігання', edM || edS,
      F('Зберігач (найменування)', 'custodian_name', a.custodian_name) + F('Код ЄДРПОУ зберігача', 'custodian_code', A.can('view_internal') ? a.custodian_code : '', 'text', 0, A.can('view_internal') ? '' : 'приховано') + F('№ договору зберігання', 'storage_contract_no', a.storage_contract_no) +
      F('Дата договору', 'storage_contract_date', a.storage_contract_date, 'date') + F('Діє до', 'storage_until', a.storage_until, 'date') + F('Вартість зберігання / міс., грн', 'storage_cost_month', a.storage_cost_month, 'text', 0, '', '', 'inputmode="decimal"') +
      F('Місце зберігання', 'storage_place', a.storage_place, 'text', 0, '', 'wide') + F('Вид зберігання', 'storage_kind', a.storage_kind));
    h += fs('Ефективне управління', edM,
      S2('Можливість ефективного управління', 'mgmt_possible', D.MGMT_POSSIBLE, a.mgmt_possible) + S2('Причина неможливості', 'impossible_reason', D.IMPOSSIBLE_REASONS, a.impossible_reason) + S2('Інвестиційна привабливість', 'invest_grade', D.INVEST_GRADES, a.invest_grade) +
      F('Яке процесуальне рішення потрібне', 'procedural_decision', a.procedural_decision, 'text', 0, '', 'wide') + S2('Спосіб передачі', 'transfer_way', D.TRANSFER_WAYS, a.transfer_way) +
      F('Очікуваний дохід / міс., грн', 'expected_income_month', a.expected_income_month, 'text', 0, '', '', 'inputmode="decimal"') + F('Очікуваний дохід / рік, грн', 'expected_income_year', a.expected_income_year, 'text', 0, '', '', 'inputmode="decimal"') +
      F('Економічний потенціал', 'economic_potential', a.economic_potential, 'textarea', 0, 'Опишіть можливі способи використання, ринок, потенційних управителів, ризики', 'wide big') + F('Збереження вартості', 'value_preserved', a.value_preserved, 'textarea', 0, '', 'wide') +
      S2('Потребує перевірки менеджером', 'needs_review', [['1', 'Так'], ['0', 'Ні — перевірено']], a.needs_review ? '1' : '0', 0, '', '', '', null));
    h += fs('Управитель, реалізація, Prozorro', edM,
      F('Управитель', 'manager_name', a.manager_name) + F('Код управителя', 'manager_code', A.can('view_internal') ? a.manager_code : '') + F('Договір управління', 'mgmt_contract', a.mgmt_contract) + F('Початок управління', 'mgmt_start', a.mgmt_start, 'date') + F('Закінчення', 'mgmt_end', a.mgmt_end, 'date') +
      F('Акт приймання-передачі', 'act_signed', a.act_signed) + F('Захід реалізації', 'realization_measure', a.realization_measure) + F('Ідентифікатор реалізації', 'realization_id', a.realization_id) + F('Дата реалізації', 'realization_date', a.realization_date, 'date') +
      F('Сума реалізації, грн', 'realization_sum', a.realization_sum, 'text', 0, '', '', 'inputmode="decimal"') + F('Ідентифікатор конкурсного відбору', 'tender_id', a.tender_id) + F('Дата відбору', 'tender_date', a.tender_date, 'date') +
      F('Ідентифікатор лоту Prozorro', 'prozorro_id', a.prozorro_id, 'text', 0, 'наприклад, LLE001-UA-20261011-12345') + F('Посилання на лот Prozorro', 'prozorro_url', a.prozorro_url, 'url', 0, 'якщо порожньо — сформується за ідентифікатором', 'wide'));
    if (!fin) h += fs('Публічний сайт', pub,
      F('Заголовок на сайті', 'public_title', a.public_title, 'text', 0, 'якщо порожньо — найменування', 'wide') + F('Опис на сайті', 'public_description', a.public_description, 'textarea', 0, 'без персональних даних і службових відомостей', 'wide') +
      F('Підрозділ для звернень', 'public_dept', a.public_dept, 'text', 0, 'напр., Відділ з організації та проведення конкурсних відборів') + F('Телефон для звернень', 'public_phone', a.public_phone) + F('E-mail для звернень', 'public_email', a.public_email, 'email') + F('Відео YouTube', 'video_urls', a.video_urls, 'textarea', 0, 'посилання на відео YouTube, кожне з нового рядка (до 5); на сайті вбудовуються у картку лота', 'wide') +
      (a.zone === 'Червона зона' ? '<div class="field mini">Червона зона: публікація недоступна до зміни стану активу.</div>' : !pubC ? '<div class="field mini">Публікує Управління комунікації — після заповнення надішліть «Запит на публікацію» у картці (вкладка «Публікація і досьє»).</div>' : a.public_candidate || isNew ? S2('Опублікувати', 'publish', [['0', 'Ні'], ['1', 'Так']], a.publish ? '1' : '0', 0, '', '', '', null) : '<div class="field mini">Публікація можлива лише для активів, публічних за критерієм критичності.</div>'));
    h += '<div class="form-actions"><a class="btn plain" href="' + (isNew ? '#/assets' : '#/asset/' + a.id) + '">Скасувати</a><button class="btn gold">' + (isNew ? 'Завести актив' : 'Зберегти зміни') + '</button></div></form>';
    return h;
  };
  A.on(/^\/asset\/(\d+)\/edit$/, function (id) {
    var a = A.get('assets', +id); if (!a) return A.notFound(); if (!A.inScope(a)) return A.deny();
    if (!(A.canEdit(a, 'main') || A.canEdit(a, 'screening') || A.can('manage_public'))) return A.deny();
    A.render(A.shell('Редагування · ' + a.asset_no, (a.name || ''), '<a class="btn plain" href="#/asset/' + a.id + '">Скасувати</a>', A.assetForm(a, false)));
  });
  A.on(/^\/asset\/new$/, function (f) {
    if (!A.can('create_assets') && !A.can('edit_any_asset')) return A.deny();
    var a = {category: f.category || 'realestate', currency: 'UAH', legal_src: 'unknown', invest_grade: 'unknown', mgmt_possible: 'unknown', transfer_way: 'none', dept_code: S.user && S.user.dept_code, details: {}};
    // етап 09 ідентифікації: картка активу заповнюється з запису ідентифікації, після збереження запис прив’язується, фото й документи переносяться
    var ir = f.ident && A.get('ident_records', +f.ident);
    if (ir && A.identPrefill) Object.assign(a, A.identPrefill(ir));
    var form = A.assetForm(a, true);
    if (ir) form = form.replace('data-act="asset-save"', 'data-act="asset-save" data-ident="' + ir.id + '"');
    A.render(A.shell('Новий актив', ir ? 'Внесення до Реєстру з ідентифікації (етап 09) · ' + (ir.asset_desc || '') : 'Заведення активу з присвоєнням номера в Реєстрі вручну', '<a class="btn plain" href="' + (ir ? '#/ident/' + ir.id : '#/assets') + '">Скасувати</a>', form));
  });
  var NUMF = ['value_registry', 'lat', 'lon', 'storage_cost_month', 'expected_income_month', 'expected_income_year', 'realization_sum'];
  var INTF = ['coords_checked', 'needs_review', 'publish', 'mtu_manager_id', 'dma_manager_id'];
  // GeoJSON контуру земельної ділянки (ручне внесення в картці)
  A.parseGeom = function (t) {
    var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Контур: текст не є коректним JSON'); }
    if (j && j.type === 'FeatureCollection') { var gs = (j.features || []).map(function (f) { return f && f.geometry; }).filter(function (g) { return g && /Polygon/.test(g.type); });
      if (!gs.length) throw new Error('Контур: у FeatureCollection немає полігонів'); j = gs.length === 1 ? gs[0] : {type: 'MultiPolygon', coordinates: gs.reduce(function (acc, g) { return acc.concat(g.type === 'Polygon' ? [g.coordinates] : g.coordinates); }, [])}; }
    else if (j && j.type === 'Feature') j = j.geometry;
    if (!j || (j.type !== 'Polygon' && j.type !== 'MultiPolygon') || !Array.isArray(j.coordinates)) throw new Error('Контур: потрібен Polygon або MultiPolygon');
    var bad = false; (j.type === 'Polygon' ? [j.coordinates] : j.coordinates).forEach(function (pl) { pl.forEach(function (r) { r.forEach(function (pt) { if (!(pt[0] > 20 && pt[0] < 42 && pt[1] > 43 && pt[1] < 53)) bad = true; }); }); });
    if (bad) throw new Error('Контур: координати поза межами України або переплутано порядок (потрібно [довгота, широта] у WGS84)');
    return {type: j.type, coordinates: j.coordinates};
  };
  A.geomCenter = function (g) { var pts = []; (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach(function (pl) { pts = pts.concat(pl[0]); }); if (!pts.length) return null;
    return [Math.round(pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length * 1e6) / 1e6, Math.round(pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length * 1e6) / 1e6]; };
  A.geomArea = function (g) { var tot = 0; (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach(function (pl) { var ring = pl[0], lat0 = ring.reduce(function (s, p) { return s + p[1]; }, 0) / ring.length, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540, ar = 0;
    for (var i = 0; i < ring.length; i++) { var p = ring[i], q = ring[(i + 1) % ring.length]; ar += p[0] * kx * q[1] * ky - q[0] * kx * p[1] * ky; } tot += Math.abs(ar / 2) / 10000; }); return Math.round(tot * 10000) / 10000; };
  A.afterRender.push(function (root) {
    var fi = root.querySelector('[data-geofile]'); if (fi && !fi.dataset.done) { fi.dataset.done = 1; fi.addEventListener('change', function () { var file = fi.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function () { var ta = root.querySelector('textarea[name=geojson]'); try { ta.value = JSON.stringify(A.parseGeom(rd.result)); A.toast('Контур завантажено — збережіть картку'); } catch (e) { A.toast(e.message, 'err'); } }; rd.readAsText(file); }); }
    var el = root.querySelector('[data-amap]'); if (!el || el.dataset.done || !window.ArmaMap) return; el.dataset.done = 1;
    var a = A.get('assets', +el.dataset.amap); if (!a) return; var g = (a.details || {}).geometry, polys = [], pts = [];
    if (g && g.coordinates) (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach(function (pl) { polys.push({rings: pl, color: '#FF8A00', fill: '33', stroke: '#FFB000', width: 3, id: a.id, label: (a.cadastral || a.asset_no) + ((a.details || {}).area_calc_ha ? ' · ' + A.num(a.details.area_calc_ha, 4) + ' га' : '')}); });
    if (a.lat && a.lon) pts.push({lat: a.lat, lon: a.lon, color: '#FF8A00', id: a.id, label: a.cadastral || a.asset_no, hasPoly: !!g});
    var m = new window.ArmaMap(el, {base: 'sat', carto: {key: S.settings.public_map_carto_key, style: S.settings.public_map_carto_style}, tiles: S.settings.map_tiles, cadastre: S.settings.map_cadastre, cadastreOn: true}); m.setData(pts, polys);
    // контур ділянки — цілком на весь розмір карти (як на Публічній кадастровій карті); ⤢ — повернутися до ділянки
    m.fitPoints(true);
  });
  // визначення координат за адресою (Nominatim / OpenStreetMap) — точність карти покращується одразу після збереження
  A.CLICK.geocode = function (t) {
    var fm = t.closest('form'), v = function (n) { var x = fm.querySelector('[name="' + n + '"]'); return x ? x.value.trim() : ''; };
    var reg = v('region'), parts = [[v('street_type') && v('street_type') !== '—' ? v('street_type') : '', v('street_name'), v('building')].filter(Boolean).join(' '), [v('settl_type'), v('settl_name')].filter(Boolean).join(' '), v('hromada') ? v('hromada') + ' громада' : '', v('district') ? v('district') + ' район' : '', reg && reg.indexOf('м. ') !== 0 ? reg + ' область' : reg, 'Україна'].filter(Boolean);
    if (parts.length < 3) return A.toast('Заповніть адресу (область, населений пункт, вулиця, будинок)', 'err');
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ua&accept-language=uk&q=' + encodeURIComponent(parts.join(', '));
    t.disabled = true;
    return fetch(url, {headers: {'Accept': 'application/json'}}).then(function (r) { return r.json(); }).then(function (j) {
      t.disabled = false; if (!j || !j.length) return A.toast('Адресу не знайдено. Уточніть адресу або внесіть координати вручну', 'err');
      fm.querySelector('[name="lat"]').value = (+j[0].lat).toFixed(6); fm.querySelector('[name="lon"]').value = (+j[0].lon).toFixed(6);
      A.toast('Координати визначено: ' + (j[0].display_name || '').slice(0, 120) + '. Збережіть картку.');
    }, function () { t.disabled = false; A.toast('Сервіс геокодування недоступний з вашої мережі — внесіть координати вручну', 'err'); });
  };
  A.ACT['asset-save'] = function (form, d) {
    var isNew = !form.dataset.id, a = isNew ? {details: {}} : A.get('assets', +form.dataset.id), p = {}, det = Object.assign({}, a.details || {}), detCh = false;
    Object.keys(d).forEach(function (k) {
      var v = typeof d[k] === 'string' ? d[k].trim() : d[k];
      if (k.indexOf('det_') === 0) {
        var key = k.slice(4), f = (D.CATEGORY_FIELDS[a.category] || []).filter(function (x) { return x[0] === key; })[0] || [];
        if (D.INTERNAL_DETAIL_KEYS.indexOf(key) >= 0 && !A.can('view_internal') && v === '') return;   // приховане значення не затирається
        if (f[2] === 'vin' && v) { v = v.toUpperCase().replace(/\s/g, ''); if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) throw new Error('VIN-код має містити 17 символів (латинські літери, крім I, O, Q, та цифри)'); }
        if ((f[2] === 'num' || f[2] === 'int' || f[2] === 'year') && v !== '') { var n = A.parseNum(v); if (n === null) throw new Error('«' + f[1] + '»: потрібне число'); v = f[2] === 'num' ? n : Math.round(n); }
        if (v === '') v = null;
        if (!same(det[key], v)) { if (v === null) delete det[key]; else det[key] = v; detCh = true; }
        return;
      }
      if (k === 'zone_manual_v' || k === 'geojson') return;
      if ((k === 'owner_code' || k === 'custodian_code' || k === 'manager_code') && !A.can('view_internal') && v === '') return;
      if (NUMF.indexOf(k) >= 0 && v !== '') { var nv = A.parseNum(v); if (nv === null) throw new Error('Поле «' + k + '»: потрібне число'); v = nv; }
      if (INTF.indexOf(k) >= 0 && v !== '') v = +v;
      if (v === '') v = null;
      if (isNew || !same(a[k], v)) p[k] = v;
    });
    if ('geojson' in d) { var gt = (d.geojson || '').trim(), had = det.geometry ? JSON.stringify(det.geometry) : '';
      if (!gt && had) { delete det.geometry; delete det.area_calc_ha; det.geometry_src = 'manual'; detCh = true; }
      else if (gt && gt !== had) { var g = A.parseGeom(gt); det.geometry = g; det.geometry_src = 'manual'; det.area_calc_ha = A.geomArea(g); if (!det.area_ha) det.area_ha = det.area_calc_ha; detCh = true;
        var cen = A.geomCenter(g); if (cen && (!a.coords_checked || !a.lat) && !('lat' in p && p.lat)) { p.lat = cen[0]; p.lon = cen[1]; } } }
    if (detCh) p.details = det;
    if ('proposal' in d || 'zone_manual_v' in d) {
      var zm = d.zone_manual_v || '', z = zm || A.zoneForStatus(d.proposal !== undefined ? d.proposal : a.proposal) || a.zone || 'Сіра зона';
      if (isNew || !same(a.zone, z)) p.zone = z; if (isNew || !same(a.zone_manual, zm ? 1 : 0)) p.zone_manual = zm ? 1 : 0;
    }
    if ('mtu_manager_id' in p) { var mu = p.mtu_manager_id && A.get('users', p.mtu_manager_id); p.mtu_manager = mu ? mu.full_name : null; if (mu && !d.mtu_manager_contact) p.mtu_manager_contact = [mu.phone, mu.email].filter(Boolean).join(', ') || null; }
    if ('dma_manager_id' in p) { var du = p.dma_manager_id && A.get('users', p.dma_manager_id); p.dma_manager = du ? du.full_name : null; if (du && !d.dma_manager_contact) p.dma_manager_contact = [du.phone, du.email].filter(Boolean).join(', ') || null; }
    if (!isNew && S.user && S.user.mtu_code && !a.mtu_code && !A.can('edit_any_asset') && A.canEdit(a, 'screening') && Object.keys(p).length) p.mtu_code = S.user.mtu_code;   // МТУ «бере» не закріплений актив
    if (!isNew && Object.keys(p).some(function (k) { return ['inspect_date', 'tech_state', 'usage_state', 'inspect_conclusion', 'description'].indexOf(k) >= 0; })) p.screening_date = A.today();
    if ('crit' in p || isNew) { var cr = isNew ? p.crit : p.crit; p.public_candidate = !cr || cr === '#N/A' ? 1 : 0; }
    if (p.publish && !(isNew ? p.public_candidate : (p.public_candidate !== undefined ? p.public_candidate : a.public_candidate))) p.publish = 0;
    if (p.publish && (p.zone || a.zone) === 'Червона зона') p.publish = 0;
    if ((p.zone || a.zone) === 'Червона зона' && a.publish && !isNew) p.publish = 0;   // перехід у Червону зону знімає з публікації
    if (isNew) {
      if (!p.asset_no) throw new Error('Вкажіть № активу в Реєстрі');
      if (A.indexes.byNo[p.asset_no]) throw new Error('Актив з номером ' + p.asset_no + ' уже є в Реєстрі');
      if (!p.name || !p.category) throw new Error('Вкажіть категорію і найменування');
      Object.assign(p, {id: A.tmpId(), source: 'manual', legal_src: 'unknown', legal_status: 'unknown', legal_basis: 'inventory', decisions_count: 0, photo_count: 0, doc_count: 0,
        public_candidate: p.public_candidate === undefined ? 1 : p.public_candidate, complexity: p.complexity || 'simple'});
    } else if (!Object.keys(p).length) { A.toast('Змін немає', 'info'); return A.go('#/asset/' + a.id); }
    var tx = A.tx(); tx.put('assets', isNew ? p : Object.assign({id: a.id}, p), isNew ? undefined : form.dataset.v);
    var ir = isNew && form.dataset.ident && A.get('ident_records', +form.dataset.ident);
    if (ir && A.identLinkTx) A.identLinkTx(tx, ir, p);
    tx.log(isNew ? 'Заведено новий актив' : 'Змінено картку активу', 'asset', isNew ? null : a.id, {fields: Object.keys(p).filter(function (k) { return k !== 'id'; })});
    return tx.commit().then(function (r) { form.classList.remove('dirty'); var nid = isNew ? r.id('assets', p.id) : a.id; A.toast(isNew ? 'Актив заведено' : 'Зміни збережено'); A.go('#/asset/' + nid); });
  };
})();
/* v2.2: досьє активу / пулу для сайту — 8 розділів: автоматично з Реєстру + стандартизовані поля менеджера ДМА */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc;
  function members(tt, rec) { return tt === 'pool' ? (A.indexes.poolAssets[rec.id] || []) : [rec]; }
  // автоматична частина (та сама логіка, що app/public_data.dossier_auto)
  A.dossierAuto = function (tt, rec) {
    var ms = members(tt, rec), a0 = ms[0] || rec, o = {};
    o.scope = ms.map(function (a) { var d = a.details || {}; return [a.asset_no + ' · ' + (a.name || '').slice(0, 120), [N.CAT[a.category], A.fullAddress(a) || a.region, a.cadastral ? 'кад. № ' + a.cadastral : '', d.area_sqm ? d.area_sqm + ' м²' : d.area_ha ? d.area_ha + ' га' : '', a.company_code ? 'ЄДРПОУ ' + a.company_code : '', d.share_pct ? 'частка ' + d.share_pct + ' %' : ''].filter(Boolean).join(' · ')]; });
    var lg = {}; ms.forEach(function (a) { var k = N.LEGAL[a.legal_status] || 'уточнюється'; lg[k] = (lg[k] || 0) + 1; });
    o.legal = [['Правовий стан', Object.keys(lg).map(function (k) { return k + (ms.length > 1 ? ' — ' + lg[k] : ''); }).join('; ')], ['Судових рішень', ms.reduce(function (s, a) { return s + (a.decisions_count || 0); }, 0)]];
    o.access = [['Стан використання', a0.usage_state], ['Дата огляду', a0.inspect_date ? A.dt(a0.inspect_date) : ''], ['Зберігач', ms.some(function (a) { return a.custodian_name; }) ? 'призначено' : '']];
    o.tech = [['Технічний стан', a0.tech_state], ['Висновок огляду', (a0.inspect_conclusion || '').slice(0, 300)], ['Фото', ms.reduce(function (s, a) { return s + (a.photo_count || 0); }, 0)]];
    o.finance = [['Оціночна вартість', rec.val_amount ? A.money(rec.val_amount) + (rec.val_date ? ' на ' + A.dt(rec.val_date) : '') : ''], ['Очікуваний дохід на рік', rec.expected_income_year ? A.money(rec.expected_income_year) : '']];
    o.ops = ms.filter(function (a) { return a.category === 'corporate' && A.indexes.comp[a.company_code]; }).slice(0, 3).map(function (a) { return ['Види діяльності (ЄДР)', (A.indexes.comp[a.company_code].activities || '').slice(0, 200)]; });
    o.risks = [['Ризик місцезнаходження', a0.location_risk]]; o.terms = [['Спосіб передачі', N.WAY[rec.transfer_way]], ['Можливість управління', N.POS[rec.mgmt_possible]]];
    Object.keys(o).forEach(function (k) { if (k !== 'scope') o[k] = o[k].filter(function (x) { return x[1] !== undefined && x[1] !== null && x[1] !== '' && x[1] !== 0; }); });
    return o;
  };
  A.dossierFill = function (rec) { var dz = rec.dossier || {}, n = 0, t = 0; (D.DOSSIER || []).forEach(function (s) { s[2].forEach(function (f) { t++; var v = dz[s[0] + '.' + f[0]]; if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) n++; }); }); return t ? Math.round(n * 100 / t) : 0; };
  A.dossierBlock = function (tt, rec, editable) {
    var dz = rec.dossier || {}, au = A.dossierAuto(tt, rec), fill = A.dossierFill(rec);
    var h = '<div class="panel"><h3>Досьє для сайту <span>заповнено ' + fill + ' % · ' + (D.DOSSIER || []).length + ' розділів</span></h3><div class="prog"><div style="width:' + fill + '%"></div></div>' +
      '<p class="mini">Ліворуч — відомості, що підтягуються з Реєстру автоматично; поля нижче заповнює менеджер ДМА за стандартною формою (без персональних даних). На сайті показуються лише заповнені поля.</p>' +
      '<form data-act="dossier-save" data-tt="' + tt + '" data-id="' + rec.id + '">' +
      (tt === 'asset' || tt === 'pool' ? '<div class="form-grid">' + A.field('ID закупівлі послуг з управління на Prozorro', 'tender_id', rec.tender_id, 'text', 0, 'UA-2026-…; посилання prozorro.gov.ua/tender/ID') + A.field('ID аукціону Prozorro.Продажі', 'prozorro_id', rec.prozorro_id, 'text', 0, 'для реалізації') + '</div>' : '');
    (D.DOSSIER || []).forEach(function (s, i) {
      var a = au[s[0]] || [];
      h += '<details class="ident-sec"' + (i < 1 ? ' open' : '') + '><summary>' + (i + 1) + '. ' + esc(s[1]) + '</summary><fieldset' + (editable ? '' : ' disabled') + ' style="border:0;margin:0;padding:0;background:none">' +
        (a.length ? '<dl class="kv auto">' + a.slice(0, 30).map(function (x) { return A.dd(x[0], x[1]); }).join('') + (a.length > 30 ? A.dd('…', 'ще ' + (a.length - 30)) : '') + '</dl>' : '') + '<div class="form-grid">';
      s[2].forEach(function (f) {
        var k = s[0] + '.' + f[0], v = dz[k], nm = 'ds|' + k;
        if (f[2] === 'text') h += A.field(f[1], nm, v, 'textarea', 0, '', 'wide');
        else if (f[2] === 'num') h += A.field(f[1], nm, v, 'text', 0, '', '', 'inputmode="decimal"');
        else if (f[2] === 'yn') h += A.fsel(f[1], nm, D.YN, v);
        else if (f[2] === 'sel') h += A.fsel(f[1], nm, f[3], v);
        else if (f[2] === 'multi') h += '<div class="field wide"><label>' + esc(f[1]) + '</label><div class="checks">' + f[3].map(function (o) { return '<label class="chk"><input type="checkbox" name="' + nm + '" value="' + esc(o) + '"' + ((v || []).indexOf(o) >= 0 ? ' checked' : '') + ' style="width:auto"> ' + esc(o) + '</label>'; }).join('') + '</div></div>';
      });
      h += '</div></fieldset></details>';
    });
    if (editable) h += '<div class="form-actions"><button class="btn gold">Зберегти досьє</button></div>';
    return h + '</form></div>';
  };
  A.ACT['dossier-save'] = function (form, d) {
    var tt = form.dataset.tt, t = tt === 'pool' ? 'pools' : 'assets', rec = A.get(t, +form.dataset.id), dz = {};
    (D.DOSSIER || []).forEach(function (s) { s[2].forEach(function (f) {
      var k = s[0] + '.' + f[0], v = d['ds|' + k];
      if (f[2] === 'multi') { v = v === undefined ? [] : Array.isArray(v) ? v : [v]; if (v.length) dz[k] = v; return; }
      v = typeof v === 'string' ? v.trim() : v; if (v === '' || v === undefined || v === null) return;
      if (f[2] === 'num') { var n = A.parseNum(v); if (n === null) throw new Error('«' + f[1] + '»: потрібне число'); v = n; }
      dz[k] = v; }); });
    var p = {id: rec.id, dossier: dz}; if ('tender_id' in d) p.tender_id = (d.tender_id || '').trim() || null; if ('prozorro_id' in d) p.prozorro_id = (d.prozorro_id || '').trim() || null;
    var tx = A.tx(); tx.put(t, p, rec.updated_at); tx.log('Оновлено досьє для сайту', tt, rec.id, {fill: A.dossierFill({dossier: dz})});
    return tx.commit().then(function () { A.toast('Досьє збережено'); A.route(true); });
  };
})();
