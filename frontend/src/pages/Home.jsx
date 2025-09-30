import React, { useCallback, useState } from "react"
import Sidebar from "../components/Sidebar"
import Market from "./Market"
import YieldInput from "./YieldInput"
import Header from "../components/Header"
import DashboardContent from "../components/Dashboard"
import Profile from "./Profile"
import EditProfile from "../components/EditProfile"
import Settings from "./Settings"

export default function Home() {
  const [activeItem, setActiveItem] = useState("dashboard")
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("")

  const handleProfileSuccessHandled = useCallback(() => {
    setProfileSuccessMessage("")
  }, [])

  return (
    <div className="flex">
      {/* sidebar */}
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />

      {/* main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* header */}
        <Header setActiveItem={setActiveItem} />

        {/* content */}
        <div className="p-6 bg-gray-50 flex-1">
          {activeItem === "dashboard" && <DashboardContent />}
          {activeItem === "yield-inputs" && <YieldInput />}
          {activeItem === "market" && <Market />}
          {activeItem === "profile" && (
            <Profile
              successMessage={profileSuccessMessage}
              onSuccessMessageHandled={handleProfileSuccessHandled}
            />
          )}
          {activeItem === "edit-profile" && (
            <EditProfile
              onCancel={() => setActiveItem("profile")}
              onSuccess={(_, message) => {
                setActiveItem("profile")
                setProfileSuccessMessage(message || "Profile updated successfully!")
              }}
            />
          )}
          {activeItem === "settings" && <Settings />}
        </div>
      </div>
    </div>
  )
}