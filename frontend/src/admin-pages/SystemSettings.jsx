import { Cog } from "lucide-react"

export default function SystemSettings() {
  return (
    <section className="px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-cyan-200 bg-white p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">
          <Cog className="h-4 w-4 text-cyan-500" />
          System Settings
        </div>
        <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">System controls</h1>
        <p className="text-sm text-slate-500">
          Platform-wide toggles are being finalized so super administrators can govern maintenance windows, feature
          flags, and notification pipelines. We&apos;re preparing the workflows to mirror the crop recommendation
          configuration experience.
        </p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          System settings tooling is still in preparation. Once activated, you&apos;ll be able to stage maintenance
          mode, manage audit integrations, and broadcast platform notices from here.
        </div>
      </div>
    </section>
  )
}
