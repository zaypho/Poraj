import { api } from "@/src/utils/api";

export type VocabTopic = {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  color: "lime" | "mint" | "purple";
  word_count: number;
  words_learned: number;
};

export type VocabWord = {
  id: string;
  term: string;
  translation: string;
  example: string;
  topic_id: string;
  status: "new" | "learning" | "known";
  lang?: string;
  source_term?: string;
  source_example?: string;
};

export type VocabLesson = {
  id: string;
  title: string;
  description: string;
  topic_id: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  xp_reward: number;
  completed?: boolean;
};

export type VocabLessonStep =
  | { kind: "vocab"; term: string; translation: string; example: string; word_id: string }
  | { kind: "quiz"; prompt: string; options: string[]; answer: string; word_id: string }
  | { kind: "done"; message: string };

export type VocabLessonFull = VocabLesson & {
  steps: VocabLessonStep[];
  progress: { status: string; current_step: number; xp_awarded: number };
};

export type VocabStats = {
  words_learned: number;
  words_practicing: number;
  lessons_completed: number;
  streak: number;
  level: number;
  xp: number;
  xp_in_level: number;
  xp_to_next: number;
  progress: number;
  placement_level?: "Beginner" | "Intermediate" | "Advanced" | null;
};

export type VocabContinue = {
  id: string;
  title: string;
  topic_id: string;
  topic_name: string;
  level: string;
  minutes: number;
  progress: number;
  tag: string;
};

export type VocabChallenge = {
  id: string;
  title: string;
  days_left: number;
  icon: string;
  goal_type: string;
  target: number;
  current: number;
  progress: number;
  completed: boolean;
};

export type VocabBooking = {
  id: string;
  user_id: string;
  tutor_id: string;
  slot_iso: string;
  duration_min: number;
  note?: string | null;
  status: string;
  created_at: string;
  tutor_name?: string;
  tutor_avatar_url?: string;
};

export type SupportedVocabLanguage = {
  code: string;
  name: string;
};

export const vocabApi = {
  listTopics: () => api.get<VocabTopic[]>("/vocab/topics"),
  getTopic: (id: string) => api.get<VocabTopic>(`/vocab/topics/${id}`),
  listWords: (topicId: string, lang?: string) => {
    const q = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    return api.get<VocabWord[]>(`/vocab/topics/${topicId}/words${q}`);
  },
  listLessons: (params?: { topic_id?: string; level?: string }) => {
    const q = new URLSearchParams();
    if (params?.topic_id) q.set("topic_id", params.topic_id);
    if (params?.level) q.set("level", params.level);
    const qs = q.toString();
    return api.get<VocabLesson[]>(`/vocab/lessons${qs ? `?${qs}` : ""}`);
  },
  getLesson: (id: string, lang?: string) => {
    const q = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    return api.get<VocabLessonFull>(`/vocab/lessons/${id}${q}`);
  },
  listLanguages: () =>
    api.get<{ supported: SupportedVocabLanguage[]; current: string }>(
      "/vocab/languages",
    ),
  setLanguage: (lang: string) =>
    api.post<{ ok: boolean; learning_language: string }>("/vocab/me/language", { lang }),
  setWordProgress: (word_id: string, status: "new" | "learning" | "known") =>
    api.post<{ ok: boolean; stats: VocabStats }>("/vocab/progress/word", { word_id, status }),
  completeLesson: (id: string, body: { step_count?: number; correct_count?: number }) =>
    api.post<{ ok: boolean; xp_awarded: number; stats: VocabStats }>(`/vocab/lessons/${id}/complete`, body),
  myStats: () => api.get<VocabStats>("/vocab/me/stats"),
  myContinue: () => api.get<VocabContinue>("/vocab/me/continue"),
  myBookmarks: () =>
    api.get<{ tutors: { target_id: string }[]; words: { target_id: string }[]; lessons: { target_id: string }[] }>(
      "/vocab/me/bookmarks",
    ),
  toggleBookmark: (target_type: "tutor" | "word" | "lesson", target_id: string) =>
    api.post<{ bookmarked: boolean }>("/vocab/bookmarks/toggle", { target_type, target_id }),
  bookmarkStatus: (target_type: string, target_id: string) =>
    api.get<{ bookmarked: boolean }>(`/vocab/bookmarks/status/${target_type}/${target_id}`),
  createBooking: (body: { tutor_id: string; slot_iso: string; duration_min?: number; note?: string }) =>
    api.post<VocabBooking>("/vocab/bookings", body),
  myBookings: () => api.get<VocabBooking[]>("/vocab/me/bookings"),
  cancelBooking: (id: string) => api.delete<{ ok: boolean }>(`/vocab/bookings/${id}`),
  listChallenges: () => api.get<VocabChallenge[]>("/vocab/challenges"),
  placementQuestions: () =>
    api.get<{ attempt_id: string; questions: PlacementQuestion[] }>(
      "/vocab/placement/questions",
    ),
  placementSubmit: (attempt_id: string, answers: Record<string, string>) =>
    api.post<PlacementResult>("/vocab/placement/submit", { attempt_id, answers }),
};

export type PlacementQuestion = {
  id: string;
  tier: "easy" | "medium" | "hard";
  prompt: string;
  options: string[];
};

export type PlacementResult = {
  score: number;
  total: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  correct_by_tier: Record<string, number>;
};
