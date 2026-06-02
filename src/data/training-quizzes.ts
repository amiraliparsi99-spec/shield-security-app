/**
 * UK security / compliance micro-training quizzes.
 * Course IDs must match web TrainingModules and mobile COURSES.
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  /** Index of correct option (0–3) */
  correct_index: number;
  explanation: string;
}

/** Number of questions per course */
export const TRAINING_QUIZ_LENGTH = 5;

/** Minimum correct answers to pass (80%) */
export const TRAINING_PASS_CORRECT = 4;

export const TRAINING_COURSE_IDS = [
  "ct-basics",
  "first-aid-refresh",
  "conflict-deesc",
  "drug-awareness",
  "crowd-management",
  "search-procedures",
  "mental-health",
  "vip-protection",
  "licensing-law",
  "report-writing",
] as const;

export type TrainingCourseQuizId = (typeof TRAINING_COURSE_IDS)[number];

export const QUIZ_BANK: Record<TrainingCourseQuizId, QuizQuestion[]> = {
  "ct-basics": [
    {
      id: "ct-1",
      question: "In UK counter-terrorism public messaging, what does ACT stand for?",
      options: [
        "Assess, Contain, Terminate",
        "Action Counters Terrorism",
        "Alert, Control, Take action",
        "Awareness Creates Trust",
      ],
      correct_index: 1,
      explanation:
        "ACT stands for Action Counters Terrorism — the national campaign encouraging everyone to report suspicious activity.",
    },
    {
      id: "ct-2",
      question:
        "You see someone repeatedly photographing emergency exits and CCTV positions. What should you do FIRST?",
      options: [
        "Confront them and demand they delete the photos",
        "Observe, note details, and report to your supervisor or security control",
        "Immediately call 999 without telling anyone on site",
        "Ignore it unless they enter a staff-only area",
      ],
      correct_index: 1,
      explanation:
        "Observe safely, record what you saw (time, description, behaviour), and report through your venue’s procedure. Your supervisor can assess and escalate.",
    },
    {
      id: "ct-3",
      question: "You find an unattended bag in a busy area. What is the correct first principle?",
      options: [
        "Open it carefully to identify the owner",
        "Move it to lost property",
        "Do not touch it; follow venue procedure — often clear, cordon, and report",
        "Announce over the PA that a bag will be destroyed",
      ],
      correct_index: 2,
      explanation:
        "Do not touch suspicious items. Follow your venue’s plan (often linked to police guidance): protect people, control access, and report.",
    },
    {
      id: "ct-4",
      question: "Which behaviour is MOST consistent with hostile reconnaissance?",
      options: [
        "A customer asking where the toilets are",
        "Someone timing entry/exit flows, security patrol patterns, and filming access points over multiple visits",
        "A group taking selfies at the bar",
        "Staff forgetting their pass once",
      ],
      correct_index: 1,
      explanation:
        "Hostile reconnaissance often involves unusual interest in security measures, access, and timings — especially if repeated or covert.",
    },
    {
      id: "ct-5",
      question: "After reporting suspicious activity internally, when should front-line staff typically dial 999?",
      options: [
        "For every unusual customer",
        "Only when there is an immediate threat to life or a crime in progress — as directed by policy or supervisor",
        "Never — only managers may call police",
        "After closing time only",
      ],
      correct_index: 1,
      explanation:
        "Use 999 for immediate danger or crime in progress. Many concerns are escalated via supervisor and control room first — follow your employer’s procedure.",
    },
  ],

  "first-aid-refresh": [
    {
      id: "fa-1",
      question: "An adult is unresponsive and not breathing normally. What is the FIRST priority after ensuring scene safety?",
      options: [
        "Start CPR and send for an AED / call 999",
        "Put them in the recovery position",
        "Give sips of water",
        "Wait to see if they wake up",
      ],
      correct_index: 0,
      explanation:
        "Unresponsive and not breathing normally: call for help / 999, start chest compressions, and use an AED as soon as available — follow current UK first-aid training.",
    },
    {
      id: "fa-2",
      question: "When is the recovery position appropriate for an unconscious casualty who IS breathing normally?",
      options: [
        "Never — always leave them flat on their back",
        "When breathing is normal and you need to keep the airway clear and protect from vomit",
        "Only if they have a broken leg",
        "Only after CPR",
      ],
      correct_index: 1,
      explanation:
        "The recovery position helps maintain an open airway for an unconscious breathing casualty and reduces aspiration risk.",
    },
    {
      id: "fa-3",
      question: "What is the primary purpose of an AED (defibrillator) in cardiac arrest?",
      options: [
        "To restart any heart rhythm automatically",
        "To analyse rhythm and deliver a shock if appropriate, as part of the chain of survival",
        "To replace CPR entirely",
        "To check blood pressure",
      ],
      correct_index: 1,
      explanation:
        "AEDs analyse shockable rhythms and can deliver a shock; CPR keeps blood flowing until the AED is ready and between shocks.",
    },
    {
      id: "fa-4",
      question: "A conscious adult is choking and cannot speak or cough effectively. What is appropriate FIRST aid?",
      options: [
        "Give them water to wash it down",
        "Back blows and abdominal thrusts per training — and get emergency help if not clearing",
        "Tell them to run around",
        "Wait five minutes",
      ],
      correct_index: 1,
      explanation:
        "Follow your trained choking protocol (back blows / thrusts) and activate emergency services if obstruction is not relieved.",
    },
    {
      id: "fa-5",
      question: "For severe external bleeding with a major wound, what is a key immediate action?",
      options: [
        "Remove any embedded object and probe the wound",
        "Apply firm direct pressure with dressings / gauze and elevate if practical",
        "Apply a tourniquet to every bleed by default",
        "Ignore small bleeds completely",
      ],
      correct_index: 1,
      explanation:
        "Direct pressure controls most bleeding. Tourniquets are for life-threatening limb bleeding when trained and indicated.",
    },
  ],

  "conflict-deesc": [
    {
      id: "cd-1",
      question: "What is the primary goal of verbal de-escalation in licensed premises?",
      options: [
        "Win the argument",
        "Reduce tension and risk while maintaining safety and professionalism",
        "Intimidate the patron into leaving",
        "Record video for social media",
      ],
      correct_index: 1,
      explanation:
        "De-escalation aims to calm the situation, protect everyone present, and resolve without unnecessary force.",
    },
    {
      id: "cd-2",
      question: "Which approach usually INCREASES aggression in a heated patron?",
      options: [
        "Calm tone and open body language",
        "Pointing, invading personal space, and shouting orders",
        "Active listening and short summaries",
        "Offering clear choices",
      ],
      correct_index: 1,
      explanation:
        "Threatening posture, shouting, and crowding often escalate conflict. Calm voice, space, and listening help lower arousal.",
    },
    {
      id: "cd-3",
      question: "Under UK law and good practice, physical force by door staff must be:",
      options: [
        "Used whenever someone is rude",
        "Reasonable, necessary, and proportionate to the circumstances",
        "As hard as possible to assert authority",
        "Avoided even if someone is assaulting staff",
      ],
      correct_index: 1,
      explanation:
        "Force is lawful only when reasonable, necessary, and proportionate — e.g. self-defence or preventing crime per your training.",
    },
    {
      id: "cd-4",
      question: "After a serious incident involving use of force, what is essential?",
      options: [
        "Say nothing to anyone",
        "Accurate incident reporting, preserving evidence, and notifying management / police as required",
        "Delete CCTV",
        "Post about it online",
      ],
      correct_index: 1,
      explanation:
        "Document facts promptly, preserve CCTV and witness details, and follow your employer’s post-incident and safeguarding procedures.",
    },
    {
      id: "cd-5",
      question: "A lone worker feels a situation is becoming unsafe. Best practice is to:",
      options: [
        "Handle it alone to prove capability",
        "Use radio / phone to request backup early and follow lone-worker policy",
        "Ignore gut instinct",
        "Escalate only after someone is injured",
      ],
      correct_index: 1,
      explanation:
        "Early communication and backup reduce harm. Lone-worker policies exist precisely for rising risk.",
    },
  ],

  "drug-awareness": [
    {
      id: "da-1",
      question: "Why is drug identification at the door based only on appearance risky?",
      options: [
        "It is always 100% accurate",
        "Many substances look similar; wrong assumptions can be unlawful or dangerous",
        "Drugs are never hidden",
        "Only police care about drugs",
      ],
      correct_index: 1,
      explanation:
        "Focus on behaviour, policy, and legal powers — avoid guessing substances from appearance alone.",
    },
    {
      id: "da-2",
      question: "Someone shows signs of opioid overdose (e.g. very slow breathing, unresponsive). What is appropriate?",
      options: [
        "Splash cold water only",
        "Call 999 immediately; follow venue/medical protocol — naloxone may be used by trained staff where supplied",
        "Give them more alcohol",
        "Leave them to sleep it off",
      ],
      correct_index: 1,
      explanation:
        "Opioid overdose is a medical emergency. Professional help and trained use of naloxone (where available) save lives.",
    },
    {
      id: "da-3",
      question: "After a needle-stick injury, what should you do FIRST?",
      options: [
        "Ignore small scratches",
        "Wash thoroughly with soap and running water, encourage bleeding if puncture, and report per occupational health policy",
        "Suck the wound",
        "Wait until end of shift",
      ],
      correct_index: 1,
      explanation:
        "Immediate washing and rapid reporting allow risk assessment, PEP if indicated, and proper documentation.",
    },
    {
      id: "da-4",
      question: "What is your general duty regarding vulnerable intoxicated persons on licensed premises?",
      options: [
        "Eject immediately onto the street without regard to safety",
        "Duty of care — take reasonable steps to prevent harm, including calling assistance or medical aid",
        "No duty once they are past the door",
        "Only the police have a duty of care",
      ],
      correct_index: 1,
      explanation:
        "Licensees and staff owe a duty of care; unsafe ejection can create liability and serious harm.",
    },
    {
      id: "da-5",
      question: "Finding drugs on a patron during a lawful search typically requires you to:",
      options: [
        "Confiscate for personal disposal",
        "Follow venue policy — usually secure, document, and hand to management / police as appropriate",
        "Return half and keep half",
        "Ignore if they are a regular",
      ],
      correct_index: 1,
      explanation:
        "Chain of custody and policy matter. Document finds and escalate per licensing and company rules.",
    },
  ],

  "crowd-management": [
    {
      id: "cm-1",
      question: "What is a key early warning sign of dangerous crowd density?",
      options: [
        "People dancing",
        "Crush pressure: difficulty breathing, feet leaving the ground, waves of surging",
        "Queues at the bar",
        "Normal applause",
      ],
      correct_index: 1,
      explanation:
        "Crowd crush dynamics include compression and loss of individual control — act early with management and emergency services.",
    },
    {
      id: "cm-2",
      question: "Why must emergency exits stay clear at all times?",
      options: [
        "Only for fire drills",
        "They are required for safe evacuation and must not be blocked or locked against escape",
        "Staff storage is allowed overnight",
        "They are optional in small venues",
      ],
      correct_index: 1,
      explanation:
        "Blocked exits kill in emergencies. Licensing and fire safety law require maintained escape routes.",
    },
    {
      id: "cm-3",
      question: "Effective crowd communication during an incident often includes:",
      options: [
        "Silent observation only",
        "Clear, calm instructions and coordination with security, bar staff, and performers/DJs as planned",
        "Shouting conflicting orders",
        "Turning all lights off without announcement",
      ],
      correct_index: 1,
      explanation:
        "Pre-planned roles and calm messaging reduce panic and speed safe movement.",
    },
    {
      id: "cm-4",
      question: "Barrier systems at events are primarily intended to:",
      options: [
        "Block all view of the stage",
        "Help control flow, prevent surges, and protect staff and the public",
        "Replace all security staff",
        "Hold advertising only",
      ],
      correct_index: 1,
      explanation:
        "Barriers are engineering controls that work with staffing and planning — not replacements for people.",
    },
    {
      id: "cm-5",
      question: "When stopping entry because the venue is at safe capacity, staff should:",
      options: [
        "Let friends in anyway",
        "Apply consistent entry policy and communicate calmly — one-in-one-out if policy allows",
        "Argue with the queue",
        "Close without telling anyone",
      ],
      correct_index: 1,
      explanation:
        "Consistent capacity control prevents overcrowding and supports licensing conditions.",
    },
  ],

  "search-procedures": [
    {
      id: "sp-1",
      question: "When may a door supervisor typically conduct a search of a person entering licensed premises?",
      options: [
        "Whenever they feel like it",
        "When entry conditions / venue policy require consent-based search as a condition of entry",
        "Only with a warrant",
        "Never",
      ],
      correct_index: 1,
      explanation:
        "Searches are usually by consent as a condition of entry under clear signage and policy — know your venue’s legal basis and training.",
    },
    {
      id: "sp-2",
      question: "If a patron refuses a lawful condition-of-entry search, you should generally:",
      options: [
        "Use force to search anyway",
        "Deny entry in line with policy — do not force a search without proper authority",
        "Let them in to avoid trouble",
        "Detain them indefinitely",
      ],
      correct_index: 1,
      explanation:
        "Without consent and legal authority, forced searches risk assault/unlawful detention claims. Refusal usually means refusal of entry.",
    },
    {
      id: "sp-3",
      question: "Pat-down searches should be conducted:",
      options: [
        "As a joke between colleagues",
        "Professionally, with minimum intrusion, same-gender where required by policy, and respect for dignity",
        "In full public view with commentary",
        "Only on people under 18",
      ],
      correct_index: 1,
      explanation:
        "Proportionality, privacy, equality, and safeguarding policies apply — follow your employer’s SOP.",
    },
    {
      id: "sp-4",
      question: "Finding an offensive weapon during search should lead to:",
      options: [
        "Returning it at exit",
        "Secure the item safely, notify management/police per policy, and document",
        "Handling it carelessly for photos",
        "Ignoring if small",
      ],
      correct_index: 1,
      explanation:
        "Weapons are serious — control, secure, escalate, and document. Never endanger staff or public.",
    },
    {
      id: "sp-5",
      question: "Why is accurate search logging important?",
      options: [
        "It is not important",
        "It supports licensing compliance, disputes, and police follow-up",
        "Only for marketing",
        "To embarrass customers",
      ],
      correct_index: 1,
      explanation:
        "Records demonstrate due diligence and factual accounts if complaints or investigations arise.",
    },
  ],

  "mental-health": [
    {
      id: "mh-1",
      question: "When someone appears in mental health crisis on your premises, your first priorities are usually:",
      options: [
        "Mock or film them",
        "Safety, empathy, calm communication, and getting appropriate help",
        "Ignore until they leave",
        "Physically restrain immediately",
      ],
      correct_index: 1,
      explanation:
        "De-escalation, safeguarding, and professional/medical assistance — restraint only when necessary and trained.",
    },
    {
      id: "mh-2",
      question: "Which statement best reflects good communication with a distressed person?",
      options: [
        "“Calm down, you’re embarrassing yourself.”",
        "“I’m here to help. Can you tell me what you need?” — short, calm, non-judgemental",
        "“Stop being dramatic.”",
        "“I don’t have time for this.”",
      ],
      correct_index: 1,
      explanation:
        "Respectful, simple language reduces shame and builds enough trust to engage services.",
    },
    {
      id: "mh-3",
      question: "Sectioning under the Mental Health Act is decided by:",
      options: [
        "Door staff on discretion",
        "Police and approved mental health professionals — not venue security",
        "The bar manager alone",
        "Anyone with a first-aid certificate",
      ],
      correct_index: 1,
      explanation:
        "Your role is safety and signposting — statutory powers belong to professionals.",
    },
    {
      id: "mh-4",
      question: "If someone expresses intent to self-harm, you should:",
      options: [
        "Dismiss it as attention-seeking",
        "Take it seriously, stay with them if safe, remove means where possible, and summon help per policy",
        "Give them alcohol",
        "Leave them alone in the toilet",
      ],
      correct_index: 1,
      explanation:
        "Suicidal ideation is a safeguarding emergency — follow venue and emergency protocols immediately.",
    },
    {
      id: "mh-5",
      question: "Safeguarding vulnerable adults may require you to:",
      options: [
        "Never share information",
        "Share relevant information with designated safeguarding leads / agencies when there is risk of harm",
        "Gossip with colleagues",
        "Post on social media",
      ],
      correct_index: 1,
      explanation:
        "Legitimate information sharing to protect life is part of professional duty — follow GDPR and safeguarding training.",
    },
  ],

  "vip-protection": [
    {
      id: "vp-1",
      question: "Advance reconnaissance (advance) for a VIP visit primarily aims to:",
      options: [
        "Choose restaurant menus",
        "Identify routes, choke points, medical assets, and threat vectors before the principal arrives",
        "Replace local police",
        "Film fans",
      ],
      correct_index: 1,
      explanation:
        "Advance work reduces surprise and plans for ingress, egress, and emergencies.",
    },
    {
      id: "vp-2",
      question: "In close protection, the “principal” is:",
      options: [
        "The lead bodyguard",
        "The person being protected",
        "The venue owner always",
        "The police commander",
      ],
      correct_index: 1,
      explanation:
        "Principal = protectee. Roles and terminology matter for clear comms.",
    },
    {
      id: "vp-3",
      question: "A basic threat assessment considers:",
      options: [
        "Only weather",
        "Likelihood and impact of threats — from overzealous fans to targeted hostility — and venue context",
        "Uniform colour",
        "Social media likes only",
      ],
      correct_index: 1,
      explanation:
        "Dynamic risk assessment drives posture, routes, and resource levels.",
    },
    {
      id: "vp-4",
      question: "During a vehicle movement, good practice includes:",
      options: [
        "Random routes published online",
        "Pre-planned routes, comms checks, and awareness of stalking vehicles / choke points",
        "No seatbelts for speed",
        "Ignoring local traffic law",
      ],
      correct_index: 1,
      explanation:
        "Predictable publicised routes increase risk. Professional movements balance discretion, law, and safety.",
    },
    {
      id: "vp-5",
      question: "If the principal wants to ignore safety advice, the CP team should:",
      options: [
        "Abandon them",
        "Brief risks clearly, offer options, document decisions, and work within lawful instruction and policy",
        "Handcuff them",
        "Publicly argue on camera",
      ],
      correct_index: 1,
      explanation:
        "Advise, mitigate, and escalate internally — ultimate decisions may sit with the client but duty of care remains.",
    },
  ],

  "licensing-law": [
    {
      id: "ll-1",
      question: "Which Act is the main framework for alcohol licensing in England and Wales?",
      options: [
        "Health and Safety at Work Act 1974 only",
        "Licensing Act 2003",
        "Road Traffic Act 1988",
        "Data Protection Act only",
      ],
      correct_index: 1,
      explanation:
        "The Licensing Act 2003 governs sale/supply of alcohol and regulated entertainment in England and Wales.",
    },
    {
      id: "ll-2",
      question: "The four licensing objectives include the prevention of crime and disorder, public safety, prevention of public nuisance, and:",
      options: [
        "Maximising profit",
        "Protection of children from harm",
        "Free entry for all",
        "Extended hours always",
      ],
      correct_index: 1,
      explanation:
        "All authorised licensable activities must promote the four objectives — children’s protection is one of them.",
    },
    {
      id: "ll-3",
      question: "A Designated Premises Supervisor (DPS) is primarily responsible for:",
      options: [
        "Cleaning schedules",
        "Day-to-day operation of the premises for alcohol sales in line with the licence",
        "Music playlists only",
        "Stock ordering without oversight",
      ],
      correct_index: 1,
      explanation:
        "The DPS is the key accountable person for alcohol sales at the premises.",
    },
    {
      id: "ll-4",
      question: "Challenge 25 (or similar policies) exists to:",
      options: [
        "Refuse all under-30s",
        "Reduce underage sales by checking ID when a person appears under 25",
        "Speed up service",
        "Replace the need for a licence",
      ],
      correct_index: 1,
      explanation:
        "Think 25-style policies are industry standard to prevent proxy sales and underage drinking.",
    },
    {
      id: "ll-5",
      question: "Selling alcohol outside your licensed hours or conditions can result in:",
      options: [
        "No consequences",
        "Enforcement action: fines, review, suspension, or revocation — and personal liability for staff in some cases",
        "A warning only forever",
        "Automatic renewal",
      ],
      correct_index: 1,
      explanation:
        "Breaching licence conditions is serious for the business and can affect personal licences.",
    },
  ],

  "report-writing": [
    {
      id: "rw-1",
      question: "A strong incident report is usually built around:",
      options: [
        "Opinions and gossip",
        "Facts — who, what, when, where, why/how, and witnesses/evidence",
        "Creative storytelling",
        "Blame only",
      ],
      correct_index: 1,
      explanation:
        "Objective facts, times, and evidence survive scrutiny in complaints and court.",
    },
    {
      id: "rw-2",
      question: "Why avoid speculative language like “probably drunk” in reports?",
      options: [
        "It sounds professional",
        "It may be challenged legally; record observable facts and behaviour instead",
        "Speculation is always accurate",
        "Courts love guesses",
      ],
      correct_index: 1,
      explanation:
        "Describe what you saw, heard, and did — not unqualified diagnoses.",
    },
    {
      id: "rw-3",
      question: "CCTV in incident reports should be referenced by:",
      options: [
        "Deleting it first",
        "Camera ID, date/time range, and retention note per policy — preserve before overwrite",
        "Saying “there was video”",
        "Guessing the time",
      ],
      correct_index: 1,
      explanation:
        "Precise metadata helps investigators obtain footage before retention expires.",
    },
    {
      id: "rw-4",
      question: "If you used force, the report should include:",
      options: [
        "Nothing — forget it",
        "Threat posed, verbal warnings, type/level of force, duration, injuries, and medical aid",
        "Only the patron’s name",
        "Jokes",
      ],
      correct_index: 1,
      explanation:
        "Use-of-force narratives must be complete and honest for accountability and defence.",
    },
    {
      id: "rw-5",
      question: "Altering a report after the fact without proper procedure is:",
      options: [
        "Good practice",
        "Potentially misconduct or perverting justice — amendments must be transparent",
        "Required daily",
        "Only wrong if someone notices",
      ],
      correct_index: 1,
      explanation:
        "Contemporaneous notes and supervised amendments maintain integrity.",
    },
  ],
};

export function getQuizForCourse(courseId: string): QuizQuestion[] | null {
  if (courseId in QUIZ_BANK) {
    return QUIZ_BANK[courseId as TrainingCourseQuizId];
  }
  return null;
}
