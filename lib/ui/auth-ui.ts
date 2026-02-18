import { useMemo } from "react";
import { useColorScheme } from "react-native";

export type AuthColors = {
  background: string;
  surface: string;
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  textMuted: string;
  placeholder: string;
  border: string;
  borderMuted: string;
  brand: string;
  brandLink: string;
  onBrand: string;
  socialSurface: string;
  socialSurfaceAlt: string;
  socialText: string;
  iconMuted: string;
  danger: string;
  dangerBorder: string;
  overlay: string;
  white: string;
};

export const AUTH_COLORS: AuthColors = {
  background: "#e8e9ee",
  surface: "#ffffff44",
  textPrimary: "#1d222a",
  textBody: "#2a2f36",
  textSecondary: "#3f444b",
  textMuted: "#545b65",
  placeholder: "#5f646c",
  border: "#969ca5",
  borderMuted: "#939aa3",
  brand: "#3c6798",
  brandLink: "#2f5e90",
  onBrand: "#f2f5f8",
  socialSurface: "#d5d9e1",
  socialSurfaceAlt: "#d0d5df",
  socialText: "#1f242b",
  iconMuted: "#5b6270",
  danger: "#b42318",
  dangerBorder: "#c63f3f",
  overlay: "#00000055",
  white: "#ffffff",
};

function createAuthColors(mode: "light" | "dark"): AuthColors {
  if (mode === "dark") {
    return {
      background: "#111317",
      surface: "#1a20295e",
      textPrimary: "#f0f3f8",
      textBody: "#d0d7e3",
      textSecondary: "#b8c0ce",
      textMuted: "#98a2b3",
      placeholder: "#8b95a5",
      border: "#394250",
      borderMuted: "#384150",
      brand: "#4b78b0",
      brandLink: "#8ab4f8",
      onBrand: "#f2f5f8",
      socialSurface: "#2a313d",
      socialSurfaceAlt: "#2a313d",
      socialText: "#edf1f7",
      iconMuted: "#b0b8c7",
      danger: "#ff8a8a",
      dangerBorder: "#e97777",
      overlay: "#00000077",
      white: "#ffffff",
    };
  }

  return AUTH_COLORS;
}

export function useAuthTheme() {
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";
  const colors = useMemo(() => createAuthColors(mode), [mode]);
  return { mode, colors } as const;
}

export const AUTH_SPACING = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
  xxxl: 20,
  screenHorizontal: 24,
  sectionGap: 22,
} as const;

export const AUTH_RADII = {
  sm: 6,
  md: 10,
  lg: 11,
  xl: 12,
  xxl: 20,
} as const;

export const AUTH_SIZES = {
  inputHeight: 50,
  primaryButtonHeight: 50,
  secondaryButtonHeight: 50,
  socialButtonHeight: 42,
  eyeButtonSize: 28,
  eyeButtonOffsetRight: 10,
  eyeButtonOffsetTop: 12,
  socialButtonMinCompact: 240,
  socialButtonMinRegular: 252,
  logoCompact: 120,
  logoRegular: 136,
} as const;

export type AuthLayoutProfile = {
  kind: "small" | "medium" | "large";
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
};

export function getAuthLayoutProfile(width: number): AuthLayoutProfile {
  if (width < 360) {
    return { kind: "small", isSmall: true, isMedium: false, isLarge: false };
  }
  if (width >= 768) {
    return { kind: "large", isSmall: false, isMedium: false, isLarge: true };
  }
  return { kind: "medium", isSmall: false, isMedium: true, isLarge: false };
}

export function getAuthTypography(width: number) {
  const compact = width < 360;
  return {
    compact,
    pageTitle: compact ? 28 : 32,
    pageTitleLineHeight: compact ? 34 : 38,
    heroTitle: compact ? 30 : 34,
    heroTitleLineHeight: compact ? 36 : 40,
    subtitle: compact ? 15 : 16,
    body: compact ? 13 : 14,
    input: compact ? 16 : 17,
    button: compact ? 18 : 19,
    buttonSecondary: compact ? 15 : 16,
    divider: 18,
    inlineError: 12,
    error: 13,
    link: compact ? 14 : 16,
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

export function getAccessibleAuthTypography(width: number, fontScale: number) {
  const compact = width < 360;
  const safeScale = Math.max(0.85, Math.min(fontScale || 1, 1.4));

  return {
    compact,
    pageTitle: scaleType(compact ? 28 : 32, safeScale),
    pageTitleLineHeight: scaleType(compact ? 34 : 38, safeScale),
    heroTitle: scaleType(compact ? 30 : 34, safeScale),
    heroTitleLineHeight: scaleType(compact ? 36 : 40, safeScale),
    subtitle: scaleType(compact ? 15 : 16, safeScale),
    body: scaleType(compact ? 13 : 14, safeScale),
    input: scaleType(compact ? 16 : 17, safeScale),
    button: scaleType(compact ? 18 : 19, safeScale),
    buttonSecondary: scaleType(compact ? 15 : 16, safeScale),
    divider: scaleType(18, safeScale),
    inlineError: scaleType(12, safeScale),
    error: scaleType(13, safeScale),
    link: scaleType(compact ? 14 : 16, safeScale),
  } as const;
}
