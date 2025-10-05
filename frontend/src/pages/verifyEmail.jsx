import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import axios from "axios"
import { ToastContainer, toast } from "react-toastify"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
  Menu,
  RefreshCw,
  X,
} from "lucide-react"
import "react-toastify/dist/ReactToastify.css"
import Header from "../components/Header"
import Sidebar from "../components/Sidebar"

const STATUS = {
  idle: "idle",
  pending: "pending",
  success: "success",
  error: "error",
  already: "already",
}

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const originView = useMemo(() => {
    const stateSource = typeof location.state?.from === "string" ? location.state.from.toLowerCase() : ""
    const querySource = (params.get("from") || "").toLowerCase()
    return stateSource || querySource || ""
  }, [location.state, params])

  const queryEmail = params.get("email") || ""
  const stateEmail = location.state?.email || ""
  const initialEmail = (stateEmail || queryEmail || "").trim().toLowerCase()

  const [emailAddress, setEmailAddress] = useState(initialEmail)
  const [status, setStatus] = useState(params.get("code") ? STATUS.pending : STATUS.idle)
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [manualVerificationUrl, setManualVerificationUrl] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendPending, setResendPending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const activeItem = originView === "settings" ? "settings" : "verify-email"
  const isAlreadyVerified = status === STATUS.already
  const successButtonLabel = isAlreadyVerified && originView === "settings" ? "Back to settings" : "Go to login"

  const verificationAttempted = useRef(false)
  const autoSendEligible = useRef(Boolean(initialEmail))

  const handleBack = useCallback(() => {
    if (originView === "settings") {
      navigate("/Settings", { replace: true, state: { activeView: "settings" } })
      return
    }

    navigate("/login", { replace: true })
  }, [navigate, originView])

  const handleHeaderNavigate = useCallback(
    (view) => {
      if (!view) return

      if (view === "settings") {
        navigate("/Settings")
        return
      }

      if (view === "geospatial-map") {
        navigate("/Geospatial-Map")
        return
      }

      navigate("/login")
    },
    [navigate]
  )

  const handleSidebarNavigate = useCallback(
    (view) => {
      setSidebarOpen(false)
      if (!view) return

      if (view === "settings") {
        navigate("/Settings")
        return
      }

      if (view === "geospatial-map") {
        navigate("/Geospatial-Map")
        return
      }

      navigate("/login")
    },
    [navigate]
  )

  const handleSuccessAction = useCallback(() => {
    if (isAlreadyVerified && originView === "settings") {
      navigate("/Settings", { replace: true, state: { activeView: "settings" } })
      return
    }

    navigate("/login", { replace: true })
  }, [isAlreadyVerified, navigate, originView])

  useEffect(() => {
    const emailFromState = (location.state?.email || "").trim().toLowerCase()
    const emailFromQuery = (params.get("email") || "").trim().toLowerCase()
    const nextEmail = emailFromState || emailFromQuery

    if (nextEmail && nextEmail !== emailAddress) {
      setEmailAddress(nextEmail)
    }
  }, [location.state, params, emailAddress])

  useEffect(() => {
    let ignore = false

    const checkVerificationStatus = async () => {
      if (status === STATUS.pending || status === STATUS.success || status === STATUS.already) {
        return
      }

      try {
        const response = await axios.get("/api/user/me", { withCredentials: true })
        if (ignore) return

        const user = response.data?.data
        if (user?.email && !emailAddress) {
          setEmailAddress(user.email.trim().toLowerCase())
        }

        if (user?.is_verified) {
          autoSendEligible.current = false
          setManualVerificationUrl("")
          setStatus((prev) => {
            if (prev === STATUS.success) return prev
            return STATUS.already
          })
          setFeedbackMessage((prev) => prev || "Your email is already verified.")
        }
      } catch (error) {
        if (error.response?.status === 401) {
          return
        }
        setManualVerificationUrl("")
      }
    }

    checkVerificationStatus()

    return () => {
      ignore = true
    }
  }, [emailAddress, status])

  useEffect(() => {
    if (resendCooldown <= 0) return

    const timer = setTimeout(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => clearTimeout(timer)
  }, [resendCooldown])

  const verifyLink = useCallback(
    async (emailValue, codeValue) => {
      const normalizedEmail = emailValue ? emailValue.trim().toLowerCase() : ""
      if (!normalizedEmail || !codeValue) return

      setStatus(STATUS.pending)
      setFeedbackMessage("")

      try {
        const response = await axios.patch("/api/auth/verify-code", {
          email: normalizedEmail,
          code: codeValue,
        })

        toast.success(response.data?.message || "Email verified successfully!")
        setStatus(STATUS.success)
        setFeedbackMessage("Your email is now verified.")

        setTimeout(() => {
          navigate("/login", { replace: true })
        }, 1800)
      } catch (error) {
        const errMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Verification failed. Please request a new link."

        setStatus(STATUS.error)
        setFeedbackMessage(errMessage)
      }
    },
    [navigate]
  )

  useEffect(() => {
    const codeFromQuery = params.get("code")
  const emailForVerification = (params.get("email") || emailAddress || "").trim().toLowerCase()

    if (!codeFromQuery || verificationAttempted.current) {
      return
    }

    verificationAttempted.current = true
    verifyLink(emailForVerification, codeFromQuery)
  }, [params, emailAddress, verifyLink])

  const handleResend = useCallback(
    async (event) => {
      event?.preventDefault?.()

      if (resendCooldown > 0 || resendPending) return

      const normalizedEmail = emailAddress.trim().toLowerCase()

      if (!normalizedEmail) {
        toast.error("Please enter your email address first.")
        return
      }

      setResendPending(true)
      setFeedbackMessage("")

      try {
        const response = await axios.post("/api/auth/send-code", { email: normalizedEmail })
        const payload = response.data?.data || {}
        const alreadyVerified = Boolean(payload?.alreadyVerified || response.data?.alreadyVerified)
        const fallbackLink = payload?.verificationUrl || response.data?.verificationUrl || ""

        if (alreadyVerified) {
          toast.info(response.data?.message || "Your email is already verified.")
          setManualVerificationUrl("")
          setFeedbackMessage("Your email is already verified.")
          setStatus(STATUS.already)
          setResendCooldown(0)
          autoSendEligible.current = false
        } else if (response.status === 202 && fallbackLink) {
          toast.info("Email delivery failed, but a manual verification link is ready.")
          setManualVerificationUrl(fallbackLink)
          setFeedbackMessage("Copy the link below and open it in your browser to verify manually.")
          setStatus(STATUS.error)
          setResendCooldown(60)
        } else {
          toast.success("A fresh verification link is on its way to your inbox.")
          setManualVerificationUrl("")
          setFeedbackMessage("")
          setStatus(STATUS.idle)
          setResendCooldown(60)
        }

        verificationAttempted.current = false
      } catch (error) {
        const errMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to resend verification link."
        toast.error(errMessage)
        setFeedbackMessage(errMessage)
        setStatus(STATUS.error)
        setManualVerificationUrl(
          error.response?.data?.data?.verificationUrl || error.response?.data?.verificationUrl || ""
        )
      } finally {
        setResendPending(false)
      }
    },
    [emailAddress, resendCooldown, resendPending]
  )

  useEffect(() => {
    if (!autoSendEligible.current) return
    if (!emailAddress) return
    if (status !== STATUS.idle) return
    if (resendPending || resendCooldown > 0) return

    autoSendEligible.current = false
    handleResend()
  }, [emailAddress, handleResend, resendCooldown, resendPending, status])

  const handleEmailInput = useCallback(
    (event) => {
      setEmailAddress(event.target.value.trim().toLowerCase())
      autoSendEligible.current = false
      if (status === STATUS.error) {
        setStatus(STATUS.idle)
        setFeedbackMessage("")
      }
    },
    [status]
  )

  const renderInstructions = () => {
    if (status === STATUS.pending) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verifying your email…</span>
        </div>
      )
    }

    if (status === STATUS.error && (feedbackMessage || manualVerificationUrl)) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <div>{feedbackMessage || "Verification encountered an issue."}</div>
          {manualVerificationUrl ? (
            <a
              href={manualVerificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
            >
              Open manual verification link
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      )
    }

    return null
  }

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 text-slate-900">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-10 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-teal-200/35 blur-3xl" />
        <div className="absolute top-1/3 right-28 h-44 w-44 rounded-full bg-emerald-100/30 blur-2xl" />
      </div>

      <button
        type="button"
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-white p-2 shadow-lg transition hover:bg-emerald-50 lg:hidden"
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? (
          <X className="h-6 w-6 text-emerald-600" />
        ) : (
          <Menu className="h-6 w-6 text-emerald-600" />
        )}
      </button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-300 lg:relative lg:z-10 lg:w-72 lg:translate-x-0`}
      >
        <Sidebar
          activeItem={activeItem}
          onItemClick={handleSidebarNavigate}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-1 flex-col bg-transparent">
        <Header setActiveItem={handleHeaderNavigate} activeItem={activeItem} />

        <main className="flex-1 overflow-y-auto px-4 pb-16 pt-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white/90 text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline focus-visible:outline-emerald-300"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-white/90 shadow-[0_30px_80px_-40px_rgba(16,185,129,0.55)] backdrop-blur">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
              <div className="relative space-y-6 px-8 py-10 sm:px-10 sm:py-12">
                {status === STATUS.success || status === STATUS.already ? (
                  <div className="space-y-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {isAlreadyVerified ? "You're already verified" : "All set!"}
                      </h1>
                      <p className="text-sm text-gray-600">
                        {feedbackMessage ||
                          (isAlreadyVerified
                            ? "Your email is already verified."
                            : "Your email is now verified. You can sign in using your credentials.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSuccessAction}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:shadow-xl"
                    >
                      {successButtonLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <MailCheck className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h1 className="text-2xl font-semibold text-gray-900">Verify your email</h1>
                        <p className="text-sm text-gray-600">
                          We&apos;ve sent a secure verification link to
                          {emailAddress ? (
                            <span className="font-semibold text-emerald-600"> {emailAddress}</span>
                          ) : (
                            <span className="font-semibold text-emerald-600"> your inbox</span>
                          )}
                          . Open the email and tap the button to confirm your account.
                        </p>
                      </div>
                    </div>

                    {renderInstructions()}

                    <form onSubmit={handleResend} className="space-y-4">
                      <div className="space-y-2 text-left">
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">
                          Email address
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={emailAddress}
                          onChange={handleEmailInput}
                          placeholder="you@example.com"
                          className="w-full rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          required
                          autoComplete="email"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={resendCooldown > 0 || resendPending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {resendPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending link…
                          </>
                        ) : resendCooldown > 0 ? (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Resend available in {resendCooldown}s
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Send verification link
                          </>
                        )}
                      </button>
                    </form>

                    <p className="text-center text-xs text-gray-500">
                      Having trouble? Check your spam folder or contact
                      <a className="font-semibold text-emerald-600" href="mailto:support@geoagritech.com">
                        {" "}support@geoagritech.com
                      </a>
                      .
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
