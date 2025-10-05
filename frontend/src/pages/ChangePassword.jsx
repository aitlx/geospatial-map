import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react"
import PropTypes from "prop-types"

const INITIAL_STATE = Object.freeze({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
})

const passwordRules = [
  { id: "length", label: "At least 8 characters", test: (value) => value.length >= 8 },
  { id: "upper", label: "Contains an uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { id: "number", label: "Contains a number", test: (value) => /[0-9]/.test(value) },
  { id: "symbol", label: "Contains a special character", test: (value) => /[^A-Za-z0-9]/.test(value) },
]

const sanitizePasswordInput = (value) => {
  if (!value) return ""
  return value.normalize("NFKC")
}

const deriveRuleState = (password) =>
  passwordRules.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }))

const mapErrorMessage = (rawMessage) => {
  if (!rawMessage) {
    return "Unable to update the password right now. Please try again."
  }

  const normalized = rawMessage.toLowerCase()

  if (normalized.includes("internal server error")) {
    return "Unable to update the password right now. Please try again."
  }

  if (normalized.includes("unauthorized")) {
    return "Session expired. Please sign in again to continue."
  }

  return rawMessage
}

export default function ChangePassword({ onBack }) {
  const navigate = useNavigate()
  const [formState, setFormState] = useState(INITIAL_STATE)
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: null, message: "" })

  const ruleStates = useMemo(() => deriveRuleState(formState.newPassword), [formState.newPassword])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({
      ...prev,
      [name]: sanitizePasswordInput(name === "currentPassword" ? value : value.trim()),
    }))
  }

  const toggleVisibility = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const validateForm = () => {
    if (!formState.currentPassword || !formState.newPassword || !formState.confirmPassword) {
      setFeedback({ type: "error", message: "Please complete all fields." })
      return false
    }

    for (const requirement of passwordRules) {
      if (!requirement.test(formState.newPassword)) {
        setFeedback({ type: "error", message: "Password must meet all security requirements." })
        return false
      }
    }

    if (formState.newPassword !== formState.confirmPassword) {
      setFeedback({ type: "error", message: "New password and confirmation do not match." })
      return false
    }

    if (formState.currentPassword === formState.newPassword) {
      setFeedback({
        type: "error",
        message: "New password must be different from the current password.",
      })
      return false
    }

    setFeedback({ type: null, message: "" })
    return true
  }

  const handleNavigateBack = (options = {}) => {
    if (typeof onBack === "function") {
      onBack(options)
      return
    }

    if (options.notice) {
      navigate("/Settings", { state: { securityNotice: options.notice } })
      return
    }

    navigate("/Settings")
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        currentPassword: formState.currentPassword,
        newPassword: formState.newPassword,
        confirmPassword: formState.confirmPassword,
      }

      const { data } = await axios.post("/api/password/change", payload, { withCredentials: true })

      const successMessage = data?.message || "Password updated successfully."
      setFeedback({ type: "success", message: successMessage })

      setTimeout(() => {
        handleNavigateBack({ notice: successMessage })
      }, 900)
    } catch (error) {
      const responseMessage =
        error.response?.data?.message || error.response?.data?.error || error.message || ""
      setFeedback({ type: "error", message: mapErrorMessage(responseMessage) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
      <button
        type="button"
        onClick={handleNavigateBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to settings
      </button>

      <header className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Change password</h1>
          <p className="text-sm text-slate-500">
            Secure your account by choosing a strong password that meets all of the requirements below.
          </p>
        </div>
      </header>

      {feedback.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-600"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="currentPassword"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Current password
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              name="currentPassword"
              type={showPassword.current ? "text" : "password"}
              value={formState.currentPassword}
              onChange={handleInputChange}
              autoComplete="current-password"
              minLength={1}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
            />
            <button
              type="button"
              onClick={() => toggleVisibility("current")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword.current ? "Hide current password" : "Show current password"}
            >
              {showPassword.current ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            New password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              name="newPassword"
              type={showPassword.next ? "text" : "password"}
              value={formState.newPassword}
              onChange={handleInputChange}
              autoComplete="new-password"
              minLength={8}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
            />
            <button
              type="button"
              onClick={() => toggleVisibility("next")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword.next ? "Hide new password" : "Show new password"}
            >
              {showPassword.next ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Password requirements
            </div>
            <ul className="space-y-1">
              {ruleStates.map((rule) => (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 ${rule.passed ? "text-emerald-600" : "text-slate-500"}`}
                >
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      rule.passed
                        ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-500"
                    }`}
                    aria-hidden="true"
                  >
                    {rule.passed ? "✓" : ""}
                  </span>
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword.confirm ? "text" : "password"}
              value={formState.confirmPassword}
              onChange={handleInputChange}
              autoComplete="new-password"
              minLength={8}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
            />
            <button
              type="button"
              onClick={() => toggleVisibility("confirm")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword.confirm ? "Hide confirmation password" : "Show confirmation password"}
            >
              {showPassword.confirm ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleNavigateBack}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitting}
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </section>
  )
}

ChangePassword.propTypes = {
  onBack: PropTypes.func,
}
