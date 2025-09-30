import { User, Mail, Phone, Calendar, Shield, Camera, Clock, LogIn, LogOut, FileEdit } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import ProfilePictureUpload from "../components/ProfilePictureUpload"

export default function ProfilePage({ successMessage = "", onSuccessMessageHandled }) {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileImage, setProfileImage] = useState(null)
  const [activityLogs, setActivityLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const API_BASE_URL = useMemo(() => import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api", [])
  const ASSET_BASE_URL = useMemo(() => import.meta.env.VITE_ASSET_URL?.replace(/\/$/, "") || "http://localhost:5000", [])

  const roleLabels = useMemo(() => ({
    1: "Super Administrator",
    2: "Administrator",
    3: "Technician"
  }), [])

  const normalizeUser = useCallback((rawUser) => {
    if (!rawUser) return null

    return {
      ...rawUser,
      roleLabel: roleLabels[rawUser.roleid] || rawUser.role || "User",
      firstname: rawUser.firstname || rawUser.firstName || "",
      lastname: rawUser.lastname || rawUser.lastName || "",
      email: rawUser.email || "",
      contactnumber: rawUser.contactnumber || rawUser.phone || "",
      createdat: rawUser.createdat || rawUser.createdAt || null,
      profileimg: rawUser.profileimg || rawUser.profileImage || null,
      bio: rawUser.bio || ""
    }
  }, [roleLabels])

  const parseDetails = useCallback((details) => {
    if (!details) return {}
    if (typeof details === "object") return details
    try {
      return JSON.parse(details)
    } catch {
      return { description: details }
    }
  }, [])

  const deriveLogType = useCallback((action = "") => {
    const normalized = action.toUpperCase()
    if (normalized.includes("LOGIN")) return "login"
    if (normalized.includes("LOGOUT")) return "logout"
    if (normalized.includes("CREATE") || normalized.includes("ADD")) return "create"
    if (normalized.includes("DELETE")) return "delete"
    if (normalized.includes("UPDATE") || normalized.includes("EDIT")) return "update"
    return "general"
  }, [])

  const formatLogEntry = useCallback((log) => {
    if (!log) return null

    const details = parseDetails(log.details)
    const description = details?.description || details?.message || log.action?.replace(/_/g, " ") || "Activity"

    return {
      id: log.log_id || log.id || crypto.randomUUID(),
      type: deriveLogType(log.action),
      description,
      timestamp: log.created_at || log.logged_at || log.timestamp || new Date().toISOString()
    }
  }, [deriveLogType, parseDetails])

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage)
      onSuccessMessageHandled?.()
    }
  }, [successMessage, onSuccessMessageHandled])

  useEffect(() => {
    let isMounted = true

    const fetchUserData = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/user/me`, {
          withCredentials: true
        })

        if (!isMounted) return

        if (data?.success) {
          const normalizedUser = normalizeUser(data.data)
          setUserData(normalizedUser)

          if (normalizedUser.profileimg) {
            setProfileImage(`${ASSET_BASE_URL}/uploads/${normalizedUser.profileimg}`)
          }

          return normalizedUser
        } else {
          throw new Error(data?.message || "Failed to load user data")
        }
      } catch (error) {
        if (!isMounted) return
        console.error("Failed to fetch user:", error)
        toast.error(error.response?.data?.message || "Unable to load profile information")
        return null
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    const fetchActivityLogs = async (roleId) => {
      if (!isMounted) return
      setLogsLoading(true)

      const technicianRoute = `${API_BASE_URL.replace(/\/$/, "")}/logs/my-logs`
      const adminRoute = `${API_BASE_URL.replace(/\/$/, "")}/logs`
      const endpoint = roleId === 3 ? technicianRoute : adminRoute

      try {
        const { data } = await axios.get(endpoint, { withCredentials: true })

        if (!isMounted) return

        if (data?.success) {
          const rawLogs = data.data || data.logs || []
          const formattedLogs = rawLogs
            .map(formatLogEntry)
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          setActivityLogs(formattedLogs)
        } else {
          throw new Error(data?.message || "Failed to load activity logs")
        }
      } catch (error) {
        if (!isMounted) return
        console.error("Failed to fetch logs:", error)

        if (error.response?.status === 403 && roleId !== 3) {
          setActivityLogs([])
        } else {
          toast.error(error.response?.data?.message || "Unable to load activity logs")
          setActivityLogs([])
        }
      } finally {
        if (isMounted) setLogsLoading(false)
      }
    }

    const initialize = async () => {
      const user = await fetchUserData()
      if (!isMounted) return

      const roleId = Number(user?.roleid ?? user?.roleID)
      await fetchActivityLogs(Number.isNaN(roleId) ? undefined : roleId)
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [API_BASE_URL, ASSET_BASE_URL, formatLogEntry, normalizeUser])

  const openUploadModal = () => setIsUploadModalOpen(true)
  const closeUploadModal = () => setIsUploadModalOpen(false)

  const handleProfilePhotoUpdated = useCallback((updatedUser) => {
    if (!updatedUser) return

    const normalized = normalizeUser(updatedUser)
    if (!normalized) return

    const cacheBustedImage = normalized.profileimg
      ? `${ASSET_BASE_URL}/uploads/${normalized.profileimg}?t=${Date.now()}`
      : null

    setProfileImage(cacheBustedImage)
    setUserData((prev) => ({
      ...(prev ?? {}),
      ...normalized
    }))
  }, [ASSET_BASE_URL, normalizeUser])

  const getActivityIcon = (type) => {
    switch(type) {
      case 'login': return <LogIn className="h-4 w-4 text-green-600" />
      case 'logout': return <LogOut className="h-4 w-4 text-gray-600" />
      case 'update': return <FileEdit className="h-4 w-4 text-blue-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  const fullName = userData ? `${userData.firstname || ""} ${userData.lastname || ""}`.trim() || "N/A" : 'N/A'
  const initials = userData ? `${userData.firstname?.[0] || ''}${userData.lastname?.[0] || ''}`.toUpperCase() || 'NA' : 'NA'
  const accountStatus = userData?.is_verified ? "Verified" : "Pending Verification"

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
          <div className="h-32 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          <div className="px-8 pb-8">
            <div className="flex flex-col items-center gap-4 -mt-16 mb-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className="w-32 h-32 rounded-2xl object-cover shadow-xl border-4 border-white"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-xl border-4 border-white">
                      {initials}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openUploadModal}
                    className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg cursor-pointer shadow-lg transition-all duration-200 hover:scale-110"
                    title="Update profile picture"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-2">
                  <h1 className="text-3xl font-bold text-gray-800">{fullName}</h1>
                  <p className="text-gray-600">{userData?.roleLabel || 'User'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" />
              Personal Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 font-medium">First Name</label>
                <p className="text-gray-800 font-medium mt-1">{userData?.firstname || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Last Name</label>
                <p className="text-gray-800 font-medium mt-1">{userData?.lastname || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Role</label>
                <p className="text-gray-800 font-medium mt-1">{userData?.roleLabel || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">Bio</label>
                <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                  {userData?.bio || 'No bio added yet. Tell us about yourself!'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-600" />
              Contact Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <label className="text-sm text-gray-500 font-medium">Email Address</label>
                  <p className="text-gray-800 font-medium mt-1">{userData?.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <label className="text-sm text-gray-500 font-medium">Phone Number</label>
                  <p className="text-gray-800 font-medium mt-1">{userData?.contactnumber || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Recent Activity
            </h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {logsLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-3"></div>
                  <span className="text-sm">Loading activity logs...</span>
                </div>
              ) : activityLogs.length > 0 ? (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="flex-shrink-0">
                      {getActivityIcon(log.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{log.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatTimestamp(log.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No activity logs available</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Account Details
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <label className="text-sm text-gray-500 font-medium">Member Since</label>
                  <p className="text-gray-800 font-medium mt-1">
                    {userData?.createdat ? new Date(userData.createdat).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <label className="text-sm text-gray-500 font-medium">Account Status</label>
                  <p className="text-gray-800 font-medium mt-1 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${userData?.is_verified ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                    {accountStatus}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        <ProfilePictureUpload
          isOpen={isUploadModalOpen}
          onClose={closeUploadModal}
          currentImage={profileImage}
          onUploadSuccess={handleProfilePhotoUpdated}
        />
    </div>
  )
}
