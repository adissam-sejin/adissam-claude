// 노션 API 프록시. 노션 API는 브라우저에서 직접 호출(CORS)할 수 없어서 서버를 거친다.
// 토큰은 요청 헤더(x-notion-token)로만 받고 서버에 저장하지 않는다.
const NOTION_BASE = process.env.NOTION_API_BASE || 'https://api.notion.com';
const ALLOWED = /^(users\/me|databases|databases\/[0-9a-f-]{32,36}(\/query)?|pages|pages\/[0-9a-f-]{32,36}|blocks\/[0-9a-f-]{32,36}\/children(\?page_size=100(&start_cursor=[0-9a-f-]{32,36})?)?)$/;

module.exports = async function handler(req, res) {
  const send = (status, obj) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return send(405, { message: 'POST만 지원합니다.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const token = req.headers['x-notion-token'];
  if (!token) return send(401, { message: '노션 토큰이 없습니다.' });

  const method = String(body.method || 'GET').toUpperCase();
  const path = String(body.path || '');
  if (!['GET', 'POST', 'PATCH'].includes(method) || !ALLOWED.test(path)) {
    return send(400, { message: '허용되지 않은 요청입니다.' });
  }

  try {
    const r = await fetch(NOTION_BASE + '/v1/' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(body.body || {}),
    });
    const retryAfter = r.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    const text = await r.text();
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(text || '{}');
  } catch (e) {
    send(502, { message: '노션 서버에 연결하지 못했습니다: ' + e.message });
  }
};
