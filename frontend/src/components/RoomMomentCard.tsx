import { Ionicons } from "@/src/ui/icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/src/components/Avatar";
import { FlagIcon } from "@/src/components/FlagIcon";
import { SpeakingBars } from "@/src/components/SpeakingBars";
import { countryToCode } from "@/src/constants/countries";
import { langName } from "@/src/constants/languages";
import { fonts, radius, spacing } from "@/src/theme";
import { RoomCardInfo } from "@/src/utils/api";

/**
 * "Live voice room" card. Renders EXACTLY like the room cards in the Voice
 * Rooms tab list — same gradient background palette, same badge/host/member
 * layout — so shared cards embedded in Moments, single moment view, or chat
 * messages are visually identical to what users already recognise from the
 * rooms list. Single source of truth for the room-card visual.
 */

const BG_GRADIENTS: [string, string][] = [
  ["#0E9AE0", "#4B3F87"],
  ["#0EA5E9", "#0369A1"],
  ["#EC4899", "#701A75"],
  ["#F59E0B", "#B45309"],
];
const ENDED_GRADIENT: [string, string] = ["#9CA3AF", "#6B7280"];

const bgForRoom = (room: RoomCardInfo): [string, string] => {
  if (!room.is_live) return ENDED_GRADIENT;
  if (typeof room.background === "number") {
    return BG_GRADIENTS[room.background % BG_GRADIENTS.length];
  }
  let hash = 0;
  for (const ch of room.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return BG_GRADIENTS[hash % BG_GRADIENTS.length];
};

const timeAgo = (iso?: string): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export const RoomMomentCard = ({
  room,
  onPress,
  testID,
}: {
  room: RoomCardInfo;
  onPress: () => void;
  testID?: string;
}) => {
  const membersPreview = room.members_preview || [];
  const memberCount = room.member_count || 0;
  const previewExtra = Math.max(0, memberCount - membersPreview.length);

  return (
    <Pressable testID={testID} disabled={!room.is_live} onPress={onPress}>
      <LinearGradient colors={bgForRoom(room)} style={styles.card}>
        {/* Top badge row: language + topic + private lock on the left,
            LIVE badge with animated bars on the right. */}
        <View style={styles.cardTop}>
          <View style={styles.badgeRow}>
            {room.language ? (
              <View style={styles.langBadge}>
                <FlagIcon code={room.language} size={12} />
                <Text style={styles.langText}>{langName(room.language)}</Text>
              </View>
            ) : null}
            {room.topic ? (
              <View style={styles.topicBadge}>
                <Text style={styles.topicText}>#{room.topic}</Text>
              </View>
            ) : null}
            {room.is_private ? (
              <Ionicons
                name="lock-closed"
                size={12}
                color="rgba(255,255,255,0.85)"
              />
            ) : null}
          </View>
          {room.is_live ? (
            <View style={styles.liveBadge}>
              <SpeakingBars />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <Ionicons name="mic-off" size={11} color="#FFFFFF" />
              <Text style={styles.liveText}>ENDED</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {room.title || "Voice room"}
        </Text>

        {/* Bottom row: host on the left, member avatar stack + count pill on the right. */}
        <View style={styles.cardBottom}>
          <View style={styles.hostRow}>
            {room.host ? (
              <Avatar
                name={room.host.name}
                url={room.host.avatar_url}
                size={26}
                flagCode={countryToCode(room.host.country)}
                frame={room.host.active_frame}
              />
            ) : null}
            <Text style={styles.hostName} numberOfLines={1}>
              {room.host?.name || "Voice room"}
              {room.created_at ? ` · ${timeAgo(room.created_at)}` : ""}
            </Text>
          </View>
          <View style={styles.memberStack}>
            {membersPreview.map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.stackAvatar,
                  { marginLeft: i === 0 ? 0 : -9, zIndex: 10 - i },
                ]}
              >
                <Avatar name={m.name} url={m.avatar_url} size={24} />
              </View>
            ))}
            <View style={styles.memberCountPill}>
              <Ionicons name="people" size={11} color="#FFFFFF" />
              <Text style={styles.memberCountText}>
                {previewExtra > 0 ? `+${previewExtra}` : memberCount}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  langText: {
    fontFamily: fonts.textBold,
    fontSize: 10,
    color: "#FFFFFF",
  },
  topicBadge: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  topicText: {
    fontFamily: fonts.textBold,
    fontSize: 10,
    color: "#FFFFFF",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  liveText: {
    fontFamily: fonts.textBold,
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    color: "#FFFFFF",
    lineHeight: 22,
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  hostName: {
    fontFamily: fonts.textBold,
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
    flexShrink: 1,
  },
  memberStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatar: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 999,
  },
  memberCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 5,
  },
  memberCountText: {
    fontFamily: fonts.textBold,
    fontSize: 11,
    color: "#FFFFFF",
  },
});
