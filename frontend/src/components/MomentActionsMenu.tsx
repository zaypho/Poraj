import { Ionicons } from "@/src/ui/icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme";

export type MomentAction =
  | "modify_visibility"
  | "pin_to_profile"
  | "delete"
  | "add_to_favorites"
  | "upvote"
  | "dislike_post"
  | "dislike_author"
  | "report";

interface Props {
  visible: boolean;
  isOwner: boolean;
  // Anchor position (typically the 3-dot button's screen coordinates). The
  // menu will render at (anchorRight, anchorTop) so the arrow appears to
  // point at the button.
  anchorRight?: number;
  anchorTop?: number;
  onClose: () => void;
  onAction: (a: MomentAction) => void;
}

interface Item {
  key: MomentAction;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  danger?: boolean;
}

const ownerItems: Item[] = [
  { key: "modify_visibility", label: "Modify Visibility", icon: "eye" },
  { key: "pin_to_profile", label: "Pin to profile", icon: "bookmark" },
  { key: "delete", label: "Delete", icon: "trash", danger: true },
];

const viewerItems: Item[] = [
  { key: "add_to_favorites", label: "Add to Favorites", icon: "bookmark-outline" },
  { key: "upvote", label: "Upvote to feature", icon: "thumbs-up-outline" },
  { key: "dislike_post", label: "Dislike post", icon: "close-circle-outline" },
  { key: "dislike_author", label: "Dislike author", icon: "person-remove-outline" },
  { key: "report", label: "Report", icon: "warning-outline", danger: true },
];

/**
 * Popup menu shown when a user taps the 3-dot button on a Moment card or the
 * Moment detail header. Renders different items for post owners vs viewers,
 * anchored to the top-right of the tapped icon.
 */
export const MomentActionsMenu: React.FC<Props> = ({
  visible,
  isOwner,
  anchorRight = 16,
  anchorTop = 60,
  onClose,
  onAction,
}) => {
  const { colors } = useTheme();
  const items = isOwner ? ownerItems : viewerItems;

  const handlePress = (key: MomentAction) => {
    Haptics.selectionAsync();
    onAction(key);
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID="moment-menu-backdrop">
        <View
          style={[
            styles.card,
            {
              right: anchorRight,
              top: anchorTop,
              backgroundColor: colors.surfaceTertiary,
              shadowColor: "#000",
            },
          ]}
        >
          {items.map((it, idx) => (
            <Pressable
              key={it.key}
              testID={`moment-menu-${it.key}`}
              onPress={() => handlePress(it.key)}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surface },
                idx === items.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Ionicons
                name={it.icon}
                size={20}
                color={it.danger ? colors.error : colors.onSurface}
              />
              <Text
                style={[
                  styles.label,
                  { color: it.danger ? colors.error : colors.onSurface },
                ]}
              >
                {it.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  card: {
    position: "absolute",
    minWidth: 210,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  label: {
    fontFamily: fonts.textSemi,
    fontSize: 15.5,
  },
});
