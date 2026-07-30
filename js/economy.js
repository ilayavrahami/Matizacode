// ===== כלכלת מטבעות =====
const COINS_PER_LESSON = 50;
const COINS_PER_EXERCISE = 20;
const COINS_PER_BOSS = 150; // שלב הבוס (השיעור האחרון בכל עולם) שווה יותר

// מעניק מטבעות פעם אחת בלבד עבור מפתח נתון (guardKey) — כדי שאי אפשר יהיה
// "לחקלא" מטבעות בלי סוף על ידי חזרה שוב ושוב על אותו תרגיל/שיעור.
// משתמש בטרנזקציה של Firestore כדי שהבדיקה והכתיבה יהיו אטומיות.
async function awardCoinsOnce(uid, guardKey, amount) {
  let awarded = false;
  await db.runTransaction(async (tx) => {
    const ref = db.collection('users').doc(uid);
    const snap = await tx.get(ref);
    const u = snap.data() || {};
    const awardedFlags = u.coinAwards || {};
    if (awardedFlags[guardKey]) return; // כבר קיבלו מטבעות על זה בעבר
    awardedFlags[guardKey] = true;
    const newCoins = (u.coins || 0) + amount;
    tx.set(ref, { coins: newCoins, coinAwards: awardedFlags }, { merge: true });
    awarded = true;
  });
  return awarded;
}

// אנימציית "+X מטבעות" צפה שנעלמת אחרי כמה שניות
function showCoinToast(amount) {
  const toast = document.createElement('div');
  toast.className = 'coin-toast';
  toast.textContent = `+${amount} 🪙`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
