"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Review {
  id: string;
  booking_id: string | null;
  reviewer_id: string;
  reviewer_type: string;
  reviewee_id: string;
  reviewee_type: string;
  overall_rating: number;
  professionalism_rating: number | null;
  punctuality_rating: number | null;
  communication_rating: number | null;
  safety_rating: number | null;
  title: string | null;
  content: string | null;
  response: string | null;
  response_at: string | null;
  helpful_count: number;
  is_verified: boolean;
  created_at: string;
  reviewer?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface UserRatings {
  reviewee_id: string;
  total_reviews: number;
  avg_rating: number;
  avg_professionalism: number | null;
  avg_punctuality: number | null;
  avg_communication: number | null;
  avg_safety: number | null;
}

interface Props {
  userId: string;
  userType: "personnel" | "venue" | "agency";
  canReview?: boolean;
  bookingId?: string;
}

export function ReviewsSection({
  userId,
  userType,
  canReview = false,
  bookingId,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratings, setRatings] = useState<UserRatings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    overall: 5,
    professionalism: 5,
    punctuality: 5,
    communication: 5,
    safety: 5,
    title: "",
    content: "",
  });
  const supabase = createClient();

  useEffect(() => {
    loadReviews();
    getCurrentUser();
  }, [userId]);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadReviews = async () => {
    // Load reviews
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select(
        `
        *,
        reviewer:profiles!reviewer_id(id, display_name, avatar_url)
      `
      )
      .eq("reviewee_id", userId)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (reviewsData) {
      setReviews(reviewsData);
    }

    // Load aggregate ratings
    const { data: ratingsData } = await supabase
      .from("user_ratings")
      .select("*")
      .eq("reviewee_id", userId)
      .single();

    if (ratingsData) {
      setRatings(ratingsData);
    }

    setLoading(false);
  };

  const handleSubmitReview = async () => {
    if (!currentUserId) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        booking_id: bookingId || null,
        reviewer_id: currentUserId,
        reviewer_type: userType === "personnel" ? "venue" : "personnel", // Opposite of reviewee
        reviewee_id: userId,
        reviewee_type: userType,
        overall_rating: reviewForm.overall,
        professionalism_rating: reviewForm.professionalism,
        punctuality_rating: reviewForm.punctuality,
        communication_rating: reviewForm.communication,
        safety_rating: reviewForm.safety,
        title: reviewForm.title || null,
        content: reviewForm.content || null,
      });

      if (error) throw error;

      setShowReviewModal(false);
      setReviewForm({
        overall: 5,
        professionalism: 5,
        punctuality: 5,
        communication: 5,
        safety: 5,
        title: "",
        content: "",
      });
      await loadReviews();
    } catch (error) {
      console.error("Failed to submit review:", error);
      alert("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    if (!currentUserId) return;

    try {
      await supabase.from("review_votes").upsert({
        review_id: reviewId,
        user_id: currentUserId,
        is_helpful: true,
      });
      await loadReviews();
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const renderStars = (rating: number, size: "sm" | "md" | "lg" = "md") => {
    const sizeClass = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";
    return (
      <div className={`flex gap-0.5 ${sizeClass}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? "text-yellow-400" : "text-dark-600"}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const renderStarInput = (
    value: number,
    onChange: (val: number) => void,
    label: string
  ) => {
    return (
      <div className="flex items-center justify-between">
        <span className="text-dark-300">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`text-2xl transition-colors ${
                star <= value
                  ? "text-yellow-400 hover:text-yellow-300"
                  : "text-dark-600 hover:text-dark-500"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-dark-600 rounded w-1/3"></div>
          <div className="h-20 bg-dark-600 rounded"></div>
          <div className="h-32 bg-dark-600 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Reviews & Ratings</h3>
          {canReview && currentUserId && currentUserId !== userId && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
            >
              Write Review
            </button>
          )}
        </div>

        {ratings ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Rating */}
            <div className="text-center p-6 bg-dark-700/50 rounded-xl">
              <div className="text-5xl font-bold text-white mb-2">
                {ratings.avg_rating?.toFixed(1) || "N/A"}
              </div>
              {renderStars(Math.round(ratings.avg_rating || 0), "lg")}
              <p className="text-dark-400 mt-2">
                Based on {ratings.total_reviews} review
                {ratings.total_reviews !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
              {[
                { label: "Professionalism", value: ratings.avg_professionalism },
                { label: "Punctuality", value: ratings.avg_punctuality },
                { label: "Communication", value: ratings.avg_communication },
                { label: "Safety", value: ratings.avg_safety },
              ].map(
                (item) =>
                  item.value && (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-dark-400 w-32">{item.label}</span>
                      <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${(item.value / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-white w-8">
                        {item.value.toFixed(1)}
                      </span>
                    </div>
                  )
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="text-4xl mb-3 block">⭐</span>
            <p className="text-dark-300">No reviews yet</p>
            {canReview && currentUserId && currentUserId !== userId && (
              <p className="text-sm text-dark-500 mt-1">
                Be the first to leave a review!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Reviews List */}
      {reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="p-6 bg-dark-800 border border-dark-600 rounded-xl"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center text-xl">
                  {review.reviewer?.avatar_url ? (
                    <img
                      src={review.reviewer.avatar_url}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    "👤"
                  )}
                </div>

                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">
                      {review.reviewer?.display_name || "Anonymous"}
                    </span>
                    {review.is_verified && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        ✓ Verified
                      </span>
                    )}
                  </div>

                  {/* Rating & Date */}
                  <div className="flex items-center gap-3 mb-3">
                    {renderStars(review.overall_rating, "sm")}
                    <span className="text-dark-500 text-sm">
                      {formatDate(review.created_at)}
                    </span>
                  </div>

                  {/* Title */}
                  {review.title && (
                    <h4 className="font-medium text-white mb-2">{review.title}</h4>
                  )}

                  {/* Content */}
                  {review.content && (
                    <p className="text-dark-300">{review.content}</p>
                  )}

                  {/* Sub-ratings */}
                  {(review.professionalism_rating ||
                    review.punctuality_rating ||
                    review.communication_rating ||
                    review.safety_rating) && (
                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                      {review.professionalism_rating && (
                        <span className="text-dark-400">
                          Professionalism: {review.professionalism_rating}/5
                        </span>
                      )}
                      {review.punctuality_rating && (
                        <span className="text-dark-400">
                          Punctuality: {review.punctuality_rating}/5
                        </span>
                      )}
                      {review.communication_rating && (
                        <span className="text-dark-400">
                          Communication: {review.communication_rating}/5
                        </span>
                      )}
                      {review.safety_rating && (
                        <span className="text-dark-400">
                          Safety: {review.safety_rating}/5
                        </span>
                      )}
                    </div>
                  )}

                  {/* Response */}
                  {review.response && (
                    <div className="mt-4 p-4 bg-dark-700/50 rounded-lg border-l-2 border-accent">
                      <p className="text-sm text-dark-400 mb-1">Response:</p>
                      <p className="text-dark-300">{review.response}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-4 mt-4">
                    <button
                      onClick={() => handleMarkHelpful(review.id)}
                      className="text-sm text-dark-400 hover:text-white transition-colors"
                    >
                      👍 Helpful ({review.helpful_count})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Write Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-600">
              <h3 className="text-lg font-semibold text-white">Write a Review</h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Overall Rating */}
              <div>
                <label className="block text-sm text-dark-300 mb-3">
                  Overall Rating *
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setReviewForm((prev) => ({ ...prev, overall: star }))
                      }
                      className={`text-4xl transition-transform hover:scale-110 ${
                        star <= reviewForm.overall
                          ? "text-yellow-400"
                          : "text-dark-600"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Ratings */}
              <div className="space-y-3 p-4 bg-dark-700/50 rounded-lg">
                {renderStarInput(
                  reviewForm.professionalism,
                  (val) =>
                    setReviewForm((prev) => ({ ...prev, professionalism: val })),
                  "Professionalism"
                )}
                {renderStarInput(
                  reviewForm.punctuality,
                  (val) =>
                    setReviewForm((prev) => ({ ...prev, punctuality: val })),
                  "Punctuality"
                )}
                {renderStarInput(
                  reviewForm.communication,
                  (val) =>
                    setReviewForm((prev) => ({ ...prev, communication: val })),
                  "Communication"
                )}
                {renderStarInput(
                  reviewForm.safety,
                  (val) => setReviewForm((prev) => ({ ...prev, safety: val })),
                  "Safety"
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Review Title (Optional)
                </label>
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={(e) =>
                    setReviewForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Summarize your experience"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Your Review (Optional)
                </label>
                <textarea
                  value={reviewForm.content}
                  onChange={(e) =>
                    setReviewForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  rows={4}
                  placeholder="Share details of your experience..."
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-dark-600 flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-lg font-medium transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
