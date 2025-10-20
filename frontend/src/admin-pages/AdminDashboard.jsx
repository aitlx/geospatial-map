// small placeholder while dashboard is being reorganized
export default function AdminDashboard() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl rounded-3xl border border-emerald-200/70 bg-white/90 px-8 py-14 text-center shadow-lg shadow-emerald-900/5">
        <h1 className="text-2xl font-semibold text-emerald-900 sm:text-3xl">Dashboard maintenance in progress</h1>
        <p className="mt-4 text-sm text-emerald-700 sm:text-base">
          The admin dashboard content is temporarily unavailable while we reorganize the experience. All core actions remain accessible from the navigation menu.
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.28em] text-emerald-500">Please check back soon</p>
      </div>
    </section>
  )
}