/**
 * EmptyState — a compact "Nothing here~" panel matching the reference
 * screenshot (Voice tab empty). Uses the same WiFi-X glyph as the
 * network-error state so the two feel like one visual family.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing, ThemeColors } from "@/src/theme";
import { NoNetworkIcon } from "./NoNetworkIcon";

interface Props {
  message?: string;
  testID?: string;
  /** Optional slot below the message (e.g. a "Create room" button). */
  children?: React.ReactNode;
}

export const EmptyState: React.FC<Props> = ({
  message = "Nothing here~",
  testID = "empty-state",
  children,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.wrap} testID={testID}>
      <NoNetworkIcon
        size={72}
        color={colors.onSurfaceSecondary}
        accentColor={colors.brand}
      />
      <Text style={styles.text}>{message}</Text>
      {children}
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
      gap: 14,
    },
    text: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
    },
  });
