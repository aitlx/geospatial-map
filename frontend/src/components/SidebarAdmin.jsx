import {
	LayoutDashboard,
	ClipboardCheck,
	Sprout,
	Users,
	BarChart3,
	Settings,
	ShieldCheck,
	History,
	Cog,
	Database,
} from "lucide-react"

const MENU_SECTIONS = {
	superAdmin: [
		{
			items: [
				{ id: "dashboard-overview", label: "Superadmin's dashboard", icon: LayoutDashboard },
				{ id: "roles-access", label: "Roles & access", icon: ShieldCheck },
				{ id: "user-management", label: "User directory", icon: Users },
				{ id: "crop-configuration", label: "Recommendations", icon: Sprout },
				{ id: "activity-logs", label: "Activity log", icon: History },
				{ id: "backups", label: "Backups", icon: Database },
				{ id: "system-settings", label: "System settings", icon: Cog },
				{ id: "settings", label: "Account settings", icon: Settings },
			],
		},
	],
	admin: [
		{
			items: [
				{ id: "dashboard-overview", label: "Admin's dashboard", icon: LayoutDashboard },
				{ id: "submission-reviews", label: "Submissions", icon: ClipboardCheck },
				{ id: "crops-admin", label: "Crops", icon: Sprout },
				{ id: "user-management", label: "User management", icon: Users },
				{ id: "reports-analytics", label: "Analytics", icon: BarChart3 },
				{ id: "settings", label: "Account settings", icon: Settings },
			],
		},
	],
}

const SIDEBAR_WIDTH = "w-64"

export default function SidebarAdmin({ activeItem, onItemClick, roleId, isOpen, onClose }) {
	const roleKey = roleId === 1 ? "superAdmin" : "admin"
	const sections = MENU_SECTIONS[roleKey] ?? MENU_SECTIONS.admin
	const hasToggleState = typeof isOpen === "boolean"
	const resolvedOpen = hasToggleState ? isOpen : true

	const sidebarClasses = `fixed inset-y-0 left-0 z-50 flex h-full ${SIDEBAR_WIDTH} transform border-r border-emerald-100 bg-white/95 text-emerald-900 shadow-lg ring-1 ring-emerald-900/5 transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:${SIDEBAR_WIDTH} lg:translate-x-0 lg:flex-col lg:shadow-none ${
		resolvedOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
	}`

	const handleNavigate = (id) => {
		onItemClick?.(id)
		if (hasToggleState) {
			onClose?.()
		}
	}

	return (
		<>
			{hasToggleState ? (
				<button
					type="button"
					className={`fixed inset-0 z-40 bg-emerald-950/30 transition-opacity duration-300 lg:hidden ${
						resolvedOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
					}`}
					onClick={onClose}
					aria-label="Close admin navigation"
				/>
			) : null}

			<aside className={sidebarClasses} aria-label="Admin navigation">
				<div className="flex h-full flex-1 flex-col overflow-hidden">
					<div className="border-b border-emerald-100/80 px-5 py-5">
						<div className="flex items-center gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 3l2.25 4.5L19 8l-3.5 3.5L16 17l-4-2-4 2 .5-5.5L5 8l4.75-.5L12 3z" />
								</svg>
							</div>
							<div className="leading-tight">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">GeoAgriTech</p>
								<p className="text-[11px] font-medium text-emerald-500/80">
									{roleId === 1 ? "Super Admin" : "Admin"}
								</p>
							</div>
						</div>
					</div>

					<nav className="flex-1 overflow-y-auto px-4 py-5">
						<div className="space-y-6">
							{sections.map((section, index) => (
								<div key={section.title || index} className="space-y-3">
									{section.title ? (
										<p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
											{section.title}
										</p>
									) : null}
									<ul className="space-y-1.5">
										{section.items.map((item) => {
											const Icon = item.icon
											const isActive = activeItem === item.id

											return (
												<li key={item.id}>
													<button
														type="button"
														onClick={() => handleNavigate(item.id)}
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
														<span className="flex-1 truncate text-left text-sm">{item.label}</span>
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
						© 2025 GeoAgriTech
					</div>
				</div>
			</aside>
		</>
	)
}