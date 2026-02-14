import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '../../theme';

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onTranscriptionStart: () => void;
  onTranscriptionComplete: (text: string, analysis: any) => void;
}

export function VoiceRecorder({ 
  onRecordingComplete, 
  onTranscriptionStart,
  onTranscriptionComplete 
}: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [duration, setDuration] = useState(0);
  const [metering, setMetering] = useState(-100);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recording) stopRecording();
    };
  }, []);

  async function startRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        const { status } = await requestPermission();
        if (status !== 'granted') return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setDuration(0);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Start metering update (simulated since expo-av metering is tricky across platforms)
      // Real app would use recording.getStatusAsync() for metering
      
      // Animations
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
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

      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    setIsRecording(false);
    
    // Stop animations
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    rippleAnim.stopAnimation();
    rippleAnim.setValue(0);
    
    if (timerRef.current) clearInterval(timerRef.current);

    if (!recording) return;

    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    
    const uri = recording.getURI();
    setRecording(null);
    
    if (uri) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRecordingComplete(uri, duration);
      simulateTranscription();
    }
  }

  const simulateTranscription = async () => {
    onTranscriptionStart();
    
    // Simulate AI processing delay
    setTimeout(() => {
      // Mock AI result
      const mockResult = {
        text: "I observed a male individual, approximately 30 years old, creating a disturbance at the main entrance. He was aggressive towards staff and refused to leave when asked. I escorted him off the premises at 22:45. No physical force was required.",
        analysis: {
          type: 'disturbance',
          severity: 'medium',
          location: 'Main Entrance',
          time: '22:45',
          involved: ['Male, ~30yo', 'Staff'],
          actions: ['Escorted off premises', 'Verbal warning']
        }
      };
      
      onTranscriptionComplete(mockResult.text, mockResult.analysis);
    }, 3000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isRecording ? 'Recording Incident...' : 'Hold to Record'}
        </Text>
        <Text style={styles.timerText}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.micContainer}>
        {/* Ripple Effect */}
        <Animated.View 
          style={[
            styles.ripple, 
            { 
              transform: [{ scale: rippleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 2.5]
              })}],
              opacity: rippleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 0]
              })
            }
          ]} 
        />
        
        {/* Pulsing Ring */}
        <Animated.View 
          style={[
            styles.pulseRing, 
            { transform: [{ scale: pulseAnim }] }
          ]} 
        />

        {/* Main Button */}
        <TouchableOpacity
          onPressIn={startRecording}
          onPressOut={stopRecording}
          activeOpacity={1}
          style={styles.buttonWrapper}
        >
          <Animated.View style={[styles.micButton, { transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient
              colors={isRecording ? ['#ef4444', '#b91c1c'] : ['#3b82f6', '#2563eb']}
              style={styles.gradient}
            >
              <Text style={styles.micIcon}>{isRecording ? '⬛' : '🎙️'}</Text>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Text style={styles.instructionText}>
        Describe the incident clearly. Mention time, location, and persons involved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  statusText: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  timerText: {
    ...typography.display,
    fontSize: 48,
    fontVariant: ['tabular-nums'],
    color: colors.error,
  },
  micContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  buttonWrapper: {
    zIndex: 10,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  gradient: {
    flex: 1,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  micIcon: {
    fontSize: 40,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    zIndex: 5,
  },
  ripple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    zIndex: 1,
  },
  instructionText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
