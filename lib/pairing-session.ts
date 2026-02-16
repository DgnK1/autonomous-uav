let pairedDevices: string[] = [];
let activeDevice: string | null = null;

export function getPairedDevices() {
  return [...pairedDevices];
}

export function addPairedDevice(label: string) {
  pairedDevices = [...pairedDevices, label];
}

export function removePairedDeviceByIndex(index: number) {
  if (index < 0 || index >= pairedDevices.length) {
    return;
  }
  const removed = pairedDevices[index];
  pairedDevices = pairedDevices.filter((_, idx) => idx !== index);
  if (activeDevice === removed) {
    activeDevice = null;
  }
}

export function setActiveDevice(deviceLabel: string) {
  activeDevice = deviceLabel;
}

export function getActiveDevice() {
  return activeDevice;
}

export function clearPairingSession() {
  pairedDevices = [];
  activeDevice = null;
}
