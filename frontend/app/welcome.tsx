import { Ionicons } from "@/src/ui/icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";

/**
 * Welcome / Auth landing screen — the first screen for signed-out users.
 * Clean, on-brand blue design with email sign up / log in only.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container} testID="welcome-screen">
      <LinearGradient
        colors={["#0E9AE0", "#0A6B9E", "#0B1220"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* soft decorative rings */}
      <View style={styles.ringLg} pointerEvents="none" />
      <View style={styles.ringSm} pointerEvents="none" />

      <SafeAreaView style={styles.content} edges={["top", "bottom"]}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubbles" size={28} color={colors.brand} />
          </View>
          <Text style={styles.brandName}>LinguaConnect</Text>
        </View>

        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>Speak the world&apos;s languages</Text>
          <Text style={styles.heroSubtitle}>
            Chat with native speakers, get instant AI translations, and make
            friends across the globe.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="get-started-btn"
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() =>
              router.push({ pathname: "/auth", params: { mode: "register" } })
            }
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.brand} />
          </Pressable>
          <Pressable
            testID="login-btn"
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() =>
              router.push({ pathname: "/auth", params: { mode: "login" } })
            }
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B1220",
      // Keeps the decorative rings from extending the layout (and creating
      // horizontal scroll) on narrow screens.
      overflow: "hidden",
    },
    ringLg: {
      position: "absolute",
      top: -120,
      right: -80,
      width: 320,
      height: 320,
      borderRadius: 160,
      borderWidth: 40,
      borderColor: "rgba(255,255,255,0.06)",
    },
    ringSm: {
      position: "absolute",
      bottom: 40,
      left: -70,
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 28,
      borderColor: "rgba(255,255,255,0.05)",
    },
    content: {
      flex: 1,
      justifyContent: "space-between",
      padding: spacing.xl,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    logoBadge: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: "#FFFFFF",
    },
    heroTextWrap: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    heroTitle: {
      fontFamily: fonts.display,
      fontSize: 40,
      lineHeight: 46,
      color: "#FFFFFF",
    },
    heroSubtitle: {
      fontFamily: fonts.text,
      fontSize: 16,
      lineHeight: 24,
      color: "rgba(255,255,255,0.82)",
    },
    actions: {
      gap: spacing.md,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#FFFFFF",
      borderRadius: radius.pill,
      paddingVertical: spacing.lg,
    },
    primaryBtnText: {
      color: colors.brand,
      fontFamily: fonts.textBold,
      fontSize: 16,
    },
    secondaryBtn: {
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.5)",
    },
    secondaryBtnText: {
      color: "#FFFFFF",
      fontFamily: fonts.textBold,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.8,
    },
  });
