const worldId = new URLSearchParams(window.location.search).get('world');
const world = WORLDS.find((w) => w.id === worldId);

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

  // בדיקת בטיחות: אם העולם הזה בכלל נעול (העולם הקודם לא הושלם), חוזרים למפה
  const allLessonsSnap = await db.collection('lessons').orderBy('order').get();
  const allLessons = allLessonsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const myWorldIndex = WORLDS.findIndex((w) => w.id === world.id);
  for (let i = 0; i < myWorldIndex; i++) {
    const prevWorld = WORLDS[i];
    const prevLessons = allLessons.filter((l) => l.order >= prevWorld.minOrder && l.order <= prevWorld.maxOrder);
    const prevDone = prevLessons.length && prevLessons.every((l) => !!progress[l.id]);
    if (prevLessons.length && !prevDone) { window.location.href = 'dashboard.html'; return; }
  }

  const worldLessons = allLessons.filter((l) => l.order >= world.minOrder && l.order <= world.maxOrder);
  const containerEl = document.getElementById('level-path-container');

  if (!worldLessons.length) {
    containerEl.innerHTML = '<p style="color:var(--text-dim)">עוד אין שיעורים בעולם הזה... בקרוב! 🚀</p>';
    return;
  }

  let previousDone = true; // השלב הראשון בעולם תמיד פתוח (כבר וידאנו שהעולם עצמו פתוח)
  let currentNodeId = null;

  const rowsHtml = worldLessons.map((lesson, idx) => {
    const done = !!progress[lesson.id];
    const unlocked = previousDone;
    const isBoss = idx === worldLessons.length - 1;
    if (unlocked && !done && currentNodeId === null) currentNodeId = lesson.id;
    previousDone = done;

    const classes = ['level-node'];
    if (isBoss) classes.push('boss');
    if (done) classes.push('done');
    else if (!unlocked) classes.push('locked');
    else classes.push('current');

    const icon = done ? '✅' : (unlocked ? (isBoss ? '💀' : idx + 1) : '🔒');
    const label = isBoss ? (world.bossTitle || 'בוס') : lesson.title;
    const tag = unlocked ? 'a' : 'span';
    const hrefAttr = unlocked ? `href="lesson.html?id=${lesson.id}"` : '';

    return `
      <div class="level-node-row">
        <${tag} class="${classes.join(' ')}" ${hrefAttr} id="node-${lesson.id}">
          ${icon}
          <span class="level-node-label">${label}</span>
        </${tag}>
      </div>`;
  }).join('');

  containerEl.innerHTML = `<div class="level-path">${rowsHtml}</div>`;

  // ממקמים את אווטאר השחקן ליד השלב הנוכחי (או האחרון, אם הכל הושלם)
  const targetId = currentNodeId || worldLessons[worldLessons.length - 1].id;
  const targetNode = document.getElementById(`node-${targetId}`);
  if (targetNode) {
    const marker = document.createElement('img');
    marker.src = 'assets/maccia-mascot.svg';
    marker.className = 'map-avatar-token';
    marker.alt = 'המיקום שלי';
    const rect = targetNode.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    marker.style.top = (rect.top - containerRect.top - 34) + 'px';
    marker.style.right = (containerRect.right - rect.right - 10) + 'px';
    containerEl.style.position = 'relative';
    containerEl.appendChild(marker);
  }
});

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
