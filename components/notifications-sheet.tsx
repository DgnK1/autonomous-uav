import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  timestampMs: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const MISSION_NOTIFICATION_SELECT = "id,message,created_at";
const ALERT_NOTIFICATION_SELECT = "id,message,severity,created_at";

function formatClockTime(timestampMs: number) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "--:--:--";
  }

  return new Date(timestampMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getMissionNotificationIcon(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("completed") || normalized.includes("reached")) {
    return { icon: "checkmark-circle" as const, iconColor: "#38d27a" };
  }
  if (normalized.includes("obstacle")) {
    return { icon: "warning" as const, iconColor: "#f3b234" };
  }
  if (normalized.includes("start")) {
    return { icon: "play-circle" as const, iconColor: "#4b8dff" };
  }
  return { icon: "list" as const, iconColor: "#4b8dff" };
}

function getAlertNotificationIcon(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "error") {
    return { icon: "warning" as const, iconColor: "#ef5350" };
  }
  if (normalized === "warning") {
    return { icon: "alert-circle" as const, iconColor: "#f3b234" };
  }
  return { icon: "notifications" as const, iconColor: "#4b8dff" };
}

function parseAlertNotifications(rows: unknown): NotificationItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const items: NotificationItem[] = [];

  rows.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const source = item as Record<string, unknown>;
    const message = typeof source.message === "string" ? source.message.trim() : "";
    if (!message) {
      return;
    }

    const severity = typeof source.severity === "string" ? source.severity : "info";
    const createdAtRaw = typeof source.created_at === "string" ? source.created_at : "";
    const timestampMs = createdAtRaw ? Date.parse(createdAtRaw) : Date.now();
    const rawId = source.id;
    const id =
      typeof rawId === "number" || typeof rawId === "string"
        ? String(rawId)
        : `alert-${index}`;
    const presentation = getAlertNotificationIcon(severity);

    items.push({
      id: `alert-${id}`,
      title: message,
      time: formatClockTime(timestampMs),
      timestampMs,
      icon: presentation.icon,
      iconColor: presentation.iconColor,
    });
  });

  return items;
}

function parseMissionNotifications(rows: unknown): NotificationItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const items: NotificationItem[] = [];

  rows.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const source = item as Record<string, unknown>;
    const message = typeof source.message === "string" ? source.message.trim() : "";
    if (!message) {
      return;
    }

    const createdAtRaw = typeof source.created_at === "string" ? source.created_at : "";
    const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : 0;
    const rawId = source.id;
    const id =
      typeof rawId === "number" || typeof rawId === "string"
        ? String(rawId)
        : `mission-${index}`;
    const presentation = getMissionNotificationIcon(message);

    items.push({
      id: `mission-${id}`,
      title: message,
      time: formatClockTime(createdAtMs),
      timestampMs: createdAtMs,
      icon: presentation.icon,
      iconColor: presentation.iconColor,
    });
  });

  return items;
}

export function useNotificationsSheet() {
  const [visible, setVisible] = useState(false);
  const [missionItems, setMissionItems] = useState<NotificationItem[]>([]);
  const [alertItems, setAlertItems] = useState<NotificationItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const notifications = useMemo(() => {
    const hidden = new Set(dismissedIds);

    return [...missionItems, ...alertItems]
      .filter((item) => !hidden.has(item.id))
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .slice(0, 30);
  }, [alertItems, dismissedIds, missionItems]);

  const dismissNotification = useCallback((id: string) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const markAllRead = useCallback(() => {
    setDismissedIds(notifications.map((item) => item.id));
  }, [notifications]);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setMissionItems([]);
      return;
    }

    let cancelled = false;

    const fetchMissionNotifications = async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/mission_logs?select=${encodeURIComponent(MISSION_NOTIFICATION_SELECT)}&order=created_at.desc&limit=25`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            errorText || `Mission notification fetch failed with status ${response.status}.`,
          );
        }

        const rows = await response.json();
        if (!cancelled) {
          setMissionItems(parseMissionNotifications(rows));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load mission notifications", error);
          setMissionItems([]);
        }
      }
    };

    void fetchMissionNotifications();
    const intervalId = setInterval(() => {
      void fetchMissionNotifications();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setAlertItems([]);
      return;
    }

    let cancelled = false;

    const fetchAlertNotifications = async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/activity_alerts?select=${encodeURIComponent(ALERT_NOTIFICATION_SELECT)}&order=created_at.desc&limit=25`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            errorText ||
              `Activity alert notification fetch failed with status ${response.status}.`,
          );
        }

        const rows = await response.json();
        if (!cancelled) {
          setAlertItems(parseAlertNotifications(rows));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load activity alert notifications", error);
          setAlertItems([]);
        }
      }
    };

    void fetchAlertNotifications();
    const intervalId = setInterval(() => {
      void fetchAlertNotifications();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const notificationsSheet = useMemo(
    () => (
      <Modal transparent animationType="slide" visible={visible} onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Notifications</Text>
              <View style={styles.actions}>
                <TouchableOpacity disabled={notifications.length === 0} onPress={markAllRead}>
                  <Text style={[styles.markRead, notifications.length === 0 && styles.disabledText]}>
                    Mark all as read
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setVisible(false)}>
                  <Ionicons name="close" size={22} color="#2b2f36" />
                </TouchableOpacity>
              </View>
            </View>
            {notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="mail-open" size={42} color="#34a853" />
                <Text style={styles.emptyText}>All caught up!</Text>
              </View>
            ) : (
              <ScrollView>
                {notifications.map((item) => (
                  <View style={styles.itemRow} key={item.id}>
                    <Ionicons name={item.icon} size={18} color={item.iconColor} />
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemTime}>{item.time}</Text>
                    </View>
                    <TouchableOpacity onPress={() => dismissNotification(item.id)}>
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
    [dismissNotification, markAllRead, notifications, visible],
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
