/**
 * Toy categories — the backbone of the production overhaul.
 *
 * Every toy belongs to ONE category. A category defines the extra production
 * steps a toy must pass through (between the craft step and Quality Control),
 * and each of those steps requires a specific elf SPECIALTY to staff it.
 *
 * A non-"basic" category is gated behind a single `unlockUpgrade`. Buying that
 * upgrade unlocks THREE things at once (kept in lockstep on purpose, so the
 * player learns one gate, not three):
 *   1. its toy lines become buyable in the New Toys shop,
 *   2. its specialist elves become hireable in the Hiring shop,
 *   3. its specialist station(s) appear in the Factory.
 *
 * To add a category: add an entry here (+ its unlock upgrade + specialist elf
 * types in elfTypesConfig). Pipeline steps, upgrades, stage routing, shop
 * grouping and the factory rail all derive from this — nothing else to touch.
 *
 * ── Stage routing (see pipelineConfig) ──────────────────────────────────────
 * craft → [specialist steps] → Quality Control → Packaging. Craft outputs to
 * `raw` when there are no specialist steps, else to `wip1`; specialist steps
 * flow wip1 → wip2 → … and the LAST one outputs to `raw`, so QC (`raw` →
 * `assembled`) and Packaging (`assembled` → `finished`) stay shared and uniform
 * across every category. Two specialist steps is the current max (electronics,
 * jewellery); supporting a third means adding `wip3` to the stage list.
 */

/** One extra production step a category inserts before Quality Control. */
export type SpecialistStepDef = {
  /** Unique pipeline step id (also the station's id), e.g. "tuning". */
  id: string;
  /** Elf specialty required to staff it (matches an elf's `specialty`). */
  specialty: string;
  icon: string;
  /** Seconds one elf takes to process one item at this station. */
  baseTime: number;
};

export type ToyCategoryDef = {
  id: string;
  name: string;
  icon: string;
  /** Upgrade id that unlocks this category (undefined = "basic": always on). */
  unlockUpgrade?: string;
  /** Cost of that unlock upgrade (used to generate it in upgradesConfig). */
  unlockCost?: number;
  /** Extra steps between craft and Quality Control, in order (empty for basic). */
  specialistSteps: SpecialistStepDef[];
};

export const toyCategories: ToyCategoryDef[] = [
  {
    id: "basic",
    name: "Basic Toys",
    icon: "🧸",
    specialistSteps: [],
  },
  {
    id: "music",
    name: "Music Toys",
    icon: "🎵",
    unlockUpgrade: "unlock_music",
    unlockCost: 40000,
    specialistSteps: [{ id: "tuning", specialty: "musical", icon: "🎚️", baseTime: 4 }],
  },
  {
    id: "sports",
    name: "Sports Equipment",
    icon: "🏅",
    unlockUpgrade: "unlock_sports",
    unlockCost: 120000,
    specialistSteps: [{ id: "balancing", specialty: "athlete", icon: "⚖️", baseTime: 4 }],
  },
  {
    id: "animals",
    name: "Animals",
    icon: "🐾",
    unlockUpgrade: "unlock_animals",
    unlockCost: 350000,
    specialistSteps: [{ id: "training", specialty: "vet", icon: "🎓", baseTime: 5 }],
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: "🔌",
    unlockUpgrade: "unlock_electronics",
    unlockCost: 900000,
    specialistSteps: [
      { id: "connect", specialty: "nerd", icon: "🔗", baseTime: 5 },
      { id: "configure", specialty: "nerd", icon: "🖥️", baseTime: 6 },
    ],
  },
  {
    id: "jewellery",
    name: "Jewellery",
    icon: "💎",
    unlockUpgrade: "unlock_jewellery",
    unlockCost: 2500000,
    specialistSteps: [
      { id: "melting", specialty: "jeweler", icon: "🔥", baseTime: 6 },
      { id: "polishing", specialty: "jeweler", icon: "✨", baseTime: 7 },
    ],
  },
];

/** The elf specialties in play, each tied to the category that unlocks them.
 *  `elfCategory` is the Hiring-shop group id for that specialty's elves. */
export const SPECIALTIES: { id: string; categoryId: string; elfCategory: string }[] = toyCategories
  .flatMap((c) => c.specialistSteps.map((s) => ({ specialty: s.specialty, categoryId: c.id })))
  .filter((v, i, arr) => arr.findIndex((x) => x.specialty === v.specialty) === i)
  .map((v) => ({ id: v.specialty, categoryId: v.categoryId, elfCategory: v.specialty }));

export function getToyCategory(id: string): ToyCategoryDef | undefined {
  return toyCategories.find((c) => c.id === id);
}

/** The specialist step definition for a given station id (undefined if not one). */
export function getSpecialistStep(stepId: string): SpecialistStepDef | undefined {
  for (const c of toyCategories) {
    const s = c.specialistSteps.find((st) => st.id === stepId);
    if (s) return s;
  }
  return undefined;
}

/** The category that owns a specialist station id (undefined if not one). */
export function categoryOfSpecialistStep(stepId: string): ToyCategoryDef | undefined {
  return toyCategories.find((c) => c.specialistSteps.some((s) => s.id === stepId));
}
