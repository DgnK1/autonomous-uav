import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type AppActionButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  compact?: boolean;
};

export function AppActionButton({
  label,
  icon,
  onPress,
  disabled = false,
  backgroundColor,
  borderColor,
  textColor,
  compact = false,
}: AppActionButtonProps) {
  const resolveStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.button,
    pressed && styles.buttonPressed,
    {
      backgroundColor,
      borderColor,
      height: compact ? 46 : 50,
      opacity: disabled ? 0.55 : 1,
    },
  ];

  async function handlePress() {
    if (!disabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      android_ripple={{ color: "#ffffff20" }}
      style={resolveStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
    >
      <View style={styles.inner}>
        {icon ? <Ionicons name={icon} size={compact ? 17 : 18} color={textColor} /> : null}
        <Text style={[styles.label, { color: textColor, fontSize: compact ? 14 : 15 }]}>{label}</Text>
      </View>
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
