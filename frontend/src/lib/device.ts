import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type LocationFix = {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
  };
};
export type MotionReading = Pick<
  DeviceMotionEvent,
  "acceleration" | "accelerationIncludingGravity"
>;
interface RoadMotionPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "accel",
    listener: (reading: MotionReading) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "paused",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}
const RoadMotion = registerPlugin<RoadMotionPlugin>("RoadMotion");
const options = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
  minimumUpdateInterval: 1000,
};
export async function getLocation(): Promise<LocationFix> {
  if (Capacitor.isNativePlatform())
    return Geolocation.getCurrentPosition(options);
  if (!navigator.geolocation)
    throw new Error("Location is unavailable. Choose a map pin instead.");
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options),
  );
}
export async function watchLocation(
  update: (p: LocationFix) => void,
  onError: () => void,
): Promise<() => void> {
  if (Capacitor.isNativePlatform()) {
    const id = await Geolocation.watchPosition(options, (position, error) =>
      position ? update(position) : onError(),
    );
    return () => {
      void Geolocation.clearWatch({ id });
    };
  }
  const id = navigator.geolocation.watchPosition(update, onError, options);
  return () => navigator.geolocation.clearWatch(id);
}
export async function listenMotion(
  reading: (value: MotionReading) => void,
  paused: () => void,
): Promise<() => void> {
  if (Capacitor.isNativePlatform()) {
    const handle = await RoadMotion.addListener("accel", reading);
    const pauseHandle = await RoadMotion.addListener("paused", paused);
    try {
      await RoadMotion.start();
    } catch (e) {
      await handle.remove();
      await pauseHandle.remove();
      throw e;
    }
    return () => {
      void RoadMotion.stop();
      void handle.remove();
      void pauseHandle.remove();
    };
  }
  window.addEventListener("devicemotion", reading);
  return () => window.removeEventListener("devicemotion", reading);
}
