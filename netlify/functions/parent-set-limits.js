const { getAdmin, jsonResponse, CORS_HEADERS } = require('./_firebase-admin');

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const admin = getAdmin();
    const db = admin.firestore();
    const { username, pin, dailyMinutes, weeklyMinutes } = JSON.parse(event.body || '{}');

    if (!username || !pin) {
      return jsonResponse(400, { error: 'צריך שם משתמש וקוד PIN' });
    }
    // ולידציה: מספר חיובי או null (ללא הגבלה)
    const daily = dailyMinutes === null || dailyMinutes === '' ? null : Number(dailyMinutes);
    const weekly = weeklyMinutes === null || weeklyMinutes === '' ? null : Number(weeklyMinutes);
    if ((daily !== null && (!Number.isFinite(daily) || daily < 0)) ||
        (weekly !== null && (!Number.isFinite(weekly) || weekly < 0))) {
      return jsonResponse(400, { error: 'ערכי הזמן חייבים להיות מספרים חיוביים או ריקים' });
    }

    const snap = await db.collection('users').where('username', '==', username.trim().toLowerCase()).limit(1).get();
    if (snap.empty) {
      return jsonResponse(404, { error: 'לא מצאנו תלמיד/ה עם שם המשתמש הזה' });
    }
    const userDoc = snap.docs[0];
    const u = userDoc.data();

    const now = Date.now();
    if (u.parentPinLockUntil && u.parentPinLockUntil > now) {
      return jsonResponse(429, { error: 'יותר מדי ניסיונות — נסו שוב בעוד כמה דקות' });
    }
    if (!u.parentPin || String(u.parentPin) !== String(pin)) {
      const attempts = (u.parentPinAttempts || 0) + 1;
      const patch = { parentPinAttempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        patch.parentPinLockUntil = now + LOCK_MINUTES * 60000;
        patch.parentPinAttempts = 0;
      }
      await userDoc.ref.update(patch);
      return jsonResponse(403, { error: 'קוד PIN שגוי' });
    }
    await userDoc.ref.update({ parentPinAttempts: 0, parentPinLockUntil: admin.firestore.FieldValue.delete() });

    await userDoc.ref.set({ limits: { dailyMinutes: daily, weeklyMinutes: weekly } }, { merge: true });

    return jsonResponse(200, { ok: true, limits: { dailyMinutes: daily, weeklyMinutes: weekly } });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
