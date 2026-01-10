import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import type { AIScoreRequest, AIScoreResponse } from '@/types'

const AI_SIGNER_PRIVATE_KEY = process.env.AI_SIGNER_PRIVATE_KEY!

// EIP-712 Domain
const domain = {
  name: 'MurmurProtocol',
  version: '1',
  chainId: 1, // Update based on your chain
}

// EIP-712 Types
const types = {
  AIScore: [
    { name: 'contentHash', type: 'bytes32' },
    { name: 'aiScore', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'messageLength', type: 'uint256' },
  ],
}

function calculateAIScore(content: string): number {
  // This is a placeholder AI scoring function
  // In production, this should call an actual AI model
  
  // Simple heuristic scoring based on:
  // - Length
  // - Punctuation usage (excitement)
  // - Capital letters usage
  // - Question marks
  
  const length = content.length
  const hasExclamation = (content.match(/!/g) || []).length
  const hasQuestion = (content.match(/\?/g) || []).length
  const hasCapitals = (content.match(/[A-Z]/g) || []).length
  const hasEmphasis = (content.match(/\*\*|__|CAPS/g) || []).length
  
  // Base score from length (0-0.3)
  let score = Math.min(length / 500, 0.3)
  
  // Add excitement score (0-0.3)
  score += Math.min((hasExclamation * 0.05 + hasQuestion * 0.03), 0.3)
  
  // Add emphasis score (0-0.2)
  score += Math.min((hasCapitals * 0.002 + hasEmphasis * 0.05), 0.2)
  
  // Add engagement score (0-0.2)
  if (length > 100 && (hasQuestion > 0 || hasExclamation > 0)) {
    score += 0.2
  }
  
  // Clamp to [0, 1]
  return Math.min(Math.max(score, 0), 1)
}

export async function POST(request: NextRequest) {
  try {
    const body: AIScoreRequest = await request.json()
    const { content, length } = body

    if (!content || length === undefined) {
      return NextResponse.json(
        { error: 'Content and length are required' },
        { status: 400 }
      )
    }

    // Calculate AI score (0-1)
    const scoreFloat = calculateAIScore(content)
    
    // Scale to uint256 (0 to 1e18)
    const score = Math.floor(scoreFloat * 1e18)
    
    // Generate contentHash (simplified - in production use proper hashing)
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(content))
    
    // Current timestamp
    const timestamp = Math.floor(Date.now() / 1000)

    // Create EIP-712 message
    const message = {
      contentHash,
      aiScore: score.toString(),
      timestamp,
      messageLength: length,
    }

    // Sign the message
    const wallet = new ethers.Wallet(AI_SIGNER_PRIVATE_KEY)
    const signature = await wallet.signTypedData(domain, types, message)

    const response: AIScoreResponse = {
      score,
      timestamp,
      signature,
    }

    return NextResponse.json({
      success: true,
      ...response,
      contentHash, // Also return contentHash for convenience
      scoreFloat, // Return float for UI display
    })
  } catch (error) {
    console.error('AI score API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI score' },
      { status: 500 }
    )
  }
}
