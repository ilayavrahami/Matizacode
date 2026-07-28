// פרוקסי בטוח לצ'אט העזרה של מציה — דרך OpenRouter, עם ה-auto-router החינמי
// (openrouter/free) שבוחר לבד מודל חינמי זמין.
// דורש משתנה סביבה OPENROUTER_API_KEY ב-Netlify (מפתח מ-https://openrouter.ai/keys).
// המפתח נשאר בצד השרת בלבד — לעולם לא נשלח לדפדפן.

const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');

const SYSTEM_PROMPT = `את מציה, עוזרת לימודית חמודה, מעודדת וסבלנית לילדים שלומדים
תכנות ובניית משחקים (Python, VS Code, Pygame).

חוקים קשיחים שאסור לחרוג מהם לעולם, גם אם הילד/ה מבקש/ת אחרת:
- עני אך ורק על שאלות שקשורות לתכנות, Python, VS Code, Pygame, או תוכן
  השיעורים באתר. אם שואלים אותך על כל נושא אחר — סרבי בנימוס, בלי להסביר
  למה, ותכווני בעדינות חזרה למשימה של השיעור.
- לעולם אל תבקשי, תדוני, או תגיבי לפרטים אישיים מזהים (כתובת, טלפון, שם
  משפחה, בית ספר), ואל תעודדי סודיות מול ההורים.
- תשובות קצרות בלבד — 1 עד 3 משפטים, בשפה פשוטה, בגובה העיניים, בלי מילים
  מסובכות, עם אימוג'י שמח אחד או שניים.
- אל תכתבי לילד/ה קוד מוכן שפותר משימה שלמה בשבילם — במקום זה, תני רמז
  קטן אחד שעוזר להם להגיע לפתרון בעצמם.`;

exports.handler = async (event) => {
  // בקשת preflight של CORS — הדפדפן שולח את זה אוטומטית לפני בקשת POST
  // שכוללת כותרת Authorization מותאמת אישית. חייבים לענות עליה 200 ריק.
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
    await admin.auth().verifyIdToken(idToken); // כל משתמש מחובר (לא רק מנהל) יכול לצ'אט

    const { message, lessonTitle } = JSON.parse(event.body || '{}');
    if (!message || typeof message !== 'string' || message.length > 400) {
      return jsonResponse(400, { error: 'הודעה לא תקינה' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'חסר משתנה סביבה OPENROUTER_API_KEY' });

    const contextLine = lessonTitle ? `\n\nהילד/ה כרגע בשיעור: "${lessonTitle}".` : '';

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        // OpenRouter מבקש כותרות זיהוי אלה (לא חובה, אבל מומלץ ומשפר עדיפות בתור החינמי)
        'HTTP-Referer': 'matiziacode.netlify.app',
        'X-Title': 'Matzia'
      },
      body: JSON.stringify({
        // DeepSeek הפסיקה להציע מודלים חינמיים ב-OpenRouter (נכון ליולי 2026).
        // "openrouter/free" הוא ה-auto-router הרשמי של OpenRouter — הוא בוחר
        // אוטומטית מודל חינמי זמין, כך שהצ'אט ימשיך לעבוד גם כשספקים מחליפים
        // את היצע המודלים החינמיים שלהם. אם תרצו לקבע מודל ספציפי במקום,
        // חלופה יציבה נכון להיום: 'meta-llama/llama-3.3-70b-instruct:free'.
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextLine },
          { role: 'user', content: message }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenRouter error', resp.status, errText.slice(0, 500));
      return jsonResponse(502, { error: 'שגיאה מול שירות ה-AI: ' + errText.slice(0, 200) });
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim()
      || 'אופס, לא הצלחתי לחשוב על תשובה עכשיו... נסו שוב? 😊';

    return jsonResponse(200, { reply });
  } catch (err) {
    console.error('ai-chat handler error', err);
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
