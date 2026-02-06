// Habit Tracker Pro - JavaScript Application
// Client-side logic for the habit tracking dashboard

let dailyChart, weeklyChart, progressChart;

// Application state management
const state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    habits: [],
    logs: []
};

async function init() {
    setupSelectors();
    setupAddHabit();
    setupClearAll();
    initCharts();
    await loadData();
    renderGrid();
    updateDashboard();
}

function showToast(message, duration = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.hidden = false;
    t.classList.add('show');
    if (t._timeout) clearTimeout(t._timeout);
    t._timeout = setTimeout(() => {
        t.classList.remove('show');
        t.hidden = true;
    }, duration);
}

function setupAddHabit() {
    const input = document.getElementById('newHabitName');
    const btn = document.getElementById('addHabitBtn');
    if (!input || !btn) return;

    async function add() {
        const name = (input.value || '').trim();
        if (!name) return;
        const res = await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            input.value = '';
            await refresh();
            showToast('Habit added');
        } else {
            // optional: show an error
            showToast('Failed to add habit', 3500);
        }
    }

    btn.onclick = add;
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') add();
    });
}

function setupClearAll() {
    const btn = document.getElementById('clearAllBtn');
    if (!btn) return;
    btn.onclick = async () => {
        if (!confirm('This will delete all habits and logs. Continue?')) return;
        await fetch('/api/habits/clear', { method: 'POST' });
        await refresh();
        showToast('All habits reset');
    };
}

function setupSelectors() {
    const mSel = document.getElementById('monthSelect');
    const ySel = document.getElementById('yearSelect');
    
    for(let i=1; i<=12; i++) mSel.innerHTML += `<option value="${i}" ${i === state.month ? 'selected' : ''}>${new Date(0, i-1).toLocaleString('default', {month: 'long'})}</option>`;
    for(let i=2026; i<=2030; i++) ySel.innerHTML += `<option value="${i}" ${i === state.year ? 'selected' : ''}>${i}</option>`;

    mSel.onchange = (e) => { state.month = parseInt(e.target.value); refresh(); };
    ySel.onchange = (e) => { state.year = parseInt(e.target.value); refresh(); };
}

async function loadData() {
    const [hRes, lRes] = await Promise.all([
        fetch('/api/habits'),
        fetch(`/api/logs/${state.year}/${state.month}`)
    ]);
    state.habits = await hRes.json();
    state.logs = await lRes.json();
    const total = document.getElementById('totalHabits');
    if (total) total.innerText = state.habits.length;
    renderSidebarHabits();
}

function renderSidebarHabits() {
    const container = document.getElementById('sidebarHabits');
    if (!container) return;
    const ul = container.querySelector('ul');
    ul.innerHTML = '';
    if (!state.habits || state.habits.length === 0) {
        ul.innerHTML = '<li class="empty">No habits yet</li>';
        return;
    }
    state.habits.forEach(h => {
        const li = document.createElement('li');
        li.className = 'sidebar-habit';
        li.innerHTML = `<span class="bullet">•</span><span class="name">${h.name}</span><button class="sidebar-delete" aria-label="Delete ${h.name}">×</button>`;
        const btn = li.querySelector('.sidebar-delete');
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete habit "${h.name}"?`)) return;
            await deleteHabit(h.id);
        });
        ul.appendChild(li);
    });
}

async function refresh() {
    await loadData();
    renderGrid();
    updateDashboard();
}

function renderGrid() {
    const grid = document.getElementById('habitGrid');
    const daysInMonth = new Date(state.year, state.month, 0).getDate();
    grid.style.gridTemplateColumns = `200px repeat(${daysInMonth}, 30px)`;
    grid.innerHTML = '';

    // Add header row: label + day numbers
    const headerLabel = document.createElement('div');
    headerLabel.className = 'habit-name header-label';
    headerLabel.innerHTML = `<span class="label">Habits</span>`;
    grid.appendChild(headerLabel);
    for (let d = 1; d <= daysInMonth; d++) {
        const dateCell = document.createElement('div');
        dateCell.className = 'date-cell';
        const wk = new Date(state.year, state.month - 1, d).toLocaleString(undefined, { weekday: 'short' });
        const shortWk = (wk || '').toString().slice(0, 3);
        dateCell.innerHTML = `<div class="weekday">${shortWk}</div><div class="daynum">${d}</div>`;
        dateCell.title = `${state.year}-${String(state.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dateCell.setAttribute('aria-label', `Day ${d}, ${shortWk}`);
        grid.appendChild(dateCell);
    }

    state.habits.forEach(habit => {
        const label = document.createElement('div');
        label.className = 'habit-name';
        // add a visual bullet before each habit name
        label.innerHTML = `<span class="bullet" aria-hidden="true">•</span><span class="label">${habit.name}</span>`;
        const del = document.createElement('button');
        del.className = 'delete';
        del.textContent = 'Remove';
        del.setAttribute('aria-label', `Remove ${habit.name}`);
        del.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm(`Remove habit "${habit.name}"?`)) return;
            await deleteHabit(habit.id);
        };
        label.appendChild(del);
        grid.appendChild(label);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${state.year}-${String(state.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isDone = state.logs.some(l => l.habit_id === habit.id && l.date === dateStr && l.completed);

            const cell = document.createElement('div');
            cell.className = `cell ${isDone ? 'checked' : ''}`;
            cell.onclick = () => toggleHabit(habit.id, dateStr, cell);
            grid.appendChild(cell);
        }
    });
}

async function deleteHabit(id) {
    await fetch(`/api/habits/${id}`, { method: 'DELETE' });
    await refresh();
    showToast('Habit removed');
}

async function toggleHabit(id, date, el) {
    const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({habit_id: id, date: date})
    });
    const data = await res.json();
    el.classList.toggle('checked', data.completed);
    updateDashboard();
    showToast(data.completed ? 'Marked complete' : 'Marked incomplete', 1200);
}

async function updateDashboard() {
    const res = await fetch(`/api/stats/${state.year}/${state.month}`);
    const stats = await res.json();

    document.getElementById('monthlyPct').innerText = `${((stats.total_completed / stats.total_possible) * 100).toFixed(1)}%`;
    
    // Update chart max based on habit count
    const chartMax = Math.max(10, state.habits.length);
    dailyChart.options.scales.y.max = chartMax;
    weeklyChart.options.scales.y.max = chartMax;
    
    // Update Charts with actual values (no clamping)
    dailyChart.data.datasets[0].data = Object.values(stats.daily);
    dailyChart.update();

    weeklyChart.data.datasets[0].data = [1,2,3,4,5].map(i => stats.weekly[i] || 0);
    weeklyChart.update();

    const maxWeek = Object.keys(stats.weekly).reduce((a, b) => stats.weekly[a] > stats.weekly[b] ? a : b);
    document.getElementById('bestWeek').innerText = `Week ${maxWeek}`;

    // Update progress pie chart
    const incomplete = stats.total_possible - stats.total_completed;
    progressChart.data.datasets[0].data = [stats.total_completed, incomplete];
    progressChart.update();
}

function initCharts() {
    dailyChart = new Chart(document.getElementById('dailyChart'), {
        type: 'line',
        data: { labels: Array.from({length: 31}, (_, i) => i + 1), datasets: [{ label: 'Daily Completion', borderColor: '#22c55e', data: [], tension: 0.3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: Math.max(10, state.habits.length), ticks: { stepSize: 1 } } } }
    });

    weeklyChart = new Chart(document.getElementById('weeklyChart'), {
        type: 'bar',
        data: { labels: ['W1', 'W2', 'W3', 'W4', 'W5'], datasets: [{ data: [], backgroundColor: '#f97316' }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: Math.max(10, state.habits.length), ticks: { stepSize: 1 } } } }
    });

    progressChart = new Chart(document.getElementById('progressChart'), {
        type: 'doughnut',
        data: { labels: ['Completed', 'Incomplete'], datasets: [{ data: [0, 0], backgroundColor: ['#3b82f6', '#1f2937'], borderColor: '#18181b' }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#fafafa', padding: 12 } } }, responsive: true, maintainAspectRatio: true }
    });
}

init();