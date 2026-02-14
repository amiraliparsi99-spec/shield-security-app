# KYC Verification System Guide

## Overview

The KYC (Know Your Customer) verification system ensures that all security personnel and agencies on the platform are properly certified, licensed, and verified before they can accept bookings. This is critical for maintaining trust and compliance in the security industry.

## Verification Tiers

### Tier 1: Basic Verification (Required to list on platform)
- Identity verification
- Right to work verification
- Basic profile completion

### Tier 2: Professional Verification (Required to accept bookings)
- SIA License verification (mandatory for UK)
- All mandatory documents verified
- Background check (DBS) - recommended

### Tier 3: Premium Verification (Enhanced trust)
- All documents verified
- Insurance verified
- Certifications verified
- Positive reviews

## For Security Personnel

### Required Documents (Mandatory)
1. **Identity Document** (Passport, Driving License, National ID)
   - Must be government-issued photo ID
   - Must be current and valid

2. **Right to Work** (Passport, Visa, BRP)
   - Required for all personnel working in the UK
   - Must be valid and not expired

3. **SIA License** (Door Supervisor or Security Guard)
   - **CRITICAL**: Required for most security work in the UK
   - Must be valid and not expired
   - License number must be verifiable with SIA database

### Recommended Documents
4. **DBS Check** (Enhanced Disclosure and Barring Service)
   - Required by many venues (especially working with vulnerable people)
   - Can be verified through DBS online service

5. **First Aid Certificate**
   - First Aid at Work or Emergency First Aid
   - Increases employability

6. **Public Liability Insurance**
   - If working independently (not through agency)
   - Minimum £1M recommended

### Verification Process
1. User uploads documents via secure file upload
2. Documents stored in Supabase Storage (encrypted)
3. Automated checks:
   - File type validation
   - Expiry date extraction (if applicable)
   - SIA license number validation (if API available)
4. Manual review by admin team:
   - Document authenticity
   - License validity
   - Photo matching
5. Status updated: `pending` → `in_review` → `verified` or `rejected`

## For Security Agencies

### Required Documents (Mandatory)
1. **Company Registration** (Companies House)
   - Certificate of Incorporation
   - Company number must be verifiable

2. **SIA Approved Contractor Scheme (ACS) License**
   - **CRITICAL**: Required for agencies providing security services
   - Must be valid and current
   - Verifiable with SIA ACS database

3. **Public Liability Insurance**
   - Minimum £5M coverage required
   - Must be current and valid

4. **Employers Liability Insurance**
   - Required by law if employing staff
   - Minimum £5M coverage

### Recommended Documents
5. **VAT Registration** (if applicable)
   - VAT registration certificate
   - VAT number

6. **Director/Owner ID**
   - ID of company director or owner
   - For identity verification

7. **Business Address Proof**
   - Proof of registered business address
   - Utility bill or bank statement

### Verification Process
1. Agency owner uploads business documents
2. Automated checks:
   - Companies House API verification (if available)
   - SIA ACS license validation
   - Insurance policy validation
3. Manual review:
   - Business legitimacy
   - License validity
   - Insurance coverage verification
4. Status updated accordingly

## Verification Status Flow

```
pending → in_review → verified
                ↓
           rejected (with reason)
                ↓
           resubmit → pending
```

### Status Meanings
- **pending**: Documents submitted, awaiting initial review
- **in_review**: Under active review by admin team
- **verified**: All checks passed, can accept bookings
- **rejected**: Documents rejected (user can resubmit)
- **expired**: Verification expired (needs renewal)
- **suspended**: Temporarily suspended (investigation)

## Implementation Recommendations

### 1. Document Upload System
- Use Supabase Storage with RLS policies
- Implement file type validation (PDF, JPG, PNG)
- File size limits (e.g., 10MB max)
- Virus scanning (optional but recommended)

### 2. Automated Verification
- **SIA License Check**: Integrate with SIA API (if available) or web scraping
- **Companies House API**: Verify company registration
- **DBS Online Service**: Verify DBS certificates
- **Expiry Monitoring**: Automated alerts for expiring documents

### 3. Manual Review Dashboard
- Admin interface to review pending documents
- Side-by-side document comparison
- Notes and rejection reasons
- Bulk approval/rejection

### 4. Third-Party Integration Options

#### Option A: Onfido (Recommended)
- **Identity verification**: Automated ID document verification
- **Right to work checks**: Automated verification
- **Background checks**: DBS and criminal record checks
- **Cost**: ~£1-5 per check
- **API**: Well-documented REST API

#### Option B: Veriff
- **Identity verification**: Strong document verification
- **Liveness checks**: Face matching
- **Cost**: Similar to Onfido
- **API**: Good developer experience

#### Option C: In-House Manual Review
- **Cost**: Lower (staff time)
- **Speed**: Slower (24-48 hours)
- **Control**: Full control over process
- **Scalability**: Limited by staff capacity

### 5. Verification Badges/UI
- Show verification status on profiles
- Badge system: "Verified", "Premium Verified", etc.
- Filter search by verification status
- Venues can require minimum verification level

### 6. Ongoing Monitoring
- **Expiry Alerts**: Email users 30 days before expiry
- **Periodic Re-verification**: Annual re-verification
- **Status Monitoring**: Monitor for license suspensions
- **Compliance Checks**: Regular compliance audits

## Security Best Practices

1. **Data Encryption**: All documents encrypted at rest
2. **Access Control**: Strict RLS policies
3. **Audit Logging**: Track all verification actions
4. **GDPR Compliance**: Secure document storage, right to deletion
5. **PII Handling**: Minimize PII storage, use hashing where possible

## Cost Considerations

### Manual Review (In-House)
- Staff time: ~10-15 minutes per verification
- Cost: ~£5-10 per verification (staff time)
- Scalability: Limited

### Automated (Third-Party)
- Onfido/Veriff: ~£1-5 per check
- SIA API: May be free or low cost
- Companies House API: Free for basic checks
- Cost: ~£2-6 per verification
- Scalability: High

### Hybrid Approach (Recommended)
- Automated checks for: Identity, SIA license, Company registration
- Manual review for: Insurance, complex cases, appeals
- Cost: ~£3-8 per verification
- Speed: Faster than full manual, more thorough than full automated

## Next Steps

1. **Phase 1**: Implement document upload system
2. **Phase 2**: Add manual review dashboard
3. **Phase 3**: Integrate automated checks (SIA, Companies House)
4. **Phase 4**: Add third-party identity verification (Onfido/Veriff)
5. **Phase 5**: Implement expiry monitoring and alerts

## Database Schema

See `supabase/migrations/0006_kyc_verification.sql` for the complete schema including:
- `verification_documents` - Stores uploaded documents
- `verifications` - Overall verification status
- `verification_requirements` - Checklist of required documents

## API Endpoints Needed

1. `POST /api/verification/upload` - Upload document
2. `GET /api/verification/status` - Get verification status
3. `GET /api/verification/documents` - List uploaded documents
4. `POST /api/verification/submit` - Submit for review
5. `GET /api/admin/verifications` - Admin: List pending verifications
6. `POST /api/admin/verifications/:id/approve` - Admin: Approve
7. `POST /api/admin/verifications/:id/reject` - Admin: Reject

## UI Components Needed

1. **Verification Dashboard** - User's verification status
2. **Document Upload** - Drag-and-drop file upload
3. **Verification Checklist** - Shows what's needed
4. **Admin Review Panel** - For manual review
5. **Verification Badge** - Display on profiles
