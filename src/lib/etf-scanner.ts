import { stockDataService, ETFData } from './stock-data'

export interface ETFPerformance {
  symbol: string
  name: string
  performance: number
  price: number
  volume: number
  marketCap: number
  holdingsCount: number
  riskScore: number
}

export interface ETFRecommendation {
  etf: ETFPerformance
  reason: string
  confidence: number
  alternativeOptions: ETFPerformance[]
}

export class ETFScanner {
  private popularEtfs = [
    'SPY', 'QQQ', 'IWM', 'DIA', 'XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLP',
    'XLU', 'XLY', 'XLB', 'GLD', 'TLT', 'VNQ', 'EFA', 'EEM', 'HYG', 'LQD'
  ]

  /**
   * Get best performing ETF over specified period
   */
  async getBestPerformingETF(periodDays: number = 30): Promise<ETFRecommendation | null> {
    try {
      const performances = await this.getETFPerformances(periodDays)
      
      if (performances.length === 0) {
        return null
      }

      // Sort by performance (descending)
      performances.sort((a, b) => b.performance - a.performance)
      
      const bestETF = performances[0]
      const alternatives = performances.slice(1, 4) // Top 3 alternatives

      // Generate recommendation reason
      const reason = this.generateRecommendationReason(bestETF, performances)
      
      // Calculate confidence based on performance gap and other factors
      const confidence = this.calculateConfidence(bestETF, performances)

      return {
        etf: bestETF,
        reason,
        confidence,
        alternativeOptions: alternatives
      }
    } catch (error) {
      console.error('Error getting best performing ETF:', error)
      return null
    }
  }

  /**
   * Get performance data for multiple ETFs
   */
  async getETFPerformances(periodDays: number = 30): Promise<ETFPerformance[]> {
    const performances: ETFPerformance[] = []

    try {
      // Get performance data for all popular ETFs
      const promises = this.popularEtfs.map(async (symbol) => {
        try {
          const performance = await this.getETFPerformance(symbol, periodDays)
          return performance
        } catch (error) {
          console.warn(`Failed to get performance for ${symbol}:`, error)
          return null
        }
      })

      const results = await Promise.allSettled(promises)
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          performances.push(result.value)
        }
      }

      return performances.filter(p => p !== null)
    } catch (error) {
      console.error('Error getting ETF performances:', error)
      return []
    }
  }

  /**
   * Get performance data for a single ETF
   */
  async getETFPerformance(symbol: string, periodDays: number): Promise<ETFPerformance | null> {
    try {
      const etfData = await stockDataService.getETFData(symbol)
      
      if (!etfData) {
        return null
      }

      // Calculate performance over the specified period
      const performance = await stockDataService.getETFPerformance(symbol, periodDays)
      
      // Calculate risk score based on volatility and other factors
      const riskScore = this.calculateRiskScore(etfData, periodDays)

      return {
        symbol: etfData.symbol,
        name: etfData.name,
        performance,
        price: etfData.price,
        volume: etfData.volume,
        marketCap: etfData.price * 100000000, // Approximate market cap
        holdingsCount: etfData.holdings.length,
        riskScore
      }
    } catch (error) {
      console.error(`Error getting ETF performance for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate risk score for ETF
   */
  private calculateRiskScore(etfData: ETFData, periodDays: number): number {
    try {
      const historical = etfData.historicalData.slice(-periodDays)
      
      if (historical.length < 10) {
        return 50 // Default moderate risk
      }

      // Calculate volatility
      const returns = []
      for (let i = 1; i < historical.length; i++) {
        returns.push((historical[i].close - historical[i-1].close) / historical[i-1].close)
      }

      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
      const volatility = Math.sqrt(variance) * Math.sqrt(252) // Annualized volatility

      // Calculate maximum drawdown
      let maxDrawdown = 0
      let peak = historical[0].close
      
      for (const data of historical) {
        if (data.close > peak) {
          peak = data.close
        }
        const drawdown = (peak - data.close) / peak
        maxDrawdown = Math.max(maxDrawdown, drawdown)
      }

      // Combine volatility and drawdown for risk score (0-100)
      const volatilityScore = Math.min(100, volatility * 100) // Convert to 0-100 scale
      const drawdownScore = Math.min(100, maxDrawdown * 200) // Amplify drawdown impact
      
      const riskScore = (volatilityScore + drawdownScore) / 2
      
      return Math.round(riskScore)
    } catch (error) {
      console.error('Error calculating risk score:', error)
      return 50
    }
  }

  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(bestETF: ETFPerformance, allETFs: ETFPerformance[]): string {
    const performanceGap = bestETF.performance - (allETFs[1]?.performance || 0)
    const avgPerformance = allETFs.reduce((sum, etf) => sum + etf.performance, 0) / allETFs.length
    
    let reason = `${bestETF.symbol} (${bestETF.name}) shows the strongest performance `
    
    if (performanceGap > 2) {
      reason += `with a significant lead of ${performanceGap.toFixed(1)}% over the next best performer. `
    } else {
      reason += `among major ETFs. `
    }
    
    if (bestETF.performance > avgPerformance * 1.5) {
      reason += `It's significantly outperforming the average ETF return of ${avgPerformance.toFixed(1)}%. `
    }
    
    if (bestETF.riskScore < 40) {
      reason += `The ETF shows relatively low risk characteristics.`
    } else if (bestETF.riskScore > 70) {
      reason += `Note: This ETF carries higher risk due to volatility.`
    } else {
      reason += `The ETF presents a balanced risk-return profile.`
    }
    
    return reason
  }

  /**
   * Calculate confidence in the recommendation
   */
  private calculateConfidence(bestETF: ETFPerformance, allETFs: ETFPerformance[]): number {
    let confidence = 50 // Base confidence
    
    // Higher confidence if performance is significantly better
    const performanceGap = bestETF.performance - (allETFs[1]?.performance || 0)
    if (performanceGap > 3) confidence += 20
    else if (performanceGap > 1) confidence += 10
    
    // Higher confidence if performance is positive
    if (bestETF.performance > 0) confidence += 10
    
    // Lower confidence if risk is too high
    if (bestETF.riskScore > 70) confidence -= 15
    else if (bestETF.riskScore < 30) confidence += 10
    
    // Higher confidence if volume is good
    if (bestETF.volume > 10000000) confidence += 5
    
    return Math.max(0, Math.min(100, confidence))
  }

  /**
   * Get ETF holdings analysis
   */
  async getETFHoldingsAnalysis(symbol: string): Promise<{
    holdings: Array<{
      symbol: string
      name: string
      weight: number
      performance?: number
      riskScore?: number
    }>
    diversificationScore: number
    sectorAllocation: Record<string, number>
  }> {
    try {
      const etfData = await stockDataService.getETFData(symbol)
      
      if (!etfData) {
        throw new Error(`ETF data not found for ${symbol}`)
      }

      const holdings = etfData.holdings.map(holding => ({
        symbol: holding.symbol,
        name: holding.name,
        weight: holding.weight
      }))

      // Calculate diversification score (0-100)
      const diversificationScore = this.calculateDiversificationScore(etfData.holdings)
      
      // Simple sector allocation (in real app, this would come from proper data)
      const sectorAllocation = this.estimateSectorAllocation(etfData.holdings)

      return {
        holdings,
        diversificationScore,
        sectorAllocation
      }
    } catch (error) {
      console.error(`Error analyzing ETF holdings for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Calculate diversification score based on holdings concentration
   */
  private calculateDiversificationScore(holdings: any[]): number {
    if (holdings.length === 0) return 0

    // Calculate Herfindahl-Hirschman Index (HHI)
    const hhi = holdings.reduce((sum, holding) => sum + Math.pow(holding.weight, 2), 0)
    
    // Convert HHI to diversification score (inverse relationship)
    const maxHHI = 10000 // Theoretical maximum if one holding is 100%
    const diversificationScore = ((maxHHI - hhi) / maxHHI) * 100
    
    return Math.round(diversificationScore)
  }

  /**
   * Estimate sector allocation (simplified)
   */
  private estimateSectorAllocation(holdings: any[]): Record<string, number> {
    const sectorMap: Record<string, string> = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'AMZN': 'Consumer Discretionary',
      'META': 'Technology',
      'TSLA': 'Consumer Discretionary',
      'NVDA': 'Technology',
      'JPM': 'Financials',
      'JNJ': 'Healthcare',
      'V': 'Financials',
      'PG': 'Consumer Staples',
      'UNH': 'Healthcare',
      'HD': 'Consumer Discretionary',
      'BAC': 'Financials',
      'XOM': 'Energy',
      'PFE': 'Healthcare',
      'CSCO': 'Technology',
      'ADBE': 'Technology',
      'CRM': 'Technology',
      'NFLX': 'Technology'
    }

    const sectorAllocation: Record<string, number> = {}
    
    for (const holding of holdings) {
      const sector = sectorMap[holding.symbol] || 'Other'
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + holding.weight
    }

    return sectorAllocation
  }
}

export const etfScanner = new ETFScanner()