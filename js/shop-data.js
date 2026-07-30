// קטלוג חנות האווטאר. כל פריט: id, שם, קטגוריה (hat/glasses/background/effect),
// נדירות (common/rare/legendary), מחיר במטבעות, ואיך לצייר אותו.
// אין כאן איורים מיוחדים — כל הפריטים בנויים מאימוג'י ואפקטי CSS, כדי שלא
// נדרשים קבצי תמונה חיצוניים.
const SHOP_ITEMS = [
  // ===== כובעים =====
  { id: "hat_cap", name: "כובע מצחייה", category: "hat", rarity: "common", price: 30, emoji: "🧢" },
  { id: "hat_tophat", name: "כובע צילינדר", category: "hat", rarity: "common", price: 30, emoji: "🎩" },
  { id: "hat_crown", name: "כתר מלכותי", category: "hat", rarity: "rare", price: 90, emoji: "👑" },
  { id: "hat_wizard", name: "כובע קוסם", category: "hat", rarity: "rare", price: 100, emoji: "🧙" },
  { id: "hat_party", name: "כובע מסיבה", category: "hat", rarity: "legendary", price: 220, emoji: "🥳" },

  // ===== משקפיים =====
  { id: "glasses_regular", name: "משקפיים", category: "glasses", rarity: "common", price: 25, emoji: "👓" },
  { id: "glasses_sun", name: "משקפי שמש", category: "glasses", rarity: "common", price: 30, emoji: "🕶️" },
  { id: "glasses_star", name: "משקפי כוכבים", category: "glasses", rarity: "rare", price: 95, emoji: "🤩" },

  // ===== רקעים =====
  { id: "bg_sky", name: "רקע שמיים", category: "background", rarity: "common", price: 25,
    css: "radial-gradient(circle, #4A7CFF 0%, #17122B 75%)" },
  { id: "bg_mint", name: "רקע מנטה", category: "background", rarity: "common", price: 25,
    css: "radial-gradient(circle, #2EE6D0 0%, #17122B 75%)" },
  { id: "bg_galaxy", name: "רקע גלקסיה", category: "background", rarity: "rare", price: 110,
    css: "radial-gradient(circle at 30% 30%, #B14EFF 0%, #241D42 60%, #17122B 100%)" },
  { id: "bg_rainbow", name: "רקע קשת", category: "background", rarity: "legendary", price: 230,
    css: "conic-gradient(from 0deg, #FF8FB1, #FFE156, #2EE6D0, #4A7CFF, #B14EFF, #FF8FB1)", animated: true },

  // ===== אפקטים מיוחדים (אגדי בלבד) =====
  { id: "fx_sparkle", name: "הילה נוצצת", category: "effect", rarity: "legendary", price: 250, effect: "sparkle" },
  { id: "fx_fire", name: "הילת אש", category: "effect", rarity: "legendary", price: 250, effect: "fire" }
];

const RARITY_LABELS = { common: "נפוץ", rare: "נדיר", legendary: "אגדי" };
const RARITY_COLORS = { common: "var(--text-dim)", rare: "var(--turquoise)", legendary: "var(--yellow)" };

// בונה HTML של תצוגת אווטאר (מסקוט + פריטים מצוידים), לשימוש בעמוד הראשי,
// בחנות, ובכל מקום אחר שרוצים להראות את הדמות של הילד/ה.
// avatar = { hat, glasses, background, effect } (מזהי פריטים או null)
function renderAvatarHTML(avatar, size = 120) {
  avatar = avatar || {};
  const bgItem = SHOP_ITEMS.find((i) => i.id === avatar.background);
  const hatItem = SHOP_ITEMS.find((i) => i.id === avatar.hat);
  const glassesItem = SHOP_ITEMS.find((i) => i.id === avatar.glasses);
  const fxItem = SHOP_ITEMS.find((i) => i.id === avatar.effect);

  const bgStyle = bgItem ? `background:${bgItem.css};` : '';
  const fxClass = fxItem ? `avatar-fx-${fxItem.effect}` : '';

  return `
    <div class="avatar-frame ${fxClass}" style="width:${size}px; height:${size}px; ${bgStyle}">
      ${fxItem && fxItem.effect === 'sparkle' ? '<span class="avatar-sparkle s1">✨</span><span class="avatar-sparkle s2">⭐</span><span class="avatar-sparkle s3">✨</span>' : ''}
      <img src="assets/maccia-mascot.svg" class="avatar-mascot" alt="מציה">
      ${hatItem ? `<span class="avatar-hat">${hatItem.emoji}</span>` : ''}
      ${glassesItem ? `<span class="avatar-glasses">${glassesItem.emoji}</span>` : ''}
    </div>`;
}
