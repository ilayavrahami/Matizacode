// אתחול משותף של Firebase Admin SDK לכל ה-Netlify Functions
// דורש משתנה סביבה בשם FIREBASE_SERVICE_ACCOUNT ב-Netlify (Site settings →
// Environment variables) שמכיל את תוכן קובץ ה-JSON של ה-Service Account
// כמחרוזת אחת (ראו README לחלק "הקמת Netlify Functions").

const admin = require('firebase-admin');

function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('חסר משתנה סביבה FIREBASE_SERVICE_ACCOUNT ב-Netlify');
    }
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin;
}

// מוודא שהמבקש שולח Authorization: Bearer <idToken> תקין, ושה-uid שלו
// מסומן כ-isAdmin:true ב-Firestore. זורק שגיאה אם לא.
async function requireAdminCaller(event) {
  const fbAdmin = getAdmin();
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) {
    const err = new Error('לא סופק טוקן הזדהות');
    err.statusCode = 401;
    throw err;
  }

  const decoded = await fbAdmin.auth().verifyIdToken(idToken);
  const callerDoc = await fbAdmin.firestore().collection('users').doc(decoded.uid).get();
  if (!callerDoc.exists || callerDoc.data().isAdmin !== true) {
    const err = new Error('גישה נדחתה — נדרשת הרשאת מנהל');
    err.statusCode = 403;
    throw err;
  }
  return { admin: fbAdmin, callerUid: decoded.uid };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body)
  };
}

module.exports = { getAdmin, requireAdminCaller, jsonResponse, CORS_HEADERS };
