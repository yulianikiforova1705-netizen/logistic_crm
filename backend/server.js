// backend/server.js

const express = require('express');
// Подключаем наш файл конфигурации
const config = require('./config'); 

const app = express();
const PORT = 3000;

// Разрешаем серверу понимать формат JSON (пригодится для передачи данных)
app.use(express.json());

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

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`💼 Клиент: ${config.CLIENT_COMPANY_NAME}`);
    console.log(`👩‍💻 Разработчик: ${config.SYSTEM_AUTHOR}`);
    console.log(`=================================`);
});