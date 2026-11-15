// 인스타그램 "내 정보 다운로드"(JSON) 파서. 브라우저와 Node 양쪽에서 동작한다.
(function (root) {
  const RE_MESSAGE = /(?:^|\/)messages\/(inbox|message_requests)\/([^/]+)\/message_\d+\.json$/;
  const RE_SAVED_POSTS = /(?:^|\/)saved\/saved_posts\.json$/;
  const RE_SAVED_COLLECTIONS = /(?:^|\/)saved\/saved_collections\.json$/;
  const RE_PROFILE = /(?:^|\/)personal_information\/personal_information\.json$/;
  const RE_HTML_EXPORT = /(?:^|\/)(messages\/inbox\/[^/]+\/message_\d+|saved\/saved_posts)\.html$/;

  function isWanted(path) {
    return RE_MESSAGE.test(path) || RE_SAVED_POSTS.test(path) ||
      RE_SAVED_COLLECTIONS.test(path) || RE_PROFILE.test(path);
  }

  // 인스타그램 내보내기는 UTF-8 바이트를 Latin-1 문자로 잘못 적어 둔다. 되돌린다.
  function fixText(s) {
    if (typeof s !== 'string' || !s) return s || '';
    let high = false;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c > 0xff) return s; // 이미 정상적인 유니코드
      if (c > 0x7f) high = true;
    }
    if (!high) return s;
    try {
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      return s;
    }
  }

  function describeMessage(m) {
    const parts = [];
    const links = [];
    const text = fixText(m.content);
    if (text) parts.push(text);
    if (m.share) {
      if (m.share.link) links.push(m.share.link);
      const owner = fixText(m.share.original_content_owner);
      const shareText = fixText(m.share.share_text);
      if (owner) parts.push('[공유한 게시물 @' + owner + ']');
      if (shareText) parts.push(shareText);
    }
    const media = [
      ['photos', '사진'], ['videos', '동영상'], ['audio_files', '음성 메시지'],
      ['gifs', 'GIF'], ['files', '파일'],
    ];
    for (const [key, label] of media) {
      if (Array.isArray(m[key]) && m[key].length) parts.push('[' + label + ' ' + m[key].length + '개]');
    }
    if (m.sticker) parts.push('[스티커]');
    if (m.call_duration != null) parts.push('[통화 ' + m.call_duration + '초]');
    return { text: parts.join('\n') || '[내용 없는 메시지]', links };
  }

  // 여러 스레드에 가장 많이 등장하는 참가자가 계정 주인이다.
  function guessOwner(threads, profileName) {
    const counts = new Map();
    for (const t of threads) {
      for (const p of t.participants) counts.set(p, (counts.get(p) || 0) + 1);
    }
    if (profileName && counts.has(profileName)) return profileName;
    let best = '', bestCount = 0;
    for (const [name, n] of counts) {
      if (n > bestCount) { best = name; bestCount = n; }
    }
    return best;
  }

  // 구조가 버전마다 달라서(키가 한국어로 바뀌기도 함) 값의 모양으로 찾는다.
  function flatten(node, out) {
    out = out || { hrefs: [], timestamps: [], values: [] };
    if (Array.isArray(node)) {
      node.forEach((n) => flatten(n, out));
    } else if (node && typeof node === 'object') {
      if (typeof node.href === 'string' && node.href) out.hrefs.push(node.href);
      if (typeof node.timestamp === 'number' && node.timestamp > 0) out.timestamps.push(node.timestamp);
      if (typeof node.value === 'string' && node.value) out.values.push(fixText(node.value));
      for (const k of Object.keys(node)) {
        if (node[k] && typeof node[k] === 'object') flatten(node[k], out);
      }
    }
    return out;
  }

  function postKind(url) {
    if (/\/(reel|reels)\//.test(url)) return '릴스';
    if (/\/tv\//.test(url)) return '동영상';
    if (/\/p\//.test(url)) return '게시물';
    return '기타';
  }

  function normalizeUrl(url) {
    return url.split('?')[0].replace(/\/+$/, '') + '/';
  }

  function firstArray(json) {
    if (Array.isArray(json)) return json;
    for (const k of Object.keys(json || {})) if (Array.isArray(json[k])) return json[k];
    return [];
  }

  /**
   * files: [{ path, text: () => Promise<string> }]
   * 반환: { threads, saved, participants, owner, htmlExport }
   */
  async function parseExport(files) {
    const threadMap = new Map();
    const savedMap = new Map();
    let profileName = '';
    let htmlExport = false;

    for (const f of files) {
      const path = f.path.replace(/\\/g, '/');
      if (RE_HTML_EXPORT.test(path)) { htmlExport = true; continue; }
      if (!isWanted(path)) continue;
      let json;
      try { json = JSON.parse(await f.text()); } catch (e) { continue; }

      const mm = path.match(RE_MESSAGE);
      if (mm) {
        const key = mm[1] + '/' + mm[2];
        let t = threadMap.get(key);
        if (!t) {
          t = { key, folder: mm[1], title: '', participants: [], raw: [] };
          threadMap.set(key, t);
        }
        if (json.title) t.title = fixText(json.title);
        for (const p of json.participants || []) {
          const name = fixText(p.name);
          if (name && !t.participants.includes(name)) t.participants.push(name);
        }
        for (const m of json.messages || []) t.raw.push(m);
        continue;
      }

      if (RE_PROFILE.test(path)) {
        const user = firstArray(json)[0];
        const smd = (user && user.string_map_data) || {};
        const nameEntry = smd.Name || smd['이름'];
        if (nameEntry && nameEntry.value) profileName = fixText(nameEntry.value);
        continue;
      }

      if (RE_SAVED_POSTS.test(path)) {
        for (const item of firstArray(json)) {
          const flat = flatten(item);
          const href = flat.hrefs.find((h) => /instagram\.com/.test(h)) || flat.hrefs[0];
          if (!href) continue;
          const url = normalizeUrl(href);
          const author = fixText(item.title) || flat.values[0] || '';
          const prev = savedMap.get(url) || { url, author: '', savedAt: 0, collections: [], kind: postKind(url) };
          prev.author = prev.author || author;
          prev.savedAt = prev.savedAt || (flat.timestamps[0] || 0) * 1000;
          savedMap.set(url, prev);
        }
        continue;
      }

      if (RE_SAVED_COLLECTIONS.test(path)) {
        let current = '';
        for (const item of firstArray(json)) {
          const flat = flatten(item);
          const href = flat.hrefs.find((h) => /instagram\.com/.test(h));
          if (!href) { // 링크가 없으면 컬렉션 머리글
            current = flat.values[0] || fixText(item.title) || current;
            continue;
          }
          const url = normalizeUrl(href);
          const prev = savedMap.get(url) || { url, author: '', savedAt: 0, collections: [], kind: postKind(url) };
          prev.author = prev.author || flat.values[0] || '';
          prev.savedAt = prev.savedAt || (flat.timestamps[0] || 0) * 1000;
          if (current && !prev.collections.includes(current)) prev.collections.push(current);
          savedMap.set(url, prev);
        }
      }
    }

    const threads = [...threadMap.values()];
    const owner = guessOwner(threads, profileName);
    const participants = [...new Set(threads.flatMap((t) => t.participants))].sort();
    const saved = [...savedMap.values()].sort((a, b) => b.savedAt - a.savedAt);
    return { threads, saved, participants, owner, htmlExport };
  }

  // 받은 메시지만 남긴다(내가 보낸 것 제외). owner를 바꿔 다시 호출할 수 있다.
  function receivedThreads(threads, owner) {
    const result = [];
    for (const t of threads) {
      const messages = t.raw
        .filter((m) => fixText(m.sender_name) !== owner)
        .map((m) => {
          const d = describeMessage(m);
          return { sender: fixText(m.sender_name) || '(알 수 없음)', ts: m.timestamp_ms || 0, text: d.text, links: d.links };
        })
        .sort((a, b) => a.ts - b.ts);
      if (!messages.length) continue;
      const others = t.participants.filter((p) => p !== owner);
      result.push({
        key: t.key,
        folder: t.folder,
        title: t.title || others.join(', ') || t.key,
        isGroup: others.length > 1,
        messages,
        firstTs: messages[0].ts,
        lastTs: messages[messages.length - 1].ts,
      });
    }
    return result.sort((a, b) => b.lastTs - a.lastTs);
  }

  const api = { parseExport, receivedThreads, isWanted, fixText, RE_HTML_EXPORT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IGParser = api;
})(typeof self !== 'undefined' ? self : this);
