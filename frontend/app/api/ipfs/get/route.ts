import { NextRequest, NextResponse } from 'next/server'
import { getFromIPFS } from '@/lib/ipfs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const hash = searchParams.get('hash')

    if (!hash) {
      return NextResponse.json(
        { error: 'Hash is required' },
        { status: 400 }
      )
    }

    const data = await getFromIPFS(hash)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('IPFS fetch API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from IPFS' },
      { status: 500 }
    )
  }
}
