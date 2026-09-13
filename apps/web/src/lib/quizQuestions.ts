import type { Locale } from "@/lib/i18n";

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

const ru: QuizQuestion[] = [
  {
    question: "В каком году Ташкент стал столицей Узбекистана (в его нынешнем статусе)?",
    options: ["1930", "1966", "1991", "2007"],
    correctIndex: 0,
  },
  {
    question: "Как называется главная площадь Ташкента с монументом Независимости?",
    options: ["Площадь Регистан", "Площадь Мустакиллик", "Площадь Амира Темура", "Площадь Хадра"],
    correctIndex: 1,
  },
  {
    question: "Какая река протекает рядом с Ташкентом?",
    options: ["Амударья", "Сырдарья", "Чирчик", "Зарафшан"],
    correctIndex: 2,
  },
  {
    question: "В каком году в Ташкенте произошло разрушительное землетрясение?",
    options: ["1956", "1966", "1976", "1986"],
    correctIndex: 1,
  },
  {
    question: "Как называется ташкентское метро по числу открытых линий на 2024 год?",
    options: ["1 линия", "2 линии", "3 линии", "5 линий"],
    correctIndex: 2,
  },
  {
    question: "Какое блюдо считается национальным символом узбекской кухни?",
    options: ["Манты", "Плов", "Лагман", "Шашлык"],
    correctIndex: 1,
  },
  {
    question: "Как называется знаменитый базар в центре Ташкента?",
    options: ["Чорсу", "Ипподром", "Куйлюк", "Себзор"],
    correctIndex: 0,
  },
  {
    question: "Какой город является второй по величине агломерацией Узбекистана?",
    options: ["Бухара", "Наманган", "Самарканд", "Андижан"],
    correctIndex: 2,
  },
  {
    question: "На какой реке стоит Хива?",
    options: ["Амударья", "Сырдарья", "Зарафшан", "Ни на одной из перечисленных"],
    correctIndex: 3,
  },
  {
    question: "Какая денежная единица используется в Узбекистане?",
    options: ["Тенге", "Сом", "Манат", "Рубль"],
    correctIndex: 1,
  },
];

const uz: QuizQuestion[] = [
  {
    question: "Toshkent qaysi yili (hozirgi maqomida) O‘zbekiston poytaxtiga aylandi?",
    options: ["1930", "1966", "1991", "2007"],
    correctIndex: 0,
  },
  {
    question: "Mustaqillik yodgorligi joylashgan Toshkentning bosh maydoni qanday nomlanadi?",
    options: ["Registon maydoni", "Mustaqillik maydoni", "Amir Temur maydoni", "Xadra maydoni"],
    correctIndex: 1,
  },
  {
    question: "Toshkent yaqinidan qaysi daryo oqib o‘tadi?",
    options: ["Amudaryo", "Sirdaryo", "Chirchiq", "Zarafshon"],
    correctIndex: 2,
  },
  {
    question: "Toshkentda vayronkor zilzila qaysi yili sodir bo‘lgan?",
    options: ["1956", "1966", "1976", "1986"],
    correctIndex: 1,
  },
  {
    question: "2024-yilga kelib Toshkent metrosida nechta liniya ishga tushirilgan?",
    options: ["1 liniya", "2 liniya", "3 liniya", "5 liniya"],
    correctIndex: 2,
  },
  {
    question: "O‘zbek oshxonasining milliy ramzi hisoblangan taom qaysi?",
    options: ["Manti", "Osh (palov)", "Lag‘mon", "Shashlik"],
    correctIndex: 1,
  },
  {
    question: "Toshkent markazidagi mashhur bozor qanday ataladi?",
    options: ["Chorsu", "Ippodrom", "Quyluq", "Sebzor"],
    correctIndex: 0,
  },
  {
    question: "O‘zbekistonning aholi soni bo‘yicha ikkinchi yirik shahri qaysi?",
    options: ["Buxoro", "Namangan", "Samarqand", "Andijon"],
    correctIndex: 2,
  },
  {
    question: "Xiva qaysi daryo bo‘yida joylashgan?",
    options: ["Amudaryo", "Sirdaryo", "Zarafshon", "Yuqoridagilarning hech biri"],
    correctIndex: 3,
  },
  {
    question: "O‘zbekistonda qanday pul birligi ishlatiladi?",
    options: ["Tenge", "So‘m", "Manat", "Rubl"],
    correctIndex: 1,
  },
];

const en: QuizQuestion[] = [
  {
    question: "In what year did Tashkent become the capital of Uzbekistan (in its current status)?",
    options: ["1930", "1966", "1991", "2007"],
    correctIndex: 0,
  },
  {
    question: "What is Tashkent's main square with the Independence Monument called?",
    options: ["Registan Square", "Mustaqillik Square", "Amir Temur Square", "Khadra Square"],
    correctIndex: 1,
  },
  {
    question: "Which river runs near Tashkent?",
    options: ["Amu Darya", "Syr Darya", "Chirchiq", "Zarafshan"],
    correctIndex: 2,
  },
  {
    question: "In what year did a devastating earthquake hit Tashkent?",
    options: ["1956", "1966", "1976", "1986"],
    correctIndex: 1,
  },
  {
    question: "How many lines did the Tashkent Metro have as of 2024?",
    options: ["1 line", "2 lines", "3 lines", "5 lines"],
    correctIndex: 2,
  },
  {
    question: "Which dish is considered the national symbol of Uzbek cuisine?",
    options: ["Manti", "Plov (pilaf)", "Lagman", "Shashlik"],
    correctIndex: 1,
  },
  {
    question: "What is the famous bazaar in central Tashkent called?",
    options: ["Chorsu", "Ippodrom", "Kuyluk", "Sebzor"],
    correctIndex: 0,
  },
  {
    question: "Which is Uzbekistan's second-largest city by population?",
    options: ["Bukhara", "Namangan", "Samarkand", "Andijan"],
    correctIndex: 2,
  },
  {
    question: "On which river is Khiva located?",
    options: ["Amu Darya", "Syr Darya", "Zarafshan", "None of the above"],
    correctIndex: 3,
  },
  {
    question: "What is the currency of Uzbekistan?",
    options: ["Tenge", "Som", "Manat", "Ruble"],
    correctIndex: 1,
  },
];

export const QUIZ_QUESTIONS: Record<Locale, QuizQuestion[]> = { ru, uz, en };
