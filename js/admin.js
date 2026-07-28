let adminUser = null;

requireAuth(async (user) => {
  const myDoc = await db.collection('users').doc(user.uid).get();
  const isAdmin = myDoc.exists && myDoc.data().isAdmin === true;

  if (!isAdmin) {
    document.getElementById('denied-wrap').style.display = 'block';
    return;
  }
  adminUser = user;
  document.getElementById('admin-wrap').style.display = 'block';
  renderUsers();
  renderProgress();
});

// קריאה בטוחה ל-Netlify Function עם טוקן הזדהות של המנהל
async function callAdminFunction(name, payload) {
  const idToken = await adminUser.getIdToken();
  const resp = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'שגיאה לא ידועה');
  return data;
}

// ===== רשימת משתמשים =====
async function renderUsers() {
  const snap = await db.collection('users').get();
  const listEl = document.getElementById('users-list');
  if (snap.empty) {
    listEl.innerHTML = '<p style="color:var(--text-dim)">אין עדיין משתמשים.</p>';
    return;
  }

  let rows = '';
  snap.forEach((doc) => {
    const u = doc.data();
    const uid = doc.id;
    rows += `
      <tr data-uid="${uid}">
        <td><input class="inline-rename field" style="margin-top:0;" value="${(u.displayName || '').replace(/"/g, '&quot;')}" data-uid="${uid}"></td>
        <td><span class="pill">${u.username || ''}</span></td>
        <td><span class="pill">${u.isAdmin ? 'מנהל' : 'תלמיד/ה'}</span></td>
        <td>
          <div class="row-actions">
            ${u.isAdmin ? '' : `
              <button class="btn-tiny turquoise" data-action="reset" data-uid="${uid}" data-name="${u.displayName || u.username}">🔑 איפוס סיסמה</button>
              <button class="btn-tiny yellow" data-action="pin" data-uid="${uid}" data-name="${u.displayName || u.username}" data-username="${u.username}">👪 קוד להורה</button>
              <button class="btn-tiny danger" data-action="delete" data-uid="${uid}" data-name="${u.displayName || u.username}">🗑️ מחיקה</button>
            `}
          </div>
        </td>
      </tr>`;
  });

  listEl.innerHTML = `
    <table class="users-table">
      <thead><tr><th>שם תצוגה</th><th>שם משתמש</th><th>סוג</th><th>פעולות</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // שינוי שם תצוגה — כתיבה ישירה ל-Firestore, מותר לפי חוקי האבטחה כי המנהל כותב
  listEl.querySelectorAll('.inline-rename').forEach((input) => {
    input.addEventListener('change', async () => {
      const uid = input.dataset.uid;
      try {
        await db.collection('users').doc(uid).set({ displayName: input.value.trim() }, { merge: true });
      } catch (err) {
        alert('שגיאה בשמירת השם: ' + err.message);
      }
    });
  });

  listEl.querySelectorAll('[data-action="reset"]').forEach((btn) => {
    btn.addEventListener('click', () => openResetModal(btn.dataset.uid, btn.dataset.name));
  });
  listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.uid, btn.dataset.name));
  });
  listEl.querySelectorAll('[data-action="pin"]').forEach((btn) => {
    btn.addEventListener('click', () => openPinModal(btn.dataset.uid, btn.dataset.name, btn.dataset.username));
  });
}

// ===== מודל: איפוס סיסמה =====
function openResetModal(uid, name) {
  document.getElementById('reset-modal-name').textContent = `עבור: ${name}`;
  document.getElementById('reset-new-password').value = '';
  document.getElementById('reset-modal-error').textContent = '';
  document.getElementById('reset-modal').dataset.uid = uid;
  document.getElementById('reset-modal').style.display = 'flex';
}
document.getElementById('reset-modal-cancel').addEventListener('click', () => {
  document.getElementById('reset-modal').style.display = 'none';
});
document.getElementById('reset-modal-confirm').addEventListener('click', async () => {
  const uid = document.getElementById('reset-modal').dataset.uid;
  const newPassword = document.getElementById('reset-new-password').value;
  const errorEl = document.getElementById('reset-modal-error');
  if (!newPassword || newPassword.length < 6) {
    errorEl.textContent = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    return;
  }
  try {
    await callAdminFunction('admin-reset-password', { uid, newPassword });
    document.getElementById('reset-modal').style.display = 'none';
    alert('הסיסמה אופסה בהצלחה ✅');
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ===== מודל: מחיקת משתמש =====
function openDeleteModal(uid, name) {
  document.getElementById('delete-modal-name').textContent = `למחוק את "${name}"?`;
  document.getElementById('delete-modal').dataset.uid = uid;
  document.getElementById('delete-modal').style.display = 'flex';
}
document.getElementById('delete-modal-cancel').addEventListener('click', () => {
  document.getElementById('delete-modal').style.display = 'none';
});
document.getElementById('delete-modal-confirm').addEventListener('click', async () => {
  const uid = document.getElementById('delete-modal').dataset.uid;
  try {
    await callAdminFunction('admin-delete-user', { uid });
    document.getElementById('delete-modal').style.display = 'none';
    renderUsers();
    renderProgress();
  } catch (err) {
    alert('שגיאה במחיקה: ' + err.message);
  }
});

// ===== מודל: קוד PIN להורה =====
async function openPinModal(uid, name, username) {
  document.getElementById('pin-modal-name').textContent = `עבור: ${name} (${username})`;
  document.getElementById('pin-modal-code').textContent = '...';
  document.getElementById('pin-modal').style.display = 'flex';

  const doc = await db.collection('users').doc(uid).get();
  let pin = doc.data().parentPin;
  if (!pin) {
    pin = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('users').doc(uid).set({ parentPin: pin }, { merge: true });
  }
  document.getElementById('pin-modal-code').textContent = pin;
}
document.getElementById('pin-modal-close').addEventListener('click', () => {
  document.getElementById('pin-modal').style.display = 'none';
});

// ===== יצירת משתמש חדש =====
document.getElementById('create-user-btn').addEventListener('click', async () => {
  const username = document.getElementById('new-username').value.trim();
  const displayName = document.getElementById('new-displayname').value.trim();
  const password = document.getElementById('new-password').value;
  const msg = document.getElementById('create-msg');
  msg.style.color = 'var(--turquoise)';
  msg.textContent = '';

  if (!username || !password) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'צריך למלא שם משתמש וסיסמה';
    return;
  }

  // חשוב: משתמשים ב-secondary app instance כדי ליצור את המשתמש
  // בלי לנתק את חשבון המנהל שמחובר כרגע בדפדפן
  try {
    const secondaryApp = firebase.apps.find(a => a.name === 'Secondary')
      || firebase.initializeApp(firebaseConfig, 'Secondary');
    const secondaryAuth = secondaryApp.auth();

    const cred = await secondaryAuth.createUserWithEmailAndPassword(
      usernameToEmail(username), password
    );

    await db.collection('users').doc(cred.user.uid).set({
      username, displayName, isAdmin: false, progress: {}
    });

    await secondaryAuth.signOut();

    msg.textContent = `נוצר בהצלחה! שם משתמש: ${username} 🎉`;
    document.getElementById('new-username').value = '';
    document.getElementById('new-displayname').value = '';
    document.getElementById('new-password').value = '';
    renderUsers();
    renderProgress();
  } catch (err) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'שגיאה: ' + err.message;
  }
});

document.getElementById('load-lessons-btn').addEventListener('click', async () => {
  const msg = document.getElementById('lessons-msg');
  try {
    await loadSeedLessons();
    msg.textContent = 'השיעורים נטענו בהצלחה! ✅';
  } catch (err) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'שגיאה: ' + err.message;
  }
});

// ===== טבלת התקדמות תלמידים =====
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

async function renderProgress() {
  const [usersSnap, lessonsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('lessons').get()
  ]);
  const totalLessons = lessonsSnap.size || 0;
  const listEl = document.getElementById('progress-list');

  const students = usersSnap.docs.filter((doc) => !doc.data().isAdmin);
  if (!students.length) {
    listEl.innerHTML = '<p style="color:var(--text-dim)">אין עדיין תלמידים.</p>';
    return;
  }

  let rows = '';
  students.forEach((doc) => {
    const u = doc.data();
    const progress = u.progress || {};
    const completedCount = Object.keys(progress).length;
    const pct = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
    const current = u.currentLesson
      ? `${u.currentLesson.title} (${u.currentLesson.frameIndex + 1}/${u.currentLesson.totalFrames})`
      : (completedCount === totalLessons && totalLessons ? 'סיים/ה הכל! 🏆' : '—');
    const minutes = Math.round(u.totalTimeMinutes || 0);

    rows += `
      <tr>
        <td>${u.displayName || u.username}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar-mini"><div style="width:${pct}%"></div></div>
            <span style="font-size:.8rem; color:var(--text-dim);">${completedCount}/${totalLessons}</span>
          </div>
        </td>
        <td style="font-size:.85rem;">${current}</td>
        <td style="font-size:.85rem;">${minutes} דק'</td>
        <td style="font-size:.8rem; color:var(--text-dim);">${fmtDate(u.lastActive)}</td>
      </tr>`;
  });

  listEl.innerHTML = `
    <table class="users-table">
      <thead><tr><th>תלמיד/ה</th><th>שיעורים</th><th>שיעור נוכחי</th><th>זמן למידה</th><th>פעילות אחרונה</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
