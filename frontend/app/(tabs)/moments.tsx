import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/src/components/Avatar";
import { VipBadge } from "@/src/components/Badges";
import { FlagIcon } from "@/src/components/FlagIcon";
import { LikersRow } from "@/src/components/LikersRow";
import { RoomMomentCard } from "@/src/components/RoomMomentCard";
import { VoiceBubble } from "@/src/components/VoiceBubble";
import { countryToCode } from "@/src/constants/countries";
import { langName } from "@/src/constants/languages";
import { useAuth } from "@/src/context/AuthContext";
import { useNotifications } from "@/src/context/NotificationsContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, shadow, spacing, ThemeColors } from "@/src/theme";
import { api, assetUrl, Moment } from "@/src/utils/api";
import { timeAgo } from "@/src/utils/time";

export default function Moments() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { momentsUnread, refresh: refreshNotifications } = useNotifications();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [photo, setPhoto] = useState<{ base64: string; uri: string; mime: string } | null>(null);
  const [postTranslations, setPostTranslations] = useState<Record<string, string>>({});
  const [feedTab, setFeedTab] = useState<"recent" | "foryou" | "help" | "nearby" | "selfies">("recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fNative, setFNative] = useState("any");
  const [fLearn, setFLearn] = useState("any");
  const [applied, setApplied] = useState<{ native: string; learn: string }>({
    native: "any",
    learn: "any",
  });

  const FEED_TABS = [
    { key: "recent", label: "Recent" },
    { key: "foryou", label: "For You" },
    { key: "help", label: "Help" },
    { key: "nearby", label: "Nearby" },
    { key: "selfies", label: "Selfies" },
  ] as const;
  const FLANGS = ["any", "en", "es", "fr", "de", "ja", "ko", "zh", "ar", "hi", "bn", "pt", "ru"];

  const visibleMoments = React.useMemo(() => {
    let list = moments;
    if (applied.native !== "any") {
      list = list.filter((m) => m.author?.native_language === applied.native);
    }
    if (applied.learn !== "any") {
      list = list.filter(
        (m) =>
          (m.author?.learning_languages?.[0] || m.author?.learning_language) ===
          applied.learn,
      );
    }
    switch (feedTab) {
      case "foryou": {
        const mine = new Set(
          [
            user?.native_language,
            user?.learning_language,
            ...(user?.learning_languages || []),
          ].filter(Boolean) as string[],
        );
        return list.filter(
          (m) =>
            m.author?.native_language && mine.has(m.author.native_language),
        );
      }
      case "help":
        return list.filter(
          (m) =>
            m.text?.includes("?") ||
            (m.tags || []).some((t) => ["help", "questions", "grammar"].includes(t)),
        );
      case "nearby":
        return list.filter(
          (m) => m.author?.country && m.author.country === user?.country,
        );
      case "selfies":
        return list.filter((m) => !!m.image_url);
      default:
        return list;
    }
  }, [moments, feedTab, applied, user]);
  const [translatingPost, setTranslatingPost] = useState<string | null>(null);

  const translatePost = async (moment: Moment) => {
    if (postTranslations[moment.id]) {
      setPostTranslations((prev) => {
        const next = { ...prev };
        delete next[moment.id];
        return next;
      });
      return;
    }
    if (!moment.text || translatingPost) return;
    setTranslatingPost(moment.id);
    try {
      const result = await api.post<{ translated: string }>("/ai/translate", {
        text: moment.text,
        target_language: user?.native_language || "en",
      });
      setPostTranslations((prev) => ({ ...prev, [moment.id]: result.translated }));
    } catch (e) {
      Alert.alert(
        "Translate",
        e instanceof Error ? e.message : "Translation failed. Try again.",
      );
    } finally {
      setTranslatingPost(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const data = await api.get<Moment[]>("/moments");
      setMoments(data);
    } catch {
      // keep previous feed on transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshNotifications();
    }, [load, refreshNotifications]),
  );

  const voteOnPoll = async (momentId: string, optionIndex: number) => {
    // Optimistic — flip local counts first so the bar animates immediately.
    setMoments((prev) =>
      prev.map((m) => {
        if (m.id !== momentId || !m.poll) return m;
        const wasIdx = m.poll.my_vote;
        if (wasIdx === optionIndex) return m; // no change if same option
        const opts = m.poll.options.map((o, i) => {
          let v = o.votes;
          if (wasIdx === i) v = Math.max(0, v - 1);
          if (i === optionIndex) v = v + 1;
          return { ...o, votes: v };
        });
        const total = wasIdx == null ? (m.poll.total_votes || 0) + 1 : m.poll.total_votes;
        return {
          ...m,
          poll: { ...m.poll, options: opts, total_votes: total, my_vote: optionIndex },
        };
      }),
    );
    try {
      const updated = await api.post<Moment>(`/moments/${momentId}/vote`, {
        option_index: optionIndex,
      });
      setMoments((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      load();
    }
  };

  const toggleLike = async (moment: Moment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMoments((prev) =>
      prev.map((m) =>
        m.id === moment.id
          ? {
              ...m,
              liked_by_me: !m.liked_by_me,
              like_count: m.like_count + (m.liked_by_me ? -1 : 1),
            }
          : m,
      ),
    );
    try {
      await api.post(`/moments/${moment.id}/like`);
    } catch {
      load();
    }
  };

  const joinRoomFromMoment = async (roomId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post(`/rooms/${roomId}/join`);
      router.push(`/room/${roomId}`);
    } catch {
      Alert.alert("Room ended", "This voice room is no longer live.");
      load();
    }
  };


  const pickPhoto = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!current.granted) {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert(
            "Photos",
            "Photo access is disabled. Enable it in Settings to share photos.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert("Photos", "Photo access is needed to add a photo.");
        }
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    setPhoto({
      base64: asset.base64,
      uri: asset.uri,
      mime: asset.mimeType || "image/jpeg",
    });
  };

  const publish = async () => {
    if (!draft.trim() && !photo) return;
    setPosting(true);
    try {
      await api.post("/moments", {
        text: draft.trim(),
        image_base64: photo?.base64,
        mime: photo?.mime,
      });
      setDraft("");
      setPhoto(null);
      setComposerOpen(false);
      load();
    } catch {
      // keep modal open so user can retry
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="moments-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moments</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          testID="moments-ranking-btn"
          hitSlop={8}
          onPress={() => router.push("/moments-ranking")}
        >
          <MaterialCommunityIcons
            name="podium-gold"
            size={23}
            color={colors.onSurface}
          />
        </Pressable>
        <Pressable
          testID="notifications-bell-btn"
          hitSlop={8}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons name="notifications-outline" size={23} color={colors.onSurface} />
          {momentsUnread > 0 && (
            <View style={styles.bellBadge} testID="notifications-badge">
              <Text style={styles.bellBadgeText}>
                {momentsUnread > 99 ? "99+" : momentsUnread}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.feedTabsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FEED_TABS as any}
          keyExtractor={(t: any) => t.key}
          renderItem={({ item: t }: any) => {
            const active = feedTab === t.key;
            return (
              <Pressable
                testID={`moments-tab-${t.key}`}
                style={[styles.feedTab, active && styles.feedTabOn]}
                onPress={() => setFeedTab(t.key)}
              >
                <Text style={[styles.feedTabText, active && styles.feedTabTextOn]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          }}
        />
        <Pressable
          testID="moments-filter-btn"
          hitSlop={8}
          style={{ paddingHorizontal: 6 }}
          onPress={() => setFilterOpen(true)}
        >
          <Ionicons name="options" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={visibleMoments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="sparkles-outline" size={56} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Share your first moment!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`moment-card-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/moment/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Pressable
                  testID={`moment-author-avatar-${item.id}`}
                  onPress={() =>
                    item.author?.id && router.push(`/user/${item.author.id}`)
                  }
                >
                  <Avatar
                    name={item.author?.name}
                    url={item.author?.avatar_url}
                    size={42}
                    flagCode={countryToCode(item.author?.country)}
                    online={item.author?.is_online}
                    frame={item.author?.active_frame}
                    inVoiceRoom={!!item.author?.in_voice_room}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <View style={styles.authorRow}>
                    <Text style={styles.authorName}>
                      {item.author?.name || "Unknown"}
                    </Text>
                    {item.author?.active_badge?.emoji ? (
                      <Text style={{ fontSize: 12 }}>
                        {item.author.active_badge.emoji}
                      </Text>
                    ) : null}
                    {item.author?.is_vip ? (
                      <VipBadge small tier={item.author?.vip_tier} />
                    ) : null}
                  </View>
                  <View style={styles.langRow}>
                    <FlagIcon code={item.author?.native_language} size={13} />
                    <Ionicons
                      name="arrow-forward"
                      size={9}
                      color={colors.onSurfaceSecondary}
                    />
                    {(item.author?.learning_languages?.length
                      ? item.author.learning_languages
                      : item.author?.learning_language
                        ? [item.author.learning_language]
                        : []
                    )
                      .slice(0, 3)
                      .map((c) => (
                        <FlagIcon key={c} code={c} size={13} />
                      ))}
                    <Text style={styles.cardTime}>
                      {" "}· {timeAgo(item.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
              {item.boosted ? (
                <View style={styles.boostTag} testID={`moment-boosted-${item.id}`}>
                  <Ionicons name="flash" size={11} color="#F5A623" />
                  <Text style={styles.boostTagText}>Boosted</Text>
                </View>
              ) : null}
              {/* Content order: voice → image/room → text (truncated) → poll */}
              {item.audio_url ? (
                <View style={styles.voiceClipWrap} testID={`moment-audio-${item.id}`}>
                  <VoiceBubble
                    audioId={item.audio_url.split("/").pop() as string}
                    durationMs={item.audio_duration_ms}
                  />
                </View>
              ) : null}
              {item.room ? (
                <RoomMomentCard
                  testID={`moment-room-card-${item.id}`}
                  room={item.room}
                  onPress={() => joinRoomFromMoment(item.room!.id)}
                />
              ) : item.image_url ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/photo-viewer",
                      params: {
                        uri: assetUrl(item.image_url)!,
                        mediaId: (item.image_url || "").split("/").pop() as string,
                        momentId: item.id,
                        likeCount: String(item.like_count),
                        commentCount: String(item.comment_count),
                        liked: item.liked_by_me ? "1" : "0",
                      },
                    })
                  }
                >
                  <Image
                    testID={`moment-image-${item.id}`}
                    source={{ uri: assetUrl(item.image_url)! }}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>
              ) : null}
              {item.text ? (
                <Text style={styles.cardText} numberOfLines={4}>
                  {item.text}
                </Text>
              ) : null}
              {postTranslations[item.id] ? (
                <View style={styles.translationBlock} testID={`moment-translation-${item.id}`}>
                  <Ionicons name="language" size={13} color={colors.brand} />
                  <Text style={styles.translationText}>
                    {postTranslations[item.id]}
                  </Text>
                </View>
              ) : null}
              {item.poll ? (
                <View style={styles.pollWrap} testID={`moment-poll-${item.id}`}>
                  {(() => {
                    const total = item.poll.total_votes || 0;
                    return item.poll.options.map((opt, idx) => {
                      const pct = total > 0 ? (opt.votes / total) * 100 : 0;
                      const mine = item.poll?.my_vote === idx;
                      return (
                        <Pressable
                          key={idx}
                          testID={`moment-poll-option-${item.id}-${idx}`}
                          onPress={() => voteOnPoll(item.id, idx)}
                          style={[
                            styles.pollOption,
                            mine && { borderColor: colors.brand, borderWidth: 1.5 },
                          ]}
                        >
                          <View
                            style={[
                              styles.pollFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: mine
                                  ? colors.brandTertiary
                                  : colors.surfaceSecondary,
                              },
                            ]}
                          />
                          <View style={styles.pollOptionInner}>
                            <Text style={styles.pollOptionText} numberOfLines={2}>
                              {opt.text}
                            </Text>
                            <Text style={styles.pollOptionPct}>
                              {total > 0 ? `${Math.round(pct)}%` : ""}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    });
                  })()}
                  <Text style={styles.pollTotal}>
                    {item.poll.total_votes || 0} vote
                    {(item.poll.total_votes || 0) === 1 ? "" : "s"}
                  </Text>
                </View>
              ) : null}
              {item.tags && item.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {item.tags.map((t) => (
                    <View key={t} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>#{t}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable
                  testID={`moment-like-btn-${item.id}`}
                  style={styles.actionBtn}
                  onPress={() => toggleLike(item)}
                >
                  <Ionicons
                    name={item.liked_by_me ? "heart" : "heart-outline"}
                    size={20}
                    color={item.liked_by_me ? colors.error : colors.onSurfaceSecondary}
                  />
                  <Text style={styles.actionText}>{item.like_count}</Text>
                </Pressable>
                <Pressable
                  testID={`moment-comment-btn-${item.id}`}
                  style={styles.actionBtn}
                  onPress={() => router.push(`/moment/${item.id}`)}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={18}
                    color={colors.onSurfaceSecondary}
                  />
                  <Text style={styles.actionText}>{item.comment_count}</Text>
                </Pressable>
                {item.text ? (
                  <Pressable
                    testID={`moment-translate-btn-${item.id}`}
                    style={styles.actionBtn}
                    onPress={() => translatePost(item)}
                  >
                    {translatingPost === item.id ? (
                      <ActivityIndicator size="small" color={colors.brand} />
                    ) : (
                      <Ionicons
                        name="language"
                        size={18}
                        color={
                          postTranslations[item.id]
                            ? colors.brand
                            : colors.onSurfaceSecondary
                        }
                      />
                    )}
                  </Pressable>
                ) : null}
              </View>
              <LikersRow
                momentId={item.id}
                likeCount={item.like_count}
                likers={item.likers}
              />
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.cfBackdrop} onPress={() => setFilterOpen(false)} />
        <View style={styles.cfSheet} testID="moments-custom-filter">
          <View style={styles.cfHeader}>
            <Pressable
              testID="mcf-close"
              onPress={() => setFilterOpen(false)}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.cfTitle}>Custom Filter</Text>
            <Pressable
              testID="mcf-reset"
              onPress={() => {
                setFNative("any");
                setFLearn("any");
                setApplied({ native: "any", learn: "any" });
              }}
              hitSlop={10}
            >
              <Ionicons name="refresh" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.cfCard}>
            <Pressable
              testID="mcf-native"
              style={styles.cfRow}
              onPress={() =>
                setFNative(FLANGS[(FLANGS.indexOf(fNative) + 1) % FLANGS.length])
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cfHint}>Native</Text>
                <Text style={styles.cfValue}>
                  {fNative === "any" ? "Any" : langName(fNative)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
            <View style={styles.cfDivider} />
            <Pressable
              testID="mcf-learn"
              style={styles.cfRow}
              onPress={() =>
                setFLearn(FLANGS[(FLANGS.indexOf(fLearn) + 1) % FLANGS.length])
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cfHint}>Learn</Text>
                <Text style={styles.cfValue}>
                  {fLearn === "any" ? "Any" : langName(fLearn)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
          <Pressable
            testID="mcf-search"
            style={styles.cfSearchBtn}
            onPress={() => {
              setApplied({ native: fNative, learn: fLearn });
              setFilterOpen(false);
            }}
          >
            <Text style={styles.cfSearchText}>Search</Text>
          </Pressable>
        </View>
      </Modal>

      <Pressable
        testID="moment-create-fab"
        style={styles.fab}
        onPress={() => router.push("/moment-compose")}
      >
        <Ionicons name="create" size={24} color={colors.onBrand} />
      </Pressable>

      <Modal
        visible={composerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposerOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Moment</Text>
              <Pressable
                testID="moment-composer-close-btn"
                onPress={() => setComposerOpen(false)}
              >
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            <TextInput
              testID="moment-composer-input"
              style={styles.composerInput}
              placeholder="Share something with the community... ask a language question, celebrate a win!"
              placeholderTextColor={colors.onSurfaceSecondary}
              multiline
              value={draft}
              onChangeText={setDraft}
              maxLength={1000}
            />
            {photo && (
              <View style={styles.photoPreviewWrap}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.photoPreview}
                  contentFit="cover"
                />
                <Pressable
                  testID="moment-photo-remove-btn"
                  style={styles.photoRemove}
                  onPress={() => setPhoto(null)}
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                </Pressable>
              </View>
            )}
            <View style={styles.composerActions}>
              <Pressable
                testID="moment-photo-btn"
                style={styles.photoBtn}
                onPress={pickPhoto}
              >
                <Ionicons name="image" size={20} color={colors.brand} />
                <Text style={styles.photoBtnText}>Photo</Text>
              </Pressable>
              <Pressable
                testID="moment-publish-btn"
                style={[
                  styles.publishBtn,
                  ((!draft.trim() && !photo) || posting) && { opacity: 0.4 },
                ]}
                disabled={(!draft.trim() && !photo) || posting}
                onPress={publish}
              >
                {posting ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={styles.publishText}>Post</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  targetDot: {
    position: "absolute",
    top: -1,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 36,
  },
  searchPillText: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
  },
  feedTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  feedTab: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    marginRight: 2,
  },
  feedTabOn: {
    backgroundColor: colors.brandTertiary,
  },
  feedTabText: {
    fontFamily: fonts.textSemi,
    fontSize: 15,
    color: colors.onSurfaceSecondary,
  },
  feedTabTextOn: {
    fontFamily: fonts.textBold,
    color: colors.onBrandTertiary,
  },
  cfBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  cfSheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cfHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cfTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.displayBold,
    fontSize: 17.5,
    color: colors.onSurface,
  },
  cfCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  cfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  cfHint: {
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  cfValue: {
    fontFamily: fonts.textBold,
    fontSize: 17,
    color: colors.onSurface,
    marginTop: 2,
  },
  cfDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  cfSearchBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  cfSearchText: {
    fontFamily: fonts.textBold,
    fontSize: 16.5,
    color: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  bellBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: "#FFF",
    fontFamily: fonts.textBold,
    fontSize: 10,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.onSurface,
  },
  headerSub: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  authorName: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.onSurface,
  },
  cardTime: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  cardText: {
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
  },
  translationBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  translationText: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onBrandTertiary,
  },
  boostTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#FFF4E0",
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 6,
  },
  boostTagText: {
    fontFamily: fonts.textBold,
    fontSize: 11,
    color: "#F5A623",
  },
  voiceClipWrap: {
    marginTop: spacing.sm,
    backgroundColor: "#F3F0FC",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignSelf: "flex-start",
    minWidth: 200,
  },
  cardImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  pollWrap: {
    gap: 8,
    marginTop: 4,
  },
  pollOption: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  pollFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  pollOptionInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pollOptionText: {
    flex: 1,
    fontFamily: fonts.textSemi,
    fontSize: 14,
    color: colors.onSurface,
  },
  pollOptionPct: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: colors.brand,
    marginLeft: 8,
  },
  pollTotal: {
    fontFamily: fonts.textSemi,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    backgroundColor: colors.brandTertiary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    fontFamily: fonts.textBold,
    fontSize: 12,
    color: colors.onBrandTertiary,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  actionText: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    minHeight: 300,
  },
  emptyText: {
    fontFamily: fonts.textSemi,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.onSurface,
  },
  composerInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 120,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  photoPreviewWrap: {
    alignSelf: "flex-start",
  },
  photoPreview: {
    width: 90,
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  photoBtnText: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: colors.onBrandTertiary,
  },
  publishBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  publishText: {
    color: colors.onBrand,
    fontFamily: fonts.textBold,
    fontSize: 16,
  },
});
