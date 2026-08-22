import React from "react";
import type { StyleProp, TextStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

/**
 * The app's signature voice/microphone glyph — a faithful vector recreation of
 * the user's uploaded icon: a soft translucent capsule body with two chunky
 * curved dashes inside, wrapped by a thick rounded U-bracket (no base bar).
 *
 * Shared by the bottom-navigation Voice tab (NavIcons) and every
 * `name="mic" | "microphone" | "voice"` icon across the app, so the mark is
 * identical everywhere.
 */

/** The raw glyph geometry, for embedding in an existing <Svg viewBox="0 0 24 24">. */
export function MicShape({
  color,
  bodyOpacity = 0.45,
}: {
  color: string;
  bodyOpacity?: number;
}) {
  return (
    <>
      {/* capsule body (tinted) */}
      <Rect
        x="5.65"
        y="1.3"
        width="12.7"
        height="17.1"
        rx="6.35"
        fill={color}
        opacity={bodyOpacity}
      />
      {/* two curved dashes */}
      <Path
        d="M9.35 6.6 Q12 4.8 14.65 6.05"
        stroke={color}
        strokeWidth={2.0}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M9.35 9.6 Q12 7.8 14.65 9.05"
        stroke={color}
        strokeWidth={2.0}
        strokeLinecap="round"
        fill="none"
      />
      {/* thick U-bracket cradling the capsule */}
      <Path
        d="M4.1 10.6 V11.7 C4.1 16.25 7.65 19.95 12 19.95 C16.35 19.95 19.9 16.25 19.9 11.7 V10.6"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

export interface MicGlyphProps {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function MicGlyph({
  size = 22,
  color = "#111827",
  style,
  testID,
  accessibilityLabel,
}: MicGlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style as never}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <MicShape color={color} />
    </Svg>
  );
}

/** Muted variant: same mark with a diagonal cut through it. */
export function MicOffGlyph({
  size = 22,
  color = "#111827",
  style,
  testID,
  accessibilityLabel,
}: MicGlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style as never}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <MicShape color={color} bodyOpacity={0.3} />
      <Path
        d="M3.6 20.4 L20.4 3.6"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
