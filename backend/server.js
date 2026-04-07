// backend/server.js
const express = require('express');
const path = require('path');
const config = require('./config'); 

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Наша база данных (массив)
const orders = [
    {
        id: 1,
        orderDate: "2026-04-07",
        loadDate: "2026-04-08",
        unloadDate: "2026-04-10",
        clientName: "ООО МегаСтрой",
        contractorName: "ИП Иванов А.А.",
        carNumber: "А123БВ 777",
        route: "Москва - СПБ",
        transportType: "Тент 20т",
        clientRate: 100000,
        contractorRate: 80000,
        currency: "RUB",
        paymentStatus: "Ожидание",
        sync1C: "Синхронизировано",
        extraExpenses: []
    }
];

// 1. Маршрут: Проверка статуса сервера
app.get('/api/status', (req, res) => {
    res.json({ status: "success", systemInfo: { author: config.SYSTEM_AUTHOR } });
});

// 2. Маршрут: ПОЛУЧИТЬ все заявки (GET)
app.get('/api/orders', (req, res) => {
    res.json({ status: "success", data: orders });
});

// 3. Маршрут: ДОБАВИТЬ новую заявку (POST)
app.post('/api/orders', (req, res) => {
    const newOrder = {
        id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1, // Безопасная генерация ID
        orderDate: req.body.orderDate,
        loadDate: "Уточняется",
        unloadDate: "Уточняется",
        clientName: req.body.clientName,
        contractorName: req.body.contractorName,
        carNumber: "Не назначен",
        route: req.body.route,
        transportType: "Стандарт",
        clientRate: Number(req.body.clientRate),
        contractorRate: Number(req.body.contractorRate),
        currency: "RUB",
        paymentStatus: "Ожидание",
        sync1C: "В очереди",
        extraExpenses: []
    };
    orders.push(newOrder);
    res.json({ status: "success", data: newOrder });
});

// 4. Маршрут: ИЗМЕНИТЬ статус оплаты (PATCH) - ТОТ САМЫЙ СВЕТОФОР
app.patch('/api/orders/:id/status', (req, res) => {
    const orderId = parseInt(req.params.id);
    const newStatus = req.body.status;
    
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.paymentStatus = newStatus;
        res.json({ status: "success" });
    } else {
        res.status(404).json({ status: "error", message: "Заявка не найдена" });
    }
});
// 5. Маршрут: ДОБАВИТЬ доп. расход к конкретной заявке (POST)
app.post('/api/orders/:id/expenses', (req, res) => {
    const orderId = parseInt(req.params.id);
    const { category, amount } = req.body;

    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.extraExpenses.push({
            category: category || "Прочее",
            amount: Number(amount) || 0
        });
        res.json({ status: "success", message: "Расход успешно добавлен" });
    } else {
        res.status(404).json({ status: "error", message: "Заявка не найдена" });
    }
});
// Запускаем сервер
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен. Порт: ${PORT}`);
    console.log(`👩‍💻 Разработчик: ${config.SYSTEM_AUTHOR}`);
});