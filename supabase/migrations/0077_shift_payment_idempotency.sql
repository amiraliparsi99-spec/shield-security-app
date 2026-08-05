-- 0077_shift_payment_idempotency.sql
-- A shift can only ever produce one payment record. Without this, a retried
-- checkout / resolve request creates duplicate shift_payments rows and double
-- credits the guard's pending wallet balance.
--
-- Any pre-existing duplicates are collapsed to the earliest row first so the
-- index can be created.

DELETE FROM public.shift_payments p
USING public.shift_payments keep
WHERE p.shift_id = keep.shift_id
  AND p.created_at > keep.created_at;

DELETE FROM public.shift_payments p
USING public.shift_payments keep
WHERE p.shift_id = keep.shift_id
  AND p.created_at = keep.created_at
  AND p.id > keep.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_payments_shift_unique
  ON public.shift_payments(shift_id);

COMMENT ON INDEX public.idx_shift_payments_shift_unique IS
  'One payment record per shift — guards against duplicate finalisation on retry.';
