import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaSpinner, FaRegCopy, FaPlus } from 'react-icons/fa';
import Modal from 'react-modal';

import { useTranslation } from 'react-i18next';

Modal.setAppElement('#root');

// Смена пароля в лк добавить в след версии

function WalletPage({ walletData }) {
  const { t } = useTranslation();
  // 1) ------------------ STATE: Общие ------------------
  const [balance, setBalance] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('usd');
  const [equivalentValue, setEquivalentValue] = useState(null);

  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingRates, setLoadingRates] = useState(true);
  const [error, setError] = useState(null);

  // 2) ------------------ STATE: PIN ------------------
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isCreatePinModalOpen, setIsCreatePinModalOpen] = useState(false);
  const [isRecoverPinModalOpen, setIsRecoverPinModalOpen] = useState(false);
  const [pinCreated, setPinCreated] = useState(false);

  const [enteredPin, setEnteredPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [recoverWord1, setRecoverWord1] = useState('');
  const [recoverWord2, setRecoverWord2] = useState('');

  // 3) ------------------ STATE: Depots & Orders ------------------
  const [depositAddress, setDepositAddress] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [orders, setOrders] = useState([]);

  // 4) ------------------ STATE: Email confirm ------------------
  const [userEmail, setUserEmail] = useState('');
  const [isEmailConfirmed, setIsEmailConfirmed] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');

  // 5) ------------------ STATE: Transfer fields ------------------
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmountFehu, setTransferAmountFehu] = useState('');
  const [transferAmountCurrency, setTransferAmountCurrency] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // 6) ------------------ STATE: Выбор вкладок / прочее ------------------
  const [activeTab, setActiveTab] = useState('wallet');
  const [activeTab2, setActiveTab2] = useState('usdt');

  // 7) ------------------ STATE: P2P ------------------
  const [depositFiat, setDepositFiat] = useState('');
  const [depositIfehu, setDepositIfehu] = useState('');
  const [selectedFiat, setSelectedFiat] = useState('usd');

  // const [lastChanged, setLastChanged] = useState(null);

  // const [depositUsdtAmount, setDepositUsdtAmount] = useState('');
  // const [equivalentFehuAmount, setEquivalentFehuAmount] = useState('');
  
  // const [depositAmount, setDepositAmount] = useState('');
  const [depositStatus, setDepositStatus] = useState(null); 

  // P2P
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState('Все');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('Все');
  const [purchaseAmountFilter, setPurchaseAmountFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newOrderType, setNewOrderType] = useState('buy');
  const [newOrderCurrency, setNewOrderCurrency] = useState('RUB');
  const [newOrderLimitMin, setNewOrderLimitMin] = useState('100');
  const [newOrderLimitMax, setNewOrderLimitMax] = useState('2000');
  const [newOrderPaymentMethod, setNewOrderPaymentMethod] = useState('bank');
  const [newOrderBankName, setNewOrderBankName] = useState('Sberbank');
  const [newOrderBankAccount, setNewOrderBankAccount] = useState('');
  const [newOrderBlockchain, setNewOrderBlockchain] = useState('polygon');
  const [newOrderCoin, setNewOrderCoin] = useState('USDT');
  const [newOrderCryptoAddress, setNewOrderCryptoAddress] = useState('');

  // Выбранный ордер
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Таймер p2p (30 мин)
  const [timeLeft, setTimeLeft] = useState(0);
  const timerIdRef = useRef(null);

  // Сети / валюты
  const [selectedNetwork, setSelectedNetwork] = useState('polygon');
  const supportedNetworks = [
    { name: 'Polygon PoS', value: 'polygon' },
    { name: 'Binance Smart Chain (BEP20)', value: 'bsc' },
    { name: 'TRC20 (Tron)', value: 'tron' },
    // { name: 'Solana', value: 'solana' },
    // { name: 'TON (The Open Network)', value: 'ton' },
  ];
  const supportedCurrencies = ['usd', 'eur', 'gbp', 'rub', 'jpy', 'cny'];

  // 7) ------------------ useEffect: Инициализация ------------------
  useEffect(() => {
    // При первом рендере / при смене token
    (async () => {
      try {
        await fetchUserInfo();
        await fetchBalance();
        await fetchExchangeRates();
        await fetchDeposits();
        await checkIfPinExists();
        await fetchOrders();
      } catch (err) {
        console.error('Init error:', err);
      }
    })();
  }, [walletData.token]);

  // 8) ------------------ useEffect: если есть selectedNetwork => get depositAddress ------------------
  useEffect(() => {
    if (selectedNetwork) fetchDepositAddress();
  }, [selectedNetwork]);

  // 9) ------------------ useEffect: пересчитать equivalentValue, если balance / rates / currency меняются ------------------
  useEffect(() => {
    if (balance !== null && exchangeRates && selectedCurrency) {
      const rate = exchangeRates[selectedCurrency.toLowerCase()];
      if (rate) {
        const val = balance * rate ;
        setEquivalentValue(val);
      } else {
        setEquivalentValue(null);
      }
    }
  }, [balance, exchangeRates, selectedCurrency]);

  // 10) ------------------ useEffect: интервал обновления депозитов (пример) ------------------
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeposits().catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUserInfo() {
    try {
      const res = await axios.get('https://ifehuadmwallet.link/wallet-api/api/user-info', {
        headers: { Authorization: `Bearer ${walletData.token}` },
      });
      setUserEmail(res.data.email);
      setIsEmailConfirmed(res.data.confirmed_email);
      setIsTosAccepted(res.data.tos_accepted);
    } catch (err) {
      console.error('fetchUserInfo error:', err);
    }
  }

  async function fetchBalance() {
    try {
      setLoadingBalance(true);
      const response = await axios.get('https://ifehuadmwallet.link/wallet-api/api/get-balance', {
        params: { address: walletData.publicKey },
        headers: { Authorization: `Bearer ${walletData.token}` },
      });
      setBalance(response.data.balance);
      setError(null);
    } catch (err) {
      console.error(t('walletPage.balanceBlock.error'), err);
      setError(t('walletPage.balanceBlock.error'));
      toast.error(t('walletPage.balanceBlock.error'));
    } finally {
      setLoadingBalance(false);
    }
  }

  async function fetchExchangeRates() {
    try {
      setLoadingRates(true);
      const response = await axios.get('https://sitworldstat.link/api/rates_ifehu');
      setExchangeRates(response.data);
      setError(null);
    } catch (error) {
      console.error('Ошибка получения курсов:', error);
      setError('Ошибка получения курсов');
      toast.error('Ошибка получения курсов.');
    } finally {
      setLoadingRates(false);
    }
  }

  async function checkIfPinExists() {
    try {
      const res = await axios.post('https://ifehuadmwallet.link/wallet-api/api/check-pin', {},
        { headers: { Authorization: `Bearer ${walletData.token}` } }
      );
      setPinCreated(res.data.pinExists);
    } catch (err) {
      console.error('Ошибка checkIfPinExists:', err);
      toast.error('Ошибка при проверке PIN-кода.');
    }
  }

  async function fetchDeposits() {
    try {
      const res = await axios.get('https://ifehuadmwallet.link/wallet-api/api/get-deposits', {
        headers: { Authorization: `Bearer ${walletData.token}` },
      });
      setDeposits(res.data.deposits);
    } catch (err) {
      console.error('Ошибка получения депозитов:', err);
      toast.error('Ошибка получения депозитов.');
    }
  }

  async function fetchOrders() {
    try {
      const res = await axios.get('https://ifehuadmwallet.link/wallet-api/api/p2p-orders/list', {
        headers: { Authorization: `Bearer ${walletData.token}` },
      });
      setOrders(res.data.orders);
    } catch (err) {
      console.error('Ошибка получения p2p-ордеров:', err);
      toast.error('Ошибка загрузки P2P-ордеров');
    }
  }

  async function fetchDepositAddress() {
    try {
      if (!walletData?.token) return;
      const res = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/get-deposit-address',
        { network: selectedNetwork },
        { headers: { Authorization: `Bearer ${walletData.token}` } }
      );
      setDepositAddress(res.data.depositAddress);
    } catch (err) {
      console.error('Ошибка адреса пополнения:', err);
      toast.error('Ошибка получения адреса.');
    }
  }

  // 12) ------------------ ФУНКЦИИ: handleSendCode / handleCheckCode (email confirm), handleTransfer, confirmEnteredPin, createPinCode, recoverPinCode, etc. ------------------
  async function handleSendCode() {
    try {
      // Нужно userId (из токена) или вы храните userId где-то ещё
      // Допустим, ваш walletData не содержит userId. Тогда можно
      // сделать ещё один GET /user-info (мы уже делали, 
      // может, нужно хранить userId в state?), 
      // но для примера примем, что userId = req.user.userId
      // => не нужно передавать userId в body, можно, 
      //   но на бэке 
      //   authenticateToken => req.user => userId
      //   Anyway, пусть передаём userEmail

      await axios.post('https://ifehuadmwallet.link/wallet-api/api/send-confirmation-code', {
        email: userEmail
      }, {
        headers: {
          Authorization: `Bearer ${walletData.token}`
        }
      });
      setCodeSent(true);
      toast.success(`Код отправлен на ${userEmail}`);
    } catch (err) {
      console.error('Ошибка отправки кода', err);
      toast.error('Не удалось отправить код');
    }
  }

  async function handleCheckCode() {
    try {
      await axios.post('https://ifehuadmwallet.link/wallet-api/api/check-confirmation-code', {
        email: userEmail,
        code: confirmCode
      }, {
        headers: {
          Authorization: `Bearer ${walletData.token}`
        }
      });
      toast.success('Email подтверждён');
      setIsEmailConfirmed(true); // обновляем локально
      setIsEmailModalOpen(false);
    } catch (err) {
      console.error('Ошибка проверки кода', err);
      toast.error(err.response?.data?.message || 'Ошибка проверки кода');
    }
  }

  async function handleAgreeTos() {
    try {
      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/agree-tos',
        {},
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );
      if (response.status === 200) {
        setIsTosAccepted(true);
        toast.success(t('walletPage.settingsSection.tosSuccess'));
      }
    } catch (error) {
      console.error('Ошибка при согласии с соглашением:', error);
      toast.error(t('walletPage.settingsSection.tosError'));
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

  // 13) ------------------ Вспомогательные компоненты: WalletMain, BuyPage, SellPage, SettingsPage ------------------

  // Создать ордер
  async function handleCreateOrder() {
    try {
      const data = {
        orderType: newOrderType,
        currency: newOrderCurrency,
        limitMin: newOrderLimitMin,
        limitMax: newOrderLimitMax,
        paymentMethod: newOrderPaymentMethod,
        bankName: newOrderPaymentMethod === 'bank' ? newOrderBankName : null,
        bankAccount: newOrderPaymentMethod === 'bank' ? newOrderBankAccount : null,
        blockchain: newOrderPaymentMethod === 'crypto' ? newOrderBlockchain : null,
        coin: newOrderPaymentMethod === 'crypto' ? newOrderCoin : null,
        cryptoAddress: newOrderPaymentMethod === 'crypto' ? newOrderCryptoAddress : null,
      };

      await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/p2p-orders/create',
        data,
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );

      toast.success('Ордер создан!');
      setIsCreateModalOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Ошибка создания p2p-ордера:', error);
      toast.error('Ошибка создания ордера');
    }
  }

  // Выбрать ордер -> /choose -> status=in_process
  async function handleChooseOrder(order) {
    try {
      await axios.post(
        `https://ifehuadmwallet.link/wallet-api/api/p2p-orders/${order.id}/choose`,
        {},
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );
      toast.success('Ордер переведён в статус in_process');

      // Открываем модалку, передаём order (реквизиты)
      setSelectedOrder(order);
      setIsOrderModalOpen(true);

      // Запускаем таймер 30 минут (1800 секунд)
      setTimeLeft(1800); // 30 * 60

      // Очистим предыдущий таймер, если есть
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
      }

      timerIdRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIdRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Сразу обновляем список, чтобы ордер пропал из таблицы
      fetchOrders();
    } catch (error) {
      console.error('Ошибка при выборе ордера:', error);
      toast.error('Невозможно выбрать ордер');
    }
  }

  // Завершить ордер (выполнил)
  async function handleCompleteOrder() {
    if (!selectedOrder) return;
    try {
      await axios.post(
        `https://ifehuadmwallet.link/wallet-api/api/p2p-orders/${selectedOrder.id}/complete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${walletData.token}`,
          },
        }
      );
      toast.success('Ордер помечен как выполненный (completed)');
      closeOrderModal();
      // Можно fetchOrders() если хотите показать иные таблицы (или оставим так)
    } catch (error) {
      console.error('Ошибка завершения ордера:', error);
      toast.error('Невозможно завершить ордер');
    }
  }



  // Закрыть модалку
  function closeOrderModal() {
    setIsOrderModalOpen(false);
    setSelectedOrder(null);
    setTimeLeft(0);

    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
    }
  }

  // Фильтрация
  const filteredOrders = orders.filter((o) => {
    if (selectedCurrencyFilter !== 'Все' && o.currency !== selectedCurrencyFilter) {
      return false;
    }
    if (paymentMethodFilter !== 'Все') {
      if (paymentMethodFilter === 'Crypto' && o.payment_method !== 'crypto') {
        return false;
      }
      if (
        (paymentMethodFilter === 'Sberbank' || paymentMethodFilter === 'Tinkoff') &&
        o.payment_method !== 'bank'
      ) {
        return false;
      }
      if (paymentMethodFilter === 'Sberbank' && o.bank_name !== 'Sberbank') {
        return false;
      }
      if (paymentMethodFilter === 'Tinkoff' && o.bank_name !== 'Tinkoff') {
        return false;
      }
    }
    if (purchaseAmountFilter) {
      const val = parseFloat(purchaseAmountFilter);
      if (isNaN(val)) return false;
      if (o.limit_min > val || o.limit_max < val) {
        return false;
      }
    }
    return true;
  });

  // Форматируем оставшееся время (секунды) в mm:ss
  function formatTimeLeft(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  }




  const copyPublicKey = () => {
    navigator.clipboard.writeText(walletData.publicKey);
    toast.success(t('walletPage.publicKeyBlock.copied'));
  };


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

  // const handleUsdtAmountChange = (e) => {
  //   const usdtAmount = e.target.value;
  //   setDepositUsdtAmount(usdtAmount);
  
  //   if (exchangeRates && exchangeRates['usd'] && !isNaN(usdtAmount) && usdtAmount !== '') {
  //     const exchangeRate = exchangeRates['usd']; 
  //     const fehuAmount = usdtAmount / exchangeRate * 12.4;
  //     setEquivalentFehuAmount(fehuAmount.toFixed(8));
  //   } else {
  //     setEquivalentFehuAmount('');
  //   }
  // };
  
  function handleFiatChange(e) {
    const newFiatValue = e.target.value;
    setDepositFiat(newFiatValue);

    // Если введено число, пересчитываем iFEHU
    if (exchangeRates && selectedFiat && !isNaN(newFiatValue) && newFiatValue !== '') {
      const rate = exchangeRates[selectedFiat.toLowerCase()];
      if (rate) {
        // Допустим 1 iFEHU = 0.124 * 1 USD (или 12.4 ? Зависит от вашей логики).
        // Если у вас 1 iFEHU = 12.4 USD, тогда:
        // iFehu = (fiatValue / rate) * (1 / 12.4) — если rate — это «1 USD = X?»
        // или проще: iFehu = fiatValue / (rate * 12.4)?

        const numeric = parseFloat(newFiatValue);
        // Предположим, чтобы получить iFEHU:
        // iFEHU = (Fiat / rate) * 12.4
        // ИЛИ  iFEHU = (Fiat * 0.124) / rate
        // Нужно подставить правильную формулу, как у вас. 
        // Смотрите, в handleUsdtAmountChange выше было: iFehu = usdt / rate * 12.4
        // Используем ту же:
        const iFehu = (numeric / rate);
        setDepositIfehu(iFehu.toFixed(8));
      } else {
        setDepositIfehu('');
      }
    } else {
      setDepositIfehu('');
    }
  }

  // Когда пользователь меняет iFEHU
  function handleIfehuChange(e) {
    const newIfehuValue = e.target.value;
    setDepositIfehu(newIfehuValue);

    if (exchangeRates && selectedFiat && !isNaN(newIfehuValue) && newIfehuValue !== '') {
      const rate = exchangeRates[selectedFiat.toLowerCase()];
      if (rate) {
        const numeric = parseFloat(newIfehuValue);
        // Обратная формула:
        // fiat = (iFehu * rate) / 12.4
        const fiat = (numeric * rate);
        setDepositFiat(fiat.toFixed(8));
      } else {
        setDepositFiat('');
      }
    } else {
      setDepositFiat('');
    }
  }

  // Пример handler, когда пользователь меняет select (rub/usd/eur).
  function handleSelectFiat(e) {
    const fiat = e.target.value;
    setSelectedFiat(fiat);

    // Пересчитываем поля, если уже что-то введено
    if (depositIfehu) {
      // «Притворимся», что пользователь ещё раз ввёл то же iFehu
      // чтобы всё пересчиталось под новый fiat
      handleIfehuChange({ target: { value: depositIfehu } });
    } else if (depositFiat) {
      handleFiatChange({ target: { value: depositFiat } });
    }
  }

  const handleDepositSent = async () => {
    if (!depositFiat || isNaN(depositFiat) || depositFiat <= 0) {
      toast.error('Пожалуйста, введите корректную сумму USDT.');
      return;
    }
  
    try {
      const response = await axios.post(
        '  https://ifehuadmwallet.link/wallet-api/api/start-deposit-check',
        {
          network: selectedNetwork,
          amount: depositFiat,
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

  function handleFehuChange(e) {
    const iFehuStr = e.target.value;
    setTransferAmountFehu(iFehuStr);
  
    const iFehuNum = parseFloat(iFehuStr);
    if (!isNaN(iFehuNum) && iFehuNum >= 0) {
      const rate = exchangeRates[selectedCurrency.toLowerCase()];
      if (rate) {
        const currencyNum = iFehuNum * rate;
        setTransferAmountCurrency(currencyNum.toFixed(8));
      } else {
        setTransferAmountCurrency('');
      }
    } else {
      setTransferAmountCurrency('');
    }
  }

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

  function handleCurrencyAmountChange(e) {
    const currencyStr = e.target.value;
    setTransferAmountCurrency(currencyStr);
  
    const currencyNum = parseFloat(currencyStr);
    if (!isNaN(currencyNum) && currencyNum >= 0) {
      const rate = exchangeRates[selectedCurrency.toLowerCase()];
      if (rate) {
        const iFehuNum = currencyNum / rate;
        setTransferAmountFehu(iFehuNum.toFixed(8));
      } else {
        setTransferAmountFehu('');
      }
    } else {
      setTransferAmountFehu('');
    }
  }

  const executeTransfer = async () => {
    try {
      setIsTransferring(true);
      toast.info(t('walletPage.transferSection.transactionSending'));

      const response = await axios.post(
        'https://ifehuadmwallet.link/wallet-api/api/transfer-tokens',
        { recipientAddress, amount: transferAmountFehu },
        { headers: { Authorization: `Bearer ${walletData.token}` } }
      );

      toast.success(
        t('walletPage.transferSection.transactionSuccess', {
          hash: response.data.transactionHash,
        })
      );

      fetchBalance();

      setRecipientAddress('');
      setTransferAmountFehu('');
      setTransferAmountCurrency('');
    } catch (error) {
      console.error(t('walletPage.transferSection.transactionError'), error);
      if (error.response && error.response.data && error.response.data.message) {
        toast.error(`Ошибка: ${error.response.data.message}`);
      } else {
        toast.error(t('walletPage.transferSection.transactionError'));
      }
    } finally {
      setIsTransferring(false);
    }
  };

  function WalletMain() {
    return (
        <div className="w-full bg-white rounded shadow p-6">
          {/* Блок Баланса */}
          <div className="flex gap-4 mb-4">
            <div className="bg-neutral-900 text-white p-4 rounded-lg flex-1">
              <p className="text-sm text-gray-400 mb-1">
                {t('walletPage.balanceBlock.balanceTitle')}:
              </p>
              {loadingBalance ? (
                <p>{t('walletPage.balanceBlock.loading')}</p>
              ) : error ? (
                <p className="text-red-400">{error}</p>
              ) : (
                balance !== null && (
                  <p className="text-2xl font-bold text-lime-400">
                    {balance.toFixed(4)} iFEHU
                  </p>
                )
              )}

              {/* Курсы */}
              {loadingRates ? (
                <p>{t('walletPage.buySection.loadingRates')}</p>
              ) : error ? (
                <p className="text-red-400">{error}</p>
              ) : (
                <>
                  <div className="mt-4">
                    <p className="text-sm text-gray-400 mb-1">
                      {t('walletPage.balanceBlock.oneIFehuEquals')}
                    </p>
                    <p className="text-xl font-semibold text-white">
                      {exchangeRates && selectedCurrency
                        ? (
                            1 * exchangeRates[selectedCurrency.toLowerCase()]
                          ).toFixed(3)
                        : t('walletPage.balanceBlock.noData')}{' '}
                      {selectedCurrency.toUpperCase()}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 items-start">
                    {/* Выбор валюты */}
                    <div>
                      <p className="text-sm text-gray-400 mb-1">
                        {t('walletPage.balanceBlock.chooseCurrency')}
                      </p>
                      <select
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                        className="w-full bg-neutral-800 text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500"
                      >
                        {supportedCurrencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">
                        {t('walletPage.balanceBlock.eqValue')}
                      </p>
                      {equivalentValue !== null ? (
                        <p className="text-xl font-semibold text-white">
                          ~ {formatValue(equivalentValue, selectedCurrency)}
                        </p>
                      ) : (
                        <p className="text-gray-400">
                          {t('walletPage.balanceBlock.noData')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={fetchBalance}
                      disabled={loadingBalance}
                      className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition ${
                        loadingBalance ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loadingBalance
                        ? t('walletPage.balanceBlock.updating')
                        : t('walletPage.balanceBlock.update')}
                    </button>
                  </div>
                </>
              )}
            </div>

          <div className="bg-neutral-800 text-white p-4 rounded-lg flex-1">
            <p className="text-sm text-gray-400 mb-1">
              {t('walletPage.publicKeyBlock.title')}
            </p>
            <div className="flex items-center space-x-2 break-all">
              <span>{walletData.publicKey}</span>
              <button
                className="text-gray-200 hover:text-white"
                onClick={copyPublicKey}
              >
                <FaRegCopy />
              </button>
            </div>
          </div>
        </div>

        {!isEmailConfirmed && (
          <div className="bg-yellow-500 text-black p-4 rounded-lg mb-4">
            <p className="font-semibold">
              {t('walletPage.emailAlert.notConfirmed')}
            </p>
            <p>
              {t('walletPage.emailAlert.goSettings')}{' '}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => setActiveTab('settings')}
              >
                {t('walletPage.tabs.settings')}
              </button>{' '}
            </p>
          </div>
        )}

        {!isTosAccepted && (
          <div className="bg-yellow-500 text-black p-4 rounded-lg mb-4">
            <p className="font-semibold">
              {t('walletPage.TosAccepted.notConfirmed')}
            </p>
            <p>
              {t('walletPage.TosAccepted.goSettings')}{' '}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => setActiveTab('settings')}
              >
                {t('walletPage.tabs.settings')}
              </button>{' '}
            </p>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">
            {t('walletPage.transferSection.title')}
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-1">
                {t('walletPage.transferSection.recipient')}
              </label>
              <input
                type="text"
                placeholder={t('walletPage.transferSection.recipientPlaceholder')}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">
                {t('walletPage.transferSection.recipientPlaceholder2')}
              </label>
              <input
                type="text"
                placeholder={t('walletPage.transferSection.recipientPlaceholder2')}
                disabled
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">
                {t('walletPage.transferSection.amountFehu')}
              </label>
              <input
                type="text"
                placeholder={t('walletPage.transferSection.amountFehu')}
                value={transferAmountFehu}
                onChange={handleFehuChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">
                {t('walletPage.transferSection.amountCurrency', {
                  currency: selectedCurrency.toUpperCase(),
                })}
              </label>
              <input
                type="text"
                placeholder={t('walletPage.transferSection.amountCurrency', {
                  currency: selectedCurrency.toUpperCase(),
                })}
                value={transferAmountCurrency}
                onChange={handleCurrencyAmountChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          </div>
          <p className="text-lime-400 text-xl mt-2">
            {t('walletPage.transferSection.warningSend')}
          </p>
          <button
            onClick={handleTransfer}
            disabled={isTransferring}
            className={`px-4 py-2 rounded bg-lime-500 text-white hover:bg-lime-600 ${
              isTransferring ? 'opacity-50 cursor-not-allowed' : ''
            } mt-4`}
          >
            {isTransferring
              ? t('walletPage.transferSection.sending')
              : t('walletPage.transferSection.send')}
          </button>
        </div>
      </div>
    );
  }

  function BuyPage() {
    const { t } = useTranslation();
  
    function BuyUsdtTab() {
      return (
        <div className="bg-neutral-900 text-white p-4 rounded-lg shadow space-y-4">
          <div className="flex space-x-4">
            <div>
              <label className="block text-gray-300 mb-1">
                {t('walletPage.buySection.usdtNetwork')}
              </label>
              <select
                className="bg-neutral-800 text-white rounded px-3 py-2"
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
              >
                {supportedNetworks.map((net) => (
                  <option key={net.value} value={net.value}>
                    {net.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Валюта */}
            <div>
              <label className="block text-gray-300 mb-1">
                {t('walletPage.buySection.usdtFiat')}
              </label>
              <select
                className="bg-neutral-800 text-white rounded px-3 py-2"
                value={selectedFiat}
                onChange={handleSelectFiat}
              >
                <option value="usd">USD</option>
                <option value="rub">RUB</option>
                <option value="eur">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-300 mb-1">
                {t('walletPage.buySection.usdtCrypto')}
              </label>
              <select className="bg-neutral-800 text-white rounded px-3 py-2">
                <option value="usdt">USDT</option>
              </select>
            </div>
          </div>
  
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-gray-300 mb-1">
                {t('walletPage.buySection.usdtAmountFehu')}
              </label>
              <input
                type="text"
                placeholder={t('walletPage.buySection.usdtAmountFehu')}
                className="bg-neutral-800 text-white rounded px-3 py-2 w-full"
                value={depositIfehu}
                onChange={handleIfehuChange}
              />
            </div>
  
            <div className="flex-1">
              <label className="block text-gray-300 mb-1">
                {t('walletPage.buySection.usdtAmountFiat', {
                  fiat: selectedFiat.toUpperCase()
                })}
              </label>
              <input
                type="text"
                placeholder={t('walletPage.buySection.usdtAmountFiat', {
                  fiat: selectedFiat.toUpperCase(),
                })}
                className="bg-neutral-800 text-white rounded px-3 py-2 w-full"
                value={depositFiat}
                onChange={handleFiatChange}
              />
            </div>
          </div>
  
          <p className="text-lime-400 text-xl mt-2">
            {t('walletPage.buySection.usdtYouGet')}{' '}
            <strong>{depositIfehu || '0'}</strong> iFEHU
          </p>
  
          {/* Кошелёк для перевода */}
          <div className="mt-4 bg-neutral-800 p-3 rounded flex items-center space-x-2">
            <div className="flex-1 break-all">
              <label className="block text-gray-300 mb-1">
                {t('walletPage.buySection.usdtWalletAddress')}
              </label>
              <p className="text-white">{depositAddress || '—'}</p>
            </div>
            <button
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              onClick={() => {
                navigator.clipboard.writeText(depositAddress);
                toast.success(t('walletPage.publicKeyBlock.copied'));
              }}
            >
              <FaRegCopy />
            </button>
          </div>
  
          <div className="mt-4 text-gray-400">
            <h4 className="text-lg font-semibold">
              {t('walletPage.buySection.algorithmTitle')}
            </h4>
            <p>
              {t('walletPage.buySection.algorithmStep1', {
                amount: depositFiat,
                fiat: selectedFiat.toUpperCase()
              })}
            </p>
            <p>{t('walletPage.buySection.algorithmStep2')}</p>
            <p>
              {t('walletPage.buySection.algorithmStep3', {
                ifehu: depositIfehu
              })}
            </p>
            <p>{t('walletPage.buySection.algorithmStep4')}</p>
          </div>
  
          <button
            className="mt-4 px-4 py-2 bg-lime-500 text-black rounded hover:bg-lime-600 transition duration-200"
            onClick={handleDepositSent}
          >
            {t('walletPage.buySection.done')}
          </button>
  
          <h4 className="text-lg font-semibold mt-4">
            {t('walletPage.buySection.historyTitle')}
          </h4>
          {deposits.length === 0 ? (
            <p>{t('walletPage.buySection.noDeposits')}</p>
          ) : (
            <ul>
              {deposits.map((deposit) => (
                <li key={deposit.id} className="border p-2 rounded mb-2">
                  <p>
                    <strong>{t('walletPage.buySection.sum')}:</strong>{' '}
                    {deposit.amount_usdt} USDT
                  </p>
                  <p>
                    <strong>{t('walletPage.buySection.status')}:</strong>{' '}
                    {deposit.status === 'pending'
                      ? t('walletPage.buySection.statusPending')
                      : deposit.status === 'confirmed'
                      ? t('walletPage.buySection.statusConfirmed')
                      : deposit.status === 'completed'
                      ? t('walletPage.buySection.statusCompleted')
                      : t('walletPage.buySection.statusError')}
                  </p>
                  <p>
                    <strong>{t('walletPage.buySection.tx')}:</strong>{' '}
                    {deposit.tx_hash ? (
                      <a
                        href={getExplorerLink(deposit.network, deposit.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                      >
                        {t('walletPage.buySection.txView')}
                      </a>
                    ) : (
                      t('walletPage.buySection.txPending')
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    
  function BuyP2PTab() {
    return (
      <div className="space-y-4">
        {/* Фильтр */}
        <div className="bg-neutral-900 p-4 text-white rounded-lg flex flex-wrap items-end gap-4">
          {/* Валюта */}
          <div>
            <label className="block text-gray-300 mb-1">
              {t('walletPage.buyP2P.currency')}
            </label>
            <select
              className="bg-neutral-800 text-white rounded px-3 py-2"
              value={selectedCurrencyFilter}
              onChange={(e) => setSelectedCurrencyFilter(e.target.value)}
            >
              <option value="Все">{t('walletPage.buyP2P.all')}</option>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="AED">AED</option>
              <option value="CNY">CNY</option>
            </select>
          </div>
  
          {/* Способ оплаты */}
          <div>
            <label className="block text-gray-300 mb-1">
              {t('walletPage.buyP2P.payment')}
            </label>
            <select
              className="bg-neutral-800 text-white rounded px-3 py-2"
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
            >
              <option value="Все">{t('walletPage.buyP2P.all')}</option>
              <option value="Sberbank">{t('walletPage.buyP2P.sberbank')}</option>
              <option value="Tinkoff">{t('walletPage.buyP2P.tinkoff')}</option>
              <option value="Crypto">{t('walletPage.buyP2P.crypto')}</option>
            </select>
          </div>
  
          {/* Сумма покупки */}
          <div>
            <label className="block text-gray-300 mb-1">
              {t('walletPage.buyP2P.purchaseAmount')}
            </label>
            <input
              type="text"
              placeholder={t('walletPage.buyP2P.purchaseAmountPlaceholder')}
              className="bg-neutral-800 text-white rounded px-3 py-2"
              value={purchaseAmountFilter}
              onChange={(e) => setPurchaseAmountFilter(e.target.value)}
            />
          </div>
        </div>
  
        {/* Таблица предложений */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold">
              {t('walletPage.buyP2P.offers')}
            </h4>
            <button
              className="flex items-center px-3 py-2 bg-lime-500 text-black rounded hover:bg-lime-600"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <FaPlus className="mr-2" />
              {t('walletPage.buyP2P.createOrder')}
            </button>
          </div>
  
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">ID</th>
                <th className="py-2">{t('walletPage.buyP2P.author')}</th>
                <th className="py-2">{t('walletPage.buyP2P.price')}</th>
                <th className="py-2">{t('walletPage.buyP2P.limit')}</th>
                <th className="py-2">{t('walletPage.buyP2P.currency')}</th>
                <th className="py-2">{t('walletPage.buyP2P.payment')}</th>
                <th className="py-2">{t('walletPage.buyP2P.orderType')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b hover:bg-gray-50">
                  <td className="py-2">{o.id}</td>
                  <td className="py-2">{o.price} {o.currency}</td>
                  <td className="py-2">
                    {o.limit_min} - {o.limit_max} iFEHU
                  </td>
                  <td className="py-2">{o.currency}</td>
                  <td className="py-2">
                    {o.payment_method === 'bank'
                      ? o.bank_name
                      : `${o.crypto_coin} ${o.crypto_blockchain}`}
                  </td>
                  <td className="py-2">
                    {o.order_type === 'buy' ? t('walletPage.buyP2P.buy') : t('walletPage.buyP2P.sell')}
                  </td>
                  <td className="py-2 text-sm text-gray-600">
                    {/* Дополнительная информация */}
                  </td>
                  <td className="py-2">
                    <button
                      className="px-2 py-1 bg-lime-200 rounded hover:bg-lime-300"
                      onClick={() => handleChooseOrder(o)}
                    >
                      {t('walletPage.buyP2P.start')}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-3 text-center text-gray-500">
                    {t('walletPage.buyP2P.noOrders')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
    
  
    function BuyCardTab() {
      return (
        <div className="bg-white p-4 rounded shadow text-black">
          <h3 className="text-lg font-semibold mb-2">{t('walletPage.buySection.cardTabTit')}</h3>
          <p>{t('walletPage.buySection.cardTabDesc')}</p>
        </div>
      );
    }
  
    let currentTabContent;
    if (activeTab2 === 'usdt') {
      currentTabContent = <BuyUsdtTab />;
    } else if (activeTab2 === 'p2p') {
      currentTabContent = <BuyP2PTab />;
    } else if (activeTab2 === 'card') {
      currentTabContent = <BuyCardTab />;
    }

    return (    
      <div className="w-full bg-white p-6 rounded-lg shadow space-y-4">
        {/* Заголовок */}
        <h2 className="text-2xl font-bold">{t('walletPage.buySection.title')}</h2>

        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => setActiveTab2('usdt')}
            className={`px-4 py-2 rounded ${
              activeTab2 === 'usdt'
                ? 'bg-lime-400 text-black'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            {t('walletPage.buySection.usdtTab')}
          </button>
          <button
            onClick={() => setActiveTab2('p2p')}
            className={`px-4 py-2 rounded ${
              activeTab2 === 'p2p'
                ? 'bg-lime-400 text-black'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            {t('walletPage.buySection.p2pTab')}
          </button>
          <button
            onClick={() => setActiveTab2('card')}
            className={`px-4 py-2 rounded ${
              activeTab2 === 'card'
                ? 'bg-lime-400 text-black'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            {t('walletPage.buySection.cardTab')}
          </button>
        </div>

        {loadingRates && <p>{t('walletPage.buySection.loadingRates')}</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loadingRates && currentTabContent}
      </div>
    );
  }

  function SellPage() {
    const { t } = useTranslation();
  
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">
          {t('walletPage.sellSection.title')}
        </h3>
        <p>{t('walletPage.sellSection.desc')}</p>
      </div>
    );
  }
  

  function SettingsPage() {
    const { t } = useTranslation();
  
    return (
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h3 className="text-xl font-semibold mb-4">
          {t('walletPage.settingsSection.title')}
        </h3>
  
        {!pinCreated && (
          <button
            onClick={() => setIsCreatePinModalOpen(true)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {t('walletPage.settingsSection.createPin')}
          </button>
        )}
  
        {pinCreated && (
          <button
            onClick={() => setIsRecoverPinModalOpen(true)}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            {t('walletPage.settingsSection.recoverPin')}
          </button>
        )}
  
        {!isEmailConfirmed ? (
          <div>
            <p className="text-sm text-red-500">
              {t('walletPage.settingsSection.emailNotConfirmed', {
                email: userEmail,
              })}
            </p>
            <button
              onClick={() => {
                setIsEmailModalOpen(true);
                setCodeSent(false);
                setConfirmCode('');
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-2"
            >
              {t('walletPage.settingsSection.confirmEmailButton')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-green-600">
            {t('walletPage.settingsSection.emailConfirmed', {
              email: userEmail,
            })}
          </p>
        )}

        <div className="bg-blue-100 p-4 rounded-lg">
          <p className="text-sm text-gray-700">
            {t('walletPage.settingsSection.tosInfo')}{' '}
            <a
              href="https://sitworldstat.link/api/download_terms_ru/1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {t('walletPage.settingsSection.tosLinkText')}
            </a>
          </p>
          {!isTosAccepted ? (
            <button
              onClick={handleAgreeTos}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              {t('walletPage.settingsSection.tosAgreeButton')}
            </button>
          ) : (
            <p className="text-sm text-green-600">
              {t('walletPage.settingsSection.tosAccepted')}
            </p>
          )}
        </div>
  
        {/* Модалка */}
        <Modal
          isOpen={isEmailModalOpen}
          onRequestClose={() => setIsEmailModalOpen(false)}
          contentLabel={t('walletPage.settingsSection.emailConfirmModalTitle')}
          className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        >
          <h2 className="text-xl font-semibold mb-4">
            {t('walletPage.settingsSection.emailConfirmModalTitle')}
          </h2>
          {!codeSent ? (
            <div>
              <p>
                {t('walletPage.settingsSection.sendCodeQuestion', {
                  email: userEmail,
                })}
              </p>
              <button
                onClick={handleSendCode}
                className="px-4 py-2 bg-lime-500 text-black rounded mt-4 hover:bg-lime-600"
              >
                {t('walletPage.settingsSection.sendCodeBtn')}
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                {t('walletPage.settingsSection.enterCodeLabel')}
              </label>
              <input
                type="text"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                className="border px-3 py-2 rounded w-full mb-4"
                placeholder="6-значный код"
              />
              <button
                onClick={handleCheckCode}
                className="px-4 py-2 bg-lime-500 text-black rounded hover:bg-lime-600"
              >
                {t('walletPage.settingsSection.confirmBtn')}
              </button>
            </div>
          )}
  
          <button
            onClick={() => setIsEmailModalOpen(false)}
            className="px-4 py-2 bg-gray-300 text-black rounded mt-4 hover:bg-gray-400"
          >
            {t('walletPage.settingsSection.closeBtn')}
          </button>
        </Modal>
      </div>
    );
  }
  

  let content;
  switch (activeTab) {
    case 'wallet':
      content = <WalletMain />;
      break;
    case 'buy':
      content = <BuyPage />;
      break;
    case 'sell':
      content = <SellPage />;
      break;
    case 'settings':
      content = <SettingsPage />;
      break;
    default:
      content = <WalletMain />;
      break;
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      {/* Шапка */}
      <header className="bg-white flex items-center justify-between px-4 py-2 shadow">
        <h1 className="text-xl font-bold">
          {t('walletPage.header.title')}
        </h1>
        <nav className="space-x-4">
          <button
            className={`px-2 py-2 rounded hover:bg-gray-200 ${
              activeTab === 'wallet' ? 'bg-gray-300' : ''
            }`}
            onClick={() => setActiveTab('wallet')}
          >
            {t('walletPage.tabs.wallet')}
          </button>
          <button
            className={`px-2 py-2 rounded hover:bg-gray-200 ${
              activeTab === 'buy' ? 'bg-gray-300' : ''
            }`}
            onClick={() => setActiveTab('buy')}
          >
            {t('walletPage.tabs.buy')}
          </button>
          <button
            className={`px-2 py-2 rounded hover:bg-gray-200 ${
              activeTab === 'sell' ? 'bg-gray-300' : ''
            }`}
            onClick={() => setActiveTab('sell')}
          >
            {t('walletPage.tabs.sell')}
          </button>
          <button
            className={`px-2 py-2 rounded hover:bg-gray-200 ${
              activeTab === 'settings' ? 'bg-gray-300' : ''
            }`}
            onClick={() => setActiveTab('settings')}
          >
            {t('walletPage.tabs.settings')}
          </button>
        </nav>
      </header>

      {/* Контент */}
      <main className="px-8 py-6">
        {activeTab === 'wallet' && <WalletMain />}
        {activeTab === 'buy' && <BuyPage />}
        {activeTab === 'sell' && <SellPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* Модалки PIN */}
      <Modal
        isOpen={isPinModalOpen}
        onRequestClose={() => setIsPinModalOpen(false)}
        contentLabel={t('walletPage.pinModal.enterPinTitle')}
        className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <h2 className="text-xl font-semibold mb-4">
          {t('walletPage.pinModal.enterPinTitle')}
        </h2>
        <input
          type="password"
          maxLength="4"
          placeholder={t('walletPage.pinModal.pinInputPlaceholder')}
          value={enteredPin}
          onChange={(e) => setEnteredPin(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4 text-center text-2xl"
        />
        <button
          onClick={confirmEnteredPin}
          className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
        >
          {t('walletPage.pinModal.confirmButton')}
        </button>
      </Modal>

      <Modal
        isOpen={isCreatePinModalOpen}
        onRequestClose={() => setIsCreatePinModalOpen(false)}
        contentLabel={t('walletPage.createPinModal.title')}
        className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <h2 className="text-xl font-semibold mb-4">
          {t('walletPage.createPinModal.title')}
        </h2>
        <input
          type="password"
          maxLength="4"
          placeholder={t('walletPage.createPinModal.pinPlaceholder')}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4 text-center text-2xl"
        />
        <input
          type="password"
          maxLength="4"
          placeholder={t('walletPage.createPinModal.pinConfirmPlaceholder')}
          value={confirmPinInput}
          onChange={(e) => setConfirmPinInput(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4 text-center text-2xl"
        />
        <button
          onClick={createPinCode}
          className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition duration-200"
        >
          {t('walletPage.createPinModal.createButton')}
        </button>
      </Modal>

      <Modal
        isOpen={isRecoverPinModalOpen}
        onRequestClose={() => setIsRecoverPinModalOpen(false)}
        contentLabel={t('walletPage.recoverPinModal.title')}
        className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <h2 className="text-xl font-semibold mb-4">
          {t('walletPage.recoverPinModal.title')}
        </h2>
        <p className="mb-4">
          {t('walletPage.recoverPinModal.desc')}
        </p>
        <input
          type="text"
          placeholder={t('walletPage.recoverPinModal.word1Placeholder')}
          value={recoverWord1}
          onChange={(e) => setRecoverWord1(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4"
        />
        <input
          type="text"
          placeholder={t('walletPage.recoverPinModal.word2Placeholder')}
          value={recoverWord2}
          onChange={(e) => setRecoverWord2(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4"
        />
        <button
          onClick={recoverPinCode}
          className="w-full py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-200"
        >
          {t('walletPage.recoverPinModal.recoverButton')}
        </button>
      </Modal>
    </div>
  );
}

export default WalletPage;