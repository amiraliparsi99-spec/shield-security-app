"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StaffCard, StaffStatusBadge } from "@/components/agency";
import type { AgencyStaffWithPersonnel, AgencyStaffStatus, AgencyStaffRole } from "@/types/database";

type FilterStatus = AgencyStaffStatus | "all";
type FilterRole = AgencyStaffRole | "all";

export default function StaffRosterPage() {
  const [staff, setStaff] = useState<AgencyStaffWithPersonnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [roleFilter, setRoleFilter] = useState<FilterRole>("all");

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Get current user's agency
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user found");
        setIsLoading(false);
        return;
      }

      console.log("Fetching agency for user:", user.id);
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      console.log("Agency result:", { agency, agencyError });

      if (!agency) {
        console.log("No agency found");
        setIsLoading(false);
        return;
      }

      // Get staff with personnel details
      console.log("Fetching staff for agency:", agency.id);
      const { data: staffData, error: staffError } = await supabase
        .from("agency_staff")
        .select(`
          *,
          personnel:personnel(*)
        `)
        .eq("agency_id", agency.id)
        .order("joined_at", { ascending: false });

      console.log("Staff result:", { staffData, staffError, count: staffData?.length });

      setStaff(staffData || []);
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter staff
  const filteredStaff = staff.filter((s) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = s.personnel?.display_name?.toLowerCase().includes(query);
      const matchesSkills = s.personnel?.skills?.some((skill: string) => skill.toLowerCase().includes(query));
      if (!matchesName && !matchesSkills) return false;
    }

    // Status filter - using is_active instead of status
    if (statusFilter === "active" && !s.is_active) return false;
    if (statusFilter === "inactive" && s.is_active) return false;

    return true;
  });

  const statusCounts = {
    all: staff.length,
    active: staff.filter((s) => s.is_active).length,
    pending: 0, // Not used anymore
    inactive: staff.filter((s) => !s.is_active).length,
    suspended: 0, // Not used anymore
  };

  const handleMessage = (staffId: string) => {
    // Navigate to messages with this staff member
    window.location.href = `/d/agency/messages?staff=${staffId}`;
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Staff Roster</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your team of security personnel
          </p>
        </div>
        <Link
          href="/d/agency/staff/add"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or certification..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50 focus:ring-1 focus:ring-shield-500/50"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
          {(["all", "active", "pending", "inactive"] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === status
                  ? "bg-shield-500/20 text-shield-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1.5 text-zinc-500">({statusCounts[status]})</span>
            </button>
          ))}
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as FilterRole)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-shield-500/50"
        >
          <option value="all">All Roles</option>
          <option value="employee">Employees</option>
          <option value="contractor">Contractors</option>
          <option value="manager">Managers</option>
        </select>
      </div>

      {/* Staff List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {staff.length === 0 ? (
            <>
              <h3 className="mt-4 font-display text-lg font-medium text-white">No staff yet</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Add security personnel to your team to get started
              </p>
              <Link
                href="/d/agency/staff/add"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Staff Member
              </Link>
            </>
          ) : (
            <>
              <h3 className="mt-4 font-display text-lg font-medium text-white">No results</h3>
              <p className="mt-2 text-sm text-zinc-400">
                No staff members match your current filters
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
                className="mt-4 text-sm text-shield-400 hover:text-shield-300"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStaff.map((staffMember) => (
            <StaffCard
              key={staffMember.id}
              staff={staffMember}
              onMessage={() => handleMessage(staffMember.id)}
            />
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {staff.length > 0 && (
        <div className="mt-6 text-center text-sm text-zinc-500">
          Showing {filteredStaff.length} of {staff.length} staff members
        </div>
      )}
    </div>
  );
}
