import axios from 'axios'

const api = axios.create({ baseURL: '/' })

export interface QueryResponse {
  sql: string
  results: Record<string, unknown>[]
  tables_used: string[]
  requires_approval: boolean
  approval_reason?: string
  latency_ms: number
}

export interface ApproveResponse {
  executed: boolean
  results: Record<string, unknown>[]
  message: string
}

export interface SchemaColumn {
  name: string
  description: string
}

export interface SchemaTable {
  table_name: string
  description: string
  columns: SchemaColumn[]
}

export interface DatabaseConfig {
  key: string
  name: string
  url: string
}

export async function postQuery(question: string, dbKey: string): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>('/api/query', { question }, {
    headers: { 'x-database': dbKey }
  })
  return data
}

export async function postApprove(sql: string, approved: boolean, dbKey: string): Promise<ApproveResponse> {
  const { data } = await api.post<ApproveResponse>('/api/approve', { sql, approved }, {
    headers: { 'x-database': dbKey }
  })
  return data
}

export async function getSchema(dbKey: string): Promise<SchemaTable[]> {
  const { data } = await api.get<SchemaTable[]>('/api/schema', {
    headers: { 'x-database': dbKey }
  })
  return data
}

export async function getHealth(): Promise<Record<string, unknown>> {
  const { data } = await api.get<Record<string, unknown>>('/api/health')
  return data
}

export async function getDatabases(): Promise<DatabaseConfig[]> {
  const { data } = await api.get<DatabaseConfig[]>('/api/databases')
  return data
}

export async function addDatabase(key: string, name: string, url: string): Promise<{ status: string; message: string }> {
  const { data } = await api.post<{ status: string; message: string }>('/api/databases', { key, name, url })
  return data
}

export async function uploadDatabaseFile(name: string, file: File): Promise<{ status: string; database: DatabaseConfig }> {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('file', file)
  
  const { data } = await api.post<{ status: string; database: DatabaseConfig }>('/api/databases/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return data
}
