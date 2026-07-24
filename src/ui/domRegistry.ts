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
  giftsToggle: HTMLButtonElement;
  giftsDropdown: HTMLElement;
  elvesResource: HTMLElement;
  elvesToggle: HTMLButtonElement;
  elvesDropdown: HTMLElement;

  // Header — season clock
  hudDay: HTMLElement;
  hudTimeOfDay: HTMLElement;
  hudTimeIcon: HTMLElement;
  hudDaysLeft: HTMLElement;
  timeBarFill: HTMLDivElement;

  // Header — menu
  menuBtn: HTMLButtonElement;
  menuPanel: HTMLDivElement;
  saveBtn: HTMLButtonElement;
  muteBtn: HTMLButtonElement;
  notifyBtn: HTMLButtonElement;
  mainMenuBtn: HTMLButtonElement;
  langSelect: HTMLElement;

  // Main tab navigation
  tabButtons: NodeListOf<HTMLButtonElement>;
  tabClick: HTMLDivElement;
  tabFactory: HTMLDivElement;
  tabShop: HTMLDivElement;
  tabStorage: HTMLDivElement;
  tabOrders: HTMLDivElement;
  tabMetrics: HTMLDivElement;
  factoryBadge: HTMLElement;
  ordersBadge: HTMLElement;

  // Toasts + celebration effects
  toastLayer: HTMLDivElement;
  fxLayer: HTMLDivElement;

  // Click page
  clickArea: HTMLElement;
  makeGiftBtn: HTMLButtonElement;
  floatLayer: HTMLDivElement;
  clickCombo: HTMLElement;
  clickGpc: HTMLElement;
  clickStock: HTMLElement;
  clickToyName: HTMLElement;
  clickToyValue: HTMLElement;
  clickToySelector: HTMLDivElement;

  // Factory page
  totalElves: HTMLElement;
  assignedElves: HTMLElement;
  unassignedElves: HTMLElement;
  unassignedTypes: HTMLDivElement;
  factoryRail: HTMLDivElement;
  factoryDetail: HTMLDivElement;

  // Shop page ("Upgrades" tab)
  shopCats: NodeListOf<HTMLButtonElement>;
  shopViews: NodeListOf<HTMLElement>;
  shopContentTitle: HTMLElement;
  shopSearch: HTMLInputElement;
  shopEmpty: HTMLElement;
  toysList: HTMLDivElement;
  elvesList: HTMLDivElement;
  upgradesList: HTMLDivElement;

  // Storage page
  storageList: HTMLDivElement;
  storageEmpty: HTMLElement;
  storageSearch: HTMLInputElement;
  storageTotalStock: HTMLElement;
  storageTotalValue: HTMLElement;
  storageTotalBroken: HTMLElement;
  sellAllBtn: HTMLButtonElement;
  sellFloatLayer: HTMLDivElement;

  // Orders page
  ordersChristmas: HTMLElement;
  ordersGrand: HTMLElement;
  ordersEvent: HTMLElement;
  ordersActiveList: HTMLDivElement;
  ordersOfferList: HTMLDivElement;
  ordersActiveCount: HTMLElement;
  ordersMax: HTMLElement;

  // Metrics page
  mGpc: HTMLElement;
  mGps: HTMLElement;
  mSellRates: HTMLDivElement;
  mGifts: HTMLElement;
  mMoney: HTMLElement;
  mNetWorth: HTMLElement;
  mBrokenHeld: HTMLElement;
  mLifetimeGifts: HTMLElement;
  mLifetimeSold: HTMLElement;
  mLifetimeRuined: HTMLElement;
  mOrdersFilled: HTMLElement;
  mDayMade: HTMLElement;
  mDaySold: HTMLElement;
  mDayEarned: HTMLElement;
  mDayRuined: HTMLElement;
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
    giftsToggle: mustGet("giftsToggle"),
    giftsDropdown: mustGet("giftsDropdown"),
    elvesResource: mustGet("elvesResource"),
    elvesToggle: mustGet("elvesToggle"),
    elvesDropdown: mustGet("elvesDropdown"),

    // Header — season clock
    hudDay: mustGet("hudDay"),
    hudTimeOfDay: mustGet("hudTimeOfDay"),
    hudTimeIcon: mustGet("hudTimeIcon"),
    hudDaysLeft: mustGet("hudDaysLeft"),
    timeBarFill: mustGet("timeBarFill"),

    // Header — menu
    menuBtn: mustGet("menuBtn"),
    menuPanel: mustGet("menuPanel"),
    saveBtn: mustGet("saveBtn"),
    muteBtn: mustGet("muteBtn"),
    notifyBtn: mustGet("notifyBtn"),
    mainMenuBtn: mustGet("mainMenuBtn"),
    langSelect: mustGet("langSelect"),

    // Main tab navigation
    tabButtons: document.querySelectorAll<HTMLButtonElement>(".tab-nav .tab-btn"),
    tabClick: mustGet("tab-click"),
    tabFactory: mustGet("tab-factory"),
    tabShop: mustGet("tab-shop"),
    tabStorage: mustGet("tab-storage"),
    tabOrders: mustGet("tab-orders"),
    tabMetrics: mustGet("tab-metrics"),
    factoryBadge: mustGet("factoryBadge"),
    ordersBadge: mustGet("ordersBadge"),

    // Toasts + celebration effects
    toastLayer: mustGet("toastLayer"),
    fxLayer: mustGet("fxLayer"),

    // Click page
    clickArea: document.querySelector<HTMLElement>(".click-area")!,
    makeGiftBtn: mustGet("makeGiftBtn"),
    floatLayer: mustGet("floatLayer"),
    clickCombo: mustGet("clickCombo"),
    clickGpc: mustGet("clickGpc"),
    clickStock: mustGet("clickStock"),
    clickToyName: mustGet("clickToyName"),
    clickToyValue: mustGet("clickToyValue"),
    clickToySelector: mustGet("clickToySelector"),

    // Factory page
    totalElves: mustGet("totalElves"),
    assignedElves: mustGet("assignedElves"),
    unassignedElves: mustGet("unassignedElves"),
    unassignedTypes: mustGet("unassignedTypes"),
    factoryRail: mustGet("factoryRail"),
    factoryDetail: mustGet("factoryDetail"),

    // Shop page ("Upgrades" tab)
    shopCats: document.querySelectorAll<HTMLButtonElement>(".shop-cat"),
    shopViews: document.querySelectorAll<HTMLElement>(".shop-view"),
    shopContentTitle: mustGet("shopContentTitle"),
    shopSearch: mustGet("shopSearch") as HTMLInputElement,
    shopEmpty: mustGet("shopEmpty"),
    toysList: mustGet("toysList"),
    elvesList: mustGet("elvesList"),
    upgradesList: mustGet("upgradesList"),

    // Storage page
    storageList: mustGet("storageList"),
    storageEmpty: mustGet("storageEmpty"),
    storageSearch: mustGet("storageSearch") as HTMLInputElement,
    storageTotalStock: mustGet("storageTotalStock"),
    storageTotalValue: mustGet("storageTotalValue"),
    storageTotalBroken: mustGet("storageTotalBroken"),
    sellAllBtn: mustGet("sellAllBtn"),
    sellFloatLayer: mustGet("sellFloatLayer"),

    // Orders page
    ordersChristmas: mustGet("ordersChristmas"),
    ordersGrand: mustGet("ordersGrand"),
    ordersEvent: mustGet("ordersEvent"),
    ordersActiveList: mustGet("ordersActiveList"),
    ordersOfferList: mustGet("ordersOfferList"),
    ordersActiveCount: mustGet("ordersActiveCount"),
    ordersMax: mustGet("ordersMax"),

    // Metrics page
    mGpc: mustGet("mGpc"),
    mGps: mustGet("mGps"),
    mSellRates: mustGet("mSellRates"),
    mGifts: mustGet("mGifts"),
    mMoney: mustGet("mMoney"),
    mNetWorth: mustGet("mNetWorth"),
    mBrokenHeld: mustGet("mBrokenHeld"),
    mLifetimeGifts: mustGet("mLifetimeGifts"),
    mLifetimeSold: mustGet("mLifetimeSold"),
    mLifetimeRuined: mustGet("mLifetimeRuined"),
    mOrdersFilled: mustGet("mOrdersFilled"),
    mDayMade: mustGet("mDayMade"),
    mDaySold: mustGet("mDaySold"),
    mDayEarned: mustGet("mDayEarned"),
    mDayRuined: mustGet("mDayRuined"),
    mWagesDue: mustGet("mWagesDue"),
    mWageResult: mustGet("mWageResult"),
    wageRuleText: mustGet("wageRuleText"),

    // Footer
    statusText: mustGet("statusText"),
  };
}
