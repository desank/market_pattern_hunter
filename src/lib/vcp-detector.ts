import { HistoricalDataPoint } from './stock-data'

export interface VCPResult {
  hasPattern: boolean
  score: number // 0-100 confidence score
  baseCount: number
  volatilityContraction: number
  priceTightness: number
  volumeDryUp: boolean
  breakoutPotential: number
  entryPoints: EntryPoint[]
  description: string
}

export interface EntryPoint {
  type: 'breakout' | 'pivot' | 'support'
  price: number
  confidence: number
  description: string
}

export class VCPDetector {
  /**
   * Analyze stock data for VCP pattern
   */
  analyzeVCP(data: HistoricalDataPoint[]): VCPResult {
    if (data.length < 50) {
      return {
        hasPattern: false,
        score: 0,
        baseCount: 0,
        volatilityContraction: 0,
        priceTightness: 0,
        volumeDryUp: false,
        breakoutPotential: 0,
        entryPoints: [],
        description: 'Insufficient data for analysis'
      }
    }

    // Sort data by date (oldest first)
    const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime())
    
    // Get the most recent data for analysis
    const recentData = sortedData.slice(-100) // Last 100 trading days
    
    // Calculate various VCP indicators
    const uptrend = this.checkUptrend(recentData)
    const bases = this.findBases(recentData)
    const volatility = this.calculateVolatilityContraction(recentData)
    const tightness = this.calculatePriceTightness(recentData)
    const volumeAnalysis = this.analyzeVolume(recentData)
    const breakout = this.assessBreakoutPotential(recentData)
    const entryPoints = this.findEntryPoints(recentData)

    // Calculate overall score
    const score = this.calculateVCPScore({
      uptrend,
      bases,
      volatility,
      tightness,
      volumeAnalysis,
      breakout
    })

    const hasPattern = score > 60 // Minimum threshold for VCP pattern

    return {
      hasPattern,
      score,
      baseCount: bases.length,
      volatilityContraction: volatility.contraction,
      priceTightness: tightness.score,
      volumeDryUp: volumeAnalysis.dryUp,
      breakoutPotential: breakout.score,
      entryPoints,
      description: this.generateDescription({
        hasPattern,
        score,
        bases,
        volatility,
        tightness,
        volumeAnalysis,
        breakout
      })
    }
  }

  /**
   * Check if stock is in uptrend (prior uptrend required for VCP)
   */
  private checkUptrend(data: HistoricalDataPoint[]): boolean {
    if (data.length < 50) return false

    const recent = data.slice(-20)
    const older = data.slice(-50, -30)
    
    const recentAvg = recent.reduce((sum, d) => sum + d.close, 0) / recent.length
    const olderAvg = older.reduce((sum, d) => sum + d.close, 0) / older.length
    
    return recentAvg > olderAvg * 1.05 // 5% minimum uptrend
  }

  /**
   * Find base formations in the price data
   */
  private findBases(data: HistoricalDataPoint[]): Array<{
    start: number
    end: number
    depth: number
    duration: number
  }> {
    const bases: Array<{
      start: number
      end: number
      depth: number
      duration: number
    }> = []

    // Simple base detection: look for areas where price consolidates
    for (let i = 10; i < data.length - 10; i++) {
      const window = data.slice(i - 10, i + 10)
      const high = Math.max(...window.map(d => d.high))
      const low = Math.min(...window.map(d => d.low))
      const range = high - low
      const avgPrice = window.reduce((sum, d) => sum + d.close, 0) / window.length
      
      // If price range is tight relative to price level, it might be a base
      if (range / avgPrice < 0.08) { // 8% or less range
        bases.push({
          start: i - 10,
          end: i + 10,
          depth: range / avgPrice,
          duration: 20
        })
      }
    }

    return bases
  }

  /**
   * Calculate volatility contraction
   */
  private calculateVolatilityContraction(data: HistoricalDataPoint[]): {
    contraction: number
    trend: 'decreasing' | 'increasing' | 'stable'
  } {
    const periods = [20, 10, 5] // Different lookback periods
    
    const volatilities = periods.map(period => {
      const recent = data.slice(-period)
      if (recent.length < 2) return 0
      
      const returns = []
      for (let i = 1; i < recent.length; i++) {
        returns.push((recent[i].close - recent[i-1].close) / recent[i-1].close)
      }
      
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
      
      return Math.sqrt(variance) * Math.sqrt(252) // Annualized volatility
    })

    const [longVol, mediumVol, shortVol] = volatilities
    
    // Calculate contraction as ratio of short-term to long-term volatility
    const contraction = longVol > 0 ? (1 - shortVol / longVol) * 100 : 0
    
    let trend: 'decreasing' | 'increasing' | 'stable' = 'stable'
    if (shortVol < mediumVol * 0.8 && mediumVol < longVol * 0.8) {
      trend = 'decreasing'
    } else if (shortVol > mediumVol * 1.2 && mediumVol > longVol * 1.2) {
      trend = 'increasing'
    }

    return { contraction: Math.max(0, contraction), trend }
  }

  /**
   * Calculate price tightness
   */
  private calculatePriceTightness(data: HistoricalDataPoint[]): {
    score: number
    description: string
  } {
    const recent = data.slice(-10)
    if (recent.length < 5) {
      return { score: 0, description: 'Insufficient data' }
    }

    const high = Math.max(...recent.map(d => d.high))
    const low = Math.min(...recent.map(d => d.low))
    const avgPrice = recent.reduce((sum, d) => sum + d.close, 0) / recent.length
    const range = high - low
    
    const tightness = (1 - range / avgPrice) * 100
    
    let score = 0
    let description = ''
    
    if (tightness > 85) {
      score = 90
      description = 'Very tight price action'
    } else if (tightness > 70) {
      score = 75
      description = 'Tight price action'
    } else if (tightness > 50) {
      score = 50
      description = 'Moderate price action'
    } else {
      score = 25
      description = 'Loose price action'
    }

    return { score, description }
  }

  /**
   * Analyze volume patterns
   */
  private analyzeVolume(data: HistoricalDataPoint[]): {
    dryUp: boolean
    trend: 'decreasing' | 'increasing' | 'stable'
    description: string
  } {
    const recent = data.slice(-20)
    const older = data.slice(-40, -20)
    
    if (recent.length === 0 || older.length === 0) {
      return { dryUp: false, trend: 'stable', description: 'Insufficient data' }
    }

    const recentAvgVol = recent.reduce((sum, d) => sum + d.volume, 0) / recent.length
    const olderAvgVol = older.reduce((sum, d) => sum + d.volume, 0) / older.length
    
    const volumeRatio = recentAvgVol / olderAvgVol
    
    let trend: 'decreasing' | 'increasing' | 'stable' = 'stable'
    if (volumeRatio < 0.7) {
      trend = 'decreasing'
    } else if (volumeRatio > 1.3) {
      trend = 'increasing'
    }

    return {
      dryUp: volumeRatio < 0.7,
      trend,
      description: `Volume ${trend === 'decreasing' ? 'drying up' : trend === 'increasing' ? 'increasing' : 'stable'}`
    }
  }

  /**
   * Assess breakout potential
   */
  private assessBreakoutPotential(data: HistoricalDataPoint[]): {
    score: number
    description: string
  } {
    const recent = data.slice(-10)
    if (recent.length < 5) {
      return { score: 0, description: 'Insufficient data' }
    }

    const currentPrice = recent[recent.length - 1].close
    const resistance = Math.max(...recent.slice(0, -1).map(d => d.high))
    const support = Math.min(...recent.slice(0, -1).map(d => d.low))
    
    const distanceToResistance = (resistance - currentPrice) / currentPrice
    const range = resistance - support
    const position = (currentPrice - support) / range
    
    let score = 0
    let description = ''
    
    // Higher score if close to resistance and in upper part of range
    if (distanceToResistance < 0.02 && position > 0.7) {
      score = 85
      description = 'Near resistance, high breakout potential'
    } else if (distanceToResistance < 0.05 && position > 0.6) {
      score = 70
      description = 'Approaching resistance, good breakout potential'
    } else if (position > 0.5) {
      score = 50
      description = 'In upper range, moderate breakout potential'
    } else {
      score = 30
      description = 'In lower range, low breakout potential'
    }

    return { score, description }
  }

  /**
   * Find potential entry points
   */
  private findEntryPoints(data: HistoricalDataPoint[]): EntryPoint[] {
    const entryPoints: EntryPoint[] = []
    const recent = data.slice(-20)
    
    if (recent.length < 10) return entryPoints

    const currentPrice = recent[recent.length - 1].close
    const resistance = Math.max(...recent.slice(0, -1).map(d => d.high))
    const support = Math.min(...recent.slice(0, -1).map(d => d.low))
    
    // Breakout entry point
    if (resistance > currentPrice * 1.01) {
      entryPoints.push({
        type: 'breakout',
        price: resistance * 1.01, // 1% above resistance
        confidence: 75,
        description: 'Breakout above resistance'
      })
    }
    
    // Pivot point entry (current price level)
    entryPoints.push({
      type: 'pivot',
      price: currentPrice,
      confidence: 60,
      description: 'Pivot point at current level'
    })
    
    // Support entry point
    if (support < currentPrice * 0.98) {
      entryPoints.push({
        type: 'support',
        price: support * 0.99, // 1% above support
        confidence: 45,
        description: 'Support level bounce'
      })
    }

    return entryPoints.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate overall VCP score
   */
  private calculateVCPScore(indicators: {
    uptrend: boolean
    bases: any[]
    volatility: { contraction: number; trend: string }
    tightness: { score: number }
    volumeAnalysis: { dryUp: boolean }
    breakout: { score: number }
  }): number {
    let score = 0
    
    // Uptrend requirement (20 points)
    if (indicators.uptrend) score += 20
    
    // Base formations (25 points)
    const baseScore = Math.min(25, indicators.bases.length * 8)
    score += baseScore
    
    // Volatility contraction (20 points)
    score += Math.min(20, indicators.volatility.contraction * 0.4)
    
    // Price tightness (15 points)
    score += indicators.tightness.score * 0.15
    
    // Volume dry up (10 points)
    if (indicators.volumeAnalysis.dryUp) score += 10
    
    // Breakout potential (10 points)
    score += indicators.breakout.score * 0.1
    
    return Math.min(100, Math.round(score))
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(indicators: any): string {
    if (!indicators.hasPattern) {
      return 'No VCP pattern detected. Stock does not meet the criteria for Volatility Contraction Pattern.'
    }

    const parts = [
      `VCP pattern detected with ${indicators.score}% confidence.`,
      `Found ${indicators.bases.length} base formations.`,
      `Volatility contraction: ${indicators.volatility.contraction.toFixed(1)}%.`,
      `Price action: ${indicators.tightness.description}.`,
      `Volume: ${indicators.volumeAnalysis.description}.`,
      `Breakout potential: ${indicators.breakout.description}.`
    ]

    return parts.join(' ')
  }
}

export const vcpDetector = new VCPDetector()