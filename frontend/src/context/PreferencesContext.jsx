import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import PropTypes from "prop-types"
import { LANGUAGE_IDS, LANGUAGE_METADATA, TRANSLATIONS, formatTemplate } from "../utils/i18n.js"

const PreferencesContext = createContext(null)

const LANGUAGE_STORAGE_KEY = "workspace-language"
const DEFAULT_THEME = "light"
const DEFAULT_LANGUAGE = "en"
const SUPPORTED_THEMES = new Set(["light", "dark"])
const SUPPORTED_LANGUAGES = new Set(LANGUAGE_IDS)

const getPreferredTheme = () => {
  if (typeof window === "undefined") {
    return DEFAULT_THEME
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  } catch {
    return DEFAULT_THEME
  }
}

const getStoredPreference = (key, fallback) => {
  if (typeof window === "undefined") {
    return fallback
  }

  try {
    const stored = window.localStorage.getItem(key)
    if (stored) {
      return stored
    }
  } catch {
    return fallback
  }

  return fallback
}

export function PreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(() => getPreferredTheme())

  const [language, setLanguageState] = useState(() => {
    const storedLanguage = getStoredPreference(LANGUAGE_STORAGE_KEY, null)
    if (storedLanguage && SUPPORTED_LANGUAGES.has(storedLanguage)) {
      return storedLanguage
    }
    return DEFAULT_LANGUAGE
  })

  useEffect(() => {
    if (typeof document === "undefined") return

    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.dataset.theme = theme
    root.style.colorScheme = theme === "dark" ? "dark" : "light"
  }, [theme])

  useEffect(() => {
    if (typeof window === "undefined") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (event) => {
      setThemeState(event.matches ? "dark" : "light")
    }

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange)
    } else if (typeof media.addListener === "function") {
      media.addListener(handleChange)
    }

    setThemeState(media.matches ? "dark" : "light")

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleChange)
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handleChange)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      window.localStorage.removeItem("workspace-theme")
    } catch {
      /* ignore storage cleanup errors */
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      /* ignore preference persistence errors */
    }
  }, [language])

  const setTheme = useCallback((nextTheme) => {
    if (!SUPPORTED_THEMES.has(nextTheme)) return
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const setLanguage = useCallback((nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.has(nextLanguage)) return
    setLanguageState(nextLanguage)
  }, [])

  const translate = useCallback(
    (key, fallback = "", values = {}) => {
      if (typeof key !== "string") {
        return formatTemplate(fallback ?? "", values)
      }

      const dictionary = TRANSLATIONS[language] ?? TRANSLATIONS.en ?? {}
      const defaultDictionary = TRANSLATIONS.en ?? {}
      const template = dictionary[key] ?? (typeof fallback === "string" ? fallback : null) ?? defaultDictionary[key] ?? key
      return formatTemplate(template, values)
    },
    [language]
  )

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, language, setLanguage, translate, languages: LANGUAGE_METADATA }),
    [theme, setTheme, toggleTheme, language, setLanguage, translate]
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

PreferencesProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePreferences = () => {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider")
  }
  return context
}
