import { Ionicons } from "@/src/ui/icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { fonts, radius, spacing } from "@/src/theme";

/**
 * Calculator Vault — the app's public face.
 *
 * Anyone who opens the app first sees a fully-working simple calculator
 * (+, −, ×, ÷, %, C, ⌫). Nothing hints at the real app underneath.
 *
 * The vault is unlocked by the secret keystroke: 11 + 37 = which redirects
 * to the LinguaConnect welcome / auth screen. Any other calculation behaves
 * like a normal calculator (e.g. 12 + 37 = 49).
 *
 * If the user is already authenticated they skip the vault entirely and go
 * straight into the main app.
 */

type Op = "+" | "−" | "×" | "÷" | null;

const VAULT_CODE = { a: "11", op: "+" as Op, b: "37" };

// Basic 4-function evaluation with float safety.
const compute = (a: number, b: number, op: Op): number => {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
};

// Trim trailing zeros / long floats so the display never overflows.
const fmt = (n: number): string => {
  if (!isFinite(n)) return "Error";
  if (Number.isInteger(n)) return String(n);
  // Cap to 10 significant digits then strip trailing zeros.
  const s = n.toPrecision(10);
  return parseFloat(s).toString();
};

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [display, setDisplay] = React.useState<string>("0");
  const [previous, setPrevious] = React.useState<string | null>(null);
  const [op, setOp] = React.useState<Op>(null);
  // True right after an operator is pressed → next digit replaces the display.
  const [waitingForNext, setWaitingForNext] = React.useState(false);
  // Track the exact user-entered strings so we can compare against the vault.
  const [enteredA, setEnteredA] = React.useState<string | null>(null);
  const [enteredOp, setEnteredOp] = React.useState<Op>(null);

  // ────────────────────────────────────────────────────────────────────────
  // Small header line above the display showing the pending expression.
  // Kept before any early returns so hook order stays stable across renders.
  // ────────────────────────────────────────────────────────────────────────
  const expressionLine = React.useMemo(() => {
    if (previous && op) {
      return `${previous} ${op}${waitingForNext ? "" : " " + display}`;
    }
    return "";
  }, [previous, op, waitingForNext, display]);

  // While the auth session is still hydrating we briefly show a loader so we
  // don't send the user to the wrong destination on the secret unlock.
  if (loading) {
    return (
      <View style={styles.loading} testID="app-loading">
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Calculator handlers.
  // ────────────────────────────────────────────────────────────────────────
  const inputDigit = (d: string) => {
    if (waitingForNext) {
      setDisplay(d);
      setWaitingForNext(false);
      return;
    }
    // Cap the length so the display never overflows.
    if (display.replace("-", "").replace(".", "").length >= 12) return;
    setDisplay(display === "0" ? d : display + d);
  };

  const inputDot = () => {
    if (waitingForNext) {
      setDisplay("0.");
      setWaitingForNext(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const clearAll = () => {
    setDisplay("0");
    setPrevious(null);
    setOp(null);
    setWaitingForNext(false);
    setEnteredA(null);
    setEnteredOp(null);
  };

  const backspace = () => {
    if (waitingForNext) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith("-"))) {
      setDisplay("0");
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const percent = () => {
    const n = parseFloat(display);
    if (!isFinite(n)) return;
    setDisplay(fmt(n / 100));
  };

  const toggleSign = () => {
    if (display === "0") return;
    if (display.startsWith("-")) setDisplay(display.slice(1));
    else setDisplay("-" + display);
  };

  const applyOperator = (nextOp: Op) => {
    // First operator press → just remember current display as the left operand.
    if (previous === null) {
      setPrevious(display);
      setEnteredA(display);
      setOp(nextOp);
      setEnteredOp(nextOp);
      setWaitingForNext(true);
      return;
    }
    // If user chains operators without pressing =, evaluate the pending one
    // using the current display as the right operand.
    if (!waitingForNext) {
      const a = parseFloat(previous);
      const b = parseFloat(display);
      const result = fmt(compute(a, b, op));
      setDisplay(result);
      setPrevious(result);
      setEnteredA(result);
    }
    setOp(nextOp);
    setEnteredOp(nextOp);
    setWaitingForNext(true);
  };

  const equals = () => {
    if (previous === null || op === null) return;

    // Secret vault code check: exactly "11 + 37 =" as typed by the user.
    if (
      enteredA === VAULT_CODE.a &&
      enteredOp === VAULT_CODE.op &&
      display === VAULT_CODE.b
    ) {
      // Reset UI so the calculator is fresh next time the user backs out.
      clearAll();
      if (user) {
        // Already authenticated → drop straight into the app.
        if (!user.native_language || !user.learning_language) {
          router.replace("/onboarding");
        } else {
          router.replace("/(tabs)/connect");
        }
      } else {
        // Not authenticated → show sign-up / login welcome screen.
        router.replace("/welcome");
      }
      return;
    }

    const a = parseFloat(previous);
    const b = parseFloat(display);
    const result = fmt(compute(a, b, op));
    setDisplay(result);
    setPrevious(null);
    setOp(null);
    setWaitingForNext(true);
    // Vault sequence gets invalidated after evaluation.
    setEnteredA(null);
    setEnteredOp(null);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Button subcomponent — styled tactile keypad.
  // ────────────────────────────────────────────────────────────────────────
  const CalcButton = ({
    label,
    onPress,
    variant = "num",
    wide = false,
    icon,
    testID,
  }: {
    label?: string;
    onPress: () => void;
    variant?: "num" | "fn" | "op" | "equals";
    wide?: boolean;
    icon?: React.ReactNode;
    testID?: string;
  }) => {
    const bg =
      variant === "num"
        ? "#2A2A2C"
        : variant === "fn"
          ? "#48484A"
          : variant === "equals"
            ? "#0EA5E9"
            : "#F59E0B"; // op
    const fg =
      variant === "fn" ? "#0F172A" : "#FFFFFF";
    const fnBg = variant === "fn" ? "#D1D5DB" : bg;

    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.btn,
          wide && styles.btnWide,
          { backgroundColor: fnBg, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        {icon ? (
          icon
        ) : (
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Display area */}
      <View style={styles.displayArea}>
        <Text style={styles.expression} numberOfLines={1}>
          {expressionLine}
        </Text>
        <Text
          testID="calc-display"
          style={styles.display}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {display}
        </Text>
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        <View style={styles.row}>
          <CalcButton label="AC" variant="fn" onPress={clearAll} testID="calc-ac" />
          <CalcButton label="±" variant="fn" onPress={toggleSign} testID="calc-sign" />
          <CalcButton label="%" variant="fn" onPress={percent} testID="calc-percent" />
          <CalcButton label="÷" variant="op" onPress={() => applyOperator("÷")} testID="calc-op-div" />
        </View>
        <View style={styles.row}>
          <CalcButton label="7" onPress={() => inputDigit("7")} testID="calc-7" />
          <CalcButton label="8" onPress={() => inputDigit("8")} testID="calc-8" />
          <CalcButton label="9" onPress={() => inputDigit("9")} testID="calc-9" />
          <CalcButton label="×" variant="op" onPress={() => applyOperator("×")} testID="calc-op-mul" />
        </View>
        <View style={styles.row}>
          <CalcButton label="4" onPress={() => inputDigit("4")} testID="calc-4" />
          <CalcButton label="5" onPress={() => inputDigit("5")} testID="calc-5" />
          <CalcButton label="6" onPress={() => inputDigit("6")} testID="calc-6" />
          <CalcButton label="−" variant="op" onPress={() => applyOperator("−")} testID="calc-op-sub" />
        </View>
        <View style={styles.row}>
          <CalcButton label="1" onPress={() => inputDigit("1")} testID="calc-1" />
          <CalcButton label="2" onPress={() => inputDigit("2")} testID="calc-2" />
          <CalcButton label="3" onPress={() => inputDigit("3")} testID="calc-3" />
          <CalcButton label="+" variant="op" onPress={() => applyOperator("+")} testID="calc-op-add" />
        </View>
        <View style={styles.row}>
          <CalcButton
            variant="num"
            onPress={backspace}
            testID="calc-back"
            icon={<Ionicons name="backspace-outline" size={26} color="#FFFFFF" />}
          />
          <CalcButton label="0" onPress={() => inputDigit("0")} testID="calc-0" />
          <CalcButton label="." onPress={inputDot} testID="calc-dot" />
          <CalcButton label="=" variant="equals" onPress={equals} testID="calc-equals" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F0F10",
  },
  loading: {
    flex: 1,
    backgroundColor: "#0F0F10",
    alignItems: "center",
    justifyContent: "center",
  },
  displayArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  expression: {
    fontFamily: fonts.textSemi,
    fontSize: 22,
    color: "rgba(255,255,255,0.55)",
    textAlign: "right",
    minHeight: 26,
  },
  display: {
    fontFamily: fonts.display,
    fontSize: 76,
    color: "#FFFFFF",
    textAlign: "right",
    lineHeight: Platform.OS === "web" ? 84 : undefined,
  },
  keypad: {
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  btn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  btnWide: {
    flex: 2.1,
    aspectRatio: undefined,
  },
  btnText: {
    fontFamily: fonts.display,
    fontSize: 30,
  },
});
