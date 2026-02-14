import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, typography, spacing, radius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Course {
  id: string;
  title: string;
  description: string;
  duration: number;
  badge: string;
  badgeName: string;
  points: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completed?: boolean;
  progress?: number;
}

const COURSES: Course[] = [
  {
    id: 'ct-basics',
    title: 'Counter-Terrorism Basics',
    description: 'Learn to identify suspicious behavior and respond to potential threats.',
    duration: 8,
    badge: '🛡️',
    badgeName: 'CT Aware',
    points: 50,
    difficulty: 'beginner',
    completed: true,
  },
  {
    id: 'first-aid',
    title: 'First Aid Refresher',
    description: 'Quick refresh on CPR, recovery position, and common injuries.',
    duration: 10,
    badge: '🏥',
    badgeName: 'First Responder',
    points: 40,
    difficulty: 'beginner',
    progress: 60,
  },
  {
    id: 'conflict',
    title: 'Conflict De-escalation',
    description: 'Techniques to calm aggressive situations without physical intervention.',
    duration: 12,
    badge: '🤝',
    badgeName: 'Peacekeeper',
    points: 60,
    difficulty: 'intermediate',
  },
  {
    id: 'drug-awareness',
    title: 'Drug Awareness',
    description: 'Identify signs of drug use in nightlife settings.',
    duration: 7,
    badge: '💊',
    badgeName: 'Vigilant',
    points: 45,
    difficulty: 'beginner',
  },
  {
    id: 'crowd',
    title: 'Crowd Management',
    description: 'Handle large crowds safely and prevent crushes at events.',
    duration: 15,
    badge: '👥',
    badgeName: 'Crowd Controller',
    points: 75,
    difficulty: 'intermediate',
  },
  {
    id: 'vip',
    title: 'VIP Protection',
    description: 'Advanced techniques for protecting high-profile individuals.',
    duration: 20,
    badge: '⭐',
    badgeName: 'Elite Protector',
    points: 100,
    difficulty: 'advanced',
  },
];

const TIER_CONFIG = {
  bronze: { label: 'Bronze', icon: '🥉', color: '#CD7F32', minPoints: 0 },
  silver: { label: 'Silver', icon: '🥈', color: '#C0C0C0', minPoints: 100 },
  gold: { label: 'Gold', icon: '🥇', color: '#FFD700', minPoints: 300 },
  elite: { label: 'Shield Elite', icon: '⭐', color: '#8B5CF6', minPoints: 600 },
};

export default function TrainingScreen() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'courses' | 'passport'>('courses');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Demo user data
  const userPoints = 145;
  const currentTier = 'silver';
  const completedCourses = COURSES.filter(c => c.completed).length;

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'beginner': return colors.success;
      case 'intermediate': return colors.warning;
      case 'advanced': return colors.error;
      default: return colors.textMuted;
    }
  };

  const renderCourseCard = (course: Course) => (
    <TouchableOpacity
      key={course.id}
      style={styles.courseCard}
      onPress={() => setSelectedCourse(course)}
      activeOpacity={0.7}
    >
      <View style={styles.courseHeader}>
        <View style={styles.courseBadge}>
          <Text style={styles.courseBadgeText}>{course.badge}</Text>
        </View>
        {course.completed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓ Done</Text>
          </View>
        )}
      </View>

      <Text style={styles.courseTitle}>{course.title}</Text>
      <Text style={styles.courseDescription} numberOfLines={2}>
        {course.description}
      </Text>

      <View style={styles.courseMeta}>
        <Text style={styles.courseMetaText}>⏱ {course.duration} min</Text>
        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(course.difficulty) + '30' }]}>
          <Text style={[styles.difficultyText, { color: getDifficultyColor(course.difficulty) }]}>
            {course.difficulty}
          </Text>
        </View>
      </View>

      {course.progress !== undefined && course.progress > 0 && course.progress < 100 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{course.progress}%</Text>
        </View>
      )}

      <View style={styles.courseFooter}>
        <Text style={styles.badgeName}>Earn: {course.badgeName}</Text>
        <Text style={styles.pointsText}>+{course.points} pts</Text>
      </View>
    </TouchableOpacity>
  );

  const renderPassport = () => (
    <View style={styles.passportContainer}>
      {/* Earned Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earned Badges</Text>
        <View style={styles.badgesGrid}>
          {COURSES.filter(c => c.completed).map(course => (
            <View key={course.id} style={styles.earnedBadge}>
              <Text style={styles.earnedBadgeIcon}>{course.badge}</Text>
              <Text style={styles.earnedBadgeName}>{course.badgeName}</Text>
            </View>
          ))}
          {COURSES.filter(c => !c.completed).map(course => (
            <View key={course.id} style={[styles.earnedBadge, styles.lockedBadge]}>
              <Text style={styles.lockedBadgeIcon}>🔒</Text>
              <Text style={styles.lockedBadgeName}>{course.badgeName}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Work History Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verified Work History</Text>
        <View style={styles.workHistoryCard}>
          <View style={styles.venueRow}>
            <View style={styles.venueIcon}>
              <Text style={styles.venueIconText}>🏢</Text>
            </View>
            <View style={styles.venueInfo}>
              <View style={styles.venueNameRow}>
                <Text style={styles.venueName}>The O2 Arena</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              </View>
              <Text style={styles.venueStats}>47 shifts • 376 hours • ★ 4.9</Text>
            </View>
          </View>
          <View style={styles.venueRow}>
            <View style={styles.venueIcon}>
              <Text style={styles.venueIconText}>🎵</Text>
            </View>
            <View style={styles.venueInfo}>
              <View style={styles.venueNameRow}>
                <Text style={styles.venueName}>Fabric London</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              </View>
              <Text style={styles.venueStats}>38 shifts • 304 hours • ★ 4.7</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/cv')}
        >
          <Text style={styles.viewAllText}>View Full Digital CV →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
          <Text style={styles.headerTitle}>Training Academy</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Tier Progress */}
        <View style={styles.tierCard}>
          <LinearGradient
            colors={[TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].color + '30', 'transparent']}
            style={styles.tierGradient}
          >
            <View style={styles.tierHeader}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierIcon}>{TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].icon}</Text>
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierLabel}>{TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].label}</Text>
                <Text style={styles.tierPoints}>{userPoints} points</Text>
              </View>
              <View style={styles.tierStats}>
                <Text style={styles.tierStatsNumber}>{completedCourses}</Text>
                <Text style={styles.tierStatsLabel}>Completed</Text>
              </View>
            </View>
            <View style={styles.tierProgress}>
              <View style={styles.tierProgressBar}>
                <View 
                  style={[
                    styles.tierProgressFill, 
                    { 
                      width: `${(userPoints / TIER_CONFIG.gold.minPoints) * 100}%`,
                      backgroundColor: TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG].color,
                    }
                  ]} 
                />
              </View>
              <Text style={styles.tierProgressText}>
                {TIER_CONFIG.gold.minPoints - userPoints} pts to Gold 🥇
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'courses' && styles.tabActive]}
            onPress={() => setActiveTab('courses')}
          >
            <Text style={[styles.tabText, activeTab === 'courses' && styles.tabTextActive]}>
              📚 Courses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'passport' && styles.tabActive]}
            onPress={() => setActiveTab('passport')}
          >
            <Text style={[styles.tabText, activeTab === 'passport' && styles.tabTextActive]}>
              🎓 Passport
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'courses' && (
            <View style={styles.coursesGrid}>
              {COURSES.map(renderCourseCard)}
            </View>
          )}
          {activeTab === 'passport' && renderPassport()}
        </ScrollView>
      </SafeAreaView>

      {/* Course Modal */}
      <Modal
        visible={!!selectedCourse}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedCourse(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedCourse && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{selectedCourse.badge}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setSelectedCourse(null)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalTitle}>{selectedCourse.title}</Text>
                <Text style={styles.modalDescription}>{selectedCourse.description}</Text>

                <View style={styles.modalStats}>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>⏱ {selectedCourse.duration}</Text>
                    <Text style={styles.modalStatLabel}>Minutes</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>+{selectedCourse.points}</Text>
                    <Text style={styles.modalStatLabel}>Points</Text>
                  </View>
                </View>

                <View style={styles.modalReward}>
                  <Text style={styles.modalRewardTitle}>🏅 On completion:</Text>
                  <Text style={styles.modalRewardText}>
                    Earn the "{selectedCourse.badgeName}" badge and {selectedCourse.points} points toward your next tier.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.startButton,
                    selectedCourse.completed && styles.startButtonCompleted
                  ]}
                  onPress={() => {
                    setSelectedCourse(null);
                    // Navigate to course content
                  }}
                >
                  <Text style={styles.startButtonText}>
                    {selectedCourse.completed 
                      ? '✓ Completed - Review Course' 
                      : selectedCourse.progress 
                      ? 'Continue Course →' 
                      : 'Start Course →'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  headerRight: {
    width: 40,
  },
  tierCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierGradient: {
    padding: spacing.lg,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierIcon: {
    fontSize: 24,
  },
  tierInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tierLabel: {
    ...typography.titleCard,
    color: colors.text,
  },
  tierPoints: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tierStats: {
    alignItems: 'center',
  },
  tierStatsNumber: {
    ...typography.title,
    color: colors.text,
  },
  tierStatsLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tierProgress: {
    marginTop: spacing.sm,
  },
  tierProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tierProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tierProgressText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.accent + '30',
  },
  tabText: {
    ...typography.body,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  coursesGrid: {
    gap: spacing.md,
  },
  courseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  courseBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBadgeText: {
    fontSize: 24,
  },
  completedBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  completedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  courseTitle: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  courseDescription: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  courseMetaText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  difficultyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  difficultyText: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  badgeName: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pointsText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
  },
  passportContainer: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  earnedBadge: {
    width: (SCREEN_WIDTH - spacing.md * 4 - spacing.md * 2) / 3,
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  lockedBadge: {
    borderColor: colors.border,
    opacity: 0.5,
  },
  earnedBadgeIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  earnedBadgeName: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
  },
  lockedBadgeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  lockedBadgeName: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  workHistoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  venueIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueIconText: {
    fontSize: 20,
  },
  venueInfo: {
    flex: 1,
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
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedText: {
    fontSize: 10,
    color: colors.success,
  },
  venueStats: {
    ...typography.caption,
    color: colors.textMuted,
  },
  viewAllButton: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  viewAllText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBadgeText: {
    fontSize: 32,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 18,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalDescription: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  modalStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  modalStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  modalStatValue: {
    ...typography.title,
    color: colors.text,
  },
  modalStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  modalReward: {
    backgroundColor: colors.accent + '15',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  modalRewardTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modalRewardText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  startButtonCompleted: {
    backgroundColor: colors.success,
  },
  startButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
