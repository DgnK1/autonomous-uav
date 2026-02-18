import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/lib/firebase";
import {
  AUTH_RADII,
  AUTH_SPACING,
  getAccessibleAuthTypography,
  getAuthLayoutProfile,
  type AuthColors,
  useAuthTheme,
} from "@/lib/ui/auth-ui";
import {
  addPairedDevice,
  ensurePairingHydrated,
  getPairedDevices,
  removePairedDeviceByIndex,
  setActiveDevice,
} from "@/lib/pairing-session";

const pairMethods = ["Wi-Fi", "Device ID", "QR Code"] as const;

export default function PairDeviceScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { mode, colors } = useAuthTheme();
  const isDark = mode === "dark";
  const styles = useMemo(() => createStyles(width, colors, mode, fontScale), [width, colors, mode, fontScale]);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [devices, setDevices] = useState<string[]>(() => getPairedDevices());
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setIsBusy(true);
    void ensurePairingHydrated()
      .then(() => {
        setDevices(getPairedDevices());
      })
      .finally(() => {
        setIsBusy(false);
      });
  }, []);

  useEffect(() => {
    if (!auth) {
      router.replace("/login");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!user.isAnonymous && !user.emailVerified) {
        router.replace("/verify-email");
      }
    });

    return unsubscribe;
  }, []);

  function pairNewDevice(method: (typeof pairMethods)[number]) {
    setIsBusy(true);
    const deviceName = `Drone (${method}) ${devices.length + 1}`;
    addPairedDevice(deviceName);
    setDevices(getPairedDevices());
    setIsBusy(false);
    Alert.alert("Device paired", `Device paired via ${method}.`);
  }

  function openMainApp(deviceName: string) {
    setIsBusy(true);
    setActiveDevice(deviceName);
    router.replace("/(tabs)");
  }

  function removeDevice(index: number) {
    setIsBusy(true);
    removePairedDeviceByIndex(index);
    setDevices(getPairedDevices());
    setIsBusy(false);
    Alert.alert("Device removed", "The paired device was removed.");
  }

  function confirmRemoveDevice(index: number) {
    Alert.alert("Remove paired device?", "This will remove the device from your paired list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeDevice(index),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pair Device</Text>
      </View>

      <View style={styles.content}>
        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="airplane" size={90} color={colors.textPrimary} />
            <Text style={styles.emptyTitle}>Pair Your Drone Device</Text>
            <Text style={styles.emptyBody}>Connect your UAV device to begin monitoring.</Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => (
              <Pressable
                style={styles.deviceCard}
                onPress={() => !isBusy && openMainApp(item)}
                onLongPress={() => !isBusy && confirmRemoveDevice(index)}
              >
                <Ionicons name="airplane" size={22} color={colors.textPrimary} />
                <Text style={styles.deviceName}>{item}</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (!isBusy) {
                      confirmRemoveDevice(index);
                    }
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={isDark ? "#ff9ea0" : "#c94949"} />
                </Pressable>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isDark ? "#d5d8df" : colors.textSecondary}
                />
              </Pressable>
            )}
          />
        )}

        <Pressable style={styles.pairButton} onPress={() => setIsPairModalOpen(true)} disabled={isBusy}>
          <MaterialCommunityIcons name="link-plus" size={22} color={isDark ? "#0f1115" : "#f3f6fb"} />
          <Text style={styles.pairButtonText}>Pair a New Device</Text>
        </Pressable>
      </View>

      <Modal transparent visible={isPairModalOpen} animationType="slide" onRequestClose={() => setIsPairModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Pair a Device</Text>
            {pairMethods.map((method) => (
              <Pressable
                key={method}
                style={styles.methodButton}
                onPress={() => {
                  if (isBusy) {
                    return;
                  }
                  setIsPairModalOpen(false);
                  pairNewDevice(method);
                }}
              >
                <Text style={styles.methodButtonText}>{`Pair via ${method}`}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancelButton} onPress={() => setIsPairModalOpen(false)} disabled={isBusy}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {isBusy && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AuthColors, mode: "light" | "dark", fontScale: number) {
  const typography = getAccessibleAuthTypography(width, fontScale);
  const layout = getAuthLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const isDark = mode === "dark";
  const screenMaxWidth = layout.isLarge ? 560 : 460;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: largeText ? 62 : 56,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#1f222a" : colors.border,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: typography.compact ? 20 : 21,
      fontWeight: "700",
    },
    content: {
      flex: 1,
      width: "100%",
      maxWidth: screenMaxWidth,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? AUTH_SPACING.xxl : AUTH_SPACING.xxxl,
      paddingBottom: 28,
      justifyContent: "space-between",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: typography.compact ? 24 : 26,
      fontWeight: "700",
      textAlign: "center",
    },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: typography.link,
      textAlign: "center",
    },
    listContainer: {
      paddingTop: AUTH_SPACING.xl,
      paddingBottom: AUTH_SPACING.xxxl,
      gap: AUTH_SPACING.md,
    },
    deviceCard: {
      minHeight: largeText ? 68 : 60,
      borderRadius: AUTH_RADII.xl,
      backgroundColor: isDark ? "#ffffff1c" : "#ffffff",
      borderWidth: 1,
      borderColor: isDark ? "#ffffff2f" : colors.border,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: AUTH_SPACING.xl,
      gap: AUTH_SPACING.lg,
    },
    deviceName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: typography.input,
      fontWeight: "500",
    },
    removeButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: AUTH_RADII.md,
      backgroundColor: isDark ? "#ffffff12" : "#00000008",
    },
    pairButton: {
      minHeight: largeText ? 58 : 52,
      borderRadius: AUTH_RADII.xl,
      backgroundColor: isDark ? "#ffffff" : "#212733",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: AUTH_SPACING.md,
      marginBottom: AUTH_SPACING.sm,
    },
    pairButtonText: {
      fontSize: 16,
      color: isDark ? "#0f1115" : "#f3f6fb",
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: isDark ? "#ffffff" : "#f7f8fb",
      borderTopLeftRadius: AUTH_RADII.xxl,
      borderTopRightRadius: AUTH_RADII.xxl,
      paddingHorizontal: AUTH_SPACING.xxxl,
      paddingTop: AUTH_SPACING.xxl,
      paddingBottom: 30,
    },
    modalTitle: {
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: "#111318",
      marginBottom: AUTH_SPACING.lg,
    },
    methodButton: {
      minHeight: largeText ? 54 : 48,
      borderRadius: AUTH_RADII.xl,
      backgroundColor: "#eef3fb",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: AUTH_SPACING.md,
    },
    methodButtonText: {
      color: "#1f2f4d",
      fontSize: 16,
      fontWeight: "600",
    },
    cancelButton: {
      marginTop: AUTH_SPACING.sm,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    cancelButtonText: {
      color: "#d14343",
      fontSize: 16,
      fontWeight: "600",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
