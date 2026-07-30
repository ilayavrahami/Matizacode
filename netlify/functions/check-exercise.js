// בודק תרגילי קוד (Python/Pygame). שני שלבים:
// 1) בדיקה דטרמיניסטית — לפני כל קריאה ל-AI — שהקוד בכלל מכיל את אבני
//    הבניין הנדרשות (requiredPatterns שמוגדרים לכל תרגיל ב-lessons-data.js).
//    זו רשת ביטחון: גם אם מודל ה-AI "מקל" מדי, קוד שהוא בעצם רק ההערות
//    המקוריות בלי שום שינוי לעולם לא יאושר.
// 2) אם שלב 1 עבר — שאלת AI לבדיקה איכותית, בסלחנות, שמסבירה טעויות.
// דורש משתנה סביבה OPENROUTER_API_KEY (אותו מפתח כמו ai-chat / debug-helper).

const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');
const { callOpenRouter } = require('./_openrouter');

const SYSTEM_PROMPT = `את מציה, בודקת תרגילי קוד Python/Pygame לילדים שלומדים
לתכנת בפעם הראשונה. תפקידך לבדוק אם הקוד שהילד/ה כתב/ה עונה על מטרת התרגיל.
כבר וידאנו קודם שהקוד מכיל את אבני הבניין הבסיסיות הנדרשות — תפקידך עכשיו
הוא לבדוק שהם משולבים נכון (למשל בסדר הנכון, בתוך הלולאה ולא מחוצה לה).

עקרונות בדיקה — חשוב מאוד לעקוב אחריהם:
- היי סלחנית לגבי סגנון, שמות משתנים, רווחים, הערות, או כל דרך חלופית
  תקינה להגיע לאותה מטרה. בודקים את הרעיון, לא שהקוד זהה מילה במילה
  לאיזשהו "פתרון מושלם" דמיוני.
- אל תהיי קפדנית מדי. אם הרעיון הכללי נכון וזה בעיקרון עונה על מטרת
  התרגיל — אישרי, גם אם יש דברים קטנים שאפשר לשפר.
- אם יש טעות שבאמת מונעת מהקוד לעבוד (סדר שגוי, הזחה שגויה, מיקום לא
  נכון של שורה) — לא לאשר, אבל להסביר בעדינות ובקצרה מה הבעיה ואיך
  לתקן. תני רמז ממוקד וברור, אבל אל תכתבי את השורה המתוקנת המלאה —
  תני לילד/ה להגיע לזה בעצמו/ה.

חובה לענות במבנה קבוע מדויק, שתי שורות:
שורה ראשונה: בדיוק המילה PASS או בדיוק המילה NEEDS_WORK (בלי כלום נוסף בשורה הזו)
שורה שנייה ואילך: הסבר קצר (1-3 משפטים), בעברית פשוטה, בגובה העיניים של
ילד/ה, עם אימוג'י שמח אחד. אם NEEDS_WORK — ההסבר חייב לכלול גם מה לא
נכון וגם רמז לאיך לתקן.`;

// בדיקה דטרמיניסטית: כל requiredPatterns (מוגדרים לכל תרגיל) חייבים להופיע
// בקוד (case-insensitive). מחזיר את הרמז הראשון שחסר, או null אם הכל תקין.
function checkRequiredPatterns(code, requiredPatterns) {
  if (!Array.isArray(requiredPatterns) || !requiredPatterns.length) return null;
  const lowerCode = code.toLowerCase();
  for (const item of requiredPatterns) {
    const needle = (item.pattern || '').toLowerCase();
    if (needle && !lowerCode.includes(needle)) {
      return item.hint || `חסר בקוד: ${item.pattern}`;
    }
  }
  return null;
}

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

    const { code, taskDescription, hints, requiredPatterns, starterCode } = JSON.parse(event.body || '{}');
    if (!code || typeof code !== 'string' || code.length > 3000) {
      return jsonResponse(400, { error: 'קוד לא תקין (חסר או ארוך מדי)' });
    }
    if (!taskDescription || typeof taskDescription !== 'string') {
      return jsonResponse(400, { error: 'חסר תיאור תרגיל' });
    }

    // שלב 1: קוד זהה בדיוק לקוד ההתחלה — לא מאושר, לא משנה מה ה-AI היה חושב
    if (typeof starterCode === 'string' && code.trim() === starterCode.trim()) {
      return jsonResponse(200, {
        passed: false,
        feedback: 'עדיין לא רואים כאן שינוי מהקוד ההתחלתי — נסו לכתוב את החלק החסר במקומות שמסומנים בהערות 😊'
      });
    }

    // שלב 2: אבני הבניין הנדרשות
    const missingHint = checkRequiredPatterns(code, requiredPatterns);
    if (missingHint) {
      return jsonResponse(200, { passed: false, feedback: missingHint });
    }

    // שלב 3: בדיקת AI לאיכות/סדר נכון
    const userContent = `מטרת התרגיל:\n${taskDescription}\n` +
      (hints ? `דגשים לבדיקה:\n${hints}\n` : '') +
      `\nהקוד שהילד/ה כתב/ה:\n${code}`;

    const raw = await callOpenRouter(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      { maxTokens: 220, temperature: 0.3, title: 'Matzia Exercise Checker' }
    );

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
