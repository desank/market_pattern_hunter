import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanId } = await params

    const stockScans = await db.stockScan.findMany({
      where: { scanId },
      orderBy: [
        { hasVcpPattern: 'desc' },
        { vcpScore: 'desc' }
      ]
    })

    return NextResponse.json(stockScans)
  } catch (error) {
    console.error('Error fetching stock scans:', error)
    return NextResponse.json({ error: 'Failed to fetch stock scans' }, { status: 500 })
  }
}