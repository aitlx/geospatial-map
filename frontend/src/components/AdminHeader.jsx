import { ShieldCheck, Edit, User } from "lucide-react"
import createRoleHeader from "./RoleHeaderFactory.jsx"

// admin header page metadata
const ADMIN_PAGE_META = {
	"dashboard-overview": (roleId) => ({
		title: roleId === 2 ? "Admin dashboard" : "Dashboard overview",
		subtitle:
			roleId === 2
				? "Monitor approvals, submissions, and barangay performance."
				: "Review recent activity and municipal health.",
	}),
	"submission-reviews": {
		title: "Submission reviews",
		subtitle: "Approve or reject barangay yield and price submissions.",
	},
	"crop-management": {
		title: "Crop management",
		subtitle: "Maintain crop records, categories, and reference data.",
	},
	"user-management": {
		title: "User management",
		subtitle: "Manage technician accounts and enforce role policies.",
	},
	"reports-analytics": {
		title: "Reports",
		subtitle: "Explore barangay performance trends and analytics.",
	},
	settings: {
		title: "Account settings",
		subtitle: "Update profile preferences and notification rules.",
	},
	profile: {
		title: "Profile",
		subtitle: "Review administrator details and contact information.",
	},
	"edit-profile": {
		title: "Edit profile",
		subtitle: "Update your contact details and display information.",
	},
	"change-password": {
		title: "Change password",
		subtitle: "Keep your account secure with an updated password.",
	},
}

const adminHeaderConfig = {
	brandLabel: "GeoAgriTech",
	brandSegment: () => "Administration",
	brandIcon: ShieldCheck,
	descriptor: () => "Admin",
	roleBadge: (roleId) => (roleId === 1 ? "Super Admin" : "Municipal Admin"),
	defaultTitle: () => "Admin workspace",
	defaultSubtitle: () => "Coordinate municipal approvals and barangay support.",
	pageMeta: ADMIN_PAGE_META,
	profileHeading: () => "Administrator",
	// point admins to the public map root so ProtectedRoute doesn't redirect them
	mapAction: { enabled: true, label: "View map", to: "/" },
	// provide explicit `to` routes so the header navigates to the admin SPA routes
	profileLinks: () => [
		{ id: "profile", label: "View profile", icon: User, featured: true, to: "/Profile" },
		{ id: "edit-profile", label: "Edit profile", icon: Edit, to: "/Edit-Profile" },
	],
}

const AdminHeader = createRoleHeader(adminHeaderConfig)

export default AdminHeader