import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type LatLng = {
  latitude: number;
  longitude: number;
};

type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapPressEvent = {
  nativeEvent: {
    coordinate: LatLng;
  };
};

type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  initialRegion?: Region;
  region?: Region;
  onPress?: (event: MapPressEvent) => void;
};

type MarkerProps = {
  coordinate: LatLng;
  onPress?: () => void;
  children?: ReactNode;
  pinColor?: string;
};

type PolygonProps = {
  coordinates: LatLng[];
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

type MapContextValue = {
  region: Region;
  width: number;
  height: number;
};

type NativeMapsModule = {
  default: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Polygon: React.ComponentType<any>;
};

const DEFAULT_REGION: Region = {
  latitude: 10.5424,
  longitude: 123.9448,
  latitudeDelta: 0.0065,
  longitudeDelta: 0.0065,
};

let nativeMapsModule: NativeMapsModule | null = null;
if (Platform.OS !== "web") {
  try {
    const runtimeRequire = Function("modulePath", "return require(modulePath);") as (
      modulePath: string
    ) => NativeMapsModule;
    nativeMapsModule = runtimeRequire("react-native-maps");
  } catch {
    nativeMapsModule = null;
  }
}

const NativeMapView = nativeMapsModule?.default ?? null;
const NativeMarker = nativeMapsModule?.Marker ?? null;
const NativePolygon = nativeMapsModule?.Polygon ?? null;

const MapContext = createContext<MapContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRegion(region?: Region): Region {
  if (!region) {
    return DEFAULT_REGION;
  }

  return {
    ...region,
    latitudeDelta: region.latitudeDelta > 0 ? region.latitudeDelta : DEFAULT_REGION.latitudeDelta,
    longitudeDelta:
      region.longitudeDelta > 0 ? region.longitudeDelta : DEFAULT_REGION.longitudeDelta,
  };
}

function coordinateToPixel(
  coordinate: LatLng,
  region: Region,
  width: number,
  height: number
) {
  const north = region.latitude + region.latitudeDelta / 2;
  const west = region.longitude - region.longitudeDelta / 2;
  const xRatio = (coordinate.longitude - west) / region.longitudeDelta;
  const yRatio = (north - coordinate.latitude) / region.latitudeDelta;

  return {
    x: clamp(xRatio, 0, 1) * width,
    y: clamp(yRatio, 0, 1) * height,
  };
}

export default function MapView(props: MapViewProps) {
  if (NativeMapView) {
    return <NativeMapView {...props} />;
  }

  return <WebMapView {...props} />;
}

function WebMapView(props: MapViewProps) {
  const { style, children, initialRegion, region, onPress } = props;
  const [size, setSize] = useState({ width: 1, height: 1 });
  const resolvedRegion = useMemo(
    () => normalizeRegion(region ?? initialRegion),
    [region, initialRegion]
  );

  function handlePress(event: {
    nativeEvent: { locationX?: number; locationY?: number };
  }) {
    if (!onPress) {
      return;
    }

    const locationX = event.nativeEvent.locationX ?? size.width / 2;
    const locationY = event.nativeEvent.locationY ?? size.height / 2;

    const longitude =
      resolvedRegion.longitude -
      resolvedRegion.longitudeDelta / 2 +
      (locationX / size.width) * resolvedRegion.longitudeDelta;
    const latitude =
      resolvedRegion.latitude +
      resolvedRegion.latitudeDelta / 2 -
      (locationY / size.height) * resolvedRegion.latitudeDelta;

    onPress({
      nativeEvent: {
        coordinate: { latitude, longitude },
      },
    });
  }

  return (
    <Pressable
      style={[styles.mapBase, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({
          width: Math.max(1, width),
          height: Math.max(1, height),
        });
      }}
      onPress={handlePress}
    >
      <View pointerEvents="none" style={styles.backgroundGrid} />
      <MapContext.Provider value={{ region: resolvedRegion, width: size.width, height: size.height }}>
        {children}
      </MapContext.Provider>
      <Text style={styles.webLabel}>Web Map Preview</Text>
    </Pressable>
  );
}

export function Marker(props: MarkerProps) {
  if (NativeMarker) {
    return <NativeMarker {...props} />;
  }

  return <WebMarker {...props} />;
}

function WebMarker(props: MarkerProps) {
  const { coordinate, onPress, children, pinColor = "#e94842" } = props;
  const context = useContext(MapContext);
  if (!context) {
    return null;
  }

  const position = coordinateToPixel(coordinate, context.region, context.width, context.height);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.markerPosition,
        {
          left: position.x,
          top: position.y,
        },
      ]}
    >
      {children ?? <View style={[styles.defaultPin, { backgroundColor: pinColor }]} />}
    </Pressable>
  );
}

export function Polygon(props: PolygonProps) {
  if (NativePolygon) {
    return <NativePolygon {...props} />;
  }

  return <WebPolygon {...props} />;
}

function WebPolygon(props: PolygonProps) {
  const {
    coordinates,
    fillColor = "rgba(47, 142, 255, 0.2)",
    strokeColor = "#2f8eff",
    strokeWidth = 1,
  } = props;
  const context = useContext(MapContext);
  if (!context || coordinates.length < 3) {
    return null;
  }

  const points = coordinates.map((point) =>
    coordinateToPixel(point, context.region, context.width, context.height)
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.polygonBox,
        {
          left: minX,
          top: minY,
          width: Math.max(2, maxX - minX),
          height: Math.max(2, maxY - minY),
          backgroundColor: fillColor,
          borderColor: strokeColor,
          borderWidth: strokeWidth,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  mapBase: {
    overflow: "hidden",
    backgroundColor: "#dce7f1",
  },
  backgroundGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#dce7f1",
    borderColor: "#c6d2df",
    borderWidth: 1,
  },
  webLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    fontSize: 11,
    fontWeight: "600",
    color: "#4c5562",
    backgroundColor: "#ffffffcc",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  markerPosition: {
    position: "absolute",
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  defaultPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  polygonBox: {
    position: "absolute",
    borderRadius: 4,
  },
});
