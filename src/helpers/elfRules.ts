/**
 * Elf rules — THE single source of truth for "what can this elf do, and where?".
 *
 * Every restriction an elf type carries used to be scattered: shift counts in
 * elfTypesConfig, structural checks in workforceHelpers, chip text in
 * localize.ts, reason strings inside the assign modal. That made it easy to
 * teach one screen a rule and forget another. Everything now derives from here:
 *
 *   elfRules(typeId)         → the full, describable rule list for a type
 *   slotRestrictionFor(...)  → why a type can't take a shift (the hard gate)
 *   canElfTypeWorkStep(...)  → role + specialty gate for a station
 *   requiredShifts(typeId)   → how many slots one elf of the type must cover
 *
 * This module is PURE: it reads config and whatever it's handed, never
 * state.workforce (that stays workforceHelpers' job, so there's exactly one
 * place touching the roster and no import cycle). workforceHelpers wraps these
 * with the state lookups; UI renders the same rule objects everywhere.
 *
 * Rule text lives in i18n under `rule.<kind>` — see ui/i18n/localize.ts
 * (elfRuleChips) for the rendering side.
 */

import { getElfType, type ElfTypeDef, type ElfRole } from "../config/elfTypesConfig";
import { shiftSlots } from "../config/shiftsConfig";
import { getPipelineStep } from "../config/pipelineConfig";
import { MAINTENANCE_STEP, REPAIR_STEP } from "../config/stationsConfig";

// ── The rule model ────────────────────────────────────────────────────────
/**
 * Every kind of rule an elf type can carry. Adding one here and to
 * `elfRules()` makes it appear in the hiring card, the crew roster and the
 * assign panel at once — they all render this list.
 */
export type ElfRuleKind =
  | "shifts" // covers N of the day's 4 slots
  | "blockedSlots" // refuses specific slots outright
  | "manager" // boosts the crew, builds nothing, one per station+shift
  | "shy" // only shares a station+shift with other shy elves
  | "dayOff" // may not show up at all on a given day
  | "specialty" // locked to one category's station
  | "flawless" // never ruins an item
  | "repairs" // mechanic: seconds per station repair
  | "mends"; // mender: seconds per toy refurbished

/**
 * How a rule reads to the player, which drives its colour everywhere:
 *  - "perk"  something good (flawless, manager boost)
 *  - "limit" a hard constraint you must schedule around (shifts, blocked slots)
 *  - "risk"  it might bite you later (day-off chance)
 *  - "info"  neutral fact (specialty, repair speed)
 */
export type ElfRuleTone = "perk" | "limit" | "risk" | "info";

export type ElfRule = {
  kind: ElfRuleKind;
  tone: ElfRuleTone;
  icon: string;
  /** Fills the `rule.<kind>` i18n string. */
  params?: Record<string, string | number>;
  /** Slot ids the rule refers to (blockedSlots) — lets UI localize slot names. */
  slots?: string[];
};

/**
 * Every rule a type carries, ordered most-constraining first so a truncated
 * chip list still shows what actually matters.
 */
export function elfRules(typeId: string): ElfRule[] {
  const def = getElfType(typeId);
  if (!def) return [];
  const rules: ElfRule[] = [];

  if (def.managerMult) {
    rules.push({ kind: "manager", tone: "perk", icon: "👔", params: { mult: def.managerMult } });
  }
  if (def.shy) {
    rules.push({ kind: "shy", tone: "limit", icon: "🙈" });
  }
  if (def.blockedSlots?.length) {
    rules.push({ kind: "blockedSlots", tone: "limit", icon: "🚫", slots: def.blockedSlots });
  }
  rules.push({
    kind: "shifts",
    tone: def.maxShifts >= shiftSlots.length ? "perk" : "limit",
    icon: "⏱",
    params: { n: def.maxShifts, of: shiftSlots.length },
  });
  if (def.dayOffChance) {
    rules.push({ kind: "dayOff", tone: "risk", icon: "😴", params: { pct: Math.round(def.dayOffChance * 100) } });
  }
  if (def.specialty) {
    rules.push({ kind: "specialty", tone: "info", icon: "🎓", params: { specialty: def.specialty } });
  }
  if (def.role === "worker" && def.mistakeChance === 0 && !def.managerMult) {
    rules.push({ kind: "flawless", tone: "perk", icon: "✨" });
  }
  if (def.role === "mechanic" && def.repairTime) {
    rules.push({ kind: "repairs", tone: "info", icon: "🔧", params: { s: def.repairTime } });
  }
  if (def.role === "mender" && def.refurbishTime) {
    rules.push({ kind: "mends", tone: "info", icon: "🪡", params: { s: def.refurbishTime } });
  }

  return rules;
}

// ── Station eligibility (role + specialty) ────────────────────────────────
/** Which elf role a step needs: mechanic (Maintenance), mender (Repair Bench),
 *  or worker (every production step). */
export function stepRole(stepId: string): ElfRole {
  if (stepId === MAINTENANCE_STEP) return "mechanic";
  if (stepId === REPAIR_STEP) return "mender";
  return "worker";
}

/** The elf specialty a step requires (specialist stations only; else undefined). */
export function stepRequiredSpecialty(stepId: string): string | undefined {
  return getPipelineStep(stepId)?.requiredSpecialty;
}

/**
 * Can this elf TYPE work this step at all? Role must match, and for production
 * steps the specialty must match exactly — generalist workers (no specialty)
 * only do craft/QC/packaging, specialists ONLY do their specialty station.
 */
export function canElfTypeWorkStep(def: ElfTypeDef | undefined, stepId: string): boolean {
  if (!def) return false;
  if (def.role !== stepRole(stepId)) return false;
  if (def.role !== "worker") return true;
  return (def.specialty ?? null) === (stepRequiredSpecialty(stepId) ?? null);
}

// ── Shift eligibility ─────────────────────────────────────────────────────
/** Can this elf type work the given slot? (false if it's in its blockedSlots.) */
export function canWorkSlot(typeId: string, slotId: string): boolean {
  return !getElfType(typeId)?.blockedSlots?.includes(slotId);
}

/** Slots an elf type is allowed to work at all (some skip specific shifts). */
export function allowedSlots(typeId: string): string[] {
  return shiftSlots.filter((s) => canWorkSlot(typeId, s.id)).map((s) => s.id);
}

/** How many shift slots one elf of this type works (capped by allowed slots). */
export function requiredShifts(typeId: string): number {
  const max = getElfType(typeId)?.maxShifts ?? 0;
  return Math.min(max, allowedSlots(typeId).length);
}

/**
 * Why can't this elf type take this slot, given who's already on it?
 *  - "blocked":       the type refuses this slot (blockedSlots).
 *  - "manager_taken": a manager already runs this station+shift (max one).
 *  - "shy_mixed":     a shy elf can't join non-shy crew on this shift.
 *  - "shy_blocked":   a non-shy elf can't join a shy crew on this shift.
 *
 * `crewTypeIds` is every elf type SCHEDULED on that station+slot (day-off elves
 * still hold their spot). Pure — workforceHelpers.slotRestriction feeds it.
 */
export type SlotRestriction = "blocked" | "manager_taken" | "shy_mixed" | "shy_blocked";

export function slotRestrictionFor(
  typeId: string,
  slotId: string,
  crewTypeIds: string[]
): SlotRestriction | null {
  if (!canWorkSlot(typeId, slotId)) return "blocked";
  const def = getElfType(typeId);
  const crew = crewTypeIds.map((id) => getElfType(id));

  if (def?.managerMult && crew.some((d) => d?.managerMult)) return "manager_taken";
  if (def?.shy && crew.some((d) => !d?.shy)) return "shy_mixed";
  if (!def?.shy && crew.some((d) => d?.shy)) return "shy_blocked";
  return null;
}

/** Is a restriction the elf's own nature (vs. caused by who else is on shift)?
 *  Own-nature ones are worth showing on a hiring card; the rest only matter
 *  once you're looking at a specific station. */
export function isIntrinsicRestriction(r: SlotRestriction): boolean {
  return r === "blocked";
}
