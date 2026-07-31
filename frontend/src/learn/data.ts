// Static content for the Vocab sub-app (matches reference designs).
// Tutors are fetched live from /api/pro/tutors.

import { Ionicons } from "@expo/vector-icons";

export type IonIcon = keyof typeof Ionicons.glyphMap;

export type Topic = {
  id: string;
  name: string;
  subtitle: string;
  icon: IonIcon;
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  topicId: string;
};

export type Challenge = {
  id: string;
  title: string;
  daysLeft: number;
  icon: IonIcon;
};

export const currentCourse = {
  id: "medicine-healthcare",
  tag: "In progress",
  title: "Medicine for healthcare professionals",
  progress: 0.32,
};

export const exploreTopics: Topic[] = [
  { id: "virology", name: "Virology", subtitle: "For healthcare providers", icon: "nutrition-outline" },
  { id: "pharmacy", name: "Pharmacy", subtitle: "Medicines & prescriptions", icon: "medkit-outline" },
  { id: "genetics", name: "Genetics", subtitle: "DNA & heredity", icon: "git-branch-outline" },
  { id: "anatomy", name: "Anatomy", subtitle: "Body systems", icon: "body-outline" },
];

export const allTopics: Topic[] = [
  { id: "medicine", name: "Medicine", subtitle: "For healthcare providers", icon: "medical-outline" },
  { id: "education", name: "Education", subtitle: "For education professionals", icon: "school-outline" },
  { id: "business", name: "Business", subtitle: "For career development", icon: "briefcase-outline" },
  { id: "science", name: "Science", subtitle: "For university students", icon: "flask-outline" },
  { id: "tech", name: "Tech", subtitle: "For software engineers", icon: "code-slash-outline" },
  { id: "travel", name: "Travel", subtitle: "For nomads & tourists", icon: "airplane-outline" },
];

export const lessons: Lesson[] = [
  {
    id: "hc-job-interview",
    title: "Prepare for a healthcare job interview",
    description: "The lesson contains some common healthcare interview questions and tips on how to answer them.",
    minutes: 35,
    level: "Advanced",
    topicId: "medicine",
  },
  {
    id: "hc-cv",
    title: "Writing a healthcare CV",
    description: "Learn how to write a good CV to apply for a role in healthcare. Practise common vocabulary and write your own CV.",
    minutes: 25,
    level: "Intermediate",
    topicId: "medicine",
  },
  {
    id: "pharmacy-basics",
    title: "Talking to patients in a pharmacy",
    description: "Common phrases and vocabulary used when helping customers at the pharmacy counter.",
    minutes: 20,
    level: "Beginner",
    topicId: "pharmacy",
  },
  {
    id: "virology-terms",
    title: "Essential virology vocabulary",
    description: "Master core virology terms with real-world examples used in hospitals and labs.",
    minutes: 30,
    level: "Advanced",
    topicId: "virology",
  },
];

export const challenges: Challenge[] = [
  { id: "c1", title: "Learn 20 new words", daysLeft: 3, icon: "reader-outline" },
  { id: "c2", title: "Complete 3 lessons", daysLeft: 5, icon: "trophy-outline" },
];

export const levelIcon = (level: Lesson["level"]): IonIcon => {
  if (level === "Beginner") return "stats-chart-outline";
  if (level === "Intermediate") return "stats-chart-outline";
  return "stats-chart-outline";
};

// ── Static content for the legacy learn screens ────────────────────────────

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: IonIcon;
  color: string;
  earned: boolean;
  progress: { current: number; total: number };
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "a1", title: "First Steps", description: "Complete your first lesson", icon: "footsteps-outline", color: "#8FCB6F", earned: true, progress: { current: 1, total: 1 } },
  { id: "a2", title: "Word Collector", description: "Learn 50 new words", icon: "book-outline", color: "#B7A0F5", earned: true, progress: { current: 50, total: 50 } },
  { id: "a3", title: "On Fire", description: "Keep a 7-day streak", icon: "flame-outline", color: "#F0715C", earned: false, progress: { current: 4, total: 7 } },
  { id: "a4", title: "Quiz Master", description: "Score 100% on 5 quizzes", icon: "ribbon-outline", color: "#FFD43D", earned: false, progress: { current: 2, total: 5 } },
  { id: "a5", title: "Social Butterfly", description: "Chat with 10 partners", icon: "chatbubbles-outline", color: "#7EC8E3", earned: false, progress: { current: 3, total: 10 } },
  { id: "a6", title: "Night Owl", description: "Study after midnight", icon: "moon-outline", color: "#D8CBFF", earned: true, progress: { current: 1, total: 1 } },
];

export type CourseOutlineStep = { title: string; body: string };

export type Course = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  lessons: number;
  minutes: number;
  outline: CourseOutlineStep[];
};

export const COURSES: Course[] = [
  {
    id: "co1", title: "Everyday Conversations", description: "Master small talk, greetings and daily chit-chat.",
    emoji: "💬", color: "#C8E4B4", category: "Speaking", level: "Beginner", lessons: 12, minutes: 180,
    outline: [
      { title: "Greetings & introductions", body: "Say hello like a native." },
      { title: "Talking about your day", body: "Present tense in action." },
      { title: "Making plans", body: "Invite friends with confidence." },
    ],
  },
  {
    id: "co2", title: "Business English", description: "Emails, meetings and negotiations that land well.",
    emoji: "💼", color: "#B7A0F5", category: "Career", level: "Intermediate", lessons: 10, minutes: 240,
    outline: [
      { title: "Professional emails", body: "Structure, tone and sign-offs." },
      { title: "Meetings & standups", body: "Give crisp status updates." },
      { title: "Negotiation basics", body: "Push back with grace." },
    ],
  },
  {
    id: "co3", title: "Travel Survival Kit", description: "Airports, hotels and restaurants without stress.",
    emoji: "✈️", color: "#E8F569", category: "Travel", level: "Beginner", lessons: 8, minutes: 120,
    outline: [
      { title: "At the airport", body: "Check-in, security and boarding." },
      { title: "Hotel check-in", body: "Bookings, requests and issues." },
      { title: "Ordering food", body: "Menus, allergies and tips." },
    ],
  },
  {
    id: "co4", title: "Academic Writing", description: "Essays and reports with clear structure.",
    emoji: "🎓", color: "#F0715C", category: "Career", level: "Advanced", lessons: 9, minutes: 200,
    outline: [
      { title: "Thesis statements", body: "Set up a strong argument." },
      { title: "Paragraph flow", body: "Cohesion and transitions." },
      { title: "Citations", body: "Quote without plagiarising." },
    ],
  },
];

export type GrammarLesson = {
  id: string;
  title: string;
  summary: string;
  emoji: string;
  color: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  body: string;
  examples: string[];
};

export const GRAMMAR_LESSONS: GrammarLesson[] = [
  {
    id: "g1", title: "Present Simple vs Continuous", summary: "When to use each — and when both work.",
    emoji: "⏳", color: "#C8E4B4", level: "Beginner", minutes: 12,
    body: "Use the present simple for habits and facts, and the present continuous for actions happening right now or temporary situations.",
    examples: ["I drink coffee every morning.", "I am drinking coffee right now.", "She lives in Madrid. / She is living in Madrid this year."],
  },
  {
    id: "g2", title: "Past Perfect", summary: "Talk about the earlier of two past events.",
    emoji: "🕰️", color: "#B7A0F5", level: "Intermediate", minutes: 15,
    body: "The past perfect (had + past participle) shows that one action happened before another action in the past.",
    examples: ["The train had left when we arrived.", "She had finished the report before the meeting."],
  },
  {
    id: "g3", title: "Conditionals (0–3)", summary: "If-clauses from facts to regrets.",
    emoji: "🔀", color: "#E8F569", level: "Intermediate", minutes: 18,
    body: "Conditionals link a condition with a result. Zero for facts, first for real futures, second for hypotheticals, third for past regrets.",
    examples: ["If you heat ice, it melts.", "If it rains, we'll stay home.", "If I were you, I'd apply.", "If I had known, I would have come."],
  },
  {
    id: "g4", title: "Articles: a / an / the", summary: "The tiny words that trip everyone up.",
    emoji: "🔤", color: "#F0715C", level: "Beginner", minutes: 10,
    body: "Use a/an for non-specific singular nouns, the for specific ones, and no article for general plurals and uncountables.",
    examples: ["I saw a dog. The dog was friendly.", "She plays the piano.", "Life is beautiful."],
  },
];

export type LeaderboardUser = {
  id: string;
  name: string;
  emoji: string;
  country: string;
  xp: number;
  isYou?: boolean;
};

export const LEADERBOARD: LeaderboardUser[] = [
  { id: "u1", name: "Mei", emoji: "🐼", country: "🇨🇳", xp: 1240 },
  { id: "u2", name: "Diego", emoji: "🦊", country: "🇲🇽", xp: 1105 },
  { id: "u3", name: "You", emoji: "⭐", country: "🌍", xp: 980, isYou: true },
  { id: "u4", name: "Amira", emoji: "🌙", country: "🇪🇬", xp: 875 },
  { id: "u5", name: "Hana", emoji: "🌸", country: "🇯🇵", xp: 720 },
  { id: "u6", name: "Lucas", emoji: "⚡", country: "🇧🇷", xp: 615 },
  { id: "u7", name: "Nina", emoji: "🎈", country: "🇩🇪", xp: 540 },
];

export type Story = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  emoji: string;
  color: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  body: string;
  glossary: { word: string; meaning: string }[];
};

export const STORIES: Story[] = [
  {
    id: "s1", title: "The Lost Umbrella", subtitle: "A rainy-day mix-up", summary: "Two strangers, one umbrella, and a chance meeting.",
    emoji: "☔", color: "#7EC8E3", level: "Beginner", minutes: 5,
    body: "It was raining hard when Ana left the café. She grabbed the blue umbrella by the door — but so did a tall stranger. \"I think this is mine,\" they both said at once, and laughed. They decided to share it to the station, and by the time the rain stopped, they had planned to meet again.",
    glossary: [
      { word: "grabbed", meaning: "took quickly" },
      { word: "stranger", meaning: "a person you don't know" },
      { word: "at once", meaning: "at the same time" },
    ],
  },
  {
    id: "s2", title: "Midnight Bakery", subtitle: "Fresh bread, old secrets", summary: "A baker who only works while the city sleeps.",
    emoji: "🥐", color: "#FFD43D", level: "Intermediate", minutes: 8,
    body: "Everyone in the neighbourhood wondered why Mr. Petrov's bakery opened at midnight and closed at dawn. One sleepless night, Lena followed the smell of cinnamon and discovered the truth: he baked for the night workers — nurses, drivers, cleaners — who never got fresh bread. She kept his secret, but joined him every Friday.",
    glossary: [
      { word: "wondered", meaning: "asked themselves" },
      { word: "dawn", meaning: "when the sun rises" },
      { word: "sleepless", meaning: "unable to sleep" },
    ],
  },
  {
    id: "s3", title: "The Interview", subtitle: "One question changes everything", summary: "A nervous graduate faces a strange final question.",
    emoji: "🗂️", color: "#B7A0F5", level: "Advanced", minutes: 10,
    body: "After ninety minutes of technical questions, the interviewer closed her laptop. \"Last one,\" she said. \"Teach me something — anything — in two minutes.\" Sofia froze, then smiled, and explained how her grandmother read the weather from the mountains. She got the job — not for her answers, but for how she made complexity feel simple.",
    glossary: [
      { word: "froze", meaning: "stopped moving from fear" },
      { word: "complexity", meaning: "the state of being complicated" },
    ],
  },
];

export type Teacher = {
  id: string;
  name: string;
  emoji: string;
  country: string;
  rating: number;
  reviews: number;
  price: string;
  bg: string;
  bio: string;
  languages: string[];
  specialties: string[];
};

export const TEACHERS: Teacher[] = [
  {
    id: "t1", name: "Nouran A.", emoji: "👩🏽‍🏫", country: "🇪🇬 Egypt", rating: 4.9, reviews: 214, price: "$12/hr", bg: "#FCE7F3",
    bio: "Businesswoman and journalist teaching practical English & Arabic for work and travel.",
    languages: ["English", "Arabic"], specialties: ["Business", "Conversation", "IELTS"],
  },
  {
    id: "t2", name: "Choco S.", emoji: "🧑🏻‍🏫", country: "🇯🇵 Japan", rating: 4.8, reviews: 158, price: "$14/hr", bg: "#E0F2FE",
    bio: "Native Japanese tutor focused on fun, anime-friendly lessons for absolute beginners.",
    languages: ["Japanese", "English"], specialties: ["Beginners", "JLPT", "Pronunciation"],
  },
  {
    id: "t3", name: "Maria C.", emoji: "👩🏻‍🏫", country: "🇪🇸 Spain", rating: 5.0, reviews: 302, price: "$15/hr", bg: "#FEF3C7",
    bio: "¡Hola! I help students speak Spanish with confidence from the very first class.",
    languages: ["Spanish", "English"], specialties: ["Conversation", "DELE", "Grammar"],
  },
  {
    id: "t4", name: "Kim D.", emoji: "🧑🏻‍💼", country: "🇰🇷 Korea", rating: 4.7, reviews: 96, price: "$11/hr", bg: "#DCFCE7",
    bio: "Let's have fun learning Korean — K-drama phrases, slang and solid grammar foundations.",
    languages: ["Korean", "English"], specialties: ["K-culture", "TOPIK", "Beginners"],
  },
];

export const WORD_OF_DAY = {
  word: "Serendipity",
  ipa: "/ˌser.ənˈdɪp.ə.ti/",
  meaning: "The luck of finding something good without looking for it.",
  example: "Meeting you here was pure serendipity.",
  exampleTranslation: "এখানে তোমার সাথে দেখা হওয়াটা ছিল একদম সৌভাগ্যক্রমে।",
  language: "English",
  emoji: "✨",
  color: "#B7A0F5",
};
