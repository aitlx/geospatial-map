// temporary placeholder for superadmin dashboard refresh
export default function SuperAdminDashboard() {
  // main insights will be added here later
  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/80 to-white px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl rounded-3xl border border-emerald-200/60 bg-white/90 px-8 py-14 text-center shadow-lg shadow-emerald-900/5">
        <h1 className="text-2xl font-semibold text-emerald-900 sm:text-3xl">Superadmin dashboard refresh</h1>
        <p className="mt-4 text-sm text-emerald-700 sm:text-base">
          We're reorganizing the superadmin insights to make them easier to navigate. For now, please use the sidebar links to access the tools you need.
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.28em] text-emerald-500">Updated experience coming soon</p>
      </div>
    </section>
  )
}