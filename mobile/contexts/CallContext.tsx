import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Vibration, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../lib/api';
import { 
  signalingService, 
  type CallState, 
  type CallParticipant, 
  type CallData,
  formatCallDuration 
} from '../lib/calling';
import { 
  agoraService, 
  generateAgoraUid, 
  generateChannelName 
} from '../lib/agora';

interface CallContextValue {
  // State
  callState: CallState;
  currentCall: CallData | null;
  remoteParticipant: CallParticipant | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isIncomingCall: boolean;
  callDuration: number;
  isAgoraConnected: boolean;
  
  // Actions
  initiateCall: (participant: CallParticipant, context?: { bookingId?: string; shiftId?: string }) => Promise<void>;
  joinGroupVoiceChannel: (channelName: string, displayName: string) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<CallParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAgoraConnected, setIsAgoraConnected] = useState(false);
  const [isGroupVoiceSession, setIsGroupVoiceSession] = useState(false);
  
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isGroupVoiceSessionRef = useRef(false);

  useEffect(() => {
    isGroupVoiceSessionRef.current = isGroupVoiceSession;
  }, [isGroupVoiceSession]);

  // Fetch Agora token from server
  const fetchAgoraToken = async (channelName: string, uid: number): Promise<string | null> => {
    try {
      const apiUrl = getApiBaseUrl();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const response = await fetch(`${apiUrl}/api/agora/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ channelName, uid }),
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to fetch Agora token (${response.status}): ${errText}`);
      }
      
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error fetching Agora token:', error);
      return null;
    }
  };

  // Join Agora voice channel by channel name
  const joinAgoraChannelByName = async (channelName: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Initialize Agora if needed
      const initialized = await agoraService.initialize();
      if (!initialized) {
        console.error('Failed to initialize Agora');
        return false;
      }

      // Set up Agora callbacks
      agoraService.setCallbacks({
        onJoinSuccess: (channel, uid) => {
          console.log('Agora: Joined channel successfully', channel, uid);
          setIsAgoraConnected(true);
        },
        onUserJoined: (uid) => {
          console.log('Agora: Remote user joined', uid);
          // Other user has joined - call is now truly connected
          setIsAgoraConnected(true);
        },
        onUserOffline: (uid) => {
          console.log('Agora: Remote user offline', uid);
          // For 1:1 calls, remote leaving ends the call.
          // For group calls, other users can leave/join without ending session.
          if (!isGroupVoiceSessionRef.current) {
            endCall();
          }
        },
        onError: (error) => {
          console.error('Agora error:', error);
          Alert.alert('Call Error', 'Voice connection failed');
        },
      });

      const agoraUid = generateAgoraUid(userId);

      // Get token from server
      const token = await fetchAgoraToken(channelName, agoraUid);
      if (!token) {
        console.error('Failed to get Agora token');
        return false;
      }

      // Join the channel
      const joined = await agoraService.joinChannel(channelName, token, agoraUid);
      return joined;
    } catch (error) {
      console.error('Error joining Agora channel:', error);
      return false;
    }
  };

  // Join Agora voice channel for 1:1 call
  const joinAgoraChannel = async (callId: string): Promise<boolean> => {
    setIsGroupVoiceSession(false);
    return joinAgoraChannelByName(generateChannelName(callId));
  };

  // Leave Agora channel
  const leaveAgoraChannel = async () => {
    try {
      await agoraService.leaveChannel();
      setIsAgoraConnected(false);
    } catch (error) {
      console.error('Error leaving Agora channel:', error);
    }
  };

  // Initialize signaling service
  useEffect(() => {
    if (!supabase) return;
    
    const init = async () => {
      // Try to get user, with retry for auth state
      let user = null;
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      user = data?.user;
      
      // If no user, listen for auth state changes
      if (!user) {
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user && !userId) {
            setUserId(session.user.id);
            await signalingService.initialize(session.user.id);
          }
        });
        return () => subscription.unsubscribe();
      }
      
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
          if (!supabase) return;
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

        signalingService.onCallAnswered = async () => {
          setCallState('connecting');
          
          // Join Agora channel for voice
          const callId = signalingService.getCurrentCallId();
          if (callId) {
            const joined = await joinAgoraChannel(callId);
            if (joined) {
              setCallState('connected');
              // Start duration timer
              durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
              }, 1000);
            } else {
              Alert.alert('Error', 'Failed to establish voice connection');
              cleanup();
            }
          }
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
      agoraService.destroy();
      cleanup();
    };
  }, []);

  const cleanup = useCallback(async () => {
    // Stop vibration
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    // Leave Agora channel
    await agoraService.leaveChannel();

    setCallState('idle');
    setCurrentCall(null);
    setRemoteParticipant(null);
    setIsIncomingCall(false);
    setCallDuration(0);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsAgoraConnected(false);
    setIsGroupVoiceSession(false);

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
      if (!supabase) return;
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
        
        // Pre-join Agora channel (caller joins first)
        const joined = await joinAgoraChannel(call.id);
        if (!joined) {
          console.warn('Failed to pre-join Agora channel');
        }
        
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

  const joinGroupVoiceChannel = useCallback(async (
    channelName: string,
    displayName: string
  ): Promise<void> => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in to join voice');
      return;
    }
    if (!channelName.trim()) {
      Alert.alert('Error', 'Invalid group call channel');
      return;
    }
    try {
      setRemoteParticipant({
        userId: `group:${channelName}`,
        name: displayName || 'Mission Control',
        role: 'personnel',
      });
      setIsIncomingCall(false);
      setCallState('connecting');
      setIsGroupVoiceSession(true);
      const joined = await joinAgoraChannelByName(channelName);
      if (!joined) {
        Alert.alert('Error', 'Failed to join group voice channel');
        cleanup();
        return;
      }
      setCallState('connected');
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to join group voice channel:', error);
      cleanup();
      Alert.alert('Error', 'Failed to join group voice channel');
    }
  }, [userId, cleanup]);

  const answerCall = useCallback(async (): Promise<void> => {
    if (!currentCall) return;

    try {
      // Stop vibration
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }

      setIsIncomingCall(false);
      setCallState('connecting');

      // Join Agora channel for voice
      const joined = await joinAgoraChannel(currentCall.id);
      if (!joined) {
        Alert.alert('Error', 'Failed to establish voice connection');
        cleanup();
        return;
      }

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
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    // Actually mute/unmute the audio via Agora
    agoraService.setMuted(newMuted);
  }, [isMuted]);

  const toggleSpeaker = useCallback(() => {
    const newSpeaker = !isSpeakerOn;
    setIsSpeakerOn(newSpeaker);
    // Toggle speakerphone via Agora
    agoraService.setSpeakerphone(newSpeaker);
  }, [isSpeakerOn]);

  const value: CallContextValue = {
    callState,
    currentCall,
    remoteParticipant,
    isMuted,
    isSpeakerOn,
    isIncomingCall,
    callDuration,
    isAgoraConnected,
    initiateCall,
    joinGroupVoiceChannel,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
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
