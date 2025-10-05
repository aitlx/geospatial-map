const PRIMARY_GEOSPATIAL_PATH = "/geospatial-map";

export const VIEW_TO_PATH = Object.freeze({
  dashboard: "/Dashboard",
  "yield-inputs": "/Yield-Inputs",
  market: "/Market",
  "geospatial-map": PRIMARY_GEOSPATIAL_PATH,
  profile: "/Profile",
  "edit-profile": "/Edit-Profile",
  settings: "/Settings",
  "change-password": "/Change-Password",
});

const ALTERNATE_VIEW_PATHS = Object.freeze({
  "geospatial-map": ["/Geospatial-Map", "/user/Geospatial-Map", "/user/geospatial-map"],
});

const PATH_VIEW_ENTRIES = [
  ...Object.entries(VIEW_TO_PATH),
  ...Object.entries(ALTERNATE_VIEW_PATHS).flatMap(([view, paths]) =>
    paths.map((path) => [view, path])
  ),
];

export const PATH_TO_VIEW = Object.freeze(
  PATH_VIEW_ENTRIES.reduce((acc, [view, path]) => {
    acc[path.toLowerCase()] = view;
    return acc;
  }, {})
);

export const getPathForView = (view) => {
  if (!view) return null;

  if (view === "geospatial-map") {
    return PRIMARY_GEOSPATIAL_PATH;
  }

  return VIEW_TO_PATH[view] || null;
};

export const getViewFromPath = (pathname) => {
  if (!pathname) return null;
  return PATH_TO_VIEW[pathname.toLowerCase()] || null;
};

export const getGeospatialPathForRole = () => PRIMARY_GEOSPATIAL_PATH;
