# Setup Guide: Agency Invitation System

## Quick Start

### 1. Run Database Migration

You need to apply the `0025_agency_invitations.sql` migration to your Supabase database.

**Option A: Supabase Studio (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `supabase/migrations/0025_agency_invitations.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run**

**Option B: Supabase CLI**

```bash
# If you have Supabase CLI linked
npx supabase db push

# Or apply the specific migration
npx supabase migration up
```

### 2. Verify Migration

Check that the following table exists:

```sql
SELECT * FROM agency_invitations LIMIT 1;
```

Check that the function exists:

```sql
SELECT accept_agency_invitation('00000000-0000-0000-0000-000000000000');
-- Should return: {"success": false, "error": "Invitation not found or expired"}
```

### 3. Test the System

#### As Agency:

1. Login as an agency owner
2. Navigate to **Staff** → **Pending Invites** → **Send Invitation**
3. Search for a guard (by name or certification)
4. Fill in the invitation details:
   - Role: Contractor/Employee/Manager
   - Hourly Rate: Optional override
   - Message: Personal message to the guard
5. Click **Send Invitation**
6. Check **Staff** → **Pending Invites** to see the invitation

#### As Guard (Web):

1. Login as a guard/personnel
2. Navigate to **Invitations** (in sidebar)
3. You should see the invitation from the agency
4. Click **Accept & Join** or **Decline**

#### As Guard (Mobile):

1. Open the Shield mobile app
2. You should receive a push notification: "Agency X has invited you to join their team"
3. Tap the notification → opens invitations screen
4. Review and accept/decline

### 4. Common Issues

#### Issue: "Module not found: Can't resolve 'framer-motion'"

**Solution:**
```bash
npm install framer-motion
```

#### Issue: Push notifications not working

**Solution:**
1. Check that `NEXT_PUBLIC_API_URL` is set in `.env.local`
2. Verify push tokens are being saved to `push_tokens` table
3. Check Expo push notification credentials

#### Issue: Invitation not showing up

**Solution:**
1. Check that the invitation status is "pending"
2. Verify `expires_at` is in the future
3. Check RLS policies are enabled
4. Verify user has correct personnel/agency record

### 5. Environment Variables

Make sure these are set in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001  # or your production URL
```

For mobile (`mobile/.env`):

```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Agency can send invitation
- [ ] Invitation appears in agency's "Pending Invites"
- [ ] Guard receives push notification (mobile)
- [ ] Guard can view invitation (web)
- [ ] Guard can view invitation (mobile)
- [ ] Guard can accept invitation
- [ ] Guard is added to `agency_staff` with status "active"
- [ ] Invitation is marked as "accepted"
- [ ] Guard can decline invitation
- [ ] Invitation is marked as "declined"
- [ ] Agency can cancel pending invitation
- [ ] Expired invitations don't show up
- [ ] Duplicate invitations are prevented

## Troubleshooting

### Check Database Tables

```sql
-- Check if table exists
SELECT * FROM agency_invitations LIMIT 5;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'agency_invitations';

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'accept_agency_invitation';
```

### Check API Endpoint

```bash
# Test invite-staff endpoint
curl -X POST http://localhost:3001/api/agency/invite-staff \
  -H "Content-Type: application/json" \
  -d '{
    "personnel_id": "your-personnel-uuid",
    "role": "contractor",
    "message": "Test invitation"
  }'
```

### Check Realtime Subscriptions

Open browser console on invitations page:

```javascript
// Should see Supabase realtime connection
// Look for: "SUBSCRIBED" status in network tab
```

## Next Steps

After successful setup:

1. **Test with real users**: Have agency owners and guards test the flow
2. **Monitor invitations**: Check `agency_invitations` table for any issues
3. **Set up cron job**: Create a scheduled job to expire old invitations
4. **Add analytics**: Track invitation acceptance rates
5. **Customize messages**: Create invitation templates for common scenarios

## Support

If you encounter issues:

1. Check the console for errors
2. Verify database migration was applied
3. Check RLS policies are correct
4. Ensure user has correct role (agency owner or personnel)
5. Review the full documentation: `docs/AGENCY_INVITATION_SYSTEM.md`

---

**Last Updated**: 2026-02-12
**Version**: 1.0.0
**Status**: Ready for Production
