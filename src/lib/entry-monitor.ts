import { db } from '@/lib/db'
import { stockDataService } from './stock-data'
import { vcpDetector, VCPResult } from './vcp-detector'
import { emailService, AlertData } from './email-service'

export interface EntrySignal {
  symbol: string
  name: string
  signalType: 'breakout' | 'pivot' | 'support' | 'volume_spike' | 'moving_average'
  confidence: number
  currentPrice: number
  targetPrice: number
  stopLoss: number
  riskRewardRatio: number
  timeframe: string
  reason: string
  timestamp: Date
}

export interface MonitoringConfig {
  checkInterval: number // minutes
  timeframes: string[] // e.g., ['1h', '4h']
  minConfidence: number // minimum confidence score
  maxRiskPerTrade: number // percentage
  enableEmailAlerts: boolean
}

export class EntryMonitor {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()
  private config: MonitoringConfig

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      checkInterval: 15, // 15 minutes
      timeframes: ['1h', '4h'],
      minConfidence: 70,
      maxRiskPerTrade: 2,
      enableEmailAlerts: true,
      ...config
    }
  }

  /**
   * Start monitoring a stock for entry signals
   */
  async startMonitoring(stockScanId: string): Promise<void> {
    try {
      const stockScan = await db.stockScan.findUnique({
        where: { id: stockScanId },
        include: {
          scan: {
            include: {
              scanConfig: true
            }
          }
        }
      })

      if (!stockScan || !stockScan.hasVcpPattern) {
        throw new Error('Stock scan not found or no VCP pattern detected')
      }

      // Stop existing monitoring for this stock
      this.stopMonitoring(stockScanId)

      console.log(`Starting entry monitoring for ${stockScan.symbol}`)

      // Create monitoring interval
      const interval = setInterval(async () => {
        await this.checkForEntrySignals(stockScanId)
      }, this.config.checkInterval * 60 * 1000)

      this.monitoringIntervals.set(stockScanId, interval)

      // Check immediately
      await this.checkForEntrySignals(stockScanId)
    } catch (error) {
      console.error('Error starting monitoring:', error)
    }
  }

  /**
   * Stop monitoring a stock
   */
  stopMonitoring(stockScanId: string): void {
    const interval = this.monitoringIntervals.get(stockScanId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(stockScanId)
      console.log(`Stopped monitoring for stock scan ${stockScanId}`)
    }
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const [stockScanId, interval] of this.monitoringIntervals) {
      clearInterval(interval)
      console.log(`Stopped monitoring for stock scan ${stockScanId}`)
    }
    this.monitoringIntervals.clear()
  }

  /**
   * Check for entry signals for a specific stock
   */
  private async checkForEntrySignals(stockScanId: string): Promise<void> {
    try {
      const stockScan = await db.stockScan.findUnique({
        where: { id: stockScanId },
        include: {
          scan: {
            include: {
              scanConfig: true
            }
          }
        }
      })

      if (!stockScan) {
        this.stopMonitoring(stockScanId)
        return
      }

      // Check each configured timeframe
      for (const timeframe of this.config.timeframes) {
        const signal = await this.analyzeTimeframe(stockScan, timeframe)
        
        if (signal && signal.confidence >= this.config.minConfidence) {
          await this.handleEntrySignal(stockScan, signal)
          
          // Stop monitoring after finding a signal (can be configured)
          this.stopMonitoring(stockScanId)
          break
        }
      }
    } catch (error) {
      console.error(`Error checking entry signals for ${stockScanId}:`, error)
    }
  }

  /**
   * Analyze a specific timeframe for entry signals
   */
  private async analyzeTimeframe(stockScan: any, timeframe: string): Promise<EntrySignal | null> {
    try {
      // Get historical data for the timeframe
      const days = timeframe === '1h' ? 7 : timeframe === '4h' ? 14 : 30
      const stockData = await stockDataService.getStockData(stockScan.symbol)
      
      if (!stockData || !stockData.historicalData.length) {
        return null
      }

      // Filter data for the timeframe (simplified - in real app, use proper timeframe data)
      const recentData = stockData.historicalData.slice(-50)

      // Analyze for different types of entry signals
      const signals: EntrySignal[] = []

      // 1. Breakout signal
      const breakoutSignal = this.checkBreakoutSignal(stockScan, recentData, timeframe)
      if (breakoutSignal) signals.push(breakoutSignal)

      // 2. Pivot point signal
      const pivotSignal = this.checkPivotSignal(stockScan, recentData, timeframe)
      if (pivotSignal) signals.push(pivotSignal)

      // 3. Support bounce signal
      const supportSignal = this.checkSupportSignal(stockScan, recentData, timeframe)
      if (supportSignal) signals.push(supportSignal)

      // 4. Volume spike signal
      const volumeSignal = this.checkVolumeSignal(stockScan, recentData, timeframe)
      if (volumeSignal) signals.push(volumeSignal)

      // 5. Moving average signal
      const maSignal = this.checkMovingAverageSignal(stockScan, recentData, timeframe)
      if (maSignal) signals.push(maSignal)

      // Return the signal with highest confidence
      if (signals.length === 0) return null
      
      return signals.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
    } catch (error) {
      console.error(`Error analyzing ${timeframe} for ${stockScan.symbol}:`, error)
      return null
    }
  }

  /**
   * Check for breakout signal
   */
  private checkBreakoutSignal(stockScan: any, data: any[], timeframe: string): EntrySignal | null {
    if (data.length < 20) return null

    const recent = data.slice(-10)
    const currentPrice = recent[recent.length - 1].close
    
    // Find resistance level
    const resistance = Math.max(...recent.slice(0, -1).map(d => d.high))
    const breakoutThreshold = resistance * 1.01 // 1% above resistance

    if (currentPrice >= breakoutThreshold) {
      const volume = recent[recent.length - 1].volume
      const avgVolume = recent.slice(0, -1).reduce((sum, d) => sum + d.volume, 0) / (recent.length - 1)
      const volumeRatio = volume / avgVolume

      // Higher confidence if volume is above average
      const confidence = Math.min(95, 70 + (volumeRatio > 1.5 ? 15 : volumeRatio > 1.2 ? 10 : 5))

      return {
        symbol: stockScan.symbol,
        name: stockScan.name,
        signalType: 'breakout',
        confidence,
        currentPrice,
        targetPrice: currentPrice * 1.08, // 8% target
        stopLoss: resistance * 0.98, // 2% below resistance
        riskRewardRatio: (currentPrice * 1.08 - currentPrice) / (currentPrice - resistance * 0.98),
        timeframe,
        reason: `Breakout above resistance at $${resistance.toFixed(2)} with ${volumeRatio.toFixed(1)}x volume`,
        timestamp: new Date()
      }
    }

    return null
  }

  /**
   * Check for pivot point signal
   */
  private checkPivotSignal(stockScan: any, data: any[], timeframe: string): EntrySignal | null {
    if (data.length < 15) return null

    const recent = data.slice(-8)
    const currentPrice = recent[recent.length - 1].close
    
    // Calculate pivot points (simplified)
    const high = Math.max(...recent.map(d => d.high))
    const low = Math.min(...recent.map(d => d.low))
    const close = recent[recent.length - 1].close
    
    const pivot = (high + low + close) / 3
    const support1 = (2 * pivot) - high
    const resistance1 = (2 * pivot) - low

    // Signal if price is near pivot and showing strength
    const distanceToPivot = Math.abs(currentPrice - pivot) / pivot
    
    if (distanceToPivot < 0.01 && currentPrice > pivot) { // Within 1% of pivot
      const confidence = Math.min(85, 65 + (1 - distanceToPivot * 100) * 20)

      return {
        symbol: stockScan.symbol,
        name: stockScan.name,
        signalType: 'pivot',
        confidence,
        currentPrice,
        targetPrice: resistance1,
        stopLoss: support1,
        riskRewardRatio: (resistance1 - currentPrice) / (currentPrice - support1),
        timeframe,
        reason: `Price at pivot point $${pivot.toFixed(2)}, showing upward momentum`,
        timestamp: new Date()
      }
    }

    return null
  }

  /**
   * Check for support bounce signal
   */
  private checkSupportSignal(stockScan: any, data: any[], timeframe: string): EntrySignal | null {
    if (data.length < 20) return null

    const recent = data.slice(-15)
    const currentPrice = recent[recent.length - 1].close
    
    // Find support level
    const support = Math.min(...recent.slice(0, -5).map(d => d.low))
    const bounceThreshold = support * 1.02 // 2% above support

    if (currentPrice <= bounceThreshold && currentPrice >= support) {
      // Check if price is bouncing up
      const prevPrice = recent[recent.length - 2]?.close || currentPrice
      const isBouncing = currentPrice > prevPrice

      if (isBouncing) {
        const confidence = Math.min(80, 60 + ((currentPrice - support) / support) * 1000)

        return {
          symbol: stockScan.symbol,
          name: stockScan.name,
          signalType: 'support',
          confidence,
          currentPrice,
          targetPrice: support * 1.06, // 6% target
          stopLoss: support * 0.97, // 3% below support
          riskRewardRatio: (support * 1.06 - currentPrice) / (currentPrice - support * 0.97),
          timeframe,
          reason: `Bouncing off support level at $${support.toFixed(2)}`,
          timestamp: new Date()
        }
      }
    }

    return null
  }

  /**
   * Check for volume spike signal
   */
  private checkVolumeSignal(stockScan: any, data: any[], timeframe: string): EntrySignal | null {
    if (data.length < 10) return null

    const recent = data.slice(-10)
    const currentPrice = recent[recent.length - 1].close
    const currentVolume = recent[recent.length - 1].volume
    
    // Calculate average volume
    const avgVolume = recent.slice(0, -1).reduce((sum, d) => sum + d.volume, 0) / (recent.length - 1)
    const volumeRatio = currentVolume / avgVolume

    // Volume spike threshold
    if (volumeRatio > 2.0) { // 2x average volume
      // Check if price movement aligns with volume
      const priceChange = (currentPrice - recent[recent.length - 2].close) / recent[recent.length - 2].close
      
      if (Math.abs(priceChange) > 0.01) { // 1% price movement
        const confidence = Math.min(90, 70 + Math.min(20, (volumeRatio - 2) * 10))

        const isBullish = priceChange > 0
        
        return {
          symbol: stockScan.symbol,
          name: stockScan.name,
          signalType: 'volume_spike',
          confidence,
          currentPrice,
          targetPrice: isBullish ? currentPrice * 1.05 : currentPrice * 0.95,
          stopLoss: isBullish ? currentPrice * 0.97 : currentPrice * 1.03,
          riskRewardRatio: isBullish ? 
            (currentPrice * 1.05 - currentPrice) / (currentPrice - currentPrice * 0.97) :
            (currentPrice - currentPrice * 0.95) / (currentPrice * 1.03 - currentPrice),
          timeframe,
          reason: `Volume spike of ${volumeRatio.toFixed(1)}x average with ${isBullish ? 'bullish' : 'bearish'} price movement`,
          timestamp: new Date()
        }
      }
    }

    return null
  }

  /**
   * Check for moving average signal
   */
  private checkMovingAverageSignal(stockScan: any, data: any[], timeframe: string): EntrySignal | null {
    if (data.length < 50) return null

    const recent = data.slice(-20)
    const currentPrice = recent[recent.length - 1].close
    
    // Calculate moving averages
    const ma20 = this.calculateMA(recent, 20)
    const ma50 = this.calculateMA(data.slice(-50), 50)
    
    if (!ma20 || !ma50) return null

    // Check for golden cross or price above MAs
    const priceAboveMA20 = currentPrice > ma20
    const priceAboveMA50 = currentPrice > ma50
    const ma20AboveMA50 = ma20 > ma50

    if (priceAboveMA20 && priceAboveMA50 && ma20AboveMA50) {
      const confidence = Math.min(85, 65 + (ma20AboveMA50 ? 10 : 0) + (priceAboveMA20 ? 5 : 0))

      return {
        symbol: stockScan.symbol,
        name: stockScan.name,
        signalType: 'moving_average',
        confidence,
        currentPrice,
        targetPrice: currentPrice * 1.06,
        stopLoss: Math.min(ma20, ma50) * 0.98,
        riskRewardRatio: (currentPrice * 1.06 - currentPrice) / (currentPrice - Math.min(ma20, ma50) * 0.98),
        timeframe,
        reason: `Price above both 20-period MA ($${ma20.toFixed(2)}) and 50-period MA ($${ma50.toFixed(2)})`,
        timestamp: new Date()
      }
    }

    return null
  }

  /**
   * Calculate moving average
   */
  private calculateMA(data: any[], period: number): number | null {
    if (data.length < period) return null
    
    const sum = data.slice(-period).reduce((acc, d) => acc + d.close, 0)
    return sum / period
  }

  /**
   * Handle detected entry signal
   */
  private async handleEntrySignal(stockScan: any, signal: EntrySignal): Promise<void> {
    try {
      console.log(`Entry signal detected for ${stockScan.symbol}: ${signal.signalType} with ${signal.confidence}% confidence`)

      // Update stock scan with entry signal
      await db.stockScan.update({
        where: { id: stockScan.id },
        data: {
          entrySignal: true,
          lastPrice: signal.currentPrice,
          volume: signal.currentPrice * 1000000 // Approximate volume
        }
      })

      // Send email alert if enabled
      if (this.config.enableEmailAlerts) {
        const alertData: AlertData = {
          type: 'entry_signal',
          symbol: signal.symbol,
          stockName: signal.name,
          vcpScore: stockScan.vcpScore,
          currentPrice: signal.currentPrice,
          scanName: stockScan.scan.scanConfig.name,
          etfSymbol: stockScan.scan.etfSymbol,
          entryPoints: [{
            type: signal.signalType,
            price: signal.targetPrice,
            confidence: signal.confidence
          }]
        }

        // Get user ID from scan config
        const userId = stockScan.scan.scanConfig.userId
        await emailService.sendEntrySignalAlert(userId, alertData)
      }

      // Log the signal
      console.log(`Entry signal processed for ${stockScan.symbol}:`, signal)
    } catch (error) {
      console.error('Error handling entry signal:', error)
    }
  }

  /**
   * Get active monitoring status
   */
  getMonitoringStatus(): Array<{
    stockScanId: string
    symbol: string
    startTime: Date
    interval: number
  }> {
    return Array.from(this.monitoringIntervals.keys()).map(stockScanId => ({
      stockScanId,
      symbol: 'Unknown', // Would need to fetch from DB
      startTime: new Date(), // Would need to store start time
      interval: this.config.checkInterval
    }))
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Restart monitoring with new configuration
    const activeMonitors = Array.from(this.monitoringIntervals.keys())
    for (const stockScanId of activeMonitors) {
      this.stopMonitoring(stockScanId)
      this.startMonitoring(stockScanId)
    }
  }
}

// Create default instance
export const entryMonitor = new EntryMonitor()