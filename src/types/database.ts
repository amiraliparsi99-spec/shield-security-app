/**
 * Shield — database types
 * Mirrors Supabase schema. Keep in sync with supabase/migrations.
 */

export type UserRole = "venue" | "personnel" | "agency" | "admin";

// ——— Users (extends Supabase auth.users; we use public.profiles)
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// ——— Venues
export interface Venue {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  venue_type: VenueType;
  address: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  description: string | null;
  capacity: number | null;
  compliance_tags: string[]; // e.g. ["alcohol", "events", "corporate"]
  created_at: string;
  updated_at: string;
}

export type VenueType =
  | "club"
  | "bar"
  | "stadium"
  | "event_space"
  | "restaurant"
  | "corporate"
  | "retail"
  | "other";

// ——— Security Personnel (individuals)
export interface Personnel {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  certs: string[]; // e.g. ["SIA", "First Aid", "CCTV"]
  experience_years: number | null;
  experience_since_year: number | null; // e.g. 2018 — "In security since 2018"
  rate_per_hour: number | null; // in minor units if needed
  currency: string;
  city: string | null;
  region: string | null;
  country: string;
  location_name: string | null; // display: "Central London, UK" — overrides city+region when set
  lat: number | null;
  lng: number | null;
  status: PersonnelStatus;
  insurance_verified: boolean;
  created_at: string;
  updated_at: string;
}

export type PersonnelStatus = "available" | "looking" | "booked" | "off";

// ——— Reviews (venues review personnel after a booking)
export interface PersonnelReview {
  id: string;
  personnel_id: string;
  author_id: string; // profile id of the venue owner who wrote it
  booking_id: string | null;
  rating: number; // 1–5
  comment: string | null;
  created_at: string;
}

// For display: review with author/venue context
export interface PersonnelReviewWithAuthor extends PersonnelReview {
  author_name: string | null;
  venue_name?: string | null;
}

// ——— Agencies (teams of guards)
export interface Agency {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  certs: string[];
  rate_per_hour: number | null;
  currency: string;
  city: string | null;
  region: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  status: "available" | "looking" | "booked" | "off";
  insurance_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ——— Availability (personnel or agency)
export interface Availability {
  id: string;
  owner_type: "personnel" | "agency";
  owner_id: string;
  start: string; // ISO
  end: string;
  recurring: "none" | "weekly" | "monthly" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ——— Request (venue posts “we need people”)
export interface Request {
  id: string;
  venue_id: string;
  title: string;
  start: string;
  end: string;
  guards_count: number;
  certs_required: string[];
  rate_offered: number | null;
  currency: string;
  description: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export type RequestStatus = "open" | "filled" | "cancelled";

// ——— Booking (confirmed shift)
export interface Booking {
  id: string;
  request_id: string;
  venue_id: string;
  provider_type: "personnel" | "agency";
  provider_id: string;
  start: string;
  end: string;
  guards_count: number;
  rate: number;
  currency: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

// ——— Verification System
export type VerificationStatus = "pending" | "in_review" | "verified" | "rejected" | "expired" | "suspended";

export type PersonnelDocumentType =
  | "sia_license"
  | "sia_cctv"
  | "sia_cp"
  | "dbs_check"
  | "right_to_work"
  | "first_aid"
  | "insurance"
  | "identity"
  | "address_proof"
  | "other";

export type AgencyDocumentType =
  | "company_registration"
  | "sia_license"
  | "insurance"
  | "employers_liability"
  | "vat_registration"
  | "identity"
  | "address_proof"
  | "other";

export interface VerificationDocument {
  id: string;
  owner_type: "personnel" | "agency";
  owner_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  status: VerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  owner_type: "personnel" | "agency";
  owner_id: string;
  status: VerificationStatus;
  identity_verified: boolean;
  documents_verified: boolean;
  background_checked: boolean;
  insurance_verified: boolean;
  certifications_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  last_reviewed_at: string | null;
  automated_check_status: string | null;
  automated_check_data: Record<string, any> | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationRequirement {
  id: string;
  owner_type: "personnel" | "agency";
  document_type: string;
  is_required: boolean;
  is_mandatory: boolean;
  priority: number;
  description: string | null;
  help_text: string | null;
  created_at: string;
}

// ——— Agency CRM: Staff Management
export type AgencyStaffRole = "employee" | "contractor" | "manager";
export type AgencyStaffStatus = "pending" | "active" | "inactive" | "suspended";

export interface AgencyStaff {
  id: string;
  agency_id: string;
  personnel_id: string;
  role: AgencyStaffRole;
  status: AgencyStaffStatus;
  hourly_rate: number | null; // Agency-specific rate override
  notes: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

// Extended type with personnel details for display
export interface AgencyStaffWithPersonnel extends AgencyStaff {
  personnel: Personnel;
}

// ——— Agency CRM: Booking Assignments
export type BookingAssignmentStatus = "assigned" | "confirmed" | "declined" | "completed" | "no_show";

export interface BookingAssignment {
  id: string;
  booking_id: string;
  agency_staff_id: string;
  status: BookingAssignmentStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Extended type with staff and booking details
export interface BookingAssignmentWithDetails extends BookingAssignment {
  agency_staff: AgencyStaffWithPersonnel;
  booking: Booking;
}

// ——— GPS Tracking
export interface StaffLocation {
  id: string;
  agency_staff_id: string;
  booking_assignment_id: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
  created_at: string;
}

export interface StaffLocationWithDetails extends StaffLocation {
  agency_staff: AgencyStaffWithPersonnel;
}

export interface Geofence {
  id: string;
  venue_id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationConsent {
  id: string;
  personnel_id: string;
  agency_id: string;
  consented: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GeofenceEventType = "enter" | "exit";

export interface GeofenceEvent {
  id: string;
  booking_assignment_id: string;
  geofence_id: string;
  event_type: GeofenceEventType;
  lat: number;
  lng: number;
  recorded_at: string;
  auto_action_taken: "check_in" | "check_out" | null;
  created_at: string;
}
