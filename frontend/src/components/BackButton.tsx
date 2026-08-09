import { Ionicons } from "@/src/ui/icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";

/**
 * Shared back button used everywhere in the app for a consistent HelloTalk-
 * style branding. Always renders `chevron-back` icon at size 24. Two visual
 * variants: "default" (rounded chip on light surfaces) and "overlay" (blurred
 * chip on top of cover art / media). Wire the same variant to any similar
 * context — for instance rooms, moments, edit-profile all use "overlay".
 */
export function BackButton({
  variant = "default",
  onPress,
  testID = "back-btn",
  color,
}: {
  variant?: "default" | "overlay" | "plain";
  onPress?: () => void;
  testID?: string;
  color?: string;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const handlePress = onPress || (() => router.back());
  const iconColor =
    color ||
    (variant === "overlay" ? "#FFFFFF" : colors.onSurface);
  const containerStyle =
    variant === "overlay"
      ? styles.overlay
      : variant === "plain"
      ? styles.plain
      : [styles.chip, { backgroundColor: colors.surfaceSecondary }];
  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        containerStyle,
        pressed && { opacity: 0.6 },
      ]}
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={24} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  plain: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
