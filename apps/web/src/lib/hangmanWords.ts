import type { Locale } from "@/lib/i18n";

// Слова без пробелов и дефисов — только буквы, чтобы игра оставалась простой
// (без спецобработки составных слов). Узбекская апостроф-буква (oʻ/gʻ)
// сознательно набрана обычным ASCII-апострофом и клавиатурой добавлена как
// отдельная «буква» — не нужно городить диграфы ради мини-игры.
const ru: string[] = [
  "ТАШКЕНТ",
  "УЗБЕКИСТАН",
  "САМАРКАНД",
  "БУХАРА",
  "ХИВА",
  "АНДИЖАН",
  "НАМАНГАН",
  "ПЛОВ",
  "ЛАГМАН",
  "ШАШЛЫК",
  "ЧОРСУ",
  "РЕГИСТАН",
  "МЕТРО",
  "БАЗАР",
  "ЧАЙХАНА",
  "ЛЕПЁШКА",
  "СОМ",
  "ХЛОПОК",
  "АРЫК",
  "МАХАЛЛЯ",
];

const uz: string[] = [
  "TOSHKENT",
  "O'ZBEKISTON",
  "SAMARQAND",
  "BUXORO",
  "XIVA",
  "ANDIJON",
  "NAMANGAN",
  "PALOV",
  "LAGMON",
  "SHASHLIK",
  "CHORSU",
  "REGISTON",
  "METRO",
  "BOZOR",
  "CHOYXONA",
  "NON",
  "SO'M",
  "PAXTA",
  "ARIQ",
  "MAHALLA",
];

const en: string[] = [
  "TASHKENT",
  "UZBEKISTAN",
  "SAMARKAND",
  "BUKHARA",
  "KHIVA",
  "ANDIJAN",
  "NAMANGAN",
  "PLOV",
  "LAGMAN",
  "SHASHLIK",
  "BAZAAR",
  "REGISTAN",
  "METRO",
  "TEAHOUSE",
  "FLATBREAD",
  "COTTON",
  "SILKROAD",
  "CARAVAN",
  "MOSQUE",
  "MINARET",
];

export const HANGMAN_WORDS: Record<Locale, string[]> = { ru, uz, en };

export const HANGMAN_KEYBOARDS: Record<Locale, string[]> = {
  ru: Array.from("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"),
  uz: [...Array.from("ABCDEFGHIJKLMNOPQRSTUVXYZ"), "'"],
  en: Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
};
