# Shield Security — Agency Launch Checklist (April → October 2026)

_Everything needed to run a legally watertight, commercially credible UK security agency from now through the Shield HQ platform launch in October 2026._

**Status:** Working checklist — tick items as completed
**Owner:** Founders
**Target state by October 2026:** Fully operational agency with 25-30 guards, 50+ shifts completed, ACS application in progress, Shield HQ platform integration live.

---

## Block 1 — Legal foundations

- [ ] Ltd company active at Companies House
- [ ] Directors registered, PSC register correct
- [ ] Registered office address (commercial, not residential)
- [ ] Business bank account open
- [ ] Articles of Association confirmed (model articles sufficient for now)
- [ ] Share certificates issued to each shareholder
- [ ] Confirmation statement scheduled (annual filing reminder set)
- [ ] Trading name "Shield Security" registered under main Ltd (if separate from Shield HQ trading name)

**Cost:** £12 incorporation + £50-200/year registered office + £34/year confirmation statement

---

## Block 2 — Insurance (CRITICAL)

### Must-have policies

- [ ] **Employers' Liability (EL)** — £10m cover
  - Legally required under Employers' Liability Compulsory Insurance Act 1969
  - Applies even if guards are self-employed (courts often reclass as workers)
  - Est. £400-800/year

- [ ] **Public Liability (PL)** — £10m cover
  - Virtually every venue contract requires this
  - Ensure night-time economy / licensed premises explicitly included
  - Est. £1,200-2,500/year

- [ ] **Professional Indemnity (PI)** — £2-5m cover
  - Required for ACS approval
  - Covers negligent advice, service delivery
  - Est. £800-1,500/year

- [ ] **Wrongful Arrest cover** — £2m+
  - Critical for DS/event work
  - One claim can be £50k+
  - Usually bundled into PL

- [ ] **Libel & Slander** — £250k+
  - Usually bundled with PL
  - Cheap add-on, worthwhile

- [ ] **Crime / Fidelity cover** — £250-500k
  - Required if handling keys, cash, client property
  - Covers guard dishonesty
  - Est. £300-600/year

- [ ] **Cyber Liability** — £1-2m
  - Agencies hold guard PII + client schedules
  - Increasingly client-demanded
  - Est. £600-1,200/year

### Recommended (add within 12 months)

- [ ] **Directors & Officers (D&O)** — £1-2m — est. £400-800/year
- [ ] **Business Interruption** — £100-250k — est. £400-700/year
- [ ] **Key Person Insurance** — if single-point-of-failure directors
- [ ] **Vehicle insurance (Class 1 business use)** — per vehicle

### Procurement actions

- [ ] Contact three specialist brokers: **SEIB / Bluefin / Wilby / Bartlett**
- [ ] Brief provided: 15 guards (growing to 25-30), Birmingham + West Midlands, venue work + DS, no CP/CIT in year one
- [ ] Compare quotes on: aggregate vs per-claim limits, guard scheduling (named vs "any SIA-licensed"), NTE exclusions
- [ ] Policy bound before first commercial shift
- [ ] Certificate of insurance on file, shareable with venue clients
- [ ] Annual renewal reminder set 45 days before expiry

**Total est. annual premium:** £3,300-6,600 (core policies) + £1,200-1,900 (recommended adds)
**Monthly budget:** £350-550

---

## Block 3 — SIA compliance

### Directors

- [ ] Director #1 SIA licence valid (on file + register-verified)
- [ ] Director #2 enrolled in SIA Door Supervisor course (4-6 week turnaround)
- [ ] Director #2 DBS check initiated
- [ ] Director #2 SIA licence application submitted (6-8 week processing)
- [ ] Consider BIIAB Level 4 Security Management Diploma for one director (6-month part-time, ~£800-1,500, strong ACS scoring value)

### Guards

- [ ] Every guard's SIA licence verified on public register before first shift
- [ ] Screenshot of SIA register verification stored per guard
- [ ] SIA expiry dates tracked (3-year cycle); renewal reminders 90/60/30 days out
- [ ] ACT Awareness training completed by all guards (free via NaCTSO)
- [ ] Compliant uniforms with visibly worn SIA badge for all guards
- [ ] SIA badge supply chain in place (replacements for lost/damaged)

---

## Block 4 — Vetting (BS 7858:2019 compliant)

For each guard, captured before first shift:

- [ ] SIA licence verified
- [ ] Right-to-work document captured (passport / BRP / share code)
- [ ] 5-year employment history with written explanations for any gap >31 days
- [ ] 2 references requested, responses logged with timestamps
- [ ] DBS certificate (minimum Basic; Standard or Enhanced preferred for high-risk venues)
- [ ] Medical self-declaration
- [ ] Photo ID captured
- [ ] Bank details for payment
- [ ] Next of kin captured
- [ ] Signed guard service contract (self-employed or employment, per IR35 classification)
- [ ] Data Protection consent captured

**Process:** managed in spreadsheet pre-launch → migrated to Shield HQ Vetting Wizard at platform launch.

---

## Block 5 — HMRC and tax

- [ ] Corporation Tax registration complete (within 3 months of trading start)
- [ ] PAYE scheme registered (even if not currently employing anyone)
- [ ] VAT registration decision — voluntary now or wait for £90k threshold?
  - Voluntary registration enables VAT reclaim on purchases; useful if high setup costs
  - But adds admin burden + 20% cost to invoices if clients non-VAT-registered
- [ ] National Insurance scheme active with PAYE
- [ ] RTI payroll software configured (BrightPay, Xero Payroll, FreeAgent)
- [ ] Accountant engaged
  - Local Birmingham Ltd company specialist
  - Budget £80-150/month
  - Shortlist: Crunch (online), Mazuma (online), local firms via Chamber of Commerce
- [ ] Accountant reviewed guard contracts for IR35 classification risk
- [ ] Accountant reviewed client service contracts for enforceability
- [ ] First quarter accounting + VAT return timeline confirmed

---

## Block 6 — Data protection (ICO)

- [ ] **ICO Data Protection Fee registered** (£40-60/year for small org) — legally required, £4k+ fine for non-registration
- [ ] Privacy Policy published on website (GDPR-compliant)
- [ ] Internal GDPR / Data Protection Policy documented
- [ ] Data Processing Agreements (DPAs) in place with all subprocessors (Xero, payroll, email, Shield HQ when active)
- [ ] Subject Access Request (SAR) process documented (30-day response legally required)
- [ ] Data breach response plan documented (72-hour notification legal requirement)
- [ ] Retention schedules defined per data category
- [ ] Guard + client PII stored securely (not in personal devices or unencrypted storage)

---

## Block 7 — Contracts and legal documents

### Client-facing

- [ ] Standard Security Services Agreement (Shield HQ contract drafts in `/agency-site/docs/contracts/` — lawyer-review before first client signing)
- [ ] Terms & Conditions (website + invoice back)
- [ ] Pricing schedule (internal reference; per-hour rates, overtime, bank holidays, emergency call-out)
- [ ] Service Level Agreement (SLA) template
- [ ] Incident reporting protocol shared with each client
- [ ] Keyholding agreement template (if offering keyholding)

### Guard-facing

- [ ] Guard Service Contract (Shield HQ contract drafts exist — **must be IR35-reviewed by accountant**)
- [ ] Guard Handbook (drafted — in `/agency-site/docs/contracts/`)
- [ ] Right-to-Substitute clause included (IR35 defence)
- [ ] Uniform + equipment policy
- [ ] Disciplinary + grievance procedure (required for ACS; simple version for now)
- [ ] Sickness / unavailability protocol
- [ ] Drugs and alcohol policy (all guards sign)
- [ ] Social media / confidentiality policy

### Internal

- [ ] Shareholders' Agreement between directors (if two or more) — £500-1,500 via lawyer
- [ ] Directors' Service Agreements
- [ ] Intellectual property assignment (for anything developed pre-incorporation)

---

## Block 8 — Operational readiness

### Kit and equipment

- [ ] Uniforms × 15 guards + 5 spares (£60-120/guard = £1,200-2,400)
- [ ] High-vis jackets / tabards as required
- [ ] Torches + batteries
- [ ] Notebooks (incident log format)
- [ ] Radios / comms (DMR radios £40-80/guard or mobile app-based)
- [ ] Body-worn cameras (£80-200 each; one per deployed guard ideal by Q4)
- [ ] First aid kits for each assignment
- [ ] PPE per H&S requirement

### Operational processes

- [ ] Incident reporting template (paper + digital)
- [ ] Shift assignment brief template (Assignment Instructions per site)
- [ ] Daily Operating Rota / control log
- [ ] Sign-on/off procedure for each shift
- [ ] Welfare check protocol (for lone workers)
- [ ] Escalation tree (who calls whom in an incident)
- [ ] Complaint handling procedure
- [ ] Continuous improvement register (simple Google Doc for now)

### Control room / dispatch

- [ ] 24/7 contact number (own mobile initially; invest in virtual landline)
- [ ] Emergency contact rota between directors
- [ ] Live location awareness for deployed guards (Shield HQ platform when live; WhatsApp location pre-launch)
- [ ] Incident response kit ready (first aid, high-vis, backup radio)

---

## Block 9 — Financial systems

- [ ] Accounting software live (Xero recommended; £25-35/month)
- [ ] Payroll software linked (BrightPay bureau or Xero Payroll; £5-30/month)
- [ ] Invoicing template branded and deployed (Xero can handle)
- [ ] Bank feed connected to accounting software
- [ ] Dedicated expenses card per director
- [ ] Working capital float of **£15-25k** for 6-month runway (insurance, wages, equipment)
- [ ] Client payment terms agreed per contract (7 days ideal; 14 days max)
- [ ] Direct debit mandate process for recurring clients (GoCardless ready)
- [ ] Guard payment cadence agreed (weekly or bi-weekly; avoid monthly)
- [ ] Float account segregation (if holding client monies)
- [ ] First month cashflow modelled before first shift

---

## Block 10 — Memberships and credibility

- [ ] BSIA membership application submitted (£500-2,000/year; 4-8 week processing)
- [ ] Birmingham Chamber of Commerce membership (£250-600/year)
- [ ] Pubwatch Birmingham engagement (free)
- [ ] Best Bar None / Purple Flag scheme alignment where relevant
- [ ] LinkedIn company page active
- [ ] Google Business Profile registered and verified (local SEO critical)
- [ ] At least 3 venue testimonials / LOIs collected before October

---

## Block 11 — ACS pre-work (parallel track)

- [ ] ACS intent registered with **NSI or SSAIB** (free, non-committal)
- [ ] Criteria document pack received and reviewed
- [ ] Gap analysis booked for Q3 (£500-1,000)
- [ ] 20 required policies drafted and approved (list in `COMPLIANCE_PLATFORM_BLUEPRINT.md` Appendix A)
- [ ] Management Review meeting cadence started (quarterly, documented minutes)
- [ ] Continuous Improvement Register maintained from day one
- [ ] First internal audit scheduled before October

---

## Block 12 — Martyn's Law readiness (for relevant venues)

If serving venues with 200+ capacity:

- [ ] All guards completed ACT Awareness (NaCTSO free e-learning)
- [ ] Senior director / supervisor completed ACT Strategic
- [ ] Counter-terror procedures documented per venue type served
- [ ] Suspicious behaviour reporting escalation path
- [ ] Bomb threat / evacuation protocols documented
- [ ] Relevant NaCTSO updates subscribed to

---

## Block 13 — Marketing and commercial

- [ ] Branded website live (agency-site in repo; ensure public + performant by May)
- [ ] SEO basics: meta tags, Google Business, Birmingham-local keywords
- [ ] Business cards printed (docs/business-card/ in repo shows these exist)
- [ ] Company email domain set up (Google Workspace / Microsoft 365)
- [ ] LinkedIn profiles for both directors — polished, industry-active
- [ ] Service brochure / one-pager (for venue cold outreach)
- [ ] Pricing one-pager (for commercial conversations)
- [ ] Cold outreach list built: 50-100 Birmingham venues prioritised
- [ ] Sales CRM in place (HubSpot free tier is fine; Pipedrive if paid)

---

## Block 14 — Technology stack decisions

Pre-Shield HQ launch you're running manually. Decisions to lock now:

- [ ] Communications: WhatsApp Business (free) + dedicated business number
- [ ] Shift scheduling: spreadsheet / Google Sheets (temporary) → Shield HQ at launch
- [ ] Timesheets: Toggl / manual → Shield HQ at launch
- [ ] Incident reporting: Google Forms / paper → Shield HQ at launch
- [ ] Client portal: shared Google Drive folder → Shield HQ at launch
- [ ] Document storage: Google Drive (primary) + backup
- [ ] Password manager for team: 1Password / Bitwarden
- [ ] 2FA required on all business-critical accounts (especially banking, HMRC, email)

---

## The 30-60-90-180 day action order

### Days 1-14 (non-negotiable foundations)

1. [ ] ICO registration complete (5 minutes online)
2. [ ] Second director's SIA course booked
3. [ ] Three insurance quotes requested from specialist brokers
4. [ ] Accountant engaged
5. [ ] Accountant reviewing guard and client contracts for IR35 + enforceability

### Days 15-30

6. [ ] Insurance policy bound
7. [ ] Corporation Tax + PAYE registered with HMRC
8. [ ] Privacy Policy + GDPR Policy live
9. [ ] Xero + payroll software configured
10. [ ] BSIA membership application submitted

### Days 31-60

11. [ ] ACS intent registered with NSI
12. [ ] 20 compliance policies draft in progress
13. [ ] Gap analysis booked for Q3
14. [ ] Uniform + SIA badge kit complete for all guards
15. [ ] All guards completed ACT Awareness
16. [ ] BS 7858:2019 vetting audit completed for all 15 guards
17. [ ] Second director's SIA licence application lodged

### Days 61-90

18. [ ] First commercial shifts running
19. [ ] Incident reporting + welfare check processes live (manual)
20. [ ] First monthly Management Review held
21. [ ] Client contract templates lawyer-reviewed
22. [ ] 3 venue testimonials / LOIs collected

### Days 91-180 (to October launch)

23. [ ] NSI/SSAIB formal ACS application
24. [ ] Second director's SIA licence received
25. [ ] Continuous Improvement Register mature
26. [ ] First Quarterly Management Review with minutes
27. [ ] Clean financial records through Xero
28. [ ] Guard roster grown to 25-30
29. [ ] 50+ shifts completed
30. [ ] Shield HQ platform migration complete

---

## Budget summary (6-month launch window)

| Category | One-off | Monthly | 6-month total |
|---|---|---|---|
| Incorporation / legal structure | £200-400 | — | £200-400 |
| Insurance premiums | — | £350-550 | £2,100-3,300 |
| Accountant | — | £100-150 | £600-900 |
| SIA director licence + training | £500-800 | — | £500-800 |
| Uniforms + initial kit | £1,500-3,000 | — | £1,500-3,000 |
| Radios / body cams / equipment | £800-2,000 | — | £800-2,000 |
| Software stack (Xero, payroll, email, CRM) | £100-200 | £50-100 | £400-800 |
| ICO + memberships (BSIA, Chamber) | £600-1,500 | — | £600-1,500 |
| Legal / contract reviews | £800-1,500 | — | £800-1,500 |
| Marketing / website / branding | £200-500 | £50-100 | £500-1,100 |
| ACS gap analysis + intent | £500-1,000 | — | £500-1,000 |
| **Operational spend (6 months)** | **£5,200-10,900** | **£550-900** | **£8,500-16,300** |

**Working capital recommendation:** £15-25k minimum in the bank before first shift. Guard wages are separate (paid from client revenue, but watch cashflow gap).

---

## Risk register (what could go wrong)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| IR35 reclassification of guards → back-tax bill | Medium | High | Accountant review upfront; substitution clauses; invoicing-based pay |
| Insurance gap exposes a claim | Low | Catastrophic | Specialist broker + read exclusions; don't skimp on wrongful arrest cover |
| Second director's SIA application delayed | Medium | Medium | Start immediately; nothing blocks trading, just ACS application |
| First incident without proper protocols | Medium | Medium | Have incident reporting ready from day one; don't let first shift be first-ever RCA |
| Client non-payment / bad debt | Medium | Medium | Direct debit via GoCardless; strict 14-day terms; credit check large clients |
| Guard injury on site | Medium | High | EL in force; H&S procedures; PPE; first aid kits; welfare checks |
| Regulatory change mid-launch (Martyn's Law, Employment Rights Bill) | Medium | Low-Medium | Subscribe to SIA + BSIA updates; adjust as needed |
| Cashflow gap between shift delivery and client payment | High | Medium | Working capital float; GoCardless direct debit; avoid weekly guard pay vs monthly client invoice mismatch |

---

## What's NOT on this list (deliberately deferred)

- Vehicle fleet (wait until consistent demand)
- Physical office with control room (work from home until Q4)
- Full-time ops manager hire (directors cover this through October)
- PR / press coverage (wait for Shield HQ launch to amplify)
- International expansion planning
- Franchise / white-label model
- Large-scale marketing spend
- Non-essential certifications (ISO 9001, Cyber Essentials) — delay to 2027

---

_Review this checklist weekly during pre-launch. Tick items as completed. Escalate any blockers to both directors within 48 hours._
