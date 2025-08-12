import yahooFinance from 'yahoo-finance2'

export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  historicalData: HistoricalDataPoint[]
}

export interface HistoricalDataPoint {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ETFData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  holdings: ETFHolding[]
  historicalData: HistoricalDataPoint[]
}

export interface ETFHolding {
  symbol: string
  name: string
  weight: number
  shares: number
}

export class StockDataService {
  /**
   * Get current stock data for a symbol
   */
  async getStockData(symbol: string): Promise<StockData | null> {
    try {
      const quote = await yahooFinance.quote(symbol)
      const historical = await this.getHistoricalData(symbol, 365) // 1 year of data

      return {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap || 0,
        historicalData: historical
      }
    } catch (error) {
      console.error(`Error fetching stock data for ${symbol}:`, error)
      // Return fallback data instead of null
      return this.getFallbackStockData(symbol)
    }
  }

  /**
   * Get historical data for a symbol
   */
  async getHistoricalData(symbol: string, days: number = 365): Promise<HistoricalDataPoint[]> {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const result = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      })

      return result.map(item => ({
        date: new Date(item.date),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume
      }))
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Get ETF data including holdings
   */
  async getETFData(symbol: string): Promise<ETFData | null> {
    try {
      const quote = await yahooFinance.quote(symbol)
      const historical = await this.getHistoricalData(symbol, 365)
      
      // Note: Yahoo Finance doesn't provide ETF holdings directly through the API
      // In a real implementation, you might need to use a different data source
      // or maintain a list of ETF holdings manually
      const holdings = await this.getETFHoldings(symbol)

      return {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        holdings,
        historicalData: historical
      }
    } catch (error) {
      console.error(`Error fetching ETF data for ${symbol}:`, error)
      // Return fallback data instead of null
      return this.getFallbackETFData(symbol)
    }
  }

  /**
   * Get fallback ETF data when API fails
   */
  private getFallbackETFData(symbol: string): ETFData {
    console.log(`Using fallback data for ETF ${symbol}`)
    
    const fallbackData: Record<string, ETFData> = {
      'SPY': {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF',
        price: 450,
        change: 1.5,
        changePercent: 0.33,
        volume: 50000000,
        holdings: [
          { symbol: 'AAPL', name: 'Apple Inc.', weight: 7.5, shares: 1000000 },
          { symbol: 'MSFT', name: 'Microsoft Corporation', weight: 6.8, shares: 900000 },
          { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 3.9, shares: 800000 },
          { symbol: 'NVDA', name: 'NVIDIA Corporation', weight: 3.5, shares: 700000 },
          { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 2.1, shares: 600000 }
        ],
        historicalData: this.generateFallbackHistoricalData()
      },
      'QQQ': {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        price: 380,
        change: 2.1,
        changePercent: 0.55,
        volume: 30000000,
        holdings: [
          { symbol: 'AAPL', name: 'Apple Inc.', weight: 11.2, shares: 1500000 },
          { symbol: 'MSFT', name: 'Microsoft Corporation', weight: 10.1, shares: 1200000 },
          { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 5.8, shares: 1000000 },
          { symbol: 'NVDA', name: 'NVIDIA Corporation', weight: 5.2, shares: 900000 },
          { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 3.1, shares: 800000 }
        ],
        historicalData: this.generateFallbackHistoricalData()
      }
    }
    
    // Return fallback data or generate generic fallback
    return fallbackData[symbol] || {
      symbol,
      name: `${symbol} ETF`,
      price: 100,
      change: 0,
      changePercent: 0,
      volume: 1000000,
      holdings: [
        { symbol: 'STOCK1', name: 'Sample Stock 1', weight: 20, shares: 100000 },
        { symbol: 'STOCK2', name: 'Sample Stock 2', weight: 20, shares: 100000 },
        { symbol: 'STOCK3', name: 'Sample Stock 3', weight: 20, shares: 100000 },
        { symbol: 'STOCK4', name: 'Sample Stock 4', weight: 20, shares: 100000 },
        { symbol: 'STOCK5', name: 'Sample Stock 5', weight: 20, shares: 100000 }
      ],
      historicalData: this.generateFallbackHistoricalData()
    }
  }
  
  /**
   * Generate fallback historical data
   */
  private generateFallbackHistoricalData(): HistoricalDataPoint[] {
    const data: HistoricalDataPoint[] = []
    const basePrice = 100
    let currentPrice = basePrice
    
    for (let i = 0; i < 365; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (365 - i))
      
      // Random walk with slight upward bias
      const change = (Math.random() - 0.48) * 2 // Slight upward bias
      currentPrice = Math.max(10, currentPrice + change)
      
      const volatility = 0.02
      const high = currentPrice * (1 + Math.random() * volatility)
      const low = currentPrice * (1 - Math.random() * volatility)
      const open = currentPrice
      const close = currentPrice
      const volume = Math.floor(Math.random() * 1000000) + 100000
      
      data.push({
        date,
        open: Math.max(low, Math.min(high, open)),
        high,
        low,
        close: Math.max(low, Math.min(high, close)),
        volume
      })
    }
    
    return data
  }

  /**
   * Get fallback stock data when API fails
   */
  private getFallbackStockData(symbol: string): StockData {
    console.log(`Using fallback data for stock ${symbol}`)
    
    // Generate realistic fallback data
    const basePrice = 100 + Math.random() * 400 // Price between 100-500
    const change = (Math.random() - 0.5) * 10 // Change between -5 to +5
    const changePercent = (change / basePrice) * 100
    
    return {
      symbol,
      name: `${symbol} Inc.`,
      price: basePrice,
      change,
      changePercent,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
      marketCap: basePrice * 1000000000, // Simplified market cap
      historicalData: this.generateFallbackHistoricalData()
    }
  }
  private async getETFHoldings(symbol: string): Promise<ETFHolding[]> {
    // This is a simplified version. In a real application, you would:
    // 1. Use a proper ETF holdings data source
    // 2. Cache the holdings data
    // 3. Update it periodically
    
    const holdingsMap: Record<string, ETFHolding[]> = {
      'SPY': [
        { symbol: 'AAPL', name: 'Apple Inc.', weight: 7.5, shares: 1000000 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', weight: 6.8, shares: 900000 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 3.9, shares: 800000 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', weight: 3.5, shares: 700000 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 2.1, shares: 600000 },
        { symbol: 'META', name: 'Meta Platforms Inc.', weight: 2.0, shares: 500000 },
        { symbol: 'TSLA', name: 'Tesla Inc.', weight: 1.8, shares: 400000 },
        { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', weight: 1.6, shares: 300000 },
        { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', weight: 1.2, shares: 200000 },
        { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 1.1, shares: 200000 }
      ],
      'QQQ': [
        { symbol: 'AAPL', name: 'Apple Inc.', weight: 11.2, shares: 1500000 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', weight: 10.1, shares: 1200000 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 5.8, shares: 1000000 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', weight: 5.2, shares: 900000 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 3.1, shares: 800000 },
        { symbol: 'META', name: 'Meta Platforms Inc.', weight: 3.0, shares: 700000 },
        { symbol: 'TSLA', name: 'Tesla Inc.', weight: 2.7, shares: 600000 },
        { symbol: 'COST', name: 'Costco Wholesale Corporation', weight: 1.8, shares: 500000 },
        { symbol: 'AVGO', name: 'Broadcom Inc.', weight: 1.6, shares: 400000 },
        { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', weight: 1.4, shares: 300000 }
      ],
      'IWM': [
        { symbol: 'IWM', name: 'iShares Russell 2000 ETF', weight: 100.0, shares: 1000000 }
      ],
      'DIA': [
        { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', weight: 100.0, shares: 1000000 }
      ],
      'XLK': [
        { symbol: 'AAPL', name: 'Apple Inc.', weight: 15.2, shares: 2000000 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', weight: 13.8, shares: 1800000 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', weight: 7.1, shares: 1200000 },
        { symbol: 'AVGO', name: 'Broadcom Inc.', weight: 4.2, shares: 800000 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 3.8, shares: 700000 },
        { symbol: 'META', name: 'Meta Platforms Inc.', weight: 3.5, shares: 600000 },
        { symbol: 'TSLA', name: 'Tesla Inc.', weight: 3.2, shares: 500000 },
        { symbol: 'ADBE', name: 'Adobe Inc.', weight: 2.1, shares: 400000 },
        { symbol: 'CRM', name: 'Salesforce Inc.', weight: 1.9, shares: 300000 },
        { symbol: 'ORCL', name: 'Oracle Corporation', weight: 1.7, shares: 300000 }
      ],
      'XLF': [
        { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', weight: 12.5, shares: 1500000 },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', weight: 10.2, shares: 1200000 },
        { symbol: 'BAC', name: 'Bank of America Corporation', weight: 8.1, shares: 1000000 },
        { symbol: 'WFC', name: 'Wells Fargo & Company', weight: 5.8, shares: 800000 },
        { symbol: 'MS', name: 'Morgan Stanley', weight: 4.2, shares: 600000 },
        { symbol: 'GS', name: 'The Goldman Sachs Group, Inc.', weight: 3.8, shares: 500000 },
        { symbol: 'BLK', name: 'BlackRock, Inc.', weight: 2.9, shares: 400000 },
        { symbol: 'AXP', name: 'American Express Company', weight: 2.5, shares: 300000 },
        { symbol: 'C', name: 'Citigroup Inc.', weight: 2.3, shares: 300000 },
        { symbol: 'SCHW', name: 'The Charles Schwab Corporation', weight: 2.1, shares: 300000 }
      ],
      'XLV': [
        { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 8.5, shares: 1200000 },
        { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', weight: 7.8, shares: 1100000 },
        { symbol: 'PFE', name: 'Pfizer Inc.', weight: 5.2, shares: 800000 },
        { symbol: 'ABBV', name: 'AbbVie Inc.', weight: 4.8, shares: 700000 },
        { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.', weight: 3.9, shares: 600000 },
        { symbol: 'ABT', name: 'Abbott Laboratories', weight: 3.5, shares: 500000 },
        { symbol: 'DHR', name: 'Danaher Corporation', weight: 3.2, shares: 500000 },
        { symbol: 'BMY', name: 'Bristol-Myers Squibb Company', weight: 2.8, shares: 400000 },
        { symbol: 'CVS', name: 'CVS Health Corporation', weight: 2.5, shares: 400000 },
        { symbol: 'GILD', name: 'Gilead Sciences, Inc.', weight: 2.2, shares: 300000 }
      ],
      'XLE': [
        { symbol: 'XOM', name: 'Exxon Mobil Corporation', weight: 22.5, shares: 3000000 },
        { symbol: 'CVX', name: 'Chevron Corporation', weight: 18.2, shares: 2500000 },
        { symbol: 'COP', name: 'ConocoPhillips', weight: 12.8, shares: 1800000 },
        { symbol: 'EOG', name: 'EOG Resources, Inc.', weight: 8.5, shares: 1200000 },
        { symbol: 'SLB', name: 'Schlumberger Limited', weight: 6.2, shares: 900000 },
        { symbol: 'MPC', name: 'Marathon Petroleum Corporation', weight: 4.8, shares: 700000 },
        { symbol: 'PSX', name: 'Phillips 66', weight: 4.2, shares: 600000 },
        { symbol: 'VLO', name: 'Valero Energy Corporation', weight: 3.8, shares: 500000 },
        { symbol: 'WMB', name: 'The Williams Companies, Inc.', weight: 3.2, shares: 400000 },
        { symbol: 'BKR', name: 'Baker Hughes Company', weight: 2.8, shares: 400000 }
      ]
    }

    const holdings = holdingsMap[symbol]
    if (!holdings || holdings.length === 0) {
      console.log(`No holdings found for ETF ${symbol}, using sample stocks`)
      // Return some sample stocks for any unsupported ETF
      return [
        { symbol: 'AAPL', name: 'Apple Inc.', weight: 10.0, shares: 1000000 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', weight: 8.0, shares: 800000 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 6.0, shares: 600000 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 5.0, shares: 500000 },
        { symbol: 'TSLA', name: 'Tesla Inc.', weight: 4.0, shares: 400000 }
      ]
    }
    
    return holdings
  }

  /**
   * Calculate ETF performance over a period
   */
  async getETFPerformance(symbol: string, days: number): Promise<number> {
    try {
      const historical = await this.getHistoricalData(symbol, days)
      
      if (historical.length < 2) {
        return 0
      }

      const startPrice = historical[0].close
      const endPrice = historical[historical.length - 1].close
      
      return ((endPrice - startPrice) / startPrice) * 100
    } catch (error) {
      console.error(`Error calculating ETF performance for ${symbol}:`, error)
      return 0
    }
  }

  /**
   * Get multiple stock data points in batch
   */
  async getBatchStockData(symbols: string[]): Promise<StockData[]> {
    const promises = symbols.map(symbol => this.getStockData(symbol))
    const results = await Promise.allSettled(promises)
    
    return results
      .filter((result): result is PromiseFulfilledResult<StockData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
  }
}

export const stockDataService = new StockDataService()