import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
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
import { FadeInView } from "@/components/ui/fade-in-view";
import {
  formatRecommendationLabel,
  getRecommendationAccent,
  getRecommendationExplanation,
} from "@/lib/irrigation-recommendation";
import {
  getFarmerRunSummary,
  useZonesStore,
  zonesStore,
  type Zone,
} from "@/lib/plots-store";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

type AreaStatus = "Healthy" | "Warning" | "Critical";

function SummaryMetricCard({
  icon,
  title,
  value,
  valueColor,
  tag = "SELECTED",
  isEmpty = false,
  emptyText = "No rover data yet",
  styles,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  valueColor: string;
  tag?: string;
  isEmpty?: boolean;
  emptyText?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTitleRow}>
        {icon}
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricTag}>{tag}</Text>
      {isEmpty ? (
        <Text style={styles.metricEmptyText}>{emptyText}</Text>
      ) : (
        <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
      )}
    </View>
  );
}

function hasSavedZoneData(plot: Zone) {
  return plot.hasSensorData;
}

function getAreaStatus(plot: Zone): AreaStatus {
  const badMoisture = plot.moistureValue < 30 || plot.moistureValue > 85;
  const warningMoisture =
    (plot.moistureValue >= 30 && plot.moistureValue < 45) ||
    (plot.moistureValue > 75 && plot.moistureValue <= 85);
  const badTemp = plot.temperatureValue < 18 || plot.temperatureValue > 35;
  const warningTemp =
    (plot.temperatureValue >= 18 && plot.temperatureValue < 22) ||
    (plot.temperatureValue > 30 && plot.temperatureValue <= 35);

  if (badMoisture || badTemp) {
    return "Critical";
  }
  if (warningMoisture || warningTemp) {
    return "Warning";
  }
  return "Healthy";
}

function getStatusColors(status: AreaStatus) {
  if (status === "Critical") {
    return {
      accent: "#ef5350",
      border: "#b93d3b",
      icon: "warning" as const,
      iconBg: "#432224",
    };
  }
  if (status === "Warning") {
    return {
      accent: "#f2b844",
      border: "#b8871a",
      icon: "alert" as const,
      iconBg: "#43341c",
    };
  }
  return {
    accent: "#7dd99c",
    border: "#4c9b67",
    icon: "checkmark" as const,
    iconBg: "#20382a",
  };
}

function getRecommendationColors(recommendation: string | null) {
  if (recommendation === "irrigate_now") {
    return {
      accent: "#ef5350",
      border: "#b93d3b",
      icon: "warning" as const,
      iconBg: "#432224",
    };
  }
  if (recommendation === "schedule_soon") {
    return {
      accent: "#f2b844",
      border: "#b8871a",
      icon: "alert" as const,
      iconBg: "#43341c",
    };
  }
  if (recommendation === "hold_irrigation") {
    return {
      accent: "#7dd99c",
      border: "#4c9b67",
      icon: "checkmark" as const,
      iconBg: "#20382a",
    };
  }
  return null;
}

function getMoistureStatusColor(value: number) {
  if (value < 30 || value > 85) {
    return "#ef5350";
  }
  if (value < 45 || value > 75) {
    return "#f2b844";
  }
  return "#7dd99c";
}

function getTemperatureStatusColor(value: number) {
  if (value < 18 || value > 40) {
    return "#ef5350";
  }
  if (value < 22 || value > 32) {
    return "#f2b844";
  }
  return "#7dd99c";
}

function getHumidityStatusColor(value: number) {
  if (value < 20 || value > 90) {
    return "#ef5350";
  }
  if (value < 30 || value > 80) {
    return "#f2b844";
  }
  return "#7dd99c";
}

function getRecommendationHistory(plots: Zone[]) {
  return plots
    .filter((plot) => hasSavedZoneData(plot) && Boolean(plot.recommendation))
    .map((plot) => ({
      id: `${plot.id}-recommendation`,
      title: `${formatRecommendationLabel(plot.recommendation)}: ${plot.title}`,
      body:
        plot.recommendationExplanation ??
        getRecommendationExplanation(
          plot.recommendation,
          plot.moistureValue,
          plot.temperatureValue,
          plot.humidityValue,
        ).body,
      status: (
        plot.recommendation === "irrigate_now"
          ? "Critical"
          : plot.recommendation === "schedule_soon"
            ? "Warning"
            : "Healthy"
      ) as AreaStatus,
    }))
    .slice(0, 6);
}

function getNextAction(plots: Zone[]) {
  const plotsWithData = plots.filter(hasSavedZoneData);

  if (plots.length === 0 || plotsWithData.length === 0) {
    return "No zone data available yet.";
  }

  const irrigateNowAreas = plotsWithData.filter(
    (plot) => plot.recommendation === "irrigate_now",
  );
  if (irrigateNowAreas.length > 0) {
    const areaNames = irrigateNowAreas
      .map((plot) => plot.title)
      .join(", ");
    return `Immediate response needed: begin irrigation for ${areaNames} as soon as possible, monitor the soil moisture after watering, and check whether temperature and humidity remain unfavorable during the next reading cycle.`;
  }

  const scheduleSoonAreas = plotsWithData.filter(
    (plot) => plot.recommendation === "schedule_soon",
  );
  if (scheduleSoonAreas.length > 0) {
    const areaNames = scheduleSoonAreas
      .map((plot) => plot.title)
      .join(", ");
    return `Prepare the irrigation setup for ${areaNames}, but you do not need to irrigate immediately yet. Recheck the next readings closely and be ready to water if moisture drops further or the area becomes hotter and drier.`;
  }

  const holdAreas = plotsWithData.filter(
    (plot) => plot.recommendation === "hold_irrigation",
  );
  if (holdAreas.length > 0) {
    return "No irrigation is needed right now. Keep observing the saved zones, allow the current soil moisture to hold, and wait for the next recommendation cycle before making any irrigation changes.";
  }

  const avgMoisture =
    plotsWithData.reduce((sum, plot) => sum + plot.moistureValue, 0) /
    plotsWithData.length;
  const criticalCount = plotsWithData.filter(
    (plot) => getAreaStatus(plot) === "Critical",
  ).length;
  const warningCount = plotsWithData.filter(
    (plot) => getAreaStatus(plot) === "Warning",
  ).length;

  if (criticalCount > 0) {
    return `There ${criticalCount > 1 ? "are" : "is"} ${criticalCount} critical zone${criticalCount > 1 ? "s" : ""} without a saved recommendation yet. Inspect ${criticalCount > 1 ? "those zones" : "that zone"} first, confirm the sensor readings, and request a recommendation immediately after review.`;
  }
  if (warningCount > 0) {
    return `There ${warningCount > 1 ? "are" : "is"} ${warningCount} warning zone${warningCount > 1 ? "s" : ""} still needing closer observation. Continue monitoring the readings, especially moisture trends, before deciding whether irrigation should be scheduled.`;
  }
  return `The monitored zones are currently stable with an average soil moisture of ${avgMoisture.toFixed(0)}%. Continue regular monitoring and wait for new readings before taking irrigation action.`;
}

function getPriorityScore(plot: Zone) {
  if (!hasSavedZoneData(plot)) {
    return -1000;
  }

  if (plot.recommendation === "irrigate_now") {
    return 300 + (100 - plot.moistureValue);
  }
  if (plot.recommendation === "schedule_soon") {
    return 200 + (100 - plot.moistureValue);
  }
  if (plot.recommendation === "hold_irrigation") {
    return 100 - plot.moistureValue;
  }

  const status = getAreaStatus(plot);
  if (status === "Critical") {
    return 250 + (100 - plot.moistureValue);
  }
  if (status === "Warning") {
    return 150 + (100 - plot.moistureValue);
  }
  return 50 - plot.moistureValue;
}

function getPrioritySummary(plot: Zone) {
  const areaName = plot.title;
  if (!hasSavedZoneData(plot)) {
    return `${areaName} has no recorded rover readings yet, so there is nothing to summarize.`;
  }

  if (plot.recommendation === "irrigate_now") {
    return `${areaName} needs the fastest response based on the latest recommendation.`;
  }
  if (plot.recommendation === "schedule_soon") {
    return `${areaName} should be prepared for irrigation soon if readings continue to worsen.`;
  }
  if (plot.recommendation === "hold_irrigation") {
    return `${areaName} is stable for now and can stay under observation.`;
  }

  const status = getAreaStatus(plot);
  if (status === "Critical") {
    return `${areaName} is the highest-risk zone from the current sensor thresholds.`;
  }
  if (status === "Warning") {
    return `${areaName} should be monitored closely against the rest of the field zones.`;
  }
  return `${areaName} is currently the most stable among the monitored zones.`;
}

function formatRunFieldLabel(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function formatSavedRunTimestamp(value: string | null | undefined) {
  if (!value) {
    return "No saved timestamp";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "No saved timestamp";
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SummaryTabScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors, fontScale);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("summary");
  const { zones, selectedZoneId } = useZonesStore();
  const [refreshing, setRefreshing] = useState(false);

  const selectedPlot = useMemo(
    () => zones.find((plot) => plot.id === selectedZoneId) ?? zones[0] ?? null,
    [zones, selectedZoneId]
  );
  const recommendationHistory = useMemo(() => getRecommendationHistory(zones), [zones]);
  const nextAction = useMemo(() => getNextAction(zones), [zones]);
  const farmerSummary = useMemo(() => getFarmerRunSummary(zones), [zones]);
  const priorityQueue = useMemo(
    () =>
      [...zones]
        .filter(hasSavedZoneData)
        .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
        .slice(0, 3),
    [zones]
  );
  const selectedPlotHasData = selectedPlot ? hasSavedZoneData(selectedPlot) : false;
  const selectedMoisture = selectedPlot?.moistureValue ?? 0;
  const selectedTemperature = selectedPlot?.temperatureValue ?? 0;
  const selectedHumidity = selectedPlot?.humidityValue ?? 0;
  const selectedMoistureColor = getMoistureStatusColor(selectedMoisture);
  const selectedTemperatureColor = getTemperatureStatusColor(selectedTemperature);
  const selectedHumidityColor = getHumidityStatusColor(selectedHumidity);
  const selectedRecommendation = selectedPlot?.recommendation ?? null;
  const selectedRecommendationLabel = formatRecommendationLabel(selectedRecommendation);
  const selectedRecommendationAccent = getRecommendationAccent(selectedRecommendation);
  const selectedRecommendationDetails = getRecommendationExplanation(
    selectedPlotHasData ? selectedRecommendation : null,
    selectedPlotHasData ? selectedPlot?.moistureValue ?? 0 : 0,
    selectedPlotHasData ? selectedPlot?.temperatureValue ?? 0 : 0,
    selectedPlotHasData ? selectedPlot?.humidityValue ?? 0 : 0,
  );
  const selectedRecommendationTitle =
    selectedPlot?.recommendationTitle ?? selectedRecommendationDetails.title;
  const selectedRecommendationExplanation =
    selectedPlot?.recommendationExplanation ?? selectedRecommendationDetails.body;
  const selectedSavedRunStatusLabel = formatRunFieldLabel(
    selectedPlot?.savedRunStatus,
    "Saved run available",
  );
  const selectedMovementFinalLabel = formatRunFieldLabel(
    selectedPlot?.movementStateFinal,
    "No movement final state",
  );
  const selectedDrillFinalLabel = formatRunFieldLabel(
    selectedPlot?.drillStateFinal,
    "No drill final state",
  );
  const selectedSavedRunTimestamp = formatSavedRunTimestamp(
    selectedPlot?.savedRunUpdatedAt ?? selectedPlot?.savedRunCreatedAt,
  );
  const selectedTopConfidence = selectedPlot?.topConfidence ?? 0;
  const selectedPredictionStatus = selectedPlot?.predictionStatus ?? "unknown";
  const selectedLowConfidence = selectedPlot?.lowConfidence ?? false;
  const selectedErrorMessage = (selectedPlot?.errorMessage ?? "").trim();
  const selectedModelVersion = (selectedPlot?.modelVersion ?? "").trim();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monitoring Summary</Text>
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
        contentContainerStyle={[styles.content, { paddingBottom: APP_SPACING.xxl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={40}>
          <Text style={styles.sectionTitle}>Zone Overview</Text>
          {zones.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <View style={styles.emptyHistoryIconWrap}>
                <Ionicons name="map-outline" size={22} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyHistoryTitle}>No saved zones yet</Text>
              <Text style={styles.emptyHistoryBody}>
                Add a zone from the Control screen first. Monitoring Summary will show
                zone health, recommendations, and mission history after at least one
                zone has been saved.
              </Text>
            </View>
          ) : (
            <View style={styles.overviewList}>
              {zones.map((plot) => {
                const zoneHasData = hasSavedZoneData(plot);
                const status = zoneHasData ? getAreaStatus(plot) : "Warning";
                const statusColors =
                  (zoneHasData ? getRecommendationColors(plot.recommendation) : null) ??
                  getStatusColors(status);
                const isSelected = plot.id === selectedPlot?.id;
                const areaName = plot.title;
                const summaryState = !zoneHasData
                  ? "No rover data yet"
                  : plot.recommendation && formatRecommendationLabel(plot.recommendation) !== "No prediction yet"
                    ? formatRecommendationLabel(plot.recommendation)
                    : status;
                const savedRunMeta = zoneHasData
                  ? `Run ${formatRunFieldLabel(plot.savedRunStatus, "Saved")}`
                  : "Waiting for rover history";
                return (
                  <TouchableOpacity
                    key={plot.id}
                    style={[
                      styles.overviewRow,
                      { borderColor: statusColors.border },
                      isSelected && styles.overviewCardSelected,
                      isSelected && {
                        shadowColor: statusColors.accent,
                        borderColor: statusColors.accent,
                      },
                    ]}
                    onPress={() => zonesStore.setSelectedZone(plot.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${areaName}`}
                  >
                    <View style={styles.overviewRowLeft}>
                      <View style={[styles.overviewIconWrap, { backgroundColor: statusColors.iconBg }]}>
                        <Ionicons name={statusColors.icon} size={24} color={statusColors.accent} />
                      </View>
                      <View style={styles.overviewTextWrap}>
                        <View style={styles.overviewTopLine}>
                          <Text style={styles.overviewLabel}>{areaName}</Text>
                        </View>
                        <Text style={styles.overviewSummary}>{getPrioritySummary(plot)}</Text>
                        <Text style={styles.overviewMeta}>{savedRunMeta}</Text>
                      </View>
                    </View>
                    <View style={styles.overviewRightWrap}>
                      <Text style={[styles.overviewState, { color: statusColors.accent }]}>
                        {summaryState}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </FadeInView>

        {zones.length > 0 ? (
          <FadeInView delay={80} style={styles.legendRow}>
            {(["Healthy", "Warning", "Critical"] as AreaStatus[]).map((status) => {
              const statusColors = getStatusColors(status);
              return (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: statusColors.accent }]} />
                  <Text style={styles.legendText}>{status}</Text>
                </View>
              );
            })}
          </FadeInView>
        ) : null}

        {zones.length > 0 ? (
          <FadeInView delay={95}>
            <View style={styles.farmerSummaryCard}>
              <Text style={styles.farmerSummaryLabel}>Saved Run Summary</Text>
              <Text style={styles.farmerSummaryTitle}>
                Latest saved rover results across monitored zones
              </Text>
              <View style={styles.farmerSummaryGrid}>
                <View style={styles.farmerSummaryMetric}>
                  <Text style={styles.farmerSummaryMetricLabel}>Zones Checked</Text>
                  <Text style={styles.farmerSummaryMetricValue}>
                    {farmerSummary.zonesChecked}
                  </Text>
                </View>
                <View style={styles.farmerSummaryMetric}>
                  <Text style={styles.farmerSummaryMetricLabel}>Irrigate Now</Text>
                  <Text
                    style={[
                      styles.farmerSummaryMetricValue,
                      { color: "#ef5350" },
                    ]}
                  >
                    {farmerSummary.irrigateNowCount}
                  </Text>
                </View>
                <View style={styles.farmerSummaryMetric}>
                  <Text style={styles.farmerSummaryMetricLabel}>Schedule Soon</Text>
                  <Text
                    style={[
                      styles.farmerSummaryMetricValue,
                      { color: "#f2b844" },
                    ]}
                  >
                    {farmerSummary.scheduleSoonCount}
                  </Text>
                </View>
                <View style={styles.farmerSummaryMetric}>
                  <Text style={styles.farmerSummaryMetricLabel}>Hold Irrigation</Text>
                  <Text
                    style={[
                      styles.farmerSummaryMetricValue,
                      { color: "#7dd99c" },
                    ]}
                  >
                    {farmerSummary.holdIrrigationCount}
                  </Text>
                </View>
              </View>
            </View>
          </FadeInView>
        ) : null}

        {zones.length > 0 ? (
          <FadeInView delay={110}>
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationLabel}>Selected Zone Recommendation</Text>
              <Text style={[styles.recommendationValue, { color: selectedRecommendationAccent }]}>
                {selectedPlotHasData ? selectedRecommendationLabel : "No rover data yet"}
              </Text>
              <Text style={styles.recommendationTitle}>
                {selectedPlotHasData ? selectedRecommendationTitle : "Waiting for rover run data"}
              </Text>
              <Text style={styles.recommendationBody}>
                {selectedPlotHasData
                  ? selectedRecommendationExplanation
                  : "This zone does not have recorded rover-run averages yet, so the app cannot summarize its condition or produce a reliable recommendation."}
              </Text>
              <View style={styles.runContextWrap}>
                <View style={styles.runContextChip}>
                  <Text style={styles.runContextLabel}>RUN</Text>
                  <Text style={styles.runContextValue}>
                    {selectedPlotHasData ? selectedSavedRunStatusLabel : "No saved run"}
                  </Text>
                </View>
                <View style={styles.runContextChip}>
                  <Text style={styles.runContextLabel}>MOVEMENT</Text>
                  <Text style={styles.runContextValue}>
                    {selectedPlotHasData ? selectedMovementFinalLabel : "No final state"}
                  </Text>
                </View>
                <View style={styles.runContextChip}>
                  <Text style={styles.runContextLabel}>DRILL</Text>
                  <Text style={styles.runContextValue}>
                    {selectedPlotHasData ? selectedDrillFinalLabel : "No final state"}
                  </Text>
                </View>
              </View>
              <Text style={styles.recommendationMeta}>
                {selectedPlotHasData
                  ? `Latest terminal rover run recorded ${selectedSavedRunTimestamp}.`
                  : "Waiting for a completed or stopped rover run to be saved for this zone."}
              </Text>
              {selectedPlotHasData ? (
                <View style={styles.reliabilityWrap}>
                  <Text style={styles.reliabilityLabel}>Recommendation Reliability</Text>
                  <View style={styles.reliabilityGrid}>
                    <View style={styles.reliabilityChip}>
                      <Text style={styles.reliabilityChipLabel}>TOP CONFIDENCE</Text>
                      <Text style={styles.reliabilityChipValue}>
                        {(selectedTopConfidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.reliabilityChip}>
                      <Text style={styles.reliabilityChipLabel}>STATUS</Text>
                      <Text style={styles.reliabilityChipValue}>
                        {formatRunFieldLabel(selectedPredictionStatus, "Unknown")}
                      </Text>
                    </View>
                    <View style={styles.reliabilityChip}>
                      <Text style={styles.reliabilityChipLabel}>LOW CONFIDENCE</Text>
                      <Text
                        style={[
                          styles.reliabilityChipValue,
                          { color: selectedLowConfidence ? "#f2b844" : colors.textPrimary },
                        ]}
                      >
                        {selectedLowConfidence ? "Yes" : "No"}
                      </Text>
                    </View>
                    <View style={styles.reliabilityChip}>
                      <Text style={styles.reliabilityChipLabel}>MODEL</Text>
                      <Text style={styles.reliabilityChipValue}>
                        {selectedModelVersion || "Not recorded"}
                      </Text>
                    </View>
                  </View>
                  {selectedErrorMessage ? (
                    <View style={styles.reliabilityErrorCard}>
                      <Text style={styles.reliabilityErrorLabel}>Error / Advisory</Text>
                      <Text style={styles.reliabilityErrorBody}>{selectedErrorMessage}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.selectedSnapshotRow}>
                <SummaryMetricCard
                  title="Moisture"
                  value={`${selectedMoisture.toFixed(0)}%`}
                  valueColor={selectedMoistureColor}
                  icon={<Ionicons name="water" size={16} color={selectedMoistureColor} />}
                  tag="SNAPSHOT"
                  isEmpty={!selectedPlotHasData}
                  styles={styles}
                />
                <SummaryMetricCard
                  title="Temperature"
                  value={`${selectedTemperature.toFixed(1)}C`}
                  valueColor={selectedTemperatureColor}
                  icon={<Ionicons name="thermometer" size={16} color={selectedTemperatureColor} />}
                  tag="SNAPSHOT"
                  isEmpty={!selectedPlotHasData}
                  styles={styles}
                />
                <SummaryMetricCard
                  title="Air Humidity"
                  value={`${selectedHumidity.toFixed(0)}%`}
                  valueColor={selectedHumidityColor}
                  icon={<Ionicons name="cloud" size={16} color={selectedHumidityColor} />}
                  tag="SNAPSHOT"
                  isEmpty={!selectedPlotHasData}
                  styles={styles}
                />
              </View>
            </View>
          </FadeInView>
        ) : null}

        <FadeInView delay={140} style={styles.metricsGrid}>
          <Text style={styles.subsectionTitle}>Priority Queue</Text>
          {priorityQueue.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <View style={styles.emptyHistoryIconWrap}>
                <Ionicons name="stats-chart-outline" size={22} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyHistoryTitle}>No prioritized zones yet</Text>
              <Text style={styles.emptyHistoryBody}>
                Priority ranking will appear after the rover records averaged readings for at least one zone.
              </Text>
            </View>
          ) : priorityQueue.map((plot, index) => {
            const areaName = plot.title;
            const accent =
              getRecommendationColors(plot.recommendation)?.accent ??
              getStatusColors(getAreaStatus(plot)).accent;
            return (
              <TouchableOpacity
                key={`priority-${plot.id}`}
                style={[
                  styles.priorityCard,
                  plot.id === selectedPlot?.id && styles.priorityCardSelected,
                ]}
                onPress={() => zonesStore.setSelectedZone(plot.id)}
                accessibilityRole="button"
                accessibilityLabel={`Review ${areaName} priority details`}
              >
                <View style={styles.priorityRankWrap}>
                  <Text style={styles.priorityRank}>{String(index + 1)}</Text>
                </View>
                <View style={styles.priorityContent}>
                  <View style={styles.priorityHeader}>
                    <Text style={styles.priorityAreaName}>{areaName}</Text>
                    <Text style={[styles.priorityState, { color: accent }]}>
                      {formatRecommendationLabel(plot.recommendation) === "No prediction yet"
                        ? getAreaStatus(plot)
                        : formatRecommendationLabel(plot.recommendation)}
                    </Text>
                  </View>
                  <Text style={styles.prioritySummary}>{getPrioritySummary(plot)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </FadeInView>

        <FadeInView delay={200}>
          <View style={styles.alertsSection}>
            <Text style={styles.alertsTitle}>Recommendation History</Text>
            {recommendationHistory.length === 0 ? (
              <View style={styles.emptyHistoryCard}>
                <View style={styles.emptyHistoryIconWrap}>
                  <Ionicons name="time-outline" size={22} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyHistoryTitle}>No recommendation history yet</Text>
                <Text style={styles.emptyHistoryBody}>
                  Saved recommendations will appear here after you request one for a zone
                  from the Home screen. Select a zone, run a recommendation, and come back
                  here to review its history.
                </Text>
              </View>
            ) : (
              recommendationHistory.map((alert) => {
                const statusColors = getStatusColors(alert.status);
                return (
                  <View key={alert.id} style={[styles.alertCard, { borderColor: statusColors.border }]}>
                    <Ionicons
                      name={alert.status === "Healthy" ? "checkmark-circle" : "warning"}
                      size={22}
                      color={statusColors.accent}
                    />
                    <View style={styles.alertContent}>
                      <Text style={styles.alertHeadline}>{alert.title}</Text>
                      <Text style={styles.alertBody}>{alert.body}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </FadeInView>

        <FadeInView delay={230}>
          <View style={styles.nextActionWrap}>
            <Text style={styles.nextActionTitle}>Next Action</Text>
            <Text style={styles.nextActionBody}>{nextAction}</Text>
          </View>
        </FadeInView>
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"], fontScale = 1) {
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
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      width: "100%",
      maxWidth: layout.isLarge ? 980 : 560,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? APP_SPACING.md : APP_SPACING.xl,
      paddingTop: APP_SPACING.md,
    },
    sectionTitle: {
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: APP_SPACING.sm,
    },
    overviewList: {
      gap: APP_SPACING.sm,
    },
    overviewRow: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.md,
    },
    overviewCardSelected: {
      backgroundColor: colors.cardAltBg,
      borderWidth: 2,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    overviewRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.md,
      flex: 1,
      minWidth: 0,
    },
    overviewIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    overviewTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    overviewTopLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
      marginBottom: 4,
    },
    overviewLabel: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      flex: 1,
    },
    overviewSummary: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    overviewMeta: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
    },
    overviewState: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      textTransform: "uppercase",
      textAlign: "right",
      maxWidth: 108,
    },
    overviewRightWrap: {
      alignItems: "flex-end",
      justifyContent: "center",
    },
    legendRow: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.md,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: typography.body,
      fontWeight: "600",
    },
    metricsGrid: {
      marginTop: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    subsectionTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
      marginBottom: APP_SPACING.sm,
    },
    priorityCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.lg,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      marginBottom: APP_SPACING.sm,
    },
    priorityCardSelected: {
      backgroundColor: colors.cardAltBg,
      borderColor: colors.selectedRowBg,
    },
    priorityRankWrap: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: colors.tagBg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    priorityRank: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "800",
    },
    priorityContent: {
      flex: 1,
    },
    priorityHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
      marginBottom: 4,
    },
    priorityAreaName: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    priorityState: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    prioritySummary: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    metricCard: {
      flex: 1,
      minHeight: compact ? 98 : 104,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: compact ? APP_SPACING.sm : APP_SPACING.md,
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
    metricTag: {
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
      color: colors.textPrimary,
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
    recommendationCard: {
      marginTop: APP_SPACING.md,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    recommendationLabel: {
      color: colors.textMuted,
      fontSize: typography.cardTitle,
      fontWeight: "700",
      marginBottom: APP_SPACING.xs,
    },
    recommendationValue: {
      fontSize: compact ? 20 : 22,
      fontWeight: "700",
      marginBottom: APP_SPACING.xs,
    },
    recommendationTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      marginBottom: APP_SPACING.xs,
    },
    recommendationBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    recommendationMeta: {
      marginTop: APP_SPACING.sm,
      color: colors.textMuted,
      fontSize: typography.small,
      lineHeight: compact ? 16 : 18,
    },
    farmerSummaryCard: {
      marginTop: APP_SPACING.md,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    farmerSummaryLabel: {
      color: colors.textMuted,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    farmerSummaryTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      lineHeight: compact ? 20 : 22,
    },
    farmerSummaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    farmerSummaryMetric: {
      flexGrow: 1,
      minWidth: 120,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    farmerSummaryMetricLabel: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    farmerSummaryMetricValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "800",
    },
    reliabilityWrap: {
      marginTop: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    reliabilityLabel: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    reliabilityGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    reliabilityChip: {
      flexGrow: 1,
      minWidth: 130,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    reliabilityChipLabel: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    reliabilityChipValue: {
      color: colors.textPrimary,
      fontSize: typography.small,
      fontWeight: "700",
      lineHeight: compact ? 16 : 18,
    },
    reliabilityErrorCard: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: "#b8871a",
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    reliabilityErrorLabel: {
      color: "#f2b844",
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    reliabilityErrorBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    runContextWrap: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    runContextChip: {
      flexGrow: 1,
      minWidth: 96,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    runContextLabel: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    runContextValue: {
      color: colors.textPrimary,
      fontSize: typography.small,
      fontWeight: "700",
      lineHeight: compact ? 16 : 18,
    },
    selectedSnapshotRow: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
    },
    tableCard: {
      marginTop: APP_SPACING.sm,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.tableHeaderBorder,
      backgroundColor: colors.cardBg,
      overflow: "hidden",
    },
    tableHeader: {
      backgroundColor: colors.tableHeaderBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableHeaderBorder,
      paddingHorizontal: compact ? APP_SPACING.xs : APP_SPACING.sm,
    },
    tableRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: compact ? APP_SPACING.sm : APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableRowBorder,
    },
    selectedTableRow: {
      backgroundColor: colors.selectedRowBg,
    },
    tableCell: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    centerCell: {
      textAlign: "center",
    },
    tableHeaderText: {
      color: colors.textPrimary,
      fontSize: compact ? 12 : typography.tableHeader,
      fontWeight: "700",
    },
    tableBodyText: {
      color: colors.textSecondary,
      fontSize: compact ? 13 : typography.body,
    },
    tableStatusText: {
      fontSize: compact ? 13 : typography.body,
      fontWeight: "700",
    },
    areaCell: {
      flex: 0.95,
    },
    moistureCell: {
      flex: 1.05,
    },
    tempCell: {
      flex: 1.1,
    },
    humidityCell: {
      flex: 1.05,
    },
    statusCell: {
      flex: 0.95,
      textAlign: "right",
    },
    alertsSection: {
      marginTop: APP_SPACING.lg,
    },
    alertsTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      marginBottom: APP_SPACING.sm,
    },
    alertCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
      borderWidth: 1,
      borderRadius: APP_RADII.lg,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      marginBottom: APP_SPACING.sm,
    },
    emptyHistoryCard: {
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.xl,
      paddingVertical: APP_SPACING.xxl,
    },
    emptyHistoryIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.tagBg,
      marginBottom: APP_SPACING.md,
    },
    emptyHistoryTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      marginBottom: APP_SPACING.xs,
      textAlign: "center",
    },
    emptyHistoryBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
      textAlign: "center",
      maxWidth: 360,
    },
    alertContent: {
      flex: 1,
    },
    alertHeadline: {
      color: colors.textPrimary,
      fontSize: compact ? 15 : 17,
      fontWeight: "700",
      marginBottom: 2,
    },
    alertBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    nextActionWrap: {
      marginTop: APP_SPACING.sm,
      marginBottom: APP_SPACING.md,
    },
    nextActionTitle: {
      color: "#64cc8a",
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      marginBottom: APP_SPACING.xs,
    },
    nextActionBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
  });
}

