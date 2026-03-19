import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markOnboardingComplete } from "@/lib/onboarding-state";
import {
  AUTH_RADII,
  AUTH_SPACING,
  getAccessibleAuthTypography,
  getAuthLayoutProfile,
  type AuthColors,
  useAuthTheme,
} from "@/lib/ui/auth-ui";

const slides = [
  {
    icon: "navigate-circle-outline" as const,
    title: "Monitor Active Areas",
    body: "Track saved field locations, moisture status, and temperature conditions from one focused dashboard.",
  },
  {
    icon: "pulse-outline" as const,
    title: "Stay Updated In Real Time",
    body: "Watch live telemetry, review mission activity, and keep an eye on area health as values change.",
  },
  {
    icon: "clipboard-outline" as const,
    title: "Review Clear Summaries",
    body: "See area health indicators, alerts, and next-action guidance to make faster field decisions.",
  },
];

export default function OnboardingScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { mode, colors } = useAuthTheme();
  const styles = useMemo(() => createStyles(width, colors, mode, fontScale), [width, colors, mode, fontScale]);
  const [index, setIndex] = useState(0);
  const activeSlide = slides[index];
  const isLast = index === slides.length - 1;

  async function handleFinish() {
    await markOnboardingComplete();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>Welcome to SOARIS</Text>
          <Pressable onPress={() => void handleFinish()} accessibilityRole="button">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.iconWrap}>
            <Ionicons name={activeSlide.icon} size={52} color={colors.onBrand} />
          </View>
          <Text style={styles.title}>{activeSlide.title}</Text>
          <Text style={styles.body}>{activeSlide.body}</Text>

          <View style={styles.dotsRow}>
            {slides.map((slide, slideIndex) => (
              <View
                key={slide.title}
                style={[styles.dot, slideIndex === index && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.previewGrid}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Dashboard</Text>
            <Text style={styles.previewBody}>Active areas, telemetry, and location insights.</Text>
          </View>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Summary</Text>
            <Text style={styles.previewBody}>Health indicators, alerts, and next-step guidance.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {index > 0 ? (
            <Pressable
              style={[styles.secondaryButton, styles.footerButton]}
              onPress={() => setIndex((current) => current - 1)}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.footerButtonSpacer} />
          )}

          <Pressable
            style={[styles.primaryButton, styles.footerButton]}
            onPress={() => {
              if (isLast) {
                void handleFinish();
                return;
              }
              setIndex((current) => current + 1);
            }}
          >
            <Text style={styles.primaryButtonText}>{isLast ? "Get Started" : "Next"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AuthColors, mode: "light" | "dark", fontScale: number) {
  const typography = getAccessibleAuthTypography(width, fontScale);
  const layout = getAuthLayoutProfile(width);
  const isDark = mode === "dark";
  const cardMaxWidth = layout.isLarge ? 620 : 460;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      width: "100%",
      maxWidth: cardMaxWidth,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? AUTH_SPACING.xxl : AUTH_SPACING.screenHorizontal,
      paddingTop: AUTH_SPACING.xxxl,
      paddingBottom: AUTH_SPACING.xxxl,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: AUTH_SPACING.xxxl,
    },
    kicker: {
      color: colors.textMuted,
      fontSize: typography.body,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    skipText: {
      color: colors.brandLink,
      fontSize: typography.link,
      fontWeight: "700",
    },
    heroCard: {
      borderRadius: AUTH_RADII.xxl,
      backgroundColor: isDark ? "#1b2330" : "#203247",
      paddingHorizontal: AUTH_SPACING.xxxl,
      paddingVertical: 28,
      marginBottom: AUTH_SPACING.xxxl,
      minHeight: layout.isSmall ? 320 : 340,
      justifyContent: "space-between",
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: isDark ? "#ffffff18" : "#ffffff20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: AUTH_SPACING.xxl,
    },
    title: {
      color: colors.white,
      fontSize: typography.heroTitle,
      lineHeight: typography.heroTitleLineHeight,
      fontWeight: "800",
      marginBottom: AUTH_SPACING.lg,
    },
    body: {
      color: "#d6dfeb",
      fontSize: typography.subtitle,
      lineHeight: typography.compact ? 22 : 24,
      marginBottom: AUTH_SPACING.xxxl,
    },
    dotsRow: {
      flexDirection: "row",
      gap: AUTH_SPACING.md,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: "#8fa3be55",
    },
    dotActive: {
      width: 26,
      backgroundColor: "#ffffff",
    },
    previewGrid: {
      flexDirection: "row",
      gap: AUTH_SPACING.md,
      marginBottom: AUTH_SPACING.xxxl,
    },
    previewCard: {
      flex: 1,
      borderRadius: AUTH_RADII.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: AUTH_SPACING.xl,
      paddingVertical: AUTH_SPACING.xxl,
      minHeight: 120,
    },
    previewTitle: {
      color: colors.textPrimary,
      fontSize: typography.buttonSecondary,
      fontWeight: "700",
      marginBottom: AUTH_SPACING.sm,
    },
    previewBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 18 : 20,
    },
    footer: {
      marginTop: "auto",
      flexDirection: "row",
      gap: AUTH_SPACING.md,
    },
    footerButton: {
      flex: 1,
    },
    footerButtonSpacer: {
      flex: 1,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: AUTH_RADII.xl,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: AUTH_SPACING.xl,
    },
    primaryButtonText: {
      color: colors.onBrand,
      fontSize: typography.button,
      fontWeight: "700",
    },
    secondaryButton: {
      minHeight: 52,
      borderRadius: AUTH_RADII.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: AUTH_SPACING.xl,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: typography.buttonSecondary,
      fontWeight: "700",
    },
  });
}
