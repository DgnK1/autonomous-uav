import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildRegionFromCoordinates } from "@/lib/map-region";
import { plotsStore, usePlotsStore } from "@/lib/plots-store";

function getRecommendation(plots: ReturnType<typeof usePlotsStore>["plots"]) {
  if (plots.length === 0) {
    return {
      title: "Next Action",
      text: "Waiting for mapping data...",
      color: "#5b7aa5",
      background: "#eaf1fb",
      border: "#9fb7d9",
    };
  }

  const avgMoisture =
    plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length;
  const avgPh = plots.reduce((sum, plot) => sum + plot.phValue, 0) / plots.length;
  const avgTemp = plots.reduce((sum, plot) => sum + plot.temperatureValue, 0) / plots.length;

  let text = "";
  let color = "#2f8f50";
  let background = "#ecf8f0";
  let border = "#9fd4ac";

  if (avgMoisture < 30) {
    text = `Soil is generally dry (avg moisture ${avgMoisture.toFixed(0)}%). It is a good time to irrigate the field.`;
    color = "#ff5f60";
    background = "#f7ecec";
    border = "#f28f90";
  } else if (avgMoisture > 70) {
    text = `Soil moisture is high (avg ${avgMoisture.toFixed(0)}%). Avoid irrigating to prevent overwatering.`;
    color = "#e1921f";
    background = "#fbf3e6";
    border = "#efce8e";
  } else {
    text = `Soil moisture is optimal (avg ${avgMoisture.toFixed(0)}%). You can wait before irrigating.`;
  }

  if (avgPh < 5.5 || avgPh > 7.5) {
    text += ` Note: average pH ${avgPh.toFixed(1)} is outside the ideal 5.5–7.5 range.`;
  }

  if (avgTemp < 15 || avgTemp > 35) {
    text += ` Temperature (${avgTemp.toFixed(1)}°C) is not ideal.`;
  }

  return {
    title: "Next Action",
    text,
    color,
    background,
    border,
  };
}

export default function SummaryScreen() {
  const { width } = useWindowDimensions();
  const styles = createStyles(width);
  const { plots, selectedPlotId } = usePlotsStore();
  const coordinates = useMemo(
    () => plots.map((plot) => ({ latitude: plot.latitude, longitude: plot.longitude })),
    [plots]
  );
  const region = useMemo(() => buildRegionFromCoordinates(coordinates), [coordinates]);
  const recommendation = getRecommendation(plots);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#292c31" />
        </Pressable>
        <Text style={styles.headerTitle}>Soil Monitoring</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.mapFrame}>
          <MapView
            key={`${region.latitude}-${region.longitude}-${region.latitudeDelta}-${region.longitudeDelta}`}
            style={styles.map}
            initialRegion={region}
          >
            {coordinates.length >= 3 && (
              <Polygon
                coordinates={coordinates}
                fillColor="rgba(233, 77, 68, 0.22)"
                strokeColor="#e94842"
                strokeWidth={2}
              />
            )}
            {plots.map((plot) => (
              <Marker
                key={plot.id}
                coordinate={{ latitude: plot.latitude, longitude: plot.longitude }}
                onPress={() => plotsStore.setSelectedPlot(plot.id)}
                pinColor={selectedPlotId === plot.id ? "#2f8eff" : "#e94842"}
              />
            ))}
          </MapView>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.plotCell]}>Plot</Text>
          <Text style={[styles.headerCell, styles.moistureCell]}>Moisture</Text>
          <Text style={[styles.headerCell, styles.tempCell]}>Temp</Text>
        </View>

        {plots.map((plot) => (
          <Pressable
            key={plot.id}
            onPress={() => plotsStore.setSelectedPlot(plot.id)}
            style={[styles.tableRow, selectedPlotId === plot.id && styles.selectedTableRow]}
          >
            <Text style={[styles.bodyCell, styles.plotCell]}>{plot.title}</Text>
            <Text style={[styles.bodyCell, styles.moistureCell]}>{plot.moisture}</Text>
            <Text style={[styles.bodyCell, styles.tempCell]}>{plot.temperature}</Text>
          </Pressable>
        ))}

        <View
          style={[
            styles.nextActionCard,
            { borderColor: recommendation.border, backgroundColor: recommendation.background },
          ]}
        >
          <Text style={[styles.nextActionTitle, { color: recommendation.color }]}>
            {recommendation.title}
          </Text>
          <Text style={styles.nextActionBody}>{recommendation.text}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(width: number) {
  const compact = width < 360;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#e8e9ee",
    },
    header: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#e8e9ee",
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#d2d5dc",
    },
    backButton: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: compact ? 16 : 17,
      fontWeight: "400",
      color: "#2d3137",
      marginRight: 32,
    },
    headerRightSpacer: {
      width: 32,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingBottom: 26,
    },
    mapFrame: {
      height: compact ? 220 : 232,
      backgroundColor: "#dce7f1",
      position: "relative",
      overflow: "hidden",
      borderBottomWidth: 1,
      borderBottomColor: "#c8ccd5",
    },
    map: {
      flex: 1,
    },
    tableHeader: {
      height: 52,
      backgroundColor: "#ececee",
      borderBottomWidth: 1,
      borderBottomColor: "#bec3cd",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    tableRow: {
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: "#c9cdd6",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    selectedTableRow: {
      backgroundColor: "#dceafd",
    },
    headerCell: {
      fontSize: 16,
      color: "#2d3136",
      fontWeight: "700",
    },
    bodyCell: {
      fontSize: 14,
      color: "#444a53",
    },
    plotCell: {
      width: "33%",
    },
    moistureCell: {
      width: "44%",
    },
    tempCell: {
      width: "23%",
    },
    nextActionCard: {
      marginTop: 14,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: "#f28f90",
      borderRadius: 8,
      backgroundColor: "#f7ecec",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    nextActionTitle: {
      color: "#ff5f60",
      fontWeight: "700",
      fontSize: 16,
      marginBottom: 4,
    },
    nextActionBody: {
      color: "#3e424a",
      fontSize: 14,
      lineHeight: 21,
    },
  });
}
