// Flashcard scheduling: a small version of SM-2 (the algorithm behind Anki).
// A card you know well comes back after longer and longer gaps; one you
// forget comes back in ten minutes.

export const grades = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof grades)[number];

export type Schedule = { intervalDays: number; ease: number; reps: number; dueAt: Date };

const MIN_EASE = 1.3;
const AGAIN_DAYS = 10 / 1440; // ten minutes
const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function review(card: Omit<Schedule, "dueAt">, grade: Grade, now = new Date()): Schedule {
  const q = QUALITY[grade];
  let { intervalDays, ease, reps } = card;
  if (grade === "again") {
    reps = 0;
    intervalDays = AGAIN_DAYS;
    ease = Math.max(MIN_EASE, ease - 0.2);
  } else {
    reps += 1;
    intervalDays = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(Math.max(1, intervalDays) * ease);
    if (grade === "hard") intervalDays = Math.max(1, Math.round(intervalDays * 0.6));
    if (grade === "easy") intervalDays = Math.round(intervalDays * 1.3) + (reps === 1 ? 2 : 0);
    ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  return { intervalDays, ease: Math.round(ease * 100) / 100, reps, dueAt: new Date(now.getTime() + intervalDays * 86_400_000) };
}

/** When each grade would bring the card back, for the buttons ("10 min", "1 d", "6 d"). */
export function preview(card: Omit<Schedule, "dueAt">) {
  return Object.fromEntries(grades.map((g) => [g, review(card, g).intervalDays])) as Record<Grade, number>;
}
