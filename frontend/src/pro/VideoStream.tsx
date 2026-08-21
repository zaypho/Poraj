// Native video renderer — uses react-native-webrtc's RTCView when the native
// module is present (production/dev builds). In Expo Go (module absent) it
// renders an empty view and the parent screen shows an avatar placeholder.
import React from "react";
import { Platform, View } from "react-native";

let RTCView: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RTCView = require("react-native-webrtc").RTCView;
  } catch {
    RTCView = null;
  }
}

export function VideoStream({
  stream,
  mirror,
  style,
}: {
  stream?: unknown;
  muted?: boolean;
  mirror?: boolean;
  style?: object;
}) {
  const url =
    stream && typeof (stream as any).toURL === "function"
      ? (stream as any).toURL()
      : null;
  if (RTCView && url) {
    return (
      <RTCView
        streamURL={url}
        style={style}
        objectFit="cover"
        mirror={!!mirror}
        zOrder={0}
      />
    );
  }
  return <View style={style} />;
}
