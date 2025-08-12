import { NextRequest, NextResponse } from 'next/server'
import { entryMonitor } from '@/lib/entry-monitor'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stockScanId = params.id

    entryMonitor.stopMonitoring(stockScanId)

    return NextResponse.json({ success: true, message: 'Monitoring stopped' })
  } catch (error) {
    console.error('Error stopping monitoring:', error)
    return NextResponse.json({ error: 'Failed to stop monitoring' }, { status: 500 })
  }
}