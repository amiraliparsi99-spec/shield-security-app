/**
 * Quick Actions Configuration for iOS (3D Touch / Long Press)
 * 
 * To enable quick actions, install expo-quick-actions:
 * npx expo install expo-quick-actions
 * 
 * Then add to app.json:
 * {
 *   "expo": {
 *     "plugins": [
 *       ["expo-quick-actions", {
 *         "iosActions": [
 *           {
 *             "id": "find_shifts",
 *             "title": "Find Shifts",
 *             "icon": "search",
 *             "params": { "screen": "explore" }
 *           },
 *           ...
 *         ]
 *       }]
 *     ]
 *   }
 * }
 */

import { router } from 'expo-router';

export interface QuickAction {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  params?: Record<string, string>;
}

// Define available quick actions
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'find_shifts',
    title: 'Find Shifts',
    subtitle: 'Browse available shifts',
    icon: 'search', // SF Symbol name for iOS
    params: { screen: 'explore' },
  },
  {
    id: 'check_in',
    title: 'Check In',
    subtitle: 'Start your shift',
    icon: 'location.fill',
    params: { screen: 'shift-tracker' },
  },
  {
    id: 'view_earnings',
    title: 'View Earnings',
    subtitle: 'See your balance',
    icon: 'creditcard.fill',
    params: { screen: 'payments' },
  },
  {
    id: 'messages',
    title: 'Messages',
    subtitle: 'Chat with venues',
    icon: 'message.fill',
    params: { screen: 'messages' },
  },
];

// Handle quick action press
export function handleQuickAction(action: QuickAction) {
  const { id, params } = action;
  
  switch (id) {
    case 'find_shifts':
      router.push('/(tabs)/explore');
      break;
    case 'check_in':
      router.push('/shift-tracker');
      break;
    case 'view_earnings':
      router.push('/(tabs)/payments');
      break;
    case 'messages':
      router.push('/(tabs)/messages');
      break;
    default:
      if (params?.screen) {
        router.push(params.screen as any);
      }
  }
}

// Setup quick actions listener
export function setupQuickActionsListener() {
  // This would use expo-quick-actions in a real implementation
  // Example usage:
  // 
  // import * as QuickActions from 'expo-quick-actions';
  // 
  // QuickActions.setItems(QUICK_ACTIONS.map(action => ({
  //   id: action.id,
  //   title: action.title,
  //   subtitle: action.subtitle,
  //   icon: action.icon,
  //   params: action.params,
  // })));
  // 
  // QuickActions.addListener((action) => {
  //   handleQuickAction(action);
  // });
  
  console.log('Quick Actions initialized');
}

// App.json configuration for quick actions
export const QUICK_ACTIONS_CONFIG = {
  "expo-quick-actions": {
    "iosActions": QUICK_ACTIONS.map(action => ({
      id: action.id,
      title: action.title,
      subtitle: action.subtitle,
      icon: action.icon,
      params: action.params,
    })),
    "androidActions": QUICK_ACTIONS.map(action => ({
      id: action.id,
      title: action.title,
      shortTitle: action.title,
      icon: action.id, // Android uses drawable resource names
      params: action.params,
    })),
  }
};
