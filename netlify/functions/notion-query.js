exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const DB_ID = process.env.NOTION_DB_ID;
    const { name } = JSON.parse(event.body);

    if (!name) return { statusCode: 400, headers, body: JSON.stringify({ error: '이름을 입력해주세요.' }) };

    // contains로 가져온 후 클라이언트에서 정확히 일치하는 것만 필터
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: '이름',
          title: { contains: name }
        },
        sorts: [{ property: '제출일', direction: 'descending' }],
        page_size: 100
      })
    });

    const data = await notionRes.json();
    if (!notionRes.ok) throw new Error(data.message || 'Notion API error');

    const records = (data.results || [])
      .map(page => {
        const p = page.properties;
        return {
          name:     p['이름']?.title?.[0]?.plain_text || '',
          school:   p['학교']?.rich_text?.[0]?.plain_text || '',
          grade:    p['학년']?.rich_text?.[0]?.plain_text || '',
          workbook: p['워크북']?.rich_text?.[0]?.plain_text || '',
          category: p['카테고리']?.rich_text?.[0]?.plain_text || '',
          date:     p['제출일']?.date?.start || ''
        };
      })
      .filter(r => r.name === name); // 정확히 일치하는 이름만

    return { statusCode: 200, headers, body: JSON.stringify({ records }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
