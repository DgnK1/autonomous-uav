export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = Coordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export const DEFAULT_REGION: MapRegion = {
  latitude: 10.5424,
  longitude: 123.9448,
  latitudeDelta: 0.0065,
  longitudeDelta: 0.0065,
};

export function buildRegionFromCoordinates(coordinates: Coordinate[]): MapRegion {
  if (coordinates.length === 0) {
    return DEFAULT_REGION;
  }

  const latitudes = coordinates.map((coord) => coord.latitude);
  const longitudes = coordinates.map((coord) => coord.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latDelta = Math.max((maxLat - minLat) * 1.8, 0.0045);
  const lngDelta = Math.max((maxLng - minLng) * 1.8, 0.0045);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

