import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { auth, firebaseConfigError } from "@/lib/firebase";
import {
  DEFAULT_AUTOMATION_SETTINGS,
  subscribeAutomationSettings,
  updateAutomationSettings,
  type AutomationSettings,
  type MissionMode,
} from "@/lib/rover-automation";
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

const missionModeOptions: { label: string; value: MissionMode; description: string }[] = [
  {
    label: "Automatic",
    value: "automatic",
    description: "Primary rover mode. Firmware/cloud triggers monitoring runs automatically.",
  },
  {
    label: "Manual Override",
    value: "manual_override",
    description: "Keep automation visible, but let operators start runs manually when needed.",
  },
  {
    label: "Maintenance",
    value: "maintenance",
    description: "Pause automation while the rover is being serviced or tested.",
  },
];

export default function SettingsScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors, fontScale);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("settings");
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>(
    DEFAULT_AUTOMATION_SETTINGS,
  );
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [fallbackScheduleDraft, setFallbackScheduleDraft] = useState("");

  useEffect(() => {
    try {
      return subscribeAutomationSettings((next) => {
        setAutomationSettings(next);
        setFallbackScheduleDraft(next.fallbackScheduleTimes.join(", "));
      });
    } catch (error) {
      console.warn("Failed to subscribe to automation settings", error);
      return undefined;
    }
  }, []);

  const automationSummary = useMemo(() => {
    if (!automationSettings.automaticMonitoringEnabled) {
      return "Automation is currently disabled. The rover will rely on manual override until automatic monitoring is enabled again.";
    }

    const scheduleText =
      automationSettings.fallbackScheduleEnabled && automationSettings.fallbackScheduleTimes.length > 0
        ? `Fallback schedule: ${automationSettings.fallbackScheduleTimes.join(", ")}.`
        : "No fallback schedule active.";

    return `Automatic monitoring is active with humidity trigger ${automationSettings.humidityTriggerThreshold}% and air temperature trigger ${automationSettings.airTemperatureTriggerThreshold}C. Cooldown: ${automationSettings.cooldownIntervalMinutes} minutes. ${scheduleText}`;
  }, [automationSettings]);

  function patchAutomation<K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) {
    setAutomationSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSaveAutomationSettings() {
    const humidityTriggerThreshold = Number(automationSettings.humidityTriggerThreshold);
    const airTemperatureTriggerThreshold = Number(automationSettings.airTemperatureTriggerThreshold);
    const cooldownIntervalMinutes = Number(automationSettings.cooldownIntervalMinutes);
    const fallbackScheduleTimes = fallbackScheduleDraft
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!Number.isFinite(humidityTriggerThreshold) || humidityTriggerThreshold < 0 || humidityTriggerThreshold > 100) {
      Alert.alert("Invalid humidity trigger", "Humidity trigger threshold must be between 0 and 100.");
      return;
    }

    if (
      !Number.isFinite(airTemperatureTriggerThreshold) ||
      airTemperatureTriggerThreshold < -20 ||
      airTemperatureTriggerThreshold > 80
    ) {
      Alert.alert("Invalid air temperature trigger", "Air temperature trigger threshold must stay within a realistic range.");
      return;
    }

    if (!Number.isFinite(cooldownIntervalMinutes) || cooldownIntervalMinutes < 0) {
      Alert.alert("Invalid cooldown", "Cooldown interval must be zero or greater.");
      return;
    }

    if (
      automationSettings.fallbackScheduleEnabled &&
      fallbackScheduleTimes.some((value) => !/^\d{2}:\d{2}$/.test(value))
    ) {
      Alert.alert(
        "Invalid fallback schedule",
        "Use 24-hour times separated by commas, for example 06:00, 12:00, 18:00.",
      );
      return;
    }

    setSavingAutomation(true);
    try {
      await updateAutomationSettings({
        automaticMonitoringEnabled: automationSettings.automaticMonitoringEnabled,
        humidityTriggerThreshold,
        airTemperatureTriggerThreshold,
        cooldownIntervalMinutes,
        fallbackScheduleEnabled: automationSettings.fallbackScheduleEnabled,
        fallbackScheduleTimes,
        area1VerificationEnabled: automationSettings.area1VerificationEnabled,
        missionMode: automationSettings.missionMode,
      });

      setFallbackScheduleDraft(fallbackScheduleTimes.join(", "));
      Alert.alert("Automation settings saved", "The rover automation configuration was updated in Firebase.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Automation settings could not be saved.";
      Alert.alert("Save failed", message);
    } finally {
      setSavingAutomation(false);
    }
  }

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
        <View style={styles.automationCard}>
          <View style={styles.automationHeader}>
            <View style={styles.automationHeaderText}>
              <Text style={styles.automationTitle}>Automation Settings</Text>
              <Text style={styles.automationBody}>
                Automation is now the rover's primary operating mode. Start Mission stays available as a manual override, while these settings control when the rover should monitor automatically.
              </Text>
            </View>
            <View
              style={[
                styles.automationStatusChip,
                automationSettings.automaticMonitoringEnabled
                  ? styles.automationStatusChipEnabled
                  : styles.automationStatusChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.automationStatusChipText,
                  !automationSettings.automaticMonitoringEnabled &&
                    styles.automationStatusChipTextDisabled,
                ]}
              >
                {automationSettings.automaticMonitoringEnabled ? "ENABLED" : "DISABLED"}
              </Text>
            </View>
          </View>

          <Text style={styles.automationSummary}>{automationSummary}</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Automatic Monitoring</Text>
              <Text style={styles.toggleBody}>
                Turn automation on so cloud and firmware can trigger Area 1 verification and full monitoring runs.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.toggleButton,
                automationSettings.automaticMonitoringEnabled && styles.toggleButtonEnabled,
              ]}
              onPress={() =>
                patchAutomation(
                  "automaticMonitoringEnabled",
                  !automationSettings.automaticMonitoringEnabled,
                )
              }
              accessibilityRole="switch"
              accessibilityState={{ checked: automationSettings.automaticMonitoringEnabled }}
              accessibilityLabel="Toggle automatic monitoring"
            >
              <View
                style={[
                  styles.toggleThumb,
                  automationSettings.automaticMonitoringEnabled && styles.toggleThumbEnabled,
                ]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGrid}>
            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Humidity Trigger Threshold</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(automationSettings.humidityTriggerThreshold)}
                onChangeText={(value) =>
                  patchAutomation("humidityTriggerThreshold", Number(value.replace(/[^\d.-]/g, "")) || 0)
                }
                keyboardType="numeric"
                placeholder="65"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldHint}>Trigger when air humidity trends beyond this threshold.</Text>
            </View>

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Air Temperature Trigger Threshold</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(automationSettings.airTemperatureTriggerThreshold)}
                onChangeText={(value) =>
                  patchAutomation("airTemperatureTriggerThreshold", Number(value.replace(/[^\d.-]/g, "")) || 0)
                }
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldHint}>Trigger when ambient heat suggests a verification run is needed.</Text>
            </View>

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Cooldown Interval (Minutes)</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(automationSettings.cooldownIntervalMinutes)}
                onChangeText={(value) =>
                  patchAutomation("cooldownIntervalMinutes", Number(value.replace(/[^\d.-]/g, "")) || 0)
                }
                keyboardType="numeric"
                placeholder="45"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldHint}>Minimum delay before the next automatic run becomes eligible.</Text>
            </View>
          </View>

          <Text style={styles.modeSectionTitle}>Mission Mode</Text>
          <View style={styles.modeOptionsWrap}>
            {missionModeOptions.map((option) => {
              const selected = automationSettings.missionMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.85}
                  style={[styles.modeOption, selected && styles.modeOptionSelected]}
                  onPress={() => patchAutomation("missionMode", option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set mission mode to ${option.label}`}
                >
                  <Text style={[styles.modeOptionLabel, selected && styles.modeOptionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.modeOptionDescription}>{option.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Area 1 Verification First</Text>
              <Text style={styles.toggleBody}>
                Let the rover verify Area 1 before deciding whether the full field must be checked.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.toggleButton,
                automationSettings.area1VerificationEnabled && styles.toggleButtonEnabled,
              ]}
              onPress={() =>
                patchAutomation(
                  "area1VerificationEnabled",
                  !automationSettings.area1VerificationEnabled,
                )
              }
              accessibilityRole="switch"
              accessibilityState={{ checked: automationSettings.area1VerificationEnabled }}
              accessibilityLabel="Toggle Area 1 verification"
            >
              <View
                style={[
                  styles.toggleThumb,
                  automationSettings.area1VerificationEnabled && styles.toggleThumbEnabled,
                ]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Fallback Schedule</Text>
              <Text style={styles.toggleBody}>
                Use schedule-based monitoring times when environmental triggers are not enough on their own.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.toggleButton,
                automationSettings.fallbackScheduleEnabled && styles.toggleButtonEnabled,
              ]}
              onPress={() =>
                patchAutomation(
                  "fallbackScheduleEnabled",
                  !automationSettings.fallbackScheduleEnabled,
                )
              }
              accessibilityRole="switch"
              accessibilityState={{ checked: automationSettings.fallbackScheduleEnabled }}
              accessibilityLabel="Toggle fallback schedule"
            >
              <View
                style={[
                  styles.toggleThumb,
                  automationSettings.fallbackScheduleEnabled && styles.toggleThumbEnabled,
                ]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Fallback Schedule Times</Text>
            <TextInput
              style={styles.fieldInput}
              value={fallbackScheduleDraft}
              onChangeText={setFallbackScheduleDraft}
              placeholder="06:00, 12:00, 18:00"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldHint}>
              Enter 24-hour times separated by commas. These are saved only when fallback scheduling is enabled.
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.saveButton, savingAutomation && styles.saveButtonDisabled]}
            onPress={() => void handleSaveAutomationSettings()}
            disabled={savingAutomation}
            accessibilityRole="button"
            accessibilityLabel="Save automation settings"
          >
            <Ionicons name="save-outline" size={18} color="#ffffff" />
            <Text style={styles.saveButtonText}>
              {savingAutomation ? "Saving..." : "Save Automation Settings"}
            </Text>
          </TouchableOpacity>
        </View>

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
