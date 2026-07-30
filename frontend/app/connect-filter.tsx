import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppSwitch } from "@/src/components/AppSwitch";
import { langName } from "@/src/constants/languages";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";

const LANGS = ["any", "en", "es", "fr", "de", "ja", "ko", "zh", "ar", "hi", "bn", "pt", "ru", "it"];
const LEVELS = ["Beginner", "Elementary", "Intermediate", "Advanced", "Proficient"];
const AGES = [18, 25, 35, 50, 90];

const PURPLE = "#7C5CFC";

/** HelloTalk-style partner Filter sheet — feeds /custom-search. */
export default function ConnectFilter() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [native, setNative] = useState("any");
  const [learning, setLearning] = useState("any");
  const [levelMin, setLevelMin] = useState(0);
  const [levelMax, setLevelMax] = useState(4);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(90);
  const [newUsers, setNewUsers] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [gender, setGender] = useState<"all" | "female" | "male">("all");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");

  const reset = () => {
    setNative("any");
    setLearning("any");
    setLevelMin(0);
    setLevelMax(4);
    setAgeMin(18);
    setAgeMax(90);
    setNewUsers(false);
    setNearby(false);
    setGender("all");
    setRegion("");
    setCity("");
  };

  const cycle = (arr: any[], cur: any, set: (v: any) => void) =>
    set(arr[(arr.indexOf(cur) + 1) % arr.length]);

  const search = () =>
    router.push({
      pathname: "/custom-search",
      params: {
        native,
        learning,
        levelMin: String(levelMin),
        levelMax: String(levelMax),
        ageMin: String(ageMin),
        ageMax: String(ageMax),
        newUsers: newUsers ? "1" : "0",
        nearby: nearby ? "1" : "0",
        gender,
        region: region.trim(),
        city: city.trim(),
      },
    });

  const LevelDots = () => (
    <View style={styles.dotsRow}>
      {LEVELS.map((_, i) => (
        <Pressable
          key={i}
          hitSlop={10}
          onPress={() => {
            // tap left half adjusts min, right half adjusts max
            if (Math.abs(i - levelMin) <= Math.abs(i - levelMax)) setLevelMin(Math.min(i, levelMax));
            else setLevelMax(Math.max(i, levelMin));
          }}
          style={[
            styles.dot,
            i >= levelMin && i <= levelMax && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]} testID="connect-filter-screen">
      <View style={styles.header}>
        <Pressable testID="cf-close" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Filter</Text>
        <Pressable testID="cf-reset" onPress={reset} hitSlop={8}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable
          testID="cf-native"
          style={styles.card}
          onPress={() => cycle(LANGS, native, setNative)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardHint}>Language partner’s native language</Text>
            <Text style={styles.cardValue}>
              {native === "any" ? "Any" : langName(native)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
        </Pressable>

        <View style={styles.card}>
          <Pressable
            testID="cf-learning"
            style={styles.rowLine}
            onPress={() => cycle(LANGS, learning, setLearning)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHint}>Language partner’s learning language</Text>
              <Text style={styles.cardValue}>
                {learning === "any" ? "Any" : langName(learning)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Level</Text>
            <Text style={styles.purpleValue}>
              {LEVELS[levelMin]}-{LEVELS[levelMax]}
            </Text>
          </View>
          <LevelDots />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Age Range</Text>
            <Text style={styles.purpleValue}>
              {ageMin}-{ageMax}{ageMax >= 90 ? "+" : ""}
            </Text>
          </View>
          <View style={styles.dotsRow}>
            {AGES.map((a) => (
              <Pressable
                key={a}
                hitSlop={10}
                onPress={() => {
                  if (Math.abs(a - ageMin) <= Math.abs(a - ageMax)) setAgeMin(Math.min(a, ageMax));
                  else setAgeMax(Math.max(a, ageMin));
                }}
                style={[styles.dot, a >= ageMin && a <= ageMax && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.rowBetween]}>
          <Text style={styles.label}>New Users</Text>
          <AppSwitch testID="cf-new-users" value={newUsers} onValueChange={setNewUsers} />
        </View>

        <View style={styles.advRow}>
          <Text style={styles.advText}>Advanced Search</Text>
          <View style={styles.vipChip}>
            <Text style={styles.vipChipText}>VIP</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Prioritize people nearby</Text>
            <AppSwitch testID="cf-nearby" value={nearby} onValueChange={setNearby} />
          </View>
          <View style={styles.divider} />
          <View style={styles.genderRow}>
            {(["all", "female", "male"] as const).map((g) => (
              <Pressable
                key={g}
                testID={`cf-gender-${g}`}
                style={[styles.genderPill, gender === g && styles.genderPillOn]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.genderText, gender === g && styles.genderTextOn]}>
                  {g === "all" ? "All" : g === "female" ? "Female" : "Male"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.divider} />
          <View style={styles.rowLine}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHint}>Region of language partner</Text>
              <TextInput
                testID="cf-region"
                style={styles.inlineInput}
                placeholder="Any"
                placeholderTextColor={colors.onSurface}
                value={region}
                onChangeText={setRegion}
              />
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
          </View>
          <View style={styles.divider} />
          <View style={styles.rowLine}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHint}>City of language partner</Text>
              <TextInput
                testID="cf-city"
                style={styles.inlineInput}
                placeholder="Any"
                placeholderTextColor={colors.onSurface}
                value={city}
                onChangeText={setCity}
              />
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable testID="cf-search" style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontFamily: fonts.displayBold,
      fontSize: 18,
      color: colors.onSurface,
    },
    resetText: { fontFamily: fonts.textBold, fontSize: 15.5, color: PURPLE },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
    },
    rowLine: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    cardHint: { fontFamily: fonts.text, fontSize: 12.5, color: colors.onSurfaceSecondary },
    cardValue: {
      fontFamily: fonts.textBold,
      fontSize: 16.5,
      color: colors.onSurface,
      marginTop: 3,
    },
    label: { fontFamily: fonts.textBold, fontSize: 16, color: colors.onSurface },
    purpleValue: { fontFamily: fonts.textBold, fontSize: 15, color: PURPLE },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    dotsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      paddingHorizontal: 4,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.surfaceTertiary,
    },
    dotActive: { backgroundColor: PURPLE },
    advRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    advText: { fontFamily: fonts.displayBold, fontSize: 16.5, color: colors.onSurface },
    vipChip: {
      backgroundColor: "#F5A623",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    vipChipText: { fontFamily: fonts.textBold, fontSize: 10, color: "#FFFFFF", fontStyle: "italic" },
    genderRow: { flexDirection: "row", gap: 10 },
    genderPill: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.pill,
      paddingVertical: 11,
      alignItems: "center",
    },
    genderPillOn: { backgroundColor: PURPLE },
    genderText: { fontFamily: fonts.textBold, fontSize: 14.5, color: colors.onSurfaceSecondary },
    genderTextOn: { color: "#FFFFFF" },
    inlineInput: {
      fontFamily: fonts.textBold,
      fontSize: 16,
      color: colors.onSurface,
      paddingVertical: 2,
      marginTop: 2,
    },
    footer: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary },
    searchBtn: {
      backgroundColor: PURPLE,
      borderRadius: radius.pill,
      height: 54,
      alignItems: "center",
      justifyContent: "center",
    },
    searchText: { fontFamily: fonts.textBold, fontSize: 17, color: "#FFFFFF" },
  });
