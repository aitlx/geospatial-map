import { Crown, Edit, User } from "lucide-react"
import createRoleHeader from "./RoleHeaderFactory.jsx"

// superadmin header metadata
const SUPER_ADMIN_PAGE_META = {
	"dashboard-overview": {
		title: "Super admin dashboard",
		subtitle: "Oversee municipal programs, approvals, and analytics.",
	},
	"roles-access": {
		title: "Roles & access",
		subtitle: "Configure permissions and governance for admin teams.",
	},
	"user-management": {
		title: "User management",
		subtitle: "Manage administrators and technicians across the platform.",
	},
	"recommendations": {
		title: "Recommendations",
		subtitle: "Fine-tune AI crop recommendations and reference data.",
	},
	"activity-logs": {
		title: "Activity log",
		subtitle: "Audit administrator and technician actions across the system.",
	},
	backups: {
		title: "Backups",
		subtitle: "Manage secure data exports and scheduled backups.",
	},
	"system-settings": {
		title: "System settings",
		subtitle: "Configure municipality-wide defaults and platform behavior.",
	},
	settings: {
		title: "Account settings",
		subtitle: "Update profile preferences and security.",
	},
	profile: {
		title: "Profile",
		subtitle: "Review your administrator details.",
	},
	"edit-profile": {
		title: "Edit profile",
		subtitle: "Update contact details and display information.",
	},
	"change-password": {
		title: "Change password",
		subtitle: "Keep your credentials secure with a fresh password.",
	},
}

const superAdminHeaderConfig = {
	brandLabel: "GeoAgriTech",
	brandSegment: () => "Super Administration",
	brandIcon: Crown,
	descriptor: () => "Super Admin",
	roleBadge: () => "Super Admin",
	defaultTitle: () => "Super admin workspace",
	defaultSubtitle: () => "Oversee LGU governance and empower every barangay.",
	pageMeta: SUPER_ADMIN_PAGE_META,
	profileHeading: () => "Super Administrator",
	// point superadmins to the public map root so ProtectedRoute doesn't redirect them
	mapAction: { enabled: true, label: "View map", to: "/" },
	// provide explicit `to` routes so the header navigates to the admin SPA routes
	profileLinks: () => [
		{ id: "profile", label: "View profile", icon: User, featured: true, to: "/Profile" },
		{ id: "edit-profile", label: "Edit profile", icon: Edit, to: "/Edit-Profile" },
	],
}

const SuperAdminHeader = createRoleHeader(superAdminHeaderConfig)

export default SuperAdminHeader