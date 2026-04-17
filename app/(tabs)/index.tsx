import { useNotificationsSheet } from "@/components/notifications-sheet";
import { FadeInView } from "@/components/ui/fade-in-view";
import {
  formatRecommendationLabel,
  getRecommendationExplanation,
  normalizeMoistureForModel,
} from "@/lib/irrigation-recommendation";
import {
  getFarmerRunSummary,
  zonesStore,
  useZonesStore,
} from "@/lib/plots-store";
import {
  createMissionRequestId,
  fetchLatestActiveRoverMission,
  requestStopMission,
  subscribeLiveMissionSnapshot,
  updateRoverMissionStatus,
  type LiveMissionSnapshot,
} from "@/lib/robot-mission-control";
import {
  DEFAULT_AUTOMATION_SETTINGS,
  DEFAULT_AUTOMATION_STATE,
  subscribeAutomationSettings,
  subscribeAutomationState,
  type AutomationSettings,
  type AutomationState,
} from "@/lib/rover-automation";
import {
  fetchLatestZoneResultsByZoneCode,
  isSupabaseZoneAveragesConfigured,
} from "@/lib/supabase-zone-averages";
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
const FORCE_CANCEL_TIMEOUT_MS = 12000;

type HomeStyles = ReturnType<typeof createStyles>;

const SOIL_RAW_DRY = 3200;
const SOIL_RAW_WET = 1200;

function convertSoilRawToPercent(raw: number) {
  const mapped = ((raw - SOIL_RAW_DRY) * 100) / (SOIL_RAW_WET - SOIL_RAW_DRY);
  return Math.max(0, Math.min(100, mapped));
}

function getZoneCodeFromTitle(title: string) {
  const match = title.match(/\d+/);
  return match?.[0] ?? title;
}

function formatMissionStateLabel(state: string | null, missionSelected: boolean) {
  const normalized = (state ?? "").trim().toLowerCase();
  const fallback = missionSelected ? "running" : "idle";
  const resolved = normalized || fallback;

  return resolved
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function getMissionStatusColor(state: string | null, missionSelected: boolean) {
  const normalized = (state ?? "").trim().toLowerCase();

  if (normalized === "aborted" || normalized === "cancelled" || normalized === "failed") {
    return "#ef4444";
  }

  if (normalized === "stopping" || normalized === "pending") {
    return "#f59e0b";
  }

  if (normalized === "running" || missionSelected) {
    return "#22c55e";
  }

  return "#5bc0ff";
}

function formatSavedRunStatusLabel(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) {
    return "Saved run available";
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

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

function snapshotHasActiveMission(snapshot: LiveMissionSnapshot | null) {
  if (!snapshot) {
    return false;
  }

  const normalizedState = (snapshot.overallState ?? "idle").trim().toLowerCase();

  return (
    snapshot.missionActive ||
    snapshot.missionBus.stopRequested ||
    snapshot.missionBus.requestDrill ||
    snapshot.missionBus.drillStarted ||
    [
      "queued",
      "pending",
      "in_progress",
      "running",
      "moving",
      "aligning",
      "arrived",
      "waiting_for_drill",
      "drilling",
      "sampling",
      "stopping",
    ].includes(normalizedState)
  );
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
  disabled = false,
  variant = "primary",
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "success" | "danger" | "warning";
  styles: HomeStyles;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        variant === "success"
          ? styles.actionButtonSuccess
          : variant === "danger"
            ? styles.actionButtonDanger
            : variant === "warning"
              ? styles.actionButtonWarning
              : null,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
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
  isEmpty = false,
  emptyText = "No data yet",
  metric,
  gradientId,
  isDark,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  numericValue: number;
  isEmpty?: boolean;
  emptyText?: string;
  metric: DialMetric;
  gradientId: string;
  isDark: boolean;
  styles: HomeStyles;
}) {
  const dialSize = 98;
  const strokeWidth = 8;
  const radius = (dialSize - strokeWidth) / 2;
  const safeValue = isEmpty ? 0 : Math.max(0, Math.min(100, numericValue));
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
          {isEmpty ? (
            <Text style={styles.areaDialEmptyText}>{emptyText}</Text>
          ) : (
            <Text style={[styles.areaDialValue, { color: textColor }]}>{value}</Text>
          )}
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
  const [liveMoisture, setLiveMoisture] = useState<number | null>(null);
  const [liveTemperature, setLiveTemperature] = useState<number | null>(null);
  const [liveHumidity, setLiveHumidity] = useState<number | null>(null);
  const [liveMissionSnapshot, setLiveMissionSnapshot] =
    useState<LiveMissionSnapshot | null>(null);
  const [robotMissionSelected, setRobotMissionSelected] = useState(false);
  const [robotMissionState, setRobotMissionState] = useState<string | null>(null);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>(
    DEFAULT_AUTOMATION_SETTINGS,
  );
  const [automationState, setAutomationState] = useState<AutomationState>(
    DEFAULT_AUTOMATION_STATE,
  );
  const [activeMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [activeMissionZoneCode, setActiveMissionZoneCode] = useState<string | null>(null);
  const [missionCommandPending, setMissionCommandPending] = useState<"start" | "stop" | "cancel" | null>(null);
  const [missionCommandError, setMissionCommandError] = useState<string | null>(null);
  const [missionCommandAck, setMissionCommandAck] = useState<{
    command: "start" | "stop" | "cancel";
    requestedAt: number;
    missionId: number | null;
  } | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const idleOrbitAnim = useRef(new Animated.Value(0)).current;
  const motionBoostAnim = useRef(new Animated.Value(0)).current;
  const loadingSpinAnim = useRef(new Animated.Value(0)).current;
  const lastMissionStatusSyncRef = useRef<string | null>(null);
  const lastRecommendationRequestKeyRef = useRef<string | null>(null);
  const liveMissionSnapshotRef = useRef<LiveMissionSnapshot | null>(null);
  const forceCancelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("index");

  const syncZoneAverages = useCallback(async () => {
    if (!isSupabaseZoneAveragesConfigured()) {
      zones.forEach((zone) => {
        zonesStore.updateZoneSavedResult(zone.id, {
          hasSensorData: false,
          moistureValue: 0,
          temperatureValue: 0,
          humidityValue: 0,
          recommendation: null,
          recommendationConfidence: null,
          recommendationTitle: null,
          recommendationExplanation: null,
          savedMissionId: null,
          savedRunStatus: null,
          savedRunCreatedAt: null,
          savedRunUpdatedAt: null,
          movementStateFinal: null,
          drillStateFinal: null,
        });
      });
      return;
    }

    const averagesByZoneCode = await fetchLatestZoneResultsByZoneCode();

    zones.forEach((zone) => {
      const zoneCode = getZoneCodeFromTitle(zone.title);
      const nextSnapshot = averagesByZoneCode[zoneCode];
      const recommendationDetails =
        nextSnapshot?.recommendation && nextSnapshot.hasSensorData
          ? getRecommendationExplanation(
              nextSnapshot.recommendation,
              nextSnapshot.moistureValue,
              nextSnapshot.temperatureValue,
              nextSnapshot.humidityValue,
            )
          : null;

      zonesStore.updateZoneSavedResult(zone.id, {
        hasSensorData: nextSnapshot?.hasSensorData ?? false,
        moistureValue: nextSnapshot?.moistureValue ?? 0,
        temperatureValue: nextSnapshot?.temperatureValue ?? 0,
        humidityValue: nextSnapshot?.humidityValue ?? 0,
        recommendation: nextSnapshot?.recommendation ?? null,
        recommendationConfidence: nextSnapshot?.recommendationConfidence ?? null,
        recommendationTitle: recommendationDetails?.title ?? null,
        recommendationExplanation:
          nextSnapshot?.recommendationExplanation ??
          recommendationDetails?.body ??
          null,
        savedMissionId: nextSnapshot?.savedMissionId ?? null,
        savedRunStatus: nextSnapshot?.savedRunStatus ?? null,
        savedRunCreatedAt: nextSnapshot?.savedRunCreatedAt ?? null,
        savedRunUpdatedAt: nextSnapshot?.savedRunUpdatedAt ?? null,
        movementStateFinal: nextSnapshot?.movementStateFinal ?? null,
        drillStateFinal: nextSnapshot?.drillStateFinal ?? null,
      });
    });
  }, [zones]);

  useEffect(() => {
    setMlRecommendation(null);
    setMlConfidence(null);
    setMlError(null);
    setMlLogMessage(null);
    lastRecommendationRequestKeyRef.current = null;
  }, [selectedZone?.id]);

  useEffect(() => {
    void syncZoneAverages().catch((error) => {
      console.warn("Failed to sync zone averages", error);
    });
  }, [syncZoneAverages]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeAutomationSettings((settings) => {
        setAutomationSettings(settings);
      });
    } catch (error) {
      console.warn("Failed to subscribe to automation settings", error);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeAutomationState((state) => {
        setAutomationState(state);
      });
    } catch (error) {
      console.warn("Failed to subscribe to automation state", error);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!missionCommandAck) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setMissionCommandAck(null);
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [missionCommandAck]);

  useEffect(() => {
    let isCancelled = false;

    void fetchLatestActiveRoverMission()
      .then((mission) => {
        if (isCancelled) {
          return;
        }

        if (!mission) {
          if (!snapshotHasActiveMission(liveMissionSnapshotRef.current)) {
            setSelectedMissionId(null);
            setActiveMissionZoneCode(null);
          }
          return;
        }

        setSelectedMissionId((current) => current ?? mission.id);
        setActiveMissionZoneCode((current) => current ?? mission.zone_code);
      })
      .catch((error) => {
        console.warn("Failed to hydrate latest active rover mission", error);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeLiveMissionSnapshot((snapshot) => {
        liveMissionSnapshotRef.current = snapshot;
        setLiveMissionSnapshot(snapshot);
        setRobotMissionSelected(snapshot.missionActive);
        setRobotMissionState(snapshot.overallState);
        const snapshotMissionIsActive = snapshotHasActiveMission(snapshot);

        if (snapshotMissionIsActive && snapshot.missionId !== null) {
          setSelectedMissionId(snapshot.missionId);
        } else if (!snapshotMissionIsActive) {
          setSelectedMissionId(null);
        }

        if (snapshotMissionIsActive && snapshot.zoneCode) {
          setActiveMissionZoneCode(snapshot.zoneCode);
        } else if (!snapshotMissionIsActive) {
          setActiveMissionZoneCode(null);
        }

        const nextMoisture =
          snapshot.telemetry.soilMoisturePct ??
          (snapshot.telemetry.soilMoistureRaw !== null
            ? convertSoilRawToPercent(snapshot.telemetry.soilMoistureRaw)
            : null) ??
          snapshot.drillStatus.soilMoistureAvg;
        const nextTemperature =
          snapshot.telemetry.soilTempC ?? snapshot.drillStatus.soilTempAvg;
        const nextHumidity =
          snapshot.telemetry.airHumidity ?? snapshot.drillStatus.airHumidityAvg;

        setLiveMoisture(nextMoisture);
        setLiveTemperature(nextTemperature);
        setLiveHumidity(nextHumidity);
      });
    } catch (error) {
      console.warn("Failed to subscribe to normalized rover live mission snapshot", error);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (liveMissionSnapshot && !snapshotHasActiveMission(liveMissionSnapshot)) {
      if (forceCancelTimeoutRef.current) {
        clearTimeout(forceCancelTimeoutRef.current);
        forceCancelTimeoutRef.current = null;
      }
    }
  }, [liveMissionSnapshot]);

  useEffect(() => {
    return () => {
      if (forceCancelTimeoutRef.current) {
        clearTimeout(forceCancelTimeoutRef.current);
        forceCancelTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const missionId = liveMissionSnapshot?.missionId ?? activeMissionId;
    if (!missionId || !liveMissionSnapshot) {
      return;
    }

    const normalizedState = (liveMissionSnapshot.overallState ?? "idle").toLowerCase();
    let nextStatus: "in_progress" | "stopping" | "stopped" | "completed" | "cancelled" | null = null;

    if (["cancelled", "error"].includes(normalizedState)) {
      nextStatus = "cancelled";
    } else if (["completed"].includes(normalizedState) || liveMissionSnapshot.missionBus.drillDone) {
      nextStatus = "completed";
    } else if (liveMissionSnapshot.missionBus.stopRequested || normalizedState === "stopping") {
      nextStatus = "stopping";
    } else if (
      liveMissionSnapshot.missionActive ||
      ["running", "moving", "aligning", "drilling", "sampling", "waiting_for_drill", "arrived"].includes(normalizedState)
    ) {
      nextStatus = "in_progress";
    }

    if (!nextStatus) {
      return;
    }

    const syncKey = `${missionId}:${nextStatus}`;
    if (lastMissionStatusSyncRef.current === syncKey) {
      return;
    }

    lastMissionStatusSyncRef.current = syncKey;
    void updateRoverMissionStatus(missionId, nextStatus).catch((error) => {
      console.warn(`Failed to sync rover mission ${missionId} to ${nextStatus}`, error);
      lastMissionStatusSyncRef.current = null;
    });
  }, [activeMissionId, liveMissionSnapshot]);

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

  const selectedMoisture = liveMoisture ?? 0;
  const selectedTemperature = liveTemperature ?? 0;
  const selectedHumidity = liveHumidity ?? 0;
  const selectedMoistureDisplay = `${selectedMoisture.toFixed(0)}%`;
  const selectedTemperatureDisplay = `${selectedTemperature.toFixed(1)}C`;
  const selectedHumidityDisplay = `${selectedHumidity.toFixed(0)}%`;
  const selectedMoistureStatusColor = getMoistureStatusColor(selectedMoisture);
  const selectedTemperatureStatusColor =
    getTemperatureStatusColor(selectedTemperature);
  const selectedHumidityStatusColor = getHumidityStatusColor(selectedHumidity);
  const farmerRunSummary = getFarmerRunSummary(zones);
  const hasLiveReadings =
    liveMoisture !== null && liveTemperature !== null && liveHumidity !== null;
  const selectedZoneHasSavedResult = Boolean(selectedZone?.hasSensorData);
  const liveMissionIsActive = snapshotHasActiveMission(liveMissionSnapshot);
  const cloudMissionIsActive =
    liveMissionIsActive || (liveMissionSnapshot === null && activeMissionId !== null);
  const effectiveMissionState =
    liveMissionSnapshot?.overallState ??
    robotMissionState ??
    (cloudMissionIsActive ? "pending" : "idle");
  const missionStateLabel = formatMissionStateLabel(
    effectiveMissionState,
    cloudMissionIsActive,
  );
  const missionStatusColor = getMissionStatusColor(
    effectiveMissionState,
    cloudMissionIsActive,
  );
  const activeMissionTargetId = cloudMissionIsActive
    ? liveMissionSnapshot?.missionId ?? activeMissionId
    : null;
  const activeMissionZoneLabel = cloudMissionIsActive
    ? liveMissionSnapshot?.zoneCode ??
      activeMissionZoneCode ??
      getZoneCodeFromTitle(selectedZone?.title ?? "")
    : null;
  const normalizedMissionState = (effectiveMissionState ?? "idle").trim().toLowerCase();
  const hasBusyMissionState = ["queued", "pending", "in_progress", "running", "moving", "drilling", "stopping", "waiting_for_drill", "aligning"].includes(normalizedMissionState);
  const canForceCancelMission =
    missionCommandPending === null &&
    (cloudMissionIsActive || activeMissionTargetId !== null);
  const missionControlHelperText = !selectedZone
    ? "Select or create a zone so this panel can track the next automated rover run."
    : missionCommandPending === "cancel"
      ? "Force cancel is armed as a timeout fallback. The app will keep waiting for board acknowledgement before it marks the mission cancelled in Supabase."
      : liveMissionSnapshot?.missionBus.stopRequested
        ? "A stop request is active in the cloud state machine. The app will keep watching for movement and drill acknowledgements before treating the mission as fully stopped."
        : normalizedMissionState === "queued" || normalizedMissionState === "pending"
          ? "The mission is queued in the cloud and waiting for the movement and drill boards to pick up the new command."
          : normalizedMissionState === "waiting_for_drill"
            ? "Movement has reached a drill point and the cloud mission bus is waiting for the drill board to take over."
            : normalizedMissionState === "drilling" || normalizedMissionState === "sampling"
              ? "The drill board is currently handling the sampling cycle while the movement board waits for the shared mission bus to continue."
              : cloudMissionIsActive
                ? "The rover mission is active. This panel is following the live cloud state machine, and Force Cancel remains available only as a timeout-based safety escape hatch."
                : "Automation is the primary monitoring path. This panel will reflect the next rover run as soon as the cloud state machine starts it.";
  const missionCommandAckLabel = missionCommandAck
    ? `Firebase command acknowledged: ${missionCommandAck.command === "start" ? "Start" : missionCommandAck.command === "stop" ? "Stop" : "Force Cancel"} - ${missionCommandAck.missionId ? `Mission ${missionCommandAck.missionId}` : "Active mission"} - ${new Date(missionCommandAck.requestedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    : null;
  const movementStateLabel = formatMissionStateLabel(
    liveMissionSnapshot?.movementStatus.state ?? "offline",
    false,
  );
  const drillStateLabel = formatMissionStateLabel(
    liveMissionSnapshot?.drillStatus.state ?? "offline",
    false,
  );
  const movementDeviceOnline =
    liveMissionSnapshot?.devices.movement.deviceOnline ?? false;
  const drillDeviceOnline =
    liveMissionSnapshot?.devices.drill.deviceOnline ?? false;
  const movementDeviceLabel =
    liveMissionSnapshot?.devices.movement.deviceId ?? "movement-board";
  const drillDeviceLabel =
    liveMissionSnapshot?.devices.drill.deviceId ?? "drill-board";
  const automationMissionModeLabel = (
    automationState.missionMode ||
    automationSettings.missionMode ||
    "automatic"
  )
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
  const triggerStatusLabel = automationState.triggerDetected
    ? automationState.triggerReason
      ? `Triggered: ${automationState.triggerReason}`
      : "Triggered by live field conditions"
    : "No live trigger detected";
  const automationStateDescription =
    automationState.area1VerificationStatus === "running"
      ? "Area 1 verification is in progress before deciding whether the rover should continue to a full-zone monitoring pass."
      : automationState.area1VerificationStatus === "passed" &&
          automationState.fullMissionRequired
        ? "Area 1 verification confirmed that a full monitoring run is needed, so automation will continue across the remaining saved zones."
        : automationState.area1VerificationStatus === "failed" &&
            !automationState.fullMissionRequired
          ? "Area 1 verification did not justify a full-zone run, so automation can stop after saving the verification result."
          : automationState.area1VerificationStatus === "error"
            ? "Automation hit a verification error. Check alerts and device health before the next autonomous run."
            : automationState.missionMode === "manual_override"
              ? "The rover is currently following a manual override run started from the app."
              : automationState.missionMode === "maintenance"
                ? "Automation is in maintenance mode. Live monitoring is still visible, but autonomous runs should remain paused."
                : "Automation is watching live conditions and waiting for a threshold trigger or fallback schedule window.";
  const lastRunSummaryText = automationState.lastRunAt
    ? `Last run checked ${farmerRunSummary.zonesChecked} zone${farmerRunSummary.zonesChecked === 1 ? "" : "s"}: ${farmerRunSummary.irrigateNowCount} irrigate now, ${farmerRunSummary.scheduleSoonCount} schedule soon, ${farmerRunSummary.holdIrrigationCount} hold irrigation.`
    : "No completed automation run has been reported yet.";
  const lastRunAtLabel = automationState.lastRunAt
    ? `Last Run: ${new Date(automationState.lastRunAt).toLocaleString()}`
    : "Last Run: --";
  const nextEligibleRunLabel = automationState.nextEligibleRunAt
    ? new Date(automationState.nextEligibleRunAt).toLocaleString()
    : "No cooldown window active";
  const automationSettingsSummary = `Humidity <= ${automationSettings.humidityTriggerThreshold}% or air temperature >= ${automationSettings.airTemperatureTriggerThreshold}C, cooldown ${automationSettings.cooldownIntervalMinutes} min`;
  const missionCoordinationStatus = liveMissionSnapshot
    ? liveMissionSnapshot.missionBus.stopRequested
      ? `Stop requested. Waiting on${liveMissionSnapshot.stopAwaiting.movement ? " movement" : ""}${liveMissionSnapshot.stopAwaiting.movement && liveMissionSnapshot.stopAwaiting.drill ? " and" : ""}${liveMissionSnapshot.stopAwaiting.drill ? " drill" : ""} acknowledgement${!liveMissionSnapshot.stopAwaiting.movement && !liveMissionSnapshot.stopAwaiting.drill ? " and terminal state sync" : ""}.`
      : normalizedMissionState === "queued" || normalizedMissionState === "pending"
        ? "Mission is queued. The cloud state machine is waiting for the boards to acknowledge the new start command."
        : liveMissionSnapshot.missionBus.requestDrill && !liveMissionSnapshot.missionBus.drillStarted
          ? "Movement has requested a drill cycle. Waiting for the drill board to start."
          : liveMissionSnapshot.missionBus.drillStarted && !liveMissionSnapshot.missionBus.drillDone
            ? "Drill cycle in progress. The mission bus is waiting for the drill board to finish before movement continues."
            : liveMissionSnapshot.missionBus.drillDone
              ? "Drill cycle completed. Waiting for the movement board to resume or publish the next mission state."
              : cloudMissionIsActive
                ? "Both boards are active and the cloud mission bus is synchronized."
                : "Mission bus is idle and synchronized."
    : "Waiting for cloud mission snapshot.";
  const operationStatusText = selectedZone
    ? cloudMissionIsActive
      ? `${selectedZone.title} is selected and the rover is currently active. Live readings below come from Firebase telemetry, while the saved zone dials above stay pinned to the latest completed or stopped Supabase run.`
      : `${selectedZone.title} is selected and ready. Automation remains the primary monitoring path while this screen focuses on live status, saved results, and safety monitoring.`
    : "No active zone selected. Create or choose a zone to monitor the next rover run.";
  const recommendationSource =
    cloudMissionIsActive && hasLiveReadings
      ? {
          type: "live" as const,
          moisture: selectedMoisture,
          temperature: selectedTemperature,
          humidity: selectedHumidity,
          description:
            "This card automatically uses the live Firebase telemetry from the active mission so you can react to the rover's current field conditions.",
        }
      : selectedZone && selectedZoneHasSavedResult
        ? {
            type: "saved" as const,
          moisture: selectedZone.moistureValue,
          temperature: selectedZone.temperatureValue,
          humidity: selectedZone.humidityValue,
          description:
            "This card automatically uses the latest completed or stopped Supabase rover run saved for the selected zone, so the result stays tied to recorded field data.",
          }
        : null;
  const recommendationSourceLabel =
    recommendationSource?.type === "live"
      ? "Recommendation source: Live Firebase telemetry"
      : recommendationSource?.type === "saved"
        ? "Recommendation source: Saved Supabase rover run"
        : "Recommendation source: Waiting for live or saved rover readings";
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.allSettled([syncZoneAverages(), fetchLatestActiveRoverMission()])
      .then((results) => {
        const activeMission = results[1];
        if (activeMission?.status === "fulfilled" && activeMission.value) {
          setSelectedMissionId(activeMission.value.id);
          setActiveMissionZoneCode(activeMission.value.zone_code);
        } else if (
          activeMission?.status === "fulfilled" &&
          !activeMission.value &&
          !snapshotHasActiveMission(liveMissionSnapshotRef.current)
        ) {
          setSelectedMissionId(null);
          setActiveMissionZoneCode(null);
        }
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, [syncZoneAverages]);

  

  const handleForceCancelMission = useCallback(() => {
    const missionId = activeMissionTargetId;

    if (!cloudMissionIsActive && missionId === null) {
      Alert.alert(
        "No rover run to cancel",
        "There is no active or pending rover mission to force cancel right now.",
      );
      return;
    }

    Alert.alert(
      "Force cancel mission?",
      missionId
        ? `This will write another stop request and then mark mission ${missionId} as cancelled in Supabase as a timeout fallback. It will not overwrite device-owned Firebase state.`
        : "This will escalate the stop request without overwriting device-owned Firebase state.",
      [
        { text: "Keep Mission", style: "cancel" },
        {
          text: "Force Cancel",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setMissionCommandPending("cancel");
              setMissionCommandError(null);
              setMissionCommandAck(null);

              try {
                const command = await requestStopMission({
                  missionId,
                  zoneCode: activeMissionZoneLabel || null,
                  requestId: createMissionRequestId(),
                });
                if (missionId !== null) {
                  const stopRequestedAt = new Date(command.requestedAt).toISOString();
                  await updateRoverMissionStatus(missionId, "stopping", {
                    stop_requested_at: stopRequestedAt,
                    updated_at: stopRequestedAt,
                  });

                  if (forceCancelTimeoutRef.current) {
                    clearTimeout(forceCancelTimeoutRef.current);
                  }

                  forceCancelTimeoutRef.current = setTimeout(() => {
                    const latestSnapshot = liveMissionSnapshotRef.current;
                    const latestMissionId = latestSnapshot?.missionId ?? missionId;
                    const stillActive =
                      latestMissionId === missionId &&
                      (snapshotHasActiveMission(latestSnapshot) ||
                        latestSnapshot?.missionBus.stopRequested);

                    if (!stillActive) {
                      forceCancelTimeoutRef.current = null;
                      return;
                    }

                    const terminalAt = new Date().toISOString();
                    void updateRoverMissionStatus(missionId, "cancelled", {
                      finished_at: terminalAt,
                      updated_at: terminalAt,
                    }).catch((error) => {
                      console.warn(
                        `Failed to apply force-cancel timeout fallback for mission ${missionId}`,
                        error,
                      );
                    }).finally(() => {
                      forceCancelTimeoutRef.current = null;
                    });
                  }, FORCE_CANCEL_TIMEOUT_MS);
                }

                setMissionCommandAck({
                  command: "cancel",
                  requestedAt: command.requestedAt,
                  missionId: missionId ?? null,
                });

                Alert.alert(
                  "Force cancel armed",
                  missionId
                    ? `Mission ${missionId} was escalated with a stop request. If movement and drill acknowledgements do not arrive within ${Math.round(FORCE_CANCEL_TIMEOUT_MS / 1000)} seconds, the app will mark it as cancelled in Supabase as a timeout fallback.`
                    : `A force-cancel escalation was sent. If the boards do not acknowledge within ${Math.round(FORCE_CANCEL_TIMEOUT_MS / 1000)} seconds, the app will fall back to a cancelled mission state in Supabase.`,
                );
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "Failed to force cancel the rover mission.";
                setMissionCommandError(message);
                Alert.alert("Force Cancel failed", message);
              } finally {
                setMissionCommandPending(null);
              }
            })();
          },
        },
      ],
    );
  }, [activeMissionTargetId, activeMissionZoneLabel, cloudMissionIsActive]);

  const refreshRecommendation = useCallback(async () => {
    if (!IRRIGATION_API_URL) {
      setMlError("Add EXPO_PUBLIC_IRRIGATION_API_URL in .env.local.");
      return;
    }

    if (!recommendationSource) {
      setMlError(
        "Automatic recommendation is waiting for either live Firebase telemetry from an active mission or a saved Supabase rover run.",
      );
      return;
    }
    const safeMoisture = Number(recommendationSource.moisture);
    const safeTemperature = Number(recommendationSource.temperature);
    const safeHumidity = Number(recommendationSource.humidity);

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
          moisture: normalizeMoistureForModel(safeMoisture),
          temperature: safeTemperature,
          humidity: safeHumidity,
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
        safeMoisture,
        safeTemperature,
        safeHumidity,
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
      setMlLogMessage(
        recommendationSource.type === "live"
          ? "Recommendation auto-updated from live Firebase telemetry."
          : "Recommendation auto-updated from the latest saved Supabase rover run.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Prediction request failed.";
      setMlError(message);
    } finally {
      setMlLoading(false);
    }
  }, [recommendationSource, selectedZone]);

  const recommendationRequestKey = useMemo(() => {
    if (!selectedZone || !recommendationSource) {
      return null;
    }

    return JSON.stringify({
      zoneId: selectedZone.id,
      sourceType: recommendationSource.type,
      moisture: Number(recommendationSource.moisture).toFixed(2),
      temperature: Number(recommendationSource.temperature).toFixed(2),
      humidity: Number(recommendationSource.humidity).toFixed(2),
    });
  }, [recommendationSource, selectedZone]);

  useEffect(() => {
    if (!recommendationRequestKey || !recommendationSource || !selectedZone) {
      return;
    }

    if (lastRecommendationRequestKeyRef.current === recommendationRequestKey) {
      return;
    }

    const timeout = setTimeout(() => {
      lastRecommendationRequestKeyRef.current = recommendationRequestKey;
      void refreshRecommendation();
    }, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, [recommendationRequestKey, recommendationSource, refreshRecommendation, selectedZone]);

  const recommendationLabel = formatRecommendationLabel(mlRecommendation);
  const recommendationDisplay =
    mlRecommendation === null
      ? recommendationSource
        ? mlLoading
          ? "Updating recommendation..."
          : "Waiting for automatic recommendation"
        : "Waiting for readings"
      : recommendationLabel;
  const recommendationMeta = mlConfidence !== null
    ? `Confidence: ${(mlConfidence * 100).toFixed(1)}%. This card refreshes automatically when the current zone readings change.`
    : `This card refreshes automatically when live Firebase telemetry or the latest saved Supabase rover run becomes available.`;
  const confidenceHelperText = mlConfidence !== null
    ? "Confidence shows how sure the model is about this recommendation based on the latest sensor readings. It is not a guarantee."
    : null;
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
                  Use Manage Zones to create your first mission zone.
                </Text>
              </View>
            ) : null}
            {zones.map((plot) => {
              const isSelected = plot.id === selectedZone?.id;
              const savedRunLabel = !plot.hasSensorData
                ? "Waiting for terminal rover run data"
                : `Saved run: ${formatSavedRunStatusLabel(plot.savedRunStatus)}`;
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
                      <View style={styles.areaTitleTextWrap}>
                        <Text style={styles.areaTitle}>
                          {plot.title}
                        </Text>
                        <Text style={styles.areaSavedMeta}>{savedRunLabel}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.areaStatusWrap,
                        isSelected ? styles.areaStatusWrapSelected : styles.areaStatusWrapIdle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.areaStatusText,
                          isSelected && styles.areaStatusTextSelected,
                        ]}
                      >
                        {isSelected ? "Selected" : "Available"}
                      </Text>
                      <View
                        style={[
                          styles.areaStatusDot,
                          isSelected && styles.areaStatusDotSelected,
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
                      isEmpty={!plot.hasSensorData}
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
                      isEmpty={!plot.hasSensorData}
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
                      isEmpty={!plot.hasSensorData}
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
          <View style={styles.liveSourceBadge}>
            <Text style={styles.liveSourceBadgeText}>Saved Zone Results (Supabase)</Text>
          </View>
        </FadeInView>

        <FadeInView delay={88}>
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardLabel}>Trigger Status</Text>
              <View
                style={[
                  styles.statusCardDot,
                  { backgroundColor: automationState.triggerDetected ? "#f59e0b" : "#22c55e" },
                ]}
              />
            </View>
            <Text style={styles.statusCardBody}>{triggerStatusLabel}</Text>
            <Text style={styles.statusMeta}>
              {automationState.triggerDetected
                ? "Automation has detected a live condition that can start verification or a full monitoring run."
                : "Automation is idle and waiting for thresholds or a fallback schedule window."}
            </Text>
          </View>
        </FadeInView>

        <FadeInView delay={92}>
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardLabel}>Next Eligible Run</Text>
              <View
                style={[
                  styles.statusCardDot,
                  { backgroundColor: automationState.nextEligibleRunAt ? "#5bc0ff" : "#94a3b8" },
                ]}
              />
            </View>
            <Text style={styles.statusCardBody}>{nextEligibleRunLabel}</Text>
            <Text style={styles.statusMeta}>{automationSettingsSummary}</Text>
          </View>
        </FadeInView>

        <FadeInView delay={96}>
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardLabel}>Last Run Summary</Text>
              <View
                style={[
                  styles.statusCardDot,
                  { backgroundColor: automationState.lastRunAt ? "#22c55e" : "#64748b" },
                ]}
              />
            </View>
            <Text style={styles.statusCardBody}>{lastRunSummaryText}</Text>
            <Text style={styles.statusMeta}>{lastRunAtLabel}</Text>
          </View>
        </FadeInView>

        <FadeInView delay={100}>
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardLabel}>Automation State</Text>
              <View
                style={[
                  styles.statusCardDot,
                  {
                    backgroundColor:
                      automationState.missionMode === "maintenance"
                        ? "#f59e0b"
                        : automationState.fullMissionRequired
                          ? "#ef4444"
                          : "#5bc0ff",
                  },
                ]}
              />
            </View>
            <Text style={styles.statusCardBody}>{automationStateDescription}</Text>
            <View style={styles.statusMetaRow}>
              <Text style={styles.statusMeta}>{`Mode: ${automationMissionModeLabel}`}</Text>
              <Text style={styles.statusMeta}>{`Area 1: ${automationState.area1VerificationStatus}`}</Text>
              <Text style={styles.statusMeta}>{`Full Run: ${automationState.fullMissionRequired ? "Required" : "Not required"}`}</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={112}>
          <View style={styles.missionControlCard}>
            <View style={styles.statusCardHeader}>
                <Text style={styles.statusCardLabel}>Cloud Mission Control</Text>
              <View
                style={[
                  styles.statusCardDot,
                  { backgroundColor: missionStatusColor },
                ]}
              />
            </View>
            <Text style={styles.statusCardBody}>
              {missionCommandError ?? missionControlHelperText}
            </Text>
            <View style={styles.deviceStatusRow}>
              <View style={styles.deviceStatusCard}>
                <View style={styles.deviceStatusHeader}>
                  <Ionicons
                    name="navigate"
                    size={15}
                    color={movementDeviceOnline ? "#5bc0ff" : colors.textMuted}
                  />
                  <Text style={styles.deviceStatusLabel}>Movement Board</Text>
                </View>
                <Text style={styles.deviceStatusValue}>{movementStateLabel}</Text>
                <Text style={styles.deviceStatusMeta}>
                  {movementDeviceOnline ? movementDeviceLabel : "Offline"}
                </Text>
              </View>
              <View style={styles.deviceStatusCard}>
                <View style={styles.deviceStatusHeader}>
                  <Ionicons
                    name="construct"
                    size={15}
                    color={drillDeviceOnline ? "#7dd99c" : colors.textMuted}
                  />
                  <Text style={styles.deviceStatusLabel}>Drill Board</Text>
                </View>
                <Text style={styles.deviceStatusValue}>{drillStateLabel}</Text>
                <Text style={styles.deviceStatusMeta}>
                  {drillDeviceOnline ? drillDeviceLabel : "Offline"}
                </Text>
              </View>
            </View>
            <Text style={styles.missionCoordinationText}>
              {missionCoordinationStatus}
            </Text>
            {missionCommandAckLabel ? (
              <View style={styles.missionAckBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#5bc0ff" />
                <Text style={styles.missionAckText}>{missionCommandAckLabel}</Text>
              </View>
            ) : null}
            <View style={styles.statusMetaRow}>
              <Text style={styles.statusMeta}>{`Rover: ${missionStateLabel}`}</Text>
              <Text style={styles.statusMeta}>{`Selected Zone: ${selectedZone?.title ?? "--"}`}</Text>
              <Text style={styles.statusMeta}>{`Mission ID: ${activeMissionTargetId ?? "--"}`}</Text>
              <Text style={styles.statusMeta}>{`Cloud Zone: ${activeMissionZoneLabel || "--"}`}</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={120} style={styles.actionRow}>
          <DashboardAction
            icon="warning"
            label={missionCommandPending === "cancel" ? "Force Cancelling..." : "Force Cancel Mission"}
            onPress={handleForceCancelMission}
            disabled={!canForceCancelMission}
            variant="warning"
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={130} style={styles.actionRow}>
          <DashboardAction
            icon="add-circle"
            label="Manage Zones"
            onPress={handleSetLocation}
            styles={styles}
          />
          <DashboardAction
            icon="trash-outline"
            label="Remove Zone"
            onPress={handleRemoveLocation}
            styles={styles}
          />
        </FadeInView>

        <View style={styles.liveSectionHeader}>
          <Text style={styles.insightsTitle}>Live Readings</Text>
          <View style={styles.liveSourceBadge}>
            <Text style={styles.liveSourceBadgeText}>Live (Firebase)</Text>
          </View>
        </View>

        <FadeInView delay={140} style={styles.readingsGrid}>
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
            isEmpty={!hasLiveReadings}
            emptyText="Waiting for live Firebase data"
            styles={styles}
          />
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
            isEmpty={!hasLiveReadings}
            emptyText="Waiting for live Firebase data"
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
            isEmpty={!hasLiveReadings}
            emptyText="Waiting for live Firebase data"
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={190}>
          <Text style={styles.subsectionTitle}>Selected Zone Overview</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardLabel}>Rover Run Status</Text>
              <View
                style={[
                  styles.statusCardDot,
                  { backgroundColor: missionStatusColor },
                ]}
              />
            </View>
            <Text style={styles.statusCardBody}>{operationStatusText}</Text>
            <View style={styles.statusMetaRow}>
              <Text style={styles.statusMeta}>{`Selected Zone: ${selectedZone?.title ?? "--"}`}</Text>
              <Text style={styles.statusMeta}>{`Rover Status: ${missionStateLabel}`}</Text>
              <Text style={styles.statusMeta}>{`Mission ID: ${activeMissionTargetId ?? "--"}`}</Text>
              <Text style={styles.statusMeta}>{`Movement: ${movementStateLabel}`}</Text>
              <Text style={styles.statusMeta}>{`Drill: ${drillStateLabel}`}</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={220}>
          <View style={styles.recommendationCard}>
            <Text style={styles.recommendationSectionTitle}>
              Irrigation Recommendation
            </Text>
            <Text style={styles.mlBody}>
              {recommendationSource?.description ??
                "Select a zone with live telemetry or a saved rover run so this card can generate an automatic recommendation."}
            </Text>
            <Text style={styles.selectedAreaText}>{`Selected Zone: ${selectedZoneLabel}`}</Text>
            <Text style={styles.recommendationSourceText}>{recommendationSourceLabel}</Text>
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
            {confidenceHelperText ? (
              <View style={styles.confidenceHelperCard}>
                <Ionicons name="information-circle-outline" size={16} color="#8bc2ff" />
                <Text style={styles.confidenceHelperText}>{confidenceHelperText}</Text>
              </View>
            ) : null}
            <View style={styles.autoRecommendationNotice}>
              <Ionicons
                name={mlLoading ? "sync-circle" : "flash"}
                size={18}
                color="#8bc2ff"
              />
              <Text style={styles.autoRecommendationNoticeText}>
                {mlLoading
                  ? "Updating automatically from the latest zone readings..."
                  : recommendationSource
                    ? "Recommendation updates automatically whenever the selected zone readings change."
                    : "Recommendation will appear automatically once live telemetry or a saved rover run becomes available."}
              </Text>
            </View>
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
    areaTitleTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    areaTitle: {
      fontSize: compact ? 17 : 19,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    areaSavedMeta: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
    },
    areaStatusWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: 6,
    },
    areaStatusWrapSelected: {
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
    areaStatusTextSelected: {
      color: isDark ? "#c9f4da" : "#0d3b23",
    },
    areaStatusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#94a1b5",
    },
    areaStatusDotSelected: {
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
    areaDialEmptyText: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: compact ? 8.5 : 9.5,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: compact ? 11 : 12,
    },
    actionRow: {
      marginTop: APP_SPACING.lg,
      flexDirection: "row",
      gap: layout.isSmall ? APP_SPACING.sm : APP_SPACING.md,
    },
    liveSectionHeader: {
      marginTop: APP_SPACING.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
    },
    liveSourceBadge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      backgroundColor: colors.cardAltBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: 6,
    },
    liveSourceBadgeText: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
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
    actionButtonSuccess: {
      backgroundColor: "#16a34a",
    },
    actionButtonDanger: {
      backgroundColor: "#dc2626",
    },
    actionButtonWarning: {
      backgroundColor: "#d97706",
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
    missionControlCard: {
      marginTop: APP_SPACING.sm,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    deviceStatusRow: {
      flexDirection: "row",
      gap: APP_SPACING.sm,
      marginBottom: APP_SPACING.sm,
    },
    deviceStatusCard: {
      flex: 1,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    deviceStatusHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    deviceStatusLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: "700",
      flex: 1,
    },
    deviceStatusValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    deviceStatusMeta: {
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
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
      marginBottom: APP_SPACING.sm,
    },
    missionCoordinationText: {
      color: colors.textMuted,
      fontSize: typography.small,
      lineHeight: compact ? 16 : 18,
      marginBottom: APP_SPACING.sm,
    },
    missionAckBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.xs,
      borderRadius: APP_RADII.md,
      borderWidth: 1,
      borderColor: "#285c85",
      backgroundColor: "rgba(27, 51, 77, 0.45)",
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: 6,
      marginBottom: APP_SPACING.sm,
    },
    missionAckText: {
      color: "#8bc2ff",
      fontSize: typography.small,
      fontWeight: "600",
      flexShrink: 1,
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
    recommendationSourceText: {
      fontSize: typography.small,
      color: colors.textMuted,
      marginBottom: APP_SPACING.xs,
    },
    mlMeta: {
      fontSize: typography.small,
      color: colors.textMuted,
      marginBottom: APP_SPACING.md,
    },
    confidenceHelperCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
      borderRadius: APP_RADII.lg,
      backgroundColor: isDark ? "#16212f" : "#eef5ff",
      borderWidth: 1,
      borderColor: isDark ? "#27425f" : "#c8ddfb",
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
      marginTop: -APP_SPACING.xs,
      marginBottom: APP_SPACING.md,
    },
    confidenceHelperText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: compact ? 16 : 18,
    },
    autoRecommendationNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
      borderRadius: APP_RADII.lg,
      backgroundColor: isDark ? "#16212f" : "#eef5ff",
      borderWidth: 1,
      borderColor: isDark ? "#27425f" : "#c8ddfb",
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    autoRecommendationNoticeText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: compact ? 16 : 18,
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













