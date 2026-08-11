import { Ionicons } from "@/src/ui/icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fonts, radius, spacing } from "@/src/theme";

/**
 * Generic, brand-safe crash screen. Shown by the router's ErrorBoundary when an
 * unexpected render error happens. Intentionally shows NO technical details,
 * stack traces, backend URLs or builder branding — just a friendly retry.
 */
export function AppErrorScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.iconWrap}>
        <Ionicons name="refresh-circle" size={64} color="#0E9AE0" />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>
        We hit an unexpected problem. Please try again.
      </Text>
      {onRetry ? (
        <Pressable
          testID="app-error-retry"
          onPress={onRetry}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Try Again</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: "#0F1720",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    color: "#5B6B7A",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: "#0E9AE0",
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  btnText: {
    fontFamily: fonts.textBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
});
