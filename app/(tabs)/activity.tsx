import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";

const timeline = [
  { time: "09:00 AM", task: "System Initialization" },
  { time: "09:30 AM", task: "Pre-flight Check" },
  { time: "09:45 AM", task: "Mission Planning" },
  { time: "10:00 AM", task: "Takeoff Sequence" },
  { time: "10:30 AM", task: "Navigation Active" },
];

export default function ActivityScreen() {
  const { width } = useWindowDimensions();
  const styles = createStyles(width);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const filteredTimeline = timeline.filter((item) =>
    item.task.toLowerCase().includes(query.toLowerCase().trim())
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setSearchVisible(true)}>
            <Ionicons name="search" size={22} color="#111111" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openNotifications}>
            <Ionicons name="notifications" size={22} color="#111111" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Drone Footage</Text>

        <View style={styles.footageCard}>
          <View style={styles.footage}>
            <View style={styles.footageOverlay} />
          </View>
        </View>

        <View style={styles.tableCard}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cellText, styles.headerCell, styles.timeCell]}>Time</Text>
            <Text style={[styles.cellText, styles.headerCell, styles.taskCell]}>Task</Text>
          </View>
          {filteredTimeline.map((item) => (
            <View style={styles.tableRow} key={`${item.time}-${item.task}`}>
              <Text style={[styles.cellText, styles.timeCell]}>{item.time}</Text>
              <Text style={[styles.cellText, styles.taskCell]}>{item.task}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {notificationsSheet}

      <Modal visible={searchVisible} transparent animationType="fade" onRequestClose={() => setSearchVisible(false)}>
        <Pressable style={styles.searchBackdrop} onPress={() => setSearchVisible(false)}>
          <Pressable style={styles.searchCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Search Tasks</Text>
              <TouchableOpacity onPress={() => setSearchVisible(false)}>
                <Ionicons name="close" size={20} color="#2b2f36" />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Type task name..."
              placeholderTextColor="#6f7480"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
            <ScrollView style={styles.searchResultsWrap}>
              {filteredTimeline.length === 0 ? (
                <Text style={styles.noMatchesText}>No matches</Text>
              ) : (
                filteredTimeline.map((item) => (
                  <TouchableOpacity
                    key={`search-${item.time}-${item.task}`}
                    style={styles.searchResultRow}
                    onPress={() => setSearchVisible(false)}
                  >
                    <Text style={styles.searchResultTask}>{item.task}</Text>
                    <Text style={styles.searchResultTime}>{item.time}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(width: number) {
  const compact = width < 360;
  const regular = width >= 360 && width < 414;

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
      fontSize: compact ? 21 : 23,
      fontWeight: "700",
      color: "#111111",
    },
    headerIcons: {
      flexDirection: "row",
      gap: 14,
    },
    content: {
      padding: 12,
    },
    sectionTitle: {
      fontSize: compact ? 19 : regular ? 21 : 22,
      fontWeight: "700",
      color: "#202020",
    },
    footageCard: {
      marginTop: 10,
      borderRadius: 3,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#bdbdc3",
    },
    footage: {
      height: compact ? 150 : regular ? 164 : 176,
      width: "100%",
      backgroundColor: "#806f60",
      justifyContent: "flex-end",
    },
    footageOverlay: {
      height: "45%",
      backgroundColor: "rgba(28, 62, 24, 0.35)",
    },
    tableCard: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: "#9297a5",
      borderRadius: 12,
      backgroundColor: "#e8e9ee",
      overflow: "hidden",
      paddingVertical: 6,
    },
    tableHeader: {
      borderBottomWidth: 1,
      borderBottomColor: "#9a9fac",
      marginBottom: 2,
    },
    tableRow: {
      flexDirection: "row",
      paddingHorizontal: 10,
      paddingVertical: compact ? 8 : 9,
    },
    headerCell: {
      fontWeight: "700",
      fontSize: compact ? 14 : 15,
      color: "#232323",
    },
    cellText: {
      color: "#31343b",
      fontSize: compact ? 13 : 14,
    },
    timeCell: {
      width: "28%",
    },
    taskCell: {
      width: "72%",
      paddingLeft: 8,
    },
    searchBackdrop: {
      flex: 1,
      backgroundColor: "#00000066",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    searchCard: {
      backgroundColor: "#f4f5f8",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#d3d7df",
      padding: 12,
      maxHeight: "58%",
    },
    searchHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    searchTitle: {
      color: "#1f242d",
      fontSize: 16,
      fontWeight: "700",
    },
    searchInput: {
      height: 44,
      borderWidth: 1,
      borderColor: "#bcc2cd",
      borderRadius: 8,
      backgroundColor: "#ffffff",
      paddingHorizontal: 12,
      color: "#1f242b",
      marginBottom: 10,
    },
    searchResultsWrap: {
      maxHeight: 240,
    },
    searchResultRow: {
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: "#dde1e8",
      justifyContent: "center",
    },
    searchResultTask: {
      color: "#1f242b",
      fontSize: 14,
      fontWeight: "500",
    },
    searchResultTime: {
      color: "#707784",
      fontSize: 12,
      marginTop: 2,
    },
    noMatchesText: {
      textAlign: "center",
      color: "#707784",
      paddingVertical: 18,
    },
  });
}
