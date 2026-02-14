# Shield App - Supabase Setup Guide

## Overview

This guide explains how to set up the Supabase database for the Shield app.

## Prerequisites

1. A Supabase account (free tier works)
2. A new Supabase project created

## Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (found in Settings > API)
   - **Service Role Key** (for admin operations, keep secret!)

### 2. Configure Environment Variables

Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Database Migrations

In your Supabase dashboard:

1. Go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `migrations/001_initial_schema.sql`
4. Click **Run**
5. Create another query
6. Copy and paste the contents of `migrations/002_row_level_security.sql`
7. Click **Run**

### 4. Enable Storage (for document uploads)

1. Go to **Storage** in your Supabase dashboard
2. Create a new bucket called `documents`
3. Set it to **Public** (or configure RLS for private access)
4. Add a policy to allow authenticated users to upload

```sql
-- Storage policy for documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 5. Configure Authentication

1. Go to **Authentication** > **Providers**
2. Enable **Email** (enabled by default)
3. Optional: Enable social providers (Google, etc.)

### 6. Test the Setup

1. Create a test user via Supabase Auth
2. Check that the profile is created in the `profiles` table
3. Test CRUD operations through your app

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends auth.users) |
| `venues` | Venue/club information |
| `personnel` | Security staff profiles |
| `agencies` | Security agency profiles |
| `bookings` | Event booking requests |
| `shifts` | Individual shift assignments |

### Supporting Tables

| Table | Description |
|-------|-------------|
| `availability` | Weekly availability schedule |
| `blocked_dates` | Dates personnel are unavailable |
| `special_availability` | Override availability for specific dates |
| `documents` | Uploaded documents (SIA, DBS, etc.) |
| `incidents` | Incident reports |
| `reviews` | Shift reviews/ratings |
| `messages` | Chat messages |
| `notifications` | User notifications |

### Relationships

```
profiles (auth.users)
    ├── venues (1:1)
    ├── personnel (1:1)
    └── agencies (1:1)

venues
    ├── bookings (1:many)
    ├── preferred_staff (many:many with personnel)
    ├── blocked_staff (many:many with personnel)
    └── event_templates (1:many)

personnel
    ├── shifts (1:many)
    ├── availability (1:many)
    ├── blocked_dates (1:many)
    ├── documents (1:many)
    └── incidents (1:many)

bookings
    └── shifts (1:many)

agencies
    └── agency_staff (many:many with personnel)
```

## TypeScript Types

All database types are defined in `src/lib/database.types.ts`.

Import and use them:

```typescript
import type { Profile, Venue, Personnel, Booking } from '@/lib/database.types';
```

## Database Service Functions

All database operations are centralized in `src/lib/db/`:

```typescript
import { 
  getProfile, 
  createBooking, 
  getAvailablePersonnel 
} from '@/lib/db';
```

## Row Level Security (RLS)

RLS is enabled on all tables. Key policies:

- Users can only access their own data
- Venues are publicly readable
- Available personnel are publicly readable
- Bookings visible to venue owner and assigned staff
- Documents only visible to owner and admins

## Troubleshooting

### "Permission denied" errors
- Check that RLS policies are applied correctly
- Verify user is authenticated
- Check the user's role matches the operation

### "Relation does not exist" errors
- Run the migration scripts in order (001 before 002)
- Check for any SQL errors during migration

### Auth not working
- Verify Supabase URL and keys in `.env.local`
- Check that email provider is enabled in Supabase Auth settings

## Next Steps

After database setup:

1. Update signup flows to create records in the correct tables
2. Connect dashboard components to real data
3. Implement real-time subscriptions for live updates
4. Add email notifications via Supabase Edge Functions
