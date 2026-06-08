import { useState } from 'react'

interface Props {
  results: Record<string, unknown>[]
}

type SortDir = 'asc' | 'desc'

export default function ResultsTable({ results }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  if (!results || results.length === 0) return null

  const columns = Object.keys(results[0])

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = [...results].sort((a, b) => {
    if (!sortCol) return 0
    const av = a[sortCol]
    const bv = b[sortCol]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 18px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        gap: '8px',
      }}>
        <span style={{ color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Results Table
        </span>
        <span>·</span>
        <span>{results.length} row{results.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{columns.length} column{columns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: sortCol === col ? 'var(--accent-teal)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '11px',
                  }}
                >
                  {col}
                  {sortCol === col && (
                    <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                }}
              >
                {columns.map((col) => {
                  const val = row[col]
                  const isNum = typeof val === 'number'
                  const isNull = val === null || val === undefined
                  return (
                    <td
                      key={col}
                      style={{
                        padding: '9px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        color: isNull
                          ? 'var(--text-secondary)'
                          : isNum
                          ? 'var(--accent-teal)'
                          : 'var(--text-primary)',
                        fontStyle: isNull ? 'italic' : 'normal',
                        whiteSpace: 'nowrap',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={isNull ? 'NULL' : String(val)}
                    >
                      {isNull ? 'NULL' : String(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
