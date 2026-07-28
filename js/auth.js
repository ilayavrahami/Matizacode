// אם כבר מחובר — קפוץ ישר לרשימת השיעורים
auth.onAuthStateChanged((user) => {
  if (user && document.getElementById('login-form')) {
    window.location.href = 'dashboard.html';
  }
});

const form = document.getElementById('login-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = '';

    try {
      await auth.signInWithEmailAndPassword(usernameToEmail(username), password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      errorMsg.textContent = 'שם משתמש או סיסמה לא נכונים 😕 נסו שוב!';
    }
  });
}

function logout() {
  auth.signOut().then(() => window.location.href = 'index.html');
}

// שומר על דפים מוגנים — מפנה ל-login אם לא מחובר
function requireAuth(callback) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = 'index.html';
    } else {
      callback(user);
    }
  });
}
