import { Home, Database, TrendingUp, Settings } from "lucide-react"

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "yield-inputs", label: "Yield Inputs", icon: Database },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
]

export default function Sidebar({ activeItem, onItemClick }) {
  return (
    <div className="w-64 bg-gradient-to-b from-slate-800 to-slate-900 text-white h-screen flex flex-col sticky top-0 self-start overflow-hidden">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4M9 7l6 3"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">GeoAgriTech</h1>
            <p className="text-xs text-slate-400">Technician Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full justify-start text-left h-12 px-4 rounded-xl flex items-center transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/50"
                      : "text-slate-300 hover:text-white hover:bg-green-500/10 hover:shadow-md"
                  }`}
                  onClick={() => onItemClick(item.id)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 flex-shrink-0">
        <div className="text-xs text-slate-400 text-center">
          © 2024 GeoAgriTech
        </div>
      </div>
    </div>
  )
}