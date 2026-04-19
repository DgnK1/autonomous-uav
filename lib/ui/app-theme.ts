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
      screenBg: isDark ? "#111317" : "#ffffff",
      headerBg: isDark ? "#171b21" : "#ffffff",
      headerBorder: isDark ? "#262b34" : "#c7ced6",
      textPrimary: isDark ? "#f0f3f8" : "#000000",
      textSecondary: isDark ? "#c8ced8" : "#000000",
      textMuted: isDark ? "#bac3d1" : "#000000",
      icon: isDark ? "#e8edf6" : "#000000",
      cardBg: isDark ? "#1b2028" : "#ffffff",
      cardBorder: isDark ? "#2b3240" : "#bcc5cf",
      cardAltBg: isDark ? "#1b2028" : "#ffffff",
      mapCardBg: isDark ? "#2e333d" : "#ffffff",
      mapFrameBg: isDark ? "#213042" : "#f8fafc",
      tableHeaderBg: isDark ? "#202731" : "#f8fafc",
      tableHeaderBorder: isDark ? "#2f3744" : "#bcc5cf",
      tableRowBorder: isDark ? "#2a313d" : "#cfd6de",
      selectedRowBg: isDark ? "#22364f" : "#eff6ff",
      overlay: isDark ? "#00000088" : "#00000066",
      searchCardBg: isDark ? "#1a2029" : "#ffffff",
      searchInputBg: isDark ? "#12171f" : "#ffffff",
      searchInputBorder: isDark ? "#37404f" : "#bcc5cf",
      actionStartBg: isDark ? "#2f8eff" : "#2b86de",
      actionModeBg: isDark ? "#3d74d6" : "#3976cb",
      metricMoist: "#3f7ee8",
      metricTemp: "#f65152",
      metricBattery: "#0a9e95",
      metricRpm: "#f4b63f",
      tagBg: isDark ? "#2d3542" : "#eef2f7",
      summaryBg: "#2994ea",
      summaryBorder: "#2582cc",
      onAccent: "#ffffff",
      tabActive: isDark ? "#ffffff" : "#000000",
      tabInactive: isDark ? "#95a0b2" : "#000000",
      tabBarBg: isDark ? "#171b21" : "#ffffff",
      tabBarBorder: isDark ? "#262b34" : "#c7ced6",
      noticeBg: isDark ? "#000000c4" : "#000000a4",
      rowIcon: isDark ? "#cdd5e2" : "#000000",
    },
  } as const;
}

export function useAppTheme() {
  const scheme = useColorScheme();
  return useMemo(() => createTheme(scheme === "dark" ? "dark" : "light"), [scheme]);
}
