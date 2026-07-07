/**
 * domRegistry — typed references to every element the game touches.
 * Collected once at boot (after all markup is mounted) so a missing
 * element fails loudly instead of silently breaking a feature.
 */

export type DomRefs = {
  // Header — resources
  hudGifts: HTMLElement;
  hudMoney: HTMLElement;
  hudElves: HTMLElement;
  giftsResource: HTMLElement;
  giftsDropdown: HTMLElement;

  // Header — time
  hudDay: HTMLElement;
  hudTimeOfDay: HTMLElement;
  timeBarFill: HTMLDivElement;

  // Header — menu
  menuBtn: HTMLButtonElement;
  menuPanel: HTMLDivElement;
  saveBtn: HTMLButtonElement;
  loadBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;

  // Main tab navigation
  tabButtons: NodeListOf<HTMLButtonElement>;
  tabClick: HTMLDivElement;
  tabFactory: HTMLDivElement;
  tabShop: HTMLDivElement;
  tabStorage: HTMLDivElement;
  tabMetrics: HTMLDivElement;

  // Click page
  makeGiftBtn: HTMLButtonElement;
  floatLayer: HTMLDivElement;
  clickGpc: HTMLElement;
  clickToySelector: HTMLDivElement;

  // Factory page
  totalElves: HTMLElement;
  unassignedElves: HTMLElement;
  pipelineList: HTMLDivElement;
  wipGrid: HTMLDivElement;

  // Shop page
  shopTabs: NodeListOf<HTMLButtonElement>;
  shopWorkforce: HTMLDivElement;
  shopUpgrades: HTMLDivElement;
  shopMachines: HTMLDivElement;
  producersList: HTMLDivElement;
  upgradesList: HTMLDivElement;

  // Storage page
  inventoryGrid: HTMLDivElement;
  sellTypeSelector: HTMLDivElement;
  sellUnitLabel: HTMLElement;
  sellSlider: HTMLInputElement;
  sellBtn: HTMLButtonElement;
  sellAmountLabel: HTMLElement;
  sellPreviewMoney: HTMLElement;
  sellFloatLayer: HTMLDivElement;
  sellQuickButtons: NodeListOf<HTMLButtonElement>;
  sellPctButtons: NodeListOf<HTMLButtonElement>;

  // Metrics page
  mGpc: HTMLElement;
  mGps: HTMLElement;
  mSellRate: HTMLElement;
  mGifts: HTMLElement;
  mMoney: HTMLElement;
  mNetWorth: HTMLElement;
  mLifetimeGifts: HTMLElement;
  mLifetimeSold: HTMLElement;
  mWagesDue: HTMLElement;
  mWageResult: HTMLElement;
  wageRuleText: HTMLElement;

  // Footer
  statusText: HTMLElement;
};

function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function getDomRefs(): DomRefs {
  return {
    // Header — resources
    hudGifts: mustGet("hudGifts"),
    hudMoney: mustGet("hudMoney"),
    hudElves: mustGet("hudElves"),
    giftsResource: mustGet("giftsResource"),
    giftsDropdown: mustGet("giftsDropdown"),

    // Header — time
    hudDay: mustGet("hudDay"),
    hudTimeOfDay: mustGet("hudTimeOfDay"),
    timeBarFill: mustGet("timeBarFill"),

    // Header — menu
    menuBtn: mustGet("menuBtn"),
    menuPanel: mustGet("menuPanel"),
    saveBtn: mustGet("saveBtn"),
    loadBtn: mustGet("loadBtn"),
    resetBtn: mustGet("resetBtn"),

    // Main tab navigation
    tabButtons: document.querySelectorAll<HTMLButtonElement>(".tab-nav .tab-btn"),
    tabClick: mustGet("tab-click"),
    tabFactory: mustGet("tab-factory"),
    tabShop: mustGet("tab-shop"),
    tabStorage: mustGet("tab-storage"),
    tabMetrics: mustGet("tab-metrics"),

    // Click page
    makeGiftBtn: mustGet("makeGiftBtn"),
    floatLayer: mustGet("floatLayer"),
    clickGpc: mustGet("clickGpc"),
    clickToySelector: mustGet("clickToySelector"),

    // Factory page
    totalElves: mustGet("totalElves"),
    unassignedElves: mustGet("unassignedElves"),
    pipelineList: mustGet("pipelineList"),
    wipGrid: mustGet("wipGrid"),

    // Shop page
    shopTabs: document.querySelectorAll<HTMLButtonElement>(".shop-tab"),
    shopWorkforce: mustGet("shop-workforce"),
    shopUpgrades: mustGet("shop-upgrades"),
    shopMachines: mustGet("shop-machines"),
    producersList: mustGet("producersList"),
    upgradesList: mustGet("upgradesList"),

    // Storage page
    inventoryGrid: mustGet("inventoryGrid"),
    sellTypeSelector: mustGet("sellTypeSelector"),
    sellUnitLabel: mustGet("sellUnitLabel"),
    sellSlider: mustGet("sellSlider"),
    sellBtn: mustGet("sellBtn"),
    sellAmountLabel: mustGet("sellAmountLabel"),
    sellPreviewMoney: mustGet("sellPreviewMoney"),
    sellFloatLayer: mustGet("sellFloatLayer"),
    sellQuickButtons: document.querySelectorAll<HTMLButtonElement>(".sell-quick"),
    sellPctButtons: document.querySelectorAll<HTMLButtonElement>(".sell-pct"),

    // Metrics page
    mGpc: mustGet("mGpc"),
    mGps: mustGet("mGps"),
    mSellRate: mustGet("mSellRate"),
    mGifts: mustGet("mGifts"),
    mMoney: mustGet("mMoney"),
    mNetWorth: mustGet("mNetWorth"),
    mLifetimeGifts: mustGet("mLifetimeGifts"),
    mLifetimeSold: mustGet("mLifetimeSold"),
    mWagesDue: mustGet("mWagesDue"),
    mWageResult: mustGet("mWageResult"),
    wageRuleText: mustGet("wageRuleText"),

    // Footer
    statusText: mustGet("statusText"),
  };
}
