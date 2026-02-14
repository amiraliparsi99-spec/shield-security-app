"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabase, useUser } from '@/hooks/useSupabase';
import {
  isPushSupported,
  getNotificationPermission,
  initializePushNotifications,
  showLocalNotification,
} from '@/lib/notifications/web-push';

interface NotificationContextValue {
  // State
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isEnabled: boolean;
  
  // Actions
  requestPermission: () => Promise<boolean>;
  showNotification: (title: string, body: string, data?: Record<string, any>) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const { user } = useUser();
  
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isEnabled, setIsEnabled] = useState(false);

  // Check support and permission on mount
  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    
    if (supported) {
      const perm = getNotificationPermission();
      setPermission(perm);
      setIsEnabled(perm === 'granted');
    }
  }, []);

  // Auto-initialize if permission already granted
  useEffect(() => {
    if (user && permission === 'granted') {
      initializePushNotifications(supabase).then(({ success }) => {
        setIsEnabled(success);
      });
    }
  }, [user, permission, supabase]);

  // Listen for service worker messages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NOTIFICATION_CLICK') {
        console.log('Notification clicked in app:', event.data);
        // Handle navigation or actions based on notification data
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  // Request permission and initialize
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const { success } = await initializePushNotifications(supabase);
    
    if (success) {
      setPermission('granted');
      setIsEnabled(true);
    } else {
      setPermission(getNotificationPermission());
    }
    
    return success;
  }, [isSupported, supabase]);

  // Show a notification
  const showNotification = useCallback((
    title: string,
    body: string,
    data?: Record<string, any>
  ) => {
    showLocalNotification(title, { body, data });
  }, []);

  const value: NotificationContextValue = {
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    showNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
