/**
 * Live Activity / Dynamic Island Support for iOS
 * 
 * Live Activities show real-time information on the lock screen and Dynamic Island.
 * This requires iOS 16.1+ and native code through Expo modules.
 * 
 * To enable:
 * 1. Install expo-live-activity (when available) or create a native module
 * 2. Create a Widget Extension in Xcode
 * 3. Configure ActivityKit attributes
 * 
 * For now, this file provides the TypeScript interface and mock implementation.
 */

import { Platform } from 'react-native';

// Types for shift activity
export interface ShiftActivityAttributes {
  venueName: string;
  venueAddress: string;
  shiftType: 'door' | 'event' | 'corporate' | 'retail';
  hourlyRate: number;
}

export interface ShiftActivityState {
  status: 'upcoming' | 'checked_in' | 'on_break' | 'checked_out';
  startTime: Date;
  endTime: Date;
  currentEarnings: number;
  elapsedMinutes: number;
  breakMinutes: number;
}

export interface LiveActivityConfig {
  attributes: ShiftActivityAttributes;
  state: ShiftActivityState;
}

// Check if Live Activities are supported
export function isLiveActivitySupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  
  // Check iOS version (16.1+)
  const iosVersion = parseInt(Platform.Version as string, 10);
  return iosVersion >= 16;
}

// Start a live activity for a shift
export async function startShiftActivity(config: LiveActivityConfig): Promise<string | null> {
  if (!isLiveActivitySupported()) {
    console.log('Live Activities not supported on this device');
    return null;
  }
  
  // In a real implementation, this would call native code:
  // 
  // import { NativeModules } from 'react-native';
  // const { ShieldLiveActivity } = NativeModules;
  // 
  // const activityId = await ShieldLiveActivity.startActivity({
  //   attributes: {
  //     venueName: config.attributes.venueName,
  //     venueAddress: config.attributes.venueAddress,
  //     shiftType: config.attributes.shiftType,
  //     hourlyRate: config.attributes.hourlyRate,
  //   },
  //   contentState: {
  //     status: config.state.status,
  //     startTime: config.state.startTime.toISOString(),
  //     endTime: config.state.endTime.toISOString(),
  //     currentEarnings: config.state.currentEarnings,
  //     elapsedMinutes: config.state.elapsedMinutes,
  //     breakMinutes: config.state.breakMinutes,
  //   }
  // });
  // 
  // return activityId;
  
  console.log('Starting Live Activity:', config);
  return 'mock-activity-id';
}

// Update a live activity
export async function updateShiftActivity(
  activityId: string,
  state: Partial<ShiftActivityState>
): Promise<void> {
  if (!isLiveActivitySupported()) return;
  
  // In a real implementation:
  // await ShieldLiveActivity.updateActivity(activityId, state);
  
  console.log('Updating Live Activity:', activityId, state);
}

// End a live activity
export async function endShiftActivity(activityId: string): Promise<void> {
  if (!isLiveActivitySupported()) return;
  
  // In a real implementation:
  // await ShieldLiveActivity.endActivity(activityId);
  
  console.log('Ending Live Activity:', activityId);
}

// Hook to manage live activity during a shift
export function useShiftLiveActivity() {
  let currentActivityId: string | null = null;
  
  const startActivity = async (shift: {
    venue: string;
    address: string;
    type: ShiftActivityAttributes['shiftType'];
    rate: number;
    start: Date;
    end: Date;
  }) => {
    const config: LiveActivityConfig = {
      attributes: {
        venueName: shift.venue,
        venueAddress: shift.address,
        shiftType: shift.type,
        hourlyRate: shift.rate,
      },
      state: {
        status: 'checked_in',
        startTime: shift.start,
        endTime: shift.end,
        currentEarnings: 0,
        elapsedMinutes: 0,
        breakMinutes: 0,
      },
    };
    
    currentActivityId = await startShiftActivity(config);
    return currentActivityId;
  };
  
  const updateActivity = async (updates: Partial<ShiftActivityState>) => {
    if (currentActivityId) {
      await updateShiftActivity(currentActivityId, updates);
    }
  };
  
  const endActivity = async () => {
    if (currentActivityId) {
      await endShiftActivity(currentActivityId);
      currentActivityId = null;
    }
  };
  
  return {
    startActivity,
    updateActivity,
    endActivity,
    isSupported: isLiveActivitySupported(),
  };
}

/**
 * Swift code needed in native iOS Widget Extension:
 * 
 * ```swift
 * import ActivityKit
 * import WidgetKit
 * import SwiftUI
 * 
 * struct ShieldShiftAttributes: ActivityAttributes {
 *     public struct ContentState: Codable, Hashable {
 *         var status: String
 *         var currentEarnings: Double
 *         var elapsedMinutes: Int
 *     }
 *     
 *     var venueName: String
 *     var venueAddress: String
 *     var shiftType: String
 *     var hourlyRate: Double
 * }
 * 
 * @main
 * struct ShieldWidgetBundle: WidgetBundle {
 *     var body: some Widget {
 *         ShieldLiveActivity()
 *     }
 * }
 * 
 * struct ShieldLiveActivity: Widget {
 *     var body: some WidgetConfiguration {
 *         ActivityConfiguration(for: ShieldShiftAttributes.self) { context in
 *             // Lock screen view
 *             VStack {
 *                 HStack {
 *                     Text("🛡️")
 *                     VStack(alignment: .leading) {
 *                         Text(context.attributes.venueName)
 *                             .font(.headline)
 *                         Text("£\(context.state.currentEarnings, specifier: "%.2f") earned")
 *                             .font(.subheadline)
 *                     }
 *                     Spacer()
 *                     Text("\(context.state.elapsedMinutes / 60)h \(context.state.elapsedMinutes % 60)m")
 *                         .font(.title2)
 *                         .fontWeight(.bold)
 *                 }
 *                 .padding()
 *             }
 *             .background(Color.black.opacity(0.8))
 *         } dynamicIsland: { context in
 *             DynamicIsland {
 *                 // Expanded view
 *                 DynamicIslandExpandedRegion(.leading) {
 *                     Text("🛡️")
 *                 }
 *                 DynamicIslandExpandedRegion(.center) {
 *                     Text(context.attributes.venueName)
 *                 }
 *                 DynamicIslandExpandedRegion(.trailing) {
 *                     Text("£\(context.state.currentEarnings, specifier: "%.0f")")
 *                 }
 *             } compactLeading: {
 *                 Text("🛡️")
 *             } compactTrailing: {
 *                 Text("£\(context.state.currentEarnings, specifier: "%.0f")")
 *             } minimal: {
 *                 Text("🛡️")
 *             }
 *         }
 *     }
 * }
 * ```
 */
