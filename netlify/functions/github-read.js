// netlify/functions/github-read.js
// 역할: meta.json 또는 config.json 읽기 (GET)
// 환경변수: GITHUB_TOKEN, GH_USER, GH_REPO

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const TOKEN = process.env.GITHUB_TOKEN;
  const USER  = process.env.GH_USER;
  const REPO  = process.env.GH_REPO;

  if (!TOKEN || !USER || !REPO) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: '서버 환경변수가 설정되지 않았습니다.' }) };
  }

  // ?file=meta  또는  ?file=config
  const file = event.queryStringParameters?.file || 'meta';
  const path = file === 'config' ? 'config.json' : 'workbooks/meta.json';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${USER}/${REPO}/contents/${path}?t=${Date.now()}`,
      { headers: { 'Authorization': `token ${TOKEN}` } }
    );

    if (res.status === 404) {
      // 파일이 아직 없음 - 빈 데이터 반환
      const empty = file === 'config'
        ? { gt: '', nt: '', ap: '' }
        : { students: [], workbooks: [], submitCounts: {}, submitHistory: [] };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ data: empty, sha: null }) };
    }

    if (!res.ok) {
      const err = await res.json();
      return { statusCode: res.status, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }

    const d = await res.json();
    const decoded = JSON.parse(Buffer.from(d.content.replace(/\n/g, ''), 'base64').toString('utf-8'));
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ data: decoded, sha: d.sha }) };

  } catch (e) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
