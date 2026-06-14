import {
  VendorItemStatus,
  type DestinyItemQuantity,
} from 'bungie-api-ts/destiny2';

export interface VendorSaleQuery {
  name?: string;
  itemHash?: number;
  costName?: string;
  costItemHash?: number;
  vendorHash?: number;
  purchasable?: boolean;
  affordable?: boolean;
  limit?: number;
  all?: boolean;
}

export interface NamedVendorSale {
  itemHash: number;
  itemName?: string;
  itemDescription?: string;
  vendorHash: number;
  vendorName?: string;
  costs: {
    itemHash: number;
    name?: string;
    quantity: number;
  }[];
  statusPurchasable: boolean;
  affordable: boolean;
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function includesText(value: string | undefined, query: string | undefined) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  return normalizeText(value).includes(normalizedQuery);
}

export function saleStatusFlags(saleStatus: VendorItemStatus) {
  return {
    success: saleStatus === VendorItemStatus.Success,
    noInventorySpace: (saleStatus & VendorItemStatus.NoInventorySpace) !== 0,
    noFunds: (saleStatus & VendorItemStatus.NoFunds) !== 0,
    noProgression: (saleStatus & VendorItemStatus.NoProgression) !== 0,
    noUnlock: (saleStatus & VendorItemStatus.NoUnlock) !== 0,
    noQuantity: (saleStatus & VendorItemStatus.NoQuantity) !== 0,
    outsidePurchaseWindow: (saleStatus & VendorItemStatus.OutsidePurchaseWindow) !== 0,
    notAvailable: (saleStatus & VendorItemStatus.NotAvailable) !== 0,
    uniquenessViolation: (saleStatus & VendorItemStatus.UniquenessViolation) !== 0,
    unknownError: (saleStatus & VendorItemStatus.UnknownError) !== 0,
    alreadySelling: (saleStatus & VendorItemStatus.AlreadySelling) !== 0,
    unsellable: (saleStatus & VendorItemStatus.Unsellable) !== 0,
    sellingInhibited: (saleStatus & VendorItemStatus.SellingInhibited) !== 0,
    alreadyOwned: (saleStatus & VendorItemStatus.AlreadyOwned) !== 0,
    displayOnly: (saleStatus & VendorItemStatus.DisplayOnly) !== 0,
  };
}

export function summarizeCostAffordability(
  cost: DestinyItemQuantity,
  availableQuantity: number | undefined,
) {
  return {
    itemHash: cost.itemHash,
    quantity: cost.quantity,
    availableQuantity,
    affordable: availableQuantity !== undefined ? availableQuantity >= cost.quantity : false,
    hasConditionalVisibility: cost.hasConditionalVisibility,
  };
}

export function saleMatchesQuery(sale: NamedVendorSale, query: VendorSaleQuery) {
  if (query.vendorHash !== undefined && sale.vendorHash !== query.vendorHash) {
    return false;
  }
  if (query.itemHash !== undefined && sale.itemHash !== query.itemHash) {
    return false;
  }
  if (query.costItemHash !== undefined && !sale.costs.some((cost) => cost.itemHash === query.costItemHash)) {
    return false;
  }
  if (!includesText(`${sale.itemName ?? ''}\n${sale.itemDescription ?? ''}`, query.name)) {
    return false;
  }
  if (query.costName && !sale.costs.some((cost) => includesText(cost.name, query.costName))) {
    return false;
  }
  if (query.purchasable && !sale.statusPurchasable) {
    return false;
  }
  if (query.affordable && !sale.affordable) {
    return false;
  }
  return true;
}

export function selectVendorSales<T extends NamedVendorSale>(
  sales: T[],
  query: VendorSaleQuery,
  defaultLimit: number,
) {
  const matched = sales.filter((sale) => saleMatchesQuery(sale, query));
  const limit = query.all ? undefined : (query.limit ?? defaultLimit);
  const selected = limit === undefined ? matched : matched.slice(0, limit);

  return {
    totalMatched: matched.length,
    count: selected.length,
    truncated: limit !== undefined && matched.length > selected.length,
    limit,
    sales: selected,
  };
}
