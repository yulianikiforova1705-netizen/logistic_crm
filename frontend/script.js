// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И ТЕМА
// ==========================================
function initTheme() {
    if(localStorage.getItem('crm_theme') === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('theme-btn').innerText = '☀️';
    }
}
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('crm_theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-btn').innerText = isDark ? '☀️' : '🌙';
    if(globalOrders.length > 0) updateCharts(globalOrders); 
}
initTheme();

// ==========================================
// 2. АВТОРИЗАЦИЯ
// ==========================================
function checkAuth() { 
    const token = localStorage.getItem('crm_token'); 
    if (token) { 
        document.getElementById('login-screen').style.display = 'none'; 
        document.getElementById('app-content').style.display = 'block'; 
        loadOrders(); 
    } else { 
        document.getElementById('login-screen').style.display = 'flex'; 
        document.getElementById('app-content').style.display = 'none'; 
    } 
}
function attemptLogin() { 
    const user = document.getElementById('login-username').value; 
    const pass = document.getElementById('login-password').value; 
    fetch('/api/login', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ username: user, password: pass }) 
    })
    .then(res => res.json())
    .then(data => { 
        if (data.status === 'success') { 
            localStorage.setItem('crm_token', data.token); 
            document.getElementById('login-error').style.display = 'none'; 
            checkAuth(); 
        } else { 
            document.getElementById('login-error').style.display = 'block'; 
        } 
    }); 
}
function logout() { 
    localStorage.removeItem('crm_token'); 
    checkAuth(); 
}
checkAuth();

// ==========================================
// 3. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let globalOrders = []; 
let currentOrderId = null; 
let selectedIds = new Set();
let chartMarginInst = null; 
let chartExpInst = null;
let currentDateFilter = 'all';

// ==========================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И ГРАФИКИ
// ==========================================
function updateDatalists(data) {
    const clients = new Set(); const contractors = new Set(); const routes = new Set(); const vehicles = new Set();
    data.forEach(order => {
        if(order.clientName) clients.add(order.clientName);
        if(order.contractorName) contractors.add(order.contractorName);
        if(order.route) routes.add(order.route);
        if(order.vehicleNumber) vehicles.add(order.vehicleNumber);
    });
    document.getElementById('clients-list').innerHTML = Array.from(clients).map(c => `<option value="${c}">`).join('');
    document.getElementById('contractors-list').innerHTML = Array.from(contractors).map(c => `<option value="${c}">`).join('');
    document.getElementById('routes-list').innerHTML = Array.from(routes).map(r => `<option value="${r}">`).join('');
    document.getElementById('vehicles-list').innerHTML = Array.from(vehicles).map(v => `<option value="${v}">`).join('');
}

function getColorClass(status) { 
    if(status === 'Оплачено') return 'status-green'; 
    if(status === 'Просрочка') return 'status-red'; 
    return 'status-yellow'; 
}

function updateCharts(data) {
    const expStats = {};
    data.forEach(order => { 
        if(order.extraExpenses) { 
            order.extraExpenses.forEach(exp => { 
                expStats[exp.category] = (expStats[exp.category] || 0) + exp.amount; 
            }); 
        } 
    });
    const expLabels = Object.keys(expStats); 
    const expData = Object.values(expStats);

    const marginByMonth = {};
    data.forEach(order => {
        const month = order.orderDate.substring(0, 7); 
        const extra = order.extraExpenses ? order.extraExpenses.reduce((sum, e) => sum + e.amount, 0) : 0;
        const margin = order.clientRate - order.contractorRate - extra;
        marginByMonth[month] = (marginByMonth[month] || 0) + margin;
    });
    const sortedMonths = Object.keys(marginByMonth).sort(); 
    const marginData = sortedMonths.map(m => marginByMonth[m]);

    const textColor = document.body.classList.contains('dark-theme') ? '#ffffff' : '#000000';
    Chart.defaults.color = textColor; 
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif";

    if(chartMarginInst) chartMarginInst.destroy();
    const ctxM = document.getElementById('marginChart').getContext('2d');
    chartMarginInst = new Chart(ctxM, { 
        type: 'line', 
        data: { 
            labels: sortedMonths.length > 0 ? sortedMonths : ['Нет данных'], 
            datasets: [{ 
                label: 'Чистая прибыль', 
                data: marginData.length > 0 ? marginData : [0], 
                borderColor: '#0A84FF', 
                backgroundColor: 'rgba(10, 132, 255, 0.15)', 
                borderWidth: 3, 
                fill: true, 
                tension: 0.4, 
                pointRadius: 6, 
                pointBackgroundColor: '#ffffff', 
                pointBorderColor: '#0A84FF', 
                pointBorderWidth: 2 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                title: { display: true, text: 'Динамика прибыли по месяцам', font: { size: 15, weight: 'bold' } }, 
                legend: { display: false } 
            }, 
            scales: { 
                y: { beginAtZero: true, grid: { color: 'rgba(150,150,150,0.1)' } }, 
                x: { grid: { display: false } } 
            } 
        } 
    });

    if(chartExpInst) chartExpInst.destroy();
    const ctxE = document.getElementById('expensesChart').getContext('2d');
    chartExpInst = new Chart(ctxE, { 
        type: 'doughnut', 
        data: { 
            labels: expLabels.length > 0 ? expLabels : ['Нет расходов'], 
            datasets: [{ 
                data: expData.length > 0 ? expData : [1], 
                backgroundColor: ['#FF453A', '#FF9500', '#AF52DE', '#30D158', '#0A84FF', '#8E8E93'], 
                borderWidth: 0 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                title: { display: true, text: 'Утечки бюджета (Доп. расходы)', font: { size: 15, weight: 'bold' } } 
            } 
        } 
    });
}

function updateDashboard(data) {
    let totalOrders = data.length; let totalMargin = 0; let problemsCount = 0;
    data.forEach(order => {
        const totalExtra = order.extraExpenses ? order.extraExpenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
        totalMargin += (order.clientRate - order.contractorRate - totalExtra);
        const hasProblematicExpenses = order.extraExpenses && order.extraExpenses.some(e => ['Штраф', 'Простой', 'Опоздание', 'Перегруз'].includes(e.category));
        if (order.paymentStatus === 'Просрочка' || hasProblematicExpenses) problemsCount++;
    });
    document.getElementById('dash-total').innerText = totalOrders; 
    document.getElementById('dash-margin').innerText = totalMargin.toLocaleString() + ' (Микс)'; 
    document.getElementById('dash-problems').innerText = problemsCount;
}

// ==========================================
// 5. ОТРИСОВКА И ФИЛЬТРАЦИЯ ТАБЛИЦЫ
// ==========================================
function renderTable(dataToRender) {
    updateDashboard(dataToRender); 
    updateCharts(dataToRender); 
    const tableBody = document.getElementById('orders-table-body'); 
    tableBody.innerHTML = ''; 
    
    const tripColors = { 
        'На погрузке': 'background: rgba(142, 142, 147, 0.15); color: var(--text-muted);', 
        'В пути': 'background: rgba(10, 132, 255, 0.15); color: var(--primary);', 
        'На выгрузке': 'background: rgba(255, 149, 0, 0.15); color: var(--accent);', 
        'Завершен': 'background: rgba(50, 215, 75, 0.15); color: var(--success);' 
    };

    dataToRender.forEach(order => {
        const totalExtra = order.extraExpenses ? order.extraExpenses.reduce((sum, exp) => sum + exp.amount, 0) : 0; 
        const finalMargin = order.clientRate - order.contractorRate - totalExtra; 
        const marginClass = finalMargin < 0 ? 'margin-negative' : 'margin-val'; 
        const colorClass = getColorClass(order.paymentStatus);
        const curr = order.currency || '₽';
        
        let expensesHtml = order.extraExpenses ? order.extraExpenses.map(e => `<span class="extra-box"><b>${e.category}:</b> ${e.amount} ${curr}</span>`).join('') : ''; 
        expensesHtml += `<button class="btn-small btn-blue" onclick="openExpenseModal(${order.id})">+ Добавить расход</button>`;
        
        const isChecked = selectedIds.has(order.id) ? 'checked' : '';
        const tColor = tripColors[order.tripStatus] || tripColors['На погрузке'];

        const row = `<tr>
            <td class="check-col"><input type="checkbox" class="row-checkbox" value="${order.id}" ${isChecked} onchange="toggleRow(${order.id}, this.checked)"></td>
            <td>
                <div class="info-cell">📋 Заявка: <b>${order.orderDate}</b></div>
                <div class="info-cell">🔼 Загр: <b>${order.loadingDate ? order.loadingDate.split('-').reverse().join('.') : '—'}</b></div>
                <div class="info-cell">🔽 Выгр: <b>${order.unloadingDate ? order.unloadingDate.split('-').reverse().join('.') : '—'}</b></div>
            </td>
            <td><div class="info-cell">👤 <b>${order.clientName}</b></div><div>🏢 ${order.contractorName}</div></td>
            <td>
                <div class="info-cell">📍 ${order.route || '—'}</div>
                <div>🚚 ${order.vehicleType || '—'} | <b>${order.vehicleNumber || '—'}</b></div>
            </td>
            <td>
                <div class="info-cell">Клиент: ${Number(order.clientRate).toLocaleString()} ${curr}</div>
                <div>Подряд: ${Number(order.contractorRate).toLocaleString()} ${curr}</div>
            </td>
            <td>
                <select style="width:100%; ${tColor}" class="status-select" onchange="updateTripStatus(${order.id}, this.value)">
                    <option value="На погрузке" ${order.tripStatus === 'На погрузке' ? 'selected' : ''}>📍 На погрузке</option>
                    <option value="В пути" ${order.tripStatus === 'В пути' ? 'selected' : ''}>🚚 В пути</option>
                    <option value="На выгрузке" ${order.tripStatus === 'На выгрузке' ? 'selected' : ''}>🏁 На выгрузке</option>
                    <option value="Завершен" ${order.tripStatus === 'Завершен' ? 'selected' : ''}>✅ Завершен</option>
                </select>
                <select class="status-select ${colorClass}" style="width:100%;" onchange="updatePaymentStatus(${order.id}, this.value)">
                    <option value="Ожидание" ${order.paymentStatus === 'Ожидание' ? 'selected' : ''}>Ожидание оплаты</option>
                    <option value="Оплачено" ${order.paymentStatus === 'Оплачено' ? 'selected' : ''}>Оплачено</option>
                    <option value="Просрочка" ${order.paymentStatus === 'Просрочка' ? 'selected' : ''}>Просрочка оплаты</option>
                </select>
            </td>
            <td>${expensesHtml}</td>
            <td class="${marginClass}" style="font-size: 14px;">${finalMargin.toLocaleString()} ${curr}</td>
            <td>
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <button class="btn-small btn-purple" onclick="openNotesModal(${order.id})">📖 Досье</button>
                    <button class="btn-small btn-orange" onclick="openDocsModal(${order.id})">📄 Доки</button>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-small btn-blue" onclick="openEditModal(${order.id})">✏️ Изменить</button>
                    <button class="btn-small btn-cancel" onclick="deleteOrder(${order.id})">🗑️ Удал.</button>
                </div>
            </td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

function setDateFilter(filterType, btnElement) { 
    currentDateFilter = filterType; 
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active')); 
    btnElement.classList.add('active'); 
    filterOrders(); 
}

function filterOrders() { 
    const query = document.getElementById('search-input').value.toLowerCase(); 
    const now = new Date(); let startDate = null; let endDate = null;

    if (currentDateFilter === 'currentMonth') { 
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
    } else if (currentDateFilter === 'lastMonth') { 
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); 
    }

    const filteredData = globalOrders.filter(order => {
        const matchesSearch = order.clientName.toLowerCase().includes(query) || 
                              order.contractorName.toLowerCase().includes(query) || 
                              (order.route && order.route.toLowerCase().includes(query)) || 
                              (order.vehicleNumber && order.vehicleNumber.toLowerCase().includes(query));
        let matchesDate = true;
        if (startDate && endDate) { 
            const orderDate = new Date(order.orderDate); 
            matchesDate = orderDate >= startDate && orderDate <= endDate; 
        }
        return matchesSearch && matchesDate;
    }); 
    renderTable(filteredData); 
}

function loadOrders() { 
    fetch('/api/orders')
    .then(res => res.json())
    .then(data => { 
        globalOrders = data.data; 
        filterOrders(); 
        updateDatalists(globalOrders); 
    }); 
}

// ==========================================
// 6. МАССОВЫЕ ДЕЙСТВИЯ И ЭКСПОРТ
// ==========================================
function toggleAll(checked) { 
    document.querySelectorAll('.row-checkbox').forEach(cb => { 
        cb.checked = checked; 
        if (checked) selectedIds.add(Number(cb.value)); else selectedIds.delete(Number(cb.value)); 
    }); 
    updateBulkBar(); 
}
function toggleRow(id, checked) { 
    if (checked) selectedIds.add(id); else selectedIds.delete(id); 
    updateBulkBar(); 
    const allChecked = selectedIds.size > 0 && selectedIds.size === globalOrders.length; 
    document.getElementById('selectAll').checked = allChecked; 
}
function updateBulkBar() { 
    const bar = document.getElementById('bulk-bar'); 
    const countSpan = document.getElementById('bulk-count'); 
    if (selectedIds.size > 0) { 
        bar.style.display = 'flex'; 
        countSpan.innerText = `Выбрано заявок: ${selectedIds.size}`; 
    } else { 
        bar.style.display = 'none'; 
    } 
}
function bulkDelete() { 
    if (!confirm(`Вы уверены, что хотите безвозвратно удалить ${selectedIds.size} рейсов?`)) return; 
    const deletePromises = Array.from(selectedIds).map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' })); 
    Promise.all(deletePromises).then(() => { 
        selectedIds.clear(); 
        updateBulkBar(); 
        document.getElementById('selectAll').checked = false; 
        loadOrders(); 
    }); 
}

function exportToJson() { 
    const dataStr = JSON.stringify(globalOrders, null, 2); 
    const blob = new Blob([dataStr], { type: "application/json" }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-'); 
    a.download = `Logistic_Backup_${dateStr}.json`; 
    a.click(); 
    URL.revokeObjectURL(url); 
}

function exportToExcel() { 
    const excelData = globalOrders.map(order => { 
        const totalExtra = order.extraExpenses ? order.extraExpenses.reduce((sum, exp) => sum + exp.amount, 0) : 0; 
        const finalMargin = order.clientRate - order.contractorRate - totalExtra; 
        const expensesText = order.extraExpenses && order.extraExpenses.length > 0 ? order.extraExpenses.map(e => `${e.category}: ${e.amount} ${order.currency||'₽'}`).join(' | ') : "Нет расходов"; 
        return { 
            "Дата заявки": order.orderDate, "Дата загрузки": order.loadingDate || "", "Дата выгрузки": order.unloadingDate || "", 
            "Клиент": order.clientName, "Подрядчик": order.contractorName, "Маршрут": order.route || "", 
            "Тип ТС": order.vehicleType || "", "Номер авто": order.vehicleNumber || "", "Валюта": order.currency || "₽", 
            "Ставка клиента": Number(order.clientRate), "Ставка подрядчика": Number(order.contractorRate), 
            "Статус рейса": order.tripStatus, "Статус оплаты": order.paymentStatus, "Доп. расходы": expensesText, "Чистая Прибыль": finalMargin 
        }; 
    }); 
    const worksheet = XLSX.utils.json_to_sheet(excelData); 
    const workbook = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет по рейсам"); 
    const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-'); 
    XLSX.writeFile(workbook, `Логистика_Отчет_${dateStr}.xlsx`); 
}

function exportTo1C() { 
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "НомерРейса;ДатаЗаявки;Клиент;Подрядчик;Маршрут;СтавкаКлиента;СтавкаПодрядчика;Валюта;СтатусОплаты\r\n"; 
    globalOrders.forEach(order => { 
        const row = [ order.id, order.orderDate, `"${order.clientName}"`, `"${order.contractorName}"`, `"${order.route || ''}"`, order.clientRate, order.contractorRate, order.currency || '₽', order.paymentStatus ]; 
        csvContent += row.join(";") + "\r\n"; 
    }); 
    const encodedUri = encodeURI(csvContent); 
    const link = document.createElement("a"); 
    link.setAttribute("href", encodedUri); 
    const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-'); 
    link.setAttribute("download", `Export_1C_${dateStr}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
}

// ==========================================
// 7. СОЗДАНИЕ И УПРАВЛЕНИЕ РЕЙСАМИ
// ==========================================
document.getElementById('add-order-form').addEventListener('submit', function(e) { 
    e.preventDefault(); 
    const newOrderData = { 
        orderDate: document.getElementById('f-date').value, 
        loadingDate: document.getElementById('f-loading-date').value, 
        unloadingDate: document.getElementById('f-unloading-date').value, 
        clientName: document.getElementById('f-client').value, 
        contractorName: document.getElementById('f-contractor').value, 
        route: document.getElementById('f-route').value, 
        vehicleType: document.getElementById('f-vehicle-type').value, 
        vehicleNumber: document.getElementById('f-vehicle-number').value, 
        currency: document.getElementById('f-currency').value, 
        clientRate: document.getElementById('f-client-rate').value, 
        contractorRate: document.getElementById('f-contractor-rate').value 
    }; 
    fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOrderData) })
    .then(() => { 
        document.getElementById('add-order-form').reset(); 
        loadOrders(); 
    }); 
});

function updatePaymentStatus(orderId, newStatus) { fetch(`/api/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).then(() => loadOrders()); }
function updateTripStatus(orderId, newStatus) { fetch(`/api/orders/${orderId}/trip_status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).then(() => loadOrders()); }
function deleteOrder(orderId) { if(confirm("Вы уверены, что хотите удалить этот рейс?")) { fetch(`/api/orders/${orderId}`, { method: 'DELETE' }).then(() => loadOrders()); } }

// Модалка Расходов
function openExpenseModal(orderId) { currentOrderId = orderId; document.getElementById('modal-amount').value = ''; document.getElementById('expense-modal').style.display = 'flex'; }
function closeExpenseModal() { document.getElementById('expense-modal').style.display = 'none'; }
function submitExpense() { 
    const category = document.getElementById('modal-category').value; 
    const amount = document.getElementById('modal-amount').value; 
    if (!amount || amount <= 0) return alert("Ошибка: введите корректную сумму!"); 
    fetch(`/api/orders/${currentOrderId}/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: category, amount: amount }) })
    .then(() => { closeExpenseModal(); loadOrders(); }); 
}

// Модалка Редактирования
function openEditModal(orderId) { 
    currentOrderId = orderId; 
    const order = globalOrders.find(o => o.id === orderId); 
    document.getElementById('e-date').value = order.orderDate; 
    document.getElementById('e-loading-date').value = order.loadingDate || ''; 
    document.getElementById('e-unloading-date').value = order.unloadingDate || ''; 
    document.getElementById('e-client').value = order.clientName; 
    document.getElementById('e-contractor').value = order.contractorName; 
    document.getElementById('e-route').value = order.route; 
    document.getElementById('e-vehicle-type').value = order.vehicleType || 'Тент'; 
    document.getElementById('e-vehicle-number').value = order.vehicleNumber || ''; 
    document.getElementById('e-currency').value = order.currency || '₽'; 
    document.getElementById('e-client-rate').value = order.clientRate; 
    document.getElementById('e-contractor-rate').value = order.contractorRate; 
    document.getElementById('edit-modal').style.display = 'flex'; 
}
function closeEditModal() { document.getElementById('edit-modal').style.display = 'none'; }
function submitEdit() { 
    const updatedData = { 
        orderDate: document.getElementById('e-date').value, loadingDate: document.getElementById('e-loading-date').value, unloadingDate: document.getElementById('e-unloading-date').value, 
        clientName: document.getElementById('e-client').value, contractorName: document.getElementById('e-contractor').value, route: document.getElementById('e-route').value, 
        vehicleType: document.getElementById('e-vehicle-type').value, vehicleNumber: document.getElementById('e-vehicle-number').value, currency: document.getElementById('e-currency').value, 
        clientRate: document.getElementById('e-client-rate').value, contractorRate: document.getElementById('e-contractor-rate').value 
    }; 
    fetch(`/api/orders/${currentOrderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) }).then(() => { closeEditModal(); loadOrders(); }); 
}

// ==========================================
// 8. ГЕНЕРАЦИЯ ДОКУМЕНТОВ
// ==========================================
function openDocsModal(orderId) { currentOrderId = orderId; document.getElementById('docs-modal').style.display = 'flex'; }
function closeDocsModal() { document.getElementById('docs-modal').style.display = 'none'; }
function generateInvoice() { 
    const order = globalOrders.find(o => o.id === currentOrderId); if(!order) return; 
    const invNumber = order.id + 1000; const dateStr = new Date().toLocaleDateString('ru-RU'); 
    const html = `<html><head><meta charset="UTF-8"><title>Счет №${invNumber}</title><style>body{font-family:'Arial',sans-serif; padding:40px; color:#000; line-height:1.6; font-size:14px; max-width:800px; margin:auto;} .header{font-size:22px; font-weight:bold; margin-bottom:20px; border-bottom:2px solid #000; padding-bottom:10px;} table{width:100%; border-collapse:collapse; margin-top:20px;} th,td{border:1px solid #000; padding:12px; text-align:left;} th{background:#f4f4f4;} .sum{text-align:right; font-size:18px; font-weight:bold; margin-top:20px;} .sign{margin-top:60px;}</style></head><body><div class="header">СЧЕТ НА ОПЛАТУ № ${invNumber} от ${dateStr}</div><p><b>Исполнитель:</b> Наша Транспортная Компания</p><p><b>Заказчик:</b> ${order.clientName}</p><p><b>Основание:</b> Перевозка груза от ${order.orderDate.split('-').reverse().join('.')}</p><table><tr><th>№</th><th>Наименование услуги</th><th>Маршрут</th><th>Сумма (${order.currency||'₽'})</th></tr><tr><td>1</td><td>Транспортно-экспедиционные услуги (ТС: ${order.vehicleNumber||''})</td><td>${order.route}</td><td>${Number(order.clientRate).toLocaleString()}</td></tr></table><div class="sum">Итого к оплате: ${Number(order.clientRate).toLocaleString()} ${order.currency||'₽'} (Без НДС)</div><div class="sign"><p>Руководитель _________________ / Подпись /</p></div><script>window.print();<\/script></body></html>`; 
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' }); window.open(URL.createObjectURL(blob), '_blank'); closeDocsModal(); 
}
function generateContractorOrder() { 
    const order = globalOrders.find(o => o.id === currentOrderId); if(!order) return; 
    const reqNumber = order.id + 500; 
    const html = `<html><head><meta charset="UTF-8"><title>Заявка №${reqNumber}</title><style>body{font-family:'Arial',sans-serif; padding:40px; color:#000; line-height:1.6; font-size:14px; max-width:800px; margin:auto;} .header{font-size:20px; font-weight:bold; margin-bottom:20px; text-align:center; text-transform:uppercase;} table{width:100%; border-collapse:collapse; margin-top:10px;} th,td{border:1px solid #000; padding:10px; text-align:left;} th{background:#f4f4f4; width:30%;} .sign{display:flex; justify-content:space-between; margin-top:50px;}</style></head><body><div class="header">Договор-заявка на перевозку груза № ${reqNumber}</div><table><tr><th>Дата заявки</th><td>${order.orderDate.split('-').reverse().join('.')}</td></tr><tr><th>Даты загрузки/выгрузки</th><td>${order.loadingDate?order.loadingDate.split('-').reverse().join('.'):'—'} - ${order.unloadingDate?order.unloadingDate.split('-').reverse().join('.'):'—'}</td></tr><tr><th>Заказчик (Экспедитор)</th><td>Наша Транспортная Компания</td></tr><tr><th>Перевозчик (Подрядчик)</th><td>${order.contractorName}</td></tr><tr><th>Автомобиль</th><td>${order.vehicleType||''} ${order.vehicleNumber||''}</td></tr><tr><th>Маршрут движения</th><td>${order.route}</td></tr><tr><th>Ставка за рейс</th><td><b>${Number(order.contractorRate).toLocaleString()} ${order.currency||'₽'}</b></td></tr></table><div class="sign"><div><b>От Заказчика:</b><br><br>_________________ / М.П. /</div><div><b>От Перевозчика:</b><br><br>_________________ / М.П. /</div></div><script>window.print();<\/script></body></html>`; 
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' }); window.open(URL.createObjectURL(blob), '_blank'); closeDocsModal(); 
}

// ==========================================
// 9. ДОСЬЕ РЕЙСА (ГОЛОС И ФАЙЛЫ)
// ==========================================
let voiceRec = null;

function openNotesModal(orderId) { 
    currentOrderId = orderId; 
    const order = globalOrders.find(o => o.id === orderId); 
    const tl = document.getElementById('notes-timeline'); 
    tl.innerHTML = ''; 
    if(order.history && order.history.length > 0) { 
        [...order.history].reverse().forEach(h => { 
            const d = new Date(h.date); 
            const formattedDate = `${d.toLocaleDateString('ru-RU')} в ${d.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}`; 
            let contentHtml = `<div class="tl-text">${h.text}</div>`; 
            if (h.fileUrl) { 
                const ext = h.fileUrl.split('.').pop().toLowerCase(); 
                if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) { 
                    contentHtml += `<div><a href="${h.fileUrl}" target="_blank"><img src="${h.fileUrl}" class="tl-image-preview"></a></div>`; 
                } else { 
                    contentHtml += `<div style="margin-top: 8px;"><a href="${h.fileUrl}" target="_blank" class="btn-small btn-blue" style="text-decoration:none; display:inline-block; padding: 8px 12px; width:auto;">📥 Скачать файл</a></div>`; 
                } 
            } 
            tl.innerHTML += `<div class="tl-item"><div class="tl-dot"></div><div class="tl-date">${formattedDate}</div>${contentHtml}</div>`; 
        }); 
    } else { 
        tl.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">История пуста. Добавьте первую запись.</div>'; 
    } 
    document.getElementById('n_new_note').value = ''; 
    document.getElementById('notes-modal').style.display = 'flex'; 
}

function closeNotesModal() { 
    document.getElementById('notes-modal').style.display = 'none'; 
    if(voiceRec) voiceRec.stop(); 
}

function submitNote() { 
    const text = document.getElementById('n_new_note').value.trim(); 
    if(!text) return; 
    fetch(`/api/orders/${currentOrderId}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text }) })
    .then(() => { loadOrders(); setTimeout(() => openNotesModal(currentOrderId), 200); }); 
}

function startVoiceRecognition() { 
    const btn = document.getElementById('micBtn'); 
    if (voiceRec) { voiceRec.stop(); return; } 
    if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { 
        alert('К сожалению, ваш браузер не поддерживает голосовой ввод.'); 
        return; 
    } 
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition; 
    voiceRec = new SpeechRec(); 
    voiceRec.lang = 'ru-RU'; 
    voiceRec.continuous = false; 
    voiceRec.onstart = () => { btn.classList.add('recording'); btn.innerText = '🔴'; }; 
    voiceRec.onresult = (e) => { 
        const input = document.getElementById('n_new_note'); 
        input.value = (input.value + ' ' + e.results[0][0].transcript).trim(); 
    }; 
    voiceRec.onerror = () => { alert('Ошибка микрофона.'); }; 
    voiceRec.onend = () => { btn.classList.remove('recording'); btn.innerText = '🎙️'; voiceRec = null; }; 
    voiceRec.start(); 
}

function uploadFile() { 
    const fileInput = document.getElementById('n_file_upload'); 
    const file = fileInput.files[0]; 
    if(!file) return; 
    const formData = new FormData(); 
    formData.append('document', file); 
    const tl = document.getElementById('notes-timeline'); 
    tl.innerHTML = '<div style="text-align:center; padding:10px; color:var(--primary); font-weight:bold;">Загрузка файла... ⏳</div>' + tl.innerHTML; 
    
    fetch(`/api/orders/${currentOrderId}/history_file`, { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => { 
        if (data.status === 'success') { 
            fileInput.value = ''; 
            loadOrders(); 
            setTimeout(() => openNotesModal(currentOrderId), 300); 
        } else { 
            alert("Ошибка сервера: " + data.message); 
        } 
    })
    .catch(err => { alert("Сетевая ошибка"); }); 
}
// ==========================================
// 10. АВТОЗАПОЛНЕНИЕ ПО ИНН (DADATA)
// ==========================================
function fetchInn(innFieldId, nameFieldId) {
    const inn = document.getElementById(innFieldId).value.trim();
    if (inn.length < 10) return; // ИНН обычно 10 или 12 цифр
    
    const nameField = document.getElementById(nameFieldId);
    nameField.placeholder = 'Ищем в базе ФНС... ⏳';
    
    fetch('/api/inn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inn: inn })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            nameField.value = data.name;
        } else {
            alert('Компания с таким ИНН не найдена. Проверьте правильность ввода.');
        }
        nameField.placeholder = 'Название...';
    })
    .catch(err => {
        console.error(err);
        nameField.placeholder = 'Название...';
    });
}