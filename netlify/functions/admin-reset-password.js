const { requireAdminCaller, jsonResponse } = require('./_firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const { admin } = await requireAdminCaller(event);
    const { uid, newPassword } = JSON.parse(event.body || '{}');

    if (!uid || !newPassword || newPassword.length < 6) {
      return jsonResponse(400, { error: 'צריך uid וסיסמה חדשה (לפחות 6 תווים)' });
    }

    await admin.auth().updateUser(uid, { password: newPassword });
    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message });
  }
};
