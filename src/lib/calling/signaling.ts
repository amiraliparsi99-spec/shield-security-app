/**
 * Signaling Service
 * Uses Supabase Realtime for WebRTC signaling
 */

import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Call, CallSignal, CallSignalType, UserRole } from '../database.types';

// Use any for Supabase client until types are regenerated with new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypedSupabaseClient = SupabaseClient<any>;

export interface SignalingHandlers {
  onIncomingCall?: (call: Call, offer: RTCSessionDescriptionInit) => void;
  onCallAnswered?: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onCallEnded?: (reason: string) => void;
  onCallRejected?: () => void;
  onError?: (error: Error) => void;
}

export class SignalingService {
  private supabase: TypedSupabaseClient;
  private userId: string;
  private channel: RealtimeChannel | null = null;
  private handlers: SignalingHandlers = {};
  private currentCallId: string | null = null;

  constructor(supabase: TypedSupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Set event handlers
   */
  setHandlers(handlers: SignalingHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Subscribe to incoming signals
   */
  async subscribe(): Promise<void> {
    // Subscribe to call_signals table for this user
    this.channel = this.supabase
      .channel(`call_signals:${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${this.userId}`,
        },
        async (payload) => {
          const signal = payload.new as CallSignal;
          await this.handleSignal(signal);
        }
      )
      .subscribe();
  }

  /**
   * Unsubscribe from signals
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /**
   * Handle incoming signal
   */
  private async handleSignal(signal: CallSignal): Promise<void> {
    // Mark signal as processed
    await this.supabase
      .from('call_signals')
      .update({ processed: true })
      .eq('id', signal.id);

    switch (signal.signal_type) {
      case 'offer':
        // Incoming call
        const { data: call } = await this.supabase
          .from('calls')
          .select('*')
          .eq('id', signal.call_id)
          .single();

        if (call) {
          this.currentCallId = call.id;
          this.handlers.onIncomingCall?.(call as Call, signal.signal_data as RTCSessionDescriptionInit);
        }
        break;

      case 'answer':
        this.handlers.onCallAnswered?.(signal.signal_data as RTCSessionDescriptionInit);
        break;

      case 'ice_candidate':
        this.handlers.onIceCandidate?.(signal.signal_data as RTCIceCandidateInit);
        break;

      case 'hangup':
        this.handlers.onCallEnded?.(signal.signal_data.reason || 'Call ended');
        break;

      case 'reject':
        this.handlers.onCallRejected?.();
        break;
    }
  }

  /**
   * Initiate a call
   */
  async initiateCall(
    receiverUserId: string,
    callerRole: UserRole,
    receiverRole: UserRole,
    offer: RTCSessionDescriptionInit,
    context?: { bookingId?: string; shiftId?: string }
  ): Promise<Call | null> {
    try {
      // Create call record
      const { data: call, error: callError } = await this.supabase
        .from('calls')
        .insert({
          caller_user_id: this.userId,
          receiver_user_id: receiverUserId,
          caller_role: callerRole,
          receiver_role: receiverRole,
          status: 'ringing',
          started_at: new Date().toISOString(),
          booking_id: context?.bookingId || null,
          shift_id: context?.shiftId || null,
        })
        .select()
        .single();

      if (callError || !call) {
        throw new Error(callError?.message || 'Failed to create call');
      }

      this.currentCallId = call.id;

      // Send offer signal
      await this.sendSignal(call.id, receiverUserId, 'offer', offer);

      return call as Call;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      this.handlers.onError?.(error as Error);
      return null;
    }
  }

  /**
   * Answer a call
   */
  async answerCall(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      // Get call details
      const { data: call } = await this.supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (!call) {
        throw new Error('Call not found');
      }

      // Update call status
      await this.supabase
        .from('calls')
        .update({
          status: 'connected',
          answered_at: new Date().toISOString(),
        })
        .eq('id', callId);

      this.currentCallId = callId;

      // Send answer signal to caller
      await this.sendSignal(callId, call.caller_user_id, 'answer', answer);
    } catch (error) {
      console.error('Failed to answer call:', error);
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * Reject a call
   */
  async rejectCall(callId: string): Promise<void> {
    try {
      const { data: call } = await this.supabase
        .from('calls')
        .select('caller_user_id')
        .eq('id', callId)
        .single();

      if (!call) return;

      // Update call status
      await this.supabase
        .from('calls')
        .update({
          status: 'declined',
          ended_at: new Date().toISOString(),
          end_reason: 'declined',
        })
        .eq('id', callId);

      // Send reject signal
      await this.sendSignal(callId, call.caller_user_id, 'reject', {});
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  }

  /**
   * End current call
   */
  async endCall(reason: string = 'completed'): Promise<void> {
    if (!this.currentCallId) return;

    try {
      // Get call details
      const { data: call } = await this.supabase
        .from('calls')
        .select('*')
        .eq('id', this.currentCallId)
        .single();

      if (!call) return;

      // Calculate duration
      const startedAt = call.answered_at || call.started_at;
      const duration = startedAt
        ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
        : 0;

      // Update call record
      await this.supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
          end_reason: reason,
        })
        .eq('id', this.currentCallId);

      // Notify the other party
      const otherUserId = call.caller_user_id === this.userId
        ? call.receiver_user_id
        : call.caller_user_id;

      await this.sendSignal(this.currentCallId, otherUserId, 'hangup', { reason });

      this.currentCallId = null;
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  /**
   * Mark call as missed (timeout)
   */
  async markMissed(callId: string): Promise<void> {
    await this.supabase
      .from('calls')
      .update({
        status: 'missed',
        ended_at: new Date().toISOString(),
        end_reason: 'timeout',
      })
      .eq('id', callId);
  }

  /**
   * Send ICE candidate
   */
  async sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.currentCallId) return;

    try {
      const { data: call } = await this.supabase
        .from('calls')
        .select('caller_user_id, receiver_user_id')
        .eq('id', this.currentCallId)
        .single();

      if (!call) return;

      const otherUserId = call.caller_user_id === this.userId
        ? call.receiver_user_id
        : call.caller_user_id;

      await this.sendSignal(
        this.currentCallId,
        otherUserId,
        'ice_candidate',
        candidate.toJSON()
      );
    } catch (error) {
      console.error('Failed to send ICE candidate:', error);
    }
  }

  /**
   * Send a signal to another user
   */
  private async sendSignal(
    callId: string,
    toUserId: string,
    signalType: CallSignalType,
    signalData: any
  ): Promise<void> {
    await this.supabase.from('call_signals').insert({
      call_id: callId,
      from_user_id: this.userId,
      to_user_id: toUserId,
      signal_type: signalType,
      signal_data: signalData,
    });
  }

  /**
   * Get call history
   */
  async getCallHistory(limit: number = 20): Promise<Call[]> {
    const { data, error } = await this.supabase
      .from('calls')
      .select('*')
      .or(`caller_user_id.eq.${this.userId},receiver_user_id.eq.${this.userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get call history:', error);
      return [];
    }

    return (data as Call[]) || [];
  }

  /**
   * Get current call ID
   */
  getCurrentCallId(): string | null {
    return this.currentCallId;
  }
}
