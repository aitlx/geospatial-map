import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Menu, X } from "lucide-react"
import Sidebar from "../components/Sidebar"
import Market from "./Market"
import YieldInput from "./YieldInput"
import Header from "../components/Header"
import DashboardContent from "../components/Dashboard"
import Profile from "./Profile"
import EditProfile from "../components/EditProfile"
import Settings from "./Settings"
import ChangePassword from "./ChangePassword"
import GeospatialMap from "./GeospatialMap"
import { getGeospatialPathForRole, getPathForView, getViewFromPath } from "../utils/viewRoutes.js"

const VALID_VIEWS = new Set([
  "dashboard",
  "yield-inputs",
  "market",
  "geospatial-map",
  "profile",
  "edit-profile",
  "settings",
  "change-password",
])

export default function Home({ defaultView = "dashboard" }) {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state
  const { pathname, search } = location
  const API_BASE_URL = useMemo(
    () => import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api",
    []
  )

  const normalizedDefaultView = useMemo(
    () => (VALID_VIEWS.has(defaultView) ? defaultView : "dashboard"),
    [defaultView]
  )

  const viewFromPath = getViewFromPath(pathname)
  const initialView = useMemo(() => {
    if (viewFromPath && VALID_VIEWS.has(viewFromPath)) {
      return viewFromPath
    }

    if (getPathForView(normalizedDefaultView)) {
      return normalizedDefaultView
    }

    return "dashboard"
  }, [normalizedDefaultView, viewFromPath])

  const [activeItem, setActiveItem] = useState(initialView)
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const resolveRoleId = useCallback(() => {
    if (typeof window === "undefined") return null

    try {
      const cached = window.localStorage.getItem("user")
      if (!cached) return null
      const parsed = JSON.parse(cached)
      return parsed?.roleID ?? parsed?.roleid ?? null
    } catch {
      return null
    }
  }, [])

  const computePathForView = useCallback(
    (view) => {
      if (!view) return null
      if (view === "geospatial-map") {
        return getGeospatialPathForRole(resolveRoleId())
      }
      return getPathForView(view)
    },
    [resolveRoleId]
  )

  useEffect(() => {
    if (viewFromPath && VALID_VIEWS.has(viewFromPath) && viewFromPath !== activeItem) {
      setActiveItem(viewFromPath)
      return
    }

    if (!viewFromPath && pathname && pathname.toLowerCase() === "/home") {
      const fallbackPath = computePathForView(normalizedDefaultView) || "/Dashboard"
      navigate(fallbackPath, { replace: true })
    }
  }, [activeItem, computePathForView, navigate, normalizedDefaultView, pathname, viewFromPath])

  const handleSetActiveItem = useCallback(
    (view) => {
      if (!VALID_VIEWS.has(view)) return

      setActiveItem(view)

      const targetPath = computePathForView(view)
      if (targetPath && targetPath !== pathname) {
        navigate(targetPath)
      }
    },
    [computePathForView, navigate, pathname]
  )

  const handleProfileSuccessHandled = useCallback(() => {
    setProfileSuccessMessage("")
  }, [])

  const handleNavigateToMap = useCallback(() => {
    handleSetActiveItem("geospatial-map")
  }, [handleSetActiveItem])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const handleAppNavigate = (event) => {
      const nextView = event.detail?.view ?? event.detail
      if (typeof nextView !== "string" || !VALID_VIEWS.has(nextView)) return
      handleSetActiveItem(nextView)
    }

    window.addEventListener("app:navigate", handleAppNavigate)
    return () => window.removeEventListener("app:navigate", handleAppNavigate)
  }, [handleSetActiveItem])

  useEffect(() => {
    const params = new URLSearchParams(search ?? "")
    const queryView = params.get("view") ?? params.get("activeView")
    const requestedView = locationState?.activeView ?? queryView

    if (!requestedView || !VALID_VIEWS.has(requestedView)) return

    handleSetActiveItem(requestedView)
  }, [handleSetActiveItem, locationState, search])

  useEffect(() => {
    if (activeItem !== "geospatial-map" || typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [activeItem])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const INACTIVITY_LIMIT = 30 * 60 * 1000
    let logoutTimer = null
    let isLoggingOut = false

    const performLogout = async () => {
      if (isLoggingOut) return
      isLoggingOut = true

      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => null)

      const clearCachedSession = () => {
        try {
          window.localStorage.removeItem("user")
          window.localStorage.removeItem("token")
          return true
        } catch {
          return false
        }
      }

      clearCachedSession()

      window.dispatchEvent(new Event("auth:logout"))
      navigate("/login", {
        replace: true,
        state: { reason: "timeout" },
      })
    }

    const resetTimer = () => {
      if (isLoggingOut) return
      if (logoutTimer) {
        window.clearTimeout(logoutTimer)
      }
      logoutTimer = window.setTimeout(performLogout, INACTIVITY_LIMIT)
    }

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "visibilitychange",
    ]

    const handleActivity = (event) => {
      if (event.type === "visibilitychange" && document.visibilityState === "hidden") {
        return
      }
      resetTimer()
    }

    const handleManualLogout = () => {
      isLoggingOut = true
      if (logoutTimer) {
        window.clearTimeout(logoutTimer)
      }
    }

    activityEvents.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    )
    window.addEventListener("auth:logout", handleManualLogout)

    resetTimer()

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      )
      window.removeEventListener("auth:logout", handleManualLogout)
      if (logoutTimer) {
        window.clearTimeout(logoutTimer)
      }
    }
  }, [API_BASE_URL, navigate])

  const resolvedRoleId = resolveRoleId()
  const numericRoleId = Number.parseInt(resolvedRoleId, 10)
  const isAdminRole = Number.isFinite(numericRoleId) && (numericRoleId === 1 || numericRoleId === 2)

  const showSidebar = activeItem !== "geospatial-map" && !isAdminRole

  useEffect(() => {
    if (!showSidebar && sidebarOpen) {
      setSidebarOpen(false)
    }
  }, [showSidebar, sidebarOpen, setSidebarOpen])

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 text-slate-900 transition-colors">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-10 h-56 w-56 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-teal-200/25 blur-3xl" />
        <div className="absolute top-1/3 right-24 h-40 w-40 rounded-full bg-emerald-100/30 blur-2xl" />
      </div>

      {/* Mobile hamburger button */}
      {showSidebar && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-50 rounded-lg bg-white p-2 shadow-lg transition hover:bg-emerald-50 lg:hidden"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="h-6 w-6 text-emerald-600" /> : <Menu className="h-6 w-6 text-emerald-600" />}
        </button>
      )}

      {/* Mobile sidebar overlay */}
      {showSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {showSidebar && (
        <div
          className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-300 lg:relative lg:z-10 lg:w-72 lg:translate-x-0`}
        >
          <Sidebar 
            activeItem={activeItem} 
            onItemClick={(view) => {
              handleSetActiveItem(view)
              setSidebarOpen(false) // Close sidebar on mobile after clicking
            }} 
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      )}

  <div className="relative z-10 flex min-h-screen flex-1 flex-col bg-transparent">
        <Header setActiveItem={handleSetActiveItem} activeItem={activeItem} />

        <div className={`flex-1 overflow-y-auto pb-16 pt-6 ${activeItem === "geospatial-map" ? "" : "px-4 sm:px-6 lg:px-8"}`}>
          <div
            className={
              activeItem === "geospatial-map"
                ? ""
                : "mx-auto flex w-full max-w-7xl flex-col gap-6"
            }
          >
            {activeItem === "dashboard" && <DashboardContent onNavigateToMap={handleNavigateToMap} />}
            {activeItem === "yield-inputs" && <YieldInput />}
            {activeItem === "market" && <Market />}
            {activeItem === "geospatial-map" && <GeospatialMap />}
            {activeItem === "profile" && (
              <Profile
                successMessage={profileSuccessMessage}
                onSuccessMessageHandled={handleProfileSuccessHandled}
              />
            )}
            {activeItem === "edit-profile" && (
              <EditProfile
                onCancel={() => handleSetActiveItem("profile")}
                onSuccess={(_, message) => {
                  handleSetActiveItem("profile")
                  setProfileSuccessMessage(message || "Profile updated successfully!")
                }}
              />
            )}
            {activeItem === "settings" && <Settings />}
            {activeItem === "change-password" && (
              <ChangePassword onBack={() => handleSetActiveItem("settings")} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}