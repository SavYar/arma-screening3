/* Діаграми порталу: горизонтальні і вертикальні стовпчики, кільце.
   Анімація під час появи, підписи не накладаються (довгі — обрізаються «…» і повністю показуються у підказці),
   кожен показник клікабельний (фільтрує перелік). Без зовнішніх бібліотек. */
(function () {
  'use strict';
  var C = {cyan: '#35D6E8', gold: '#F5C518', violet: '#8B7BF7', ok: '#3DD68C', lim: '#F5A524', lost: '#F0524E',
           unk: '#6E7F9E', blue: '#4C8DF6', closed: '#5B7DB1', red: '#F0524E', yellow: '#F5C518', grey: '#8A94A6'};
  var PAL = ['#35D6E8', '#F5C518', '#8B7BF7', '#3DD68C', '#F5A524', '#4C8DF6', '#F0524E', '#6E7F9E', '#5B7DB1', '#C3B8FF', '#7FD1AE', '#E58FB4'];
  var tip = null;
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function fmt(v, unit) {
    v = Number(v) || 0; var a = Math.abs(v), s;
    if (unit === 'money') {
      if (a >= 1e9) return (v / 1e9).toFixed(2).replace('.', ',') + ' млрд ₴';
      if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' млн ₴';
      return Math.round(v).toLocaleString('uk-UA') + ' ₴';
    }
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' млн';
    if (a >= 1e4) return (v / 1e3).toFixed(1).replace('.', ',') + ' тис.';
    s = (Math.round(v * 10) / 10).toString().replace('.', ',');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function full(v, unit) { var g = function (x, dg) { var p = (Math.round(x * Math.pow(10, dg)) / Math.pow(10, dg)).toFixed(dg).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join(','); };
    return unit === 'money' ? g(Number(v) || 0, 2) + ' ₴' : g(Number(v) || 0, Number(v) % 1 ? 2 : 0); }
  function color(d, i) { var c = d.colors ? d.colors[i] : d.color; return C[c] || c || PAL[i % PAL.length]; }
  function showTip(e, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ch-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block';
    var x = e.clientX + 14, y = e.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function bind(el, d, i, total) {
    var pct = total ? ' · ' + (d.values[i] * 100 / total).toFixed(1).replace('.', ',') + '%' : '';
    var html = '<b>' + esc(d.labels[i]) + '</b><br>' + full(d.values[i], d.unit) + pct + (d.links && d.links[i] ? '<div class="ch-tip-h">клікніть — показати перелік</div>' : '');
    el.addEventListener('mousemove', function (e) { showTip(e, html); });
    el.addEventListener('mouseleave', hideTip);
    if (d.links && d.links[i]) {
      el.classList.add('ch-link');
      el.addEventListener('click', function () { hideTip(); location.href = d.links[i]; });
    }
  }
  function sum(a) { return a.reduce(function (s, v) { return s + (Number(v) || 0); }, 0); }

  function barh(box, d) {
    var max = Math.max.apply(null, d.values.concat([1])), total = sum(d.values);
    var wrap = document.createElement('div'); wrap.className = 'ch-barh';
    d.labels.forEach(function (lab, i) {
      var row = document.createElement('div'); row.className = 'ch-row';
      row.innerHTML = '<div class="ch-lbl" title="' + esc(lab) + '">' + esc(lab) + '</div><div class="ch-track"><div class="ch-fill" style="background:' + color(d, i) + '"></div></div><div class="ch-val">' + fmt(d.values[i], d.unit) + '</div>';
      bind(row, d, i, total); wrap.appendChild(row);
      var fill = row.querySelector('.ch-fill');
      setTimeout(function () { fill.style.width = Math.max(1.5, d.values[i] * 100 / max) + '%'; }, 30 + i * 35);
    });
    box.appendChild(wrap);
  }
  function barv(box, d) {
    var max = Math.max.apply(null, d.values.concat([1])), total = sum(d.values);
    var wrap = document.createElement('div'); wrap.className = 'ch-barv';
    d.labels.forEach(function (lab, i) {
      var col = document.createElement('div'); col.className = 'ch-col';
      col.innerHTML = '<div class="ch-cval">' + fmt(d.values[i], d.unit) + '</div><div class="ch-ctrack"><div class="ch-cfill" style="background:' + color(d, i) + '"></div></div><div class="ch-clbl" title="' + esc(lab) + '">' + esc(lab) + '</div>';
      bind(col, d, i, total); wrap.appendChild(col);
      var f = col.querySelector('.ch-cfill');
      setTimeout(function () { f.style.height = Math.max(2, d.values[i] * 100 / max) + '%'; }, 30 + i * 40);
    });
    box.appendChild(wrap);
  }
  function donut(box, d) {
    var total = sum(d.values) || 1, R = 54, CIRC = 2 * Math.PI * R, off = 0;
    var wrap = document.createElement('div'); wrap.className = 'ch-donut';
    var svg = '<svg viewBox="0 0 140 140" class="ch-dsvg"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="24"/>';
    d.values.forEach(function (v, i) {
      var len = CIRC * v / total;
      svg += '<circle class="ch-seg" data-i="' + i + '" cx="70" cy="70" r="' + R + '" fill="none" stroke="' + color(d, i) + '" stroke-width="24" stroke-dasharray="0 ' + CIRC + '" data-len="' + len + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"/>';
      off += len;
    });
    svg += '<text x="70" y="66" text-anchor="middle" class="ch-dtot">' + fmt(sum(d.values), d.unit) + '</text><text x="70" y="84" text-anchor="middle" class="ch-dsub">' + esc(d.center || 'усього') + '</text></svg>';
    wrap.innerHTML = svg;
    var lg = document.createElement('div'); lg.className = 'ch-legend';
    d.labels.forEach(function (lab, i) {
      var r = document.createElement('div'); r.className = 'ch-li';
      r.innerHTML = '<i style="background:' + color(d, i) + '"></i><span class="ch-ll" title="' + esc(lab) + '">' + esc(lab) + '</span><b>' + fmt(d.values[i], d.unit) + '</b><em>' + (d.values[i] * 100 / total).toFixed(0) + '%</em>';
      bind(r, d, i, total); lg.appendChild(r);
    });
    wrap.appendChild(lg); box.appendChild(wrap);
    wrap.querySelectorAll('.ch-seg').forEach(function (c) {
      var i = +c.getAttribute('data-i'); bind(c, d, i, total);
      setTimeout(function () { c.setAttribute('stroke-dasharray', c.getAttribute('data-len') + ' ' + CIRC); }, 40 + i * 60);
    });
  }
  // згруповані стовпчики «план / факт» за періодами: d.series = [{name, values, color}], d.labels — періоди
  function grouped(box, d) {
    var max = 1; d.series.forEach(function (sr) { sr.values.forEach(function (v) { if ((Number(v) || 0) > max) max = Number(v); }); });
    var wrap = document.createElement('div'); wrap.className = 'ch-grp';
    var lg = '<div class="ch-glegend">' + d.series.map(function (sr, k) { return '<span><i style="background:' + (C[sr.color] || sr.color || PAL[k]) + '"></i>' + esc(sr.name) + '</span>'; }).join('') + '</div>';
    var cols = '<div class="ch-gcols">' + d.labels.map(function (lab, i) {
      return '<div class="ch-gcol' + (i % 2 ? ' odd' : '') + '" data-i="' + i + '"><div class="ch-gbars">' + d.series.map(function (sr, k) { var v = Number(sr.values[i]) || 0;
        return '<div class="ch-gbar" data-h="' + (v * 100 / max) + '" style="background:' + (C[sr.color] || sr.color || PAL[k]) + (sr.dashed ? ';background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.25) 0 4px,transparent 4px 8px)' : '') + '"></div>'; }).join('') + '</div><div class="ch-clbl" title="' + esc(lab) + '">' + esc(lab) + '</div></div>'; }).join('') + '</div>';
    wrap.innerHTML = lg + cols; box.appendChild(wrap);
    wrap.querySelectorAll('.ch-gcol').forEach(function (col) {
      var i = +col.getAttribute('data-i');
      col.addEventListener('mousemove', function (e) { showTip(e, '<b>' + esc(d.labels[i]) + '</b><br>' + d.series.map(function (sr) { return esc(sr.name) + ': ' + full(Number(sr.values[i]) || 0, d.unit); }).join('<br>')); });
      col.addEventListener('mouseleave', hideTip);
      if (d.links && d.links[i]) { col.classList.add('ch-link'); col.addEventListener('click', function () { hideTip(); location.href = d.links[i]; }); }
      col.querySelectorAll('.ch-gbar').forEach(function (b, k) { setTimeout(function () { b.style.height = Math.max(1, +b.getAttribute('data-h')) + '%'; }, 40 + i * 30 + k * 15); });
    });
  }
  // v2.6: комбінована діаграма (SVG): вісь зі шкалою (розділення тисяч), смуги місяців, згруповані стовпчики, лінії,
  // горизонтальні опорні лінії (напр. гарантійний платіж), колір стовпчика за умовою; наведення — підсвітка місяця і підказка
  function nice(max) { if (max <= 0) return 1; var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map(function (k) { return k * p; }).filter(function (v) { return v >= raw; })[0] * 4; }
  function axl(v, unit) { var a = Math.abs(v), f = function (x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); };
    if (a >= 1e9) return f(v / 1e9) + ' млрд'; if (a >= 1e6) return f(v / 1e6) + ' млн'; if (a >= 1e3) return f(v / 1e3) + ' тис'; return f(v); }
  function combo(box, d) {
    var W = Math.max(320, box.clientWidth || 800), H = d.height || 270, pl = 62, pr = 12, pt = 14, pb = 30, n = d.labels.length;
    var bars = d.series.filter(function (s) { return s.kind !== 'line'; }), mx = 0;
    var mn = 0; d.series.forEach(function (s) { s.values.forEach(function (v) { mx = Math.max(mx, Number(v) || 0); mn = Math.min(mn, Number(v) || 0); }); }); (d.hlines || []).forEach(function (h) { mx = Math.max(mx, h.value || 0); });
    // v2.9: від’ємні значення (збиток) — вісь нижче нуля, крок шкали спільний
    var st = nice(Math.max(mx, -mn) * 1.05) / 4, top = mn < 0 ? Math.max(st, Math.ceil(mx / st) * st) : nice(mx * 1.05), bot = mn < 0 ? -Math.ceil(-mn / st) * st : 0, nt = mn < 0 ? Math.round((top - bot) / st) : 4;
    var gw = (W - pl - pr) / n, y = function (v) { return pt + (H - pt - pb) * (top - (Number(v) || 0)) / (top - bot); };
    var bw = Math.max(3, Math.min(26, (gw - 10) / Math.max(1, bars.length))), svg = '<svg class="ch-combo" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">';
    for (var i = 0; i < n; i++) svg += '<rect class="cb-band' + (i % 2 ? ' odd' : '') + '" data-i="' + i + '" x="' + (pl + gw * i) + '" y="' + pt + '" width="' + gw + '" height="' + (H - pt - pb) + '"/>';
    for (var k = 0; k <= nt; k++) { var tv = bot + (top - bot) * k / nt, yy = y(tv); svg += '<line class="cb-grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '"' + (Math.abs(tv) < 1e-9 && bot < 0 ? ' style="stroke-opacity:.6"' : '') + '/><text class="cb-ax" x="' + (pl - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + axl(tv) + '</text>'; }
    for (i = 0; i < n; i++) {
      var x0 = pl + gw * i + (gw - bw * bars.length) / 2;
      bars.forEach(function (s, j) { var v = Number(s.values[i]) || 0, c = (s.colors && s.colors[i]) || C[s.color] || s.color || PAL[j];
        if (v < 0 && s.negColor) c = C[s.negColor] || s.negColor;
        if (v) svg += '<rect class="cb-bar" x="' + (x0 + j * bw + 1) + '" y="' + Math.min(y(v), y(0)) + '" width="' + (bw - 2) + '" height="' + Math.abs(y(0) - y(v)) + '" rx="2" fill="' + c + '"' + (s.dashed ? ' fill-opacity=".55" stroke="' + c + '" stroke-dasharray="3 2"' : '') + '/>'; });
      svg += '<text class="cb-ax cb-xl" x="' + (pl + gw * i + gw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(d.labels[i]) + '</text>';
      if (i) svg += '<line class="cb-sep" x1="' + (pl + gw * i) + '" x2="' + (pl + gw * i) + '" y1="' + pt + '" y2="' + (H - pb) + '"/>';
    }
    d.series.filter(function (s) { return s.kind === 'line'; }).forEach(function (s, j) { var c = C[s.color] || s.color || PAL[j + 3], pts = s.values.map(function (v, i) { return v === null || v === undefined ? null : [pl + gw * i + gw / 2, y(v)]; }).filter(Boolean);
      svg += '<polyline class="cb-line" fill="none" stroke="' + c + '" stroke-width="2.2" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>' + pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="' + c + '"/>'; }).join(''); });
    (d.hlines || []).forEach(function (h) { if (!h.value) return; var yy = y(h.value); svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + (h.color || '#E8EDF7') + '" stroke-width="1.5" stroke-dasharray="6 4"/><text class="cb-ax cb-hl" x="' + (pl + 4) + '" y="' + (yy - 5) + '">' + esc(h.name) + ' ' + axl(h.value) + '</text>'; });
    svg += '</svg>';
    var lg = '<div class="ch-glegend">' + d.series.map(function (s, j) { var c = C[s.color] || s.color || PAL[j]; return '<span>' + (s.kind === 'line' ? '<i class="ln" style="background:' + c + '"></i>' : '<i style="background:' + c + '"></i>') + esc(s.name) + (s.total !== false ? ' · ' + fmt(sum(s.values), d.unit) : '') + '</span>'; }).join('') +
      (d.hlines || []).map(function (h) { return '<span><i class="ln dash" style="border-color:' + (h.color || '#E8EDF7') + '"></i>' + esc(h.name) + '</span>'; }).join('') + (d.legendExtra || []).map(function (x) { return '<span><i style="background:' + x.color + '"></i>' + esc(x.name) + '</span>'; }).join('') + '</div>';
    box.innerHTML = svg + lg;
    box.querySelectorAll('.cb-band').forEach(function (b) { var i = +b.getAttribute('data-i');
      b.addEventListener('mousemove', function (e) { box.querySelectorAll('.cb-band.hl').forEach(function (x) { x.classList.remove('hl'); }); b.classList.add('hl');
        showTip(e, '<b>' + esc(d.labels[i]) + (d.fullLabels ? ' · ' + esc(d.fullLabels[i]) : '') + '</b><br>' + d.series.map(function (s) { return esc(s.name) + ': ' + (s.values[i] === null || s.values[i] === undefined ? '—' : full(Number(s.values[i]) || 0, s.unit || d.unit)); }).join('<br>') + (d.hlines || []).map(function (h) { return '<br>' + esc(h.name) + ': ' + full(h.value, d.unit); }).join('') + (d.links && d.links[i] ? '<div class="ch-tip-h">клікніть — детальніше</div>' : '')); });
      b.addEventListener('mouseleave', function () { b.classList.remove('hl'); hideTip(); });
      if (d.links && d.links[i]) { b.classList.add('ch-link'); b.addEventListener('click', function () { hideTip(); location.href = d.links[i]; }); }
    });
  }
  function render(root) {
    (root || document).querySelectorAll('[data-chart]').forEach(function (box) {
      if (box.dataset.done) return;
      var d; try { d = JSON.parse(box.dataset.chart); } catch (e) { return; }
      if (d.type === 'combo' && !box.offsetWidth) return;   // у прихованій вкладці — намалюється при її відкритті
      box.dataset.done = '1'; box.innerHTML = '';
      if (d.type === 'combo') { if (!d.series || !d.series.some(function (sr) { return sr.values.some(function (v) { return Number(v); }); })) { box.innerHTML = '<div class="empty">Немає даних за період</div>'; return; } return combo(box, d); }
      if (d.type === 'grouped') { if (!d.series || !d.series.some(function (sr) { return sum(sr.values); })) { box.innerHTML = '<div class="empty">Немає даних</div>'; return; } return grouped(box, d); }
      if (!d.values || !d.values.length || !sum(d.values)) { box.innerHTML = '<div class="empty">Немає даних</div>'; return; }
      ({barh: barh, barv: barv, donut: donut}[d.type] || barh)(box, d);
    });
  }
  window.ArmaCharts = {render: render, fmt: fmt, hideTip: hideTip};
})();
