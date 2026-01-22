class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.budget = parseFloat(localStorage.getItem('monthlyBudget')) || 30000;
        this.monthDay = parseInt(localStorage.getItem('monthDay')) || 25;
        this.currentPeriod = 'current';
        this.chartCanvas = null;
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.updateMonthSelector();
        this.switchTab('add');
        this.renderList();
        this.updateStats();
        this.updateBudgetDisplay();
        document.getElementById('custom-month-day').value = this.monthDay;
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
    }

    bindEvents() {
        // 修復：使用箭頭函數確保 this 指向正確
        document.getElementById('add-expense').addEventListener('click', (e) => {
            e.preventDefault();
            this.addExpense();
        });
        
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.amountEl.value = btn.dataset.amount;
                this.categoryEl.value = '飲食';
                this.addExpense();
            });
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        document.getElementById('save-budget').addEventListener('click', () => {
            this.saveBudget();
        });
        
        document.getElementById('save-month-day').addEventListener('click', () => {
            this.saveMonthDay();
        });
        
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setPeriod(btn.dataset.period));
        });
    }

    // 新增驗證函數
    validateInput() {
        const amount = parseFloat(this.amountEl.value);
        if (!amount || amount <= 0 || isNaN(amount)) {
            alert('請輸入有效金額（大於0的數字）！');
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
        
        // 清空表單
        this.amountEl.value = '';
        this.noteEl.value = '';
        this.categoryEl.value = '飲食'; // 重置為預設值
        
        this.renderList();
        this.updateStats();
        this.updateBudgetDisplay();
        this.updateChart();

        this.showToast('✅ 新增成功！');
    }

    // 修復 deleteExpense 使其可以被全域調用
    deleteExpense(id) {
        if (confirm('確定刪除這筆支出？')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.saveData();
            this.renderList();
            this.updateStats();
            this.updateBudgetDisplay();
            this.updateChart();
            this.showToast('🗑️ 刪除成功！');
        }
    }

    // 其他方法保持不變...
    saveMonthDay() {
        const day = parseInt(document.getElementById('custom-month-day').value);
        if (day >= 1 && day <= 31) {
            this.monthDay = day;
            localStorage.setItem('monthDay', this.monthDay);
            this.updateMonthSelector();
            this.updateAll();
            this.showToast('✅ 換月日儲存成功！');
        } else {
            alert('請輸入1-31日的有效日期');
        }
    }

    setPeriod(period) {
        this.currentPeriod = period;
        document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
        this.updateAll();
    }

    updateMonthSelector() {
        const select = document.getElementById('month-select');
        select.innerHTML = '<option value="current">當前期間</option>';
        
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, this.monthDay);
            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const periodStr = `${date.getFullYear()}年${monthNames[date.getMonth()]} (${this.monthDay}日結算)`;
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            select.innerHTML += `<option value="${value}">${periodStr}</option>`;
        }
    }

    getCurrentPeriodExpenses() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        if (this.currentPeriod === 'previous') {
            return this.getPeriodExpenses(year, month - 1);
        }
        
        return this.getPeriodExpenses(year, month);
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
                    <i class="fas fa-wallet" style="font-size:48px;margin-bottom:15px;opacity:0.5;"></i>
                    <p>本期還沒有支出記錄<br>點上方快速按鈕新增試試！</p>
                </div>
            `;
            return;
        }

        list.innerHTML = periodExpenses.slice(0, 20).map(expense => {
            const date = new Date(expense.date).toLocaleDateString('zh-TW');
            const icon = this.getCategoryIcon(expense.category);
            return `
                <div class="expense-item">
                    <div class="category-icon">${icon}</div>
                    <div class="expense-info">
                        <h4>${expense.category}</h4>
                        ${expense.note ? `<p>${expense.note}</p>` : ''}
                        <div class="expense-date">${date}</div>
                    </div>
                    <div class="expense-amount">-${expense.amount.toLocaleString()}</div>
                    <button class="delete-btn" onclick="tracker.deleteExpense(${expense.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    getCategoryIcon(category) {
        const icons = {
            '飲食': '🍽️', '交通': '🚗', '購物': '🛒', 
            '娛樂': '🎮', '生活': '🏠', '投資': '📈'
        };
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

    saveBudget() {
        this.budget = parseFloat(this.monthlyBudgetEl.value) || 0;
        localStorage.setItem('monthlyBudget', this.budget);
        this.updateBudgetDisplay();
        this.showToast('💰 預算儲存成功！');
    }

    updateChart() {
        if (!this.chartCanvas) return;
        const canvas = this.chartCanvas;
        const ctx = canvas.getContext('2d');
        
        canvas.width = 600;
        canvas.height = 450;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const periodExpenses = this.getCurrentPeriodExpenses();
        if (periodExpenses.length === 0) {
            ctx.save();
            ctx.fillStyle = '#999';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('📊 圓餅圖 - 無資料', canvas.width/2, canvas.height/2);
            ctx.restore();
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
        
        const centerX = 220;
        const centerY = 225;
        const radius = 130;
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#96CEB4'];

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
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.stroke();

            startAngle = endAngle;
        });

        const legendStartX = 380;
        let legendY = 100;
        categories.forEach((category, index) => {
            const amount = amounts[index];
            const percentage = ((amount / totalAmount) * 100).toFixed(1);
            
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(legendStartX, legendY, 20, 20);
            
            ctx.fillStyle = '#333';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(category.slice(0,2), legendStartX + 28, legendY + 10);
            
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#e74c3c';
            ctx.fillText(`${amount.toLocaleString()}`, legendStartX + 100, legendY + 8);
            
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText(`(${percentage}%)`, legendStartX + 160, legendY + 12);
            
            legendY += 45;
        });

        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('📊 本期支出分析', canvas.width/2, 20);

        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(`總計 ${totalAmount.toLocaleString()} 元`, canvas.width/2, 65);
    }

    updateAll() {
        this.renderList();
        this.updateStats();
        this.updateBudgetDisplay();
        this.updateChart();
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(tab).classList.add('active');
        
        if (tab === 'list') this.renderList();
        if (tab === 'chart') this.updateChart();
        if (tab === 'budget') this.updateBudgetDisplay();
    }

    saveData() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#27ae60',
            color: 'white',
            padding: '15px 25px',
            borderRadius: '10px',
            zIndex: '10000',
            fontWeight: 'bold',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
}

// 修復：確保全域變數 tracker 正確初始化
let tracker;

window.addEventListener('DOMContentLoaded', () => {
    tracker = new ExpenseTracker();
});

// 為了 deleteExpense 的全域調用，確保 tracker 已準備好
window.tracker = tracker;
