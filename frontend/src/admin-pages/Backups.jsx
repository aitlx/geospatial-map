import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { ShieldAlert, X } from 'lucide-react'
import { API_URL } from '../api'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

export default function Backups() {
  const [accessChecked, setAccessChecked] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [banner, setBanner] = useState(null)

  const V_MAINT = String(import.meta.env.VITE_BACKUPS_MAINTENANCE || '').toLowerCase() === 'true'
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => {
    // quick permission check (api: /user/me)
    let mounted = true
    ;(async () => {
      try {
        const res = await axios.get(`${API_URL}/user/me`, { withCredentials: true })
        if (!mounted) return
        // unwrap nested data wrappers (some responses have data.data.user)
        let wrapped = res.data
        let depth = 0
        while (wrapped && typeof wrapped === 'object' && wrapped.data && depth < 5) {
          wrapped = wrapped.data
          depth += 1
        }
        // normalize role id from possible shapes (roleID, roleid, roleId)
        const role = wrapped?.roleID ?? wrapped?.roleid ?? wrapped?.roleId ?? wrapped?.role ?? null
        setIsSuperAdmin(Number(role) === 1)
        setDebugInfo({ ok: true, status: res.status, data: res.data })
      } catch (err) {
        console.error('permission check error', err)
        const status = err.response?.status ?? null
        const data = err.response?.data ?? null
        setDebugInfo({ ok: false, status, data, message: err.message })
        setIsSuperAdmin(false)
      } finally {
        setAccessChecked(true)
      }
    })()
    return () => { mounted = false }
  }, [])

  const resetBanner = () => setBanner(null)

  const fetchBackups = useCallback(async () => {
    // fetch list of backups
    setLoading(true)
    try {
      resetBanner()
  const r = await axios.get(`${API_URL}/backups/list`, { withCredentials: true })
      setBackups(r.data?.data ?? r.data ?? [])
    } catch (err) {
      console.error('fetchBackups', err)
      setBanner({ type: 'error', message: 'Failed to load backups.' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (accessChecked && isSuperAdmin && !V_MAINT) fetchBackups() }, [accessChecked, isSuperAdmin, V_MAINT, fetchBackups])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleDownload = async (backup) => {
    if (!backup?.id) return
    try {
      const downloadEndpoint = backup.downloadUrl ?? `/api/backups/${backup.id}/download`
      const response = await axios.get(downloadEndpoint, { responseType: 'blob', withCredentials: true })
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backup.originalName || backup.filename || `backup-${backup.id}.tar.gz`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setBanner({ type: 'success', message: 'Backup download started.' })
    } catch (err) {
      console.error('downloadBackup', err)
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to download backup.' })
    }
  }

  const createBackup = async () => {
    // create manual backup (superadmin only). keeps 'creating' state separate
    try {
      resetBanner()
      setCreating(true)
      // POST to request a manual backup. Many systems will enqueue a job and return 202 + job info.
      const r = await axios.post(`${API_URL}/backups/create`, {}, { withCredentials: true })
      const created = r.data?.data ?? r.data ?? null
      if (r.status === 201 && created && created.id) {
        // server created immediately and returned resource
        setBackups(prev => [created, ...(prev || [])])
        setBanner({ type: 'success', message: 'Backup created successfully.' })
      } else if (r.status === 202) {
        // accepted: show message and refresh list after short delay
        setBanner({ type: 'success', message: 'Backup creation queued. Refreshing shortly...' })
        setTimeout(() => fetchBackups(), 2000)
      } else {
        // fallback: try to refresh list
        setBanner({ type: 'success', message: 'Backup creation requested. Refreshing list...' })
        await fetchBackups()
      }
    } catch (err) {
      console.error('createBackup', err)
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to create backup.' })
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async (backup) => {
    // confirm and delete backup
    if (!backup?.id) return
    if (!confirm(`Delete backup ${backup.filename || backup.originalName || backup.id}? This cannot be undone.`)) return
    try {
      resetBanner()
      await axios.delete(`/api/backups/${backup.id}`, { withCredentials: true })
      setBanner({ type: 'success', message: 'Backup deleted permanently.' })
      await fetchBackups()
    } catch (err) {
      console.error('deleteBackup', err)
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to delete backup.' })
    }
  }

  // upload handler for manual backup files
  const [uploading, setUploading] = useState(false)
  const uploadBackup = async () => {
    if (!uploadFile) return setBanner({ type: 'error', message: 'No file selected.' })
    try {
      resetBanner()
      setUploading(true)
      setUploadProgress(0)
      const form = new FormData()
  form.append('backupFile', uploadFile)
      const r = await axios.post(`${API_URL}/backups/upload`, form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(pct)
        }
      })
      const created = r.data?.data ?? r.data ?? null
      setBanner({ type: 'success', message: 'Backup uploaded successfully.' })
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadProgress(0)
      // refresh list or prepend created item
      if (created && created.id) setBackups(prev => [created, ...(prev || [])])
      else await fetchBackups()
    } catch (err) {
      console.error('uploadBackup', err)
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to upload backup.' })
    } finally {
      setUploading(false)
    }
  }

  if (!accessChecked) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center p-6 text-slate-600">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          <span className="loading loading-spinner loading-sm text-emerald-400" aria-hidden="true" />
          Verifying access…
        </div>
      </section>
    )
  }

  if (!isSuperAdmin) {
    return (
      <section className="p-6 text-slate-800">
        <div className="max-w-3xl space-y-6">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              <ShieldAlert className="h-4 w-4 text-emerald-500" />
              Access Restricted
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-slate-900">Backups &amp; recovery tools are limited to super administrators.</p>
              <p className="mt-2 text-slate-500">Coordinate with a super administrator if you need the latest archive or require disaster recovery assistance.</p>
            </div>
            {/* diagnostic panel to help find why access is restricted */}
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              <div className="mb-2">/user/me result</div>
              <pre className="whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(debugInfo, null, 2)}</pre>
              <div className="mt-2">
                <button className="btn btn-sm btn-ghost mr-2" onClick={async () => {
                  setAccessChecked(false)
                  // re-run permission check
                    try {
                      const r = await axios.get(`${API_URL}/user/me`, { withCredentials: true })
                      // unwrap nested data like above
                      let w = r.data
                      let d = 0
                      while (w && typeof w === 'object' && w.data && d < 5) { w = w.data; d += 1 }
                      const role2 = w?.roleID ?? w?.roleid ?? w?.roleId ?? w?.role ?? null
                      setIsSuperAdmin(Number(role2) === 1)
                      setDebugInfo({ ok: true, status: r.status, data: r.data })
                    } catch (e) {
                    setDebugInfo({ ok: false, status: e.response?.status ?? null, data: e.response?.data ?? null, message: e.message })
                    setIsSuperAdmin(false)
                  } finally { setAccessChecked(true) }
                }}>Retry</button>
                <span className="text-xs text-slate-500">If this shows 401/403, your session cookie may not be sent to the API or the token expired.</span>
              </div>
            </div>
          </header>
        </div>
      </section>
    )
  }

  if (V_MAINT && !isSuperAdmin) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-white via-emerald-50 to-teal-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl space-y-4 rounded-3xl border border-emerald-200/60 bg-white/95 px-8 py-14 text-center shadow-lg shadow-emerald-900/5">
          <h1 className="text-2xl font-semibold text-emerald-900 sm:text-3xl">Backups maintenance in progress</h1>
          <p className="text-sm text-emerald-700 sm:text-base">The municipal backup archive is temporarily offline while we streamline the workflow. Existing exports remain safe and accessible to the engineering team.</p>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-500">Please check back soon</p>
        </div>
      </section>
    )
  }

  return (
    <section className="p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl font-semibold">Backups</h1>
            <p className="text-sm text-slate-500">Manage database exports and archives.</p>
          </div>
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 justify-end">
            {isSuperAdmin && (
              <>
                <button
                  className="btn btn-primary btn-sm sm:btn"
                  onClick={() => setShowUploadModal(true)}
                  aria-haspopup="dialog"
                >
                  Upload Backup
                </button>
                <button
                  className="btn btn-ghost btn-sm sm:btn"
                  onClick={createBackup}
                  disabled={creating}
                  aria-disabled={creating}
                >
                  {creating ? 'Creating…' : 'Create (Queue)'}
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm sm:btn" onClick={() => fetchBackups()} aria-label="Refresh backups list">Refresh</button>
          </div>
        </header>

        {banner && (
          <div
            role="status"
            aria-live={banner.type === 'success' ? 'polite' : 'assertive'}
            className={`mb-4 rounded-md border p-3 ${banner.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
          >
            {banner.message}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border bg-white p-3">
          {!isMobile ? (
            <table className="table w-full text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Filename</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-6">Loading…</td></tr>
                ) : backups.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-sm text-slate-500">No backups found</td></tr>
                ) : backups.map(b => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap">{new Date(b.created_at || b.createdAt).toLocaleString()}</td>
                    <td className="capitalize">{b.backup_type || b.backupType}</td>
                    <td className="truncate max-w-xs" title={b.originalName || b.filename}>{b.filename || b.originalName}</td>
                    <td className="text-right">{b.file_size_mb ? `${b.file_size_mb} MB` : (b.size ? formatBytes(b.size) : '—')}</td>
                    <td>
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${b.backup_status === 'completed' ? 'bg-emerald-100 text-emerald-800' : b.backup_status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                        {b.backup_status || b.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleDownload(b)} className="btn btn-outline btn-sm">Download</button>
                        <button onClick={() => confirmDelete(b)} className="btn btn-error btn-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-6">Loading…</div>
              ) : backups.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">No backups found</div>
              ) : backups.map(b => (
                <div key={b.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{new Date(b.created_at || b.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-slate-500">{b.backup_type || b.backupType} · {b.filename || b.originalName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-800">{b.file_size_mb ? `${b.file_size_mb} MB` : (b.size ? formatBytes(b.size) : '—')}</div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button onClick={() => handleDownload(b)} className="btn btn-outline btn-xs">Download</button>
                        <button onClick={() => confirmDelete(b)} className="btn btn-error btn-xs">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
  {/* upload modal rendered at the root of this section */}
        <UploadModal
          open={showUploadModal}
          onClose={() => { setShowUploadModal(false); setUploadFile(null); setUploadProgress(0) }}
          onFileSelect={(f) => setUploadFile(f)}
          onUpload={uploadBackup}
          file={uploadFile}
          progress={uploadProgress}
          uploading={uploading}
        />
      </div>
    </section>
  )
}

// Upload modal component (kept outside the page component)
function UploadModal({ open, onClose, onFileSelect, onUpload, file, progress, uploading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-slate-50 to-emerald-100 px-6 py-5">
          <div className="flex items-start gap-3 text-slate-800">
            <div>
              <h2 className="text-xl font-semibold">Upload Backup</h2>
              <p className="text-sm text-slate-600">Manual upload for super administrators</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-700"
            disabled={uploading}
            aria-label="Close upload modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-6 py-6 text-slate-800">
          <div>
            <p className="text-sm text-slate-500">Select a backup archive to upload. Allowed formats: .sql, .gz, .zip, .tar.gz</p>
          </div>
          <div>
            <input type="file" accept=".sql,.gz,.zip,.tar,.tar.gz" onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)} className="file-input file-input-bordered w-full" />
            {file && (
              <div className="mt-2 text-sm text-slate-600">Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})</div>
            )}
            {uploading && (
              <div className="mt-3">
                <div className="h-2 w-full rounded bg-slate-100">
                  <div className="h-2 rounded bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-500">Uploading: {progress}%</div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
              onClick={onUpload}
              disabled={!file || uploading}
            >
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}