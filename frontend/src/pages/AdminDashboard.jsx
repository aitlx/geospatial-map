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

const useAdminUser = (navigate) => {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user")
      if (!stored) {
        navigate("/admin/login", { replace: true })
        return
      }

      const parsed = JSON.parse(stored)
      const roleId = parsed?.roleID ?? parsed?.roleid

      if (roleId === 1 || roleId === 2) {
        setUser(parsed)
      } else {
        navigate("/admin/login", { replace: true })
        return
      }
    } catch {
      localStorage.removeItem("user")
      navigate("/admin/login", { replace: true })
      return
    } finally {
      setChecked(true)
    }
  }, [navigate])

  return { user, checked, setUser }
}

const DEFAULT_PAGE = "dashboard-overview"
const ADMIN_DEFAULT_PAGE = "submission-reviews"
const SUPER_ADMIN_ONLY_ITEMS = new Set(["roles-access", "crop-configuration", "activity-logs", "backups", "system-settings"])

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, checked, setUser } = useAdminUser(navigate)
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
    }

    if (roleId === 1) {
      sharedPages["user-management"] = () => <UserManagement />
      sharedPages["roles-access"] = () => <RolesAccess />
      sharedPages["crops-admin"] = () => <CropsAdmin />
      sharedPages["crop-configuration"] = () => <CropRecommendationConfiguration />
      sharedPages["activity-logs"] = () => <ActivityLogs />
      sharedPages.backups = () => <Backups />
      sharedPages["system-settings"] = () => <SystemSettingsModule />
    } else if (roleId === 2) {
      sharedPages["user-management"] = () => <UserManagement />
      sharedPages["crops-admin"] = () => <CropsAdmin />
    } else {
      sharedPages["user-management"] = () => <UserManagement />
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

    if (roleId !== 1 && SUPER_ADMIN_ONLY_ITEMS.has(activeItem)) {
      const fallback = roleId === 2 ? ADMIN_DEFAULT_PAGE : DEFAULT_PAGE
      setActiveItem(fallback)
    }

    if (roleId === 1 && activeItem === "submission-reviews") {
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
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 text-emerald-900">
      <div className="flex">
        <SidebarAdmin
          activeItem={activeItem}
          onItemClick={setActiveItem}
          roleId={roleId}
          isOpen={sidebarOpen}
          onClose={handleCloseSidebar}
        />
        <main className="flex flex-1 flex-col">
          <AdminHeader
            user={user}
            roleId={roleId}
            activeItem={activeItem}
            onNavigate={setActiveItem}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          />
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-emerald-50/60 via-white to-emerald-100/60 px-6 pb-10 pt-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              <ActiveComponent />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
