import React from "react";
import { StyleSheet, View } from "react-native";

import { Avatar } from "@/src/components/Avatar";
import { User } from "@/src/utils/api";

/**
 * WhatsApp-style collage avatar for group chats: shows up to 4 member
 * photos arranged inside one circle (used when no custom group photo).
 */
export const GroupAvatar: React.FC<{
  members: User[];
  size?: number;
  testID?: string;
}> = ({ members, size = 54, testID }) => {
  const ms = members.slice(0, 12);
  const small = Math.round(size * 0.52);
  const tiny = Math.round(size * 0.44);
  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {ms.length <= 1 ? (
        <Avatar name={ms[0]?.name} url={ms[0]?.avatar_url} size={size} />
      ) : ms.length === 2 ? (
        <>
          <View style={{ position: "absolute", top: 0, left: 0 }}>
            <Avatar name={ms[0]?.name} url={ms[0]?.avatar_url} size={small} />
          </View>
          <View style={{ position: "absolute", bottom: 0, right: 0 }}>
            <Avatar name={ms[1]?.name} url={ms[1]?.avatar_url} size={small} />
          </View>
        </>
      ) : ms.length <= 4 ? (
        <>
          <View style={{ position: "absolute", top: 0, alignSelf: "center" }}>
            <Avatar name={ms[0]?.name} url={ms[0]?.avatar_url} size={tiny} />
          </View>
          <View style={{ position: "absolute", bottom: 0, left: 0 }}>
            <Avatar name={ms[1]?.name} url={ms[1]?.avatar_url} size={tiny} />
          </View>
          <View style={{ position: "absolute", bottom: 0, right: 0 }}>
            <Avatar name={ms[2]?.name} url={ms[2]?.avatar_url} size={tiny} />
          </View>
        </>
      ) : (
        // 5+ members: mini mosaic — up to 12 small photos around the circle
        <View style={styles.grid}>
          {ms.slice(0, 12).map((m, i) => (
            <Avatar
              key={m.id || i}
              name={m.name}
              url={m.avatar_url}
              size={Math.max(10, Math.round(size / 3.6))}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "visible",
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
});
