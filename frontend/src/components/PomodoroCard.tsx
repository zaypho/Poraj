/**
 * PomodoroCard — shared study timer shown inside Study voice rooms.
 *
 * State comes from the room document (server is the source of truth); the
 * card only *renders* a live countdown locally. When a running timer crosses
 * zero the client rolls phases forward with the exact same rule the backend
 * uses (focus ⇄ break), so all members stay in sync without polling.
 *
 * Host-only controls: Start/Pause · Skip phase · Reset.
 */

import { Ionicons } from "@/src/ui/icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface PomodoroState {
  phase: "focus" | "break";
  focus_min: number;
  break_min: number;
  running: boolean;
  remaining_sec?: number | null;
  ends_at?: string | null;
}

interface Props {
  pomodoro: PomodoroState;
  isHost: boolean;
  onAction: (action: "start" | "pause" | "reset" | "skip") => void;
}

const derive = (p: PomodoroState): { phase: "focus" | "break"; secs: number } => {
  if (!p.running || !p.ends_at) {
    return {
      phase: p.phase,
      secs: p.remaining_sec ?? p.focus_min * 60,
    };
  }
  let phase = p.phase;
  let end = new Date(p.ends_at).getTime();
  const now = Date.now();
  // Mirror the backend rollover so long-running rooms stay in phase.
  while (end <= now) {
    phase = phase === "focus" ? "break" : "focus";
    end += (phase === "break" ? p.break_min : p.focus_min) * 60 * 1000;
  }
  return { phase, secs: Math.max(0, Math.ceil((end - now) / 1000)) };
};

const fmt = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const PomodoroCard: React.FC<Props> = ({ pomodoro, isHost, onAction }) => {
  const [state, setState] = useState(() => derive(pomodoro));

  useEffect(() => {
    setState(derive(pomodoro));
    if (!pomodoro.running) return;
    const t = setInterval(() => setState(derive(pomodoro)), 1000);
    return () => clearInterval(t);
  }, [pomodoro]);

  const isBreak = state.phase === "break";
  const total = (isBreak ? pomodoro.break_min : pomodoro.focus_min) * 60;
  const progress = total > 0 ? 1 - state.secs / total : 0;

  const phaseColor = isBreak ? "#60A5FA" : "#0E9AE0";

  const styles = useMemo(() => makeStyles(), []);

  return (
    <View style={styles.card} testID="pomodoro-card">
      <View style={styles.topRow}>
        <View style={[styles.phasePill, { backgroundColor: phaseColor }]}>
          <Ionicons
            name={isBreak ? "cafe" : "book"}
            size={12}
            color="#0B1220"
          />
          <Text style={styles.phasePillText}>
            {isBreak ? "Break" : "Focus time"}
          </Text>
        </View>
        <Text style={styles.timer} testID="pomodoro-timer">
          {fmt(state.secs)}
        </Text>
        {isHost ? (
          <View style={styles.controls}>
            <Pressable
              testID="pomodoro-toggle"
              onPress={() => onAction(pomodoro.running ? "pause" : "start")}
              style={styles.ctrlBtn}
              hitSlop={6}
            >
              <Ionicons
                name={pomodoro.running ? "pause" : "play"}
                size={15}
                color="#FFFFFF"
              />
            </Pressable>
            <Pressable
              testID="pomodoro-skip"
              onPress={() => onAction("skip")}
              style={styles.ctrlBtn}
              hitSlop={6}
            >
              <Ionicons name="play-skip-forward" size={14} color="#FFFFFF" />
            </Pressable>
            <Pressable
              testID="pomodoro-reset"
              onPress={() => onAction("reset")}
              style={styles.ctrlBtn}
              hitSlop={6}
            >
              <Ionicons name="refresh" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusWrap}>
            <Text style={styles.statusText}>
              {pomodoro.running ? "In session" : "Paused"}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, Math.max(2, progress * 100))}%`,
              backgroundColor: phaseColor,
            },
          ]}
        />
      </View>
    </View>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    card: {
      marginHorizontal: 14,
      marginBottom: 8,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.28)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    phasePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    phasePillText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#0B1220",
    },
    timer: {
      flex: 1,
      color: "#FFFFFF",
      fontSize: 24,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      letterSpacing: 1,
    },
    controls: {
      flexDirection: "row",
      gap: 6,
    },
    ctrlBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    statusWrap: {
      paddingHorizontal: 8,
    },
    statusText: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 11,
      fontWeight: "700",
    },
    track: {
      height: 5,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.16)",
      overflow: "hidden",
    },
    fill: {
      height: 5,
      borderRadius: 3,
    },
  });
