/**
 * WebRTC Call Service
 * Handles peer-to-peer audio connections
 */

export type CallState = 
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed';

export interface CallParticipant {
  userId: string;
  name: string;
  role: 'venue' | 'agency' | 'personnel';
  avatarUrl?: string;
}

export interface CallConfig {
  iceServers?: RTCIceServer[];
  audio?: boolean;
  video?: boolean;
}

// Default ICE servers (STUN only - free)
// For production, add TURN servers for NAT traversal
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: CallConfig;
  
  // Callbacks
  private onStateChange?: (state: CallState) => void;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onIceCandidate?: (candidate: RTCIceCandidate) => void;
  private onError?: (error: Error) => void;

  constructor(config: CallConfig = {}) {
    this.config = {
      iceServers: config.iceServers || DEFAULT_ICE_SERVERS,
      audio: config.audio ?? true,
      video: config.video ?? false,
    };
  }

  /**
   * Set event handlers
   */
  setHandlers(handlers: {
    onStateChange?: (state: CallState) => void;
    onRemoteStream?: (stream: MediaStream) => void;
    onIceCandidate?: (candidate: RTCIceCandidate) => void;
    onError?: (error: Error) => void;
  }) {
    this.onStateChange = handlers.onStateChange;
    this.onRemoteStream = handlers.onRemoteStream;
    this.onIceCandidate = handlers.onIceCandidate;
    this.onError = handlers.onError;
  }

  /**
   * Request microphone permission and get local audio stream
   */
  async requestAudioPermission(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audio,
        video: this.config.video,
      });
      return true;
    } catch (error) {
      console.error('Failed to get audio permission:', error);
      this.onError?.(error as Error);
      return false;
    }
  }

  /**
   * Initialize peer connection
   */
  private initPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    // Add local tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStream?.(this.remoteStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connecting':
          this.onStateChange?.('connecting');
          break;
        case 'connected':
          this.onStateChange?.('connected');
          break;
        case 'disconnected':
        case 'closed':
          this.onStateChange?.('ended');
          break;
        case 'failed':
          this.onStateChange?.('failed');
          break;
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    return pc;
  }

  /**
   * Create an offer (caller initiates)
   */
  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    try {
      // Get audio permission first
      const hasPermission = await this.requestAudioPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      this.peerConnection = this.initPeerConnection();
      this.onStateChange?.('calling');

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      this.onError?.(error as Error);
      return null;
    }
  }

  /**
   * Handle incoming offer (receiver)
   * Supports both WebRTC offers and mobile signaling-only calls
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    try {
      // Check if this is a mobile signaling-only call (no real SDP)
      const isMobileCall = (offer as any)?.type === 'mobile_call' || 
                           !offer?.type || 
                           !['offer', 'answer', 'pranswer', 'rollback'].includes(offer.type);
      
      if (isMobileCall) {
        // Mobile call - skip WebRTC, go straight to connected
        console.log('Mobile call detected - using signaling-only mode');
        this.onStateChange?.('connected');
        return { type: 'answer', sdp: 'mobile_answer' } as RTCSessionDescriptionInit;
      }

      // Full WebRTC call
      const hasPermission = await this.requestAudioPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      this.peerConnection = this.initPeerConnection();
      this.onStateChange?.('ringing');

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.onStateChange?.('connecting');
      return answer;
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.onError?.(error as Error);
      return null;
    }
  }

  /**
   * Handle answer (caller receives)
   * Supports both WebRTC answers and mobile signaling-only answers
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      // Check if this is a mobile signaling-only answer
      const isMobileAnswer = answer?.sdp === 'mobile_answer' || 
                             !answer?.sdp ||
                             !this.peerConnection;
      
      if (isMobileAnswer) {
        console.log('Mobile answer detected - signaling-only mode');
        this.onStateChange?.('connected');
        return;
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.onStateChange?.('connecting');
    } catch (error) {
      console.error('Failed to handle answer:', error);
      this.onError?.(error as Error);
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        console.warn('No peer connection for ICE candidate');
        return;
      }

      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  /**
   * Mute/unmute local audio
   */
  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Check if currently muted
   */
  isMuted(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? !audioTrack.enabled : true;
    }
    return true;
  }

  /**
   * End the call and cleanup
   */
  endCall(): void {
    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.onStateChange?.('ended');
  }

  /**
   * Get local stream for preview
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Check if call is active
   */
  isActive(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }
}

// Singleton instance for global use
let callServiceInstance: CallService | null = null;

export function getCallService(): CallService {
  if (!callServiceInstance) {
    callServiceInstance = new CallService();
  }
  return callServiceInstance;
}

export function resetCallService(): void {
  if (callServiceInstance) {
    callServiceInstance.endCall();
    callServiceInstance = null;
  }
}
