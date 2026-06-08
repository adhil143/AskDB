import { useState } from 'react'

interface Props {
  onLogin: (username: string) => void
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const u = username.trim()
    const p = password.trim()

    if (!u || !p) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)

    // Simulating a minor network delay for premium feedback feel
    setTimeout(() => {
      if (u === 'admin' && p === 'admin') {
        onLogin(u)
      } else {
        setError('Invalid username or password. (Hint: use admin / admin)')
        setLoading(false)
      }
    }, 800)
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #020617 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative Blur Spheres */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(53, 184, 165, 0.15)',
        filter: 'blur(80px)',
        top: '10%',
        left: '15%',
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.12)',
        filter: 'blur(100px)',
        bottom: '10%',
        right: '15%',
      }} />

      {/* Login Card */}
      <form 
        onSubmit={handleSubmit}
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '40px 32px',
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '12px',
            background: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
            marginBottom: '8px',
          }}>
            S
          </div>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '0.01em',
            margin: 0,
          }}>
            AskDB Sign In
          </h2>
          <p style={{
            fontFamily: 'var(--font-sans)',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
            margin: 0,
          }}>
            Enter your credentials to access the analyst portal
          </p>
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              autoComplete="username"
              required
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)' }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#fca5a5',
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        {/* Credentials Hint */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '11px',
          color: '#93c5fd',
          textAlign: 'center',
        }}>
          💡 Quick Access Hint: Use <strong>admin</strong> / <strong>admin</strong>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '8px',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#2563eb' }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#3b82f6' }}
        >
          {loading ? 'Verifying...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
