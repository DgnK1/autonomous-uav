import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import * as Linking from "expo-linking";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { auth, firebaseConfigError } from "@/lib/firebase";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

const settingItems = [
  { icon: "person-circle-outline", label: "Account Management" },
  { icon: "notifications-outline", label: "Notification Settings" },
  { icon: "share-social-outline", label: "Share App" },
  { icon: "lock-closed-outline", label: "Privacy Policy" },
  { icon: "document-text-outline", label: "Terms and Conditions" },
  { icon: "mail-outline", label: "Contact" },
  { icon: "chatbox-ellipses-outline", label: "Feedback" },
  { icon: "log-out-outline", label: "Logout" },
] as const;

export default function SettingsScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors, fontScale);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("settings");

  async function handleLogout() {
    if (!auth) {
      Alert.alert("Firebase not configured", firebaseConfigError ?? "Missing Firebase config.");
      return;
    }

    try {
      await signOut(auth);
      router.replace("/login");
    } catch {
      Alert.alert("Logout failed", "Please try again.");
    }
  }

  async function handleSettingAction(label: (typeof settingItems)[number]["label"]) {
    if (label === "Account Management") {
      router.push("/account");
      return;
    }

    if (label === "Notification Settings") {
      try {
        await Linking.openSettings();
      } catch {
        Alert.alert(
          "Notifications",
          "Open your device settings to manage notification permissions for SOARIS.",
        );
      }
      return;
    }

    if (label === "Share App") {
      await Share.share({
        title: "SOARIS",
        message: "Check out SOARIS mobile app.",
      });
      return;
    }

    if (label === "Privacy Policy") {
      Alert.alert("Privacy Policy", "Privacy policy content will be added by your backend/legal team.");
      return;
    }

    if (label === "Terms and Conditions") {
      router.push("/terms");
      return;
    }

    if (label === "Contact") {
      const contactUrl =
        "mailto:kylesabatin9999@gmail.com,kenjielagaras1@gmail.com?subject=SOARIS%20Contact";
      const canOpen = await Linking.canOpenURL(contactUrl);
      if (canOpen) {
        await Linking.openURL(contactUrl);
      } else {
        Alert.alert(
          "Contact",
          "Please email us at:\nkylesabatin9999@gmail.com\nkenjielagaras1@gmail.com"
        );
      }
      return;
    }

    if (label === "Feedback") {
      router.push("/feedback");
      return;
    }

    if (label === "Logout") {
      await handleLogout();
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          onPress={openNotifications}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: APP_SPACING.md + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          {settingItems.map((item) => (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.row}
              key={item.label}
              onPress={() => void handleSettingAction(item.label)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.rowLeft}>
                <Ionicons name={item.icon} size={20} color={colors.rowIcon} />
                <Text style={styles.rowText}>{item.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"], fontScale = 1) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const largeText = fontScale >= 1.15;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: largeText ? 72 : 64,
      paddingHorizontal: APP_SPACING.xxxl,
      backgroundColor: colors.headerBg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
    },
    headerTitle: {
      fontSize: typography.headerTitle,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    container: {
      paddingHorizontal: APP_SPACING.xl,
      paddingTop: APP_SPACING.sm,
      gap: APP_SPACING.lg,
    },
    sectionBlock: {
      gap: 2,
    },
    sectionTitle: {
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: APP_SPACING.xs,
    },
    automationCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.md,
    },
    automationHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: APP_SPACING.md,
    },
    automationHeaderText: {
      flex: 1,
      gap: APP_SPACING.xs,
    },
    automationTitle: {
      fontSize: typography.cardTitle + 2,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    automationBody: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: largeText ? 22 : 20,
    },
    automationSummary: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: largeText ? 22 : 20,
      backgroundColor: colors.cardAltBg,
      borderRadius: APP_RADII.lg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
    },
    automationStatusChip: {
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: 6,
      borderRadius: APP_RADII.md,
      backgroundColor: "#1f7a4d",
    },
    automationStatusChipEnabled: {
      backgroundColor: "#1f7a4d",
    },
    automationStatusChipDisabled: {
      backgroundColor: colors.tagBg,
    },
    automationStatusChipText: {
      fontSize: typography.chipLabel,
      fontWeight: "800",
      color: "#ffffff",
      letterSpacing: typography.chipTracking,
    },
    automationStatusChipTextDisabled: {
      color: colors.textMuted,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.md,
    },
    toggleTextWrap: {
      flex: 1,
      gap: 4,
    },
    toggleTitle: {
      fontSize: typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    toggleBody: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: largeText ? 22 : 20,
    },
    toggleButton: {
      width: 56,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.tagBg,
      padding: 4,
      justifyContent: "center",
    },
    toggleButtonEnabled: {
      backgroundColor: "#3d7ef0",
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#ffffff",
    },
    toggleThumbEnabled: {
      alignSelf: "flex-end",
    },
    fieldGrid: {
      gap: APP_SPACING.sm,
    },
    fieldCard: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
      gap: APP_SPACING.xs,
    },
    fieldLabel: {
      fontSize: typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    fieldInput: {
      minHeight: 44,
      borderRadius: APP_RADII.md,
      borderWidth: 1,
      borderColor: colors.searchInputBorder,
      backgroundColor: colors.searchInputBg,
      paddingHorizontal: APP_SPACING.md,
      color: colors.textPrimary,
      fontSize: typography.body,
    },
    fieldHint: {
      fontSize: typography.small,
      color: colors.textMuted,
      lineHeight: largeText ? 20 : 18,
    },
    modeSectionTitle: {
      fontSize: typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modeOptionsWrap: {
      gap: APP_SPACING.sm,
    },
    modeOption: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    modeOptionSelected: {
      borderColor: "#4b8dff",
      backgroundColor: colors.selectedRowBg,
    },
    modeOptionLabel: {
      fontSize: typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modeOptionLabelSelected: {
      color: "#4b8dff",
    },
    modeOptionDescription: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: largeText ? 22 : 20,
    },
    saveButton: {
      minHeight: 48,
      borderRadius: APP_RADII.lg,
      backgroundColor: "#3d7ef0",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: APP_SPACING.sm,
      paddingHorizontal: APP_SPACING.md,
    },
    saveButtonDisabled: {
      opacity: 0.65,
    },
    saveButtonText: {
      color: "#ffffff",
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    row: {
      minHeight: largeText ? 62 : 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: APP_RADII.lg,
      paddingHorizontal: APP_SPACING.sm,
    },
    rowLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.xxl,
    },
    rowText: {
      fontSize: typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: "500",
      flexShrink: 1,
    },
  });
}
