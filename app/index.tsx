import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { ensureOnboardingHydrated, hasCompletedOnboarding } from "@/lib/onboarding-state";
import { useAuthTheme } from "@/lib/ui/auth-ui";

export default function Index() {
  const { colors } = useAuthTheme();
  const [isReady, setIsReady] = useState(false);
  const [target, setTarget] = useState<"/login" | "/onboarding">("/login");

  useEffect(() => {
    let isMounted = true;

    void ensureOnboardingHydrated().finally(() => {
      if (!isMounted) {
        return;
      }

      setTarget(hasCompletedOnboarding() ? "/login" : "/onboarding");
      setIsReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return <Redirect href={target} />;
}
