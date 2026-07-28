// פרוקסי בטוח לצ'אט העזרה של מציה.
// דורש משתנה סביבה GEMINI_API_KEY ב-Netlify (מפתח מ-https://aistudio.google.com/apikey).
// המפתח נשאר בצד השרת בלבד — לעולם לא נשלח לדפדפן.

const { getAdmin, jsonResponse } = require('./_firebase-admin');

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'חסר משתנה סביבה GEMINI_API_KEY' });

    const contextLine = lessonTitle ? `\n\nהילד/ה כרגע בשיעור: "${lessonTitle}".` : '';

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT + contextLine }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
        })
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return jsonResponse(502, { error: 'שגיאה מול שירות ה-AI: ' + errText.slice(0, 200) });
    }

    const data = await resp.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || 'אופס, לא הצלחתי לחשוב על תשובה עכשיו... נסו שוב? 😊';

    return jsonResponse(200, { reply });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
