// הגדרת "עולמות" למפת ההרפתקאות. כדי להוסיף עולם חדש בעתיד — פשוט מוסיפים
// אובייקט נוסף למערך הזה עם טווח order מתאים לשיעורים החדשים.
// 4 הפלטות (blue/green/purple/red) כבר מוכנות לשימוש גם אם כרגע רק 2 עולמות
// פעילים בפועל (לפי תוכן השיעורים הקיים) — כך שהרחבה עתידית היא שינוי קטן.
const WORLDS = [
  {
    id: "world-1",
    title: "אי ההתחלה",
    subtitle: "הכלים הראשונים",
    emoji: "🏝️",
    theme: "blue",
    minOrder: 1,
    maxOrder: 10,
    floatSymbols: ["A", "B", "X", "01", "10", "{ }"],
    bossTitle: "בוס: המשחק המלא"
  },
  {
    id: "world-2",
    title: "הר ה-Pygame",
    subtitle: "בונים משחק אמיתי",
    emoji: "⛰️",
    theme: "red",
    minOrder: 11,
    maxOrder: 14,
    floatSymbols: ["🎮", "👾", "🕹️", "⚙️"],
    bossTitle: "בוס: אתגר Pygame"
  }
  // דוגמה לעולם עתידי (לא פעיל עדיין, כי אין שיעורים בטווח הזה):
  // { id: "world-3", title: "יער התנאים", subtitle: "if / else",
  //   emoji: "🌲", theme: "green", minOrder: 9, maxOrder: 12,
  //   floatSymbols: ["IF", "ELSE", "?", "✓"], bossTitle: "בוס: אתגר התנאים" },
  // { id: "world-4", title: "מבצר הלולאות", subtitle: "while / for",
  //   emoji: "🏰", theme: "purple", minOrder: 13, maxOrder: 16,
  //   floatSymbols: ["↻", "⚙️", "∞"], bossTitle: "בוס: אתגר הלולאות" }
];

function worldForOrder(order) {
  return WORLDS.find((w) => order >= w.minOrder && order <= w.maxOrder) || null;
}

// נקודות עיגון של סמלי הגולגולת הזוהרים על גבי assets/floating-island.png,
// שנמדדו ישירות מהתמונה (איתור פיקסלים בצבע הזוהר הכתום/צהוב, קיבוץ
// לרכיבים, ואימות חזותי) — לא ניחוש. אחוזים יחסית לגודל התמונה המלאה
// (1672×941), כך שהם עובדים בכל גודל תצוגה.
const ISLAND_MARKER_SLOTS = [
  { x: 9.84, y: 53.26 }, { x: 19.98, y: 45.98 }, { x: 29.40, y: 46.81 },
  { x: 37.46, y: 54.20 }, { x: 49.52, y: 43.84 }, { x: 58.01, y: 52.56 },
  { x: 63.16, y: 41.89 }, { x: 70.51, y: 51.37 }, { x: 79.49, y: 55.14 },
  { x: 84.15, y: 45.43 }, { x: 91.30, y: 54.09 }
];

// בוחר N נקודות עיגון — פשוט הראשונות מימין... כלומר משמאל לימין ברצף,
// בדיוק כמו שהדגלים בתמונה עצמם ממוספרים (1, 2, 3...) — כך ששיעור 1 נופל
// על הדגל שכתוב עליו "1", שיעור 2 על "2" וכך הלאה. אם יש בעולם יותר
// שיעורים מנקודות זמינות בתמונה, חוזרים על הנקודה האחרונה.
function pickMarkerSlots(n) {
  const total = ISLAND_MARKER_SLOTS.length;
  const picked = [];
  for (let i = 0; i < n; i++) {
    picked.push(ISLAND_MARKER_SLOTS[Math.min(i, total - 1)]);
  }
  return picked;
}
