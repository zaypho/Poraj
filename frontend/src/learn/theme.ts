// Vocab sub-app design tokens — dark + light palettes with a shared runtime shape.
// Cards keep their bright colors in both modes; only chrome (bg / text / tab bar)
// swaps between the two.

export type LearnThemeMode = "dark" | "light";

export type LearnPalette = {
  mode: LearnThemeMode;
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  onLight: string;
  cardLight: string;
  cardMint: string;
  cardMintDeep: string;
  cardLime: string;
  cardCoral: string;
  cardPurple: string;
  cardPurpleSoft: string;
  purple: string;
  purpleDark: string;
  green: string;
  lime: string;
  coral: string;
  tabBg: string;
  tabActivePill: string;
  tabActiveText: string;
  tabInactive: string;
  tabInactiveLabel: string;
  // ── extended tokens used by the legacy learn screens ──
  onSurface: string;
  onSurfaceSecondary: string;
  onSurfaceTertiary: string;
  surfaceHigh: string;
  yellow: string;
  onYellow: string;
  orange: string;
  onboardingYellow: string;
  onboardingOrange: string;
  onboardingLilac: string;
};

export const darkPalette: LearnPalette = {
  mode: "dark",
  bg: "#0B0B0F",
  surface: "#121218",
  surfaceRaised: "#1A1A21",
  border: "#2A2A34",
  text: "#FFFFFF",
  textDim: "#9A9AA5",
  textFaint: "#6B6B75",
  onLight: "#0B0B0F",
  cardLight: "#F2F2F4",
  cardMint: "#C8E4B4",
  cardMintDeep: "#B7D8A2",
  cardLime: "#E8F569",
  cardCoral: "#F0715C",
  cardPurple: "#B7A0F5",
  cardPurpleSoft: "#D8CBFF",
  purple: "#A78BFA",
  purpleDark: "#7C5CE0",
  green: "#8FCB6F",
  lime: "#D6E85E",
  coral: "#F0715C",
  tabBg: "#0B0B0F",
  tabActivePill: "#B7A0F5",
  tabActiveText: "#0B0B0F",
  tabInactive: "#E4E4EA",
  tabInactiveLabel: "#E4E4EA",
  onSurface: "#FFFFFF",
  onSurfaceSecondary: "#9A9AA5",
  onSurfaceTertiary: "#6B6B75",
  surfaceHigh: "#22222B",
  yellow: "#FFD43D",
  onYellow: "#0B0B0F",
  orange: "#FF5C1F",
  onboardingYellow: "#FFD43D",
  onboardingOrange: "#FF9F45",
  onboardingLilac: "#D8CBFF",
};

export const lightPalette: LearnPalette = {
  mode: "light",
  bg: "#F5F5F1",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#E4E4EA",
  text: "#0B0B0F",
  textDim: "#5A5A63",
  textFaint: "#8A8A93",
  onLight: "#0B0B0F",
  cardLight: "#FFFFFF",
  cardMint: "#C8E4B4",
  cardMintDeep: "#B7D8A2",
  cardLime: "#E8F569",
  cardCoral: "#F0715C",
  cardPurple: "#B7A0F5",
  cardPurpleSoft: "#D8CBFF",
  purple: "#7C5CE0",
  purpleDark: "#5A3EC4",
  green: "#6BA84F",
  lime: "#D6E85E",
  coral: "#F0715C",
  tabBg: "#FFFFFF",
  tabActivePill: "#B7A0F5",
  tabActiveText: "#0B0B0F",
  tabInactive: "#0B0B0F",
  tabInactiveLabel: "#2A2A34",
  onSurface: "#0B0B0F",
  onSurfaceSecondary: "#5A5A63",
  onSurfaceTertiary: "#8A8A93",
  surfaceHigh: "#EDEDEF",
  yellow: "#F5B301",
  onYellow: "#0B0B0F",
  orange: "#F04E23",
  onboardingYellow: "#FFD43D",
  onboardingOrange: "#FF9F45",
  onboardingLilac: "#D8CBFF",
};

// Default export kept for legacy imports that still reference `learnColors`.
// It maps to whichever palette is active on first load (dark by default).
export const learnColors = darkPalette;

export const learnRadius = {
  chip: 999,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
} as const;

export const learnFont = {
  h1: 32,
  h2: 26,
  h3: 20,
  body: 15,
  small: 13,
  tiny: 11,
};
