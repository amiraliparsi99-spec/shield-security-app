import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SilentSupportAlertProps {
  visible: boolean;
  location: string;
  type: 'unsafe' | 'medical' | 'lost' | 'other';
  venueName: string;
  onRespond: () => void;
  onDismiss: () => void;
}

const TYPE_CONFIG = {
  unsafe: { 
    label: 'Guest Feels Unsafe', 
    icon: '🛡️', 
    color: '#ef4444',
    urgency: 'high'
  },
  medical: { 
    label: 'Medical Assistance', 
    icon: '🏥', 
    color: '#f59e0b',
    urgency: 'high'
  },
  lost: { 
    label: 'Lost Friends', 
    icon: '👥', 
    color: '#3b82f6',
    urgency: 'medium'
  },
  other: { 
    label: 'General Assistance', 
    icon: '💬', 
    color: '#8b5cf6',
    urgency: 'normal'
  },
};

export function SilentSupportAlert({
  visible,
  location,
  type,
  venueName,
  onRespond,
  onDismiss,
}: SilentSupportAlertProps) {
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const config = TYPE_CONFIG[type];

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      // Vibration pattern for urgent alerts
      if (config.urgency === 'high') {
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
      }
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateY: slideAnim },
            { scale: pulseAnim }
          ],
        },
      ]}
    >
      <LinearGradient
        colors={[config.color + '30', config.color + '10']}
        style={styles.gradient}
      >
        {/* Alert Header */}
        <View style={styles.header}>
          <View style={styles.urgencyBadge}>
            <View style={[styles.urgencyDot, { backgroundColor: config.color }]} />
            <Text style={[styles.urgencyText, { color: config.color }]}>
              SILENT SUPPORT
            </Text>
          </View>
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Alert Content */}
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '30' }]}>
            <Text style={styles.icon}>{config.icon}</Text>
          </View>
          <View style={styles.textContent}>
            <Text style={styles.typeLabel}>{config.label}</Text>
            <Text style={styles.location}>📍 {location}</Text>
            <Text style={styles.venue}>{venueName}</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.respondBtn, { backgroundColor: config.color }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onRespond();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.respondText}>🚶 I'm Responding</Text>
        </TouchableOpacity>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          Approach guest casually and discreetly
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

// Hook to listen for Silent Support notifications
export function useSilentSupportAlerts(venueId: string) {
  const [alert, setAlert] = React.useState<{
    visible: boolean;
    location: string;
    type: 'unsafe' | 'medical' | 'lost' | 'other';
    venueName: string;
    requestId: string;
  } | null>(null);

  useEffect(() => {
    // In production, subscribe to Supabase realtime:
    // const channel = supabase.channel('support_requests')
    //   .on('postgres_changes', {
    //     event: 'INSERT',
    //     schema: 'public',
    //     table: 'support_requests',
    //     filter: `venue_id=eq.${venueId}`
    //   }, (payload) => {
    //     setAlert({
    //       visible: true,
    //       location: payload.new.location,
    //       type: payload.new.type,
    //       venueName: payload.new.venue_name,
    //       requestId: payload.new.id,
    //     });
    //   })
    //   .subscribe();
    
    // Demo: simulate an alert after 5 seconds
    // const timer = setTimeout(() => {
    //   setAlert({
    //     visible: true,
    //     location: 'Table 4',
    //     type: 'unsafe',
    //     venueName: 'The Night Owl',
    //     requestId: 'demo-1',
    //   });
    // }, 5000);

    return () => {
      // channel.unsubscribe();
      // clearTimeout(timer);
    };
  }, [venueId]);

  const dismissAlert = () => {
    setAlert(null);
  };

  const respondToAlert = async () => {
    if (!alert) return;
    
    // In production, update the request status in Supabase:
    // await supabase.from('support_requests')
    //   .update({ status: 'responding', responded_at: new Date().toISOString() })
    //   .eq('id', alert.requestId);
    
    setAlert(null);
  };

  return {
    alert,
    dismissAlert,
    respondToAlert,
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  gradient: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dismissBtn: {
    padding: spacing.xs,
  },
  dismissText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
  textContent: {
    flex: 1,
  },
  typeLabel: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: 2,
  },
  location: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  venue: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  respondBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  respondText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
