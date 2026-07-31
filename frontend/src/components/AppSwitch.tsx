import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

/**
 * iOS-style pill switch used everywhere in the app (reference design):
 * rounded track (purple when on, soft grey when off) + white round thumb.
 * Drop-in replacement for react-native's Switch.
 */
export const AppSwitch: React.FC<{
  value: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
  trackColor?: { true?: string; false?: string };
  thumbColor?: string; // accepted for API compat; thumb stays white
}> = ({ value, onValueChange, disabled, testID, trackColor }) => {
  const onColor = trackColor?.true || "#059669";
  const offColor = trackColor?.false || "#DDDDE3";
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      hitSlop={6}
      style={[
        styles.track,
        { backgroundColor: value ? onColor : offColor },
        value ? styles.trackOn : styles.trackOff,
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.thumb} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: "center",
  },
  trackOn: {
    alignItems: "flex-end",
  },
  trackOff: {
    alignItems: "flex-start",
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
