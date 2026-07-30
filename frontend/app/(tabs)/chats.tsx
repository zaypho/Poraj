import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/Avatar";
import { GroupAvatar } from "@/src/components/GroupAvatar";
import { SpeakingBars } from "@/src/components/SpeakingBars";
import { VipBadge } from "@/src/components/Badges";
import { countryToCode } from "@/src/constants/countries";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useChatSocket } from "@/src/hooks/use-chat-socket";
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";
import { api, Conversation } from "@/src/utils/api";
import { timeAgo } from "@/src/utils/time";

interface Shortcut {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route?: string;
}

const SHORTCUTS: Shortcut[] = [
  {
    key: "pro",
    label: "Pro",
    icon: "videocam",
    color: "#C05A46",
    route: "/pro",
  },
  {
    key: "lessons",
    label: "Lessons",
    icon: "sparkles",
    color: "#3AC569",
    route: "/lessons",
  },
  {
    key: "premium",
    label: "Premium",
    icon: "diamond",
    color: "#FFB627",
    route: "/premium",
  },
  {
    key: "learn",
    label: "Vocab",
    icon: "book",
    color: "#C6B2FF",
    route: "/learn",
  },
  { key: "courses", label: "All Courses", icon: "book", color: "#3B82F6" },
  { key: "play", label: "Play", icon: "game-controller", color: "#22C55E" },
  {
    key: "translate",
    label: "AI Translation",
    icon: "language",
    color: "#14B8A6",
    route: "/translate",
  },
  { key: "voice", label: "Voiceroom", icon: "mic", color: "#8B5CF6" },
  { key: "more", label: "More", icon: "chevron-down", color: "#9CA3AF" },
];

export default function Chats() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [vnInfo, setVnInfo] = useState<{
    unread: number;
    last: { text: string; created_at: string } | null;
  } | null>(null);

  const load = useCallback(async () => {
    if (!user) return; // wait for auth to hydrate (fresh page loads)
    try {
      const data = await api.get<Conversation[]>("/chats");
      setConversations(data);
      api
        .get<{ unread: number; last: { text: string; created_at: string } | null }>(
          "/rooms/notices/unread",
        )
        .then(setVnInfo)
        .catch(() => {});
    } catch {
      // keep previous list on transient errors
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  useChatSocket(
    useCallback(
      (event) => {
        if (event.type === "new_message") load();
      },
      [load],
    ),
  );

  const [chatFilter, setChatFilter] = useState<
    "all" | "online" | "unread" | "myturn" | "timezone"
  >("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = conversations;
    if (q) {
      list = list.filter((c) => {
        const name = ((c.is_group ? c.name : c.partner?.name) || "").toLowerCase();
        const snippet = (c.last_message?.text || "").toLowerCase();
        return name.includes(q) || snippet.includes(q);
      });
    }
    switch (chatFilter) {
      case "online":
        return list.filter((c) => c.is_group || c.partner?.is_online);
      case "unread":
        return list.filter((c) => c.unread > 0);
      case "myturn":
        // Their message is the latest — it's my turn to reply.
        return list.filter(
          (c) => c.last_message && c.last_message.sender_id !== user?.id,
        );
      case "timezone":
        // Same country ≈ same timezone neighbourhood.
        return list.filter(
          (c) => !c.is_group && c.partner?.country && c.partner.country === user?.country,
        );
      default:
        return list;
    }
  }, [conversations, query, chatFilter, user?.id, user?.country]);

  const FILTERS: { key: typeof chatFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "online", label: "Online" },
    { key: "unread", label: "Unread" },
    { key: "myturn", label: "My turn" },
    { key: "timezone", label: "Timezone" },
  ];

  const onShortcut = (s: Shortcut) => {
    if (s.route) router.push(s.route as never);
  };

  const listHeader = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shortcutRow}
      >
        {SHORTCUTS.map((s) => (
          <Pressable
            key={s.key}
            testID={`chats-shortcut-${s.key}`}
            style={styles.shortcut}
            onPress={() => onShortcut(s)}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: s.color }]}>
              <Ionicons name={s.icon} size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.shortcutLabel} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.onSurfaceSecondary} />
        <TextInput
          testID="chats-search-input"
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={colors.onSurfaceSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <Pressable
            testID="chats-search-clear"
            onPress={() => setQuery("")}
            hitSlop={8}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.onSurfaceSecondary}
            />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <View style={styles.filterSortBtn}>
          <MaterialCommunityIcons
            name="sort-variant"
            size={18}
            color={colors.onSurfaceSecondary}
          />
        </View>
        {FILTERS.map((f) => {
          const active = chatFilter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`chat-filter-${f.key}`}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setChatFilter(f.key)}
            >
              <Text
                style={[styles.filterChipText, active && styles.filterChipTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="chats-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <Pressable
          testID="chats-add-btn"
          style={styles.headerIconBtn}
          onPress={() => router.push("/add-sheet")}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Shortcuts + search — pinned; only the conversation list scrolls. */}
      {listHeader}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          ListHeaderComponent={
            <Pressable
              testID="live-voiceroom-row"
              style={styles.row}
              onPress={() => router.push("/voiceroom-notices")}
            >
              <View>
                <View style={styles.vnAvatar}>
                  <Ionicons name="mic" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.vnVerified}>
                  <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={styles.nameWrap}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      Live & Voiceroom
                    </Text>
                  </View>
                  {vnInfo?.last ? (
                    <Text style={styles.rowTime}>
                      {timeAgo(vnInfo.last.created_at)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.rowSnippet} numberOfLines={1}>
                    {vnInfo?.last?.text ||
                      "Voiceroom alerts from hosts you follow"}
                  </Text>
                  {(vnInfo?.unread || 0) > 0 && (
                    <View style={styles.badge} testID="vn-unread-badge">
                      <Text style={styles.badgeText}>{vnInfo?.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="chatbubbles-outline"
                size={56}
                color={colors.borderStrong}
              />
              <Text style={styles.emptyTitle}>
                {query ? "No matches" : "No chats yet"}
              </Text>
              <Text style={styles.emptyText}>
                {query
                  ? "Try a different search."
                  : "Find a partner and say hello!"}
              </Text>
              {!query && (
                <Pressable
                  testID="chats-find-partners-btn"
                  style={styles.findBtn}
                  onPress={() => router.push("/add-sheet")}
                >
                  <Text style={styles.findBtnText}>Find Partners</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`chat-row-${item.id}`}
              style={styles.row}
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <View>
                {item.is_group ? (
                  <GroupAvatar
                    testID={`group-avatar-${item.id}`}
                    members={item.members_preview || []}
                    size={54}
                  />
                ) : (
                  <Avatar
                    name={item.partner?.name}
                    url={item.partner?.avatar_url}
                    size={54}
                    flagCode={countryToCode(item.partner?.country)}
                    online={item.partner?.is_online}
                    frame={item.partner?.active_frame}
                    inVoiceRoom={!!item.partner?.in_voice_room}
                  />
                )}
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={styles.nameWrap}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.is_group ? item.name : item.partner?.name || "Unknown"}
                    </Text>
                    {item.partner?.active_badge?.emoji ? (
                      <Text style={{ fontSize: 12 }}>
                        {item.partner.active_badge.emoji}
                      </Text>
                    ) : null}
                    {item.partner?.is_vip ? (
                      <VipBadge small tier={item.partner?.vip_tier} />
                    ) : null}
                  </View>
                  <Text style={styles.rowTime}>
                    {timeAgo(item.last_message?.created_at)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  {item.partner?.in_voice_room ? (
                    <View style={styles.roomStatusRow}>
                      <SpeakingBars color="#7C5CFC" />
                      <Text style={styles.roomStatus} numberOfLines={1}>
                        In voice room
                        {item.partner.in_voice_room.name
                          ? ` · ${item.partner.in_voice_room.name}`
                          : ""}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.rowSnippet} numberOfLines={1}>
                      {item.last_message?.text || "Say hello 👋"}
                    </Text>
                  )}
                  {item.unread > 0 && (
                    <View style={styles.badge} testID={`chat-unread-${item.id}`}>
                      <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
    collapsibleWrap: {
      overflow: "hidden",
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brand,
    },
    headerTitle: {
      flex: 1,
      textAlign: "left",
      fontFamily: fonts.display,
      fontSize: 22,
      color: colors.onSurface,
    },
    shortcutRow: {
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    shortcut: {
      alignItems: "center",
      width: 56,
      gap: 6,
    },
    shortcutIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    shortcutLabel: {
      fontFamily: fonts.textSemi,
      fontSize: 11,
      color: colors.onSurfaceSecondary,
      textAlign: "center",
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: colors.onSurface,
      padding: 0,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    rowBody: {
      flex: 1,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      paddingBottom: spacing.md,
      gap: spacing.xs,
    },
    rowTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    groupAvatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#EFEAFE",
      alignItems: "center",
      justifyContent: "center",
    },
    rowName: {
      fontFamily: fonts.displaySemi,
      fontSize: 16,
      color: colors.onSurface,
      flexShrink: 1,
    },
    nameWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    filterSortBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChip: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.pill,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    filterChipActive: {
      backgroundColor: "#EFEAFE",
    },
    filterChipText: {
      fontFamily: fonts.textSemi,
      fontSize: 13.5,
      color: colors.onSurfaceSecondary,
    },
    filterChipTextActive: {
      fontFamily: fonts.textBold,
      color: "#7C5CFC",
    },
    vnAvatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#3B9DF8",
      alignItems: "center",
      justifyContent: "center",
    },
    vnVerified: {
      position: "absolute",
      bottom: 0,
      left: 0,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: "#22C55E",
      borderWidth: 1.5,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    roomBadge: {
      position: "absolute",
      top: -3,
      left: -3,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#8B5CF6",
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    roomStatusRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    roomStatus: {
      flex: 1,
      fontFamily: fonts.textSemi,
      fontSize: 13,
      color: "#8B5CF6",
    },
    rowTime: {
      fontFamily: fonts.text,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
    },
    rowBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
    },
    rowSnippet: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    badgeText: {
      color: colors.onBrand,
      fontFamily: fonts.textBold,
      fontSize: 11,
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.xl,
      paddingTop: spacing.xxxl,
    },
    emptyTitle: {
      fontFamily: fonts.displaySemi,
      fontSize: 18,
      color: colors.onSurface,
      marginTop: spacing.md,
    },
    emptyText: {
      fontFamily: fonts.text,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
    },
    findBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
    },
    findBtnText: {
      color: colors.onBrand,
      fontFamily: fonts.textBold,
      fontSize: 15,
    },
  });
