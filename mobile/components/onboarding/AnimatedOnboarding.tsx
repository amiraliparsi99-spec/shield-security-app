import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, radius } from '../../theme';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  gradientColors: [string, string, string];
}

// Animated illustration components
function ShieldIllustration({ color, scale }: { color: string; scale: Animated.Value }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous rotation
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Pulse effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.illustrationContainer}>
      {/* Outer glow rings */}
      <Animated.View style={[styles.glowRing, styles.glowRing3, { 
        backgroundColor: color + '10',
        transform: [{ scale: Animated.multiply(scale, pulse) }]
      }]} />
      <Animated.View style={[styles.glowRing, styles.glowRing2, { 
        backgroundColor: color + '15',
        transform: [{ scale }]
      }]} />
      <Animated.View style={[styles.glowRing, styles.glowRing1, { 
        backgroundColor: color + '20',
        transform: [{ scale }]
      }]} />
      
      {/* Main shield */}
      <Animated.View style={[styles.mainIcon, { 
        backgroundColor: color + '25',
        borderColor: color + '40',
        transform: [{ scale }]
      }]}>
        <Text style={styles.iconEmoji}>🛡️</Text>
      </Animated.View>

      {/* Floating particles */}
      <Animated.View style={[styles.particle, styles.particle1, {
        backgroundColor: color,
        transform: [{ rotate: spin }, { translateX: 80 }]
      }]} />
      <Animated.View style={[styles.particle, styles.particle2, {
        backgroundColor: color,
        transform: [{ rotate: spin }, { translateX: -70 }]
      }]} />
      <Animated.View style={[styles.particle, styles.particle3, {
        backgroundColor: color,
        transform: [{ rotate: spin }, { translateY: 75 }]
      }]} />
    </View>
  );
}

function MapIllustration({ color, scale }: { color: string; scale: Animated.Value }) {
  const marker1 = useRef(new Animated.Value(0)).current;
  const marker2 = useRef(new Animated.Value(0)).current;
  const marker3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateMarker = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.6, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    };
    animateMarker(marker1, 0);
    animateMarker(marker2, 300);
    animateMarker(marker3, 600);
  }, []);

  return (
    <View style={styles.illustrationContainer}>
      <Animated.View style={[styles.mapContainer, { transform: [{ scale }] }]}>
        {/* Map background */}
        <View style={[styles.mapBg, { borderColor: color + '30' }]}>
          {/* Grid lines */}
          <View style={[styles.mapLine, styles.mapLineH1, { backgroundColor: color + '20' }]} />
          <View style={[styles.mapLine, styles.mapLineH2, { backgroundColor: color + '20' }]} />
          <View style={[styles.mapLine, styles.mapLineV1, { backgroundColor: color + '20' }]} />
          <View style={[styles.mapLine, styles.mapLineV2, { backgroundColor: color + '20' }]} />
          
          {/* Markers */}
          <Animated.View style={[styles.mapMarker, styles.mapMarker1, { 
            backgroundColor: color,
            opacity: marker1,
            transform: [{ scale: marker1 }]
          }]}>
            <Text style={styles.markerText}>1</Text>
          </Animated.View>
          <Animated.View style={[styles.mapMarker, styles.mapMarker2, { 
            backgroundColor: color,
            opacity: marker2,
            transform: [{ scale: marker2 }]
          }]}>
            <Text style={styles.markerText}>2</Text>
          </Animated.View>
          <Animated.View style={[styles.mapMarker, styles.mapMarker3, { 
            backgroundColor: color,
            opacity: marker3,
            transform: [{ scale: marker3 }]
          }]}>
            <Text style={styles.markerText}>3</Text>
          </Animated.View>
          
          {/* Current location */}
          <View style={styles.currentLocation}>
            <View style={styles.currentLocationDot} />
            <View style={styles.currentLocationPulse} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function ChatIllustration({ color, scale }: { color: string; scale: Animated.Value }) {
  const message1 = useRef(new Animated.Value(0)).current;
  const message2 = useRef(new Animated.Value(0)).current;
  const message3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(400, [
      Animated.spring(message1, { toValue: 1, useNativeDriver: true, damping: 12 }),
      Animated.spring(message2, { toValue: 1, useNativeDriver: true, damping: 12 }),
      Animated.spring(message3, { toValue: 1, useNativeDriver: true, damping: 12 }),
    ]).start();
  }, []);

  return (
    <View style={styles.illustrationContainer}>
      <Animated.View style={[styles.chatContainer, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.chatBubble, styles.chatBubbleLeft, {
          backgroundColor: color + '20',
          borderColor: color + '30',
          opacity: message1,
          transform: [{ scale: message1 }, { translateX: message1.interpolate({
            inputRange: [0, 1],
            outputRange: [-50, 0]
          })}]
        }]}>
          <Text style={styles.chatText}>New shift available!</Text>
        </Animated.View>
        
        <Animated.View style={[styles.chatBubble, styles.chatBubbleRight, {
          backgroundColor: color,
          opacity: message2,
          transform: [{ scale: message2 }, { translateX: message2.interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0]
          })}]
        }]}>
          <Text style={[styles.chatText, { color: '#000' }]}>I'm interested!</Text>
        </Animated.View>
        
        <Animated.View style={[styles.chatBubble, styles.chatBubbleLeft, {
          backgroundColor: color + '20',
          borderColor: color + '30',
          opacity: message3,
          transform: [{ scale: message3 }, { translateX: message3.interpolate({
            inputRange: [0, 1],
            outputRange: [-50, 0]
          })}]
        }]}>
          <Text style={styles.chatText}>You're booked! ✓</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function MoneyIllustration({ color, scale }: { color: string; scale: Animated.Value }) {
  const coinAnim = useRef(new Animated.Value(0)).current;
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    // Animate the coin bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(coinAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(coinAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Animate the counter
    let startTime = Date.now();
    const duration = 2000;
    const targetAmount = 1840;
    
    const updateAmount = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(Math.floor(targetAmount * eased));
      
      if (progress < 1) {
        requestAnimationFrame(updateAmount);
      }
    };
    
    requestAnimationFrame(updateAmount);
  }, []);

  const formatAmount = (num: number) => {
    return num.toLocaleString('en-GB');
  };

  return (
    <View style={styles.illustrationContainer}>
      <Animated.View style={[styles.moneyContainer, { transform: [{ scale }] }]}>
        <View style={[styles.earningsCard, { borderColor: color + '30' }]}>
          <Text style={styles.earningsLabel}>Total Earned</Text>
          <Text style={[styles.earningsAmount, { color }]}>
            £{formatAmount(displayAmount)}
          </Text>
          <View style={styles.earningsChart}>
            {[40, 60, 45, 80, 65, 90, 75].map((h, i) => (
              <Animated.View 
                key={i} 
                style={[styles.chartBar, { 
                  height: h,
                  backgroundColor: i === 6 ? color : color + '40',
                  transform: [{ scaleY: coinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  })}]
                }]} 
              />
            ))}
          </View>
        </View>
        
        {/* Floating coins */}
        <Animated.View style={[styles.floatingCoin, styles.coin1, {
          transform: [{ translateY: coinAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -20]
          })}]
        }]}>
          <Text style={styles.coinEmoji}>💷</Text>
        </Animated.View>
        <Animated.View style={[styles.floatingCoin, styles.coin2, {
          transform: [{ translateY: coinAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -15]
          })}]
        }]}>
          <Text style={styles.coinEmoji}>💰</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function RocketIllustration({ color, scale }: { color: string; scale: Animated.Value }) {
  const rocket = useRef(new Animated.Value(0)).current;
  const stars = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(rocket, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(rocket, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.timing(stars, { toValue: 1, duration: 3000, useNativeDriver: true })
      ),
    ]).start();
  }, []);

  return (
    <View style={styles.illustrationContainer}>
      <Animated.View style={[styles.rocketContainer, { 
        transform: [
          { scale },
          { translateY: rocket.interpolate({
            inputRange: [0, 1],
            outputRange: [10, -10]
          })},
          { rotate: rocket.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: ['-3deg', '3deg', '-3deg']
          })}
        ] 
      }]}>
        <Text style={styles.rocketEmoji}>🚀</Text>
      </Animated.View>
      
      {/* Stars */}
      {[...Array(8)].map((_, i) => (
        <Animated.View 
          key={i}
          style={[
            styles.star,
            {
              top: 20 + Math.random() * 160,
              left: 20 + Math.random() * (width - 100),
              opacity: stars.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 1, 0.3]
              })
            }
          ]}
        >
          <Text style={styles.starEmoji}>✨</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    illustration: ShieldIllustration,
    title: 'Welcome to Shield',
    subtitle: 'Your Security Career Starts Here',
    description: 'The platform connecting SIA-licensed professionals with venues and agencies across the UK.',
    accentColor: '#2dd4bf',
    gradientColors: ['#0c0d10', '#0a1a1a', '#0c0d10'],
  },
  {
    id: '2',
    illustration: MapIllustration,
    title: 'Find Shifts Near You',
    subtitle: 'Opportunities on the Map',
    description: 'Browse available shifts in your area, see what venues are hiring, and apply with one tap.',
    accentColor: '#10b981',
    gradientColors: ['#0c0d10', '#0a1a12', '#0c0d10'],
  },
  {
    id: '3',
    illustration: ChatIllustration,
    title: 'Connect Instantly',
    subtitle: 'Real-time Communication',
    description: 'Message venues directly, receive booking confirmations, and stay updated on shift changes.',
    accentColor: '#8b5cf6',
    gradientColors: ['#0c0d10', '#14101f', '#0c0d10'],
  },
  {
    id: '4',
    illustration: MoneyIllustration,
    title: 'Track Your Earnings',
    subtitle: 'Get Paid on Time',
    description: 'View your earnings in real-time, track completed shifts, and withdraw funds securely.',
    accentColor: '#f59e0b',
    gradientColors: ['#0c0d10', '#1a1408', '#0c0d10'],
  },
  {
    id: '5',
    illustration: RocketIllustration,
    title: "Let's Get Started",
    subtitle: 'Your Journey Begins',
    description: 'Create your profile, set your availability, and start receiving shift offers today.',
    accentColor: '#2dd4bf',
    gradientColors: ['#0c0d10', '#0a1a1a', '#0c0d10'],
  },
];

const ONBOARDING_KEY = 'shield-animated-onboarding-complete';

interface Props {
  onComplete: () => void;
}

export function AnimatedOnboarding({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
    });
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [50, 0, 50],
      extrapolate: 'clamp',
    });

    const IllustrationComponent = item.illustration as React.ComponentType<{ color: string; scale: Animated.Value }>;

    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={item.gradientColors}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Illustration */}
        <View style={styles.illustrationWrapper}>
          <IllustrationComponent color={item.accentColor} scale={scale} />
        </View>
        
        {/* Text content */}
        <Animated.View style={[styles.textContent, { opacity, transform: [{ translateY }] }]}>
          <Text style={[styles.subtitle, { color: item.accentColor }]}>{item.subtitle}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {SLIDES.map((slide, index) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 32, 8],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: SLIDES[currentIndex].accentColor,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Skip button */}
      {currentIndex < SLIDES.length - 1 && (
        <TouchableOpacity 
          style={[styles.skipButton, { top: insets.top + 10 }]} 
          onPress={handleSkip}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        {/* Dots */}
        {renderDots()}

        {/* Button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: currentSlide.accentColor }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? "Get Started" : "Continue"}
          </Text>
          <Text style={styles.nextButtonIcon}>→</Text>
        </TouchableOpacity>

        {/* Page indicator */}
        <Text style={styles.pageIndicator}>
          {currentIndex + 1} of {SLIDES.length}
        </Text>
      </View>
    </Animated.View>
  );
}

// Hook to check if onboarding is complete
export function useAnimatedOnboardingComplete() {
  const [isComplete, setIsComplete] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setIsComplete(value === 'true');
    });
  }, []);

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    setIsComplete(false);
  };

  return { isComplete, setIsComplete, resetOnboarding };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButton: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    ...typography.body,
    color: colors.textMuted,
  },
  slide: {
    width,
    flex: 1,
  },
  illustrationWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  illustrationContainer: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    paddingHorizontal: spacing.xl + 10,
    paddingBottom: 200,
  },
  subtitle: {
    ...typography.label,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    color: colors.text,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 26,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  nextButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#000',
    fontSize: 16,
  },
  nextButtonIcon: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
  },
  pageIndicator: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // Illustration styles
  glowRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowRing1: {
    width: 180,
    height: 180,
  },
  glowRing2: {
    width: 220,
    height: 220,
  },
  glowRing3: {
    width: 260,
    height: 260,
  },
  mainIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 56,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  particle1: { top: 40 },
  particle2: { bottom: 60 },
  particle3: { right: 40 },
  // Map styles
  mapContainer: {
    width: 220,
    height: 180,
  },
  mapBg: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  mapLine: {
    position: 'absolute',
  },
  mapLineH1: { top: '33%', left: 0, right: 0, height: 1 },
  mapLineH2: { top: '66%', left: 0, right: 0, height: 1 },
  mapLineV1: { left: '33%', top: 0, bottom: 0, width: 1 },
  mapLineV2: { left: '66%', top: 0, bottom: 0, width: 1 },
  mapMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarker1: { top: 25, left: 30 },
  mapMarker2: { top: 50, right: 40 },
  mapMarker3: { bottom: 30, left: '45%' },
  markerText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  currentLocation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: 20,
    marginLeft: -8,
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: '#fff',
  },
  currentLocationPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    top: -8,
    left: -8,
  },
  // Chat styles
  chatContainer: {
    width: 240,
    gap: 12,
  },
  chatBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    maxWidth: '80%',
  },
  chatBubbleLeft: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  chatBubbleRight: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  // Money styles
  moneyContainer: {
    width: 240,
    alignItems: 'center',
  },
  earningsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  earningsChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 60,
    gap: 8,
  },
  chartBar: {
    flex: 1,
    borderRadius: 4,
  },
  floatingCoin: {
    position: 'absolute',
  },
  coin1: { top: -20, right: 20 },
  coin2: { top: 10, left: -10 },
  coinEmoji: { fontSize: 32 },
  // Rocket styles
  rocketContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rocketEmoji: {
    fontSize: 72,
  },
  star: {
    position: 'absolute',
  },
  starEmoji: {
    fontSize: 20,
  },
});
