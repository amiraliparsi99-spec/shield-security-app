/**
 * Background location task — must load at app startup (see app/_layout.tsx).
 * Expo requires TaskManager.defineTask at module scope before any native task runs.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { BACKGROUND_LOCATION_TASK } from "../constants/locationTask";
import { processLocationUpdate } from "../services/location";

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      const msg = (error as { message?: string })?.message ?? "";
      const code = (error as { code?: number })?.code;
      const isTransientUnknown =
        code === 0 || /kCLErrorDomain.*Code=0/i.test(msg);
      if (isTransientUnknown) {
        if (__DEV__) {
          console.warn("[Background Location] Transient kCLErrorLocationUnknown — ignoring");
        }
      } else {
        console.warn("[Background Location] Task error:", error);
      }
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      const location = locations[0];
      if (location) {
        await processLocationUpdate(location);
      }
    }
  });
}
