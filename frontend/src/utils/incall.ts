import { Platform } from "react-native";

// react-native-incall-manager — native-only audio session control (speaker vs
// earpiece routing, proximity sensor, audio focus). Gracefully absent on web
// and in Expo Go; every call is a safe no-op there.
let InCall: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    InCall = require("react-native-incall-manager").default;
  } catch {
    InCall = null;
  }
}

export const audioSession = {
  /** Begin an audio session. `speaker` = route to loudspeaker (voice rooms). */
  start(speaker: boolean) {
    try {
      InCall?.start({ media: "audio" });
      InCall?.setForceSpeakerphoneOn(speaker);
    } catch {
      /* no-op */
    }
  },
  setSpeaker(on: boolean) {
    try {
      InCall?.setForceSpeakerphoneOn(on);
    } catch {
      /* no-op */
    }
  },
  stop() {
    try {
      InCall?.setForceSpeakerphoneOn(false);
      InCall?.stop();
    } catch {
      /* no-op */
    }
  },
};
