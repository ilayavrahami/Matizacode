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
    maxOrder: 4,
    floatSymbols: ["A", "B", "X", "01", "10", "{ }"],
    bossTitle: "בוס: הדפסה למסך"
  },
  {
    id: "world-2",
    title: "הר ה-Pygame",
    subtitle: "בונים משחק אמיתי",
    emoji: "⛰️",
    theme: "red",
    minOrder: 5,
    maxOrder: 8,
    floatSymbols: ["🎮", "👾", "🕹️", "⚙️"],
    bossTitle: "בוס: הדמות הזזה"
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
