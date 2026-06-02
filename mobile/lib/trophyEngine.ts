import type { TrophyDef } from "../data/trophies";

export type TrophyStats = {
  completedShifts: number;
  shieldScore: number;
  trainingCount: number;
  reviewCount: number;
  avgRating: number;
  activeDays: number;
  nightShifts: number;
  morningShifts: number;
  maxShiftsSingleDay: number;
};

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function getTrophyPower(s: TrophyStats): number {
  return (
    s.completedShifts +
    s.trainingCount * 3 +
    s.reviewCount +
    Math.floor(s.shieldScore / 5) +
    s.activeDays * 2 +
    Math.floor(s.avgRating * 4) +
    s.nightShifts +
    s.morningShifts +
    s.maxShiftsSingleDay * 4
  );
}

export function earnedByRule(id: string, s: TrophyStats): boolean {
  const trophyPower = getTrophyPower(s);
  switch (id) {
    case "shift_1": return s.completedShifts >= 1;
    case "shift_5": return s.completedShifts >= 5;
    case "shift_25": return s.completedShifts >= 25;
    case "shift_50": return s.completedShifts >= 50;
    case "shift_100": return s.completedShifts >= 100;
    case "training_1": return s.trainingCount >= 1;
    case "training_5": return s.trainingCount >= 5;
    case "training_10": return s.trainingCount >= 10;
    case "review_5": return s.reviewCount >= 5;
    case "review_20": return s.reviewCount >= 20;
    case "rating_45": return s.reviewCount >= 5 && s.avgRating >= 4.5;
    case "rating_48": return s.reviewCount >= 10 && s.avgRating >= 4.8;
    case "score_70": return s.shieldScore >= 70;
    case "score_85": return s.shieldScore >= 85;
    case "score_95": return s.shieldScore >= 95;
    case "hulk_mode": return s.maxShiftsSingleDay >= 3;
    case "night_owl": return s.nightShifts >= 10;
    case "early_bird": return s.morningShifts >= 10;
    case "streak_7": return s.activeDays >= 7;
    case "streak_30": return s.activeDays >= 30;
    case "nick_fury": return s.completedShifts >= 75 && s.trainingCount >= 10 && s.shieldScore >= 85;
    case "door_jedi": return s.completedShifts >= 40 && s.reviewCount >= 10 && s.avgRating >= 4.8;
    case "captain_queue": return s.completedShifts >= 30;
    case "bat_signal": return s.nightShifts >= 20;
    case "neon_defender": return s.nightShifts >= 25 && s.shieldScore >= 80;
    case "shadow_responder": return s.completedShifts >= 60 && s.nightShifts >= 20;
    case "titan_guardian": return s.completedShifts >= 150 && s.shieldScore >= 90;
    case "hulk_smash": return s.maxShiftsSingleDay >= 5;
    case "marvel_mode": return s.trainingCount >= 10 && s.completedShifts >= 100;
    case "radio_active": return s.activeDays >= 25;
    case "steady_hand": return s.reviewCount >= 20 && s.avgRating >= 4.5;
    case "people_magnet": return s.reviewCount >= 40;
    case "passport_legend": return s.trainingCount >= 10 && s.shieldScore >= 80;
    case "zero_to_hero": return s.completedShifts >= 50 && s.trainingCount >= 5;
    case "comms_king": return s.reviewCount >= 30 && s.avgRating >= 4.8;
    case "early_riser_pro": return s.morningShifts >= 25;
    case "night_commander": return s.nightShifts >= 40;
    case "safest_hands": return s.shieldScore >= 95 && s.reviewCount >= 20 && s.avgRating >= 4.8;
    case "year_best": return s.completedShifts >= 200;
    case "legendary_guard": return s.completedShifts >= 250 && s.shieldScore >= 95;
    default:
      if (id.startsWith("legend_")) {
        const n = Number(id.replace("legend_", ""));
        if (!Number.isFinite(n)) return false;
        return trophyPower >= n;
      }
      return false;
  }
}

export function splitTrophies(defs: TrophyDef[], stats: TrophyStats) {
  const earned: TrophyDef[] = [];
  const locked: TrophyDef[] = [];
  defs.forEach((t) => (earnedByRule(t.id, stats) ? earned : locked).push(t));
  return { earned, locked };
}
