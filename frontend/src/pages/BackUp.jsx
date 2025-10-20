import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_URL } from '../api'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const STATUS_CLASS = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
}

export default function Backup() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])

  const fetchList = async () => {
    setLoading(true)
    try {
      const r = await axios.get(`${API_URL}/backups/list`, { withCredentials: true })
      setItems(r.data?.data ?? r.data ?? [])
    } catch (_err) {
      console.error('[Backup] fetchList error', _err)
      toast.error('Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [])

  const handleCreate = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_URL}/backups/create`, { type: 'manual' }, { withCredentials: true })
      toast.success('Backup created')
      fetchList()
    } catch (err) {
      console.error('[Backup] createManualBackup error', err)
      toast.error('Failed to create backup')
    } finally { setLoading(false) }
  }

  const handleDownload = (filename) => {
    const url = `${API_URL}/backups/download/${encodeURIComponent(filename)}`
    window.open(url, '_blank')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this backup?')) return
    setLoading(true)
    try {
      await axios.delete(`${API_URL}/backups/${id}`, { withCredentials: true })
      toast.success('Backup deleted')
      fetchList()
    } catch (err) {
      console.error('[Backup] deleteBackup error', err)
      toast.error('Failed to delete backup')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Backups</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate} disabled={loading} className="btn btn-primary">{loading ? 'Working…' : 'Create Backup'}</button>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white/95 p-4">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Filename</th>
                  <th>Size (MB)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-sm text-slate-500">No backups found</td></tr>
                ) : items.map((it) => (
                  <tr key={it.id || it.id}>
                    <td>{new Date(it.created_at || it.createdat).toLocaleString()}</td>
                    <td className="capitalize">{it.backup_type || it.backupType}</td>
                    <td className="truncate max-w-xs">{it.filename}</td>
                    <td>{it.file_size_mb ?? it.fileSizeMb ?? '-'}</td>
                    <td><span className={`inline-flex items-center gap-2 px-2 py-1 rounded ${STATUS_CLASS[it.backup_status || it.backupStatus] || 'bg-slate-100 text-slate-700'}`}>{it.backup_status || it.status}</span></td>
                    <td className="flex gap-2">
                      <button onClick={() => handleDownload(it.filename)} className="btn btn-ghost btn-sm">Download</button>
                      <button onClick={() => handleDelete(it.id ?? it.id)} className="btn btn-error btn-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

