import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { formatTimePH } from "@/lib/time";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Modal,
  Platform,
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
  body: string;
  time: string;
  timestampMs: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

type NotificationsContextValue = {
  openNotifications: () => void;
  notificationsSheet: null;
};

type NotificationsModule = typeof import("expo-notifications");

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const MISSION_NOTIFICATION_SELECT = "id,message,created_at";
const ALERT_NOTIFICATION_SELECT = "id,message,severity,created_at";
const ANDROID_NOTIFICATION_CHANNEL = "soaris-alerts";

function classifyAutomationNotification(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("automatic monitoring triggered") ||
    normalized.includes("trigger detected")
  ) {
    return {
      title: "Automatic Monitoring Triggered",
      icon: "flash" as const,
      iconColor: "#4b8dff",
    };
  }

  if (
    normalized.includes("area 1 verification started") ||
    normalized.includes("verification started")
  ) {
    return {
      title: "Area 1 Verification Started",
      icon: "scan" as const,
      iconColor: "#38d27a",
    };
  }

  if (
    normalized.includes("full-zone monitoring started") ||
    normalized.includes("full mission required") ||
    normalized.includes("full monitoring")
  ) {
    return {
      title: "Full-Zone Monitoring Started",
      icon: "map" as const,
      iconColor: "#4b8dff",
    };
  }

  if (
    normalized.includes("monitoring completed") ||
    normalized.includes("verification-only completion") ||
    normalized.includes("verification completed")
  ) {
    return {
      title: "Monitoring Completed",
      icon: "checkmark-circle" as const,
      iconColor: "#38d27a",
    };
  }

  if (normalized.includes("low-confidence")) {
    return {
      title: "Low-Confidence Recommendation",
      icon: "alert-circle" as const,
      iconColor: "#f3b234",
    };
  }

  if (
    normalized.includes("invalid input") ||
    normalized.includes("prediction error") ||
    normalized.includes("model error") ||
    normalized.includes("api error")
  ) {
    return {
      title: "Prediction Error",
      icon: "close-circle" as const,
      iconColor: "#ef5350",
    };
  }

  if (
    normalized.includes("device offline") ||
    normalized.includes("mission timeout") ||
    normalized.includes("timeout")
  ) {
    return {
      title: "Device or Mission Timeout",
      icon: "timer" as const,
      iconColor: "#ef5350",
    };
  }

  return null;
}

function formatClockTime(timestampMs: number) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "-";
  }

  return formatTimePH(timestampMs);
}

function getMissionNotificationIcon(message: string) {
  const automationNotification = classifyAutomationNotification(message);
  if (automationNotification) {
    return {
      icon: automationNotification.icon,
      iconColor: automationNotification.iconColor,
    };
  }

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

function getAlertNotificationTitle(severity: string, message: string) {
  const automationNotification = classifyAutomationNotification(message);
  if (automationNotification) {
    return {
      title: automationNotification.title,
      icon: automationNotification.icon,
      iconColor: automationNotification.iconColor,
    };
  }

  const presentation = getAlertNotificationIcon(severity);
  return {
    title:
      severity.toLowerCase() === "critical"
        ? "Critical Rover Alert"
        : severity.toLowerCase() === "warning"
          ? "Rover Warning"
          : "Rover Notice",
    icon: presentation.icon,
    iconColor: presentation.iconColor,
  };
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
    const presentation = getAlertNotificationTitle(severity, message);

    items.push({
      id: `alert-${id}`,
      title: presentation.title,
      body: message,
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
    const automationNotification = classifyAutomationNotification(message);

    items.push({
      id: `mission-${id}`,
      title: automationNotification?.title ?? "Rover Mission Update",
      body: message,
      time: formatClockTime(createdAtMs),
      timestampMs: createdAtMs,
      icon: presentation.icon,
      iconColor: presentation.iconColor,
    });
  });

  return items;
}

async function ensureDeviceNotificationPermissions(notificationsModule: NotificationsModule) {
  let permission = await notificationsModule.getPermissionsAsync();
  if (permission.status !== "granted") {
    permission = await notificationsModule.requestPermissionsAsync();
  }

  if (Platform.OS === "android") {
    await notificationsModule.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL, {
      name: "SOARIS Rover Alerts",
      importance: notificationsModule.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: "#4b8dff",
      sound: "default",
    });
  }

  return permission.status === "granted";
}

async function scheduleLocalDeviceNotification(
  notificationsModule: NotificationsModule,
  item: NotificationItem,
) {
  await notificationsModule.scheduleNotificationAsync({
    content: {
      title: item.title,
      body: item.body,
      sound: "default",
      data: {
        notificationId: item.id,
        timestampMs: item.timestampMs,
      },
    },
    trigger:
      Platform.OS === "android"
        ? {
            type: notificationsModule.SchedulableTriggerInputTypes.DATE,
            channelId: ANDROID_NOTIFICATION_CHANNEL,
            date: new Date(Date.now() + 150),
          }
        : null,
  });
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [missionItems, setMissionItems] = useState<NotificationItem[]>([]);
  const [alertItems, setAlertItems] = useState<NotificationItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const notificationsModuleRef = useRef<NotificationsModule | null>(null);
  const isExpoGo = Constants.appOwnership === "expo";
  const hasNotificationPermissionRef = useRef(false);
  const missionSeededRef = useRef(false);
  const alertSeededRef = useRef(false);
  const announcedIdsRef = useRef<Set<string>>(new Set());

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

  const announceNewItems = useCallback(async (items: NotificationItem[], seeded: boolean) => {
    if (items.length === 0) {
      return true;
    }

    if (!seeded) {
      items.forEach((item) => {
        announcedIdsRef.current.add(item.id);
      });
      return true;
    }

    const unseenItems = items
      .filter((item) => !announcedIdsRef.current.has(item.id))
      .sort((a, b) => a.timestampMs - b.timestampMs);

    if (unseenItems.length === 0) {
      return true;
    }

    const notificationsModule = notificationsModuleRef.current;
    if (!notificationsModule) {
      return false;
    }

    if (!hasNotificationPermissionRef.current) {
      hasNotificationPermissionRef.current =
        await ensureDeviceNotificationPermissions(notificationsModule);
    }

    unseenItems.forEach((item) => {
      announcedIdsRef.current.add(item.id);
    });

    if (!hasNotificationPermissionRef.current) {
      return false;
    }

    for (const item of unseenItems) {
      await scheduleLocalDeviceNotification(notificationsModule, item);
    }

    return true;
  }, []);

  useEffect(() => {
    if (isExpoGo) {
      hasNotificationPermissionRef.current = false;
      return;
    }

    let cancelled = false;

    void import("expo-notifications")
      .then(async (notificationsModule) => {
        notificationsModuleRef.current = notificationsModule;
        notificationsModule.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        await notificationsModule.setAutoServerRegistrationEnabledAsync(false);
        const granted = await ensureDeviceNotificationPermissions(notificationsModule);
        if (!cancelled) {
          hasNotificationPermissionRef.current = granted;
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to initialize device notifications", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isExpoGo]);

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
        const parsedItems = parseMissionNotifications(rows);

        if (!cancelled) {
          setMissionItems(parsedItems);
          const seeded = missionSeededRef.current;
          await announceNewItems(parsedItems, seeded);
          missionSeededRef.current = true;
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
  }, [announceNewItems]);

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
        const parsedItems = parseAlertNotifications(rows);

        if (!cancelled) {
          setAlertItems(parsedItems);
          const seeded = alertSeededRef.current;
          await announceNewItems(parsedItems, seeded);
          alertSeededRef.current = true;
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
  }, [announceNewItems]);

  const contextValue = useMemo<NotificationsContextValue>(
    () => ({
      openNotifications: () => setVisible(true),
      notificationsSheet: null,
    }),
    [],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
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
                      <Text style={styles.itemBody}>{item.body}</Text>
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
    </NotificationsContext.Provider>
  );
}

export function useNotificationsSheet() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error("useNotificationsSheet must be used inside NotificationsProvider.");
  }

  return context;
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
    borderBottomColor: "#d6dae3",
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f232b",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  markRead: {
    color: "#3d6fb6",
    fontSize: 13,
    fontWeight: "600",
  },
  disabledText: {
    color: "#8c93a1",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    color: "#2b2f36",
    fontSize: 15,
    fontWeight: "600",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dde2ea",
  },
  itemTextWrap: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: "#1f232b",
    fontSize: 14,
    fontWeight: "700",
  },
  itemBody: {
    color: "#4f5765",
    fontSize: 13,
    lineHeight: 18,
  },
  itemTime: {
    color: "#7f8693",
    fontSize: 12,
  },
});
