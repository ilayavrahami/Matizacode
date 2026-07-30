requireAuth(async (user) => {
  const allowed = await enforceTimeLimits(user.uid);
  if (!allowed) return;

  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const progress = userData.progress || {};

  const name = userData.displayName || userData.username || '';
  document.getElementById('greeting').textContent =
    name ? `היייי ${name}! מוכנים להמשיך? 😄` : 'היייי! מוכנים להמשיך? 😄';

  const snap = await db.collection('lessons').orderBy('order').get();
  const listEl = document.getElementById('lesson-list');

  if (snap.empty) {
    listEl.innerHTML = '<p style="color:var(--text-dim)">עוד אין שיעורים כאן... בקרוב! 🚀</p>';
    return;
  }

  let html = '';
  let previousDone = true; // lesson 1 is always unlocked

  snap.forEach((doc) => {
    const lesson = doc.data();
    const done = !!progress[doc.id];
    const unlocked = previousDone;
    const classes = ['lesson-item'];
    if (done) classes.push('done');
    if (!unlocked) classes.push('locked');

    html += `
      <a class="${classes.join(' ')}" href="lesson.html?id=${doc.id}">
        <div class="lesson-num">${lesson.order}</div>
        <div>
          <p class="lesson-title">${lesson.title}</p>
          <p class="lesson-sub">${lesson.subtitle || ''}</p>
        </div>
        <div class="check">${done ? '✅' : (unlocked ? '' : '🔒')}</div>
      </a>`;

    previousDone = done;
  });

  listEl.innerHTML = html;
});