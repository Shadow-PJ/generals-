// Which device the player last used: the keyboard (and mouse) or a controller (session 6C).
// Labels and hints show that device's keys or buttons, and update when it changes.

export type InputDevice = 'keyboard' | 'gamepad';

let current: InputDevice = 'keyboard';
const listeners = new Set<(device: InputDevice) => void>();

export function inputDevice(): InputDevice {
  return current;
}

/** Records the device just used; listeners hear about a change. */
export function useDevice(device: InputDevice): void {
  if (device === current) return;
  current = device;
  for (const listener of listeners) listener(device);
}

/** Calls the listener whenever the device changes; returns a function that stops it. */
export function onDeviceChange(listener: (device: InputDevice) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
