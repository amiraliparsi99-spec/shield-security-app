"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author: {
    id: string;
    display_name: string;
    role: string;
  };
  booking?: {
    venue_name?: string;
    date?: string;
  };
}

interface ReviewCardProps {
  review: Review;
  variant?: "compact" | "full";
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizes[size]} ${star <= rating ? "text-yellow-400" : "text-zinc-600"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function ReviewCard({ review, variant = "full" }: ReviewCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (variant === "compact") {
    return (
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-shield-500/20 flex items-center justify-center shrink-0">
          <span className="text-sm text-shield-400 font-medium">
            {review.author.display_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StarRating rating={review.rating} size="sm" />
            <span className="text-xs text-zinc-500">{formatDate(review.created_at)}</span>
          </div>
          {review.comment && (
            <p className="text-sm text-zinc-300 mt-1 line-clamp-2">{review.comment}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="glass rounded-xl p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-shield-500/20 flex items-center justify-center shrink-0">
          <span className="text-lg text-shield-400 font-medium">
            {review.author.display_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-white">{review.author.display_name}</h4>
              <p className="text-xs text-zinc-500 capitalize">{review.author.role}</p>
            </div>
            <span className="text-xs text-zinc-500">{formatDate(review.created_at)}</span>
          </div>
          
          <div className="mt-2">
            <StarRating rating={review.rating} size="md" />
          </div>

          {review.booking && (
            <p className="text-xs text-zinc-500 mt-2">
              Shift at {review.booking.venue_name} • {review.booking.date}
            </p>
          )}

          {review.comment && (
            <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
              {review.comment}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Reviews summary component
interface ReviewsSummaryProps {
  averageRating: number;
  totalReviews: number;
  distribution: number[]; // [5-star, 4-star, 3-star, 2-star, 1-star]
}

export function ReviewsSummary({ averageRating, totalReviews, distribution }: ReviewsSummaryProps) {
  const maxCount = Math.max(...distribution, 1);

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-white">{averageRating.toFixed(1)}</div>
          <StarRating rating={Math.round(averageRating)} size="md" />
          <p className="text-xs text-zinc-500 mt-1">{totalReviews} reviews</p>
        </div>
        
        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((stars, i) => (
            <div key={stars} className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 w-3">{stars}</span>
              <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-400 rounded-full"
                  style={{ width: `${(distribution[i] / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500 w-6">{distribution[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Write review form
interface WriteReviewFormProps {
  bookingId: string;
  personnelId: string;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onCancel?: () => void;
}

export function WriteReviewForm({ bookingId, personnelId, onSubmit, onCancel }: WriteReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-white">Leave a Review</h3>
      
      <div>
        <label className="block text-sm text-zinc-400 mb-2">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-1"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <svg
                className={`w-8 h-8 transition-colors ${
                  star <= (hoverRating || rating) ? "text-yellow-400" : "text-zinc-600"
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-2">Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Share your experience..."
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none resize-none"
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-zinc-400 hover:text-white transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={rating === 0 || isSubmitting}
          className="px-6 py-2 bg-shield-500 hover:bg-shield-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}

export { StarRating };
