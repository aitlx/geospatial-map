import AdminDashboard from "./AdminDashboard"
import SuperAdminDashboard from "./SuperAdminDashboard"

// choose dashboard view based on role
export default function DashboardOverview({ roleId }) {
  if (roleId === 1) {
    return <SuperAdminDashboard />
  }
  return <AdminDashboard />
}
