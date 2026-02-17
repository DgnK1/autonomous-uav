import { StyleSheet, View } from "react-native";

type SparklineBarsProps = {
  values: number[];
  color: string;
  trackColor: string;
};

export function SparklineBars({ values, color, trackColor }: SparklineBarsProps) {
  const safeValues = values.length > 0 ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Trend sparkline">
      {safeValues.map((value, index) => (
        <View key={`${value}-${index}`} style={[styles.barTrack, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.barFill,
              {
                backgroundColor: color,
                height: `${Math.max(12, (value / max) * 100)}%`,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 20,
    marginTop: 8,
  },
  barTrack: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 999,
  },
});
