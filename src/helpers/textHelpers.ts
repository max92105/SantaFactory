/** Shared text/wording helpers so status messages stay consistent. */

/** "1 elf" / "3 elves" — use everywhere elves are counted in text. */
export function pluralizeElves(count: number): string {
  return count === 1 ? "elf" : "elves";
}

/** Generic plural: pluralize(3, "gift") → "gifts". */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
