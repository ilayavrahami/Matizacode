// ===== ניהול זמנים / הגבלות הורים =====
// מפתחות תקופה: יום = YYYY-MM-DD מקומי. שבוע = תאריך יום ראשון האחרון (YYYY-MM-DD),
// כלומר כל השבוע (ראשון עד שבת) חולק אותו מפתח.

function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekKey(d = new Date()) {
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return todayKey(sunday);
}

// קורא את המסמך ומחזיר את דקות השימוש בתקופה הנוכחית (0 אם התקופה השתנתה)
function currentUsage(u) {
  const daily = (u.usage && u.usage.daily && u.usage.daily.date === todayKey()) ? u.usage.daily.minutes : 0;
  const weekly = (u.usage && u.usage.weekly && u.usage.weekly.weekStart === weekKey()) ? u.usage.weekly.minutes : 0;
  return { daily, weekly };
}

// בודק אם המשתמש חרג ממגבלה. מחזיר null אם הכל תקין, או 'daily'/'weekly' אם חסום.
function checkLimitStatus(u) {
  if (!u.limits) return null;
  const usage = currentUsage(u);
  if (u.limits.dailyMinutes && usage.daily >= u.limits.dailyMinutes) return 'daily';
  if (u.limits.weeklyMinutes && usage.weekly >= u.limits.weeklyMinutes) return 'weekly';
  return null;
}

// כותב עדכון זמן שימוש בטרנזקציה (מאפס תקופה אם התאריך/שבוע השתנו), ומחזיר
// את סטטוס החסימה אחרי העדכון.
async function recordUsageMinutes(uid, minutes) {
  if (minutes <= 0) return null;
  let status = null;
  await db.runTransaction(async (tx) => {
    const ref = db.collection('users').doc(uid);
    const snap = await tx.get(ref);
    const u = snap.data() || {};
    const tKey = todayKey(), wKey = weekKey();

    let daily = (u.usage && u.usage.daily && u.usage.daily.date === tKey) ? u.usage.daily : { date: tKey, minutes: 0 };
    daily = { date: tKey, minutes: daily.minutes + minutes };

    let weekly = (u.usage && u.usage.weekly && u.usage.weekly.weekStart === wKey) ? u.usage.weekly : { weekStart: wKey, minutes: 0 };
    weekly = { weekStart: wKey, minutes: weekly.minutes + minutes };

    tx.set(ref, {
      usage: { daily, weekly },
      totalTimeMinutes: firebase.firestore.FieldValue.increment(minutes),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    status = checkLimitStatus({ ...u, limits: u.limits, usage: { daily, weekly } });
  });
  return status;
}

function showLockOverlay(reason) {
  if (document.getElementById('time-lock-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'time-lock-overlay';
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '2000';
  const text = reason === 'weekly'
    ? 'הגיעו למגבלת הזמן השבועית שההורים קבעו. נתראה בשבוע הבא! 📅'
    : 'הגיעו למגבלת הזמן היומית שההורים קבעו. נתראה מחר! 🌙';
  overlay.innerHTML = `
    <div class="card modal-card" style="text-align:center;">
      <img src="assets/maccia-mascot.svg" class="mascot mascot-sm" alt="מציה" style="margin:0 auto 12px;">
      <h3>הזמן להיום נגמר ⏰</h3>
      <p style="color:var(--text-dim);">${text}</p>
    </div>`;
  document.body.appendChild(overlay);
  // עוצרים כל טיימר/אודיו פעיל אם קיימים
  if (window.__timeLimitInterval) clearInterval(window.__timeLimitInterval);
}

// נקרא בתחילת דף (אחרי requireAuth) — בודק חסימה קיימת, ואם הכל תקין, מתחיל
// טיימר שמדווח שימוש כל דקה ובודק חסימה תוך כדי שימוש. מחזיר true אם מותר להמשיך.
async function enforceTimeLimits(uid) {
  const doc = await db.collection('users').doc(uid).get();
  const u = doc.data() || {};
  const status = checkLimitStatus(u);
  if (status) {
    showLockOverlay(status);
    return false;
  }

  const sessionStart = Date.now();
  let lastFlushed = 0;
  window.__timeLimitInterval = setInterval(async () => {
    const elapsedMinutes = (Date.now() - sessionStart) / 60000 - lastFlushed;
    if (elapsedMinutes < 1) return;
    lastFlushed += elapsedMinutes;
    try {
      const newStatus = await recordUsageMinutes(uid, elapsedMinutes);
      if (newStatus) showLockOverlay(newStatus);
    } catch (e) { /* לא קריטי */ }
  }, 60000);

  return true;
}
