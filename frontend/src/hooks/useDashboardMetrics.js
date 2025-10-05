import { useCallback, useEffect, useRef, useState } from "react"
import axios from "axios"

const INITIAL_STATE = {
  data: null,
  loading: true,
  error: null,
}

export function useDashboardMetrics() {
  const mountedRef = useRef(false)
  const [state, setState] = useState(INITIAL_STATE)

  const fetchMetrics = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await axios.get("/api/dashboard/metrics", { withCredentials: true })
      if (!mountedRef.current) return

      setState({
        data: response?.data?.data ?? null,
        loading: false,
        error: null,
      })
    } catch (error) {
      if (!mountedRef.current) return

      const message = error?.response?.data?.message || error.message || "Unable to load dashboard metrics."
      setState({ data: null, loading: false, error: message })
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchMetrics()
    return () => {
      mountedRef.current = false
    }
  }, [fetchMetrics])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh: fetchMetrics,
  }
}

export default useDashboardMetrics
