import { useNotificationsSheet } from "@/components/notifications-sheet";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ScreenSection } from "@/components/ui/screen-section";
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
import Svg, { Circle } from "react-native-svg";

const IRRIGATION_API_URL =
  process.env.EXPO_PUBLIC_IRRIGATION_API_URL?.replace(/\/$/, "") ?? "";

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
  if (value < 18 || value > 40) {
    return "#ef4444";
  }
  if (value < 22 || value > 32) {
    return "#facc15";
  }
  return "#22c55e";
}

function getHumidityStatusColor(value: number) {
  if (value < 20 || value > 90) {
    return "#ef4444";
  }
  if (value < 30 || value > 80) {
    return "#facc15";
  }
  return "#22c55e";
}

function MetricCard({
  icon,
  title,
  value,
  valueColor,
  isEmpty = false,
  emptyText = "Waiting for data",
  styles,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  valueColor: string;
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
          <Text style={[styles.metricValue, { color: valueColor }]}>
            {value}
          </Text>
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

function AreaDial({
  icon,
  label,
  value,
  numericValue,
  valueColor,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  numericValue: number;
  valueColor: string;
  styles: HomeStyles;
}) {
  const dialSize = 112;
  const strokeWidth = 8;
  const radius = (dialSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const visibleArcLength = circumference * 0.75;
  const gapLength = circumference - visibleArcLength;
  const safeValue = Math.max(0, Math.min(100, numericValue));
  const progressLength = visibleArcLength * (safeValue / 100);
  const arcStartAngle = 135;

  return (
    <View style={styles.areaDialWrap}>
      <View style={styles.areaDialCircle}>
        <Svg width={dialSize} height={dialSize} style={styles.areaDialSvg}>
          <Circle
            cx={dialSize / 2}
            cy={dialSize / 2}
            r={radius}
            stroke="#556070"
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.6}
            strokeLinecap="round"
            strokeDasharray={`${visibleArcLength} ${gapLength}`}
            transform={`rotate(${arcStartAngle} ${dialSize / 2} ${dialSize / 2})`}
          />
          <Circle
            cx={dialSize / 2}
            cy={dialSize / 2}
            r={radius}
            stroke={valueColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            transform={`rotate(${arcStartAngle} ${dialSize / 2} ${dialSize / 2})`}
          />
        </Svg>
        <Ionicons name={icon} size={18} color={valueColor} />
        <Text style={styles.areaDialLabel}>{label}</Text>
        <Text style={[styles.areaDialValue, { color: valueColor }]}>{value}</Text>
      </View>
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
  const nav = useRouter();
  const { plots, selectedPlotId } = usePlotsStore();
  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null,
    [plots, selectedPlotId],
  );
  const [realBatteryLevel, setRealBatteryLevel] = useState("0");
  const [refreshing, setRefreshing] = useState(false);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlRecommendation, setMlRecommendation] = useState<string | null>(null);
  const [mlConfidence, setMlConfidence] = useState<number | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [mlModelName, setMlModelName] = useState<string | null>(null);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("index");

  useEffect(() => {
    setMlRecommendation(null);
    setMlConfidence(null);
    setMlError(null);
  }, [selectedPlot?.id]);

  useEffect(() => {
    if (!db) {
      return;
    }

    const unsubBattery = onValue(ref(db, "battery_level"), (snapshot) => {
      if (snapshot.exists()) {
        setRealBatteryLevel(String(snapshot.val()));
      }
    });

    return () => {
      unsubBattery();
    };
  }, []);

  const batteryDisplay = realBatteryLevel.includes("%")
    ? realBatteryLevel
    : `${realBatteryLevel}%`;
  const selectedMoisture = selectedPlot?.moistureValue ?? 0;
  const selectedTemperature = selectedPlot?.temperatureValue ?? 0;
  const selectedHumidity = selectedPlot?.humidityValue ?? 0;
  const selectedMoistureDisplay = `${selectedMoisture.toFixed(0)}%`;
  const selectedTemperatureDisplay = `${selectedTemperature.toFixed(1)}°C`;
  const selectedHumidityDisplay = `${selectedHumidity.toFixed(0)}%`;
  const selectedMoistureStatusColor = getMoistureStatusColor(selectedMoisture);
  const selectedTemperatureStatusColor =
    getTemperatureStatusColor(selectedTemperature);
  const selectedHumidityStatusColor = getHumidityStatusColor(selectedHumidity);
  const operationStatusText = selectedPlot
    ? `${selectedPlot.title.replace(/^Plot/i, "Area")} is active. Review the latest readings below, then request an irrigation recommendation when you are ready to act.`
    : "No active area selected. Set or choose an area to start monitoring live readings.";
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 650);
  }, []);

  const handleTestRecommendation = useCallback(async () => {
    if (!IRRIGATION_API_URL) {
      setMlError("Add EXPO_PUBLIC_IRRIGATION_API_URL in .env.local.");
      return;
    }

    const moisture = selectedPlot?.moistureValue;
    const temperature = selectedPlot?.temperatureValue;
    const humidity = selectedPlot?.humidityValue;

    if (
      !Number.isFinite(moisture) ||
      !Number.isFinite(temperature) ||
      !Number.isFinite(humidity)
    ) {
      setMlError("Live moisture, temperature, and humidity readings are required.");
      return;
    }

    setMlLoading(true);
    setMlError(null);

    try {
      const healthResponse = await fetch(`${IRRIGATION_API_URL}/health`);
      if (healthResponse.ok) {
        const healthResult = await healthResponse.json();
        const modelPath =
          typeof healthResult?.model_path === "string"
            ? healthResult.model_path
            : "";
        if (modelPath) {
          const modelName = modelPath.split(/[\\/]/).pop() ?? modelPath;
          setMlModelName(modelName);
        }
      }

      const response = await fetch(`${IRRIGATION_API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moisture,
          temperature,
          humidity,
          zone: selectedPlot?.title ?? "SA01",
        }),
      });

      if (!response.ok) {
        throw new Error(`Prediction request failed with status ${response.status}.`);
      }

      const result = await response.json();
      const confidenceEntries = Object.entries(
        (result?.confidence ?? {}) as Record<string, number>,
      );
      const topConfidence = confidenceEntries.length > 0 ? Number(confidenceEntries[0][1]) : null;

      setMlRecommendation(String(result?.recommendation ?? "unknown"));
      setMlConfidence(Number.isFinite(topConfidence) ? topConfidence : null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Prediction request failed.";
      setMlError(message);
    } finally {
      setMlLoading(false);
    }
  }, [selectedPlot]);

  const recommendationLabel = mlRecommendation
    ? mlRecommendation.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "No prediction yet";
  const recommendationMeta = mlConfidence !== null
    ? `Confidence: ${(mlConfidence * 100).toFixed(1)}%`
    : `Using the selected area test inputs. Humidity: ${selectedHumidityDisplay}`;
  const selectedAreaLabel = selectedPlot?.title.replace(/^Plot/i, "Area") ?? "No area selected";
  const isPrimaryHourlyModel =
    mlModelName?.toLowerCase().includes("scan_hourly") ?? false;
  const modelStatusText = mlModelName
    ? isPrimaryHourlyModel
      ? "Primary model active"
      : `Connected to fallback model: ${mlModelName}`
    : "Waiting for backend confirmation";
  const modelStatusColor = isPrimaryHourlyModel ? "#22c55e" : "#ef4444";

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
        <Text style={styles.headerTitle}>Area Control</Text>
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
              const moistureColor = getMoistureStatusColor(plot.moistureValue);
              const temperatureColor = getTemperatureStatusColor(plot.temperatureValue);
              const humidityColor = getHumidityStatusColor(plot.humidityValue);
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
                    <View style={styles.areaTitleWrap}>
                      <Ionicons name="location" size={16} color="#5b95ee" />
                      <Text style={styles.areaTitle}>
                        {plot.title.replace(/^Plot/i, "Area")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.areaStatusWrap,
                        isSelected ? styles.areaStatusWrapActive : styles.areaStatusWrapIdle,
                      ]}
                    >
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

                  <View style={styles.areaDialRow}>
                    <AreaDial
                      icon="water"
                      label="Soil Moisture"
                      value={`${Math.round(plot.moistureValue)}%`}
                      numericValue={plot.moistureValue}
                      valueColor={moistureColor}
                      styles={styles}
                    />
                    <AreaDial
                      icon="thermometer"
                      label="Soil Temperature"
                      value={`${plot.temperatureValue.toFixed(1)}°C`}
                      numericValue={Math.max(0, Math.min(100, (plot.temperatureValue / 50) * 100))}
                      valueColor={temperatureColor}
                      styles={styles}
                    />
                  </View>

                  <View style={styles.areaHumidityRow}>
                    <View style={styles.areaHumidityHeader}>
                      <View style={styles.areaHumidityLabelWrap}>
                        <Ionicons name="cloud" size={18} color={humidityColor} />
                        <Text style={styles.areaHumidityLabel}>Air Humidity</Text>
                      </View>
                      <Text style={[styles.areaHumidityValue, { color: humidityColor }]}>
                        {`${Math.round(plot.humidityValue)}%`}
                      </Text>
                    </View>
                    <View style={styles.areaHumidityTrack}>
                      <View
                        style={[
                          styles.areaHumidityFill,
                          {
                            backgroundColor: humidityColor,
                            width: `${Math.max(12, Math.min(100, plot.humidityValue))}%`,
                          },
                        ]}
                      />
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

        <Text style={styles.insightsTitle}>Live Readings</Text>

        <FadeInView delay={120} style={styles.readingsGrid}>
          <MetricCard
            title="Temperature"
            value={selectedTemperatureDisplay}
            valueColor={selectedTemperatureStatusColor}
            icon={
              <Ionicons
                name="thermometer"
                size={iconSize}
                color={selectedTemperatureStatusColor}
              />
            }
            isEmpty={!selectedPlot}
            styles={styles}
          />
          <MetricCard
            title="Air Humidity"
            value={selectedHumidityDisplay}
            valueColor={selectedHumidityStatusColor}
            icon={
              <Ionicons
                name="cloud"
                size={iconSize}
                color={selectedHumidityStatusColor}
              />
            }
            isEmpty={!selectedPlot}
            styles={styles}
          />
          <MetricCard
            title="Soil Moisture"
            value={selectedMoistureDisplay}
            valueColor={selectedMoistureStatusColor}
            icon={
              <Ionicons
                name="water"
                size={iconSize}
                color={selectedMoistureStatusColor}
              />
            }
            isEmpty={!selectedPlot}
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={190}>
          <ScreenSection
            title="Selected Area Status"
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
            </View>
          </ScreenSection>
        </FadeInView>

        <FadeInView delay={220}>
          <ScreenSection
            title="Irrigation Recommendation"
            titleColor={colors.textPrimary}
            titleSize={typography.cardTitle}
            borderColor={colors.cardBorder}
            backgroundColor={colors.cardBg}
            style={styles.mlPanel}
          >
            <Text style={styles.mlBody}>
              Use the selected area current moisture, temperature, and humidity
              readings to request a recommendation for what to do next right now.
            </Text>
            <Text style={styles.selectedAreaText}>{`Selected Area: ${selectedAreaLabel}`}</Text>
            <Text style={styles.mlResult}>{recommendationLabel}</Text>
            <Text style={[styles.mlMeta, { color: modelStatusColor }]}>
              {modelStatusText}
            </Text>
            <Text style={styles.mlMeta}>{mlError ?? recommendationMeta}</Text>
            <TouchableOpacity
              style={[styles.actionButton, mlLoading && styles.actionButtonDisabled]}
              onPress={handleTestRecommendation}
              disabled={mlLoading}
              accessibilityRole="button"
              accessibilityLabel="Get recommendation for selected area"
            >
              <Ionicons name="analytics" size={18} color="#ffffff" />
              <Text style={styles.actionButtonText}>
                {mlLoading ? "Checking..." : `Get Recommendation for ${selectedAreaLabel}`}
              </Text>
            </TouchableOpacity>
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
      justifyContent: "space-between",
      gap: APP_SPACING.md,
    },
    areaTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
      flex: 1,
      minWidth: 0,
    },
    areaTitle: {
      fontSize: compact ? 17 : 19,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    areaStatusWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: 6,
    },
    areaStatusWrapActive: {
      backgroundColor: "#1b4f3b",
    },
    areaStatusWrapIdle: {
      backgroundColor: "#304153",
    },
    areaStatusText: {
      color: "#d6e8de",
      fontSize: typography.chipLabel,
      fontWeight: "700",
    },
    areaStatusTextActive: {
      color: "#c9f4da",
    },
    areaStatusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#94a1b5",
    },
    areaStatusDotActive: {
      backgroundColor: "#7dd99c",
    },
    areaDialRow: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.md,
    },
    areaDialWrap: {
      flex: 1,
      alignItems: "center",
    },
    areaDialCircle: {
      width: compact ? 102 : 112,
      height: compact ? 102 : 112,
      borderRadius: 999,
      backgroundColor: "#203247",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: APP_SPACING.sm,
      overflow: "visible",
      position: "relative",
    },
    areaDialSvg: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    areaDialLabel: {
      color: "#90a0b7",
      fontSize: compact ? 9 : 10,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 4,
    },
    areaDialValue: {
      color: colors.textPrimary,
      fontSize: compact ? 18 : 20,
      fontWeight: "700",
      marginTop: 2,
    },
    areaHumidityRow: {
      marginTop: APP_SPACING.md,
    },
    areaHumidityHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    areaHumidityLabelWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    areaHumidityLabel: {
      color: "#cbd5e1",
      fontSize: compact ? 12 : 13,
      fontWeight: "700",
    },
    areaHumidityValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    areaHumidityTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: "#2a3a50",
      overflow: "hidden",
    },
    areaHumidityFill: {
      height: "100%",
      borderRadius: 999,
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
    readingsGrid: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: layout.isSmall ? APP_SPACING.sm : APP_SPACING.md,
    },
    metricCard: {
      width: "31.5%",
      minHeight: typography.compact ? 108 : 116,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: typography.compact ? APP_SPACING.sm : APP_SPACING.md,
      paddingTop: APP_SPACING.sm,
      paddingBottom: APP_SPACING.md,
    },
    metricTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metricTitle: {
      fontSize: compact ? 11 : 12,
      color: colors.textPrimary,
      fontWeight: "600",
      flex: 1,
    },
    tag: {
      marginTop: APP_SPACING.md,
      alignSelf: "center",
      color: colors.textSecondary,
      fontSize: compact ? 9 : typography.chipLabel,
      letterSpacing: typography.chipTracking,
      fontWeight: "700",
      backgroundColor: colors.tagBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: APP_RADII.md,
    },
    metricValue: {
      marginTop: APP_SPACING.md,
      alignSelf: "center",
      fontSize: compact ? 14 : 16,
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
    mlPanel: {
      marginTop: APP_SPACING.md,
    },
    mlBody: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: typography.compact ? 19 : 21,
      marginBottom: APP_SPACING.sm,
    },
    mlResult: {
      fontSize: typography.value,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: APP_SPACING.xs,
    },
    selectedAreaText: {
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      color: "#5b95ee",
      marginBottom: APP_SPACING.xs,
    },
    mlMeta: {
      fontSize: typography.small,
      color: colors.textMuted,
      marginBottom: APP_SPACING.md,
    },
    actionButtonDisabled: {
      opacity: 0.7,
    },
  });
}
