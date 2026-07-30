const worldId = new URLSearchParams(window.location.search).get('world');
const worldIndex = WORLDS.findIndex((w) => w.id === worldId);
const world = worldIndex === -1 ? null : WORLDS[worldIndex];

// אי מתחת ל-viewBox קבוע 400x300. הנתיב המפותל (island-trail-path) רץ על
// פני שטח הדשא — צמתי השלבים ממוקמים בדיוק עליו לפי אורך המסלול, כך שזה
// מסתגל אוטומטית לכל מספר שיעורים בעולם.
function buildIslandSVG() {
  return `
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grassGrad" cx="45%" cy="35%" r="75%">
          <stop offset="0%" style="stop-color:var(--world-glow-2, #2EE6D0)"/>
          <stop offset="100%" style="stop-color:var(--world-dim, #123a2a)"/>
        </radialGradient>
        <linearGradient id="rockGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:#3a3350"/>
          <stop offset="100%" style="stop-color:#17122B"/>
        </linearGradient>
      </defs>

      <!-- גוף הסלע התחתון של האי -->
      <path d="M 55 150 Q 40 230 110 260 Q 200 285 300 258 Q 365 232 345 150 Z"
            fill="url(#rockGrad)"/>

      <!-- מפל קטן זורם מהצד -->
      <path class="island-waterfall" d="M 95 190 Q 88 240 78 295 L 108 295 Q 112 240 118 190 Z"
            style="fill:var(--world-glow-2, #4A7CFF); opacity:.6;"/>

      <!-- משטח הדשא העליון -->
      <ellipse cx="200" cy="140" rx="170" ry="68" fill="url(#grassGrad)"/>

      <!-- גבישים דקורטיביים -->
      <polygon class="island-crystal c1" points="90,95 100,60 110,95 100,115"
               style="fill:var(--world-glow, #4A7CFF); filter:drop-shadow(0 0 6px var(--world-glow, #4A7CFF));"/>
      <polygon class="island-crystal c2" points="300,85 312,45 324,85 312,108"
               style="fill:var(--world-glow-2, #2EE6D0); filter:drop-shadow(0 0 6px var(--world-glow-2, #2EE6D0));"/>
      <polygon class="island-crystal c3" points="200,60 208,35 216,60 208,75"
               style="fill:var(--world-glow, #4A7CFF); filter:drop-shadow(0 0 5px var(--world-glow, #4A7CFF));"/>

      <!-- מסלול מפותל שהצמתים יושבים עליו -->
      <path id="island-trail-path"
            d="M 90 175 C 130 145, 120 110, 175 108 C 235 106, 220 150, 270 140 C 310 132, 300 95, 335 85"
            fill="none" style="stroke:var(--world-glow-2, #2EE6D0);" stroke-width="4"
            stroke-linecap="round" stroke-dasharray="2 10" opacity=".7"/>
    </svg>`;
}

requireAuth(async (user) => {
  const allowed = await enforceTimeLimits(user.uid);
  if (!allowed) return;

  if (!world) { window.location.href = 'dashboard.html'; return; }

  document.getElementById('world-wrap').classList.add(`world-theme-${world.theme}`);
  document.getElementById('world-title-top').textContent = `${world.emoji} ${world.title}`;
  renderFloatingSymbols(world.floatSymbols || []);

  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const progress = userData.progress || {};
  document.getElementById('coin-pill').textContent = userData.isAdmin ? '🪙 ∞' : `🪙 ${userData.coins || 0}`;

  const allLessonsSnap = await db.collection('lessons').orderBy('order').get();
  const allLessons = allLessonsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // בדיקת בטיחות: אם העולם הזה בכלל נעול (העולם הקודם לא הושלם), חוזרים למפה
  for (let i = 0; i < worldIndex; i++) {
    const prevWorld = WORLDS[i];
    const prevLessons = allLessons.filter((l) => l.order >= prevWorld.minOrder && l.order <= prevWorld.maxOrder);
    const prevDone = prevLessons.length && prevLessons.every((l) => !!progress[l.id]);
    if (prevLessons.length && !prevDone) { window.location.href = 'dashboard.html'; return; }
  }

  const worldLessons = allLessons.filter((l) => l.order >= world.minOrder && l.order <= world.maxOrder);
  setupArrows(allLessons, progress);

  const stageEl = document.getElementById('island-stage-container');
  if (!worldLessons.length) {
    stageEl.innerHTML = '<p style="color:var(--text-dim); text-align:center;">עוד אין שיעורים באי הזה... בקרוב! 🚀</p>';
    return;
  }

  stageEl.innerHTML = `<div class="island-stage" id="island-stage">${buildIslandSVG()}<div class="island-nodes" id="island-nodes"></div></div>`;

  const pathEl = document.getElementById('island-stage').querySelector('#island-trail-path');
  const totalLen = pathEl.getTotalLength();
  const n = worldLessons.length;

  let previousDone = true;
  let currentPoint = null;
  const nodesEl = document.getElementById('island-nodes');

  worldLessons.forEach((lesson, idx) => {
    const t = n === 1 ? 1 : idx / (n - 1);
    const pt = pathEl.getPointAtLength(t * totalLen);
    const leftPct = (pt.x / 400) * 100;
    const topPct = (pt.y / 300) * 100;

    const done = !!progress[lesson.id];
    const unlocked = previousDone;
    const isBoss = idx === n - 1;
    if (unlocked && !done && !currentPoint) currentPoint = { leftPct, topPct };
    previousDone = done;

    const classes = ['island-node-btn'];
    if (isBoss) classes.push('boss');
    if (done) classes.push('done');
    else if (!unlocked) classes.push('locked');
    else classes.push('current');

    const icon = done ? '✅' : (unlocked ? (isBoss ? '💀' : idx + 1) : '🔒');
    const label = isBoss ? (world.bossTitle || 'בוס') : lesson.title;
    const tag = unlocked ? 'a' : 'span';

    const btn = document.createElement(tag);
    btn.className = classes.join(' ');
    btn.style.left = leftPct + '%';
    btn.style.top = topPct + '%';
    if (unlocked) btn.setAttribute('href', `lesson.html?id=${lesson.id}`);
    btn.innerHTML = `${icon}<span class="island-node-label">${label}</span>`;
    nodesEl.appendChild(btn);
  });

  // אם הכל הושלם, שמים את האווטאר על הצומת האחרון
  if (!currentPoint && worldLessons.length) {
    const t = 1;
    const pt = pathEl.getPointAtLength(t * totalLen);
    currentPoint = { leftPct: (pt.x / 400) * 100, topPct: (pt.y / 300) * 100 };
  }

  if (currentPoint) {
    const marker = document.createElement('img');
    marker.src = 'assets/maccia-mascot.svg';
    marker.className = 'island-avatar-token';
    marker.alt = 'המיקום שלי';
    marker.style.left = currentPoint.leftPct + '%';
    marker.style.top = currentPoint.topPct + '%';
    nodesEl.appendChild(marker);
  }
});

function setupArrows(allLessons, progress) {
  const prevWorld = worldIndex > 0 ? WORLDS[worldIndex - 1] : null;
  const nextWorld = worldIndex < WORLDS.length - 1 ? WORLDS[worldIndex + 1] : null;

  const prevArrow = document.getElementById('arrow-prev');
  const nextArrow = document.getElementById('arrow-next');

  if (prevWorld) {
    prevArrow.href = `world.html?world=${prevWorld.id}`;
  } else {
    prevArrow.classList.add('disabled');
  }

  const myLessons = allLessons.filter((l) => l.order >= world.minOrder && l.order <= world.maxOrder);
  const myDone = myLessons.length && myLessons.every((l) => !!progress[l.id]);

  if (nextWorld && myDone) {
    nextArrow.href = `world.html?world=${nextWorld.id}`;
  } else {
    nextArrow.classList.add('disabled');
  }
}

function renderFloatingSymbols(symbols) {
  if (!symbols.length) return;
  const box = document.getElementById('float-symbols');
  const count = 16;
  let html = '';
  for (let i = 0; i < count; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const left = Math.random() * 100;
    const duration = 10 + Math.random() * 12;
    const delay = Math.random() * 10;
    const size = 0.9 + Math.random() * 1.4;
    html += `<span class="float-symbol" style="left:${left}vw; font-size:${size}rem; animation-duration:${duration}s; animation-delay:-${delay}s;">${symbol}</span>`;
  }
  box.innerHTML = html;
}
