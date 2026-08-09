/**
 * Custom bottom-navigation icon set — original, hand-drawn SVG glyphs designed
 * specifically for this app's tab bar (Chats / Connect / Moments / Voice / Me).
 *
 * These are NOT from any icon library — every path is authored here — so the
 * navbar has a unique, premium look:
 *   • Inactive  → clean rounded outline in the theme's inactive tint.
 *   • Active    → filled with the brand teal→blue gradient, white inner detail,
 *                 a soft highlight "pill" behind the glyph, and a gentle spring
 *                 pop for a delightful, tactile feel.
 */

import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

const GRAD_A = "#12B5A6"; // teal
const GRAD_B = "#3B82F6"; // blue
const INK = "#FFFFFF"; // inner detail on active (filled) glyphs
const HIGHLIGHT = "rgba(18, 181, 166, 0.14)";

export interface NavIconProps {
  focused: boolean;
  color: string;
  size?: number;
}

/** Shared shell: soft active pill + spring-pop animated SVG canvas. */
function Shell({
  focused,
  size = 26,
  gradId,
  children,
}: {
  focused: boolean;
  size?: number;
  gradId: string;
  children: React.ReactNode;
}) {
  const anim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [focused, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const pillOpacity = anim;
  const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.pill,
          { opacity: pillOpacity, transform: [{ scale: pillScale }] },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={GRAD_A} />
              <Stop offset="1" stopColor={GRAD_B} />
            </LinearGradient>
          </Defs>
          {children}
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────── Chats ─────────────────────────── */
export function ChatsIcon({ focused, color, size }: NavIconProps) {
  const g = "navGradChats";
  const fill = focused ? `url(#${g})` : "none";
  const stroke = focused ? "none" : color;
  const dot = focused ? INK : color;
  return (
    <Shell focused={focused} size={size} gradId={g}>
      <Path
        d="M6.5 4 H17.5 A4.5 4.5 0 0 1 22 8.5 V12 A4.5 4.5 0 0 1 17.5 16.5 H12.6 L8 20 V16.5 H6.5 A4.5 4.5 0 0 1 2 12 V8.5 A4.5 4.5 0 0 1 6.5 4 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx="8.3" cy="10.2" r="1.25" fill={dot} />
      <Circle cx="12" cy="10.2" r="1.25" fill={dot} />
      <Circle cx="15.7" cy="10.2" r="1.25" fill={dot} />
    </Shell>
  );
}

/* ────────────────────────── Connect ────────────────────────── */
export function ConnectIcon({ focused, color, size }: NavIconProps) {
  const g = "navGradConnect";
  const line = focused ? `url(#${g})` : color;
  const nodeFill = focused ? `url(#${g})` : "none";
  const nodeStroke = focused ? "none" : color;
  return (
    <Shell focused={focused} size={size} gradId={g}>
      <Line x1="11.4" y1="6.4" x2="6" y2="15.4" stroke={line} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1="12.6" y1="6.4" x2="18" y2="15.4" stroke={line} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1="7" y1="16.8" x2="17" y2="16.8" stroke={line} strokeWidth={1.9} strokeLinecap="round" />
      <Circle cx="12" cy="5" r="2.9" fill={nodeFill} stroke={nodeStroke} strokeWidth={2} />
      <Circle cx="5" cy="16.8" r="2.9" fill={nodeFill} stroke={nodeStroke} strokeWidth={2} />
      <Circle cx="19" cy="16.8" r="2.9" fill={nodeFill} stroke={nodeStroke} strokeWidth={2} />
    </Shell>
  );
}

/* ────────────────────────── Moments ────────────────────────── */
export function MomentsIcon({ focused, color, size }: NavIconProps) {
  const g = "navGradMoments";
  const planetFill = focused ? `url(#${g})` : "none";
  const planetStroke = focused ? "none" : color;
  const ring = focused ? `url(#${g})` : color;
  const dot = focused ? `url(#${g})` : color;
  return (
    <Shell focused={focused} size={size} gradId={g}>
      <Ellipse
        cx="12"
        cy="12"
        rx="10.3"
        ry="4"
        stroke={ring}
        strokeWidth={1.8}
        fill="none"
        transform="rotate(-24 12 12)"
      />
      <Circle cx="12" cy="12" r="5.1" fill={planetFill} stroke={planetStroke} strokeWidth={2} />
      {focused ? <Circle cx="10.2" cy="10.2" r="1.5" fill={INK} opacity={0.85} /> : null}
      <Circle cx="20.4" cy="8.1" r="1.15" fill={dot} />
    </Shell>
  );
}

/* ─────────────────────────── Voice ─────────────────────────── */
export function VoiceIcon({ focused, color, size }: NavIconProps) {
  const g = "navGradVoice";
  const capFill = focused ? `url(#${g})` : "none";
  const capStroke = focused ? "none" : color;
  const line = focused ? `url(#${g})` : color;
  return (
    <Shell focused={focused} size={size} gradId={g}>
      <Rect x="9" y="2.5" width="6" height="10.5" rx="3" fill={capFill} stroke={capStroke} strokeWidth={2} />
      <Path d="M5.5 11 A6.5 6.5 0 0 0 18.5 11" stroke={line} strokeWidth={1.9} fill="none" strokeLinecap="round" />
      <Line x1="12" y1="17.5" x2="12" y2="20.6" stroke={line} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1="8.6" y1="20.8" x2="15.4" y2="20.8" stroke={line} strokeWidth={1.9} strokeLinecap="round" />
    </Shell>
  );
}

/* ──────────────────────────── Me ───────────────────────────── */
export function MeIcon({ focused, color, size }: NavIconProps) {
  const g = "navGradMe";
  const frameFill = focused ? `url(#${g})` : "none";
  const frameStroke = focused ? "none" : color;
  const person = focused ? INK : color;
  return (
    <Shell focused={focused} size={size} gradId={g}>
      <Rect x="3" y="3" width="18" height="18" rx="6.5" fill={frameFill} stroke={frameStroke} strokeWidth={2} />
      <Circle cx="12" cy="10" r="2.8" fill={focused ? person : "none"} stroke={person} strokeWidth={focused ? 0 : 1.9} />
      <Path
        d="M7 18.2 A5.4 5.4 0 0 1 17 18.2"
        fill="none"
        stroke={person}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Shell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 52,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: HIGHLIGHT,
  },
});
