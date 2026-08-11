/**
 * Bottom-navigation icon set — the classic, friendly SOLID glyph style that
 * matches the reference screenshot 1:1:
 *
 *   • Chats    → filled round speech bubble with a small bottom-left tail
 *   • Connect  → two overlapping filled person silhouettes (front-left bigger)
 *   • Moments  → a filled Saturn / planet whose thin ring pokes out as ears
 *                (ring drawn BEHIND the planet, so it never crosses the face)
 *   • Voice    → filled microphone (capsule + U-bracket + stand)
 *   • Me       → filled person bust
 *
 * Every glyph is a single-colour SOLID fill using whatever `color` the tab bar
 * passes in (brand tint when active, muted tint when inactive), so it always
 * matches the current theme in both light and dark mode.
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

/* ─────────────────────────── Chats (round speech bubble) ──────────────── */
export function ChatsIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      <Path
        d="M12 3.4 C6.85 3.4 3 6.75 3 10.9 C3 13.05 4.05 14.95 5.75 16.3 C5.9 17.8 5.35 19.2 4.25 20.3 C4.05 20.5 4.2 20.83 4.48 20.78 C6.25 20.5 7.85 19.75 9.05 18.5 C9.98 18.76 10.97 18.9 12 18.9 C17.15 18.9 21 15.05 21 10.9 C21 6.75 17.15 3.4 12 3.4 Z"
        fill={color}
      />
    </Shell>
  );
}

/* ─────────────────────────── Connect (two people) ────────────────────── */
export function ConnectIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {/* back person (offset up-right, slightly smaller) */}
      <Circle cx="15.7" cy="8.1" r="2.5" fill={color} />
      <Path
        d="M11.6 17.9 C11.6 14.9 13.35 13 15.7 13 C18.05 13 20.3 14.9 20.3 17.9 Z"
        fill={color}
      />
      {/* front person (drawn on top, left + bigger) */}
      <Circle cx="8.6" cy="9" r="3.1" fill={color} />
      <Path
        d="M3 19.4 C3 15.75 5.35 13.6 8.6 13.6 C11.85 13.6 14.2 15.75 14.2 19.4 Z"
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
          rx="9.7"
          ry="3"
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      </G>
      {/* solid planet on top hides the ring's middle */}
      <Circle cx="12" cy="11" r="6" fill={color} />
    </Shell>
  );
}

/* ─────────────────────────── Voice (microphone) ──────────────────────── */
export function VoiceIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      <Rect x="9.3" y="3" width="5.4" height="9.6" rx="2.7" fill={color} />
      <Path
        d="M6.3 10.8 A5.7 5.7 0 0 0 17.7 10.8"
        stroke={color}
        strokeWidth={1.9}
        fill="none"
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="16.5"
        x2="12"
        y2="20.2"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Line
        x1="8.8"
        y1="20.4"
        x2="15.2"
        y2="20.4"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Shell>
  );
}

/* ─────────────────────────── Me (person bust) ────────────────────────── */
export function MeIcon({ color, focused, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      <Circle cx="12" cy="7.9" r="3.7" fill={color} />
      <Path
        d="M4.5 20.4 C4.5 15.8 7.65 13.4 12 13.4 C16.35 13.4 19.5 15.8 19.5 20.4 Z"
        fill={color}
      />
    </Shell>
  );
}
