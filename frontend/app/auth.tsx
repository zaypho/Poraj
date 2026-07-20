import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";

type FieldKey = "name" | "email" | "password";

export default function AuthScreen() {
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"login" | "register">(
    initialMode === "login" ? "login" : "register",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const isLogin = mode === "login";

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const nameValid = isLogin || name.trim().length >= 1;
  const formValid = emailValid && passwordValid && nameValid;

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (!isLogin && !passwordValid) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!isLogin && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    try {
      const authedUser = isLogin
        ? await login(email.trim(), password)
        : await register(email.trim(), password, name.trim());
      // Skip the calculator vault entirely after successful auth — go straight
      // into the app. If the user hasn't finished language onboarding yet,
      // send them there first; otherwise land on the main chats tab.
      if (!authedUser.native_language || !authedUser.learning_language) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)/connect");
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Something went wrong";
      // Turn common backend errors into friendly messages.
      let msg = raw;
      if (/incorrect email or password/i.test(raw)) {
        msg = "Wrong email or password. Please try again.";
      } else if (/email already registered/i.test(raw)) {
        msg = "This email is already registered. Try logging in instead.";
      } else if (/banned/i.test(raw)) {
        msg = "This account has been suspended.";
      } else if (/network|failed to fetch/i.test(raw)) {
        msg = "Can't reach the server. Check your connection.";
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const inputWrapStyle = (key: FieldKey) => [
    styles.inputWrap,
    focused === key && styles.inputWrapFocused,
  ];

  return (
    <View style={styles.container} testID="auth-screen">
      {/* Gradient hero */}
      <LinearGradient
        colors={["#0EA5E9", "#38BDF8", "#7DD3FC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}
      >
        <BackButton
          testID="auth-back-btn"
          variant="overlay"
        />

        <View style={styles.heroBody}>
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubbles" size={26} color="#0EA5E9" />
          </View>
          <Text style={styles.heroTitle}>
            {isLogin ? "Welcome back!" : "Create your account"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isLogin
              ? "Log in to keep practicing with your partners."
              : "Join millions learning languages together."}
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
              <Text style={styles.label}>Password</Text>
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
                !formValid && !busy && { opacity: 0.5 },
              ]}
              onPress={submit}
              disabled={busy || !formValid}
            >
              <LinearGradient
                colors={["#0EA5E9", "#38BDF8"]}
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
              <Text style={styles.dividerText}>
                {isLogin ? "New to LinguaConnect?" : "Been here before?"}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              testID="auth-switch-mode-btn"
              onPress={() => {
                setMode(isLogin ? "register" : "login");
                setError(null);
              }}
              style={({ pressed }) => [
                styles.switchBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.switchText}>
                {isLogin ? "Create an account" : "Log in instead"}
              </Text>
            </Pressable>
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
      backgroundColor: "#0EA5E9",
    },
    hero: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl + spacing.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
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
      ...Platform.select({
        ios: {
          shadowColor: "#0F172A",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    heroTitle: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: "#FFFFFF",
    },
    heroSubtitle: {
      fontFamily: fonts.textSemi,
      fontSize: 14.5,
      lineHeight: 21,
      color: "rgba(255,255,255,0.9)",
    },
    sheetFlex: {
      flex: 1,
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      marginTop: -spacing.xl,
      overflow: "hidden",
    },
    scroll: {
      padding: spacing.xl,
      paddingTop: spacing.xl + spacing.xs,
      paddingBottom: spacing.xxxl,
    },
    field: {
      marginBottom: spacing.lg,
    },
    label: {
      fontFamily: fonts.textBold,
      fontSize: 13,
      color: colors.onSurfaceTertiary,
      marginBottom: spacing.sm,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: "transparent",
      paddingHorizontal: spacing.lg,
    },
    inputWrapFocused: {
      borderColor: colors.brand,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.md + 2,
      fontFamily: fonts.textSemi,
      fontSize: 15,
      color: colors.onSurface,
      ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
    },
    hint: {
      marginTop: 6,
      marginLeft: 4,
      fontFamily: fonts.textSemi,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(239,68,68,0.08)",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    error: {
      flex: 1,
      color: colors.error,
      fontFamily: fonts.textSemi,
      fontSize: 13,
    },
    submitWrap: {
      borderRadius: radius.pill,
      overflow: "hidden",
      marginTop: spacing.sm,
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    submitText: {
      color: "#FFFFFF",
      fontFamily: fonts.textBold,
      fontSize: 16,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.xl + spacing.sm,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
    },
    dividerText: {
      fontFamily: fonts.textSemi,
      fontSize: 12.5,
      color: colors.onSurfaceSecondary,
    },
    switchBtn: {
      alignItems: "center",
      marginTop: spacing.lg,
      borderWidth: 1.5,
      borderColor: colors.brand,
      borderRadius: radius.pill,
      paddingVertical: spacing.md + 2,
    },
    switchText: {
      color: colors.brand,
      fontFamily: fonts.textBold,
      fontSize: 15,
    },
  });
