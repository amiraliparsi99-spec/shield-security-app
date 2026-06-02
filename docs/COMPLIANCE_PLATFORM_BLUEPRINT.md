# Shield HQ — Compliance Platform Blueprint

_The whiteboard sketch for the ACS Accelerator and Martyn's Law modules, the unified Compliance Command Centre architecture, and the A-to-Z agency/venue experience._

**Status:** Strategic draft v1 — to be iterated on before engineering kickoff
**Owner:** Founders
**Target shipping window:** Phase 1 by October 2026 launch; full platform by Q2 2027
**Last updated:** April 2026

---

## 1. Purpose and strategic thesis

Shield HQ is repositioning from "shift management software for security agencies" to **"the compliance operating system for the UK security industry."**

The foundation for this repositioning is two flagship compliance products:

1. **The ACS Accelerator** — makes SIA Approved Contractor Scheme audit-readiness continuous, measurable, and agency-outcome-tied.
2. **The Martyn's Law Platform** — the first dedicated compliance platform for the Terrorism (Protection of Premises) Act 2025, serving both venues (direct compliance duty) and agencies (supplying trained staff).

Together these two products transform Shield HQ from a feature-competitive vertical SaaS into a category-of-one compliance platform with an expanding regulatory moat.

### The central architectural bet

One unified **Compliance Command Centre** with a pluggable framework layer. Every compliance scheme (ACS, Martyn's Law, ISO 9001, Cyber Essentials, BS 7858, Modern Slavery, and future additions) is a "pack" that plugs into a shared evidence engine. This means:

- **Evidence captured once satisfies many frameworks** — a single incident report with root-cause analysis contributes to ACS Section 5, ISO 9001 Section 10, Martyn's Law Section 4, and the agency's internal audit record simultaneously.
- **Each new framework costs 10-20% of the first** — because the evidence engine, UI chrome, and workflow infrastructure already exist.
- **Agencies and venues compound value the longer they stay** — switching costs rise every quarter as accumulated evidence becomes harder to migrate away from.

---

## 2. Architectural foundation — the Compliance Command Centre

### 2.1 Three-layer model

```
┌─────────────────────────────────────────────────────────────┐
│                  LAYER 3: INTERFACES                        │
│  ACS Dashboard  │  Martyn's Law Hub  │  ISO 9001 View       │
│  Score Predictor│  Audit Pack Export │  Coaching Flows      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│              LAYER 2: FRAMEWORK PACKS                       │
│  Each pack defines:                                         │
│   • Criteria (78 for ACS, ~40 for Martyn's Law, etc.)       │
│   • Evidence mappings (which data satisfies which criterion)│
│   • Weighting rules                                         │
│   • Export templates (Audit Pack formats)                   │
│   • Maturity model / score thresholds                       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│              LAYER 1: EVIDENCE ENGINE (SHARED)              │
│  • Shifts, guards, vetting, training, incidents             │
│  • Post-shift feedback, complaints, welfare checks          │
│  • Risk assessments, policies, SOPs                         │
│  • Financial records, insurance, CSR activities             │
│  • Management reviews, internal audits, CI register         │
│                                                             │
│  Every record tagged with evidence_tags[]:                  │
│  ['acs:5.2', 'iso9001:10.1', 'martyns_law:4.3']            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Evidence tagging principle

Every piece of operational data captured by Shield HQ carries an `evidence_tags` array identifying which compliance criteria it can contribute to. This is set at the data-model level, not bolted on. Tags are maintained in the framework packs, not hard-coded in entity tables — so adding a new framework means adding its pack definition, not refactoring data models.

Example:

```typescript
// An incident report record
{
  id: 'inc_123',
  agency_id: 'ag_shield',
  occurred_at: '2026-03-14T22:15:00Z',
  category: 'near_miss',
  root_cause: '...',
  preventive_action: '...',
  evidence_tags: [
    'acs:5.2',          // ACS criterion 5.2 - incident reporting
    'acs:5.3',          // ACS criterion 5.3 - root cause analysis
    'acs:8.1',          // ACS criterion 8.1 - continuous improvement
    'iso9001:10.2',     // ISO 9001 corrective action
    'iso45001:10.1',    // ISO 45001 H&S incident
    'martyns_law:4.2'   // Martyn's Law incident learning (if terror-related)
  ]
}
```

A single query — _"give me all evidence for ACS criterion 5.2 for agency X from date Y to Z"_ — powers dashboards, score predictors, and audit pack generators uniformly.

### 2.3 Core data objects

| Object | Purpose | Sources |
|---|---|---|
| `compliance_frameworks` | Definition of each scheme (name, version, applicability) | Seeded by Shield HQ |
| `compliance_criteria` | Individual criteria per framework, with weight + category | Seeded per pack |
| `evidence_sources` | Types of data that can serve as evidence | Generated from workflow features |
| `evidence_records` | Actual captured data with tagging | Populated by normal platform usage |
| `agency_compliance_profile` | Agency's state per framework | Computed + user-maintained |
| `readiness_scores` | Daily calculated readiness per framework per agency | Computed |
| `audit_packs` | Exported evidence bundles | On-demand |
| `coaching_actions` | Recommended next actions per agency | Computed |

---

## 3. The ACS Accelerator — full module spec

### 3.1 What it is

A first-class module within the Agency dashboard that takes an agency from zero ACS awareness to audit-passed and re-audit-improved, year after year, with measurable scoring trajectory.

### 3.2 Key capabilities

#### 3.2.1 ACS Onboarding Wizard

Triggered when an agency signs up or toggles "Pursuing ACS approval" in settings. A 15-20 minute structured interview that:

- Captures current state (trading history, guard count, directors' qualifications, existing policies, current audit intentions)
- Identifies target audit date (or "not yet decided")
- Produces an initial **ACS Readiness Index** score (0-100)
- Generates a personalised 6-18 month roadmap with monthly milestones

**Output:** a `compliance_profile` record + an initial `coaching_actions` list.

#### 3.2.2 ACS Readiness Index (the proprietary methodology)

Shield HQ's owned scoring framework. 0-100 scale mapping to predicted ACS score bands:

| Readiness Index | Predicted ACS Score | Status |
|---|---|---|
| 0-30 | <60 | Not audit-ready |
| 31-50 | 60-80 | Approaching readiness |
| 51-70 | 80-110 | Likely first-time pass |
| 71-85 | 110-140 | Top quartile trajectory |
| 86-100 | 140+ | Best-in-class |

Calculation is a weighted roll-up across four pillars:

1. **Evidence Quality** (35%) — vetting completeness, training completion, incident RCA rates, post-shift CSAT response rates
2. **Process Maturity** (25%) — policies documented, DRAs per assignment, SOP acknowledgement rates, management review cadence
3. **Data Continuity** (20%) — months of accumulated operational data, KPI trend availability, complaint resolution time trends
4. **Governance Cadence** (20%) — internal audits completed, management reviews held, continuous improvement entries logged

Recalculated daily. Displayed as headline metric on the Agency ACS dashboard.

#### 3.2.3 Vetting Wizard (BS 7858:2019 compliant)

Guided guard onboarding that enforces full BS 7858:2019. Already scoped; key requirements:

- SIA licence number → auto-verified against SIA public register, screenshot archived
- Right-to-work document capture (passport/ID + share code verification)
- 5-year employment history with mandatory explanations for any gap >31 days
- 2 references requested via platform email, responses logged with timestamps + source IPs
- DBS certificate capture (basic/standard/enhanced) with expiry tracking
- Medical self-declaration
- Photo capture + identity verification step
- Signed contract (existing functionality)

**Blocking rule:** a guard cannot be assigned to a shift until their vetting profile is 100% complete. No exceptions. This is both compliance-correct and the strongest individual scoring lever in the ACS People section.

#### 3.2.4 Training Matrix

Grid: every guard × every required course. Per cell:

- Completion status
- Completion date
- Certificate uploaded (PDF/image)
- Expiry date
- Auto-renewal reminders at 90/60/30 days before expiry
- Blocking flag (expired → guard can't work)

**Standard courses tracked:** SIA licence, FAW/EFAW first aid, ACT (Action Counters Terrorism), fire safety, conflict management, physical intervention (for DS), terror awareness, GDPR awareness, lone working, manual handling.

**Custom courses per assignment:** site inductions, client-specific procedures, VAWG/Ask for Angela (for NTE venues), bespoke training.

**Output:** audit-ready training matrix PDF report with completion percentages, expiry windows, gaps.

#### 3.2.5 Dynamic Risk Assessments per assignment

Every venue/assignment has a dynamic risk assessment (DRA):

- Template library per venue type (pub, club, retail, residential, corporate, stadium, event)
- Version controlled — each edit creates a new version with reviewer sign-off
- Auto-reviewed quarterly; alerts if review overdue
- **Linked to incidents** — when an incident occurs at a venue, DRA auto-prompts "Does this change the risk profile?"
- Guards acknowledge the current DRA version before starting each shift
- Audit export: "Show me DRA history for venue X" → full version log, change reasons, review dates, acknowledgement log

#### 3.2.6 Incident reporting with RCA extension

Existing incident reports gain:

- **Severity classification** (1-4)
- **Category** (aggressive patron, first aid, theft, suspicious behaviour, medical emergency, fire, weapon, terror-related, near-miss, other)
- **Root Cause Analysis** (guided 5-whys template)
- **Preventive Action** (assigned to a named person with due date)
- **30-day verification** (did the preventive action work?)
- **Linked entities** (DRA updated? SOP changed? Training added?)
- **Near-miss as first-class category** — auditors specifically look for near-miss reporting as a quality signal

#### 3.2.7 Welfare check module (lone worker compliance)

For shifts flagged as "lone worker" (toggle on shift creation):

- Scheduled welfare prompts every X minutes (configurable per venue; default 60min)
- Guard taps "I'm OK" or reports an issue
- Non-response triggers operator escalation
- Full log exportable
- Aligns with HSE lone working guidance and ACS Section 6

#### 3.2.8 Post-shift feedback capture

Existing functionality to be extended:

- Automated 30-second form sent to venue booking contact 2 hours after shift end
- Star rating, Y/N questions, free-text comments
- Aggregated monthly into CSAT / NPS metrics per guard, per venue, overall
- Non-respondent follow-up after 24 hours
- Trend data feeds Customer Results section of ACS audit

#### 3.2.9 Complaint management

Distinct object from incident reports:

- Category (guard conduct, billing, service quality, other)
- Severity (1-4)
- Timestamps: received → acknowledged → resolved
- Resolution narrative
- Customer satisfaction survey after closure
- Root cause + preventive action (links to CI register)
- Dashboard: open vs closed, avg resolution time, repeat complaints, trend

#### 3.2.10 Management Review module

Quarterly meetings with templated agenda covering all 8 ACS sections:

- Auto-populated with latest data per section
- Attendees captured (minimum 2 directors)
- Minutes dictated/typed in-app
- Actions logged with owners and due dates
- Next review auto-scheduled 90 days out

#### 3.2.11 Internal Audit scheduler

Monthly self-audits rotating through ACS sections:

- System generates checklist for the month's section
- Internal auditor (could be director or designated person) completes
- Findings logged
- Corrective actions tracked to closure

#### 3.2.12 Continuous Improvement Register

Running log:

- Problem identified
- Action taken
- Evidence of impact (linked data or written narrative)
- One-page PDF exportable for audit

This is the simplest feature on the list and disproportionately important — most agencies lack one.

#### 3.2.13 Policy Library with document control

20 required policies (see Appendix A) with:

- Version history
- Approved-by, approved-on, next-review-date
- Distribution acknowledgement (guards read + acknowledge relevant ones)
- Linked to training (some policies require training completion)

Shield HQ ships with baseline templates; agencies customise and version forward.

#### 3.2.14 Audit Pack export (the killer feature)

One-button generator. Produces:

- A structured PDF covering all 78 ACS criteria
- A ZIP archive of all referenced evidence documents
- A mapping index: "Criterion X.Y — Evidence located in Pack Section A.B"

Background job completes in 60-180 seconds. Agency downloads and takes to audit.

#### 3.2.15 Score Predictor

Live dashboard showing:

- Current ACS Readiness Index (0-100)
- Predicted ACS audit score (band)
- Section-by-section breakdown
- Weakest 3 sections with specific actions to improve
- Trend chart (last 6 months)
- Estimated next-audit-pass probability

Gamifies the path; drives monthly engagement.

### 3.3 Agency dashboard — ACS view

Navigation structure under `/d/agency/compliance/acs/`:

```
ACS Accelerator
├── Overview (Readiness Index + trend + next actions)
├── Criteria (all 78 with per-criterion status)
├── Evidence Library (searchable, filterable)
├── Vetting (guards + completion %)
├── Training (matrix + expiries)
├── Incidents (list + RCA workflow)
├── Complaints (list + resolution times)
├── DRAs (per assignment)
├── Policies (library + review schedule)
├── Management Reviews (calendar + minutes)
├── Internal Audits (schedule + findings)
├── CI Register (improvements log)
├── Audit Pack (generate + download)
└── Settings (target audit date, assigned body NSI/SSAIB)
```

### 3.4 Agency journey — A to Z with ACS

#### Week 1: Arrival
- Agency signs up for Shield HQ
- Selects plan tier (includes ACS Accelerator)
- Onboarding asks: "Do you have ACS approval / are you pursuing it?"
- If pursuing: enters ACS Onboarding Wizard (20 min)
- Receives initial Readiness Index (typically 30-50 for new agencies)
- Receives 12-18 month roadmap

#### Month 1-2: Foundation
- Imports/enrols all existing guards through Vetting Wizard
- System flags gaps (missing RTW docs, expired SIA, incomplete histories)
- Agency remediates systematically
- 20 policy templates drafted/customised and approved
- Target: Readiness Index 45-55

#### Month 3-6: Operations
- Shifts run through Shield HQ accumulate evidence automatically
- Every incident captured with RCA
- Every shift captures post-shift CSAT
- Lone worker shifts generate welfare check evidence
- DRAs created per assignment, reviewed quarterly
- First quarterly Management Review held in-app
- First internal audit completed (Strategy section)
- Target: Readiness Index 60-70

#### Month 6-9: Maturation
- 6 months of trend data now available
- Readiness Index trending upward, section weak-points visible
- Score Predictor estimates ACS score band
- Coaching actions focus on weakest sections
- Book gap analysis with NSI/SSAIB (£500-1,000 external)
- Remediate gap analysis findings
- Target: Readiness Index 70-80

#### Month 9-12: Audit prep
- Book full on-site audit (NSI/SSAIB)
- Generate draft Audit Pack, review internally
- Mock audit by internal auditor or external consultant
- Final Audit Pack generated week of audit
- Target: Readiness Index 75-85

#### Audit day
- Auditor arrives, spends 1-2 days on site
- Director has Shield HQ open; every auditor question → click through to evidence
- Audit Pack PDF printed + digital copy provided
- Audit score awarded 2-4 weeks later

#### Year 2 onwards
- Annual re-audit cycle built into platform calendar
- Continuous improvement drives 15-25 point score uplift per cycle
- Agency climbs score ladder: pass → top-half → top-quartile → best-in-class
- Marketing materials auto-generated: "ACS Score: X. Top-quartile. Shield HQ certified."

### 3.5 Agency-visible outcomes (the sales story)

| Metric | Typical agency pre-Shield HQ | Shield HQ agency |
|---|---|---|
| Time to ACS audit-ready | 12-18 months (manual) | 6-9 months |
| Consultant cost for audit prep | £10-25k | £0 (platform replaces it) |
| First-time pass rate | ~55-65% | Target 85%+ |
| Average first-audit score | 75-90 | Target 95-115 |
| Annual score improvement | 10-15 points | Target 20-30 points |
| Admin hours per week on compliance | 8-15 | 2-4 |

---

## 4. The Martyn's Law Platform — full module spec

### 4.1 Regulatory context

**Terrorism (Protection of Premises) Act 2025**
- Royal Assent: April 2025
- Commencement expected: late 2026 / early 2027 (2-year implementation window)
- Regulator: The Security Industry Authority (same as ACS)
- Applies to: any premises with 200+ capacity (Standard tier) or 800+ capacity (Enhanced tier)
- Duties: documented risk assessments, staff training, incident response procedures, evacuation plans, public protection measures

### 4.2 Why Shield HQ owns this

- **Dual-sided fit** — venues face direct compliance duty; agencies face indirect duty to supply appropriately trained guards. Shield HQ already serves both sides.
- **Same regulator as ACS** — any NSI/SSAIB partnership established for ACS carries into Martyn's Law.
- **No incumbent has a product** — venues are scrambling; existing venue management platforms (3rd-party booking, EPOS, etc.) don't address this.
- **Bigger addressable market than ACS** — 100,000-180,000 affected premises vs 3,000-5,000 ACS-eligible agencies. 30-50x larger customer base.
- **Timing window** — 18-24 months of visible demand before commencement deadlines bite. First mover takes the category.

### 4.3 Product structure

Two interlinked modules:

#### 4.3.1 Martyn's Law for Venues

Lives at `/d/venue/compliance/martyns-law/`. Feature set:

**A. Tier assessment wizard**
- Venue capacity capture
- Activity type (entertainment, retail, sports, place of worship, education, healthcare, etc.)
- Outputs: Exempt / Standard (200-799) / Enhanced (800+)
- Determines feature unlocks

**B. Risk Assessment Builder**
- Templated per venue type (10-15 templates)
- Covers: entry points, crowd flow, vulnerable areas, CCTV coverage, communication channels, staff distribution, medical provisions
- Version controlled
- Reviewed annually (Standard) or biannually (Enhanced)
- Exportable as PDF

**C. Counter-Terror Plan module**
- Documented procedures for: Marauding Terrorist Attack, vehicle attack, bomb threat, suspicious package, hostage situation, chemical/biological incident, active shooter, crowd crush
- Template library editable per venue
- Staff acknowledgement tracking (every staff member reads + acknowledges)
- Version controlled

**D. Training tracker**
- All staff (venue employees + contracted security) mapped to:
  - ACT Awareness (NaCTSO free e-learning)
  - Evacuation procedures
  - First aid basics
  - Suspicious behaviour identification (See, Check, Notify)
  - Bomb threat protocols
  - Enhanced tier: ACT Strategic, decision-making under terror
- Completion percentages visible
- Auto-reminders for renewals

**E. Tabletop Exercise module**
- Scheduled terror exercises (minimum annually for Standard, biannually for Enhanced)
- Scenario library: bomb threat response, evacuation drill, MTA simulation, vehicle attack, hostage negotiation
- Attendance captured
- Observations + findings logged
- Actions assigned to responsible owners
- Evidence pack auto-generated

**F. Public Protection Measures register**
- Inventory of physical measures (hostile vehicle mitigation, bag checks, CCTV, public address, PACE points, first aid stations)
- Maintenance schedules
- Inspection records
- Linked to risk assessment (which measures mitigate which risks)

**G. Incident & near-miss log**
- Terror-specific: suspicious behaviour reports, bag check refusals, evacuation trigger events, hostile reconnaissance detected, verified threats
- Integrates with agency-supplied guard incident reports (if venue uses Shield HQ agencies)
- RCA on near-misses particularly weighted

**H. Communication protocol**
- Who gets informed of what, when, and how
- Links to local police BCU, neighbouring premises (for coordinated response)
- Test cadence (quarterly comms tests logged)

**I. Compliance Pack export**
- One-click SIA-ready evidence bundle
- Mirrors Audit Pack pattern from ACS module
- PDF + ZIP archive, mapped to Martyn's Law requirements

**J. Martyn's Law Readiness Index**
- Equivalent scoring methodology to ACS Readiness Index
- 0-100 scale, section-weighted
- Live score + trend
- Gap analysis → actions

#### 4.3.2 Martyn's Law for Agencies

Lives within the Agency compliance area, with shift-level integrations:

**A. ACT training compliance per guard**
- Extends Training Matrix
- Every guard assigned to a Martyn's Law venue must have current ACT Awareness completion
- Blocking rule: no ACT certificate → guard can't be assigned to Enhanced tier venues

**B. Venue-specific counter-terror brief**
- When a guard is assigned to a Martyn's Law venue, they receive the venue's counter-terror plan as pre-shift briefing
- Must acknowledge reading before shift start (blocker)

**C. Pre-shift terror vigilance checklist**
- Integrated into existing check-in flow
- 3-4 questions: entry points clear? Unusual items observed? Briefing read?
- Adds minimal friction, creates strong audit trail

**D. In-shift incident categories extended**
- Suspicious behaviour, hostile reconnaissance, abandoned item, verbal threat, attempted unauthorised access
- Auto-shared with venue's Martyn's Law incident log (if venue on Shield HQ)

**E. Post-shift terror-specific debrief (when applicable)**
- If any suspicious behaviour or near-miss logged during shift
- Structured follow-up: action taken, venue notified, escalation path, lessons

**F. Agency-level Martyn's Law readiness**
- Aggregate metric: % of guards ACT-trained, % of venues briefed, incident handling rate
- Becomes a sales asset: "100% of our guards are ACT-certified, evidenced live"

### 4.4 Venue journey — A to Z with Martyn's Law

#### Discovery
- Venue already on Shield HQ for booking security; or signs up specifically for Martyn's Law module
- Tier assessment wizard (5 min) → Standard or Enhanced classification
- Initial Martyn's Law Readiness Index score generated

#### Week 1-4: Foundation
- Risk Assessment Builder walks venue through first assessment
- Staff list imported, ACT training status captured
- Counter-terror plan templates adapted to venue
- Public Protection Measures inventory built
- Target: Readiness Index 30-50

#### Month 2-3: Training
- ACT training rolled out to all staff (NaCTSO free e-learning linked from platform)
- Venue-specific training content created and acknowledged
- First tabletop exercise scheduled
- Target: Readiness Index 50-70

#### Month 3-6: Operations
- Incidents/near-misses logged routinely
- Security guard shifts integrate via Shield HQ (if agency on platform)
- Quarterly communication tests completed
- Annual risk assessment review conducted
- Target: Readiness Index 70-85

#### Compliance readiness
- Compliance Pack generated
- Available on demand for SIA inspection
- Insurance providers increasingly request this evidence — discounts unlocked
- Target: Readiness Index 85+

### 4.5 Martyn's Law killer features

- **The SIA Inspection Pack** — one-click PDF bundle for regulator visit
- **Cross-venue benchmarking** — for venue groups (e.g., a pub chain), aggregate readiness across all sites
- **Insurance partner integration** — share compliance evidence with broker → premium discounts
- **Agency-to-venue evidence sharing** — "here are our guards' credentials relevant to your Martyn's Law file"

---

## 5. Shared Compliance Command Centre — infrastructure

### 5.1 Unified dashboard

At `/d/agency/compliance/` (agencies) and `/d/venue/compliance/` (venues):

```
Compliance Command Centre
├── Overall Compliance Score (weighted across active frameworks)
├── Framework Tiles
│   ├── ACS (Accelerator) → Readiness Index + trend
│   ├── Martyn's Law → Readiness Index + trend
│   ├── ISO 9001 → status
│   ├── Cyber Essentials → status
│   ├── BS 7858 Vetting → % complete
│   └── Modern Slavery → statement status
├── Evidence Library (universal search across all frameworks)
├── Audit Calendar (upcoming audits/reviews/inspections)
├── Coaching Centre (next actions ranked by impact)
└── Benchmarks (anonymised network averages)
```

### 5.2 Framework pack schema

Each pack is defined in a structured JSON/YAML format. Example sketch:

```yaml
framework:
  id: sia_acs
  name: SIA Approved Contractor Scheme
  version: 2019
  applies_to: [agency]
  sections:
    - id: 1_strategy
      name: Strategy
      weight: 10
      criteria:
        - id: 1.1
          name: Vision and mission documented
          weight: 2
          evidence_sources:
            - type: document
              tag: policy:vision_mission
            - type: management_review
              tag: review:strategy_discussion
          scoring_method: binary_plus_quality
        # ...
    - id: 2_commercial
      # ...
  export_templates:
    - name: Full Audit Pack
      format: pdf_zip
      sections: all
```

New frameworks = new YAML files + seed scripts. No core code changes required.

### 5.3 Evidence engine

A set of services that:

1. **Ingest** — every platform feature that generates data emits events with framework tags
2. **Index** — evidence records are indexed by framework + criterion for fast lookup
3. **Query** — dashboards, predictors, and export jobs query via a uniform interface
4. **Retain** — evidence is versioned and retained per compliance retention requirements (typically 3-7 years)

### 5.4 Cross-framework evidence reuse

This is where the architecture compounds. A single incident report with RCA contributes to:

- ACS Section 5 (Operations)
- ACS Section 8 (Best Practice — continuous improvement)
- ISO 9001 Section 10 (Improvement)
- ISO 45001 Section 10 (Health & Safety)
- Martyn's Law Section 4 (if terror-related)
- Internal audit evidence
- Insurance claim / incident history

One data point, seven compliance uses. No other platform architecturally supports this.

---

## 6. Supporting modules — the adjacent compliance packs

These are Phase 2/3 but scoped now so the architecture supports them cleanly:

| Pack | Audience | Complexity | Estimated build effort |
|---|---|---|---|
| BS 7858:2019 Vetting | Agency | Low (already building) | 3-4 weeks |
| Cyber Essentials | Agency | Low | 2-3 weeks |
| ISO 9001 Quality Management | Agency | Medium (70% reuses ACS) | 3-4 weeks |
| ISO 45001 Occupational H&S | Agency | Medium | 3-4 weeks |
| ISO 27001 Information Security | Agency | High | 6-8 weeks |
| Modern Slavery Act statements | Agency | Low | 1 week |
| Living Wage accreditation | Agency | Low | 1 week |
| Armed Forces Covenant | Agency | Low | 1 week |
| VAWG / Ask for Angela | Agency | Low-medium | 2-3 weeks |
| UK GDPR / ICO | Both | Medium | 3-4 weeks |
| CCS framework bid pack | Agency | High | 6-8 weeks |
| Procurement Act bid assistant | Agency | High | 8-12 weeks |

---

## 7. Execution roadmap

### 7.1 Phase 1 — Foundation (May 2026 - October 2026 launch)

**Goal:** launch with a credible ACS Accelerator module + Martyn's Law v1 for venues.

| Month | Engineering focus | Marketing / commercial focus |
|---|---|---|
| May 2026 | Compliance Command Centre architecture; evidence tagging retrofit to existing data models; ACS framework pack definition | Whitepaper draft 1; NSI/SSAIB outreach |
| June 2026 | Vetting Wizard v2 (BS 7858:2019); Training Matrix; Incident RCA extension | Whitepaper published; industry blog launches; first partner agency LOIs |
| July 2026 | DRAs per assignment; Welfare checks; Post-shift CSAT; Complaint management | Agency beta programme (5-10 agencies) |
| August 2026 | Policy Library; Management Review; Internal Audit scheduler; CI Register | Beta agency onboarding; case study drafts |
| September 2026 | Audit Pack export; Score Predictor; ACS Readiness Index; coaching flows | Launch marketing prep; NSI/SSAIB formal approach |
| October 2026 | Martyn's Law for Venues v1 (Risk Assessment Builder, Training tracker, Counter-Terror Plan module) | **Public launch** |

**Ships by launch:**
- ACS Accelerator (all 15 core capabilities)
- Martyn's Law for Venues v1 (core RA + training + plans)
- BS 7858 Vetting as standalone value
- Unified Compliance Command Centre

**Defers to Phase 2:**
- Martyn's Law for Agencies (guard-side)
- ISO 9001, Cyber Essentials packs
- CCS / Procurement Act bid tools
- International expansion modules

### 7.2 Phase 2 — Expansion (Nov 2026 - April 2027)

- Martyn's Law for Agencies (guard ACT training tracking, venue brief integration, pre-shift terror checklist)
- Martyn's Law Tabletop Exercise module
- Martyn's Law Compliance Pack export
- ISO 9001 pack (leveraging 70% of ACS evidence)
- Cyber Essentials pack
- Venue-side Compliance Command Centre rollout
- First anonymised network benchmark data published

### 7.3 Phase 3 — Dominance (May - Dec 2027)

- ISO 45001, ISO 27001, Modern Slavery packs
- VAWG / Ask for Angela compliance pack (Birmingham / NTE wedge)
- CCS framework bid assistant v1
- Procurement Act bid tools
- Insurance partner integrations (premium discounts for Shield HQ agencies)
- Annual "State of ACS" industry report launched as category-owning content

### 7.4 Phase 4 — International (2028+)

- Ireland PSA compliance pack (proof-of-concept international)
- Netherlands ND Nummer pack
- Germany §34a pack
- Country localisation framework solidified

---

## 8. Team and resourcing

### 8.1 Minimum viable team for Phase 1

| Role | Allocation | Purpose |
|---|---|---|
| Founder (product/strategy) | Full-time | Drive positioning, NSI/SSAIB partnerships, beta agency relationships |
| Founder (operations) | Full-time | Agency-side execution, field validation, own the agency side of the business |
| Engineering lead | Full-time | Architecture, evidence engine, framework pack system |
| Full-stack engineer | Full-time | Feature builds (vetting, training, incidents, reports) |
| Frontend engineer | Full-time | Compliance dashboards, UX, Audit Pack UI |
| ACS domain expert | Part-time (£4-8k/month) or FTE hire | Translate audit criteria into product decisions, review evidence mappings, QA audit pack outputs |
| Part-time content/technical writer | £2-3k/month | Whitepaper, blog, policy templates, knowledge base |

### 8.2 Phase 2-3 additions

- Counter-terror / Martyn's Law domain advisor (ex-police / NaCTSO / CTP)
- Customer success lead (onboards beta → paying agencies through first audit cycle)
- Sales lead (focused on FM subcontractor chains + direct agency acquisition)

### 8.3 Key hires in priority order

1. **ACS domain expert** — single biggest unlock. Consider ex-NSI/SSAIB auditors (often retired, open to part-time consulting).
2. **Engineering lead with compliance/regtech background** — rare but valuable; brings patterns from adjacent markets.
3. **Counter-terror advisor** — for Phase 2 Martyn's Law credibility.
4. **Customer success lead** — required once 10+ agencies paying.

---

## 9. Metrics and KPIs

### 9.1 Product metrics (internal)

| Metric | Target by Oct 2026 | Target by Apr 2027 |
|---|---|---|
| Agencies onboarded | 10-20 (beta + early) | 50-100 |
| Avg Readiness Index on platform | N/A | 65+ |
| Compliance Command Centre DAU/MAU ratio | 40%+ | 55%+ |
| Audit Packs generated | 0-2 | 10+ |
| Agency NPS | 30+ | 50+ |

### 9.2 Outcome metrics (external / sales narrative)

| Metric | Goal |
|---|---|
| Shield HQ agencies first-time ACS pass rate | 85%+ (vs industry ~65%) |
| Average first-audit score uplift vs industry | +15-25 points |
| Avg admin hours saved per agency / week | 6-10 hours |
| Average consultant cost displaced | £8-15k per agency |

### 9.3 Martyn's Law specific metrics

| Metric | Target by Apr 2027 |
|---|---|
| Venues on Martyn's Law module | 50+ |
| % ACT training completion across Shield HQ network | 95%+ |
| Tabletop exercises completed | 20+ |
| SIA inspections passed by Shield HQ venues | 100% |

---

## 10. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Incumbent (TimeGate/SmartTask) copies positioning | Medium | High | Speed + NSI/SSAIB partnership lock-up + data moat accumulation |
| First beta agency fails first audit | Medium | High | Hand-picked beta cohort with high baseline ops; domain expert shepherds; scope promises carefully ("readiness" not "guaranteed pass") |
| Martyn's Law commencement delays further | Medium | Medium | Module delivers value pre-commencement (insurance discounts, best-practice positioning); flex roadmap timing |
| NSI/SSAIB decline partnership | Medium | Medium | Data self-reported; build credibility via published outcomes; trade body (BSIA) as alternative |
| Domain expert hire proves difficult | High | Medium | Start with part-time consultant; build systematically from criterion documents; validate with beta cohort |
| Scope creep across too many framework packs early | High | High | Phase 1 hard-locked to ACS + Martyn's Law v1 only; everything else = Phase 2+ |
| ACS Readiness Index methodology challenged | Low | Medium | Publish methodology openly; invite peer critique; refine quarterly with live data |

---

## 11. Appendix A — ACS policy library (the 20 required policies)

Ship these as editable templates in the Policy Library at launch:

1. Vision and Mission Statement
2. Code of Ethics / Conduct
3. Equal Opportunities and Diversity Policy
4. Modern Slavery Policy Statement
5. Anti-Bribery and Corruption Policy
6. Health and Safety Policy
7. Risk Assessment Procedure
8. Incident Management Procedure
9. Lone Worker Policy
10. Training and Development Policy
11. Recruitment and Vetting Procedure (BS 7858:2019 aligned)
12. Disciplinary and Grievance Procedure
13. Whistleblowing Policy
14. Data Protection and Privacy Policy (UK GDPR)
15. Information Security Policy
16. Business Continuity and Disaster Recovery Plan
17. Complaints Handling Procedure
18. Customer Service Policy (SLAs)
19. Environmental Policy
20. Conflict of Interest Policy

Each template: 1-3 pages, agency-customisable placeholders, version-controlled from day one.

---

## 12. Appendix B — Martyn's Law counter-terror procedure templates

Counter-Terror Plan module ships with templated response procedures for:

1. Marauding Terrorist Attack (MTA)
2. Vehicle-as-a-Weapon attack
3. Improvised Explosive Device (IED) / suspicious package
4. Hostile reconnaissance detected
5. Bomb threat (phone / email / in-person)
6. Active shooter
7. Hostage situation
8. Chemical / biological / radiological incident
9. Crowd crush / stampede
10. Arson / deliberate fire
11. Cyber incident affecting physical security
12. Multi-site coordinated attack

Each template: scene-setting, immediate response steps, communication protocols, evacuation logic, post-incident actions, reporting obligations.

---

## 13. Appendix C — Open questions to resolve before build kickoff

1. **Assessing body alignment** — NSI vs SSAIB vs both vs neither. Decision drives evidence mapping nuances.
2. **Hosting / data residency** — compliance evidence is sensitive. UK-only hosting with Supabase EU region? Separate compliance-grade tier?
3. **Retention policy** — default 7 years; configurable per framework. Storage cost implications at scale.
4. **Audit Pack signing / tamper-evidence** — cryptographic signing of exports to prove non-modification?
5. **Multi-tenant isolation** — particularly acute for Martyn's Law (venue competitors). Review RLS architecture.
6. **White-label for FMs** — Phase 3+ decision; don't design it out early.
7. **Offline capability** — for guard mobile app, particularly in poor-signal venues. Evidence sync-on-connect?
8. **SIA integration** — can we consume SIA register via official API or only via public-site scraping?

---

## 14. Appendix D — Positioning and messaging seeds

For the whitepaper, landing pages, sales decks:

**One-liner**
> Shield HQ — the compliance operating system for UK security agencies and venues.

**Three-line elevator**
> Shield HQ turns the evidence your operations already generate into audit-ready compliance for every framework that matters. ACS, Martyn's Law, ISO 9001, Cyber Essentials — captured once, satisfied many times. Agencies pass audits faster and climb scoring ladders. Venues meet Martyn's Law with confidence. All from one platform.

**Category statement**
> Every security agency and venue in the UK has the same structural problem: operational evidence is captured in spreadsheets, WhatsApp, and email, then painfully reconstructed for every audit. Shield HQ captures it once, in the workflow, tagged to every compliance framework it serves. You don't prepare for audits anymore — you pass through them.

**The promise**
> Better scores. Lower admin. No consultants. Audit-ready continuously.

---

_End of blueprint v1. Next revisions tracked by date in this file header._
