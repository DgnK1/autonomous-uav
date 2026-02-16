import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { useFlightMode } from "@/lib/flight-mode";
import { buildRegionFromCoordinates } from "@/lib/map-region";
import { plotsStore, usePlotsStore } from "@/lib/plots-store";

export default function ManualScreen() {
  const { width } = useWindowDimensions();
  const styles = createStyles(width);
  const { isManualMode } = useFlightMode();
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const { plots, selectedPlotId } = usePlotsStore();
  const coordinates = useMemo(
    () => plots.map((plot) => ({ latitude: plot.latitude, longitude: plot.longitude })),
    [plots]
  );
  const region = useMemo(() => buildRegionFromCoordinates(coordinates), [coordinates]);

  if (!isManualMode) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manual Controls</Text>
          <TouchableOpacity onPress={openNotifications}>
            <Ionicons name="notifications" size={22} color="#111111" />
          </TouchableOpacity>
        </View>
        <View style={styles.blockedWrap}>
          <Text style={styles.blockedTitle}>Manual Mode Required</Text>
          <Text style={styles.blockedText}>
            Switch to Manual Mode from the Home page to access this screen.
          </Text>
          <TouchableOpacity style={styles.blockedButton} onPress={() => router.back()}>
            <Text style={styles.blockedButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
        {notificationsSheet}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manual Controls</Text>
        <TouchableOpacity onPress={openNotifications}>
          <Ionicons name="notifications" size={22} color="#111111" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mapFrame}>
          <MapView
            key={`${region.latitude}-${region.longitude}-${region.latitudeDelta}-${region.longitudeDelta}`}
            style={styles.map}
            initialRegion={region}
          >
            {coordinates.length >= 3 && (
              <Polygon
                coordinates={coordinates}
                fillColor="rgba(56, 132, 219, 0.2)"
                strokeColor="#2f8eff"
                strokeWidth={2}
              />
            )}
            {plots.map((plot) => (
              <Marker
                key={plot.id}
                coordinate={{ latitude: plot.latitude, longitude: plot.longitude }}
                onPress={() => plotsStore.setSelectedPlot(plot.id)}
              >
                <View style={[styles.marker, selectedPlotId === plot.id && styles.selectedMarker]}>
                  <View style={styles.markerCore} />
                </View>
              </Marker>
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
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number) {
  const compact = width < 360;
  const regular = width >= 360 && width < 414;
  const mapHeight = compact ? 182 : regular ? 202 : 222;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#e8e9ee",
    },
    header: {
      height: 64,
      paddingHorizontal: 18,
      backgroundColor: "#ffffff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: "#dddddd",
    },
    headerTitle: {
      fontSize: compact ? 21 : 22,
      fontWeight: "700",
      color: "#111111",
    },
    content: {
      paddingBottom: 16,
    },
    mapFrame: {
      height: mapHeight,
      backgroundColor: "#dce7f1",
      borderBottomWidth: 1,
      borderBottomColor: "#c9ccd4",
      position: "relative",
      overflow: "hidden",
    },
    map: {
      flex: 1,
    },
    marker: {
      width: compact ? 22 : 24,
      height: compact ? 22 : 24,
      borderRadius: 12,
      borderWidth: 3,
      borderColor: "#1d76ce",
      backgroundColor: "#d7ecff",
      alignItems: "center",
      justifyContent: "center",
    },
    markerCore: {
      width: compact ? 7 : 8,
      height: compact ? 7 : 8,
      borderRadius: 4,
      backgroundColor: "#1d76ce",
    },
    selectedMarker: {
      backgroundColor: "#2f8eff",
      borderColor: "#ffffff",
    },
    tableHeader: {
      height: 44,
      backgroundColor: "#ececee",
      borderBottomWidth: 1,
      borderBottomColor: "#b7bcc9",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    tableRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 7,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#d6d9e1",
    },
    selectedTableRow: {
      backgroundColor: "#dceafd",
    },
    headerCell: {
      fontSize: compact ? 14 : 15,
      fontWeight: "700",
      color: "#272727",
    },
    bodyCell: {
      fontSize: compact ? 13 : 14,
      color: "#383d45",
    },
    plotCell: {
      width: "30%",
    },
    moistureCell: {
      width: "40%",
    },
    tempCell: {
      width: "30%",
    },
    blockedWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 26,
      gap: 12,
    },
    blockedTitle: {
      fontSize: compact ? 20 : 22,
      fontWeight: "700",
      color: "#1b1f24",
      textAlign: "center",
    },
    blockedText: {
      fontSize: compact ? 14 : 15,
      color: "#4a4f57",
      textAlign: "center",
      lineHeight: compact ? 20 : 22,
    },
    blockedButton: {
      marginTop: 4,
      backgroundColor: "#2f8eff",
      borderRadius: 10,
      height: 44,
      minWidth: 150,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    blockedButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
