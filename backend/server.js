const express = require('express');
const path = require('path');
const { Pool } = require('pg'); 
const multer = require('multer'); 
const fs = require('fs');         

const app = express();
const PORT = 3000;

// === ВСТАВЬ СЮДА СВОЮ ССЫЛКУ ИЗ NEON ===
const DATABASE_URL = 'postgresql://neondb_owner:npg_ZF8YphcWLGB1@ep-tiny-wave-ald7394w-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=requireс';

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
        await pool.query(`CREATE TABLE IF NOT EXISTS orders ( id SERIAL PRIMARY KEY, order_date DATE NOT NULL, client_name TEXT NOT NULL, contractor_name TEXT NOT NULL, route TEXT, client_rate NUMERIC, contractor_rate NUMERIC, payment_status TEXT DEFAULT 'Ожидание', extra_expenses JSONB DEFAULT '[]' );`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS trip_status TEXT DEFAULT 'На погрузке'`);
        
        // НОВЫЕ КОЛОНКИ
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_date DATE`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS unloading_date DATE`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_type TEXT`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_number TEXT`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT '₽'`);
        
        console.log("✅ База данных успешно обновлена новыми полями!");
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
            id: row.id, 
            orderDate: row.order_date.toISOString().split('T')[0], 
            clientName: row.client_name,
            contractorName: row.contractor_name, 
            route: row.route, 
            clientRate: Number(row.client_rate),
            contractorRate: Number(row.contractor_rate), 
            paymentStatus: row.payment_status,
            tripStatus: row.trip_status || 'На погрузке',
            
            // Новые поля
            loadingDate: row.loading_date ? row.loading_date.toISOString().split('T')[0] : '',
            unloadingDate: row.unloading_date ? row.unloading_date.toISOString().split('T')[0] : '',
            vehicleType: row.vehicle_type || '',
            vehicleNumber: row.vehicle_number || '',
            currency: row.currency || '₽',

            extraExpenses: row.extra_expenses || [], 
            history: row.history || []
        }));
        res.json({ status: "success", data: formattedData });
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    const b = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO orders (order_date, client_name, contractor_name, route, client_rate, contractor_rate, loading_date, unloading_date, vehicle_type, vehicle_number, currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *', 
            [b.orderDate, b.clientName, b.contractorName, b.route, b.clientRate, b.contractorRate, b.loadingDate || null, b.unloadingDate || null, b.vehicleType, b.vehicleNumber, b.currency || '₽']
        );
        res.json({ status: "success", data: result.rows[0] });
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); }
});

app.put('/api/orders/:id', async (req, res) => { 
    const b = req.body; 
    try { 
        await pool.query(
            'UPDATE orders SET order_date = $1, client_name = $2, contractor_name = $3, route = $4, client_rate = $5, contractor_rate = $6, loading_date = $7, unloading_date = $8, vehicle_type = $9, vehicle_number = $10, currency = $11 WHERE id = $12', 
            [b.orderDate, b.clientName, b.contractorName, b.route, b.clientRate, b.contractorRate, b.loadingDate || null, b.unloadingDate || null, b.vehicleType, b.vehicleNumber, b.currency, req.params.id]
        ); 
        res.json({ status: "success" }); 
    } catch (err) { res.status(500).json({ status: "error", message: err.message }); } 
});

app.patch('/api/orders/:id/status', async (req, res) => { try { await pool.query('UPDATE orders SET payment_status = $1 WHERE id = $2', [req.body.status, req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.patch('/api/orders/:id/trip_status', async (req, res) => { try { await pool.query('UPDATE orders SET trip_status = $1 WHERE id = $2', [req.body.status, req.params.id]); await pool.query("UPDATE orders SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ date: new Date().toISOString(), text: `🔄 Статус рейса изменен на: ${req.body.status}` }]), req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.post('/api/orders/:id/expenses', async (req, res) => { try { await pool.query("UPDATE orders SET extra_expenses = extra_expenses || $1::jsonb WHERE id = $2", [JSON.stringify([{ category: req.body.category, amount: Number(req.body.amount) }]), req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.delete('/api/orders/:id', async (req, res) => { try { await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.post('/api/orders/:id/history', async (req, res) => { try { await pool.query("UPDATE orders SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ date: new Date().toISOString(), text: req.body.text }]), req.params.id]); res.json({ status: "success" }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });
app.post('/api/orders/:id/history_file', upload.single('document'), async (req, res) => { try { if (!req.file) throw new Error("Файл не найден"); const fileUrl = '/uploads/' + req.file.filename; await pool.query("UPDATE orders SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2", [JSON.stringify([{ date: new Date().toISOString(), text: `📎 Прикреплен документ: ${req.file.originalname}`, fileUrl: fileUrl }]), req.params.id]); res.json({ status: "success", fileUrl }); } catch (err) { res.status(500).json({ status: "error", message: err.message }); } });

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));