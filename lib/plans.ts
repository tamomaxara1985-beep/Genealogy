export type Plan = 'free' | 'standard' | 'premium'
export type PlanStatus = 'active' | 'cancelled' | 'on_hold' | 'expired'

// TODO: add premium product ID when available: 'pdt_PREMIUM_ID_HERE': 'premium'
export const PLAN_PRODUCT_MAP: Record<string, Plan> = {
  pdt_0Ngp959eAaBGtnmvgciKO: 'standard',
}

export const PLAN_LIMITS = {
  free:     { maxTrees: 1,        maxPersonsPerTree: 30,       aiChat: false },
  standard: { maxTrees: 1,        maxPersonsPerTree: Infinity, aiChat: true  },
  premium:  { maxTrees: Infinity, maxPersonsPerTree: Infinity, aiChat: true  },
} as const

export function getPlanFromProductId(productId: string): Plan {
  return PLAN_PRODUCT_MAP[productId] ?? 'free'
}
