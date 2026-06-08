import { useMemo } from 'react'

interface Props {
  results: Record<string, unknown>[]
  title?: string
}

interface DatasetMode {
  type: 'dataset'
  data: { label: string; value: number }[]
  maxVal: number
  valueKey: string
  labelKey: string
  isPercentage: boolean
}

interface MetricNumericMode {
  type: 'metric-numeric'
  valueKey: string
  labelKey: string
  value: number
  label: string
}

interface MetricTextMode {
  type: 'metric-text'
  valueKey: string
  value: string
}

type ChartMode = DatasetMode | MetricNumericMode | MetricTextMode

export default function ResultsChart({ results, title }: Props) {
  const chartMode = useMemo<ChartMode | null>(() => {
    if (!results || results.length === 0) return null

    const keys = Object.keys(results[0])
    const numericKeys = keys.filter(k => typeof results[0][k] === 'number')
    const otherKeys = keys.filter(k => typeof results[0][k] !== 'number')

    // 1. Single row result (Metric View)
    if (results.length === 1) {
      if (numericKeys.length > 0) {
        const valueKey = numericKeys[0]
        const labelKey = otherKeys[0] || ''
        const value = Number(results[0][valueKey]) || 0
        const label = labelKey ? String(results[0][labelKey] ?? '') : ''
        return {
          type: 'metric-numeric',
          valueKey,
          labelKey,
          value,
          label
        }
      } else {
        const valueKey = keys[0]
        const value = String(results[0][valueKey] ?? 'NULL')
        return {
          type: 'metric-text',
          valueKey,
          value
        }
      }
    }

    // 2. Multiple rows result
    if (numericKeys.length > 0) {
      let labelKey = ''
      let valueKey = ''

      // Prioritize keys that look like labels
      const labelCandidates = ['category_name', 'state', 'month', 'channel', 'city', 'seller_id', 'user_id', 'product_id', 'name']
      for (const cand of labelCandidates) {
        if (keys.includes(cand)) {
          labelKey = cand
          break
        }
      }

      // Prioritize keys that look like metrics
      const valueCandidates = [
        'total_revenue', 'total_spend', 'order_count', 'total_orders', 
        'avg_review_score', 'avg_freight', 'freight_pct', 'cancel_rate_pct',
        'total_revenue_usd', 'order_total_usd', 'avg_order_value', 'revenue', 'spend', 'count'
      ]
      for (const cand of valueCandidates) {
        if (keys.includes(cand)) {
          valueKey = cand
          break
        }
      }

      // Fallbacks
      if (!labelKey) labelKey = otherKeys[0] || keys[0]
      if (!valueKey) valueKey = numericKeys[0]

      // Extract top 6 records
      const rawData = results.slice(0, 6).map(row => {
        const labelVal = row[labelKey]
        const label = labelVal === null || labelVal === undefined ? 'NULL' : String(labelVal)
        const value = Number(row[valueKey]) || 0
        return { label, value }
      })

      const maxVal = Math.max(...rawData.map(d => d.value), 1)
      const isPercentage = valueKey.toLowerCase().includes('pct') || valueKey.toLowerCase().includes('rate') || (maxVal <= 100 && rawData.some(d => d.value > 0 && d.value < 1))

      return {
        type: 'dataset',
        data: rawData,
        maxVal,
        valueKey,
        labelKey,
        isPercentage
      }
    } else {
      // 3. Multiple rows, but no numeric columns (Frequency Distribution)
      const targetKey = keys[0]
      const counts: Record<string, number> = {}
      for (const row of results) {
        const val = row[targetKey] === null || row[targetKey] === undefined ? 'NULL' : String(row[targetKey])
        counts[val] = (counts[val] || 0) + 1
      }

      const rawData = Object.entries(counts).map(([label, value]) => ({ label, value }))
      // Sort descending by frequency count
      rawData.sort((a, b) => b.value - a.value)
      const topData = rawData.slice(0, 6)
      const maxVal = Math.max(...topData.map(d => d.value), 1)

      return {
        type: 'dataset',
        data: topData,
        maxVal,
        valueKey: `Count of ${targetKey}`,
        labelKey: targetKey,
        isPercentage: false
      }
    }
  }, [results])

  if (!chartMode) {
    return (
      <div style={{
        padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '12px'
      }}>
        No visual data representation available.
      </div>
    )
  }

  // Format utility
  const formatValue = (val: number, isPct: boolean, max: number) => {
    if (isPct) {
      if (max <= 1) {
        return `${(val * 100).toFixed(0)}%`
      }
      return `${val.toFixed(1)}%`
    }
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  // Render Metric Numeric (Scalar Gauge)
  if (chartMode.type === 'metric-numeric') {
    const { valueKey, label, value } = chartMode
    const displayTitle = title || valueKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 2 })

    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '220px',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.25s, border-color 0.25s'
      }}>
        {/* Background glow decoration */}
        <div style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'var(--accent-teal)',
          opacity: 0.08,
          filter: 'blur(30px)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-secondary)',
          zIndex: 2
        }}>
          {displayTitle}
        </span>

        {/* Circular Dial indicator */}
        <div style={{
          position: 'relative',
          width: '130px',
          height: '130px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2
        }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="var(--bg-tertiary)"
              strokeWidth="6"
            />
            {/* Active glowing ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="var(--accent-teal)"
              strokeWidth="6"
              strokeDasharray="251.2"
              strokeDashoffset="62.8" /* 75% arc for style */
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(13, 148, 136, 0.3))'
              }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            inset: 0
          }}>
            <span style={{
              fontSize: formatted.length > 8 ? '18px' : formatted.length > 5 ? '22px' : '26px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)'
            }}>
              {formatted}
            </span>
          </div>
        </div>

        {label && (
          <span style={{
            fontSize: '12.5px',
            color: 'var(--text-primary)',
            background: 'var(--bg-tertiary)',
            padding: '4px 12px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            zIndex: 2
          }}>
            {label}
          </span>
        )}
      </div>
    )
  }

  // Render Metric Text (Scalar String Badge)
  if (chartMode.type === 'metric-text') {
    const { valueKey, value } = chartMode
    const displayTitle = title || valueKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '220px',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.25s, border-color 0.25s'
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'var(--accent-blue)',
          opacity: 0.05,
          filter: 'blur(35px)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-secondary)',
          zIndex: 2
        }}>
          {displayTitle}
        </span>

        {/* Decorative Badge representation */}
        <div style={{
          padding: '16px 24px',
          borderRadius: '10px',
          border: '1px dashed var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '90%',
          textAlign: 'center',
          zIndex: 2,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{
            fontSize: value.length > 20 ? '15px' : '18px',
            fontWeight: 700,
            color: 'var(--accent-teal)',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-mono)'
          }}>
            "{value}"
          </span>
        </div>

        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', zIndex: 2 }}>
          Single Record Result
        </span>
      </div>
    )
  }

  // Render Dataset Mode (Bar Chart)
  if (chartMode.type === 'dataset') {
    const { data, maxVal, valueKey, isPercentage } = chartMode
    const displayTitle = title || `${valueKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`

    // SVG dimensions
    const width = 500
    const height = 240
    const paddingLeft = 60
    const paddingRight = 20
    const paddingTop = 30
    const paddingBottom = 40

    const chartWidth = width - paddingLeft - paddingRight
    const chartHeight = height - paddingTop - paddingBottom

    // Calculate ticks
    const ticks = [0, 0.25, 0.5, 0.75, 1]

    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'background-color 0.25s, border-color 0.25s'
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13.5px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          textAlign: 'center',
          letterSpacing: '0.01em',
          transition: 'color 0.25s'
        }}>
          {displayTitle}
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
          {/* Y Axis Grid Lines & Labels */}
          {ticks.map((t, idx) => {
            const y = paddingTop + chartHeight - t * chartHeight
            const val = t * maxVal
            return (
              <g key={idx}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="var(--border-color)" 
                  strokeWidth={1}
                  opacity={0.5}
                  style={{ transition: 'stroke 0.25s' }}
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  fill="var(--text-secondary)" 
                  fontSize="9.5px"
                  fontFamily="var(--font-mono)"
                  style={{ transition: 'fill 0.25s' }}
                >
                  {formatValue(val, isPercentage, maxVal)}
                </text>
              </g>
            )
          })}

          {/* X Axis Line */}
          <line 
            x1={paddingLeft} 
            y1={paddingTop + chartHeight} 
            x2={width - paddingRight} 
            y2={paddingTop + chartHeight} 
            stroke="var(--border-color)" 
            strokeWidth={1}
            style={{ transition: 'stroke 0.25s' }}
          />

          {/* Bars */}
          {data.map((d, idx) => {
            const barCount = data.length
            const barWidth = Math.min(32, (chartWidth / barCount) * 0.5)
            const spacing = chartWidth / barCount
            const x = paddingLeft + idx * spacing + (spacing - barWidth) / 2
            
            const barHeight = (d.value / maxVal) * chartHeight
            const y = paddingTop + chartHeight - barHeight

            return (
              <g key={idx} style={{ transition: 'all 0.3s ease' }}>
                <title>{`${d.label}: ${d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</title>

                {/* Bar with rounded top corner using path */}
                {barHeight > 4 ? (
                  <path
                    d={`
                      M ${x},${y + 4}
                      a 4,4 0 0 1 4,-4
                      l ${barWidth - 8},0
                      a 4,4 0 0 1 4,4
                      l 0,${barHeight - 4}
                      l -${barWidth},0
                      Z
                    `}
                    fill="url(#tealGradient)"
                    style={{ cursor: 'pointer' }}
                  />
                ) : (
                  <rect 
                    x={x} 
                    y={y} 
                    width={barWidth} 
                    height={barHeight} 
                    fill="url(#tealGradient)" 
                    rx={2} 
                    ry={2}
                  />
                )}

                {/* Labels below bars */}
                <text
                  x={x + barWidth / 2}
                  y={paddingTop + chartHeight + 16}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="9.5px"
                  fontFamily="var(--font-sans)"
                  fontWeight="500"
                  style={{
                    maxWidth: spacing - 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'fill 0.25s'
                  }}
                >
                  {d.label.length > 12 ? `${d.label.substring(0, 10)}…` : d.label}
                </text>
              </g>
            )
          })}

          {/* Gradient Definitions */}
          <defs>
            <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-teal)" />
              <stop offset="100%" stopColor="var(--accent-teal-hover)" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  return null
}
