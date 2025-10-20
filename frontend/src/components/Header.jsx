import createRoleHeader from "./RoleHeaderFactory.jsx"
import { Map as MapIcon } from "lucide-react"

// technician header presets
const TECH_PAGE_META = {
  dashboard: { title: "Dashboard", subtitle: "Technician workspace" },
  "yield-inputs": { title: "Yield submissions", subtitle: "Log barangay harvests" },
  market: { title: "Market prices", subtitle: "Record local prices" },
  settings: { title: "Account settings", subtitle: "Manage your profile" },
}

const techHeaderConfig = {
  brandLabel: "GEOAGRITECH",
  brandIcon: MapIcon,
  defaultTitle: () => "Technician workspace",
  defaultSubtitle: () => "Keep barangay data current.",
  pageMeta: TECH_PAGE_META,
  profileHeading: () => "Technician",
  mapAction: { enabled: true, label: "View map", to: "/geospatial-map" },
  profileLinks: () => [
    { id: "profile", label: "View profile", to: "/profile" },
    { id: "edit-profile", label: "Edit profile", to: "/profile/edit" },
  ],
}

const TechnicianHeader = createRoleHeader(techHeaderConfig)

export default TechnicianHeader