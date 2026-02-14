"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useVenueProfile, useCreateBooking } from "@/hooks";
import { useSupabase } from "@/hooks/useSupabase";
import { 
  checkPersonnelAvailabilityDetailed, 
  type AvailabilityCheckResult 
} from "@/lib/db/availability";
import { autoAssignShifts } from "@/lib/db/assignment";
import { createMissionControlChat } from "@/lib/db/mission-control";
import type { Personnel } from "@/lib/database.types";

type StaffRequirement = {
  role: string;
  quantity: number;
  rate: number;
};

type PersonnelWithAvailability = Personnel & {
  availabilityInfo?: AvailabilityCheckResult;
};

const roleOptions = [
  { value: "Door Security", rate: 18 },
  { value: "Floor Security", rate: 16 },
  { value: "VIP Security", rate: 22 },
  { value: "Event Security", rate: 16 },
  { value: "CCTV Operator", rate: 17 },
  { value: "Supervisor", rate: 25 },
];

export default function NewBookingPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { data: venue, loading: venueLoading } = useVenueProfile();
  const { mutate: createBooking, loading: submitting } = useCreateBooking();
  
  const [step, setStep] = useState(1);
  const [staffSelection, setStaffSelection] = useState<"auto" | "manual">("auto");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffFilter, setStaffFilter] = useState<"all" | "available">("available");
  const [availablePersonnel, setAvailablePersonnel] = useState<PersonnelWithAvailability[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [availabilityStats, setAvailabilityStats] = useState({ available: 0, unavailable: 0, total: 0 });
  
  const [formData, setFormData] = useState({
    eventName: "",
    date: "",
    startTime: "",
    endTime: "",
    staffRequirements: [{ role: "Door Security", quantity: 2, rate: 18 }] as StaffRequirement[],
    briefNotes: "",
  });

  // Fetch available personnel with smart availability checking
  useEffect(() => {
    const fetchAvailablePersonnel = async () => {
      if (!formData.date || !formData.startTime || !formData.endTime) return;
      
      setLoadingStaff(true);
      try {
        // Get all active personnel
        const { data, error } = await supabase
          .from('personnel')
          .select('*')
          .eq('is_active', true)
          .order('shield_score', { ascending: false });
        
        if (!error && data) {
          // Check availability for each personnel
          const personnelWithAvailability: PersonnelWithAvailability[] = [];
          let availableCount = 0;
          let unavailableCount = 0;
          
          for (const person of data) {
            const availabilityInfo = await checkPersonnelAvailabilityDetailed(
              supabase,
              person.id,
              formData.date,
              formData.startTime,
              formData.endTime
            );
            
            personnelWithAvailability.push({
              ...person,
              availabilityInfo,
            });
            
            if (availabilityInfo.available) {
              availableCount++;
            } else {
              unavailableCount++;
            }
          }
          
          // Sort: available first, then by shield score
          personnelWithAvailability.sort((a, b) => {
            if (a.availabilityInfo?.available && !b.availabilityInfo?.available) return -1;
            if (!a.availabilityInfo?.available && b.availabilityInfo?.available) return 1;
            return (b.shield_score || 0) - (a.shield_score || 0);
          });
          
          setAvailablePersonnel(personnelWithAvailability);
          setAvailabilityStats({
            available: availableCount,
            unavailable: unavailableCount,
            total: data.length,
          });
        }
      } catch (e) {
        console.error("Error fetching personnel:", e);
      } finally {
        setLoadingStaff(false);
      }
    };
    
    fetchAvailablePersonnel();
  }, [formData.date, formData.startTime, formData.endTime, supabase]);

  const addStaffRequirement = () => {
    setFormData(prev => ({
      ...prev,
      staffRequirements: [
        ...prev.staffRequirements,
        { role: "Floor Security", quantity: 1, rate: 16 }
      ]
    }));
  };

  const updateStaffRequirement = (index: number, field: keyof StaffRequirement, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      staffRequirements: prev.staffRequirements.map((req, i) => {
        if (i === index) {
          if (field === "role") {
            const roleOption = roleOptions.find(r => r.value === value);
            return { ...req, role: value as string, rate: roleOption?.rate || 16 };
          }
          return { ...req, [field]: value };
        }
        return req;
      })
    }));
  };

  const removeStaffRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      staffRequirements: prev.staffRequirements.filter((_, i) => i !== index)
    }));
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaff(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const calculateHours = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const [startH, startM] = formData.startTime.split(":").map(Number);
    const [endH, endM] = formData.endTime.split(":").map(Number);
    let hours = endH - startH + (endM - startM) / 60;
    if (hours <= 0) hours += 24;
    return hours;
  };

  const calculateTotal = () => {
    const hours = calculateHours();
    if (staffSelection === "manual" && selectedStaff.length > 0) {
      const selectedStaffData = availablePersonnel.filter(s => selectedStaff.includes(s.id));
      return selectedStaffData.reduce((sum, s) => sum + ((s.hourly_rate || 16) * hours), 0);
    }
    return formData.staffRequirements.reduce((sum, req) => sum + (req.quantity * req.rate * hours), 0);
  };

  const totalStaff = staffSelection === "manual" 
    ? selectedStaff.length 
    : formData.staffRequirements.reduce((sum, req) => sum + req.quantity, 0);

  const handleSubmit = async () => {
    if (!venue) {
      alert("Venue not found. Please try again.");
      return;
    }

    const hours = calculateHours();
    const estimatedTotal = calculateTotal();

    console.log("Creating booking for venue:", venue.id, venue.name);
    console.log("Booking data:", {
      venue_id: venue.id,
      event_name: formData.eventName,
      event_date: formData.date,
      start_time: formData.startTime,
      end_time: formData.endTime,
      staff_requirements: formData.staffRequirements,
      estimated_total: estimatedTotal,
    });

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        venue_id: venue.id,
        event_name: formData.eventName,
        event_date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        brief_notes: formData.briefNotes || null,
        staff_requirements: formData.staffRequirements,
        status: 'pending',
        estimated_total: estimatedTotal,
        auto_assign: staffSelection === "auto",
      })
      .select()
      .single();

    if (bookingError) {
      console.error("Booking error:", JSON.stringify(bookingError, null, 2));
      console.error("Booking error message:", bookingError.message);
      console.error("Booking error code:", bookingError.code);
      console.error("Booking error details:", bookingError.details);
      console.error("Booking error hint:", bookingError.hint);
      alert(`Failed to create booking: ${bookingError.message || "Unknown error"}`);
      return;
    }
    
    // Also check if booking was actually created (RLS can silently block inserts)
    if (!booking) {
      console.error("Booking creation returned null - likely RLS policy blocking insert");
      console.error("Attempted to insert for venue_id:", venue.id);
      alert("Failed to create booking. You may not have permission to create bookings for this venue.");
      return;
    }

    // Create shifts for selected or auto-assigned staff
    const shiftsToCreate = [];
    const eventDate = new Date(formData.date);
    const [startH, startM] = formData.startTime.split(":").map(Number);
    const [endH, endM] = formData.endTime.split(":").map(Number);
    
    const scheduledStart = new Date(eventDate);
    scheduledStart.setHours(startH, startM, 0, 0);
    
    const scheduledEnd = new Date(eventDate);
    scheduledEnd.setHours(endH, endM, 0, 0);
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd.setDate(scheduledEnd.getDate() + 1); // Next day for overnight
    }

    if (staffSelection === "manual") {
      // Create shifts for manually selected staff
      for (const personnelId of selectedStaff) {
        const person = availablePersonnel.find(p => p.id === personnelId);
        shiftsToCreate.push({
          booking_id: booking.id,
          personnel_id: personnelId,
          role: "Security", // Could be refined based on skills
          hourly_rate: person?.hourly_rate || 16,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: 'pending',
        });
      }
    } else {
      // For auto-assign, create shifts without personnel_id (to be assigned later)
      for (const req of formData.staffRequirements) {
        for (let i = 0; i < req.quantity; i++) {
          shiftsToCreate.push({
            booking_id: booking.id,
            personnel_id: null, // Will be assigned later
            role: req.role,
            hourly_rate: req.rate,
            scheduled_start: scheduledStart.toISOString(),
            scheduled_end: scheduledEnd.toISOString(),
            status: 'pending',
          });
        }
      }
    }

    if (shiftsToCreate.length > 0) {
      const { error: shiftsError } = await supabase
        .from('shifts')
        .insert(shiftsToCreate);

      if (shiftsError) {
        console.error("Shifts error:", shiftsError);
      }
    }

    // === SMART NOTIFY: Send targeted push notifications to nearby guards ===
    // Uses proximity matching to find the best candidates (Uber-style)
    try {
      const notifyRes = await fetch('/api/shifts/notify-guards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      const notifyData = await notifyRes.json();
      if (notifyData.success) {
        console.log(`Smart-notified ${notifyData.guards_notified} nearby guards (${notifyData.offers_created} offers created)`);
      } else {
        console.warn('Smart notify failed, falling back to bulk:', notifyData.error);
        // Fallback: notify all guards if smart matching fails
        const { data: allPersonnel } = await supabase
          .from('personnel')
          .select('user_id')
          .eq('is_active', true);
        if (allPersonnel && allPersonnel.length > 0) {
          const totalShifts = shiftsToCreate.length;
          const eventDate = new Date(formData.date).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short'
          });
          const notifications = allPersonnel
            .filter(p => p.user_id)
            .map(p => ({
              user_id: p.user_id,
              type: 'shift' as const,
              title: '🚨 New Shifts Available!',
              body: `${totalShifts} shift${totalShifts > 1 ? 's' : ''} at ${venue.name} on ${eventDate}. Tap to claim!`,
              data: { booking_id: booking.id },
            }));
          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }
        }
      }
    } catch (notifyErr) {
      console.error('Error calling notify-guards API:', notifyErr);
    }

    // Notify venue owner
    await supabase.from('notifications').insert({
      user_id: venue.owner_id || venue.user_id,
      type: 'booking',
      title: '✅ Job Posted!',
      body: `Your booking for "${formData.eventName}" is now live. ${shiftsToCreate.length} shift${shiftsToCreate.length > 1 ? 's' : ''} available for guards to claim.`,
      data: { booking_id: booking.id },
    });

    const successMessage = "🎉 Job posted! All security guards have been notified. They can now claim shifts from the job board.";
    
    alert(successMessage);
    router.push("/d/venue/bookings");
  };

  if (venueLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/d/venue/bookings" className="text-zinc-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bookings
        </Link>
        <h1 className="text-2xl font-bold text-white">Book Security</h1>
        <p className="text-sm text-zinc-400">Fill in the details and select your team</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { num: 1, label: "Event Details" },
          { num: 2, label: "Staff Requirements" },
          { num: 3, label: "Select Staff" },
          { num: 4, label: "Review" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
              step >= s.num ? "bg-purple-500 text-white" : "bg-white/10 text-zinc-500"
            }`}>
              {step > s.num ? "✓" : s.num}
            </div>
            <span className={`text-sm whitespace-nowrap ${step >= s.num ? "text-white" : "text-zinc-500"}`}>
              {s.label}
            </span>
            {idx < 3 && <div className={`w-6 h-0.5 ${step > s.num ? "bg-purple-500" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-6">
        {/* Step 1: Event Details */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-lg font-semibold text-white">Event Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Event Name</label>
              <input
                type="text"
                value={formData.eventName}
                onChange={(e) => setFormData(prev => ({ ...prev, eventName: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                placeholder="e.g. Friday Night, VIP Event"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
            </div>

            {calculateHours() > 0 && (
              <p className="text-sm text-zinc-400">
                Duration: <span className="text-white font-medium">{calculateHours()} hours</span>
              </p>
            )}

            <div className="flex justify-end">
              <motion.button
                onClick={() => setStep(2)}
                disabled={!formData.eventName || !formData.date || !formData.startTime || !formData.endTime}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next: Staff Requirements →
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Staff Requirements */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Staff Requirements</h2>
              <button
                onClick={addStaffRequirement}
                className="text-sm text-purple-400 hover:text-purple-300 transition"
              >
                + Add Role
              </button>
            </div>

            <div className="space-y-3">
              {formData.staffRequirements.map((req, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white/5 rounded-lg p-3">
                  <select
                    value={req.role}
                    onChange={(e) => updateStaffRequirement(index, "role", e.target.value)}
                    className="col-span-5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none transition"
                  >
                    {roleOptions.map(role => (
                      <option key={role.value} value={role.value}>{role.value}</option>
                    ))}
                  </select>
                  <div className="col-span-3 flex items-center gap-2">
                    <input
                      type="number"
                      value={req.quantity}
                      onChange={(e) => updateStaffRequirement(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none transition text-center"
                      min="1"
                    />
                    <span className="text-zinc-500 text-sm">staff</span>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-emerald-400 font-medium">£{req.rate}/hr</span>
                  </div>
                  <button
                    onClick={() => removeStaffRequirement(index)}
                    className="col-span-1 text-red-400 hover:text-red-300 transition p-2"
                    disabled={formData.staffRequirements.length === 1}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Brief Notes (Optional)</label>
              <textarea
                value={formData.briefNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, briefNotes: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition h-24 resize-none"
                placeholder="Any special requirements, dress code, areas to focus on..."
              />
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="text-zinc-400 hover:text-white transition">
                ← Back
              </button>
              <motion.button
                onClick={() => setStep(3)}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next: Select Staff →
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Select Staff */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-lg font-semibold text-white">How would you like to fill this job?</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setStaffSelection("auto"); setSelectedStaff([]); }}
                className={`p-6 rounded-xl border transition ${
                  staffSelection === "auto"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="text-3xl mb-3">🚀</div>
                <p className="font-semibold text-white text-lg">Post to Job Board</p>
                <p className="text-sm text-zinc-400 mt-2">
                  All security guards get notified instantly. First to claim gets the shift.
                </p>
                <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Fastest way to fill shifts</span>
                </div>
              </button>
              <button
                onClick={() => setStaffSelection("manual")}
                className={`p-6 rounded-xl border transition ${
                  staffSelection === "manual"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="text-3xl mb-3">👥</div>
                <p className="font-semibold text-white text-lg">Select Specific Staff</p>
                <p className="text-sm text-zinc-400 mt-2">
                  Handpick trusted guards from your network. They'll be notified directly.
                </p>
                <div className="mt-4 flex items-center gap-2 text-purple-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  <span>Control who works your events</span>
                </div>
              </button>
            </div>

            <AnimatePresence>
              {staffSelection === "manual" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  {/* Availability Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-400">
                        {loadingStaff ? "..." : availabilityStats.available}
                      </p>
                      <p className="text-xs text-zinc-400">Available</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-400">
                        {loadingStaff ? "..." : availabilityStats.unavailable}
                      </p>
                      <p className="text-xs text-zinc-400">Unavailable</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">
                        {loadingStaff ? "..." : selectedStaff.length}
                      </p>
                      <p className="text-xs text-zinc-400">Selected</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400">
                    Showing availability for {formData.date} • {formData.startTime} - {formData.endTime}
                  </p>

                  {/* Filter Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStaffFilter("available")}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        staffFilter === "available"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                          : "bg-white/5 text-zinc-400 border border-white/10"
                      }`}
                    >
                      Available Only
                    </button>
                    <button
                      onClick={() => setStaffFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        staffFilter === "all"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                          : "bg-white/5 text-zinc-400 border border-white/10"
                      }`}
                    >
                      Show All
                    </button>
                  </div>

                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {availablePersonnel
                      .filter(staff => staffFilter === "all" || staff.availabilityInfo?.available)
                      .map(staff => {
                        const isAvailable = staff.availabilityInfo?.available;
                        const isSelected = selectedStaff.includes(staff.id);
                        
                        return (
                          <motion.div
                            key={staff.id}
                            onClick={() => isAvailable && toggleStaffSelection(staff.id)}
                            className={`p-4 rounded-xl transition ${
                              !isAvailable
                                ? "bg-red-500/5 border border-red-500/20 opacity-60 cursor-not-allowed"
                                : isSelected
                                  ? "bg-purple-500/20 border border-purple-500 cursor-pointer"
                                  : "bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer"
                            }`}
                            whileHover={isAvailable ? { scale: 1.01 } : {}}
                            whileTap={isAvailable ? { scale: 0.99 } : {}}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                                !isAvailable
                                  ? "bg-red-500/20 text-red-400"
                                  : isSelected
                                    ? "bg-purple-500 text-white"
                                    : "bg-gradient-to-br from-shield-500 to-emerald-500 text-white"
                              }`}>
                                {!isAvailable ? "✗" : isSelected ? "✓" : staff.display_name?.charAt(0) || "?"}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-white">{staff.display_name}</p>
                                  {isAvailable ? (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                                      Available
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                                      Unavailable
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
                                  <span className="text-shield-400">Shield: {staff.shield_score || 0}</span>
                                  <span>{staff.total_shifts || 0} shifts</span>
                                  {staff.city && <span>{staff.city}</span>}
                                </div>
                                {!isAvailable && staff.availabilityInfo?.reason && (
                                  <p className="text-xs text-red-400 mt-1">
                                    {staff.availabilityInfo.reason}
                                    {staff.availabilityInfo.conflictingShifts && staff.availabilityInfo.conflictingShifts.length > 0 && (
                                      <span> ({staff.availabilityInfo.conflictingShifts.length} conflict)</span>
                                    )}
                                  </p>
                                )}
                                {isAvailable && staff.availabilityInfo?.availabilityWindow && (
                                  <p className="text-xs text-emerald-400 mt-1">
                                    Window: {staff.availabilityInfo.availabilityWindow.start} - {staff.availabilityInfo.availabilityWindow.end}
                                  </p>
                                )}
                                {staff.skills && staff.skills.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {(staff.skills as string[]).slice(0, 3).map((skill: string) => (
                                      <span key={skill} className="text-[10px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded">
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="text-right">
                                <p className={`text-lg font-bold ${isAvailable ? "text-emerald-400" : "text-zinc-500"}`}>
                                  £{staff.hourly_rate || 16}
                                </p>
                                <p className="text-xs text-zinc-500">/hour</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    
                    {availablePersonnel.length === 0 && !loadingStaff && (
                      <p className="text-center text-zinc-500 py-8">
                        No personnel available. They will be notified when you create the booking.
                      </p>
                    )}
                  </div>

                  {selectedStaff.length > 0 && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-purple-400 font-medium">
                        {selectedStaff.length} staff selected • 
                        <span className="text-emerald-400"> £{calculateTotal().toFixed(2)} estimated</span>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {staffSelection === "auto" && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🚀</span>
                  <div>
                    <p className="font-medium text-white">How Job Board Works</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      Like Uber or DoorDash - guards claim shifts instantly
                    </p>
                    <ul className="text-sm text-zinc-400 mt-2 space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400">1.</span> All guards get notified instantly
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400">2.</span> They see the job on their board
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400">3.</span> First to tap "Claim" gets the shift
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400">4.</span> Mission Control chat activates
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="text-zinc-400 hover:text-white transition">
                ← Back
              </button>
              <motion.button
                onClick={() => setStep(4)}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next: Review →
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="text-lg font-semibold text-white">Review Your Booking</h2>

            <div className="bg-white/5 rounded-lg p-4 space-y-4">
              <div>
                <p className="text-sm text-zinc-400">Event</p>
                <p className="text-lg font-semibold text-white">{formData.eventName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-400">Date</p>
                  <p className="text-white">{new Date(formData.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Time</p>
                  <p className="text-white">{formData.startTime} - {formData.endTime} ({calculateHours()}hrs)</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-zinc-400 mb-2">
                  {staffSelection === "auto" ? "Job Board Posting" : "Selected Staff"}
                </p>
                {staffSelection === "auto" ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <p className="text-emerald-400 font-medium">🚀 Job Board - All Guards Notified</p>
                    <div className="mt-2 space-y-1">
                      {formData.staffRequirements.map((req, idx) => (
                        <div key={idx} className="text-sm text-zinc-300">
                          {req.quantity}x {req.role} @ £{req.rate}/hr
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">First guards to claim get the shifts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availablePersonnel.filter(s => selectedStaff.includes(s.id)).map(staff => (
                      <div key={staff.id} className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                            {staff.display_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{staff.display_name}</p>
                            <p className="text-xs text-zinc-400">Shield: {staff.shield_score}</p>
                          </div>
                        </div>
                        <span className="text-emerald-400 font-medium">£{staff.hourly_rate || 16}/hr</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formData.briefNotes && (
                <div>
                  <p className="text-sm text-zinc-400">Notes</p>
                  <p className="text-white text-sm">{formData.briefNotes}</p>
                </div>
              )}
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-purple-400">Estimated Total</p>
                  <p className="text-3xl font-bold text-white">£{calculateTotal().toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">{totalStaff} staff × {calculateHours()}hrs</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="text-zinc-400 hover:text-white transition">
                ← Back
              </button>
              <motion.button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-8 py-3 rounded-xl font-bold text-lg transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Posting Job...
                  </span>
                ) : staffSelection === "auto" ? (
                  "🚀 Post to Job Board"
                ) : (
                  "✓ Send to Selected Staff"
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
