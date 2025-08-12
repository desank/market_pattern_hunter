import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { db } from '@/lib/db'
import { entryMonitor } from './entry-monitor'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: ServerIO
    }
  }
}

export class RealtimeService {
  private io: ServerIO | null = null

  constructor() {
    // Initialize Socket.IO if not already done
    if (typeof window === 'undefined') {
      this.initializeSocket()
    }
  }

  /**
   * Initialize Socket.IO server
   */
  private initializeSocket() {
    if (this.io) return

    // This would be initialized in the server setup
    // For now, we'll use a placeholder
    console.log('Realtime service initialized')
  }

  /**
   * Broadcast scan update to all connected clients
   */
  async broadcastScanUpdate(scanId: string) {
    try {
      const scan = await db.scan.findUnique({
        where: { id: scanId },
        include: {
          scanConfig: true,
          stockScans: {
            where: {
              hasVcpPattern: true
            },
            take: 10
          }
        }
      })

      if (!scan) return

      const update = {
        type: 'scan_update',
        data: {
          id: scan.id,
          etfSymbol: scan.etfSymbol,
          status: scan.status,
          etfPerformance: scan.etfPerformance,
          stocksScanned: scan.stocksScanned,
          vcpFound: scan.vcpFound,
          topVCPS: scan.stockScans.map(stock => ({
            symbol: stock.symbol,
            name: stock.name,
            vcpScore: stock.vcpScore,
            entrySignal: stock.entrySignal,
            currentPrice: stock.lastPrice
          }))
        }
      }

      this.broadcast(update)
    } catch (error) {
      console.error('Error broadcasting scan update:', error)
    }
  }

  /**
   * Broadcast VCP pattern found
   */
  async broadcastVCPFound(stockScanId: string) {
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

      if (!stockScan || !stockScan.hasVcpPattern) return

      const update = {
        type: 'vcp_found',
        data: {
          id: stockScan.id,
          symbol: stockScan.symbol,
          name: stockScan.name,
          vcpScore: stockScan.vcpScore,
          currentPrice: stockScan.lastPrice,
          scanName: stockScan.scan.scanConfig.name,
          etfSymbol: stockScan.scan.etfSymbol,
          timestamp: new Date()
        }
      }

      this.broadcast(update)
    } catch (error) {
      console.error('Error broadcasting VCP found:', error)
    }
  }

  /**
   * Broadcast entry signal detected
   */
  async broadcastEntrySignal(stockScanId: string) {
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

      if (!stockScan || !stockScan.entrySignal) return

      const update = {
        type: 'entry_signal',
        data: {
          id: stockScan.id,
          symbol: stockScan.symbol,
          name: stockScan.name,
          vcpScore: stockScan.vcpScore,
          currentPrice: stockScan.lastPrice,
          scanName: stockScan.scan.scanConfig.name,
          etfSymbol: stockScan.scan.etfSymbol,
          timestamp: new Date()
        }
      }

      this.broadcast(update)
    } catch (error) {
      console.error('Error broadcasting entry signal:', error)
    }
  }

  /**
   * Broadcast system status
   */
  async broadcastSystemStatus() {
    try {
      const activeScans = await db.scan.count({
        where: { status: 'running' }
      })

      const totalVCPS = await db.stockScan.count({
        where: { hasVcpPattern: true }
      })

      const activeSignals = await db.stockScan.count({
        where: { entrySignal: true }
      })

      const monitoringStatus = entryMonitor.getMonitoringStatus()

      const update = {
        type: 'system_status',
        data: {
          activeScans,
          totalVCPS,
          activeSignals,
          monitoringStatus,
          timestamp: new Date()
        }
      }

      this.broadcast(update)
    } catch (error) {
      console.error('Error broadcasting system status:', error)
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: any) {
    if (this.io) {
      this.io.emit('update', message)
    } else {
      // Fallback: store in database for polling
      this.storeForPolling(message)
    }
  }

  /**
   * Store message for clients that are polling
   */
  private async storeForPolling(message: any) {
    try {
      // In a real implementation, you would store this in a Redis cache
      // or a dedicated updates table
      console.log('Storing update for polling:', message.type)
    } catch (error) {
      console.error('Error storing update for polling:', error)
    }
  }

  /**
   * Get recent updates for polling clients
   */
  async getRecentUpdates(since?: Date) {
    try {
      // In a real implementation, this would fetch from a cache
      // For now, return current system status
      const activeScans = await db.scan.count({
        where: { status: 'running' }
      })

      const totalVCPS = await db.stockScan.count({
        where: { hasVcpPattern: true }
      })

      const activeSignals = await db.stockScan.count({
        where: { entrySignal: true }
      })

      return {
        systemStatus: {
          activeScans,
          totalVCPS,
          activeSignals,
          timestamp: new Date()
        }
      }
    } catch (error) {
      console.error('Error getting recent updates:', error)
      return { systemStatus: null }
    }
  }

  /**
   * Start periodic status broadcasts
   */
  startStatusBroadcasts(interval: number = 30000) { // 30 seconds
    setInterval(() => {
      this.broadcastSystemStatus()
    }, interval)
  }
}

// Create singleton instance
export const realtimeService = new RealtimeService()