import { useState, useEffect, useCallback } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getAgencyId } from "../../lib/auth";

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string | null;
  sia_license_number: string | null;
  sia_verified: boolean;
  hourly_rate: number | null;
  status: string;
  availability_status: 'available' | 'busy' | 'offline';
}

export default function StaffManagementScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'verified'>('all');

  const loadStaff = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const profile = await getProfileIdAndRole(supabase, user.id);
    if (!profile) {
      setLoading(false);
      return;
    }

    const agencyId = await getAgencyId(supabase, profile.profileId);
    if (!agencyId) {
      setLoading(false);
      return;
    }

    // Get agency staff
    const { data, error } = await supabase
      .from('agency_staff')
      .select(`
        id,
        status,
        personnel:personnel_id (
          id,
          user_id,
          full_name,
          display_name,
          sia_license_number,
          sia_verified,
          hourly_rate
        )
      `)
      .eq('agency_id', agencyId)
      .eq('status', 'active');

    if (!error && data) {
      const staffList: StaffMember[] = data
        .filter((item: any) => item.personnel)
        .map((item: any) => ({
          id: item.personnel.id,
          user_id: item.personnel.user_id,
          full_name: item.personnel.full_name,
          display_name: item.personnel.display_name,
          sia_license_number: item.personnel.sia_license_number,
          sia_verified: item.personnel.sia_verified,
          hourly_rate: item.personnel.hourly_rate,
          status: item.status,
          // Mock availability - in real app would check availability table
          availability_status: Math.random() > 0.3 ? 'available' : Math.random() > 0.5 ? 'busy' : 'offline',
        }));
      setStaff(staffList);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStaff();
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch = 
      member.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.display_name?.toLowerCase().includes(search.toLowerCase());

    if (filter === 'available') {
      return matchesSearch && member.availability_status === 'available';
    }
    if (filter === 'verified') {
      return matchesSearch && member.sia_verified;
    }
    return matchesSearch;
  });

  const getStatusColor = (status: StaffMember['availability_status']) => {
    switch (status) {
      case 'available': return colors.success;
      case 'busy': return colors.warning;
      default: return colors.textMuted;
    }
  };

  const renderStaffMember = ({ item }: { item: StaffMember }) => (
    <TouchableOpacity
      style={styles.staffCard}
      onPress={() => router.push(`/personnel/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.staffInfo}>
        <View style={styles.staffHeader}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.availability_status) }]} />
          <Text style={styles.staffName}>{item.display_name || item.full_name}</Text>
        </View>
        
        <View style={styles.staffMeta}>
          {item.sia_verified && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✓ SIA Verified</Text>
            </View>
          )}
          {item.hourly_rate && (
            <Text style={styles.staffRate}>£{(item.hourly_rate / 100).toFixed(2)}/hr</Text>
          )}
        </View>

        {item.sia_license_number && (
          <Text style={styles.staffLicense}>License: {item.sia_license_number}</Text>
        )}
      </View>

      <View style={styles.staffActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/chat/start?userId=${item.user_id}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Staff</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search staff..."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {[
          { key: 'all', label: 'All' },
          { key: 'available', label: 'Available' },
          { key: 'verified', label: 'Verified' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key as typeof filter)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{staff.length}</Text>
          <Text style={styles.statLabel}>Total Staff</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {staff.filter((s) => s.availability_status === 'available').length}
          </Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {staff.filter((s) => s.sia_verified).length}
          </Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
      </View>

      {/* Staff List */}
      <FlatList
        data={filteredStaff}
        renderItem={renderStaffMember}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {search ? 'No staff matching your search' : 'No staff members yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              Add staff to your agency to manage them here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.titleCard,
    color: colors.text,
  },
  addButton: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.text,
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  staffCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffInfo: {
    flex: 1,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  staffName: {
    ...typography.titleCard,
    color: colors.text,
  },
  staffMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  staffRate: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '500',
  },
  staffLicense: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  staffActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
