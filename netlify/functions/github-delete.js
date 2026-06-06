// netlify/functions/github-delete.js
// 역할: 워크북 파일 삭제 + meta.json 갱신
// 환경변수: GITHUB_TOKEN, GH_USER, GH_REPO
//
// POST body: { path: 'workbooks/xxxx.html' }
// (meta 갱신은 클라이언트가 save-meta 호출로 별도 처리)

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const TOKEN = () => process.env.GITHUB_TOKEN;
const USER  = () => process.env.GH_USER;
const REPO  = () => process.env.GH_REPO;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  if (!TOKEN() || !USER() || !REPO()) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: '요청 형식 오류' }) }; }

  const { path, title } = body;
  if (!path) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'path 필수' }) };

  // 파일 경로 URL 인코딩 (공백, 괄호, 한글 등)
  const encodedPath = path.split('/').map(p => encodeURIComponent(p)).join('/');

  try {
    // SHA 조회
    const r = await fetch(
      `https://api.github.com/repos/${USER()}/${REPO()}/contents/${encodedPath}`,
      { headers: { 'Authorization': `token ${TOKEN()}` } }
    );

    if (r.status === 404) {
      // 이미 없는 파일 → 성공으로 처리
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, skipped: true }) };
    }
    if (!r.ok) {
      const err = await r.json();
      return { statusCode: r.status, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }

    const d = await r.json();
    const sha = d.sha;

    // 삭제 요청
    const delRes = await fetch(
      `https://api.github.com/repos/${USER()}/${REPO()}/contents/${encodedPath}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `token ${TOKEN()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Delete: ${title || path}`, sha })
      }
    );

    if (!delRes.ok) {
      const err = await delRes.json();
      return { statusCode: delRes.status, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };

  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
