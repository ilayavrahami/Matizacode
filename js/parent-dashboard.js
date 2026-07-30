const qp = new URLSearchParams(window.location.search);
const prefillUser = qp.get('u');
if (prefillUser) document.getElementById('pin-username').value = prefillUser;

let sessionUsername = null;
let sessionPin = null;

document.getElementById('pin-submit').addEventListener('click', submitPin);
document.getElementById('pin-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });

async function submitPin() {
  const username = document.getElementById('pin-username').value.trim();
  const pin = document.getElementById('pin-code').value.trim();
  const errorEl = document.getElementById('pin-error');
  const btn = document.getElementById('pin-submit');
  errorEl.textContent = '';

  if (!username || !pin) {
    errorEl.textContent = 'צריך למלא שם משתמש וקוד PIN';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'בודקים... ⏳';
  try {
    const resp = await fetch('/.netlify/functions/parent-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin })
    });
    const data = await resp.json();
    if (!resp.ok) {
      errorEl.textContent = data.error || 'שגיאה, נסו שוב';
      return;
    }
    sessionUsername = username;
    sessionPin = pin;
    renderReport(data);
  } catch (e) {
    errorEl.textContent = 'בעיה בחיבור לאינטרנט, נסו שוב';
  } finally {
    btn.disabled = false;
    btn.textContent = 'צפייה בדוח 🔍';
  }
}

const statusLabel = { done: '🟢 הושלם', in_progress: '🟡 בתהליך', not_started: '⚪ טרם התחיל' };

function renderReport(data) {
  document.getElementById('pin-card').style.display = 'none';
  document.getElementById('report-card').style.display = 'block';

  document.getElementById('report-name').textContent = `ההתקדמות של ${data.displayName}`;
  document.getElementById('stat-completed').textContent = `${data.completedCount}/${data.totalLessons}`;
  const hrs = Math.floor(data.totalTimeMinutes / 60);
  const mins = data.totalTimeMinutes % 60;
  document.getElementById('stat-time').textContent = hrs > 0 ? `${hrs} ש' ${mins} דק'` : `${mins} דק'`;
  document.getElementById('stat-last').textContent = data.lastActive || '—';

  const topicsEl = document.getElementById('topics-list');
  topicsEl.innerHTML = data.topics.length
    ? data.topics.map(t => `<span class="topic-pill">✅ ${t}</span>`).join('')
    : '<p style="color:var(--text-dim); font-size:.9rem;">עוד אין נושאים שהושלמו.</p>';

  const lessonsEl = document.getElementById('lessons-list');
  lessonsEl.innerHTML = data.lessons.map((l) => `
    <div class="lesson-status-row">
      <span>${l.title}${l.frameProgress ? ` <span style="color:var(--text-dim); font-size:.82rem;">(פריים ${l.frameProgress})</span>` : ''}</span>
      <span>${l.completedAt ? `<span style="color:var(--text-dim); font-size:.78rem;">${l.completedAt}</span> ` : ''}${statusLabel[l.status]}</span>
    </div>`).join('');

  document.getElementById('encourage-text').textContent = data.encouragement;

  document.getElementById('limit-daily').value = data.limits && data.limits.dailyMinutes != null ? data.limits.dailyMinutes : '';
  document.getElementById('limit-weekly').value = data.limits && data.limits.weeklyMinutes != null ? data.limits.weeklyMinutes : '';
}

document.getElementById('limits-save').addEventListener('click', async () => {
  const errorEl = document.getElementById('limits-error');
  const successEl = document.getElementById('limits-success');
  const btn = document.getElementById('limits-save');
  errorEl.textContent = '';
  successEl.textContent = '';

  const dailyRaw = document.getElementById('limit-daily').value.trim();
  const weeklyRaw = document.getElementById('limit-weekly').value.trim();

  btn.disabled = true;
  try {
    const resp = await fetch('/.netlify/functions/parent-set-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: sessionUsername,
        pin: sessionPin,
        dailyMinutes: dailyRaw === '' ? null : Number(dailyRaw),
        weeklyMinutes: weeklyRaw === '' ? null : Number(weeklyRaw)
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      errorEl.textContent = data.error || 'שגיאה בשמירה';
      return;
    }
    successEl.textContent = 'ההגבלות נשמרו בהצלחה ✅';
  } catch (e) {
    errorEl.textContent = 'בעיה בחיבור לאינטרנט, נסו שוב';
  } finally {
    btn.disabled = false;
  }
});
