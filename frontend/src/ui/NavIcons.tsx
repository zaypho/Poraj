/**
 * Bottom-navigation icon set — bold, friendly SOLID glyphs matching the
 * reference screenshots:
 *
 *   • Chats    → solid round bubble with a small fin tail at the lower-left
 *   • Connect  → two overlapping person silhouettes (back-left small, front-right big)
 *   • Moments  → a solid Saturn / planet whose thin ring pokes out as ears
 *   • Voice    → solid microphone (capsule + U-bracket + stand)
 *   • Me       → solid person bust
 *
 * Every glyph is a single-colour SOLID fill using whatever `color` the tab bar
 * passes in (brand tint when active, muted tint when inactive). Shapes are drawn
 * chunky so they read as bold at small sizes, in both light and dark mode.
 */

import React from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

export interface NavIconProps {
  focused: boolean;
  color: string;
  size?: number;
}

/** Thin canvas with a gentle spring-pop when the tab becomes active. */
function Shell({
  focused,
  size = 26,
  children,
}: {
  focused: boolean;
  size?: number;
  children: React.ReactNode;
}) {
  const anim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 160,
    }).start();
  }, [focused, anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View
      style={{
        width: size + 6,
        height: size + 4,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {children}
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────── Chats (bubble + fin tail) ────────────────── */
export function ChatsIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {/* small fin tail at the lower-left */}
      <Path
        d="M9 15.3 C7.7 17.7 6.05 19.2 4.35 19.95 C4.05 20.08 3.8 19.75 3.98 19.48 C5.05 17.9 5.6 16.3 5.45 14.45 Z"
        fill={color}
      />
      {/* bold round bubble body */}
      <Circle cx="13.3" cy="10.2" r="7.4" fill={color} />
    </Shell>
  );
}

/* ─────────────────────────── Connect (two people) ────────────────────── */
export function ConnectIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {/* back person (left, smaller + higher) */}
      <Circle cx="8.2" cy="8" r="2.7" fill={color} />
      <Path
        d="M3.6 18 C3.6 14.8 5.6 12.9 8.2 12.9 C10.8 12.9 12.8 14.8 12.8 18 Z"
        fill={color}
      />
      {/* front person (right, bigger — drawn on top) */}
      <Circle cx="15.4" cy="9" r="3.3" fill={color} />
      <Path
        d="M9.2 19.6 C9.2 15.7 11.8 13.4 15.4 13.4 C19 13.4 21.4 15.7 21.4 19.6 Z"
        fill={color}
      />
    </Shell>
  );
}

/* ─────────────────────────── Moments (Saturn / planet) ────────────────── */
export function MomentsIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {/* ring first (behind) — only its tips show past the planet as "ears" */}
      <G transform="rotate(-25 12 11.6)">
        <Ellipse
          cx="12"
          cy="11.6"
          rx="9.9"
          ry="3.1"
          fill="none"
          stroke={color}
          strokeWidth={2.6}
        />
      </G>
      {/* solid planet on top hides the ring's middle */}
      <Circle cx="12" cy="11" r="6.3" fill={color} />
    </Shell>
  );
}

/* ─────────────────────────── Voice (microphone) ──────────────────────── */
export function VoiceIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      <Rect x="9" y="2.6" width="6" height="10" rx="3" fill={color} />
      <Path
        d="M6 11 A6 6 0 0 0 18 11"
        stroke={color}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="16.6"
        x2="12"
        y2="20.4"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Line
        x1="8.6"
        y1="20.6"
        x2="15.4"
        y2="20.6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Shell>
  );
}

/* ─────────────────────────── Me (person bust) ────────────────────────── */
export function MeIcon({ color, focused, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      <Circle cx="12" cy="7.7" r="3.9" fill={color} />
      <Path
        d="M4.2 20.6 C4.2 15.7 7.5 13.2 12 13.2 C16.5 13.2 19.8 15.7 19.8 20.6 Z"
        fill={color}
      />
    </Shell>
  );
}
