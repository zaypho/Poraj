// LinguaConnect design tokens — refined Light & Dark palettes with unified
// purple accents, chat-bubble semantics and voice-message tokens.
// Both palettes share the same shape so screens can swap themes freely.
export interface ThemeColors {
  // Base surfaces
  surface: string;
  onSurface: string;
  surfaceSecondary: string;
  onSurfaceSecondary: string;
  surfaceTertiary: string;
  onSurfaceTertiary: string;

  // Brand / primary accent (purple)
  brand: string;
  onBrand: string;
  brandSecondary: string;
  onBrandSecondary: string;
  brandTertiary: string;
  onBrandTertiary: string;

  // Semantic
  success: string;
  warning: string;
  error: string;

  // Structure
  border: string;
  borderStrong: string;
  divider: string;

  // Chat bubbles
  bubbleMine: string;
  onBubbleMine: string;
  bubbleTheirs: string;
  onBubbleTheirs: string;
  bubbleMeta: string;

  // Voice message
  waveActive: string;
  waveInactive: string;
  speedPillBg: string;
  speedPillText: string;

  // Content card tints — cycled through for feed variety (Moments feed).
  // 6 subtle pastel/tinted surfaces so consecutive cards feel distinct while
  // still respecting the mode's overall palette.
  cardTints: [string, string, string, string, string, string];
}

// Light — clean white with subtle sage-tinted secondary surfaces, soft mint
// own-bubble, near-black green-tinted text. Accent is a rich botanical
// emerald that unifies voice, badges, reactions, waveforms and interactive
// states.
export const lightColors: ThemeColors = {
  surface: "#FFFFFF",
  onSurface: "#111513",
  surfaceSecondary: "#F4F7F5",
  onSurfaceSecondary: "#5C6B64",
  surfaceTertiary: "#E9EFEC",
  onSurfaceTertiary: "#2B342F",

  brand: "#0A7A5F",
  onBrand: "#FFFFFF",
  brandSecondary: "#E1F2EC",
  onBrandSecondary: "#065A45",
  brandTertiary: "#F0F9F5",
  onBrandTertiary: "#0A7A5F",

  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",

  border: "#E2E9E5",
  borderStrong: "#C7D4CD",
  divider: "#EEF3F0",

  bubbleMine: "#E1F2EC",
  onBubbleMine: "#0B3A2E",
  bubbleTheirs: "#F4F7F5",
  onBubbleTheirs: "#111513",
  bubbleMeta: "#5C6B64",

  waveActive: "#0A7A5F",
  waveInactive: "#A7D4C7",
  speedPillBg: "#FFFFFF",
  speedPillText: "#0A7A5F",

  cardTints: [
    "#FFFFFF", // clean white
    "#FFFDF5", // warm cream
    "#F4FAFC", // sky
    "#F1FBF3", // mint
    "#FCF6F5", // rose
    "#E1F2EC", // soft emerald
  ],
};

// Dark — deep forest near-black background, deep-emerald own bubbles,
// dark-gray-green received bubbles, high-contrast off-white text. Glowing
// mint accent for interactive states so it stays readable against the dark
// surface.
export const darkColors: ThemeColors = {
  surface: "#0D1210",
  onSurface: "#F0F5F2",
  surfaceSecondary: "#161D1A",
  onSurfaceSecondary: "#9DAFA6",
  surfaceTertiary: "#212C27",
  onSurfaceTertiary: "#D5DED9",

  brand: "#34D399",
  onBrand: "#06251C",
  brandSecondary: "#0B4A38",
  onBrandSecondary: "#6EE7B7",
  brandTertiary: "#10291F",
  onBrandTertiary: "#34D399",

  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",

  border: "#232D28",
  borderStrong: "#3A4A42",
  divider: "#1A231F",

  bubbleMine: "#0B4A38",
  onBubbleMine: "#D1FAE5",
  bubbleTheirs: "#1D2621",
  onBubbleTheirs: "#F0F5F2",
  bubbleMeta: "#8FA298",

  waveActive: "#34D399",
  waveInactive: "#0F5D46",
  speedPillBg: "#123025",
  speedPillText: "#34D399",

  cardTints: [
    "#161D1A", // default dark
    "#1C1813", // slightly warm
    "#151A1C", // sky-tinged
    "#161F1B", // mint-tinged
    "#1C1516", // rose-tinged
    "#0F2E23", // deep emerald
  ],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

export const fonts = {
  // HelloTalk-style clean typography — Inter for both display headings and
  // body text. Weight scale: 400 (regular), 500 (medium), 600 (semibold),
  // 700 (bold). Display uses the heavier end so titles/names stand out.
  display: "Inter_700Bold",
  displaySemi: "Inter_600SemiBold",
  displayBold: "Inter_700Bold",
  text: "Inter_400Regular",
  textSemi: "Inter_500Medium",
  textBold: "Inter_600SemiBold",
};

export const shadow = {
  card: {
    boxShadow: "0px 4px 12px rgba(15, 23, 42, 0.08)",
  },
};
