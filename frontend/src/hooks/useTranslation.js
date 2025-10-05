import { usePreferences } from "../context/PreferencesContext.jsx"

export const useTranslation = () => {
  const { translate, language, languages, setLanguage } = usePreferences()
  return {
    t: translate,
    language,
    languages,
    setLanguage,
  }
}
