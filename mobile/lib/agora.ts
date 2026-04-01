/**
 * Agora Voice Calling Service
 * Handles real-time voice communication using Agora SDK
 * 
 * NOTE: This requires a development build (not Expo Go) to work.
 * In Expo Go, calls will work but without actual voice audio.
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';

// Get App ID from environment
const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

// Check if we're in Expo Go (native modules won't be available)
let isAgoraAvailable = false;
let createAgoraRtcEngine: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;

// Try to import Agora - will fail in Expo Go
try {
  const agora = require('react-native-agora');
  createAgoraRtcEngine = agora.default;
  ChannelProfileType = agora.ChannelProfileType;
  ClientRoleType = agora.ClientRoleType;
  isAgoraAvailable = true;
  console.log('Agora SDK loaded successfully');
} catch (error) {
  console.log('Agora SDK not available (running in Expo Go) - voice calls will be simulated');
  isAgoraAvailable = false;
}

export interface AgoraCallbacks {
  onJoinSuccess?: (channel: string, uid: number) => void;
  onUserJoined?: (uid: number) => void;
  onUserOffline?: (uid: number) => void;
  onError?: (error: string) => void;
  onConnectionStateChanged?: (state: number) => void;
}

class AgoraService {
  private engine: any = null;
  private isInitialized = false;
  private currentChannel: string | null = null;
  private callbacks: AgoraCallbacks = {};
  private _isMuted = false;
  private _isSpeakerOn = false;

  /**
   * Check if Agora is available (development build)
   */
  isAvailable(): boolean {
    return isAgoraAvailable;
  }

  /**
   * Initialize the Agora engine
   */
  async initialize(): Promise<boolean> {
    // If Agora isn't available (Expo Go), return success but log warning
    if (!isAgoraAvailable) {
      console.log('Agora not available - running in simulation mode');
      this.isInitialized = true;
      return true;
    }

    if (this.isInitialized && this.engine) {
      return true;
    }

    if (!AGORA_APP_ID) {
      console.error('Agora App ID not configured');
      return false;
    }

    try {
      // Request microphone permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Shield needs access to your microphone for voice calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Microphone permission denied');
          return false;
        }
      }

      // Create engine
      this.engine = createAgoraRtcEngine();
      
      // Initialize with App ID
      this.engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Register event handlers
      this.engine.registerEventHandler(this.createEventHandler());

      // Enable audio
      this.engine.enableAudio();

      // Set audio profile for voice calls
      this.engine.setAudioProfile(0, 0); // Default profile

      this.isInitialized = true;
      console.log('Agora engine initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Agora:', error);
      return false;
    }
  }

  /**
   * Create event handler for Agora callbacks
   */
  private createEventHandler(): any {
    return {
      onJoinChannelSuccess: (connection: any, elapsed: number) => {
        console.log('Joined channel:', connection.channelId, 'UID:', connection.localUid);
        this.callbacks.onJoinSuccess?.(
          connection.channelId || '',
          connection.localUid || 0
        );
      },

      onUserJoined: (connection: any, remoteUid: number, elapsed: number) => {
        console.log('Remote user joined:', remoteUid);
        this.callbacks.onUserJoined?.(remoteUid);
      },

      onUserOffline: (connection: any, remoteUid: number, reason: number) => {
        console.log('Remote user offline:', remoteUid, 'reason:', reason);
        this.callbacks.onUserOffline?.(remoteUid);
      },

      onError: (err: number, msg: string) => {
        console.error('Agora error:', err, msg);
        this.callbacks.onError?.(`Error ${err}: ${msg}`);
      },

      onConnectionStateChanged: (
        connection: any,
        state: number,
        reason: number
      ) => {
        console.log('Connection state changed:', state, 'reason:', reason);
        this.callbacks.onConnectionStateChanged?.(state);
      },
    };
  }

  /**
   * Set callbacks for Agora events
   */
  setCallbacks(callbacks: AgoraCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Join a voice channel
   */
  async joinChannel(
    channelName: string,
    token: string,
    uid: number
  ): Promise<boolean> {
    // Simulation mode for Expo Go
    if (!isAgoraAvailable) {
      console.log('[Simulation] Joining channel:', channelName);
      this.currentChannel = channelName;
      // Simulate successful join after a short delay
      setTimeout(() => {
        this.callbacks.onJoinSuccess?.(channelName, uid);
      }, 500);
      return true;
    }

    if (!this.engine || !this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    try {
      this.currentChannel = channelName;

      // Join channel with token
      this.engine?.joinChannel(token, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });

      return true;
    } catch (error) {
      console.error('Failed to join channel:', error);
      return false;
    }
  }

  /**
   * Leave the current channel
   */
  async leaveChannel(): Promise<void> {
    // Simulation mode
    if (!isAgoraAvailable) {
      console.log('[Simulation] Leaving channel');
      this.currentChannel = null;
      return;
    }

    try {
      if (this.engine && this.currentChannel) {
        this.engine.leaveChannel();
        this.currentChannel = null;
        console.log('Left channel');
      }
    } catch (error) {
      console.error('Failed to leave channel:', error);
    }
  }

  /**
   * Mute/unmute local audio
   */
  setMuted(muted: boolean): void {
    this._isMuted = muted;
    
    // Simulation mode
    if (!isAgoraAvailable) {
      console.log('[Simulation] Muted:', muted);
      return;
    }

    try {
      this.engine?.muteLocalAudioStream(muted);
      console.log('Muted:', muted);
    } catch (error) {
      console.error('Failed to set mute:', error);
    }
  }

  /**
   * Enable/disable speakerphone
   */
  setSpeakerphone(enabled: boolean): void {
    this._isSpeakerOn = enabled;
    
    // Simulation mode
    if (!isAgoraAvailable) {
      console.log('[Simulation] Speakerphone:', enabled);
      return;
    }

    try {
      this.engine?.setEnableSpeakerphone(enabled);
      console.log('Speakerphone:', enabled);
    } catch (error) {
      console.error('Failed to set speakerphone:', error);
    }
  }

  /**
   * Get current mute state
   */
  isMuted(): boolean {
    return this._isMuted;
  }

  /**
   * Get current speaker state
   */
  isSpeakerOn(): boolean {
    return this._isSpeakerOn;
  }

  /**
   * Get current channel name
   */
  getCurrentChannel(): string | null {
    return this.currentChannel;
  }

  /**
   * Check if currently in a call
   */
  isInCall(): boolean {
    return this.currentChannel !== null;
  }

  /**
   * Destroy the engine and clean up
   */
  async destroy(): Promise<void> {
    // Simulation mode
    if (!isAgoraAvailable) {
      console.log('[Simulation] Destroying Agora service');
      this.currentChannel = null;
      this.isInitialized = false;
      return;
    }

    try {
      if (this.currentChannel) {
        await this.leaveChannel();
      }
      if (this.engine) {
        this.engine.unregisterEventHandler(this.createEventHandler());
        this.engine.release();
        this.engine = null;
      }
      this.isInitialized = false;
      console.log('Agora engine destroyed');
    } catch (error) {
      console.error('Failed to destroy Agora engine:', error);
    }
  }

  /**
   * Show alert if voice calling is not available
   */
  showUnavailableAlert(): void {
    if (!isAgoraAvailable) {
      Alert.alert(
        'Voice Calling Limited',
        'Real voice calling requires a development build. Currently running in simulation mode.\n\nTo enable voice calling, create a development build using EAS Build.',
        [{ text: 'OK' }]
      );
    }
  }
}

// Singleton instance
export const agoraService = new AgoraService();

/**
 * Generate a unique numeric UID from a string user ID
 * Agora requires numeric UIDs
 */
export function generateAgoraUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Ensure positive number and within Agora's UID range
  return Math.abs(hash) % 2147483647;
}

/**
 * Generate a channel name for a call between two users
 */
export function generateChannelName(callId: string): string {
  return `shield_call_${callId}`;
}
