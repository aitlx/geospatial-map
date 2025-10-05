import { useMemo } from "react"
import { ArrowRight, Bell, ChevronDown, Menu } from "lucide-react"

const ROLE_LABELS = {
1: "Superadmin",
2: "Admin",
}

const DEFAULT_METADATA = {
title: "Admin workspace",
description: "Manage GeoAgriTech operations and keep barangay data accurate.",
chips: [],
}

const PAGE_METADATA = {
"dashboard-overview": ({ roleId }) => ({
title: roleId === 1 ? "Superadmin dashboard" : "Admin dashboard",
description:
roleId === 1
? "System-wide insights, approvals, and analytics for your LGU."
: "Monitor approvals, technician submissions, and barangay performance.",
chips: roleId === 1 ? ["System oversight"] : ["Approvals focus"],
}),
"submission-reviews": () => ({
title: "Submission reviews",
description: "Approve or reject barangay yield and price submissions.",
chips: ["Workflow"],
}),
"reports-analytics": () => ({
title: "Reports & analytics",
description: "Explore barangay performance trends and yield analytics.",
chips: ["Insights"],
}),
"user-management": () => ({
title: "User directory",
description: "Invite, update, or deactivate technician accounts across barangays.",
chips: ["Directory"],
}),
"roles-access": () => ({
title: "Roles & access",
description: "Configure permissions and governance for admin teams.",
chips: ["Security"],
}),
"crops-admin": () => ({
title: "Crop catalogue",
description: "Maintain the list of crops and their reference data.",
chips: ["Inventory"],
}),
settings: () => ({
title: "Account settings",
description: "Update admin profile information and account preferences.",
chips: ["Profile"],
}),
profile: () => ({
title: "Profile",
description: "Review your administrator details.",
chips: ["Profile"],
}),
"edit-profile": () => ({
title: "Edit profile",
description: "Update your contact details and display information.",
chips: ["Profile"],
}),
"change-password": () => ({
title: "Change password",
description: "Keep your account secure with an updated password.",
chips: ["Security"],
}),
}

const formatName = (user) => {
const first = user?.firstname?.trim() || user?.firstName?.trim() || ""
const last = user?.lastname?.trim() || user?.lastName?.trim() || ""
const full = `${first} ${last}`.trim()
return full.length ? full : user?.email || "Administrator"
}

const getInitials = (user) => {
const first = user?.firstname?.trim() || user?.firstName?.trim() || ""
const last = user?.lastname?.trim() || user?.lastName?.trim() || ""
const initials = `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase()
if (initials.length) return initials
const email = user?.email || ""
return email.slice(0, 2).toUpperCase() || "AD"
}

const buildMetadata = (activeItem, roleId) => {
const resolver = PAGE_METADATA[activeItem]
if (resolver) {
return resolver({ roleId })
}
return DEFAULT_METADATA
}

export default function AdminHeader({ user, roleId: roleIdProp, activeItem, onNavigate, onToggleSidebar }) {
const resolvedRoleId = roleIdProp ?? user?.roleID ?? user?.roleid ?? 2
const roleLabel = ROLE_LABELS[resolvedRoleId] || "Admin"

const metadata = useMemo(() => buildMetadata(activeItem, resolvedRoleId), [activeItem, resolvedRoleId])

const quickAction = useMemo(() => {
if (typeof onNavigate !== "function") return null
if (resolvedRoleId === 1 && activeItem !== "roles-access") {
return { label: "Manage access", target: "roles-access" }
}
if (activeItem !== "submission-reviews") {
return { label: "Review submissions", target: "submission-reviews" }
}
return null
}, [activeItem, onNavigate, resolvedRoleId])

const handleQuickAction = () => {
if (quickAction?.target && typeof onNavigate === "function") {
onNavigate(quickAction.target)
}
}

return (
<header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-white/80 backdrop-blur">
<div className="px-4 py-4 sm:px-6 lg:px-8">
<div className="flex items-center justify-between gap-4">
<div className="flex flex-1 items-center gap-4">
<button
type="button"
onClick={onToggleSidebar}
className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
aria-label="Toggle admin sidebar"
>
<Menu className="h-5 w-5" />
</button>

<div className="space-y-1">
<p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">{roleLabel} area</p>
<div className="flex flex-wrap items-center gap-2 text-emerald-900">
<h1 className="text-2xl font-semibold sm:text-3xl">{metadata.title}</h1>
{metadata.chips?.length ? (
<div className="flex flex-wrap gap-2">
{metadata.chips.map((chip) => (
<span
key={chip}
className="inline-flex items-center rounded-full bg-emerald-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700"
>
{chip}
</span>
))}
</div>
) : null}
</div>
<p className="text-sm text-emerald-600">{metadata.description}</p>
</div>
</div>

<div className="flex items-center gap-3">
{quickAction ? (
<button
type="button"
onClick={handleQuickAction}
className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:inline-flex"
>
<span>{quickAction.label}</span>
<ArrowRight className="h-4 w-4" />
</button>
) : null}

<button
type="button"
className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
aria-label="View notifications"
>
<Bell className="h-5 w-5" />
<span className="sr-only">Open notifications</span>
</button>

<div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/90 px-3 py-2 shadow-sm">
<div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
<span className="text-sm font-semibold uppercase">{getInitials(user)}</span>
</div>
<div className="leading-tight">
<p className="text-sm font-semibold text-emerald-900">{formatName(user)}</p>
<p className="text-xs text-emerald-500">{user?.email ?? "admin@geoagritech.com"}</p>
</div>
<button
type="button"
className="rounded-lg border border-transparent p-1 text-emerald-500 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
aria-label="Account menu"
>
<ChevronDown className="h-4 w-4" />
</button>
</div>
</div>
</div>
</div>
</header>
)
}
