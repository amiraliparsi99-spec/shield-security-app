-- KYC/Verification System for Security Personnel and Agencies
-- This migration adds comprehensive verification capabilities

-- Verification Status Enum
create type verification_status as enum (
  'pending',      -- Submitted, awaiting review
  'in_review',    -- Under review by admin/automated system
  'verified',     -- Approved and verified
  'rejected',     -- Rejected (with reason)
  'expired',      -- Verification expired (needs renewal)
  'suspended'     -- Temporarily suspended
);

-- Document Types for Personnel
create type personnel_document_type as enum (
  'sia_license',           -- SIA Door Supervisor/Guard License
  'sia_cctv',              -- SIA CCTV License
  'sia_cp',                -- SIA Close Protection
  'dbs_check',             -- DBS (Disclosure and Barring Service) certificate
  'right_to_work',         -- Right to work document (passport, visa, etc.)
  'first_aid',             -- First Aid certificate
  'insurance',             -- Public liability insurance
  'identity',              -- Government ID (passport, driving license)
  'address_proof',         -- Utility bill, bank statement
  'other'                  -- Other certifications
);

-- Document Types for Agencies
create type agency_document_type as enum (
  'company_registration',   -- Companies House registration
  'sia_license',            -- SIA Approved Contractor Scheme (ACS)
  'insurance',             -- Public liability insurance
  'employers_liability',    -- Employers' liability insurance
  'vat_registration',      -- VAT registration certificate
  'identity',               -- Director/owner ID
  'address_proof',         -- Business address proof
  'other'                   -- Other business documents
);

-- Verification Documents Table
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  
  -- Owner: either personnel or agency
  owner_type text not null check (owner_type in ('personnel', 'agency')),
  owner_id uuid not null,
  
  -- Document details
  document_type text not null, -- Will be personnel_document_type or agency_document_type based on owner_type
  document_name text not null,
  file_url text not null, -- Supabase Storage URL
  file_size bigint, -- in bytes
  mime_type text,
  
  -- Verification metadata
  status verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id), -- Admin who verified
  rejection_reason text, -- If rejected, why?
  expires_at timestamptz, -- For licenses/certificates with expiry dates
  
  -- Additional metadata
  metadata jsonb default '{}', -- Store additional info like license number, issue date, etc.
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure one document per type per owner (can be updated)
  unique(owner_type, owner_id, document_type)
);

-- Overall Verification Status Table
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  
  -- Owner: either personnel or agency
  owner_type text not null check (owner_type in ('personnel', 'agency')),
  owner_id uuid not null unique, -- One verification record per personnel/agency
  
  -- Overall status
  status verification_status not null default 'pending',
  
  -- Verification levels (tiered system)
  identity_verified boolean not null default false,
  documents_verified boolean not null default false,
  background_checked boolean not null default false,
  insurance_verified boolean not null default false,
  certifications_verified boolean not null default false,
  
  -- Verification details
  verified_at timestamptz,
  verified_by uuid references public.profiles (id), -- Admin who verified
  rejection_reason text,
  last_reviewed_at timestamptz,
  
  -- Automated checks (if using third-party services)
  automated_check_status text, -- 'pending', 'passed', 'failed', 'error'
  automated_check_data jsonb, -- Store results from third-party verification
  
  -- Notes
  admin_notes text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Verification Requirements Checklist (what's needed for each type)
create table public.verification_requirements (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('personnel', 'agency')),
  document_type text not null,
  is_required boolean not null default true,
  is_mandatory boolean not null default false, -- Cannot be verified without this
  priority int not null default 0, -- Order of importance
  description text,
  help_text text, -- Guidance for users
  created_at timestamptz not null default now()
);

-- Insert default requirements for Personnel
insert into public.verification_requirements (owner_type, document_type, is_required, is_mandatory, priority, description, help_text) values
  ('personnel', 'identity', true, true, 1, 'Government-issued photo ID', 'Passport, driving license, or national ID card'),
  ('personnel', 'right_to_work', true, true, 2, 'Right to work in the UK', 'Passport, visa, or other right to work document'),
  ('personnel', 'sia_license', true, true, 3, 'SIA License (Door Supervisor or Security Guard)', 'Valid SIA license number. Required for most security work in the UK.'),
  ('personnel', 'dbs_check', true, false, 4, 'DBS Check (Enhanced)', 'Enhanced DBS certificate. Some venues require this.'),
  ('personnel', 'first_aid', false, false, 5, 'First Aid Certificate', 'First Aid at Work or Emergency First Aid certificate'),
  ('personnel', 'insurance', false, false, 6, 'Public Liability Insurance', 'Personal public liability insurance (if not covered by agency)'),
  ('personnel', 'address_proof', true, false, 7, 'Proof of Address', 'Utility bill or bank statement from last 3 months');

-- Insert default requirements for Agencies
insert into public.verification_requirements (owner_type, document_type, is_required, is_mandatory, priority, description, help_text) values
  ('agency', 'company_registration', true, true, 1, 'Companies House Registration', 'Certificate of incorporation from Companies House'),
  ('agency', 'sia_license', true, true, 2, 'SIA Approved Contractor Scheme (ACS)', 'SIA ACS license. Required for agencies providing security services.'),
  ('agency', 'insurance', true, true, 3, 'Public Liability Insurance', 'Minimum £5M public liability insurance'),
  ('agency', 'employers_liability', true, true, 4, 'Employers Liability Insurance', 'Required by law if you employ staff'),
  ('agency', 'vat_registration', false, false, 5, 'VAT Registration', 'VAT registration certificate (if applicable)'),
  ('agency', 'identity', true, false, 6, 'Director/Owner ID', 'ID of company director or owner'),
  ('agency', 'address_proof', true, false, 7, 'Business Address Proof', 'Proof of registered business address');

-- Indexes
create index idx_verification_documents_owner on public.verification_documents (owner_type, owner_id);
create index idx_verification_documents_status on public.verification_documents (status);
create index idx_verification_documents_type on public.verification_documents (document_type);

create index idx_verifications_owner on public.verifications (owner_type, owner_id);
create index idx_verifications_status on public.verifications (status);

create index idx_verification_requirements_type on public.verification_requirements (owner_type);

-- RLS Policies
alter table public.verification_documents enable row level security;
alter table public.verifications enable row level security;
alter table public.verification_requirements enable row level security;

-- Documents: Users can view their own, admins can view all
create policy "Users can view own documents" on public.verification_documents
  for select using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid()))
  );

create policy "Users can insert own documents" on public.verification_documents
  for insert with check (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid()))
  );

create policy "Users can update own documents" on public.verification_documents
  for update using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid()))
  );

-- Verifications: Users can view their own, admins can view all
create policy "Users can view own verification" on public.verifications
  for select using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid()))
  );

-- Requirements: Public read
create policy "Requirements are viewable by all" on public.verification_requirements
  for select using (true);

-- Update personnel and agencies tables to reference verification status
alter table public.personnel
  add column if not exists verification_status verification_status default 'pending',
  add column if not exists verification_id uuid references public.verifications (id);

alter table public.agencies
  add column if not exists verification_status verification_status default 'pending',
  add column if not exists verification_id uuid references public.verifications (id);

-- Function to auto-create verification record when personnel/agency is created
create or replace function create_verification_record()
returns trigger as $$
begin
  insert into public.verifications (owner_type, owner_id, status)
  values (TG_ARGV[0], NEW.id, 'pending'::verification_status)
  on conflict (owner_id) do nothing;
  
  -- Link the verification
  if TG_ARGV[0] = 'personnel' then
    update public.personnel
    set verification_id = (select id from public.verifications where owner_id = NEW.id and owner_type = 'personnel')
    where id = NEW.id;
  elsif TG_ARGV[0] = 'agency' then
    update public.agencies
    set verification_id = (select id from public.verifications where owner_id = NEW.id and owner_type = 'agency')
    where id = NEW.id;
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Triggers to auto-create verification records
create trigger create_personnel_verification
  after insert on public.personnel
  for each row
  execute function create_verification_record('personnel');

create trigger create_agency_verification
  after insert on public.agencies
  for each row
  execute function create_verification_record('agency');

-- Function to update verification status based on documents
create or replace function update_verification_status()
returns trigger as $$
declare
  v_owner_type text;
  v_owner_id uuid;
  v_required_count int;
  v_verified_count int;
  v_mandatory_count int;
  v_mandatory_verified_count int;
begin
  v_owner_type := NEW.owner_type;
  v_owner_id := NEW.owner_id;
  
  -- Count required documents
  select count(*)
  into v_required_count
  from public.verification_requirements
  where owner_type = v_owner_type and is_required = true;
  
  -- Count verified required documents
  select count(*)
  into v_verified_count
  from public.verification_documents vd
  join public.verification_requirements vr on vr.document_type = vd.document_type and vr.owner_type = vd.owner_type
  where vd.owner_type = v_owner_type
    and vd.owner_id = v_owner_id
    and vr.is_required = true
    and vd.status = 'verified';
  
  -- Count mandatory documents
  select count(*)
  into v_mandatory_count
  from public.verification_requirements
  where owner_type = v_owner_type and is_mandatory = true;
  
  -- Count verified mandatory documents
  select count(*)
  into v_mandatory_verified_count
  from public.verification_documents vd
  join public.verification_requirements vr on vr.document_type = vd.document_type and vr.owner_type = vd.owner_type
  where vd.owner_type = v_owner_type
    and vd.owner_id = v_owner_id
    and vr.is_mandatory = true
    and vd.status = 'verified';
  
  -- Update verification status
  update public.verifications
  set 
    documents_verified = (v_verified_count >= v_required_count),
    status = (case
      when v_mandatory_verified_count < v_mandatory_count then 'pending'
      when v_verified_count >= v_required_count then 'in_review'
      else 'pending'
    end)::verification_status,
    updated_at = now()
  where owner_type = v_owner_type and owner_id = v_owner_id;
  
  return NEW;
end;
$$ language plpgsql;

-- Trigger to update verification status when documents change
create trigger update_verification_on_document_change
  after insert or update on public.verification_documents
  for each row
  execute function update_verification_status();

-- Comments
comment on table public.verification_documents is 'Uploaded documents for KYC verification';
comment on table public.verifications is 'Overall verification status for personnel and agencies';
comment on table public.verification_requirements is 'Required documents checklist for each entity type';
