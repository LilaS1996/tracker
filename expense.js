class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.budget = parseFloat(localStorage.getItem('monthlyBudget')) || 30000;
        this.monthDay = parseInt(localStorage.getItem('monthDay')) || 25;
        this.currentPeriod = 'current';
        this.selectedExpenses = new Set();
        this.quickButtons = JSON.parse(localStorage.getItem('quickButtons')) || [
            { amount: 50, category: '飲食' },
            { amount: 150, category: '飲食' },
            { amount: 300, category: '飲食' },
            { amount: 100, category: '交通' }
        ];
        this.chartCanvas = null;
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.switchTab('add');
        this.renderList();
        this.updateStats();
        this.updateBudgetDisplay();
        this.loadQuickButtons();
        this.chartCanvas = document.getElementById('expense-chart');
    }

    bindElements() {
        this.categoryEl = document.getElementById('category');
        this.amountEl = document.getElementById('amount');
        this.noteEl = document.getElementById('note');
        this.expenseList = document.getElementById('expense-list');
        this.monthTotalEl = document.getElementById('month-total');
        this.budgetLeftEl = document.getElementById('budget-left');
        this.monthlyBudgetEl = document.getElementById('monthly-budget');
        this.budgetPercentEl = document.getElementById('budget-percent');
        this.deleteSelectedBtn = document.getElementById('delete-selected');
        this.selectedCountEl = document.getElementById('selected-count');
        this.selectAllBtn = document.getElementById('select-all');
    }

    bindEvents() {
        document.getElementById('add-expense').addEventListener('click', () => this.addExpense());
        
        this.amountEl?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addExpense();
        });

        document.querySelectorAll('.tab-btn, .nav-btn, .period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.dataset.tab) {
                    this.switchTab(btn.dataset.tab);
                    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
                    document.querySelector(`.nav-btn[data-tab="${btn.dataset.tab}"]`)?.classList.add('active');
                }
                if (btn.dataset.period) {
                    this.currentPeriod = btn.dataset.period;
                    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.renderList();
                    this.updateStats();
                    this.updateBudgetDisplay();
                    this.updateChart();
                }
            });
        });

        // 快速新增按鈕事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-add-btn')) {
                const index = parseInt(e.target.dataset.index);
                this.useQuickButton(index);
            }
        });

        // 清單功能
        document.getElementById('delete-selected').addEventListener('click', () => this.deleteSelected());
        document.getElementById('select-all').addEventListener('click', () => this.toggleSelectAll());

        document.getElementById('save-budget').addEventListener('click', () => this.saveBudget());
    }

    loadQuickButtons() {
        document.querySelectorAll('.quick-amount').forEach((input, index) => {
            input.value = this.quickButtons[index]?.amount || '';
        });
        document.querySelectorAll('.quick-category').forEach((select, index) => {
            select.value = this.quickButtons[index]?.category || '飲食';
        });
    }

    useQuickButton(index) {
        const amountInput = document.querySelector(`.quick-amount[data-index="${index}"]`);
        const categorySelect = document.querySelector(`.quick-category[data-index="${index}"]`);
        
        const amount = parseFloat(amountInput.value);
        if (!amount || amount <= 0 || isNaN(amount)) {
            this.showToast('❌ 請輸入有效金額（大於0）！');
            amountInput.focus();
            return;
        }

        // 自動新增支出
        this.amountEl.value = amount;
        this.categoryEl.value = categorySelect.value;
        this.noteEl.value = '';
        this.addExpense();

        // 保存快速按鈕設定
        this.quickButtons[index] = {
            amount,
            category: categorySelect.value
        };
        localStorage.setItem('quickButtons', JSON.stringify(this.quickButtons));
    }

    validateInput() {
        const amount = parseFloat(this.amountEl.value);
        if (!amount || amount <= 0 || isNaN(amount)) {
            this.showToast('❌ 請輸入有效金額（大於0）！');
            this.amountEl.focus();
            return false;
        }
        return true;
    }

    addExpense() {
        if (!this.validateInput()) return;

        const category = this.categoryEl.value;
        const amount = parseFloat(this.amountEl.value);
        const note = this.noteEl.value.trim();

        const expense = {
            id: Date.now(),
            category,
            amount,
            note,
            date: new Date().toISOString()
        };

        this.expenses.unshift(expense);
        this.saveData();
        
        this.amountEl.value = '';
        this.noteEl.value = '';
        this.categoryEl.value = '飲食';
        
        this.renderList();
        this.updateStats();
        this.updateBudgetDisplay();
        this.updateChart();
        this.showToast('✅ 新增成功！');
    }

    deleteSelected() {
        if (this.selectedExpenses.size === 0) return;
        
        if (confirm(`確定刪除 ${this.selectedExpenses.size} 筆勾選的支出？`)) {
            this.expenses = this.expenses.filter(e => !this.selectedExpenses.has(e.id));
            this.selectedExpenses.clear();
            this.saveData();
            this.renderList();
            this.updateStats();
            this.updateBudgetDisplay();
            this.updateChart();
            this.updateSelectionUI();
            this.showToast(`🗑️ 刪除 ${this.selectedExpenses.size} 筆成功！`);
        }
    }

    toggleSelectAll() {
        const periodExpenses = this.getCurrentPeriodExpenses();
        if (this.selectedExpenses.size === periodExpenses.length) {
            this.selectedExpenses.clear();
        } else {
            periodExpenses.forEach(expense => this.selectedExpenses.add(expense.id));
        }
        this.renderList();
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const count = this.selectedExpenses.size;
        this.selectedCountEl.textContent = count;
        this.deleteSelectedBtn.disabled = count === 0;
    }

    deleteExpense(id) {
        if (confirm('確定刪除這筆支出？')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            if (this.selectedExpenses.has(id)) {
                this.selectedExpenses.delete(id);
            }
            this.saveData();
            this.renderList();
            this.updateStats();
            this.updateBudgetDisplay();
            this.updateChart();
            this.updateSelectionUI();
            this.showToast('🗑️ 刪除成功！');
        }
    }

    saveBudget() {
        this.budget = parseFloat(this.monthlyBudgetEl.value) || 0;
        localStorage.setItem('monthlyBudget', this.budget);
        this.updateBudgetDisplay();
        this.showToast('💰 預算儲存成功！');
    }

    getCurrentPeriodExpenses() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return this.currentPeriod === 'previous' ? 
            this.getPeriodExpenses(year, month - 1) : 
            this.getPeriodExpenses(year, month);
    }

    getPeriodExpenses(year, month) {
        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const periodStart = new Date(year, month, this.monthDay);
            const periodEnd = new Date(year, month + 1, this.monthDay);
            periodEnd.setHours(23, 59, 59, 999);
            return expenseDate >= periodStart && expenseDate < periodEnd;
        });
    }

    renderList() {
        const list = this.expenseList;
        const periodExpenses = this.getCurrentPeriodExpenses();
        
        if (periodExpenses.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-wallet"></i>
                    <p>本期還沒有支出記錄<br>點上方快速按鈕新增試試！</p>
                </div>
            `;
            this.updateSelectionUI();
            return;
        }

        list.innerHTML = periodExpenses.slice(0, 50).map(expense => {
            const date = new Date(expense.date).toLocaleDateString('zh-TW');
            const icon = this.getCategoryIcon(expense.category);
            const isSelected = this.selectedExpenses.has(expense.id);
            return `
                <div class="expense-item ${isSelected ? 'selected' : ''}" data-id="${expense.id}">
                    <input type="checkbox" class="expense-checkbox" ${isSelected ? 'checked' : ''} data-id="${expense.id}">
                    <div class="category-icon">${icon}</div>
                    <div class="expense-info">
                        <h4>${expense.category}</h4>
                        ${expense.note ? `<p>${expense.note}</p>` : ''}
                        <div class="expense-date">${date}</div>
                    </div>
                    <div class="expense-amount">-${expense.amount.toLocaleString()}</div>
                    <button class="delete-btn" data-id="${expense.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');

        // 事件委派
        list.addEventListener('change', (e) => {
            if (e.target.classList.contains('expense-checkbox')) {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    this.selectedExpenses.add(id);
                } else {
                    this.selectedExpenses.delete(id);
                }
                e.target.closest('.expense-item').classList.toggle('selected', e.target.checked);
                this.updateSelectionUI();
            }
        });

        list.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
                const id = parseInt(e.target.closest('.delete-btn').dataset.id);
                this.deleteExpense(id);
            }
        });

        this.updateSelectionUI();
    }

    getCategoryIcon(category) {
        const icons = {'飲食': '🍽️', '交通': '🚗', '購物': '🛒', '娛樂': '🎮', '生活': '🏠', '投資': '📈'};
        return icons[category] || '💰';
    }

    updateStats() {
        const periodExpenses = this.getCurrentPeriodExpenses();
        const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
        this.monthTotalEl.textContent = total.toLocaleString();
    }

    updateBudgetDisplay() {
        this.monthlyBudgetEl.value = this.budget;
        const periodExpenses = this.getCurrentPeriodExpenses();
        const spent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
        const remaining = this.budget - spent;
        this.budgetLeftEl.textContent = remaining.toLocaleString();
        
        const percentage = this.budget > 0 ? Math.min((spent / this.budget) * 100, 100) : 0;
        this.budgetPercentEl.textContent = percentage.toFixed(0) + '%';
        
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            const circumference = 502;
            const offset = circumference * (1 - percentage / 100);
            progressFill.style.strokeDashoffset = offset;
        }
    }

    updateChart() {
        if (!this.chartCanvas) return;
        
        const canvas = this.chartCanvas;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        // 修復畫布尺寸問題
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        const periodExpenses = this.getCurrentPeriodExpenses();
        if (periodExpenses.length === 0) {
            ctx.fillStyle = '#e9ecef';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '24px sans-serif';
            ctx.fillText('沒有資料', rect.width / 2, rect.height / 2);
            this.renderEmptyLegend();
            return;
        }
        
        const categoryTotals = {};
        let totalAmount = 0;
        periodExpenses.forEach(expense => {
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
            totalAmount += expense.amount;
        });

        const categories = Object.keys(categoryTotals);
        const amounts = Object.values(categoryTotals);
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(centerX, centerY, 200) * 0.7;
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#96CEB4', '#FECA57'];

        let startAngle = 0;
        categories.forEach((category, index) => {
            const amount = amounts[index];
            const percentage = (amount / totalAmount) * 100;
            const sliceAngle = (percentage / 100) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.stroke();

            startAngle = endAngle;
        });

        this.renderLegend(categoryTotals, totalAmount, colors);
    }

    renderLegend(categoryTotals, totalAmount, colors) {
        const legend = document.getElementById('chart-legend');
        legend.innerHTML = Object.entries(categoryTotals).map(([category, amount], index) => {
            const percentage = ((amount / totalAmount) * 100).toFixed(1);
            return `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${colors[index % colors.length]}"></div>
                    <span>${category}: ${amount.toLocaleString()}元 (${percentage}%)</span>
                </div>
            `;
        }).join('');
    }

    renderEmptyLegend() {
        const legend = document.getElementById('chart-legend');
        legend.innerHTML = '<p style="color: #999; font-style: italic;">沒有資料顯示圖表</p>';
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn, .nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(tab).classList.add('active');
        
        if (tab === 'list') this.renderList();
        if (tab === 'chart') {
            this.updateChart();
        }
        if (tab === 'budget') this.updateBudgetDisplay();
        
        document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');
    }

    saveData() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #27ae60, #2ecc71)', color: 'white',
            padding: '15px 30px', borderRadius: '16px', zIndex: '10001',
            fontWeight: '700', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
}

const tracker = new ExpenseTracker();
window.tracker = tracker;
