import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/Avatar";
import { VipBadge } from "@/src/components/Badges";
import { countryToCode } from "@/src/constants/countries";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";
import { api, User } from "@/src/utils/api";

const LEVELS = ["Beginner", "Elementary", "Intermediate", "Advanced", "Proficient"];

/** Custom Search results — partners filtered by the Filter sheet params. */
export default function CustomSearch() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const p = useLocalSearchParams<Record<string, string>>();
  const [partners, setPartners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "serious">("all");

  useEffect(() => {
    if (!user) return;
    api
      .get<User[]>("/users/partners")
      .then(setPartners)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    const lvMin = parseInt(p.levelMin || "0", 10);
    const lvMax = parseInt(p.levelMax || "4", 10);
    const aMin = parseInt(p.ageMin || "18", 10);
    const aMax = parseInt(p.ageMax || "90", 10);
    let list = partners.filter((u) => {
      if (p.native && p.native !== "any" && u.native_language !== p.native) return false;
      const learn = u.learning_languages?.[0] || u.learning_language;
      if (p.learning && p.learning !== "any" && learn !== p.learning) return false;
      if (u.age && (u.age < aMin || (aMax < 90 && u.age > aMax))) return false;
      if (p.gender && p.gender !== "all" && u.gender !== p.gender) return false;
      const lv = LEVELS.indexOf(u.proficiency || "");
      if (lv >= 0 && (lv < lvMin || lv > lvMax)) return false;
      const where = `${u.country || ""}`.toLowerCase();
      if (p.region && !where.includes(p.region.toLowerCase())) return false;
      if (p.city && !where.includes(p.city.toLowerCase())) return false;
      return true;
    });
    if (tab === "serious") {
      list = list.filter((u) => !!u.bio || u.is_vip);
    }
    if (p.nearby === "1" && user?.country) {
      list = [...list].sort(
        (a, b) =>
          Number(b.country === user.country) - Number(a.country === user.country),
      );
    }
    return list;
  }, [partners, p, tab, user?.country]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]} testID="custom-search-screen">
      <View style={styles.header}>
        <Pressable testID="cs-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Custom Search</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabsRow}>
        {(["all", "serious"] as const).map((t) => (
          <Pressable
            key={t}
            testID={`cs-tab-${t}`}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t === "all" ? "All" : "Serious Learners"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No partners match these filters.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`cs-row-${item.id}`}
              style={styles.row}
              onPress={() => router.push(`/user/${item.id}`)}
            >
              <Avatar
                name={item.name}
                url={item.avatar_url}
                size={56}
                flagCode={countryToCode(item.country)}
                inVoiceRoom={!!item.in_voice_room}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.is_vip ? <VipBadge small tier={item.vip_tier} /> : null}
                  <View style={{ flex: 1 }} />
                  {item.is_online ? (
                    <View style={styles.activeRow}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeText}>Active now</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.langRow}>
                  <Text style={styles.langCode}>
                    {(item.native_language || "??").toUpperCase()}
                  </Text>
                  <Ionicons name="swap-horizontal" size={12} color={colors.onSurfaceSecondary} />
                  <Text style={styles.langCode}>
                    {(item.learning_languages?.[0] || item.learning_language || "??").toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.location}>
                  {item.country || "Location Not Provided"}
                </Text>
                {item.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>
                    {item.bio}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
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
    tabsRow: {
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    tab: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: radius.pill,
    },
    tabOn: { backgroundColor: colors.surfaceSecondary },
    tabText: { fontFamily: fonts.textSemi, fontSize: 15, color: colors.onSurfaceSecondary },
    tabTextOn: { fontFamily: fonts.textBold, color: colors.onSurface },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    empty: {
      textAlign: "center",
      fontFamily: fonts.text,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
      marginTop: 50,
    },
    row: { flexDirection: "row", gap: spacing.md, paddingVertical: 14 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { fontFamily: fonts.textBold, fontSize: 16.5, color: colors.onSurface, maxWidth: 150 },
    activeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
    activeText: { fontFamily: fonts.text, fontSize: 12, color: colors.onSurfaceSecondary },
    langRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    langCode: { fontFamily: fonts.textBold, fontSize: 11.5, color: colors.onSurfaceTertiary },
    location: {
      fontFamily: fonts.text,
      fontSize: 12.5,
      color: colors.onSurfaceSecondary,
      marginTop: 3,
    },
    bio: {
      fontFamily: fonts.text,
      fontSize: 13.5,
      color: colors.onSurface,
      marginTop: 4,
      lineHeight: 19,
    },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 70 },
  });
