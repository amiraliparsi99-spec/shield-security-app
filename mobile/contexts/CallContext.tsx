import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Vibration, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { 
  signalingService, 
  type CallState, 
  type CallParticipant, 
  type CallData,
  formatCallDuration 
} from '../lib/calling';

interface CallContextValue {
  // State
  callState: CallState;
  currentCall: CallData | null;
  remoteParticipant: CallParticipant | null;
  isMuted: boolean;
  isIncomingCall: boolean;
  callDuration: number;
  
  // Actions
  initiateCall: (participant: CallParticipant, context?: { bookingId?: string; shiftId?: string }) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<CallParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize signaling service
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await signalingService.initialize(user.id);

        // Set up handlers
        signalingService.onIncomingCall = async (call, callerName) => {
          // Vibrate for incoming call
          if (Platform.OS !== 'web') {
            Vibration.vibrate([500, 500, 500], true);
          }

          // Get caller profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, role')
            .eq('id', call.callerUserId)
            .single();

          setCurrentCall(call);
          setRemoteParticipant({
            userId: call.callerUserId,
            name: callerName || 'Unknown',
            role: (call.callerRole as any) || 'personnel',
            avatarUrl: profile?.avatar_url || undefined,
          });
          setIsIncomingCall(true);
          setCallState('ringing');
        };

        signalingService.onCallAnswered = () => {
          setCallState('connected');
          // Start duration timer
          durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        };

        signalingService.onCallEnded = (reason) => {
          cleanup();
        };

        signalingService.onCallRejected = () => {
          cleanup();
          Alert.alert('Call Declined', 'The call was declined');
        };
      }
    };

    init();

    return () => {
      signalingService.cleanup();
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    // Stop vibration
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    setCallState('idle');
    setCurrentCall(null);
    setRemoteParticipant(null);
    setIsIncomingCall(false);
    setCallDuration(0);
    setIsMuted(false);

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const initiateCall = useCallback(async (
    participant: CallParticipant,
    context?: { bookingId?: string; shiftId?: string }
  ): Promise<void> => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in to make calls');
      return;
    }

    try {
      setRemoteParticipant(participant);
      setIsIncomingCall(false);
      setCallState('calling');

      // Get caller's role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const callerRole = profile?.role || 'personnel';

      const call = await signalingService.initiateCall(
        participant.userId,
        callerRole,
        participant.role,
        context
      );

      if (call) {
        setCurrentCall(call);
        
        // Set timeout for unanswered calls
        setTimeout(() => {
          if (callState === 'calling') {
            cleanup();
            Alert.alert('No Answer', 'The call was not answered');
          }
        }, 30000);
      } else {
        cleanup();
        Alert.alert('Error', 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
      cleanup();
      Alert.alert('Error', 'Failed to initiate call');
    }
  }, [userId, callState, cleanup]);

  const answerCall = useCallback(async (): Promise<void> => {
    if (!currentCall) return;

    try {
      // Stop vibration
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }

      setIsIncomingCall(false);
      setCallState('connecting');

      await signalingService.answerCall(currentCall.id);
      setCallState('connected');

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanup();
    }
  }, [currentCall, cleanup]);

  const rejectCall = useCallback(async (): Promise<void> => {
    if (!currentCall) return;

    try {
      await signalingService.rejectCall(currentCall.id);
      cleanup();
    } catch (error) {
      console.error('Failed to reject call:', error);
      cleanup();
    }
  }, [currentCall, cleanup]);

  const endCall = useCallback(async (): Promise<void> => {
    try {
      await signalingService.endCall('user_ended');
      cleanup();
    } catch (error) {
      console.error('Failed to end call:', error);
      cleanup();
    }
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    // Note: Actual audio muting requires WebRTC integration
  }, []);

  const value: CallContextValue = {
    callState,
    currentCall,
    remoteParticipant,
    isMuted,
    isIncomingCall,
    callDuration,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export { formatCallDuration };
