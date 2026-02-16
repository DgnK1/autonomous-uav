import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, type MapPressEvent } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEFAULT_REGION } from "@/lib/map-region";
import { setMappingSelection, type MappingPoint } from "@/lib/mapping-selection";
import { plotsStore } from "@/lib/plots-store";

export default function MappingAreaScreen() {
  const [points, setPoints] = useState<MappingPoint[]>([]);

  function onMapTap(event: MapPressEvent) {
    if (points.length >= 4) {
      return;
    }

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPoints((prev) => [...prev, { latitude, longitude }]);
  }

  function completeSelection() {
    if (points.length !== 4) {
      Alert.alert("Need 4 points", "Tap exactly 4 points to define the mapping area.");
      return;
    }

    setMappingSelection(points);
    plotsStore.setPlotsFromCoordinates(points);
    router.back();
  }

  function confirmCancel() {
    Alert.alert("Cancel Mapping?", "Are you sure you want to cancel the mapping process?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => {
          setPoints([]);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={confirmCancel} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Define Mapping Area</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.mapFrame}>
        <MapView style={styles.map} initialRegion={DEFAULT_REGION} onPress={onMapTap}>
          {points.length >= 3 && (
            <Polygon
              coordinates={points}
              fillColor="rgba(47, 142, 255, 0.25)"
              strokeColor="#2f8eff"
              strokeWidth={2}
            />
          )}
          {points.map((point, index) => (
            <Marker key={`${point.latitude}-${point.longitude}-${index}`} coordinate={point}>
              <View style={styles.pointMarker}>
                <Text style={styles.pointLabel}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
        <View style={styles.mapGuide}>
          <Text style={styles.mapGuideText}>Tap 4 points to outline the target mapping area.</Text>
        </View>
      </View>

      <View style={styles.bottomArea}>
        <Text style={styles.helperText}>{`Points selected: ${points.length}/4`}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.actionButton, styles.resetButton]} onPress={() => setPoints([])}>
            <Text style={styles.actionText}>Reset</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.completeButton, points.length !== 4 && styles.disabled]}
            onPress={completeSelection}
          >
            <Text style={styles.actionText}>Complete Area</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121417",
  },
  header: {
    height: 58,
    backgroundColor: "#161a20",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  backButton: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#f4f6fb",
    fontSize: 19,
    fontWeight: "700",
  },
  headerRightPlaceholder: {
    width: 34,
  },
  mapFrame: {
    flex: 1,
    margin: 14,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#3c424a",
  },
  map: {
    flex: 1,
  },
  mapGuide: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 10,
    backgroundColor: "#000000a3",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapGuideText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  pointMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2f8eff",
    borderWidth: 2,
    borderColor: "#d9ecff",
    alignItems: "center",
    justifyContent: "center",
  },
  pointLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  bottomArea: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  helperText: {
    color: "#d4d9e0",
    textAlign: "center",
    marginBottom: 12,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: "#e25656",
  },
  completeButton: {
    backgroundColor: "#39a05f",
  },
  disabled: {
    opacity: 0.55,
  },
  actionText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
