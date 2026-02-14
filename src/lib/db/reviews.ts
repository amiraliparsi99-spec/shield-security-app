/**
 * Reviews database operations
 * Handles creating reviews and aggregating ratings
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Use any for Supabase client to avoid strict type conflicts with dynamic schema
type TypedSupabaseClient = SupabaseClient<any>;

export interface ReviewSubmission {
  shiftId: string;
  revieweeId: string;
  revieweeType: 'personnel' | 'venue';
  overallRating: number;
  professionalismRating?: number;
  punctualityRating?: number;
  communicationRating?: number;
  safetyRating?: number;
  title?: string;
  content?: string;
  isPublic?: boolean;
}

export interface ReviewResult {
  success: boolean;
  reviewId?: string;
  error?: string;
}

export interface UserRatingStats {
  totalReviews: number;
  averageRating: number;
  averageProfessionalism: number | null;
  averagePunctuality: number | null;
  averageCommunication: number | null;
  averageSafety: number | null;
  ratingDistribution: { rating: number; count: number }[];
}

/**
 * Submit a review for a completed shift
 */
export async function submitReview(
  supabase: TypedSupabaseClient,
  review: ReviewSubmission
): Promise<ReviewResult> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify shift exists and is completed
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('id, status, personnel_id, booking:bookings(venue_id, venues(owner_id))')
    .eq('id', review.shiftId)
    .single();

  if (shiftError || !shift) {
    return { success: false, error: 'Shift not found' };
  }

  if (shift.status !== 'checked_out') {
    return { success: false, error: 'Can only review completed shifts' };
  }

  // Determine reviewer type based on who is submitting
  const venue = (shift as any).booking?.venues;
  const isVenueOwner = venue?.owner_id === user.id;
  const isPersonnel = shift.personnel_id && await isUserPersonnel(supabase, user.id, shift.personnel_id);
  
  let reviewerType: 'venue' | 'personnel';
  if (isVenueOwner && review.revieweeType === 'personnel') {
    reviewerType = 'venue';
  } else if (isPersonnel && review.revieweeType === 'venue') {
    reviewerType = 'personnel';
  } else {
    return { success: false, error: 'Not authorized to review this shift' };
  }

  // Check if review already exists
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('shift_id', review.shiftId)
    .eq('reviewer_id', user.id)
    .maybeSingle();

  if (existingReview) {
    return { success: false, error: 'You have already reviewed this shift' };
  }

  // Create the review
  const { data: newReview, error: insertError } = await supabase
    .from('reviews')
    .insert({
      shift_id: review.shiftId,
      booking_id: (shift as any).booking_id,
      reviewer_id: user.id,
      reviewer_type: reviewerType,
      reviewee_id: review.revieweeId,
      reviewee_type: review.revieweeType,
      overall_rating: review.overallRating,
      professionalism_rating: review.professionalismRating || null,
      punctuality_rating: review.punctualityRating || null,
      communication_rating: review.communicationRating || null,
      safety_rating: review.safetyRating || null,
      title: review.title || null,
      content: review.content || null,
      is_public: review.isPublic ?? true,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Review insert error:', insertError);
    return { success: false, error: insertError.message };
  }

  // Update aggregated ratings and Shield Score
  await updateUserRatings(supabase, review.revieweeId);
  
  if (review.revieweeType === 'personnel') {
    await updateShieldScore(supabase, review.revieweeId, review.overallRating);
  }

  // Send notification to reviewee
  const { data: revieweeProfile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', review.revieweeId)
    .maybeSingle();

  // Try to get user_id from the reviewee entity directly based on type
  let revieweeUserId: string | null = null;
  if (review.revieweeType === 'personnel') {
    const { data } = await supabase
      .from('personnel')
      .select('user_id')
      .eq('id', review.revieweeId)
      .maybeSingle();
    revieweeUserId = data?.user_id || null;
  } else if (review.revieweeType === 'venue') {
    const { data } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', review.revieweeId)
      .maybeSingle();
    revieweeUserId = data?.owner_id || null;
  }

  if (revieweeUserId) {
    await supabase.from('notifications').insert({
      user_id: revieweeUserId,
      type: 'review',
      title: `⭐ New ${review.overallRating}-Star Review`,
      body: review.title || `You received a new review${review.content ? `: "${review.content.slice(0, 50)}..."` : ''}`,
      data: { review_id: newReview.id, rating: review.overallRating },
    });
  }

  return { success: true, reviewId: newReview.id };
}

/**
 * Check if user is the personnel for this shift
 */
async function isUserPersonnel(
  supabase: TypedSupabaseClient,
  userId: string,
  personnelId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('personnel')
    .select('id')
    .eq('id', personnelId)
    .eq('user_id', userId)
    .maybeSingle();
  
  return !!data;
}

/**
 * Update aggregated rating stats for a user
 */
async function updateUserRatings(
  supabase: TypedSupabaseClient,
  revieweeId: string
): Promise<void> {
  // This is handled by the database view/materialized view
  // The user_ratings view automatically calculates averages
  // We can optionally force a refresh if using a materialized view
  
  // For now, the view handles this automatically
  console.log('User ratings updated for:', revieweeId);
}

/**
 * Update Shield Score based on new review
 */
async function updateShieldScore(
  supabase: TypedSupabaseClient,
  personnelId: string,
  rating: number
): Promise<void> {
  // Calculate points based on rating
  // 5 stars = +5 points, 4 stars = +2, 3 stars = 0, 2 stars = -3, 1 star = -5
  const pointsMap: Record<number, number> = {
    5: 5,
    4: 2,
    3: 0,
    2: -3,
    1: -5,
  };
  const pointsChange = pointsMap[Math.round(rating)] || 0;

  // Record in shield score history
  await supabase.from('shield_score_history').insert({
    personnel_id: personnelId,
    event_type: 'review_received',
    points_change: pointsChange,
    details: { rating, calculated_points: pointsChange },
    created_at: new Date().toISOString(),
  });

  // Update personnel's shield score
  const { data: current } = await supabase
    .from('personnel')
    .select('shield_score')
    .eq('id', personnelId)
    .single();

  if (current) {
    const newScore = Math.max(0, Math.min(100, (current.shield_score || 50) + pointsChange));
    await supabase
      .from('personnel')
      .update({ shield_score: newScore })
      .eq('id', personnelId);
  }
}

/**
 * Get rating stats for a user
 */
export async function getUserRatingStats(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<UserRatingStats | null> {
  const { data, error } = await supabase
    .from('user_ratings')
    .select('*')
    .eq('reviewee_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // Get rating distribution
  const { data: distribution } = await supabase
    .from('reviews')
    .select('overall_rating')
    .eq('reviewee_id', userId);

  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution?.forEach(r => {
    const rounded = Math.round(r.overall_rating);
    if (ratingCounts[rounded] !== undefined) {
      ratingCounts[rounded]++;
    }
  });

  return {
    totalReviews: data.total_reviews || 0,
    averageRating: data.avg_rating || 0,
    averageProfessionalism: data.avg_professionalism,
    averagePunctuality: data.avg_punctuality,
    averageCommunication: data.avg_communication,
    averageSafety: data.avg_safety,
    ratingDistribution: Object.entries(ratingCounts).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
    })),
  };
}

/**
 * Get pending reviews for a user (shifts they need to review)
 */
export async function getPendingReviews(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<{
  shiftsToReview: Array<{
    shiftId: string;
    venueName: string;
    personnelName: string;
    completedAt: string;
    role: string;
  }>;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { shiftsToReview: [] };

  // Get user's role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  const shiftsToReview: Array<{
    shiftId: string;
    venueName: string;
    personnelName: string;
    completedAt: string;
    role: string;
  }> = [];

  if (profile?.role === 'personnel') {
    // Get personnel ID
    const { data: personnel } = await supabase
      .from('personnel')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (personnel) {
      // Find completed shifts without a review from this personnel
      const { data: shifts } = await supabase
        .from('shifts')
        .select(`
          id,
          actual_end,
          role,
          booking:bookings(
            venue:venues(id, name)
          )
        `)
        .eq('personnel_id', personnel.id)
        .eq('status', 'checked_out')
        .order('actual_end', { ascending: false })
        .limit(10);

      if (shifts) {
        for (const shift of shifts) {
          // Check if review exists
          const { data: existingReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('shift_id', shift.id)
            .eq('reviewer_id', userId)
            .maybeSingle();

          if (!existingReview) {
            const venue = (shift as any).booking?.venue;
            shiftsToReview.push({
              shiftId: shift.id,
              venueName: venue?.name || 'Unknown Venue',
              personnelName: '', // Not needed for venue review
              completedAt: shift.actual_end || '',
              role: shift.role,
            });
          }
        }
      }
    }
  } else if (profile?.role === 'venue') {
    // Get venue ID
    const { data: venue } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (venue) {
      // Find completed shifts at this venue without a review
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id,
          shifts(
            id,
            actual_end,
            role,
            status,
            personnel:personnel(id, display_name)
          )
        `)
        .eq('venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (bookings) {
        for (const booking of bookings) {
          const shifts = (booking as any).shifts || [];
          for (const shift of shifts) {
            if (shift.status === 'checked_out' && shift.personnel) {
              const { data: existingReview } = await supabase
                .from('reviews')
                .select('id')
                .eq('shift_id', shift.id)
                .eq('reviewer_id', userId)
                .maybeSingle();

              if (!existingReview) {
                shiftsToReview.push({
                  shiftId: shift.id,
                  venueName: '', // Not needed
                  personnelName: shift.personnel?.display_name || 'Unknown',
                  completedAt: shift.actual_end || '',
                  role: shift.role,
                });
              }
            }
          }
        }
      }
    }
  }

  return { shiftsToReview: shiftsToReview.slice(0, 5) }; // Limit to 5
}
