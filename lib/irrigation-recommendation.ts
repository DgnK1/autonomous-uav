export function formatRecommendationLabel(recommendation: string | null) {
  return recommendation
    ? recommendation.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "No prediction yet";
}

export function normalizeMoistureForModel(displayMoisture: number) {
  return Number((displayMoisture / 6).toFixed(1));
}

export function getRecommendationExplanation(
  recommendation: string | null,
  moisture: number,
  temperature: number,
  humidity: number,
) {
  if (!recommendation) {
    return {
      title: "No Recommendation Yet",
      body:
        "Request a recommendation from the dashboard to see why the selected area should hold irrigation, schedule soon, or irrigate now.",
    };
  }

  if (recommendation === "hold_irrigation") {
    return {
      title: "Why Hold Irrigation",
      body:
        `The area still appears stable for now. Soil moisture is ${moisture.toFixed(0)}%, temperature is ${temperature.toFixed(1)} degrees C, and air humidity is ${humidity.toFixed(0)}%, so the model sees less immediate drying risk and recommends waiting before irrigating.`,
    };
  }

  if (recommendation === "schedule_soon") {
    return {
      title: "Why Schedule Soon",
      body:
        `The area is not yet critical, but conditions are trending toward dryness. Soil moisture is ${moisture.toFixed(0)}%, temperature is ${temperature.toFixed(1)} degrees C, and air humidity is ${humidity.toFixed(0)}%, so the model suggests preparing irrigation soon before the soil becomes too dry.`,
    };
  }

  if (recommendation === "irrigate_now") {
    return {
      title: "Why Irrigate Now",
      body:
        `The area shows stronger water stress signals right now. Soil moisture is ${moisture.toFixed(0)}%, temperature is ${temperature.toFixed(1)} degrees C, and air humidity is ${humidity.toFixed(0)}%, so the model recommends irrigating immediately to avoid further drying.`,
    };
  }

  return {
    title: "Why this recommendation appears",
    body:
      `The model used the current moisture (${moisture.toFixed(0)}%), temperature (${temperature.toFixed(1)} degrees C), and humidity (${humidity.toFixed(0)}%) readings to generate this recommendation.`,
  };
}

export function getRecommendationAccent(recommendation: string | null) {
  if (recommendation === "irrigate_now") {
    return "#ef5350";
  }
  if (recommendation === "schedule_soon") {
    return "#f2b844";
  }
  if (recommendation === "hold_irrigation") {
    return "#7dd99c";
  }
  return "#94a3b8";
}

