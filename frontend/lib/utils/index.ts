import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function formatBalance(balance: bigint | string, decimals = 18): string {
  const value = typeof balance === 'string' ? BigInt(balance) : balance
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const fraction = value % divisor
  return `${whole}.${fraction.toString().padStart(decimals, '0').slice(0, 4)}`
}

export function calculateVP(vdotAmount: bigint): bigint {
  // VP = 100 * sqrt(vDOT)
  // Using integer square root
  const scaled = vdotAmount * BigInt(10000) // Scale for precision
  const sqrtScaled = sqrt(scaled)
  return sqrtScaled * BigInt(100) / BigInt(100) // VP with 18 decimals
}

// Integer square root using Newton's method
function sqrt(value: bigint): bigint {
  if (value < BigInt(0)) {
    throw new Error('Square root of negative numbers is not supported')
  }
  if (value < BigInt(2)) {
    return value
  }

  let x = value
  let y = (x + BigInt(1)) / BigInt(2)

  while (y < x) {
    x = y
    y = (x + value / x) / BigInt(2)
  }

  return x
}

export function formatTimeRemaining(endTime: number): string {
  const now = Date.now() / 1000
  const remaining = endTime - now

  if (remaining <= 0) return 'Ended'

  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  return `${hours}h ${minutes}m`
}
