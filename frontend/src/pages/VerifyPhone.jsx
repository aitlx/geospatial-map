import { Phone, ArrowLeft } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

export default function VerifyPhone() {
  const navigate = useNavigate()
  const location = useLocation()
  const phoneNumber = location.state?.phoneNumber || ""

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white px-4 py-12">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-emerald-100/60 bg-white/90 p-8 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <Phone className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Phone verification coming soon</h1>
          <p className="mt-3 text-sm text-gray-600">
            SMS-based verification is being finalized. We&apos;ll notify you once one-time passcodes are available.
            In the meantime, confirm that your contact number is accurate so you can be verified right away.
          </p>

          <div className="mt-6 w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-left text-sm text-emerald-800">
            <p className="font-semibold">Current phone number</p>
            <p className="mt-1 text-base text-emerald-700">{phoneNumber || "Not added"}</p>
          </div>

          <div className="mt-6 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate("/Edit-Profile")}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transition hover:from-green-600 hover:to-emerald-700"
            >
              Update phone number
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-600 transition hover:bg-emerald-50"
            >
              Return to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
