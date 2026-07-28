const { requireAdminCaller, jsonResponse } = require('./_firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const { admin, callerUid } = await requireAdminCaller(event);
    const { uid } = JSON.parse(event.body || '{}');

    if (!uid) {
      return jsonResponse(400, { error: 'חסר uid' });
    }
    if (uid === callerUid) {
      return jsonResponse(400, { error: 'אי אפשר למחוק את המשתמש המחובר כרגע' });
    }

    await admin.auth().deleteUser(uid).catch((err) => {
      // אם המשתמש כבר לא קיים ב-Auth, ממשיכים בכל זאת למחוק את מסמך Firestore
      if (err.code !== 'auth/user-not-found') throw err;
    });
    await admin.firestore().collection('users').doc(uid).delete();

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
