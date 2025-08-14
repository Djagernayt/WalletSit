const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const { execFile } = require('child_process');


const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'finanalys',
  password: 'Fehu',
  port: 5432,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Убедитесь, что папка "uploads" существует
  },
  filename: function (req, file, cb) {
    // Добавляем уникальный суффикс к оригинальному имени файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.get('/api/test', (req, res) => {
  res.json({ message: 'Will add soon!' });
});

// GET: Скачать устав фонда
app.get('/api/download_statute/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM investment_statute WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка отправки файла устава:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файла' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_statute:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET: Получить последнюю версию устава
app.get('/api/latest_statute', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM investment_statute ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка в latest_statute:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST: Загрузить новый устав
app.post('/api/upload_statute', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO investment_statute (filename, file_size, file_path) VALUES ($1, $2, $3) RETURNING *',
      [originalname, size, filePath]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки устава:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT: Обновить устав
app.put('/api/upload_statute/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM investment_statute WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старого устава:', err);
      });
    }

    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);

    const result = await pool.query(
      'UPDATE investment_statute SET filename = $1, file_size = $2, file_path = $3, uploaded_at = NOW() WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления устава:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* --------------------------------
   2. КОШЕЛЁК (wallet_exe)
-------------------------------- */

app.get('/api/download_wallet/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM wallet_exe WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка скачивания кошелька:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файла' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_wallet:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_wallet', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM wallet_exe ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения кошелька:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* --------------------------------
   3. Политика конфиденциальности 
   RU (privacy_ru), US (privacy_us)
-------------------------------- */

// Пример для privacy_ru
app.get('/api/download_privacy_ru/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM privacy_ru WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файла:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файла' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_privacy_ru:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_privacy_ru', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM privacy_ru ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения политики конфиденциальности:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload_privacy_ru', upload.single('file'), async (req, res) => {
  try {
    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO privacy_ru (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [originalname, size, filePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки политики конфиденциальности:', err);
    res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/upload_privacy_ru/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM privacy_ru WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старой политики конфиденциальности:', err);
      });
    }

    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'UPDATE privacy_ru SET filename = $1, file_size = $2, file_path = $3 WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления политики конфиденциальности:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/download_privacy_en/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM privacy_en WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файла:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файла' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_privacy_en:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_privacy_en', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM privacy_en ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения политики конфиденциальности:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload_privacy_en', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO privacy_en (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [originalname, size, filePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки политики конфиденциальности:', err);
    res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/upload_privacy_en/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM privacy_en WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старой политики конфиденциальности:', err);
      });
    }

    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'UPDATE privacy_en SET filename = $1, file_size = $2, file_path = $3 WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления политики конфиденциальности:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/download_terms_ru/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM terms_ru WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файлов:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файлов' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_terms_ru:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_terms_ru', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM terms_ru ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения условий использования:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload_terms_ru', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO terms_ru (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [originalname, size, filePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки условий использования:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/upload_terms_ru/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM terms_ru WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старых условий использования:', err);
      });
    }

    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'UPDATE terms_ru SET filename = $1, file_size = $2, file_path = $3 WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) { 
    console.error('Ошибка обновления условий использования:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/download_terms_en/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM terms_en WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файлов:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файлов' });
      }
  });
  } catch (err) {
    console.error('Ошибка в download_terms_en:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_terms_en', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM terms_en ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]); 
  } catch (err) {
    console.error('Ошибка получения условий использования:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload_terms_en', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO terms_en (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [originalname, size, filePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки условий использования:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/upload_terms_en/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM terms_en WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старых условий использования:', err);
      });
    }

    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'UPDATE terms_en SET filename = $1, file_size = $2, file_path = $3 WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления условий использования:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/download_disclaimer_ru/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM disclaimer_ru WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файлов:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файлов' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_disclaimer_ru:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_disclaimer_ru', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disclaimer_ru ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения уведомления:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload_disclaimer_ru', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO disclaimer_ru (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [originalname, size, filePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки уведомления:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/upload_disclaimer_ru/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM disclaimer_ru WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старого уведомления:', err);
      });
    }

    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'UPDATE disclaimer_ru SET filename = $1, file_size = $2, file_path = $3 WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления уведомления:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/download_disclaimer_us/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('SELECT file_path, filename FROM disclaimer_us WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const { file_path, filename } = result.rows[0];
    const absolutePath = path.resolve(file_path);
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Ошибка при отправке файлов:', err);
        res.status(500).json({ error: 'Ошибка при скачивании файлов' });
      }
    });
  } catch (err) {
    console.error('Ошибка в download_disclaimer_us:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_disclaimer_us', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disclaimer_us ORDER BY uploaded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения уведомления:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload_disclaimer_us', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    const { originalname, filename, size } = req.file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(
      'INSERT INTO disclaimer_us (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [originalname, size, filePath]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки уведомления:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/upload_disclaimer_us/:id', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const oldRecord = await pool.query('SELECT file_path FROM disclaimer_us WHERE id = $1', [id]);
    if (oldRecord.rows.length > 0) {
      const oldFilePath = oldRecord.rows[0].file_path;
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старого уведомления:', err);
      });
    }

    const { originalname, filename, size } = file;
    const filePath = path.join('uploads', filename);
    const result = await pool.query(  
      'UPDATE disclaimer_us SET filename = $1, file_size = $2, file_path = $3 WHERE id = $4 RETURNING *',
      [originalname, size, filePath, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления уведомления:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// // GET API для получения последней версии устава
// app.get('/api/latest_statute', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM investment_statute ORDER BY uploaded_at DESC LIMIT 1');
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Запись не найдена' });
//     }
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error('Error fetching latest statute:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });


// // GET API для скачивания файла устава по ID
// app.get('/api/download_statute/:id', async (req, res) => {
//   try {
//     const id = req.params.id;
//     const result = await pool.query('SELECT file_path, filename FROM investment_statute WHERE id = $1', [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Запись не найдена' });
//     }
//     const { file_path, filename } = result.rows[0];
//     // Формируем абсолютный путь к файлу
//     const absolutePath = path.resolve(file_path);
//     // Отправляем файл с заголовком, чтобы браузер скачал его
//     res.download(absolutePath, filename, (err) => {
//       if (err) {
//         console.error('Ошибка при отправке файла:', err);
//         res.status(500).json({ error: 'Ошибка при скачивании файла' });
//       }
//     });
//   } catch (err) {
//     console.error('Error in download_statute:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });


// app.post('/api/upload_statute', upload.single('file'), async (req, res) => {
//   try {
//     const file = req.file;
//     if (!file) {
//       return res.status(400).json({ error: 'Файл не загружен' });
//     }
//     const { originalname, filename, size } = file;
//     const filePath = path.join('uploads', filename);

//     const result = await pool.query(
//       'INSERT INTO investment_statute (filename, file_size, file_path) VALUES ($1, $2, $3) RETURNING *',
//       [originalname, size, filePath]
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     console.error('Error uploading file:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // 2. PUT API для обновления файла по ID
// app.put('/api/upload_statute/:id', upload.single('file'), async (req, res) => {
//   try {
//     const id = req.params.id;
//     const file = req.file;
//     if (!file) {
//       return res.status(400).json({ error: 'Файл не загружен' });
//     }

//     // Получаем старую запись, чтобы удалить старый файл
//     const oldRecordResult = await pool.query('SELECT file_path FROM investment_statute WHERE id = $1', [id]);
//     if (oldRecordResult.rows.length > 0) {
//       const oldFilePath = oldRecordResult.rows[0].file_path;
//       // Удаляем старый файл (если требуется)
//       fs.unlink(oldFilePath, (err) => {
//         if (err) {
//           console.error('Error deleting old file:', err);
//         }
//       });
//     }

//     const { originalname, filename, size } = file;
//     const filePath = path.join('uploads', filename);

//     const result = await pool.query(
//       'UPDATE investment_statute SET filename = $1, file_size = $2, file_path = $3, uploaded_at = NOW() WHERE id = $4 RETURNING *',
//       [originalname, size, filePath, id]
//     );
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error('Error updating file:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// app.get('/api/download_wallet/:id', async (req, res) => {
//   try {
//     const id = req.params.id;
//     const result = await pool.query('SELECT file_path, filename FROM wallet_exe WHERE id = $1', [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Запись не найдена' });
//     }
//     const { file_path, filename } = result.rows[0];
//     const absolutePath = path.resolve(file_path);
//     res.download(absolutePath, filename, (err) => {
//       if (err) {
//         console.error('Ошибка при отправке файла:', err);
//         res.status(500).json({ error: 'Ошибка при скачивании файла' });
//       }
//     });
//   } catch (err) {
//     console.error('Error in download_wallet:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // GET API для получения последней версии кошелька
// app.get('/api/latest_wallet', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM wallet_exe ORDER BY uploaded_at DESC LIMIT 1');
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Запись не найдена' });
//     }
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error('Error fetching latest wallet exe:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// app.get('/api/check_wallet', async (req, res) => {
//   try {
//     // Путь к директории, где лежат файлы кошелька
//     const walletDir = path.join(__dirname, 'uploads', 'wallet');
    
//     // Проверяем, существует ли директория. Если нет – можно создать её
//     if (!fs.existsSync(walletDir)) {
//       fs.mkdirSync(walletDir, { recursive: true });
//     }
    
//     // Считываем список файлов в папке
//     const files = fs.readdirSync(walletDir);
    
//     // Для каждого файла проверяем, есть ли запись в БД
//     for (const file of files) {
//       const fullPath = path.join(walletDir, file);
//       const dbResult = await pool.query('SELECT * FROM wallet_exe WHERE file_path = $1', [fullPath]);
//       if (dbResult.rows.length === 0) {
//         // Файл не найден в БД – получаем его информацию
//         const stats = fs.statSync(fullPath);
//         // Вставляем новую запись (uploaded_at берём из stats.birthtime)
//         await pool.query(
//           'INSERT INTO wallet_exe (filename, file_size, file_path, uploaded_at) VALUES ($1, $2, $3, $4)',
//           [file, stats.size, fullPath, stats.birthtime]
//         );
//       }
//     }
    
//     const latestResult = await pool.query('SELECT * FROM wallet_exe ORDER BY uploaded_at DESC LIMIT 1');
//     if (latestResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Файл кошелька не найден' });
//     }
//     res.json(latestResult.rows[0]);
//   } catch (err) {
//     console.error("Ошибка в эндпоинте check_wallet:", err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

app.get('/api/news', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM news ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST: Создать новую новость
app.post('/api/news', async (req, res) => {
  const { title, content, photos } = req.body; 
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO news (title, content, photos) VALUES ($1, $2, $3)
       RETURNING *`,
      [title, content, photos || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating news:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT: Обновить новость по заголовку
app.put('/api/news/:title', async (req, res) => {
  const newsTitle = decodeURIComponent(req.params.title);
  const { content, photos } = req.body; // допускаем обновление контента и фотографий
  if (!content) {
    return res.status(400).json({ error: 'Content is required for update' });
  }
  try {
    // Обновляем поле updated_at автоматически с помощью NOW()
    const result = await pool.query(
      `UPDATE news 
       SET content = $1, photos = $2, updated_at = NOW() 
       WHERE title = $3
       RETURNING *`,
      [content, photos || null, newsTitle]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating news:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/news/:title', async (req, res) => {
  const newsTitle = decodeURIComponent(req.params.title);
  try {
    const result = await pool.query(
      `DELETE FROM news WHERE title = $1 RETURNING *`,
      [newsTitle]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News not found' });
    }
    res.json({ message: 'News deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting news:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_fund', async (req, res) => {
  try {
    const result = await pool.query('SELECT fund FROM handle_market ORDER BY recorded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No records found' });
    } else {
      res.json({ latest_fund: result.rows[0].fund });
    }
  } catch (err) {
    console.error('Error fetching latest fund:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_coins_sell', async (req, res) => {
  try {
    const result = await pool.query('SELECT coins_sell FROM handle_market ORDER BY recorded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No records found' });
    } else {
      res.json({ latest_coins_sell: result.rows[0].coins_sell });
    }
  } catch (err) {
    console.error('Error fetching latest coins_sell:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/handle_market', async (req, res) => {
  const { fund, coins_sell, assets } = req.body;
  if (typeof fund === 'undefined' || typeof coins_sell === 'undefined' || typeof assets === 'undefined') {
    return res.status(400).json({ error: 'Fund, coins_sell and assets are required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO handle_market (fund, coins_sell, assets, recorded_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [fund, coins_sell, assets]
    );
    res.status(201).json(result.rows[0]);

    const scriptPath = path.join(__dirname, '..', '..', 'python', 'ifehu2.py');
    execFile('python3', [scriptPath], (error, stdout, stderr) => {
      if (error) {
        console.error('Ошибка выполнения Python-скрипта:', error);
        return;
      }
      console.log('Вывод Python-скрипта:', stdout);
    });

  } catch (err) {
    console.error('Error creating new record in handle_market:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/latest_assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT assets FROM handle_market ORDER BY recorded_at DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No records found' });
    }
    res.json({ latest_assets: result.rows[0].assets });
  } catch (err) {
    console.error('Error fetching latest assets:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/latest_usd_rate', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT usd FROM ifehu_rates ORDER BY id DESC LIMIT 1'
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No records found' });
    }
    res.json({ latest_usd: result.rows[0].usd });
  } catch (err) {
    console.error('Error fetching latest USD rate:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/api/fehu_history', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fehu_history ORDER BY recorded_at DESC LIMIT 24');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching fehu_history data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/fehu_rates_bool', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fehu_rates_bool ORDER BY recorded_at DESC LIMIT 1');
    res.json(result.rows[0]); 
  } catch (err) {
    console.error('Error fetching fehu_rates_bool data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/fehu_rates_bool', async (req, res) => {
  const boolData = req.body;

  if (!boolData) {
    return res.status(400).json({ error: 'No data provided in request body' });
  }

  const fields = Object.keys(boolData).filter(key => key !== 'id' && key !== 'recorded_at');
  const values = fields.map(field => boolData[field]);

  const fieldsString = fields.join(', ');
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

  try {
    const result = await pool.query(
      `INSERT INTO fehu_rates_bool (${fieldsString}, recorded_at) VALUES (${placeholders}, NOW()) RETURNING *`,
      values
    );
    res.json({ message: 'Data saved successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Error inserting data into fehu_rates_bool:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/fehu_rates_weights', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fehu_rates_weights ORDER BY recorded_at DESC LIMIT 1');
    res.json(result.rows[0]); 
  } catch (err) {
    console.error('Error fetching fehu_rates_weights data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/fehu_rates_weights', async (req, res) => {
  const weightsData = req.body;

  if (!weightsData) {
    return res.status(400).json({ error: 'No data provided in request body' });
  }

  console.log('Received weights data:', weightsData);

  const fields = Object.keys(weightsData).filter(key => key !== 'id' && key !== 'recorded_at');
  const values = fields.map(field => weightsData[field]);

  const fieldsString = fields.join(', ');
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

  try {
    const result = await pool.query(
      `INSERT INTO fehu_rates_weights (${fieldsString}, recorded_at) VALUES (${placeholders}, NOW()) RETURNING *`,
      values
    );
    res.json({ message: 'Data saved successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Error inserting data into fehu_rates_weights:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/exchange', async (req, res) => {
  const amount = parseFloat(req.query.amount) || 1;
  const currencyFrom = req.query.from || 'FEHU';
  const currencyTo = req.query.to || 'USD';

  try {
    const convertedAmount = await convertCurrency(amount, currencyFrom, currencyTo);
    res.json({ convertedAmount });
  } catch (err) {
    console.error('Error during currency exchange:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function getCurrencyRateExchange(fromCurrency, toCurrency) {
  try {
    const result = await pool.query('SELECT * FROM fehu_rates ORDER BY recorded_at DESC LIMIT 1');
    const latestRate = result.rows[0];

    let rate;
    if (toCurrency === 'FEHU') {
      rate = 1 / (latestRate[fromCurrency.toLowerCase()] || 1);
    } else {
      rate = latestRate[toCurrency.toLowerCase()] || 1;
    }
    return rate;
  } catch (err) {
    throw new Error('Error fetching currency rates');
  }
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
  let rate = await getCurrencyRateExchange(fromCurrency, toCurrency);

  const settingsResult = await pool.query('SELECT * FROM exchange_settings ORDER BY recorded_at DESC LIMIT 1');
  const settings = settingsResult.rows[0];
  const buyPercentage = parseFloat(settings.buy_percentage) || 0.97;  
  const sellPercentage = parseFloat(settings.sell_percentage) || 1.03; 

  if (fromCurrency === 'FEHU') {
    rate *= sellPercentage; 
  } else {
    rate *= buyPercentage;  
  }

  const convertedAmount = amount * rate;
  return convertedAmount;
}

app.get('/api/exchange_settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exchange_settings ORDER BY recorded_at DESC LIMIT 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching exchange settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/exchange_settings', async (req, res) => {
  const { buy_percentage, sell_percentage } = req.body;

  if (buy_percentage == null || sell_percentage == null) {
    return res.status(400).json({ error: 'Both buy_percentage and sell_percentage are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO exchange_settings (buy_percentage, sell_percentage) VALUES ($1, $2) RETURNING *',
      [buy_percentage, sell_percentage]
    );
    res.json({ message: 'Settings updated successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Error updating exchange settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/invest_income_all', async (req, res) => {
  res.json ({ count: 000 });
});

app.get('/api/invest_income_month', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/invest_income_eur', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/invest_ifehu', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/invest_system_count', async (req, res) => {
  res.json({ count: 2500000 });
});

app.get('/api/invest_users_count', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/users_coin_count', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/users_count', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/coins_moving', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/invest_transaction_count', async (req, res) => {
  res.json({ count: 000 });
});

app.get('/api/market_cap_eur', async (req, res) => {
  try {
    const result = await pool.query('SELECT eur FROM fehu_rates ORDER BY recorded_at DESC LIMIT 1');
    
    if (result.rows.length > 0) {
      const marketCapEur = result.rows[0].eur * 2500000 * 0.124;
      res.json({ count: marketCapEur });
    } else {
      res.status(404).json({ error: 'Data not found' });
    }
  } catch (err) {
    console.error('Error fetching market cap in EUR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/rates', async (req, res) => {
  try {
    const result = await pool.query('SELECT usd, eur, gbp, try_rate, krw, zar, sar, rub, mxn, jpy, idr, inr, cny, cad, brl, aud, ars, gold, byn, chf, nzd, pln, sgd, ils, thb, aed, jod, kwd, hkd, kyd FROM fehu_rates ORDER BY recorded_at DESC LIMIT 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/rates_ifehu', async (req, res) => {
  try {
    const queryText = `
      SELECT 
        usd, eur, gbp, try_rate, krw, zar, sar, rub, mxn, jpy, 
        idr, inr, cny, cad, brl, aud, ars, gold, byn, chf, 
        nzd, pln, sgd, ils, thb, aed, jod, kwd, hkd, kyd 
      FROM ifehu_rates 
      ORDER BY recorded_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(queryText);
    // Если строка не найдена, вернём пустой объект или ошибку
    if (result.rows.length === 0) {
      return res.json({});
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get_last_coin_count', async (req, res) => {
  try {
    const result = await pool.query('SELECT count FROM count_coins ORDER BY recorded_at DESC LIMIT 1;');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get_market_cap', async (req, res) => {
  try {
    const coinResult = await pool.query('SELECT count FROM count_coins ORDER BY recorded_at DESC LIMIT 1');
    const rateResult = await pool.query('SELECT eur FROM fehu_rates ORDER BY recorded_at DESC LIMIT 1');

    if (coinResult.rows.length > 0 && rateResult.rows.length > 0) {
      const marketCap = coinResult.rows[0].count * rateResult.rows[0].eur;
      res.json({ count: marketCap });
    } else {
      res.status(404).json({ error: 'Data not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get_monthly_coin_addition', async (req, res) => {
  try {
    const result = await pool.query('SELECT count FROM count_coins ORDER BY recorded_at DESC LIMIT 1;');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get_total_operations', async (req, res) => {
  try {
    const result = await pool.query('SELECT count FROM user_transactions ORDER BY recorded_at DESC LIMIT 1');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get_ifehu_data', async (req, res) => {
  const { currency } = req.query;

  const query = `
    SELECT id, recorded_at, ${currency.toLowerCase()} as rate
    FROM ifehu_rates
    WHERE ${currency.toLowerCase()} IS NOT NULL
    ORDER BY recorded_at DESC
  `;

  try {
    const result = await pool.query(query);

    const chartLabels = result.rows.map(row => new Date(row.recorded_at).toLocaleDateString());
    const chartValues = result.rows.map(row => row.rate);
    
    res.json({
      chartLabels,
      chartValues,
      history: result.rows
    });
  } catch (err) {
    console.error('Error fetching idehu data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



app.get('/api/get_currency_data', async (req, res) => {
  const { currency, range } = req.query;

  let dateCondition;
  let timeInterval;
  switch (range) {
    case 'week':
      dateCondition = "current_date - interval '1 week'";
      timeInterval = 'hour'; 
      break;
    case 'month':
      dateCondition = "current_date - interval '1 month'";
      timeInterval = 'hour'; 
      break;
    case '6month':
      dateCondition = "current_date - interval '6 months'";
      timeInterval = 'day'; 
      break;
    case 'year':
      dateCondition = "current_date - interval '1 year'";
      timeInterval = 'day'; 
      break;
    default:
      dateCondition = "current_date - interval '1 month'";
      timeInterval = 'hour'; 
  }

  const chartDataQuery = `
    SELECT date_trunc('${timeInterval}', recorded_at) as date, ${currency.toLowerCase()} as rate 
    FROM fehu_rates 
    WHERE ${currency.toLowerCase()} IS NOT NULL 
    AND recorded_at >= ${dateCondition}
    ORDER BY recorded_at DESC
  `;

  const historyQuery = `
    SELECT id, recorded_at, ${currency.toLowerCase()} as rate 
    FROM fehu_rates 
    WHERE ${currency.toLowerCase()} IS NOT NULL 
    ORDER BY recorded_at DESC 
    LIMIT 24
  `;

  try {
    const chartDataResult = await pool.query(chartDataQuery);
    const historyResult = await pool.query(historyQuery);

    res.json({
      chartLabels: chartDataResult.rows.map(row => row.date.toLocaleDateString()),
      chartValues: chartDataResult.rows.map(row => row.rate),
      history: historyResult.rows
    });
  } catch (err) {
    console.error('Error fetching currency data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get_invest_data', async (req, res) => {
  const {currency} = req.query;

  const dailyAvgQuery = `
    SELECT date_trunc('day', recorded_at) as date, AVG(${currency.toLowerCase()}) as avg_rate
    FROM fehu_rates
    WHERE ${currency.toLowerCase()} IS NOT NULL
    GROUP BY date_trunc('day', recorded_at)
    ORDER BY date_trunc('day', recorded_at) DESC
  `;
  
  const historyQuery = `
    SELECT id, recorded_at, ${currency.toLowerCase()} as rate 
    FROM fehu_rates 
    WHERE ${currency.toLowerCase()} IS NOT NULL 
    ORDER BY recorded_at DESC 
    LIMIT 24
  `;

  try {
    const dailyAvgResult = await pool.query(dailyAvgQuery);
    const historyResult = await pool.query(historyQuery);

    res.json({
      chartLabels: dailyAvgResult.rows.map(row => row.date.toLocaleDateString()),
      chartValues: dailyAvgResult.rows.map(row => row.avg_rate),
      history: historyResult.rows
    });
  } catch (err) {
    console.error('Error fetching daily average currency data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/graph-stat-invest', async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT
        DATE(recorded_at) AS date,
        AVG(fehu_price) * 0.124 AS average_price
      FROM
        fehu_history
      GROUP BY
        DATE(recorded_at)
      ORDER BY
        DATE(recorded_at);
    `);

    const data = result.rows.map(row => ({
      date: row.date,
      averagePrice: parseFloat(row.average_price),
    }));

    res.status(200).json(data);
  } catch (error) {
    console.error('Ошибка при получении средних цен:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

