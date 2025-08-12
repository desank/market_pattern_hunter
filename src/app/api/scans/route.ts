import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const scans = await db.scan.findMany({
      include: {
        scanConfig: true,
        stockScans: {
          where: {
            hasVcpPattern: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(scans)
  } catch (error) {
    console.error('Error fetching scans:', error)
    return NextResponse.json({ error: 'Failed to fetch scans' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    // Delete all stock scans first
    await db.stockScan.deleteMany({})
    
    // Delete all scans
    await db.scan.deleteMany({})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting all scans:', error)
    return NextResponse.json({ error: 'Failed to delete all scans' }, { status: 500 })
  }
}