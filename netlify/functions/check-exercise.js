// בודק תרגילי קוד (Python/Pygame) בעזרת AI — לא מריץ את הקוד בפועל, אלא
// מעריך אותו מול מטרת התרגיל, בסלחנות, ומסביר טעויות בעדינות.
// דורש משתנה סביבה OPENROUTER_API_KEY (אותו מפתח כמו ai-chat / debug-helper).

const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');

const SYSTEM_PROMPT = `את מציה, בודקת תרגילי קוד Python/Pygame לילדים שלומדים
לתכנת בפעם הראשונה. תפקידך לבדוק אם הקוד שהילד/ה כתב/ה עונה על מטרת התרגיל.

עקרונות בדיקה — חשוב מאוד לעקוב אחריהם:
- היי סלחנית לגבי סגנון, שמות משתנים, רווחים, הערות, או כל דרך חלופית
  תקינה להגיע לאותה מטרה. בודקים את הרעיון, לא שהקוד זהה מילה במילה
  לאיזשהו "פתרון מושלם" דמיוני.
- אל תהיי קפדנית מדי. אם הרעיון הכללי נכון וזה בעיקרון עונה על מטרת
  התרגיל — אישרי, גם אם יש דברים קטנים שאפשר לשפר.
- אם יש טעות שבאמת מונעת מהקוד לעבוד (שם פונקציה שגוי, פרמטר חסר,
  סוגריים/מרכאות לא סגורים, הזחה שגויה, שכחת שורה חשובה) — לא לאשר, אבל
  להסביר בעדינות ובקצרה מה הבעיה ואיך לתקן. תני רמז ממוקד וברור, אבל
  אל תכתבי את השורה המתוקנת המלאה — תני לילד/ה להגיע לזה בעצמו/ה.
- קוד ריק, או קוד שמעתיק בדיוק את קוד ההתחלה בלי שום שינוי — לא לאשר.

חובה לענות במבנה קבוע מדויק, שתי שורות:
שורה ראשונה: בדיוק המילה PASS או בדיוק המילה NEEDS_WORK (בלי כלום נוסף בשורה הזו)
שורה שנייה ואילך: הסבר קצר (1-3 משפטים), בעברית פשוטה, בגובה העיניים של
ילד/ה, עם אימוג'י שמח אחד. אם NEEDS_WORK — ההסבר חייב לכלול גם מה לא
נכון וגם רמז לאיך לתקן.`;

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

    const { code, taskDescription, hints } = JSON.parse(event.body || '{}');
    if (!code || typeof code !== 'string' || code.length > 3000) {
      return jsonResponse(400, { error: 'קוד לא תקין (חסר או ארוך מדי)' });
    }
    if (!taskDescription || typeof taskDescription !== 'string') {
      return jsonResponse(400, { error: 'חסר תיאור תרגיל' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'חסר משתנה סביבה OPENROUTER_API_KEY' });

    const userContent = `מטרת התרגיל:\n${taskDescription}\n` +
      (hints ? `דגשים לבדיקה:\n${hints}\n` : '') +
      `\nהקוד שהילד/ה כתב/ה:\n${code}`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://matzia-site.netlify.app',
        'X-Title': 'Matzia Exercise Checker'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        max_tokens: 220,
        temperature: 0.3
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenRouter error (check-exercise)', resp.status, errText.slice(0, 500));
      return jsonResponse(502, { error: 'שגיאה מול שירות ה-AI: ' + errText.slice(0, 200) });
    }

    const data = await resp.json();
    const raw = (data?.choices?.[0]?.message?.content || '').trim();
    const firstLineEnd = raw.indexOf('\n');
    const verdictLine = (firstLineEnd === -1 ? raw : raw.slice(0, firstLineEnd)).trim().toUpperCase();
    const explanation = (firstLineEnd === -1 ? '' : raw.slice(firstLineEnd + 1).trim())
      || 'מעולה! זה נכון ✅';

    const passed = verdictLine.startsWith('PASS');
    return jsonResponse(200, { passed, feedback: explanation });
  } catch (err) {
    console.error('check-exercise handler error', err);
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
