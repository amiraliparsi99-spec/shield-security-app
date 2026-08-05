"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HelpHint } from "@/components/ui/HelpHint";
import {
  ATTIRE_OPTIONS,
  BRIEF_TEMPLATES,
  buildBriefNotes,
  briefBodyForGuard,
  extractAttireRequirement,
  hasBriefContent,
  parseBriefNotes,
  type BriefFields,
} from "@/lib/booking/brief";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-shield-500/50 focus:outline-none focus:ring-1 focus:ring-shield-500/30 transition";

type ShiftBriefSectionProps = {
  bookingId: string;
  briefNotes: string | null;
  editable: boolean;
  onSave: (briefNotes: string | null) => Promise<boolean>;
  className?: string;
};

export function ShiftBriefSection({
  bookingId,
  briefNotes,
  editable,
  onSave,
  className = "",
}: ShiftBriefSectionProps) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<BriefFields>(() => parseBriefNotes(briefNotes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!editing) setFields(parseBriefNotes(briefNotes));
  }, [briefNotes, editing]);

  const startEdit = () => {
    setFields(parseBriefNotes(briefNotes));
    setError(null);
    setEditing(true);
  };

  const applyTemplate = (duties: string) => {
    setFields((f) => ({
      ...f,
      duties: f.duties.trim() ? `${f.duties.trim()}\n\n${duties}` : duties,
    }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const next = buildBriefNotes(fields);
      const ok = await onSave(next);
      if (!ok) throw new Error("Could not save brief");
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save brief");
    } finally {
      setSaving(false);
    }
  }, [fields, onSave]);

  const body = briefBodyForGuard(briefNotes);
  const attire = extractAttireRequirement(briefNotes);
  const empty = !hasBriefContent(briefNotes);

  return (
    <section
      className={`rounded-xl border border-white/[0.08] bg-zinc-900/50 overflow-hidden ${className}`}
      aria-labelledby={`shift-brief-${bookingId}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 id={`shift-brief-${bookingId}`} className="text-sm font-semibold text-white">
              Shift brief for guards
            </h3>
            <HelpHint label="Why briefs matter">
              This is what assigned guards see before and during the shift — duties, dress code,
              access instructions, and who to contact on site. Keep it clear and specific.
            </HelpHint>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            What the guard is doing, how to dress, and how to get on site
          </p>
        </div>
        {editable && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 rounded-lg bg-shield-500/15 px-3 py-1.5 text-xs font-medium text-shield-300 hover:bg-shield-500/25 transition"
          >
            {empty ? "Write brief" : "Edit brief"}
          </button>
        )}
        {savedFlash && <span className="text-xs font-medium text-emerald-400">Saved</span>}
      </div>

      {!editing ? (
        <div className="px-4 py-4 sm:px-5 space-y-3">
          {empty ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-sm text-zinc-400 mb-1">No brief yet</p>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                Guards need to know their role, dress code, and site access. Add a brief before the
                shift starts.
              </p>
              {editable && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="mt-4 rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-600 transition"
                >
                  Add shift brief
                </button>
              )}
            </div>
          ) : (
            <>
              {attire && (
                <div className="flex items-start gap-2 rounded-lg bg-shield-500/10 border border-shield-500/20 px-3 py-2">
                  <span className="text-base leading-none" aria-hidden>
                    👔
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-shield-400/80">
                      Required attire
                    </p>
                    <p className="text-sm text-zinc-200">{attire}</p>
                  </div>
                </div>
              )}
              {body && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-1.5">
                    Duties & instructions
                  </p>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{body}</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="px-4 py-4 sm:px-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-400 mb-2">Start from a template (optional)</p>
            <div className="flex flex-wrap gap-2">
              {BRIEF_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.duties)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300 hover:border-shield-500/40 hover:text-white transition"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              What is the guard doing on site?
            </label>
            <textarea
              value={fields.duties}
              onChange={(e) => setFields((f) => ({ ...f, duties: e.target.value }))}
              rows={5}
              className={`${inputClass} resize-none`}
              placeholder="Main responsibilities, areas to cover, reporting lines, special risks…"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Required attire</label>
            <select
              value={fields.attire}
              onChange={(e) => setFields((f) => ({ ...f, attire: e.target.value }))}
              className={inputClass}
            >
              {ATTIRE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-500 mt-1">
              {ATTIRE_OPTIONS.find((o) => o.value === fields.attire)?.note}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Access / entry</label>
              <input
                value={fields.accessNotes}
                onChange={(e) => setFields((f) => ({ ...f, accessNotes: e.target.value }))}
                className={inputClass}
                placeholder="e.g. Report to main reception, staff entrance on High St"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Contact on site</label>
              <input
                value={fields.contactNotes}
                onChange={(e) => setFields((f) => ({ ...f, contactNotes: e.target.value }))}
                className={inputClass}
                placeholder="e.g. John (Event manager) 07xxx"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <motion.button
              type="button"
              onClick={() => void save()}
              disabled={saving || !fields.duties.trim()}
              className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-600 disabled:opacity-50 transition"
              whileTap={{ scale: 0.98 }}
            >
              {saving ? "Saving…" : "Save brief"}
            </motion.button>
          </div>
        </div>
      )}
    </section>
  );
}
