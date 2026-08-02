const worldId = new URLSearchParams(window.location.search).get('world');
const worldIndex = WORLDS.findIndex((w) => w.id === worldId);
const world = worldIndex === -1 ? null : WORLDS[worldIndex];

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

  stageEl.innerHTML = `
    <div class="island-stage">
      <img class="island-bg" src="assets/floating-island.png" alt="האי של ${world.title}">
      <div class="island-nodes" id="island-nodes"></div>
    </div>`;

  const nodesEl = document.getElementById('island-nodes');
  const slots = pickMarkerSlots(worldLessons.length);

  let previousDone = true;
  let currentSlot = null;
  const n = worldLessons.length;

  worldLessons.forEach((lesson, idx) => {
    const slot = slots[idx];
    const done = !!progress[lesson.id];
    const unlocked = previousDone;
    const isBoss = idx === n - 1;
    if (unlocked && !done && !currentSlot) currentSlot = slot;
    previousDone = done;

    const classes = ['island-node-btn'];
    if (isBoss) classes.push('boss');
    if (done) classes.push('done');
    else if (!unlocked) classes.push('locked');
    else classes.push('current');

    const label = isBoss ? (world.bossTitle || 'בוס') : lesson.title;
    const tag = unlocked ? 'a' : 'span';

    const btn = document.createElement(tag);
    btn.className = classes.join(' ');
    btn.style.left = slot.x + '%';
    btn.style.top = slot.y + '%';
    if (unlocked) btn.setAttribute('href', `lesson.html?id=${lesson.id}`);
    btn.innerHTML = `<span class="island-node-label">${label}</span>`;
    nodesEl.appendChild(btn);
  });

  // אם הכל הושלם, שמים את האווטאר על הצומת האחרון (שלב הבוס)
  if (!currentSlot) currentSlot = slots[slots.length - 1];

  const marker = document.createElement('img');
  marker.src = 'assets/maccia-mascot.svg';
  marker.className = 'island-avatar-token';
  marker.alt = 'המיקום שלי';
  marker.style.left = currentSlot.x + '%';
  marker.style.top = currentSlot.y + '%';
  nodesEl.appendChild(marker);
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
