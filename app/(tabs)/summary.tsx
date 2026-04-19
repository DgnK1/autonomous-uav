import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatRecommendationLabel } from "@/lib/irrigation-recommendation";
import { FIXED_ZONES, getFarmerRunSummary, useZonesStore, zonesStore } from "@/lib/plots-store";
import {
  buildZoneMap,
  fetchLatestRecommendationsByZone,
  fetchLatestZoneSummaries,
  fetchRecentSampleResults,
  getFixedZoneCodeForStoreZone,
  type SampleResultSnapshot,
  type ZoneRecommendation,
  type ZoneSummary,
} from "@/lib/supabase-zone-averages";
import { formatDateTimePH } from "@/lib/time";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

type RecommendationDisplayState = "success" | "waiting" | "error";

function formatTimestamp(value: string | null | undefined, emptyText = "Not available") {
  if (!value) {
    return emptyText;
  }

  const formatted = formatDateTimePH(value);
  return formatted === "-" ? emptyText : formatted;
}

function formatMetric(value: number | null | undefined, digits = 1, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

function getRecommendationState(summary: ZoneSummary, recommendation: ZoneRecommendation) {
  if (
    summary.errorFlag ||
    recommendation.errorFlag ||
    summary.predictionStatus === "invalid_input" ||
    summary.predictionStatus === "api_error" ||
    recommendation.predictionStatus === "invalid_input" ||
    recommendation.predictionStatus === "api_error"
  ) {
    return "error" as RecommendationDisplayState;
  }

  if (
    recommendation.predictionStatus === "success" &&
    recommendation.recommendation
  ) {
    return "success" as RecommendationDisplayState;
  }

  return "waiting" as RecommendationDisplayState;
}

function getRecommendationAccent(state: RecommendationDisplayState) {
  if (state === "error") {
    return "#ef5350";
  }
  if (state === "success") {
    return "#64cc8a";
  }
  return "#f2b844";
}

function getSummaryStatusLabel(state: RecommendationDisplayState, recommendation: string | null) {
  if (state === "error") {
    return "Advisory";
  }
  if (state === "success") {
    return formatRecommendationLabel(recommendation);
  }
  return "Waiting";
}

function getRecommendationHeadline(summary: ZoneSummary, recommendation: ZoneRecommendation) {
  const state = getRecommendationState(summary, recommendation);

  if (state === "error") {
    return "Advisory state detected";
  }

  if (state === "success") {
    return formatRecommendationLabel(recommendation.recommendation);
  }

  return "Waiting for automatic recommendation";
}

function getRecommendationBody(summary: ZoneSummary, recommendation: ZoneRecommendation) {
  const state = getRecommendationState(summary, recommendation);

  if (state === "error") {
    return (
      recommendation.errorMessage ??
      summary.errorMessage ??
      "The latest processed row reported an advisory or error state. Check the upstream sample and model pipeline."
    );
  }

  if (state === "success") {
    return "Automatic recommendation from Supabase";
  }

  return "Waiting for automatic recommendation";
}

function getSampleRowStatus(sample: SampleResultSnapshot) {
  if (
    sample.errorFlag ||
    sample.predictionStatus === "invalid_input" ||
    sample.predictionStatus === "api_error"
  ) {
    return { label: "Advisory", color: "#ef5350" };
  }

  if (sample.predictionStatus === "success" && sample.recommendation) {
    return { label: formatRecommendationLabel(sample.recommendation), color: "#64cc8a" };
  }

  return { label: "Waiting", color: "#f2b844" };
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentSamples, setRecentSamples] = useState<SampleResultSnapshot[]>([]);
  const [zoneSummaries, setZoneSummaries] = useState<ZoneSummary[]>([]);
  const [zoneRecommendations, setZoneRecommendations] = useState<ZoneRecommendation[]>([]);
  const [sampleHistoryExpanded, setSampleHistoryExpanded] = useState(false);

  const selectedStoreZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null,
    [zones, selectedZoneId],
  );

  const selectedZoneCode = selectedStoreZone
    ? getFixedZoneCodeForStoreZone(selectedStoreZone)
    : FIXED_ZONES[0].code;

  const summaryMap = useMemo(() => buildZoneMap(zoneSummaries), [zoneSummaries]);
  const recommendationMap = useMemo(
    () => buildZoneMap(zoneRecommendations),
    [zoneRecommendations],
  );

  const selectedSummary = summaryMap[selectedZoneCode];
  const selectedRecommendation = recommendationMap[selectedZoneCode];
  const selectedRecommendationState = getRecommendationState(
    selectedSummary,
    selectedRecommendation,
  );
  const farmerSummary = useMemo(() => getFarmerRunSummary(zones), [zones]);

  const loadSummary = useCallback(async () => {
    setLoadError(null);
    setLoading(true);

    try {
      const [summaries, recommendations, samples] = await Promise.all([
        fetchLatestZoneSummaries(),
        fetchLatestRecommendationsByZone(),
        fetchRecentSampleResults(30),
      ]);

      setZoneSummaries(summaries);
      setZoneRecommendations(recommendations);
      setRecentSamples(samples);

      const recommendationByCode = buildZoneMap(recommendations);
      const summaryByCode = buildZoneMap(summaries);

      FIXED_ZONES.forEach((zone) => {
        const summary = summaryByCode[zone.code];
        const recommendation = recommendationByCode[zone.code];
        const moistureValue = recommendation.soilMoisturePct ?? summary.soilMoisturePct;
        const temperatureValue =
          recommendation.thermistorC ?? recommendation.airTempC ?? summary.thermistorC;
        const humidityValue = recommendation.humidityPct ?? summary.humidityPct;
        const hasSensorData =
          moistureValue !== null && temperatureValue !== null && humidityValue !== null;
        const savedMissionId = recommendation.missionId ? Number(recommendation.missionId) : null;

        zonesStore.updateZoneSavedResult(zone.id, {
          hasSensorData,
          moistureValue: hasSensorData ? moistureValue : 0,
          temperatureValue: hasSensorData ? temperatureValue : 0,
          humidityValue: hasSensorData ? humidityValue : 0,
          recommendation: recommendation.recommendation ?? summary.recommendation,
          recommendationConfidence: recommendation.topConfidence ?? summary.topConfidence,
          recommendationTitle: null,
          recommendationExplanation: getRecommendationBody(summary, recommendation),
          savedMissionId:
            savedMissionId !== null && Number.isFinite(savedMissionId) ? savedMissionId : null,
          savedRunStatus: recommendation.predictionStatus ?? summary.predictionStatus,
          savedRunCreatedAt: recommendation.capturedAt ?? summary.capturedAt,
          savedRunUpdatedAt: recommendation.capturedAt ?? summary.capturedAt,
          movementStateFinal: null,
          drillStateFinal: null,
          topConfidence: recommendation.topConfidence ?? summary.topConfidence,
          lowConfidence: recommendation.lowConfidence,
          predictionStatus: recommendation.predictionStatus ?? summary.predictionStatus,
          errorFlag: recommendation.errorFlag || summary.errorFlag,
          errorMessage: recommendation.errorMessage ?? summary.errorMessage,
          confidenceIrrigateNow: recommendation.confidenceIrrigateNow,
          confidenceScheduleSoon: recommendation.confidenceScheduleSoon,
          confidenceHoldIrrigation: recommendation.confidenceHoldIrrigation,
          modelVersion: recommendation.modelVersion,
          sampleResultId: recommendation.sampleResultId ?? summary.sampleResultId,
          sampleDeviceId: recommendation.deviceId,
          sampleZoneLabel: zone.title,
          soilMoistureRaw: recommendation.soilMoistureRaw,
        });
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load the latest Supabase monitoring summary.";
      setLoadError(message);
      setZoneSummaries([]);
      setZoneRecommendations([]);
      setRecentSamples([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadSummary().finally(() => {
      setTimeout(() => setRefreshing(false), 350);
    });
  }, [loadSummary]);
  const displayedSamples = sampleHistoryExpanded ? recentSamples : recentSamples.slice(0, 5);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />
        }
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={40}>
          <Text style={styles.sectionTitle}>Fixed Zone Summary</Text>
          <Text style={styles.sectionBody}>
            Six monitoring zones stay visible at all times. Saved metrics and automatic
            recommendations come from the latest Supabase rows.
          </Text>

          <View style={styles.zoneList}>
            {FIXED_ZONES.map((zone) => {
              const summary = summaryMap[zone.code];
              const recommendation = recommendationMap[zone.code];
              const state = getRecommendationState(summary, recommendation);
              const isSelected = zone.id === selectedStoreZone?.id;
              const accent = getRecommendationAccent(state);

              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneCard,
                    { borderColor: `${accent}66` },
                    isSelected && styles.zoneCardSelected,
                    isSelected && { borderColor: accent },
                  ]}
                  onPress={() => zonesStore.setSelectedZone(zone.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${zone.title}`}
                >
                  <View style={styles.zoneCardHeader}>
                    <View>
                      <Text style={styles.zoneTitle}>{zone.title}</Text>
                      <Text style={styles.zoneMeta}>
                        {formatTimestamp(
                          recommendation.capturedAt ?? summary.capturedAt,
                          "Waiting for Supabase data",
                        )}
                      </Text>
                    </View>
                    <Text style={[styles.zoneState, { color: accent }]}>
                      {getSummaryStatusLabel(state, recommendation.recommendation)}
                    </Text>
                  </View>

                  <View style={styles.zoneMetricsRow}>
                    <View style={styles.zoneMetricChip}>
                      <Text style={styles.zoneMetricLabel}>Moisture</Text>
                      <Text style={styles.zoneMetricValue}>
                        {formatMetric(summary.soilMoisturePct, 1, "%")}
                      </Text>
                    </View>
                    <View style={styles.zoneMetricChip}>
                      <Text style={styles.zoneMetricLabel}>Temp</Text>
                      <Text style={styles.zoneMetricValue}>
                        {formatMetric(summary.thermistorC, 1, "C")}
                      </Text>
                    </View>
                    <View style={styles.zoneMetricChip}>
                      <Text style={styles.zoneMetricLabel}>Humidity</Text>
                      <Text style={styles.zoneMetricValue}>
                        {formatMetric(summary.humidityPct, 1, "%")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

        <FadeInView delay={120}>
          <View style={styles.selectedCard}>
            <Text style={styles.selectedLabel}>{selectedSummary.zoneLabel}</Text>
            <Text
              style={[
                styles.selectedHeadline,
                { color: getRecommendationAccent(selectedRecommendationState) },
              ]}
            >
              {getRecommendationHeadline(selectedSummary, selectedRecommendation)}
            </Text>
            <Text style={styles.selectedBody}>
              {getRecommendationBody(selectedSummary, selectedRecommendation)}
            </Text>

            <View style={styles.selectedMetricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Soil Moisture</Text>
                <Text style={styles.metricValue}>
                  {formatMetric(selectedSummary.soilMoisturePct, 1, "%")}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Thermistor</Text>
                <Text style={styles.metricValue}>
                  {formatMetric(selectedSummary.thermistorC, 1, "C")}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Humidity</Text>
                <Text style={styles.metricValue}>
                  {formatMetric(selectedSummary.humidityPct, 1, "%")}
                </Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaChip}>
                <Text style={styles.metaLabel}>Top Confidence</Text>
                <Text style={styles.metaValue}>
                  {formatMetric(
                    selectedRecommendation.topConfidence ?? selectedSummary.topConfidence,
                    4,
                  )}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaLabel}>Prediction Status</Text>
                <Text style={styles.metaValue}>
                  {(selectedRecommendation.predictionStatus ??
                    selectedSummary.predictionStatus ??
                    "waiting")
                    .replace(/_/g, " ")
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaLabel}>Captured At</Text>
                <Text style={styles.metaValue}>
                  {formatTimestamp(
                    selectedRecommendation.capturedAt ?? selectedSummary.capturedAt,
                    "Waiting for sample",
                  )}
                </Text>
              </View>
            </View>

            {(selectedRecommendation.errorMessage || selectedSummary.errorMessage) &&
            selectedRecommendationState === "error" ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Advisory</Text>
                <Text style={styles.errorBody}>
                  {selectedRecommendation.errorMessage ?? selectedSummary.errorMessage}
                </Text>
              </View>
            ) : null}
          </View>
        </FadeInView>

        <FadeInView delay={180}>
          <View style={styles.rollupCard}>
            <Text style={styles.rollupTitle}>Current Rollup</Text>
            <View style={styles.rollupGrid}>
              <View style={styles.rollupMetric}>
                <Text style={styles.rollupMetricLabel}>Zones With Data</Text>
                <Text style={styles.rollupMetricValue}>{farmerSummary.zonesChecked}</Text>
              </View>
              <View style={styles.rollupMetric}>
                <Text style={styles.rollupMetricLabel}>Irrigate Now</Text>
                <Text style={styles.rollupMetricValue}>{farmerSummary.irrigateNowCount}</Text>
              </View>
              <View style={styles.rollupMetric}>
                <Text style={styles.rollupMetricLabel}>Schedule Soon</Text>
                <Text style={styles.rollupMetricValue}>{farmerSummary.scheduleSoonCount}</Text>
              </View>
              <View style={styles.rollupMetric}>
                <Text style={styles.rollupMetricLabel}>Hold Irrigation</Text>
                <Text style={styles.rollupMetricValue}>{farmerSummary.holdIrrigationCount}</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={230}>
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent Supabase Sample History</Text>
            <Text style={styles.historyBody}>
              Saved sample rows remain available even while live rover state stays in Firebase.
            </Text>

            {loadError ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Summary load failed</Text>
                <Text style={styles.emptyBody}>{loadError}</Text>
              </View>
            ) : null}

            {!loadError && loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading Supabase summary</Text>
                <Text style={styles.emptyBody}>
                  Fetching the latest fixed-zone snapshots and recommendation history.
                </Text>
              </View>
            ) : null}

            {!loadError && !loading && recentSamples.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No saved sample history yet</Text>
                <Text style={styles.emptyBody}>
                  The four zone slots are ready. Sample history will appear here after Supabase
                  receives processed rows.
                </Text>
              </View>
            ) : null}

            {!loadError && !loading && recentSamples.length > 0
              ? displayedSamples.map((sample) => {
                  const status = getSampleRowStatus(sample);
                  return (
                    <View key={sample.id} style={styles.historyRow}>
                      <View style={styles.historyRowHeader}>
                        <Text style={styles.historyRowTitle}>{sample.zone ?? "Unmapped Zone"}</Text>
                        <Text style={[styles.historyRowStatus, { color: status.color }]}>
                          {status.label}
                        </Text>
                      </View>
                      <Text style={styles.historyRowMeta}>
                        {formatTimestamp(sample.capturedAt, "Unknown capture time")}
                      </Text>
                      <Text style={styles.historyRowMeta}>
                        Moisture {formatMetric(sample.soilMoisturePct, 1, "%")} • Temp{" "}
                        {formatMetric(sample.thermistorC ?? sample.airTempC, 1, "C")} • Humidity{" "}
                        {formatMetric(sample.humidityPct, 1, "%")}
                      </Text>
                    </View>
                  );
                })
              : null}
            {!loadError && !loading && recentSamples.length > 5 ? (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setSampleHistoryExpanded((previous) => !previous)}
                accessibilityRole="button"
                accessibilityLabel={
                  sampleHistoryExpanded
                    ? "Show fewer sample history rows"
                    : "Show all sample history rows"
                }
              >
                <Text style={styles.expandButtonText}>
                  {sampleHistoryExpanded ? "Show Less" : `Show All ${recentSamples.length}`}
                </Text>
                <Ionicons
                  name={sampleHistoryExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#4b8dff"
                />
              </TouchableOpacity>
            ) : null}
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
      gap: APP_SPACING.md,
    },
    sectionTitle: {
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: APP_SPACING.xs,
    },
    sectionBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
      marginBottom: APP_SPACING.sm,
    },
    zoneList: {
      gap: APP_SPACING.sm,
    },
    zoneCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    zoneCardSelected: {
      backgroundColor: colors.cardAltBg,
      borderWidth: 2,
    },
    zoneCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
    },
    zoneTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    zoneMeta: {
      marginTop: 4,
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
    },
    zoneState: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      textTransform: "uppercase",
      textAlign: "right",
    },
    zoneMetricsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    zoneMetricChip: {
      flexGrow: 1,
      minWidth: 92,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    zoneMetricLabel: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    zoneMetricValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    selectedCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    selectedLabel: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    selectedHeadline: {
      fontSize: compact ? 20 : 22,
      fontWeight: "700",
    },
    selectedBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    selectedMetricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    metricCard: {
      flexGrow: 1,
      minWidth: 100,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "800",
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    metaChip: {
      flexGrow: 1,
      minWidth: 124,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    metaLabel: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    metaValue: {
      color: colors.textPrimary,
      fontSize: typography.small,
      fontWeight: "700",
      lineHeight: compact ? 16 : 18,
    },
    errorCard: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: "#b93d3b",
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    errorTitle: {
      color: "#ef5350",
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    errorBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    rollupCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    rollupTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    rollupGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    rollupMetric: {
      flexGrow: 1,
      minWidth: 110,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    rollupMetricLabel: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    rollupMetricValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "800",
    },
    historyCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    historyTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    historyBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    historyRow: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    historyRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
    },
    historyRowTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    historyRowStatus: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    historyRowMeta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: compact ? 16 : 18,
    },
    emptyCard: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.xs,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    expandButton: {
      minHeight: 42,
      borderRadius: APP_RADII.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: APP_SPACING.xs,
    },
    expandButtonText: {
      color: "#4b8dff",
      fontSize: typography.chipLabel,
      fontWeight: "700",
    },
  });
}
