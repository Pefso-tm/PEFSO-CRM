const API_URL = 'https://script.google.com/macros/s/AKfycbztZk1GrWqI78GxSksmJ9yITrAgM_07inLKB_lAFRlPxoZvG7ixleJ03flGRnXfVecH/exec';

let currentUser = null;
let customersCache = [];
let productsCache = [];
let dashboardCache = {
  products: 0,
  draftProducts: 0,
  customers: 0,
  inquiries: 0,
  quotations: 0,
  openPI: 0,
  openOrders: 0,
  paymentOverdue: 0,
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

  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.innerText = `${currentUser.Full_Name || ''} - ${currentUser.Role || ''}`;
  }

  showToast('Login successful', 'success');

  showStatus('Loading data...');
  await Promise.all([
    loadDashboard({ silent: true }),
    loadCustomers({ silent: true }),
    loadProducts({ silent: true })
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
    products: Number(result.data.products || 0),
    draftProducts: Number(result.data.draftProducts || 0),
    customers: Number(result.data.customers || 0),
    inquiries: Number(result.data.inquiries || 0),
    quotations: Number(result.data.quotations || 0),
    openPI: Number(result.data.openPI || 0),
    openOrders: Number(result.data.openOrders || 0),
    paymentOverdue: Number(result.data.paymentOverdue || 0),
    followups: Number(result.data.followups || 0)
  };

  renderDashboard();
}

function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) return;

  dashboard.innerHTML = `
    <div class="card"><b>Products</b><span>${dashboardCache.products}</span></div>
    <div class="card"><b>Draft Products</b><span>${dashboardCache.draftProducts}</span></div>
    <div class="card"><b>Customers</b><span>${dashboardCache.customers}</span></div>
    <div class="card"><b>New Inquiries</b><span>${dashboardCache.inquiries}</span></div>
    <div class="card"><b>Pending Quotations</b><span>${dashboardCache.quotations}</span></div>
    <div class="card"><b>Open PI</b><span>${dashboardCache.openPI}</span></div>
    <div class="card"><b>Open Orders</b><span>${dashboardCache.openOrders}</span></div>
    <div class="card"><b>Payment Overdue</b><span>${dashboardCache.paymentOverdue}</span></div>
    <div class="card"><b>Follow-up Due</b><span>${dashboardCache.followups}</span></div>
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

async function loadProducts(options = {}) {
  const result = await api('listProducts');

  if (!result.ok) {
    if (!options.silent) showToast(result.error || 'Cannot load products', 'error');
    return;
  }

  productsCache = Array.isArray(result.data) ? result.data : [];
  renderProducts();
}

function renderProducts() {
  const container = document.getElementById('products');
  if (!container) return;

  const rows = productsCache.map(p => `
    <tr>
      <td>${safe(p.Product_Code)}</td>
      <td>${safe(p.Product_Name_EN)}</td>
      <td>${safe(p.Product_Name_VN)}</td>
      <td>${safe(p.HS_Code)}</td>
      <td>${safe(p.Product_Status || 'Draft')}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Name EN</th>
          <th>Name VN</th>
          <th>HS Code</th>
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
  showStatus('Saving customer...');

  const result = await api('createCustomer', data);

  setButtonBusy('createCustomerBtn', false, 'Create Customer');
  hideStatus();

  if (!result.ok) {
    showToast(result.error || 'Cannot create customer', 'error');
    return;
  }

  const newCustomer = result.data;
  customersCache.unshift(newCustomer);
  dashboardCache.customers += 1;

  renderCustomers();
  renderDashboard();
  clearCustomerForm();

  showToast('Customer created: ' + newCustomer.Customer_ID, 'success');

  setTimeout(() => {
    loadCustomers({ silent: true });
    loadDashboard({ silent: true });
  }, 1200);
}

async function createProduct() {
  const data = {
    Product_Name_EN: val('p_name_en'),
    Product_Name_VN: val('p_name_vn'),
    HS_Code: val('p_hs_code'),
    Category: val('p_category'),
    Material: val('p_material'),
    Specification: val('p_specification'),
    Unit: val('p_unit'),
    MOQ: val('p_moq'),
    Standard_Price: val('p_standard_price'),
    Currency: val('p_currency'),
    Customs_Description: val('p_customs_description'),
    VAT_Description: val('p_vat_description'),
    Packing_Standard: val('p_packing_standard'),
    Notes: val('p_notes')
  };

  if (!data.Product_Name_EN || !data.Product_Name_VN || !data.HS_Code || !data.Category || !data.Material || !data.Specification || !data.Unit) {
    showToast('Missing required product information', 'error');
    return;
  }

  setButtonBusy('createProductBtn', true, 'Saving...');
  showStatus('Saving product...');

  const result = await api('createProduct', data);

  setButtonBusy('createProductBtn', false, 'Create Product');
  hideStatus();

  if (!result.ok) {
    showToast(result.error || 'Cannot create product', 'error');
    return;
  }

  productsCache.unshift(result.data);
  dashboardCache.products += 1;
  dashboardCache.draftProducts += 1;

  renderProducts();
  renderDashboard();

  showToast('Product created: ' + result.data.Product_Code, 'success');

  setTimeout(() => {
    loadProducts({ silent: true });
    loadDashboard({ silent: true });
  }, 1200);
}

async function approveProduct(productId) {
  if (!productId) {
    showToast('Missing Product ID', 'error');
    return;
  }

  const result = await api('approveProduct', { Product_ID: productId });

  if (!result.ok) {
    showToast(result.error || 'Cannot approve product', 'error');
    return;
  }

  showToast('Product approved', 'success');
  await loadProducts({ silent: true });
  await loadDashboard({ silent: true });
}

async function createInquiry(data) {
  const result = await api('createInquiry', data);
  notifyResult(result, 'Inquiry created');
  return result;
}

async function createQuotation(data) {
  const result = await api('createQuotation', data);
  notifyResult(result, 'Quotation created');
  return result;
}

async function createPI(data) {
  const result = await api('createPI', data);
  notifyResult(result, 'PI created');
  return result;
}

async function createOrder(data) {
  const result = await api('createOrder', data);
  notifyResult(result, 'Order created');
  return result;
}

async function createCI(data) {
  const result = await api('createCI', data);
  notifyResult(result, 'Commercial Invoice created');
  return result;
}

async function createPackingList(data) {
  const result = await api('createPackingList', data);
  notifyResult(result, 'Packing List created');
  return result;
}

async function createPayment(data) {
  const result = await api('createPayment', data);
  notifyResult(result, 'Payment record created');
  return result;
}

async function createFollowup(data) {
  const result = await api('createFollowup', data);
  notifyResult(result, 'Follow-up created');
  return result;
}

async function getCustomerDetail(customerId) {
  const result = await api('getCustomerDetail', { Customer_ID: customerId });

  if (!result.ok) {
    showToast(result.error || 'Cannot load customer detail', 'error');
    return null;
  }

  return result.data;
}

function notifyResult(result, successMessage) {
  if (!result.ok) {
    showToast(result.error || 'Action failed', 'error');
    return;
  }

  showToast(successMessage, 'success');
  loadDashboard({ silent: true });
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

  if (!btn) return;

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
