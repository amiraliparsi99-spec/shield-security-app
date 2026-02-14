/**
 * Mobile Calling Service
 * Handles call signaling via Supabase Realtime
 * Note: Full WebRTC requires expo-dev-client and react-native-webrtc
 */

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

export interface CallData {
  id: string;
  callerUserId: string;
  receiverUserId: string;
  callerRole: string;
  receiverRole: string;
  status: string;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

class MobileSignalingService {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private currentCallId: string | null = null;

  // Callbacks
  public onIncomingCall?: (call: CallData, callerName: string) => void;
  public onCallAnswered?: () => void;
  public onCallEnded?: (reason: string) => void;
  public onCallRejected?: () => void;

  async initialize(userId: string) {
    this.userId = userId;

    // Subscribe to call signals for this user
    this.channel = supabase
      .channel(`call_signals:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${userId}`,
        },
        async (payload) => {
          await this.handleSignal(payload.new as any);
        }
      )
      .subscribe();
  }

  async cleanup() {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private async handleSignal(signal: any) {
    // Mark signal as processed
    await supabase
      .from('call_signals')
      .update({ processed: true })
      .eq('id', signal.id);

    switch (signal.signal_type) {
      case 'offer':
        // Incoming call
        const { data: call } = await supabase
          .from('calls')
          .select('*')
          .eq('id', signal.call_id)
          .single();

        if (call) {
          // Get caller name
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', call.caller_user_id)
            .single();

          this.currentCallId = call.id;
          this.onIncomingCall?.(call as CallData, profile?.display_name || 'Unknown');
        }
        break;

      case 'answer':
        this.onCallAnswered?.();
        break;

      case 'hangup':
        this.onCallEnded?.(signal.signal_data?.reason || 'Call ended');
        break;

      case 'reject':
        this.onCallRejected?.();
        break;
    }
  }

  async initiateCall(
    receiverUserId: string,
    callerRole: string,
    receiverRole: string,
    context?: { bookingId?: string; shiftId?: string }
  ): Promise<CallData | null> {
    if (!this.userId) return null;

    try {
      // Create call record
      const { data: call, error } = await supabase
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

      if (error || !call) {
        throw new Error(error?.message || 'Failed to create call');
      }

      this.currentCallId = call.id;

      // Send offer signal (simplified for mobile - no WebRTC SDP yet)
      await this.sendSignal(call.id, receiverUserId, 'offer', { 
        type: 'mobile_call',
        callId: call.id 
      });

      return call as CallData;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      return null;
    }
  }

  async answerCall(callId: string): Promise<void> {
    try {
      const { data: call } = await supabase
        .from('calls')
        .select('caller_user_id')
        .eq('id', callId)
        .single();

      if (!call) return;

      // Update call status
      await supabase
        .from('calls')
        .update({
          status: 'connected',
          answered_at: new Date().toISOString(),
        })
        .eq('id', callId);

      this.currentCallId = callId;

      // Send answer signal
      await this.sendSignal(callId, call.caller_user_id, 'answer', { 
        type: 'mobile_answer' 
      });
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }

  async rejectCall(callId: string): Promise<void> {
    try {
      const { data: call } = await supabase
        .from('calls')
        .select('caller_user_id')
        .eq('id', callId)
        .single();

      if (!call) return;

      await supabase
        .from('calls')
        .update({
          status: 'declined',
          ended_at: new Date().toISOString(),
          end_reason: 'declined',
        })
        .eq('id', callId);

      await this.sendSignal(callId, call.caller_user_id, 'reject', {});
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  }

  async endCall(reason: string = 'completed'): Promise<void> {
    if (!this.currentCallId) return;

    try {
      const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('id', this.currentCallId)
        .single();

      if (!call) return;

      const startedAt = call.answered_at || call.started_at;
      const duration = startedAt
        ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
        : 0;

      await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
          end_reason: reason,
        })
        .eq('id', this.currentCallId);

      const otherUserId = call.caller_user_id === this.userId
        ? call.receiver_user_id
        : call.caller_user_id;

      await this.sendSignal(this.currentCallId, otherUserId, 'hangup', { reason });

      this.currentCallId = null;
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  private async sendSignal(
    callId: string,
    toUserId: string,
    signalType: string,
    signalData: any
  ): Promise<void> {
    if (!this.userId) return;

    await supabase.from('call_signals').insert({
      call_id: callId,
      from_user_id: this.userId,
      to_user_id: toUserId,
      signal_type: signalType,
      signal_data: signalData,
    });
  }

  getCurrentCallId(): string | null {
    return this.currentCallId;
  }
}

// Singleton instance
export const signalingService = new MobileSignalingService();

// Helper function to format call duration
export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
