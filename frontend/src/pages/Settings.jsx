import { User, Lock, Bell, Globe, Shield, Mail, Eye, EyeOff } from "lucide-react"
import { useState, useEffect } from "react"

export default function Settings() {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    updates: false,
  })

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/user/me', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setUserData(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (formData.newPassword !== formData.confirmPassword) {
      alert("Passwords don't match!")
      return
    }

    try {
      const response = await fetch('http://localhost:5000/api/user/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        })
      })

      if (response.ok) {
        alert('Password changed successfully!')
        setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        alert('Failed to change password')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
    }
  }

  const handleNotificationToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600 mx-auto"></div>
          <p className="text-sm text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-gray-600 text-sm mt-1">Manage your account preferences and security</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 xl:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <User className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Email</label>
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{userData?.email || "N/A"}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Role</label>
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <Shield className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{userData?.role || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 xl:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full h-12 px-4 pr-12 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">New Password</label>
              <input
                type="password"
                className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Confirm New Password</label>
              <input
                type="password"
                className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
            <button
              type="button"
              onClick={handlePasswordChange}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
            >
              Update Password
            </button>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
              <div>
                <p className="font-semibold text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
              <button
                type="button"
                onClick={() => handleNotificationToggle("email")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.email ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.email ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
              <div>
                <p className="font-semibold text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">Receive push notifications on your device</p>
              </div>
              <button
                type="button"
                onClick={() => handleNotificationToggle("push")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.push ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.push ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
              <div>
                <p className="font-semibold text-gray-900">System Updates</p>
                <p className="text-sm text-gray-600">Get notified about system updates</p>
              </div>
              <button
                type="button"
                onClick={() => handleNotificationToggle("updates")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.updates ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.updates ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Language & Region</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Language</label>
              <select className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all">
                <option>English (US)</option>
                <option>Filipino</option>
                <option>Spanish</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Timezone</label>
              <select className="w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all">
                <option>Asia/Manila (GMT+8)</option>
                <option>UTC</option>
                <option>America/New_York (GMT-5)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
