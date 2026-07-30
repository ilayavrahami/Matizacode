requireAuth(async (user) => {
  const allowed = await enforceTimeLimits(user.uid);
  if (!allowed) return;

  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const progress = userData.progress || {};

  const name = userData.displayName || userData.username || '';
  document.getElementById('greeting').textContent =
    name ? `היייי ${name}! לאיזה עולם יוצאים היום? 🚀` : 'היייי! לאיזה עולם יוצאים היום? 🚀';

  document.getElementById('coin-pill').textContent = userData.isAdmin ? '🪙 ∞' : `🪙 ${userData.coins || 0}`;
  document.getElementById('avatar-preview').innerHTML = renderAvatarHTML(userData.avatar, 100);

  const snap = await db.collection('lessons').orderBy('order').get();
  const gridEl = document.getElementById('world-grid');

  if (snap.empty) {
    gridEl.innerHTML = '<p style="color:var(--text-dim)">עוד אין שיעורים כאן... בקרוב! 🚀</p>';
    return;
  }

  const lessons = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  let previousWorldDone = true; // העולם הראשון תמיד פתוח

  const cardsHtml = WORLDS.map((world) => {
    const worldLessons = lessons.filter((l) => l.order >= world.minOrder && l.order <= world.maxOrder);
    if (!worldLessons.length) return ''; // עולם בלי שיעורים בפועל עדיין — לא מציגים

    const doneCount = worldLessons.filter((l) => !!progress[l.id]).length;
    const total = worldLessons.length;
    const worldDone = doneCount === total;
    const unlocked = previousWorldDone;
    previousWorldDone = worldDone;

    const pct = total ? Math.round((doneCount / total) * 100) : 0;
    const cardClasses = ['world-portal', `world-theme-${world.theme}`];
    if (!unlocked) cardClasses.push('locked');

    const tag = unlocked ? 'a' : 'div';
    const hrefAttr = unlocked ? `href="world.html?world=${world.id}"` : '';

    return `
      <${tag} class="${cardClasses.join(' ')}" ${hrefAttr}>
        <span class="world-portal-emoji">${world.emoji}</span>
        <h3>${world.title}</h3>
        <p>${world.subtitle}</p>
        <div class="world-portal-progress"><div style="width:${pct}%"></div></div>
        <div class="world-portal-frac">${doneCount}/${total} שיעורים</div>
      </${tag}>`;
  }).join('');

  gridEl.innerHTML = cardsHtml || '<p style="color:var(--text-dim)">עוד אין שיעורים כאן... בקרוב! 🚀</p>';
});
