import { Platform } from "react-native";

/**
 * Real microphone/stream loudness meter used for active-speaker detection.
 *
 * On web we tap the MediaStream with a Web Audio AnalyserNode (works for both
 * local and remote streams in every modern browser). On native there is no Web
 * Audio, so callers fall back to `readStats()` audio levels from getStats.
 */
export interface LevelMeter {
  /** Current RMS loudness, 0..1. */
  level: () => number;
  stop: () => void;
}

export const createLevelMeter = (stream: any): LevelMeter | null => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC || !stream?.getAudioTracks || stream.getAudioTracks().length === 0) {
    return null;
  }
  try {
    const ctx = new AC();
    if (ctx.state === "suspended") ctx.resume?.();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    return {
      level: () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        return Math.sqrt(sum / buf.length);
      },
      stop: () => {
        try {
          source.disconnect();
          analyser.disconnect();
          ctx.close?.();
        } catch {
          // already torn down
        }
      },
    };
  } catch {
    return null;
  }
};

/** Loudness above which a participant counts as actively speaking. */
export const SPEAKING_THRESHOLD_WEB = 0.045;
export const SPEAKING_THRESHOLD_STATS = 0.02;
/** Keep the speaking flag on briefly so it doesn't flicker between syllables. */
export const SPEAKING_HOLD_MS = 700;
