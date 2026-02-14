/**
 * Shield AI Knowledge Base
 * Comprehensive UK Security Industry Knowledge for RAG System
 * 
 * This knowledge base trains Shield AI to be an expert for:
 * - VENUES: Clubs, bars, corporate, events, retail
 * - AGENCIES: Staff management, compliance, growth
 * - SECURITY PERSONNEL: Career, licensing, skills
 */

export interface KnowledgeDocument {
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  source?: string;
  keywords: string[];
  applicable_roles: ('venue' | 'agency' | 'personnel')[];
  priority: number; // 1-10
}

// =====================================================
// COMPREHENSIVE UK SECURITY INDUSTRY KNOWLEDGE BASE
// =====================================================

export const SECURITY_KNOWLEDGE_BASE: KnowledgeDocument[] = [
  
  // ========================================
  // SECTION 1: SIA LICENSING (All Roles)
  // ========================================
  
  {
    title: "SIA Door Supervisor License Requirements",
    content: `The Door Supervisor (DS) license is required for anyone working in a role that involves guarding licensed premises such as pubs, clubs, and bars.

**Requirements:**
- Be at least 18 years old
- Have the right to work in the UK
- Complete an approved Level 2 qualification in Door Supervision
- Pass the SIA identity and criminality checks
- Pay the license fee (currently £190)

**Training includes:**
- Conflict management (4 units)
- Physical intervention skills
- Emergency procedures
- Legal powers and responsibilities
- Search procedures

**Processing time:** Typically 4-6 weeks

**License validity:** 3 years from issue date

**Renewal:** Apply at least 8 weeks before expiry. You'll need to complete a top-up training course (typically 1 day) within 6 months before renewal.

**Training Providers:**
Look for courses approved by Highfield, City & Guilds, or similar awarding bodies. Cost typically £200-400.`,
    category: "licensing",
    subcategory: "door_supervisor",
    source: "SIA",
    keywords: ["SIA", "door supervisor", "DS license", "bouncer", "door staff", "licensed premises", "nightclub", "bar"],
    applicable_roles: ["personnel", "agency", "venue"],
    priority: 10
  },
  
  {
    title: "SIA Security Guard License Requirements",
    content: `The Security Guard (SG) license is required for manned guarding activities including static site guarding, mobile patrols, and cash/valuables in transit.

**Requirements:**
- Be at least 18 years old
- Have the right to work in the UK
- Complete an approved Level 2 qualification in Security Guarding
- Pass SIA identity and criminality checks
- Pay the license fee (currently £190)

**Training includes:**
- Working in the private security industry
- Working as a security officer
- Conflict management
- Communication skills

**Job roles covered:**
- Static security guards
- Mobile patrol officers
- Gatehouse/reception security
- Retail security (non-door work)
- Corporate security officers
- Concierge security

**Processing time:** 4-6 weeks
**License validity:** 3 years`,
    category: "licensing",
    subcategory: "security_guard",
    source: "SIA",
    keywords: ["SIA", "security guard", "SG license", "manned guarding", "static guard", "patrol", "corporate"],
    applicable_roles: ["personnel", "agency", "venue"],
    priority: 10
  },
  
  {
    title: "SIA CCTV Operator License Requirements",
    content: `The CCTV (Public Space Surveillance) license is required for anyone operating CCTV equipment to monitor public spaces.

**When is it required:**
- Monitoring CCTV for security purposes in public areas
- Town centre CCTV operations
- Car park surveillance
- NOT required for in-house staff monitoring private premises only

**Requirements:**
- Be at least 18 years old
- Right to work in UK
- Complete Level 2 CCTV qualification
- Pass SIA checks

**Training includes:**
- CCTV operations and procedures
- Data protection and GDPR compliance
- Evidence handling and preservation
- Legal requirements
- Report writing

**License fee:** £190
**Validity:** 3 years

**Common misconception:** In-house CCTV operators monitoring only their employer's private premises don't need an SIA license. The license is for monitoring public spaces or working for a third party.`,
    category: "licensing",
    subcategory: "cctv",
    source: "SIA",
    keywords: ["CCTV", "surveillance", "public space", "monitoring", "camera operator", "GDPR"],
    applicable_roles: ["personnel", "agency"],
    priority: 8
  },
  
  {
    title: "SIA Close Protection License Requirements",
    content: `The Close Protection (CP) license is required for bodyguard work protecting individuals from assault, kidnapping, or harassment.

**Requirements:**
- Be at least 18 years old
- Right to work in UK
- Complete Level 3 Close Protection qualification (typically 140+ hours)
- First Aid at Work certification
- Pass enhanced SIA checks

**Training includes:**
- Threat assessment and risk analysis
- Route planning and reconnaissance
- Protective escort techniques
- Conflict management at advanced level
- Emergency response procedures
- Surveillance awareness and counter-surveillance
- Venue security advances
- Residential security

**Career path:** Most CP operatives have previous military or police experience, though this is not mandatory. Good physical fitness and driving skills are essential.

**License fee:** £220 (higher due to enhanced checks)
**Validity:** 3 years

**Typical day rates:** £150-£300+ depending on risk level and experience`,
    category: "licensing",
    subcategory: "close_protection",
    source: "SIA",
    keywords: ["close protection", "CP", "bodyguard", "personal protection", "executive protection", "VIP"],
    applicable_roles: ["personnel", "agency"],
    priority: 7
  },
  
  {
    title: "SIA License Renewal Process",
    content: `**When to Renew:**
Apply at least 8 weeks before your license expires to ensure continuity. You can apply up to 16 weeks before expiry.

**Steps:**
1. Complete a top-up training course (usually 1 day) within 6 months of renewal
2. Apply online at gov.uk/sia
3. Pay the renewal fee (same as new license: £190)
4. Submit updated photo and identity documents if required

**Top-up Training Requirements:**
- Door Supervisors: 4-hour conflict management refresher + physical intervention
- Security Guards: 4-hour refresher course
- Must be completed with an approved training provider

**What if your license expires:**
- You cannot legally work until new license arrives
- If expired more than 6 months, you need full training again
- Working without valid license is a criminal offense (fine up to £5,000)

**Tips:**
- Set a calendar reminder for 10 weeks before expiry
- Keep your contact details updated with SIA
- Check SIA register to verify your license status
- Keep your top-up certificate safe - you'll need it

**Cost breakdown:**
- License fee: £190
- Top-up training: £50-100
- Total: ~£250-300`,
    category: "licensing",
    subcategory: "renewal",
    source: "SIA",
    keywords: ["renewal", "expired license", "top-up training", "license expiry", "refresh"],
    applicable_roles: ["personnel", "agency"],
    priority: 9
  },

  {
    title: "SIA License Check - How to Verify",
    content: `**How to Check if a License is Valid:**

**Online Register:**
Visit: https://services.sia.homeoffice.gov.uk/Pages/register.aspx

**What you can check:**
- License validity
- License type
- Expiry date
- If license is suspended or revoked

**What you need:**
- Either the 16-digit license number
- Or: First name, surname, and date of birth

**Why verification matters:**
- Legal requirement to ensure staff are licensed
- Protects venue/agency from prosecution
- Due diligence evidence

**Red flags:**
- License number doesn't return results
- Expired license
- Wrong license type for the role
- Photo doesn't match person

**Best practice for agencies/venues:**
- Check all licenses before first shift
- Re-verify licenses quarterly
- Keep records of verification dates
- Use Shield's built-in verification tools`,
    category: "licensing",
    subcategory: "verification",
    source: "SIA",
    keywords: ["verify", "check", "license check", "SIA register", "valid", "fake"],
    applicable_roles: ["venue", "agency"],
    priority: 9
  },

  // ========================================
  // SECTION 2: STAFFING & RATIOS
  // ========================================

  {
    title: "Security Staff Ratios for Events",
    content: `**Recommended Security-to-Guest Ratios:**

**Low Risk Events** (corporate, seated dinner, conferences):
- 1 security per 100-150 guests
- Examples: Business meetings, award ceremonies, exhibitions, seminars

**Medium Risk Events** (standing events with alcohol):
- 1 security per 75-100 guests
- Examples: Wedding receptions, product launches, private parties, gallery openings

**High Risk Events** (nightlife, concerts, festivals):
- 1 security per 50-75 guests
- Examples: Nightclubs, live music, sporting events, festivals

**Very High Risk Events** (known disorder risk):
- 1 security per 30-50 guests
- Examples: Boxing matches, controversial events, historic rivalry, high-profile guests

**Additional Considerations:**
- Entry points: Minimum 2 per active entrance
- VIP areas: Dedicated security required
- Emergency exits: Coverage for each
- Roaming patrols: At least 10% of security team
- Female searchers: At least 1 per entry point

**Factors that increase requirements:**
- Alcohol being served (especially free bar)
- Event running past midnight
- Standing room / dance floor
- History of incidents at venue
- High-value or celebrity attendees
- Multiple floors or areas
- Outdoor areas or beer gardens`,
    category: "staffing",
    subcategory: "ratios",
    source: "industry_standard",
    keywords: ["staffing", "ratio", "how many", "event security", "guards needed", "staff numbers", "capacity"],
    applicable_roles: ["venue", "agency"],
    priority: 10
  },

  {
    title: "Nightclub Security Staffing",
    content: `**Minimum Requirements for Nightclubs:**

**Door Team:**
- Minimum 2 door supervisors at all times
- 1 per 100 capacity for venues up to 500
- 1 per 75 capacity for venues over 500
- At least 1 female DS for patron searches
- Head door person for coordination

**Internal Team:**
- 1 roaming per 150 capacity
- Dedicated staff for VIP/bottle service areas
- 1 per bar area minimum
- Coverage for smoking areas

**Typical Deployment (400 capacity club):**
- Door: 3-4 staff (2 checking, 1 queue, 1 internal float)
- Dance floor: 2 roaming
- VIP: 1 dedicated
- Smoking area: 1
- Bar area: 1
- **Total: 8-10 staff**

**Peak Time Adjustments:**
- 11pm-2am typically busiest
- Consider +2 staff during peak
- Last hour focus on exit management and dispersal

**Key Positions:**
- Head doorman (team coordination, incident response)
- Queue management (crowd flow, capacity monitoring)
- ID verification (Challenge 25, fake ID detection)
- Internal patrol (behavior monitoring, assistance)
- Ejection team (work in pairs, document incidents)
- Exit management (safe dispersal, reduce disorder)`,
    category: "staffing",
    subcategory: "nightclub",
    source: "industry_standard",
    keywords: ["nightclub", "club security", "door staff", "nightlife", "bar security", "DS deployment", "bouncer"],
    applicable_roles: ["venue", "agency"],
    priority: 9
  },

  {
    title: "Corporate Security Staffing",
    content: `**Office Building Security:**

**Reception/Gatehouse:**
- 1 officer per main entrance during business hours
- Consider 24/7 coverage for high-security buildings
- Badge checking and visitor management

**Patrol Requirements:**
- Mobile patrol every 2-4 hours (depending on building size)
- Key holding and alarm response capability
- Lock-up and open-up duties

**Typical Staffing (Medium Office, 500 employees):**
- Day shift (07:00-19:00): 2 officers
- Night shift (19:00-07:00): 1 officer
- Weekend: 1 officer

**Additional for High Security:**
- Control room operator
- Loading bay security
- Executive protection for C-suite
- CCTV monitoring

**Key Duties:**
- Access control and badge verification
- Visitor registration and escorting
- Contractor management
- Package screening
- Parking management
- Emergency response
- Fire warden duties
- First aid (if trained)`,
    category: "staffing",
    subcategory: "corporate",
    source: "industry_standard",
    keywords: ["corporate", "office", "reception", "gatehouse", "business", "access control"],
    applicable_roles: ["venue", "agency"],
    priority: 7
  },

  {
    title: "Retail Security Staffing",
    content: `**Retail Store Security:**

**Small Store (<5,000 sq ft):**
- 1 security officer during peak hours
- Consider mobile patrol for off-peak

**Medium Store (5,000-20,000 sq ft):**
- 1-2 officers during opening hours
- Focus on entrance and high-value areas

**Large Store (>20,000 sq ft):**
- 2-4 officers
- Dedicated fitting room monitoring
- CCTV operator

**Shopping Centre:**
- 1 officer per 10,000-15,000 sq ft
- Control room staffing
- Car park patrols

**Key Duties:**
- Visible deterrence
- Customer service assistance
- Shoplifter detention (citizen's arrest)
- CCTV monitoring
- Emergency response
- Car park patrols
- Opening/closing procedures

**Loss Prevention Focus:**
- High-theft areas: cosmetics, electronics, clothing
- Known offender identification
- Incident reporting
- Evidence preservation for prosecution`,
    category: "staffing",
    subcategory: "retail",
    source: "industry_standard",
    keywords: ["retail", "shop", "store", "shopping", "loss prevention", "shoplifting"],
    applicable_roles: ["venue", "agency"],
    priority: 7
  },

  {
    title: "Construction Site Security",
    content: `**Why Construction Sites Need Security:**
- Theft of materials, tools, and plant equipment (£800m+ annually in UK)
- Vandalism and anti-social behaviour
- Health & safety compliance
- Unauthorized access prevention
- Asset protection

**Staffing Guidelines:**

**Small Sites (<£500k project):**
- Mobile patrol service (3-4 visits per night)
- CCTV monitoring with remote response
- Alarm response service

**Medium Sites (£500k-£5m):**
- Overnight static guard (18:00-06:00)
- Weekend coverage (24hr)
- Gate control during working hours

**Large Sites (>£5m):**
- 24/7 manned security
- Multiple guards for large perimeter
- Access control with sign-in systems
- Traffic management
- Control room

**Key Duties:**
- Perimeter checks every 2 hours
- Vehicle and personnel logging
- Key holding
- Incident reporting
- Fire watch when required
- Delivery verification

**Cost-Saving Tips:**
- Combine static with mobile patrols
- Use CCTV with remote monitoring
- Secure high-value items in locked containers
- Install temporary lighting and alarms`,
    category: "staffing",
    subcategory: "construction",
    source: "industry_standard",
    keywords: ["construction", "site security", "building site", "theft prevention", "overnight guard", "plant theft"],
    applicable_roles: ["venue", "agency"],
    priority: 7
  },

  // ========================================
  // SECTION 3: INCIDENT MANAGEMENT
  // ========================================

  {
    title: "Incident Reporting Best Practices",
    content: `**Why Proper Reporting Matters:**
- Legal protection for venue and staff
- Evidence for police and insurance claims
- Identifies patterns and risks
- Training improvement opportunities
- Regulatory compliance

**What to Document:**
1. Date, time, and exact location
2. Names and descriptions of all involved
3. Witness details and statements
4. Sequence of events (factual, not opinions)
5. Actions taken by security
6. Outcome (police called, ejection, etc.)
7. Injuries sustained (if any)
8. CCTV coverage reference

**Report Structure (5 W's + H):**
- **Who:** All persons involved
- **What:** Exactly what happened
- **When:** Precise times
- **Where:** Specific location
- **Why:** Apparent cause/trigger
- **How:** How situation was resolved

**Best Practices:**
- Write reports immediately after incident (or ASAP)
- Use clear, professional language
- Avoid opinions - stick to facts
- Get witness signatures where possible
- Preserve CCTV footage (usually 30-day retention)
- Report serious incidents to police within 24 hours
- Use Shield's incident reporting feature

**Types of Incidents to Report:**
- Physical altercations
- Ejections and refusals
- Drug-related incidents
- Theft or attempted theft
- Medical emergencies
- Near misses
- Staff injuries
- Property damage`,
    category: "incidents",
    subcategory: "reporting",
    source: "best_practice",
    keywords: ["incident", "report", "documentation", "evidence", "reporting", "log", "record"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 9
  },

  {
    title: "Handling Aggressive Individuals",
    content: `**De-escalation Techniques:**

**The LEAPS Model:**
- **L**isten actively to their concerns
- **E**mpathize with their frustration
- **A**sk questions to understand
- **P**araphrase to show understanding
- **S**ummarize and offer solutions

**Body Language:**
- Maintain non-threatening posture
- Keep hands visible and open
- Stand at 45-degree angle (not confrontational)
- Maintain safe distance (arm's length minimum)
- Don't point or use aggressive gestures

**Verbal Techniques:**
- Use person's name if known
- Speak slowly and clearly
- Lower your voice (they may match your tone)
- Offer choices, not ultimatums
- Acknowledge their feelings
- "I understand you're frustrated, let me help"
- "What can we do to resolve this?"

**When to Escalate:**
- Weapons visible or mentioned
- Physical violence imminent
- Multiple aggressors
- Person under influence and unpredictable
- Threats to other customers

**Physical Intervention:**
- Last resort only
- Minimum force necessary
- Document everything
- Ensure backup present
- Know your legal powers
- Disengage when safe to do so

**After the Incident:**
- Complete incident report
- Preserve CCTV
- Debrief with team
- Consider if any lessons learned`,
    category: "incidents",
    subcategory: "conflict",
    source: "best_practice",
    keywords: ["aggressive", "conflict", "de-escalation", "angry customer", "drunk", "violence", "confrontation"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 10
  },

  {
    title: "Emergency Evacuation Procedures",
    content: `**Pre-Planning:**
- Know all exits and assembly points
- Understand venue capacity limits
- Identify vulnerable persons procedures
- Know location of fire extinguishers/alarms
- Understand fire panel and zones
- Practice regular drills

**During Evacuation:**
1. Sound alarm / initiate evacuation
2. Direct people to nearest safe exit
3. Check toilets, offices, and hidden areas
4. Assist persons with disabilities
5. Prevent re-entry
6. Account for all staff
7. Liaise with emergency services on arrival

**Key Phrases:**
- "Please make your way calmly to the exit"
- "Do not run, walk quickly"
- "Leave all belongings"
- "Do not use lifts"
- "Move away from the building"

**Security Team Roles:**
- Door staff: Control exits, prevent re-entry
- Internal team: Sweep and clear all areas
- Supervisor: Coordinate with fire brigade
- Designated person: Disabled assistance (PEEP)

**After Evacuation:**
- Maintain crowd control at assembly point
- Brief emergency services on arrival
- Do not re-enter until all-clear given
- Document timeline of events
- Debrief team after incident

**Common Causes:**
- Fire alarm (genuine or false)
- Bomb threat
- Gas leak
- Structural concern
- Major incident inside venue`,
    category: "incidents",
    subcategory: "emergency",
    source: "fire_safety",
    keywords: ["evacuation", "fire", "emergency", "exit", "assembly point", "fire alarm", "escape"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 10
  },

  {
    title: "Drug-Related Incidents",
    content: `**What to Look For:**
- Unusual behavior (hyperactive or lethargic)
- Dilated or pinpoint pupils
- Excessive sweating or dry mouth
- Loss of coordination
- Frequent toilet visits
- White residue around nose
- Unusual items (small bags, straws, foil)

**Discovery of Drugs:**
1. Do not touch directly - use gloves
2. Document what, where, when
3. Secure the area and evidence
4. Contact supervisor immediately
5. Call police if significant quantity
6. Preserve CCTV footage

**Dealing with Drug Users:**
- Prioritize safety (yours and theirs)
- Medical emergency takes precedence
- Don't judge - focus on venue rules
- Ejection is standard policy
- Document incident thoroughly

**Drug Search Procedures:**
- Must have consent for personal search
- Bag searches are condition of entry
- Same-sex searches only
- Private area for search
- Witness present

**Medical Emergencies:**
- Call 999 immediately for overdose
- Place in recovery position if unconscious
- Be prepared to perform CPR
- Never leave person alone
- Tell paramedics what you suspect

**Venue Policy:**
- Clear signage about drug-free policy
- Refuse entry to suspected users
- Report dealers to police
- Consider amnesty bins`,
    category: "incidents",
    subcategory: "drugs",
    source: "best_practice",
    keywords: ["drugs", "substances", "overdose", "dealing", "cocaine", "pills", "search"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 8
  },

  // ========================================
  // SECTION 4: LEGAL & COMPLIANCE
  // ========================================

  {
    title: "Use of Force Guidelines",
    content: `**Legal Framework:**
Security staff have the same powers as ordinary citizens - no special powers unless specific conditions apply.

**When Force is Justified:**
- Self-defense or defense of others
- Prevention of crime
- Lawful arrest
- Ejection from premises (reasonable force)
- To prevent a breach of the peace

**Key Principles (PLAN):**
1. **P**roportionate: Only what's necessary
2. **L**egal: Lawful purpose
3. **A**ccountable: You must justify your actions
4. **N**ecessary: No other option available

**Powers of Arrest (Section 24A PACE):**
- Person committing an indictable offense
- Reasonable grounds to believe offense committed
- Arrest necessary (e.g., prevent harm, escape)
- Must hand over to police ASAP

**What to Avoid:**
- Pre-emptive strikes (unless immediate threat)
- Continued force after threat neutralized
- Restraints that restrict breathing
- Head strikes (except extreme circumstances)
- Chokeholds

**Documentation:**
- Always document use of force immediately
- Include justification and witnesses
- Preserve CCTV footage
- Report to management and police if significant

**After Force is Used:**
- Check for injuries (all parties)
- Call ambulance if needed
- Separate involved parties
- Get witness details
- Complete incident report`,
    category: "compliance",
    subcategory: "use_of_force",
    source: "legal",
    keywords: ["force", "use of force", "restraint", "arrest", "powers", "legal", "self defense"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 10
  },

  {
    title: "GDPR and CCTV Compliance",
    content: `**CCTV Legal Requirements:**

**Signage:**
- Clear signs stating CCTV in operation
- Must include contact details of data controller
- Signs at each entry point
- State purpose (e.g., "for the safety of our customers")

**Data Protection:**
- Register with ICO if monitoring public spaces
- Retention period typically 30 days (or as stated)
- Written policy on access and retention
- Subject access requests must be fulfilled
- Privacy impact assessment recommended

**Footage Access:**
- Only authorized personnel
- Secure storage required
- Log all viewings and access
- Police requests require proper documentation (SAR)

**Best Practices:**
- Regular system audits
- Staff training on GDPR
- Clear retention and deletion schedule
- Password-protected access
- Encrypted storage

**Common Mistakes:**
- Cameras pointing at neighboring property
- No visible signage
- Keeping footage too long
- Sharing footage on social media
- Emailing unencrypted footage

**Subject Access Requests:**
- Individual can request their footage
- Must respond within 1 month
- Can charge reasonable fee for copies
- Must redact other individuals
- Can refuse if request is manifestly unfounded`,
    category: "compliance",
    subcategory: "gdpr",
    source: "ICO",
    keywords: ["GDPR", "CCTV", "privacy", "data protection", "cameras", "footage", "ICO", "recording"],
    applicable_roles: ["venue", "agency"],
    priority: 8
  },

  {
    title: "Licensing Act Requirements for Venues",
    content: `**Key License Conditions:**

**Door Supervision:**
- Many premises licenses require SIA door staff
- Conditions specify minimum numbers
- Often time-specific (e.g., after 9pm, after 11pm)
- Check your license conditions carefully
- Failure to comply is criminal offense

**Capacity Limits:**
- Maximum occupancy must be displayed
- Clickers/counters required at entry
- Fire certificate capacity may differ from license
- Never exceed capacity

**CCTV Requirements:**
- Many licenses require functional CCTV
- Minimum retention periods (often 31 days)
- Staff must know how to access footage
- Working cameras at all entry/exit points
- Must provide footage to police on request

**Challenge 25:**
- Policy to challenge anyone looking under 25
- Acceptable ID: Passport, driving license, PASS card
- Staff training records must be kept
- Test purchases may be conducted

**Incident Books:**
- Record all incidents and refusals
- Must be available for inspection
- Keep for minimum 12 months
- Include date, time, nature, action taken

**Consequences of Breach:**
- Review of premises license
- Additional conditions imposed
- License suspension (up to 3 months)
- License revocation
- Prosecution and fine`,
    category: "compliance",
    subcategory: "licensing_act",
    source: "legal",
    keywords: ["premises license", "licensing act", "capacity", "CCTV", "door supervision requirement", "Challenge 25"],
    applicable_roles: ["venue"],
    priority: 9
  },

  {
    title: "Search Procedures and Powers",
    content: `**Legal Position:**
Security staff have NO power to search anyone without consent. Searches are a condition of entry.

**Consent-Based Searches:**
- Clear signage: "Bag searches as condition of entry"
- Verbal consent before each search
- Right to refuse (but may be refused entry)
- Same-sex searches for pat-downs
- Witness present recommended

**What You Can Search:**
- Bags and belongings (with consent)
- Outer clothing/pat-down (with consent, same sex)
- Pockets (consent required)
- Vehicles entering your property (consent)

**What You Cannot Do:**
- Search without consent
- Physically detain for search
- Strip search
- Internal searches
- Search children without parent present

**If You Find Prohibited Items:**
- Confiscate item (with consent or disposal)
- Document in incident report
- Contact police for weapons or drugs
- Preserve evidence properly

**Search Training:**
- All searchers should be trained
- Use back of hands initially
- Systematic approach (top to bottom)
- Be respectful and professional
- Explain what you're doing

**Refusing Search:**
- Person may refuse
- You may refuse entry
- Do not use force
- Document the refusal`,
    category: "compliance",
    subcategory: "search",
    source: "legal",
    keywords: ["search", "pat down", "bag search", "consent", "entry search", "weapons"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 8
  },

  // ========================================
  // SECTION 5: BUSINESS & OPERATIONS
  // ========================================

  {
    title: "Security Staff Hourly Rates UK 2024",
    content: `**Current Market Rates:**

**Door Supervisors:**
- Standard (outside London): £12-15/hour
- London: £14-18/hour
- Premium events: £16-20/hour
- New Year's Eve: £20-30/hour
- Last minute (< 24hr notice): +20-30%

**Security Guards:**
- Static guard: £11-14/hour
- Mobile patrol: £12-15/hour
- Corporate/office: £12-16/hour
- Gatehouse: £11-14/hour

**Specialist Roles:**
- CCTV Operator: £11-14/hour
- Close Protection: £150-300/day
- Event Security Lead/Supervisor: £16-22/hour
- Control Room Operator: £12-15/hour

**Factors Affecting Rates:**
- Location (London commands 20-30% premium)
- Time of day (nights typically +10-15%)
- Experience level and qualifications
- Short notice bookings
- Special skills (first aid, conflict management)
- Risk level of assignment

**Agency Markup:**
- Typical charge rate to client: Staff rate + 20-35%
- Premium services: 30-40% markup
- Example: Pay staff £14/hr, charge client £18-19/hr

**Minimum Wage Reference (April 2024):**
- 21+: £11.44/hour
- 18-20: £8.60/hour
- Under 18: £6.40/hour`,
    category: "business",
    subcategory: "pricing",
    source: "market_data",
    keywords: ["rates", "hourly rate", "pay", "cost", "pricing", "wages", "salary", "charge rate"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 8
  },

  {
    title: "Vetting Security Staff - Complete Checklist",
    content: `**Essential Pre-Employment Checks:**

**Identity Verification:**
□ Valid passport or driving license
□ Proof of address (utility bill, bank statement)
□ Right to work in UK documentation
□ Original documents (not copies)

**SIA License Verification:**
□ Verify license on SIA register online
□ Check expiry date (minimum 6 months validity)
□ Confirm correct license type for role
□ Photo matches applicant
□ Document verification date

**Employment History:**
□ Full CV/resume covering last 5 years
□ Written references from last 2 employers
□ Explanation for any gaps over 1 month
□ Contact referees directly

**Criminal Record Check:**
□ Basic DBS check (minimum)
□ Enhanced DBS for certain roles
□ Declare any pending charges
□ Review and assess any disclosed offenses

**Additional Checks:**
□ Qualifications (first aid, conflict management)
□ Training certificates
□ Previous incident reports (if available)
□ Professional memberships

**Interview Essentials:**
□ Scenario-based questions
□ Conflict resolution approach
□ Knowledge of powers and law
□ Communication skills assessment
□ Customer service attitude
□ Physical fitness discussion

**Red Flags:**
- Expired or invalid SIA license
- Unable to provide references
- Gaps in employment unexplained
- Negative references
- Inconsistent information
- Reluctance to undergo checks`,
    category: "business",
    subcategory: "vetting",
    source: "best_practice",
    keywords: ["vetting", "hiring", "checks", "references", "DBS", "background check", "recruitment"],
    applicable_roles: ["venue", "agency"],
    priority: 8
  },

  {
    title: "Last-Minute Shift Coverage Strategies",
    content: `**When Staff Cancel:**

**Immediate Actions (in order):**
1. Contact backup list (maintain list of 5-10 reliable staff)
2. Check which current staff can extend their shift
3. Post on Shield marketplace marked as "Urgent"
4. Contact partner agencies
5. Consider reduced coverage if safe

**Prevention Strategies:**
- Require 24-48hr notice for cancellations in contracts
- Build relationships with reliable core team
- Maintain larger pool than minimum needed
- Financial penalties for no-shows (deduct from pay)
- Bonus for good attendance record

**Building Your Backup System:**
- Identify 5-10 flexible staff who want extra hours
- Keep their contact details easily accessible
- Reward those who regularly cover
- Maintain relationships even when not needed

**Communication:**
- Inform client immediately of any issues
- Provide solutions, not just problems
- Be honest about coverage levels
- Document all cancellations for patterns

**Shield Platform Tips:**
- Mark shifts as "Urgent" for priority visibility
- Offer premium rate for short notice (+15-25%)
- Use instant messaging to confirm quickly
- Check staff ratings before accepting cover
- Build a favorites list of reliable staff

**Contractual Protection:**
- Include cancellation clause in contracts
- Require deposit for large bookings
- Have backup clause in client contracts
- Insurance for lost shifts`,
    category: "business",
    subcategory: "operations",
    source: "best_practice",
    keywords: ["cancellation", "no show", "last minute", "cover", "backup", "staff shortage", "urgent"],
    applicable_roles: ["venue", "agency"],
    priority: 7
  },

  // ========================================
  // SECTION 6: CAREER (Personnel Focused)
  // ========================================

  {
    title: "Career Progression in Security",
    content: `**Entry Level → Senior Roles:**

**1. Security Guard / Door Supervisor (0-2 years)**
- Entry-level position
- Learn fundamentals
- Build experience and references
- Earn £11-15/hour

**2. Senior Security Officer (2-5 years)**
- More responsibility
- May lead small teams
- Better assignments
- Earn £14-18/hour

**3. Team Leader / Supervisor (3-7 years)**
- Manage team of 5-15 officers
- Incident coordination
- Client liaison
- Earn £16-22/hour + bonuses

**4. Operations Manager (5-10 years)**
- Multiple sites/contracts
- P&L responsibility
- Staff recruitment and training
- Earn £35-50k salary

**5. Director / Owner (10+ years)**
- Run your own agency
- Strategic decisions
- Business development
- Earnings unlimited

**Valuable Additional Qualifications:**
- First Aid at Work (essential)
- Fire Marshal
- Customer Service NVQ
- Team Leading ILM
- Health & Safety IOSH/NEBOSH
- Close Protection (premium rates)
- Driving license (essential for mobile work)

**Tips for Advancement:**
- Never turn down training opportunities
- Build relationships with clients
- Be reliable (show up, on time, professional)
- Document your achievements
- Network within the industry
- Consider specialization (CP, events, corporate)`,
    category: "career",
    subcategory: "progression",
    source: "industry",
    keywords: ["career", "promotion", "progression", "advancement", "supervisor", "manager"],
    applicable_roles: ["personnel"],
    priority: 8
  },

  {
    title: "Getting More Shifts - Tips for Security Personnel",
    content: `**How to Get More Work:**

**Build Your Reputation:**
- Always be professional and presentable
- Arrive 15 minutes early
- Be reliable - never cancel without notice
- Go above and beyond when possible
- Get to know regular clients

**Expand Your Skills:**
- Get additional SIA licenses (DS + SG)
- First Aid at Work certificate
- Fire Marshal training
- CCTV operation
- Customer service qualifications

**Use Shield Effectively:**
- Complete your profile 100%
- Upload professional photo
- List all qualifications
- Set availability accurately
- Respond to opportunities quickly
- Accept urgent shifts when you can
- Build positive reviews

**Networking:**
- Be friendly with other security staff
- Get to know agency managers
- Connect with venue managers
- Join security industry groups
- Attend industry events

**Location Strategy:**
- Be flexible on location
- Consider travel radius expansion
- Target venues with regular needs
- London pays more but costs more

**Timing:**
- Be available for unpopular shifts (Sundays, early mornings)
- New Year's Eve and bank holidays pay premium
- Summer festival season is busy
- December party season is lucrative

**What Clients Value:**
- Reliability (most important!)
- Professional appearance
- Good communication
- Problem-solving ability
- Customer service attitude`,
    category: "career",
    subcategory: "getting_work",
    source: "industry",
    keywords: ["more shifts", "get work", "find work", "availability", "booking", "hired"],
    applicable_roles: ["personnel"],
    priority: 9
  },

  {
    title: "Rights and Working Conditions",
    content: `**Your Employment Rights:**

**Working Time Regulations:**
- Maximum 48 hours average per week (opt-out available)
- Minimum 11 hours rest between shifts
- 20 minutes break if working 6+ hours
- 24 hours uninterrupted rest per week
- 28 days paid annual leave (pro-rata)

**Pay Rights:**
- Minimum wage must be paid
- Overtime must be agreed
- Travel time may be payable (check contract)
- Uniform costs cannot take you below minimum wage
- Payslips must be provided

**Agency Workers Regulations (AWR):**
- After 12 weeks in same role: equal pay to permanent staff
- Day 1 rights: access to facilities, job vacancies info
- You're entitled to know pay rate before accepting

**Health & Safety:**
- Employer must provide safe working environment
- Risk assessments for your role
- PPE provided if required
- Report hazards without fear of dismissal

**What You Can Refuse:**
- Unsafe working conditions
- Work beyond contracted hours (unless agreed)
- Work without valid SIA license
- Illegal activities

**Common Issues:**
- Unpaid trial shifts (illegal if working)
- Deductions from wages (must be agreed in contract)
- Holiday pay not accrued
- Being dismissed for raising concerns

**Where to Get Help:**
- ACAS (free advice): 0300 123 1100
- Citizens Advice Bureau
- Your union (if member)
- Employment tribunal (last resort)`,
    category: "career",
    subcategory: "rights",
    source: "legal",
    keywords: ["rights", "working hours", "breaks", "pay", "minimum wage", "overtime", "holiday"],
    applicable_roles: ["personnel"],
    priority: 8
  },

  // ========================================
  // SECTION 7: AGENCY MANAGEMENT
  // ========================================

  {
    title: "Starting a Security Agency - Requirements",
    content: `**Legal Requirements:**

**SIA Approved Contractor Scheme (ACS):**
- Not mandatory but highly recommended
- Demonstrates quality and compliance
- Required for some government contracts
- Annual audit and assessment

**Business Registration:**
- Register as Ltd company or sole trader
- Register for VAT if turnover > £85k
- Employer's liability insurance (mandatory: £5m minimum)
- Public liability insurance (typically £5-10m)
- Professional indemnity insurance

**Key Policies Needed:**
- Health & Safety policy
- Equal opportunities policy
- GDPR/data protection policy
- Complaints procedure
- Disciplinary procedure
- Staff handbook

**Operational Requirements:**
- Vetting procedures for all staff
- SIA license verification system
- Training records management
- Incident reporting system
- Scheduling and deployment system
- Payroll system

**Financial Considerations:**
- Cash flow (you pay staff before client pays you)
- Typical 30-day client payment terms
- Insurance costs: £2-5k annually
- Software and systems: £100-500/month
- Marketing and acquisition costs

**Common Mistakes:**
- Underpricing to win contracts
- Not checking staff licenses properly
- Poor cash flow management
- Inadequate insurance
- No contracts with staff or clients`,
    category: "agency",
    subcategory: "starting",
    source: "business",
    keywords: ["start agency", "ACS", "approved contractor", "insurance", "business", "setup"],
    applicable_roles: ["agency"],
    priority: 7
  },

  {
    title: "Agency Staff Retention Strategies",
    content: `**Why Staff Leave:**
- Better pay elsewhere
- Poor communication
- Lack of appreciation
- Inconsistent shifts
- Bad assignments
- No career progression

**Retention Strategies:**

**Fair Pay:**
- Pay above minimum wage
- Regular pay reviews
- Bonus schemes for loyalty
- Premium rates for short notice

**Consistent Work:**
- Prioritize reliable staff for regular shifts
- Give advance notice of schedules
- Offer preferred venue/client matching
- Consider guaranteed hours contracts

**Recognition:**
- Thank staff for good work
- Employee of the month
- Bonuses for positive client feedback
- Celebrate milestones (1 year, 5 years)

**Communication:**
- Regular check-ins
- Listen to concerns
- Clear expectations
- Open door policy

**Career Development:**
- Paid training opportunities
- Progression to supervisor roles
- Support for additional qualifications
- Internal promotion preference

**Good Assignments:**
- Rotate difficult venues
- Consider travel times
- Match skills to sites
- Don't overwork reliable staff

**Measuring Retention:**
- Track turnover rate (aim for <30% annually)
- Exit interviews
- Staff satisfaction surveys
- Monitor staff returning after leaving`,
    category: "agency",
    subcategory: "retention",
    source: "business",
    keywords: ["retention", "staff turnover", "keep staff", "loyalty", "employee"],
    applicable_roles: ["agency"],
    priority: 8
  },

  {
    title: "Winning Security Contracts",
    content: `**Finding Opportunities:**

**Where to Look:**
- Shield platform marketplace
- Government contracts (Contracts Finder)
- Tender websites (MyTenders, Delta)
- Direct approaches to venues
- Networking events
- Referrals from existing clients

**Tender Response Tips:**
- Read requirements carefully
- Answer ALL questions
- Be specific, not generic
- Include case studies
- Competitive but realistic pricing
- Highlight differentiators
- Professional presentation

**Pricing Strategy:**
- Know your costs (staff, overheads, insurance)
- Minimum margin: 15-20%
- Don't race to the bottom
- Value-based pricing for premium clients
- Consider contract length and volume

**What Clients Want:**
1. Reliability (most important)
2. Professional appearance
3. Good communication
4. Compliance and documentation
5. Technology/reporting
6. Value for money (not cheapest)

**Pitching to Venues:**
- Research their needs first
- Visit the venue if possible
- Identify their pain points
- Propose specific solutions
- Offer trial period
- Provide references

**Contract Essentials:**
- Clear scope of work
- Pricing and payment terms
- Notice period (both sides)
- Liability limitations
- Insurance requirements
- Performance standards
- Termination clauses`,
    category: "agency",
    subcategory: "sales",
    source: "business",
    keywords: ["contracts", "tender", "bid", "win business", "sales", "clients", "pitch"],
    applicable_roles: ["agency"],
    priority: 7
  },

  // ========================================
  // SECTION 8: VENUE-SPECIFIC GUIDANCE
  // ========================================

  {
    title: "Managing Security at Your Venue",
    content: `**Security Strategy for Venues:**

**Risk Assessment:**
- Identify potential threats
- Assess vulnerability of premises
- Consider history of incidents
- Review location and surroundings
- Update annually or after incidents

**Staffing Decisions:**
- In-house vs contracted (agency)
- Pros of in-house: loyalty, knowledge, control
- Pros of agency: flexibility, coverage, less admin
- Consider hybrid approach

**Working with Security:**
- Clear briefing before events
- Share any intelligence on expected issues
- Introduce to key venue staff
- Provide radio communication
- Post-event debrief

**Key Policies to Have:**
- Admission and refusal policy
- Drug and weapons policy
- Intoxication policy
- Ejection procedure
- Emergency procedures
- CCTV usage policy

**Compliance Checklist:**
- License conditions reviewed
- CCTV operational
- Incident book available
- Staff SIA licenses verified
- First aid provision
- Fire exits clear

**Cost Management:**
- Right-size your security team
- Use technology to supplement (CCTV, alarms)
- Review staffing levels regularly
- Negotiate annual contracts
- Consider off-peak reductions`,
    category: "venue",
    subcategory: "management",
    source: "best_practice",
    keywords: ["venue security", "manage security", "hire security", "in-house", "contract"],
    applicable_roles: ["venue"],
    priority: 8
  },

  {
    title: "Dealing with Problem Customers",
    content: `**Venue Manager's Guide:**

**Types of Problem Customers:**
- Intoxicated individuals
- Aggressive/confrontational
- Drug users
- Persistent rule breakers
- Underage attempted entry
- Banned individuals

**Your Options:**
1. **Refuse entry** - at door, before any issues
2. **Request to leave** - polite but firm
3. **Eject** - when request refused (document)
4. **Bar/ban** - for serious or repeated issues
5. **Call police** - for crimes or serious threats

**Documentation:**
- Record all refusals and ejections
- CCTV footage retention
- Witness statements
- Photos if appropriate
- Pattern identification

**Banning Procedures:**
- Written notice where possible
- Clear reason for ban
- Duration specified
- Right to appeal
- Share with door team
- Consider sharing with nearby venues

**Legal Position:**
- You have right to refuse entry
- You have right to ask someone to leave
- Reasonable force can be used for ejection
- Police should be called for crimes

**Working with Security:**
- Empower them to make decisions
- Back up their refusals
- Clear communication of policies
- Regular briefings on known issues
- Review incidents together`,
    category: "venue",
    subcategory: "problem_customers",
    source: "best_practice",
    keywords: ["problem customer", "eject", "ban", "refuse entry", "drunk", "aggressive"],
    applicable_roles: ["venue"],
    priority: 8
  },

  // ========================================
  // SECTION 9: FIRST AID & MEDICAL
  // ========================================

  {
    title: "First Aid in Security",
    content: `**Why First Aid Matters:**
- Often first on scene at incidents
- Legal duty of care
- Can save lives
- Professional expectation
- Many licenses require it

**Recommended Training:**
- First Aid at Work (FAW) - 3 day course
- Emergency First Aid at Work (EFAW) - 1 day
- Refresher training: every 3 years

**Common Situations:**
- Intoxication/collapse
- Drug overdose
- Assault injuries
- Falls
- Allergic reactions
- Heart attacks
- Diabetic emergencies

**Key Skills:**
- CPR and defibrillator use
- Recovery position
- Bleeding control
- Shock management
- Choking response
- When to call ambulance

**Your First Aid Kit:**
- Plasters
- Bandages
- Sterile dressings
- Disposable gloves
- Face shield for CPR
- Eye wash
- Foil blanket

**When to Call 999:**
- Unconscious and not responding
- Difficulty breathing
- Severe bleeding
- Suspected heart attack
- Seizures
- Suspected overdose
- Severe allergic reaction

**Documentation:**
- Record all first aid given
- Note time, symptoms, treatment
- Witness details
- Handover info to paramedics`,
    category: "safety",
    subcategory: "first_aid",
    source: "health_safety",
    keywords: ["first aid", "medical", "injury", "CPR", "ambulance", "emergency", "FAW"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 8
  },

  // ========================================
  // SECTION 10: SHIELD PLATFORM SPECIFIC
  // ========================================

  {
    title: "Using Shield Platform Effectively",
    content: `**For Security Personnel:**

**Profile Optimization:**
- Professional photo (uniform or smart casual)
- Complete all sections
- List all qualifications and licenses
- Set accurate availability
- Update regularly

**Getting More Bookings:**
- Accept shifts quickly (first responders win)
- Build positive reviews
- Mark yourself available for urgent shifts
- Expand your travel radius
- Accept various venue types

**Communication:**
- Respond to messages promptly
- Confirm shifts when accepted
- Report any issues immediately
- Use professional language

**For Venues:**

**Posting Shifts:**
- Provide clear description
- Include all requirements
- Set fair rates
- Give adequate notice
- Specify dress code

**Managing Staff:**
- Rate staff after shifts
- Provide feedback
- Build favorites list
- Use repeat booking features

**For Agencies:**

**Staff Management:**
- Verify all licenses on platform
- Keep availability updated
- Use bulk scheduling
- Track performance metrics
- Communicate through platform

**Growing Your Business:**
- Complete agency profile
- Respond to venue requests quickly
- Build reputation through reviews
- Use analytics to optimize`,
    category: "platform",
    subcategory: "usage",
    source: "shield",
    keywords: ["Shield", "platform", "app", "profile", "booking", "how to use"],
    applicable_roles: ["venue", "agency", "personnel"],
    priority: 7
  },
];

// Categories for filtering
export const KNOWLEDGE_CATEGORIES = [
  { id: 'licensing', name: 'SIA Licensing', icon: '🪪' },
  { id: 'staffing', name: 'Staffing & Ratios', icon: '👥' },
  { id: 'incidents', name: 'Incident Management', icon: '🚨' },
  { id: 'compliance', name: 'Legal & Compliance', icon: '⚖️' },
  { id: 'business', name: 'Business Operations', icon: '💼' },
  { id: 'career', name: 'Career Development', icon: '📈' },
  { id: 'agency', name: 'Agency Management', icon: '🏢' },
  { id: 'venue', name: 'Venue Security', icon: '🏟️' },
  { id: 'safety', name: 'Health & Safety', icon: '🏥' },
  { id: 'platform', name: 'Shield Platform', icon: '🛡️' },
];

// Function to get relevant knowledge for a query
export function getRelevantKnowledge(
  query: string, 
  userRole: string,
  limit: number = 5
): KnowledgeDocument[] {
  const queryLower = query.toLowerCase();
  
  // Score each document based on keyword matches
  const scored = SECURITY_KNOWLEDGE_BASE.map(doc => {
    let score = 0;
    
    // Check title match (high weight)
    if (doc.title.toLowerCase().includes(queryLower)) score += 15;
    
    // Check keyword matches (medium weight)
    doc.keywords.forEach(keyword => {
      if (queryLower.includes(keyword.toLowerCase())) score += 8;
      // Partial keyword match
      if (keyword.toLowerCase().split(' ').some(w => queryLower.includes(w))) score += 3;
    });
    
    // Check content match
    const queryWords = queryLower.split(' ').filter(w => w.length > 3);
    queryWords.forEach(word => {
      if (doc.content.toLowerCase().includes(word)) score += 2;
    });
    
    // Boost by priority
    score += doc.priority;
    
    // Boost if applicable to user role
    if (doc.applicable_roles.includes(userRole as any)) score += 5;
    
    // Extra boost if category matches query intent
    if (queryLower.includes(doc.category)) score += 5;
    
    return { doc, score };
  });
  
  // Sort by score and return top results
  return scored
    .filter(s => s.score > 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.doc);
}

// Get all documents for a specific role
export function getKnowledgeForRole(
  role: 'venue' | 'agency' | 'personnel'
): KnowledgeDocument[] {
  return SECURITY_KNOWLEDGE_BASE.filter(doc => 
    doc.applicable_roles.includes(role)
  ).sort((a, b) => b.priority - a.priority);
}

// Get documents by category
export function getKnowledgeByCategory(
  category: string
): KnowledgeDocument[] {
  return SECURITY_KNOWLEDGE_BASE.filter(doc => 
    doc.category === category
  ).sort((a, b) => b.priority - a.priority);
}
