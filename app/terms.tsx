import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.bodyText}>
          Last updated: [Date]
          {"\n\n"}1. Acceptance of Terms
          {"\n"}By downloading, installing, or using SOARIS, you agree to these Terms.
          {"\n\n"}2. Eligibility and Legal Use
          {"\n"}You agree to comply with all applicable laws and regulations.
          {"\n\n"}3. Account and Security
          {"\n"}You are responsible for safeguarding your account credentials.
          {"\n\n"}4. License
          {"\n"}A limited, non-exclusive license is granted for intended app use.
          {"\n\n"}5. Prohibited Uses
          {"\n"}No unlawful, harmful, or unsafe operation is allowed.
          {"\n\n"}6. Flight Safety and Regulatory Compliance
          {"\n"}You are solely responsible for safe operation and legal compliance.
          {"\n\n"}7. No Professional Advice
          {"\n"}App information is general guidance only.
          {"\n\n"}8. Third-Party Services and Data
          {"\n"}Third-party services are subject to their own terms.
          {"\n\n"}9. Subscriptions, Payments, and Refunds
          {"\n"}Paid features, if any, follow the terms shown at purchase.
          {"\n\n"}10. User Content
          {"\n"}You retain ownership of your content and grant limited operational use.
          {"\n\n"}11. Intellectual Property
          {"\n"}All app rights are owned by SOARIS and licensors.
          {"\n\n"}12. Disclaimers
          {"\n"}The app is provided as-is without warranties.
          {"\n\n"}13. Limitation of Liability
          {"\n"}Liability is limited to the maximum extent permitted by law.
          {"\n\n"}14. Indemnification
          {"\n"}You agree to indemnify for misuse or violation of terms.
          {"\n\n"}15. Termination
          {"\n"}Access may be suspended or terminated at any time.
          {"\n\n"}16. Changes to Terms
          {"\n"}Terms may be updated, and continued use implies acceptance.
          {"\n\n"}17. Governing Law
          {"\n"}Governed by applicable local law.
          {"\n\n"}18. Contact
          {"\n"}Email: kenjielagaras1@gmail.com
        </Text>
      </ScrollView>
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
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#d7dbe3",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1f232b",
  },
  content: {
    padding: 16,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#2d323b",
  },
});
