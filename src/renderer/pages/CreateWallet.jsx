import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaSpinner, FaRegCopy } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

function CreateWallet({ setView }) {
  const { t } = useTranslation(); // Хук для переводов

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [walletData, setWalletData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Копирование текста в буфер обмена
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('createWallet.copySuccess'));
    } catch (err) {
      toast.error(t('createWallet.copyFail'));
    }
  };

  // Валидация телефона
  const validatePhone = (phoneValue) => {
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(phoneValue);
  };

  // Валидация email
  const validateEmail = (emailValue) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // Валидация пароля
  const validatePassword = (passwordValue) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(passwordValue);
  };

  // Обработка нажатия "Создать кошелёк"
  const handleCreate = async () => {
    if (!phone) {
      toast.error(t('createWallet.errorPhone'));
      return;
    }
    if (!validatePhone(phone)) {
      toast.error(t('createWallet.errorPhoneFormat'));
      return;
    }
    if (!email) {
      toast.error(t('createWallet.errorEmail'));
      return;
    }
    if (!validateEmail(email)) {
      toast.error(t('createWallet.errorEmailFormat'));
      return;
    }
    if (!password) {
      toast.error(t('createWallet.errorPassword'));
      return;
    }
    if (!validatePassword(password)) {
      toast.error(t('createWallet.errorPasswordFormat'));
      return;
    }

    try {
      setIsSubmitting(true);
      toast.info(t('createWallet.creatingToast'));

      const response = await axios.post('https://ifehuadmwallet.link/wallet-api/api/create-wallet', {
        phone,
        email,
        password,
      });

      setWalletData(response.data.wallet);
      toast.success(t('createWallet.successToast'));

      // Через 5 минут вернёмся на главную
      setTimeout(() => {
        setView('home');
      }, 300000);
    } catch (error) {
      console.error(t('createWallet.errorCreate'), error);
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(`Ошибка: ${error.response.data.message}`);
      } else {
        toast.error(t('createWallet.errorCreate'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      {/* Если кошелёк не создан, показываем форму */}
      {!walletData ? (
        <>
          <h2 className="text-2xl font-semibold mb-6">
            {t('createWallet.title')}
          </h2>

          <div className="space-y-4">
            {/* Телефон */}
            <div>
              <label className="block text-gray-700 font-medium mb-2" htmlFor="phone">
                {t('createWallet.phoneLabel')}
              </label>
              <input
                id="phone"
                type="text"
                placeholder={t('createWallet.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-gray-700 font-medium mb-2" htmlFor="email">
                {t('createWallet.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                placeholder={t('createWallet.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2" htmlFor="password">
                {t('createWallet.passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                placeholder={t('createWallet.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 
                           focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-gray-500 text-sm mt-1">
                {t('createWallet.passwordRules')}
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className={`
                w-full py-3 text-black rounded 
                transition duration-200 flex items-center justify-center
                ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#AAE71C] hover:bg-green-600'
                }
              `}
            >
              {isSubmitting ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  {t('createWallet.creating')}
                </>
              ) : (
                t('createWallet.createButton')
              )}
            </button>
            <button
              onClick={() => setView('home')}
              className="w-full py-3 rounded font-medium text-white 
                        bg-gray-900 hover:bg-gray-800 transition duration-200"
            >
              {t('resetPassword.backHome')}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">{t('createWallet.walletCreated')}</h3>

          <div className="bg-gray-100 p-4 rounded text-sm space-y-2">
            <div className="break-words">
              <strong>{t('createWallet.seedPhrase')}</strong> {walletData.seedPhrase}{' '}
              <button
                className="inline-flex items-center ml-2 text-gray-600 hover:text-gray-800"
                onClick={() => copyToClipboard(walletData.seedPhrase)}
              >
                <FaRegCopy className="mr-1" />
                <span className="text-xs">{t('createWallet.copySuccess')}</span>
              </button>
            </div>
            <div className="break-words">
              <strong>{t('createWallet.publicKey')}</strong> {walletData.publicKey}{' '}
              <button
                className="inline-flex items-center ml-2 text-gray-600 hover:text-gray-800"
                onClick={() => copyToClipboard(walletData.publicKey)}
              >
                <FaRegCopy className="mr-1" />
                <span className="text-xs">{t('createWallet.copySuccess')}</span>
              </button>
            </div>
            <div className="break-words">
              <strong>{t('createWallet.privateKey')}</strong> {walletData.privateKey}{' '}
              <button
                className="inline-flex items-center ml-2 text-gray-600 hover:text-gray-800"
                onClick={() => copyToClipboard(walletData.privateKey)}
              >
                <FaRegCopy className="mr-1" />
                <span className="text-xs">{t('createWallet.copySuccess')}</span>
              </button>
            </div>
          </div>

          <p className="text-red-600 text-sm">
            {t('createWallet.saveWarning')}
          </p>
          <button
            onClick={() => setView('home')}
            className="w-full py-3 bg-[#AAE71C] text-black rounded 
                      hover:bg-green-600 transition duration-200"
          >
            {t('createWallet.backHome')}
          </button>
        </div>
      )}
    </div>
  );
}

export default CreateWallet;
