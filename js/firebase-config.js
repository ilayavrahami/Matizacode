// פרטי הפרויקט של מציה ב-Firebase
// Project Settings → General → "Your apps" → Web app → firebaseConfig

const firebaseConfig = {
  apiKey: "AIzaSyBho4nYaPZJiDIRGS99rVIK0KJopIW7VFQ",
  authDomain: "matzia-comic-code.firebaseapp.com",
  projectId: "matzia-comic-code",
  storageBucket: "matzia-comic-code.firebasestorage.app",
  messagingSenderId: "210381500588",
  appId: "1:210381500588:web:327f6476fd3671e93eef09"
};

// אתחול האפליקציה הראשית (session רגיל)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// כדי ש-username "יעבוד" עם Firebase Auth (שדורש email),
// כל שם משתמש הופך פנימית ל-username@matzia.local
function usernameToEmail(username) {
  return username.trim().toLowerCase() + "@matzia.local";
}
