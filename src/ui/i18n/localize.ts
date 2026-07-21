/**
 * localize — localized accessors for config-driven names/descriptions. Each
 * falls back to the config's English string when a translation key is missing,
 * so newly-added content still renders. Keys live in messages.ts.
 */

import { tOr, t } from "./i18n";
import { getToyType } from "../../config/toyTypesConfig";
import { getElfType, elfCategories } from "../../config/elfTypesConfig";
import { getPipelineStep, PRODUCTION_STAGES } from "../../config/pipelineConfig";
import { getShiftSlot } from "../../config/shiftsConfig";
import { getUpgrade } from "../../config/upgradesConfig";
import { getOrderTemplate } from "../../config/ordersConfig";
import { gameEvents } from "../../config/eventsConfig";
import { getRandomEvent } from "../../config/randomEventsConfig";
import { grandOrderDefs } from "../../config/grandOrdersConfig";

// ── Toys ──
export function toyName(id: string): string {
  return tOr(`toy.${id}`, getToyType(id)?.name ?? id);
}
export function toyIcon(id: string): string {
  return getToyType(id)?.icon ?? "🎁";
}
/** "🧸 Peluche" */
export function toyLabel(id: string): string {
  return `${toyIcon(id)} ${toyName(id)}`;
}

// ── Elves ──
export function elfName(id: string): string {
  return tOr(`elf.${id}.name`, getElfType(id)?.name ?? id);
}
export function elfDesc(id: string): string {
  return tOr(`elf.${id}.desc`, getElfType(id)?.description ?? "");
}
export function elfCategoryName(id: string): string {
  return tOr(`elfCat.${id}.name`, elfCategories.find((c) => c.id === id)?.name ?? id);
}
export function elfCategoryDesc(id: string): string {
  return tOr(`elfCat.${id}.desc`, elfCategories.find((c) => c.id === id)?.description ?? "");
}
/**
 * Short, scannable chips describing a specialist elf type's work rules — shown
 * on hiring cards and in the crew-assign window so constraints are visible
 * BEFORE you commit to hiring/assigning. Empty array for elves with no quirks.
 * `includeBlockedSlots` also chips the shifts a type refuses (e.g. antisocial
 * elves skipping daylight) — omitted on the hiring card, where that's already
 * shown by the Shifts stat, but included in the assign window, which isn't.
 */
export function elfTraitChips(id: string, opts?: { includeBlockedSlots?: boolean }): string[] {
  const def = getElfType(id);
  if (!def) return [];
  const chips: string[] = [];
  if (def.managerMult) chips.push(t("trait.manager", { mult: def.managerMult }));
  if (def.shy) chips.push(t("trait.shy"));
  if (def.dayOffChance) chips.push(t("trait.dayOff", { pct: Math.round(def.dayOffChance * 100) }));
  if (def.mistakeChance === 0 && !def.managerMult && def.role === "worker") chips.push(t("trait.perfect"));
  if (opts?.includeBlockedSlots && def.blockedSlots?.length) {
    chips.push(t("trait.blockedSlots", { slots: def.blockedSlots.map((s) => slotName(s)).join(", ") }));
  }
  return chips;
}

// ── Pipeline steps + stages ──
export function stepName(id: string): string {
  return tOr(`step.${id}.name`, getPipelineStep(id)?.name ?? id);
}
export function stepDesc(id: string): string {
  return tOr(`step.${id}.desc`, getPipelineStep(id)?.description ?? "");
}
export function stageLabel(id: string): string {
  return tOr(`stage.${id}`, PRODUCTION_STAGES.find((s) => s.id === id)?.label ?? id);
}

// ── Shift slots (Morning/Afternoon/Evening/Night → tod.* keys) ──
export function slotName(id: string): string {
  const raw = getShiftSlot(id)?.name ?? id;
  return tOr(`tod.${raw}`, raw);
}

// ── Upgrades ──
export function upgradeName(id: string): string {
  return tOr(`upgrade.${id}.name`, getUpgrade(id)?.name ?? id);
}
export function upgradeDesc(id: string): string {
  return tOr(`upgrade.${id}.desc`, getUpgrade(id)?.description ?? "");
}

// ── Orders / events ──
export function orderTemplateName(id: string): string {
  return tOr(`orderTpl.${id}`, getOrderTemplate(id)?.name ?? id);
}
export function calendarEventName(id: string): string {
  return tOr(`calEvent.${id}.name`, gameEvents.find((e) => e.id === id)?.name ?? id);
}
export function calendarEventDesc(id: string): string {
  return tOr(`calEvent.${id}.desc`, gameEvents.find((e) => e.id === id)?.description ?? "");
}
export function randomEventTitle(id: string): string {
  return tOr(`event.${id}.title`, getRandomEvent(id)?.title ?? id);
}
export function randomEventDesc(id: string, params?: Record<string, string | number>): string {
  return tOr(`event.${id}.desc`, getRandomEvent(id)?.desc ?? "", params);
}
export function grandOrderName(defId: string): string {
  return tOr(`grand.${defId}.name`, grandOrderDefs.find((d) => d.id === defId)?.name ?? defId);
}
export function grandOrderFlavor(defId: string): string {
  return tOr(`grand.${defId}.flavor`, grandOrderDefs.find((d) => d.id === defId)?.flavor ?? "");
}
