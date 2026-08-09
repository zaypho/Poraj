import { Ionicons } from "@/src/ui/icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { lessonColors, lessonFonts } from "@/src/lessons/theme";

interface Props {
  streak: number;
  gems: number;
  hearts: number;
  flag?: string;
  showExit?: boolean;
}

// Top status strip shared across the Lessons tabs.
export function LessonsTopBar({ streak, gems, hearts, flag = "es", showExit }: Props) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <View style={styles.flagWrap}>
        <Text style={styles.flagText}>{flag.toUpperCase()}</Text>
      </View>
      <View style={styles.stats}>
        <Stat icon="flame" color={lessonColors.streak} value={streak} testID="lessons-streak" />
        <Stat icon="diamond" color={lessonColors.gem} value={gems} testID="lessons-gems" />
        <Stat icon="heart" color={lessonColors.heart} value={hearts} testID="lessons-hearts" />
      </View>
      {showExit ? (
        <Pressable testID="lessons-exit" onPress={() => router.replace("/(tabs)/chats")} style={styles.exit} hitSlop={8}>
          <Ionicons name="close" size={20} color={lessonColors.inkSoft} />
        </Pressable>
      ) : (
        <View style={{ width: 8 }} />
      )}
    </View>
  );
}

function Stat({ icon, color, value, testID }: { icon: any; color: string; value: number; testID?: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statText, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 10, gap: 12 },
  flagWrap: { width: 40, height: 30, borderRadius: 8, backgroundColor: lessonColors.blueSoft, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: lessonColors.blue },
  flagText: { fontFamily: lessonFonts.black, fontSize: 12, color: lessonColors.blue },
  stats: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: { fontFamily: lessonFonts.black, fontSize: 16 },
  exit: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
