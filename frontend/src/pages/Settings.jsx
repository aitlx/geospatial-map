import { User, Lock, Bell, Globe, Shield, Mail, Phone, CheckCircle, AlertCircle, Sun, Moon } from "lucide-react"
import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import PropTypes from "prop-types"
// preferences removed for Language & region section
import { API_URL } from "../api"

const ROLE_LABELS = {
  1: "Super Administrator",
  2: "Administrator",
  3: "Technician",
}

export default function Settings({ onAdminNavigate, adminNotice, onNoticeConsumed }) {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    updates: false,
  })
  const [securityNotice, setSecurityNotice] = useState("")
  const navigate = useNavigate()
  const location = useLocation()

  const emailVerified = Boolean(userData?.is_verified)
  const phoneNumber = userData?.contactnumber || userData?.contactNumber || ""
  const phoneVerified = Boolean(userData?.is_phone_verified ?? userData?.phoneVerified)
  const roleLabel = userData?.roleLabel || userData?.role || ROLE_LABELS[userData?.roleid] || "User"

  const handleVerifyEmail = () => {
    if (!userData?.email) return
    navigate("/verify-email?from=settings", { state: { email: userData.email, from: "settings" } })
  }

  const handleVerifyPhone = () => {
    if (!phoneNumber) {
      window.alert("Please add a phone number on your profile before verifying.")
      navigate("/Edit-Profile")
      return
    }

    navigate("/verify-phone", { state: { phoneNumber } })
  }

  useEffect(() => {
    const fetchUserData = async () => {
      try {
  const response = await fetch(`${API_URL}/user/me`, {
          credentials: 'include'
        })
        if (!response.ok) {
          // surface server response body for debugging (may be JSON or plain text)
          let body = null
          try {
            body = await response.text()
          } catch (e) {
            body = `<unreadable: ${String(e)}>`
          }
          // log status and body to help trace 500s in browser console during development
          console.error("GET /user/me failed", { status: response.status, body })
          setUserData(null)
          return
        }

        const data = await response.json()
        const rawUser = data?.data || {}
        setUserData({
          ...rawUser,
          contactnumber: rawUser?.contactnumber || rawUser?.contactNumber || "",
          roleLabel: rawUser?.roleLabel || rawUser?.role || ROLE_LABELS[rawUser?.roleid] || "User",
        })
      } catch {
  // log unexpected errors (network, JSON parse, etc.) to the console
  console.error("fetchUserData error", arguments)
        setUserData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  useEffect(() => {
    const notice = location.state?.securityNotice
    if (!notice) return

    setSecurityNotice(notice)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!adminNotice) return
    setSecurityNotice(adminNotice)
    onNoticeConsumed?.()
  }, [adminNotice, onNoticeConsumed])

  const handleNotificationToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleChangePassword = () => {
    if (typeof onAdminNavigate === "function") {
      onAdminNavigate("change-password")
      return
    }

    navigate("/Change-Password", { state: { from: "settings" } })
  }

  if (loading) {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white/85 px-4 py-3 text-emerald-600 shadow-sm shadow-emerald-900/5">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" aria-hidden="true" />
          <p className="text-sm font-medium">Loading settings…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-screen overflow-visible rounded-3xl border border-emerald-100/70 bg-white/90 p-6 pb-12 text-slate-900 shadow-sm shadow-emerald-900/5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-12 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-teal-200/30 blur-[120px]" />
      </div>
      <div className="relative space-y-8">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            <User className="h-4 w-4" />
            Account Settings
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800 md:text-[28px]">Account settings</h1>
            <p className="text-sm text-slate-500 md:text-base">Manage your profile, notifications, and security preferences.</p>
          </div>
        </header>

        {securityNotice ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-700 shadow-sm shadow-amber-900/10">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-semibold">Security notice</p>
              <p>{securityNotice}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Account information</h2>
                <p className="text-sm text-slate-500">Keep your contact details and permissions up to date.</p>
              </div>
            </div>

<div className="grid gap-5 md:grid-cols-2">
              <div className="group rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/30 p-6 shadow-sm shadow-emerald-900/5 transition-all duration-200 hover:shadow-md">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-600/70">Email</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{userData?.email || "N/A"}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm sm:self-center ${
                      emailVerified
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                        : "border-amber-200 bg-amber-100 text-amber-700"
                    }`}
                  >
                    {emailVerified ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {emailVerified ? "Verified" : "Not verified"}
                  </span>
                </div>
                {emailVerified ? (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    <CheckCircle className="h-5 w-5" />
                    Email verified
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:shadow-xl hover:from-emerald-400 hover:to-teal-400"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Verify email
                  </button>
                )}
              </div>

              <div className="group rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white to-emerald-50/30 p-6 shadow-sm shadow-emerald-900/5 transition-all duration-200 hover:shadow-md">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-600/70">Phone</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{phoneNumber || "Not added"}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm sm:self-center ${
                      phoneVerified
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                        : "border-amber-200 bg-amber-100 text-amber-700"
                    }`}
                  >
                    {phoneVerified ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {phoneVerified ? "Verified" : "Not verified"}
                  </span>
                </div>
                {phoneVerified ? (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    <CheckCircle className="h-5 w-5" />
                    Phone verified
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleVerifyPhone}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-600 hover:shadow-md"
                  >
                    <Phone className="h-4 w-4" />
                    {phoneNumber ? "Verify phone number" : "Add phone number"}
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-100/80 bg-white/75 p-5 shadow-sm shadow-emerald-900/5 md:col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600/70">Role</p>
                    <p className="text-sm font-medium text-slate-900">{roleLabel || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
                <p className="text-sm text-slate-500">We recommend updating your password every few months.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Update your password regularly to keep your account secure. Launch the in-app password tool to update your credentials safely.
            </p>
            <button
              type="button"
              onClick={handleChangePassword}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/10 transition hover:from-emerald-400 hover:to-teal-400"
            >
              Update password
            </button>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Notification preferences</h2>
                <p className="text-sm text-slate-500">Choose how you want to stay informed.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100/80 bg-white/75 p-4 shadow-sm shadow-emerald-900/5">
                <div>
                  <p className="font-semibold text-slate-900">Email notifications</p>
                  <p className="text-sm text-slate-500">Receive notifications via email.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationToggle("email")}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                    notifications.email ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      notifications.email ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-emerald-100/80 bg-white/75 p-4 shadow-sm shadow-emerald-900/5">
                <div>
                  <p className="font-semibold text-slate-900">Push notifications</p>
                  <p className="text-sm text-slate-500">Receive push notifications on your device.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationToggle("push")}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                    notifications.push ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      notifications.push ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-emerald-100/80 bg-white/75 p-4 shadow-sm shadow-emerald-900/5">
                <div>
                  <p className="font-semibold text-slate-900">System updates</p>
                  <p className="text-sm text-slate-500">Get notified about platform enhancements.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationToggle("updates")}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                    notifications.updates ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      notifications.updates ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </article>

          {/* Language & region removed per request */}
        </div>
      </div>
    </section>
  )
}

Settings.propTypes = {
  onAdminNavigate: PropTypes.func,
  adminNotice: PropTypes.string,
  onNoticeConsumed: PropTypes.func,
}

Settings.defaultProps = {
  onAdminNavigate: null,
  adminNotice: "",
  onNoticeConsumed: null,
}
