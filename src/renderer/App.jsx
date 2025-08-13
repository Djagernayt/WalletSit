import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MainLayout from './layouts/MainLayout';

import CreateWallet from './pages/CreateWallet';
import LoginWallet from './pages/LoginWallet';
import ResetPassword from './pages/ResetPassword';
import WalletPage from './pages/WalletPage';
import logo from './assets/logo1.png';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState('home');
  const [serverStatus, setServerStatus] = useState('');
  const [walletData, setWalletData] = useState(null);

  useEffect(() => {
    const pingServer = async () => {
      if (window.api && typeof window.api.ping === 'function') {
        try {
          const status = await window.api.ping();
          setServerStatus(status);
          toast.success(t('home.serverstat1') + status);
        } catch (err) {
          setServerStatus(t('home.server_call_error'));
          toast.error(t('home.server_call_error'));
        }
      } else {
        // console.error('window.api.ping недоступен');
        setServerStatus(t('home.server_api_error'));
        toast.error(t('home.server_api_error'));
      }
    };
    pingServer();
  }, []);

  const isServerOk = serverStatus && !serverStatus.includes('Не удалось');

  return (
    <MainLayout 
      serverStatus={serverStatus} 
      isServerOk={isServerOk}
    >
      {view === 'wallet' && walletData && <WalletPage walletData={walletData} />}

      {view !== 'wallet' && (
        <div className="w-full max-w-4xl bg-gray-300 p-6 rounded-md shadow-md flex">
          <div className="w-1/2 pr-4 flex flex-col justify-center">
            {view === 'home' && (
              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => setView('create')}
                  className="px-4 py-2 bg-[#AAE71C] text-[#030610] rounded hover:bg-green-600 transition"
                >
                  {t('home.createWallet')}
                </button>
                <button
                  onClick={() => setView('login')}
                  className="px-4 py-2 bg-[#030610] text-[#AAE71C] rounded hover:bg-green-600 transition"
                >
                  {t('home.haveWallet')}
                </button>
                <button
                  onClick={() => setView('reset')}
                  className="px-4 py-2 bg-[#E7E7E7] text-[#030610] rounded hover:bg-green-600 transition"
                >
                  {t('home.forgotPassword')}
                </button>
              </div>
            )}

            {view === 'create' && <CreateWallet setView={setView} />}
            {view === 'login' && <LoginWallet setView={setView} setWalletData={setWalletData} />}
            {view === 'reset' && <ResetPassword setView={setView} />}
          </div>

          <div className="w-1/2 flex items-center justify-center">
            <img
              src={logo}
              alt="Fehu Logo"
              className="max-w-xs object-contain"
            />
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </MainLayout>
  );
}

export default App;
