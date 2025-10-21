import { User, Mail, Phone, Calendar, Shield, Camera, Clock, Pencil } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Link } from "react-router-dom"
import axios from "axios"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import ProfilePictureUpload from "../components/ProfilePictureUpload"

const DEFAULT_PROFILE_IMAGE = "/default-profile.webp"

export default function ProfilePage({ successMessage = "", onSuccessMessageHandled }) {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileImage, setProfileImage] = useState(DEFAULT_PROFILE_IMAGE)
  const [activityLogs, setActivityLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const API_BASE_URL = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL?.trim()
    if (!raw) return "http://localhost:5000/api"
    const normalized = raw.replace(/\/$/, "")
    return normalized.endsWith("/api") ? normalized : `${normalized}/api`
  }, [])
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

  const shouldDisplayLog = useCallback((action = "") => {
    if (!action) return false
    const normalized = action.toUpperCase()

    if (normalized.startsWith("FETCH") || normalized.startsWith("GET")) {
      return false
    }

    if (normalized.includes("PENDING_APPROVAL")) {
      return false
    }

    return true
  }, [])

  const humanize = useCallback((value) => {
    if (!value) return "";
    return String(value)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  const describeActivity = useCallback((log, details) => {
    const action = (log?.action || "").toUpperCase();

    switch (action) {
      case "LOGIN_USER":
        return "Signed in";
      case "LOGIN_ADMIN":
        return "Signed in via admin portal";
      case "LOGOUT_USER":
        return "Signed out";
      case "CHANGE_PASSWORD":
        return "Changed account password";
      case "REGISTER_USER":
        return "Registered a new account";
      case "UPDATE_PROFILE": {
        const updatedFields = Array.isArray(details?.updatedFields) ? details.updatedFields.filter(Boolean) : [];
        const fieldLabels = updatedFields.map((field) => humanize(field)).filter(Boolean);
        const fieldSummary = fieldLabels.length ? fieldLabels.join(", ") : "profile details";
        const photoNote = details?.fileUploaded ? " and refreshed profile photo" : "";
        return `Updated ${fieldSummary}${photoNote}`;
      }
      case "APPROVE_RECORD":
      case "REJECT_RECORD": {
        const approvalDetails = details?.approval ?? {};
        const mainDetails = details?.mainTable ?? {};
        const recordType = approvalDetails.record_type || mainDetails.record_type || log?.target_table || "record";
        const recordId = approvalDetails.record_id || mainDetails.price_id || mainDetails.yield_id || log?.target_id;
        const friendlyType = humanize(recordType);
        const actionVerb = action === "APPROVE_RECORD" ? "Approved" : "Rejected";
        const reasonNote = action === "REJECT_RECORD" && details?.reason ? ` – ${details.reason}` : "";
        return `${actionVerb} ${friendlyType}${recordId ? ` #${recordId}` : ""}${reasonNote}`;
      }
      case "CREATE_USER":
        return "Created a new user account";
      case "UPDATE_USER":
        return "Updated a user account";
      case "DELETE_USER":
        return "Removed a user account";
      case "SUBMIT_CROP_PRICE":
        return "Submitted crop price data";
      case "SUBMIT_BARANGAY_YIELD":
        return "Submitted barangay yield data";
      default:
        break;
    }

    return details?.description || details?.message || humanize(action) || "Activity";
  }, [humanize]);

  const formatLogEntry = useCallback((log) => {
    if (!log) return null

    if (!shouldDisplayLog(log.action)) {
      return null
    }

    const details = parseDetails(log.details)
    const description = describeActivity(log, details)

    return {
      id: log.log_id || log.id || crypto.randomUUID(),
      description,
      timestamp: log.created_at || log.logged_at || log.timestamp || new Date().toISOString()
    }
  }, [describeActivity, parseDetails, shouldDisplayLog])

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

          setProfileImage(
            normalizedUser.profileimg
              ? `${ASSET_BASE_URL}/uploads/${normalizedUser.profileimg}`
              : DEFAULT_PROFILE_IMAGE
          )

          return normalizedUser
        } else {
          throw new Error(data?.message || "Failed to load user data")
        }
      } catch (error) {
        if (!isMounted) return
        toast.error(error.response?.data?.message || "Unable to load profile information")
        setUserData(null)
        return null
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    const fetchActivityLogs = async () => {
      if (!isMounted) return
      setLogsLoading(true)

      const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/logs/self`

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

        toast.error(error.response?.data?.message || "Unable to load activity logs")
        setActivityLogs([])
      } finally {
        if (isMounted) setLogsLoading(false)
      }
    }

    const initialize = async () => {
      await fetchUserData()
      if (!isMounted) return

      await fetchActivityLogs()
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
      : DEFAULT_PROFILE_IMAGE

    setProfileImage(cacheBustedImage)
    setUserData((prev) => ({
      ...(prev ?? {}),
      ...normalized
    }))
  }, [ASSET_BASE_URL, normalizeUser])

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
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/40 to-white flex items-center justify-center">
        <div className="text-center text-slate-700">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  const fullName = userData ? `${userData.firstname || ""} ${userData.lastname || ""}`.trim() || "N/A" : 'N/A'
  const initials = userData ? `${userData.firstname?.[0] || ''}${userData.lastname?.[0] || ''}`.toUpperCase() || 'NA' : 'NA'
  const accountStatus = userData?.is_verified ? "Verified" : "Pending Verification"

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/40 to-white py-10 px-3 sm:px-5 lg:px-7 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <ToastContainer position="top-right" autoClose={3000} theme="light" />

        <div className="relative overflow-hidden rounded-3xl border border-emerald-100/70 bg-white/90 shadow-lg shadow-emerald-900/5 backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_65%)]" aria-hidden="true"></div>
          <div className="relative h-36 w-full bg-gradient-to-r from-emerald-500/30 via-emerald-400/15 to-transparent"></div>
          <div className="relative -mt-16 px-8 pb-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:gap-10 sm:text-left">
                <div className="relative">
                <div className="absolute inset-0 -translate-y-1 scale-110 rounded-3xl bg-emerald-400/20 blur-3xl" aria-hidden="true"></div>
                <img
                  src={profileImage || DEFAULT_PROFILE_IMAGE}
                  alt={fullName ? `${fullName}'s profile photo` : `Profile ${initials}`}
                  onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }}
                  className="relative h-32 w-32 rounded-2xl border border-emerald-200 bg-white object-cover shadow-xl shadow-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={openUploadModal}
                  className="absolute bottom-3 right-3 flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600"
                  title="Update profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600/80">My profile</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-[28px]">{fullName}</h1>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600 sm:justify-start">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 font-medium text-emerald-700">
                      <Shield className="h-4 w-4" />
                      {userData?.roleLabel || 'User'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 font-medium text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${userData?.is_verified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {accountStatus}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to="/Edit-Profile"
                className="inline-flex items-center justify-center gap-2 self-center rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:self-end"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100/70 bg-white/95 p-6 shadow-sm shadow-emerald-900/5">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <User className="h-5 w-5 text-emerald-600" />
              Personal information
            </h2>
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">First name</label>
                <p className="mt-2 text-base font-semibold text-slate-900">{userData?.firstname || 'Not provided'}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Last name</label>
                <p className="mt-2 text-base font-semibold text-slate-900">{userData?.lastname || 'Not provided'}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Role</label>
                <p className="mt-2 text-base font-semibold text-slate-900">{userData?.roleLabel || 'Not provided'}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Bio</label>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {userData?.bio || 'No bio added yet. Tell us about yourself!'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100/70 bg-white/95 p-6 shadow-sm shadow-emerald-900/5">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Mail className="h-5 w-5 text-emerald-600" />
              Contact information
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Mail className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Email address</label>
                  <p className="mt-2 text-base font-semibold text-slate-900">{userData?.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Phone className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Phone number</label>
                  <p className="mt-2 text-base font-semibold text-slate-900">{userData?.contactnumber || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100/70 bg-white/95 p-6 shadow-sm shadow-emerald-900/5 lg:col-span-2">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Clock className="h-5 w-5 text-emerald-600" />
              Recent activity
            </h2>
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-emerald-100/60 bg-emerald-50/30">
              {logsLoading ? (
                <div className="flex items-center justify-center gap-3 py-8 text-slate-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-emerald-500"></div>
                  <span className="text-sm">Loading activity logs...</span>
                </div>
              ) : activityLogs.length > 0 ? (
                <div className="flex flex-col divide-y divide-emerald-100/60">
                  {activityLogs.slice(0, 7).map((log) => (
                    <div key={log.id} className="px-5 py-4 transition-colors hover:bg-emerald-100/45">
                      <p className="text-sm font-medium text-slate-900 line-clamp-2">{log.description}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatTimestamp(log.timestamp)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-slate-600">No recent activity yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100/70 bg-white/95 p-6 shadow-sm shadow-emerald-900/5 lg:col-span-2">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Shield className="h-5 w-5 text-emerald-600" />
              Account details
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Calendar className="h-5 w-5" />
                </span>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Member since</label>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {userData?.createdat ? new Date(userData.createdat).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/60 bg-emerald-50/40 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Shield className="h-5 w-5" />
                </span>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">Account status</label>
                  <p className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                    <span className={`h-2 w-2 rounded-full ${userData?.is_verified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
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
