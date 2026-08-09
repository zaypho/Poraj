/**
 * NoNetworkIcon — the "WiFi arcs with a purple X" glyph used across
 * empty / disconnected states.
 *
 * Rendered from primitives (Ionicons + a filled circle) so it inherits
 * the current theme colors and stays crisp at any size.
 */

import { Ionicons } from "@/src/ui/icons";
import React from "react";
import { View, StyleSheet } from "react-native";

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

export const NoNetworkIcon: React.FC<Props> = ({
  size = 80,
  color = "#94A3B8",
  accentColor = "#059669",
}) => {
  const bubble = Math.round(size * 0.42);
  return (
    <View
      style={[
        styles.wrap,
        { width: size + bubble * 0.5, height: size },
      ]}
    >
      <Ionicons name="wifi" size={size} color={color} />
      <View
        style={[
          styles.bubble,
          {
            width: bubble,
            height: bubble,
            borderRadius: bubble / 2,
            backgroundColor: accentColor,
            right: 0,
            top: -bubble * 0.15,
          },
        ]}
      >
        <Ionicons name="close" size={bubble * 0.65} color="#FFFFFF" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
