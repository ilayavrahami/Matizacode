const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');
let currentUser = null;
let lesson = null;
let frameIndex = 0;
let taskChecked = {};
let codeSolved = {};
let pygameSolved = {};

// ===== תמיכה בערבוב עברית/אנגלית (Bidi) =====
// הדפדפן קובע איך למקם סימנים "נייטרליים" (כמו סוגריים, נקודות, מקפים)
// לפי כיוון הפסקה שמסביב. כשפסקה היא עברית (RTL) וסוגריים באים מיד אחרי
// קוד אנגלי (LTR), הם "נשלפים" למקום ההפוך. הפתרון: לעטוף כל "ריצה" של
// תווים שאינם עבריים (קוד/אנגלית/מספרים/סימנים) בתגית <bdi dir="ltr">,
// שמבודדת את הכיוון שלה מהפסקה שמסביב בלי לשנות איך היא נראית.
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bidiSafe(str) {
  const escaped = escapeHtml(str);
  // עוטפים רק ריצות שבאמת מכילות אות לטינית (קוד/אנגלית אמיתיים).
  // סימני פיסוק "נייטרליים" שמקיפים מילה עברית (כמו (שווה) או 'שווה') לא
  // נוגעים בהם בכלל — הם כבר מוצגים נכון כחלק טבעי מהפסקה העברית, ועטיפה
  // שלהם בנפרד היא מה שגרם לבאג ההפוך.
  return escaped.replace(/[^\u0590-\u05FF\n]+/g, (run) => (/[A-Za-z]/.test(run) ? `<bdi dir="ltr">${run}</bdi>` : run));
}

// --- מעקב זמן למידה (לדוח של ההורים + אכיפת מגבלות זמן) ---
let lessonStartTime = Date.now();
let timeFlushed = false;

async function flushTimeSpent() {
  if (timeFlushed || !currentUser) return;
  const minutes = (Date.now() - lessonStartTime) / 60000;
  if (minutes < 0.05) return; // פחות מ-3 שניות, לא שווה לשמור
  timeFlushed = true;
  try {
    await recordUsageMinutes(currentUser.uid, minutes);
  } catch (e) { /* לא קריטי אם זה נכשל */ }
}
window.addEventListener('beforeunload', flushTimeSpent);
window.addEventListener('pagehide', flushTimeSpent);

requireAuth(async (user) => {
  currentUser = user;
  const allowed = await enforceTimeLimits(user.uid);
  if (!allowed) { document.getElementById('nav-row').style.display = 'none'; return; }

  if (!lessonId) { window.location.href = 'dashboard.html'; return; }

  const doc = await db.collection('lessons').doc(lessonId).get();
  if (!doc.exists) {
    document.getElementById('stage').innerHTML = '<p style="text-align:center;">השיעור הזה לא נמצא 😕</p>';
    return;
  }
  lesson = doc.data();
  document.getElementById('lesson-title-top').textContent = lesson.title;
  document.getElementById('nav-row').style.display = 'flex';
  renderFrame();
  initChatWidget();
  initDebugWidget();
});

function updateCurrentPosition() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).set({
    currentLesson: { id: lessonId, title: lesson.title, frameIndex, totalFrames: (lesson.frames || []).length },
    lastActive: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});
}

function renderFrame() {
  const frames = lesson.frames || [];
  const frame = frames[frameIndex];
  const stage = document.getElementById('stage');
  const pct = frames.length ? Math.round(((frameIndex + 1) / frames.length) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  updateCurrentPosition();

  const imgBlock = frame.image
    ? `<img src="${frame.image}" alt="">${frame.highlight ? `<span class="click-marker" style="left:${frame.highlight.x}%; top:${frame.highlight.y}%;"></span>` : ''}`
    : `<span class="frame-placeholder">🎨</span>`;

  const taskBlock = frame.task ? `
    <label class="task-box">
      <input type="checkbox" id="task-check" ${taskChecked[frameIndex] ? 'checked' : ''}>
      <span>${bidiSafe(frame.task)}</span>
    </label>` : '';

  const codeBlock = frame.type === 'code' ? `
    <div class="code-terminal">
      <div class="code-terminal-bar">🖥️ הטרמינל שלי</div>
      <textarea class="code-input" id="code-input" spellcheck="false">${escapeHtml(frame.starterCode || '')}</textarea>
      <button class="btn yellow btn-block" id="run-code-btn" type="button">▶️ הרצה</button>
      <div class="code-output" id="code-output">${codeSolved[frameIndex] ? codeOutputSuccessHTML(codeSolved[frameIndex]) : ''}</div>
    </div>` : '';

  const pygameBlock = frame.type === 'pygame-code' ? `
    <div class="code-terminal">
      <div class="code-terminal-bar">🐍 hello.py</div>
      <textarea class="code-input" id="pygame-code-input" spellcheck="false" style="min-height:220px;">${escapeHtml(pygameSolved[frameIndex] ? pygameSolved[frameIndex].code : (frame.starterCode || ''))}</textarea>
      <button class="btn yellow btn-block" id="check-pygame-btn" type="button">🔍 בדיקת קוד</button>
      <div class="code-output" id="pygame-output">${pygameSolved[frameIndex] ? `<div class="code-msg ok">${bidiSafe(pygameSolved[frameIndex].feedback)}</div>` : ''}</div>
    </div>` : '';

  stage.innerHTML = `
    ${frame.image || (frame.type !== 'code' && frame.type !== 'pygame-code') ? `<div class="frame-img-wrap">${imgBlock}</div>` : ''}
    <div class="bubble-row">
      <div class="bubble">${bidiSafe(frame.text)}</div>
      <img src="assets/maccia-mascot.svg" class="mascot mascot-sm" alt="מציה">
    </div>
    ${taskBlock}
    ${codeBlock}
    ${pygameBlock}
  `;

  if (frame.task) {
    document.getElementById('task-check').addEventListener('change', (e) => {
      taskChecked[frameIndex] = e.target.checked;
    });
  }

  if (frame.type === 'code') {
    document.getElementById('run-code-btn').addEventListener('click', () => runCode(frame));
  }

  if (frame.type === 'pygame-code') {
    document.getElementById('check-pygame-btn').addEventListener('click', () => runPygameCheck(frame));
  }

  document.getElementById('prev-btn').disabled = frameIndex === 0;
  const nextBtn = document.getElementById('next-btn');
  nextBtn.textContent = (frameIndex === frames.length - 1) ? 'סיימתי! 🏆' : 'הבא ⟶';
  nextBtn.disabled = (frame.type === 'code' && !codeSolved[frameIndex]) ||
                      (frame.type === 'pygame-code' && !pygameSolved[frameIndex]);
}

function codeOutputSuccessHTML(printed) {
  return `<div class="code-line ok">&gt;&gt;&gt; ${bidiSafe(printed)}</div><div class="code-msg ok">מעולה! זה בדיוק נכון ✅</div>`;
}

function runCode(frame) {
  const code = document.getElementById('code-input').value;
  const output = document.getElementById('code-output');
  const match = code.match(/print\s*\(\s*(["'])([\s\S]*?)\1\s*\)/);

  if (!match) {
    output.innerHTML = `<div class="code-msg err">${bidiSafe('לא מצאתי כאן print("...") — נסו לכתוב את זה בדיוק ככה 🧐')}</div>`;
    return;
  }

  const printed = match[2];
  if (printed.trim() === (frame.expectedPrint || '').trim()) {
    output.innerHTML = codeOutputSuccessHTML(printed);
    codeSolved[frameIndex] = printed;
    document.getElementById('next-btn').disabled = false;
    fireConfetti(24);
    playChime('success');
  } else {
    output.innerHTML = `<div class="code-line">&gt;&gt;&gt; ${bidiSafe(printed)}</div><div class="code-msg err">${bidiSafe(`כמעט! זה הדפיס "${printed}" ולא "${frame.expectedPrint}". בדקו מה כתוב בתוך המרכאות ונסו שוב 💪`)}</div>`;
  }
}

async function runPygameCheck(frame) {
  const input = document.getElementById('pygame-code-input');
  const btn = document.getElementById('check-pygame-btn');
  const output = document.getElementById('pygame-output');
  const code = input.value;

  if (!code.trim()) {
    output.innerHTML = `<div class="code-msg err">${bidiSafe('כתבו קצת קוד קודם, ואז נבדוק ביחד 😊')}</div>`;
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'מציה בודקת... 🤔';
  output.innerHTML = '';

  try {
    const idToken = await currentUser.getIdToken();
    const resp = await fetch('/.netlify/functions/check-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({
        code,
        taskDescription: frame.taskDescription || '',
        hints: frame.hints || '',
        requiredPatterns: frame.requiredPatterns || [],
        starterCode: frame.starterCode || ''
      })
    });
    const data = await resp.json();

    if (!resp.ok) {
      output.innerHTML = `<div class="code-msg err">${bidiSafe('אופס, הייתה בעיה קטנה בבדיקה... נסו שוב עוד רגע 😅')}</div>`;
      return;
    }

    if (data.passed) {
      output.innerHTML = `<div class="code-msg ok">${bidiSafe(data.feedback)}</div>`;
      pygameSolved[frameIndex] = { code, feedback: data.feedback };
      document.getElementById('next-btn').disabled = false;
      fireConfetti(24);
      playChime('success');
    } else {
      output.innerHTML = `<div class="code-msg err">${bidiSafe(data.feedback)}</div>`;
    }
  } catch (e) {
    output.innerHTML = `<div class="code-msg err">${bidiSafe('אופס, לא הצלחתי להתחבר... בדקו את החיבור לאינטרנט 😅')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}


document.getElementById('prev-btn').addEventListener('click', () => {
  if (frameIndex > 0) { frameIndex--; renderFrame(); }
});

document.getElementById('next-btn').addEventListener('click', async () => {
  const frames = lesson.frames || [];
  if (frameIndex < frames.length - 1) {
    frameIndex++;
    renderFrame();
  } else {
    // last frame — mark lesson complete and show the celebration screen
    const topics = lesson.topics || [];
    await db.collection('users').doc(currentUser.uid).set({
      progress: { [lessonId]: { done: true, completedAt: firebase.firestore.FieldValue.serverTimestamp() } },
      topics: firebase.firestore.FieldValue.arrayUnion(...topics),
      currentLesson: firebase.firestore.FieldValue.delete(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await flushTimeSpent();
    showCompletionScreen();
  }
});

async function showCompletionScreen() {
  document.getElementById('nav-row').style.display = 'none';
  document.getElementById('progress-fill').style.width = '100%';

  let nextLessonId = null;
  if (typeof lesson.order === 'number') {
    const nextSnap = await db.collection('lessons').where('order', '==', lesson.order + 1).limit(1).get();
    if (!nextSnap.empty) nextLessonId = nextSnap.docs[0].id;
  }

  document.getElementById('stage').innerHTML = `
    <div style="text-align:center;">
      <img src="assets/maccia-mascot.svg" class="mascot" alt="מציה">
      <h2 class="display" style="color:var(--yellow);">כל הכבוד! 🏆</h2>
      <p class="bubble" style="display:inline-block;">סיימת את "${bidiSafe(lesson.title)}"!</p>
      <div style="display:flex; gap:12px; margin-top:24px;">
        <a href="dashboard.html" class="btn secondary" style="flex:1;">לשיעורים</a>
        ${nextLessonId ? `<a href="lesson.html?id=${nextLessonId}" class="btn" style="flex:1;">לשיעור הבא ⟶</a>` : ''}
      </div>
    </div>`;
  fireConfetti();
  playChime('victory');
}

function fireConfetti(count = 90) {
  const colors = ['#2EE6D0', '#FFE156', '#B14EFF', '#4A7CFF', '#FF8FB1'];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

// ===== צלילים (Web Audio API — בלי קבצי אודיו חיצוניים) =====
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNote(freq, startTime, duration, gainPeak = 0.18) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playChime(kind) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const melody = kind === 'victory'
      ? [523.25, 659.25, 783.99, 1046.50]   // C5 E5 G5 C6 — ניצחון גדול
      : [659.25, 987.77];                    // E5 B5 — משימה קטנה הושלמה
    melody.forEach((freq, i) => playNote(freq, now + i * 0.13, 0.35));
  } catch (e) { /* Web Audio לא נתמך/חסום — לא קריטי */ }
}

// ===== צ'אט עזרה של מציה (AI Companion) =====
function initChatWidget() {
  const shell = document.querySelector('.frame-shell');
  const widget = document.createElement('div');
  widget.className = 'chat-widget';
  widget.innerHTML = `
    <button class="chat-fab" id="chat-fab" type="button" aria-label="שאלו את מציה">💬</button>
    <div class="chat-panel" id="chat-panel" style="display:none;">
      <div class="chat-panel-head">
        <span>💬 שאלו את מציה</span>
        <button id="chat-close" type="button" aria-label="סגירה">✕</button>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg bot">היי! יש לך שאלה על השיעור? אני כאן 😊</div>
      </div>
      <div class="chat-input-row">
        <input id="chat-input" class="field" placeholder="כתבו כאן..." maxlength="400">
        <button id="chat-send" class="btn" type="button">שלח</button>
      </div>
    </div>`;
  shell.appendChild(widget);

  const panel = document.getElementById('chat-panel');
  document.getElementById('chat-fab').addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('chat-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  const sendBtn = document.getElementById('chat-send');
  const input = document.getElementById('chat-input');
  const send = () => sendChatMessage(input, sendBtn);
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
}

function appendChatMessage(text, who) {
  const box = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg ' + who;
  el.innerHTML = bidiSafe(text);
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

async function sendChatMessage(input, sendBtn) {
  const text = input.value.trim();
  if (!text || !currentUser) return;
  input.value = '';
  sendBtn.disabled = true;
  appendChatMessage(text, 'me');
  const thinking = appendChatMessage('מציה חושבת... 🤔', 'bot');

  try {
    const idToken = await currentUser.getIdToken();
    const resp = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ message: text, lessonTitle: lesson ? lesson.title : '' })
    });
    const data = await resp.json();
    thinking.innerHTML = bidiSafe(resp.ok ? data.reply : 'אופס, הייתה בעיה קטנה... נסו שוב עוד רגע 😅');
  } catch (e) {
    thinking.innerHTML = bidiSafe('אופס, לא הצלחתי להתחבר... בדקו את החיבור לאינטרנט 😅');
  } finally {
    sendBtn.disabled = false;
  }
}

// ===== עוזר דיבאג (מפענח שגיאות Python) =====
function initDebugWidget() {
  const shell = document.querySelector('.frame-shell');
  const widget = document.createElement('div');
  widget.className = 'debug-widget';
  widget.innerHTML = `
    <button class="chat-fab" id="debug-fab" type="button" aria-label="עוזר דיבאג" style="background:var(--blue); box-shadow:0 4px 0 #2f5bcf, 0 8px 20px rgba(74,124,255,.35);">🐛</button>
    <div class="chat-panel" id="debug-panel" style="display:none;">
      <div class="chat-panel-head">
        <span>🐛 עוזר דיבאג</span>
        <button id="debug-close" type="button" aria-label="סגירה">✕</button>
      </div>
      <div style="padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
        <p style="margin:0; font-size:.85rem; color:var(--text-dim);">
          קיבלתם שגיאה ב-VS Code? הדביקו אותה כאן ומציה תסביר בפשטות מה קרה.
        </p>
        <textarea id="debug-error-input" class="field" style="margin-top:0; min-height:90px; font-family:'Courier New',monospace; font-size:.85rem; direction:ltr; text-align:left;" placeholder="Traceback (most recent call last): ..."></textarea>
        <button id="debug-send" class="btn" type="button">פענוח השגיאה</button>
        <div id="debug-result" class="chat-messages" style="padding:0; max-height:180px;"></div>
      </div>
    </div>`;
  shell.appendChild(widget);

  const panel = document.getElementById('debug-panel');
  document.getElementById('debug-fab').addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('debug-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });
  document.getElementById('debug-send').addEventListener('click', sendDebugError);
}

async function sendDebugError() {
  const input = document.getElementById('debug-error-input');
  const btn = document.getElementById('debug-send');
  const resultBox = document.getElementById('debug-result');
  const errorMessage = input.value.trim();
  if (!errorMessage || !currentUser) return;

  btn.disabled = true;
  resultBox.innerHTML = '';
  const thinking = document.createElement('div');
  thinking.className = 'chat-msg bot';
  thinking.innerHTML = bidiSafe('מציה בודקת... 🤔');
  resultBox.appendChild(thinking);

  try {
    const idToken = await currentUser.getIdToken();
    const resp = await fetch('/.netlify/functions/debug-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ errorMessage })
    });
    const data = await resp.json();
    thinking.innerHTML = bidiSafe(resp.ok ? data.explanation : 'אופס, הייתה בעיה קטנה... נסו שוב עוד רגע 😅');
  } catch (e) {
    thinking.innerHTML = bidiSafe('אופס, לא הצלחתי להתחבר... בדקו את החיבור לאינטרנט 😅');
  } finally {
    btn.disabled = false;
  }
}
