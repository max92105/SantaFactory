/**
 * elfIcons — real portrait icons for each elf type (assets/icons/elves), used
 * everywhere an elf is shown (Hiring shop, factory crew cards, assign window,
 * idle chips, HUD breakdown). Falls back to the config emoji for any elf type
 * without an image, so adding a new elf never breaks the UI.
 *
 * Images load via Vite's glob so there's no 26-line import wall; the id→file map
 * below is the single place to wire a new portrait.
 */

// All elf portraits as URLs, keyed by file basename.
const urlByFile: Record<string, string> = {};
for (const [path, url] of Object.entries(
  import.meta.glob("../assets/icons/elves/*.png", { eager: true, query: "?url", import: "default" }) as Record<
    string,
    string
  >
)) {
  urlByFile[path.split("/").pop() ?? path] = url;
}

/** Elf type id → portrait file. (Some filenames differ from the id.) */
const FILE_BY_ID: Record<string, string> = {
  drunken: "ico_drunken_elf.png",
  clumsy: "ico_clumsy_elf.png",
  coked: "ico_coked_elf.png",
  worker: "ico_worker_elf.png",
  veteran: "ico_veteran_elf.png",
  shy: "ico_shy_elf.png",
  antisocial: "ico_antisocial_elf.png",
  retired: "ico_almost_retired_elf.png",
  workaholic: "ico_workaholic_elf.png",
  perfectionist: "ico_perfectionist_elf.png",
  manager: "ico_manager_elf.png",
  musician: "ico_apprentice_musician_elf.png",
  maestro: "ico_maestro_elf.png",
  coach: "ico_fitness_coach_elf.png",
  olympian: "ico_olympian_elf.png",
  vet_assistant: "ico_vet_assistant_elf.png",
  veterinarian: "ico_veterinarian_elf.png",
  geek: "ico_geek_elf.png",
  hacker: "ico_hacker_elf.png",
  apprentice_jeweler: "ico_apprentice_jeweler_elf.png",
  master_jeweler: "ico_master_jeweler_elf.png",
  apprentice_mech: "ico_apprentice_mechanic_elf.png",
  mechanic: "ico_mechanic_elf.png",
  master_mech: "ico_master_mechanic_elf.png",
  tinker: "ico_tinker_elf.png",
  mender: "ico_mender_elf.png",
};

/** Portrait URL for an elf type id, or undefined if none exists. */
export function elfIconUrl(id: string): string | undefined {
  const file = FILE_BY_ID[id];
  return file ? urlByFile[file] : undefined;
}

/**
 * HTML for an elf's icon: a rounded-square portrait `<img>` when one exists,
 * otherwise the emoji fallback (returned as-is so it inherits the caller's
 * font-size). Drop this in wherever `${def.icon}` used to be.
 */
export function elfIconHtml(id: string, emojiFallback: string): string {
  const url = elfIconUrl(id);
  return url ? `<img class="elf-icon" src="${url}" alt="" draggable="false" />` : emojiFallback;
}
