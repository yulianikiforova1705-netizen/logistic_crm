// backend/server.js

const express = require('express');
// Подключаем наш файл конфигурации
const config = require('./config'); 
const path = require('path');

const app = express();
const PORT = 3000;

// Разрешаем серверу понимать формат JSON (пригодится для передачи данных)
app.use(express.json());
// Раздаем визуальную часть системы из папки frontend
app.use(express.static(path.join(__dirname, '../frontend')));
// Создаем наш первый тестовый маршрут (API endpoint)
app.get('/api/status', (req, res) => {
    // Сервер будет отвечать информацией о системе
    res.json({
        status: "success",
        message: "CRM API работает стабильно!",
        systemInfo: {
            author: config.SYSTEM_AUTHOR,
            version: config.APP_VERSION,
            currentClient: config.CLIENT_COMPANY_NAME
        }
    });
});
// Временная база данных заявок (MVP)
const orders = [
    {
        id: 1,
        orderDate: "2026-04-07",
        clientName: "ООО МегаСтрой",
        contractorName: "ИП Иванов А.А.",
        route: "Москва - Санкт-Петербург",
        transportType: "Тент 20т",
        clientRate: 85000,
        contractorRate: 70000,
        currency: "RUB",
        paymentStatus: "Ожидание" // Желтый индикатор
    }
];

// Маршрут для получения списка заявок
app.get('/api/orders', (req, res) => {
    res.json({
        status: "success",
        totalOrders: orders.length,
        data: orders
    });
});
// Запускаем сервер
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`💼 Клиент: ${config.CLIENT_COMPANY_NAME}`);
    console.log(`👩‍💻 Разработчик: ${config.SYSTEM_AUTHOR}`);
    console.log(`=================================`);
});