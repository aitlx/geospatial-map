import { Bell, Map, Edit, LogOut, ChevronDown, ArrowLeft } from "lucide-react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { getGeospatialPathForRole } from "../utils/viewRoutes.js"
import { useTranslation } from "../hooks/useTranslation.js"

const STATUS_BADGES = {
  verified: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-rose-100 text-rose-700",
  reminder: "bg-sky-100 text-sky-700",
}
const RECORD_LABELS = {
  barangay_yields: "Barangay yield record",
  crop_prices: "Crop price record",
}

const ROLE_LABELS = {
  1: "Super admin",
  2: "Admin",
  3: "Technician",
}

const PAGE_TITLES = {
  dashboard: {
    titleKey: "header.pages.dashboard.title",
    titleFallback: "Dashboard overview",
    subtitleKey: "header.pages.dashboard.subtitle",
    subtitleFallback: "Highlights from your assigned barangays.",
  },
  "yield-inputs": {
    titleKey: "header.pages.yieldInputs.title",
    titleFallback: "Yield submissions",
    subtitleKey: "header.pages.yieldInputs.subtitle",
    subtitleFallback: "Log and review barangay harvest data.",
  },
  market: {
    titleKey: "header.pages.market.title",
    titleFallback: "Market prices",
    subtitleKey: "header.pages.market.subtitle",
    subtitleFallback: "Check the latest crop price trends.",
  },
  profile: {
    titleKey: "header.pages.profile.title",
    titleFallback: "Your profile",
    subtitleKey: "header.pages.profile.subtitle",
    subtitleFallback: "View account details and contact info.",
  },
  "edit-profile": {
    titleKey: "header.pages.editProfile.title",
    titleFallback: "Edit profile",
    subtitleKey: "header.pages.editProfile.subtitle",
    subtitleFallback: "Update your information before your next field visit.",
  },
  settings: {
    titleKey: "header.pages.settings.title",
    titleFallback: "Account settings",
    subtitleKey: "header.pages.settings.subtitle",
    subtitleFallback: "Adjust preferences and notification rules.",
  },
  "change-password": {
    titleKey: "header.pages.changePassword.title",
    titleFallback: "Security",
    subtitleKey: "header.pages.changePassword.subtitle",
    subtitleFallback: "Keep your credentials up to date.",
  },
  "geospatial-map": {
    titleKey: "header.pages.map.title",
    titleFallback: "Geospatial map",
    subtitleKey: "header.pages.map.subtitle",
    subtitleFallback: "Inspect barangay data on the map.",
  },
}

const formatRecordLabel = (recordType) => {
  if (!recordType) return null
  const key = recordType.toLowerCase()
  if (RECORD_LABELS[key]) {
    return RECORD_LABELS[key]
  }
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

const STATUS_LABEL_KEYS = {
  verified: "status.verified",
  pending: "status.pending",
  rejected: "status.rejected",
  reminder: "status.reminder",
}

const STATUS_LABEL_FALLBACK = {
  verified: "Verified",
  pending: "Pending",
  rejected: "Rejected",
  reminder: "Reminder",
}

const DEFAULT_AVATAR = "/default-profile.webp"

const formatRelativeTime = (value, translate) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / (1000 * 60))

  if (minutes <= 1) return translate("header.time.justNow", "Just now")
  if (minutes < 60) return translate("header.time.minutes", "{count} min ago", { count: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const suffix = hours > 1 ? translate("header.time.pluralSuffix", "s") : ""
    return translate("header.time.hours", "{count} hr{suffix} ago", { count: hours, suffix })
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    const suffix = days > 1 ? translate("header.time.pluralSuffix", "s") : ""
    return translate("header.time.days", "{count} day{suffix} ago", { count: days, suffix })
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function Header({ setActiveItem, activeItem }) {
  const [profileDropdown, setProfileDropdown] = useState(false)
  const [notificationDropdown, setNotificationDropdown] = useState(false)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState(null)
  const [notificationsLoaded, setNotificationsLoaded] = useState(false)
  
  const profileRef = useRef(null)
  const notificationRef = useRef(null)
  const notificationsFetchInFlight = useRef(false)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isMapView = activeItem === "geospatial-map"
  const showUserMenus = !isMapView
  const API_BASE_URL = useMemo(
    () => import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api",
    []
  )
  const ASSET_BASE_URL = useMemo(
    () => import.meta.env.VITE_ASSET_URL?.replace(/\/$/, "") || "http://localhost:5000",
    []
  )

  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/me`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUserData(data.data)
      }
    } catch {
      setUserData(null)
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL])

  const fetchNotifications = useCallback(async ({ force = false, silent = false } = {}) => {
    if (notificationsFetchInFlight.current && !force) {
      return
    }

    notificationsFetchInFlight.current = true

    if (!silent) {
      setNotificationsLoading(true)
    }
    setNotificationsError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/technician`, {
        credentials: 'include',
      })

      if (response.status === 204) {
        setNotifications([])
        return
      }

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.message || 'Failed to load notifications'
        throw new Error(message)
      }

      const items = Array.isArray(payload?.data) ? payload.data : []
      setNotifications(items)
    } catch (error) {
      if (!silent) {
        const rawMessage = error?.message || 'Unable to load notifications.'
        const friendlyMessage = rawMessage.toLowerCase().includes('forbidden')
          ? 'Notifications are available for technician accounts only.'
          : rawMessage
        setNotificationsError(friendlyMessage)
      }
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
      setNotificationsLoaded(true)
      notificationsFetchInFlight.current = false
    }
  }, [API_BASE_URL])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  useEffect(() => {
    if (!loading && userData?.roleid === 3 && !notificationsLoaded) {
      fetchNotifications({ silent: true })
    }
  }, [loading, userData, notificationsLoaded, fetchNotifications])

  useEffect(() => {
    if (notificationDropdown) {
      fetchNotifications()
    }
  }, [notificationDropdown, fetchNotifications])

  useEffect(() => {
    const handleRefreshNotifications = () => fetchNotifications({ force: true })
    window.addEventListener('notifications:refresh', handleRefreshNotifications)
    return () => window.removeEventListener('notifications:refresh', handleRefreshNotifications)
  }, [fetchNotifications])

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      const updated = event.detail
      if (!updated) return

      setUserData((prev) => ({
        ...(prev ?? {}),
        ...updated
      }))
    }

    window.addEventListener('profile:updated', handleProfileUpdated)
    return () => window.removeEventListener('profile:updated', handleProfileUpdated)
  }, [])

  // keep dropdowns shut when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdown(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isMapView) {
      setProfileDropdown(false)
      setNotificationDropdown(false)
    }
  }, [isMapView])

  const resolveRoleId = () => {
    if (userData?.roleid) return userData.roleid

    try {
      const cached = localStorage.getItem('user')
      if (!cached) return null

      const parsed = JSON.parse(cached)
      return parsed?.roleID || parsed?.roleid || null
    } catch {
      return null
    }
  }

  const handleLogout = async () => {
    const roleId = resolveRoleId()

    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        localStorage.removeItem('user')
        localStorage.removeItem('token')

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'))
        }

        const isAdmin = roleId === 1 || roleId === 2
        const isTechnician = roleId === 3

        if (isAdmin) {
          navigate('/admin/login', { replace: true })
        } else if (isTechnician) {
          navigate('/login', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
  }

  const handleViewProfile = () => {
    setProfileDropdown(false)
    setActiveItem('profile')
  }

  const handleEditProfile = () => {
    setProfileDropdown(false)
    setActiveItem('edit-profile')
  }

  const handleNavigateToMap = () => {
    setProfileDropdown(false)
    setNotificationDropdown(false)

    const targetView = "geospatial-map"
    const targetPath = (() => {
      const roleId = resolveRoleId()
      return getGeospatialPathForRole(roleId)
    })()
    const hasViewHandler = typeof setActiveItem === "function"

    if (hasViewHandler) {
      setActiveItem(targetView)
    } else {
      navigate(targetPath)
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("app:navigate", { detail: { view: targetView } })
      )
    }
  }

  const fullName = userData ? `${userData.firstname} ${userData.lastname}` : t("general.loading", "Loading…")
  const email = userData?.email || ''
  const roleLabel = userData?.roleLabel || userData?.role || ROLE_LABELS[userData?.roleid] || null
  const profileImageUrl = userData?.profileimg
    ? `${ASSET_BASE_URL}/uploads/${userData.profileimg}`
    : DEFAULT_AVATAR
  const handleAvatarError = useCallback((event) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = DEFAULT_AVATAR
  }, [])
  const hasAttentionItems = useMemo(
    () => notifications.some((item) => ['pending', 'rejected', 'reminder'].includes(item.status)),
    [notifications]
  )
  const showNotificationIndicator = showUserMenus && (hasAttentionItems || (!notificationsLoaded && userData?.roleid === 3))
  const pageMeta = useMemo(() => {
    const fallback = {
      title: t("header.pages.default.title", "Technician workspace"),
      subtitle: t("header.pages.default.subtitle", "Keep barangay data current."),
    }

    if (!activeItem) {
      return fallback
    }

    const config = PAGE_TITLES[activeItem]
    if (!config) {
      return fallback
    }

    return {
      title: t(config.titleKey, config.titleFallback),
      subtitle: t(config.subtitleKey, config.subtitleFallback),
    }
  }, [activeItem, t])

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100/80 bg-white/90 py-3 text-emerald-800 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-inner sm:h-10 sm:w-10">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12l8-4.5" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12v8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12L4 7.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-emerald-500">
              <span className="truncate">{t("app.brand", "GeoAgriTech")}</span>
              <span className="hidden h-1 w-1 rounded-full bg-emerald-200 align-middle sm:inline-block" />
              <span className="truncate tracking-[0.22em] text-emerald-400">{t("header.brandSegment", "Technician")}</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">{pageMeta.title}</h1>
            {pageMeta.subtitle ? (
              <p className="text-xs font-medium text-slate-500 sm:text-sm">{pageMeta.subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-start gap-2.5 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-3">
          {activeItem === "geospatial-map" ? (
            <button
              type="button"
              onClick={() => setActiveItem?.("dashboard")}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-emerald-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t("header.button.backToDashboard", "Back to dashboard")}</span>
              <span className="sm:hidden">{t("header.button.back", "Back")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNavigateToMap}
              aria-label={t("header.button.viewMap", "View map")}
              className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline focus-visible:outline-emerald-200"
            >
              <Map className="h-5 w-5" />
              <span className="pointer-events-none absolute -bottom-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 sm:block">
                {t("header.button.viewMap", "View map")}
              </span>
            </button>
          )}

          {showUserMenus ? (
            <>
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationDropdown(!notificationDropdown)
                    setProfileDropdown(false)
                  }}
                  className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline focus-visible:outline-emerald-200"
                >
                  <Bell className="h-5 w-5" />
                  {showNotificationIndicator && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-200 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                  )}
                  <span className="pointer-events-none absolute -bottom-10 left-1/2 z-10 hidden -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-emerald-700 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                    {t("header.button.notifications", "Notifications")}
                  </span>
                </button>

                {notificationDropdown && (
                  <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-emerald-100 bg-white/95 shadow-2xl backdrop-blur transition-colors sm:w-80">
                    <div className="border-b border-emerald-50 px-4 py-3">
                      <h3 className="font-semibold text-emerald-900">{t("header.button.notifications", "Notifications")}</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notificationsLoading && (
                        <div className="space-y-2 p-4">
                          {[1, 2, 3].map((item) => (
                            <div key={item} className="space-y-2 rounded-xl border border-emerald-50 bg-emerald-50/60 p-3 animate-pulse">
                              <div className="h-3 w-2/3 rounded bg-emerald-200/70" />
                              <div className="h-2 w-3/4 rounded bg-emerald-100/70" />
                              <div className="h-2 w-1/3 rounded bg-emerald-100/70" />
                            </div>
                          ))}
                        </div>
                      )}

                      {!notificationsLoading && notificationsError && (
                        <div className="space-y-2 p-4 text-sm text-rose-600">
                          <p className="font-semibold">{t("header.notifications.errorTitle", "Couldn't load notifications")}</p>
                          <p className="text-xs text-rose-500">{notificationsError}</p>
                          <button
                            type="button"
                            onClick={() => fetchNotifications({ force: true })}
                            className="mt-1 inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            {t("header.notifications.retry", "Try again")}
                          </button>
                        </div>
                      )}

                      {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                        <div className="px-6 py-10 text-center text-sm text-gray-500">
                          <p className="font-semibold text-gray-700">{t("header.notifications.emptyTitle", "You're all caught up")}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {t("header.notifications.emptySubtitle", "We'll notify you when approval decisions land or monthly reminders are due.")}
                          </p>
                        </div>
                      )}

                      {!notificationsLoading && !notificationsError && notifications.length > 0 && (
                        <div className="divide-y divide-emerald-50">
                          {notifications.map((item) => {
                            const normalizedStatus = item.status?.toLowerCase?.()
                            const badgeClass = STATUS_BADGES[item.status] || "bg-slate-100 text-slate-600"
                            const statusKey = STATUS_LABEL_KEYS[item.status]
                            const badgeLabel = statusKey ? t(statusKey, STATUS_LABEL_FALLBACK[item.status] || "Info") : null
                            const showStatusBadge = normalizedStatus && normalizedStatus !== "verified" && badgeLabel
                            const recordLabel = item.meta?.recordType ? formatRecordLabel(item.meta.recordType) : null
                            const recordId = item.meta?.recordId ?? item.meta?.record_id ?? null
                            const metaLine = recordLabel || recordId

                            return (
                              <div key={item.id} className="cursor-default p-3 transition-colors hover:bg-emerald-50/60">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                  </div>
                                  {showStatusBadge ? (
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                                      {badgeLabel}
                                    </span>
                                  ) : null}
                                </div>
                                {item.message && <p className="mt-1 text-xs text-gray-500">{item.message}</p>}
                                {metaLine ? (
                                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-500/80">
                                    {recordLabel ? recordLabel : null}
                                    {recordLabel && recordId ? " • " : ""}
                                    {recordId ? `#${recordId}` : null}
                                  </p>
                                ) : null}
                                <p className="mt-1.5 text-xs font-medium text-emerald-600">{formatRelativeTime(item.timestamp, t)}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5 border-t border-emerald-50 text-center">
                      <button
                        type="button"
                        onClick={() => fetchNotifications({ force: true })}
                        className="text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                      >
                        {t("header.notifications.refresh", "Refresh notifications")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdown(!profileDropdown)
                    setNotificationDropdown(false)
                  }}
                  disabled={loading}
                  className="group flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-emerald-700 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:text-emerald-800 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 text-sm font-semibold text-white shadow-inner ring-2 ring-white ring-offset-2 ring-offset-emerald-50 transition group-hover:ring-emerald-200">
                    <img
                      src={profileImageUrl}
                      alt={fullName}
                      onError={handleAvatarError}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="hidden min-w-[10rem] text-left sm:block">
                    <p className="text-sm font-semibold leading-tight text-emerald-900">{fullName}</p>
                    {roleLabel ? (
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-500/80">{roleLabel}</p>
                    ) : null}
                    <p className="text-xs leading-tight text-emerald-400/80">{email}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-emerald-500 transition-transform ${profileDropdown ? "rotate-180" : ""}`} />
                </button>

                {profileDropdown && (
                  <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-emerald-100/70 bg-white/95 shadow-2xl backdrop-blur">
                    <div className="border-b border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">{fullName}</p>
                      {roleLabel ? (
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500/80">{roleLabel}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-emerald-600/80">{email}</p>
                      <button
                        type="button"
                        onClick={() => {
                          handleViewProfile()
                        }}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500 transition hover:text-emerald-600"
                      >
                        {t("header.button.viewProfile", "View profile")}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    <div className="space-y-1 bg-white/80 p-3">
                      <button
                        type="button"
                        onClick={handleEditProfile}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <Edit className="h-4 w-4 text-emerald-500" />
                        {t("header.menu.editProfile", "Edit Profile")}
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        {t("header.menu.logout", "Logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}