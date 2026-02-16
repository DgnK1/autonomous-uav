import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FEEDBACK_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxXZabG_5EZxjg5A9Cdp6iUScexnA1qWbEmtRCv0e04QDzrgLV1bwfZBwXnxVkFVsri/exec";
const FEEDBACK_TOKEN = "SOARIS_FEEDBACK_TOKEN_1";

export default function FeedbackScreen() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback() {
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert("Feedback required", "Please enter your feedback before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          app: "SOARIS",
          sentAt: new Date().toISOString(),
          token: FEEDBACK_TOKEN,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status >= 200 && response.status < 400) {
        Alert.alert("Thanks!", "Your feedback was sent.");
        setMessage("");
        return;
      }

      throw new Error(`Status ${response.status}`);
    } catch {
      const fallback = "mailto:kylesabatin9999@gmail.com,kenjielagaras1@gmail.com?subject=SOARIS%20Feedback&body=";
      const url = `${fallback}${encodeURIComponent(message.trim())}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Unable to send",
          "No mail app found. Please email:\nkylesabatin9999@gmail.com\nkenjielagaras1@gmail.com"
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GIVE US FEEDBACK</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            multiline
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what you think..."
            placeholderTextColor="#6f7480"
            textAlignVertical="top"
          />
        </View>
        <Pressable style={styles.submitButton} onPress={() => void submitFeedback()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8e9ee",
  },
  header: {
    height: 58,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#d5d9e1",
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    color: "#1f232b",
    fontSize: 17,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#dfe4ec",
    padding: 12,
  },
  input: {
    flex: 1,
    color: "#252a33",
    fontSize: 15,
  },
  submitButton: {
    marginTop: 20,
    alignSelf: "center",
    width: 160,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3c6798",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
