import { NextResponse } from 'next/server'
import { entryMonitor } from '@/lib/entry-monitor'

export async function GET() {
  try {
    const status = entryMonitor.getMonitoringStatus()

    return NextResponse.json({ status })
  } catch (error) {
    console.error('Error getting monitoring status:', error)
    return NextResponse.json({ error: 'Failed to get monitoring status' }, { status: 500 })
  }
}