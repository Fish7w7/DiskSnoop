const supportedLanguages = ["pt-BR", "en-US"];

function isSupportedLanguage(language) {
  return supportedLanguages.includes(language);
}

function languageFromSystemLocale(locale, fallback = "pt-BR") {
  if (typeof locale !== "string" || !locale.trim()) return fallback;
  return locale.trim().toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
}

function resolveInitialLanguage(savedLanguage, getSystemLocale, fallback = "pt-BR") {
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
  languageFromSystemLocale,
  resolveInitialLanguage
};
