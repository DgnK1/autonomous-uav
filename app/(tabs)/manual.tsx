import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
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

function getStatusSummary(status: AreaStatus) {
  if (status === "Critical") {
    return "Immediate attention required.";
  }
  if (status === "Warning") {
    return "Conditions are drifting out of range.";
  }
  return "Conditions are within safe range.";
}

function getOperationalAlerts(plots: Plot[]) {
  const alerts: { id: string; title: string; body: string; status: AreaStatus }[] = [];

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

  return alerts.slice(0, 3);
}

function getNextAction(plots: Plot[]) {
  if (plots.length === 0) {
    return "No area data available yet.";
  }

  const avgMoisture = plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length;
  const criticalCount = plots.filter((plot) => getAreaStatus(plot) === "Critical").length;
  const warningCount = plots.filter((plot) => getAreaStatus(plot) === "Warning").length;

  if (criticalCount > 0) {
    return `Prioritize the ${criticalCount} critical area${criticalCount > 1 ? "s" : ""} before the next pass.`;
  }
  if (warningCount > 0) {
    return `Monitor ${warningCount} warning area${warningCount > 1 ? "s" : ""}. Avg moisture is ${avgMoisture.toFixed(0)}%.`;
  }
  return `Soil moisture is optimal (avg ${avgMoisture.toFixed(0)}%). You can wait before irrigating.`;
}

export default function SummaryTabScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const typography = getAccessibleAppTypography(width, fontScale);
  const styles = createStyles(width, colors, fontScale);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("manual");
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
  const alerts = useMemo(() => getOperationalAlerts(plots), [plots]);
  const nextAction = useMemo(() => getNextAction(plots), [plots]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Soil Monitoring</Text>
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
                  ]}
                  onPress={() => plotsStore.setSelectedPlot(plot.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${plot.title.replace(/^Plot/i, "Area")}`}
                >
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

        <FadeInView delay={110} style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Selected Area</Text>
            <Text style={styles.statValue}>{selectedPlot?.title.replace(/^Plot/i, "Area") ?? "--"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Location</Text>
            <Text style={styles.statValueSmall}>
              {selectedPlot
                ? `${selectedPlot.latitude.toFixed(4)}, ${selectedPlot.longitude.toFixed(4)}`
                : "--"}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average Moisture</Text>
            <Text style={styles.statValue}>{`${avgMoisture.toFixed(0)}%`}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average Temperature</Text>
            <Text style={styles.statValue}>{`${avgTemp.toFixed(1)}°C`}</Text>
          </View>
        </FadeInView>

        <FadeInView delay={140}>
          <View style={styles.tableCard}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.areaCell, styles.tableHeaderText]}>Area</Text>
              <Text style={[styles.tableCell, styles.moistureCell, styles.tableHeaderText]}>Moisture</Text>
              <Text style={[styles.tableCell, styles.tempCell, styles.tableHeaderText]}>Temp</Text>
              <Text style={[styles.tableCell, styles.statusCell, styles.tableHeaderText]}>Status</Text>
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
                  <Text style={[styles.tableCell, styles.moistureCell, styles.tableBodyText]}>
                    {`${plot.moistureValue.toFixed(0)}%`}
                  </Text>
                  <Text style={[styles.tableCell, styles.tempCell, styles.tableBodyText]}>
                    {`${plot.temperatureValue.toFixed(0)}°C`}
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

        {selectedPlot ? (
          <FadeInView delay={170}>
            <View
              style={[
                styles.selectedAreaCard,
                { borderColor: getStatusColors(getAreaStatus(selectedPlot)).border },
              ]}
            >
              <Text style={styles.selectedAreaTitle}>{selectedPlot.title.replace(/^Plot/i, "Area")} Status</Text>
              <Text style={styles.selectedAreaBody}>{getStatusSummary(getAreaStatus(selectedPlot))}</Text>
              <View style={styles.selectedAreaMetaRow}>
                <Text style={styles.selectedAreaMeta}>{`Moisture: ${selectedPlot.moistureValue.toFixed(0)}%`}</Text>
                <Text style={styles.selectedAreaMeta}>{`Temp: ${selectedPlot.temperatureValue.toFixed(0)}°C`}</Text>
              </View>
            </View>
          </FadeInView>
        ) : null}

        <FadeInView delay={200}>
          <View style={styles.alertsSection}>
            <Text style={styles.alertsTitle}>Operational Alerts</Text>
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
      gap: APP_SPACING.md,
    },
    overviewCard: {
      width: "47%",
      minHeight: compact ? 132 : 144,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      backgroundColor: colors.cardBg,
      alignItems: "center",
      justifyContent: "center",
      gap: APP_SPACING.md,
    },
    overviewCardSelected: {
      backgroundColor: colors.cardAltBg,
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 3,
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
    statsGrid: {
      marginTop: APP_SPACING.md,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    statCard: {
      width: "48.5%",
      minHeight: 92,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: typography.cardTitle,
      fontWeight: "600",
      marginBottom: APP_SPACING.sm,
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: compact ? 16 : 18,
      fontWeight: "700",
    },
    statValueSmall: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
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
    },
    tableRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: APP_SPACING.md,
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
    tableHeaderText: {
      color: colors.textPrimary,
      fontSize: typography.tableHeader,
      fontWeight: "700",
    },
    tableBodyText: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    tableStatusText: {
      fontSize: typography.body,
      fontWeight: "700",
    },
    areaCell: {
      flex: 1.1,
    },
    moistureCell: {
      flex: 1.1,
    },
    tempCell: {
      flex: 0.9,
    },
    statusCell: {
      flex: 1,
      textAlign: "right",
    },
    selectedAreaCard: {
      marginTop: APP_SPACING.md,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    selectedAreaTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
      marginBottom: APP_SPACING.xs,
    },
    selectedAreaBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    selectedAreaMetaRow: {
      marginTop: APP_SPACING.md,
      gap: 4,
    },
    selectedAreaMeta: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
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
