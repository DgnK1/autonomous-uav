const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type RobotRunRecommendationInput = {
  zoneCode: string;
  airHumidity: number;
  soilTempAvg: number;
  soilMoistureAvg: number;
  recommendation: string;
  recommendationConfidence: number | null;
  recommendationExplanation: string;
};

export function isSupabaseRecommendationLoggingConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function insertRobotRunRecommendation(
  input: RobotRunRecommendationInput,
) {
  if (!isSupabaseRecommendationLoggingConfigured()) {
    throw new Error(
      "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable recommendation logging.",
    );
  }

  const payload = {
    zone_code: input.zoneCode,
    air_humidity: input.airHumidity,
    soil_temp_avg: input.soilTempAvg,
    soil_moisture_avg: input.soilMoistureAvg,
    recommendation: input.recommendation,
    recommendation_confidence: input.recommendationConfidence,
    recommendation_explanation: input.recommendationExplanation,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/robot_runs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase logging failed with status ${response.status}: ${errorText || "unknown error"}`,
    );
  }

  return response.json();
}

