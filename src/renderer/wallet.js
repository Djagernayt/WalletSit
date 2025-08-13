import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaSpinner } from 'react-icons/fa';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Wallet({ walletData }) {
  const [balance, setBalance] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('usd');
  const [equivalentValue, setEquivalentValue] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingRates, setLoadingRates] = useState(true);
  const [error, setError] = useState(null);

  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmountFehu, setTransferAmountFehu] = useState('');
  const [transferAmountCurrency, setTransferAmountCurrency] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [lastChanged, setLastChanged] = useState(null);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isCreatePinModalOpen, setIsCreatePinModalOpen] = useState(false);
  const [isRecoverPinModalOpen, setIsRecoverPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [recoverWord1, setRecoverWord1] = useState('');
  const [recoverWord2, setRecoverWord2] = useState('');
  const [pinCreated, setPinCreated] = useState(false);

  const [depositAddress, setDepositAddress] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositStatus, setDepositStatus] = useState(null); 
  const [deposits, setDeposits] = useState([]);
  const [depositUsdtAmount, setDepositUsdtAmount] = useState('');
  const [equivalentFehuAmount, setEquivalentFehuAmount] = useState('');

  const supportedCurrencies = ['usd', 'eur', 'gbp', 'rub', 'jpy', 'cny'];

  const checkIfPinExists = async () => {
    try {
      const response = await axios.post('https://ifehuadmwallet.link/wallet-api/api/check-pin', {}, {
        headers: {
          Authorization: `Bearer ${walletData.token}`,
        },
      });
      setPinCreated(response.data.pinExists);
    } catch (error) {
      console.error('Ошибка при проверке наличия PIN-кода:', error);
      toast.error('Ошибка при проверке наличия PIN-кода.');
    }
  };

  const [selectedNetwork, setSelectedNetwork] = useState('polygon');

  const supportedNetworks = [
    { name: 'Polygon PoS', value: 'polygon' },
    { name: 'Binance Smart Chain (BEP20)', value: 'bsc' },
    { name: 'TRC20 (Tron)', value: 'tron' },
    { name: 'Solana', value: 'solana' },
    { name: 'TON (The Open Network)', value: 'ton' },
  ];

  const getExplorerLink = (network, txHash) => {
    switch (network) {
      case 'polygon':
        return `https://polygonscan.com/tx/${txHash}`;
      case 'bsc':
        return `https://bscscan.com/tx/${txHash}`;
      case 'tron':
        return `https://tronscan.org/#/transaction/${txHash}`;
      case 'solana':
        return `https://explorer.solana.com/tx/${txHash}`;
      case 'ton':
        return `https://tonscan.org/transactions/${txHash}`;
      default:
        return '#';
    }
  };

  const fetchDeposits = async () => {
    try {
      const response = await axios.get('https://ifehuadmwallet.link/wallet-api/api/get-deposits', {
        headers: {
          Authorization: `Bearer ${walletData.token}`,
        },
      });
      setDeposits(response.data.deposits);
    } catch (error) {
      console.error('Ошибка получения депозитов:', error);
      toast.error('Ошибка получения депозитов.');
    }
  };
  
  useEffect(() => {
    fetchDeposits();
    const interval = setInterval(fetchDeposits, 60000);
    return () => clearInterval(interval);
  }, []);


  const fetchDepositAddress = async () => {
    try {
      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/get-deposit-address',
        { network: selectedNetwork },
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );
      setDepositAddress(response.data.depositAddress);
    } catch (error) {
      console.error('Ошибка получения адреса пополнения:', error);
      toast.error('Ошибка получения адреса для пополнения.');
    }
  };

  const handleUsdtAmountChange = (e) => {
    const usdtAmount = e.target.value;
    setDepositUsdtAmount(usdtAmount);
  
    if (exchangeRates && exchangeRates['usd'] && !isNaN(usdtAmount) && usdtAmount !== '') {
      const exchangeRate = exchangeRates['usd']; 
      const fehuAmount = usdtAmount / exchangeRate * 12.4;
      setEquivalentFehuAmount(fehuAmount.toFixed(8));
    } else {
      setEquivalentFehuAmount('');
    }
  };
  

  const handleDepositSent = async () => {
    if (!depositUsdtAmount || isNaN(depositUsdtAmount) || depositUsdtAmount <= 0) {
      toast.error('Пожалуйста, введите корректную сумму USDT.');
      return;
    }
  
    try {
      const response = await axios.post(
        '  https://ifehuadmwallet.link/wallet-api/api/start-deposit-check',
        {
          network: selectedNetwork,
          amount: depositUsdtAmount,
        },
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );
  
      if (response.status === 200) {
        toast.success('Проверка транзакции начата. Ожидайте подтверждения.');
        fetchDeposits();
      }
    } catch (error) {
      console.error('Ошибка при запуске проверки депозита:', error);
      toast.error('Ошибка при запуске проверки депозита.');
    }
  };
  

  useEffect(() => {
    if (selectedNetwork) {
      fetchDepositAddress();
    }
  }, [selectedNetwork]);

  useEffect(() => {
    fetchBalance();
    fetchExchangeRates();
    checkIfPinExists();
  }, []);

  const fetchBalance = async () => {
    try {
      setLoadingBalance(true);
      const response = await axios.get('https://ifehuadmwallet.link/wallet-api/api/get-balance', {
        params: { address: walletData.publicKey },
        headers: {
          Authorization: `Bearer ${walletData.token}`,
        },
      });
      setBalance(response.data.balance);
      setError(null);
    } catch (error) {
      console.error('Ошибка получения баланса', error);
      setError('Ошибка получения баланса');
      toast.error('Ошибка получения баланса.');
    } finally {
      setLoadingBalance(false);
    }
  };

  // const fetchExchangeRates = async () => {
  //   try {
  //     setLoadingRates(true);
  //     const response = await axios.get('https://sitworldstat.link/api/rates');
  //     console.log('Данные курсов валют:', response.data); 

  //     let filteredRates = {};

  //     if (Array.isArray(response.data)) {
  //       filteredRates = response.data
  //         .filter((item) => supportedCurrencies.includes(item.currency.toLowerCase()))
  //         .reduce((obj, item) => {
  //           obj[item.currency.toLowerCase()] = item.rate;
  //           return obj;
  //         }, {});
  //     } else if (typeof response.data === 'object') {
  //       filteredRates = Object.keys(response.data)
  //         .filter((currency) => supportedCurrencies.includes(currency.toLowerCase()))
  //         .reduce((obj, key) => {
  //           obj[key.toLowerCase()] = response.data[key];
  //           return obj;
  //         }, {});
  //     } else {
  //       throw new Error('Неизвестный формат данных курсов валют');
  //     }

  //     setExchangeRates(filteredRates);
  //     setError(null);
  //   } catch (error) {
  //     console.error('Ошибка получения курсов валют:', error);
  //     setError('Ошибка получения курсов валют');
  //     toast.error('Ошибка получения курсов валют.');
  //   } finally {
  //     setLoadingRates(false);
  //   }
  // };

  const fetchExchangeRates = async () => {
    try {
      setLoadingRates(true);
      const response = await axios.get('https://sitworldstat.link/api/rates');
      console.log('Данные курсов валют:', response.data);
  
      const rates = response.data; // Предполагаем, что API возвращает объект с курсами
      setExchangeRates(rates);
      setError(null);
    } catch (error) {
      console.error('Ошибка получения курсов валют:', error);
      setError('Ошибка получения курсов валют');
      toast.error('Ошибка получения курсов валют.');
    } finally {
      setLoadingRates(false);
    }
  };  

  useEffect(() => {
    if (balance !== null && exchangeRates && selectedCurrency) {
      console.log('selectedCurrency:', selectedCurrency);
      const rate = exchangeRates[selectedCurrency.toLowerCase()];
      console.log('rate:', rate);
      if (rate) {
        const value = balance * rate * 0.124;
        setEquivalentValue(value);
      } else {
        setEquivalentValue(null);
      }
    }
  }, [balance, exchangeRates, selectedCurrency]);

  const formatValue = (value, currency) => {
    if (typeof currency !== 'string') {
      console.error(`Некорректный код валюты: ${currency}`);
      return value;
    }
    
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency.toUpperCase(),
        maximumFractionDigits: 2,
      }).format(value);
    } catch (error) {
      console.error(`Ошибка форматирования валюты: ${currency}`, error);
      return value;
    }
  };

  const currencyOptions = exchangeRates ? Object.keys(exchangeRates) : [];

  const handleFehuChange = (e) => {
    const value = e.target.value;
    setTransferAmountFehu(value);
    setLastChanged('fehu');
    if (exchangeRates && selectedCurrency && !isNaN(value) && value !== '') {
      const rate = exchangeRates[selectedCurrency.toLowerCase()];
      if (rate) {
        const equivalent = value * rate * 0.124;
        setTransferAmountCurrency(equivalent.toFixed(8));
      } else {
        setTransferAmountCurrency('');
      }
    } else {
      setTransferAmountCurrency('');
    }
  };

  const handleCurrencySelectionChange = (e) => {
    const currency = e.target.value;
    setSelectedCurrency(currency);
    setLastChanged('currency');
    if (exchangeRates && currency && exchangeRates[currency.toLowerCase()] !== 0 && transferAmountCurrency !== '') {
      const equivalent = transferAmountCurrency / exchangeRates[currency.toLowerCase()];
      setTransferAmountFehu(equivalent.toFixed(8));
    } else {
      setTransferAmountFehu('');
    }
  };

  const handleCurrencyAmountChange = (e) => {
    const value = e.target.value;
    setTransferAmountCurrency(value);
    setLastChanged('currency');
    if (exchangeRates && selectedCurrency && !isNaN(value) && value !== '') {
      const rate = exchangeRates[selectedCurrency.toLowerCase()];
      if (rate) {
        const equivalent = value / rate * 12.4;
        setTransferAmountFehu(equivalent.toFixed(8));
      } else {
        setTransferAmountFehu('');
      }
    } else {
      setTransferAmountFehu('');
    }
  };

  const handleTransfer = async () => {
    if (!recipientAddress) {
      toast.error('Пожалуйста, введите адрес получателя.');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      toast.error('Некорректный адрес получателя.');
      return;
    }

    if (!transferAmountFehu || !transferAmountCurrency) {
      toast.error('Пожалуйста, введите сумму для отправки.');
      return;
    }

    if (transferAmountFehu <= 0) {
      toast.error('Сумма перевода должна быть положительным числом.');
      return;
    }

    if (pinCreated) {
      setIsPinModalOpen(true);
    } else {
      toast.warn('Для отправки транзакции необходимо создать PIN-код.');
      setIsCreatePinModalOpen(true);
    }
  };

  const confirmEnteredPin = async () => {
    if (enteredPin.length !== 4) {
      toast.error('PIN-код должен состоять из 4 цифр.');
      return;
    }

    try {
      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/verify-pin',
        { pin: enteredPin },
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );

      if (response.status === 200) {
        toast.success('PIN-код верный. Транзакция выполняется...');
        setIsPinModalOpen(false);
        executeTransfer();
      }
    } catch (error) {
      console.error('Неверный PIN-код:', error);
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(`Ошибка: ${error.response.data.message}`);
      } else {
        toast.error('Неверный PIN-код.');
      }
      setEnteredPin('');
    }
  };


  const executeTransfer = async () => {
    try {
      setIsTransferring(true);
      toast.info('Отправка транзакции...');

      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/transfer-tokens',
        {
          recipientAddress,
          amount: transferAmountFehu,
        },
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );

      toast.success(`Транзакция успешно отправлена! Хэш: ${response.data.transactionHash}`);

      fetchBalance();

      setRecipientAddress('');
      setTransferAmountFehu('');
      setTransferAmountCurrency('');
    } catch (error) {
      console.error('Ошибка при отправке транзакции:', error);
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(`Ошибка: ${error.response.data.message}`);
      } else {
        toast.error('Ошибка при отправке транзакции');
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const createPinCode = async () => {
    if (newPin.length !== 4 || confirmPinInput.length !== 4) {
      toast.error('PIN-код должен состоять из 4 цифр.');
      return;
    }

    if (newPin !== confirmPinInput) {
      toast.error('PIN-коды не совпадают.');
      return;
    }

    try {
      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/set-pin',
        { pin: newPin },
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );

      if (response.status === 200) {
        toast.success('PIN-код успешно установлен.');
        setPinCreated(true);
        setIsCreatePinModalOpen(false);
      }
    } catch (error) {
      console.error('Ошибка при установке PIN-кода на сервере:', error);
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(`Ошибка: ${error.response.data.message}`);
      } else {
        toast.error('Ошибка при установке PIN-кода на сервере.');
      }
    }
  };

  const recoverPinCode = async () => {
    if (!recoverWord1 || !recoverWord2) {
      toast.error('Пожалуйста, введите оба слова из вашей сид-фразы.');
      return;
    }

    try {
      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/recover-pin',
        {
          wordIndices: [0, 1],
          words: [recoverWord1, recoverWord2],
        },
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );

      if (response.status === 200) {
        toast.success(response.data.message);
        setIsRecoverPinModalOpen(false);
        setIsCreatePinModalOpen(true);
      }
    } catch (error) {
      console.error('Ошибка восстановления PIN-кода:', error);
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(`Ошибка: ${error.response.data.message}`);
      } else {
        toast.error('Ошибка при восстановлении PIN-кода');
      }
    }
  };

  return (
    <div className="mt-8 space-y-6 relative">
      {!pinCreated && (
        <button
          onClick={() => setIsCreatePinModalOpen(true)}
          className="absolute top-4 right-4 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition duration-200"
        >
          Создать PIN
        </button>
      )}

      {pinCreated && (
        <button
          onClick={() => setIsRecoverPinModalOpen(true)}
          className="absolute top-4 right-4 px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition duration-200"
        >
          Восстановить PIN
        </button>
      )}
      <h2 className="text-2xl font-semibold">Ваш кошелек</h2>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Информация о кошельке</h3>
        <p>
          <strong>Публичный ключ:</strong> {walletData.publicKey}
        </p>
        {/* приватного ключа и сид-фразу не видно */}
        {/* <p>
          <strong>Приватный ключ:</strong> {walletData.privateKey}
        </p>
        <p>
          <strong>Сид-фраза:</strong> {walletData.seedPhrase}
        </p> */}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Баланс</h3>
        {loadingBalance ? (
          <p>Загрузка баланса...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p>
            <strong>Баланс:</strong> {balance} iFehu
          </p>
        )}

        {loadingRates ? (
          <p>Загрузка курсов валют...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <div className="mt-4">
              <label htmlFor="currency" className="mr-2">
                Выберите валюту:
              </label>
              <select
                id="currency"
                value={selectedCurrency}
                onChange={handleCurrencySelectionChange}
                className="border rounded px-3 py-2"
              >
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency.toUpperCase()}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchBalance}
                className={`ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${
                  loadingBalance ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={loadingBalance}
              >
                {loadingBalance ? 'Обновляется...' : 'Обновить'}
              </button>
            </div>

            {equivalentValue !== null && (
              <p>
                <strong>Эквивалентная стоимость:</strong>{' '}
                {formatValue(equivalentValue, selectedCurrency)}
              </p>
            )}
          </>
        )}
      </div>
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Пополнение кошелька</h3>
        <div className="mt-4">
          <label htmlFor="network" className="mr-2">
            Выберите сеть:
          </label>
          <select
            id="network"
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {supportedNetworks.map((network) => (
              <option key={network.value} value={network.value}>
                {network.name}
              </option>
            ))}
          </select>
        </div>
        <p>Для пополнения кошелька отправьте USDT на следующий адрес:</p>
        <div className="bg-gray-100 p-4 rounded">
          <p>
            <strong>Адрес:</strong> {depositAddress}
          </p>
          <p>
            <strong>Сеть:</strong> {supportedNetworks.find((n) => n.value === selectedNetwork)?.name}
          </p>
        </div>

        <div className="mt-4">
          <label htmlFor="usdtAmount" className="block text-gray-700 mb-1">
            Сумма USDT для отправки
          </label>
          <input
            id="usdtAmount"
            type="number"
            placeholder="Введите сумму в USDT"
            value={depositUsdtAmount}
            onChange={handleUsdtAmountChange}
            className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {equivalentFehuAmount !== '' && (
          <p className="mt-2">
            Вы получите примерно <strong>{equivalentFehuAmount} iFEHU</strong> после подтверждения транзакции.
          </p>
        )}

        <button
          onClick={handleDepositSent}
          className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-200"
        >
          Отправил
        </button>

        <h4 className="text-lg font-semibold mt-4">История пополнений</h4>
        {deposits.length === 0 ? (
          <p>Нет пополнений.</p>
        ) : (
          <ul>
            {deposits.map((deposit) => (
              <li key={deposit.id} className="border p-2 rounded mb-2">
                <p>
                  <strong>Сумма:</strong> {deposit.amount_usdt} USDT
                </p>
                <p>
                  <strong>Статус:</strong>{' '}
                  {deposit.status === 'pending'
                    ? 'Ожидание подтверждения'
                    : deposit.status === 'confirmed'
                    ? 'Подтверждено'
                    : deposit.status === 'completed'
                    ? 'Завершено'
                    : 'Ошибка'}
                </p>
                <p>
                  <strong>Транзакция:</strong>{' '}
                  {deposit.tx_hash ? (
                    <a
                      href={getExplorerLink(deposit.network, deposit.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      Посмотреть
                    </a>
                  ) : (
                    'Транзакция в обработке...'
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Перевод монет</h3>
        <div className="flex flex-col space-y-4">
          <input
            type="text"
            placeholder="Адрес получателя"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
            <div className="flex-1">
              <label className="block text-gray-700 mb-1" htmlFor="amountFehu">
                Сумма (iFehu)
              </label>
              <input
                id="amountFehu"
                type="number"
                placeholder="Введите сумму в iFehu"
                value={transferAmountFehu}
                onChange={handleFehuChange}
                className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1">
              <label className="block text-gray-700 mb-1" htmlFor="amountCurrency">
                Сумма ({selectedCurrency.toUpperCase()})
              </label>
              <input
                id="amountCurrency"
                type="number"
                placeholder={`Введите сумму в ${selectedCurrency.toUpperCase()}`}
                value={transferAmountCurrency}
                onChange={handleCurrencyAmountChange}
                className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleTransfer}
          className={`mt-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition duration-200 w-full flex items-center justify-center ${
            isTransferring ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={isTransferring}
        >
          {isTransferring ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Отправка...
            </>
          ) : (
            'Отправить'
          )}
        </button>
      </div>

      {/* Модальное окно для ввода PIN-кода */}
      <Modal
        isOpen={isPinModalOpen}
        onRequestClose={() => setIsPinModalOpen(false)}
        contentLabel="Введите PIN-код"
        className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <h2 className="text-xl font-semibold mb-4">Введите PIN-код</h2>
        <input
          type="password"
          maxLength="4"
          placeholder="****"
          value={enteredPin}
          onChange={(e) => setEnteredPin(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4 text-center text-2xl"
        />
        <button
          onClick={confirmEnteredPin}
          className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
        >
          Подтвердить
        </button>
      </Modal>

      <Modal
        isOpen={isCreatePinModalOpen}
        onRequestClose={() => setIsCreatePinModalOpen(false)}
        contentLabel="Создать PIN-код"
        className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <h2 className="text-xl font-semibold mb-4">Создайте PIN-код</h2>
        <input
          type="password"
          maxLength="4"
          placeholder="Введите PIN-код"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4 text-center text-2xl"
        />
        <input
          type="password"
          maxLength="4"
          placeholder="Подтвердите PIN-код"
          value={confirmPinInput}
          onChange={(e) => setConfirmPinInput(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4 text-center text-2xl"
        />
        <button
          onClick={createPinCode}
          className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-200"
        >
          Создать
        </button>
      </Modal>

      <Modal
        isOpen={isRecoverPinModalOpen}
        onRequestClose={() => setIsRecoverPinModalOpen(false)}
        contentLabel="Восстановление PIN-кода"
        className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <h2 className="text-xl font-semibold mb-4">Восстановление PIN-кода</h2>
        <p className="mb-4">
          Пожалуйста, введите два слова из вашей мнемонической фразы для восстановления PIN-кода.
        </p>
        <input
          type="text"
          placeholder="Слово 1"
          value={recoverWord1}
          onChange={(e) => setRecoverWord1(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4"
        />
        <input
          type="text"
          placeholder="Слово 2"
          value={recoverWord2}
          onChange={(e) => setRecoverWord2(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4"
        />
        <button
          onClick={recoverPinCode}
          className="w-full py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-200"
        >
          Восстановить PIN
        </button>
      </Modal>
    </div>
  );
}

export default Wallet;
