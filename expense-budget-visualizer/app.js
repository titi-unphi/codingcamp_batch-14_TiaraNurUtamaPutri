/* ============================================================
   BUDGET VISUALIZER — app.js
   Vanilla JS · localStorage · No dependencies
   ============================================================ */

'use strict';

/* ── Constants ───────────────────────────────────────────── */
const STORAGE_KEY_EXPENSES = 'bv_expenses';
const STORAGE_KEY_BUDGET   = 'bv_budget';

const CATEGORY_COLORS = {
  Food:          '#f97316',
  Transport:     '#3b82f6',
  Housing:       '#8b5cf6',
  Health:        '#10b981',
  Entertainment: '#ec4899',
  Shopping:      '#f59e0b',
  Utilities:     '#06b6d4',
  Education:     '#6366f1',
  Other:         '#9ca3af',
};

/* ── State ───────────────────────────────────────────────── */
let expenses   = [];   // { id, name, amount, category, date }
let budget     = 0;
let editingId  = null; // id of expense being edited, or null
let pendingDeleteId = null;

/* ── DOM refs ────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const dom = {
  // Budget
  budgetInput:      $('budget-amount'),
  btnSetBudget:     $('btn-set-budget'),
  progressFill:     $('progress-fill'),
  progressPct:      $('progress-pct'),
  progressBarWrap:  $('progress-bar-wrap'),
  spentLabel:       $('spent-label'),
  remainingLabel:   $('remaining-label'),

  // Form
  form:             $('expense-form'),
  expName:          $('exp-name'),
  expAmount:        $('exp-amount'),
  expCategory:      $('exp-category'),
  expDate:          $('exp-date'),
  formError:        $('form-error'),
  btnAdd:           $('btn-add-expense'),
  btnCancelEdit:    $('btn-cancel-edit'),

  // List
  expenseList:      $('expense-list'),
  emptyState:       $('empty-state'),
  filterCategory:   $('filter-category'),
  sortExpenses:     $('sort-expenses'),

  // Summary
  statBudget:       $('stat-budget'),
  statSpent:        $('stat-spent'),
  statRemaining:    $('stat-remaining'),
  statCount:        $('stat-count'),

  // Chart
  donutChart:       $('donut-chart'),
  chartCenterValue: $('chart-center-value'),
  chartLegend:      $('chart-legend'),

  // Toast
  toast:            $('toast'),

  // Modal
  modalOverlay:     $('modal-overlay'),
  modalCancel:      $('modal-cancel'),
  modalConfirm:     $('modal-confirm'),

  // Reset
  btnReset:         $('btn-reset'),
};

/* ── localStorage helpers ────────────────────────────────── */
function saveExpenses() {
  localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
}

function saveBudget() {
  localStorage.setItem(STORAGE_KEY_BUDGET, JSON.stringify(budget));
}

function loadData() {
  try {
    const rawExpenses = localStorage.getItem(STORAGE_KEY_EXPENSES);
    const rawBudget   = localStorage.getItem(STORAGE_KEY_BUDGET);
    expenses = rawExpenses ? JSON.parse(rawExpenses) : [];
    budget   = rawBudget   ? JSON.parse(rawBudget)   : 0;
  } catch (e) {
    expenses = [];
    budget   = 0;
  }
}

/* ── ID generation ───────────────────────────────────────── */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Currency formatting ─────────────────────────────────── */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/* ── Date formatting ─────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '';
  // dateStr is YYYY-MM-DD; parse as local date
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ── Toast ───────────────────────────────────────────────── */
let toastTimer = null;

function showToast(message, type = 'default') {
  const el = dom.toast;
  el.textContent = message;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 3000);
}

/* ── Modal ───────────────────────────────────────────────── */
function openModal(expenseId) {
  pendingDeleteId = expenseId;
  dom.modalOverlay.classList.add('open');
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  dom.modalConfirm.focus();
}

function closeModal() {
  pendingDeleteId = null;
  dom.modalOverlay.classList.remove('open');
  dom.modalOverlay.setAttribute('aria-hidden', 'true');
}

/* ── Budget management ───────────────────────────────────── */
function setBudget() {
  const val = parseFloat(dom.budgetInput.value);
  if (isNaN(val) || val < 0) {
    showToast('Please enter a valid budget amount.', 'error');
    return;
  }
  budget = val;
  saveBudget();
  dom.budgetInput.value = val;
  renderAll();
  showToast(`Budget set to ${formatCurrency(val)}`, 'success');
}

/* ── Compute totals ──────────────────────────────────────── */
function getTotalSpent() {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

function getSpentByCategory() {
  const map = {};
  for (const e of expenses) {
    map[e.category] = (map[e.category] || 0) + e.amount;
  }
  return map;
}

/* ── Expense CRUD ────────────────────────────────────────── */
function addExpense(name, amount, category, date) {
  const expense = {
    id: generateId(),
    name: name.trim(),
    amount,
    category,
    date: date || todayISO(),
  };
  expenses.unshift(expense); // newest first by default
  saveExpenses();
  return expense;
}

function updateExpense(id, name, amount, category, date) {
  const idx = expenses.findIndex(e => e.id === id);
  if (idx === -1) return false;
  expenses[idx] = { ...expenses[idx], name: name.trim(), amount, category, date: date || todayISO() };
  saveExpenses();
  return true;
}

function deleteExpense(id) {
  const before = expenses.length;
  expenses = expenses.filter(e => e.id !== id);
  if (expenses.length < before) {
    saveExpenses();
    return true;
  }
  return false;
}

/* ── Form: validation & submit ───────────────────────────── */
function clearFormError() {
  dom.formError.textContent = '';
}

function showFormError(msg) {
  dom.formError.textContent = msg;
}

function resetForm() {
  dom.form.reset();
  dom.expDate.value = todayISO();
  clearFormError();
  editingId = null;
  dom.btnAdd.textContent = 'Add Expense';
  dom.btnCancelEdit.style.display = 'none';
  // Remove editing highlight from all items
  document.querySelectorAll('.expense-item.editing').forEach(el => el.classList.remove('editing'));
}

function populateFormForEdit(expense) {
  dom.expName.value     = expense.name;
  dom.expAmount.value   = expense.amount;
  dom.expCategory.value = expense.category;
  dom.expDate.value     = expense.date || todayISO();
  clearFormError();
  editingId = expense.id;
  dom.btnAdd.textContent = 'Save Changes';
  dom.btnCancelEdit.style.display = 'inline-flex';

  // Scroll form into view
  dom.form.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  dom.expName.focus();

  // Highlight the row being edited
  document.querySelectorAll('.expense-item').forEach(el => {
    el.classList.toggle('editing', el.dataset.id === expense.id);
  });
}

function handleFormSubmit(e) {
  e.preventDefault();
  clearFormError();

  const name     = dom.expName.value.trim();
  const amount   = parseFloat(dom.expAmount.value);
  const category = dom.expCategory.value;
  const date     = dom.expDate.value;

  // Validate
  if (!name) {
    showFormError('Description is required.');
    dom.expName.focus();
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showFormError('Please enter a valid amount greater than 0.');
    dom.expAmount.focus();
    return;
  }

  if (editingId) {
    updateExpense(editingId, name, amount, category, date);
    showToast('Expense updated.', 'success');
  } else {
    addExpense(name, amount, category, date);
    showToast('Expense added.', 'success');
  }

  resetForm();
  renderAll();
}

/* ── Filter & sort helpers ───────────────────────────────── */
function getFilteredSortedExpenses() {
  const filterCat = dom.filterCategory.value;
  const sortVal   = dom.sortExpenses.value;

  let list = filterCat === 'all'
    ? [...expenses]
    : expenses.filter(e => e.category === filterCat);

  list.sort((a, b) => {
    switch (sortVal) {
      case 'date-desc':   return (b.date || '').localeCompare(a.date || '');
      case 'date-asc':    return (a.date || '').localeCompare(b.date || '');
      case 'amount-desc': return b.amount - a.amount;
      case 'amount-asc':  return a.amount - b.amount;
      default:            return 0;
    }
  });

  return list;
}

/* ── Render: expense list ────────────────────────────────── */
function renderExpenseList() {
  const list = getFilteredSortedExpenses();
  const ul   = dom.expenseList;

  ul.innerHTML = '';

  if (list.length === 0) {
    dom.emptyState.classList.add('visible');
    return;
  }

  dom.emptyState.classList.remove('visible');

  for (const expense of list) {
    const color = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.Other;
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.dataset.id  = expense.id;
    li.dataset.cat = expense.category;

    // Highlight if currently editing
    if (editingId === expense.id) li.classList.add('editing');

    li.innerHTML = `
      <span class="expense-dot" style="background:${color}" aria-hidden="true"></span>
      <div class="expense-info">
        <div class="expense-name" title="${escapeHtml(expense.name)}">${escapeHtml(expense.name)}</div>
        <div class="expense-meta">
          <span>${escapeHtml(expense.category)}</span>
          ${expense.date ? `<span>${formatDate(expense.date)}</span>` : ''}
        </div>
      </div>
      <span class="expense-amount">${formatCurrency(expense.amount)}</span>
      <div class="expense-actions">
        <button class="btn-icon edit" data-action="edit" data-id="${expense.id}" aria-label="Edit ${escapeHtml(expense.name)}">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="btn-icon delete" data-action="delete" data-id="${expense.id}" aria-label="Delete ${escapeHtml(expense.name)}">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;
    ul.appendChild(li);
  }
}

/* ── Render: budget progress bar ─────────────────────────── */
function renderProgress() {
  const spent     = getTotalSpent();
  const remaining = budget - spent;
  const pct       = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  dom.spentLabel.textContent     = `Spent: ${formatCurrency(spent)}`;
  dom.remainingLabel.textContent = `Remaining: ${formatCurrency(Math.max(remaining, 0))}`;
  dom.progressFill.style.width   = `${pct}%`;
  dom.progressPct.textContent    = `${pct.toFixed(1)}% used`;
  dom.progressBarWrap.setAttribute('aria-valuenow', pct.toFixed(1));

  // Color state
  dom.progressFill.classList.remove('warning', 'danger');
  if (pct >= 90)      dom.progressFill.classList.add('danger');
  else if (pct >= 70) dom.progressFill.classList.add('warning');
}

/* ── Render: summary stats ───────────────────────────────── */
function renderStats() {
  const spent     = getTotalSpent();
  const remaining = budget - spent;

  dom.statBudget.textContent    = formatCurrency(budget);
  dom.statSpent.textContent     = formatCurrency(spent);
  dom.statRemaining.textContent = formatCurrency(remaining);
  dom.statCount.textContent     = expenses.length;

  // Color remaining red if over budget
  dom.statRemaining.style.color = remaining < 0
    ? 'var(--clr-danger)'
    : 'var(--clr-text)';
}

/* ── Render: donut chart (SVG) ───────────────────────────── */
function renderDonutChart() {
  const svg    = dom.donutChart;
  const legend = dom.chartLegend;
  const total  = getTotalSpent();
  const byCategory = getSpentByCategory();

  // Update center label
  dom.chartCenterValue.textContent = formatCurrency(total);

  svg.innerHTML   = '';
  legend.innerHTML = '';

  const cx = 110, cy = 110, r = 80;
  const strokeW = 28;
  const circumference = 2 * Math.PI * r;

  if (total === 0) {
    // Empty ring
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('class', 'chart-empty-ring');
    svg.appendChild(circle);
    return;
  }

  // Sort categories by amount descending for visual clarity
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  let offset = 0; // dashoffset offset in circumference units

  for (const [cat, amount] of entries) {
    const pct    = amount / total;
    const dash   = pct * circumference;
    const gap    = circumference - dash;
    const color  = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', strokeW);
    circle.setAttribute('stroke-dasharray', `${dash} ${gap}`);
    circle.setAttribute('stroke-dashoffset', -offset);
    circle.setAttribute('stroke-linecap', 'butt');
    circle.setAttribute('role', 'presentation');

    // Tooltip via title element
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${cat}: ${formatCurrency(amount)} (${(pct * 100).toFixed(1)}%)`;
    circle.appendChild(title);

    svg.appendChild(circle);
    offset += dash;

    // Legend item
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-dot" style="background:${color}" aria-hidden="true"></span>
      <span class="legend-label">${escapeHtml(cat)}</span>
      <span class="legend-pct">${(pct * 100).toFixed(1)}%</span>
      <span class="legend-amt">${formatCurrency(amount)}</span>
    `;
    legend.appendChild(li);
  }
}

/* ── Render: budget input sync ───────────────────────────── */
function renderBudgetInput() {
  if (budget > 0) {
    dom.budgetInput.value = budget;
  }
}

/* ── Render all ──────────────────────────────────────────── */
function renderAll() {
  renderBudgetInput();
  renderProgress();
  renderStats();
  renderExpenseList();
  renderDonutChart();
}

/* ── XSS helper ──────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Event delegation: expense list actions ──────────────── */
function handleListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const id     = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'edit') {
    const expense = expenses.find(ex => ex.id === id);
    if (expense) populateFormForEdit(expense);
  }

  if (action === 'delete') {
    openModal(id);
  }
}

/* ── Reset all data ──────────────────────────────────────── */
function handleReset() {
  if (!confirm('Reset all data? This will clear your budget and all expenses.')) return;
  expenses = [];
  budget   = 0;
  localStorage.removeItem(STORAGE_KEY_EXPENSES);
  localStorage.removeItem(STORAGE_KEY_BUDGET);
  dom.budgetInput.value = '';
  resetForm();
  renderAll();
  showToast('All data cleared.', 'default');
}

/* ── Bootstrap ───────────────────────────────────────────── */
function init() {
  // Load persisted data
  loadData();

  // Set today's date as default for the date field
  dom.expDate.value = todayISO();

  // Initial render
  renderAll();

  /* ── Event listeners ─────────────────────────────────── */

  // Budget
  dom.btnSetBudget.addEventListener('click', setBudget);
  dom.budgetInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') setBudget();
  });

  // Expense form
  dom.form.addEventListener('submit', handleFormSubmit);
  dom.btnCancelEdit.addEventListener('click', resetForm);

  // List delegation (edit / delete buttons)
  dom.expenseList.addEventListener('click', handleListClick);

  // Filter & sort
  dom.filterCategory.addEventListener('change', renderExpenseList);
  dom.sortExpenses.addEventListener('change', renderExpenseList);

  // Modal
  dom.modalCancel.addEventListener('click', closeModal);
  dom.modalConfirm.addEventListener('click', () => {
    if (pendingDeleteId) {
      const expense = expenses.find(e => e.id === pendingDeleteId);
      const name    = expense ? expense.name : 'expense';
      deleteExpense(pendingDeleteId);
      // If we were editing this one, cancel the edit
      if (editingId === pendingDeleteId) resetForm();
      closeModal();
      renderAll();
      showToast(`"${name}" deleted.`, 'default');
    }
  });

  // Close modal on overlay click
  dom.modalOverlay.addEventListener('click', e => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dom.modalOverlay.classList.contains('open')) {
      closeModal();
    }
  });

  // Reset
  dom.btnReset.addEventListener('click', handleReset);
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
