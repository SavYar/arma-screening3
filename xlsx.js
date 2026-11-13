/* Формування XLSX у браузері без зовнішніх бібліотек (однаково на сервері і в дзеркалі).
   ZIP: стиснення deflate через CompressionStream (сучасні браузери), інакше — без стиснення.
   XLSX.table — звичайний звіт; XLSX.fillTemplate — заповнення шаблону зі збереженням оформлення і формул. */
(function () {
  'use strict';
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = new TextEncoder(), dec = new TextDecoder();
  function streamBytes(data, stream) { return new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function deflate(u8) { if (typeof CompressionStream === 'undefined') return Promise.resolve(null); try { return streamBytes(u8, new CompressionStream('deflate-raw')).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
  function inflate(u8) { return streamBytes(u8, new DecompressionStream('deflate-raw')); }
  function zip(files) {     // files: {name: string|Uint8Array}
    var names = Object.keys(files);
    return Promise.all(names.map(function (n) { var d = typeof files[n] === 'string' ? enc.encode(files[n]) : files[n]; return deflate(d).then(function (z) { return {n: enc.encode(n), d: d, z: z && z.length < d.length ? z : null}; }); })).then(function (items) {
      var parts = [], central = [], off = 0;
      items.forEach(function (it) {
        var crc = crc32(it.d), body = it.z || it.d, m = it.z ? 8 : 0, h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, m, true); h.setUint32(14, crc, true); h.setUint32(18, body.length, true); h.setUint32(22, it.d.length, true); h.setUint16(26, it.n.length, true);
        parts.push(new Uint8Array(h.buffer), it.n, body);
        var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, m, true); c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, it.d.length, true); c.setUint16(28, it.n.length, true); c.setUint32(42, off, true);
        central.push(new Uint8Array(c.buffer), it.n); off += 30 + it.n.length + body.length;
      });
      var size = central.reduce(function (s, x) { return s + x.length; }, 0), e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, items.length, true); e.setUint16(10, items.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
      return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    });
  }
  function unzip(buf) {
    var u = new Uint8Array(buf), v = new DataView(buf), eo = u.length - 22;
    while (eo > 0 && v.getUint32(eo, true) !== 0x06054b50) eo--;
    var n = v.getUint16(eo + 10, true), p = v.getUint32(eo + 16, true), jobs = [];
    for (var i = 0; i < n; i++) {
      var m = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      var name = dec.decode(u.subarray(p + 46, p + 46 + nl)), ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), data = u.subarray(ds, ds + cs);
      jobs.push((function (name, m, data) { return (m === 8 ? inflate(data) : Promise.resolve(data)).then(function (d) { return [name, d]; }); })(name, m, data));
      p += 46 + nl + xl + cl;
    }
    return Promise.all(jobs).then(function (r) { var o = {}; r.forEach(function (x) { o[x[0]] = x[1]; }); return o; });
  }
  function x(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // v2.9.1: Excel не приймає клітинку довшу за 32 767 символів (файл «відновлюється» з видаленням рядка) — обрізаємо з позначкою
  var MAXC = 32000, CUT = ' … [текст обрізано — обмеження Excel 32 767 символів у клітинці; повний перелік — у порталі / досьє]';
  function lim(v) { return typeof v === 'string' && v.length > MAXC ? v.slice(0, MAXC) + CUT : v; }
  function cell(ref, v, s) {
    if (v && typeof v === 'object' && !v.f && 'v' in v) { if (v.s !== undefined) s = v.s; v = v.v; }
    v = lim(v);
    var st = s !== undefined && s !== null ? ' s="' + s + '"' : '';
    if (v === null || v === undefined || v === '') return s !== undefined && s !== null ? '<c r="' + ref + '"' + st + '/>' : '';
    if (typeof v === 'object' && v.f) return '<c r="' + ref + '"' + st + '><f>' + x(v.f) + '</f></c>';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
    return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
  }
  var CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0;[Red]\-#,##0"/><numFmt numFmtId="166" formatCode="0.0%;[Red]\-0.0%"/><numFmt numFmtId="167" formatCode="0.00;[Red]\-0.00"/></numFmts><fonts count="6"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF1F3A60"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF5B6575"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>' +
    '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3A60"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFB0B8C4"/></left><right style="thin"><color rgb="FFB0B8C4"/></right><top style="thin"><color rgb="FFB0B8C4"/></top><bottom style="thin"><color rgb="FFB0B8C4"/></bottom></border></borders>' +
    '<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="15"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf borderId="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf borderId="1" numFmtId="164" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf fontId="2" applyFont="1"/><xf fontId="3" fillId="3" borderId="1" applyBorder="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf borderId="1" applyBorder="1" numFmtId="165" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf borderId="1" applyBorder="1" numFmtId="166" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf borderId="1" applyBorder="1" numFmtId="167" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf fontId="5" borderId="1" applyBorder="1" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fontId="4" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="4" borderId="1" applyBorder="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="5" borderId="1" applyBorder="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="6" borderId="1" applyBorder="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fontId="5" borderId="1" applyBorder="1" numFmtId="165" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  // sheets: [{name, title, cols:[{h, w, num}], rows:[[...]]}]
  function table(sheets) {
    var files = {'_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>', 'xl/styles.xml': STYLES};
    var ct = CT, wb = '', rels = '';
    sheets.forEach(function (sh, si) {
      var n = si + 1, top = sh.title ? 2 : 0, body = '';
      if (sh.title) body += '<row r="1">' + cell('A1', sh.title, 4) + '</row>';
      var hd = sh.noHead ? 0 : 1, mg = [];
      if (hd) body += '<row r="' + (top + 1) + '" ht="32" customHeight="1">' + sh.cols.map(function (c, i) { return cell(col(i) + (top + 1), c.h, 1); }).join('') + '</row>';
      sh.rows.forEach(function (r, ri) { var rn = top + 1 + hd + ri; if (r.merge) mg.push(col(r.merge[0]) + rn + ':' + col(r.merge[1]) + rn); body += '<row r="' + rn + '"' + (r.ht ? ' ht="' + r.ht + '" customHeight="1"' : '') + '>' + r.map(function (v, i) { return cell(col(i) + rn, v, typeof v === 'number' ? (sh.cols[i] && sh.cols[i].s) || 3 : (sh.cols[i] && sh.cols[i].ts) || 2); }).join('') + '</row>'; });
      var last = col(sh.cols.length - 1) + (top + 1 + sh.rows.length);
      files['xl/worksheets/sheet' + n + '.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (si ? '' : ' tabSelected="1"') + '>' + (hd ? '<pane ySplit="' + (top + 1) + '" topLeftCell="A' + (top + 2) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews><cols>' +
        sh.cols.map(function (c, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.w || 16) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' + body + '</sheetData>' + (sh.rows.length && !sh.noFilter ? '<autoFilter ref="A' + (top + 1) + ':' + last + '"/>' : '') + (mg.length ? '<mergeCells count="' + mg.length + '">' + mg.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') + '</worksheet>';
      ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wb += '<sheet name="' + x((sh.name || 'Аркуш' + n).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
      rels += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
    });
    var k = sheets.length + 1;
    files['[Content_Types].xml'] = ct + '</Types>';
    files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wb + '</sheets></workbook>';
    files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '<Relationship Id="rId' + k + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    return zip(files);
  }
  /* Заповнення шаблону: рядок-зразок protoRow (стилі комірок) розмножується для кожного запису;
     formulas: {індекс колонки: 'AK{r}+AL{r}'}; підсумкові SUM(X7:X299) перераховуються на фактичний діапазон;
     extraSheets: {назва аркуша: [[адреса, значення], ...]} — оновлення окремих комірок інших аркушів. */
  function colN(L) { var n = 0; for (var i = 0; i < L.length; i++) n = n * 26 + L.charCodeAt(i) - 64; return n - 1; }
  /* Заповнення шаблону: рядок-зразок protoRow (стилі комірок) розмножується для кожного запису; рядки шаблону нижче
     зразка зсуваються вниз (порядок рядків — як вимагає Excel); formulas: {індекс колонки: 'AK{r}+AL{r}'};
     підсумкові SUM(X7:X299) перераховуються на фактичний діапазон; extraSheets: {аркуш: [[адреса, значення], ...]};
     keepCols (v2.6): масив вихідних індексів колонок у потрібному порядку — решта колонок (напр. невибрані місяці)
     вилучається разом з об’єднаннями і ширинами; rowHeight — висота рядків даних (пункти). */
  function fillTemplate(buf, opt) {
    return unzip(buf).then(function (f) {
      var wbx = dec.decode(f['xl/workbook.xml']), rels = dec.decode(f['xl/_rels/workbook.xml.rels']);
      function sheetPath(name) { var m = wbx.match(new RegExp('<sheet[^>]*name="' + name + '"[^>]*r:id="(rId\\d+)"')) || wbx.match(new RegExp('<sheet[^>]*r:id="(rId\\d+)"[^>]*name="' + name + '"')); if (!m) return null; var t = rels.match(new RegExp('Id="' + m[1] + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + m[1] + '"')); return t ? 'xl/' + t[1].replace(/^\/?xl\//, '') : null; }
      var sp = sheetPath(opt.sheet) || 'xl/worksheets/sheet1.xml', s = dec.decode(f[sp]), pr = opt.protoRow, first = opt.firstRow || pr;
      // спершу — точкові заміни (на вихідних адресах, тож при вилученні колонок вони переміщуються разом із колонкою)
      function setCells(t, list) { list.forEach(function (u) { var ref = u[0], re = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)'); var m = t.match(re); var st = m && (m[1].match(/\ss="(\d+)"/) || [])[1];
        if (m) t = t.replace(re, cell(ref, u[1], st === undefined ? null : st) || '<c r="' + ref + '"' + (st ? ' s="' + st + '"' : '') + '/>'); }); return t; }
      if (opt.extraSheets && opt.extraSheets[opt.sheet]) s = setCells(s, opt.extraSheets[opt.sheet]);
      var rm = s.match(new RegExp('<row r="' + pr + '"(?:\\s[^>]*?[^/])?>([\\s\\S]*?)</row>')), rowAttr = (s.match(new RegExp('<row r="' + pr + '"(\\s[^>]*?)?/?>')) || [])[1] || '';
      var styles = {}; if (rm) rm[1].replace(/<c r="([A-Z]+)\d+"(?:[^>]*?\ss="(\d+)")?[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, function (_, c, st) { styles[c] = st; return ''; });
      rowAttr = rowAttr.replace(/\s(hidden|ht|customHeight|spans)="[^"]*"/g, '') + (opt.rowHeight ? ' ht="' + opt.rowHeight + '" customHeight="1"' : '');
      var n = Math.max(1, opt.rows.length), last = first + n - 1, delta = last - pr, out = '';
      opt.rows.forEach(function (r, i) { var rn = first + i, cells = '';
        for (var c = 0; c < opt.cols; c++) { var L = col(c), v = r[c]; if (opt.formulas && opt.formulas[c]) v = {f: opt.formulas[c].replace(/\{r\}/g, rn)}; cells += cell(L + rn, v, styles[L] !== undefined ? styles[L] : null); }
        out += '<row r="' + rn + '"' + rowAttr + '>' + cells + '</row>'; });
      // рядки шаблону нижче зразка — зсув на delta (номери рядків і адреси комірок)
      function shiftRow(xml) { return xml.replace(/<row r="(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, function (m0, rn, at, tail, body) { rn = +rn; if (rn <= pr || !delta) return m0;
        var nr = rn + delta; return '<row r="' + nr + '"' + at + (body === undefined ? '/>' : '>' + body.replace(/<c r="([A-Z]+)\d+"/g, '<c r="$1' + nr + '"') + '</row>'); }); }
      s = shiftRow(s.replace(new RegExp('<row r="' + pr + '"(?:\\s[^>]*?)?/>|<row r="' + pr + '"(?:\\s[^>]*?[^/])?>[\\s\\S]*?</row>'), '\u0000PROTO\u0000'));
      if (s.indexOf('\u0000PROTO\u0000') < 0) throw new Error('Шаблон: не знайдено рядок-зразок ' + pr);
      s = s.replace('\u0000PROTO\u0000', out);
      s = s.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, function (m0, a, r1, b, r2) { r1 = +r1; r2 = +r2; if (r1 > pr && delta) { r1 += delta; r2 += delta; } return '<mergeCell ref="' + a + r1 + ':' + b + r2 + '"/>'; });
      s = s.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, function (m0, a, r1, b, r2) { return +r1 === first && +r2 !== +r1 ? 'SUM(' + a + first + ':' + b + Math.max(first, last) + ')' : m0; });   // лише діапазони-підсумки (не формули в рядку)
      s = s.replace(/<autoFilter ref="([A-Z]+\d+):([A-Z]+)\d+"/, function (m0, a, b) { return '<autoFilter ref="' + a + ':' + b + Math.max(first, last) + '"'; });
      if (opt.total && opt.totalRow) {   // підсумковий рядок шаблону (після зсуву) — значення з opt.total, оформлення шаблону
        var tr = opt.totalRow + (opt.totalRow > pr ? delta : 0);
        s = s.replace(new RegExp('<row r="' + tr + '"(\\s[^>]*?)?(/>|>([\\s\\S]*?)</row>)'), function (m0, at, tail, body) { at = at || ''; var st = {}; (body || '').replace(/<c r="([A-Z]+)\d+"(?:[^>]*?\ss="(\d+)")?/g, function (_, c, x) { st[c] = x; return _; });
          var cs = ''; for (var c = 0; c < opt.cols; c++) { var L = col(c); cs += cell(L + tr, opt.total[c], st[L] !== undefined ? st[L] : null); } return '<row r="' + tr + '"' + at.replace(/\/$/, '') + '>' + cs + '</row>'; });
      }
      if (opt.keepCols) s = keepColumns(s, opt.keepCols);
      var maxRow = 0; s.replace(/<row r="(\d+)"/g, function (m0, r) { maxRow = Math.max(maxRow, +r); return m0; });
      var maxCol = opt.keepCols ? opt.keepCols.length - 1 : opt.cols - 1;
      s = s.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:' + col(maxCol) + maxRow + '"/>');
      s = s.replace(/<v><\/v>/g, '').replace(/<c r="([A-Z]+\d+)"([^>]*)><\/c>/g, '<c r="$1"$2/>');
      if (opt.freeze) s = s.replace(/<sheetView(\s[^>]*?)?(\/>|>[\s\S]*?<\/sheetView>)/, function (m0, at) { at = at || ''; var fr = opt.freeze.match(/([A-Z]+)(\d+)/), xs = colN(fr[1]), ys = +fr[2] - 1;
        return '<sheetView' + at.replace(/\stopLeftCell="[^"]*"/, '') + '><pane' + (xs ? ' xSplit="' + xs + '"' : '') + ' ySplit="' + ys + '" topLeftCell="' + opt.freeze + '" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="' + opt.freeze + '" sqref="' + opt.freeze + '"/></sheetView>'; });
      f[sp] = enc.encode(s);
      wbx = wbx.replace(/(_FilterDatabase[^>]*>[^<]*!\$[A-Z]+\$\d+:\$[A-Z]+\$)\d+/, function (m0, a) { return a + Math.max(first, last); });
      if (!/fullCalcOnLoad/.test(wbx)) wbx = wbx.replace(/<calcPr([^>]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
      f['xl/workbook.xml'] = enc.encode(wbx);
      Object.keys(opt.extraSheets || {}).forEach(function (name) { if (name === opt.sheet) return; var p = sheetPath(name); if (!p) return; f[p] = enc.encode(setCells(dec.decode(f[p]), opt.extraSheets[name])); });
      Object.keys(f).forEach(function (k) { if (/^xl\/worksheets\/.*\.xml$/.test(k) && k !== sp) f[k] = enc.encode(dec.decode(f[k]).replace(/<v><\/v>/g, '')); });
      delete f['xl/calcChain.xml'];
      var ct = dec.decode(f['[Content_Types].xml']).replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, ''); f['[Content_Types].xml'] = enc.encode(ct);
      var ordered = {'[Content_Types].xml': f['[Content_Types].xml']}; Object.keys(f).forEach(function (k) { if (!ordered[k]) ordered[k] = f[k]; });
      return zip(ordered);
    });
  }
  // вилучення / перестановка колонок аркуша: keep — вихідні індекси у новому порядку
  function keepColumns(s, keep) {
    var map = {}; keep.forEach(function (c, i) { map[c] = i; });
    s = s.replace(/<row r="(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, function (m0, rn, at, tail, body) { if (body === undefined) return m0;
      var cells = []; body.replace(/<c r="([A-Z]+)(\d+)"([\s\S]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, function (m1, L, r, attrs, inner) { var o = colN(L); if (map[o] === undefined) return m1;
        if (inner && inner.indexOf('<f') >= 0) inner = inner.replace(/<f([^>]*)>([\s\S]*?)<\/f>/, function (m2, fa, fx) { return '<f' + fa + '>' + fx.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, function (m3, d1, L2, d2, rr) { var oc = colN(L2); return map[oc] === undefined ? m3 : d1 + col(map[oc]) + d2 + rr; }) + '</f>'; });
        cells.push([map[o], '<c r="' + col(map[o]) + r + '"' + attrs + (inner === undefined ? '/>' : '>' + inner + '</c>')]); return m1; });
      cells.sort(function (a, b) { return a[0] - b[0]; });
      return '<row r="' + rn + '"' + at.replace(/\sspans="[^"]*"/, '') + '>' + cells.map(function (c) { return c[1]; }).join('') + '</row>';
    });
    var widths = {}, cm = s.match(/<cols>([\s\S]*?)<\/cols>/);
    if (cm) { cm[1].replace(/<col ([^>]*?)\/>/g, function (m0, at) { var mn = +(at.match(/min="(\d+)"/) || [])[1], mx = +(at.match(/max="(\d+)"/) || [])[1]; for (var c = mn; c <= mx; c++) widths[c - 1] = at.replace(/\s?(min|max)="\d+"/g, ''); return m0; });
      s = s.replace(/<cols>[\s\S]*?<\/cols>/, '<cols>' + keep.map(function (o, i) { return widths[o] !== undefined ? '<col min="' + (i + 1) + '" max="' + (i + 1) + '" ' + widths[o].trim() + '/>' : ''; }).join('') + '</cols>'); }
    var merges = [];
    s.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, function (m0, a, r1, b, r2) { var ks = []; for (var c = colN(a); c <= colN(b); c++) if (map[c] !== undefined) ks.push(map[c]);
      if (!ks.length) return m0; ks.sort(function (x, y) { return x - y; }); var lo = ks[0], hi = ks[ks.length - 1];
      if (hi - lo + 1 !== ks.length) hi = lo;   // об’єднання розірване перестановкою — лишається перша колонка
      if (lo === hi && r1 === r2) return m0; merges.push(col(lo) + r1 + ':' + col(hi) + r2); return m0; });
    s = s.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, merges.length ? '<mergeCells count="' + merges.length + '">' + merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '');
    return s;
  }
  function download(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  window.XLSX = {zip: zip, unzip: unzip, table: table, fillTemplate: fillTemplate, download: download, col: col};
})();
