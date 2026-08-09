import { Ionicons } from "@/src/ui/icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { FlagIcon } from "@/src/components/FlagIcon";
import { fonts, radius, spacing } from "@/src/theme";
import { api } from "@/src/utils/api";

interface DailyPhrase {
  lang: string;
  lang_name: string;
  text: string;
  roman?: string | null;
  meaning: string;
  category: string;
  date: string;
}

interface DailyPhraseCardProps {
  /** Preferred language code (user's first learning language). */
  lang?: string | null;
}

/** Gradient "Phrase of the Day" card shown at the top of Connect. */
export const DailyPhraseCard: React.FC<DailyPhraseCardProps> = ({ lang }) => {
  const [phrase, setPhrase] = useState<DailyPhrase | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    setRevealed(false);
    api
      .get<DailyPhrase>(`/phrases/daily${lang ? `?lang=${lang}` : ""}`)
      .then((p) => active && setPhrase(p))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lang]);

  if (!phrase) return null;

  return (
    <Animated.View entering={FadeIn.duration(350)}>
      <LinearGradient
        colors={["#38BDF8", "#6366F1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
        testID="daily-phrase-card"
      >
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            <Ionicons name="sparkles" size={13} color="#FDE68A" />
            <Text style={styles.title}>PHRASE OF THE DAY</Text>
          </View>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>{phrase.category}</Text>
          </View>
          <FlagIcon code={phrase.lang} size={20} />
        </View>

        <Text style={styles.phrase}>{phrase.text}</Text>
        {phrase.roman ? <Text style={styles.roman}>{phrase.roman}</Text> : null}

        {revealed ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.meaningRow}>
            <Ionicons name="bulb" size={14} color="#FDE68A" />
            <Text style={styles.meaning}>{phrase.meaning}</Text>
          </Animated.View>
        ) : (
          <Pressable
            testID="daily-phrase-reveal-btn"
            style={styles.revealBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setRevealed(true);
            }}
          >
            <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
            <Text style={styles.revealText}>Tap to reveal meaning</Text>
          </Pressable>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  title: {
    fontFamily: fonts.textBold,
    fontSize: 11,
    letterSpacing: 1,
    color: "rgba(255,255,255,0.85)",
  },
  categoryPill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: fonts.textBold,
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  phrase: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 28,
    color: "#FFFFFF",
  },
  roman: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.75)",
    marginTop: -4,
  },
  meaningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  meaning: {
    flex: 1,
    fontFamily: fonts.textSemi,
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  revealText: {
    fontFamily: fonts.textBold,
    fontSize: 12.5,
    color: "#FFFFFF",
  },
});
