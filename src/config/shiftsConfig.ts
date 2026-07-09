/**
 * Shift slots — a day is split into 4 eight-hour slots that line up with the
 * time-of-day clock. Elves are scheduled per slot; a step only produces during
 * a slot if elves are scheduled for it that slot.
 *
 * Each elf provides `maxShifts` slots of capacity (elfTypesConfig.ts). Drunken
 * elves refuse the night slot (busy getting drunk).
 */

export type ShiftSlotDef = {
  id: string;
  name: string;
  icon: string;
};

export const shiftSlots: ShiftSlotDef[] = [
  { id: "morning", name: "Morning", icon: "🌅" },
  { id: "afternoon", name: "Afternoon", icon: "☀️" },
  { id: "evening", name: "Evening", icon: "🌆" },
  { id: "night", name: "Night", icon: "🌙" },
];

export const NIGHT_SLOT = "night";

export function getShiftSlot(id: string): ShiftSlotDef | undefined {
  return shiftSlots.find((s) => s.id === id);
}

/** Which slot is active for a given day progress (0..1). Matches TimeSystem's labels. */
export function currentShiftSlot(dayProgress: number): string {
  const p = Math.min(0.999, Math.max(0, dayProgress));
  const index = Math.floor(p * shiftSlots.length);
  return shiftSlots[index]?.id ?? shiftSlots[0].id;
}
