import React from 'react';
import { useTranslation } from 'react-i18next';

function MainLayout({ children, serverStatus, isServerOk }) {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <div className="text-2xl font-bold">
          {t('home.title')}
        </div>

        <div className={`text-sm ${isServerOk ? 'text-green-600' : 'text-red-500'}`}>
          {serverStatus}
        </div>

        <div className="ml-4">
          <select
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            onChange={(e) => handleLanguageChange(e.target.value)}
            value={i18n.language} 
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8">
        {children}
      </main>
    </div>
  );
}

export default MainLayout;
