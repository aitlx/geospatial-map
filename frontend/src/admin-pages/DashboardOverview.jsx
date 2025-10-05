import AdminDashboard from "./AdminDashboard"
import SuperAdminDashboard from "./SuperAdminDashboard"

export default function DashboardOverview({ roleId }) {
  if (roleId === 1) {
    return <SuperAdminDashboard />
  }
  return <AdminDashboard />
}
