import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type NotificationItem = {
  id: string;
  title: string;
  time: string;
};

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  { id: "1", title: "Mission initialized", time: "09:00 AM" },
  { id: "2", title: "Pre-flight check passed", time: "09:30 AM" },
  { id: "3", title: "Mission planning complete", time: "09:45 AM" },
  { id: "4", title: "Takeoff successful", time: "10:00 AM" },
  { id: "5", title: "Navigation active", time: "10:30 AM" },
];

export function useNotificationsSheet() {
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);

  const notificationsSheet = useMemo(
    () => (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Notifications</Text>
              <View style={styles.actions}>
                <TouchableOpacity disabled={items.length === 0} onPress={() => setItems([])}>
                  <Text style={[styles.markRead, items.length === 0 && styles.disabledText]}>
                    Mark all as read
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setVisible(false)}>
                  <Ionicons name="close" size={22} color="#2b2f36" />
                </TouchableOpacity>
              </View>
            </View>
            {items.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="mail-open" size={42} color="#34a853" />
                <Text style={styles.emptyText}>All caught up!</Text>
              </View>
            ) : (
              <ScrollView>
                {items.map((item) => (
                  <View style={styles.itemRow} key={item.id}>
                    <Ionicons name="notifications" size={18} color="#4f5561" />
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemTime}>{item.time}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                    >
                      <Ionicons name="trash-outline" size={18} color="#d84d4d" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    ),
    [items, visible]
  );

  return {
    openNotifications: () => setVisible(true),
    notificationsSheet,
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#f2f3f7",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
  },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#d6d9e1",
    paddingHorizontal: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#20242c",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markRead: {
    fontSize: 13,
    color: "#2f5e90",
    fontWeight: "600",
  },
  disabledText: {
    color: "#9da2ab",
  },
  itemRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: "#dde0e6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    color: "#252a33",
    fontSize: 14,
    fontWeight: "500",
  },
  itemTime: {
    color: "#707784",
    fontSize: 12,
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    color: "#2c3139",
    fontSize: 16,
    fontWeight: "600",
  },
});
