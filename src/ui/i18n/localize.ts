/**
 * localize — localized accessors for config-driven names/descriptions. Each
 * falls back to the config's English string when a translation key is missing,
 * so newly-added content still renders. Keys live in messages.ts.
 */

import { tOr, t } from "./i18n";
import { getToyType } from "../../config/toyTypesConfig";
import { getToyCategory } from "../../config/toyCategoriesConfig";
import { getElfType, elfCategories } from "../../config/elfTypesConfig";
import { elfRules, type ElfRuleKind, type ElfRuleTone, type SlotRestriction } from "../../helpers/elfRules";
import { getPipelineStep, PRODUCTION_STAGES } from "../../config/pipelineConfig";
import { getShiftSlot } from "../../config/shiftsConfig";
import { getUpgrade, CATEGORY_UNLOCK_IDS, warehouseTierNumber } from "../../config/upgradesConfig";
import { capacityForTiers } from "../../config/storageConfig";
import { formatInt } from "../../helpers/formatHelpers";
import { toyCategories } from "../../config/toyCategoriesConfig";
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
 * Localized, scannable chips for an elf type's work rules — the ONE renderer
 * for helpers/elfRules.ts, used by the hiring card, the crew roster and the
 * assign panel alike. Add a rule kind in elfRules and it shows up in all three.
 */
export type ElfRuleChip = { kind: ElfRuleKind; tone: ElfRuleTone; icon: string; text: string };

export function elfRuleChips(id: string): ElfRuleChip[] {
  return elfRules(id).map((r) => ({
    kind: r.kind,
    tone: r.tone,
    icon: r.icon,
    text: t(`rule.${r.kind}`, {
      ...(r.params ?? {}),
      // Rules that name shifts or specialties localize them here, so elfRules
      // itself never has to know about the i18n layer.
      ...(r.slots ? { slots: r.slots.map((s) => slotName(s)).join(", ") } : {}),
      ...(r.params?.specialty ? { specialty: specialtyLabel(String(r.params.specialty)) } : {}),
    }),
  }));
}

/** Why a shift is closed to a type — the localized `SlotRestriction`. */
export function slotRestrictionText(r: SlotRestriction): string {
  return t(`restriction.${r}`);
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

// ── Toy categories + specialties ──
export function toyCategoryLabel(catId: string): string {
  return tOr(`toyCat.${catId}.name`, getToyCategory(catId)?.name ?? catId);
}
export function specialtyLabel(specialty: string): string {
  return tOr(`specialty.${specialty}`, specialty);
}

// ── Upgrades (the generated category-unlock, hand-build and warehouse ones are
//    templated, so a new toy/category/storage tier needs no new strings) ──
export function upgradeName(id: string): string {
  if (id.startsWith("handbuild_")) {
    return t("upgrade.handbuild.name", { name: toyName(id.slice("handbuild_".length)) });
  }
  if (CATEGORY_UNLOCK_IDS.has(id)) {
    const cat = toyCategories.find((c) => c.unlockUpgrade === id);
    return t("upgrade.catUnlock.name", { name: cat ? toyCategoryLabel(cat.id) : id });
  }
  const tier = warehouseTierNumber(id);
  if (tier > 0) return t("upgrade.warehouse.name", { n: tier });
  return tOr(`upgrade.${id}.name`, getUpgrade(id)?.name ?? id);
}
export function upgradeDesc(id: string): string {
  if (id.startsWith("handbuild_")) {
    return t("upgrade.handbuild.desc", { name: toyName(id.slice("handbuild_".length)) });
  }
  if (CATEGORY_UNLOCK_IDS.has(id)) {
    const cat = toyCategories.find((c) => c.unlockUpgrade === id);
    return t("upgrade.catUnlock.desc", { name: cat ? toyCategoryLabel(cat.id) : id });
  }
  const tier = warehouseTierNumber(id);
  if (tier > 0) {
    return t("upgrade.warehouse.desc", {
      from: formatInt(capacityForTiers(tier - 1)),
      to: formatInt(capacityForTiers(tier)),
    });
  }
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
