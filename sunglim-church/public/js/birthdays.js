// 생일 명단에서 그 주 생일자를 찾습니다. 음력 생일은 해마다 양력으로 바꿔서 계산합니다.
(function () {
  // 브라우저에 들어 있는 한국 음력 달력(단기력)을 사용
  const lunarFmt = (function () {
    try {
      const f = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
      return f.resolvedOptions().calendar === 'dangi' ? f : null;
    } catch (e) { return null; }
  })();
  const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));

  // 양력 날짜 → 음력 {m, d, leap(윤달)}
  function lunarOf(date) {
    if (!lunarFmt) return null;
    const parts = lunarFmt.formatToParts(date);
    const mo = parts.find((p) => p.type === 'month').value, da = parts.find((p) => p.type === 'day').value;
    return { m: parseInt(mo.replace(/\D/g, ''), 10), d: parseInt(da, 10), leap: /\D/.test(mo) };
  }

  // 이 양력 날짜가 그 사람의 생일인지
  function isBirthday(p, date) {
    const m = date.getUTCMonth() + 1, d = date.getUTCDate();
    if (!p.lunar) {
      if (p.month === m && p.day === d) return true;
      // 2월 29일생은 평년에는 2월 28일에
      return p.month === 2 && p.day === 29 && m === 2 && d === 28 && day(date.getUTCFullYear(), 2, 29).getUTCMonth() !== 1;
    }
    const lu = lunarOf(date);
    if (!lu || lu.leap || lu.m !== p.month) return false; // 윤달은 건너뛰고 평달에 맞춤
    if (lu.d === p.day) return true;
    // 음력 30일생인데 올해 그 달이 29일까지뿐이면 마지막 날에
    const next = lunarOf(new Date(date.getTime() + 86400000));
    return p.day > lu.d && !!next && next.d === 1;
  }

  // startIso(주일)부터 days일 동안의 생일자 → [{date:'11/26', name}]
  function inRange(list, startIso, days) {
    const s = startIso.split('-').map(Number), out = [];
    for (let i = 0; i < days; i++) {
      const dt = day(s[0], s[1], s[2] + i);
      (list || []).forEach((p) => { if (isBirthday(p, dt)) out.push({ date: (dt.getUTCMonth() + 1) + '/' + dt.getUTCDate(), name: p.name }); });
    }
    return out;
  }
  const toText = (rows) => rows.map((r) => r.date + ' ' + r.name).join('\n');

  // 음력 생일이 올해 양력으로 며칠인지 (명단 화면에 보여 주는 용도)
  function solarDates(p, year) {
    const out = [];
    for (let dt = day(year, 1, 1); dt.getUTCFullYear() === year; dt = new Date(dt.getTime() + 86400000)) {
      if (isBirthday(p, dt)) out.push((dt.getUTCMonth() + 1) + '/' + dt.getUTCDate());
    }
    return out;
  }

  // 엑셀에서 복사한 표 읽기: 이름 · 날짜 · (음력 표시)
  function parsePaste(text) {
    const out = [];
    (text || '').split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      let cells = line.split('\t');
      if (cells.length < 2) cells = line.split(/\s*[,|]\s*|\s{2,}/);
      cells = cells.map((c) => c.trim()).filter(Boolean);
      const di = cells.findIndex((c) => /\d{1,2}\s*[.\-\/월]\s*\d{1,2}/.test(c));
      if (di < 0) return; // 제목 줄 등
      const m = cells[di].match(/(?:\d{4}\s*[.\-\/년]\s*)?(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
      const month = +m[1], dd = +m[2];
      if (!(month >= 1 && month <= 12 && dd >= 1 && dd <= 31)) return;
      const name = cells.find((c, i) => i !== di && !/^[(\[]?\s*(음력?|양력?|[oOvV✓●]|-)\s*[)\]]?$/.test(c));
      if (!name) return;
      const lunar = cells.some((c) => c !== name && /음/.test(c));
      out.push({ name, month, day: dd, lunar });
    });
    return out;
  }

  const api = { inRange, toText, solarDates, parsePaste, lunarOk: !!lunarFmt };
  if (typeof window !== 'undefined') window.Birthdays = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
