const supportedLanguages = ["pt-BR", "en-US"];

function isSupportedLanguage(language) {
  return supportedLanguages.includes(language);
}

function languageFromSystemLocale(locale, fallback = "en-US") {
  if (typeof locale !== "string" || !locale.trim()) return fallback;
  return /^pt(?:[-_]|$)/i.test(locale.trim()) ? "pt-BR" : fallback;
}

function resolveInitialLanguage(savedLanguage, getSystemLocale, fallback = "en-US") {
  if (isSupportedLanguage(savedLanguage)) {
    return {
      language: savedLanguage,
      shouldPersist: false
    };
  }

  try {
    return {
      language: languageFromSystemLocale(getSystemLocale(), fallback),
      shouldPersist: true
    };
  } catch {
    return {
      language: fallback,
      shouldPersist: true
    };
  }
}

module.exports = {
  isSupportedLanguage,
  languageFromSystemLocale,
  resolveInitialLanguage
};
