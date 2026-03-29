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
import { usePlotsStore, plotsStore, type Plot } from "@/lib/plots-store";
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
  styles,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  valueColor: string;
  tag?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTitleRow}>
        {icon}
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricTag}>{tag}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function getAreaStatus(plot: Plot): AreaStatus {
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

function getOperationalAlerts(plots: Plot[]) {
  const alerts: { id: string; title: string; body: string; status: AreaStatus }[] = [];

  plots.forEach((plot) => {
    if (!plot.recommendation) {
      return;
    }

    alerts.push({
      id: `${plot.id}-recommendation`,
      title: `${formatRecommendationLabel(plot.recommendation)}: ${plot.title.replace(/^Plot/i, "Area")}`,
      body:
        plot.recommendationExplanation ??
        getRecommendationExplanation(
          plot.recommendation,
          plot.moistureValue,
          plot.temperatureValue,
          plot.humidityValue,
        ).body,
      status:
        plot.recommendation === "irrigate_now"
          ? "Critical"
          : plot.recommendation === "schedule_soon"
            ? "Warning"
            : "Healthy",
    });
  });

  plots.forEach((plot) => {
    const status = getAreaStatus(plot);
    if (status === "Critical") {
      if (plot.temperatureValue > 35) {
        alerts.push({
          id: `${plot.id}-temp-high`,
          title: `High Temps: ${plot.title.replace(/^Plot/i, "Area")}`,
          body: `Temperature reached ${plot.temperatureValue.toFixed(0)}°C. Heat stress is now critical.`,
          status,
        });
      } else {
        alerts.push({
          id: `${plot.id}-moisture-critical`,
          title: `Critical Moisture: ${plot.title.replace(/^Plot/i, "Area")}`,
          body: `Moisture level is ${plot.moistureValue.toFixed(0)}%. Soil condition needs immediate action.`,
          status,
        });
      }
    } else if (status === "Warning") {
      alerts.push({
        id: `${plot.id}-warning`,
        title: `Monitor ${plot.title.replace(/^Plot/i, "Area")}`,
        body: `Moisture at ${plot.moistureValue.toFixed(0)}% and temperature at ${plot.temperatureValue.toFixed(0)}°C need closer observation.`,
        status,
      });
    }
  });

  if (alerts.length === 0) {
    alerts.push({
      id: "all-healthy",
      title: "All Areas Healthy",
      body: "All monitored areas are currently within the safe operating range.",
      status: "Healthy",
    });
  }

  return alerts.slice(0, 4);
}

function getNextAction(plots: Plot[]) {
  if (plots.length === 0) {
    return "No area data available yet.";
  }

  const irrigateNowAreas = plots.filter(
    (plot) => plot.recommendation === "irrigate_now",
  );
  if (irrigateNowAreas.length > 0) {
    const areaNames = irrigateNowAreas
      .map((plot) => plot.title.replace(/^Plot/i, "Area"))
      .join(", ");
    return `Immediate response needed: begin irrigation for ${areaNames} as soon as possible, monitor the soil moisture after watering, and check whether temperature and humidity remain unfavorable during the next reading cycle.`;
  }

  const scheduleSoonAreas = plots.filter(
    (plot) => plot.recommendation === "schedule_soon",
  );
  if (scheduleSoonAreas.length > 0) {
    const areaNames = scheduleSoonAreas
      .map((plot) => plot.title.replace(/^Plot/i, "Area"))
      .join(", ");
    return `Prepare the irrigation setup for ${areaNames}, but you do not need to irrigate immediately yet. Recheck the next readings closely and be ready to water if moisture drops further or the area becomes hotter and drier.`;
  }

  const holdAreas = plots.filter(
    (plot) => plot.recommendation === "hold_irrigation",
  );
  if (holdAreas.length > 0) {
    return "No irrigation is needed right now. Keep observing the saved areas, allow the current soil moisture to hold, and wait for the next recommendation cycle before making any irrigation changes.";
  }

  const avgMoisture = plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length;
  const criticalCount = plots.filter((plot) => getAreaStatus(plot) === "Critical").length;
  const warningCount = plots.filter((plot) => getAreaStatus(plot) === "Warning").length;

  if (criticalCount > 0) {
    return `There ${criticalCount > 1 ? "are" : "is"} ${criticalCount} critical area${criticalCount > 1 ? "s" : ""} without a saved recommendation yet. Inspect ${criticalCount > 1 ? "those areas" : "that area"} first, confirm the sensor readings, and request a recommendation immediately after review.`;
  }
  if (warningCount > 0) {
    return `There ${warningCount > 1 ? "are" : "is"} ${warningCount} warning area${warningCount > 1 ? "s" : ""} still needing closer observation. Continue monitoring the readings, especially moisture trends, before deciding whether irrigation should be scheduled.`;
  }
  return `The monitored areas are currently stable with an average soil moisture of ${avgMoisture.toFixed(0)}%. Continue regular monitoring and wait for new readings before taking irrigation action.`;
}

export default function SummaryTabScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors, fontScale);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("summary");
  const { plots, selectedPlotId } = usePlotsStore();
  const [refreshing, setRefreshing] = useState(false);

  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null,
    [plots, selectedPlotId]
  );
  const avgMoisture = useMemo(
    () => (plots.length ? plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length : 0),
    [plots]
  );
  const avgTemp = useMemo(
    () => (plots.length ? plots.reduce((sum, plot) => sum + plot.temperatureValue, 0) / plots.length : 0),
    [plots]
  );
  const avgHumidity = useMemo(
    () => (plots.length ? plots.reduce((sum, plot) => sum + plot.humidityValue, 0) / plots.length : 0),
    [plots]
  );
  const alerts = useMemo(() => getOperationalAlerts(plots), [plots]);
  const nextAction = useMemo(() => getNextAction(plots), [plots]);
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
    selectedRecommendation,
    selectedPlot?.moistureValue ?? 0,
    selectedPlot?.temperatureValue ?? 0,
    selectedPlot?.humidityValue ?? 0,
  );
  const selectedRecommendationTitle =
    selectedPlot?.recommendationTitle ?? selectedRecommendationDetails.title;
  const selectedRecommendationExplanation =
    selectedPlot?.recommendationExplanation ?? selectedRecommendationDetails.body;

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
          <Text style={styles.sectionTitle}>Map Overview</Text>
          <View style={styles.overviewGrid}>
            {plots.map((plot) => {
              const status = getAreaStatus(plot);
              const statusColors = getStatusColors(status);
              const isSelected = plot.id === selectedPlot?.id;
              return (
                <TouchableOpacity
                  key={plot.id}
                  style={[
                    styles.overviewCard,
                    { borderColor: statusColors.border },
                    isSelected && styles.overviewCardSelected,
                    isSelected && {
                      shadowColor: statusColors.accent,
                      borderColor: statusColors.accent,
                    },
                  ]}
                  onPress={() => plotsStore.setSelectedPlot(plot.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${plot.title.replace(/^Plot/i, "Area")}`}
                >
                  {isSelected ? (
                    <Text style={[styles.selectedBadge, { color: statusColors.accent }]}>Selected</Text>
                  ) : null}
                  <View style={[styles.overviewIconWrap, { backgroundColor: statusColors.iconBg }]}>
                    <Ionicons name={statusColors.icon} size={32} color={statusColors.accent} />
                  </View>
                  <Text style={styles.overviewLabel}>{plot.title.replace(/^Plot/i, "Area")}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

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

        <FadeInView delay={110} style={styles.metricsGrid}>
          <SummaryMetricCard
            title="Soil Moisture"
            value={`${selectedMoisture.toFixed(0)}%`}
            valueColor={selectedMoistureColor}
            icon={<Ionicons name="water" size={18} color={selectedMoistureColor} />}
            styles={styles}
          />
          <SummaryMetricCard
            title="Temperature"
            value={`${selectedTemperature.toFixed(1)}°C`}
            valueColor={selectedTemperatureColor}
            icon={<Ionicons name="thermometer" size={18} color={selectedTemperatureColor} />}
            styles={styles}
          />
          <SummaryMetricCard
            title="Air Humidity"
            value={`${selectedHumidity.toFixed(0)}%`}
            valueColor={selectedHumidityColor}
            icon={<Ionicons name="cloud" size={18} color={selectedHumidityColor} />}
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={125}>
          <View style={styles.recommendationCard}>
            <Text style={styles.recommendationLabel}>Selected Area Recommendation</Text>
            <Text style={[styles.recommendationValue, { color: selectedRecommendationAccent }]}>
              {selectedRecommendationLabel}
            </Text>
            <Text style={styles.recommendationTitle}>{selectedRecommendationTitle}</Text>
            <Text style={styles.recommendationBody}>{selectedRecommendationExplanation}</Text>
          </View>
        </FadeInView>

        <FadeInView delay={140}>
          <View style={styles.tableCard}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text
                style={[styles.tableCell, styles.areaCell, styles.tableHeaderText]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Area
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.moistureCell,
                  styles.tableHeaderText,
                  styles.centerCell,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Moisture
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.tempCell,
                  styles.tableHeaderText,
                  styles.centerCell,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Temp
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.humidityCell,
                  styles.tableHeaderText,
                  styles.centerCell,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Humidity
              </Text>
              <Text
                style={[styles.tableCell, styles.statusCell, styles.tableHeaderText]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Status
              </Text>
            </View>
            {plots.map((plot) => {
              const status = getAreaStatus(plot);
              const statusColors = getStatusColors(status);
              return (
                <TouchableOpacity
                  key={plot.id}
                  style={[styles.tableRow, plot.id === selectedPlot?.id && styles.selectedTableRow]}
                  onPress={() => plotsStore.setSelectedPlot(plot.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${plot.title.replace(/^Plot/i, "Area")} details`}
                >
                  <Text style={[styles.tableCell, styles.areaCell, styles.tableBodyText]}>
                    {plot.title.replace(/^Plot/i, "Area")}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.moistureCell,
                      styles.tableBodyText,
                      styles.centerCell,
                    ]}
                  >
                    {`${plot.moistureValue.toFixed(0)}%`}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.tempCell,
                      styles.tableBodyText,
                      styles.centerCell,
                    ]}
                  >
                    {`${plot.temperatureValue.toFixed(0)}°C`}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.humidityCell,
                      styles.tableBodyText,
                      styles.centerCell,
                    ]}
                  >
                    {`${plot.humidityValue.toFixed(0)}%`}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.statusCell,
                      styles.tableStatusText,
                      { color: statusColors.accent },
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

        <FadeInView delay={200}>
          <View style={styles.alertsSection}>
            <Text style={styles.alertsTitle}>Recommendation History</Text>
            {alerts.map((alert) => {
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
            })}
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
    overviewGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: APP_SPACING.md,
    },
    overviewCard: {
      width: "48.5%",
      minHeight: compact ? 132 : 144,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      backgroundColor: colors.cardBg,
      alignItems: "center",
      justifyContent: "center",
      gap: APP_SPACING.md,
      position: "relative",
    },
    overviewCardSelected: {
      backgroundColor: colors.cardAltBg,
      borderWidth: 2,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    selectedBadge: {
      position: "absolute",
      top: APP_SPACING.sm,
      right: APP_SPACING.sm,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    overviewIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    overviewLabel: {
      color: colors.textSecondary,
      fontSize: typography.bodyStrong,
      fontWeight: "600",
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
      flexDirection: "row",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
    },
    metricCard: {
      width: "31.5%",
      minHeight: compact ? 108 : 116,
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
    tableCard: {
      marginTop: APP_SPACING.md,
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
