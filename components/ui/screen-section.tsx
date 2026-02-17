import { type ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

type ScreenSectionProps = {
  title?: string;
  children: ReactNode;
  rightSlot?: ReactNode;
  style?: ViewStyle;
  titleColor: string;
  titleSize?: number;
  titleTracking?: number;
  borderColor: string;
  backgroundColor: string;
};

export function ScreenSection({
  title,
  children,
  rightSlot,
  style,
  titleColor,
  titleSize = 15,
  titleTracking = 0,
  borderColor,
  backgroundColor,
}: ScreenSectionProps) {
  return (
    <View style={[styles.section, { borderColor, backgroundColor }, style]}>
      {title ? (
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: titleColor, fontSize: titleSize, letterSpacing: titleTracking }]}>
            {title}
          </Text>
          {rightSlot}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
});
