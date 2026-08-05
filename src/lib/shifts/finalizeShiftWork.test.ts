import { describe, it, expect, vi, beforeEach } from "vitest";

type PaymentParams = {
  shift: { personnel_id: string | null };
  venueId: string;
  venueOwnerId: string;
  agencyId: string | null;
  agencyCommissionRate?: number;
};

const createShiftPayment = vi.fn(
  (_client: unknown, _params: PaymentParams) => Promise.resolve({ success: true }),
);

vi.mock("@/lib/db/payments", () => ({
  createShiftPayment: (client: unknown, params: PaymentParams) =>
    createShiftPayment(client, params),
}));

import { recordShiftPaymentAndCompleteBooking } from "./finalizeShiftWork";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

/**
 * Minimal PostgREST-shaped stub: supports the select/eq/in/maybeSingle and
 * update/eq/in chains this module uses, and mutates the in-memory tables so
 * assertions can read the resulting rows back.
 */
function makeClient(tables: Tables) {
  function from(table: string) {
    const filters: Array<[string, string, any]> = [];
    let mode: "select" | "update" = "select";
    let values: Row = {};

    const matched = () =>
      (tables[table] ?? []).filter((row) =>
        filters.every(([op, col, val]) =>
          op === "eq"
            ? row[col] === val
            : op === "in"
              ? (val as any[]).includes(row[col])
              : op === "neq"
                ? row[col] !== val
                : true,
        ),
      );

    const settle = () => {
      const rows = matched();
      if (mode === "update") rows.forEach((row) => Object.assign(row, values));
      return { data: rows, error: null };
    };

    const api: any = {
      select: () => api,
      update: (next: Row) => {
        mode = "update";
        values = next;
        return api;
      },
      eq: (col: string, val: any) => (filters.push(["eq", col, val]), api),
      in: (col: string, val: any[]) => (filters.push(["in", col, val]), api),
      neq: (col: string, val: any) => (filters.push(["neq", col, val]), api),
      not: () => api,
      maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
      single: async () => ({ data: matched()[0] ?? null, error: null }),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(settle()).then(resolve, reject),
    };
    return api;
  }

  return { from } as any;
}

const workedShift = (over: Row = {}): Row => ({
  id: "s1",
  booking_id: "b1",
  personnel_id: "p1",
  original_personnel_id: null,
  status: "checked_out",
  hourly_rate: 15,
  total_pay: 60,
  hours_worked: 4,
  actual_start: "2026-08-01T18:00:00Z",
  actual_end: "2026-08-01T22:00:00Z",
  ...over,
});

beforeEach(() => createShiftPayment.mockClear());

describe("recordShiftPaymentAndCompleteBooking — agency self-managed bookings", () => {
  it("completes the booking without creating an escrow payment", async () => {
    const tables: Tables = {
      shifts: [workedShift()],
      bookings: [
        {
          id: "b1",
          venue_id: null,
          agency_id: "a1",
          self_managed: true,
          stripe_payment_intent_id: null,
          venues: null,
          status: "confirmed",
        },
      ],
      shift_payments: [],
      personnel: [{ id: "p1", agency_id: "a1" }],
      agencies: [{ id: "a1", commission_rate: 0.15 }],
    };

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(createShiftPayment).not.toHaveBeenCalled();
    expect(tables.bookings[0].status).toBe("completed");
    expect(tables.bookings[0].completed_at).toBeTruthy();
  });

  it("still completes when the guard checked out early", async () => {
    const tables: Tables = {
      shifts: [workedShift({ actual_end: "2026-08-01T20:00:00Z", hours_worked: 2, total_pay: 30 })],
      bookings: [
        { id: "b1", venue_id: null, agency_id: "a1", self_managed: true, status: "in_progress" },
      ],
      shift_payments: [],
      personnel: [],
      agencies: [],
    };

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(tables.bookings[0].status).toBe("completed");
  });
});

describe("recordShiftPaymentAndCompleteBooking — venue bookings", () => {
  const venueTables = (shifts: Row[]): Tables => ({
    shifts,
    bookings: [
      {
        id: "b1",
        venue_id: "v1",
        agency_id: null,
        self_managed: false,
        stripe_payment_intent_id: "pi_1",
        venues: { id: "v1", user_id: "u-venue" },
        status: "confirmed",
      },
    ],
    shift_payments: [],
    personnel: [{ id: "p1", agency_id: "a1" }],
    agencies: [{ id: "a1", commission_rate: 0.2 }],
  });

  it("creates the escrow payment and completes the booking", async () => {
    const tables = venueTables([workedShift()]);

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(createShiftPayment).toHaveBeenCalledTimes(1);
    const params = createShiftPayment.mock.calls[0][1];
    expect(params.venueId).toBe("v1");
    expect(params.venueOwnerId).toBe("u-venue");
    expect(params.agencyId).toBe("a1");
    expect(params.agencyCommissionRate).toBe(0.2);
    expect(tables.bookings[0].status).toBe("completed");
  });

  it("is idempotent — a second call does not duplicate the payment", async () => {
    const tables = venueTables([workedShift()]);
    tables.shift_payments.push({ id: "pay1", shift_id: "s1" });

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(createShiftPayment).not.toHaveBeenCalled();
  });

  it("pays the original guard when they were unassigned after working", async () => {
    const tables = venueTables([
      workedShift({ personnel_id: null, original_personnel_id: "p1" }),
    ]);

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(createShiftPayment).toHaveBeenCalledTimes(1);
    expect(createShiftPayment.mock.calls[0][1].shift.personnel_id).toBe("p1");
  });
});

describe("recordShiftPaymentAndCompleteBooking — booking completion rules", () => {
  it("leaves the booking open while a sibling shift is still live", async () => {
    const tables: Tables = {
      shifts: [workedShift(), workedShift({ id: "s2", status: "checked_in", actual_end: null })],
      bookings: [{ id: "b1", venue_id: null, agency_id: "a1", self_managed: true, status: "in_progress" }],
      shift_payments: [],
      personnel: [],
      agencies: [],
    };

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(tables.bookings[0].status).toBe("in_progress");
  });

  it("leaves an all-cancelled booking open so it can be re-staffed", async () => {
    const tables: Tables = {
      shifts: [
        { id: "s1", booking_id: "b1", status: "cancelled", actual_start: null, total_pay: null },
        { id: "s2", booking_id: "b1", status: "cancelled", actual_start: null, total_pay: null },
      ],
      bookings: [{ id: "b1", venue_id: null, agency_id: "a1", self_managed: true, status: "confirmed" }],
      shift_payments: [],
      personnel: [],
      agencies: [],
    };

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(tables.bookings[0].status).toBe("confirmed");
  });

  it("completes when one guard worked and the other cancelled", async () => {
    const tables: Tables = {
      shifts: [
        workedShift(),
        { id: "s2", booking_id: "b1", status: "cancelled", actual_start: null, total_pay: null },
      ],
      bookings: [{ id: "b1", venue_id: null, agency_id: "a1", self_managed: true, status: "confirmed" }],
      shift_payments: [],
      personnel: [],
      agencies: [],
    };

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(tables.bookings[0].status).toBe("completed");
  });

  it("does not resurrect a cancelled booking", async () => {
    const tables: Tables = {
      shifts: [workedShift()],
      bookings: [{ id: "b1", venue_id: null, agency_id: "a1", self_managed: true, status: "cancelled" }],
      shift_payments: [],
      personnel: [],
      agencies: [],
    };

    await recordShiftPaymentAndCompleteBooking(makeClient(tables), "s1");

    expect(tables.bookings[0].status).toBe("cancelled");
  });
});
