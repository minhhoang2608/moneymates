import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MicIcon } from "@/components/icons";
import { PressableScale } from "@/components/PressableScale";
import { VoiceRings } from "@/components/VoiceRings";

import { useAiAvailable } from "@/api/features";
import { parseText } from "@/api/parseText";
import { useTargetDefault } from "@/components/target/useTargetDefault";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { CategoryRow, GroupMember } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { haptics } from "@/lib/haptics";
import { formatVnd } from "@/lib/money";
import { durations, useReduceMotion } from "@/lib/motion";
import { initialVoiceState, parseSpokenExpense, resolveVoiceEntry, toVoiceFormParams, voiceReducer } from "@/lib/voice";
import { getSpeechRecognizer, VOICE_LANG } from "@/voice/speech";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const BARS = [12, 22, 34, 26, 38, 18, 28, 14, 8];

export default function VoiceScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { categories: catRepo, groups } = useRepositories();
  const targetState = useTargetDefault({ fromGroupId: groupId });
  const { target } = targetState;
  const targetGroupId = target.kind === "group" ? target.groupId : undefined;
  const ai = useAiAvailable("parse_text");

  const [text, setText] = useState("");
  const [voice, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const { status, error } = voice;
  const listening = status === "listening";
  const busy = status === "processing" || status === "done";
  const [level, setLevel] = useState<number | null>(null);
  const reduceMotion = useReduceMotion();
  const holding = useRef(false);
  const releasedEarly = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const session = useRef(0);

  useEffect(() => {
    let alive = true;
    catRepo.listByKind("expense").then((rows) => alive && setCats(rows));
    return () => {
      alive = false;
    };
  }, [catRepo]);

  useEffect(() => {
    if (!targetGroupId) return;
    let alive = true;
    groups.getGroup(targetGroupId).then((g) => alive && setMembers(g.members));
    return () => {
      alive = false;
    };
  }, [groups, targetGroupId]);

  useEffect(
    () => () => {
      session.current++;
      if (navTimer.current) clearTimeout(navTimer.current);
      getSpeechRecognizer().stop();
    },
    [],
  );

  const spokenCats = useMemo(() => cats.map((c) => ({ id: c.id, name: c.name, type: c.type })), [cats]);
  const spokenMembers = useMemo(
    () => (targetGroupId ? members.map((m) => ({ id: m.id, name: m.displayName, isMe: m.isMe })) : undefined),
    [members, targetGroupId],
  );
  const preview = useMemo(
    () => (text ? parseSpokenExpense(text, { categories: spokenCats, members: spokenMembers }) : null),
    [text, spokenCats, spokenMembers],
  );

  const begin = async () => {
    const rec = getSpeechRecognizer();
    const id = ++session.current;
    holding.current = true;
    releasedEarly.current = false;
    setLevel(null);
    dispatch({ type: "START" });
    haptics.light(); // feedback right away, before the permission round trip
    const granted = await rec.requestPermission();
    if (id !== session.current) return;
    if (!granted) {
      holding.current = false;
      dispatch({ type: "ERROR", message: vi.voice.permissionDenied });
      return;
    }
    rec.start(VOICE_LANG, {
      onText: (t) => id === session.current && setText(t),
      onVolume: (l) => id === session.current && setLevel(l),
      onEnd: () => {
        if (id !== session.current) return;
        holding.current = false;
        dispatch({ type: "RECOGNIZER_END" });
      },
      onError: () => {
        if (id !== session.current) return;
        holding.current = false;
        dispatch({ type: "ERROR", message: vi.voice.speechError });
      },
    });
    // Released before the recognizer was up (a quick tap): stop it right away; the transcript is kept.
    if (releasedEarly.current) rec.stop();
  };

  const end = () => {
    if (!holding.current) return;
    holding.current = false;
    releasedEarly.current = true;
    haptics.light();
    getSpeechRecognizer().stop();
    dispatch({ type: "STOP" });
  };

  const retry = () => {
    getSpeechRecognizer().stop();
    session.current++;
    holding.current = false;
    setText("");
    dispatch({ type: "CANCEL" });
    void begin();
  };

  const use = async () => {
    if (!text.trim() || status !== "idle") return;
    dispatch({ type: "PROCESS" });
    let r: Awaited<ReturnType<typeof resolveVoiceEntry>>;
    try {
      r = await resolveVoiceEntry(text, {
        categories: spokenCats,
        members: spokenMembers,
        aiAvailable: ai.available,
        parseTextFn: parseText,
      });
    } catch {
      dispatch({ type: "PARSE_FAIL" }); // back to idle; the transcript and buttons stay usable
      return;
    }
    const params = toVoiceFormParams(r, text, targetGroupId);
    dispatch({ type: "PARSE_OK" });
    navTimer.current = setTimeout(
      () => router.replace({ pathname: "/transaction/new", params }),
      reduceMotion ? 0 : durations.slow,
    );
  };

  const payerName = preview?.payer.matched ? preview.payer.name : null;
  const rows: [string, string, string][] = [
    ["amount", vi.voice.amount, preview?.amount ? formatVnd(preview.amount) : "—"],
    ["category", vi.voice.category, preview?.category?.name ?? "—"],
    ["note", vi.voice.note, preview?.note || "—"],
  ];

  return (
    <View style={styles.root} testID="screen-voice">
      <View style={styles.header}>
        <PressableScale
          testID="voice-close"
          accessibilityRole="button"
          accessibilityLabel={vi.voice.close}
          onPress={() => router.back()}
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </PressableScale>
        <Text style={styles.title}>{vi.voice.title}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.chip}>{vi.voice.writeTo(target.kind === "group" ? target.name : vi.target.personal)}</Text>
        <Text testID="voice-transcript" style={[styles.transcript, !text && styles.placeholder]}>
          {text ? `“${text}”` : vi.voice.placeholder}
        </Text>
        {listening ? (
          <Text testID="voice-listening-label" style={styles.statusLabel}>
            {vi.voice.listening}
          </Text>
        ) : null}
        {status === "processing" ? (
          <View style={styles.processing}>
            <ActivityIndicator testID="voice-processing" color={colors.primary} />
            <Text style={styles.statusLabel}>{vi.voice.processing}</Text>
          </View>
        ) : null}
        {error ? (
          <Text testID="voice-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={styles.card}>
          {rows.map(([key, label, value]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text testID={`voice-preview-${key}`} style={styles.rowValue}>
                {value}
              </Text>
            </View>
          ))}
          {targetGroupId ? (
            <View style={[styles.row, styles.lastRow]}>
              <Text style={styles.rowLabel}>{vi.voice.payer}</Text>
              <Text testID="voice-preview-payer" style={styles.rowValue}>
                {payerName ?? members.find((m) => m.isMe)?.displayName ?? "—"}
                {payerName ? <Text style={styles.matched}>{` ${vi.voice.payerMatched}`}</Text> : null}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.footnote}>{ai.available ? vi.voice.footnote : vi.voice.offlineHint}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.bars} accessibilityElementsHidden>
          {BARS.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height: listening ? h : 6, backgroundColor: i % 3 === 0 ? colors.primarySoft2 : colors.primary },
              ]}
            />
          ))}
        </View>
        <View style={styles.micWrap}>
          <VoiceRings active={listening} reduceMotion={reduceMotion} level={level} />
          <PressableScale
            testID="voice-mic"
            accessibilityRole="button"
            accessibilityLabel={vi.voice.micLabel}
            accessibilityState={{ busy: listening }}
            onPressIn={() => void begin()}
            onPressOut={end}
            style={[styles.mic, listening && styles.micActive]}
          >
            <MicIcon color={colors.onPrimary} size={32} />
          </PressableScale>
        </View>
        <Text style={styles.hold}>{vi.voice.hold}</Text>
        <View style={styles.buttons}>
          <PressableScale
            testID="voice-retry"
            accessibilityRole="button"
            onPress={retry}
            style={[styles.btn, styles.btnGhost]}
          >
            <Text style={styles.btnGhostText}>{vi.voice.retry}</Text>
          </PressableScale>
          <PressableScale
            testID="voice-use-result"
            accessibilityRole="button"
            accessibilityState={{ disabled: !text.trim() || busy }}
            onPress={use}
            style={[styles.btn, styles.btnPrimary, !text.trim() && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>{vi.voice.use}</Text>
          </PressableScale>
        </View>
      </View>
      {status === "done" ? (
        <Animated.View
          testID="voice-done"
          style={styles.doneOverlay}
          entering={reduceMotion ? undefined : FadeIn.duration(durations.slow)}
        >
          <Text style={styles.doneCheck}>✓</Text>
          <Text style={styles.statusLabel}>{vi.voice.done}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, marginTop: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 20, color: colors.text },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  content: { paddingHorizontal: 20, gap: 18 },
  chip: {
    alignSelf: "flex-start",
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  transcript: { fontFamily: fontFamily.semibold, fontSize: 24, lineHeight: 32, color: colors.text },
  placeholder: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.expense },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 4 },
  row: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  rowValue: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  matched: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.primary },
  footnote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: "center",
    gap: 18,
  },
  bars: { flexDirection: "row", alignItems: "center", gap: 4, height: 40 },
  bar: { width: 4, borderRadius: 2 },
  mic: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 10,
    borderColor: colors.primarySoft2,
    boxSizing: "content-box",
  },
  micWrap: { alignItems: "center", justifyContent: "center" },
  micActive: { backgroundColor: colors.primaryDark },
  statusLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primary },
  processing: { flexDirection: "row", alignItems: "center", gap: 8 },
  doneOverlay: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.background,
  },
  doneCheck: { fontSize: 56, color: colors.primary },
  hold: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  buttons: { width: "100%", flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 52, borderRadius: radii.button, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text },
  btnPrimary: { backgroundColor: colors.primary },
  btnDisabled: { backgroundColor: colors.neutral },
  btnPrimaryText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.onPrimary },
});
