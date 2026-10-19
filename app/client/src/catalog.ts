/** Browse categories shown on the Search page (queries run against YouTube). */
export type Category = {
  id: string;
  title: string;
  color: string;
  /** Used for the tilted artwork; first result of `query` is fetched lazily. */
  query: string;
  sections: Array<{ title: string; query: string }>;
};

export const categories: Category[] = [
  {
    id: "mahragan",
    title: "مهرجانات",
    color: "#e8115b",
    query: "مهرجانات مصرية جديدة",
    sections: [
      { title: "أحدث المهرجانات", query: "مهرجانات مصرية جديدة 2026" },
      { title: "مهرجانات ترند", query: "مهرجانات ترند" },
      { title: "مهرجانات للفرح والسهر", query: "مهرجانات رقص وافراح" },
    ],
  },
  {
    id: "rap",
    title: "راب مصري",
    color: "#8d67ab",
    query: "راب مصري",
    sections: [
      { title: "راب جامد", query: "راب مصري جديد" },
      { title: "كلاسيكيات الراب", query: "راب مصري قديم كلاسيك" },
      { title: "ميكسات راب", query: "ميكس راب مصري" },
    ],
  },
  {
    id: "pop",
    title: "بوب",
    color: "#dc148c",
    query: "pop hits",
    sections: [
      { title: "أشهر أغاني البوب", query: "top pop hits" },
      { title: "إصدارات جديدة", query: "new pop songs" },
      { title: "بوب كلاسيك", query: "classic pop songs" },
    ],
  },
  {
    id: "arabic",
    title: "عربي",
    color: "#1e3264",
    query: "اغاني عربية",
    sections: [
      { title: "أغاني عربية جديدة", query: "اغاني عربية جديدة" },
      { title: "كلاسيكيات الطرب", query: "ام كلثوم عبد الحليم فيروز" },
      { title: "أغاني رومانسية", query: "اغاني عربية رومانسية" },
    ],
  },
  {
    id: "shaabi",
    title: "شعبي",
    color: "#e13300",
    query: "اغاني شعبي",
    sections: [
      { title: "شعبي مصري", query: "اغاني شعبي مصري" },
      { title: "أحمد شيبة وحمو بيكا", query: "احمد شيبة حمو بيكا" },
      { title: "ميكس شعبي", query: "ميكس شعبي" },
    ],
  },
  {
    id: "focus",
    title: "تركيز",
    color: "#503750",
    query: "lofi hip hop",
    sections: [
      { title: "Lofi للمذاكرة", query: "lofi hip hop study" },
      { title: "موسيقى هادئة", query: "calm piano focus" },
      { title: "موسيقى بدون كلام", query: "instrumental focus music" },
    ],
  },
  {
    id: "workout",
    title: "رياضة",
    color: "#477d95",
    query: "gym workout music",
    sections: [
      { title: "حماس للجيم", query: "gym motivation music" },
      { title: "ركض وكارديو", query: "running music mix" },
      { title: "راب للتمرين", query: "workout rap mix" },
    ],
  },
  {
    id: "chill",
    title: "هدوء ونوم",
    color: "#006450",
    query: "relaxing music",
    sections: [
      { title: "استرخاء", query: "relaxing music" },
      { title: "نوم عميق", query: "sleep music" },
      { title: "صوت المطر", query: "rain sounds sleep" },
    ],
  },
  {
    id: "travel",
    title: "سفر وعربية",
    color: "#af2896",
    query: "اغاني سفر",
    sections: [
      { title: "أغاني للطريق", query: "اغاني طريق سفر" },
      { title: "ميكس سواقة", query: "driving music mix" },
      { title: "سهرة مع الصحاب", query: "اغاني سهرة" },
    ],
  },
  {
    id: "quran",
    title: "قرآن وأذكار",
    color: "#1e7c5a",
    query: "القران الكريم تلاوة",
    sections: [
      { title: "تلاوات مختارة", query: "القران الكريم تلاوة خاشعة" },
      { title: "قراء مشهورون", query: "مشاري العفاسي ماهر المعيقلي" },
      { title: "أذكار وأدعية", query: "اذكار الصباح" },
    ],
  },
  {
    id: "podcast",
    title: "بودكاست",
    color: "#006450",
    query: "بودكاست عربي",
    sections: [
      { title: "بودكاست مصري", query: "بودكاست مصري" },
      { title: "قصص وحكايات", query: "بودكاست قصص" },
      { title: "ثقافة وتطوير", query: "بودكاست تطوير الذات" },
    ],
  },
  {
    id: "gaming",
    title: "ألعاب وأنمي",
    color: "#7358ff",
    query: "gaming music mix",
    sections: [
      { title: "موسيقى الألعاب", query: "gaming music mix" },
      { title: "أنمي", query: "anime openings" },
      { title: "ريمكسات", query: "bass boosted remix" },
    ],
  },
];

export const homeChips = [
  { id: "all", label: "الكل" },
  { id: "mahragan", label: "مهرجانات" },
  { id: "rap", label: "راب" },
  { id: "arabic", label: "عربي" },
  { id: "shaabi", label: "شعبي" },
  { id: "focus", label: "تركيز" },
  { id: "chill", label: "هدوء" },
];

export const homeShelves = [
  { title: "اخترنا ليك النهاردة", query: "اغاني عربية جديدة" },
  { title: "ترند في مصر", query: "ترند اغاني مصر" },
  { title: "راب مصري جامد", query: "راب مصري جديد" },
  { title: "مهرجانات السهرة", query: "مهرجانات مصرية جديدة" },
  { title: "هدوء وتركيز", query: "lofi hip hop" },
];

/** Starter tiles for the quick-access grid when the user has no history yet. */
export const starterMixes = [
  { title: "ميكس مهرجانات", query: "ميكس مهرجانات" },
  { title: "راب جامد", query: "راب مصري" },
  { title: "أغاني عمرو دياب", query: "عمرو دياب اجمل اغاني" },
  { title: "ام كلثوم", query: "ام كلثوم" },
  { title: "Lofi", query: "lofi hip hop" },
  { title: "تلاوات", query: "القران الكريم تلاوة" },
  { title: "ميكس شعبي", query: "ميكس شعبي" },
  { title: "Top Hits", query: "top hits" },
];
