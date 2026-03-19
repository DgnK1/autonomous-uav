import { useNotificationsSheet } from "@/components/notifications-sheet";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ScreenSection } from "@/components/ui/screen-section";
import { SparklineBars } from "@/components/ui/sparkline-bars";
import { db } from "@/lib/firebase";
import { plotsStore, usePlotsStore } from "@/lib/plots-store";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  useAppTheme,
  type AppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onValue, ref } from "firebase/database";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type HomeStyles = ReturnType<typeof createStyles>;

function getMoistureStatusColor(value: number) {
  if (value < 30 || value > 85) {
    return "#ef4444";
  }
  if (value < 45 || value > 75) {
    return "#facc15";
  }
  return "#22c55e";
}

function getTemperatureStatusColor(value: number) {
  if (value < 18 || value > 35) {
    return "#ef4444";
  }
  if (value < 22 || value > 30) {
    return "#facc15";
  }
  return "#22c55e";
}

function MetricCard({
  icon,
  title,
  value,
  valueColor,
  trackColor,
  trendValues,
  isEmpty = false,
  emptyText = "Waiting for data",
  hideTrend = false,
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
  hideTrend?: boolean;
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
          <Text style={[styles.metricValue, { color: valueColor }]}>
            {value}
          </Text>
          {!hideTrend ? (
            <SparklineBars
              values={trendValues}
              color={valueColor}
              trackColor={trackColor}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

function DashboardAction({
  icon,
  label,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: HomeStyles;
}) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={18} color="#ffffff" />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
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
  const nav = useRouter();
  const { plots, selectedPlotId } = usePlotsStore();
  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null,
    [plots, selectedPlotId],
  );
  const [realTimeTemp, setRealTimeTemp] = useState("0");
  const [realTimeMoist, setRealTimeMoist] = useState("0");
  const [realBatteryLevel, setRealBatteryLevel] = useState("0");
  const [hasTelemetry, setHasTelemetry] = useState(false);
  const [moistureTrend, setMoistureTrend] = useState<number[]>([]);
  const [tempTrend, setTempTrend] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("index");

  useEffect(() => {
    if (!db) {
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

  const moistureDisplay = realTimeMoist.includes("%")
    ? realTimeMoist
    : `${realTimeMoist}%`;
  const batteryDisplay = realBatteryLevel.includes("%")
    ? realBatteryLevel
    : `${realBatteryLevel}%`;
  const tempDisplay =
    realTimeTemp.includes("°") || /c$/i.test(realTimeTemp.trim())
      ? realTimeTemp
      : `${realTimeTemp}°C`;
  const selectedLocation = selectedPlot
    ? `${selectedPlot.latitude.toFixed(4)}, ${selectedPlot.longitude.toFixed(4)}`
    : "No saved area";
  const numericMoisture = Number.parseFloat(realTimeMoist);
  const numericTemperature = Number.parseFloat(realTimeTemp);
  const moistureStatusColor = Number.isFinite(numericMoisture)
    ? getMoistureStatusColor(numericMoisture)
    : "#3f7ee8";
  const temperatureStatusColor = Number.isFinite(numericTemperature)
    ? getTemperatureStatusColor(numericTemperature)
    : "#f65152";
  const locationTrend = useMemo(() => {
    if (!selectedPlot) {
      return [0, 0, 0, 0, 0, 0];
    }
    return [
      selectedPlot.latitude,
      selectedPlot.latitude + 0.0003,
      selectedPlot.latitude - 0.0002,
      selectedPlot.longitude,
      selectedPlot.longitude + 0.0002,
      selectedPlot.longitude,
    ];
  }, [selectedPlot]);
  const operationStatusText = selectedPlot
    ? `${selectedPlot.title} is selected for monitoring. Telemetry cards below track the latest moisture, temperature, battery, and area location snapshot.`
    : "No active area selected. Set a location to begin monitoring the dashboard.";
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 650);
  }, []);

  function handleSetLocation() {
    nav.push("/mapping-area");
  }

  function handleRemoveLocation() {
    if (!selectedPlot) {
      Alert.alert("No location selected", "There is no active area to remove.");
      return;
    }

    Alert.alert(
      "Remove location?",
      `Remove ${selectedPlot.title} from Active Areas?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => plotsStore.removePlot(selectedPlot.id),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Drone Dashboard</Text>
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: APP_SPACING.lg + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.icon}
          />
        }
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
            <Text
              style={styles.topStatusText}
            >{`Battery: ${batteryDisplay}`}</Text>
          </View>
        </View>

        <FadeInView delay={40}>
          <Text style={styles.sectionTitle}>Active Areas</Text>
          <View style={styles.activeAreasList}>
            {plots.map((plot) => {
              const isSelected = plot.id === selectedPlot?.id;
              return (
                <TouchableOpacity
                  key={plot.id}
                  style={[
                    styles.areaCard,
                    isSelected && styles.areaCardSelected,
                  ]}
                  onPress={() => plotsStore.setSelectedPlot(plot.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${plot.title}`}
                >
                  <View style={styles.areaCardTopRow}>
                    <View style={styles.areaIconWrap}>
                      <Ionicons name="location" size={24} color="#5b95ee" />
                    </View>
                    <View style={styles.areaMeta}>
                      <Text style={styles.areaTitle}>
                        {plot.title.replace(/^Plot/i, "Area")}
                      </Text>
                      <Text style={styles.areaCoords}>
                        {`${plot.latitude.toFixed(4)}, ${plot.longitude.toFixed(4)}`}
                      </Text>
                    </View>
                    <View style={styles.areaStatusWrap}>
                      <Text
                        style={[
                          styles.areaStatusText,
                          isSelected && styles.areaStatusTextActive,
                        ]}
                      >
                        {isSelected ? "Active" : "Standby"}
                      </Text>
                      <View
                        style={[
                          styles.areaStatusDot,
                          isSelected && styles.areaStatusDotActive,
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.areaStatsRow}>
                    <View style={styles.areaMoistureBlock}>
                      {(() => {
                        const moistureColor = getMoistureStatusColor(plot.moistureValue);
                        return (
                          <>
                      <View style={styles.areaMoistureHeader}>
                        <Text style={styles.areaMetricLabel}>Moisture</Text>
                        <Text
                          style={[styles.areaMetricValue, { color: moistureColor }]}
                        >{`${Math.round(plot.moistureValue)}%`}</Text>
                      </View>
                      <View style={styles.areaProgressTrack}>
                        <View
                          style={[
                            styles.areaProgressFill,
                            { backgroundColor: moistureColor },
                            {
                              width: `${Math.max(12, Math.min(100, plot.moistureValue))}%`,
                            },
                          ]}
                        />
                      </View>
                          </>
                        );
                      })()}
                    </View>

                    <View style={styles.areaTempWrap}>
                      {(() => {
                        const temperatureColor = getTemperatureStatusColor(plot.temperatureValue);
                        return (
                          <>
                      <Ionicons name="thermometer" size={20} color={temperatureColor} />
                      <Text
                        style={[styles.areaTempText, { color: temperatureColor }]}
                      >{`${Math.round(plot.temperatureValue)}°C`}</Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

        <FadeInView delay={80} style={styles.actionRow}>
          <DashboardAction
            icon="add-circle"
            label="Set Location"
            onPress={handleSetLocation}
            styles={styles}
          />
          <DashboardAction
            icon="trash-outline"
            label="Remove Location"
            onPress={handleRemoveLocation}
            styles={styles}
          />
        </FadeInView>

        <Text style={styles.insightsTitle}>Area Insights</Text>

        <FadeInView delay={120} style={styles.metricsRow}>
          <MetricCard
            title="Soil Moisture"
            value={moistureDisplay}
            valueColor={moistureStatusColor}
            icon={<Ionicons name="water" size={iconSize} color={moistureStatusColor} />}
            trackColor={colors.tagBg}
            trendValues={moistureTrend}
            isEmpty={!hasTelemetry}
            styles={styles}
          />
          <MetricCard
            title="Temperature"
            value={tempDisplay}
            valueColor={temperatureStatusColor}
            icon={
              <Ionicons name="thermometer" size={iconSize} color={temperatureStatusColor} />
            }
            trackColor={colors.tagBg}
            trendValues={tempTrend}
            isEmpty={!hasTelemetry}
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={150} style={styles.metricsRow}>
          <MetricCard
            title="Battery"
            value={batteryDisplay}
            valueColor="#0a9e95"
            icon={
              <Ionicons name="battery-full" size={iconSize} color="#0a9e95" />
            }
            trackColor={colors.tagBg}
            trendValues={[45, 56, 62, 68, 74, Number(realBatteryLevel) || 0]}
            isEmpty={!hasTelemetry}
            styles={styles}
          />
          <MetricCard
            title="Area Location"
            value={selectedLocation}
            valueColor={colors.metricRpm}
            icon={
              <Ionicons
                name="location"
                size={iconSize}
                color={colors.metricRpm}
              />
            }
            trackColor={colors.tagBg}
            trendValues={locationTrend}
            isEmpty={!selectedPlot}
            emptyText="Waiting for area"
            hideTrend
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={190}>
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
              <Text
                style={styles.statusMeta}
              >{`Active Area: ${selectedPlot?.title ?? "--"}`}</Text>
              <Text
                style={styles.statusMeta}
              >{`Location: ${selectedLocation}`}</Text>
            </View>
          </ScreenSection>
        </FadeInView>
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(
  width: number,
  colors: AppTheme["colors"],
  fontScale: number,
) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const layout = getLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const { compact } = typography;

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
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flexGrow: 1,
      width: "100%",
      maxWidth: layout.isLarge ? 980 : 560,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall
        ? APP_SPACING.md
        : layout.isLarge
          ? APP_SPACING.xxl
          : APP_SPACING.xl,
      paddingTop: APP_SPACING.md,
    },
    topStatusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.xs,
      marginBottom: APP_SPACING.md,
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
    sectionTitle: {
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: APP_SPACING.sm,
    },
    insightsTitle: {
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: APP_SPACING.lg,
      marginBottom: APP_SPACING.md,
    },
    activeAreasList: {
      gap: APP_SPACING.sm,
    },
    areaCard: {
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: compact ? APP_SPACING.md : APP_SPACING.lg,
      paddingVertical: compact ? APP_SPACING.md : APP_SPACING.lg,
    },
    areaCardSelected: {
      borderColor: "#4a86df",
      backgroundColor: colors.cardAltBg,
    },
    areaCardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.md,
    },
    areaIconWrap: {
      width: compact ? 52 : 56,
      height: compact ? 52 : 56,
      borderRadius: 28,
      backgroundColor: "#23354f",
      alignItems: "center",
      justifyContent: "center",
    },
    areaMeta: {
      flex: 1,
      minWidth: 0,
    },
    areaTitle: {
      fontSize: compact ? 21 : 24,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    areaCoords: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: typography.body,
      fontWeight: "600",
    },
    areaStatusWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginTop: 2,
    },
    areaStatusText: {
      color: colors.textMuted,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    areaStatusTextActive: {
      color: "#5b95ee",
    },
    areaStatusDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#94a1b5",
    },
    areaStatusDotActive: {
      backgroundColor: "#5b95ee",
    },
    areaStatsRow: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: APP_SPACING.md,
    },
    areaMoistureBlock: {
      flex: 1,
    },
    areaMoistureHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    areaMetricLabel: {
      color: colors.textMuted,
      fontSize: compact ? 13 : typography.body,
      fontWeight: "700",
    },
    areaMetricValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    areaProgressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: "#2a3a50",
      overflow: "hidden",
    },
    areaProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: "#5b95ee",
    },
    areaTempWrap: {
      minWidth: compact ? 78 : 90,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    areaTempText: {
      color: colors.textPrimary,
      fontSize: compact ? 17 : 20,
      fontWeight: "700",
    },
    actionRow: {
      marginTop: APP_SPACING.lg,
      flexDirection: "row",
      gap: layout.isSmall ? APP_SPACING.sm : APP_SPACING.md,
    },
    actionButton: {
      flex: 1,
      minHeight: compact ? 48 : 52,
      borderRadius: APP_RADII.xl,
      backgroundColor: "#3b82f6",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: APP_SPACING.sm,
      paddingHorizontal: APP_SPACING.md,
    },
    actionButtonText: {
      color: "#ffffff",
      fontSize: typography.bodyStrong,
      fontWeight: "700",
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
      flex: 1,
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
      textAlign: "center",
    },
    metricEmptyText: {
      marginTop: APP_SPACING.lg,
      alignSelf: "center",
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
      textAlign: "center",
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
      gap: APP_SPACING.xs,
    },
    statusMeta: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      color: colors.textMuted,
    },
  });
}
