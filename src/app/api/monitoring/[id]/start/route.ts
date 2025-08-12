import { NextRequest, NextResponse } from 'next/server'
import { entryMonitor } from '@/lib/entry-monitor'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stockScanId = params.id

    await entryMonitor.startMonitoring(stockScanId)

    return NextResponse.json({ success: true, message: 'Monitoring started' })
  } catch (error) {
    console.error('Error starting monitoring:', error)
    return NextResponse.json({ error: 'Failed to start monitoring' }, { status: 500 })
  }
}