// מתרגם הודעות שגיאה של Python להסבר ידידותי לילדים, דרך OpenRouter.
// דורש משתנה סביבה OPENROUTER_API_KEY ב-Netlify (אותו מפתח כמו ai-chat).

const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');

const SYSTEM_PROMPT = `את מציה, עוזרת דיבאגינג חמודה וסבלנית לילדים שלומדים Python.
מקבלים ממך קטע קוד (אופציונלי) והודעת שגיאה אמיתית מ-Python (למשל
SyntaxError, NameError, IndexError, TypeError).

חוקים קשיחים:
- הסבירי במשפט או שניים, בעברית פשוטה, בגובה העיניים של ילד/ה, בלי מונחים
  מסובכים (אל תגידי "syntax", תגידי "איך כותבים את זה").
- אמרי בדיוק היכן/מה קרוב לוודאי הבעיה (למשל "כנראה שכחת לסגור סוגריים
  בשורה X" או "השם הזה לא הוגדר קודם בקוד"), אבל אל תכתבי את הקוד המתוקן
  המלא בשבילם — רק כיוון לתיקון, כדי שהם ילמדו לתקן לבד.
- סיימי תמיד בעידוד קצר ואימוג'י שמח אחד.
- אם הטקסט שקיבלת בכלל לא נראה כמו שגיאת Python אמיתית — אמרי בעדינות
  שלא זיהית שגיאת Python בטקסט, ותבקשי להעתיק את ההודעה המדויקת מהטרמינל.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const admin = getAdmin();
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) return jsonResponse(401, { error: 'לא סופק טוקן הזדהות' });
    await admin.auth().verifyIdToken(idToken);

    const { errorMessage, codeSnippet } = JSON.parse(event.body || '{}');
    if (!errorMessage || typeof errorMessage !== 'string' || errorMessage.length > 1500) {
      return jsonResponse(400, { error: 'צריך להדביק הודעת שגיאה (עד 1500 תווים)' });
    }
    const code = typeof codeSnippet === 'string' ? codeSnippet.slice(0, 1500) : '';

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'חסר משתנה סביבה OPENROUTER_API_KEY' });

    const userContent = code
      ? `הקוד:\n${code}\n\nהודעת השגיאה:\n${errorMessage}`
      : `הודעת השגיאה:\n${errorMessage}`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://matzia-site.netlify.app',
        'X-Title': 'Matzia Debug Helper'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        max_tokens: 220,
        temperature: 0.5
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenRouter error (debug-helper)', resp.status, errText.slice(0, 500));
      return jsonResponse(502, { error: 'שגיאה מול שירות ה-AI: ' + errText.slice(0, 200) });
    }

    const data = await resp.json();
    const explanation = data?.choices?.[0]?.message?.content?.trim()
      || 'אופס, לא הצלחתי להבין את השגיאה הזו... נסו להדביק אותה שוב 😅';

    return jsonResponse(200, { explanation });
  } catch (err) {
    console.error('debug-helper handler error', err);
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
