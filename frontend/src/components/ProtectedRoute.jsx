import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import axios from "axios";

// auth check states
const AUTH_STATES = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "forbidden",
};

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(AUTH_STATES.LOADING);
  const [roleId, setRoleId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const response = await axios.get("/api/user/me", { withCredentials: true });
        if (!isMounted) return;

        const user = response.data?.data;
        const resolvedRoleId = user?.roleid ?? user?.roleID ?? null;
        setRoleId(resolvedRoleId);

        if (resolvedRoleId !== 3) {
          setStatus(AUTH_STATES.FORBIDDEN);
          return;
        }

        setStatus(AUTH_STATES.AUTHENTICATED);
      } catch {
        if (isMounted) {
          setRoleId(null);
          setStatus(AUTH_STATES.UNAUTHENTICATED);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (status === AUTH_STATES.LOADING) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-white">
        <div className="flex flex-col items-center gap-3 text-emerald-700">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-500" aria-hidden="true" />
          <p className="text-sm font-medium">Checking session…</p>
        </div>
      </div>
    );
  }

  if (status === AUTH_STATES.UNAUTHENTICATED) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }


  if (status === AUTH_STATES.FORBIDDEN) {
    const target = roleId === 1 || roleId === 2 ? "/admin/dashboard" : "/login";
    return <Navigate to={target} replace state={{ from: location }} />;
  }
  return children;
}
