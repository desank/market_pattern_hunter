'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Play, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Clock, Activity, BarChart3, Bell, Settings } from 'lucide-react'

interface ScanConfig {
  id: string
  name: string
  etfSymbol: string
  lookbackPeriod: number
  timeframe: string
  isActive: boolean
}

interface Scan {
  id: string
  configName: string
  etfSymbol: string
  etfPerformance: number
  status: string
  stocksScanned: number
  vcpFound: number
  createdAt: string
}

interface StockScan {
  id: string
  symbol: string
  name?: string
  hasVcpPattern: boolean
  vcpScore?: number
  entrySignal: boolean
  lastPrice?: number
  volume?: number
  createdAt: string
}

interface SystemStatus {
  activeScans: number
  totalVCPS: number
  activeSignals: number
  monitoringStatus: Array<{
    stockScanId: string
    symbol: string
    interval: number
  }>
  timestamp: string
}

const popularEtfs = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR Fund' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund' },
]

export default function Home() {
  const [scanConfigs, setScanConfigs] = useState<ScanConfig[]>([])
  const [scans, setScans] = useState<Scan[]>([])
  const [stockScans, setStockScans] = useState<StockScan[]>([])
  const [currentScanInfo, setCurrentScanInfo] = useState<Scan | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStocksForScan, setLoadingStocksForScan] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [scanningConfigId, setScanningConfigId] = useState<string | null>(null)
  
  // New scan configuration form state
  const [newConfig, setNewConfig] = useState({
    name: '',
    etfSymbol: '',
    lookbackPeriod: 30,
    timeframe: '1d'
  })

  // Auto-load most recent scan results when switching to results tab
  
  useEffect(() => {
    if (activeTab === 'results') {
      // Find the most recent completed scan
      const completedScans = scans.filter(s => s.status === 'completed').sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      if (completedScans.length > 0 && stockScans.length === 0) {
        loadStockScans(completedScans[0].id)
        toast.info(`Loaded results from most recent scan: ${completedScans[0].etfSymbol}`)
      }
    }
  }, [activeTab, scans])
  
  // Load initial data
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadScanConfigs(),
        loadScans(),
        loadSystemStatus()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadScanConfigs = async () => {
    try {
      const response = await fetch('/api/scan-configs')
      if (response.ok) {
        const data = await response.json()
        setScanConfigs(data)
      }
    } catch (error) {
      console.error('Failed to load scan configs:', error)
    }
  }

  const loadScans = async () => {
    try {
      const response = await fetch('/api/scans')
      if (response.ok) {
        const data = await response.json()
        setScans(data)
      }
    } catch (error) {
      console.error('Failed to load scans:', error)
    }
  }

  const loadSystemStatus = async () => {
    try {
      const response = await fetch('/api/monitoring/status')
      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data.status)
      }
    } catch (error) {
      console.error('Failed to load system status:', error)
    }
  }

  const loadStockScans = async (scanId: string) => {
    setLoadingStocksForScan(scanId)
    try {
      const response = await fetch(`/api/scans/${scanId}/stocks`)
      if (response.ok) {
        const data = await response.json()
        setStockScans(data)
        
        // Find and set the scan info
        const scan = scans.find(s => s.id === scanId)
        if (scan) {
          setCurrentScanInfo(scan)
          toast.success(`Loaded ${data.length} results from ${scan.configName} scan`)
        }
      } else {
        toast.error('Failed to load stock scan results')
      }
    } catch (error) {
      console.error('Failed to load stock scans:', error)
      toast.error('Failed to load stock scan results')
    } finally {
      setLoadingStocksForScan(null)
    }
  }

  const createScanConfig = async () => {
    if (!newConfig.name || !newConfig.etfSymbol) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/scan-configs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })

      if (response.ok) {
        await loadScanConfigs()
        setNewConfig({ name: '', etfSymbol: '', lookbackPeriod: 30, timeframe: '1d' })
        toast.success('Configuration created successfully!')
      } else {
        const error = await response.json()
        toast.error(`Failed to create configuration: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to create scan config:', error)
      toast.error('Failed to create configuration. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const startScan = async (configId: string) => {
    if (scanningConfigId) {
      toast.warning('A scan is already running')
      return
    }

    setScanningConfigId(configId)
    try {
      const response = await fetch(`/api/scans/${configId}/start`, {
        method: 'POST'
      })

      if (response.ok) {
        await loadScans()
        toast.success('Scan started successfully!')
        
        // Start polling for updates
        const pollInterval = setInterval(async () => {
          await loadScans()
          const updatedScans = await (await fetch('/api/scans')).json()
          const runningScans = updatedScans.filter((s: Scan) => s.status === 'running')
          if (runningScans.length === 0) {
            clearInterval(pollInterval)
            setScanningConfigId(null)
            toast.success('Scan completed!')
          }
        }, 3000)
      } else {
        const error = await response.json()
        toast.error(`Failed to start scan: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to start scan:', error)
      toast.error('Failed to start scan. Please try again.')
    } finally {
      // Don't set scanningConfigId to null here, let the polling handle it
    }
  }

  const deleteAllScans = async () => {
    if (scans.length === 0) {
      toast.info('No scans to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete all ${scans.length} scans and their results?`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/scans', {
        method: 'DELETE'
      })

      if (response.ok) {
        // Clear all scan-related state
        setScans([])
        setCurrentScanInfo(null)
        setStockScans([])
        
        toast.success('All scans deleted successfully!')
      } else {
        const error = await response.json()
        toast.error(`Failed to delete scans: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to delete all scans:', error)
      toast.error('Failed to delete scans. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteScan = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan and all its results?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/scans/${scanId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove the scan from local state
        setScans(prev => prev.filter(s => s.id !== scanId))
        
        // Clear current scan info if it was the deleted scan
        if (currentScanInfo?.id === scanId) {
          setCurrentScanInfo(null)
          setStockScans([])
        }
        
        toast.success('Scan deleted successfully!')
      } else {
        const error = await response.json()
        toast.error(`Failed to delete scan: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to delete scan:', error)
      toast.error('Failed to delete scan. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      await loadAllData()
      toast.success('Data refreshed successfully!')
    } catch (error) {
      console.error('Failed to refresh data:', error)
      toast.error('Failed to refresh data. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  const getVCPScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading && scanConfigs.length === 0) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading Stock Market Scanner...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Market Scanner</h1>
          <p className="text-muted-foreground">
            Scan for VCP (Volatility Contraction Patterns) in US stocks
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="configs">Scan Configurations</TabsTrigger>
          <TabsTrigger value="results">Scan Results</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* System Overview - Calculated from actual data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                System Overview
              </CardTitle>
              <CardDescription>
                Current scanner activity and cumulative performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{scans.filter(s => s.status === 'running').length}</div>
                  <div className="text-sm text-blue-800">Active Scans</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{scans.reduce((sum, scan) => sum + scan.vcpFound, 0)}</div>
                  <div className="text-sm text-green-800">Total VCP Patterns</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stockScans.filter(s => s.entrySignal).length}</div>
                  <div className="text-sm text-orange-800">Entry Signals</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{scans.reduce((sum, scan) => sum + scan.stocksScanned, 0)}</div>
                  <div className="text-sm text-purple-800">Total Stocks Scanned</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Scans</CardTitle>
              <CardDescription>
                Click "View Results" to see detailed VCP pattern analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="mb-2">No scans yet.</p>
                    <p className="text-sm">Create a scan configuration to get started.</p>
                  </div>
                ) : (
                  scans.slice(0, 5).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(scan.status)}
                        <div>
                          <div className="font-medium">{scan.configName}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(scan.createdAt).toLocaleString()} • {scan.stocksScanned} stocks scanned
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-sm font-medium ${scan.etfPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {scan.etfSymbol} {scan.etfPerformance >= 0 ? '+' : ''}{scan.etfPerformance.toFixed(2)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {scan.vcpFound} VCP found
                          </div>
                        </div>
                        {getStatusBadge(scan.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            loadStockScans(scan.id)
                            setActiveTab('results')
                          }}
                          disabled={loadingStocksForScan === scan.id || isLoading}
                        >
                          {loadingStocksForScan === scan.id ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          {loadingStocksForScan === scan.id ? 'Loading...' : 'View Results'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Scan Configuration</CardTitle>
              <CardDescription>
                Configure a new scan to detect VCP patterns in US stocks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Configuration Name *</Label>
                  <Input
                    id="name"
                    placeholder="My VCP Scan"
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="etfSymbol">ETF Symbol *</Label>
                  <Select
                    value={newConfig.etfSymbol}
                    onValueChange={(value) => setNewConfig({ ...newConfig, etfSymbol: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ETF" />
                    </SelectTrigger>
                    <SelectContent>
                      {popularEtfs.map((etf) => (
                        <SelectItem key={etf.symbol} value={etf.symbol}>
                          {etf.symbol} - {etf.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lookbackPeriod">Lookback Period (days)</Label>
                  <Input
                    id="lookbackPeriod"
                    type="number"
                    value={newConfig.lookbackPeriod}
                    onChange={(e) => setNewConfig({ ...newConfig, lookbackPeriod: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeframe">Timeframe</Label>
                  <Select
                    value={newConfig.timeframe}
                    onValueChange={(value) => setNewConfig({ ...newConfig, timeframe: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">Daily (1d)</SelectItem>
                      <SelectItem value="1h">Hourly (1h)</SelectItem>
                      <SelectItem value="4h">4-Hour (4h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={createScanConfig} 
                disabled={!newConfig.name || !newConfig.etfSymbol || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Configuration'
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Configurations</CardTitle>
              <CardDescription>
                Manage your scan configurations and start new scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scanConfigs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="mb-2">No configurations yet.</p>
                    <p className="text-sm">Create one above to start scanning for VCP patterns.</p>
                  </div>
                ) : (
                  scanConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <div className="font-medium">{config.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {config.etfSymbol} • {config.lookbackPeriod} days • {config.timeframe}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.isActive ? "default" : "secondary"}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          onClick={() => startScan(config.id)}
                          disabled={scanningConfigId !== null || isLoading}
                          size="sm"
                        >
                          {scanningConfigId === config.id ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          {scanningConfigId === config.id ? 'Starting...' : 'Start Scan'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {/* Recent Scans Table for selecting which scan results to view */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Scans
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteAllScans}
                  disabled={scans.length === 0 || isLoading}
                >
                  Delete All Scans
                </Button>
              </CardTitle>
              <CardDescription>
                Click on a scan to view its detailed results below
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="mb-2">No scans available.</p>
                  <p className="text-sm">Run a scan to see results here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scans.map((scan) => (
                    <div 
                      key={scan.id}
                      className={[
                        'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                        currentScanInfo?.id === scan.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      ].join(' ')}
                      onClick={() => loadStockScans(scan.id)}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(scan.status)}
                        <div>
                          <div className="font-medium">{scan.configName}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(scan.createdAt).toLocaleString()} • {scan.etfSymbol}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-sm font-medium ${scan.etfPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {scan.etfPerformance >= 0 ? '+' : ''}{scan.etfPerformance.toFixed(2)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {scan.stocksScanned} stocks, {scan.vcpFound} VCP
                          </div>
                        </div>
                        {getStatusBadge(scan.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteScan(scan.id)
                          }}
                          disabled={isLoading}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Stock Scan Results */}
          {currentScanInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Stock Scan Results
                </CardTitle>
                <CardDescription>
                  Results for {currentScanInfo.configName} ({currentScanInfo.etfSymbol}) - {new Date(currentScanInfo.createdAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stockScans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="mb-2">No stock scan results found.</p>
                    <p className="text-sm">This scan may not have found any VCP patterns.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Found {stockScans.filter(s => s.hasVcpPattern).length} stocks with VCP patterns</span>
                      <span>{stockScans.filter(s => s.entrySignal).length} entry signals detected</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>VCP Pattern</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Entry Signal</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Volume</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {stockScans.map((stock) => (
                        <TableRow key={stock.id}>
                          <TableCell className="font-medium">{stock.symbol}</TableCell>
                          <TableCell>{stock.name}</TableCell>
                          <TableCell>
                            {stock.hasVcpPattern ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">Found</Badge>
                            ) : (
                              <Badge variant="secondary">None</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {stock.vcpScore ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${stock.vcpScore}%` }}
                                  ></div>
                                </div>
                                <span className={`text-sm font-medium ${getVCPScoreColor(stock.vcpScore)}`}>
                                  {stock.vcpScore.toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {stock.entrySignal ? (
                              <Badge variant="destructive" className="bg-red-100 text-red-800">Signal</Badge>
                            ) : (
                              <Badge variant="outline">Waiting</Badge>
                            )}
                          </TableCell>
                          <TableCell>${stock.lastPrice?.toFixed(2) || '-'}</TableCell>
                          <TableCell>{stock.volume?.toLocaleString() || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Settings</CardTitle>
              <CardDescription>
                Configure email alerts for VCP patterns and entry signals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Email alerts will be sent when VCP patterns are detected and when entry signals are confirmed.
                  Configure your SMTP settings below to enable email notifications.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp">SMTP Server</Label>
                  <Input
                    id="smtp"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your email password or app password"
                  />
                </div>
                
                <Button className="w-full">Save Email Configuration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
