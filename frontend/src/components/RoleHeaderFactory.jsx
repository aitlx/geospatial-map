import React, { useRef, useEffect, useMemo, useState, useCallback } from "react"
import { Map as MapIcon, ChevronDown, ArrowLeft } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { getPathForView } from "../utils/viewRoutes.js"
import { useTranslation } from "../hooks/useTranslation.js"

const DEFAULT_AVATAR = "/default-profile.webp"

function createRoleHeader(config = {}) {
  return function RoleHeader({ setActiveItem, activeItem, onNavigate, onToggleSidebar }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const headerEl = useRef(null)

  const [userData, setUserData] = useState(null)
    const [profileOpen, setProfileOpen] = useState(false)
    const profileRef = useRef(null)

    const API_BASE_URL = useMemo(() => {
      const raw = import.meta.env.VITE_API_URL?.trim()
      if (!raw) return "http://localhost:5000/api"
      const normalized = raw.replace(/\/$/, "")
      return normalized.endsWith("/api") ? normalized : `${normalized}/api`
    }, [])

    const ASSET_BASE_URL = useMemo(
      () => import.meta.env.VITE_ASSET_URL?.replace(/\/$/, "") || "http://localhost:5000",
      []
    )

    const fetchUserData = useCallback(async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/user/me`, { credentials: 'include' })
        console.debug('[RoleHeader] fetchUserData status', resp.status)
        if (!resp.ok) {
          // fall back to local cache when api call is not ok
          try {
            const cached = localStorage.getItem('user')
            if (cached) {
              const parsed = JSON.parse(cached)
              setUserData(parsed)
            } else {
              setUserData(null)
            }
          } catch {
            setUserData(null)
          }
          return
        }
        const payload = await resp.json().catch(() => null)
        console.debug('[RoleHeader] fetchUserData payload', payload)
        setUserData(payload?.data ?? null)
      } catch {
        // network/parse error: fall back to cached user when available
        console.debug('fetchUserData error')
        try {
          const cached = localStorage.getItem('user')
          if (cached) {
            const parsed = JSON.parse(cached)
            setUserData(parsed)
          } else {
            setUserData(null)
          }
        } catch {
          setUserData(null)
        }
      }
    }, [API_BASE_URL])

    useEffect(() => {
      fetchUserData()
    }, [fetchUserData])

    // close profile dropdown on outside pointerdown
    useEffect(() => {
      const handleOutside = (e) => {
        try {
          if (profileRef.current && !profileRef.current.contains(e.target)) {
            setProfileOpen(false)
          }
        } catch {
            // ignore
          }
      }
      document.addEventListener('pointerdown', handleOutside)
      return () => document.removeEventListener('pointerdown', handleOutside)
    }, [])

    useEffect(() => {
      const EXTRA_PX = 4
      const setHeaderTop = () => {
        try {
          const el = headerEl.current
          if (!el || !document?.documentElement) return
          const height = Math.round(el.getBoundingClientRect().height)
          document.documentElement.style.setProperty('--sidebar-top', `${height + EXTRA_PX}px`)
        } catch {
          // ignore
        }
      }

      setHeaderTop()
      const ro = new ResizeObserver(setHeaderTop)
      if (headerEl.current) ro.observe(headerEl.current)
      window.addEventListener('resize', setHeaderTop)
      return () => {
        ro.disconnect()
        window.removeEventListener('resize', setHeaderTop)
      }
    }, [])

    const resolveRoleId = useCallback(() => {
      if (userData?.roleid) return userData.roleid
      try {
        const cached = localStorage.getItem('user')
        if (!cached) return null
        const parsed = JSON.parse(cached)
        return parsed?.roleID || parsed?.roleid || null
      } catch {
        return null
      }
    }, [userData])

    const pageMeta = useMemo(() => {
      const raw = config.pageMeta && config.pageMeta[activeItem]
      const roleId = resolveRoleId()
      const meta = typeof raw === 'function' ? raw(roleId) : raw || {}
      const title = meta.title || (typeof config.defaultTitle === 'function' ? config.defaultTitle() : config.defaultTitle) || ''
      const subtitle = meta.subtitle || (typeof config.defaultSubtitle === 'function' ? config.defaultSubtitle() : config.defaultSubtitle) || ''
      return { title, subtitle }
    }, [activeItem, resolveRoleId])

  const BrandIcon = config.brandIcon
  // prefer either setActiveItem (older name) or onNavigate (newer name)
  const navigateHandler = typeof setActiveItem === 'function' ? setActiveItem : (typeof onNavigate === 'function' ? onNavigate : null)

    const profileImageUrl = userData?.profileimg ? `${ASSET_BASE_URL}/uploads/${userData.profileimg}` : DEFAULT_AVATAR

    // open/close profile dropdown
    // open immediately; fetch user data in background if missing
    const openProfile = async () => {
      setProfileOpen(true)
      if (!userData) {
        // fetch in background to avoid blocking the UI
        fetchUserData().catch(() => {})
      }
    }

    // navigation now handled inline in dropdown actions

    const handleLogout = async () => {
      // determine role from in-memory userData or localStorage fallback
      const resolveCachedRole = () => {
        try {
          if (userData?.roleid) return userData.roleid
          const cached = localStorage.getItem('user')
          if (!cached) return null
          const parsed = JSON.parse(cached)
          return parsed?.roleID || parsed?.roleid || null
        } catch {
          return null
        }
      }

      const role = resolveCachedRole()

      try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
      } catch {
        // ignore network errors; proceed to clear local session and redirect
        console.debug('[RoleHeader] logout request failed')
      }

      try {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      } catch {
        // ignore
      }

      // notify app and redirect to appropriate login
      window.dispatchEvent(new Event('auth:logout'))
      try {
        if (role === 1 || role === 2) {
          navigate('/admin/login', { replace: true })
          return
        }
        navigate('/login', { replace: true })
      } catch {
        // ignore navigation errors
      }
    }

    const handleMapClick = () => {
      if (config.mapAction && config.mapAction.enabled) {
        const to = config.mapAction.to || '/'
        // navigate to the map and indicate we came from the header so the map can hide its landing copy
        navigate(to, { state: { fromHeader: true } })
        if (typeof setActiveItem === 'function') setActiveItem('geospatial-map')
      }
    }

    const location = useLocation()
    const cameFromHeader = location?.state?.fromHeader === true
    const isMapPath = typeof location?.pathname === 'string' && location.pathname.toLowerCase().includes('geospatial')

    // hide the top profile header for technicians when viewing the geospatial map
    // the map page renders its own header (back button + title)
    try {
      const currentRole = resolveRoleId()
  // treat role ID flexibly (string or number) so comparison matches stored values
  if (isMapPath && String(currentRole) === '3') {
        // when we intentionally hide the top role header for technicians on the
        // geospatial map, clear the layout top padding so the page content
        // doesn't keep the old header gap (uses --sidebar-top in index.css)
  try { document.documentElement.style.setProperty('--sidebar-top', '2px') } catch { /* noop: best-effort layout tweak */ }
        return null
      }
    } catch {
      // ignore
    }

    // if user navigated from header to the map, render a simplified header with a back button
    if (cameFromHeader && isMapPath) {
  const roleIdForBack = resolveRoleId()
  // prefer project canonical route helper for dashboard paths
  const dashboardHref = roleIdForBack === 1 || roleIdForBack === 2 ? "/admin/dashboard" : (getPathForView('dashboard') || "/Dashboard")
      return (
        <header ref={headerEl} className="sticky top-0 z-50 w-full bg-emerald-700/95 text-white shadow-sm">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between px-3 py-1 md:py-2">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-emerald-600/20 p-2">
                {BrandIcon ? <BrandIcon className="h-5 w-5 text-white" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-100 hidden sm:block">
                  {config.brandLabel || 'GEOAGRITECH'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(dashboardHref)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-white/30"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("header.button.backToDashboard", "Back to Dashboard")}</span>
                <span className="sm:hidden">{t("header.button.back", "Back")}</span>
              </button>
            </div>
          </div>
        </header>
      )
    }

    return (
      <header ref={headerEl} className="sticky top-0 z-50 w-full bg-emerald-700/95 text-white shadow-sm">
  <div className="mx-auto flex max-w-screen-xl items-center justify-between px-3 py-1 md:py-2">
    <div className="flex items-center gap-3">
            {/* hamburger for small screens to toggle sidebar */}
            <button
              type="button"
              onClick={() => {
                if (typeof onToggleSidebar === 'function') return onToggleSidebar()
                // fallback event for pages that manage sidebar state differently
                window.dispatchEvent(new Event('sidebar:toggle'))
              }}
              aria-label={t('header.toggleMenu','Toggle menu')}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus:outline-none"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div className="rounded-md bg-emerald-600/20 p-2">
              {BrandIcon ? <BrandIcon className="h-5 w-5 text-white" /> : null}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-100 hidden sm:block">
                {config.brandLabel || 'GEOAGRITECH'}
              </div>

              <div>
                <h1 className="text-lg font-semibold text-white leading-tight truncate max-w-xs sm:max-w-md" title={pageMeta.title}>{pageMeta.title}</h1>
                {/* subtitle intentionally omitted to keep header compact */}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {config.mapAction && config.mapAction.enabled ? (
              <button
                type="button"
                onClick={handleMapClick}
                aria-label={config.mapAction.label || t('header.map', 'Open map')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <MapIcon className="h-5 w-5" />
              </button>
            ) : null}

            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => (profileOpen ? setProfileOpen(false) : openProfile())}
                className="inline-flex items-center gap-2 rounded-full bg-white/90 px-2 py-1 text-emerald-800"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <img alt={userData?.firstname ? `${userData.firstname} ${userData.lastname}` : 'User'} src={profileImageUrl} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=DEFAULT_AVATAR}} className="h-7 w-7 rounded-full object-cover" />
                <div className="hidden md:flex flex-col text-left min-w-0 md:max-w-[10rem]">
                  <div
                    className="text-sm font-medium truncate"
                    title={userData?.firstname ? `${userData.firstname} ${userData.lastname}` : (config.profileName || 'User')}
                  >
                    {userData?.firstname ? `${userData.firstname} ${userData.lastname}` : (localStorage.getItem('user') ? (() => {try{return JSON.parse(localStorage.getItem('user')).firstname + ' ' + JSON.parse(localStorage.getItem('user')).lastname}catch{return config.profileName||'User'}})() : (config.profileName || 'User'))}
                  </div>
                  <div className="text-xs text-emerald-600 truncate" title={userData?.rolelabel || ''}>{userData?.rolelabel || (typeof config.roleBadge === 'function' ? config.roleBadge() : config.roleBadge)}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-emerald-600" />
              </button>

              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white p-1 shadow-lg text-emerald-900 z-50">
                  <div className="px-3 py-2">
                    <div className="text-sm font-semibold">{userData?.firstname ? `${userData.firstname} ${userData.lastname}` : config.profileHeading ? config.profileHeading() : 'User'}</div>
                    {userData?.email ? <div className="text-xs text-emerald-500">{userData.email}</div> : null}
                  </div>
                  <div className="border-t border-emerald-100/60 mt-2" />
                  <div className="py-1">
                    {(config.profileLinks ? config.profileLinks() : []).map((link) => (
                      <button
                        key={link.id}
                        type="button"
                          onClick={() => {
                          // close first, then navigate
                          setProfileOpen(false)
                          // prefer explicit path property on link
                          if (link.to) {
                            // if we have a navigation handler for the page container, use it to keep routing in-app
                            if (navigateHandler) {
                              navigateHandler(link.id)
                              return
                            }
                            navigate(link.to)
                            return
                          }

                          // explicit known routes for profile actions — navigate first
                          const explicit = {
                            profile: '/profile',
                            'edit-profile': '/profile/edit',
                            'change-password': '/profile/change-password',
                          }
                          if (explicit[link.id]) {
                            if (navigateHandler) {
                              navigateHandler(link.id)
                              return
                            }
                            navigate(explicit[link.id])
                            return
                          }

                          // otherwise fallback to setActiveItem if available
                          if (navigateHandler) {
                            navigateHandler(link.id)
                            return
                          }
                        }}
                        className="flex w-full items-center gap-3 text-left px-3 py-2 text-sm hover:bg-emerald-50"
                      >
                        {link.icon ? <link.icon className="h-4 w-4 text-emerald-600" /> : null}
                        <span>{link.label}</span>
                      </button>
                    ))}
                    <button type="button" onClick={() => { setProfileOpen(false); handleLogout() }} className="flex w-full items-center gap-3 text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">{t('header.logout','Log out')}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    )
  }
}

export default createRoleHeader