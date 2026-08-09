import { Ionicons } from "@/src/ui/icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { learnColors } from "./theme";

export type LearnDockTab = "home" | "plan" | "classes" | "explore";

interface DockItem {
  key: LearnDockTab;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const ITEMS: DockItem[] = [
  { key: "home", icon: "home", route: "/learn/dashboard" },
  { key: "plan", icon: "checkmark-circle", route: "/learn/plan" },
  { key: "classes", icon: "people", route: "/learn/classes" },
  { key: "explore", icon: "telescope", route: "/learn/explore" },
];

const INACTIVE_ICON = "#6B6B75"; // uniform muted colour for all icons at rest
const ACTIVE_ICON = "#FFFFFF";

/**
 * Shared floating dock for the Learn mini-app.
 *
 * Design:
 *  - All icons share ONE default colour (INACTIVE_ICON) with a subtle raised
 *    pill background — so no tab looks "chosen" until the user is on it.
 *  - Active tab swaps its pill fill to the accent orange and the icon to
 *    white, then a tiny dot appears under the pill as a secondary indicator.
 *  - Safe-area aware (`useSafeAreaInsets().bottom`) so the dock always floats
 *    ABOVE the iOS home indicator / Android nav gesture bar — it CANNOT
 *    overlap the OS bottom bar.
 *  - `scale` micro-interaction on press via Reanimated for a native feel.
 */
export function LearnDock({ active }: { active: LearnDockTab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12) + 8;

  return (
    <View
      style={[styles.dock, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <View style={styles.dockInner}>
        {ITEMS.map((item) => (
          <DockButton
            key={item.key}
            item={item}
            isActive={active === item.key}
            onPress={() => {
              if (active !== item.key) router.replace(item.route as never);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function DockButton({
  item,
  isActive,
  onPress,
}: {
  item: DockItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const activeAnim = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeAnim.value = withTiming(isActive ? 1 : 0, { duration: 220 });
  }, [isActive, activeAnim]);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateBg(activeAnim.value),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: activeAnim.value,
    transform: [
      { scale: interpolate(activeAnim.value, [0, 1], [0.4, 1]) },
    ],
  }));

  return (
    <Pressable
      testID={`learn-dock-${item.key}`}
      onPressIn={() => (scale.value = withSpring(0.92, { damping: 12 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
      onPress={onPress}
      hitSlop={6}
      style={styles.btnWrap}
    >
      <Animated.View style={[styles.btn, btnStyle]}>
        <Ionicons
          name={item.icon}
          size={18}
          color={isActive ? ACTIVE_ICON : INACTIVE_ICON}
        />
      </Animated.View>
      <Animated.View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
}

// Blend colour crudely between the two states while animating. Reanimated
// worklet-safe: uses simple string reconstruction. Kept as a plain function so
// the animated style can call it from a worklet context.
function interpolateBg(v: number) {
  "worklet";
  // From #1A1A21 → #FF5C1F, roughly.
  const r = Math.round(26 + (255 - 26) * v);
  const g = Math.round(26 + (92 - 26) * v);
  const b = Math.round(33 + (31 - 33) * v);
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
  },
  dockInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: learnColors.surface,
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: learnColors.border,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
  btnWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: learnColors.surfaceRaised,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: learnColors.orange,
  },
});

export default LearnDock;

/**
 * Height (pixels) the dock occupies from the bottom edge, including its own
 * bottom offset. Screens can use this to compute a safe `paddingBottom` for
 * their ScrollView so content never hides behind the floating dock.
 */
export function useLearnDockPadding(extra = 20) {
  const insets = useSafeAreaInsets();
  // 44 button + 12 padding + 8 gap-above-inset + inset + `extra` breathing
  return Math.max(insets.bottom, 12) + 8 + 56 + extra;
}
