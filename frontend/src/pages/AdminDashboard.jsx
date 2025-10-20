import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import SidebarAdmin from "../components/SidebarAdmin"
import AdminHeader from "../components/AdminHeader"
import DashboardOverview from "../admin-pages/DashboardOverview"
import SubmissionReviews from "../admin-pages/SubmissionReviews"
import UserManagement from "../admin-pages/UserManagement"
import RolesAccess from "../admin-pages/RolesAccess"
import CropsAdmin from "../admin-pages/CropsAdmin"
import CropRecommendationConfiguration from "../admin-pages/CropRecommendationConfiguration"
import ActivityLogs from "../admin-pages/ActivityLogs"
import SystemSettingsModule from "../admin-pages/SystemSettings"
import Backups from "../admin-pages/Backups"
import ReportsAnalytics from "../admin-pages/ReportsAnalytics"
import ProfilePage from "../pages/Profile"
import EditProfile from "../components/EditProfile"
import SettingsPage from "../pages/Settings"
import ChangePassword from "../pages/ChangePassword"

const useAdminUser = (navigate, apiBaseUrl) => {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let isMounted = true

    const normalizeRoleId = (value) => {
      if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10)
        return Number.isFinite(parsed) ? parsed : null
      }
      if (Number.isFinite(value)) return value
      return null
    }

    const persistUser = (candidate) => {
      try {
        if (!candidate) {
          localStorage.removeItem("user")
          return
        }
        localStorage.setItem("user", JSON.stringify(candidate))
      } catch {
        /* ignore storage errors */
      }
    }

    const resolveLocalUser = () => {
      if (typeof window === "undefined") return null
      try {
        const raw = window.localStorage.getItem("user")
        if (!raw) return null
        const parsed = JSON.parse(raw)
        const roleId = normalizeRoleId(parsed?.roleID ?? parsed?.roleid)
        if (roleId === 1 || roleId === 2) {
          return { ...parsed, roleID: roleId, roleid: roleId }
        }
      } catch {
        /* ignore parse errors */
      }
      return null
    }

    const handleFailure = () => {
      if (!isMounted) return
      setUser(null)
      persistUser(null)
      navigate("/admin/login", { replace: true })
    }

    const verifySession = async () => {
      const localUser = resolveLocalUser()
      if (isMounted) {
        setUser(localUser)
      }

      try {
        const response = await fetch(`${apiBaseUrl}/user/me`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) {
          throw new Error(`session check failed (${response.status})`)
        }

        const payload = await response.json()
        const data = payload?.data ?? payload ?? null
        const roleId = normalizeRoleId(data?.roleID ?? data?.roleid)

        if (roleId !== 1 && roleId !== 2) {
          throw new Error("non-admin session")
        }

        const enrichedUser = {
          ...data,
          roleID: roleId,
          roleid: roleId,
        }

        if (isMounted) {
          setUser(enrichedUser)
          persistUser(enrichedUser)
        }
      } catch (error) {
        console.debug("Admin session verification failed", error)
        handleFailure()
      } finally {
        if (isMounted) {
          setChecked(true)
        }
      }
    }

    verifySession()

    const handleAuthEvent = () => {
      setChecked(false)
      verifySession()
    }

    if (typeof window !== "undefined") {
      window.addEventListener("auth:login", handleAuthEvent)
      window.addEventListener("auth:logout", handleAuthEvent)
    }

    return () => {
      isMounted = false
      if (typeof window !== "undefined") {
        window.removeEventListener("auth:login", handleAuthEvent)
        window.removeEventListener("auth:logout", handleAuthEvent)
      }
    }
  }, [apiBaseUrl, navigate])

  return { user, checked, setUser }
}

const DEFAULT_PAGE = "dashboard-overview"
const ADMIN_DEFAULT_PAGE = "dashboard-overview"
const SUPER_ADMIN_ONLY_ITEMS = new Set([
  "roles-access",
  "user-management",
  "recommendations",
  "crop-configuration",
  "activity-logs",
  "backups",
  "system-settings",
])
const ADMIN_ONLY_ITEMS = new Set([
  "submission-reviews",
  "crop-management",
  "crops-admin",
  "reports-analytics",
  "technician-management",
])

export default function AdminDashboard() {
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL?.trim()
    if (!raw) return "http://localhost:5000/api"
    const normalized = raw.replace(/\/$/, "")
    return normalized.endsWith("/api") ? normalized : `${normalized}/api`
  }, [])
  const { user, checked, setUser } = useAdminUser(navigate, apiBaseUrl)
  const [activeItem, setActiveItem] = useState(DEFAULT_PAGE)
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("")
  const [settingsNotice, setSettingsNotice] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const roleId = user?.roleID ?? user?.roleid ?? null
  const activeItemInitializedRef = useRef(false)

  const handleCloseSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarOpen(true)
      return
    }

    setSidebarOpen(false)
  }

  const pages = useMemo(() => {
    const sharedPages = {
      "dashboard-overview": () => <DashboardOverview roleId={roleId} />,
      "reports-analytics": () => <ReportsAnalytics />,
      settings: () => (
        <SettingsPage
          onAdminNavigate={setActiveItem}
          adminNotice={settingsNotice}
          onNoticeConsumed={() => setSettingsNotice("")}
        />
      ),
      "change-password": () => (
        <ChangePassword
          onBack={(options = {}) => {
            if (options.notice) {
              setSettingsNotice(options.notice)
            }
            setActiveItem("settings")
          }}
        />
      ),
      profile: () => (
        <ProfilePage
          successMessage={profileSuccessMessage}
          onSuccessMessageHandled={() => setProfileSuccessMessage("")}
        />
      ),
      "edit-profile": () => (
        <EditProfile
          onCancel={() => setActiveItem("profile")}
          onSuccess={(updatedUser, message) => {
            if (updatedUser) {
              setUser((prev) => {
                const nextUser = { ...(prev ?? {}), ...updatedUser }
                try {
                  localStorage.setItem("user", JSON.stringify(nextUser))
                } catch {
                  return nextUser
                }
                return nextUser
              })
            }
            setProfileSuccessMessage(message || "Profile updated successfully!")
            setActiveItem("profile")
          }}
        />
      ),
    }

    if (roleId === 2) {
      sharedPages["submission-reviews"] = () => <SubmissionReviews />
      sharedPages["technician-management"] = () => <UserManagement roleFilter="technician" />
      const renderCropManagement = () => <CropsAdmin />
      sharedPages["crop-management"] = renderCropManagement
      sharedPages["crops-admin"] = renderCropManagement
    }

    if (roleId === 1) {
      sharedPages["user-management"] = () => <UserManagement />
      sharedPages["roles-access"] = () => <RolesAccess />
      const renderRecommendations = () => <CropRecommendationConfiguration />
      sharedPages["recommendations"] = renderRecommendations
      sharedPages["crop-configuration"] = renderRecommendations
      sharedPages["activity-logs"] = () => <ActivityLogs />
      sharedPages.backups = () => <Backups />
      sharedPages["system-settings"] = () => <SystemSettingsModule />
    }

    return sharedPages
  }, [
    profileSuccessMessage,
    roleId,
    setActiveItem,
    setSettingsNotice,
    settingsNotice,
    setUser,
  ])

  const fallbackPageKey = roleId === 2 ? ADMIN_DEFAULT_PAGE : DEFAULT_PAGE
  const ActiveComponent = pages[activeItem] || pages[fallbackPageKey]

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "GeoAgriTech Admin"
    }
  }, [])

  useEffect(() => {
    if (!roleId) return

    const targetDefault = roleId === 2 ? ADMIN_DEFAULT_PAGE : DEFAULT_PAGE

    if (!activeItemInitializedRef.current) {
      setActiveItem(targetDefault)
      activeItemInitializedRef.current = true
    }
  }, [roleId, setActiveItem])

  useEffect(() => {
    if (!roleId) return

    console.log('[AdminDashboard] Protection check:', { roleId, activeItem })

    if (roleId !== 1 && SUPER_ADMIN_ONLY_ITEMS.has(activeItem)) {
      console.log('[AdminDashboard] Non-superadmin trying to access superadmin page, redirecting to dashboard')
      const fallback = roleId === 2 ? ADMIN_DEFAULT_PAGE : DEFAULT_PAGE
      setActiveItem(fallback)
    }

    if (roleId === 1 && ADMIN_ONLY_ITEMS.has(activeItem)) {
      console.log('[AdminDashboard] Superadmin trying to access admin-only page, redirecting to dashboard')
      setActiveItem(DEFAULT_PAGE)
    }
  }, [roleId, activeItem, setActiveItem])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleResize = () => {
      const shouldShowSidebar = window.innerWidth >= 1024
      setSidebarOpen(shouldShowSidebar)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-700 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="loading loading-spinner loading-lg text-emerald-500" aria-hidden="true" />
          <p className="text-sm">Verifying admin session…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-950/5 via-emerald-50 to-white text-emerald-900">
      <div className="flex min-h-screen">
        <SidebarAdmin
          activeItem={activeItem}
          onItemClick={setActiveItem}
          roleId={roleId}
          isOpen={sidebarOpen}
          onClose={handleCloseSidebar}
        />
        <main className="flex min-h-screen flex-1 flex-col bg-transparent">
          <AdminHeader
            user={user}
            roleId={roleId}
            activeItem={activeItem}
            onNavigate={setActiveItem}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            sidebarOpen={sidebarOpen}
            sidebarOverlay={typeof window !== 'undefined' ? sidebarOpen && window.innerWidth < 1024 : false}
          />
          <div className="flex-1 overflow-y-auto px-4 pb-12 pt-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              <ActiveComponent />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}