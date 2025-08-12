import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanId } = await params

    // Delete all stock scans associated with this scan
    await db.stockScan.deleteMany({
      where: { scanId }
    })

    // Delete the scan itself
    await db.scan.delete({
      where: { id: scanId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scan:', error)
    return NextResponse.json({ error: 'Failed to delete scan' }, { status: 500 })
  }
}