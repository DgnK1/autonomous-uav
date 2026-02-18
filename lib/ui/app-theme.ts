import { useMemo } from "react";
import { useColorScheme } from "react-native";

export type AppTheme = ReturnType<typeof createTheme>;

export const APP_SPACING = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 18,
} as const;

export const APP_RADII = {
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
} as const;

export type AppLayoutProfile = {
  kind: "small" | "medium" | "large";
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
};

export function getLayoutProfile(width: number): AppLayoutProfile {
  if (width < 360) {
    return {
      kind: "small",
      isSmall: true,
      isMedium: false,
      isLarge: false,
    };
  }
  if (width >= 768) {
    return {
      kind: "large",
      isSmall: false,
      isMedium: false,
      isLarge: true,
    };
  }
  return {
    kind: "medium",
    isSmall: false,
    isMedium: true,
    isLarge: false,
  };
}

export function getAppTypography(width: number) {
  const compact = width < 360;
  const regular = width >= 360 && width < 414;
  return {
    compact,
    regular,
    headerTitle: compact ? 21 : 23,
    sectionTitle: compact ? 19 : regular ? 21 : 22,
    tableHeader: compact ? 14 : 15,
    cardTitle: compact ? 12 : 13,
    chipLabel: 10,
    chipTracking: 0.4,
    body: compact ? 13 : 14,
    bodyStrong: compact ? 14 : 15,
    value: compact ? 17 : 19,
    small: compact ? 11 : 12,
  } as const;
}

function dampForFontScale(fontScale: number) {
  if (fontScale <= 1) {
    return 1;
  }
  const damp = 1 + (fontScale - 1) * 0.35;
  return Math.min(damp, 1.18);
}

function scaleType(value: number, fontScale: number) {
  const damp = dampForFontScale(fontScale);
  return Math.round((value / damp) * 100) / 100;
}

export function getAccessibleAppTypography(width: number, fontScale: number) {
  const compact = width < 360;
  const regular = width >= 360 && width < 414;
  const safeScale = Math.max(0.85, Math.min(fontScale || 1, 1.4));
  return {
    compact,
    regular,
    headerTitle: scaleType(compact ? 21 : 23, safeScale),
    sectionTitle: scaleType(compact ? 19 : regular ? 21 : 22, safeScale),
    tableHeader: scaleType(compact ? 14 : 15, safeScale),
    cardTitle: scaleType(compact ? 12 : 13, safeScale),
    chipLabel: scaleType(10, safeScale),
    chipTracking: 0.4,
    body: scaleType(compact ? 13 : 14, safeScale),
    bodyStrong: scaleType(compact ? 14 : 15, safeScale),
    value: scaleType(compact ? 17 : 19, safeScale),
    small: scaleType(compact ? 11 : 12, safeScale),
  } as const;
}

function createTheme(mode: "light" | "dark") {
  const isDark = mode === "dark";
  return {
    isDark,
    colors: {
      screenBg: isDark ? "#111317" : "#e8e9ee",
      headerBg: isDark ? "#171b21" : "#ffffff",
      headerBorder: isDark ? "#262b34" : "#dddddd",
      textPrimary: isDark ? "#f0f3f8" : "#111111",
      textSecondary: isDark ? "#c8ced8" : "#31343b",
      textMuted: isDark ? "#bac3d1" : "#4f4f4f",
      icon: isDark ? "#e8edf6" : "#111111",
      cardBg: isDark ? "#1b2028" : "#ececef",
      cardBorder: isDark ? "#2b3240" : "#cdced3",
      cardAltBg: isDark ? "#1b2028" : "#e8e9ee",
      mapCardBg: isDark ? "#2e333d" : "#d8d4ce",
      mapFrameBg: isDark ? "#213042" : "#dce7f1",
      tableHeaderBg: isDark ? "#202731" : "#ececee",
      tableHeaderBorder: isDark ? "#2f3744" : "#b7bcc9",
      tableRowBorder: isDark ? "#2a313d" : "#d6d9e1",
      selectedRowBg: isDark ? "#22364f" : "#dceafd",
      overlay: isDark ? "#00000088" : "#00000066",
      searchCardBg: isDark ? "#1a2029" : "#f4f5f8",
      searchInputBg: isDark ? "#12171f" : "#ffffff",
      searchInputBorder: isDark ? "#37404f" : "#bcc2cd",
      actionStartBg: isDark ? "#2f8eff" : "#2b86de",
      actionModeBg: isDark ? "#3d74d6" : "#3976cb",
      metricMoist: "#3f7ee8",
      metricTemp: "#f65152",
      metricBattery: "#0a9e95",
      metricRpm: "#f4b63f",
      tagBg: isDark ? "#2d3542" : "#d4d6db",
      summaryBg: "#2994ea",
      summaryBorder: "#2582cc",
      onAccent: "#ffffff",
      tabActive: isDark ? "#ffffff" : "#141414",
      tabInactive: isDark ? "#95a0b2" : "#909090",
      tabBarBg: isDark ? "#171b21" : "#ffffff",
      tabBarBorder: isDark ? "#262b34" : "#dddddd",
      noticeBg: isDark ? "#000000c4" : "#000000a4",
      rowIcon: isDark ? "#cdd5e2" : "#4f5561",
    },
  } as const;
}

export function useAppTheme() {
  const scheme = useColorScheme();
  return useMemo(() => createTheme(scheme === "dark" ? "dark" : "light"), [scheme]);
}
