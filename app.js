const API_URL = 'https://script.google.com/macros/s/AKfycbxJsRbT5ROVW-WysN7saJbug5mnw0PIcdQesh1Dca5zrKHTN7QMiUvL1IkC35EVE8Pf/exec';

let currentUser = null;
let customersCache = [];
let dashboardCache = {
  customers: 0,
  inquiries: 0,
  quotations: 0,
  followups: 0
};

async function api(action, data = {}) {
  try {
    const emailInput = document.getElementById('email');
    const userEmail = emailInput ? emailInput.value.trim() : '';

    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action,
        userEmail,
        data
      })
    });

    return await res.json();
  } catch (err) {
    return {
      ok: false,
      error: err.message || 'Connection error'
    };
  }
}

async function login() {
  const email = val('email');

  if (!email) {
    showToast('Please enter your email', 'error');
    return;
  }

  setButtonBusy('loginBtn', true, 'Logging in...');
  showStatus('Checking user permission...');

  const result = await api('login');

  setButtonBusy('loginBtn', false, 'Login');
  hideStatus();

  if (!result.ok) {
    showToast(result.error || 'Login failed', 'error');
    return;
  }

  currentUser = result.user;

  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('appBox').style.display = 'block';
  document.getElementById('userInfo').innerText = `${currentUser.Full_Name || ''} - ${currentUser.Role || ''}`;

  showToast('Login successful', 'success');

  showStatus('Loading dashboard...');
  await Promise.all([
    loadDashboard({ silent: true }),
    loadCustomers({ silent: true })
  ]);
  hideStatus();
}

async function loadDashboard(options = {}) {
  const result = await api('getDashboard');

  if (!result.ok) {
    if (!options.silent) showToast(result.error || 'Cannot load dashboard', 'error');
    return;
  }

  dashboardCache = {
    customers: Number(result.data.customers || 0),
    inquiries: Number(result.data.inquiries || 0),
    quotations: Number(result.data.quotations || 0),
    followups: Number(result.data.followups || 0)
  };

  renderDashboard();
}

function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) return;

  dashboard.innerHTML = `
    <div class="card"><b>Customers</b><span>${dashboardCache.customers}</span></div>
    <div class="card"><b>Inquiries</b><span>${dashboardCache.inquiries}</span></div>
    <div class="card"><b>Quotations</b><span>${dashboardCache.quotations}</span></div>
    <div class="card"><b>Open Follow-ups</b><span>${dashboardCache.followups}</span></div>
  `;
}

async function loadCustomers(options = {}) {
  const result = await api('listCustomers');

  if (!result.ok) {
    if (!options.silent) showToast(result.error || 'Cannot load customers', 'error');
    return;
  }

  customersCache = Array.isArray(result.data) ? result.data : [];
  renderCustomers();
}

function renderCustomers() {
  const container = document.getElementById('customers');
  if (!container) return;

  const rows = customersCache.map(c => `
    <tr>
      <td>${safe(c.Customer_ID)}</td>
      <td>${safe(c.Company_Name)}</td>
      <td>${safe(c.Contact_Person)}</td>
      <td>${safe(c.Country)}</td>
      <td>${safe(c.Status || 'Active')}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Company</th>
          <th>Contact</th>
          <th>Country</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function createCustomer() {
  const data = {
    Company_Name: val('c_company'),
    Contact_Person: val('c_contact'),
    Email: val('c_email'),
    Phone: val('c_phone'),
    Country: val('c_country'),
    Customer_Type: val('c_type'),
    Notes: val('c_notes')
  };

  if (!data.Company_Name) {
    focusField('c_company');
    showToast('Company name is required', 'error');
    return;
  }

  setButtonBusy('createCustomerBtn', true, 'Saving...');
  showStatus('Saving customer to database...');

  const result = await api('createCustomer', data);

  setButtonBusy('createCustomerBtn', false, 'Create Customer');
  hideStatus();

  if (!result.ok) {
    showToast(result.error || 'Cannot create customer', 'error');
    return;
  }

  const newCustomer = {
    Customer_ID: result.data.Customer_ID,
    Company_Name: data.Company_Name,
    Contact_Person: data.Contact_Person,
    Email: data.Email,
    Phone: data.Phone,
    Country: data.Country,
    Customer_Type: data.Customer_Type,
    Status: 'Active',
    Notes: data.Notes
  };

  customersCache.unshift(newCustomer);
  dashboardCache.customers += 1;

  renderCustomers();
  renderDashboard();
  clearCustomerForm();

  showToast('Customer created: ' + result.data.Customer_ID, 'success');

  setTimeout(() => {
    loadCustomers({ silent: true });
    loadDashboard({ silent: true });
  }, 1200);
}

function clearCustomerForm() {
  const ids = [
    'c_company',
    'c_contact',
    'c_email',
    'c_phone',
    'c_country',
    'c_notes'
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const typeEl = document.getElementById('c_type');
  if (typeEl) typeEl.selectedIndex = 0;
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function focusField(id) {
  const el = document.getElementById(id);
  if (el) el.focus();
}

function safe(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setButtonBusy(buttonId, isBusy, text) {
  const btn = document.getElementById(buttonId);

  if (!btn) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      const label = button.innerText.trim().toLowerCase();
      if (label.includes('create customer') || label.includes('login')) {
        button.disabled = isBusy;
        if (text) button.innerText = text;
      }
    });
    return;
  }

  btn.disabled = isBusy;
  btn.innerText = text || btn.innerText;
  btn.style.opacity = isBusy ? '0.75' : '1';
  btn.style.cursor = isBusy ? 'not-allowed' : 'pointer';
}

function showStatus(message) {
  let status = document.getElementById('statusBar');

  if (!status) {
    status = document.createElement('div');
    status.id = 'statusBar';
    status.style.position = 'fixed';
    status.style.left = '50%';
    status.style.bottom = '18px';
    status.style.transform = 'translateX(-50%)';
    status.style.background = '#ffffff';
    status.style.color = '#1f4e79';
    status.style.border = '1px solid #d8e3ef';
    status.style.borderRadius = '999px';
    status.style.padding = '8px 14px';
    status.style.fontSize = '13px';
    status.style.fontWeight = '600';
    status.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
    status.style.zIndex = '9998';
    document.body.appendChild(status);
  }

  status.innerText = message;
  status.style.display = 'block';
}

function hideStatus() {
  const status = document.getElementById('statusBar');
  if (status) status.style.display = 'none';
}

function showToast(message, type = 'success') {
  const oldToast = document.getElementById('pefsoToast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.id = 'pefsoToast';
  toast.innerText = message;

  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.maxWidth = '360px';
  toast.style.padding = '12px 18px';
  toast.style.borderRadius = '12px';
  toast.style.color = '#fff';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 10px 28px rgba(0,0,0,0.22)';
  toast.style.zIndex = '9999';
  toast.style.background = type === 'error' ? '#b00020' : '#1f4e79';
  toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-8px)';

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 280);
  }, 2600);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
