/**
 * LinguaConnect auth screen.
 *
 * A single screen that hosts login + signup + Google OAuth + guest access.
 * The two email flows share the same fields (name shown only when signing up)
 * with a segmented toggle at the top. Below the form:
 *   - Google Sign-In (Emergent-managed OAuth)
 *   - Continue as Guest (creates a throwaway account)
 *
 * Emergent Google OAuth flow (per playbook):
 *   1. Build a platform-specific redirect URL.
 *   2. On mobile: open in `WebBrowser.openAuthSessionAsync`, read
 *      `session_id` from `result.url`.
 *   3. On web: `window.location.href = ...`, and parse `#session_id=...`
 *      from `window.location.hash` when we return to `/auth`.
 *   4. Exchange the `session_id` at `/api/auth/google` for a JWT.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/src/components/BackButton";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing, ThemeColors } from "@/src/theme";

type FieldKey = "name" | "email" | "password";
type Mode = "login" | "register";

// Emergent auth entry point (playbook constant).
const EMERGENT_AUTH_URL = "https://auth.emergentagent.com/";
const GOOGLE_LOGO =
  "https://developers.google.com/identity/images/g-logo.png";

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(
    initialMode === "login" ? "login" : "register",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<null | "google" | "guest">(null);
  const {
    login,
    register,
    googleLogin,
    guestLogin,
  } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const isLogin = mode === "login";

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const nameValid = isLogin || name.trim().length >= 1;
  const formValid = emailValid && passwordValid && nameValid;

  // ── after-auth navigation (shared by email / google / guest) ─────────
  const routeAfterAuth = (u: { native_language?: string | null; learning_language?: string | null }) => {
    if (!u.native_language || !u.learning_language) {
      router.replace("/onboarding");
    } else {
      router.replace("/(tabs)/connect");
    }
  };

  const humanizeError = (raw: string) => {
    if (/incorrect email or password/i.test(raw)) {
      return "Wrong email or password. Please try again.";
    }
    if (/email already registered/i.test(raw)) {
      return "This email is already registered. Try logging in instead.";
    }
    if (/banned/i.test(raw)) return "This account has been suspended.";
    if (/network|failed to fetch/i.test(raw)) {
      return "Can't reach the server. Check your connection.";
    }
    if (/invalid or expired google session/i.test(raw)) {
      return "Google session expired. Please try again.";
    }
    return raw;
  };

  // ── email / password submit ──────────────────────────────────────────
  const submit = async () => {
    setError(null);
    if (!email.trim()) return setError("Please enter your email.");
    if (!emailValid) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    if (!isLogin && !passwordValid) {
      return setError("Password must be at least 6 characters.");
    }
    if (!isLogin && !name.trim()) return setError("Please enter your name.");
    setBusy(true);
    try {
      const authedUser = isLogin
        ? await login(email.trim(), password)
        : await register(email.trim(), password, name.trim());
      routeAfterAuth(authedUser);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : "Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  // ── Google Sign-In ───────────────────────────────────────────────────
  // A ref guards against the web-mount effect double-processing the same
  // ?session_id when Fast Refresh remounts the screen.
  const handledSession = useRef<string | null>(null);

  const parseSessionId = (rawUrl: string): string | null => {
    // session_id may be in hash (#session_id=...) or query (?session_id=...).
    try {
      const url = new URL(rawUrl);
      const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
      const hashParams = new URLSearchParams(hash);
      const fromHash = hashParams.get("session_id");
      if (fromHash) return fromHash;
      return url.searchParams.get("session_id");
    } catch {
      // Manual fallback for exp:// URLs that URL() can't parse
      const m = rawUrl.match(/[?#&]session_id=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    }
  };

  const consumeSessionId = async (sessionId: string) => {
    if (handledSession.current === sessionId) return;
    handledSession.current = sessionId;
    setSocialBusy("google");
    setError(null);
    try {
      const u = await googleLogin(sessionId);
      routeAfterAuth(u);
    } catch (e) {
      setError(
        humanizeError(e instanceof Error ? e.message : "Google sign-in failed"),
      );
    } finally {
      setSocialBusy(null);
    }
  };

  // Web return-URL handler: parse the fragment on mount + clean it up.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const sid = parseSessionId(window.location.href);
    if (sid) {
      // Strip the fragment / query so re-mounts don't re-process.
      window.history.replaceState(null, "", window.location.pathname);
      consumeSessionId(sid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGoogleLogin = async () => {
    setError(null);
    try {
      let redirectUrl: string;
      if (Platform.OS === "web") {
        redirectUrl = window.location.origin + "/auth";
      } else {
        redirectUrl = Linking.createURL("/auth");
      }
      const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      setSocialBusy("google");
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type !== "success" || !result.url) {
        setSocialBusy(null);
        return; // user cancelled or dismissed
      }
      const sid = parseSessionId(result.url);
      if (!sid) {
        setSocialBusy(null);
        setError("Google sign-in did not return a session. Please try again.");
        return;
      }
      await consumeSessionId(sid);
    } catch (e) {
      setSocialBusy(null);
      setError(
        humanizeError(e instanceof Error ? e.message : "Google sign-in failed"),
      );
    }
  };

  // ── Guest ────────────────────────────────────────────────────────────
  const startGuest = async () => {
    setError(null);
    setSocialBusy("guest");
    try {
      const u = await guestLogin();
      routeAfterAuth(u);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : "Guest login failed"));
    } finally {
      setSocialBusy(null);
    }
  };

  const inputWrapStyle = (key: FieldKey) => [
    styles.inputWrap,
    focused === key && styles.inputWrapFocused,
  ];

  const bothBusy = busy || socialBusy !== null;

  // ── render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container} testID="auth-screen">
      {/* Purple gradient hero */}
      <LinearGradient
        colors={["#059669", "#047857"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}
      >
        <BackButton testID="auth-back-btn" variant="overlay" />
        <View style={styles.heroBody}>
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubbles" size={26} color="#059669" />
          </View>
          <Text style={styles.heroTitle}>
            {isLogin ? "Welcome back!" : "Join LinguaConnect"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isLogin
              ? "Log in and keep the conversation going."
              : "Meet native speakers and learn together."}
          </Text>
        </View>
      </LinearGradient>

      {/* Form sheet */}
      <KeyboardAvoidingView
        style={styles.sheetFlex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Segmented Log in / Sign up */}
            <View style={styles.segmentedRow}>
              {(["login", "register"] as Mode[]).map((m) => {
                const on = mode === m;
                return (
                  <Pressable
                    key={m}
                    testID={`auth-segment-${m}`}
                    onPress={() => {
                      setMode(m);
                      setError(null);
                    }}
                    style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        on && styles.segmentTextOn,
                      ]}
                    >
                      {m === "login" ? "Log in" : "Sign up"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!isLogin && (
              <View style={styles.field}>
                <Text style={styles.label}>Name</Text>
                <View style={inputWrapStyle("name")}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={focused === "name" ? colors.brand : colors.onSurfaceSecondary}
                  />
                  <TextInput
                    testID="auth-name-input"
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={inputWrapStyle("email")}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={focused === "email" ? colors.brand : colors.onSurfaceSecondary}
                />
                <TextInput
                  testID="auth-email-input"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                {isLogin && (
                  <Pressable
                    testID="auth-forgot-btn"
                    hitSlop={6}
                    onPress={() =>
                      setError(
                        "Password reset is coming soon. For now, please contact support.",
                      )
                    }
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                )}
              </View>
              <View style={inputWrapStyle("password")}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={
                    focused === "password" ? colors.brand : colors.onSurfaceSecondary
                  }
                />
                <TextInput
                  testID="auth-password-input"
                  style={styles.input}
                  placeholder={isLogin ? "Your password" : "At least 6 characters"}
                  placeholderTextColor={colors.onSurfaceSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                />
                <Pressable
                  testID="auth-toggle-password-btn"
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color={colors.onSurfaceSecondary}
                  />
                </Pressable>
              </View>
              {!isLogin && (
                <Text
                  style={[
                    styles.hint,
                    password.length > 0 && !passwordValid && { color: colors.error },
                  ]}
                >
                  {password.length === 0
                    ? "Use at least 6 characters."
                    : passwordValid
                      ? "✓ Looks good!"
                      : `${password.length}/6 characters`}
                </Text>
              )}
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.error} />
                <Text testID="auth-error-text" style={styles.error}>
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              testID="auth-submit-btn"
              style={({ pressed }) => [
                styles.submitWrap,
                (pressed || busy) && { opacity: 0.85 },
                (!formValid || bothBusy) && !busy && { opacity: 0.5 },
              ]}
              onPress={submit}
              disabled={bothBusy || !formValid}
            >
              <LinearGradient
                colors={["#059669", "#047857"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitBtn}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitText}>
                      {isLogin ? "Log In" : "Sign Up"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <Pressable
              testID="auth-google-btn"
              onPress={startGoogleLogin}
              disabled={bothBusy}
              style={({ pressed }) => [
                styles.socialBtn,
                pressed && { opacity: 0.9 },
                bothBusy && { opacity: 0.6 },
              ]}
            >
              {socialBusy === "google" ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  <Image source={{ uri: GOOGLE_LOGO }} style={styles.googleLogo} />
                  <Text style={styles.socialText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <Pressable
              testID="auth-guest-btn"
              onPress={startGuest}
              disabled={bothBusy}
              style={({ pressed }) => [
                styles.guestBtn,
                pressed && { opacity: 0.7 },
                bothBusy && { opacity: 0.6 },
              ]}
            >
              {socialBusy === "guest" ? (
                <ActivityIndicator color={colors.onSurfaceSecondary} />
              ) : (
                <>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={colors.onSurfaceSecondary}
                  />
                  <Text style={styles.guestText}>Continue as guest</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.tosText}>
              By continuing, you agree to our{" "}
              <Text style={styles.tosLink}>Terms</Text> &{" "}
              <Text style={styles.tosLink}>Privacy</Text>.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#059669",
    },
    hero: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl + spacing.md,
    },
    heroBody: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    logoBadge: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
      boxShadow: "0px 6px 16px rgba(15, 23, 42, 0.14)",
    },
    heroTitle: {
      fontFamily: fonts.displayBold,
      fontSize: 26,
      color: "#FFFFFF",
    },
    heroSubtitle: {
      fontFamily: fonts.text,
      fontSize: 14,
      color: "rgba(255,255,255,0.9)",
      marginTop: 2,
    },
    sheetFlex: {
      flex: 1,
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      marginTop: -28,
    },
    scroll: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    // ── Segmented switcher ──
    segmentedRow: {
      flexDirection: "row",
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 4,
      marginBottom: spacing.lg,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: "center",
    },
    segmentBtnOn: {
      backgroundColor: colors.surface,
      boxShadow: "0px 1px 3px rgba(15, 23, 42, 0.08)",
    },
    segmentText: {
      fontFamily: fonts.textBold,
      fontSize: 13.5,
      color: colors.onSurfaceSecondary,
    },
    segmentTextOn: {
      color: colors.brand,
    },
    field: {
      marginBottom: spacing.md,
    },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    label: {
      fontFamily: fonts.textBold,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    forgotText: {
      fontFamily: fonts.textBold,
      fontSize: 12,
      color: colors.brand,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1.5,
      borderColor: "transparent",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "web" ? 12 : 10,
    },
    inputWrapFocused: {
      borderColor: colors.brand,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: colors.onSurface,
      paddingVertical: 0,
      ...(Platform.OS === "web" ? { outlineWidth: 0 } : {}),
    },
    hint: {
      fontFamily: fonts.text,
      fontSize: 11.5,
      color: colors.onSurfaceSecondary,
      marginTop: 5,
      marginLeft: 4,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: `${colors.error}1A`,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: spacing.md,
    },
    error: {
      flex: 1,
      fontFamily: fonts.textBold,
      fontSize: 12.5,
      color: colors.error,
    },
    submitWrap: {
      marginTop: spacing.xs,
      borderRadius: 999,
      overflow: "hidden",
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
    },
    submitText: {
      fontFamily: fonts.textBold,
      fontSize: 15.5,
      color: "#FFFFFF",
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: spacing.md,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
    },
    dividerText: {
      fontFamily: fonts.textBold,
      fontSize: 11.5,
      color: colors.onSurfaceSecondary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    socialBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.divider,
      borderRadius: 12,
      paddingVertical: 12,
      marginBottom: 10,
    },
    googleLogo: {
      width: 18,
      height: 18,
    },
    socialText: {
      fontFamily: fonts.textBold,
      fontSize: 14.5,
      color: colors.onSurface,
    },
    guestBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
    },
    guestText: {
      fontFamily: fonts.textBold,
      fontSize: 13.5,
      color: colors.onSurfaceSecondary,
    },
    tosText: {
      textAlign: "center",
      fontFamily: fonts.text,
      fontSize: 11.5,
      color: colors.onSurfaceSecondary,
      marginTop: spacing.md,
      lineHeight: 17,
    },
    tosLink: {
      color: colors.brand,
      fontFamily: fonts.textBold,
    },
  });
