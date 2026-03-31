import { useNotificationsSheet } from "@/components/notifications-sheet";
import { FadeInView } from "@/components/ui/fade-in-view";
import {
  formatRecommendationLabel,
  getRecommendationExplanation,
  normalizeMoistureForModel,
} from "@/lib/irrigation-recommendation";
import { zonesStore, useZonesStore } from "@/lib/plots-store";
import {
  insertRobotRunRecommendation,
  isSupabaseRecommendationLoggingConfigured,
} from "@/lib/supabase-recommendation-log";
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Alert,
  Easing,
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
import Svg, { Path } from "react-native-svg";

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

type DialMetric = "moisture" | "temperature" | "humidity";

type GradientStop = {
  offset: number;
  color: string;
};

const MOISTURE_GRADIENT_STOPS: GradientStop[] = [
  { offset: 0, color: "#b45309" },
  { offset: 0.2, color: "#d97706" },
  { offset: 0.35, color: "#84cc16" },
  { offset: 0.55, color: "#22c55e" },
  { offset: 0.75, color: "#14b8a6" },
  { offset: 1, color: "#2563eb" },
];

const TEMPERATURE_GRADIENT_STOPS: GradientStop[] = [
  { offset: 0, color: "#ef4444" },
  { offset: 0.28, color: "#fb923c" },
  { offset: 0.5, color: "#fde047" },
  { offset: 0.72, color: "#e0f2fe" },
  { offset: 1, color: "#38bdf8" },
];

const HUMIDITY_GRADIENT_STOPS: GradientStop[] = [
  { offset: 0, color: "#ff0000" },
  { offset: 0.2, color: "#d9480f" },
  { offset: 0.35, color: "#c98a42" },
  { offset: 0.5, color: "#39a53a" },
  { offset: 0.7, color: "#2599ad" },
  { offset: 0.85, color: "#4a8db9" },
  { offset: 1, color: "#48588f" },
];

function getDialGradientStops(metric: DialMetric) {
  if (metric === "moisture") {
    return MOISTURE_GRADIENT_STOPS;
  }
  if (metric === "temperature") {
    return TEMPERATURE_GRADIENT_STOPS;
  }
  return HUMIDITY_GRADIENT_STOPS;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function interpolateGradientColor(stops: GradientStop[], value: number) {
  const safeValue = Math.max(0, Math.min(100, value));
  const position = safeValue / 100;
  const upperIndex = stops.findIndex((stop) => stop.offset >= position);

  if (upperIndex <= 0) {
    return stops[0]?.color ?? "#94a3b8";
  }

  if (upperIndex === -1) {
    return stops[stops.length - 1]?.color ?? "#94a3b8";
  }

  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const localSpan = upper.offset - lower.offset || 1;
  const ratio = (position - lower.offset) / localSpan;
  const lowerRgb = hexToRgb(lower.color);
  const upperRgb = hexToRgb(upper.color);

  return rgbToHex(
    lowerRgb.r + (upperRgb.r - lowerRgb.r) * ratio,
    lowerRgb.g + (upperRgb.g - lowerRgb.g) * ratio,
    lowerRgb.b + (upperRgb.b - lowerRgb.b) * ratio,
  );
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
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
        <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
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
  metric,
  gradientId,
  isDark,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  numericValue: number;
  metric: DialMetric;
  gradientId: string;
  isDark: boolean;
  styles: HomeStyles;
}) {
  const dialSize = 98;
  const strokeWidth = 8;
  const radius = (dialSize - strokeWidth) / 2;
  const safeValue = Math.max(0, Math.min(100, numericValue));
  const arcStartAngle = 225;
  const arcEndAngle = 495;
  const visibleArcAngle = arcEndAngle - arcStartAngle;
  const gradientStops = getDialGradientStops(metric);
  const valueColor = interpolateGradientColor(gradientStops, safeValue);
  const textColor = isDark ? valueColor : "#111111";
  const trackPath = describeArc(
    dialSize / 2,
    dialSize / 2,
    radius,
    arcStartAngle,
    arcEndAngle,
  );
  const segmentCount = 28;
  const segmentGap = 3;
  const activeArcAngle = visibleArcAngle * (safeValue / 100);
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const segmentStart =
      arcStartAngle + (visibleArcAngle / segmentCount) * index;
    const segmentEnd =
      arcStartAngle + (visibleArcAngle / segmentCount) * (index + 1);

    if (segmentStart >= arcStartAngle + activeArcAngle) {
      return null;
    }

    const cappedEnd = Math.min(segmentEnd, arcStartAngle + activeArcAngle);
    const paddedStart = segmentStart + segmentGap / 2;
    const paddedEnd = cappedEnd - segmentGap / 2;

    if (paddedEnd <= paddedStart) {
      return null;
    }

    const progressAtSegment =
      ((segmentStart + cappedEnd) / 2 - arcStartAngle) / visibleArcAngle;

    return {
      path: describeArc(
        dialSize / 2,
        dialSize / 2,
        radius,
        paddedStart,
        paddedEnd,
      ),
      color: interpolateGradientColor(gradientStops, progressAtSegment * 100),
    };
  }).filter((segment): segment is { path: string; color: string } => segment !== null);

  return (
    <View style={styles.areaDialWrap}>
      <View style={styles.areaDialCircle}>
        <Svg width={dialSize} height={dialSize} style={styles.areaDialSvg}>
          <Path
            d={trackPath}
            stroke="#556070"
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.6}
            strokeLinecap="round"
          />
          {segments.map((segment, index) => (
            <Path
              key={`${gradientId}-${index}`}
              d={segment.path}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </Svg>
        <View style={styles.areaDialContent}>
          <Ionicons name={icon} size={16} color={valueColor} />
          <Text style={styles.areaDialLabel}>{label}</Text>
          <Text style={[styles.areaDialValue, { color: textColor }]}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const layout = getLayoutProfile(width);
  const styles = createStyles(width, colors, fontScale, isDark);
  const iconSize = layout.isSmall ? 18 : 20;
  const nav = useRouter();
  const { zones, selectedZoneId } = useZonesStore();
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null,
    [zones, selectedZoneId],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlRecommendation, setMlRecommendation] = useState<string | null>(null);
  const [mlConfidence, setMlConfidence] = useState<number | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [mlModelName, setMlModelName] = useState<string | null>(null);
  const [mlLogMessage, setMlLogMessage] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const idleOrbitAnim = useRef(new Animated.Value(0)).current;
  const motionBoostAnim = useRef(new Animated.Value(0)).current;
  const loadingSpinAnim = useRef(new Animated.Value(0)).current;
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("index");

  useEffect(() => {
    setMlRecommendation(null);
    setMlConfidence(null);
    setMlError(null);
    setMlLogMessage(null);
  }, [selectedZone?.id]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  useEffect(() => {
    const orbitLoop = Animated.loop(
      Animated.timing(idleOrbitAnim, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    idleOrbitAnim.setValue(0);
    orbitLoop.start();

    return () => {
      orbitLoop.stop();
    };
  }, [idleOrbitAnim]);

  useEffect(() => {
    Animated.timing(motionBoostAnim, {
      toValue: mlLoading ? 1 : 0,
      duration: mlLoading ? 220 : 420,
      easing: mlLoading ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [mlLoading, motionBoostAnim]);

  useEffect(() => {
    let spinLoop: Animated.CompositeAnimation | null = null;

    if (mlLoading) {
      loadingSpinAnim.setValue(0);
      spinLoop = Animated.loop(
        Animated.timing(loadingSpinAnim, {
          toValue: 1,
          duration: 1350,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop.start();
    } else {
      loadingSpinAnim.stopAnimation();
      loadingSpinAnim.setValue(0);
    }

    return () => {
      spinLoop?.stop();
    };
  }, [mlLoading, loadingSpinAnim]);

  const selectedMoisture = selectedZone?.moistureValue ?? 0;
  const selectedTemperature = selectedZone?.temperatureValue ?? 0;
  const selectedHumidity = selectedZone?.humidityValue ?? 0;
  const selectedMoistureDisplay = `${selectedMoisture.toFixed(0)}%`;
  const selectedTemperatureDisplay = `${selectedTemperature.toFixed(1)}C`;
  const selectedHumidityDisplay = `${selectedHumidity.toFixed(0)}%`;
  const selectedMoistureStatusColor = getMoistureStatusColor(selectedMoisture);
  const selectedTemperatureStatusColor =
    getTemperatureStatusColor(selectedTemperature);
  const selectedHumidityStatusColor = getHumidityStatusColor(selectedHumidity);
  const operationStatusText = selectedZone
    ? `${selectedZone.title} is active. Review the latest readings below, then request an irrigation recommendation when you are ready to act.`
    : "No active zone selected. Add or choose a saved zone to start monitoring live readings.";
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

    const moisture = selectedZone?.moistureValue;
    const temperature = selectedZone?.temperatureValue;
    const humidity = selectedZone?.humidityValue;

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
    setMlLogMessage(null);

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
          moisture: normalizeMoistureForModel(moisture),
          temperature,
          humidity,
          zone: selectedZone?.title ?? "Zone 1",
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

      const nextRecommendation = String(result?.recommendation ?? "unknown");
      const nextConfidence = Number.isFinite(topConfidence) ? topConfidence : null;
      const explanation = getRecommendationExplanation(
        nextRecommendation,
        moisture,
        temperature,
        humidity,
      );

      setMlRecommendation(nextRecommendation);
      setMlConfidence(nextConfidence);
      if (selectedZone) {
        zonesStore.updateZoneRecommendation(selectedZone.id, {
          recommendation: nextRecommendation,
          recommendationConfidence: nextConfidence,
          recommendationTitle: explanation.title,
          recommendationExplanation: explanation.body,
        });
      }

      if (selectedZone && isSupabaseRecommendationLoggingConfigured()) {
        await insertRobotRunRecommendation({
          zoneCode: selectedZone.title,
          airHumidity: humidity,
          soilTempAvg: temperature,
          soilMoistureAvg: moisture,
          recommendation: nextRecommendation,
          recommendationConfidence: nextConfidence,
          recommendationExplanation: explanation.body,
        });
        setMlLogMessage("Recommendation saved to Supabase.");
      } else if (!isSupabaseRecommendationLoggingConfigured()) {
        setMlLogMessage(
          "Supabase logging is off. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to save results automatically.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Prediction request failed.";
      setMlError(message);
    } finally {
      setMlLoading(false);
    }
  }, [selectedZone]);

  const recommendationLabel = formatRecommendationLabel(mlRecommendation);
  const recommendationDisplay =
    mlRecommendation === null ? "No prediction yet" : recommendationLabel;
  const recommendationMeta = mlConfidence !== null
    ? `Confidence: ${(mlConfidence * 100).toFixed(1)}%. Saved to Monitoring Summary.`
    : `Uses the selected zone readings and saves the result to Monitoring Summary.`;
  const selectedZoneLabel = selectedZone?.title ?? "No zone selected";
  const isPrimaryHourlyModel =
    mlModelName?.toLowerCase().includes("scan_hourly") ?? false;
  const modelStatusText = mlModelName
    ? isPrimaryHourlyModel
      ? "Primary model active"
      : `Connected to fallback model: ${mlModelName}`
    : "Waiting for backend confirmation";
  const modelStatusColor = isPrimaryHourlyModel ? "#22c55e" : "#ef4444";
  const blendedPulse = Animated.add(
    Animated.multiply(pulseAnim, 1),
    Animated.multiply(motionBoostAnim, 0.5),
  );
  const orbScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });
  const orbScaleBoost = motionBoostAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const orbScaleCombined = Animated.multiply(orbScale, orbScaleBoost);
  const orbHaloOpacity = blendedPulse.interpolate({
    inputRange: [0, 1.5],
    outputRange: [0.05, 0.24],
  });
  const loadingSpin = loadingSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  function handleSetLocation() {
    nav.push("/manage-zones" as never);
  }

  function handleRemoveLocation() {
    if (!selectedZone) {
      Alert.alert("No location selected", "There is no active zone to remove.");
      return;
    }

    Alert.alert(
      "Remove location?",
      `Remove ${selectedZone.title} from Saved Zones?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => zonesStore.removeZone(selectedZone.id),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Zone Control</Text>
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
        <FadeInView delay={40}>
          <Text style={styles.sectionTitle}>Saved Zones</Text>
          <View style={styles.activeAreasList}>
            {zones.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No saved zones yet</Text>
                <Text style={styles.emptyStateBody}>
                  Use Set Location to add a zone with manual coordinates.
                </Text>
              </View>
            ) : null}
            {zones.map((plot) => {
              const isSelected = plot.id === selectedZone?.id;
              return (
                <TouchableOpacity
                  key={plot.id}
                  style={[
                    styles.areaCard,
                    isSelected && styles.areaCardSelected,
                  ]}
                  onPress={() => zonesStore.setSelectedZone(plot.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${plot.title}`}
                >
                  <View style={styles.areaCardTopRow}>
                    <View style={styles.areaTitleWrap}>
                      <Ionicons name="location" size={16} color="#5b95ee" />
                      <Text style={styles.areaTitle}>
                        {plot.title}
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
                      metric="moisture"
                      gradientId={`moisture-${plot.id}`}
                      isDark={isDark}
                      styles={styles}
                    />
                    <AreaDial
                      icon="thermometer"
                      label="Soil Temperature"
                      value={`${plot.temperatureValue.toFixed(1)}C`}
                      numericValue={Math.max(0, Math.min(100, (plot.temperatureValue / 50) * 100))}
                      metric="temperature"
                      gradientId={`temperature-${plot.id}`}
                      isDark={isDark}
                      styles={styles}
                    />
                    <AreaDial
                      icon="cloud"
                      label="Air Humidity"
                      value={`${Math.round(plot.humidityValue)}%`}
                      numericValue={plot.humidityValue}
                      metric="humidity"
                      gradientId={`humidity-${plot.id}`}
                      isDark={isDark}
                      styles={styles}
                    />
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
            isEmpty={!selectedZone}
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
            isEmpty={!selectedZone}
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
            isEmpty={!selectedZone}
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={190}>
          <Text style={styles.subsectionTitle}>Selected Zone Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardLabel}>Zone Status</Text>
              <View style={styles.statusCardDot} />
            </View>
            <Text style={styles.statusCardBody}>{operationStatusText}</Text>
            <View style={styles.statusMetaRow}>
              <Text
                style={styles.statusMeta}
              >{`Active Zone: ${selectedZone?.title ?? "--"}`}</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={220}>
          <View style={styles.recommendationCard}>
            <Text style={styles.recommendationSectionTitle}>
              Irrigation Recommendation
            </Text>
            <Text style={styles.mlBody}>
              Use the selected zone current moisture, temperature, and humidity
              readings to request a recommendation for what to do next right now.
            </Text>
            <Text style={styles.selectedAreaText}>{`Selected Zone: ${selectedZoneLabel}`}</Text>
            <Text style={styles.recommendationHeadline}>
              {recommendationDisplay}
            </Text>
            <View style={styles.recommendationVisualWrap}>
              <Animated.View
                style={[
                  styles.recommendationVisualHalo,
                  {
                    opacity: orbHaloOpacity,
                    transform: [{ scale: orbScaleCombined }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.recommendationOrbitLayer,
                  {
                    transform: [{ rotate: mlLoading ? loadingSpin : "0deg" }],
                  },
                ]}
              >
                <View style={styles.recommendationVisualSparkLeft} />
                <View style={styles.recommendationVisualSparkRight} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.recommendationVisualOrb,
                  {
                    transform: [
                      { rotate: mlLoading ? loadingSpin : "0deg" },
                      { scale: orbScaleCombined },
                    ],
                  },
                ]}
              >
                <View style={styles.recommendationVisualInnerOrb}>
                  <Ionicons name="leaf" size={28} color="#9af7bf" />
                </View>
              </Animated.View>
            </View>
            <Text style={[styles.mlMeta, { color: modelStatusColor }]}>
              {modelStatusText}
            </Text>
            <Text style={styles.mlMeta}>
              {mlError ?? mlLogMessage ?? recommendationMeta}
            </Text>
            <TouchableOpacity
              style={[
                styles.actionButton,
                mlLoading && styles.actionButtonDisabled,
              ]}
              onPress={handleTestRecommendation}
              disabled={mlLoading}
              accessibilityRole="button"
              accessibilityLabel="Get recommendation for selected zone"
            >
              <Ionicons name="analytics" size={18} color="#ffffff" />
              <Text style={styles.recommendationButtonText}>
                {mlLoading ? "Checking..." : `Get Recommendation for ${selectedZoneLabel}`}
              </Text>
            </TouchableOpacity>
          </View>
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
  isDark: boolean,
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
    emptyStateCard: {
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: compact ? APP_SPACING.md : APP_SPACING.lg,
      paddingVertical: compact ? APP_SPACING.md : APP_SPACING.lg,
      gap: APP_SPACING.xs,
    },
    emptyStateTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    emptyStateBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
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
      backgroundColor: isDark ? "#1b4f3b" : "#bfead0",
    },
    areaStatusWrapIdle: {
      backgroundColor: isDark ? "#304153" : "#c8d2df",
    },
    areaStatusText: {
      color: isDark ? "#d6e8de" : "#111111",
      fontSize: typography.chipLabel,
      fontWeight: "700",
    },
    areaStatusTextActive: {
      color: isDark ? "#c9f4da" : "#0d3b23",
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
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
    },
    areaDialWrap: {
      flex: 1,
      alignItems: "center",
    },
    areaDialCircle: {
      width: compact ? 92 : 98,
      height: compact ? 92 : 98,
      borderRadius: 999,
      backgroundColor: colors.cardBg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: APP_SPACING.sm,
      overflow: "visible",
      position: "relative",
    },
    areaDialContent: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    areaDialSvg: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    areaDialLabel: {
      color: isDark ? "#90a0b7" : "#2b2f36",
      fontSize: compact ? 7.5 : 8.5,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: compact ? 10 : 11,
      marginTop: 4,
    },
    areaDialValue: {
      color: colors.textPrimary,
      fontSize: compact ? 14 : 16,
      fontWeight: "700",
      marginTop: 3,
      textAlign: "center",
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
      minHeight: typography.compact ? 96 : 104,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: typography.compact ? APP_SPACING.sm : APP_SPACING.md,
      paddingTop: APP_SPACING.sm,
      paddingBottom: APP_SPACING.sm,
    },
    metricTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metricTitle: {
      fontSize: compact ? 11 : 12,
      color: colors.textPrimary,
      fontWeight: "700",
      flex: 1,
    },
    tag: {
      marginTop: APP_SPACING.sm,
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
      marginTop: APP_SPACING.sm,
      alignSelf: "center",
      fontSize: compact ? 17 : 19,
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
    subsectionTitle: {
      fontSize: typography.cardTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: APP_SPACING.sm,
      marginBottom: APP_SPACING.sm,
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
    statusCard: {
      marginTop: APP_SPACING.xs,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    statusCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: APP_SPACING.xs,
    },
    statusCardLabel: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    statusCardDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: "#5bc0ff",
    },
    statusCardBody: {
      fontSize: typography.body,
      color: colors.textSecondary,
      lineHeight: typography.compact ? 19 : 21,
      marginBottom: APP_SPACING.md,
    },
    mlPanel: {
      marginTop: APP_SPACING.md,
    },
    recommendationCard: {
      marginTop: APP_SPACING.lg,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.lg,
      paddingTop: APP_SPACING.lg,
      paddingBottom: APP_SPACING.lg,
    },
    recommendationSectionTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
      textAlign: "center",
    },
    recommendationHeadline: {
      marginTop: APP_SPACING.xs,
      color: colors.textPrimary,
      fontSize: typography.value + 6,
      fontWeight: "700",
      lineHeight: typography.value + 10,
      textAlign: "center",
      marginBottom: APP_SPACING.sm,
    },
    recommendationVisualWrap: {
      height: 132,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      marginBottom: APP_SPACING.sm,
    },
    recommendationOrbitLayer: {
      position: "absolute",
      width: 126,
      height: 126,
      alignItems: "center",
      justifyContent: "center",
    },
    recommendationVisualHalo: {
      position: "absolute",
      width: 112,
      height: 112,
      borderRadius: 999,
      backgroundColor: "rgba(91, 149, 238, 0.08)",
    },
    recommendationVisualOrb: {
      width: 88,
      height: 88,
      borderRadius: 999,
      backgroundColor: isDark ? "#314760" : "#48627f",
      borderWidth: 1,
      borderColor: isDark ? "#4c6480" : "#5b7595",
      alignItems: "center",
      justifyContent: "center",
    },
    recommendationVisualInnerOrb: {
      width: 62,
      height: 62,
      borderRadius: 999,
      backgroundColor: isDark ? "#4e6784" : "#6b85a4",
      alignItems: "center",
      justifyContent: "center",
    },
    recommendationVisualSparkLeft: {
      position: "absolute",
      left: 8,
      top: 36,
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: "#84ccff",
    },
    recommendationVisualSparkRight: {
      position: "absolute",
      right: 10,
      top: 48,
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: "#b9e7ff",
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
      color: isDark ? "#5b95ee" : "#2f6fd2",
      marginBottom: APP_SPACING.xs,
    },
    mlMeta: {
      fontSize: typography.small,
      color: colors.textMuted,
      marginBottom: APP_SPACING.md,
    },
    recommendationButtonText: {
      color: "#ffffff",
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    actionButtonDisabled: {
      opacity: 0.7,
    },
  });
}
