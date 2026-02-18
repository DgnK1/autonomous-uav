import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useState } from "react";
import * as Linking from "expo-linking";
import { Alert, Share, StyleSheet, Switch, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { auth, firebaseConfigError } from "@/lib/firebase";
import { clearPairingSession } from "@/lib/pairing-session";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

const settingItems = [
  { icon: "share-social-outline", label: "Share App" },
  { icon: "lock-closed-outline", label: "Privacy Policy" },
  { icon: "document-text-outline", label: "Terms and Conditions" },
  { icon: "mail-outline", label: "Contact" },
  { icon: "chatbox-ellipses-outline", label: "Feedback" },
  { icon: "time-outline", label: "Changelog (v1.0.1)" },
  { icon: "log-out-outline", label: "Logout" },
] as const;

export default function SettingsScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors, fontScale);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("settings");

  async function handleLogout() {
    if (!auth) {
      Alert.alert("Firebase not configured", firebaseConfigError ?? "Missing Firebase config.");
      return;
    }

    try {
      await signOut(auth);
      clearPairingSession();
      router.replace("/login");
    } catch {
      Alert.alert("Logout failed", "Please try again.");
    }
  }

  async function handleSettingAction(label: (typeof settingItems)[number]["label"]) {
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

    if (label === "Changelog (v1.0.1)") {
      Alert.alert(
        "Changelog – Version 1.0.1",
        [
          "• Auto / Manual flight mode separation for mapping and manual controls.",
          "• Expanded mapping view with full-screen map and in-map Cancel Mapping.",
          "• Mapping completion dialog after mapping and analysis finish.",
          "• Summary button requires mapping completion.",
          "• Soil Monitoring includes Next Action recommendation.",
          "• pH card removed from Home dashboard and tables.",
          "• Tables updated for full-width aligned columns.",
        ].join("\n")
      );
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

      <View style={[styles.container, { paddingBottom: APP_SPACING.md + insets.bottom }]}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications" size={20} color={colors.rowIcon} />
            <Text style={styles.rowText}>Notification</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
        </View>

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
