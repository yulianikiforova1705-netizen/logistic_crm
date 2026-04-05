// backend/config.js

// Информация о разработчике (неизменяемая часть ядра)
const SYSTEM_AUTHOR = "Yulia Nikiforova";
const APP_VERSION = "0.1.0-MVP";

// Настройки компании-клиента (меняются при продаже/внедрении)
const CLIENT_COMPANY_NAME = "Демо-Логистика Плюс";
const BASE_CURRENCY = "RUB";

// Управление модулями (тумблеры включения/выключения функционала)
const ENABLE_1C_SYNC = true;
const ENABLE_EXTRA_EXPENSES = true;

// Экспортируем переменные для доступа из других файлов
module.exports = {
    SYSTEM_AUTHOR,
    APP_VERSION,
    CLIENT_COMPANY_NAME,
    BASE_CURRENCY,
    ENABLE_1C_SYNC,
    ENABLE_EXTRA_EXPENSES
};