-- Fix verification_status enum casting in trigger functions
-- This migration fixes the "column status is of type verification_status but expression is of type text" error

-- Fix create_verification_record function
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

-- Fix update_verification_status function
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
    and vd.status = 'verified'::verification_status;
  
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
    and vd.status = 'verified'::verification_status;
  
  -- Update verification status (cast CASE result to enum)
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
