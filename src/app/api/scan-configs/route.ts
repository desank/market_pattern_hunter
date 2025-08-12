import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const configs = await db.scanConfig.findMany({
      include: {
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('Error fetching scan configs:', error)
    return NextResponse.json({ error: 'Failed to fetch scan configs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, etfSymbol, lookbackPeriod, timeframe } = body

    if (!name || !etfSymbol) {
      return NextResponse.json({ error: 'Name and ETF symbol are required' }, { status: 400 })
    }

    // Create or get a default user
    let user = await db.user.findUnique({
      where: { email: 'default-user@example.com' }
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email: 'default-user@example.com',
          name: 'Default User'
        }
      })
    }

    const config = await db.scanConfig.create({
      data: {
        name,
        etfSymbol,
        lookbackPeriod: lookbackPeriod || 30,
        timeframe: timeframe || '1d',
        userId: user.id
      }
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error creating scan config:', error)
    return NextResponse.json({ error: 'Failed to create scan config' }, { status: 500 })
  }
}