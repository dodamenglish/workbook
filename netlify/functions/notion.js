exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const NOTION_TOKEN = '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';
    const DB_ID = '374cbd70de1d80ad8126c56c890f34f4';

    const body = JSON.parse(event.body);
    const { name, school, grade, workbook, category, submitDate, wrongAnswers, screenshotBase64 } = body;

    // Notion 페이지 생성
    const notionBody = {
      parent: { database_id: DB_ID },
      properties: {
        '이름': { title: [{ text: { content: name || '' } }] },
        '학교': { rich_text: [{ text: { content: school || '' } }] },
        '학년': { rich_text: [{ text: { content: grade || '' } }] },
        '워크북': { rich_text: [{ text: { content: workbook || '' } }] },
        '카테고리': { rich_text: [{ text: { content: category || '' } }] },
        '제출일': { date: { start: submitDate || new Date().toISOString().split('T')[0] } },
        '오답내용': { rich_text: [{ text: { content: wrongAnswers || '' } }] }
      },
      children: []
    };

    // 스크린샷이 있으면 이미지 블록으로 추가
    if (screenshotBase64) {
      notionBody.children.push({
        object: 'block',
        type: 'image',
        image: {
          type: 'external',
          external: { url: `data:image/jpeg;base64,${screenshotBase64}` }
        }
      });
    }

    // 오답 텍스트도 블록으로 추가
    if (wrongAnswers) {
      notionBody.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: `📝 오답 상세:\n${wrongAnswers}` } }]
        }
      });
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notionBody)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.message || 'Notion API error' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, pageId: data.id })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
