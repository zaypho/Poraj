import * as Clipboard from "expo-clipboard";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Avatar } from "@/src/components/Avatar";
import { BackButton } from "@/src/components/BackButton";
import { MessageReactionsPopup, MsgMenuAction } from "@/src/components/MessageReactionsPopup";
import { RoomMomentCard } from "@/src/components/RoomMomentCard";
import { VoiceBubble } from "@/src/components/VoiceBubble";
import { countryToCode } from "@/src/constants/countries";
import { langName } from "@/src/constants/languages";
import { useAuth } from "@/src/context/AuthContext";
import { useCall } from "@/src/context/CallContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useChatSocket } from "@/src/hooks/use-chat-socket";
import { fonts, radius, spacing, ThemeColors } from "@/src/theme";
import { premiumThemeColors } from "@/src/premium/theme";
import { api, Conversation, Message, mediaUrl } from "@/src/utils/api";
import { clockTime } from "@/src/utils/time";

/** RN-web's Alert.alert is a no-op — use window.alert on web so users always see feedback. */
const notify = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const zodiacFor = (birthday?: string | null): string => {
  if (!birthday) return "";
  const parts = birthday.split("-");
  if (parts.length < 3) return "";
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!m || !d) return "";
  const table: [string, number, number][] = [
    ["Capricorn", 1, 19], ["Aquarius", 2, 18], ["Pisces", 3, 20],
    ["Aries", 4, 19], ["Taurus", 5, 20], ["Gemini", 6, 20],
    ["Cancer", 7, 22], ["Leo", 8, 22], ["Virgo", 9, 22],
    ["Libra", 10, 22], ["Scorpio", 11, 21], ["Sagittarius", 12, 21],
    ["Capricorn", 12, 31],
  ];
  const [name, , maxDay] = table[m - 1];
  return d <= maxDay ? name : table[m % 12][0];
};

const dateSeparator = (iso: string): string => {
  const d = dayjs(iso);
  const now = dayjs();
  const t = d.format("HH:mm");
  if (d.isSame(now, "day")) return `Today ${t}`;
  if (d.isSame(now.subtract(1, "day"), "day")) return `Yesterday ${t}`;
  return `${d.format("MMM D")} ${t}`;
};

const sameDay = (a?: string, b?: string): boolean =>
  !!a && !!b && dayjs(a).isSame(dayjs(b), "day");

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const QUICK_EMOJIS = [
  "😊", "😂", "❤️", "👍", "🙏", "😍", "🎉", "😅",
  "🤔", "😢", "🔥", "✨", "🥰", "😎", "👋", "🙌",
  "💯", "😘", "🤗", "😴", "🎂", "☕", "🌟", "😇",
];

const QUICK_TEMPLATES = [
  "Hi! How are you? 😊",
  "Nice to meet you!",
  "Where are you from?",
  "Let's practice languages together!",
  "What are your hobbies?",
  "Sorry, I was busy earlier 🙏",
  "Have a great day! 🌟",
];

const TOPIC_PROMPTS = [
  "How has the internet changed the way we work?",
  "Do you prefer to watch movies alone or with others?",
  "Do you think all information on the internet is true?",
  "Do you like traveling? Where would you go next?",
  "What's a food from your country I should try?",
  "What are you learning these days?",
  "Tell me about a festival in your country.",
  "What's your favorite way to relax?",
];

const CHAT_GIFTS = [
  { key: "highfive", name: "High Five", emoji: "🙌", coins: 1 },
  { key: "rose", name: "Rose", emoji: "🌹", coins: 10 },
  { key: "heart", name: "Heart", emoji: "💖", coins: 20 },
  { key: "star", name: "Star", emoji: "⭐", coins: 30 },
  { key: "cake", name: "Cake", emoji: "🎂", coins: 50 },
  { key: "crown", name: "Crown", emoji: "👑", coins: 100 },
  { key: "sakura", name: "Sakura", emoji: "🌸", coins: 199 },
  { key: "diamond", name: "Diamond", emoji: "💎", coins: 299 },
  { key: "rocket", name: "Rocket", emoji: "🚀", coins: 599 },
];

const EMOJI_GRID = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
  "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
  "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪",
  "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟",
  "😢", "😭", "😤", "😠", "😡", "🤯", "😳", "🥺",
  "😴", "🤗", "🤔", "🤭", "🤫", "🙄", "😬", "😰",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "👋", "🤝",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔",
  "🔥", "✨", "🎉", "🎊", "💯", "⭐", "🌟", "💫",
];

export default function ChatScreen() {
  const { id, premium } = useLocalSearchParams<{ id: string; premium?: string }>();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { colors: themeColors } = useTheme();
  // When the chat is opened from the Premium Club, render the exact same
  // screen in the royal-purple + gold palette so the experience feels premium.
  const isPremium = premium === "1";
  const colors = isPremium ? premiumThemeColors : themeColors;
  const { startCall } = useCall();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [fullPartner, setFullPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<
    Record<string, { corrected: string; explanation: string }>
  >({});
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [draftFixing, setDraftFixing] = useState(false);
  const [draftHint, setDraftHint] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<
    null | "attach" | "emoji" | "phrases" | "gift" | "translate"
  >(null);
  const [phraseTab, setPhraseTab] = useState<"used" | "topics">("used");
  const [customPhrases, setCustomPhrases] = useState<string[]>([]);
  const [giftTab, setGiftTab] = useState<"gift" | "vip" | "card">("gift");
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [trTo, setTrTo] = useState<string>("en");
  const [trInput, setTrInput] = useState("");
  const [trResult, setTrResult] = useState<string | null>(null);
  const [trLoading, setTrLoading] = useState(false);
  // Reaction popup state — anchor is measured on long press so we can point
  // the picker to the exact bubble on-screen (Instagram-style).
  const [reactionMsg, setReactionMsg] = useState<Message | null>(null);
  const [reactionAnchor, setReactionAnchor] = useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);
  const bubbleRefs = useRef<Record<string, View | null>>({});
  // Multi-select mode (from the message action sheet).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Manual correction composer (user hand-corrects a message — HelloTalk style).
  const [correctingMsg, setCorrectingMsg] = useState<Message | null>(null);
  const [correctDraft, setCorrectDraft] = useState("");
  const [correctNote, setCorrectNote] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  // Keeps the list pinned to the newest message. True until the reader
  // scrolls up to browse history, so we never yank them back down.
  const stickToEnd = useRef(true);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const [conv, msgs] = await Promise.all([
          api.get<Conversation>(`/chats/${id}`),
          api.get<Message[]>(`/chats/${id}/messages`),
        ]);
        if (!active) return;
        setConversation(conv);
        setMessages(msgs);
        if (conv?.partner?.id) {
          api
            .get<User>(`/users/${conv.partner.id}`)
            .then((p) => active && setFullPartner(p))
            .catch(() => {});
        }
        api.post(`/chats/${id}/read`).catch(() => {});
      } catch {
        // auth not ready or network error — will retry on next focus
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id, user]);

  useChatSocket(
    useCallback(
      (event) => {
        if (event.type === "new_message" && event.conversation_id === id && event.message) {
          const msg = event.message as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
          api.post(`/chats/${id}/read`).catch(() => {});
        }
        if (
          event.type === "message_reaction" &&
          event.conversation_id === id &&
          event.message
        ) {
          const updated = event.message as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, reactions: updated.reactions } : m)),
          );
        }
        if (
          event.type === "messages_deleted" &&
          event.conversation_id === id &&
          Array.isArray(event.ids)
        ) {
          const ids = event.ids as string[];
          setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
        }
        if (
          event.type === "message_update" &&
          event.conversation_id === id &&
          event.message
        ) {
          const updated = event.message as Message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, pinned: updated.pinned, manual_correction: updated.manual_correction, transcript: updated.transcript }
                : m,
            ),
          );
        }
      },
      [id],
    ),
  );

  // Open reaction picker anchored to the tapped bubble.
  const openReactionPopup = (msg: Message) => {
    const node = bubbleRefs.current[msg.id];
    if (!node) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // measureInWindow gives screen-space coordinates → perfect for a fullscreen Modal.
    (node as any).measureInWindow?.(
      (x: number, y: number, width: number, height: number) => {
        setReactionAnchor({ x, y, width, height });
        setReactionMsg(msg);
      },
    );
  };

  const myReactionFor = (msg: Message): string | undefined => {
    if (!user) return undefined;
    return msg.reactions?.find((r) => r.user_ids.includes(user.id))?.emoji;
  };

  const toggleReaction = async (emoji: string) => {
    if (!reactionMsg) return;
    const target = reactionMsg;
    setReactionMsg(null);
    setReactionAnchor(null);
    // Optimistic update so the bubble reacts instantly.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== target.id) return m;
        const uid = user?.id || "";
        const currentEmoji = m.reactions?.find((r) => r.user_ids.includes(uid))?.emoji;
        const cleared = (m.reactions || [])
          .map((r) => ({ ...r, user_ids: r.user_ids.filter((x) => x !== uid), count: r.user_ids.filter((x) => x !== uid).length }))
          .filter((r) => r.count > 0);
        if (currentEmoji === emoji) {
          return { ...m, reactions: cleared };
        }
        const existing = cleared.find((r) => r.emoji === emoji);
        const next = existing
          ? cleared.map((r) =>
              r.emoji === emoji ? { ...r, user_ids: [...r.user_ids, uid], count: r.count + 1 } : r,
            )
          : [...cleared, { emoji, user_ids: [uid], count: 1 }];
        return { ...m, reactions: next };
      }),
    );
    try {
      await api.post(`/chats/${id}/messages/${target.id}/react`, { emoji });
    } catch (e) {
      // Rollback would be complex; refetch instead.
      try {
        const msgs = await api.get<Message[]>(`/chats/${id}/messages`);
        setMessages(msgs);
      } catch {}
    }
  };

  const patchMessage = (msgId: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...patch } : m)));
  };

  const readAloud = (msg: Message) => {
    const text = (msg.transcript || msg.text || "").trim();
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { rate: 0.95 });
    Haptics.selectionAsync().catch(() => {});
  };

  const transcribeVoice = async (msg: Message) => {
    if (!msg.audio_id || transcribing) return;
    if (msg.transcript) {
      // Already transcribed — toggle the caption off.
      patchMessage(msg.id, { transcript: null });
      return;
    }
    setTranscribing(msg.id);
    try {
      const res = await api.post<{ text: string }>("/ai/transcribe", {
        audio_id: msg.audio_id,
      });
      patchMessage(msg.id, { transcript: res.text || "(no speech detected)" });
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      notify(
        "Voice to text",
        e instanceof Error ? e.message : "Could not transcribe this voice message.",
      );
    } finally {
      setTranscribing(null);
    }
  };

  const toggleSave = async (msg: Message, kind: "saved" | "practice") => {
    if (!user) return;
    const field = kind === "practice" ? "practice_by" : "saved_by";
    const list = (msg[field] as string[]) || [];
    const active = list.includes(user.id);
    // Optimistic update.
    patchMessage(msg.id, {
      [field]: active ? list.filter((x) => x !== user.id) : [...list, user.id],
    } as Partial<Message>);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await api.post(`/chats/${id}/messages/${msg.id}/save`, { kind });
    } catch {
      // Revert on failure.
      patchMessage(msg.id, { [field]: list } as Partial<Message>);
    }
  };

  const togglePin = async (msg: Message) => {
    const next = !msg.pinned;
    patchMessage(msg.id, { pinned: next });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const res = await api.post<Message>(`/chats/${id}/messages/${msg.id}/pin`);
      patchMessage(msg.id, { pinned: res.pinned });
    } catch {
      patchMessage(msg.id, { pinned: msg.pinned });
    }
  };

  const openManualCorrection = (msg: Message) => {
    setCorrectingMsg(msg);
    setCorrectDraft(msg.manual_correction?.corrected || msg.text || "");
    setCorrectNote(msg.manual_correction?.note || "");
  };

  const submitManualCorrection = async () => {
    if (!correctingMsg) return;
    const corrected = correctDraft.trim();
    if (!corrected) return;
    setSavingCorrection(true);
    try {
      const res = await api.post<Message>(
        `/chats/${id}/messages/${correctingMsg.id}/correction`,
        { corrected, note: correctNote.trim() || undefined },
      );
      patchMessage(correctingMsg.id, { manual_correction: res.manual_correction });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCorrectingMsg(null);
      setCorrectDraft("");
      setCorrectNote("");
    } catch (e) {
      notify("Correction", e instanceof Error ? e.message : "Could not save correction.");
    } finally {
      setSavingCorrection(false);
    }
  };

  const enterSelectMode = (msg: Message) => {
    setSelectMode(true);
    setSelectedIds([msg.id]);
    setPanel(null);
  };

  const addPhrase = () => {
    const text = draft.trim();
    if (!text) {
      notify("Add a phrase", "Type a phrase in the message box first, then tap Add a phrase.");
      return;
    }
    setCustomPhrases((prev) => (prev.includes(text) ? prev : [text, ...prev]));
    Haptics.selectionAsync().catch(() => {});
  };

  const sendGiftMessage = async () => {
    const gift = CHAT_GIFTS.find((g) => g.key === selectedGift);
    if (!gift || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const msg = await api.post<Message>(`/chats/${id}/messages`, {
        text: `${gift.emoji} ${gift.name}`,
      });
      stickToEnd.current = true;
      setMessages((prev) => [...prev, msg]);
      setPanel(null);
      setSelectedGift(null);
    } catch (e) {
      notify("Gift", e instanceof Error ? e.message : "Could not send the gift.");
    } finally {
      setSending(false);
    }
  };

  const runPanelTranslate = async () => {
    const text = trInput.trim();
    if (!text || trLoading) return;
    setTrLoading(true);
    setTrResult(null);
    try {
      const res = await api.post<{ translated: string }>("/ai/translate", {
        text,
        target_language: trTo,
      });
      setTrResult(res.translated);
    } catch (e) {
      notify("Translate", e instanceof Error ? e.message : "Translation failed.");
    } finally {
      setTrLoading(false);
    }
  };

  const toggleSelect = (msgId: string) => {
    setSelectedIds((prev) =>
      prev.includes(msgId) ? prev.filter((x) => x !== msgId) : [...prev, msgId],
    );
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };

  const copySelected = async () => {
    const texts = messages
      .filter((m) => selectedIds.includes(m.id) && m.text)
      .map((m) => m.text);
    if (texts.length) {
      await Clipboard.setStringAsync(texts.join("\n"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    exitSelectMode();
  };

  const deleteSelected = () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const doDelete = async () => {
      setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
      exitSelectMode();
      try {
        await api.post(`/chats/${id}/messages/delete`, { ids });
      } catch {
        // best-effort; reload on failure
        try {
          const msgs = await api.get<Message[]>(`/chats/${id}/messages`);
          setMessages(msgs);
        } catch {}
      }
    };
    if (Platform.OS === "web") {
      doDelete();
    } else {
      Alert.alert("Delete messages", `Delete ${ids.length} message(s)?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleMsgAction = async (action: MsgMenuAction) => {
    if (!reactionMsg) return;
    const target = reactionMsg;
    setReactionMsg(null);
    setReactionAnchor(null);
    switch (action) {
      case "reply": {
        const quoted = target.text ? `↳ ${target.text.slice(0, 80)}\n` : "";
        setDraft((d) => (d.startsWith(quoted) ? d : quoted + d));
        break;
      }
      case "copy":
        if (target.text) {
          await Clipboard.setStringAsync(target.text);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        break;
      case "readAloud":
        readAloud(target);
        break;
      case "save":
        toggleSave(target, "saved");
        break;
      case "translate":
        translate(target);
        break;
      case "aiCorrect":
        correctMessage(target);
        break;
      case "correct":
        openManualCorrection(target);
        break;
      case "practice":
        toggleSave(target, "practice");
        break;
      case "pin":
        togglePin(target);
        break;
      case "multiSelect":
        enterSelectMode(target);
        break;
      case "recall":
        recallMessage(target);
        break;
      case "delete":
        deleteSelectedById([target.id]);
        break;
    }
  };

  const recallMessage = (msg: Message) => {
    const doRecall = async () => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      try {
        await api.post(`/chats/${id}/messages/delete`, { ids: [msg.id] });
      } catch {}
    };
    if (Platform.OS === "web") {
      doRecall();
    } else {
      Alert.alert("Recall message", "Recall (unsend) this message for everyone?", [
        { text: "Cancel", style: "cancel" },
        { text: "Recall", style: "destructive", onPress: doRecall },
      ]);
    }
  };

  const deleteSelectedById = (ids: string[]) => {
    const doDelete = async () => {
      setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
      try {
        await api.post(`/chats/${id}/messages/delete`, { ids });
      } catch {}
    };
    if (Platform.OS === "web") {
      doDelete();
    } else {
      Alert.alert("Delete message", "Delete this message?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  useEffect(() => {
    if (messages.length > 0 && stickToEnd.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const msg = await api.post<Message>(`/chats/${id}/messages`, { text });
      stickToEnd.current = true;
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      let perm = await AudioModule.getRecordingPermissionsAsync();
      if (!perm.granted) {
        perm = await AudioModule.requestRecordingPermissionsAsync();
      }
      if (!perm.granted) {
        if (Platform.OS !== "web" && !perm.canAskAgain) {
          Alert.alert(
            "Microphone",
            "Microphone access is disabled. Enable it in Settings to send voice messages.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          notify(
            "Microphone",
            "Microphone permission is needed to record voice messages. Please allow microphone access and try again.",
          );
        }
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordSeconds(0);
      setRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      setRecording(false);
      notify(
        "Microphone",
        "Could not start recording. Make sure a microphone is available and allowed, then try again.",
      );
    }
  };

  const cancelRecording = async () => {
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    setRecording(false);
  };

  const encodeAudio = async (uri: string): Promise<string> => {
    if (Platform.OS === "web") {
      const blob = await fetch(uri).then((r) => r.blob());
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  };

  const sendVoice = async () => {
    const durationMs = recordSeconds * 1000;
    setRecording(false);
    setUploadingVoice(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording");
      const base64 = await encodeAudio(uri);
      const mime = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
      const msg = await api.post<Message>(`/chats/${id}/voice`, {
        audio_base64: base64,
        mime,
        duration_ms: Math.max(durationMs, 1000),
      });
      stickToEnd.current = true;
      setMessages((prev) => [...prev, msg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      notify("Voice message", "Could not send the voice message. Try again.");
    } finally {
      setUploadingVoice(false);
    }
  };

  const pickImage = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!current.granted) {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert(
            "Photos",
            "Photo access is disabled. Enable it in Settings to share photos.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert("Photos", "Photo access is needed to share images in chat.");
        }
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    setUploadingImage(true);
    try {
      const msg = await api.post<Message>(`/chats/${id}/image`, {
        image_base64: asset.base64,
        mime: asset.mimeType || "image/jpeg",
      });
      stickToEnd.current = true;
      setMessages((prev) => [...prev, msg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      notify("Photo", "Could not send the photo. Try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const translate = async (msg: Message) => {
    if (translations[msg.id]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    setTranslating(msg.id);
    try {
      const result = await api.post<{ translated: string }>("/ai/translate", {
        text: msg.text,
        target_language: user?.native_language || "en",
      });
      setTranslations((prev) => ({ ...prev, [msg.id]: result.translated }));
    } catch (e) {
      notify(
        "Translate",
        e instanceof Error ? e.message : "Translation failed. Try again.",
      );
    } finally {
      setTranslating(null);
    }
  };

  const correctMessage = async (msg: Message) => {
    if (corrections[msg.id]) {
      setCorrections((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    setCorrecting(msg.id);
    try {
      const res = await api.post<{ corrected: string; explanation: string }>(
        "/ai/correct",
        { text: msg.text },
      );
      setCorrections((prev) => ({ ...prev, [msg.id]: res }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      notify(
        "Correction",
        e instanceof Error ? e.message : "Correction failed. Try again.",
      );
    } finally {
      setCorrecting(null);
    }
  };

  const fixDraft = async () => {
    const text = draft.trim();
    if (!text || draftFixing) return;
    setDraftFixing(true);
    try {
      const res = await api.post<{ corrected: string; explanation: string }>(
        "/ai/correct",
        { text },
      );
      if (res.corrected && res.corrected !== text) {
        setDraft(res.corrected);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setDraftHint(res.explanation || "Looks perfect!");
      setTimeout(() => setDraftHint(null), 6000);
    } catch (e) {
      notify(
        "AI Check",
        e instanceof Error ? e.message : "Could not check the text. Try again.",
      );
    } finally {
      setDraftFixing(false);
    }
  };

  const partner = conversation?.partner;

  const momentsHidden = !!(
    partner?.id && (user?.hidden_moment_users || []).includes(partner.id)
  );
  const isBlocked = !!(
    partner?.id && (user?.blocked_users || []).includes(partner.id)
  );

  const toggleMuteChat = async () => {
    try {
      const res = await api.post<{ muted: boolean }>(`/chats/${id}/mute`);
      setConversation((prev) => (prev ? { ...prev, muted: res.muted } : prev));
    } catch {
      // ignore
    }
  };

  const toggleHideMoments = async () => {
    if (!partner?.id) return;
    try {
      const res = await api.post<{ hidden: boolean }>(
        `/users/${partner.id}/hide-moments`,
      );
      if (user) {
        const list = user.hidden_moment_users || [];
        setUser({
          ...user,
          hidden_moment_users: res.hidden
            ? [...list, partner.id]
            : list.filter((x) => x !== partner.id),
        });
      }
    } catch {
      // ignore
    }
  };

  const toggleBlock = () => {
    if (!partner?.id) return;
    const doToggle = async () => {
      try {
        const res = await api.post<{ blocked: boolean }>(
          `/users/${partner.id}/block`,
        );
        if (user) {
          const list = user.blocked_users || [];
          setUser({
            ...user,
            blocked_users: res.blocked
              ? [...list, partner.id]
              : list.filter((x) => x !== partner.id),
          });
        }
        setMenuOpen(false);
      } catch {
        // ignore
      }
    };
    if (isBlocked) {
      doToggle();
    } else {
      Alert.alert(
        "Block user",
        `${partner.name} won't be able to message you anymore.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: doToggle },
        ],
      );
    }
  };

  const clearHistory = () => {
    Alert.alert("Clear chat history", "All messages will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/chats/${id}/messages`);
            setMessages([]);
            setMenuOpen(false);
          } catch {
            // ignore
          }
        },
      },
    ]);
  };

  const info = fullPartner || partner;
  const chips: { icon?: IconName; iconColor?: string; label: string }[] = [];
  if (info) {
    const z = zodiacFor(info.birthday);
    if (z) chips.push({ icon: "planet", iconColor: "#8B5CF6", label: z });
    if (info.blood_type)
      chips.push({ icon: "water", iconColor: "#EF4444", label: info.blood_type });
    if (info.mbti) chips.push({ label: info.mbti });
    (info.interests || []).slice(0, 6).forEach((i) => chips.push({ label: i }));
    if (info.hometown) chips.push({ label: info.hometown });
    if (info.places_to_go) chips.push({ label: info.places_to_go });
  }

  const partnerCard = partner ? (
    <Pressable
      testID="chat-intro-card"
      style={styles.partnerCard}
      onPress={() => router.push(`/user/${partner.id}`)}
    >
      <View style={styles.partnerTop}>
        <Avatar
          name={partner.name}
          url={partner.avatar_url}
          size={56}
          flagCode={countryToCode(partner.country)}
          online={partner.is_online}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.partnerNameRow}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partner.name}
            </Text>
            {partner.gender ? (
              <View
                style={[
                  styles.genderPill,
                  { backgroundColor: partner.gender === "female" ? "#EC4899" : "#3B82F6" },
                ]}
              >
                <Ionicons
                  name={partner.gender === "female" ? "female" : "male"}
                  size={11}
                  color="#FFFFFF"
                />
                {partner.age ? (
                  <Text style={styles.genderPillText}>{partner.age}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <Text style={styles.partnerSub}>
            Native {langName(partner.native_language)} · Learning{" "}
            {langName(partner.learning_language)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
      </View>
      {partner.bio ? (
        <Text style={styles.partnerBio} numberOfLines={2}>
          {partner.bio}
        </Text>
      ) : null}
      {chips.length > 0 ? (
        <View style={styles.chipsWrap}>
          {chips.map((c, i) => (
            <View key={`${c.label}-${i}`} style={styles.introChip}>
              {c.icon ? (
                <Ionicons name={c.icon} size={12} color={c.iconColor} />
              ) : null}
              <Text style={styles.introChipText}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="chat-screen">
      {isPremium && <StatusBar style="light" />}
      <View style={styles.header}>
        <BackButton testID="chat-back-btn" />
        {partner && (
          <>
            <Pressable
              testID="chat-partner-header"
              style={styles.headerInfo}
              onPress={() => router.push(`/user/${partner.id}`)}
            >
              <Text style={styles.headerName} numberOfLines={1}>
                {partner.name}
              </Text>
              <Text style={styles.headerStatus}>
                {partner.is_online ? "Active now" : "Offline"}
              </Text>
            </Pressable>
            <Pressable
              testID="chat-call-btn"
              style={styles.headerIconBtn}
              onPress={() => startCall(partner)}
            >
              <Ionicons name="call-outline" size={22} color={colors.onSurface} />
            </Pressable>
            <Pressable
              testID="chat-menu-btn"
              style={styles.headerIconBtn}
              onPress={() => setMenuOpen(true)}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={colors.onSurface}
              />
            </Pressable>
          </>
        )}
      </View>

      {selectMode && (
        <View style={styles.selectBar} testID="chat-select-bar">
          <Pressable testID="select-cancel" onPress={exitSelectMode} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.selectCount}>{selectedIds.length} selected</Text>
          <Pressable testID="select-copy" style={styles.selectAction} onPress={copySelected}>
            <Ionicons name="copy-outline" size={20} color={colors.brand} />
            <Text style={styles.selectActionText}>Copy</Text>
          </Pressable>
          <Pressable testID="select-delete" style={styles.selectAction} onPress={deleteSelected}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.selectActionText, { color: colors.error }]}>Delete</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{partner?.name}</Text>
              <Pressable
                testID="chat-menu-close-btn"
                onPress={() => setMenuOpen(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            <Pressable
              testID="chat-menu-profile"
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                if (partner?.id) router.push(`/user/${partner.id}`);
              }}
            >
              <Ionicons name="person-circle-outline" size={22} color={colors.brand} />
              <Text style={styles.menuText}>View profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
            </Pressable>
            <Pressable
              testID="chat-menu-mute"
              style={styles.menuRow}
              onPress={toggleMuteChat}
            >
              <Ionicons
                name={conversation?.muted ? "notifications-off" : "notifications-outline"}
                size={21}
                color={colors.brand}
              />
              <Text style={styles.menuText}>
                {conversation?.muted ? "Unmute notifications" : "Mute notifications"}
              </Text>
              <View style={[styles.menuToggle, conversation?.muted && styles.menuToggleOn]}>
                <View style={[styles.menuThumb, conversation?.muted && styles.menuThumbOn]} />
              </View>
            </Pressable>
            <Pressable
              testID="chat-menu-hide-moments"
              style={styles.menuRow}
              onPress={toggleHideMoments}
            >
              <Ionicons
                name={momentsHidden ? "eye-off" : "eye-off-outline"}
                size={21}
                color={colors.brand}
              />
              <Text style={styles.menuText}>
                {momentsHidden ? "Show their Moments" : "Hide their Moments"}
              </Text>
              <View style={[styles.menuToggle, momentsHidden && styles.menuToggleOn]}>
                <View style={[styles.menuThumb, momentsHidden && styles.menuThumbOn]} />
              </View>
            </Pressable>
            <Pressable
              testID="chat-menu-clear"
              style={styles.menuRow}
              onPress={clearHistory}
            >
              <Ionicons name="trash-outline" size={21} color={colors.brand} />
              <Text style={styles.menuText}>Clear chat history</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
            </Pressable>
            <Pressable
              testID="chat-menu-block"
              style={styles.menuRow}
              onPress={toggleBlock}
            >
              <Ionicons name="ban" size={21} color={colors.error} />
              <Text style={[styles.menuText, { color: colors.error }]}>
                {isBlocked ? "Unblock user" : "Block user"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "web" ? undefined : "translate-with-padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListHeaderComponent={partnerCard}
            onContentSizeChange={() => {
              // Fires whenever bubbles/avatars/images finish measuring, so
              // the chat reliably opens pinned to the newest message.
              if (stickToEnd.current) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } =
                e.nativeEvent;
              const distanceFromBottom =
                contentSize.height -
                layoutMeasurement.height -
                contentOffset.y;
              // Reading history? Stop auto-snapping until back near the end.
              stickToEnd.current = distanceFromBottom < 120;
            }}
            scrollEventThrottle={32}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="hand-left-outline" size={48} color={colors.borderStrong} />
                <Text style={styles.emptyText}>
                  Say hello to {partner?.name?.split(" ")[0]}!
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const mine = item.sender_id === user?.id;
              const translated = translations[item.id];
              const correction = corrections[item.id];
              const isVoice = item.type === "voice" && item.audio_id;
              const isImage = item.type === "image" && item.image_id;
              const isRoomShare = item.type === "room" && item.room;
              const prev = messages[index - 1];
              const showDate = !prev || !sameDay(prev.created_at, item.created_at);
              // Avatar grouping (WhatsApp/HelloTalk style): the partner's avatar
              // is shown only on the FIRST message of a consecutive run from the
              // same sender. Subsequent messages in that run leave a spacer so
              // the bubbles stay aligned. A new day or a switch of sender starts
              // a fresh group and shows the avatar again.
              const showAvatar =
                !mine && (!prev || prev.sender_id !== item.sender_id || showDate);
              // Only the most recent partner (received) message gets the side
              // translate / transcribe affordance — matches HelloTalk's UX
              // where the icon lives next to the newest incoming reply.
              const isLastPartnerMsg = (() => {
                if (mine) return false;
                for (let i = messages.length - 1; i > index; i -= 1) {
                  if (messages[i].sender_id !== user?.id) return false;
                }
                return true;
              })();
              const setBubbleRef = (node: View | null) => {
                bubbleRefs.current[item.id] = node;
              };
              const openReactions = () => openReactionPopup(item);
              const selected = selectedIds.includes(item.id);
              const onBubblePress = () => {
                if (selectMode) toggleSelect(item.id);
              };
              return (
                <>
                  {showDate && (
                    <Text style={styles.dateSep}>
                      {dateSeparator(item.created_at)}
                    </Text>
                  )}
                  {isRoomShare ? (
                    <View style={styles.roomShareRow}>
                      <Pressable
                        ref={setBubbleRef}
                        onLongPress={openReactions}
                        delayLongPress={220}
                        style={styles.roomShareBubble}
                      >
                        <RoomMomentCard
                          testID={`room-share-${item.id}`}
                          room={item.room!}
                          onPress={() => {
                            if (item.room?.id && item.room?.is_live) {
                              router.push(`/room/${item.room.id}`);
                            }
                          }}
                        />
                        <View style={styles.bubbleFooter}>
                          <Text
                            style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}
                          >
                            {clockTime(item.created_at)}
                          </Text>
                        </View>
                        {item.reactions && item.reactions.length > 0 && (
                          <View
                            style={[
                              styles.reactionBadgeRow,
                              mine ? styles.reactionBadgeMine : styles.reactionBadgeTheirs,
                            ]}
                          >
                            {item.reactions.map((r) => (
                              <View key={r.emoji} style={styles.reactionBadge}>
                                <Text style={styles.reactionBadgeEmoji}>{r.emoji}</Text>
                                {r.count > 1 && (
                                  <Text style={styles.reactionBadgeCount}>{r.count}</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                  <View
                    style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
                  >
                    {!mine &&
                      (showAvatar ? (
                        <Avatar
                          name={partner?.name || ""}
                          url={partner?.avatar_url}
                          size={32}
                          flagCode={countryToCode(partner?.country)}
                        />
                      ) : (
                        <View style={styles.avatarSpacer} />
                      ))}
                    <Pressable
                      ref={setBubbleRef}
                      onLongPress={openReactions}
                      onPress={onBubblePress}
                      delayLongPress={220}
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                        selected && styles.bubbleSelected,
                      ]}
                    >
                    {isVoice ? (
                      <VoiceBubble
                        testID={`voice-bubble-${item.id}`}
                        audioId={item.audio_id!}
                        durationMs={item.duration_ms}
                        mine={mine}
                      />
                    ) : isImage ? (
                      <Image
                        testID={`image-bubble-${item.id}`}
                        source={{ uri: mediaUrl(item.image_id!) }}
                        style={styles.imageBubble}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <Text
                        style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                      >
                        {item.text}
                      </Text>
                    )}
                    {item.transcript ? (
                      <View style={styles.translationBox}>
                        <View style={styles.correctionHeader}>
                          <Ionicons
                            name="mic"
                            size={11}
                            color={colors.brand}
                          />
                          <Text
                            style={[
                              styles.manualLabel,
                              mine && { color: colors.onSurfaceSecondary },
                            ]}
                          >
                            Voice to text
                          </Text>
                        </View>
                        <Text
                          style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                        >
                          {item.transcript}
                        </Text>
                      </View>
                    ) : null}
                    {translated && (
                      <View style={styles.translationBox}>
                        <Text
                          style={[
                            styles.translationText,
                            mine && styles.bubbleTextMine,
                          ]}
                        >
                          {translated}
                        </Text>
                      </View>
                    )}
                    {correction && (
                      <View style={styles.correctionBox}>
                        <View style={styles.correctionHeader}>
                          <Ionicons
                            name="school"
                            size={12}
                            color={colors.success}
                          />
                          <Text
                            style={[
                              styles.correctionLabel,
                              mine && { color: colors.onSurfaceSecondary },
                            ]}
                          >
                            Corrected
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.correctionText,
                            mine && styles.bubbleTextMine,
                          ]}
                        >
                          {correction.corrected === item.text
                            ? "✓ No mistakes found"
                            : correction.corrected}
                        </Text>
                        {correction.explanation ? (
                          <Text
                            style={[
                              styles.correctionExplain,
                              mine && { color: colors.onSurfaceSecondary },
                            ]}
                          >
                            {correction.explanation}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    {item.manual_correction && (
                      <View style={styles.manualBox}>
                        <View style={styles.correctionHeader}>
                          <Ionicons
                            name="create"
                            size={12}
                            color={colors.brand}
                          />
                          <Text
                            style={[
                              styles.manualLabel,
                              mine && { color: colors.brand },
                            ]}
                          >
                            Correction · {item.manual_correction.by_name}
                          </Text>
                        </View>
                        <Text
                          style={[styles.manualText, mine && styles.bubbleTextMine]}
                        >
                          {item.manual_correction.corrected}
                        </Text>
                        {item.manual_correction.note ? (
                          <Text
                            style={[
                              styles.correctionExplain,
                              mine && { color: colors.onSurfaceSecondary },
                            ]}
                          >
                            {item.manual_correction.note}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    <View style={styles.bubbleFooter}>
                      {item.pinned && (
                        <MaterialCommunityIcons
                          name="pin"
                          size={12}
                          color={colors.brand}
                          style={{ transform: [{ rotate: "45deg" }] }}
                        />
                      )}
                      <Text
                        style={[
                          styles.bubbleTime,
                          mine && styles.bubbleTimeMine,
                          { marginRight: "auto" },
                        ]}
                      >
                        {clockTime(item.created_at)}
                      </Text>
                    </View>
                    {item.reactions && item.reactions.length > 0 && (
                      <View
                        style={[
                          styles.reactionBadgeRow,
                          mine ? styles.reactionBadgeMine : styles.reactionBadgeTheirs,
                        ]}
                      >
                        {item.reactions.map((r) => (
                          <View key={r.emoji} style={styles.reactionBadge}>
                            <Text style={styles.reactionBadgeEmoji}>{r.emoji}</Text>
                            {r.count > 1 && (
                              <Text style={styles.reactionBadgeCount}>{r.count}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                    {!mine && !selectMode && (isVoice || (!isImage && !!item.text && isLastPartnerMsg)) && (
                      <View style={styles.sideCol}>
                        {isVoice ? (
                          <Pressable
                            testID={`transcribe-btn-${item.id}`}
                            style={[styles.sideBtn, item.transcript && styles.sideBtnActive]}
                            onPress={() => transcribeVoice(item)}
                            hitSlop={6}
                          >
                            {transcribing === item.id ? (
                              <ActivityIndicator size="small" color={colors.brand} />
                            ) : (
                              <View style={styles.micWrap}>
                                <Ionicons
                                  name="mic"
                                  size={17}
                                  color={item.transcript ? colors.brand : colors.onSurface}
                                />
                                <Text style={styles.micA}>A</Text>
                              </View>
                            )}
                          </Pressable>
                        ) : (
                          <Pressable
                            testID={`side-translate-btn-${item.id}`}
                            style={[styles.sideBtn, translated && styles.sideBtnActive]}
                            onPress={() => translate(item)}
                            hitSlop={6}
                          >
                            {translating === item.id ? (
                              <ActivityIndicator size="small" color={colors.brand} />
                            ) : (
                              <Text
                                style={[
                                  styles.sideGlyph,
                                  { color: translated ? colors.brand : colors.onSurface },
                                ]}
                              >
                                文A
                              </Text>
                            )}
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                  )}
                </>
              );
            }}
          />
        )}

        {recording ? (
          <View style={styles.recordingBar} testID="recording-bar">
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTime}>
              0:{recordSeconds.toString().padStart(2, "0")}
            </Text>
            <Text style={styles.recordingHint}>Recording voice message...</Text>
            <Pressable
              testID="recording-cancel-btn"
              onPress={cancelRecording}
              style={styles.recordCancel}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
            </Pressable>
            <Pressable
              testID="recording-send-btn"
              onPress={sendVoice}
              style={styles.recordSend}
            >
              <Ionicons name="send" size={18} color={colors.onBrand} />
            </Pressable>
          </View>
        ) : (
          <>
            {draftHint && (
              <View style={styles.hintBar} testID="draft-hint-bar">
                <Ionicons name="sparkles" size={14} color={colors.brand} />
                <Text style={styles.hintText}>{draftHint}</Text>
                <Pressable onPress={() => setDraftHint(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
                </Pressable>
              </View>
            )}
          <View style={styles.inputArea}>
            <View style={styles.inputRow}>
              <View style={styles.inputPill}>
                <TextInput
                  testID="chat-message-input"
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.onSurfaceSecondary}
                  selectionColor={colors.brand}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => setPanel(null)}
                  multiline
                />
              </View>
              {draft.trim() ? (
                <Pressable
                  testID="chat-send-btn"
                  onPress={send}
                  style={[styles.sendBtn, sending && { opacity: 0.4 }]}
                  disabled={sending}
                >
                  <Ionicons name="send" size={18} color={colors.onBrand} />
                </Pressable>
              ) : (
                <Pressable
                  testID="chat-record-btn"
                  onPress={startRecording}
                  style={[styles.micBtn, uploadingVoice && { opacity: 0.4 }]}
                  disabled={uploadingVoice}
                  hitSlop={6}
                >
                  {uploadingVoice ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <Ionicons name="mic-outline" size={24} color={colors.onSurfaceSecondary} />
                  )}
                </Pressable>
              )}
            </View>
            <View style={styles.toolbarRow}>
              <Pressable
                testID="chat-add-btn"
                onPress={() => setPanel((p) => (p === "attach" ? null : "attach"))}
                style={styles.toolIcon}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={26}
                  color={panel === "attach" ? colors.brand : colors.onSurface}
                />
              </Pressable>
              <Pressable
                testID="chat-media-btn"
                onPress={pickImage}
                style={[styles.toolIcon, uploadingImage && { opacity: 0.4 }]}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Ionicons name="image-outline" size={24} color={colors.onSurface} />
                )}
              </Pressable>
              <Pressable
                testID="tool-emoji"
                onPress={() => setPanel((p) => (p === "emoji" ? null : "emoji"))}
                style={styles.toolIcon}
              >
                <Ionicons
                  name="happy-outline"
                  size={24}
                  color={panel === "emoji" ? colors.brand : colors.onSurface}
                />
              </Pressable>
              <Pressable
                testID="tool-gift"
                onPress={() => setPanel((p) => (p === "gift" ? null : "gift"))}
                style={styles.toolIcon}
              >
                <Ionicons
                  name="gift-outline"
                  size={24}
                  color={panel === "gift" ? colors.brand : colors.onSurface}
                />
              </Pressable>
              <Pressable
                testID="tool-translate"
                onPress={() => setPanel((p) => (p === "translate" ? null : "translate"))}
                style={styles.toolIcon}
              >
                <Text style={[styles.translateGlyph, panel === "translate" && { color: colors.brand }]}>文A</Text>
              </Pressable>
              <Pressable
                testID="tool-templates"
                onPress={() => setPanel((p) => (p === "phrases" ? null : "phrases"))}
                style={styles.toolIcon}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={24}
                  color={panel === "phrases" ? colors.brand : colors.onSurface}
                />
              </Pressable>
            </View>
            {panel === "emoji" && (
              <ScrollView
                style={styles.emojiGridWrap}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.emojiGrid}>
                  {EMOJI_GRID.map((e, i) => (
                    <Pressable
                      key={`${e}-${i}`}
                      testID={`emoji-${e}`}
                      style={styles.emojiGridItem}
                      onPress={() => setDraft((d) => d + e)}
                    >
                      <Text style={styles.emojiGridText}>{e}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
            {panel === "phrases" && (
              <View style={styles.phrasesPanel}>
                <View style={styles.phraseTabs}>
                  <Pressable
                    testID="phrase-tab-used"
                    style={[styles.phraseTab, phraseTab === "used" && styles.phraseTabActive]}
                    onPress={() => setPhraseTab("used")}
                  >
                    <Text style={[styles.phraseTabText, phraseTab === "used" && styles.phraseTabTextActive]}>
                      Most Used
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="phrase-tab-topics"
                    style={[styles.phraseTab, phraseTab === "topics" && styles.phraseTabActive]}
                    onPress={() => setPhraseTab("topics")}
                  >
                    <Text style={[styles.phraseTabText, phraseTab === "topics" && styles.phraseTabTextActive]}>
                      Topics
                    </Text>
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.phraseList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {(phraseTab === "used"
                    ? [...customPhrases, ...QUICK_TEMPLATES]
                    : TOPIC_PROMPTS
                  ).map((t, i) => (
                    <Pressable
                      key={`${t}-${i}`}
                      testID="phrase-item"
                      style={styles.phrasePill}
                      onPress={() => {
                        setDraft(t);
                        setPanel(null);
                      }}
                    >
                      <Text style={styles.phrasePillText}>{t}</Text>
                    </Pressable>
                  ))}
                  {phraseTab === "used" && (
                    <Pressable testID="phrase-add" style={styles.addPhraseBtn} onPress={addPhrase}>
                      <Ionicons name="add" size={16} color={colors.brand} />
                      <Text style={styles.addPhraseText}>Add a phrase</Text>
                    </Pressable>
                  )}
                </ScrollView>
              </View>
            )}
            {panel === "gift" && (
              <View style={styles.giftPanel}>
                <View style={styles.giftTabs}>
                  {(["gift", "vip", "card"] as const).map((t) => (
                    <Pressable
                      key={t}
                      testID={`gift-tab-${t}`}
                      style={[styles.giftTab, giftTab === t && styles.giftTabActive]}
                      onPress={() => setGiftTab(t)}
                    >
                      <Text style={[styles.giftTabText, giftTab === t && styles.giftTabTextActive]}>
                        {t === "gift" ? "Gift" : t === "vip" ? "VIP" : "Card"}
                      </Text>
                    </Pressable>
                  ))}
                  <View style={styles.coinPill}>
                    <Ionicons name="cash" size={13} color="#F59E0B" />
                    <Text style={styles.coinText}>{user?.coins ?? 0}</Text>
                  </View>
                </View>
                <ScrollView
                  style={styles.giftGridWrap}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.giftGrid}>
                    {CHAT_GIFTS.map((g) => (
                      <Pressable
                        key={g.key}
                        testID={`gift-${g.key}`}
                        style={[styles.giftItem, selectedGift === g.key && styles.giftItemActive]}
                        onPress={() => setSelectedGift(g.key)}
                      >
                        <Text style={styles.giftEmoji}>{g.emoji}</Text>
                        <Text style={styles.giftName} numberOfLines={1}>{g.name}</Text>
                        <View style={styles.giftCoinRow}>
                          <Ionicons name="cash" size={11} color="#F59E0B" />
                          <Text style={styles.giftCoins}>{g.coins}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <Pressable
                  testID="gift-send"
                  style={[styles.giftSendBtn, !selectedGift && { opacity: 0.4 }]}
                  onPress={sendGiftMessage}
                  disabled={!selectedGift}
                >
                  <Text style={styles.giftSendText}>Send</Text>
                </Pressable>
              </View>
            )}
            {panel === "translate" && (
              <View style={styles.translatePanel}>
                <View style={styles.translateHeaderRow}>
                  <Text style={styles.translateTitle}>Translate to...</Text>
                  <View style={styles.langChips}>
                    {["en", "es", "pt", "fr", "ja"].map((lng) => (
                      <Pressable
                        key={lng}
                        testID={`tr-lang-${lng}`}
                        style={[styles.langChip, trTo === lng && styles.langChipActive]}
                        onPress={() => setTrTo(lng)}
                      >
                        <Text style={[styles.langChipText, trTo === lng && styles.langChipTextActive]}>
                          {lng.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.translateInputRow}>
                  <TextInput
                    testID="tr-input"
                    style={styles.translateInput}
                    placeholder="Enter the text you wish to translate"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    selectionColor={colors.brand}
                    value={trInput}
                    onChangeText={setTrInput}
                    multiline
                  />
                  <Pressable
                    testID="tr-run"
                    style={styles.translateRunBtn}
                    onPress={runPanelTranslate}
                    disabled={trLoading}
                  >
                    {trLoading ? (
                      <ActivityIndicator size="small" color={colors.onBrand} />
                    ) : (
                      <Ionicons name="arrow-forward" size={18} color={colors.onBrand} />
                    )}
                  </Pressable>
                </View>
                {trResult ? (
                  <Pressable
                    testID="tr-result"
                    style={styles.translateResult}
                    onPress={() => {
                      setDraft((d) => (d ? d + " " : "") + trResult);
                      setPanel(null);
                    }}
                  >
                    <Text style={styles.translateResultText}>{trResult}</Text>
                    <Text style={styles.translateUseHint}>Tap to use →</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            {panel === "attach" && (
              <View style={styles.attachPanel}>
                <Pressable
                  testID="attach-photo"
                  style={styles.attachItem}
                  onPress={() => {
                    setPanel(null);
                    pickImage();
                  }}
                >
                  <View style={[styles.attachIcon, { backgroundColor: "#3B82F6" }]}>
                    <Ionicons name="image" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.attachLabel}>Photo</Text>
                </Pressable>
                <Pressable
                  testID="attach-call"
                  style={styles.attachItem}
                  onPress={() => {
                    setPanel(null);
                    if (partner) startCall(partner);
                  }}
                >
                  <View style={[styles.attachIcon, { backgroundColor: "#22C55E" }]}>
                    <Ionicons name="call" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.attachLabel}>Voice Call</Text>
                </Pressable>
                <Pressable
                  testID="attach-gift"
                  style={styles.attachItem}
                  onPress={() => {
                    setPanel(null);
                    router.push("/market");
                  }}
                >
                  <View style={[styles.attachIcon, { backgroundColor: "#F59E0B" }]}>
                    <Ionicons name="gift" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.attachLabel}>Gift</Text>
                </Pressable>
              </View>
            )}
          </View>
          </>
        )}
      </KeyboardAvoidingView>
      <MessageReactionsPopup
        visible={!!reactionMsg}
        anchor={reactionAnchor}
        mine={reactionMsg ? reactionMsg.sender_id === user?.id : false}
        hasText={!!reactionMsg?.text && reactionMsg?.type !== "voice" && reactionMsg?.type !== "image"}
        isVoice={reactionMsg?.type === "voice"}
        isImage={reactionMsg?.type === "image"}
        messageText={reactionMsg?.text}
        voiceDurationMs={reactionMsg?.duration_ms ?? null}
        currentReaction={reactionMsg ? myReactionFor(reactionMsg) : undefined}
        pinned={!!reactionMsg?.pinned}
        saved={!!(reactionMsg?.saved_by || []).includes(user?.id || "")}
        practiced={!!(reactionMsg?.practice_by || []).includes(user?.id || "")}
        hasManualCorrection={!!reactionMsg?.manual_correction}
        onClose={() => {
          setReactionMsg(null);
          setReactionAnchor(null);
        }}
        onReact={toggleReaction}
        onAction={handleMsgAction}
      />

      <Modal
        visible={!!correctingMsg}
        transparent
        animationType="slide"
        onRequestClose={() => setCorrectingMsg(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setCorrectingMsg(null)} />
          <View style={styles.modalCard}>
            <View style={styles.menuHeader}>
              <Text style={styles.modalTitle}>Correction</Text>
              <Pressable testID="correction-close" onPress={() => setCorrectingMsg(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            {correctingMsg?.text ? (
              <Text style={styles.modalOriginal} numberOfLines={3}>
                {correctingMsg.text}
              </Text>
            ) : null}
            <TextInput
              testID="correction-input"
              style={styles.modalInput}
              placeholder="Write the corrected version..."
              placeholderTextColor={colors.onSurfaceSecondary}
              selectionColor={colors.brand}
              value={correctDraft}
              onChangeText={setCorrectDraft}
              multiline
            />
            <TextInput
              testID="correction-note-input"
              style={[styles.modalInput, { minHeight: 40 }]}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.onSurfaceSecondary}
              selectionColor={colors.brand}
              value={correctNote}
              onChangeText={setCorrectNote}
              multiline
            />
            <Pressable
              testID="correction-save"
              style={[styles.modalSaveBtn, savingCorrection && { opacity: 0.5 }]}
              onPress={submitManualCorrection}
              disabled={savingCorrection}
            >
              {savingCorrection ? (
                <ActivityIndicator size="small" color={colors.onBrand} />
              ) : (
                <Text style={styles.modalSaveText}>Save correction</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerInfo: {
      flex: 1,
      justifyContent: "center",
    },
    headerName: {
      fontFamily: fonts.displaySemi,
      fontSize: 18,
      color: colors.onSurface,
    },
    headerStatus: {
      fontFamily: fonts.text,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
      marginTop: 1,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerLang: {
      fontFamily: fonts.text,
      fontSize: 11,
      color: colors.onSurfaceSecondary,
    },
    callBtn: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    menuBtn: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing.xs,
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
      justifyContent: "flex-end",
    },
    menuCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.xs,
    },
    menuHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    menuTitle: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.onSurface,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    menuText: {
      flex: 1,
      fontFamily: fonts.textSemi,
      fontSize: 15,
      color: colors.onSurface,
    },
    menuToggle: {
      width: 40,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.borderStrong,
      padding: 2,
      justifyContent: "center",
    },
    menuToggleOn: {
      backgroundColor: colors.brand,
    },
    menuThumb: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#FFFFFF",
    },
    menuThumbOn: {
      alignSelf: "flex-end",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      minHeight: 200,
    },
    emptyText: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
    },
    messageList: {
      padding: spacing.lg,
      gap: spacing.sm,
      flexGrow: 1,
    },
    partnerCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    partnerTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    partnerNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    partnerName: {
      fontFamily: fonts.displaySemi,
      fontSize: 18,
      color: colors.onSurface,
      flexShrink: 1,
    },
    genderPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    genderPillText: {
      fontFamily: fonts.textBold,
      fontSize: 11,
      color: "#FFFFFF",
    },
    partnerSub: {
      fontFamily: fonts.text,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
      marginTop: 2,
    },
    partnerBio: {
      fontFamily: fonts.text,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurface,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs + 2,
    },
    introChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    introChipText: {
      fontFamily: fonts.textSemi,
      fontSize: 12,
      color: colors.onSurfaceTertiary,
    },
    dateSep: {
      alignSelf: "center",
      fontFamily: fonts.text,
      fontSize: 11,
      color: colors.onSurfaceSecondary,
      marginVertical: spacing.sm,
    },
    bubbleRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
    },
    rowMine: {
      justifyContent: "flex-end",
    },
    rowTheirs: {
      justifyContent: "flex-start",
    },
    bubble: {
      maxWidth: "76%",
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: spacing.xs,
    },
    bubbleMine: {
      backgroundColor: "#F1ECF7",
    },
    bubbleTheirs: {
      backgroundColor: "#F0F0F0",
    },
    avatarSpacer: {
      width: 32,
    },
    bubbleText: {
      fontFamily: fonts.text,
      fontSize: 15,
      lineHeight: 21,
      color: "#1A1A1A",
    },
    bubbleTextMine: {
      color: "#1A1A1A",
    },
    imageBubble: {
      width: 210,
      height: 210,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceTertiary,
    },
    translationBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.xs + 2,
    },
    translationText: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      lineHeight: 20,
      color: colors.brand,
    },
    bubbleFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    bubbleActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    correctionBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.xs + 2,
      gap: 2,
    },
    correctionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    correctionLabel: {
      fontFamily: fonts.textBold,
      fontSize: 10,
      color: colors.success,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    correctionText: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      lineHeight: 20,
      color: colors.success,
    },
    correctionExplain: {
      fontFamily: fonts.text,
      fontSize: 12,
      lineHeight: 17,
      color: colors.onSurfaceSecondary,
      fontStyle: "italic",
    },
    bubbleSelected: {
      borderWidth: 2,
      borderColor: colors.brand,
    },
    sideCol: {
      justifyContent: "center",
      alignSelf: "center",
      marginLeft: 6,
    },
    sideBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    sideBtnActive: {
      backgroundColor: colors.brandTertiary,
    },
    sideGlyph: {
      fontFamily: fonts.textBold,
      fontSize: 14,
    },
    micWrap: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    micA: {
      fontFamily: fonts.textBold,
      fontSize: 9,
      color: colors.onSurface,
      marginTop: 1,
      marginLeft: -1,
    },
    manualBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.xs + 2,
      gap: 2,
    },
    manualLabel: {
      fontFamily: fonts.textBold,
      fontSize: 10,
      color: colors.brand,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    manualText: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      lineHeight: 20,
      color: colors.brand,
    },
    selectBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    selectCount: {
      flex: 1,
      fontFamily: fonts.displaySemi,
      fontSize: 16,
      color: colors.onSurface,
    },
    selectAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    selectActionText: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      color: colors.brand,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.45)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.xl,
      gap: spacing.md,
    },
    modalTitle: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.onSurface,
    },
    modalOriginal: {
      fontFamily: fonts.text,
      fontSize: 13,
      color: colors.onSurfaceSecondary,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.sm,
      padding: spacing.sm + 2,
    },
    modalInput: {
      fontFamily: fonts.text,
      fontSize: 15,
      color: colors.onSurface,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      padding: spacing.md,
      minHeight: 52,
      textAlignVertical: "top",
    },
    modalSaveBtn: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    modalSaveText: {
      fontFamily: fonts.textBold,
      fontSize: 15,
      color: colors.onBrand,
    },
    hintBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.brandTertiary,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    hintText: {
      flex: 1,
      fontFamily: fonts.textSemi,
      fontSize: 12,
      color: colors.brand,
    },
    bubbleTime: {
      fontFamily: fonts.text,
      fontSize: 10,
      color: colors.onSurfaceSecondary,
    },
    bubbleTimeMine: {
      color: colors.onSurfaceSecondary,
    },
    roomShareRow: {
      alignSelf: "stretch",
      paddingHorizontal: spacing.md,
      marginVertical: 4,
    },
    roomShareBubble: {
      // Full width — the RoomMomentCard is styled identically to the moments
      // feed card, so it should occupy the same visual footprint whether it's
      // seen in a chat message or a moment.
      alignSelf: "stretch",
      padding: 0,
      borderRadius: radius.md,
      gap: 4,
    },
    reactionBadgeRow: {
      flexDirection: "row",
      gap: 4,
      marginTop: -6,
      marginBottom: 2,
      alignSelf: "flex-start",
    },
    reactionBadgeMine: {
      alignSelf: "flex-end",
      marginRight: 4,
    },
    reactionBadgeTheirs: {
      alignSelf: "flex-start",
      marginLeft: 4,
    },
    reactionBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 3,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    reactionBadgeEmoji: {
      fontSize: 13,
    },
    reactionBadgeCount: {
      fontFamily: fonts.textSemi,
      fontSize: 11,
      color: colors.onSurfaceSecondary,
    },
    recordingBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.error,
    },
    recordingTime: {
      fontFamily: fonts.textBold,
      fontSize: 15,
      color: colors.onSurface,
    },
    recordingHint: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 13,
      color: colors.onSurfaceSecondary,
    },
    recordCancel: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    recordSend: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    inputArea: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    inputPill: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: spacing.lg,
      minHeight: 40,
      justifyContent: "center",
    },
    inlineActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    micBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    translateGlyph: {
      fontFamily: fonts.textBold,
      fontSize: 18,
      color: colors.onSurface,
    },
    emojiBar: {
      maxHeight: 52,
      marginBottom: spacing.sm,
    },
    emojiBarContent: {
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    emojiItem: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },
    emojiText: {
      fontSize: 22,
    },
    templatePanel: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    templateItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    templateText: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 14,
      color: colors.onSurface,
    },
    attachPanel: {
      flexDirection: "row",
      gap: spacing.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    attachItem: {
      alignItems: "center",
      gap: spacing.xs + 2,
    },
    attachIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    attachLabel: {
      fontFamily: fonts.textSemi,
      fontSize: 12,
      color: colors.onSurfaceSecondary,
    },
    toolbarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    toolIcon: {
      width: 44,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    toolBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: colors.onSurface,
      maxHeight: 110,
      paddingVertical: Platform.OS === "web" ? 8 : 6,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiGridWrap: {
      maxHeight: 220,
      marginBottom: spacing.sm,
    },
    emojiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    emojiGridItem: {
      width: `${100 / 8}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiGridText: {
      fontSize: 26,
    },
    phrasesPanel: {
      maxHeight: 260,
      marginBottom: spacing.sm,
    },
    phraseTabs: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    phraseTab: {
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
    },
    phraseTabActive: {
      backgroundColor: colors.brandTertiary,
    },
    phraseTabText: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
    },
    phraseTabTextActive: {
      color: colors.brand,
    },
    phraseList: {
      maxHeight: 210,
    },
    phrasePill: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
    },
    phrasePillText: {
      fontFamily: fonts.text,
      fontSize: 14.5,
      color: colors.onSurface,
    },
    addPhraseBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      alignSelf: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 4,
      marginBottom: spacing.md,
    },
    addPhraseText: {
      fontFamily: fonts.textSemi,
      fontSize: 13,
      color: colors.brand,
    },
    giftPanel: {
      maxHeight: 300,
      marginBottom: spacing.sm,
    },
    giftTabs: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    giftTab: {
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
    },
    giftTabActive: {
      backgroundColor: colors.brandTertiary,
    },
    giftTabText: {
      fontFamily: fonts.textSemi,
      fontSize: 13,
      color: colors.onSurfaceSecondary,
    },
    giftTabTextActive: {
      color: colors.brand,
    },
    coinPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginLeft: "auto",
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    coinText: {
      fontFamily: fonts.textBold,
      fontSize: 12,
      color: colors.onSurface,
    },
    giftGridWrap: {
      maxHeight: 200,
    },
    giftGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    giftItem: {
      width: `${100 / 4}%`,
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    giftItemActive: {
      borderColor: colors.brand,
      backgroundColor: colors.brandTertiary,
    },
    giftEmoji: {
      fontSize: 30,
    },
    giftName: {
      fontFamily: fonts.textSemi,
      fontSize: 11,
      color: colors.onSurface,
      marginTop: 2,
    },
    giftCoinRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    giftCoins: {
      fontFamily: fonts.textSemi,
      fontSize: 10,
      color: colors.onSurfaceSecondary,
    },
    giftSendBtn: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    giftSendText: {
      fontFamily: fonts.textBold,
      fontSize: 15,
      color: colors.onBrand,
    },
    translatePanel: {
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    translateHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    translateTitle: {
      fontFamily: fonts.textSemi,
      fontSize: 14,
      color: colors.onSurfaceSecondary,
    },
    langChips: {
      flexDirection: "row",
      gap: 6,
    },
    langChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
    },
    langChipActive: {
      backgroundColor: colors.brand,
    },
    langChipText: {
      fontFamily: fonts.textBold,
      fontSize: 11,
      color: colors.onSurfaceSecondary,
    },
    langChipTextActive: {
      color: colors.onBrand,
    },
    translateInputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
    },
    translateInput: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: colors.onSurface,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      minHeight: 44,
      maxHeight: 100,
    },
    translateRunBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    translateResult: {
      backgroundColor: colors.brandTertiary,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 4,
    },
    translateResultText: {
      fontFamily: fonts.textSemi,
      fontSize: 15,
      color: colors.brand,
    },
    translateUseHint: {
      fontFamily: fonts.text,
      fontSize: 11,
      color: colors.onSurfaceSecondary,
      alignSelf: "flex-end",
    },
  });
