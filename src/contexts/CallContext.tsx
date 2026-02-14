"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useSupabase';
import { CallService, CallState, getCallService, resetCallService } from '@/lib/calling/call-service';
import { SignalingService } from '@/lib/calling/signaling';
import type { Call, UserRole } from '@/lib/database.types';

interface CallParticipant {
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

interface CallContextValue {
  // State
  callState: CallState;
  currentCall: Call | null;
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
  
  // Permission
  hasAudioPermission: boolean;
  requestAudioPermission: () => Promise<boolean>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const { user } = useUser();
  
  // State
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<CallParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [pendingOffer, setPendingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  
  // Refs
  const callServiceRef = useRef<CallService | null>(null);
  const signalingRef = useRef<SignalingService | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Initialize services
  useEffect(() => {
    if (!user) return;

    callServiceRef.current = getCallService();
    signalingRef.current = new SignalingService(supabase, user.id);

    // Set up call service handlers
    callServiceRef.current.setHandlers({
      onStateChange: (state) => {
        setCallState(state);
        
        // Start duration timer when connected
        if (state === 'connected') {
          durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
          stopRingtone();
        }
        
        // Cleanup on end
        if (state === 'ended' || state === 'failed') {
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }
          stopRingtone();
        }
      },
      onRemoteStream: (stream) => {
        // Play remote audio
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play().catch(console.error);
      },
      onIceCandidate: async (candidate) => {
        await signalingRef.current?.sendIceCandidate(candidate);
      },
      onError: (error) => {
        console.error('Call error:', error);
        setCallState('failed');
      },
    });

    // Set up signaling handlers
    signalingRef.current.setHandlers({
      onIncomingCall: async (call, offer) => {
        // Fetch caller info
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, role')
          .eq('id', call.caller_user_id)
          .single();

        setCurrentCall(call);
        setRemoteParticipant({
          userId: call.caller_user_id,
          name: profile?.display_name || 'Unknown',
          role: (call.caller_role as UserRole) || 'personnel',
          avatarUrl: profile?.avatar_url || undefined,
        });
        setPendingOffer(offer);
        setIsIncomingCall(true);
        setCallState('ringing');
        playRingtone();
      },
      onCallAnswered: async (answer) => {
        await callServiceRef.current?.handleAnswer(answer);
      },
      onIceCandidate: async (candidate) => {
        await callServiceRef.current?.addIceCandidate(candidate);
      },
      onCallEnded: (reason) => {
        cleanup();
      },
      onCallRejected: () => {
        cleanup();
      },
    });

    // Subscribe to signals
    signalingRef.current.subscribe();

    return () => {
      signalingRef.current?.unsubscribe();
      cleanup();
    };
  }, [user, supabase]);

  // Ringtone functions
  const playRingtone = () => {
    if (typeof window !== 'undefined') {
      ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(() => {
        // Autoplay might be blocked
        console.log('Ringtone autoplay blocked');
      });
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    setCallState('idle');
    setCurrentCall(null);
    setRemoteParticipant(null);
    setIsIncomingCall(false);
    setCallDuration(0);
    setPendingOffer(null);
    setIsMuted(false);
    stopRingtone();
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    callServiceRef.current?.endCall();
  }, []);

  // Request audio permission
  const requestAudioPermission = useCallback(async (): Promise<boolean> => {
    const result = await callServiceRef.current?.requestAudioPermission() || false;
    setHasAudioPermission(result);
    return result;
  }, []);

  // Initiate call
  const initiateCall = useCallback(async (
    participant: CallParticipant,
    context?: { bookingId?: string; shiftId?: string }
  ): Promise<void> => {
    if (!user || !signalingRef.current || !callServiceRef.current) return;

    try {
      setRemoteParticipant(participant);
      setIsIncomingCall(false);
      setCallState('calling');

      // Get user's role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const callerRole = (profile?.role as UserRole) || 'personnel';

      // Create offer
      const offer = await callServiceRef.current.createOffer();
      if (!offer) {
        throw new Error('Failed to create offer');
      }

      // Send call through signaling
      const call = await signalingRef.current.initiateCall(
        participant.userId,
        callerRole,
        participant.role,
        offer,
        context
      );

      if (call) {
        setCurrentCall(call);
      }

      // Play outgoing ringtone
      playRingtone();

      // Set timeout for unanswered calls (30 seconds)
      setTimeout(() => {
        if (callState === 'calling' || callState === 'ringing') {
          signalingRef.current?.markMissed(currentCall?.id || '');
          cleanup();
        }
      }, 30000);
    } catch (error) {
      console.error('Failed to initiate call:', error);
      cleanup();
    }
  }, [user, supabase, callState, currentCall, cleanup]);

  // Answer call
  const answerCall = useCallback(async (): Promise<void> => {
    if (!pendingOffer || !currentCall || !signalingRef.current || !callServiceRef.current) return;

    try {
      stopRingtone();
      setIsIncomingCall(false);

      // Handle the offer and create answer
      const answer = await callServiceRef.current.handleOffer(pendingOffer);
      if (!answer) {
        throw new Error('Failed to create answer');
      }

      // Send answer through signaling
      await signalingRef.current.answerCall(currentCall.id, answer);
      setPendingOffer(null);
    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanup();
    }
  }, [pendingOffer, currentCall, cleanup]);

  // Reject call
  const rejectCall = useCallback(async (): Promise<void> => {
    if (!currentCall || !signalingRef.current) return;

    try {
      await signalingRef.current.rejectCall(currentCall.id);
      cleanup();
    } catch (error) {
      console.error('Failed to reject call:', error);
      cleanup();
    }
  }, [currentCall, cleanup]);

  // End call
  const endCall = useCallback(async (): Promise<void> => {
    try {
      await signalingRef.current?.endCall('user_ended');
      cleanup();
    } catch (error) {
      console.error('Failed to end call:', error);
      cleanup();
    }
  }, [cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    callServiceRef.current?.setMuted(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

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
    hasAudioPermission,
    requestAudioPermission,
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

// Format call duration as MM:SS
export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
