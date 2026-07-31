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

// Light — soft off-white background, subtle lavender own-bubble, mint/off-white
// received-bubble, near-black text. Accent is a friendly purple that unifies
// voice, badges, reactions, waveforms and interactive states.
export const lightColors: ThemeColors = {
  surface: "#FFFFFF",
  onSurface: "#111318",
  surfaceSecondary: "#F5F6F9",
  onSurfaceSecondary: "#5B6472",
  surfaceTertiary: "#ECEDF1",
  onSurfaceTertiary: "#2A2F38",

  brand: "#7B61FF",
  onBrand: "#FFFFFF",
  brandSecondary: "#EBE0FC",
  onBrandSecondary: "#4A34C7",
  brandTertiary: "#F3EDFF",
  onBrandTertiary: "#4A34C7",

  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",

  border: "#E6E7EC",
  borderStrong: "#D1D4DB",
  divider: "#F0F1F5",

  bubbleMine: "#E9DEFB",
  onBubbleMine: "#141419",
  bubbleTheirs: "#F1F2F5",
  onBubbleTheirs: "#141419",
  bubbleMeta: "#6B7280",

  waveActive: "#7B61FF",
  waveInactive: "#CDBEF6",
  speedPillBg: "#E7E0FA",
  speedPillText: "#7B61FF",

  cardTints: [
    "#FFFFFF", // clean white
    "#FFF7EC", // warm cream
    "#F3F8FF", // sky
    "#F1FBF3", // mint
    "#FFF1F5", // rose
    "#F5F0FE", // lavender
  ],
};

// Dark — warm near-black background, dark-purple own bubbles, dark-gray
// received bubbles, high-contrast off-white text. Softer purple accent for
// interactive states so it stays readable against the dark surface.
export const darkColors: ThemeColors = {
  surface: "#0E0F14",
  onSurface: "#F1F1F5",
  surfaceSecondary: "#171821",
  onSurfaceSecondary: "#9AA3B4",
  surfaceTertiary: "#22242F",
  onSurfaceTertiary: "#D8DBE3",

  brand: "#A78BFA",
  onBrand: "#0E0F14",
  brandSecondary: "#2E2350",
  onBrandSecondary: "#D9CBFF",
  brandTertiary: "#241B42",
  onBrandTertiary: "#C4B0FF",

  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",

  border: "#262835",
  borderStrong: "#3A3C4B",
  divider: "#1B1D27",

  bubbleMine: "#3D2B67",
  onBubbleMine: "#F0EAFF",
  bubbleTheirs: "#1E1F28",
  onBubbleTheirs: "#EAEAEE",
  bubbleMeta: "#A6ADBB",

  waveActive: "#A78BFA",
  waveInactive: "#463868",
  speedPillBg: "#2E2350",
  speedPillText: "#D9CBFF",

  cardTints: [
    "#171821", // default dark
    "#1D1A24", // slightly warm
    "#171E28", // sky-tinged
    "#161F1D", // mint-tinged
    "#221820", // rose-tinged
    "#1B1826", // lavender-tinged
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
