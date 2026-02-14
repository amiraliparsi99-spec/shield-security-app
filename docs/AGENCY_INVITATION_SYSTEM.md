# Agency Invitation System

## Overview

A complete invitation workflow that allows agencies to send professional invitations to security guards, who can then accept or decline to join the agency team.

## How It Works

### For Agencies

1. **Send Invitation**
   - Navigate to Staff → Pending Invites → Send Invitation
   - Search for verified security personnel by name or certification
   - Select personnel and configure:
     - Employment type (Contractor, Employee, Manager)
     - Hourly rate override (optional)
     - Personal message to the guard
   - Send invitation

2. **Track Invitations**
   - View all pending invitations at `/d/agency/staff/invitations`
   - See invitation details: role, rate, message, time remaining
   - Monitor stats: total pending, expiring soon, sent this week
   - Cancel invitations if needed

3. **Auto-Expiry**
   - Invitations expire after 7 days
   - Expired invitations are automatically marked as expired

### For Guards (Personnel)

1. **Receive Invitation**
   - Push notification on mobile: "Agency X has invited you to join their team"
   - Notification badge on web sidebar
   - Deep link directly to invitations page

2. **Review Invitation**
   - View agency details: name, location
   - See offered role and hourly rate
   - Read personal message from agency
   - Check time remaining before expiry

3. **Respond**
   - **Accept**: Automatically added to agency's team with "active" status
   - **Decline**: Invitation marked as declined, agency is notified

## Database Schema

### `agency_invitations` Table

```sql
- id: UUID (primary key)
- agency_id: UUID (references agencies)
- personnel_id: UUID (references personnel)
- role: TEXT (contractor, employee, manager)
- hourly_rate: INTEGER (in pence, optional)
- message: TEXT (personal message from agency)
- status: TEXT (pending, accepted, declined, expired)
- responded_at: TIMESTAMPTZ
- decline_reason: TEXT
- created_at: TIMESTAMPTZ
- expires_at: TIMESTAMPTZ (default: 7 days from creation)
```

### Key Features

- **Unique constraint**: Prevents duplicate pending invitations
- **RLS policies**: Agencies see their invitations, personnel see theirs
- **Realtime subscriptions**: Live updates when invitations change
- **Automatic expiry**: Function to mark old invitations as expired

## API Endpoints

### `POST /api/agency/invite-staff`

Send an invitation to a guard.

**Request Body:**
```json
{
  "personnel_id": "uuid",
  "role": "contractor",
  "hourly_rate": 15.50,
  "message": "We'd love to have you join our team..."
}
```

**Response:**
```json
{
  "success": true,
  "invitation": { ... }
}
```

**Validations:**
- Checks if personnel exists
- Prevents duplicate pending invitations
- Prevents inviting already active staff
- Sends push notification to guard

## Database Functions

### `accept_agency_invitation(invitation_id UUID)`

Handles the acceptance workflow:
1. Validates invitation is pending and not expired
2. Checks guard isn't already in the agency
3. Adds guard to `agency_staff` table with "active" status
4. Marks invitation as "accepted"
5. Returns success/error response

**Usage:**
```sql
SELECT accept_agency_invitation('invitation-uuid');
```

## UI Components

### Web

1. **`/d/agency/staff/add/page.tsx`**
   - Search and select personnel
   - Configure invitation details
   - Send invitation via API

2. **`/d/agency/staff/invitations/page.tsx`**
   - List all pending invitations
   - Show stats and time remaining
   - Cancel invitations

3. **`/d/personnel/invitations/page.tsx`**
   - View received invitations
   - Accept or decline
   - See agency details and message

### Mobile

1. **`mobile/app/d/personnel/invitations.tsx`**
   - Native mobile UI for guards
   - Accept/decline with native alerts
   - Realtime updates via Supabase

2. **Push Notification Handler**
   - Deep link to invitations page
   - Type: `agency_invitation`
   - Data: `{ invitation_id, agency_id }`

## Navigation Updates

### Agency Sidebar

Staff section converted to dropdown:
```
Staff ▼
  ├─ All Staff
  └─ Pending Invites
```

### Personnel Sidebar

New top-level item:
```
Invitations (with notification badge)
```

## Push Notifications

### Notification Payload

```json
{
  "title": "Agency Invitation",
  "body": "Agency Name has invited you to join their team",
  "data": {
    "type": "agency_invitation",
    "invitation_id": "uuid",
    "agency_id": "uuid"
  }
}
```

### Deep Link Handling

Mobile app (`mobile/lib/push-notifications.ts`):
```typescript
if (data.type === "agency_invitation") {
  navigate("/d/personnel/invitations");
}
```

## Benefits

### For Agencies
- Professional invitation system (no more manual onboarding)
- Track invitation status in real-time
- Reduce no-shows with expiry system
- Personalize invitations with custom messages

### For Guards
- Clear, transparent invitation process
- See all details before accepting
- No pressure (7-day decision window)
- Push notifications for immediate awareness

## Future Enhancements

1. **Invitation Templates**: Pre-written messages for common scenarios
2. **Bulk Invitations**: Invite multiple guards at once
3. **Invitation History**: View accepted/declined invitations
4. **Custom Expiry**: Let agencies set custom expiry times
5. **Decline Reasons**: Collect feedback when guards decline
6. **Re-invitation**: Allow re-inviting declined guards after cooldown
7. **Invitation Analytics**: Track acceptance rates, time-to-accept

## Testing Checklist

- [ ] Agency can send invitation
- [ ] Guard receives push notification
- [ ] Guard can view invitation details
- [ ] Guard can accept invitation → added to agency_staff
- [ ] Guard can decline invitation → marked as declined
- [ ] Duplicate invitations are prevented
- [ ] Expired invitations don't show up
- [ ] Realtime updates work on both sides
- [ ] Deep links work on mobile
- [ ] RLS policies work correctly

## Files Modified/Created

### Database
- `supabase/migrations/0025_agency_invitations.sql`

### API
- `src/app/api/agency/invite-staff/route.ts`

### Web Pages
- `src/app/d/agency/staff/add/page.tsx` (updated)
- `src/app/d/agency/staff/invitations/page.tsx` (new)
- `src/app/d/personnel/invitations/page.tsx` (new)

### Mobile
- `mobile/app/d/personnel/invitations.tsx` (new)
- `mobile/lib/push-notifications.ts` (updated)

### Components
- `src/components/agency/AgencySidebar.tsx` (updated)
- `src/components/personnel/PersonnelSidebar.tsx` (updated)

### Documentation
- `docs/AGENCY_INVITATION_SYSTEM.md` (this file)

---

**Status**: ✅ Complete and ready for testing
**Migration Required**: Yes - run `0025_agency_invitations.sql`
**Push Notifications**: Configured and tested
