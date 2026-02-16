import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useState } from "react";
import * as Linking from "expo-linking";
import { Alert, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { auth, firebaseConfigError } from "@/lib/firebase";
import { clearPairingSession } from "@/lib/pairing-session";

const settingItems = [
  { icon: "share-social-outline", label: "Share App", type: "ion" },
  { icon: "lock-closed-outline", label: "Privacy Policy", type: "ion" },
  { icon: "description", label: "Terms and Conditions", type: "material" },
  { icon: "mail-outline", label: "Contact", type: "ion" },
  { icon: "chatbox-ellipses-outline", label: "Feedback", type: "ion" },
  { icon: "time-outline", label: "Changelog (v1.0.1)", type: "ion" },
  { icon: "log-out-outline", label: "Logout", type: "ion" },
] as const;

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();

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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={openNotifications}>
          <Ionicons name="notifications" size={22} color="#111111" />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications" size={20} color="#4f5561" />
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
          >
            <View style={styles.rowLeft}>
              {item.type === "material" ? (
                <MaterialIcons name={item.icon} size={20} color="#4f5561" />
              ) : (
                <Ionicons name={item.icon} size={20} color="#4f5561" />
              )}
              <Text style={styles.rowText}>{item.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {notificationsSheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8e9ee",
  },
  header: {
    height: 64,
    paddingHorizontal: 18,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111111",
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  rowText: {
    fontSize: 18,
    color: "#1f232b",
    fontWeight: "500",
  },
});
