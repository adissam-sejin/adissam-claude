// 목사님 원고(한글 파일 또는 붙여넣은 글)를 읽어서 주보 항목별로 나눕니다.
(function () {
  // 성경 이름 → 주보에 쓰는 줄임말
  const BOOKS = {
    '창세기': '창', '출애굽기': '출', '레위기': '레', '민수기': '민', '신명기': '신', '여호수아': '수', '사사기': '삿', '룻기': '룻',
    '사무엘상': '삼상', '사무엘하': '삼하', '열왕기상': '왕상', '열왕기하': '왕하', '역대상': '대상', '역대하': '대하', '에스라': '스',
    '느헤미야': '느', '에스더': '에', '욥기': '욥', '시편': '시', '잠언': '잠', '전도서': '전', '아가': '아', '이사야': '사',
    '예레미야애가': '애', '예레미야': '렘', '에스겔': '겔', '다니엘': '단', '호세아': '호', '요엘': '욜', '아모스': '암', '오바댜': '옵',
    '요나': '욘', '미가': '미', '나훔': '나', '하박국': '합', '스바냐': '습', '학개': '학', '스가랴': '슥', '말라기': '말',
    '마태복음': '마', '마가복음': '막', '누가복음': '눅', '요한복음': '요', '사도행전': '행', '로마서': '롬', '고린도전서': '고전',
    '고린도후서': '고후', '갈라디아서': '갈', '에베소서': '엡', '빌립보서': '빌', '골로새서': '골', '데살로니가전서': '살전',
    '데살로니가후서': '살후', '디모데전서': '딤전', '디모데후서': '딤후', '디도서': '딛', '빌레몬서': '몬', '히브리서': '히',
    '야고보서': '약', '베드로전서': '벧전', '베드로후서': '벧후', '요한일서': '요일', '요한이서': '요이', '요한삼서': '요삼',
    '요한1서': '요일', '요한2서': '요이', '요한3서': '요삼', '유다서': '유', '요한계시록': '계'
  };
  const BOOK_NAMES = Object.keys(BOOKS).sort((a, b) => b.length - a.length); // 긴 이름부터 맞춰 봄

  // "사도행전 13:44-52" → "행 13:44-52"
  function shortRef(s) {
    s = (s || '').trim();
    for (const name of BOOK_NAMES) {
      if (s.indexOf(name) === 0 && /^\s*\d/.test(s.slice(name.length))) return BOOKS[name] + ' ' + s.slice(name.length).trim();
    }
    return s;
  }

  const SEP = '[_:：\\-–—]';
  const pad = (n) => (n < 10 ? '0' : '') + n;

  // 원고 글 → 항목별 내용
  function parse(text) {
    // has: 원고에 그 구역 제목이 있었는지 (있으면 개수가 0이어도 '이번 주엔 없음'으로 받아들임)
    const out = { date: '', scripture: '', title: '', memoryRef: '', memoryText: '', news: [], cell: [], questions: [], schedule: [], has: { news: false, cell: false, schedule: false } };
    let sec = 'head', item = null, wantMemoryText = false, inQuestions = false, m;

    (text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
      raw = raw.replace(/[ 　]/g, ' ').replace(/\s+$/, '');
      const t = raw.trim();
      if (!t) return;

      // 구역이 바뀌는 줄
      if (/^[\[【(]?\s*(광고|교회\s*소식|소식|알림)\s*[\]】)]?$/.test(t)) { sec = 'news'; out.has.news = true; item = null; wantMemoryText = false; return; }
      if (t.length < 30 && /셀\s*나눔/.test(t)) { sec = 'cell'; out.has.cell = true; inQuestions = false; wantMemoryText = false; return; }
      if (t.length < 20 && /교회\s*일정/.test(t)) { sec = 'sched'; out.has.schedule = true; wantMemoryText = false; return; }

      if (sec === 'head') {
        if (!out.date && (m = t.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) { out.date = m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]); return; }
        if ((m = t.match(new RegExp('^본문\\s*' + SEP + '\\s*(.+)$')))) { out.scripture = shortRef(m[1]); return; }
        if ((m = t.match(new RegExp('^(?:설교\\s*)?제목\\s*' + SEP + '\\s*(.+)$')))) { out.title = m[1].trim().replace(/^[“"']|[”"']$/g, ''); return; }
        if (/암송/.test(t)) {
          m = t.match(new RegExp('암송\\s*(?:말씀|구절)?\\s*' + SEP + '\\s*(.+)$'));
          if (m) out.memoryRef = m[1].trim();
          wantMemoryText = true;
          return;
        }
        if (wantMemoryText) {
          // "행13:52 제자들은 …" 처럼 구절과 말씀이 한 줄에 있는 경우도 받아 줌
          if (!out.memoryRef && (m = t.match(/^([가-힣]{1,6}\s?\d+\s?:\s?\d+(?:\s?[-~]\s?\d+)?)\s+(.+)$/))) { out.memoryRef = m[1]; out.memoryText = m[2]; }
          else out.memoryText = (out.memoryText ? out.memoryText + ' ' : '') + t;
          return;
        }
        return;
      }

      if (sec === 'news') {
        if ((m = t.match(/^[*＊]\s*(.+)$/))) { item = { title: m[1].trim(), body: '' }; out.news.push(item); return; }
        if (/^※/.test(t)) {
          const i = t.search(/[:：]/);
          item = i > 0 ? { title: t.slice(0, i).trim(), body: t.slice(i + 1).trim() } : { title: t, body: '' };
          out.news.push(item);
          return;
        }
        if (!item) { item = { title: '', body: '' }; out.news.push(item); }
        item.body += (item.body ? '\n' : '') + raw.replace(/^\s{3,}/, '  ');
        return;
      }

      if (sec === 'cell') {
        const numbered = /^\d+\s*[.)]\s*/.test(t);
        const asks = t.length <= 140 && /(봅시다|나눕시다|나눠\s?주세요|나눠요|까요|\?)\s*[.!]?$/.test(t);
        if (numbered || inQuestions || (asks && out.cell.length)) { inQuestions = true; out.questions.push(t.replace(/^\d+\s*[.)]\s*/, '')); }
        else out.cell.push(t);
        return;
      }

      if (sec === 'sched') {
        out.schedule.push(t.replace(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*/, '$1/$2 ').trim());
      }
    });
    return out;
  }

  // ---------- 한글(.hwp) 파일에서 글자만 꺼내기 ----------
  // 압축 풀기(deflate). 브라우저마다 내장 기능의 동작이 달라서 직접 풉니다.
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function inflateRaw(src) {
    let pos = 0, bitbuf = 0, bitcnt = 0, dp = 0;
    let dst = new Uint8Array(Math.max(4096, src.length * 4));
    const bad = () => { throw new Error('inflate'); };
    function need(n) {
      if (dp + n <= dst.length) return;
      const bigger = new Uint8Array(Math.max(dst.length * 2, dp + n));
      bigger.set(dst.subarray(0, dp)); dst = bigger;
    }
    function bits(n) {
      let v = bitbuf;
      while (bitcnt < n) { if (pos >= src.length) bad(); v |= src[pos++] << bitcnt; bitcnt += 8; }
      bitbuf = v >>> n; bitcnt -= n;
      return v & ((1 << n) - 1);
    }
    function table(lengths, off, n) {
      const count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16);
      for (let i = 0; i < n; i++) count[lengths[off + i]]++;
      for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l];
      for (let i = 0; i < n; i++) if (lengths[off + i]) symbol[offs[lengths[off + i]]++] = i;
      return { count, symbol };
    }
    function decode(h) {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len <= 15; len++) {
        code |= bits(1);
        const count = h.count[len];
        if (code - count < first) return h.symbol[index + (code - first)];
        index += count; first += count; first <<= 1; code <<= 1;
      }
      return bad();
    }
    function codes(lc, dc) {
      for (;;) {
        let sym = decode(lc);
        if (sym < 256) { need(1); dst[dp++] = sym; continue; }
        if (sym === 256) return;
        sym -= 257;
        if (sym >= 29) bad();
        const len = LBASE[sym] + bits(LEXT[sym]);
        const ds = decode(dc);
        if (ds >= 30) bad();
        const dist = DBASE[ds] + bits(DEXT[ds]);
        if (dist > dp) bad();
        need(len);
        for (let i = 0; i < len; i++, dp++) dst[dp] = dst[dp - dist];
      }
    }
    let last;
    do {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        bitbuf = 0; bitcnt = 0;
        if (pos + 4 > src.length) bad();
        const len = src[pos] | (src[pos + 1] << 8); pos += 4;
        if (pos + len > src.length) bad();
        need(len); dst.set(src.subarray(pos, pos + len), dp); dp += len; pos += len;
      } else if (type === 1) {
        const lengths = new Uint8Array(318);
        lengths.fill(8, 0, 144); lengths.fill(9, 144, 256); lengths.fill(7, 256, 280); lengths.fill(8, 280, 288); lengths.fill(5, 288, 318);
        codes(table(lengths, 0, 288), table(lengths, 288, 30));
      } else if (type === 2) {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        if (nlen > 286 || ndist > 30) bad();
        const lengths = new Uint8Array(320);
        for (let i = 0; i < ncode; i++) lengths[ORDER[i]] = bits(3);
        const lc = table(lengths, 0, 19);
        lengths.fill(0);
        for (let idx = 0; idx < nlen + ndist;) {
          const sym = decode(lc);
          if (sym < 16) { lengths[idx++] = sym; continue; }
          let len = 0, rep;
          if (sym === 16) { if (!idx) bad(); len = lengths[idx - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (idx + rep > nlen + ndist) bad();
          while (rep--) lengths[idx++] = len;
        }
        codes(table(lengths, 0, nlen), table(lengths, nlen, ndist));
      } else bad();
    } while (!last);
    return dst.subarray(0, dp);
  }
  function concat(parts, size) {
    let total = 0; parts.forEach((p) => { total += p.length; });
    const out = new Uint8Array(total); let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return size != null && size < total ? out.subarray(0, size) : out;
  }

  async function readHwp(buffer) {
    const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
    if (u8.length < 512 || dv.getUint32(0) !== 0xD0CF11E0 || dv.getUint32(4) !== 0xA1B11AE1) throw new Error('not-hwp');
    const ssz = 1 << dv.getUint16(30, true), per = ssz / 4;
    const dirStart = dv.getInt32(48, true), miniCutoff = dv.getUint32(56, true), miniFatStart = dv.getInt32(60, true);
    const off = (n) => (n + 1) * ssz;
    const ok = (n) => n >= 0 && off(n) + ssz <= u8.length;

    // 파일 안의 조각(섹터) 연결표
    const fatSecs = [];
    for (let i = 0; i < 109; i++) { const s = dv.getInt32(76 + i * 4, true); if (s >= 0) fatSecs.push(s); }
    for (let ds = dv.getInt32(68, true), g = 0; ok(ds) && g < 4096; g++) {
      for (let i = 0; i < per - 1; i++) { const s = dv.getInt32(off(ds) + i * 4, true); if (s >= 0) fatSecs.push(s); }
      ds = dv.getInt32(off(ds) + ssz - 4, true);
    }
    const next = (n) => { const fs = fatSecs[Math.floor(n / per)]; return ok(fs) ? dv.getInt32(off(fs) + (n % per) * 4, true) : -2; };
    function chain(start, size) {
      const parts = [];
      for (let s = start, g = 0; ok(s) && g < 1e6; g++) { parts.push(u8.subarray(off(s), off(s) + ssz)); s = next(s); }
      return concat(parts, size);
    }

    // 목록(디렉터리)
    const dir = chain(dirStart), ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength), entries = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const len = Math.max(0, Math.min(64, ddv.getUint16(o + 64, true)) - 2);
      let name = '';
      for (let i = 0; i < len; i += 2) name += String.fromCharCode(ddv.getUint16(o + i, true));
      entries.push({ name, type: dir[o + 66], left: ddv.getInt32(o + 68, true), right: ddv.getInt32(o + 72, true), child: ddv.getInt32(o + 76, true), start: ddv.getInt32(o + 116, true), size: ddv.getUint32(o + 120, true) });
    }
    const root = entries[0];
    if (!root) throw new Error('not-hwp');
    const mini = chain(root.start, root.size);
    const miniFat = chain(miniFatStart), mdv = new DataView(miniFat.buffer, miniFat.byteOffset, miniFat.byteLength);
    function read(e) {
      if (e.size >= miniCutoff) return chain(e.start, e.size);
      const parts = [];
      for (let s = e.start, g = 0; s >= 0 && (s + 1) * 64 <= mini.length && g < 1e6; g++) {
        parts.push(mini.subarray(s * 64, s * 64 + 64));
        s = s * 4 + 4 <= miniFat.length ? mdv.getInt32(s * 4, true) : -2;
      }
      return concat(parts, e.size);
    }
    function children(e) {
      const out = [], seen = {};
      (function walk(id) {
        if (id < 0 || id >= entries.length || seen[id]) return;
        seen[id] = 1; walk(entries[id].left); out.push(entries[id]); walk(entries[id].right);
      })(e.child);
      return out;
    }

    const top = children(root);
    const header = top.find((e) => e.name === 'FileHeader'), body = top.find((e) => e.name === 'BodyText');
    if (!header || !body) throw new Error('not-hwp');
    const flags = read(header)[36];
    if (flags & 2) throw new Error('password');
    const sections = children(body).filter((e) => /^Section\d+$/.test(e.name)).sort((a, b) => +a.name.slice(7) - +b.name.slice(7));

    const lines = [];
    for (const sec of sections) {
      let data = read(sec);
      if (flags & 1) data = inflateRaw(data);
      const sdv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i + 4 <= data.length;) {
        const h = sdv.getUint32(i, true); i += 4;
        const tag = h & 0x3ff; let size = h >>> 20;
        if (size === 0xfff) { size = sdv.getUint32(i, true); i += 4; }
        if (tag === 67) { // 문단 글자
          let s = '';
          for (let j = i; j + 2 <= i + size && j + 2 <= data.length;) {
            const c = sdv.getUint16(j, true); j += 2;
            if (c === 10) s += '\n';
            else if (c === 13 || c === 0) continue;
            else if (c === 9) { s += '\t'; j += 14; }
            else if (c < 24) j += 14;            // 표·그림 같은 조판 부호는 건너뜀
            else if (c < 32) s += c === 24 ? '-' : ' ';
            else s += String.fromCharCode(c);
          }
          lines.push(s);
        }
        i += size;
      }
    }
    return lines.join('\n');
  }

  const api = { parse, readHwp, shortRef };
  if (typeof window !== 'undefined') window.Manuscript = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
