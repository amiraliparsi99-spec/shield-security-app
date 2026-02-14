import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { colors, spacing, typography, radius } from "../../../theme";
import { Ionicons } from "@expo/vector-icons";

interface AgencyInvitation {
  id: string;
  agency_id: string;
  role: string;
  hourly_rate: number | null;
  message: string | null;
  created_at: string;
  expires_at: string;
  agencies: {
    name: string;
    city: string | null;
    region: string | null;
  };
}

export default function InvitationsScreen() {
  const [invitations, setInvitations] = useState<AgencyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
    subscribeToInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get personnel ID
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!personnel) return;

      // Get pending invitations
      const { data } = await supabase
        .from("agency_invitations")
        .select(`
          *,
          agencies (
            name,
            city,
            region
          )
        `)
        .eq("personnel_id", personnel.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      setInvitations(data || []);
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToInvitations = () => {
    const channel = supabase
      .channel("personnel-invitations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agency_invitations",
        },
        () => {
          loadInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAccept = async (invitationId: string) => {
    setProcessingId(invitationId);

    try {
      const { data, error } = await supabase.rpc("accept_agency_invitation", {
        invitation_id: invitationId,
      });

      if (error) throw error;

      if (data?.success) {
        Alert.alert(
          "Success",
          "You've joined the agency! You can now see their shifts.",
          [{ text: "OK", onPress: () => loadInvitations() }]
        );
      } else {
        throw new Error(data?.error || "Failed to accept invitation");
      }
    } catch (error: any) {
      console.error("Accept error:", error);
      Alert.alert("Error", error.message || "Failed to accept invitation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    Alert.alert(
      "Decline Invitation",
      "Are you sure you want to decline this invitation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setProcessingId(invitationId);

            try {
              const { error } = await supabase
                .from("agency_invitations")
                .update({
                  status: "declined",
                  responded_at: new Date().toISOString(),
                })
                .eq("id", invitationId);

              if (error) throw error;

              loadInvitations();
            } catch (error: any) {
              console.error("Decline error:", error);
              Alert.alert("Error", error.message || "Failed to decline invitation");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} left`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} left`;
    } else {
      return "Expiring soon";
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: "Invitations", headerShown: true }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: "Agency Invitations",
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md }}
      >
        {invitations.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl * 2,
              alignItems: "center",
              marginTop: spacing.xl * 2,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(255,255,255,0.05)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Ionicons name="mail-outline" size={32} color={colors.textMuted} />
            </View>
            <Text
              style={{
                ...typography.title,
                color: colors.text,
                marginBottom: spacing.sm,
              }}
            >
              No Invitations
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              When agencies invite you to join their team, they'll appear here
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {invitations.map((invitation) => (
              <View
                key={invitation.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: "rgba(45, 212, 191, 0.2)",
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.title,
                        color: colors.text,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {invitation.agencies.name}
                    </Text>
                    {(invitation.agencies.city || invitation.agencies.region) && (
                      <Text style={{ ...typography.caption, color: colors.textMuted }}>
                        {[invitation.agencies.city, invitation.agencies.region]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      backgroundColor: "rgba(45, 212, 191, 0.2)",
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.md,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.accent,
                        fontWeight: "600",
                      }}
                    >
                      {formatTimeRemaining(invitation.expires_at)}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.lg,
                    marginBottom: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        marginBottom: spacing.xs,
                      }}
                    >
                      Role
                    </Text>
                    <Text
                      style={{
                        ...typography.body,
                        color: colors.text,
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {invitation.role}
                    </Text>
                  </View>
                  {invitation.hourly_rate && (
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...typography.caption,
                          color: colors.textMuted,
                          textTransform: "uppercase",
                          marginBottom: spacing.xs,
                        }}
                      >
                        Hourly Rate
                      </Text>
                      <Text
                        style={{
                          ...typography.body,
                          color: colors.text,
                          fontWeight: "600",
                        }}
                      >
                        £{(invitation.hourly_rate / 100).toFixed(2)}/hr
                      </Text>
                    </View>
                  )}
                </View>

                {/* Message */}
                {invitation.message && (
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      marginBottom: spacing.md,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        marginBottom: spacing.xs,
                      }}
                    >
                      Message from Agency
                    </Text>
                    <Text
                      style={{
                        ...typography.body,
                        color: colors.textSecondary,
                        lineHeight: 20,
                      }}
                    >
                      {invitation.message}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => handleDecline(invitation.id)}
                    disabled={processingId === invitation.id}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: radius.lg,
                      paddingVertical: spacing.md,
                      alignItems: "center",
                      opacity: processingId === invitation.id ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.body,
                        color: colors.textSecondary,
                        fontWeight: "600",
                      }}
                    >
                      Decline
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAccept(invitation.id)}
                    disabled={processingId === invitation.id}
                    style={{
                      flex: 1,
                      backgroundColor: colors.accent,
                      borderRadius: radius.lg,
                      paddingVertical: spacing.md,
                      alignItems: "center",
                      opacity: processingId === invitation.id ? 0.5 : 1,
                    }}
                  >
                    {processingId === invitation.id ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Text
                        style={{
                          ...typography.body,
                          color: colors.background,
                          fontWeight: "700",
                        }}
                      >
                        Accept & Join
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
