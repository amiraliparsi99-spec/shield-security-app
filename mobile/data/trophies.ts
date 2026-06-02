export type TrophyDef = {
  id: string;
  name: string;
  icon: string;
  category: "shifts" | "training" | "reputation" | "consistency" | "fun";
  requirement: string;
  points: number;
};

const CORE_TROPHIES: TrophyDef[] = [
  { id: "shift_1", name: "First Watch", icon: "🛡️", category: "shifts", requirement: "Complete your first shift", points: 10 },
  { id: "shift_5", name: "Five Alive", icon: "✋", category: "shifts", requirement: "Complete 5 shifts", points: 15 },
  { id: "shift_25", name: "Security in Motion", icon: "🏃", category: "shifts", requirement: "Complete 25 shifts", points: 30 },
  { id: "shift_50", name: "Shield Veteran", icon: "🎖️", category: "shifts", requirement: "Complete 50 shifts", points: 40 },
  { id: "shift_100", name: "Security of the Year?", icon: "🏆", category: "shifts", requirement: "Complete 100 shifts", points: 60 },
  { id: "training_1", name: "Class Is in Session", icon: "🎓", category: "training", requirement: "Complete 1 training module", points: 10 },
  { id: "training_5", name: "Knowledge Stack", icon: "📚", category: "training", requirement: "Complete 5 training modules", points: 25 },
  { id: "training_10", name: "Passport Maxed", icon: "🪪", category: "training", requirement: "Complete 10 training modules", points: 40 },
  { id: "review_5", name: "People's Guard", icon: "⭐", category: "reputation", requirement: "Receive 5 reviews", points: 20 },
  { id: "review_20", name: "Crowd Favorite", icon: "🌟", category: "reputation", requirement: "Receive 20 reviews", points: 35 },
  { id: "rating_45", name: "Top Rated", icon: "💎", category: "reputation", requirement: "Maintain 4.5+ average rating", points: 30 },
  { id: "rating_48", name: "Elite Rated", icon: "👑", category: "reputation", requirement: "Maintain 4.8+ average rating", points: 50 },
  { id: "score_70", name: "Shield Rising", icon: "📈", category: "consistency", requirement: "Reach Shield Score 70+", points: 20 },
  { id: "score_85", name: "Shield Anchor", icon: "⚓", category: "consistency", requirement: "Reach Shield Score 85+", points: 35 },
  { id: "score_95", name: "The Wall", icon: "🧱", category: "consistency", requirement: "Reach Shield Score 95+", points: 50 },
  { id: "hulk_mode", name: "Is He Hulk?", icon: "💚", category: "fun", requirement: "Complete 3 shifts in one day", points: 30 },
  { id: "night_owl", name: "Night Owl", icon: "🦉", category: "fun", requirement: "Complete 10 night shifts", points: 25 },
  { id: "early_bird", name: "Early Bird", icon: "🌅", category: "fun", requirement: "Complete 10 morning shifts", points: 25 },
  { id: "streak_7", name: "One-Week Streak", icon: "🔥", category: "consistency", requirement: "Complete shifts on 7 different days", points: 30 },
  { id: "streak_30", name: "Monthly Machine", icon: "⚙️", category: "consistency", requirement: "Complete shifts on 30 different days", points: 60 },
];

const SPECIAL_TROPHIES: TrophyDef[] = [
  { id: "nick_fury", name: "Nick Fury?", icon: "🕶️", category: "fun", requirement: "Complete 75 shifts + 10 trainings + Shield 85+", points: 80 },
  { id: "door_jedi", name: "Door Jedi", icon: "✨", category: "fun", requirement: "Complete 40 shifts with 4.8+ rating", points: 55 },
  { id: "captain_queue", name: "Captain Queue", icon: "🧍", category: "fun", requirement: "Complete 30 shifts", points: 30 },
  { id: "bat_signal", name: "Bat Signal", icon: "🦇", category: "fun", requirement: "Complete 20 night shifts", points: 35 },
  { id: "neon_defender", name: "Neon Defender", icon: "🌃", category: "fun", requirement: "Complete 25 night shifts + Shield 80+", points: 50 },
  { id: "shadow_responder", name: "Shadow Responder", icon: "🌑", category: "fun", requirement: "Complete 60 shifts + 20 night shifts", points: 55 },
  { id: "titan_guardian", name: "Titan Guardian", icon: "🗿", category: "consistency", requirement: "Complete 150 shifts + Shield 90+", points: 95 },
  { id: "hulk_smash", name: "Hulk Smash Shift", icon: "💥", category: "fun", requirement: "Complete 5 shifts in one day", points: 45 },
  { id: "marvel_mode", name: "Marvel Mode", icon: "🎬", category: "fun", requirement: "Complete all 10 trainings + 100 shifts", points: 100 },
  { id: "radio_active", name: "Radio Active", icon: "📻", category: "consistency", requirement: "Complete 25 shifts on different days", points: 40 },
  { id: "steady_hand", name: "Steady Hand", icon: "🖐️", category: "reputation", requirement: "Maintain 4.5+ rating with 20 reviews", points: 45 },
  { id: "people_magnet", name: "People Magnet", icon: "🧲", category: "reputation", requirement: "Receive 40 reviews", points: 55 },
  { id: "passport_legend", name: "Passport Legend", icon: "📘", category: "training", requirement: "Complete all trainings with Shield 80+", points: 70 },
  { id: "zero_to_hero", name: "Zero to Hero", icon: "🚀", category: "consistency", requirement: "Complete 50 shifts + 5 trainings", points: 45 },
  { id: "comms_king", name: "Comms King", icon: "📡", category: "fun", requirement: "Maintain 4.8+ rating with 30 reviews", points: 60 },
  { id: "early_riser_pro", name: "Early Riser Pro", icon: "🌤️", category: "fun", requirement: "Complete 25 morning shifts", points: 35 },
  { id: "night_commander", name: "Night Commander", icon: "🌌", category: "fun", requirement: "Complete 40 night shifts", points: 60 },
  { id: "safest_hands", name: "Safest Hands", icon: "🤲", category: "reputation", requirement: "Shield 95+ and 4.8+ rating", points: 75 },
  { id: "year_best", name: "Security of the Year", icon: "🥇", category: "shifts", requirement: "Complete 200 shifts", points: 120 },
  { id: "legendary_guard", name: "Legendary Guard", icon: "🐉", category: "consistency", requirement: "Complete 250 shifts + Shield 95+", points: 150 },
];

const FUN_PREFIXES = ["Stealth", "Iron", "Quiet", "Rapid", "Midnight", "Neon", "Titan", "Sentinel", "Granite", "Shadow"];
const FUN_SUFFIXES = ["Guardian", "Responder", "Patroller", "Protector", "Operator", "Commander", "Defender", "Specialist", "Agent", "Keeper"];
const FUN_ICONS = ["🛡️", "🚨", "📻", "👣", "🔦", "🧠", "⚡", "🛰️", "🧰", "🎯"];

function buildCatalog(): TrophyDef[] {
  const all = [...CORE_TROPHIES, ...SPECIAL_TROPHIES];
  let i = 0;
  while (all.length < 120) {
    const prefix = FUN_PREFIXES[i % FUN_PREFIXES.length];
    const suffix = FUN_SUFFIXES[Math.floor(i / FUN_PREFIXES.length) % FUN_SUFFIXES.length];
    const icon = FUN_ICONS[i % FUN_ICONS.length];
    const id = `legend_${all.length + 1}`;
    all.push({
      id,
      name: `${prefix} ${suffix}`,
      icon,
      category: "fun",
      requirement: `Reach Trophy Power ${all.length + 1}`,
      points: 5 + (i % 8) * 5,
    });
    i += 1;
  }
  return all;
}

export const TROPHY_DEFS: TrophyDef[] = buildCatalog();
