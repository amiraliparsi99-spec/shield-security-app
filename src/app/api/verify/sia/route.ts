import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SIA_API_URL = "https://api.siachecker.co.uk/v1/licences/verify";
const SIA_API_KEY = process.env.SIA_CHECKER_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies
              .getAll()
              .map((c) => ({ name: c.name, value: c.value }));
          },
          setAll() {},
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { valid: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { sia_number } = await request.json();

    const digits = (sia_number || "").replace(/\D/g, "");
    if (!digits || digits.length !== 16) {
      return NextResponse.json(
        { valid: false, message: "Invalid SIA number format. Must be 16 digits." },
        { status: 400 }
      );
    }

    if (!SIA_API_KEY) {
      console.error("[SIA] SIA_CHECKER_API_KEY not set");
      return NextResponse.json(
        { valid: false, message: "SIA verification is temporarily unavailable." },
        { status: 503 }
      );
    }

    const siaRes = await fetch(SIA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ licenceNumber: digits }),
    });

    const siaData = await siaRes.json().catch(() => null);

    if (!siaData) {
      console.error(`[SIA] API returned ${siaRes.status} with unparseable body`);
      return NextResponse.json(
        { valid: false, message: "SIA verification service error. Please try again." },
        { status: 502 }
      );
    }

    // 5xx = real API error; 4xx with NOT_FOUND = licence doesn't exist (expected)
    if (siaRes.status >= 500) {
      console.error(`[SIA] API server error ${siaRes.status}:`, siaData);
      return NextResponse.json(
        { valid: false, message: "SIA verification service is temporarily unavailable." },
        { status: 502 }
      );
    }

    if (siaData.status !== "FOUND" || !siaData.licence) {
      return NextResponse.json({
        valid: false,
        message: siaData.message || "SIA Licence not found on the register.",
        data: null,
      });
    }

    const licence = siaData.licence;
    const isActive = licence.status === "Active";
    const isExpired =
      licence.expiryDate && new Date(licence.expiryDate) < new Date();

    if (!isActive || isExpired) {
      return NextResponse.json({
        valid: false,
        message: `Licence is ${licence.status}${isExpired ? " (expired)" : ""}. Only active licences are accepted.`,
        data: {
          license_number: licence.licenceNumber,
          first_name: licence.firstName,
          last_name: licence.surname,
          role: licence.role,
          sector: licence.licenceSector,
          status: licence.status,
          expiry_date: licence.expiryDate,
        },
      });
    }

    return NextResponse.json({
      valid: true,
      message: "Licence verified successfully.",
      data: {
        license_number: licence.licenceNumber,
        first_name: licence.firstName,
        last_name: licence.surname,
        role: licence.role,
        sector: licence.licenceSector,
        status: licence.status,
        expiry_date: licence.expiryDate,
      },
    });
  } catch (error: any) {
    console.error("[SIA] Verification error:", error);
    return NextResponse.json(
      { valid: false, message: "Internal server error during SIA check." },
      { status: 500 }
    );
  }
}
