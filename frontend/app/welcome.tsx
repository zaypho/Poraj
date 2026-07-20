import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";

const HERO_URL =
  "https://images.unsplash.com/photo-1669950200209-69d8292c032f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

/**
 * Welcome / Auth landing screen. Previously lived at "/" as the app's default
 * entry point, but has been moved here so the app can boot into a private
 * calculator vault (see app/index.tsx). This screen is only reached when the
 * user solves the vault code (11 + 37 =) or explicitly navigates here.
 */
export default function WelcomeScreen() {
  const { guestLogin } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [guestBusy, setGuestBusy] = React.useState(false);
  const [guestErr, setGuestErr] = React.useState<string | null>(null);

  const enterAsGuest = async () => {
    if (guestBusy) return;
    setGuestBusy(true);
    setGuestErr(null);
    try {
      await guestLogin();
      router.replace("/(tabs)/connect");
    } catch (e) {
      setGuestErr(e instanceof Error ? e.message : "Couldn't start guest mode.");
      setGuestBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="welcome-screen">
      <Image source={{ uri: HERO_URL }} style={styles.hero} contentFit="cover" />
      <View style={styles.heroOverlay} />
      <SafeAreaView style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubbles" size={26} color={colors.onBrand} />
          </View>
          <Text style={styles.brandName}>LinguaConnect</Text>
        </View>
        <View style={styles.bottomCard}>
          <Text style={styles.title}>Speak the world&apos;s languages</Text>
          <Text style={styles.subtitle}>
            Chat with native speakers, get instant AI translations, and make
            friends across the globe.
          </Text>
          <Pressable
            testID="get-started-btn"
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/auth", params: { mode: "register" } })}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </Pressable>
          <Pressable
            testID="login-btn"
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/auth", params: { mode: "login" } })}
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </Pressable>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable
            testID="guest-mode-btn"
            style={({ pressed }) => [styles.guestBtn, pressed && styles.pressed]}
            onPress={enterAsGuest}
            disabled={guestBusy}
          >
            {guestBusy ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <>
                <Ionicons name="rocket" size={17} color={colors.onSurface} />
                <Text style={styles.guestBtnText}>Continue as Guest</Text>
              </>
            )}
          </Pressable>
          {guestErr ? (
            <Text style={styles.guestErr} testID="guest-mode-error">
              {guestErr}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    hero: {
      ...StyleSheet.absoluteFillObject,
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(12, 74, 110, 0.35)",
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
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: "#FFFFFF",
    },
    bottomCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: colors.onSurface,
      lineHeight: 34,
    },
    subtitle: {
      fontFamily: fonts.text,
      fontSize: 15,
      lineHeight: 22,
      color: colors.onSurfaceSecondary,
    },
    primaryBtn: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    primaryBtnText: {
      color: colors.onBrand,
      fontFamily: fonts.textBold,
      fontSize: 16,
    },
    secondaryBtn: {
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    secondaryBtnText: {
      color: colors.brand,
      fontFamily: fonts.textBold,
      fontSize: 15,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: 2,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
    },
    dividerText: {
      fontFamily: fonts.textSemi,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
    },
    guestBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      paddingVertical: spacing.md,
    },
    guestBtnText: {
      color: colors.onSurface,
      fontFamily: fonts.textBold,
      fontSize: 15,
    },
    guestErr: {
      color: colors.error,
      fontFamily: fonts.textSemi,
      fontSize: 13,
      textAlign: "center",
      marginTop: -4,
    },
    pressed: {
      opacity: 0.75,
    },
  });
