import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { addDatabase, uploadDatabaseFile } from '../api'

interface Props {
  onClose: () => void
  onDatabaseAdded: (newDbKey: string) => void
}

export default function AddDatabaseModal({ onClose, onDatabaseAdded }: Props) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload')

  // Connection URL state
  const [dbKey, setDbKey] = useState('')
  const [dbName, setDbName] = useState('')
  const [dbUrl, setDbUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  // Upload File state
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-generate key from name
  const handleNameChange = (val: string) => {
    setDbName(val)
    const sanitizedKey = val
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
    setDbKey(sanitizedKey)
  }

  // Handle URL Form Submit
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dbKey.trim() || !dbName.trim() || !dbUrl.trim() || urlLoading) return

    setUrlLoading(true)
    setUrlError(null)

    try {
      await addDatabase(dbKey.trim(), dbName.trim(), dbUrl.trim())
      onDatabaseAdded(dbKey.trim())
    } catch (err: any) {
      setUrlError(err.response?.data?.detail || err.message || 'Failed to register connection URL.')
    } finally {
      setUrlLoading(false)
    }
  }

  // Handle File Drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.db')) {
        setUploadFile(file)
        if (!uploadName) {
          // Auto-fill display name from filename
          const baseName = file.name.replace(/\.db$/, '').replace(/[_-]/g, ' ')
          setUploadName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
        }
      } else {
        setUploadError('Only SQLite database files (.db) are supported.')
      }
    }
  }

  // Handle File Input Selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.db')) {
        setUploadFile(file)
        if (!uploadName) {
          const baseName = file.name.replace(/\.db$/, '').replace(/[_-]/g, ' ')
          setUploadName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
        }
      } else {
        setUploadError('Only SQLite database files (.db) are supported.')
      }
    }
  }

  // Handle Upload Form Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadName.trim() || !uploadFile || uploadLoading) return

    setUploadLoading(true)
    setUploadError(null)

    try {
      const response = await uploadDatabaseFile(uploadName.trim(), uploadFile)
      onDatabaseAdded(response.database.key)
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || err.message || 'Failed to upload SQLite file.')
    } finally {
      setUploadLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
        padding: '24px', maxWidth: '500px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: 'var(--card-shadow)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Register & Upload Custom Database</h3>
          <button onClick={onClose} style={{ background: 'transparent', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
          borderRadius: '8px', padding: '4px', gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              background: activeTab === 'upload' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            📁 Upload SQLite File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              background: activeTab === 'url' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'url' ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            🔗 Connection URL
          </button>
        </div>

        {/* Upload Form Tab */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>DATABASE DISPLAY NAME</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. Chinook Sales"
                required
                style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>SQLITE FILE (.DB)</label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                  background: isDragOver ? 'var(--accent-teal-light)' : 'var(--bg-secondary)',
                  borderRadius: '8px', padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".db"
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '24px' }}>🗄️</span>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {uploadFile ? uploadFile.name : 'Drag & drop your database file here, or browse'}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                  {uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Supports SQLite database files (.db) only'}
                </span>
              </div>
            </div>

            {uploadError && (
              <div style={{ color: 'var(--accent-red)', fontSize: '12px', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                ⚠️ {uploadError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadLoading || !uploadFile || !uploadName.trim()}
                style={{
                  flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  background: uploadLoading || !uploadFile || !uploadName.trim() ? 'var(--bg-tertiary)' : 'var(--accent-teal)',
                  color: uploadLoading || !uploadFile || !uploadName.trim() ? 'var(--text-secondary)' : '#ffffff',
                  cursor: uploadLoading || !uploadFile || !uploadName.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {uploadLoading ? 'Uploading...' : 'Upload & Register'}
              </button>
            </div>
          </form>
        )}

        {/* Connection URL Tab */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>DATABASE NAME</label>
              <input
                type="text"
                value={dbName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Sales DB"
                required
                style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>DATABASE KEY (UNIQUE ID)</label>
              <input
                type="text"
                value={dbKey}
                onChange={(e) => setDbKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                placeholder="e.g. sales_db"
                required
                style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>CONNECTION URL (SQLAlchemy syntax)</label>
              <input
                type="text"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="e.g. sqlite:///./data/chinook.db"
                required
                style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            {urlError && (
              <div style={{ color: 'var(--accent-red)', fontSize: '12px', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                ⚠️ {urlError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={urlLoading || !dbKey.trim() || !dbName.trim() || !dbUrl.trim()}
                style={{
                  flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  background: urlLoading || !dbKey.trim() || !dbName.trim() || !dbUrl.trim() ? 'var(--bg-tertiary)' : 'var(--accent-teal)',
                  color: urlLoading || !dbKey.trim() || !dbName.trim() || !dbUrl.trim() ? 'var(--text-secondary)' : '#ffffff',
                  cursor: urlLoading || !dbKey.trim() || !dbName.trim() || !dbUrl.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {urlLoading ? 'Registering...' : 'Register Connection'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
