// פרוקסי בטוח לצ'אט העזרה של מציה — דרך OpenRouter (ראו _openrouter.js
// למודלים בשימוש ולוגיקת הנפילה-אחורה).
// דורש משתנה סביבה OPENROUTER_API_KEY ב-Netlify (מפתח מ-https://openrouter.ai/keys).
// המפתח נשאר בצד השרת בלבד — לעולם לא נשלח לדפדפן.

const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');
const { callOpenRouter } = require('./_openrouter');

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

    const contextLine = lessonTitle ? `\n\nהילד/ה כרגע בשיעור: "${lessonTitle}".` : '';

    const reply = await callOpenRouter(
      [
        { role: 'system', content: SYSTEM_PROMPT + contextLine },
        { role: 'user', content: message }
      ],
      { maxTokens: 200, temperature: 0.7, title: 'Matzia Chat' }
    );

    return jsonResponse(200, { reply });
  } catch (err) {
    console.error('ai-chat handler error', err);
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
