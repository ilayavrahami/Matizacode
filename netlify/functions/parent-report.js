const { getAdmin, jsonResponse } = require('./_firebase-admin');

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

function fmtDate(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function buildEncouragement(displayName, completedCount, topics) {
  const name = displayName || 'הילד/ה';
  if (completedCount === 0) {
    return `${name} עוד בתחילת הדרך — כל התחלה היא הצעד הראשון להרפתקה גדולה! 🚀`;
  }
  const lastTopic = topics.length ? topics[topics.length - 1] : null;
  return lastTopic
    ? `${name} מתקדם/ת יפה מאוד ולמד/ה לאחרונה: "${lastTopic}"! מומלץ לבקש ממנו/ה להראות לכם מה בנה/תה 🎉`
    : `${name} מתקדם/ת יפה מאוד! מומלץ לבקש ממנו/ה לספר לכם על השיעור האחרון 🎉`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const admin = getAdmin();
    const db = admin.firestore();
    const { username, pin } = JSON.parse(event.body || '{}');

    if (!username || !pin) {
      return jsonResponse(400, { error: 'צריך שם משתמש וקוד PIN' });
    }

    const snap = await db.collection('users').where('username', '==', username.trim().toLowerCase()).limit(1).get();
    if (snap.empty) {
      return jsonResponse(404, { error: 'לא מצאנו תלמיד/ה עם שם המשתמש הזה' });
    }
    const userDoc = snap.docs[0];
    const u = userDoc.data();

    // הגנה בסיסית מפני ניחוש PIN באמצעות ניסיונות חוזרים
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

    const lessonsSnap = await db.collection('lessons').orderBy('order').get();
    const progress = u.progress || {};
    let completedCount = 0;
    const lessonRows = lessonsSnap.docs.map((doc) => {
      const l = doc.data();
      const entry = progress[doc.id];
      const done = !!entry;
      if (done) completedCount++;
      const isCurrent = u.currentLesson && u.currentLesson.id === doc.id;
      return {
        title: l.title,
        status: done ? 'done' : (isCurrent ? 'in_progress' : 'not_started'),
        completedAt: done && entry.completedAt ? fmtDate(entry.completedAt) : null,
        frameProgress: isCurrent ? `${u.currentLesson.frameIndex + 1}/${u.currentLesson.totalFrames}` : null
      };
    });

    const topics = u.topics || [];

    return jsonResponse(200, {
      displayName: u.displayName || u.username,
      totalLessons: lessonsSnap.size,
      completedCount,
      totalTimeMinutes: Math.round(u.totalTimeMinutes || 0),
      lastActive: fmtDate(u.lastActive),
      topics,
      lessons: lessonRows,
      encouragement: buildEncouragement(u.displayName, completedCount, topics)
    });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
