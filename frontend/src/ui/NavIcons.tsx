/**
 * Custom bottom-navigation icon set — original hand-drawn SVG glyphs in a clean,
 * flat, friendly style (inspired by the reference the user shared):
 *
 *   • Inactive → thin rounded OUTLINE in the theme's muted tint.
 *   • Active   → SOLID fill in the brand (teal) tint with crisp white inner
 *                detail. No gradients, no background pill — just a clean, bold
 *                filled glyph, exactly like the reference navbar.
 *
 * The active/inactive colour is whatever the tab bar passes in (`color`), so it
 * always matches the current theme (light + dark).
 */

import React from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

const INK = "#FFFFFF"; // inner detail drawn on top of a filled (active) glyph
const SW = 1.9; // outline stroke width

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
    <View style={{ width: size + 6, height: size + 4, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {children}
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────── Chats (speech bubble + dots) ─────────────── */
export function ChatsIcon({ focused, color, size }: NavIconProps) {
  const fill = focused ? color : "none";
  const stroke = focused ? "none" : color;
  const dot = focused ? INK : color;
  return (
    <Shell focused={focused} size={size}>
      <Path
        d="M12 4 C17.1 4 21 7.3 21 11.4 C21 15.5 17.1 18.8 12 18.8 C11 18.8 10.1 18.7 9.2 18.5 C8 19.4 6.4 20 4.8 20 C5.6 19.1 6.1 17.9 6.1 16.7 C4.2 15.4 3 13.5 3 11.4 C3 7.3 6.9 4 12 4 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Circle cx="8.2" cy="11.3" r="1.25" fill={dot} />
      <Circle cx="12" cy="11.3" r="1.25" fill={dot} />
      <Circle cx="15.8" cy="11.3" r="1.25" fill={dot} />
    </Shell>
  );
}

/* ─────────────────────────── Connect (two people) ────────────────────── */
export function ConnectIcon({ focused, color, size }: NavIconProps) {
  const fill = focused ? color : "none";
  const stroke = focused ? "none" : color;
  return (
    <Shell focused={focused} size={size}>
      {/* two heads */}
      <Circle cx="8" cy="8.6" r="2.5" fill={fill} stroke={stroke} strokeWidth={SW} />
      <Circle cx="16" cy="8.6" r="2.5" fill={fill} stroke={stroke} strokeWidth={SW} />
      {/* overlapping shoulders → reads as a small group */}
      <Path
        d="M3.6 18.8 C3.6 15.5 5.6 13.7 8 13.7 C10.4 13.7 12.4 15.5 12.4 18.8 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Path
        d="M11.6 18.8 C11.6 15.5 13.6 13.7 16 13.7 C18.4 13.7 20.4 15.5 20.4 18.8 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Shell>
  );
}

/* ─────────────────────────── Moments (Discover: circle + leaf) ────────── */
export function MomentsIcon({ focused, color, size }: NavIconProps) {
  const discFill = focused ? color : "none";
  const discStroke = focused ? "none" : color;
  const leaf = focused ? INK : color;
  return (
    <Shell focused={focused} size={size}>
      <Circle cx="12" cy="12" r="8.4" fill={discFill} stroke={discStroke} strokeWidth={SW} />
      <Path
        d="M9 15 C9 11.7 11.7 9 15 9 C15 12.3 12.3 15 9 15 Z"
        fill={leaf}
      />
    </Shell>
  );
}

/* ─────────────────────────── Voice (mic) ─────────────────────────────── */
export function VoiceIcon({ focused, color, size }: NavIconProps) {
  const capFill = focused ? color : "none";
  const capStroke = focused ? "none" : color;
  const line = color;
  return (
    <Shell focused={focused} size={size}>
      <Rect x="9" y="3" width="6" height="9.6" rx="3" fill={capFill} stroke={capStroke} strokeWidth={SW} />
      <Path d="M6 11.2 A6 6 0 0 0 18 11.2" stroke={line} strokeWidth={SW} fill="none" strokeLinecap="round" />
      <Line x1="12" y1="17.2" x2="12" y2="20.2" stroke={line} strokeWidth={SW} strokeLinecap="round" />
      <Line x1="8.8" y1="20.4" x2="15.2" y2="20.4" stroke={line} strokeWidth={SW} strokeLinecap="round" />
    </Shell>
  );
}

/* ─────────────────────────── Me (person) ─────────────────────────────── */
export function MeIcon({ focused, color, size }: NavIconProps) {
  if (focused) {
    return (
      <Shell focused={focused} size={size}>
        <Circle cx="12" cy="8.3" r="3.3" fill={color} />
        <Path
          d="M5.7 19 C5.7 15.3 8.5 13.4 12 13.4 C15.5 13.4 18.3 15.3 18.3 19 Z"
          fill={color}
        />
      </Shell>
    );
  }
  return (
    <Shell focused={focused} size={size}>
      <Circle cx="12" cy="8.3" r="3.3" fill="none" stroke={color} strokeWidth={SW} />
      <Path
        d="M6 18.8 A6 6 0 0 1 18 18.8"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
      />
    </Shell>
  );
}
