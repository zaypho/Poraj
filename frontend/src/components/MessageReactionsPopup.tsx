import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
} from "react-native-reanimated";

import { fonts, radius, spacing } from "@/src/theme";

/**
 * HelloTalk-style message action sheet that pops next to a long-pressed bubble.
 * A single rounded card holds: a quick-emoji reaction strip, a row of round
 * action buttons (Reply · Copy · Read aloud · Save) and a labelled action list
 * (Translation · AI Corrections · Correction · Practice · Pin · Multi-select).
 */

export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍", "🔥"];

const EXPANDED_EMOJIS = [
  "❤️", "😂", "😮", "😢", "😡", "👍", "👎", "🙏",
  "🔥", "🎉", "💯", "✨", "😍", "🥺", "😅", "😎",
  "🙌", "👏", "💜", "🥰", "🤗", "😴", "🤔", "🙄",
];

const ACCENT = "#7C6BF0";
const INK = "#1F2430";
const MUTED = "#8A8F9C";

export type MsgMenuAction =
  | "reply"
  | "copy"
  | "readAloud"
  | "save"
  | "translate"
  | "aiCorrect"
  | "correct"
  | "practice"
  | "pin"
  | "multiSelect"
  | "delete";

interface Props {
  visible: boolean;
  anchor: { x: number; y: number; width: number; height: number } | null;
  mine: boolean;
  hasText: boolean;
  isVoice?: boolean;
  currentReaction?: string;
  pinned?: boolean;
  saved?: boolean;
  practiced?: boolean;
  hasManualCorrection?: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onAction: (action: MsgMenuAction) => void;
}

export function MessageReactionsPopup({
  visible,
  anchor,
  mine,
  hasText,
  isVoice,
  currentReaction,
  pinned,
  saved,
  practiced,
  hasManualCorrection,
  onClose,
  onReact,
  onAction,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { width: screenW, height: screenH } = Dimensions.get("window");

  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  if (!visible || !anchor) return null;

  const CARD_WIDTH = 288;
  // Estimated card height so we can decide above/below and clamp on-screen.
  const CARD_HEIGHT = Math.min(470, screenH - 120);

  const centerX = anchor.x + anchor.width / 2;
  let cardLeft = centerX - CARD_WIDTH / 2;
  cardLeft = Math.max(12, Math.min(cardLeft, screenW - CARD_WIDTH - 12));

  // Prefer placing the card below the bubble; flip above when there's no room.
  const spaceBelow = screenH - (anchor.y + anchor.height);
  let cardTop: number;
  if (spaceBelow > CARD_HEIGHT + 24) {
    cardTop = anchor.y + anchor.height + 12;
  } else if (anchor.y > CARD_HEIGHT + 24) {
    cardTop = anchor.y - CARD_HEIGHT - 12;
  } else {
    cardTop = Math.max(60, (screenH - CARD_HEIGHT) / 2);
  }

  const react = (emoji: string) => {
    Haptics.selectionAsync().catch(() => {});
    onReact(emoji);
  };
  const act = (a: MsgMenuAction) => {
    Haptics.selectionAsync().catch(() => {});
    onAction(a);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={ZoomIn.duration(170)}
          exiting={FadeOut.duration(120)}
          style={[styles.card, { left: cardLeft, top: cardTop, width: CARD_WIDTH }]}
        >
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ borderRadius: 26 }}>
            {/* Emoji reaction strip */}
            {!expanded ? (
              <View style={styles.reactionRow}>
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    testID={`reaction-${emoji}`}
                    onPress={() => react(emoji)}
                    style={({ pressed }) => [
                      styles.reactionBtn,
                      currentReaction === emoji && styles.reactionActive,
                      pressed && styles.reactionPressed,
                    ]}
                    hitSlop={4}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
                <Pressable
                  testID="reaction-more"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setExpanded(true);
                  }}
                  style={styles.moreBtn}
                >
                  <Ionicons name="add" size={18} color={ACCENT} />
                </Pressable>
              </View>
            ) : (
              <Animated.View entering={FadeIn.duration(140)} style={styles.expandedGrid}>
                {EXPANDED_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    testID={`reaction-full-${emoji}`}
                    onPress={() => react(emoji)}
                    style={styles.gridBtn}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </Animated.View>
            )}

            <View style={styles.divider} />

            {/* Round action buttons */}
            <View style={styles.roundRow}>
              <RoundBtn testID="msg-round-reply" icon="arrow-undo-outline" label="Reply" onPress={() => act("reply")} />
              {hasText && (
                <RoundBtn testID="msg-round-copy" icon="copy-outline" label="Copy" onPress={() => act("copy")} />
              )}
              {(hasText || isVoice) && (
                <RoundBtn testID="msg-round-read" icon="volume-high-outline" label="Read" onPress={() => act("readAloud")} />
              )}
              <RoundBtn
                testID="msg-round-save"
                icon={saved ? "bookmark" : "bookmark-outline"}
                label="Save"
                active={saved}
                onPress={() => act("save")}
              />
            </View>

            {/* Labelled action list */}
            <ScrollView
              style={{ maxHeight: CARD_HEIGHT - 190 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {hasText && (
                <ListRow testID="msg-list-translate" onPress={() => act("translate")}
                  left={<Text style={styles.glyph}>文A</Text>} label="Translation" ai />
              )}
              {hasText && (
                <ListRow testID="msg-list-aicorrect" onPress={() => act("aiCorrect")}
                  left={<Ionicons name="sparkles-outline" size={19} color={INK} />} label="AI Corrections" ai />
              )}
              {hasText && (
                <ListRow testID="msg-list-correct" onPress={() => act("correct")}
                  left={<Text style={styles.abc}>Abc</Text>}
                  label="Correction"
                  active={hasManualCorrection} />
              )}
              {hasText && (
                <ListRow testID="msg-list-practice" onPress={() => act("practice")}
                  left={<Ionicons name="locate-outline" size={19} color={INK} />}
                  label="Practice"
                  active={practiced} />
              )}
              <View style={styles.listDivider} />
              <ListRow testID="msg-list-pin" onPress={() => act("pin")}
                left={<MaterialCommunityIcons name={pinned ? "pin" : "pin-outline"} size={19} color={pinned ? ACCENT : INK} />}
                label={pinned ? "Unpin" : "Pin"}
                active={pinned} />
              <ListRow testID="msg-list-multi" onPress={() => act("multiSelect")}
                left={<MaterialCommunityIcons name="format-list-checks" size={19} color={INK} />}
                label="Multi-select" />
              {mine && (
                <ListRow testID="msg-list-delete" onPress={() => act("delete")}
                  left={<Ionicons name="trash-outline" size={19} color="#EF4444" />}
                  label="Delete"
                  danger />
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function RoundBtn({
  testID,
  icon,
  label,
  active,
  onPress,
}: {
  testID: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable testID={testID} style={styles.roundItem} onPress={onPress} hitSlop={4}>
      <View style={[styles.roundCircle, active && styles.roundCircleActive]}>
        <Ionicons name={icon} size={21} color={active ? ACCENT : INK} />
      </View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

function ListRow({
  testID,
  left,
  label,
  ai,
  active,
  danger,
  onPress,
}: {
  testID: string;
  left: React.ReactNode;
  label: string;
  ai?: boolean;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
    >
      <View style={styles.listIcon}>{left}</View>
      <Text
        style={[
          styles.listLabel,
          active && { color: ACCENT },
          danger && { color: "#EF4444" },
        ]}
      >
        {label}
      </Text>
      {ai && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      )}
      {active && !ai && (
        <Ionicons name="checkmark" size={16} color={ACCENT} style={{ marginLeft: "auto" }} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 14, 38, 0.32)",
  },
  card: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  reactionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionActive: {
    backgroundColor: "#EEEAFF",
    transform: [{ scale: 1.08 }],
  },
  reactionPressed: {
    transform: [{ scale: 0.85 }],
  },
  reactionEmoji: {
    fontSize: 23,
  },
  moreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F0FF",
  },
  expandedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 4,
  },
  gridBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEBF3",
    marginVertical: 8,
  },
  roundRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  roundItem: {
    alignItems: "center",
    gap: 5,
  },
  roundCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F4F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  roundCircleActive: {
    backgroundColor: "#EEEAFF",
  },
  roundLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 11,
    color: MUTED,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEBF3",
    marginVertical: 4,
    marginHorizontal: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  listRowPressed: {
    backgroundColor: "#F5F4FA",
  },
  listIcon: {
    width: 24,
    alignItems: "center",
  },
  listLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 15.5,
    color: INK,
  },
  glyph: {
    fontFamily: fonts.textBold,
    fontSize: 15,
    color: INK,
  },
  abc: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: INK,
  },
  aiBadge: {
    marginLeft: 6,
    marginTop: -8,
  },
  aiBadgeText: {
    fontFamily: fonts.textBold,
    fontSize: 9,
    color: ACCENT,
    letterSpacing: 0.5,
  },
});
