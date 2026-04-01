import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

const TOTAL_STEPS = 3;

const STEP_INFO = [
  { key: "personal_details", title: "Personal Details", icon: "\u{1F464}", guidance: "Enter your legal name and full address. This confirms your location for venue matching." },
  { key: "sia_license", title: "SIA Licence", icon: "\u{1FAAA}", guidance: "Enter your 16-digit SIA licence number. We\u2019ll verify it against the official SIA register." },
] as const;

interface SIAVerifyResult {
  valid: boolean;
  message: string;
  data?: {
    license_number: string;
    first_name: string;
    last_name: string;
    role: string;
    sector: string;
    status: string;
    expiry_date: string;
  } | null;
}

interface VerificationDashboardProps {
  ownerType: "personnel" | "agency";
  ownerId: string;
  profileId?: string;
  authUserId?: string;
  onComplete?: () => void;
}

export function VerificationDashboard({
  ownerType,
  ownerId,
  profileId,
  authUserId,
  onComplete,
}: VerificationDashboardProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personnelData, setPersonnelData] = useState<any>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);

  // Personal details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Postcode lookup
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [postcodeAddresses, setPostcodeAddresses] = useState<any[]>([]);
  const [resolvedLat, setResolvedLat] = useState<number | null>(null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(null);

  // SIA
  const [siaNumber, setSiaNumber] = useState("");
  const [siaExpiry, setSiaExpiry] = useState("");

  function formatSIANumber(text: string): string {
    const digits = text.replace(/\D/g, "").slice(0, 16);
    const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12), digits.slice(12, 16)].filter(Boolean);
    return parts.join("-");
  }

  function formatExpiryDate(text: string): string {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  const [siaVerifying, setSiaVerifying] = useState(false);
  const [siaError, setSiaError] = useState<string | null>(null);
  const [siaResult, setSiaResult] = useState<SIAVerifyResult | null>(null);

  useEffect(() => {
    loadData();
  }, [ownerType, ownerId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error("Supabase not configured");

      if (ownerType === "personnel") {
        const { data: pData } = await supabase
          .from("personnel")
          .select("first_name, last_name, address_line1, address_line2, city, postcode, sia_license_number, sia_expiry_date, display_name, user_id, verification_status, latitude, longitude")
          .eq("id", ownerId)
          .single();
        setPersonnelData(pData);
        if (pData) {
          setFirstName(pData.first_name || "");
          setLastName(pData.last_name || "");
          setAddressLine1(pData.address_line1 || "");
          setAddressLine2(pData.address_line2 || "");
          setCity(pData.city || "");
          setPostcode(pData.postcode || "");
          setSiaNumber(pData.sia_license_number || "");
          setSiaExpiry(pData.sia_expiry_date || "");
        }
      }

      let { data: verificationData } = await supabase
        .from("verifications")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (!verificationData) {
        const { data: created } = await supabase
          .from("verifications")
          .insert({ owner_type: ownerType, owner_id: ownerId, status: "pending" })
          .select()
          .single();
        verificationData = created;
      }

      setVerification(verificationData);
    } catch (err: any) {
      console.error("Error loading verification data:", err);
    } finally {
      setLoading(false);
    }
  }

  const apiBase =
    process.env.EXPO_PUBLIC_API_URL ||
    (typeof __DEV__ !== "undefined" && __DEV__ ? "http://127.0.0.1:3000" : "");

  async function verifySIALicence(): Promise<SIAVerifyResult | null> {
    const digits = siaNumber.replace(/\D/g, "");
    if (!digits || digits.length !== 16) {
      setSiaError("SIA licence must be 16 digits.");
      return null;
    }
    setSiaVerifying(true);
    setSiaError(null);
    setSiaResult(null);
    try {
      const res = await fetch(`${apiBase}/api/verify/sia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sia_number: digits }),
      });
      const json: SIAVerifyResult = await res.json();
      setSiaResult(json);
      if (!json.valid) {
        setSiaError(json.message || "Licence could not be verified.");
        return null;
      }
      if (json.data?.expiry_date) {
        setSiaExpiry(json.data.expiry_date);
      }
      return json;
    } catch (err: any) {
      setSiaError("Could not reach verification service. Check your connection.");
      return null;
    } finally {
      setSiaVerifying(false);
    }
  }

  function convertToISODate(dateStr: string): string | null {
    if (!dateStr) return null;
    // Already YYYY-MM-DD from API
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // DD/MM/YYYY → YYYY-MM-DD
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return dateStr;
  }

  async function saveSIADetails() {
    if (!supabase) return;
    const digits = siaNumber.replace(/\D/g, "");
    try {
      const { error: err } = await supabase
        .from("personnel")
        .update({
          sia_license_number: digits || null,
          sia_expiry_date: convertToISODate(siaExpiry.trim()) || null,
        })
        .eq("id", ownerId);
      if (err) throw err;
      await loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save SIA details");
    }
  }

  async function lookupPostcode() {
    const trimmed = postcode.trim().replace(/\s+/g, "").toUpperCase();
    if (!trimmed) {
      setPostcodeError("Please enter a postcode");
      return;
    }
    setPostcodeLoading(true);
    setPostcodeError(null);
    setPostcodeAddresses([]);
    try {
      const apiKey = process.env.EXPO_PUBLIC_IDEAL_POSTCODES_KEY || "ak_test";
      const res = await fetch(
        `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(trimmed)}?api_key=${apiKey}`
      );
      const json = await res.json();
      if (json.result && json.result.length > 0) {
        setPostcodeAddresses(json.result);
        const first = json.result[0];
        if (first.latitude && first.longitude) {
          setResolvedLat(first.latitude);
          setResolvedLng(first.longitude);
        }
      } else {
        setPostcodeError("No addresses found for this postcode.");
      }
    } catch {
      setPostcodeError("Could not look up postcode.");
    } finally {
      setPostcodeLoading(false);
    }
  }

  function selectAddress(addr: any) {
    setAddressLine1(addr.line_1 || "");
    setAddressLine2(addr.line_2 || "");
    setCity(addr.post_town || addr.town_or_city || "");
    setPostcode(addr.postcode || postcode);
    if (addr.latitude && addr.longitude) {
      setResolvedLat(addr.latitude);
      setResolvedLng(addr.longitude);
    }
    setPostcodeAddresses([]);
  }

  async function savePersonalDetails() {
    if (!supabase) return;
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const updateData: Record<string, any> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim(),
        postcode: postcode.trim() || null,
        display_name: `${firstName.trim()} ${lastName.trim()}`,
      };

      if (resolvedLat != null && resolvedLng != null) {
        updateData.latitude = resolvedLat;
        updateData.longitude = resolvedLng;
      }

      const { error: err } = await supabase
        .from("personnel")
        .update(updateData)
        .eq("id", ownerId);
      if (err) throw err;
      await loadData();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to save details");
      throw err;
    } finally {
      setSavingDetails(false);
    }
  }

  // Completion checks
  const hasSIA = !!personnelData?.sia_license_number;
  const hasPersonalDetails = !!personnelData?.first_name && !!personnelData?.last_name && !!personnelData?.city;

  // Stripe account is created when the user taps "Connect Bank Account" in Payments.
  // This ensures the personnel data is fully saved before the account is created.

  function isCurrentStepComplete(): boolean {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return !!firstName.trim() && !!lastName.trim() && !!addressLine1.trim() && !!city.trim() && !!postcode.trim();
      case 3:
        return !!siaNumber.trim() && !!siaExpiry.trim();
      default:
        return true;
    }
  }

  function getStepHint(): string | null {
    switch (currentStep) {
      case 2: {
        const missing: string[] = [];
        if (!firstName.trim()) missing.push("first name");
        if (!lastName.trim()) missing.push("last name");
        if (!addressLine1.trim()) missing.push("address");
        if (!city.trim()) missing.push("city");
        if (!postcode.trim()) missing.push("postcode");
        return missing.length ? `Please add your ${missing.join(", ")}` : null;
      }
      case 3: {
        const missing: string[] = [];
        if (!siaNumber.trim()) missing.push("licence number");
        if (!siaExpiry.trim()) missing.push("expiry date");
        return missing.length ? `Please add your ${missing.join(", ")}` : null;
      }
      default:
        return null;
    }
  }

  const stepComplete = isCurrentStepComplete();
  const stepHint = getStepHint();

  const allStepsSubmitted =
    ownerType === "personnel" && hasPersonalDetails && hasSIA;
  const isVerified = verification?.status === "verified";
  const alreadySubmitted = verification?.status === "submitted" || verification?.status === "verified" || allStepsSubmitted;

  useEffect(() => {
    if (!loading && ownerType === "personnel" && alreadySubmitted && currentStep <= TOTAL_STEPS) {
      setCurrentStep(TOTAL_STEPS + 1);
    }
  }, [loading, ownerType, alreadySubmitted, currentStep]);

  async function markVerificationVerified() {
    if (!verification?.id) return;
    try {
      const res = await fetch(`${apiBase}/api/verify/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verification.id,
          status: "verified",
          identity_verified: true,
        }),
      });
      const json = await res.json();
      console.log("[Verify] markVerified response:", json);
    } catch (err) {
      console.error("[Verify] markVerified error:", err);
    }
  }

  async function markVerificationSubmitted() {
    if (!verification?.id) return;
    try {
      const res = await fetch(`${apiBase}/api/verify/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verification.id,
          status: "submitted",
        }),
      });
      const json = await res.json();
      console.log("[Verify] markSubmitted response:", json);
    } catch (err) {
      console.error("[Verify] markSubmitted error:", err);
    }
  }

  function namesMatch(siaData: SIAVerifyResult["data"]): boolean {
    if (!siaData) return false;
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const siaFirst = normalize(siaData.first_name || "");
    const siaLast = normalize(siaData.last_name || "");
    const enteredFirst = normalize(firstName);
    const enteredLast = normalize(lastName);
    // Exact match (case-insensitive)
    if (siaFirst === enteredFirst && siaLast === enteredLast) return true;
    // SIA first name might contain middle names — check if entered first name is the first word
    const siaFirstWord = siaFirst.split(" ")[0];
    if (siaFirstWord === enteredFirst && siaLast === enteredLast) return true;
    return false;
  }

  const handleNext = async () => {
    if (currentStep === 2) {
      try {
        await savePersonalDetails();
      } catch {
        return;
      }
    }
    if (currentStep === 3) {
      const siaResponse = await verifySIALicence();
      if (!siaResponse) return;
      await saveSIADetails();

      // Show verifying loading screen
      setVerifyingAccount(true);

      // Use the freshly returned data, not stale React state
      const matched = namesMatch(siaResponse.data || null);
      console.log("[Verify] Name match check:", {
        siaFirst: siaResponse.data?.first_name,
        siaLast: siaResponse.data?.last_name,
        enteredFirst: firstName,
        enteredLast: lastName,
        matched,
      });

      // Wait 6 seconds for the verification animation
      await new Promise((resolve) => setTimeout(resolve, 6000));

      if (matched) {
        await markVerificationVerified();
        setVerification((prev: any) => prev ? { ...prev, status: "verified", identity_verified: true } : prev);
      } else {
        await markVerificationSubmitted();
        setVerification((prev: any) => prev ? { ...prev, status: "submitted" } : prev);
      }

      setVerifyingAccount(false);
      setCurrentStep(TOTAL_STEPS + 1);
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      await markVerificationSubmitted();
      setCurrentStep(TOTAL_STEPS + 1);
    }
  };

  const handleDone = () => {
    onComplete?.();
    router.back();
  };

  const isCompleteView = currentStep > TOTAL_STEPS;

  const handleBack = () => {
    if (isCompleteView) {
      onComplete?.();
      router.back();
      return;
    }
    if (currentStep > 1) setCurrentStep(currentStep - 1);
    else router.back();
  };

  const renderProgressBar = () => (
    <View style={styles.stepperProgressContainer}>
      <View style={styles.stepperProgressBar}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => {
          const pastThisStep = currentStep > step;
          const showTick = pastThisStep;
          const isCurrentStep = step === Math.min(currentStep, TOTAL_STEPS) && !isCompleteView;
          return (
            <View key={step} style={styles.stepperStepContainer}>
              <View style={[
                styles.stepperDot,
                isCurrentStep && styles.stepperDotActive,
                showTick && styles.stepperDotCompleted,
              ]}>
                {showTick ? (
                  <Text style={styles.stepperCheck}>{"\u2713"}</Text>
                ) : (
                  <Text style={[styles.stepperNumber, isCurrentStep && styles.stepperNumberActive]}>{step}</Text>
                )}
              </View>
              {step < TOTAL_STEPS && (
                <View style={[styles.stepperLine, showTick && styles.stepperLineActive]} />
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.stepperProgressText}>
        {currentStep === 1 ? "Overview" : isCompleteView ? "Complete" : `Step ${currentStep} of ${TOTAL_STEPS}`}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading verification data...</Text>
      </View>
    );
  }

  if (verifyingAccount) {
    return (
      <View style={[styles.stepperContainer, { justifyContent: "center", alignItems: "center" }]}>
        <View style={styles.verifyingWrap}>
          <View style={styles.verifyingIconWrap}>
            <Text style={styles.verifyingIcon}>{"\u{1F6E1}\uFE0F"}</Text>
          </View>
          <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: spacing.lg }} />
          <Text style={styles.verifyingTitle}>Verifying your account...</Text>
          <Text style={styles.verifyingSubtitle}>
            Checking your details against the SIA register. This will only take a moment.
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderIntroStep = () => (
    <View style={styles.introStep}>
      <View style={styles.introIconWrap}>
        <Text style={styles.introIcon}>{"\u{1F6E1}\uFE0F"}</Text>
      </View>
      <Text style={styles.introTitle}>Get verified</Text>
      <Text style={styles.introSubtitle}>
        Verified security professionals get more booking requests and appear higher in search results. Venues trust verified profiles.
      </Text>
      <View style={styles.introList}>
        <View style={styles.introListItem}>
          <Text style={styles.introListIcon}>{"\u{1F464}"}</Text>
          <Text style={styles.introListText}>Personal Details {"\u2013"} legal name and full address</Text>
        </View>
        <View style={styles.introListItem}>
          <Text style={styles.introListIcon}>{"\u{1FAAA}"}</Text>
          <Text style={styles.introListText}>SIA Licence {"\u2013"} verified against the official register</Text>
        </View>
      </View>
      <Text style={styles.introNote}>
        After verification, connect your bank account in the Payments tab to start receiving payouts.
      </Text>
    </View>
  );

  const renderPersonalDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{STEP_INFO[0].title}</Text>
      <Text style={styles.stepDescription}>{STEP_INFO[0].guidance}</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Legal First Name *</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="e.g. John"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Legal Last Name *</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="e.g. Smith"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Postcode *</Text>
        <View style={styles.postcodeRow}>
          <TextInput
            style={[styles.input, styles.postcodeInput]}
            value={postcode}
            onChangeText={setPostcode}
            placeholder="e.g. B21 9JB"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.postcodeLookupBtn, postcodeLoading && styles.postcodeLookupBtnDisabled]}
            onPress={lookupPostcode}
            disabled={postcodeLoading}
          >
            {postcodeLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.postcodeLookupText}>Find Address</Text>
            )}
          </TouchableOpacity>
        </View>
        {postcodeError && <Text style={styles.fieldError}>{postcodeError}</Text>}
      </View>

      {postcodeAddresses.length > 0 && (
        <View style={styles.addressListContainer}>
          <Text style={styles.addressListTitle}>Select your address:</Text>
          <ScrollView style={styles.addressList} nestedScrollEnabled>
            {postcodeAddresses.map((addr, i) => (
              <TouchableOpacity
                key={i}
                style={styles.addressListItem}
                onPress={() => selectAddress(addr)}
              >
                <Text style={styles.addressListItemText}>
                  {[addr.line_1, addr.line_2, addr.post_town].filter(Boolean).join(", ")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Address Line 1 *</Text>
        <TextInput
          style={styles.input}
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="e.g. 123 High Street"
          placeholderTextColor={colors.textMuted}
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="Optional"
          placeholderTextColor={colors.textMuted}
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>City *</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Birmingham"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
      </View>

      {detailsError && (
        <View style={styles.siaErrorCard}>
          <Text style={styles.siaErrorIcon}>{"\u26A0\uFE0F"}</Text>
          <Text style={styles.siaErrorText}>{detailsError}</Text>
        </View>
      )}
    </View>
  );

  const renderSIAStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{STEP_INFO[1].title}</Text>
      <Text style={styles.stepDescription}>{STEP_INFO[1].guidance}</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Licence Number *</Text>
        <TextInput
          style={styles.input}
          value={siaNumber}
          onChangeText={(text) => setSiaNumber(formatSIANumber(text))}
          placeholder="e.g. XXXX-XXXX-XXXX-XXXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={19}
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Expiry Date</Text>
        <TextInput
          style={styles.input}
          value={siaExpiry}
          onChangeText={(text) => setSiaExpiry(formatExpiryDate(text))}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>

      {siaResult?.valid && (
        <View style={styles.siaSuccessCard}>
          <Text style={styles.siaSuccessIcon}>{"\u2705"}</Text>
          <Text style={styles.siaSuccessTitle}>Licence Verified</Text>
          <Text style={styles.siaSuccessText}>
            {siaResult.data?.first_name} {siaResult.data?.last_name} {"\u2013"} {siaResult.data?.role}
          </Text>
          <Text style={styles.siaSuccessText}>
            Status: {siaResult.data?.status} | Expires: {siaResult.data?.expiry_date}
          </Text>
        </View>
      )}

      {siaError && (
        <View style={styles.siaErrorCard}>
          <Text style={styles.siaErrorIcon}>{"\u26A0\uFE0F"}</Text>
          <Text style={styles.siaErrorText}>{siaError}</Text>
        </View>
      )}

      {(siaNumber.trim() || siaExpiry.trim()) && !siaResult?.valid && (
        <View style={styles.siaSummaryCard}>
          <Text style={styles.siaSummaryTitle}>What you've entered</Text>
          {siaNumber.trim() ? (
            <Text style={styles.siaSummaryText}>License: {siaNumber.trim()}</Text>
          ) : null}
          {siaExpiry.trim() ? (
            <Text style={styles.siaSummaryText}>
              Expires: {(() => {
                const d = siaExpiry.trim();
                try {
                  const parsed = new Date(d);
                  if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                } catch {}
                return d;
              })()}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  const renderCompletionView = () => (
    <View style={[styles.completeView, styles.completeViewVerified]}>
      {isVerified ? (
        <>
          <View style={[styles.completeIconWrap, { backgroundColor: colors.successSoft }]}>
            <Text style={[styles.completeIcon, { color: colors.success }]}>{"\u2713"}</Text>
          </View>
          <Text style={styles.completeTitle}>Account Verified</Text>
          <Text style={styles.completeSubtitle}>
            Your identity and SIA licence have been verified. You're ready to start accepting shifts.
          </Text>
        </>
      ) : (
        <>
          <View style={[styles.completeIconWrap, { backgroundColor: colors.warningSoft }]}>
            <Text style={styles.completeIcon}>{"\u26A0\uFE0F"}</Text>
          </View>
          <Text style={styles.completeTitle}>Details don't match</Text>
          <Text style={styles.completeSubtitle}>
            The name on your SIA licence doesn't match the personal details you entered. Please check your details and try again.
          </Text>

          <TouchableOpacity
            style={styles.tryAgainButton}
            onPress={() => {
              setSiaResult(null);
              setSiaError(null);
              setCurrentStep(2);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.tryAgainText}>Try Again</Text>
          </TouchableOpacity>
        </>
      )}

      {isVerified && (
        <>
          <View style={styles.completeSummary}>
            <Text style={styles.completeSummaryTitle}>Verification summary</Text>
            {personnelData?.first_name && (
              <View style={styles.completeSummaryRow}>
                <Text style={[styles.completeSummaryCheck, { color: colors.success }]}>{"\u2713"}</Text>
                <View style={styles.completeSummaryThumbRow}>
                  <View style={styles.completeThumbIcon}><Text style={styles.completeThumbIconText}>{"\u{1F464}"}</Text></View>
                  <Text style={styles.completeSummaryText}>
                    {personnelData.first_name} {personnelData.last_name}{personnelData.city ? ` \u2014 ${personnelData.city}` : ""}
                  </Text>
                </View>
              </View>
            )}
            {(hasSIA || personnelData?.sia_license_number) && (
              <View style={styles.completeSummaryRow}>
                <Text style={[styles.completeSummaryCheck, { color: colors.success }]}>{"\u2713"}</Text>
                <View style={styles.completeSummaryThumbRow}>
                  <View style={styles.completeThumbIcon}><Text style={styles.completeThumbIconText}>{"\u{1FAAA}"}</Text></View>
                  <Text style={styles.completeSummaryText}>
                    SIA Licence {"\u2013"} Verified
                    {personnelData?.sia_expiry_date
                      ? ` (expires ${new Date(personnelData.sia_expiry_date).toLocaleDateString("en-GB")})`
                      : ""}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.goToPaymentsButton}
            onPress={() => { onComplete?.(); router.replace("/(tabs)/payments"); }}
            activeOpacity={0.7}
          >
            <Text style={styles.goToPaymentsIcon}>{"\u{1F3E6}"}</Text>
            <Text style={styles.goToPaymentsText}>Go to Payments to set up your bank account</Text>
            <Text style={styles.goToPaymentsArrow}>{"\u2192"}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (ownerType !== "personnel") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Verification</Text>
          <Text style={styles.helpText2}>Agency verification steps can be added here.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.stepperContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {isCompleteView ? (
          <View style={styles.headerBackButton} />
        ) : (
          <TouchableOpacity onPress={handleBack} style={styles.headerBackButton}>
            <Text style={styles.headerBackButtonText}>{"\u2039"}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>{"\u{1F6E1}\uFE0F"}</Text>
          </View>
          <Text style={styles.headerTitle}>Verification</Text>
        </View>
        <View style={styles.headerBackButton} />
      </View>

      {renderProgressBar()}

      <ScrollView
        style={styles.stepperScrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isCompleteView && renderCompletionView()}
        {currentStep === 1 && renderIntroStep()}
        {currentStep === 2 && renderPersonalDetailsStep()}
        {currentStep === 3 && renderSIAStep()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        {isCompleteView ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleDone}>
            <Text style={styles.nextButtonText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <>
            {stepHint && currentStep > 1 && (
              <Text style={styles.stepHintText}>{stepHint}</Text>
            )}
            <TouchableOpacity
              style={[styles.nextButton, ((!stepComplete && currentStep > 1) || siaVerifying || savingDetails) && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={(!stepComplete && currentStep > 1) || siaVerifying || savingDetails}
              activeOpacity={0.7}
            >
              {siaVerifying && currentStep === 3 ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.text} />
                  <Text style={styles.nextButtonText}>Verifying licence...</Text>
                </View>
              ) : savingDetails && currentStep === 2 ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.text} />
                  <Text style={styles.nextButtonText}>Saving details...</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.nextButtonText, !stepComplete && currentStep > 1 && styles.nextButtonTextDisabled]}>
                    {currentStep === 1 ? "Get Started" : currentStep === 2 ? "Save & Continue" : currentStep === TOTAL_STEPS ? "Verify & Submit" : "Next"}
                  </Text>
                  {currentStep > 1 && currentStep < TOTAL_STEPS && stepComplete && !siaVerifying && !savingDetails && <Text style={styles.nextButtonArrow}>{"\u2192"}</Text>}
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  centered: { padding: spacing.xl, alignItems: "center" },
  loadingText: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.md },
  errorBox: {
    padding: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: "#ef444420",
    borderWidth: 1,
    borderColor: "#ef444440",
  },
  errorText: { ...typography.bodySmall, color: "#ef4444" },

  stepperContainer: { flex: 1, backgroundColor: colors.background },
  stepperScrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerBackButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerBackButtonText: { fontSize: 32, color: colors.accent, fontWeight: "300" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { ...typography.title, color: colors.text },

  // Progress bar
  stepperProgressContainer: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  stepperProgressBar: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  stepperStepContainer: { flexDirection: "row", alignItems: "center" },
  stepperDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepperDotActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  stepperDotCompleted: { borderColor: colors.accent, backgroundColor: colors.accent },
  stepperCheck: { color: "#fff", fontSize: 14, fontWeight: "700" },
  stepperNumber: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  stepperNumberActive: { color: colors.accent },
  stepperLine: { width: 32, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  stepperLineActive: { backgroundColor: colors.accent },
  stepperProgressText: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },

  // Intro
  introStep: { paddingTop: spacing.xxl, alignItems: "center" },
  introIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  introIcon: { fontSize: 36 },
  introTitle: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  introSubtitle: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: spacing.xxl },
  introList: { width: "100%", gap: spacing.md, marginBottom: spacing.xxl },
  introListItem: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  introListIcon: { fontSize: 24 },
  introListText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  introNote: { ...typography.caption, color: colors.textMuted, textAlign: "center", lineHeight: 18, fontStyle: "italic" },

  // Step content
  stepContent: { paddingTop: spacing.lg },
  stepTitle: { ...typography.display, fontSize: 22, color: colors.text, marginBottom: spacing.xs },
  stepDescription: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.xxl },

  // Fields
  fieldGroup: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    ...typography.body, color: colors.text,
  },
  fieldError: { ...typography.caption, color: colors.error, marginTop: spacing.xs },

  // Postcode
  postcodeRow: { flexDirection: "row", gap: spacing.sm },
  postcodeInput: { flex: 1 },
  postcodeLookupBtn: {
    backgroundColor: colors.accentSoft, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, justifyContent: "center",
    borderWidth: 1, borderColor: colors.accent,
  },
  postcodeLookupBtnDisabled: { opacity: 0.6 },
  postcodeLookupText: { ...typography.label, color: colors.accent },

  // Address list
  addressListContainer: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg, overflow: "hidden",
  },
  addressListTitle: { ...typography.label, color: colors.textSecondary, padding: spacing.md, paddingBottom: spacing.xs },
  addressList: { maxHeight: 200 },
  addressListItem: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addressListItemText: { ...typography.bodySmall, color: colors.text },

  // SIA
  siaSuccessCard: {
    backgroundColor: colors.successSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.success,
    padding: spacing.lg, marginBottom: spacing.lg, alignItems: "center", gap: spacing.xs,
  },
  siaSuccessIcon: { fontSize: 24 },
  siaSuccessTitle: { ...typography.titleCard, color: colors.success },
  siaSuccessText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
  siaErrorCard: {
    backgroundColor: colors.errorSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.error,
    padding: spacing.lg, marginBottom: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  siaErrorIcon: { fontSize: 18 },
  siaErrorText: { ...typography.bodySmall, color: colors.errorLight, flex: 1 },
  siaSummaryCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginTop: spacing.sm,
  },
  siaSummaryTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  siaSummaryText: { ...typography.bodySmall, color: colors.text, marginBottom: spacing.xs },

  // Completion
  completeView: { paddingTop: spacing.xxl, alignItems: "center" },
  completeViewVerified: {
    backgroundColor: colors.accentSoft,
    marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl, borderRadius: radius.lg,
  },
  completeIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  completeIcon: { fontSize: 32, color: colors.accent },
  completeTitle: { ...typography.display, fontSize: 24, color: colors.text, marginBottom: spacing.sm },
  completeSubtitle: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginTop: spacing.sm },
  completeNote: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg, fontStyle: "italic" },
  completeSummary: {
    marginTop: spacing.xxl, width: "100%",
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
  completeSummaryTitle: { ...typography.titleCard, color: colors.text, marginBottom: spacing.md },
  completeSummaryRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm },
  completeSummaryCheck: { fontSize: 14, color: colors.success, fontWeight: "bold" },
  completeSummaryText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  completeSummaryThumbRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  completeThumbIcon: {
    width: 40, height: 40, borderRadius: radius.xs,
    backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center",
  },
  completeThumbIconText: { fontSize: 20 },

  // Footer
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  nextButton: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: spacing.sm,
  },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { ...typography.body, fontWeight: "600", color: colors.textInverse },
  nextButtonTextDisabled: { opacity: 0.7 },
  nextButtonArrow: { fontSize: 18, color: colors.textInverse },
  stepHintText: { ...typography.caption, color: colors.warning, textAlign: "center", marginBottom: spacing.sm },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

  // Verifying account loading screen
  verifyingWrap: { alignItems: "center", paddingHorizontal: spacing.xl },
  verifyingIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xxl,
  },
  verifyingIcon: { fontSize: 40 },
  verifyingTitle: { ...typography.display, fontSize: 22, color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  verifyingSubtitle: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 24 },

  // Try Again button
  tryAgainButton: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, paddingHorizontal: spacing.xl,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.xl, width: "100%",
  },
  tryAgainText: { ...typography.body, fontWeight: "600", color: colors.textInverse },

  // Go to Payments button
  goToPaymentsButton: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.accentSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent,
    padding: spacing.lg, marginTop: spacing.xxl, width: "100%",
  },
  goToPaymentsIcon: { fontSize: 24 },
  goToPaymentsText: { ...typography.body, color: colors.accent, flex: 1, fontWeight: "500" },
  goToPaymentsArrow: { fontSize: 20, color: colors.accent },

  // Help card (agency fallback)
  helpCard: { padding: spacing.lg },
  helpTitle: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  helpText2: { ...typography.body, color: colors.textMuted },
});
