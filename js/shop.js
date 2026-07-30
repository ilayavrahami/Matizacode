let currentUser = null;
let userData = {};
let activeCategory = 'all';

requireAuth(async (user) => {
  currentUser = user;
  const doc = await db.collection('users').doc(user.uid).get();
  userData = doc.exists ? doc.data() : {};
  renderAll();

  document.querySelectorAll('.shop-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category;
      renderGrid();
    });
  });
});

function renderAll() {
  document.getElementById('coin-pill').textContent = `🪙 ${userData.coins || 0}`;
  document.getElementById('avatar-preview').innerHTML = renderAvatarHTML(userData.avatar, 140);
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('shop-grid');
  const inventory = userData.inventory || {};
  const avatar = userData.avatar || {};

  const items = SHOP_ITEMS.filter((i) => activeCategory === 'all' || i.category === activeCategory);

  grid.innerHTML = items.map((item) => {
    const owned = !!inventory[item.id];
    const equipped = avatar[item.category] === item.id;
    const canAfford = (userData.coins || 0) >= item.price;

    const preview = item.category === 'background'
      ? `<div class="shop-item-swatch" style="background:${item.css};"></div>`
      : `<div class="shop-item-preview">${item.emoji || (item.effect === 'sparkle' ? '✨' : '🔥')}</div>`;

    let actionBtn;
    if (equipped) {
      actionBtn = `<button class="btn-shop equip" data-action="unequip" data-id="${item.id}">להסיר</button>`;
    } else if (owned) {
      actionBtn = `<button class="btn-shop equip" data-action="equip" data-id="${item.id}">להלביש</button>`;
    } else {
      actionBtn = `<button class="btn-shop buy" data-action="buy" data-id="${item.id}" ${canAfford ? '' : 'disabled'}>קנייה</button>`;
    }

    return `
      <div class="shop-item-card">
        ${preview}
        <span class="rarity-badge" style="background:${RARITY_COLORS[item.rarity]}22; color:${RARITY_COLORS[item.rarity]};">${RARITY_LABELS[item.rarity]}</span>
        <p class="shop-item-name">${item.name}</p>
        ${owned ? '' : `<p class="shop-item-price">🪙 ${item.price}</p>`}
        ${actionBtn}
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-action="buy"]').forEach((btn) => btn.addEventListener('click', () => buyItem(btn.dataset.id)));
  grid.querySelectorAll('[data-action="equip"]').forEach((btn) => btn.addEventListener('click', () => equipItem(btn.dataset.id)));
  grid.querySelectorAll('[data-action="unequip"]').forEach((btn) => btn.addEventListener('click', () => unequipItem(btn.dataset.id)));
}

async function buyItem(itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return;

  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection('users').doc(currentUser.uid);
      const snap = await tx.get(ref);
      const u = snap.data() || {};
      const coins = u.coins || 0;
      const inventory = u.inventory || {};

      if (inventory[itemId]) return; // כבר בבעלות, לא לחייב שוב
      if (coins < item.price) throw new Error('אין מספיק מטבעות');

      inventory[itemId] = true;
      const avatar = u.avatar || {};
      avatar[item.category] = itemId; // לובשים אוטומטית מיד אחרי הקנייה

      tx.set(ref, { coins: coins - item.price, inventory, avatar }, { merge: true });
    });

    const doc = await db.collection('users').doc(currentUser.uid).get();
    userData = doc.data() || {};
    renderAll();
  } catch (err) {
    alert(err.message === 'אין מספיק מטבעות' ? 'אין מספיק מטבעות לפריט הזה עדיין 😊' : 'שגיאה: ' + err.message);
  }
}

async function equipItem(itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return;
  const avatar = { ...(userData.avatar || {}), [item.category]: itemId };
  await db.collection('users').doc(currentUser.uid).set({ avatar }, { merge: true });
  userData.avatar = avatar;
  renderAll();
}

async function unequipItem(itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return;
  const avatar = { ...(userData.avatar || {}), [item.category]: null };
  await db.collection('users').doc(currentUser.uid).set({ avatar }, { merge: true });
  userData.avatar = avatar;
  renderAll();
}
