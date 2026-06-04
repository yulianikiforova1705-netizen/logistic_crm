const express = require('express');
const path = require('path');
const { Pool } = require('pg'); 
const multer = require('multer'); 
const fs = require('fs');         
const https = require('https'); 

const app = express();
const PORT = 3000;

// === ТВОИ СЕКРЕТНЫЕ КЛЮЧИ ===
const DATABASE_URL = 'postgresql://neondb_owner:npg_ZF8YphcWLGB1@ep-tiny-wave-ald7394w-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=requireс';
const TELEGRAM_TOKEN = '8973776187:AAFCGBEp5ooyphG-coU-Xw8PL4MW9yGcv_Y';
const TELEGRAM_CHAT_ID = '765319326'; 
const DADATA_TOKEN = 'a4d7d506c3120574657233f6a83befd9bf6e7b80'; 

// Функция Telegram
function sendTelegramNotification(message) {
    if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID.includes('СЮДА')) return;
    const data = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' });
    const options = { hostname: 'api.telegram.org', port: 443, path: `/bot${TELEGRAM_TOKEN}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(options);
    req.on('error', (e) => console.error("Ошибка Telegram:", e));
    req.write(data); req.end();
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir) },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadDir));

const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS orders ( id SERIAL PRIMARY KEY, order_date DATE NOT NULL, client_name TEXT NOT NULL, contractor_name TEXT NOT NULL, route TEXT, client_rate NUMERIC, contractor_rate NUMERIC, payment_status TEXT DEFAULT 'Ожидание', extra_expenses JSONB DEFAULT '[]', history JSONB DEFAULT '[]', trip_status TEXT DEFAULT 'На погрузке', loading_date DATE, unloading_date DATE, vehicle_type TEXT, vehicle_number TEXT, currency TEXT DEFAULT '₽' );`);
        console.log("✅ База данных готова!");
    } catch (err) { console.error("❌ Ошибка базы:", err); }
};
initDB();

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '12345') res.json({ status: "success", token: "secret-crm-token" });
    else res.status(401).json({ status: "error", message: "Ошибка" });
});

app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
        const formattedData = result.rows.map(row => ({
            id: row.id, orderDate: row.order_date.toISOString().split('T')[0], clientName: row.client_name, contractorName: row.contractor_name, route: row.route, clientRate: Number(row.client_rate), contractorRate: Number(row.contractor_rate), paymentStatus: row.payment_status, tripStatus: row.trip_status || 'На погрузке', loadingDate: row.loading_date ? row.loading_date.toISOString().split('T')[0] : '', unloadingDate: row.unloading_date ? row.unloading_date.toISOString().split('T')[0] : '', vehicleType: row.vehicle_type || '', vehicleNumber: row.vehicle_number || '', currency: row.currency || '₽', extraExpenses: row.extra_expenses || [], history: row.history || []
        }));
        res.json({ status: "success", data: formattedData });
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    const b = req.body;
    try {
        const result = await pool.query('INSERT INTO orders (order_date, client_name, contractor_name, route, client_rate, contractor_rate, loading_date, unloading_date, vehicle_type, vehicle_number, currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *', [b.orderDate, b.clientName, b.contractorName, b.route, b.clientRate, b.contractorRate, b.loadingDate || null, b.unloadingDate || null, b.vehicleType, b.vehicleNumber, b.currency || '₽']);
        res.json({ status: "success", data: result.rows[0] });
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); }
});

app.put('/api/orders/:id', async (req, res) => { const b = req.body; try { await pool.query('UPDATE orders SET order_date = $1, client_name = $2, contractor_name = $3, route = $4, client_rate = $5, contractor_rate = $6, loading_date = $7, unloading_date = $8, vehicle_type = $9, vehicle_number = $10, currency = $11 WHERE id = $12', [b.orderDate, b.clientName, b.contractorName, b.route, b.clientRate, b.contractorRate, b.loadingDate || null, b.unloadingDate || null, b.vehicleType, b.vehicleNumber, b.currency, req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });

app.patch('/api/orders/:id/status', async (req, res) => { 
    try { 
        await pool.query('UPDATE orders SET payment_status = $1 WHERE id = $2', [req.body.status, req.params.id]); 
        if (req.body.status === 'Просрочка') sendTelegramNotification(`⚠️ <b>ВНИМАНИЕ: Просрочка!</b>\nРейс #${req.params.id} переведен в статус "Просрочка оплаты".\nТребуется контроль!`);
        res.json({ status: "success" }); 
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); } 
});

app.patch('/api/orders/:id/trip_status', async (req, res) => { try { await pool.query('UPDATE orders SET trip_status = $1 WHERE id = $2', [req.body.status, req.params.id]); await pool.query("UPDATE orders SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ date: new Date().toISOString(), text: `🔄 Статус рейса изменен на: ${req.body.status}` }]), req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });

app.post('/api/orders/:id/expenses', async (req, res) => { 
    try { 
        await pool.query("UPDATE orders SET extra_expenses = COALESCE(extra_expenses, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ category: req.body.category, amount: Number(req.body.amount) }]), req.params.id]); 
        if (['Штраф', 'Простой', 'Перегруз', 'Опоздание'].includes(req.body.category)) sendTelegramNotification(`🚨 <b>Утечка бюджета!</b>\nПо рейсу #${req.params.id} добавлен непредвиденный расход:\n<b>${req.body.category}:</b> ${req.body.amount}`);
        res.json({ status: "success" }); 
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); } 
});

app.delete('/api/orders/:id', async (req, res) => { try { await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.post('/api/orders/:id/history', async (req, res) => { try { await pool.query("UPDATE orders SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ date: new Date().toISOString(), text: req.body.text }]), req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.post('/api/orders/:id/history_file', upload.single('document'), async (req, res) => { try { if (!req.file) throw new Error("Файл не найден"); const fileUrl = '/uploads/' + req.file.filename; await pool.query("UPDATE orders SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ date: new Date().toISOString(), text: `📎 Прикреплен документ: ${req.file.originalname}`, fileUrl: fileUrl }]), req.params.id]); res.json({ status: "success", fileUrl }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });

app.get('/api/1c/sync', async (req, res) => {
    const token = req.query.token;
    if (token !== 'super-secret-1c-token-2026') return res.status(403).json({ error: "Доступ запрещен." });
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
        const formattedData = result.rows.map(row => ({ "НомерРейса": row.id, "ДатаЗаявки": row.order_date.toISOString().split('T')[0], "Клиент": row.client_name, "Подрядчик": row.contractor_name, "Маршрут": row.route || "", "СтавкаКлиента": Number(row.client_rate), "СтавкаПодрядчика": Number(row.contractor_rate), "Валюта": row.currency || "₽", "СтатусОплаты": row.payment_status, "СтатусРейса": row.trip_status || "На погрузке" }));
        res.json(formattedData);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// НОВЫЙ МАРШРУТ: Поиск по ИНН через DaData
app.post('/api/inn', (req, res) => {
    const inn = req.body.inn;
    if (!DADATA_TOKEN || DADATA_TOKEN.includes('СЮДА')) return res.status(500).json({ status: 'error', message: 'API ключ DaData не настроен' });

    const data = JSON.stringify({ query: inn });
    const options = {
        hostname: 'suggestions.dadata.ru', port: 443, path: '/suggestions/api/4_1/rs/findById/party', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Token ' + DADATA_TOKEN, 'Content-Length': Buffer.byteLength(data) }
    };

    const request = https.request(options, (response) => {
        let body = '';
        response.on('data', (chunk) => body += chunk);
        response.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                if (parsed.suggestions && parsed.suggestions.length > 0) res.json({ status: 'success', name: parsed.suggestions[0].value });
                else res.json({ status: 'not_found' });
            } catch (e) { res.status(500).json({ status: 'error' }); }
        });
    });
    request.on('error', (e) => res.status(500).json({ status: 'error', message: e.message }));
    request.write(data); request.end();
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));