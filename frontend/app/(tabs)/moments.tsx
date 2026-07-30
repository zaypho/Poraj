import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { langName, LANGUAGES } from "@/src/constants/languages";
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
  const [langPicker, setLangPicker] = useState<null | "native" | "learn">(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [noticeIdx, setNoticeIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNoticeIdx((i) => (i + 1) % 3), 5000);
    return () => clearInterval(t);
  }, []);

  const FEED_TABS = [
    { key: "recent", label: "Recent" },
    { key: "foryou", label: "For You" },
    { key: "help", label: "Help" },
    { key: "nearby", label: "Nearby" },
    { key: "selfies", label: "Selfies" },
  ] as const;
  const NATIVE_NAMES: Record<string, string> = {
    en: "English",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    it: "Italiano",
    pt: "Português",
    ru: "Русский",
    ja: "日本語",
    ko: "한국어",
    zh: "中文(简体)",
    ar: "العربية",
    hi: "हिन्दी",
    bn: "বাংলা",
    tr: "Türkçe",
  };
  const NOTICES = [
    {
      title: "LinguaConnect\nMoments Topics",
      tags: ["#热门话题", "제 광장", "#topik hangat"],
      btn: "View now",
      route: "/moments-ranking",
    },
    {
      title: "Weekly Moments\nReport is here!",
      tags: ["📊 stats", "🏆 ranks"],
      btn: "Open",
      route: "/moments-report",
    },
    {
      title: "Boost your posts\nfor more exposure",
      tags: ["🚀 boost", "⚡ reach"],
      btn: "Boost",
      route: "/boost-center",
    },
  ] as const;

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
          contentContainerStyle={{ paddingRight: 14 }}
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
          style={styles.filterBtn}
          onPress={() => setFilterOpen(true)}
        >
          <MaterialCommunityIcons name="tune-variant" size={19} color={colors.onSurface} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={visibleMoments}
          ListHeaderComponent={
            <Pressable
              testID="moments-notice-banner"
              onPress={() => router.push(NOTICES[noticeIdx].route as any)}
            >
              <LinearGradient
                colors={["#8B6CF7", "#6C4DF0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.noticeBanner}
              >
                <View style={styles.noticeTags}>
                  {NOTICES[noticeIdx].tags.map((t, i) => (
                    <View
                      key={t}
                      style={[
                        styles.noticeTag,
                        { backgroundColor: ["#FFC24B", "#FF7DB0", "#5AD6FF"][i % 3] },
                      ]}
                    >
                      <Text style={styles.noticeTagText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.noticeTitle}>{NOTICES[noticeIdx].title}</Text>
                <View style={styles.noticeBtn}>
                  <Text style={styles.noticeBtnText}>{NOTICES[noticeIdx].btn}</Text>
                </View>
                <View style={styles.noticeDashes}>
                  {NOTICES.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.noticeDash, i === noticeIdx && styles.noticeDashOn]}
                    />
                  ))}
                </View>
              </LinearGradient>
            </Pressable>
          }
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
              onPress={() => {
                setPickerQuery("");
                setLangPicker("native");
              }}
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
              onPress={() => {
                setPickerQuery("");
                setLangPicker("learn");
              }}
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

      <Modal
        visible={!!langPicker}
        animationType="slide"
        onRequestClose={() => setLangPicker(null)}
      >
        <SafeAreaView style={styles.lpScreen} edges={["top", "bottom"]}>
          <View style={styles.lpHeader}>
            <Pressable
              testID="lp-close"
              onPress={() => setLangPicker(null)}
              hitSlop={10}
            >
              <Ionicons name="close" size={26} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.lpTitle}>
              {langPicker === "native" ? "Native Language" : "Learning"}
            </Text>
            <View style={{ width: 26 }} />
          </View>
          <View style={styles.lpSearch}>
            <Ionicons name="search" size={16} color={colors.onSurfaceSecondary} />
            <TextInput
              testID="lp-search"
              style={styles.lpSearchInput}
              placeholder="Search"
              placeholderTextColor={colors.onSurfaceSecondary}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              autoCapitalize="none"
            />
          </View>
          <Pressable testID="lp-vip" onPress={() => router.push("/premium")}>
            <LinearGradient
              colors={["#F040B8", "#4FA3F7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.lpVip}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.lpVipTitle}>Upgrade to VIP</Text>
                <Text style={styles.lpVipSub} numberOfLines={2}>
                  Quickly find the perfect language partner by searching for
                  partners in …
                </Text>
              </View>
              <View style={styles.lpVipBtn}>
                <Text style={styles.lpVipBtnText}>Upgrade</Text>
              </View>
            </LinearGradient>
          </Pressable>
          <Text style={styles.lpRecommend}>Recommend</Text>
          <View style={{ flex: 1, flexDirection: "row" }}>
            <ScrollView
              style={styles.lpCard}
              showsVerticalScrollIndicator={false}
            >
              {[{ code: "any", name: "Any", flag: "🌐" }, ...LANGUAGES]
                .filter(
                  (l) =>
                    !pickerQuery.trim() ||
                    l.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
                )
                .map((l) => {
                  const cur = langPicker === "native" ? fNative : fLearn;
                  const on = cur === l.code;
                  return (
                    <Pressable
                      key={l.code}
                      testID={`lp-lang-${l.code}`}
                      style={styles.lpRow}
                      onPress={() => {
                        if (langPicker === "native") setFNative(l.code);
                        else setFLearn(l.code);
                        setLangPicker(null);
                      }}
                    >
                      <View style={styles.lpFlagCircle}>
                        {l.code === "any" ? (
                          <Ionicons name="globe-outline" size={24} color="#3B82F6" />
                        ) : (
                          <FlagIcon code={l.code} size={34} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.lpName, on && styles.lpNameOn]}>
                          {l.name}
                        </Text>
                        <Text style={styles.lpNative}>
                          {l.code === "any"
                            ? "All languages"
                            : NATIVE_NAMES[l.code] || l.name}
                        </Text>
                      </View>
                      {on && (
                        <Ionicons name="checkmark" size={20} color="#7C5CFC" />
                      )}
                    </Pressable>
                  );
                })}
            </ScrollView>
            <View style={styles.lpIndex}>
              {"#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => (
                <Text key={c} style={styles.lpIndexChar}>
                  {c}
                </Text>
              ))}
            </View>
          </View>
        </SafeAreaView>
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
    gap: 10,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  noticeBanner: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 92,
    justifyContent: "center",
  },
  noticeTags: {
    position: "absolute",
    left: 10,
    top: 8,
    bottom: 8,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  noticeTag: {
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  noticeTagText: {
    fontFamily: fonts.textBold,
    fontSize: 10,
    color: "#3B2A00",
  },
  noticeTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 19,
    lineHeight: 24,
    color: "#FFFFFF",
    marginLeft: 110,
  },
  noticeBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  noticeBtnText: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: "#6C4DF0",
  },
  noticeDashes: {
    position: "absolute",
    right: 14,
    bottom: 8,
    flexDirection: "row",
    gap: 4,
  },
  noticeDash: {
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  noticeDashOn: {
    backgroundColor: "#FFFFFF",
  },
  lpScreen: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  lpHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  lpTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.onSurface,
  },
  lpSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 14,
    height: 42,
  },
  lpSearchInput: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
  },
  lpVip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  lpVipTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  lpVipSub: {
    fontFamily: fonts.text,
    fontSize: 12.5,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  lpVipBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  lpVipBtnText: {
    fontFamily: fonts.textBold,
    fontSize: 13.5,
    color: "#B44BF0",
  },
  lpRecommend: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.onSurface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  lpCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginLeft: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  lpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lpFlagCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  lpName: {
    fontFamily: fonts.textBold,
    fontSize: 16,
    color: colors.onSurfaceSecondary,
  },
  lpNameOn: {
    color: "#7C5CFC",
  },
  lpNative: {
    fontFamily: fonts.text,
    fontSize: 12.5,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  lpIndex: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  lpIndexChar: {
    fontFamily: fonts.textSemi,
    fontSize: 9.5,
    color: colors.onSurfaceSecondary,
    lineHeight: 13,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
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
