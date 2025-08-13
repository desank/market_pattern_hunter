
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET a single scan configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const config = await db.scanConfig.findUnique({
      where: { id: params.id },
    })
    if (!config) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error fetching configuration:', error)
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 })
  }
}

// UPDATE a scan configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, etfSymbol, lookbackPeriod, timeframe, isActive } = body

    const updatedConfig = await db.scanConfig.update({
      where: { id: params.id },
      data: {
        name,
        etfSymbol,
        lookbackPeriod,
        timeframe,
        isActive,
      },
    })

    return NextResponse.json(updatedConfig)
  } catch (error) {
    console.error('Error updating configuration:', error)
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
  }
}

// DELETE a scan configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First, delete related scans to avoid foreign key constraint errors
    await db.scan.deleteMany({
      where: { scanConfigId: params.id },
    })
    
    // Then, delete the configuration itself
    await db.scanConfig.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Configuration deleted successfully' })
  } catch (error) {
    console.error('Error deleting configuration:', error)
    return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
  }
}
