import { MaterialCommunityIcons } from "@/src/ui/icons";
import React from "react";
import { StyleProp, TextStyle } from "react-native";

// -----------------------------------------------------------------------------
// Vocab sub-app icon helper
//
// Every icon rendered inside the Vocab sub-app is drawn with
// MaterialCommunityIcons so the visual weight matches the reference designs
// (rounded outlines, "box"-style variants for play/profile, emoticon smiley
// for tutors, etc.).
//
// Historically we used mixed Ionicons + MCI names.  This helper accepts *any*
// legacy Ionicons-style name and maps it to its MCI equivalent so callers can
// keep writing familiar names like "arrow-back" without knowing MCI vocab.
// Anything not in the map is passed through as-is (must already be a valid
// MCI icon name).
// -----------------------------------------------------------------------------

const NAME_MAP: Record<string, string> = {
  // ── Navigation / arrows ──────────────────────────────────────────────
  "arrow-back": "chevron-left",
  "arrow-forward": "chevron-right",
  "chevron-forward": "chevron-right",
  "chevron-back": "chevron-left",
  "chevron-down": "chevron-down",
  "chevron-up": "chevron-up",
  close: "close",
  "close-circle": "close-circle",
  checkmark: "check",
  "checkmark-circle": "check-circle",

  // ── Toolbar / controls ──────────────────────────────────────────────
  search: "magnify",
  "options-outline": "tune-variant",
  options: "tune-variant",
  "settings-outline": "cog-outline",
  settings: "cog",

  // ── Theme ───────────────────────────────────────────────────────────
  sunny: "white-balance-sunny",
  moon: "weather-night",

  // ── Stats / status ──────────────────────────────────────────────────
  flame: "fire",
  "flame-outline": "fire",
  star: "star",
  "star-outline": "star-outline",
  trophy: "trophy",
  "trophy-outline": "trophy-outline",
  "sparkles-outline": "star-four-points-outline",
  sparkles: "star-four-points",
  "medal-outline": "medal-outline",

  // ── Media ───────────────────────────────────────────────────────────
  play: "play",
  "play-circle": "play-circle",
  "play-circle-outline": "play-circle-outline",
  "play-box": "play-box",
  "play-box-outline": "play-box-outline",
  refresh: "refresh",

  // ── Content / lists ────────────────────────────────────────────────
  bookmark: "bookmark",
  "bookmark-outline": "bookmark-outline",
  "albums-outline": "card-multiple-outline",
  "list-outline": "format-list-bulleted",
  "reader-outline": "text-box-outline",
  "library-outline": "bookshelf",
  "book-outline": "book-outline",
  book: "book",

  // ── Time / charts ───────────────────────────────────────────────────
  "time-outline": "clock-outline",
  time: "clock",
  "stats-chart": "chart-bar",
  "stats-chart-outline": "chart-bar",

  // ── People / education ─────────────────────────────────────────────
  "school-outline": "school-outline",
  school: "school",
  "people-outline": "account-group-outline",
  people: "account-group",
  "person-outline": "account-outline",
  person: "account",
  "account-box-outline": "account-box-outline",
  "account-box": "account-box",

  // ── Communication ──────────────────────────────────────────────────
  "chatbubble-ellipses-outline": "chat-processing-outline",
  "chatbubble-outline": "chat-outline",
  chatbubble: "chat",
  "calendar-outline": "calendar-outline",
  calendar: "calendar",
  "card-outline": "credit-card-outline",
  "help-circle-outline": "help-circle-outline",
  "notifications-outline": "bell-outline",
  notifications: "bell",
  "language-outline": "translate",

  // ── Topic seed icons (Ionicons → MCI) ──────────────────────────────
  "medical-outline": "medical-bag",
  "nutrition-outline": "food-apple-outline",
  "medkit-outline": "pill",
  "git-branch-outline": "source-branch",
  "body-outline": "human",
  "briefcase-outline": "briefcase-outline",
  "flask-outline": "flask-outline",
  "code-slash-outline": "code-tags",
  "airplane-outline": "airplane",
  "heart-circle-outline": "heart-outline",
  "happy-outline": "emoticon-happy-outline",
  happy: "emoticon-happy",
  "cash-outline": "cash-multiple",
  "shield-checkmark-outline": "shield-check-outline",
  "megaphone-outline": "bullhorn-outline",
  "restaurant-outline": "silverware-fork-knife",
  "football-outline": "soccer",
  "musical-notes-outline": "music-note-outline",
  "film-outline": "movie-outline",
  "shirt-outline": "tshirt-crew-outline",
  "color-palette-outline": "palette-outline",
  "leaf-outline": "leaf",
  "flower-outline": "flower-outline",
  "planet-outline": "earth",
  "flag-outline": "flag-outline",
  "home-outline": "home-outline",
  home: "home",
};

export function mciName(name: string | undefined | null): string {
  if (!name) return "help-circle-outline";
  return NAME_MAP[name] || name;
}

export type VIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Vocab icon.  Drop-in replacement for `<Ionicons />` — accepts the same names
 * and renders using MaterialCommunityIcons for a consistent rounded-outline
 * look across the entire sub-app (tabs, back buttons, cards, modals, ...).
 */
export function VIcon({ name, size = 20, color, style }: VIconProps) {
  return (
    <MaterialCommunityIcons
      name={mciName(name) as any}
      size={size}
      color={color}
      style={style}
    />
  );
}
