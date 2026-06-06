// netlify/functions/github-write.js
// 역할: 파일 업로드 / meta.json 저장 / config.json 저장
// 환경변수: GITHUB_TOKEN, GH_USER, GH_REPO
//
// POST body:
//   { action: 'upload-file', fileName, content(base64), title }
//   { action: 'save-meta',   meta: { students, workbooks, submitCounts, submitHistory } }
//   { action: 'save-config', config: { gt, nt, ap } }

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const TOKEN = () => process.env.GITHUB_TOKEN;
const USER  = () => process.env.GH_USER;
const REPO  = () => process.env.GH_REPO;

// GitHub 파일에 SHA 조회 후 PUT (신규/갱신 공통)
async function ghPut(path, content, message, existingSha = null) {
  // SHA 없으면 먼저 조회
  let sha = existingSha;
  if (!sha) {
    const r = await fetch(
      `https://api.github.com/repos/${USER()}/${REPO()}/contents/${path}?t=${Date.now()}`,
      { headers: { 'Authorization': `token ${TOKEN()}` } }
    );
    if (r.ok) { const d = await r.json(); sha = d.sha; }
  }

  const body = { message, content };
  if (sha) body.sha = sha;

  // SHA 충돌 시 1회 재시도
  for (let i = 0; i < 2; i++) {
    const res = await fetch(
      `https://api.github.com/repos/${USER()}/${REPO()}/contents/${path}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `token ${TOKEN()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    if (res.ok) return { ok: true };
    const err = await res.json();
    if (res.status === 409 && i === 0) {
      // SHA 충돌 → 최신 SHA 다시 가져와서 재시도
      const r2 = await fetch(
        `https://api.github.com/repos/${USER()}/${REPO()}/contents/${path}?t=${Date.now()}`,
        { headers: { 'Authorization': `token ${TOKEN()}` } }
      );
      if (r2.ok) { const d2 = await r2.json(); body.sha = d2.sha; }
      continue;
    }
    return { ok: false, error: err.message, status: res.status };
  }
  return { ok: false, error: 'SHA 충돌 재시도 실패' };
}

function toB64(obj) {
  return Buffer.from(JSON.stringify(obj, null, 2), 'utf-8').toString('base64');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  if (!TOKEN() || !USER() || !REPO()) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: '요청 형식 오류' }) }; }

  const { action } = body;

  try {
    // ── 파일 업로드 ──────────────────────────────────────────
    if (action === 'upload-file') {
      const { fileName, content, title } = body;
      if (!fileName || !content) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'fileName, content 필수' }) };

      const path = `workbooks/${Date.now()}_${fileName}`;
      const result = await ghPut(path, content, `Add: ${title || fileName}`);
      if (!result.ok) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: result.error }) };

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, path }) };
    }

    // ── meta.json 저장 ───────────────────────────────────────
    if (action === 'save-meta') {
      const { meta } = body;
      if (!meta) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'meta 필수' }) };

      const result = await ghPut('workbooks/meta.json', toB64(meta), 'Update meta');
      if (!result.ok) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: result.error }) };

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    }

    // ── config.json 저장 ─────────────────────────────────────
    if (action === 'save-config') {
      const { config } = body;
      if (!config) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'config 필수' }) };

      const result = await ghPut('config.json', toB64(config), 'Update config');
      if (!result.ok) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: result.error }) };

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `알 수 없는 action: ${action}` }) };

  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
