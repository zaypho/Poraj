/**
 * IconChip — small circular icon button for title-bars and toolbars.
 *
 * Enforces consistent hitbox (40x40), soft rounded background, and press
 * feedback across every screen so the app feels unified. Screens pass a
 * tint pair (icon + subtle background) to convey meaning without varying
 * the shape.
 *
 * ```tsx
 * <IconChip
 *   icon="cart"
 *   tint="pink"
 *   onPress={goToStore}
 *   testID="profile-store"
 * />
 * ```
 */

import { Ionicons, MaterialCommunityIcons } from "@/src/ui/icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { ThemeColors } from "@/src/theme";

type IonIcon = keyof typeof Ionicons.glyphMap;
type MciIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export type IconChipTint =
  | "purple"
  | "pink"
  | "blue"
  | "green"
  | "amber"
  | "rose"
  | "neutral"
  | "brand"
  | "transparent";

interface Props {
  icon?: IonIcon;
  mci?: MciIcon;
  size?: number;
  tint?: IconChipTint;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  hitSlop?: number;
  badge?: React.ReactNode;
}

/** Static tint pair (icon color, background) — soft pastels that read
 *  cleanly on both light and dark surfaces.
 *
 *  Semantic tints (amber/rose/green) are kept for cases where color
 *  carries meaning (streak, warning, success). Every everyday chip
 *  should use `tint="brand"` so the app feels like one product. */
const TINTS: Record<IconChipTint, { fg: string; bg: string; dbg?: string; dfg?: string }> = {
  purple:  { fg: "#0D9488", bg: "#CCFBF1", dbg: "#16342F", dfg: "#5EEAD4" },
  pink:    { fg: "#EC4899", bg: "#FCE7F3", dbg: "#3B2432", dfg: "#F9A8D4" },
  blue:    { fg: "#2563EB", bg: "#DBEAFE", dbg: "#1E2A44", dfg: "#93C5FD" },
  green:   { fg: "#16A34A", bg: "#DCFCE7", dbg: "#1B3229", dfg: "#86EFAC" },
  amber:   { fg: "#F59E0B", bg: "#FEF3C7", dbg: "#3A2F16", dfg: "#FCD34D" },
  rose:    { fg: "#EF4444", bg: "#FEE2E2", dbg: "#3B2020", dfg: "#FCA5A5" },
  neutral: { fg: "",        bg: ""        }, // resolves to theme colors at runtime
  brand:   { fg: "",        bg: ""        }, // resolves to theme brand pair at runtime
  transparent: { fg: "", bg: "transparent" },
};

export const IconChip: React.FC<Props> = ({
  icon,
  mci,
  size,
  tint = "neutral",
  onPress,
  disabled,
  testID,
  hitSlop = 6,
  badge,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === "dark";
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const tintCfg = TINTS[tint];
  const bg =
    tint === "neutral"
      ? colors.surfaceSecondary
      : tint === "brand"
        ? colors.brandTertiary
        : tint === "transparent"
          ? "transparent"
          : (isDark && tintCfg.dbg) || tintCfg.bg;
  const fg =
    tint === "neutral"
      ? colors.onSurface
      : tint === "brand"
        ? colors.brand
        : tint === "transparent"
          ? colors.onSurface
          : (isDark && tintCfg.dfg) || tintCfg.fg;

  const iconSize = size ?? 18;

  const content = (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={iconSize} color={fg} /> : null}
      {mci ? <MaterialCommunityIcons name={mci} size={iconSize} color={fg} /> : null}
      {badge}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.wrap,
        pressed && !disabled && { opacity: 0.72 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {content}
    </Pressable>
  );
};

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {},
    chip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
  });
