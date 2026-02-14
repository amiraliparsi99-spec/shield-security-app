import { createClient } from "@/lib/supabase/server";
import { ComplianceVault } from "@/components/agency";

async function getComplianceData(supabase: any, userId: string) {
  // Get profile and agency
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) return null;

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("owner_id", profile.id)
    .single();

  if (!agency) return null;

  // Get all staff with their SIA details
  const { data: staff } = await supabase
    .from("agency_staff")
    .select(`
      id,
      display_name,
      sia_badge_number,
      sia_expiry,
      status,
      personnel:personnel_id (
        id,
        display_name,
        sia_license_number,
        sia_expiry_date,
        certs
      )
    `)
    .eq("agency_id", agency.id);

  // Transform staff data
  const staffList = (staff || []).map((s: any) => ({
    id: s.id,
    name: s.display_name || s.personnel?.display_name || "Unknown",
    siaNumber: s.sia_badge_number || s.personnel?.sia_license_number,
    siaExpiry: s.sia_expiry || s.personnel?.sia_expiry_date,
    documents: [],
  }));

  // Create mock documents from staff SIA data for demo
  const documents = staffList
    .filter((s: any) => s.siaNumber)
    .map((s: any) => {
      const expiryDate = s.siaExpiry ? new Date(s.siaExpiry) : null;
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let status: "valid" | "expiring_soon" | "expired" = "valid";
      if (expiryDate) {
        if (expiryDate < now) {
          status = "expired";
        } else if (expiryDate < thirtyDaysFromNow) {
          status = "expiring_soon";
        }
      }

      return {
        id: `sia-${s.id}`,
        staffId: s.id,
        staffName: s.name,
        type: "sia_license" as const,
        documentNumber: s.siaNumber,
        expiryDate: s.siaExpiry,
        status,
        uploadedAt: new Date().toISOString(),
      };
    });

  return {
    agency,
    staff: staffList,
    documents,
  };
}

export default async function CompliancePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const data = session ? await getComplianceData(supabase, session.user.id) : null;

  return (
    <div className="px-4 py-6 sm:px-6">
      <ComplianceVault 
        documents={data?.documents || []} 
        staff={data?.staff || []} 
      />
    </div>
  );
}
