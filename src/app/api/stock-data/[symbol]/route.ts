import { NextRequest, NextResponse } from 'next/server'
import { stockDataService } from '@/lib/stock-data'
import { vcpDetector } from '@/lib/vcp-detector'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params

    const historicalData = await stockDataService.getStockData(symbol)

    if (!historicalData || !historicalData.historicalData.length) {
      return NextResponse.json({ error: 'No historical data found for this symbol' }, { status: 404 })
    }

    const vcpResult = vcpDetector.analyzeVCP(historicalData.historicalData)

    return NextResponse.json({
      historicalData: historicalData.historicalData,
      vcpResult,
    })
  } catch (error) {
    console.error(`Error fetching stock data for ${params.symbol}:`, error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
}
