const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const axios = require('axios');
const { ethers } = require('ethers');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sendVerificationEmail } = require('./pythonService');


const pool = new Pool({
  user: 'admin_wallet',
  host: 'localhost',
  database: 'wallet',
  password: 'wallet',
  port: 5432,
});

const app = express();
const router = express.Router();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use('/wallet-api', router);


// app.use(cors({
//   origin: 'https://sitworldstat.link', 
//   credentials: true,
// }));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

router.get('/api/ping', (req, res) => {
  res.send('Сервер работает!');
});

router.post('/api/create-wallet', async (req, res) => {
  const { phone, email, password } = req.body;

  try {
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE phone = $1 OR email = $2',
      [phone, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Пользователь с таким телефоном или почтой уже существует' });
    }

    const wallet = ethers.Wallet.createRandom();
    const seedPhrase = wallet.mnemonic.phrase;
    const publicKey = wallet.address;
    const privateKey = wallet.privateKey;

    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      'INSERT INTO users (phone, email, password_hash, public_key, private_key, has_pin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [phone, email, passwordHash, publicKey, privateKey, false]
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      'INSERT INTO wallets (user_id, seed_phrase) VALUES ($1, $2)',
      [userId, seedPhrase]
    );

    res.status(201).json({
        message: 'Кошелек создан!',
        wallet: {
          publicKey,
          seedPhrase,
          privateKey,
          hasPin: false,
        },
      });
  } catch (error) {
    console.error('Ошибка создания кошелька:', error);
    res.status(500).json({ message: 'Ошибка создания кошелька' });
  }
});

router.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный пароль' });
    }

    const walletResult = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [user.id]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ message: 'Кошелек не найден' });
    }

    const wallet = walletResult.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const hasPin = user.has_pin;

    res.status(200).json({
      message: 'Успешный вход',
      wallet: {
        phone: user.phone,
        publicKey: user.public_key,
        seedPhrase: wallet.seed_phrase,
        token,
        hasPin,
      },
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ message: 'Ошибка входа' });
  }
});

router.post('/api/reset-password', async (req, res) => {
  const { email, wordIndices, words, newPassword } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь с такой почтой не найден' });
    }

    const user = userResult.rows[0];

    const walletResult = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [user.id]);

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ message: 'Кошелек не найден' });
    }

    const wallet = walletResult.rows[0];
    const seedPhrase = wallet.seed_phrase;
    const seedWords = seedPhrase.split(' ');

    let isValid = true;
    for (let i = 0; i < wordIndices.length; i++) {
      const index = wordIndices[i];
      if (seedWords[index] !== words[i]) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      return res.status(401).json({ message: 'Неверные слова сид-фразы' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, user.id]);

    res.status(200).json({ message: 'Пароль успешно обновлен' });
  } catch (error) {
    console.error('Ошибка при восстановлении пароля:', error);
    res.status(500).json({ message: 'Ошибка при восстановлении пароля' });
  }
});

router.get('/api/user-info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT email, confirmed_email, tos_accepted FROM users WHERE id=$1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const { email, confirmed_email, tos_accepted } = result.rows[0];
    res.json({ email, confirmed_email, tos_accepted });
  } catch (error) {
    console.error('Ошибка user-info:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.post('/api/agree-tos', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Обновляем в таблице пользователей значение столбца, например, tos_accepted в true
    await pool.query('UPDATE users SET tos_accepted = true WHERE id = $1', [userId]);
    res.status(200).json({ message: 'Terms of Service accepted.' });
  } catch (error) {
    console.error('Ошибка при обновлении TOS:', error);
    res.status(500).json({ message: 'Ошибка при подтверждении пользовательского соглашения.' });
  }
});



router.get('/api/get-balance', async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ message: 'Адрес не указан' });
  }

  try {
    const response = await axios.get('https://api.polygonscan.com/api', {
      params: {
        module: 'account',
        action: 'tokenbalance',
        contractaddress: process.env.IFEU_CONTRACT_ADDRESS,
        address: address,
        tag: 'latest',
        apikey: process.env.POLYGONSCAN_API_KEY,
      },
    });

    const balance = response.data.result;
    const decimals = 8;
    const realBalance = balance / Math.pow(10, decimals);

    res.status(200).json({ balance: realBalance });
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    res.status(500).json({ message: 'Ошибка получения баланса' });
  }
});

router.post('/api/transfer-tokens', authenticateToken, async (req, res) => {
  const { recipientAddress, amount } = req.body;

  if (!recipientAddress || !amount) {
    return res.status(400).json({ message: 'Необходимо указать адрес получателя и сумму.' });
  }

  try {
    const userId = req.user.userId;

    const userResult = await pool.query('SELECT private_key FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const privateKey = userResult.rows[0].private_key;

    const provider = new ethers.JsonRpcProvider(process.env.RPC_PROVIDER_URL);

    const wallet = new ethers.Wallet(privateKey, provider);

    const tokenContractAddress = process.env.IFEU_CONTRACT_ADDRESS;

    const tokenAbi = [
      'function transfer(address to, uint amount) returns (bool)',
    ];

    const tokenContract = new ethers.Contract(tokenContractAddress, tokenAbi, wallet);

    const decimals = 8;

    const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

    const transactionResponse = await tokenContract.transfer(recipientAddress, tokenAmount);

    console.log('Транзакция отправлена:', transactionResponse);

    const receipt = await transactionResponse.wait(1);

    console.log('Транзакция подтверждена:', receipt);

    res.status(200).json({
      message: 'Транзакция успешно отправлена!',
      transactionHash: transactionResponse.hash,
    });
  } catch (error) {
    console.error('Ошибка при отправке транзакции:', error);
    res.status(500).json({ message: 'Ошибка при отправке транзакции' });
  }
});

router.post('/api/set-pin', authenticateToken, async (req, res) => {
  const { pin } = req.body;
  const userId = req.user.userId;

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN-код должен состоять из 4 цифр.' });
  }

  try {
    const pinHash = await bcrypt.hash(pin, 10);

    await pool.query('UPDATE users SET pin_hash = $1, has_pin = true WHERE id = $2', [pinHash, userId]);

    res.status(200).json({ message: 'PIN-код успешно установлен.' });
  } catch (error) {
    console.error('Ошибка установки PIN-кода:', error);
    res.status(500).json({ message: 'Ошибка установки PIN-кода.' });
  }
});

router.post('/api/verify-pin', authenticateToken, async (req, res) => {
  const { pin } = req.body;
  const userId = req.user.userId;

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN-код должен состоять из 4 цифр.' });
  }

  try {
    const userResult = await pool.query('SELECT pin_hash FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const pinHash = userResult.rows[0].pin_hash;

    const isMatch = await bcrypt.compare(pin, pinHash);
    if (isMatch) {
      res.status(200).json({ message: 'PIN-код верный.' });
    } else {
      res.status(401).json({ message: 'Неверный PIN-код.' });
    }
  } catch (error) {
    console.error('Ошибка проверки PIN-кода:', error);
    res.status(500).json({ message: 'Ошибка проверки PIN-кода.' });
  }
});

router.post('/api/recover-pin', authenticateToken, async (req, res) => {
  const { wordIndices, words } = req.body;
  const userId = req.user.userId;

  try {
    const walletResult = await pool.query('SELECT seed_phrase FROM wallets WHERE user_id = $1', [userId]);

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ message: 'Кошелек не найден' });
    }

    const seedPhrase = walletResult.rows[0].seed_phrase;
    const seedWords = seedPhrase.split(' ');

    let isValid = true;
    for (let i = 0; i < wordIndices.length; i++) {
      const index = wordIndices[i];
      if (seedWords[index] !== words[i]) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      return res.status(401).json({ message: 'Неверные слова сид-фразы.' });
    }

    res.status(200).json({ message: 'PIN-код восстановлен. Пожалуйста, установите новый PIN-код.' });
  } catch (error) {
    console.error('Ошибка восстановления PIN-кода:', error);
    res.status(500).json({ message: 'Ошибка восстановления PIN-кода.' });
  }
});

router.post('/api/check-pin', authenticateToken, async (req, res) => {
  const { userId } = req.user;

  try {
    const userResult = await pool.query('SELECT has_pin FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const hasPin = userResult.rows[0].has_pin;

    res.status(200).json({ pinExists: hasPin });
  } catch (error) {
    console.error('Ошибка при проверке PIN-кода:', error);
    res.status(500).json({ message: 'Ошибка при проверке PIN-кода.' });
  }
});

router.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT timestamp, transaction_hash, recipient_wallet, amount_ifehu
      FROM transactions
      ORDER BY timestamp ASC;
    `);

    const data = result.rows.map(row => ({
      timestamp: row.timestamp,
      transactionHash: row.transaction_hash,
      recipientWallet: row.recipient_wallet,
      amountIfehu: parseFloat(row.amount_ifehu),
    }));

    res.status(200).json(data);
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.get('/api/capitalization-history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT date, capitalization
      FROM capitalization_history
      ORDER BY date ASC;
    `);

    const data = result.rows.map(row => ({
      date: row.date,
      capitalization: parseFloat(row.capitalization),
    }));

    res.status(200).json(data);
  } catch (error) {
    console.error('Ошибка при получении данных капитализации:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.get('/api/users-count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) AS count FROM users;');
    const count = parseInt(result.rows[0].count, 10);

    res.status(200).json({ usersCount: count });
  } catch (error) {
    console.error('Ошибка при получении количества пользователей:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.post('/api/get-deposit-address', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { network } = req.body;

  try {
    let depositAddress;
    switch (network) {
      case 'polygon':
        depositAddress = process.env.DEPOSIT_ADDRESS_POLYGON;
        break;
      case 'bsc':
        depositAddress = process.env.DEPOSIT_ADDRESS_BSC;
        break;
      case 'tron':
        depositAddress = process.env.DEPOSIT_ADDRESS_TRON;
        break;
      case 'solana':
        depositAddress = process.env.DEPOSIT_ADDRESS_SOLANA;
        break;
      case 'ton':
        depositAddress = process.env.DEPOSIT_ADDRESS_TON;
        break;
      default:
        return res.status(400).json({ message: 'Неподдерживаемая сеть' });
    }

    res.status(200).json({ depositAddress });
  } catch (error) {
    console.error('Ошибка получения адреса для депозита:', error);
    res.status(500).json({ message: 'Ошибка получения адреса для депозита' });
  }
});

router.post('/api/start-deposit-check', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { network, amount } = req.body;

  if (!network || !amount) {
    return res.status(400).json({ message: 'Необходимо указать сеть и сумму.' });
  }

  try {
    let depositAddress;
    switch (network) {
      case 'polygon':
        depositAddress = process.env.DEPOSIT_ADDRESS_POLYGON;
        break;
      case 'bsc':
        depositAddress = process.env.DEPOSIT_ADDRESS_BSC;
        break;
      case 'tron':
        depositAddress = process.env.DEPOSIT_ADDRESS_TRON;
        break;
      case 'solana':
        depositAddress = process.env.DEPOSIT_ADDRESS_SOLANA;
        break;
      case 'ton':
        depositAddress = process.env.DEPOSIT_ADDRESS_TON;
        break;
      default:
        return res.status(400).json({ message: 'Неподдерживаемая сеть' });
    }

    const insertDepositQuery = `
      INSERT INTO deposits (user_id, network, deposit_address, amount_usdt, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const depositResult = await pool.query(insertDepositQuery, [
      userId,
      network,
      depositAddress,
      amount,
      'pending',
    ]);

    const depositId = depositResult.rows[0].id;

    res.status(200).json({ message: 'Проверка депозита запущена.', depositId });
  } catch (error) {
    console.error('Ошибка при запуске проверки депозита:', error);
    res.status(500).json({ message: 'Ошибка при запуске проверки депозита.' });
  }
});

const checkPendingDeposits = async () => {
  try {
    const pendingDepositsQuery = 'SELECT * FROM deposits WHERE status = $1';
    const pendingDepositsResult = await pool.query(pendingDepositsQuery, ['pending']);

    const pendingDeposits = pendingDepositsResult.rows;

    for (const deposit of pendingDeposits) {
      switch (deposit.network) {
        case 'polygon':
        case 'bsc':
          await checkEthereumDeposit(deposit);
          break;
        case 'tron':
          await checkTronDeposit(deposit);
          break;
        //  функции для Tron, Solana, TON должны быть здесь
        default:
          console.error('Неподдерживаемая сеть для проверки депозита:', deposit.network);
      }
    }
  } catch (error) {
    console.error('Ошибка при проверке ожидающих депозитов:', error);
  }
};

setInterval(checkPendingDeposits, 10000);


const checkEthereumDeposit = async (deposit) => {
  const { id, user_id, network, deposit_address, amount_usdt, created_at } = deposit;

  let explorerApiUrl;
  let explorerApiKey;
  let usdtContractAddress;

  switch (network) {
    case 'polygon':
      explorerApiUrl = 'https://api.polygonscan.com/api';
      explorerApiKey = process.env.POLYGONSCAN_API_KEY;
      usdtContractAddress = process.env.USDT_CONTRACT_ADDRESS_POLYGON;
      break;
    case 'bsc':
      explorerApiUrl = 'https://api.bscscan.com/api';
      explorerApiKey = process.env.BSCSCAN_API_KEY;
      usdtContractAddress = process.env.USDT_CONTRACT_ADDRESS_BSC;
      break;
    default:
      console.error('Неподдерживаемая сеть для проверки Ethereum-депозитов:', network);
      return;
  }

  try {
    const response = await axios.get(explorerApiUrl, {
      params: {
        module: 'account',
        action: 'tokentx',
        contractaddress: usdtContractAddress,
        address: deposit_address,
        page: 1,
        offset: 100,
        sort: 'desc',
        apikey: explorerApiKey,
      },
    });

    if (response.data.status !== '1') {
      console.error(`Ошибка получения транзакций для сети ${network}:`, response.data.result);
      return;
    }

    const transactions = response.data.result;

    const matchingTx = transactions.find((tx) => {
      const txAmount = parseFloat(ethers.formatUnits(tx.value, 6)); 
      const txTime = new Date(tx.timeStamp * 1000);

      return (
        tx.to.toLowerCase() === deposit_address.toLowerCase() &&
        txAmount === parseFloat(amount_usdt) &&
        txTime >= new Date(created_at)
      );
    });

    if (matchingTx) {
      const updateDepositQuery = `
        UPDATE deposits
        SET status = $1, tx_hash = $2, updated_at = NOW()
        WHERE id = $3
      `;
      await pool.query(updateDepositQuery, ['confirmed', matchingTx.hash, id]);

      // Отправляем iFehu пользователю
      await sendiFehuToUser(deposit);

      console.log(`Депозит пользователя ${user_id} подтвержден в сети ${network}`);
    }
  } catch (error) {
    console.error(`Ошибка проверки депозита в сети ${network}:`, error);
  }
};

const checkTronDeposit = async (deposit) => {
  const { id, network, deposit_address, amount_usdt } = deposit;

  try {
    const { TRONGRID_API_KEY, USDT_CONTRACT_ADDRESS_TRON } = process.env;
    if (!TRONGRID_API_KEY || !USDT_CONTRACT_ADDRESS_TRON) {
      console.error('TRONGRID_API_KEY или USDT_CONTRACT_ADDRESS_TRON не установлены в переменных окружения.');
      return;
    }

    const formattedAddress = deposit_address;

    const tronGridURL = `https://api.trongrid.io/v1/accounts/${formattedAddress}/transactions/trc20`;

    const response = await axios.get(tronGridURL, {
      headers: {
        'TRON-PRO-API-KEY': TRONGRID_API_KEY,
      },
      params: {
        limit: 100,
        only_confirmed: true,
        contract_address: USDT_CONTRACT_ADDRESS_TRON,
        sort: 'timestamp,desc',
      },
    });

    console.log('TronGrid API Response:', JSON.stringify(response.data, null, 2));

    const transactions = response.data.data;

    if (!transactions || transactions.length === 0) {
      console.error(`Транзакции не найдены для адреса ${deposit_address} в сети ${network}`);
      return;
    }

    transactions.forEach(tx => {
      console.log(`Raw Value: ${tx.value} (Type: ${typeof tx.value})`);
      const txAmount = parseFloat(tx.value) / 1_000_000;
      console.log(`Транзакция ${tx.transaction_id}: сумма ${txAmount} USDT`);
    });

    const matchingTx = transactions.find(tx => {
      if (!tx.value || !tx.transaction_id) {
        console.warn(`Пропущена транзакция без суммы или ID: ${JSON.stringify(tx)}`);
        return false;
      }
      const cleanValue = tx.value.replace(/[^0-9]/g, '');
      const txAmount = parseFloat(cleanValue) / 1_000_000;
      console.log(`Проверяем транзакцию ${tx.transaction_id}: ${txAmount} USDT >= ${amount_usdt * 0.99} USDT`);
      return txAmount >= parseFloat(amount_usdt) * 0.99;
    });

    if (!matchingTx) {
      console.log(`Нет подходящих транзакций для депозита ID ${id} на адрес ${deposit_address}`);
      return;
    }

    console.log(`Депозит ID ${id} подтвержден. Транзакция: ${matchingTx.transaction_id}`);

    const updateDepositQuery = `
      UPDATE deposits
      SET status = $1, tx_hash = $2, updated_at = NOW()
      WHERE id = $3
    `;
    await pool.query(updateDepositQuery, ['confirmed', matchingTx.transaction_id, id]);

    await sendiFehuToUser(deposit);
  } catch (error) {
    if (error.response) {
      console.error(`TronGrid API Error: ${error.response.status} - ${error.response.data.message || 'undefined'}`);
    } else {
      console.error(`Ошибка проверки депозита в сети ${network}:`, error.message);
    }
  }
};



const sendiFehuToUser = async (deposit) => {
  const { id, user_id, amount_usdt } = deposit;

  const userResult = await pool.query('SELECT public_key FROM users WHERE id = $1', [user_id]);

  if (userResult.rows.length === 0) {
    console.error('Пользователь не найден для депозита:', deposit.id);
    return;
  }

  const recipientAddress = userResult.rows[0].public_key;

  const providerUrl = process.env.RPC_PROVIDER_URL;
  const privateKey = process.env.PRIVATE_KEY_POLYGON;
  const iFehuContractAddress = process.env.IFEU_CONTRACT_ADDRESS;

  const provider = new ethers.JsonRpcProvider(providerUrl);  
  const wallet = new ethers.Wallet(privateKey, provider);

  const iFehuAbi = ['function transfer(address to, uint256 amount) public returns (bool)'];
  const iFehuContract = new ethers.Contract(iFehuContractAddress, iFehuAbi, wallet);

  try {
    // Получаем курс обмена из API
    const ratesResponse = await axios.get('https://sitworldstat.link/api/rates_ifehu');
    const rates = ratesResponse.data;

    const exchangeRate = parseFloat(rates.usd); 

    if (!exchangeRate) {
      console.error('Не удалось получить курс обмена iFehu');
      return;
    }

    const decimals = 8;
    const amountIfehuRaw = parseFloat(amount_usdt) / exchangeRate;
    const amountIfehu = amountIfehuRaw.toFixed(decimals);

    if (!/^\d+(\.\d{1,8})?$/.test(amountIfehu)) {
      console.error(`Некорректная сумма iFehu: ${amountIfehu}`);
      throw new Error('Некорректная сумма iFehu');
    }

    const updateDepositQuery = `
      UPDATE deposits
      SET amount_ifehu = $1
      WHERE id = $2
    `;
    await pool.query(updateDepositQuery, [amountIfehu, id]);

    const tokenAmount = ethers.parseUnits(amountIfehu, decimals);

    const tx = await iFehuContract.transfer(recipientAddress, tokenAmount);
    await tx.wait(1);

    console.log(`iFehu отправлены пользователю ${recipientAddress} в сети Polygon`);

    // Обновляем статус депозита на 'completed'
    const updateDepositStatusQuery = `
      UPDATE deposits
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(updateDepositStatusQuery, ['completed', id]);
  } catch (error) {
    console.error(`Ошибка отправки iFehu в сети Polygon:`, error);

    // Обновляем статус депозита на 'error'
    const updateDepositStatusQuery = `
      UPDATE deposits
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(updateDepositStatusQuery, ['error', id]);
  }
};

router.get('/api/get-deposits', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const depositsResult = await pool.query('SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.status(200).json({ deposits: depositsResult.rows });
  } catch (error) {
    console.error('Ошибка получения депозитов:', error);
    res.status(500).json({ message: 'Ошибка получения депозитов.' });
  }
});

router.post('/api/p2p-orders/create', authenticateToken, async (req, res) => {
  /*
    ждем в body:
    {
      orderType: 'buy' | 'sell',
      currency: 'RUB' | 'USD' | ...
      limitMin: number,
      limitMax: number,
      paymentMethod: 'bank'|'crypto',
      bankName?: 'Sberbank'|'Tinkoff'|..., 
      bankAccount?: 'номер_телефона_или_карты',
      cryptoBlockchain?: 'polygon'|..., 
      cryptoCoin?: 'USDT'|...,
      cryptoAddress?: '0x...',
    }
    price - не приходит от пользователя, возьмём из API
  */
  try {
    const userId = req.user.userId; // id авторизованного пользователя
    const {
      orderType,
      currency,
      limitMin,
      limitMax,
      paymentMethod,
      bankName,
      bankAccount,
      cryptoBlockchain,
      cryptoCoin,
      cryptoAddress,
    } = req.body;

    // 1) Получаем актуальную цену iFeHu из https://sitworldstat.link/api/rates
    // Предположим, что там приходят курсы в объекте { usd: 1.0, rub: 100.0, ... }
    // Ваша логика, как получать "цену iFeHu"?
    // Допустим, iFeHu = 0.124 * currencyRate. 
    // Или у вас свой endpoint. Ниже - просто демо.
    const ratesRes = await axios.get('https://sitworldstat.link/api/rates');
    const rates = ratesRes.data; // { usd: ..., rub: ... }
    // Если currency == 'RUB', price = some formula
    let price;
    if (!rates[currency.toLowerCase()]) {
      return res.status(400).json({ message: 'Нет курса для такой валюты' });
    }
    // Допустим, price = 1 iFeHu = X units of currency
    // Пример: iFeHuRateInUSD = 0.124, iFeHuRateInRUB = 0.124 * rates['rub']
    // Придумаем для demo:
    const iFeHuRate = 0.124 * rates[currency.toLowerCase()];
    price = iFeHuRate.toFixed(2); 

    // 2) Вставляем в p2p_orders
    const insertQuery = `
      INSERT INTO p2p_orders
        (user_id, order_type, currency, price,
         limit_min, limit_max, payment_method,
         bank_name, bank_account,
         crypto_blockchain, crypto_coin, crypto_address,
         status)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7,
         $8, $9,
         $10, $11, $12,
         'created')
      RETURNING *
    `;
    const values = [
      userId, orderType, currency, price,
      limitMin, limitMax, paymentMethod,
      paymentMethod === 'bank' ? bankName : null,
      paymentMethod === 'bank' ? bankAccount : null,
      paymentMethod === 'crypto' ? cryptoBlockchain : null,
      paymentMethod === 'crypto' ? cryptoCoin : null,
      paymentMethod === 'crypto' ? cryptoAddress : null,
    ];

    const result = await pool.query(insertQuery, values);
    const newOrder = result.rows[0];

    return res.status(201).json({
      message: 'Ордер создан',
      order: newOrder,
    });
  } catch (error) {
    console.error('Ошибка при создании p2p-ордера:', error);
    res.status(500).json({ message: 'Ошибка при создании p2p-ордера' });
  }
});

// Список ордеров, не показываем те, что in_process или completed, если хотим только "свободные"
router.get('/api/p2p-orders/list', authenticateToken, async (req, res) => {
  try {
    // Допустим, показываем только 'created'
    const result = await pool.query(`
      SELECT o.*,
             u.phone AS owner_phone
      FROM p2p_orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.status = 'created'
      ORDER BY o.id DESC
    `);
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Ошибка получения списка p2p-ордеров:', error);
    res.status(500).json({ message: 'Ошибка получения p2p-ордеров' });
  }
});

// Выбрать ордер (переводим в статус 'in_process', указываем buyer_id)
router.post('/api/p2p-orders/:id/choose', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const buyerId = req.user.userId;

    // Убедимся, что ордер в статусе 'created'
    const checkRes = await pool.query(`
      SELECT * FROM p2p_orders
       WHERE id = $1 AND status = 'created'
    `, [orderId]);
    if (checkRes.rows.length === 0) {
      return res.status(400).json({ message: 'Ордер не найден или уже занят' });
    }

    // Переводим в in_process
    await pool.query(`
      UPDATE p2p_orders
       SET status = 'in_process',
           buyer_id = $1,
           updated_at = NOW()
       WHERE id = $2
    `, [buyerId, orderId]);

    res.json({ message: 'Ордер переведён в статус in_process' });
  } catch (error) {
    console.error('Ошибка choose p2p order:', error);
    res.status(500).json({ message: 'Ошибка обработки ордера' });
  }
});

// Завершить ордер (status='completed'), увеличить счётчик
router.post('/api/p2p-orders/:id/complete', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;

    // Узнаем, кто хозяин ордера (user_id)
    const orderRes = await pool.query(`
      SELECT user_id, status FROM p2p_orders WHERE id = $1
    `, [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: 'Ордер не найден' });
    }
    const { user_id, status } = orderRes.rows[0];
    if (status !== 'in_process') {
      return res.status(400).json({ message: 'Ордер не в процессе' });
    }

    // Ставим completed
    await pool.query(`
      UPDATE p2p_orders
        SET status='completed',
            updated_at=NOW()
        WHERE id=$1
    `, [orderId]);

    // // Увеличиваем счётчик у автора
    // await pool.query(`
    //   UPDATE users
    //     SET completed_orders_count = completed_orders_count + 1
    //   WHERE id = $1
    // `, [user_id]);

    return res.json({ message: 'Ордер завершён' });
  } catch (error) {
    console.error('Ошибка завершения p2p-ордера:', error);
    res.status(500).json({ message: 'Ошибка завершения p2p-ордера' });
  }
});

router.post('/api/send-confirmation-code', async (req, res) => {
  try {
    const { email } = req.body; // Только email
    // 1) Находим пользователя по email:
    const userRes = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь с таким email не найден' });
    }
    const userId = userRes.rows[0].id;

    // 2) Генерим код и сохраняем
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expireDate = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(`
      INSERT INTO email_confirmations (user_id, email, code, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [userId, email, code, expireDate]);

    // 3) Отправляем письмо
    await sendVerificationEmail(email, code);

    return res.json({ message: 'Код отправлен на почту' });
  } catch (error) {
    console.error('Ошибка send-confirmation-code:', error);
    return res.status(500).json({ message: 'Ошибка сервера при отправке кода' });
  }
});

router.post('/api/check-confirmation-code', async (req, res) => {
  try {
    const { email, code } = req.body; // теперь присылаем email + code
    // 1) Находим userId по email
    const userRes = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    const userId = userRes.rows[0].id;

    // 2) Ищем в email_confirmations по user_id, email, code
    const confRes = await pool.query(`
      SELECT * FROM email_confirmations
      WHERE user_id=$1 AND email=$2
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, email]);

    if (confRes.rows.length === 0) {
      return res.status(400).json({ message: 'Код не найден' });
    }
    const record = confRes.rows[0];

    if (record.code !== code) {
      return res.status(400).json({ message: 'Неверный код' });
    }
    if (new Date() > record.expires_at) {
      return res.status(400).json({ message: 'Срок действия кода истёк' });
    }

    // Ставим confirmed_email
    await pool.query(`
      UPDATE users
      SET confirmed_email=true
      WHERE id=$1
    `, [userId]);

    // Удаляем записи
    await pool.query(`DELETE FROM email_confirmations WHERE user_id=$1`, [userId]);

    return res.json({ message: 'Email подтверждён' });
  } catch (error) {
    console.error('Ошибка check-confirmation-code:', error);
    return res.status(500).json({ message: 'Ошибка сервера при проверке кода' });
  }
});


app.listen(port, () => {
  console.log(`Сервер работает на порту ${port}`);
});
