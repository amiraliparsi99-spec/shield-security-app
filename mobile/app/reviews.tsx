import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { SlideInView } from "../components/ui/AnimatedComponents";

interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  overall_rating: number;
  professionalism_rating: number;
  punctuality_rating: number;
  communication_rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string;
}

interface RatingStats {
  avg_rating: number;
  total_reviews: number;
  rating_breakdown: Record<number, number>;
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [canWriteReview, setCanWriteReview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Write review form
  const [newReview, setNewReview] = useState({
    overall: 5,
    professionalism: 5,
    punctuality: 5,
    communication: 5,
    comment: "",
  });

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { profileId, role } = await getProfileIdAndRole(supabase);
      setCurrentUserId(profileId);
      
      // Load reviews for the user
      const targetId = userId || profileId;
      
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewee_id", targetId)
        .order("created_at", { ascending: false });

      if (reviewsData) {
        setReviews(reviewsData);
        
        // Calculate stats
        if (reviewsData.length > 0) {
          const avgRating = reviewsData.reduce((sum, r) => sum + r.overall_rating, 0) / reviewsData.length;
          const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          reviewsData.forEach(r => {
            breakdown[r.overall_rating] = (breakdown[r.overall_rating] || 0) + 1;
          });
          setStats({
            avg_rating: avgRating,
            total_reviews: reviewsData.length,
            rating_breakdown: breakdown,
          });
        }
      }

      // Check if current user can write a review (has completed booking with this person)
      if (profileId && targetId && profileId !== targetId) {
        setCanWriteReview(true); // Simplified - in production check for completed booking
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [userId]);

  const handleSubmitReview = async () => {
    if (!currentUserId || !userId) return;
    
    try {
      const { error } = await supabase.from("reviews").insert({
        reviewer_id: currentUserId,
        reviewee_id: userId,
        overall_rating: newReview.overall,
        professionalism_rating: newReview.professionalism,
        punctuality_rating: newReview.punctuality,
        communication_rating: newReview.communication,
        comment: newReview.comment,
      });

      if (error) throw error;

      safeHaptic("success");
      setShowWriteModal(false);
      setNewReview({ overall: 5, professionalism: 5, punctuality: 5, communication: 5, comment: "" });
      loadData();
      Alert.alert("Success", "Review submitted successfully!");
    } catch (error) {
      console.error("Error submitting review:", error);
      safeHaptic("error");
      Alert.alert("Error", "Failed to submit review");
    }
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Text key={star} style={{ fontSize: size }}>
            {star <= rating ? "⭐" : "☆"}
          </Text>
        ))}
      </View>
    );
  };

  const renderRatingSelector = (
    label: string,
    value: number,
    onChange: (val: number) => void
  ) => (
    <View style={styles.ratingSelector}>
      <Text style={styles.ratingSelectorLabel}>{label}</Text>
      <View style={styles.ratingStars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => {
              onChange(star);
              safeHaptic("selection");
            }}
          >
            <Text style={{ fontSize: 28 }}>{star <= value ? "⭐" : "☆"}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reviews</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Stats Card */}
        {stats && (
          <SlideInView delay={0}>
            <View style={styles.statsCard}>
              <View style={styles.statsMain}>
                <Text style={styles.avgRating}>{stats.avg_rating.toFixed(1)}</Text>
                {renderStars(Math.round(stats.avg_rating), 20)}
                <Text style={styles.totalReviews}>{stats.total_reviews} reviews</Text>
              </View>
              <View style={styles.statsBreakdown}>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <View key={rating} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{rating}★</Text>
                    <View style={styles.breakdownBar}>
                      <View
                        style={[
                          styles.breakdownFill,
                          {
                            width: `${((stats.rating_breakdown[rating] || 0) / stats.total_reviews) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.breakdownCount}>{stats.rating_breakdown[rating] || 0}</Text>
                  </View>
                ))}
              </View>
            </View>
          </SlideInView>
        )}

        {/* Write Review Button */}
        {canWriteReview && (
          <TouchableOpacity
            style={styles.writeReviewBtn}
            onPress={() => {
              setShowWriteModal(true);
              safeHaptic("light");
            }}
          >
            <Text style={styles.writeReviewText}>✍️ Write a Review</Text>
          </TouchableOpacity>
        )}

        {/* Reviews List */}
        <View style={styles.reviewsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading reviews...</Text>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No Reviews Yet</Text>
              <Text style={styles.emptyText}>
                Reviews will appear here after completed bookings
              </Text>
            </View>
          ) : (
            reviews.map((review, index) => (
              <SlideInView key={review.id} delay={index * 100}>
                <View style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Text style={styles.reviewerInitial}>
                          {review.reviewer_name?.[0] || "U"}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>
                          {review.reviewer_name || "Anonymous"}
                        </Text>
                        <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                      </View>
                    </View>
                    {renderStars(review.overall_rating)}
                  </View>

                  {review.comment && (
                    <Text style={styles.reviewComment}>"{review.comment}"</Text>
                  )}

                  <View style={styles.reviewRatings}>
                    <View style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>Professional</Text>
                      <Text style={styles.ratingValue}>{review.professionalism_rating}/5</Text>
                    </View>
                    <View style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>Punctual</Text>
                      <Text style={styles.ratingValue}>{review.punctuality_rating}/5</Text>
                    </View>
                    <View style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>Communication</Text>
                      <Text style={styles.ratingValue}>{review.communication_rating}/5</Text>
                    </View>
                  </View>
                </View>
              </SlideInView>
            ))
          )}
        </View>
      </ScrollView>

      {/* Write Review Modal */}
      <Modal visible={showWriteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setShowWriteModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {renderRatingSelector("Overall Rating", newReview.overall, (val) =>
                setNewReview((prev) => ({ ...prev, overall: val }))
              )}
              {renderRatingSelector("Professionalism", newReview.professionalism, (val) =>
                setNewReview((prev) => ({ ...prev, professionalism: val }))
              )}
              {renderRatingSelector("Punctuality", newReview.punctuality, (val) =>
                setNewReview((prev) => ({ ...prev, punctuality: val }))
              )}
              {renderRatingSelector("Communication", newReview.communication, (val) =>
                setNewReview((prev) => ({ ...prev, communication: val }))
              )}

              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>Comment (optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  value={newReview.comment}
                  onChangeText={(text) => setNewReview((prev) => ({ ...prev, comment: text }))}
                  placeholder="Share your experience..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitReview}>
              <Text style={styles.submitBtnText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statsMain: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avgRating: {
    fontSize: 48,
    fontWeight: "700",
    color: colors.text,
  },
  starsContainer: {
    flexDirection: "row",
    marginVertical: spacing.xs,
  },
  totalReviews: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statsBreakdown: {
    gap: spacing.xs,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 30,
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  breakdownCount: {
    ...typography.caption,
    color: colors.textMuted,
    width: 20,
    textAlign: "right",
  },
  writeReviewBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  writeReviewText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  reviewsList: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  reviewerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewerInitial: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
  },
  reviewerName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  reviewDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reviewComment: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  reviewRatings: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ratingItem: {
    alignItems: "center",
  },
  ratingLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  ratingValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
  },
  modalClose: {
    fontSize: 24,
    color: colors.textMuted,
  },
  modalBody: {
    padding: spacing.lg,
  },
  ratingSelector: {
    marginBottom: spacing.lg,
  },
  ratingSelectorLabel: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    fontWeight: "600",
  },
  ratingStars: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  commentSection: {
    marginTop: spacing.md,
  },
  commentLabel: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    fontWeight: "600",
  },
  commentInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  submitBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
