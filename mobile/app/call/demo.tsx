import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../theme";

type CallState = 'calling' | 'ringing' | 'connected' | 'ended';

export default function DemoCallScreen() {
  const { name, role } = useLocalSearchParams<{ name: string; role: string }>();
  const callerName = name || 'Demo Contact';
  const callerRole = role || 'personnel';
  
  const insets = useSafeAreaInsets();
  const [callState, setCallState] = useState<CallState>('calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationRef = useRef<NodeJS.Timeout | null>(null);

  // Pulse animation for calling state
  useEffect(() => {
    if (callState === 'calling' || callState === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callState]);

  // Simulate call connection
  useEffect(() => {
    // Simulate ringing after 2 seconds
    const ringTimeout = setTimeout(() => {
      if (callState === 'calling') {
        setCallState('ringing');
        Vibration.vibrate([0, 500, 200, 500]);
      }
    }, 2000);

    // Simulate answer after 4 seconds
    const answerTimeout = setTimeout(() => {
      if (callState === 'calling' || callState === 'ringing') {
        setCallState('connected');
      }
    }, 4000);

    return () => {
      clearTimeout(ringTimeout);
      clearTimeout(answerTimeout);
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (callState === 'connected') {
      durationRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
      }
    };
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallState('ended');
    if (durationRef.current) {
      clearInterval(durationRef.current);
    }
    setTimeout(() => {
      router.back();
    }, 1000);
  };

  const getRoleIcon = () => {
    switch (callerRole) {
      case 'venue': return '🏢';
      case 'agency': return '🏛️';
      case 'personnel': return '🛡️';
      default: return '👤';
    }
  };

  const getStatusText = () => {
    switch (callState) {
      case 'calling': return 'Calling...';
      case 'ringing': return 'Ringing...';
      case 'connected': return formatDuration(duration);
      case 'ended': return 'Call Ended';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />
      
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.minimizeBtn}>
          <Text style={styles.minimizeBtnText}>▼</Text>
        </TouchableOpacity>
        <Text style={styles.encryptedText}>🔒 End-to-end encrypted</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Caller info */}
      <View style={styles.callerInfo}>
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getRoleIcon()}</Text>
          </View>
          {(callState === 'calling' || callState === 'ringing') && (
            <>
              <View style={styles.pulseRing1} />
              <View style={styles.pulseRing2} />
            </>
          )}
        </Animated.View>
        
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callerRole}>{callerRole}</Text>
        <Text style={styles.callStatus}>{getStatusText()}</Text>
      </View>

      {/* Call quality indicator (when connected) */}
      {callState === 'connected' && (
        <View style={styles.qualityIndicator}>
          <View style={styles.qualityBar} />
          <View style={styles.qualityBar} />
          <View style={styles.qualityBar} />
          <View style={[styles.qualityBar, styles.qualityBarWeak]} />
          <Text style={styles.qualityText}>Good</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {callState === 'connected' && (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, isSpeaker && styles.actionBtnActive]} 
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Text style={styles.actionBtnIcon}>{isSpeaker ? '🔊' : '🔈'}</Text>
              <Text style={styles.actionBtnLabel}>Speaker</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionBtnIcon}>📹</Text>
              <Text style={styles.actionBtnLabel}>Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, isMuted && styles.actionBtnActive]} 
              onPress={() => setIsMuted(!isMuted)}
            >
              <Text style={styles.actionBtnIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              <Text style={styles.actionBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {callState === 'connected' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionBtnIcon}>⏸️</Text>
              <Text style={styles.actionBtnLabel}>Hold</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionBtnIcon}>➕</Text>
              <Text style={styles.actionBtnLabel}>Add</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionBtnIcon}>💬</Text>
              <Text style={styles.actionBtnLabel}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* End call button */}
        <TouchableOpacity 
          style={styles.endCallBtn} 
          onPress={handleEndCall}
          activeOpacity={0.8}
        >
          <Text style={styles.endCallBtnIcon}>📞</Text>
        </TouchableOpacity>
        
        {callState !== 'connected' && (
          <Text style={styles.endCallLabel}>
            {callState === 'ended' ? 'Call ended' : 'Tap to cancel'}
          </Text>
        )}
      </View>

      {/* Demo indicator */}
      <View style={styles.demoIndicator}>
        <Text style={styles.demoText}>🧪 Demo Call - No real connection</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    opacity: 0.95,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  minimizeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizeBtnText: {
    fontSize: 20,
    color: colors.textMuted,
  },
  encryptedText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  callerInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  avatarContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  avatarText: {
    fontSize: 50,
  },
  pulseRing1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: colors.accent + '40',
    zIndex: 1,
  },
  pulseRing2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: colors.accent + '20',
    zIndex: 0,
  },
  callerName: {
    ...typography.display,
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  callerRole: {
    ...typography.body,
    color: colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
  },
  callStatus: {
    ...typography.title,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: spacing.xl,
  },
  qualityBar: {
    width: 4,
    height: 12,
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  qualityBarWeak: {
    backgroundColor: colors.textMuted,
    height: 8,
  },
  qualityText: {
    ...typography.caption,
    color: colors.success,
    marginLeft: spacing.sm,
  },
  actionsContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  actionBtn: {
    alignItems: 'center',
    width: 70,
  },
  actionBtnActive: {
    opacity: 1,
  },
  actionBtnIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  actionBtnLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  endCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#e74c3c',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallBtnIcon: {
    fontSize: 30,
  },
  endCallLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  demoIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  demoText: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
});
