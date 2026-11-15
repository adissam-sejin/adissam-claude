// 로컬 실행용 서버: public/ 정적 파일 + /api/notion 프록시. 의존성 없음.
const http = require('http');
const fs = require('fs');
const path = require('path');
const notion = require('./api/notion');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/notion') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { req.body = JSON.parse(data || '{}'); } catch (e) { req.body = {}; }
      notion(req, res);
    });
    return;
  }
  const file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.end(buf);
  });
}).listen(process.env.PORT || 3000, () => {
  console.log('http://localhost:' + (process.env.PORT || 3000));
});
