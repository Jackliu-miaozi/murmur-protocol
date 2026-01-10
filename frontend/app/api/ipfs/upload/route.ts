import { NextRequest, NextResponse } from 'next/server'
import { uploadToIPFS } from '@/lib/ipfs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, name } = body

    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      )
    }

    const result = await uploadToIPFS(data, name)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('IPFS upload API error:', error)
    return NextResponse.json(
      { error: 'Failed to upload to IPFS' },
      { status: 500 }
    )
  }
}
