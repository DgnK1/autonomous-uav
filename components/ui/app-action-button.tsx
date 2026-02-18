import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type AppActionButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  compact?: boolean;
  accessibilityHint?: string;
};

export function AppActionButton({
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
  backgroundColor,
  borderColor,
  textColor,
  compact = false,
  accessibilityHint,
}: AppActionButtonProps) {
  const isDisabled = disabled || loading;
  const resolveStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.button,
    pressed && !isDisabled && styles.buttonPressed,
    {
      backgroundColor,
      borderColor,
      height: compact ? 46 : 50,
      minHeight: 44,
      opacity: isDisabled ? 0.62 : 1,
    },
  ];

  async function handlePress() {
    if (!isDisabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (!isDisabled) {
      onPress();
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      android_ripple={{ color: "#ffffff20" }}
      style={resolveStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 17} color={textColor} /> : null}
          <Text
            style={[styles.label, { color: textColor, fontSize: compact ? 14 : 15 }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ scale: 1 }],
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontWeight: "700",
  },
});
