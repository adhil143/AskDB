import { useState, useEffect } from 'react'
import ResultsChart from './components/ResultsChart'
import ResultsTable from './components/ResultsTable'
import Login from './components/Login'
import ApprovalModal from './components/ApprovalModal'
import AddDatabaseModal from './components/AddDatabaseModal'
import { getSchema, postApprove, type SchemaTable, type QueryResponse, postQuery, postApprove as approveApi, getDatabases, addDatabase, uploadDatabaseFile, type DatabaseConfig } from './api'

interface HistoryItem {
  question: string
  sql: string
  results: Record<string, unknown>[]
  latencyMs: number
  tablesUsed: string[]
  timestamp: string
}

const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Play a dual chime (two quick pleasant notes)
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      osc.type = 'sine'
      osc.frequency.value = freq
      
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.03) // smooth attack
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration) // decay
      
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    
    const now = ctx.currentTime
    playNote(523.25, now, 0.25) // C5
    playNote(659.25, now + 0.06, 0.35) // E5
  } catch (err) {
    console.error('Failed to play success sound:', err)
  }
}


export default function App() {
  const [schema, setSchema] = useState<SchemaTable[]>([])
  const [activeTables, setActiveTables] = useState<string[]>([])
  
  // Workspace states
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [selectedDb, setSelectedDb] = useState('olist_db')
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set(['fact_orders']))
  const [databases, setDatabases] = useState<DatabaseConfig[]>([])
  const [addDbModalOpen, setAddDbModalOpen] = useState(false)

  // Query states
  const [inputQuery, setInputQuery] = useState('Show the top 5 customers by total spending, listing their names and cities.')
  const [generatedSql, setGeneratedSql] = useState('')
  const [queryResults, setQueryResults] = useState<Record<string, unknown>[]>([])
  const [latency, setLatency] = useState(0)
  const [loading, setLoading] = useState(false)
  const [autoExecute, setAutoExecute] = useState(true)
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('table')
  const [lastUpdated, setLastUpdated] = useState('--:--')

  // Approval flow states
  const [pendingApproval, setPendingApproval] = useState<QueryResponse | null>(null)
  
  // Navigation Modal states
  const [docOpen, setDocOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Auth state
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('user'))

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' ? 'dark' : 'light'
  })

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('query_history')
    return saved ? JSON.parse(saved) : []
  })

  // Sync theme class to document body
  useEffect(() => {
    document.body.className = `${theme}-theme`
    localStorage.setItem('theme', theme)
  }, [theme])

  // Fetch databases on mount/login
  useEffect(() => {
    if (user) {
      getDatabases()
        .then(setDatabases)
        .catch((err) => console.error('Failed to load databases:', err))
    }
  }, [user])

  // Fetch schema when active database changes
  useEffect(() => {
    if (user && selectedDb) {
      setSchema([])
      getSchema(selectedDb)
        .then((s) => {
          setSchema(s)
          if (s && s.length > 0) {
            setExpandedTables(new Set([s[0].table_name]))
          } else {
            setExpandedTables(new Set())
          }
        })
        .catch((err) => console.error('Failed to load schema:', err))
    }
  }, [user, selectedDb])

  const handleLogin = (username: string) => {
    setUser(username)
    localStorage.setItem('user', username)
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
    setInputQuery('')
    setGeneratedSql('')
    setQueryResults([])
    setHistory([])
    localStorage.removeItem('query_history')
  }

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(tableName)) next.delete(tableName)
      else next.add(tableName)
      return next
    })
  }

  const handleGenerateSql = async () => {
    const q = inputQuery.trim()
    if (!q || loading) return

    setLoading(true)
    setQueryResults([])
    
    try {
      const response = await postQuery(q, selectedDb)
      setGeneratedSql(response.sql)
      setActiveTables(response.tables_used)
      setLatency(response.latency_ms)
      
      const now = new Date()
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setLastUpdated(timeStr)
      
      playSuccessSound()

      if (response.requires_approval) {
        setPendingApproval(response)
      } else if (autoExecute) {
        setQueryResults(response.results)
        
        // Add to history
        addToHistory(q, response.sql, response.results, response.latency_ms, response.tables_used)
      }
    } catch (err: any) {
      alert(`Error generating SQL: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRunQuery = async () => {
    if (!generatedSql || loading) return

    setLoading(true)
    try {
      // Direct SQL execution on the backend
      // We can use the /api/approve route by passing approved=true
      // This runs _execute_sql on the backend
      const response = await approveApi(generatedSql, true, selectedDb)
      setQueryResults(response.results)
      
      const now = new Date()
      setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      
      addToHistory(inputQuery, generatedSql, response.results, latency, activeTables)
    } catch (err: any) {
      alert(`SQL Execution Error: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const addToHistory = (q: string, sql: string, results: Record<string, unknown>[], lat: number, tables: string[]) => {
    const now = new Date()
    const item: HistoryItem = {
      question: q,
      sql: sql,
      results: results,
      latencyMs: lat,
      tablesUsed: tables,
      timestamp: now.toLocaleString(),
    }
    setHistory(prev => {
      const next = [item, ...prev.slice(0, 19)] // Limit to 20 history items
      localStorage.setItem('query_history', JSON.stringify(next))
      return next
    })
  }

  const handleLoadHistory = (item: HistoryItem) => {
    setInputQuery(item.question)
    setGeneratedSql(item.sql)
    setQueryResults(item.results)
    setLatency(item.latencyMs)
    setActiveTables(item.tablesUsed)
    setHistoryOpen(false)
  }

  const handleApprove = async (approved: boolean) => {
    if (!pendingApproval) return
    try {
      const result = await approveApi(pendingApproval.sql, approved, selectedDb)
      setQueryResults(result.results)
      addToHistory(inputQuery, pendingApproval.sql, result.results, latency, activeTables)
    } catch (err) {
      console.error('Approval failed:', err)
    } finally {
      setPendingApproval(null)
    }
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>
      {/* 1. Header Bar */}
      <header style={{
        height: '50px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 800,
            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
          }}>
            S
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
            SYNTAX
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>
            v3.1
          </span>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <button 
            onClick={() => {
              setInputQuery('')
              setGeneratedSql('')
              setQueryResults([])
            }}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            New Query
          </button>
          
          <button 
            onClick={() => setDocOpen(true)}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Documentation
          </button>

          <button 
            onClick={() => setHistoryOpen(true)}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            History
          </button>

          <button 
            onClick={() => setSettingsOpen(true)}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Settings
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebars Container */}
        <div style={{ display: 'flex', height: '100%' }}>
          {/* Thin Icon sidebar */}
          <div style={{
            width: '48px',
            background: 'var(--bg-tertiary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 0',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <button 
                onClick={() => setWorkspaceOpen(!workspaceOpen)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: workspaceOpen ? 'var(--accent-blue-light)' : 'transparent',
                  color: workspaceOpen ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                📁
              </button>
              <button 
                onClick={() => setDocOpen(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
                title="Documentation"
              >
                📄
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <button 
                onClick={() => setDocOpen(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
                title="Guide"
              >
                ❓
              </button>
              <button 
                onClick={() => setSettingsOpen(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
                title="Settings"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Collapsible Workspace Table Tree */}
          {workspaceOpen && (
            <div style={{
              width: '240px',
              background: 'var(--bg-primary)',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideIn 0.15s ease-out'
            }}>
              {/* Workspace Header */}
              <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Workspace</span>
                <button 
                  onClick={() => setWorkspaceOpen(false)}
                  style={{ background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px' }}
                >
                  ◀
                </button>
              </div>

              {/* DB Selector */}
              <div style={{ padding: '12px 16px' }}>
                <div style={{ position: 'relative' }}>
                   <select
                    value={selectedDb}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setAddDbModalOpen(true)
                      } else {
                        setSelectedDb(e.target.value)
                      }
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '8px 12px 8px 30px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                    }}
                  >
                    {databases.length === 0 ? (
                      <option value="olist_db">olist_db</option>
                    ) : (
                      databases.map(db => (
                        <option key={db.key} value={db.key}>{db.name}</option>
                      ))
                    )}
                    <option value="ADD_NEW">➕ Register / Upload DB...</option>
                  </select>
                  <span style={{
                    position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '12px', pointerEvents: 'none'
                  }}>🗄️</span>
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '9px', color: 'var(--text-secondary)', pointerEvents: 'none'
                  }}>▼</span>
                </div>
              </div>

              {/* Schema tree view list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px 8px' }}>
                {schema.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Loading schema tree...
                  </div>
                ) : (
                  schema.map((table) => {
                    const isOpen = expandedTables.has(table.table_name)
                    const isActive = activeTables.includes(table.table_name)
                    
                    return (
                      <div key={table.table_name} style={{ marginBottom: '2px' }}>
                        {/* Table header trigger */}
                        <div 
                          onClick={() => toggleTable(table.table_name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: isActive ? 'var(--accent-blue-light)' : 'transparent',
                            color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                            fontSize: '12.5px',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', width: '10px' }}>
                            {isOpen ? '▼' : '▶'}
                          </span>
                          <span>{table.table_name.startsWith('fact') ? '📊' : '📋'}</span>
                          <span style={{ fontWeight: 500 }}>{table.table_name}</span>
                        </div>

                        {/* Column sub-tree */}
                        {isOpen && (
                          <div style={{
                            marginLeft: '22px',
                            borderLeft: '1px solid var(--border-color)',
                            paddingLeft: '10px',
                            marginTop: '2px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}>
                            {table.columns.map((col) => (
                              <div 
                                key={col.name} 
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  padding: '2px 0'
                                }}
                                title={col.description}
                              >
                                <span style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Middle Pane: Query Builder Input */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-color)',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Input: Natural Language Query</h2>
          
          <textarea
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Type your database question in plain English here..."
            disabled={loading}
            style={{
              flex: 1,
              minHeight: '260px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              marginBottom: '16px',
              transition: 'border-color 0.15s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-blue)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Auto-execute generated SQL</span>
            </label>
          </div>

          <button
            onClick={handleGenerateSql}
            disabled={loading || !inputQuery.trim()}
            style={{
              background: loading || !inputQuery.trim() ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
              color: loading || !inputQuery.trim() ? 'var(--text-secondary)' : '#ffffff',
              borderRadius: '8px',
              padding: '14px',
              fontWeight: 600,
              fontSize: '14px',
              letterSpacing: '0.03em',
              transition: 'all 0.15s',
              cursor: loading || !inputQuery.trim() ? 'not-allowed' : 'pointer',
              boxShadow: loading || !inputQuery.trim() ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.25)'
            }}
            onMouseEnter={(e) => { if (!loading && inputQuery.trim()) e.currentTarget.style.background = 'var(--accent-blue-hover)' }}
            onMouseLeave={(e) => { if (!loading && inputQuery.trim()) e.currentTarget.style.background = 'var(--accent-blue)' }}
          >
            {loading ? 'GENERATING...' : 'GENERATE SQL'}
          </button>
        </div>

        {/* 4. Right Pane: Code Preview & Interactive Results */}
        <div style={{
          flex: 1.2,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          overflow: 'hidden'
        }}>
          {/* Top Panel: SQL Code Pre-execution */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '1px solid var(--border-color)',
            padding: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Generated SQL Query (Pre-execution)</span>
              
              <button
                onClick={handleRunQuery}
                disabled={loading || !generatedSql}
                style={{
                  background: loading || !generatedSql ? 'transparent' : 'var(--accent-blue)',
                  color: loading || !generatedSql ? 'var(--text-secondary)' : '#ffffff',
                  border: loading || !generatedSql ? '1px solid var(--border-color)' : 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontWeight: 600,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: loading || !generatedSql ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !generatedSql ? 'none' : '0 2px 6px rgba(59, 130, 246, 0.2)'
                }}
              >
                <span>▷</span> Run
              </button>
            </div>

            {/* SQL Block */}
            <div style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px',
              overflowY: 'auto',
            }}>
              {generatedSql ? (
                <pre style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12.5px',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}>
                  {generatedSql}
                </pre>
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontStyle: 'italic',
                }}>
                  SQL will be compiled here once query is generated.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Panel: SQL Execution Results & Charts */}
          <div style={{
            flex: 1.2,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>SQL Execution Results</span>
              
              {/* Tab Toggles */}
              {queryResults.length > 0 && (
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  padding: '2px',
                  display: 'flex',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setActiveTab('table')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: activeTab === 'table' ? 'var(--card-bg)' : 'transparent',
                      color: activeTab === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📋 Table
                  </button>
                  <button
                    onClick={() => setActiveTab('chart')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: activeTab === 'chart' ? 'var(--card-bg)' : 'transparent',
                      color: activeTab === 'chart' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📊 Chart
                  </button>
                </div>
              )}
            </div>

            {/* Results display container */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {queryResults.length > 0 ? (
                activeTab === 'chart' ? (
                  <ResultsChart results={queryResults} />
                ) : (
                  <ResultsTable results={queryResults} />
                )
              ) : (
                <div style={{
                  height: '100%',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontStyle: 'italic',
                }}>
                  {loading ? 'Running SQL query...' : 'Execute query to preview results and charts.'}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 5. Footer Bar */}
      <footer style={{
        height: '32px',
        background: 'var(--bg-tertiary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
          <span>Connected to {selectedDb}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>Latency: {latency}ms</span>
          <span>Last updated: {lastUpdated}</span>
        </div>
      </footer>

      {/* ================= MODAL OVERLAYS ================= */}

      {/* Documentation Modal */}
      {docOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
            padding: '24px', maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: 'var(--card-shadow)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>SYNTAX Documentation Guide</h3>
              <button onClick={() => setDocOpen(false)} style={{ background: 'transparent', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', lineHeight: 1.6 }}>
              <p>
                <strong>AskDB (SYNTAX)</strong> uses a Retrieval-Augmented Generation (RAG) schema retriever combined with a local Ollama LLM to compile natural language into optimized SQL.
              </p>
              
              <h4 style={{ fontWeight: 600, fontSize: '13px', marginTop: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                💡 Query Tips & Syntaxes:
              </h4>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>Time aggregations:</strong> Always request SQLite format operations like `strftime('%Y', created_at)` for sorting dates.</li>
                <li><strong>Aliases:</strong> Always qualify your table fields with aliases (e.g. `fo.order_id` in joins).</li>
                <li><strong>Dividing:</strong> Use `NULLIF(val, 0)` to prevent runtime division-by-zero crashes.</li>
              </ul>

              <h4 style={{ fontWeight: 600, fontSize: '13px', marginTop: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                📋 Copy-paste Examples:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  "Show the total revenue by product category.",
                  "Who are the top 10 sellers by total revenue?",
                  "What percentage of orders were canceled in each state?",
                  "What is the average review score per product category?"
                ].map((eg, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px',
                    border: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', fontSize: '11.5px'
                  }}>
                    <span>{eg}</span>
                    <button 
                      onClick={() => {
                        setInputQuery(eg)
                        setDocOpen(false)
                      }}
                      style={{ background: 'var(--accent-blue)', color: '#ffffff', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
            padding: '24px', maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: 'var(--card-shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>SYNTAX Settings</h3>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'transparent', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              {/* Theme Toggle Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>APPEARANCE THEME</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                  style={{
                    width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 10px', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="light">☀️ Light Theme</option>
                  <option value="dark">🌙 Dark Theme</option>
                </select>
              </div>

              {/* DB URL Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>ACTIVE DATABASE CONNECTION</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                  {databases.find(db => db.key === selectedDb)?.url || 'sqlite:///./data/olist.db'}
                </span>
              </div>

              {/* Add Database shortcut inside settings */}
              <button
                onClick={() => {
                  setSettingsOpen(false)
                  setAddDbModalOpen(true)
                }}
                style={{
                  background: 'var(--accent-blue-light)', color: 'var(--accent-blue)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  borderRadius: '6px', padding: '10px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                  marginTop: '4px', textAlign: 'center'
                }}
              >
                ➕ Register / Upload New Database
              </button>

              {/* Logout inside settings */}
              <button
                onClick={() => {
                  handleLogout()
                  setSettingsOpen(false)
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px', padding: '10px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                  marginTop: '10px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
              >
                Sign Out / Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
            padding: '24px', maxWidth: '550px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: 'var(--card-shadow)', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Query History</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px' }}>
                  {history.length} logged
                </span>
              </div>
              <button onClick={() => setHistoryOpen(false)} style={{ background: 'transparent', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No queries in history log.
                </div>
              ) : (
                history.map((item, idx) => (
                  <div key={idx} style={{
                    border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px',
                    display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-primary)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.question}</span>
                      <button 
                        onClick={() => handleLoadHistory(item)}
                        style={{
                          background: 'var(--accent-blue)', color: '#ffffff', borderRadius: '4px',
                          fontSize: '11px', padding: '3px 10px', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Load
                      </button>
                    </div>
                    
                    <pre style={{
                      margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-secondary)',
                      padding: '6px 10px', borderRadius: '4px', color: 'var(--text-secondary)', overflowX: 'auto'
                    }}>
                      {item.sql}
                    </pre>
                    
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', alignSelf: 'flex-end' }}>
                      {item.timestamp}
                    </div>
                  </div>
                ))
              )}

              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([])
                    localStorage.removeItem('query_history')
                  }}
                  style={{
                    alignSelf: 'center', background: 'transparent', color: 'var(--accent-red)',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginTop: '8px'
                  }}
                >
                  Clear History Log
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Human Approval Modal */}
      {pendingApproval && (
        <ApprovalModal
          sql={pendingApproval.sql}
          reason={pendingApproval.approval_reason || ''}
          onApprove={() => handleApprove(true)}
          onReject={() => {
            setPendingApproval(null)
          }}
        />
      )}
      {/* Register & Upload Database Modal */}
      {addDbModalOpen && (
        <AddDatabaseModal
          onClose={() => setAddDbModalOpen(false)}
          onDatabaseAdded={(newDbKey) => {
            getDatabases()
              .then((dbs) => {
                setDatabases(dbs)
                setSelectedDb(newDbKey)
                setAddDbModalOpen(false)
              })
              .catch((err) => console.error('Failed to load databases:', err))
          }}
        />
      )}
    </div>
  )
}
