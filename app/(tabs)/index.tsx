import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { AppActionButton } from "@/components/ui/app-action-button";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ScreenSection } from "@/components/ui/screen-section";
import { SparklineBars } from "@/components/ui/sparkline-bars";
import { useFlightMode } from "@/lib/flight-mode";
import { consumeMappingSelection } from "@/lib/mapping-selection";
import { db } from "@/lib/firebase";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

type HomeStyles = ReturnType<typeof createStyles>;

function MetricCard({
  icon,
  title,
  value,
  valueColor,
  trackColor,
  trendValues,
  isEmpty = false,
  emptyText = "Waiting for data",
  styles,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  valueColor: string;
  trackColor: string;
  trendValues: number[];
  isEmpty?: boolean;
  emptyText?: string;
  styles: HomeStyles;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTitleRow}>
        {icon}
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.tag}>REAL-TIME</Text>
      {isEmpty ? (
        <Text style={styles.metricEmptyText}>{emptyText}</Text>
      ) : (
        <>
          <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
          <SparklineBars values={trendValues} color={valueColor} trackColor={trackColor} />
        </>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const layout = getLayoutProfile(width);
  const typography = getAccessibleAppTypography(width, fontScale);
  const styles = createStyles(width, colors, fontScale);
  const iconSize = layout.isSmall ? 18 : 20;
  const { flightMode, setFlightMode } = useFlightMode();
  const nav = useRouter();
  const [isMapping, setIsMapping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasMapped, setHasMapped] = useState(false);
  const [progress, setProgress] = useState(0);
  const [realTimeTemp, setRealTimeTemp] = useState("0");
  const [realTimeMoist, setRealTimeMoist] = useState("0");
  const [realBatteryLevel, setRealBatteryLevel] = useState("0");
  const [hasTelemetry, setHasTelemetry] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [moistureTrend, setMoistureTrend] = useState<number[]>([]);
  const [tempTrend, setTempTrend] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionDialogShownRef = useRef(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("index");

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
      setTelemetryError("Telemetry offline: Firebase database is not connected.");
      return;
    }

    const unsubTemp = onValue(ref(db, "temperature_data"), (snapshot) => {
      if (snapshot.exists()) {
        const next = Number(snapshot.val());
        setRealTimeTemp(String(snapshot.val()));
        if (Number.isFinite(next)) {
          setHasTelemetry(true);
          setTempTrend((prev) => [...prev.slice(-9), next]);
        }
      }
    });

    const unsubMoisture = onValue(ref(db, "Moisture_data"), (snapshot) => {
      if (snapshot.exists()) {
        const next = Number(snapshot.val());
        setRealTimeMoist(String(snapshot.val()));
        if (Number.isFinite(next)) {
          setHasTelemetry(true);
          setMoistureTrend((prev) => [...prev.slice(-9), next]);
        }
      }
    });

    const unsubBattery = onValue(ref(db, "battery_level"), (snapshot) => {
      if (snapshot.exists()) {
        setRealBatteryLevel(String(snapshot.val()));
        setHasTelemetry(true);
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
  const drillRpmDisplay = isMapping || isAnalyzing ? "1200 RPM" : "0 RPM";
  const operationStatusText = isMapping
    ? "Drilling and mapping in progress."
    : isAnalyzing
      ? `Analyzing collected data (${Math.round(progress * 100)}%).`
      : hasMapped
        ? "Mapping complete. View summary for recommendations."
        : "System idle. Start mapping to begin drilling diagnostics.";
  const tempDisplay =
    realTimeTemp.includes("°") || /c$/i.test(realTimeTemp.trim())
      ? realTimeTemp
      : `${realTimeTemp}°C`;
  const offlineStatus = useMemo(() => {
    if (telemetryError) {
      return telemetryError;
    }
    if (!hasTelemetry) {
      return "Waiting for live telemetry stream...";
    }
    return null;
  }, [hasTelemetry, telemetryError]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 650);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Drone Dashboard</Text>
        <View style={styles.headerRight}>
          <View style={styles.modeChip}>
            <Text style={styles.modeChipText}>{flightMode.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            onPress={openNotifications}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: APP_SPACING.lg + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />}
      >
        <View style={styles.topStatusRow}>
          <View style={styles.topStatusChip}>
            <Text style={styles.topStatusText}>Device: Linked</Text>
          </View>
          <View style={styles.topStatusChip}>
            <Text style={styles.topStatusText}>GPS: Stable</Text>
          </View>
          <View style={styles.topStatusChip}>
            <Text style={styles.topStatusText}>Signal: Strong</Text>
          </View>
          <View style={styles.topStatusChip}>
            <Text style={styles.topStatusText}>{`Battery ${batteryDisplay}`}</Text>
          </View>
        </View>

        <FadeInView delay={30}>
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
            {!hasTelemetry && !isMapping && !isAnalyzing ? (
              <View style={styles.mapEmptyOverlay}>
                <Text style={styles.mapEmptyText}>No live map telemetry yet</Text>
              </View>
            ) : null}
            <Text style={styles.googleText}>Google</Text>
          </View>
        </FadeInView>

        <View style={styles.helperHintRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.helperHintText}>
            Auto mode runs mapping flow. Manual mode is for direct route control only.
          </Text>
        </View>

        {offlineStatus ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.offlineText}>{offlineStatus}</Text>
          </View>
        ) : null}

        <FadeInView delay={70} style={styles.actionRow}>
          <View style={styles.actionButtonWrap}>
            <AppActionButton
              label={isMapping || isAnalyzing ? "Cancel Mapping" : "Start Mapping"}
              icon="play-circle"
              onPress={handleStartMapping}
              backgroundColor={colors.actionStartBg}
              borderColor={colors.summaryBorder}
              textColor={colors.onAccent}
              compact={layout.isSmall}
              accessibilityHint="Starts a mapping run in auto mode"
            />
          </View>
          <View style={styles.actionButtonWrap}>
            <AppActionButton
              label={`Mode: ${flightMode}`}
              icon="settings"
              onPress={selectMode}
              backgroundColor={colors.actionModeBg}
              borderColor={colors.summaryBorder}
              textColor={colors.onAccent}
              compact={layout.isSmall}
              accessibilityHint="Changes between auto and manual flight modes"
            />
          </View>
        </FadeInView>

        <FadeInView delay={110} style={styles.metricsRow}>
          <MetricCard
            title="Soil Moisture"
            value={moistureDisplay}
            valueColor="#3f7ee8"
            icon={<Ionicons name="water" size={iconSize} color="#3f7ee8" />}
            trackColor={colors.tagBg}
            trendValues={moistureTrend}
            isEmpty={!hasTelemetry}
            styles={styles}
          />
          <MetricCard
            title="Temperature"
            value={tempDisplay}
            valueColor="#f65152"
            icon={<Ionicons name="thermometer" size={iconSize} color="#f65152" />}
            trackColor={colors.tagBg}
            trendValues={tempTrend}
            isEmpty={!hasTelemetry}
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={140} style={styles.metricsRow}>
          <MetricCard
            title="Battery"
            value={batteryDisplay}
            valueColor="#0a9e95"
            icon={<Ionicons name="battery-full" size={iconSize} color="#0a9e95" />}
            trackColor={colors.tagBg}
            trendValues={[45, 56, 62, 68, 74, Number(realBatteryLevel) || 0]}
            isEmpty={!hasTelemetry}
            styles={styles}
          />
          <MetricCard
            title="Drill RPM"
            value={drillRpmDisplay}
            valueColor={colors.metricRpm}
            icon={<Ionicons name="speedometer-outline" size={iconSize} color={colors.metricRpm} />}
            trackColor={colors.tagBg}
            trendValues={isMapping || isAnalyzing ? [650, 810, 980, 1110, 1180, 1200] : [0, 0, 0, 0, 0, 0]}
            isEmpty={!hasTelemetry && !isMapping && !isAnalyzing}
            emptyText="Standby"
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={170}>
          <ScreenSection
            title="Operation Overview"
            titleColor={colors.textPrimary}
            titleSize={typography.cardTitle}
            borderColor={colors.cardBorder}
            backgroundColor={colors.cardBg}
            style={styles.statusPanel}
          >
            <Text style={styles.statusPanelBody}>{operationStatusText}</Text>
            <View style={styles.statusMetaRow}>
              <Text style={styles.statusMeta}>{`Mode: ${flightMode}`}</Text>
              <Text style={styles.statusMeta}>{`Drill: ${drillRpmDisplay}`}</Text>
            </View>
          </ScreenSection>
        </FadeInView>
      </ScrollView>

      <View style={[styles.summaryDock, { paddingBottom: Math.max(insets.bottom, APP_SPACING.md) }]}>
        <AppActionButton
          label="Summary"
          onPress={handleSummary}
          backgroundColor={colors.summaryBg}
          borderColor={colors.summaryBorder}
          textColor={colors.onAccent}
          compact={layout.isSmall}
          accessibilityHint="Opens summary recommendations and alerts"
        />
      </View>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"], fontScale: number) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const layout = getLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const { compact, regular } = typography;
  const mapHeight = layout.isSmall ? 160 : layout.isLarge ? 218 : regular ? 182 : 200;
  const summaryWidth = layout.isLarge
    ? 300
    : Math.min(250, Math.max(184, width * 0.58));

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
      letterSpacing: 0.2,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    modeChip: {
      borderWidth: 1,
      borderColor: colors.summaryBorder,
      backgroundColor: colors.actionModeBg,
      borderRadius: APP_RADII.md,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.xs,
    },
    modeChipText: {
      color: colors.onAccent,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    content: {
      flexGrow: 1,
      width: "100%",
      maxWidth: layout.isLarge ? 980 : 560,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? APP_SPACING.md : layout.isLarge ? APP_SPACING.xxl : APP_SPACING.xl,
      paddingTop: APP_SPACING.md,
    },
    topStatusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.xs,
      marginBottom: APP_SPACING.sm,
    },
    topStatusChip: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      borderRadius: APP_RADII.md,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: largeText ? APP_SPACING.sm : APP_SPACING.xs,
    },
    topStatusText: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
      flexShrink: 1,
    },
    mapCard: {
      height: largeText ? mapHeight + 12 : mapHeight,
      borderRadius: APP_RADII.sm,
      backgroundColor: colors.mapCardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      justifyContent: "flex-end",
      padding: APP_SPACING.md,
      overflow: "hidden",
    },
    mappingBanner: {
      position: "absolute",
      top: APP_SPACING.sm,
      left: APP_SPACING.sm,
      right: APP_SPACING.sm,
      backgroundColor: colors.noticeBg,
      borderRadius: APP_RADII.md,
      paddingVertical: 6,
      paddingHorizontal: APP_SPACING.md,
      zIndex: 2,
    },
    mappingBannerText: {
      color: colors.onAccent,
      textAlign: "center",
      fontWeight: "700",
      fontSize: typography.small,
    },
    mapEmptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
    mapEmptyText: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    googleText: {
      fontSize: typography.body,
      fontWeight: "600",
      color: colors.textMuted,
    },
    helperHintRow: {
      marginTop: APP_SPACING.sm,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.xs,
      paddingHorizontal: 2,
    },
    helperHintText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: typography.small,
      lineHeight: typography.compact ? 15 : 17,
    },
    offlineBanner: {
      marginTop: APP_SPACING.sm,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.xs,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.md,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.xs,
    },
    offlineText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "600",
    },
    actionRow: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      gap: layout.isSmall ? APP_SPACING.sm : APP_SPACING.md,
    },
    actionButtonWrap: {
      flex: 1,
    },
    metricsRow: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      gap: layout.isSmall ? APP_SPACING.sm : APP_SPACING.md,
    },
    metricCard: {
      flex: 1,
      minHeight: typography.compact ? 120 : 128,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: typography.compact ? APP_SPACING.sm : APP_SPACING.md,
      paddingTop: APP_SPACING.md,
    },
    metricTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    metricTitle: {
      fontSize: typography.cardTitle,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    tag: {
      marginTop: typography.compact ? APP_SPACING.md : APP_SPACING.lg,
      alignSelf: "center",
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      letterSpacing: typography.chipTracking,
      fontWeight: "700",
      backgroundColor: colors.tagBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: APP_RADII.md,
    },
    metricValue: {
      marginTop: typography.compact ? APP_SPACING.md : APP_SPACING.lg,
      alignSelf: "center",
      fontSize: typography.value,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    metricEmptyText: {
      marginTop: APP_SPACING.lg,
      alignSelf: "center",
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
    },
    statusPanel: {
      marginTop: APP_SPACING.md,
      borderRadius: APP_RADII.xl,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 0,
      minHeight: compact ? 104 : 120,
      justifyContent: "space-between",
    },
    statusPanelBody: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: typography.compact ? 19 : 21,
      marginBottom: APP_SPACING.md,
    },
    statusMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: APP_SPACING.md,
    },
    statusMeta: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      color: colors.textMuted,
    },
    summaryDock: {
      paddingTop: APP_SPACING.md,
      backgroundColor: colors.screenBg,
      width: summaryWidth,
      alignSelf: "center",
    },
  });
}
