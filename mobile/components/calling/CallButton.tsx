import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useCall } from '../../contexts/CallContext';
import { colors, spacing } from '../../theme';

interface CallButtonProps {
  userId: string;
  name: string;
  role: 'venue' | 'agency' | 'personnel';
  avatarUrl?: string;
  bookingId?: string;
  shiftId?: string;
  variant?: 'default' | 'icon' | 'small';
  style?: any;
}

export function CallButton({
  userId,
  name,
  role,
  avatarUrl,
  bookingId,
  shiftId,
  variant = 'default',
  style,
}: CallButtonProps) {
  const { initiateCall, callState } = useCall();

  const handleCall = async () => {
    if (callState !== 'idle') {
      Alert.alert('Call in Progress', "You're already in a call");
      return;
    }

    await initiateCall(
      { userId, name, role, avatarUrl },
      { bookingId, shiftId }
    );
  };

  const isDisabled = callState !== 'idle';

  if (variant === 'icon') {
    return (
      <TouchableOpacity
        onPress={handleCall}
        disabled={isDisabled}
        style={[
          styles.iconButton,
          isDisabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>📞</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'small') {
    return (
      <TouchableOpacity
        onPress={handleCall}
        disabled={isDisabled}
        style={[
          styles.smallButton,
          isDisabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.7}
      >
        <Text style={styles.smallIcon}>📞</Text>
        <Text style={styles.smallText}>Call</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleCall}
      disabled={isDisabled}
      style={[
        styles.defaultButton,
        isDisabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>📞</Text>
      <Text style={styles.defaultText}>Call {name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  defaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.success,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: `${colors.success}30`,
    borderWidth: 1,
    borderColor: `${colors.success}50`,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 20,
  },
  smallIcon: {
    fontSize: 16,
  },
  defaultText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  smallText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '500',
  },
});
