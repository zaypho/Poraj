/**
 * Signature bottom-navigation icon set — a premium two-state design:
 *
 *   • INACTIVE → elegant rounded line glyph (crisp 1.9pt stroke)
 *   • ACTIVE   → the same glyph as a SOLID shape filled with the sky-blue
 *                brand gradient, with tiny white "knockout" details inside
 *                (chat dots, mic grill, spark core…) for a hand-crafted,
 *                brand-mark feel — plus a smooth spring pop on activation.
 *
 * Glyphs (all original paths, drawn on a 24×24 grid):
 *   • Chats    → soft round bubble with a lower-left tail + three dots
 *   • Connect  → two friends (duo busts) with a tiny sparkle between them
 *   • Moments  → a rounded four-point "moment spark" with a companion star
 *   • Voice    → studio microphone with grill lines + rounded stand
 *   • Me       → person inside a full circle badge
 */

import React from "react";
import { Animated, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

export interface NavIconProps {
  focused: boolean;
  color: string;
  size?: number;
}

/* Brand gradient used by every ACTIVE glyph (light sky → deep sky). */
const GRAD_FROM = "#4EC4F6";
const GRAD_TO = "#0B8FD6";

function Grad({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={GRAD_FROM} />
        <Stop offset="1" stopColor={GRAD_TO} />
      </LinearGradient>
    </Defs>
  );
}

/** Canvas with a gentle spring-pop when the tab becomes active. */
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
      friction: 5,
      tension: 180,
    }).start();
  }, [focused, anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const lift = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });

  return (
    <View
      style={{
        width: size + 6,
        height: size + 4,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ transform: [{ translateY: lift }, { scale }] }}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {children}
        </Svg>
      </Animated.View>
    </View>
  );
}

/* Shared stroke settings for the INACTIVE (outline) state. */
const SW = 1.9;

/* ── Chats — round bubble, lower-left tail, three dots ─────────────────── */
const BUBBLE_PATH =
  "M12 3.2 C17.1 3.2 21.2 6.8 21.2 11.2 C21.2 15.6 17.1 19.2 12 19.2 " +
  "C11.2 19.2 10.4 19.1 9.7 18.9 C8.4 20.2 6.6 21.2 4.9 21.4 " +
  "C4.4 21.5 4.1 20.9 4.4 20.5 C5.2 19.5 5.7 18.4 5.7 17.2 " +
  "C3.9 15.7 2.8 13.6 2.8 11.2 C2.8 6.8 6.9 3.2 12 3.2 Z";

export function ChatsIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {focused ? (
        <>
          <Grad id="gChats" />
          <Path d={BUBBLE_PATH} fill="url(#gChats)" />
          <Circle cx="8" cy="11.2" r="1.3" fill="#FFFFFF" />
          <Circle cx="12" cy="11.2" r="1.3" fill="#FFFFFF" />
          <Circle cx="16" cy="11.2" r="1.3" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <Path
            d={BUBBLE_PATH}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <Circle cx="8" cy="11.2" r="1.15" fill={color} />
          <Circle cx="12" cy="11.2" r="1.15" fill={color} />
          <Circle cx="16" cy="11.2" r="1.15" fill={color} />
        </>
      )}
    </Shell>
  );
}

/* ── Connect — two friends with a sparkle between them ─────────────────── */
const BACK_BODY =
  "M2.4 19.2 C2.4 15.9 4.4 13.9 7.2 13.9 C8.3 13.9 9.3 14.2 10.1 14.8 " +
  "C8.6 15.9 7.6 17.4 7.3 19.2 Z";
const FRONT_BODY =
  "M8.9 20.6 C8.9 16.6 11.6 14.2 15.3 14.2 C19 14.2 21.7 16.6 21.7 20.6 Z";
const SPARK =
  "M12.6 3.1 C12.95 4.55 13.75 5.35 15.2 5.7 C13.75 6.05 12.95 6.85 12.6 8.3 " +
  "C12.25 6.85 11.45 6.05 10 5.7 C11.45 5.35 12.25 4.55 12.6 3.1 Z";

export function ConnectIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {focused ? (
        <>
          <Grad id="gConnect" />
          {/* back friend */}
          <Circle cx="7.2" cy="9.4" r="2.6" fill="url(#gConnect)" opacity={0.55} />
          <Path d={BACK_BODY} fill="url(#gConnect)" opacity={0.55} />
          {/* front friend */}
          <Circle cx="15.3" cy="9.2" r="3.3" fill="url(#gConnect)" />
          <Path d={FRONT_BODY} fill="url(#gConnect)" />
          {/* connection sparkle */}
          <Path d={SPARK} fill="url(#gConnect)" transform="translate(-8.2 -0.9) scale(0.92)" />
        </>
      ) : (
        <>
          <Circle
            cx="7.2"
            cy="9.4"
            r="2.6"
            fill="none"
            stroke={color}
            strokeWidth={SW * 0.85}
            opacity={0.75}
          />
          <Path
            d={BACK_BODY}
            fill="none"
            stroke={color}
            strokeWidth={SW * 0.85}
            strokeLinejoin="round"
            opacity={0.75}
          />
          <Circle cx="15.3" cy="9.2" r="3.3" fill="none" stroke={color} strokeWidth={SW} />
          <Path
            d={FRONT_BODY}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <Path d={SPARK} fill={color} transform="translate(-8.2 -0.9) scale(0.92)" />
        </>
      )}
    </Shell>
  );
}

/* ── Moments — rounded four-point spark + companion star ───────────────── */
const SPARK_MAIN =
  "M12 3 C13.25 7.7 15.5 9.95 20.2 11.2 C15.5 12.45 13.25 14.7 12 19.4 " +
  "C10.75 14.7 8.5 12.45 3.8 11.2 C8.5 9.95 10.75 7.7 12 3 Z";
const SPARK_MINI =
  "M18.9 15.4 C19.35 17.05 20.35 18.05 22 18.5 C20.35 18.95 19.35 19.95 18.9 21.6 " +
  "C18.45 19.95 17.45 18.95 15.8 18.5 C17.45 18.05 18.45 17.05 18.9 15.4 Z";

export function MomentsIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {focused ? (
        <>
          <Grad id="gMoments" />
          <Path d={SPARK_MAIN} fill="url(#gMoments)" />
          <Circle cx="12" cy="11.2" r="1.5" fill="#FFFFFF" />
          <Path d={SPARK_MINI} fill="url(#gMoments)" />
        </>
      ) : (
        <>
          <Path
            d={SPARK_MAIN}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="11.2" r="1.35" fill={color} />
          <Path d={SPARK_MINI} fill={color} />
        </>
      )}
    </Shell>
  );
}

/* ── Voice — studio microphone with grill + rounded stand ──────────────── */
export function VoiceIcon({ focused, color, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {focused ? (
        <>
          <Grad id="gVoice" />
          <Rect x="8.9" y="2.4" width="6.2" height="11" rx="3.1" fill="url(#gVoice)" />
          {/* white grill lines */}
          <Path d="M10.6 6 H13.4" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
          <Path d="M10.6 8.2 H13.4" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" />
          <Path
            d="M5.7 10.9 A6.3 6.3 0 0 0 18.3 10.9"
            stroke="url(#gVoice)"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M12 17.2 V20"
            stroke="url(#gVoice)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Path
            d="M8.6 20.9 H15.4"
            stroke="url(#gVoice)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Rect
            x="8.9"
            y="2.4"
            width="6.2"
            height="11"
            rx="3.1"
            fill="none"
            stroke={color}
            strokeWidth={SW}
          />
          <Path
            d="M5.7 10.9 A6.3 6.3 0 0 0 18.3 10.9"
            stroke={color}
            strokeWidth={SW}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M12 17.2 V20" stroke={color} strokeWidth={SW} strokeLinecap="round" />
          <Path d="M8.6 20.9 H15.4" stroke={color} strokeWidth={SW} strokeLinecap="round" />
        </>
      )}
    </Shell>
  );
}

/* ── Me — person inside a full circle badge ────────────────────────────── */
const ME_SHOULDERS_FILL =
  "M12 14.1 C8.7 14.1 6.3 15.8 5.4 18.4 C7.1 20.15 9.4 21.2 12 21.2 " +
  "C14.6 21.2 16.9 20.15 18.6 18.4 C17.7 15.8 15.3 14.1 12 14.1 Z";
const ME_SHOULDERS_LINE =
  "M5.9 18.8 C7 16 9.3 14.5 12 14.5 C14.7 14.5 17 16 18.1 18.8";

export function MeIcon({ color, focused, size }: NavIconProps) {
  return (
    <Shell focused={focused} size={size}>
      {focused ? (
        <>
          <Grad id="gMe" />
          <Circle cx="12" cy="12" r="9.3" fill="url(#gMe)" />
          <Circle cx="12" cy="9.5" r="3.1" fill="#FFFFFF" />
          <Path d={ME_SHOULDERS_FILL} fill="#FFFFFF" />
        </>
      ) : (
        <>
          <Circle cx="12" cy="12" r="9.3" fill="none" stroke={color} strokeWidth={SW} />
          <Circle cx="12" cy="9.4" r="3" fill="none" stroke={color} strokeWidth={SW} />
          <Path
            d={ME_SHOULDERS_LINE}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        </>
      )}
    </Shell>
  );
}
