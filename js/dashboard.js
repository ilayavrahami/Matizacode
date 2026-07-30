// חלוקת השיעורים ל"עולמות" נושאיים למפה. מבוסס על טווח order של השיעור.
// כשמוסיפים עוד שיעורים בעתיד — פשוט מוסיפים עולם נוסף לרשימה הזו.
const WORLDS = [
  { emoji: "🏝️", title: "אי ההתחלה", minOrder: 1, maxOrder: 4 },
  { emoji: "⛰️", title: "הר ה-Pygame", minOrder: 5, maxOrder: 8 }
];

requireAuth(async (user) => {
  const allowed = await enforceTimeLimits(user.uid);
  if (!allowed) return;

  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const progress = userData.progress || {};

  const name = userData.displayName || userData.username || '';
  document.getElementById('greeting').textContent =
    name ? `היייי ${name}! מוכנים להמשיך? 😄` : 'היייי! מוכנים להמשיך? 😄';

  document.getElementById('coin-pill').textContent = userData.isAdmin ? '🪙 ∞' : `🪙 ${userData.coins || 0}`;
  document.getElementById('avatar-preview').innerHTML = renderAvatarHTML(userData.avatar, 100);

  const snap = await db.collection('lessons').orderBy('order').get();
  const containerEl = document.getElementById('map-container');

  if (snap.empty) {
    containerEl.innerHTML = '<p style="color:var(--text-dim)">עוד אין שיעורים כאן... בקרוב! 🚀</p>';
    return;
  }

  const lessons = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  let previousDone = true; // lesson 1 is always unlocked

  const worldsHtml = WORLDS.map((world) => {
    const worldLessons = lessons.filter((l) => l.order >= world.minOrder && l.order <= world.maxOrder);
    if (!worldLessons.length) return '';

    const nodesHtml = worldLessons.map((lesson) => {
      const done = !!progress[lesson.id];
      const unlocked = previousDone;
      const classes = ['map-node'];
      if (done) classes.push('done');
      if (!unlocked) classes.push('locked');
      previousDone = done;

      return `
        <a class="${classes.join(' ')}" href="lesson.html?id=${lesson.id}">
          <div class="map-node-circle">${done ? '✅' : (unlocked ? lesson.order : '🔒')}</div>
          <div class="map-node-info">
            <p class="map-node-title">${lesson.title}</p>
            <p class="map-node-sub">${lesson.subtitle || ''}</p>
          </div>
        </a>`;
    }).join('');

    return `
      <div class="world-block">
        <div class="world-header">
          <span class="world-emoji">${world.emoji}</span>
          <h3>${world.title}</h3>
        </div>
        <div class="map-path">${nodesHtml}</div>
      </div>`;
  }).join('');

  containerEl.innerHTML = worldsHtml || '<p style="color:var(--text-dim)">עוד אין שיעורים כאן... בקרוב! 🚀</p>';
});
