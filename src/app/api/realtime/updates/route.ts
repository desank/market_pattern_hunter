import { NextRequest, NextResponse } from 'next/server'
import { realtimeService } from '@/lib/realtime-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since')
    
    const sinceDate = since ? new Date(since) : undefined
    
    const updates = await realtimeService.getRecentUpdates(sinceDate)
    
    return NextResponse.json(updates)
  } catch (error) {
    console.error('Error fetching realtime updates:', error)
    return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 })
  }
}