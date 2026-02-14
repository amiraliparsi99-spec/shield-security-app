import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, typography, spacing, radius } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VenueExperience {
  id: string;
  name: string;
  type: string;
  shifts: number;
  hours: number;
  rating: number;
  verified: boolean;
  notableEvents?: string[];
}

const VENUES: VenueExperience[] = [
  {
    id: '1',
    name: 'The O2 Arena',
    type: 'Arena / Concert Venue',
    shifts: 47,
    hours: 376,
    rating: 4.9,
    verified: true,
    notableEvents: ['Taylor Swift Eras Tour', 'UFC 286', 'NYE 2024'],
  },
  {
    id: '2',
    name: 'Fabric London',
    type: 'Nightclub',
    shifts: 38,
    hours: 304,
    rating: 4.7,
    verified: true,
    notableEvents: ['Defected Records NYE'],
  },
  {
    id: '3',
    name: 'The Shard',
    type: 'Corporate / Mixed Use',
    shifts: 24,
    hours: 192,
    rating: 5.0,
    verified: true,
  },
  {
    id: '4',
    name: 'Ministry of Sound',
    type: 'Nightclub',
    shifts: 31,
    hours: 248,
    rating: 4.8,
    verified: true,
  },
];

const CERTIFICATIONS = [
  { name: 'SIA Door Supervisor License', issuer: 'SIA', expires: 'Jun 2025', verified: true },
  { name: 'First Aid at Work (FAW)', issuer: 'St John Ambulance', expires: 'Feb 2026', verified: true },
  { name: 'ACT Awareness', issuer: 'NaCTSO', verified: true },
];

const TRAINING_BADGES = [
  { badge: '🛡️', name: 'CT Aware' },
  { badge: '🏥', name: 'First Responder' },
  { badge: '🤝', name: 'Peacekeeper' },
];

export default function DigitalCVScreen() {
  const [selectedVenue, setSelectedVenue] = useState<VenueExperience | null>(null);

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out my verified security profile on Shield!\n\n🛡️ James Mitchell\n✓ SIA Verified\n📍 156 shifts completed\n⭐ 4.8 avg rating\n\nhttps://shield.app/cv/james-mitchell',
        title: 'My Shield Digital CV',
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#0a0a0f', '#111118', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Digital CV</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Text style={styles.shareText}>📤</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#FFD700' + '30', 'transparent']}
              style={styles.profileGradient}
            >
              {/* Tier Banner */}
              <View style={styles.tierBanner}>
                <Text style={styles.tierText}>🥇 Gold Tier</Text>
              </View>

              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>👤</Text>
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>🥇</Text>
                  </View>
                </View>
                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>James Mitchell</Text>
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedIcon}>✓</Text>
                      <Text style={styles.verifiedLabel}>SIA</Text>
                    </View>
                  </View>
                  <Text style={styles.siaBadge}>SIA: 1234567890123456</Text>
                  <Text style={styles.memberSince}>Member since Mar 2023</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>156</Text>
                  <Text style={styles.statLabel}>Shifts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>1,248</Text>
                  <Text style={styles.statLabel}>Hours</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>4.8 ⭐</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>

              {/* Specializations */}
              <View style={styles.specializations}>
                {['Door Supervisor', 'Event Security', 'VIP Protection'].map((spec) => (
                  <View key={spec} style={styles.specBadge}>
                    <Text style={styles.specText}>{spec}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          {/* Verified Work History */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Verified Work History</Text>
              <View style={styles.gpsVerified}>
                <Text style={styles.gpsVerifiedText}>📍 GPS Verified</Text>
              </View>
            </View>

            {VENUES.map((venue) => (
              <TouchableOpacity 
                key={venue.id}
                style={styles.venueCard}
                onPress={() => setSelectedVenue(venue)}
                activeOpacity={0.7}
              >
                <View style={styles.venueIcon}>
                  <Text style={styles.venueIconText}>🏢</Text>
                </View>
                <View style={styles.venueContent}>
                  <View style={styles.venueNameRow}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    {venue.verified && (
                      <View style={styles.verifiedDot}>
                        <Text style={styles.verifiedDotText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.venueType}>{venue.type}</Text>
                  <View style={styles.venueStats}>
                    <Text style={styles.venueStatText}>{venue.shifts} shifts</Text>
                    <Text style={styles.venueStatDot}>•</Text>
                    <Text style={styles.venueStatText}>{venue.hours}h</Text>
                    <Text style={styles.venueStatDot}>•</Text>
                    <Text style={styles.venueRating}>★ {venue.rating}</Text>
                  </View>
                  {venue.notableEvents && (
                    <View style={styles.eventTags}>
                      {venue.notableEvents.slice(0, 2).map((event) => (
                        <View key={event} style={styles.eventTag}>
                          <Text style={styles.eventTagText}>{event}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.venueArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Training Badges */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Training Badges</Text>
              <TouchableOpacity onPress={() => router.push('/training')}>
                <Text style={styles.seeAllText}>See All →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.badgesRow}>
              {TRAINING_BADGES.map((badge) => (
                <View key={badge.name} style={styles.trainingBadge}>
                  <Text style={styles.trainingBadgeIcon}>{badge.badge}</Text>
                  <Text style={styles.trainingBadgeName}>{badge.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Certifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>

            {CERTIFICATIONS.map((cert, i) => (
              <View key={i} style={styles.certCard}>
                <View style={styles.certIcon}>
                  <Text style={styles.certIconText}>📜</Text>
                </View>
                <View style={styles.certContent}>
                  <View style={styles.certNameRow}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    {cert.verified && (
                      <View style={styles.certVerified}>
                        <Text style={styles.certVerifiedText}>✓ Verified</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.certIssuer}>
                    {cert.issuer} {cert.expires && `• Expires: ${cert.expires}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* GPS Verification Note */}
          <View style={styles.gpsNote}>
            <Text style={styles.gpsNoteIcon}>📍</Text>
            <View style={styles.gpsNoteContent}>
              <Text style={styles.gpsNoteTitle}>GPS Verification</Text>
              <Text style={styles.gpsNoteText}>
                All shifts are verified using GPS check-in/check-out. Venues can trust this work history is accurate.
              </Text>
            </View>
          </View>

          {/* Export Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareActionButton} onPress={handleShare}>
              <Text style={styles.shareActionText}>📤 Share CV Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton}>
              <Text style={styles.exportText}>📄 Export as PDF</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: colors.text,
    fontSize: 20,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  profileCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileGradient: {
    padding: spacing.lg,
  },
  tierBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FFD700',
  },
  tierText: {
    position: 'absolute',
    top: 8,
    right: spacing.lg,
    ...typography.caption,
    color: '#FFD700',
    fontWeight: '700',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
  },
  tierBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  tierBadgeText: {
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  profileName: {
    ...typography.title,
    color: colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 4,
  },
  verifiedIcon: {
    fontSize: 10,
    color: colors.success,
  },
  verifiedLabel: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  siaBadge: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  memberSince: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.title,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  specializations: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  specBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  specText: {
    ...typography.caption,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  gpsVerified: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  gpsVerifiedText: {
    ...typography.caption,
    color: colors.success,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  venueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueIconText: {
    fontSize: 22,
  },
  venueContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  venueName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  verifiedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: {
    fontSize: 8,
    color: colors.success,
  },
  venueType: {
    ...typography.caption,
    color: colors.textMuted,
  },
  venueStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  venueStatText: {
    ...typography.caption,
    color: colors.text,
  },
  venueStatDot: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  venueRating: {
    ...typography.caption,
    color: '#FFD700',
  },
  eventTags: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  eventTag: {
    backgroundColor: '#8B5CF6' + '30',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  eventTagText: {
    ...typography.caption,
    color: '#8B5CF6',
    fontSize: 10,
  },
  venueArrow: {
    color: colors.textMuted,
    fontSize: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trainingBadge: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  trainingBadgeIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  trainingBadgeName: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
  },
  certCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  certIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certIconText: {
    fontSize: 20,
  },
  certContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  certNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  certName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  certVerified: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  certVerifiedText: {
    ...typography.caption,
    color: colors.success,
    fontSize: 10,
  },
  certIssuer: {
    ...typography.caption,
    color: colors.textMuted,
  },
  gpsNote: {
    backgroundColor: colors.success + '10',
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '30',
    marginBottom: spacing.lg,
  },
  gpsNoteIcon: {
    fontSize: 20,
  },
  gpsNoteContent: {
    flex: 1,
  },
  gpsNoteTitle: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  gpsNoteText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
  shareActionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareActionText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  exportText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
