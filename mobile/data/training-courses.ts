/**
 * Training Academy catalog — IDs align with web TrainingModules and QUIZ_BANK.
 */

export interface Course {
  id: string;
  title: string;
  description: string;
  duration: number;
  lessons: number;
  category: string;
  badge: string;
  badgeName: string;
  points: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  elite_required?: boolean;
  /** Optional; shown on Explore when set (e.g. after progress sync) */
  progress?: number;
}

export const COURSES: Course[] = [
  {
    id: "ct-basics",
    title: "Counter-Terrorism Basics",
    description:
      "Learn to identify suspicious behaviour and respond proportionately. Covers ACT awareness, reporting, and venue procedures.",
    duration: 8,
    lessons: 4,
    category: "safety",
    badge: "🛡️",
    badgeName: "CT Aware",
    points: 50,
    difficulty: "beginner",
  },
  {
    id: "first-aid-refresh",
    title: "First Aid Refresher",
    description:
      "CPR, recovery position, AED awareness, choking and bleeding — aligned with UK workplace first-aid expectations.",
    duration: 10,
    lessons: 5,
    category: "medical",
    badge: "🏥",
    badgeName: "First Responder",
    points: 40,
    difficulty: "beginner",
  },
  {
    id: "conflict-deesc",
    title: "Conflict De-escalation",
    description:
      "Calm aggressive situations with professional communication. Use-of-force awareness and post-incident reporting.",
    duration: 12,
    lessons: 6,
    category: "communication",
    badge: "🤝",
    badgeName: "Peacekeeper",
    points: 60,
    difficulty: "intermediate",
  },
  {
    id: "drug-awareness",
    title: "Drug Awareness",
    description:
      "Signs of intoxication, overdose awareness, needle-stick protocol, and duty of care on licensed premises.",
    duration: 7,
    lessons: 4,
    category: "safety",
    badge: "💊",
    badgeName: "Vigilant",
    points: 45,
    difficulty: "beginner",
  },
  {
    id: "crowd-management",
    title: "Crowd Management",
    description:
      "Safe capacities, crush dynamics, egress, barriers, and coordinated communication during events.",
    duration: 15,
    lessons: 7,
    category: "safety",
    badge: "👥",
    badgeName: "Crowd Controller",
    points: 75,
    difficulty: "intermediate",
  },
  {
    id: "search-procedures",
    title: "Search Procedures",
    description:
      "Condition-of-entry searches, consent, dignity, recording finds, and escalation for weapons.",
    duration: 10,
    lessons: 5,
    category: "legal",
    badge: "🔍",
    badgeName: "Search Pro",
    points: 55,
    difficulty: "intermediate",
  },
  {
    id: "mental-health",
    title: "Mental Health Awareness",
    description:
      "Recognise crisis, communicate with empathy, safeguarding, and when to involve emergency services.",
    duration: 12,
    lessons: 6,
    category: "medical",
    badge: "🧠",
    badgeName: "Mindful Guard",
    points: 65,
    difficulty: "intermediate",
  },
  {
    id: "vip-protection",
    title: "VIP & Close Protection",
    description:
      "Advance planning, threat assessment, principal terminology, and professional conduct on high-profile work.",
    duration: 20,
    lessons: 10,
    category: "specialist",
    badge: "⭐",
    badgeName: "Elite Protector",
    points: 100,
    difficulty: "advanced",
    elite_required: true,
  },
  {
    id: "licensing-law",
    title: "Licensing Law Essentials",
    description:
      "Licensing Act 2003 objectives, DPS role, conditions, and Challenge 25 — foundations for door supervisors.",
    duration: 8,
    lessons: 4,
    category: "legal",
    badge: "⚖️",
    badgeName: "Law Expert",
    points: 50,
    difficulty: "beginner",
  },
  {
    id: "report-writing",
    title: "Incident Report Writing",
    description:
      "Factual reporting, use-of-force narratives, CCTV references, and integrity under scrutiny.",
    duration: 6,
    lessons: 3,
    category: "legal",
    badge: "📝",
    badgeName: "Reporter",
    points: 35,
    difficulty: "beginner",
  },
];

export function getCourseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}
