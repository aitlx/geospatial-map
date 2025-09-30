import { Bell, Map, Edit, LogOut, ChevronDown } from "lucide-react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"

export default function Header({ setActiveItem }) {
  const [profileDropdown, setProfileDropdown] = useState(false)
  const [notificationDropdown, setNotificationDropdown] = useState(false)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const profileRef = useRef(null)
  const notificationRef = useRef(null)
  const navigate = useNavigate()
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
    } catch (error) {
      console.error('failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

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

  // Close dropdowns when clicking outside
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

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        navigate('/', { replace: true })
      }
    } catch (error) {
      console.error('logout failed:', error)
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

  const fullName = userData ? `${userData.firstname} ${userData.lastname}` : 'Loading...'
  const email = userData?.email || ''
  const profileImageUrl = userData?.profileimg
    ? `${ASSET_BASE_URL}/uploads/${userData.profileimg}`
    : null

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="hidden sm:flex flex-col text-white/90">
          <span className="text-xs uppercase tracking-wide text-white/70">Technician Portal</span>
          <span className="text-sm font-semibold">GeoAgriTech Dashboard</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Map Button */}
          <button 
            type="button"
            className="relative group rounded-2xl p-2.5 text-white/90 transition-all duration-200 hover:bg-white/15"
          >
            <Map className="h-5 w-5" />
            <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
              View Map
            </span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notificationRef}>
            <button 
              type="button"
              onClick={() => {
                setNotificationDropdown(!notificationDropdown)
                setProfileDropdown(false)
              }}
              className="relative group rounded-2xl p-2.5 text-white/90 transition-all duration-200 hover:bg-white/15"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-300"></span>
              <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                Notifications
              </span>
            </button>

            {notificationDropdown && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/10 bg-white/95 shadow-2xl backdrop-blur">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <button 
                    type="button"
                    className="w-full p-3 hover:bg-green-50/50 cursor-pointer transition-colors border-b border-gray-50 text-left"
                  >
                    <p className="text-sm font-medium text-gray-900">New soil data available</p>
                    <p className="text-xs text-gray-500 mt-1">Updated readings from Sector 7</p>
                    <p className="text-xs text-green-600 mt-1.5 font-medium">2 min ago</p>
                  </button>
                  <button 
                    type="button"
                    className="w-full p-3 hover:bg-green-50/50 cursor-pointer transition-colors border-b border-gray-50 text-left"
                  >
                    <p className="text-sm font-medium text-gray-900">Weather alert</p>
                    <p className="text-xs text-gray-500 mt-1">Heavy rain expected tomorrow</p>
                    <p className="text-xs text-green-600 mt-1.5 font-medium">1 hour ago</p>
                  </button>
                  <button 
                    type="button"
                    className="w-full p-3 hover:bg-green-50/50 cursor-pointer transition-colors text-left"
                  >
                    <p className="text-sm font-medium text-gray-900">Report submitted</p>
                    <p className="text-xs text-gray-500 mt-1">Monthly yield report approved</p>
                    <p className="text-xs text-green-600 mt-1.5 font-medium">3 hours ago</p>
                  </button>
                </div>
                <div className="px-3 py-2.5 border-t border-gray-100 text-center">
                  <button 
                    type="button"
                    className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button 
              type="button"
              onClick={() => {
                setProfileDropdown(!profileDropdown)
                setNotificationDropdown(false)
              }}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-white transition-all duration-200 hover:bg-white/20"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (userData?.firstname?.charAt(0) || 'U').toUpperCase()
                )}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight text-white">{fullName}</p>
                <p className="text-xs leading-tight text-white/80">{email}</p>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${profileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {profileDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                {/* Profile info section */}
                <div className="p-3 border-b border-gray-100 bg-gradient-to-br from-green-50 to-emerald-50">
                  <button
                    type="button"
                    onClick={handleViewProfile}
                    className="w-full text-left hover:opacity-80 transition-opacity"
                  >
                    <p className="text-sm font-semibold text-gray-900">{fullName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{email}</p>
                    <p className="text-xs text-green-600 mt-1 font-medium">View Profile →</p>
                  </button>
                </div>

                {/* Menu items */}
                <div className="p-2">
                  <button 
                    type="button"
                    onClick={handleEditProfile}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-700 hover:bg-green-50 hover:text-green-600 rounded-lg transition-all duration-200"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="text-sm font-medium">Edit Profile</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}