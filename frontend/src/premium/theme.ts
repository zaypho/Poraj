// Royal-purple + gold premium palette for the exclusive members' area.
// Kept in its own module so screens can pick it up without touching the
// main app theme.

import { ThemeColors } from "@/src/theme";

export const premiumColors = {
  // Backgrounds
  bg: "#0F0623",           // very deep royal black-purple
  surface: "#1A0F2E",       // main surface
  surfaceRaised: "#251742", // elevated card
  surfaceHigh: "#312057",   // active state
  chip: "#3B2A63",

  // Text
  onSurface: "#F5EDDA",         // cream white (matches gold)
  onSurfaceSecondary: "#B9A5D6",// soft lilac
  onSurfaceTertiary: "#7A6B96",

  // Accents
  gold: "#FFB627",         // rich gold — primary brand
  goldSoft: "#FFD866",     // softer gold for hover / secondary
  goldDeep: "#C08316",     // deep gold for pressed state
  onGold: "#1A0F2E",        // text on gold

  // Utility
  border: "#3B2456",
  divider: "#241338",
  error: "#F87171",
  success: "#A5FF5C",
  info: "#B4A0FF",

  // Category tints (softened for premium)
  purple: "#B892FF",
  rose: "#FF9AC7",
  emerald: "#7FF6C3",
  amber: "#FFCE6F",
} as const;

export const premiumRadius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/**
 * premiumColors mapped onto the shared `ThemeColors` shape so any screen that
 * is written against the main theme (e.g. the chat conversation screen) can be
 * rendered in the royal-purple + gold Premium palette simply by feeding it this
 * object instead of the light/dark theme. This lets the Premium Club reuse the
 * exact same feature-rich screens — only the colours/theme differ.
 *
 * Key intent for chat:
 *  - brand (my sent bubbles + send button) -> gold
 *  - surface (screen/header/input bg) -> deep purple surface
 *  - surfaceSecondary (their bubbles + input pill) -> raised purple
 */
export const premiumThemeColors: ThemeColors = {
  surface: premiumColors.surface,
  onSurface: premiumColors.onSurface,
  surfaceSecondary: premiumColors.surfaceRaised,
  onSurfaceSecondary: premiumColors.onSurfaceSecondary,
  surfaceTertiary: premiumColors.surfaceHigh,
  onSurfaceTertiary: premiumColors.onSurfaceTertiary,
  brand: premiumColors.gold,
  onBrand: premiumColors.onGold,
  brandSecondary: premiumColors.goldSoft,
  onBrandSecondary: premiumColors.onGold,
  brandTertiary: premiumColors.chip,
  onBrandTertiary: premiumColors.goldSoft,
  success: premiumColors.success,
  warning: premiumColors.goldSoft,
  error: premiumColors.error,
  border: premiumColors.border,
  borderStrong: premiumColors.onSurfaceTertiary,
  divider: premiumColors.divider,

  // Premium chat bubbles — gold "mine", raised purple "theirs".
  bubbleMine: premiumColors.gold,
  onBubbleMine: premiumColors.onGold,
  bubbleTheirs: premiumColors.surfaceRaised,
  onBubbleTheirs: premiumColors.onSurface,
  bubbleMeta: premiumColors.onSurfaceSecondary,

  // Voice message accents on premium theme
  waveActive: premiumColors.gold,
  waveInactive: premiumColors.chip,
  speedPillBg: premiumColors.chip,
  speedPillText: premiumColors.goldSoft,
};
