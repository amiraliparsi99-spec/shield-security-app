import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  Animated 
} from 'react-native';
import { useCall, formatCallDuration } from '../../contexts/CallContext';
import { colors, spacing, typography } from '../../theme';

export function ActiveCallScreen() {
  const { 
    callState, 
    remoteParticipant, 
    isMuted, 
    callDuration,
    isIncomingCall,
    toggleMute, 
    endCall 
  } = useCall();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Show for calling, connecting, or connected states (but not incoming ringing)
  const isVisible = ['calling', 'connecting', 'connected'].includes(callState) && !isIncomingCall;

  // Pulse animation when not connected
  useEffect(() => {
    if (isVisible && callState !== 'connected') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isVisible, callState, pulseAnim]);

  if (!isVisible || !remoteParticipant) return null;

  const initial = remoteParticipant.name?.[0]?.toUpperCase() || '?';

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {callState === 'calling' && 'Calling...'}
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'connected' && 'In Call'}
          </Text>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Avatar */}
          <Animated.View 
            style={[
              styles.avatarContainer,
              callState !== 'connected' && { transform: [{ scale: pulseAnim }] }
            ]}
          >
            {callState === 'connected' && (
              <View style={styles.connectedRing} />
            )}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </Animated.View>

          {/* Participant info */}
          <Text style={styles.participantName}>{remoteParticipant.name}</Text>
          <Text style={styles.participantRole}>{remoteParticipant.role}</Text>

          {/* Call status/duration */}
          {callState === 'connected' ? (
            <View style={styles.durationContainer}>
              <View style={styles.liveDot} />
              <Text style={styles.duration}>{formatCallDuration(callDuration)}</Text>
            </View>
          ) : (
            <Animated.Text 
              style={[
                styles.connectingText,
                { opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.05],
                  outputRange: [1, 0.5],
                })}
              ]}
            >
              {callState === 'calling' ? 'Ringing...' : 'Establishing connection...'}
            </Animated.Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={endCall}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>📵</Text>
            <Text style={styles.controlLabel}>End</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>🔊</Text>
            <Text style={styles.controlLabel}>Speaker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0d10',
  },
  statusBar: {
    paddingTop: 60,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  connectedRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: `${colors.success}50`,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  avatarText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
  },
  participantName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: spacing.xs,
  },
  participantRole: {
    fontSize: 16,
    color: colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: spacing.lg,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  duration: {
    fontSize: 20,
    fontFamily: 'monospace',
    color: colors.success,
  },
  connectingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.xl * 2,
    paddingBottom: spacing.xl * 2,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#fff',
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.error,
  },
  controlIcon: {
    fontSize: 28,
  },
  controlLabel: {
    position: 'absolute',
    bottom: -24,
    fontSize: 12,
    color: colors.textMuted,
  },
});
