import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { translations, LANGUAGES, DEFAULT_LANG } from './translations';

const LANG_KEY = 'appLanguage';
const I18nContext = createContext(null);

// Language from the device, if we support it; otherwise English.
function deviceLang() {
  try {
    const locales = Localization.getLocales?.() || [];
    const code = (locales[0]?.languageCode || DEFAULT_LANG).toLowerCase();
    return LANGUAGES.some((l) => l.code === code) ? code : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(null); // null while loading
  const [chosen, setChosen] = useState(false); // did the user pick a language before?

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(LANG_KEY);
      setChosen(!!saved);
      setLangState(saved || deviceLang());
    })();
  }, []);

  const setLang = useCallback(async (l) => {
    setLangState(l);
    setChosen(true);
    await AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback((key, params) => {
    const dict = translations[lang] || translations[DEFAULT_LANG];
    let s = dict[key];
    if (s == null) s = translations[DEFAULT_LANG][key];
    if (s == null) return key;
    if (params) {
      for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
    }
    return s;
  }, [lang]);

  if (!lang) return null; // still loading the preference

  return (
    <I18nContext.Provider value={{ lang, setLang, t, chosen }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  return ctx || { lang: DEFAULT_LANG, t: (k) => k, setLang: () => {}, chosen: true };
}
