// VP Cost calculation utilities based on contract documentation

const C0 = 10 // Base cost (10 VP)
const BETA = 0.25 // Heat coefficient
const ALPHA = 2.0 // Intensity coefficient  
const P = 2 // Power for intensity
const GAMMA = 0.15 // Length coefficient

export function calculateMessageCost(
  length: number,
  aiScore: number, // 0-1
  heat: number = 0 // Default to 0 if heat not available
): bigint {
  // Base(H) = c0 × (1 + β × H)
  const base = C0 * (1 + BETA * heat)
  
  // Intensity(S) = 1 + α × S^p
  const intensity = 1 + ALPHA * Math.pow(aiScore, P)
  
  // Length(L) = 1 + γ × log(1 + L)
  const lengthFactor = 1 + GAMMA * Math.log(1 + length)
  
  // Cost = Base(H) × Intensity(S) × Length(L)
  const cost = base * intensity * lengthFactor
  
  // Convert to wei (18 decimals)
  return BigInt(Math.floor(cost * 1e18))
}

export function calculateHeat(
  messageRate: number,
  uniqueUsers: number,
  likeRate: number,
  vpBurnRate: number
): number {
  // Heat calculation: H = w1×log(1+msg_rate) + w2×log(1+unique_users) + w3×log(1+like_rate) + w4×log(1+vp_burn_rate)
  const w1 = 0.3
  const w2 = 0.3
  const w3 = 0.2
  const w4 = 0.2
  
  const heat = 
    w1 * Math.log(1 + messageRate) +
    w2 * Math.log(1 + uniqueUsers) +
    w3 * Math.log(1 + likeRate) +
    w4 * Math.log(1 + vpBurnRate)
  
  return heat
}

export function formatVP(vpAmount: bigint): string {
  const divisor = BigInt(1e18)
  const whole = vpAmount / divisor
  const fraction = vpAmount % divisor
  const fractionStr = fraction.toString().padStart(18, '0').slice(0, 2)
  return `${whole}.${fractionStr}`
}

export const LIKE_COST = BigInt(1e18) // 1 VP per like
