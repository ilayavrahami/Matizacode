// בדיקת תוכן אוטומטית — לשימוש עתידי בכל תכונת קהילה/פרסום (כמו Showcase).
// שלב 1: פילטר מהיר מבוסס מילון (מילים פוגעניות + זיהוי פרטים אישיים).
// שלב 2: אם שלב 1 עבר בשלום, בדיקת AI קלה שמאשרת/דוחה תוכן לא הולם בעברית/אנגלית.
// דורש משתנה סביבה OPENROUTER_API_KEY (אותו מפתח כמו ai-chat / debug-helper).

const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');

// רשימת מילים חסומות בסיסית — יש להרחיב לפי הצורך. שומרים קצר בכוונה כאן.
const BLOCKED_WORDS = [
  // דוגמאות בלבד — יש להוסיף רשימה מלאה בהתאם למדיניות בפועל
  'זונה', 'מניאק', 'שרמוטה', 'fuck', 'shit', 'bitch', 'porn', 'nude'
];

const PII_PATTERNS = [
  /\b\d{9,10}\b/,                          // מספרי טלפון/ת.ז ישראליים (9-10 ספרות ברצף)
  /\b\d{2,3}[-\s]?\d{7}\b/,                // טלפון עם מקף
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // כתובת אימייל
  /רחוב\s+\S+\s+\d+/,                       // "רחוב X 12"
  /בית ספר\s+\S+/                           // שם בית ספר
];

function regexCheck(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const w of BLOCKED_WORDS) {
    if (lower.includes(w.toLowerCase())) return `נמצאה מילה לא מתאימה: "${w}"`;
  }
  for (const p of PII_PATTERNS) {
    if (p.test(text)) return 'נמצא מידע אישי מזהה (טלפון/אימייל/כתובת) שאסור לפרסם';
  }
  return null;
}

const MODERATION_SYSTEM_PROMPT = `את מסננת תוכן אוטומטית לפלטפורמה קהילתית של ילדים
שלומדים תכנות. תפקידך לבדוק אם טקסט (שם משחק, תיאור, או קוד) מתאים לפרסום.

דחי תוכן אם הוא כולל: קללות, אלימות גרפית, תוכן מיני, הטרדה, גזענות, קידום
פגיעה עצמית, פרטים אישיים מזהים, או ניסיון לגרום למשתמשים אחרים לצאת מהאתר
או לתקשר בערוץ חיצוני לא מפוקח.

עני אך ורק במילה אחת: APPROVE או REJECT. אם REJECT — הוסיפי אחריה נקודתיים
וסיבה קצרה מאוד בעברית (עד 8 מילים). שום דבר אחר.`;

async function aiCheck(text) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { approved: true, reason: null }; // אין מפתח מוגדר — לא חוסמים בגלל זה, רק הפילטר הבסיסי פעיל

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://matzia-site.netlify.app',
      'X-Title': 'Matzia Moderation'
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        { role: 'system', content: MODERATION_SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 2000) }
      ],
      max_tokens: 40,
      temperature: 0
    })
  });

  if (!resp.ok) {
    console.error('moderation AI error', resp.status, await resp.text());
    return { approved: true, reason: null }; // כשל בשירות ה-AI — לא חוסמים, רק לוגים לבדיקה ידנית מאוחר יותר
  }

  const data = await resp.json();
  const verdict = (data?.choices?.[0]?.message?.content || '').trim();
  if (verdict.toUpperCase().startsWith('REJECT')) {
    return { approved: false, reason: verdict.split(':').slice(1).join(':').trim() || 'תוכן לא מתאים' };
  }
  return { approved: true, reason: null };
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

    const { title, description, code } = JSON.parse(event.body || '{}');
    const combinedText = [title, description].filter(Boolean).join('\n');

    const regexHit = regexCheck(combinedText) || regexCheck(code);
    if (regexHit) {
      return jsonResponse(200, { approved: false, reason: regexHit, stage: 'regex' });
    }

    const aiResult = await aiCheck(combinedText || code || '');
    return jsonResponse(200, { ...aiResult, stage: 'ai' });
  } catch (err) {
    console.error('moderate-content handler error', err);
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
