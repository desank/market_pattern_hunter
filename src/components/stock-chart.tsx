import React, { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickSeriesPartialOptions, Time } from 'lightweight-charts'
import { HistoricalDataPoint } from '@/lib/stock-data'
import { VCPResult } from '@/lib/vcp-detector'

interface StockChartProps {
  historicalData: HistoricalDataPoint[]
  vcpResult: VCPResult
  symbol: string
}

const StockChart: React.FC<StockChartProps> = ({ historicalData, vcpResult, symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    console.log('First useEffect: Running')
    if (!chartContainerRef.current) {
      console.log('First useEffect: chartContainerRef.current is null')
      return
    }

    console.log('First useEffect: chartContainerRef.current is available', chartContainerRef.current)
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: 'solid', color: '#1E293B' },
        textColor: '#CBD5E1',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0, // Magnet mode
      },
    })
    console.log('First useEffect: chart created', chart)

    chartRef.current = chart
    console.log('First useEffect: chartRef.current assigned', chartRef.current)

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })
    console.log('First useEffect: candlestickSeries created', candlestickSeries)
    candlestickSeriesRef.current = candlestickSeries

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, []) // Empty dependency array to run only once on mount

  // Set data for candlestick series
  useEffect(() => {
    if (!candlestickSeriesRef.current || historicalData.length === 0) return

    const formattedData = historicalData.map(d => ({
      time: (new Date(d.date).getTime() / 1000) as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))

    candlestickSeriesRef.current.setData(formattedData)
    chartRef.current?.timeScale().fitContent()
  }, [historicalData, candlestickSeriesRef.current])

  // Drawing VCP pattern
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !vcpResult.hasPattern) return

    const chart = chartRef.current
    const drawingSeries: ISeriesApi<any>[] = []

    // Clear previous drawings
    chart.series().forEach(series => {
      if (series !== candlestickSeriesRef.current) {
        chart.removeSeries(series)
      }
    })

    // Draw Bases
    vcpResult.bases.forEach(base => {
      const baseStart = historicalData[base.start].date
      const baseEnd = historicalData[base.end].date
      const baseHigh = Math.max(...historicalData.slice(base.start, base.end + 1).map(d => d.high))
      const baseLow = Math.min(...historicalData.slice(base.start, base.end + 1).map(d => d.low))

      const topLine = chart.addLineSeries({
        color: '#FBBF24', // Amber
        lineWidth: 1,
        lineStyle: 0, // Solid
        axisLabelVisible: false,
      })
      topLine.setData([
        { time: (new Date(baseStart).getTime() / 1000) as Time, value: baseHigh },
        { time: (new Date(baseEnd).getTime() / 1000) as Time, value: baseHigh },
      ])
      drawingSeries.push(topLine)

      const bottomLine = chart.addLineSeries({
        color: '#FBBF24', // Amber
        lineWidth: 1,
        lineStyle: 0, // Solid
        axisLabelVisible: false,
      })
      bottomLine.setData([
        { time: (new Date(baseStart).getTime() / 1000) as Time, value: baseLow },
        { time: (new Date(baseEnd).getTime() / 1000) as Time, value: baseLow },
      ])
      drawingSeries.push(bottomLine)
    })

    // Draw Entry Points
    vcpResult.entryPoints.forEach(entry => {
      const entryLine = chart.addLineSeries({
        color: entry.type === 'breakout' ? '#10B981' : entry.type === 'pivot' ? '#60A5FA' : '#F87171', // Green, Blue, Red
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        lastValueVisible: true,
      })
      entryLine.setData([
        { time: (historicalData[historicalData.length - 1].date.getTime() / 1000) as Time, value: entry.price },
        { time: (historicalData[historicalData.length - 1].date.getTime() / 1000) as Time, value: entry.price },
      ])
      drawingSeries.push(entryLine)

      entryLine.createPriceLine({
        price: entry.price,
        color: entry.type === 'breakout' ? '#10B981' : entry.type === 'pivot' ? '#60A5FA' : '#F87171',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `${entry.type.toUpperCase()} (${entry.price.toFixed(2)})`,
      })
    })

    // Draw Target Projection
    if (vcpResult.targetProjection) {
      const targetLine = chart.addLineSeries({
        color: '#8B5CF6', // Purple
        lineWidth: 2,
        lineStyle: 3, // Dotted
        axisLabelVisible: true,
        lastValueVisible: true,
      })
      targetLine.setData([
        { time: (historicalData[historicalData.length - 1].date.getTime() / 1000) as Time, value: vcpResult.targetProjection },
        { time: (historicalData[historicalData.length - 1].date.getTime() / 1000) as Time, value: vcpResult.targetProjection },
      ])
      drawingSeries.push(targetLine)

      targetLine.createPriceLine({
        price: vcpResult.targetProjection,
        color: '#8B5CF6',
        lineWidth: 2,
        lineStyle: 3,
        axisLabelVisible: true,
        title: `TARGET (${vcpResult.targetProjection.toFixed(2)})`,
      })
    }

    return () => {
      drawingSeries.forEach(series => chart.removeSeries(series))
    }
  }, [vcpResult, historicalData, candlestickSeriesRef.current])

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{symbol} Candlestick Chart</h3>
      <div ref={chartContainerRef} className="w-full h-[400px]" />
      {vcpResult.hasPattern ? (
        <div className="bg-blue-900/20 p-4 rounded-lg text-sm">
          <p className="font-medium text-blue-300">VCP Pattern Detected!</p>
          <p>Score: {vcpResult.score.toFixed(0)}%</p>
          <p>{vcpResult.description}</p>
          {vcpResult.entryPoints.length > 0 && (
            <p>Potential Entry: {vcpResult.entryPoints[0].price.toFixed(2)} ({vcpResult.entryPoints[0].type})</p>
          )}
          {vcpResult.targetProjection && (
            <p>Target Projection: {vcpResult.targetProjection.toFixed(2)}</p>
          )}
        </div>
      ) : (
        <div className="bg-gray-800/20 p-4 rounded-lg text-sm text-gray-400">
          <p>No VCP pattern detected for {symbol} in the analyzed period.</p>
        </div>
      )}
    </div>
  )
}

export default StockChart
