import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
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
  addPairedDevice,
  getPairedDevices,
  removePairedDeviceByIndex,
  setActiveDevice,
} from "@/lib/pairing-session";

const pairMethods = ["Wi-Fi", "Device ID", "QR Code"] as const;

export default function PairDeviceScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const styles = useMemo(() => createStyles(compact), [compact]);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [devices, setDevices] = useState<string[]>(() => getPairedDevices());

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
    const deviceName = `Drone (${method}) ${devices.length + 1}`;
    addPairedDevice(deviceName);
    setDevices(getPairedDevices());
    Alert.alert("Device paired", `Device paired via ${method}.`);
  }

  function openMainApp(deviceName: string) {
    setActiveDevice(deviceName);
    router.replace("/(tabs)");
  }

  function removeDevice(index: number) {
    removePairedDeviceByIndex(index);
    setDevices(getPairedDevices());
    Alert.alert("Device removed", "The paired device was removed.");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pair Device</Text>
      </View>

      <View style={styles.content}>
        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="airplane" size={90} color="#ffffff" />
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
                onPress={() => openMainApp(item)}
                onLongPress={() => removeDevice(index)}
              >
                <Ionicons name="airplane" size={22} color="#ffffff" />
                <Text style={styles.deviceName}>{item}</Text>
                <Ionicons name="chevron-forward" size={18} color="#d5d8df" />
              </Pressable>
            )}
          />
        )}

        <Pressable style={styles.pairButton} onPress={() => setIsPairModalOpen(true)}>
          <MaterialCommunityIcons name="link-plus" size={22} color="#0f1115" />
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
                  setIsPairModalOpen(false);
                  pairNewDevice(method);
                }}
              >
                <Text style={styles.methodButtonText}>{`Pair via ${method}`}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancelButton} onPress={() => setIsPairModalOpen(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(compact: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#090a0d",
    },
    header: {
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: "#1f222a",
    },
    headerTitle: {
      color: "#f6f7fb",
      fontSize: compact ? 20 : 21,
      fontWeight: "700",
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
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
      color: "#ffffff",
      fontSize: compact ? 24 : 26,
      fontWeight: "700",
      textAlign: "center",
    },
    emptyBody: {
      color: "#b4b9c4",
      fontSize: compact ? 14 : 16,
      textAlign: "center",
    },
    listContainer: {
      paddingTop: 14,
      paddingBottom: 20,
      gap: 10,
    },
    deviceCard: {
      minHeight: 60,
      borderRadius: 12,
      backgroundColor: "#ffffff1c",
      borderWidth: 1,
      borderColor: "#ffffff2f",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 12,
    },
    deviceName: {
      flex: 1,
      color: "#ffffff",
      fontSize: compact ? 16 : 17,
      fontWeight: "500",
    },
    pairButton: {
      height: 52,
      borderRadius: 12,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    pairButtonText: {
      fontSize: 16,
      color: "#0f1115",
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "#00000066",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: "#ffffff",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 30,
    },
    modalTitle: {
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: "#111318",
      marginBottom: 16,
    },
    methodButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor: "#eef3fb",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    methodButtonText: {
      color: "#1f2f4d",
      fontSize: 16,
      fontWeight: "600",
    },
    cancelButton: {
      marginTop: 8,
      alignItems: "center",
      justifyContent: "center",
      height: 44,
    },
    cancelButtonText: {
      color: "#d14343",
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
