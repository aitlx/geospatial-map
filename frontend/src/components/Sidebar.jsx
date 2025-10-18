import { Home, Leaf, DollarSign, Settings } from "lucide-react"
import { useTranslation } from "../hooks/useTranslation.js"

const MENU_SECTIONS = [
  {
    titleKey: "sidebar.section.workspace",
    items: [
      { id: "dashboard", labelKey: "sidebar.link.dashboard", icon: Home },
      { id: "yield-inputs", labelKey: "sidebar.link.yield", icon: Leaf },
      { id: "market", labelKey: "sidebar.link.price", icon: DollarSign },
    ],
  },
  {
    titleKey: "sidebar.section.account",
    items: [{ id: "settings", labelKey: "sidebar.link.settings", icon: Settings }],
  },
]

// sidebar width
const SIDEBAR_WIDTH = "w-64"

export default function Sidebar({ activeItem, onItemClick, isOpen = true, onClose }) {
  const hasToggleState = typeof isOpen === "boolean"
  const resolvedOpen = hasToggleState ? isOpen : true
  const { t } = useTranslation()

  const sidebarClasses = `fixed inset-y-0 left-0 z-50 flex h-full ${SIDEBAR_WIDTH} transform border-r border-emerald-100/80 bg-white/95 text-emerald-900 shadow-lg ring-1 ring-emerald-900/5 transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:${SIDEBAR_WIDTH} lg:translate-x-0 lg:flex-col lg:shadow-none ${
    resolvedOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
  }`

  return (
    <>
      {hasToggleState ? (
        <button
          type="button"
          className={`fixed inset-0 z-40 bg-emerald-950/30 transition-opacity duration-300 lg:hidden ${
            resolvedOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={onClose}
          aria-label={t("sidebar.close", "Close navigation")}
        />
      ) : null}

      <aside className={sidebarClasses} aria-label="Technician navigation">
          <div className="flex h-full flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-emerald-100/80 px-5 py-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12l8-4.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12v8" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 12L4 7.5" />
                </svg>
              </div>
              <div className="leading-tight">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                    {t("app.brand", "GeoAgriTech")}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-500/80">
                    {t("app.tagline", "Technician workspace")}
                  </p>
                </div>
            </div>

            {/* inner close button removed; overlay + hamburger control sidebar on small screens */}
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-6">
              {MENU_SECTIONS.map((section) => (
                <div key={section.titleKey} className="space-y-3">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                    {t(section.titleKey)}
                  </p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeItem === item.id

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onItemClick(item.id)}
                            aria-current={isActive ? "page" : undefined}
                            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                              isActive
                                ? "bg-emerald-100/90 text-emerald-900 shadow-inner shadow-emerald-200"
                                : "text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 transition ${
                                isActive
                                  ? "bg-emerald-500/15"
                                  : "bg-emerald-500/10 group-hover:bg-emerald-500/15"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="flex-1 truncate text-left text-sm leading-tight">
                              {t(item.labelKey)}
                            </span>
                            {/* subtle chevron for active items on lg screens */}
                            {isActive ? <span className="hidden lg:inline text-xs text-emerald-500">●</span> : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <div className="border-t border-emerald-100/80 px-5 py-4 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400/70">
            © {new Date().getFullYear()} {t("app.brand", "GeoAgriTech")}
          </div>
        </div>
      </aside>
    </>
  )
}