import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Gentle bounce for icon
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.iconContainer, { transform: [{ translateY: bounceAnim }] }]}>
        <Text style={styles.icon}>{icon}</Text>
      </Animated.View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}

      {secondaryActionLabel && onSecondaryAction && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onSecondaryAction} activeOpacity={0.7}>
          <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Pre-built empty states
export function EmptyMessages({ onStartChat }: { onStartChat?: () => void }) {
  return (
    <EmptyState
      icon="💬"
      title="No messages yet"
      description="Start a conversation with a venue, agency, or security professional."
      actionLabel="Start a Chat"
      onAction={onStartChat}
    />
  );
}

export function EmptyShifts({ onExplore }: { onExplore?: () => void }) {
  return (
    <EmptyState
      icon="📅"
      title="No upcoming shifts"
      description="When you're booked for shifts, they'll appear here. Start exploring opportunities!"
      actionLabel="Explore Jobs"
      onAction={onExplore}
    />
  );
}

export function EmptyBookings({ onCreateBooking }: { onCreateBooking?: () => void }) {
  return (
    <EmptyState
      icon="📋"
      title="No bookings yet"
      description="Create your first booking to find security professionals for your venue."
      actionLabel="Create Booking"
      onAction={onCreateBooking}
    />
  );
}

export function EmptyStaff({ onAddStaff }: { onAddStaff?: () => void }) {
  return (
    <EmptyState
      icon="👥"
      title="No staff members"
      description="Add security professionals to your team to manage shifts and assignments."
      actionLabel="Add Staff"
      onAction={onAddStaff}
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon="🔔"
      title="All caught up!"
      description="You have no new notifications. We'll let you know when something happens."
    />
  );
}

export function EmptySearch({ searchTerm }: { searchTerm: string }) {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      description={`We couldn't find anything matching "${searchTerm}". Try a different search term.`}
    />
  );
}

export function EmptyEarnings({ onFindWork }: { onFindWork?: () => void }) {
  return (
    <EmptyState
      icon="💰"
      title="No earnings yet"
      description="Complete shifts to start earning. Your payment history will appear here."
      actionLabel="Find Work"
      onAction={onFindWork}
    />
  );
}

export function ErrorState({ 
  onRetry, 
  message = "Something went wrong" 
}: { 
  onRetry?: () => void; 
  message?: string;
}) {
  return (
    <EmptyState
      icon="😕"
      title="Oops!"
      description={message}
      actionLabel="Try Again"
      onAction={onRetry}
    />
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon="📡"
      title="You're offline"
      description="Check your internet connection and try again."
      actionLabel="Retry"
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  actionButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  secondaryButton: {
    padding: spacing.md,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.accent,
  },
});
