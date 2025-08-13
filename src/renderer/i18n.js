import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';
import ruTranslation from './locales/ru/translation.json';

const resources = {
  en: {
    translation: enTranslation,
  },
  ru: {
    translation: ruTranslation,
  },
};

const savedLanguage = localStorage.getItem('lang') || 'en'; 


// i18n
//   .use(initReactI18next)
//   .init({
//     resources,
//     lng: 'ru', // Язык по умолчанию (можно 'en')
//     fallbackLng: 'en', // Запасной язык, если нет ключей в основном
//     interpolation: {
//       escapeValue: false, // react уже экранирует
//     },
//     debug: true, // Можно включить для отладки, потом выключить
//   });

// export default i18n;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      ru: { translation: ruTranslation },
    },
    lng: savedLanguage,   // Устанавливаем язык из localStorage
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
