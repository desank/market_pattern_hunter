import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { etfScanner } from '@/lib/etf-scanner'
import { stockDataService } from '@/lib/stock-data'
import { vcpDetector } from '@/lib/vcp-detector'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: configId } = await params

    // Get the scan configuration
    const config = await db.scanConfig.findUnique({
      where: { id: configId }
    })

    if (!config) {
      return NextResponse.json({ error: 'Scan configuration not found' }, { status: 404 })
    }

    // Create a new scan record
    const scan = await db.scan.create({
      data: {
        scanConfigId: configId,
        etfSymbol: config.etfSymbol,
        etfPerformance: 0, // Will be calculated
        status: 'running'
      }
    })

    // Start the scan process in the background
    performScan(scan.id, config).catch(console.error)

    return NextResponse.json(scan)
  } catch (error) {
    console.error('Error starting scan:', error)
    return NextResponse.json({ error: 'Failed to start scan' }, { status: 500 })
  }
}

async function performScan(scanId: string, config: any) {
  try {
    console.log(`Starting scan for ${config.etfSymbol}`)
    
    // Step 1: Get ETF performance
    const etfPerformance = await stockDataService.getETFPerformance(config.etfSymbol, config.lookbackPeriod)
    
    // Step 2: Get ETF holdings
    const etfData = await stockDataService.getETFData(config.etfSymbol)
    
    if (!etfData || !etfData.holdings.length) {
      throw new Error(`No holdings found for ETF ${config.etfSymbol}`)
    }

    console.log(`Found ${etfData.holdings.length} holdings in ${config.etfSymbol}`)

    let stocksScanned = 0
    let vcpFound = 0

    // Step 3: Scan each stock for VCP patterns
    for (const holding of etfData.holdings) {
      try {
        console.log(`Scanning ${holding.symbol}...`)
        
        // Get stock data
        const stockData = await stockDataService.getStockData(holding.symbol)
        
        if (!stockData || !stockData.historicalData.length) {
          console.log(`No data available for ${holding.symbol}`)
          continue
        }

        // Analyze for VCP pattern
        const vcpResult = vcpDetector.analyzeVCP(stockData.historicalData)
        
        stocksScanned++

        // Save stock scan result
        await db.stockScan.create({
          data: {
            scanId,
            symbol: holding.symbol,
            name: holding.name,
            hasVcpPattern: vcpResult.hasPattern,
            vcpScore: vcpResult.score,
            entrySignal: vcpResult.hasPattern && vcpResult.score > 75, // High confidence patterns
            lastPrice: stockData.price,
            volume: stockData.volume
          }
        })

        if (vcpResult.hasPattern) {
          vcpFound++
          console.log(`VCP pattern found in ${holding.symbol} with score ${vcpResult.score}`)
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error scanning ${holding.symbol}:`, error)
        continue
      }
    }

    // Update scan with final results
    await db.scan.update({
      where: { id: scanId },
      data: {
        etfPerformance,
        stocksScanned,
        vcpFound,
        status: 'completed'
      }
    })

    console.log(`Scan completed for ${config.etfSymbol}: ${stocksScanned} stocks scanned, ${vcpFound} VCP patterns found`)
    
  } catch (error) {
    console.error('Error during scan:', error)
    
    // Update scan status to failed with error message
    await db.scan.update({
      where: { id: scanId },
      data: { 
        status: 'failed'
      }
    })
    
    // Log the specific error for debugging
    console.error(`Scan failed for ${config.etfSymbol}:`, error instanceof Error ? error.message : 'Unknown error')
  }
}