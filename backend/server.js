// backend/server.js
const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // Подключаем библиотеку для работы с базой
const config = require('./config');

const app = express();
const PORT = 3000;

// ТВОЯ ССЫЛКА ДЛЯ ПОДКЛЮЧЕНИЯ (вставь её сюда)
const DATABASE_URL = 'postgresql://neondb_owner:npg_ZF8YphcWLGB1@ep-tiny-wave-ald7394w-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Настройка подключения к облаку
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Обязательно для облачных баз вроде Neon
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Функция для создания таблицы в облаке (запустится один раз при старте)
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_date DATE NOT NULL,
                client_name TEXT NOT NULL,
                contractor_name TEXT NOT NULL,
                route TEXT,
                client_rate NUMERIC,
                contractor_rate NUMERIC,
                payment_status TEXT DEFAULT 'Ожидание',
                extra_expenses JSONB DEFAULT '[]'
            );
        `);
        console.log("✅ Таблица в облаке готова к работе");
    } catch (err) {
        console.error("❌ Ошибка инициализации базы:", err);
    }
};

initDB();

// 1. ПОЛУЧИТЬ все заявки из базы
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
        // Превращаем названия из БД в те, что ждет наш фронтенд
        const formattedData = result.rows.map(row => ({
            id: row.id,
            orderDate: row.order_date.toISOString().split('T')[0],
            clientName: row.client_name,
            contractorName: row.contractor_name,
            route: row.route,
            clientRate: Number(row.client_rate),
            contractorRate: Number(row.contractor_rate),
            paymentStatus: row.payment_status,
            extraExpenses: row.extra_expenses || []
        }));
        res.json({ status: "success", data: formattedData });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// 2. ДОБАВИТЬ заявку в базу
app.post('/api/orders', async (req, res) => {
    const { orderDate, clientName, contractorName, route, clientRate, contractorRate } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO orders (order_date, client_name, contractor_name, route, client_rate, contractor_rate) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [orderDate, clientName, contractorName, route, clientRate, contractorRate]
        );
        res.json({ status: "success", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// 3. ИЗМЕНИТЬ статус (Светофор)
app.patch('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE orders SET payment_status = $1 WHERE id = $2', [status, id]);
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// 4. ДОБАВИТЬ расход
app.post('/api/orders/:id/expenses', async (req, res) => {
    const { id } = req.params;
    const { category, amount } = req.body;
    try {
        // Хитрая операция: добавляем объект в JSON-массив прямо в базе
        await pool.query(
            "UPDATE orders SET extra_expenses = extra_expenses || $1::jsonb WHERE id = $2",
            [JSON.stringify([{ category, amount: Number(amount) }]), id]
        );
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Сервер на PostgreSQL запущен на порту ${PORT}`));