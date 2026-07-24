import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts, radius, spacing } from "@/src/theme";
import { audioUrl } from "@/src/utils/api";

interface VoiceBubbleProps {
  audioId: string;
  durationMs?: number | null;
  mine?: boolean;
  testID?: string;
}

const BAR_COUNT = 20;
const SPEEDS = [1, 1.5, 2];
const PURPLE = "#7B61FF";
const PURPLE_LIGHT = "#CDBEF6";

const fmt = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
};

// Deterministic pseudo-random bar heights derived from the audio id, so each
// voice message keeps a consistent waveform shape across renders.
const barHeights = (seed: string): number[] => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const r = (h % 1000) / 1000;
    out.push(7 + Math.round(r * 17)); // 7..24 px
  }
  return out;
};

export const VoiceBubble: React.FC<VoiceBubbleProps> = ({
  audioId,
  durationMs,
  testID,
}) => {
  const player = useAudioPlayer(audioUrl(audioId));
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = React.useState(0);
  const bars = React.useMemo(() => barHeights(audioId), [audioId]);

  const totalSec =
    status.duration > 0 ? status.duration : (durationMs || 0) / 1000;
  const curSec = status.currentTime || 0;
  const progress = totalSec > 0 ? Math.min(1, curSec / totalSec) : 0;
  const playing = status.playing;
  // Countdown: while playing show the remaining time, otherwise the full length.
  const shownSec = playing ? Math.max(0, totalSec - curSec) : totalSec;
  const filled = Math.round(progress * BAR_COUNT);

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      if (status.didJustFinish || curSec >= totalSec - 0.1) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    const rate = SPEEDS[next];
    try {
      // expo-audio: setPlaybackRate(rate, pitchCorrectionQuality)
      (player as unknown as {
        setPlaybackRate?: (r: number, q: string) => void;
      }).setPlaybackRate?.(rate, "high");
    } catch {
      try {
        (player as unknown as { playbackRate?: number }).playbackRate = rate;
      } catch {
        /* noop */
      }
    }
  };

  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        testID={testID ? `${testID}-play` : undefined}
        onPress={toggle}
        hitSlop={10}
        style={styles.playBtn}
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={playing ? 24 : 28}
          color={PURPLE}
        />
      </Pressable>
      <View style={styles.wave}>
        {bars.map((hgt, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: hgt,
                backgroundColor: i < filled ? PURPLE : PURPLE_LIGHT,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.right}>
        <Pressable onPress={cycleSpeed} hitSlop={6} style={styles.speedPill}>
          <Text style={styles.speedText}>{SPEEDS[speedIdx].toFixed(1)}x</Text>
        </Pressable>
        <Text style={styles.dur}>{fmt(shownSec)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 210,
    paddingVertical: 2,
  },
  playBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  wave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 28,
    flexShrink: 1,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  right: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginLeft: spacing.xs,
  },
  speedPill: {
    backgroundColor: "#E7E0FA",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 46,
    alignItems: "center",
  },
  speedText: {
    fontFamily: fonts.textBold,
    fontSize: 13,
    color: PURPLE,
  },
  dur: {
    fontFamily: fonts.textSemi,
    fontSize: 12,
    color: "#9AA0A6",
  },
});
