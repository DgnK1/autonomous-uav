export type MappingPoint = {
  latitude: number;
  longitude: number;
};

let latestSelection: MappingPoint[] | null = null;

export function setMappingSelection(points: MappingPoint[]) {
  latestSelection = points;
}

export function consumeMappingSelection() {
  const result = latestSelection;
  latestSelection = null;
  return result;
}

export function clearMappingSelection() {
  latestSelection = null;
}
