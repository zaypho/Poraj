/**
 * NetworkErrorState — a full-column "Oops! Network Error" panel matching
 * the reference screenshot:
 *
 *   [WiFi-X icon]
 *   Oops! Network Error
 *   Refresh or try these solutions:
 *   1. Turn your network off and back on.
 *   2. Move to a location with better internet connection.
 *   [ Refresh ]
 *
 * Use inside any screen where the primary content couldn't load and you
 * want the user to see a clear, guided empty-error.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing, ThemeColors } from "@/src/theme";
import { NoNetworkIcon } from "./NoNetworkIcon";

interface Props {
  onRefresh?: () => void | Promise<void>;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  steps?: string[];
  testID?: string;
}

export const NetworkErrorState: React.FC<Props> = ({
  onRefresh,
  loading = false,
  title = "Oops! Network Error",
  subtitle = "Refresh or try these solutions:",
  steps = [
    "Turn your network off and back on.",
    "Move to a location with better internet connection.",
  ],
  testID = "network-error-state",
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap} testID={testID}>
      <NoNetworkIcon
        size={80}
        color={colors.onSurfaceSecondary}
        accentColor={colors.brand}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.stepList}>
        {steps.map((s, i) => (
          <Text key={i} style={styles.step}>
            {i + 1}. {s}
          </Text>
        ))}
      </View>
      {onRefresh ? (
        <Pressable
          testID={`${testID}-refresh`}
          onPress={() => onRefresh()}
          disabled={loading}
          style={({ pressed }) => [
            styles.btn,
            (pressed || loading) && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Refresh</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
      gap: 10,
    },
    title: {
      fontFamily: fonts.displayBold,
      fontSize: 17,
      color: colors.onSurface,
      marginTop: spacing.md,
    },
    subtitle: {
      fontFamily: fonts.text,
      fontSize: 13.5,
      color: colors.onSurfaceSecondary,
      textAlign: "center",
    },
    stepList: {
      alignSelf: "stretch",
      gap: 4,
    },
    step: {
      fontFamily: fonts.text,
      fontSize: 13,
      color: colors.onSurfaceSecondary,
      lineHeight: 20,
    },
    btn: {
      marginTop: spacing.md,
      backgroundColor: colors.brand,
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 999,
    },
    btnText: {
      fontFamily: fonts.textBold,
      fontSize: 14.5,
      color: "#FFFFFF",
    },
  });
