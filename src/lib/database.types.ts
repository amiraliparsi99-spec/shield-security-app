// Shield App Database Types
// Auto-generated from Supabase schema

export type UserRole = 'venue' | 'personnel' | 'agency' | 'admin';
export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type ShiftStatus = 'pending' | 'accepted' | 'declined' | 'checked_in' | 'checked_out' | 'no_show' | 'cancelled';
export type DocumentType = 'sia_license' | 'dbs_certificate' | 'first_aid' | 'training' | 'insurance' | 'id' | 'other';
export type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export type IncidentType = 'ejection' | 'medical' | 'theft' | 'assault' | 'disturbance' | 'other';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType = 'booking' | 'shift' | 'payment' | 'message' | 'verification' | 'system';
export type CallStatus = 'ringing' | 'connected' | 'ended' | 'missed' | 'declined' | 'failed';
export type CallSignalType = 'offer' | 'answer' | 'ice_candidate' | 'hangup' | 'reject';
export type DevicePlatform = 'web' | 'ios' | 'android';
export type NotificationLogStatus = 'pending' | 'sent' | 'delivered' | 'failed';

// =====================================================
// TABLE TYPES
// =====================================================

export interface Profile {
  id: string;
  role: UserRole;
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
  is_verified: boolean;
  is_active: boolean;
}

export interface Venue {
  id: string;
  user_id: string;
  owner_id?: string; // Some schemas use owner_id instead of user_id
  name: string;
  type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  capacity: number | null;
  logo_url: string | null;
  cover_image_url: string | null;
  operating_hours: Record<string, { open: string; close: string }> | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Personnel {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  city: string;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  hourly_rate: number;
  experience_years: number;
  skills: string[];
  
  // Shield Score
  shield_score: number;
  reliability_score: number;
  review_score: number;
  total_shifts: number;
  total_hours: number;
  
  // Verification
  sia_license_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean;
  dbs_verified: boolean;
  right_to_work_verified: boolean;
  
  // Preferences
  max_travel_distance: number;
  night_shifts_ok: boolean;
  weekend_only: boolean;
  
  // Standby / Dispatcher
  is_standby: boolean;
  
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_available: boolean;
}

export interface Agency {
  id: string;
  user_id: string;
  name: string;
  registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  total_staff: number;
  total_clients: number;
  average_rating: number;
  default_commission_rate: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface AgencyStaff {
  id: string;
  agency_id: string;
  personnel_id: string;
  commission_rate: number | null;
  joined_at: string;
  is_active: boolean;
}

export interface Availability {
  id: string;
  personnel_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  personnel_id: string;
  date: string;
  reason: string | null;
  created_at: string;
}

export interface SpecialAvailability {
  id: string;
  personnel_id: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  created_at: string;
}

export interface StaffRequirement {
  role: string;
  quantity: number;
  rate: number;
}

export interface Booking {
  id: string;
  venue_id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  brief_notes: string | null;
  staff_requirements: StaffRequirement[];
  status: BookingStatus;
  estimated_total: number | null;
  final_total: number | null;
  platform_fee: number | null;
  auto_assign: boolean;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface Shift {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  agency_id: string | null;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  status: ShiftStatus;
  hours_worked: number | null;
  total_pay: number | null;
  agency_commission: number | null;
  platform_fee: number | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: 'venue' | 'personnel' | 'agency' | null;
  no_show_at: string | null;
  no_show_notes: string | null;
  
  // Dispatcher / Urgent replacement
  is_urgent: boolean;
  surge_rate: number | null;
  original_personnel_id: string | null;
  dispatcher_status: 'none' | 'at_risk' | 'searching' | 'replacement_found' | 'failed' | null;
}

export interface Document {
  id: string;
  personnel_id: string;
  type: DocumentType;
  name: string;
  file_url: string;
  file_size: number | null;
  status: DocumentStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  expiry_date: string | null;
  expiry_reminder_sent: boolean;
  reference_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  shift_id: string | null;
  personnel_id: string;
  venue_id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  actions_taken: string;
  occurred_at: string;
  witness_count: number;
  police_involved: boolean;
  police_reference: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  shift_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_type: UserRole;
  overall_rating: number;
  professionalism_rating: number | null;
  punctuality_rating: number | null;
  communication_rating: number | null;
  comment: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreferredStaff {
  id: string;
  venue_id: string;
  personnel_id: string;
  note: string | null;
  created_at: string;
}

export interface BlockedStaff {
  id: string;
  venue_id: string;
  personnel_id: string;
  reason: string | null;
  created_at: string;
}

export interface EventTemplate {
  id: string;
  venue_id: string;
  name: string;
  staff_requirements: StaffRequirement[];
  brief_notes: string | null;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  booking_id?: string | null;
  last_message_at?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// =====================================================
// JOINED / EXTENDED TYPES
// =====================================================

export interface PersonnelWithProfile extends Personnel {
  profile: Profile;
}

export interface VenueWithProfile extends Venue {
  profile: Profile;
}

export interface AgencyWithProfile extends Agency {
  profile: Profile;
}

export interface ShiftWithDetails extends Shift {
  booking: Booking;
  personnel: Personnel | null;
  venue: Venue;
}

export interface BookingWithVenue extends Booking {
  venue: Venue;
}

export interface BookingWithShifts extends Booking {
  shifts: Shift[];
  venue: Venue;
}

export interface PersonnelWithAvailability extends Personnel {
  availability: Availability[];
  blocked_dates: BlockedDate[];
  special_availability: SpecialAvailability[];
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  participant1: Profile;
  participant2: Profile;
}

// =====================================================
// CALLING SYSTEM
// =====================================================

export interface Call {
  id: string;
  caller_user_id: string;
  receiver_user_id: string;
  caller_role: UserRole;
  receiver_role: UserRole;
  status: CallStatus;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  booking_id: string | null;
  shift_id: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallSignal {
  id: string;
  call_id: string;
  from_user_id: string;
  to_user_id: string;
  signal_type: CallSignalType;
  signal_data: Record<string, any>;
  processed: boolean;
  created_at: string;
}

export interface CallWithParticipants extends Call {
  caller?: Profile;
  receiver?: Profile;
}

// =====================================================
// PUSH NOTIFICATIONS
// =====================================================

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  device_name: string | null;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  notification_type: string;
  related_id: string | null;
  status: NotificationLogStatus;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

// =====================================================
// INSERT TYPES (for creating new records)
// =====================================================

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at' | 'last_active_at'>;
export type VenueInsert = Omit<Venue, 'id' | 'created_at' | 'updated_at'>;
export type PersonnelInsert = Omit<Personnel, 'id' | 'created_at' | 'updated_at' | 'shield_score' | 'reliability_score' | 'review_score' | 'total_shifts' | 'total_hours'>;
export type AgencyInsert = Omit<Agency, 'id' | 'created_at' | 'updated_at' | 'total_staff' | 'total_clients' | 'average_rating'>;
export type BookingInsert = Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'confirmed_at' | 'completed_at' | 'cancelled_at'>;
export type ShiftInsert = Omit<Shift, 'id' | 'created_at' | 'updated_at' | 'accepted_at' | 'declined_at'>;
export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'verified_at' | 'verified_by'>;
export type IncidentInsert = Omit<Incident, 'id' | 'created_at' | 'updated_at' | 'acknowledged_at' | 'acknowledged_by'>;
export type ReviewInsert = Omit<Review, 'id' | 'created_at' | 'updated_at'>;
export type MessageInsert = Omit<Message, 'id' | 'created_at' | 'read_at'>;
export type NotificationInsert = Omit<Notification, 'id' | 'created_at' | 'read_at'>;
export type CallInsert = Omit<Call, 'id' | 'created_at' | 'updated_at' | 'answered_at' | 'ended_at' | 'duration_seconds'>;
export type CallSignalInsert = Omit<CallSignal, 'id' | 'created_at' | 'processed'>;

// =====================================================
// UPDATE TYPES (for partial updates)
// =====================================================

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;
export type VenueUpdate = Partial<Omit<Venue, 'id' | 'user_id' | 'created_at'>>;
export type PersonnelUpdate = Partial<Omit<Personnel, 'id' | 'user_id' | 'created_at'>>;
export type AgencyUpdate = Partial<Omit<Agency, 'id' | 'user_id' | 'created_at'>>;
export type BookingUpdate = Partial<Omit<Booking, 'id' | 'venue_id' | 'created_at'>>;
export type ShiftUpdate = Partial<Omit<Shift, 'id' | 'booking_id' | 'created_at'>>;

// =====================================================
// DATABASE TYPE (for Supabase client)
// =====================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      venues: {
        Row: Venue;
        Insert: VenueInsert;
        Update: VenueUpdate;
      };
      personnel: {
        Row: Personnel;
        Insert: PersonnelInsert;
        Update: PersonnelUpdate;
      };
      agencies: {
        Row: Agency;
        Insert: AgencyInsert;
        Update: AgencyUpdate;
      };
      agency_staff: {
        Row: AgencyStaff;
        Insert: Omit<AgencyStaff, 'id' | 'joined_at'>;
        Update: Partial<AgencyStaff>;
      };
      availability: {
        Row: Availability;
        Insert: Omit<Availability, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Availability>;
      };
      blocked_dates: {
        Row: BlockedDate;
        Insert: Omit<BlockedDate, 'id' | 'created_at'>;
        Update: Partial<BlockedDate>;
      };
      special_availability: {
        Row: SpecialAvailability;
        Insert: Omit<SpecialAvailability, 'id' | 'created_at'>;
        Update: Partial<SpecialAvailability>;
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert;
        Update: BookingUpdate;
      };
      shifts: {
        Row: Shift;
        Insert: ShiftInsert;
        Update: ShiftUpdate;
      };
      documents: {
        Row: Document;
        Insert: DocumentInsert;
        Update: Partial<Document>;
      };
      incidents: {
        Row: Incident;
        Insert: IncidentInsert;
        Update: Partial<Incident>;
      };
      reviews: {
        Row: Review;
        Insert: ReviewInsert;
        Update: Partial<Review>;
      };
      preferred_staff: {
        Row: PreferredStaff;
        Insert: Omit<PreferredStaff, 'id' | 'created_at'>;
        Update: Partial<PreferredStaff>;
      };
      blocked_staff: {
        Row: BlockedStaff;
        Insert: Omit<BlockedStaff, 'id' | 'created_at'>;
        Update: Partial<BlockedStaff>;
      };
      event_templates: {
        Row: EventTemplate;
        Insert: Omit<EventTemplate, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<EventTemplate>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at'>;
        Update: Partial<Conversation>;
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: Partial<Message>;
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: Partial<Notification>;
      };
      calls: {
        Row: Call;
        Insert: CallInsert;
        Update: Partial<Call>;
      };
      call_signals: {
        Row: CallSignal;
        Insert: CallSignalInsert;
        Update: Partial<CallSignal>;
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      shift_status: ShiftStatus;
      document_type: DocumentType;
      document_status: DocumentStatus;
      incident_type: IncidentType;
      incident_severity: IncidentSeverity;
      notification_type: NotificationType;
      call_status: CallStatus;
      call_signal_type: CallSignalType;
    };
  };
}
