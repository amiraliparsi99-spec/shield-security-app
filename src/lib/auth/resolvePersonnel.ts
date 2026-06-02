import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Collects every candidate id that could appear as `personnel.user_id`
 * for the given authenticated user across all historical profile schemas.
 *
 * Two layouts exist in the migration history:
 *   0001: profiles.id = auth.users.id (no user_id column, has full_name)
 *   0003: profiles.id is a separate UUID, profiles.user_id = auth.users.id,
 *         has display_name
 *
 * Depending on when the account was created, `personnel.user_id` may equal
 * the auth user id, the profile id, or either. Different rows may use
 * different column names, so we intentionally select only columns that
 * exist in every historical schema, then look up the rest opportunistically.
 */
async function collectOwnerCandidates(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<{
  candidates: string[];
  profileId: string | null;
  profileRole: string | null;
  displayName: string | null;
}> {
  const candidates = new Set<string>([authUserId]);
  let profileId: string | null = null;
  let profileRole: string | null = null;
  let displayName: string | null = null;

  // Only select columns guaranteed to exist across schemas.
  // Layout 0001: profiles.id = auth user id
  const { data: byId } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", authUserId)
    .maybeSingle();
  if (byId) {
    profileId = String((byId as any).id);
    profileRole = ((byId as any).role as string | null) ?? null;
    candidates.add(profileId);
  }

  // Layout 0003: profiles.user_id = auth user id (separate UUID id)
  try {
    const { data: byUser } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (byUser) {
      profileId = profileId ?? String((byUser as any).id);
      profileRole =
        profileRole ?? ((byUser as any).role as string | null) ?? null;
      if ((byUser as any).id) candidates.add(String((byUser as any).id));
    }
  } catch {
    // profiles.user_id may not exist in the 0001-only layout — ignore.
  }

  // Try to pick up a friendly display name opportunistically.
  if (profileId) {
    for (const col of ["display_name", "full_name"]) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select(col)
          .eq("id", profileId)
          .maybeSingle();
        const val = (data as any)?.[col];
        if (val && typeof val === "string" && val.trim().length > 0) {
          displayName = val;
          break;
        }
      } catch {
        // Column doesn't exist in this schema — try the next one.
      }
    }
  }

  return {
    candidates: Array.from(candidates),
    profileId,
    profileRole,
    displayName,
  };
}

function buildPersonnelSelect(extraColumns: string): string {
  // Ensure id and user_id are present without duplicating columns the caller
  // already requested.
  const requested = new Set(
    extraColumns
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
  );
  requested.add("id");
  requested.add("user_id");
  return Array.from(requested).join(", ");
}

async function findPersonnelByOwners(
  supabase: SupabaseClient,
  ownerIds: string[],
  columns: string,
): Promise<Record<string, any> | null> {
  if (ownerIds.length === 0) return null;
  const select = buildPersonnelSelect(columns);
  const { data } = await supabase
    .from("personnel")
    .select(select)
    .in("user_id", ownerIds)
    .limit(1);
  const rows = (data as Record<string, any>[] | null) ?? [];
  return rows[0] ?? null;
}

export async function resolvePersonnelByAuthUser(
  supabase: SupabaseClient,
  authUserId: string,
  columns: string,
): Promise<Record<string, any> | null> {
  const { candidates } = await collectOwnerCandidates(supabase, authUserId);
  return findPersonnelByOwners(supabase, candidates, columns);
}

/**
 * Robustly resolves the personnel record for an authenticated user.
 *
 * Order of operations:
 *   1. Look up personnel by every possible owner id (auth uid + profile ids).
 *   2. Fall back to the provided personnel_id if supplied, validating
 *      ownership (tolerantly — accepts if the personnel row's user_id maps
 *      back to the authenticated user through any profile layout).
 *   3. If a profile exists with role='personnel' (or unspecified) but no
 *      personnel row exists, auto-create a minimal personnel row so the
 *      user isn't blocked by a broken signup halfway.
 */
export async function resolvePersonnelByAuthOrProvidedId(
  supabase: SupabaseClient,
  authUserId: string,
  columns: string,
  providedPersonnelId?: string | null,
): Promise<Record<string, any> | null> {
  const { candidates, profileId, profileRole, displayName } =
    await collectOwnerCandidates(supabase, authUserId);

  (globalThis as any).__lastResolvePersonnelState = {
    auth_user_id: authUserId,
    candidates,
    profile_id: profileId,
    profile_role: profileRole,
    provided_personnel_id: providedPersonnelId ?? null,
    byProvided_user_id: null as string | null,
    byProvided_found: false,
    fallback_reason: null as string | null,
  };

  const direct = await findPersonnelByOwners(supabase, candidates, columns);
  if (direct) return direct;

  if (providedPersonnelId) {
    const select = buildPersonnelSelect(columns);
    const { data: byProvided, error: byProvidedErr } = await supabase
      .from("personnel")
      .select(select)
      .eq("id", providedPersonnelId)
      .maybeSingle();

    if (byProvidedErr) {
      (globalThis as any).__lastResolvePersonnelState.fallback_reason =
        `byProvided error: ${byProvidedErr.message}`;
    }

    if (byProvided) {
      (globalThis as any).__lastResolvePersonnelState.byProvided_found = true;
      const ownerId = String((byProvided as any).user_id ?? "");
      (globalThis as any).__lastResolvePersonnelState.byProvided_user_id =
        ownerId;

      // Accept if owner id matches any known candidate OR if it maps back
      // to the authenticated user via any profile layout.
      if (candidates.includes(ownerId)) {
        return byProvided as Record<string, any>;
      }

      // Look up whether `ownerId` corresponds to a profile belonging to
      // the authenticated user (either as profile.id or profile.user_id).
      const { data: tiedByOwner } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", ownerId)
        .maybeSingle();
      if (
        tiedByOwner &&
        (String((tiedByOwner as any).id) === authUserId ||
          candidates.includes(String((tiedByOwner as any).id)))
      ) {
        return byProvided as Record<string, any>;
      }

      try {
        const { data: tiedByUser } = await supabase
          .from("profiles")
          .select("id, user_id, role")
          .eq("user_id", ownerId)
          .maybeSingle();
        if (
          tiedByUser &&
          ((tiedByUser as any).user_id === authUserId ||
            candidates.includes(String((tiedByUser as any).id)))
        ) {
          return byProvided as Record<string, any>;
        }
      } catch {
        // profiles.user_id may not exist — ignore.
      }

      (globalThis as any).__lastResolvePersonnelState.fallback_reason =
        `owner_id ${ownerId} does not map to auth user ${authUserId}`;
    }
  }

  // Bootstrap safety net: profile exists but no personnel row yet.
  if (profileId && (profileRole === null || profileRole === "personnel")) {
    const insertPayload: Record<string, any> = {
      user_id: profileId,
      display_name: displayName || "Security Professional",
    };

    const select = buildPersonnelSelect(columns);
    const { data: created, error: createErr } = await supabase
      .from("personnel")
      .insert(insertPayload)
      .select(select)
      .maybeSingle();

    if (createErr) {
      console.error(
        "[resolvePersonnel] Failed to auto-create personnel row:",
        createErr,
      );
      (globalThis as any).__lastResolvePersonnelError = {
        message: createErr.message,
        code: (createErr as any).code ?? null,
        details: (createErr as any).details ?? null,
        hint: (createErr as any).hint ?? null,
      };
    }
    if (created) return created as Record<string, any>;

    // Fallback: try with authUserId as user_id in case profileId differs.
    if (profileId !== authUserId) {
      const { data: created2, error: createErr2 } = await supabase
        .from("personnel")
        .insert({ ...insertPayload, user_id: authUserId })
        .select(select)
        .maybeSingle();
      if (createErr2) {
        console.error(
          "[resolvePersonnel] Fallback personnel insert failed:",
          createErr2,
        );
        (globalThis as any).__lastResolvePersonnelError2 = {
          message: createErr2.message,
          code: (createErr2 as any).code ?? null,
          details: (createErr2 as any).details ?? null,
          hint: (createErr2 as any).hint ?? null,
        };
      }
      if (created2) return created2 as Record<string, any>;
    }
  }

  return null;
}
