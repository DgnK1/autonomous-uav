import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { useFlightMode } from "@/lib/flight-mode";
import { consumeMappingSelection } from "@/lib/mapping-selection";
import { db } from "@/lib/firebase";

type HomeStyles = ReturnType<typeof createStyles>;

function MetricCard({
  icon,
  title,
  value,
  valueColor,
  styles,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  valueColor: string;
  styles: HomeStyles;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTitleRow}>
        {icon}
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.tag}>REAL-TIME</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const styles = createStyles(width);
  const iconSize = width < 360 ? 18 : 20;
  const { flightMode, setFlightMode } = useFlightMode();
  const nav = useRouter();
  const [isMapping, setIsMapping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasMapped, setHasMapped] = useState(false);
  const [progress, setProgress] = useState(0);
  const [realTimeTemp, setRealTimeTemp] = useState("0");
  const [realTimeMoist, setRealTimeMoist] = useState("0");
  const [realBatteryLevel, setRealBatteryLevel] = useState("0");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionDialogShownRef = useRef(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();

  const stopLifecycle = useCallback((resetMappedState = false) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMapping(false);
    setIsAnalyzing(false);
    setProgress(0);
    if (resetMappedState) {
      setHasMapped(false);
    }
  }, []);

  useEffect(() => {
    if (!db) {
      return;
    }

    const unsubTemp = onValue(ref(db, "temperature_data"), (snapshot) => {
      if (snapshot.exists()) {
        setRealTimeTemp(String(snapshot.val()));
      }
    });

    const unsubMoisture = onValue(ref(db, "Moisture_data"), (snapshot) => {
      if (snapshot.exists()) {
        setRealTimeMoist(String(snapshot.val()));
      }
    });

    const unsubBattery = onValue(ref(db, "battery_level"), (snapshot) => {
      if (snapshot.exists()) {
        setRealBatteryLevel(String(snapshot.val()));
      }
    });

    return () => {
      unsubTemp();
      unsubMoisture();
      unsubBattery();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const runPhase = useCallback(
    (phase: "mapping" | "analyzing", durationMs: number, onComplete: () => void) => {
      const start = Date.now();
      setProgress(0);
      setIsMapping(phase === "mapping");
      setIsAnalyzing(phase === "analyzing");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(1, elapsed / durationMs);
        setProgress(pct);

        if (pct >= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onComplete();
        }
      }, 120);
    },
    []
  );

  const startMappingLifecycle = useCallback(() => {
    completionDialogShownRef.current = false;
    setHasMapped(false);
    runPhase("mapping", 10_000, () => {
      runPhase("analyzing", 30_000, () => {
        setIsMapping(false);
        setIsAnalyzing(false);
        setProgress(1);
        setHasMapped(true);
        if (!completionDialogShownRef.current) {
          completionDialogShownRef.current = true;
          Alert.alert("Mapping Complete", "Soil mapping and analysis are finished.");
        }
      });
    });
  }, [runPhase]);

  useFocusEffect(
    useCallback(() => {
      const selectedPoints = consumeMappingSelection();
      if (selectedPoints && selectedPoints.length === 4) {
        startMappingLifecycle();
      }
    }, [startMappingLifecycle])
  );

  function selectMode() {
    Alert.alert("Select Flight Mode", "Choose a mode to continue.", [
      {
        text: "Auto Mode",
        onPress: () => setFlightMode("Auto"),
      },
      {
        text: "Manual Mode",
        onPress: () => setFlightMode("Manual"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  function handleStartMapping() {
    if (flightMode === "Manual") {
      Alert.alert(
        "Manual Mode Active",
        "You are currently in Manual Mode. Use the MANUAL tab to control the drone and define paths."
      );
      return;
    }

    if (isMapping || isAnalyzing) {
      Alert.alert("Cancel Mapping?", "Are you sure you want to cancel the mapping process?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => stopLifecycle(true),
        },
      ]);
      return;
    }

    if (hasMapped) {
      Alert.alert("New Mapping?", "A mapping already exists. Start a new one?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Start New Scan",
          onPress: () => {
            setHasMapped(false);
            nav.push("/mapping-area");
          },
        },
      ]);
      return;
    }

    nav.push("/mapping-area");
  }

  function handleSummary() {
    if (hasMapped && !isMapping && !isAnalyzing) {
      router.push("/summary");
      return;
    }
    Alert.alert(
      "Finish Mapping First",
      "Please complete the mapping and analysis before viewing the summary."
    );
  }

  const moistureDisplay = realTimeMoist.includes("%") ? realTimeMoist : `${realTimeMoist}%`;
  const batteryDisplay = realBatteryLevel.includes("%") ? realBatteryLevel : `${realBatteryLevel}%`;
  const tempDisplay =
    realTimeTemp.includes("°") || /c$/i.test(realTimeTemp.trim())
      ? realTimeTemp
      : `${realTimeTemp}°C`;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Drone Dashboard</Text>
        <TouchableOpacity onPress={openNotifications}>
          <Ionicons name="notifications" size={22} color="#111111" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.mapCard}>
          {(isMapping || isAnalyzing) && (
            <View style={styles.mappingBanner}>
              <Text style={styles.mappingBannerText}>
                {isMapping
                  ? "Mapping in Progress..."
                  : `Analyzing Soil Data (${Math.round(progress * 100)}%)`}
              </Text>
            </View>
          )}
          <Text style={styles.googleText}>Google</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartMapping}
          >
            <Ionicons name="play-circle" size={iconSize} color="#111111" />
            <Text style={styles.startText}>{isMapping || isAnalyzing ? "Cancel Mapping" : "Start Mapping"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.modeButton]}
            onPress={selectMode}
          >
            <Ionicons name="settings" size={iconSize} color="#111111" />
            <Text style={styles.modeText}>{`Mode: ${flightMode}`}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            title="Soil Moisture"
            value={moistureDisplay}
            valueColor="#3f7ee8"
            icon={<Ionicons name="water" size={iconSize} color="#3f7ee8" />}
            styles={styles}
          />
          <MetricCard
            title="Temperature"
            value={tempDisplay}
            valueColor="#f65152"
            icon={<MaterialCommunityIcons name="thermometer" size={iconSize} color="#f65152" />}
            styles={styles}
          />
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            title="Battery"
            value={batteryDisplay}
            valueColor="#0a9e95"
            icon={<MaterialIcons name="battery-full" size={iconSize} color="#0a9e95" />}
            styles={styles}
          />
          <View style={styles.placeholderCard} />
        </View>
      </ScrollView>

      <View style={styles.summaryDock}>
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.summaryButton}
          onPress={handleSummary}
        >
          <Text style={styles.summaryText}>Summary</Text>
        </TouchableOpacity>
      </View>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number) {
  const compact = width < 360;
  const regular = width >= 360 && width < 414;
  const mapHeight = compact ? 148 : regular ? 164 : 182;
  const summaryWidth = Math.min(250, Math.max(184, width * 0.58));

  return StyleSheet.create({
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
      fontSize: compact ? 21 : 23,
      fontWeight: "700",
      color: "#111111",
      letterSpacing: 0.2,
    },
    content: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
    },
    mapCard: {
      height: mapHeight,
      borderRadius: 4,
      backgroundColor: "#d8d4ce",
      borderWidth: 1,
      borderColor: "#dbdbdb",
      justifyContent: "flex-end",
      padding: 10,
      overflow: "hidden",
    },
    mappingBanner: {
      position: "absolute",
      top: 8,
      left: 8,
      right: 8,
      backgroundColor: "#000000a4",
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      zIndex: 2,
    },
    mappingBannerText: {
      color: "#ffffff",
      textAlign: "center",
      fontWeight: "700",
      fontSize: compact ? 11 : 12,
    },
    googleText: {
      fontSize: compact ? 13 : 14,
      fontWeight: "600",
      color: "#4f4f4f",
    },
    actionRow: {
      marginTop: 10,
      flexDirection: "row",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      height: compact ? 48 : 52,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      borderWidth: 1,
      borderColor: "#d7d7d7",
    },
    startButton: {
      backgroundColor: "#b0f44e",
    },
    modeButton: {
      backgroundColor: "#f9aa3a",
    },
    startText: {
      fontSize: compact ? 13 : 15,
      fontWeight: "700",
      color: "#111111",
    },
    modeText: {
      fontSize: compact ? 13 : 15,
      fontWeight: "700",
      color: "#111111",
    },
    metricsRow: {
      marginTop: 10,
      flexDirection: "row",
      gap: 10,
    },
    metricCard: {
      flex: 1,
      minHeight: compact ? 120 : 128,
      borderRadius: 12,
      backgroundColor: "#ececef",
      borderWidth: 1,
      borderColor: "#cdced3",
      paddingHorizontal: compact ? 8 : 10,
      paddingTop: 10,
    },
    metricTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    metricTitle: {
      fontSize: compact ? 11 : 12,
      color: "#242424",
      fontWeight: "600",
    },
    tag: {
      marginTop: compact ? 10 : 12,
      alignSelf: "center",
      color: "#3a3a3a",
      fontSize: 9,
      letterSpacing: 0.5,
      fontWeight: "700",
      backgroundColor: "#d4d6db",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    metricValue: {
      marginTop: compact ? 10 : 12,
      alignSelf: "center",
      fontSize: compact ? 17 : 19,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    placeholderCard: {
      flex: 1,
    },
    summaryButton: {
      width: summaryWidth,
      alignSelf: "center",
      height: compact ? 54 : 58,
      borderRadius: 12,
      backgroundColor: "#2994ea",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#2582cc",
    },
    summaryDock: {
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: "#e8e9ee",
    },
    summaryText: {
      color: "#ffffff",
      fontSize: compact ? 16 : 18,
      fontWeight: "700",
    },
  });
}
