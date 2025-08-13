import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

function LoginWallet({ setView, setWalletData }) {
  const { t } = useTranslation();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/login',
        { phone, password }
      );
      const wallet = response.data.wallet;
      setWalletData(wallet); // Устанавливаем walletData в App.jsx
      setView('wallet'); // Переключаемся на страницу кошелька
      toast.success(t('loginWallet.loginSuccess'));
    } catch (error) {
      console.error(t('loginWallet.loginError'), error);

      toast.error(
        error.response?.data?.message || t('loginWallet.loginError')
      );

      setPhone('');
      setPassword('');
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">{t('loginWallet.title')}</h2>

        <div>
          <label
            className="block text-gray-700 font-medium mb-1"
            htmlFor="phone"
          >
            {t('loginWallet.phoneLabel')}
          </label>
          <input
            id="phone"
            type="text"
            placeholder={t('loginWallet.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 
                       focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label
            className="block text-gray-700 font-medium mb-1"
            htmlFor="password"
          >
            {t('loginWallet.passwordLabel')}
            </label>
          <input
            id="password"
            type="password"
            placeholder={t('loginWallet.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 
                       focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          onClick={handleLogin}
          className="w-full py-3 bg-[#AAE71C] text-[#030610] rounded
                     hover:bg-green-600 transition duration-200"
        >
          {t('loginWallet.loginButton')}
        </button>
        <button
          onClick={() => setView('home')}
          className="w-full py-3 rounded font-medium text-white 
                     bg-gray-900 hover:bg-gray-800 transition duration-200"
        >
          {t('resetPassword.backHome')}
        </button>
      </div>
    </div>
  );
}

export default LoginWallet;
