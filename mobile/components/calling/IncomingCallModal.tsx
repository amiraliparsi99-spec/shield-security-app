import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  Animated,
  Dimensions 
} from 'react-native';
import { useCall } from '../../contexts/CallContext';
import { colors, spacing, typography } from '../../theme';

const { width } = Dimensions.get('window');

export function IncomingCallModal() {
  const { callState, isIncomingCall, remoteParticipant, answerCall, rejectCall } = useCall();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;

  const isVisible = callState === 'ringing' && isIncomingCall;

  // Pulse animation
  useEffect(() => {
    if (isVisible) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();

      const animation2 = Animated.loop(
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(pulseAnim2, {
            toValue: 1.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim2, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation2.start();

      return () => {
        animation.stop();
        animation2.stop();
      };
    }
  }, [isVisible, pulseAnim, pulseAnim2]);

  if (!isVisible || !remoteParticipant) return null;

  const initial = remoteParticipant.name?.[0]?.toUpperCase() || '?';

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Pulsing avatar */}
        <View style={styles.avatarContainer}>
          <Animated.View 
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({
                inputRange: [1, 1.4],
                outputRange: [0.5, 0],
              })}
            ]}
          />
          <Animated.View 
            style={[
              styles.pulseRing2,
              { transform: [{ scale: pulseAnim2 }], opacity: pulseAnim2.interpolate({
                inputRange: [1, 1.6],
                outputRange: [0.3, 0],
              })}
            ]}
          />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* Caller info */}
        <Text style={styles.callerName}>{remoteParticipant.name}</Text>
        <Text style={styles.callerRole}>{remoteParticipant.role}</Text>
        <Animated.Text 
          style={[
            styles.statusText,
            { opacity: pulseAnim.interpolate({
              inputRange: [1, 1.4],
              outputRange: [1, 0.5],
            })}
          ]}
        >
          Incoming Call...
        </Animated.Text>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={rejectCall}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonIcon}>📵</Text>
            <Text style={styles.buttonLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={answerCall}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonIcon}>📞</Text>
            <Text style={styles.buttonLabel}>Accept</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
  },
  pulseRing2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: spacing.xs,
  },
  callerRole: {
    fontSize: 16,
    color: colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  statusText: {
    fontSize: 18,
    color: colors.success,
    marginBottom: spacing.xl * 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.xl * 2,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  declineButton: {
    backgroundColor: colors.error,
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  buttonIcon: {
    fontSize: 32,
  },
  buttonLabel: {
    position: 'absolute',
    bottom: -30,
    color: colors.textMuted,
    fontSize: 14,
  },
});
