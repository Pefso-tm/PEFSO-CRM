const API_URL = 'https://script.google.com/macros/s/AKfycbwxHRaWF6g8YNpmA3isO78er_xyRb8BTPx1LWxejZRRuvphewKTtEDpMCYccMzAZsQb/exec';

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

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action,
        userEmail,
        data
      })
    });

    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err.message || 'Connection error'
    };
  }
}

/* LOGIN */

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
    loadProducts({ silent: true }),
    loadCustomers({ silent: true })
  ]);
  hideStatus();
}

/* DASHBOARD */

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
    ${dashboardCard('Products', dashboardCache.products, 'Tổng sản phẩm')}
    ${dashboardCard('Draft Products', dashboardCache.draftProducts, 'Chờ duyệt')}
    ${dashboardCard('Customers', dashboardCache.customers, 'Tổng khách hàng')}
    ${dashboardCard('New Inquiries', dashboardCache.inquiries, 'Đang xử lý')}
    ${dashboardCard('Pending Quotations', dashboardCache.quotations, 'Chờ phản hồi')}
    ${dashboardCard('Open PI', dashboardCache.openPI, 'Chưa hoàn tất')}
    ${dashboardCard('Open Orders', dashboardCache.openOrders, 'Đang thực hiện')}
    ${dashboardCard('CI / PKL Issued', 0, 'Đã phát hành')}
    ${dashboardCard('Payment Overdue', dashboardCache.paymentOverdue, 'Quá hạn')}
    ${dashboardCard('Follow-up Due', dashboardCache.followups, 'Cần follow')}
  `;
}

function dashboardCard(title, value, subtitle) {
  return `
    <div class="card">
      <b>${safe(title)}</b>
      <span>${safe(value)}</span>
      <p class="muted">${safe(subtitle || '')}</p>
    </div>
  `;
}

/* PRODUCT MASTER */

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

  if (!productsCache.length) {
    container.innerHTML = `<p class="muted">No product data yet.</p>`;
    return;
  }

  const rows = productsCache.map(p => `
    <tr>
      <td>${safe(p.Product_Code)}</td>
      <td>${safe(p.Product_Name_EN)}</td>
      <td>${safe(p.Product_Name_VN)}</td>
      <td>${safe(p.HS_Code)}</td>
      <td>${safe(p.Category)}</td>
      <td>${safe(p.Unit)}</td>
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
          <th>Category</th>
          <th>Unit</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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
    Currency: val('p_currency') || 'USD',
    Customs_Description: val('p_customs_description'),
    VAT_Description: val('p_vat_description'),
    Packing_Standard: val('p_packing_standard'),
    Notes: val('p_notes')
  };

  const required = [
    'Product_Name_EN',
    'Product_Name_VN',
    'HS_Code',
    'Category',
    'Material',
    'Specification',
    'Unit'
  ];

  const missing = required.filter(field => !data[field]);

  if (missing.length) {
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
  clearProductForm();

  showToast('Product created: ' + result.data.Product_Code, 'success');

  setTimeout(() => {
    loadProducts({ silent: true });
    loadDashboard({ silent: true });
  }, 1200);
}

function clearProductForm() {
  [
    'p_name_en',
    'p_name_vn',
    'p_hs_code',
    'p_category',
    'p_material',
    'p_specification',
    'p_unit',
    'p_moq',
    'p_standard_price',
    'p_currency',
    'p_customs_description',
    'p_vat_description',
    'p_packing_standard',
    'p_notes'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

/* CUSTOMER CRM */

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

  if (!customersCache.length) {
    container.innerHTML = `<p class="muted">No customer data yet.</p>`;
    return;
  }

  const rows = customersCache.map(c => `
    <tr>
      <td>${safe(c.Customer_ID)}</td>
      <td>${safe(c.Company_Name)}</td>
      <td>${safe(c.Contact_Person)}</td>
      <td>${safe(c.Email)}</td>
      <td>${safe(c.Country)}</td>
      <td>${safe(c.Customer_Type)}</td>
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
          <th>Email</th>
          <th>Country</th>
          <th>Type</th>
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

  customersCache.unshift(result.data);
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
  [
    'c_company',
    'c_contact',
    'c_email',
    'c_phone',
    'c_country',
    'c_notes'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const typeEl = document.getElementById('c_type');
  if (typeEl) typeEl.selectedIndex = 0;
}

/* FUTURE MODULE API HELPERS */

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

/* UI HELPERS */

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
    status.style.color = '#002b4f';
    status.style.border = '1px solid #e5eaf1';
    status.style.borderRadius = '999px';
    status.style.padding = '9px 15px';
    status.style.fontSize = '13px';
    status.style.fontWeight = '700';
    status.style.boxShadow = '0 10px 28px rgba(20,33,61,0.12)';
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
  toast.style.maxWidth = '380px';
  toast.style.padding = '13px 18px';
  toast.style.borderRadius = '14px';
  toast.style.color = '#fff';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '700';
  toast.style.boxShadow = '0 14px 34px rgba(0,0,0,0.24)';
  toast.style.zIndex = '9999';
  toast.style.background = type === 'error' ? '#b00020' : '#002b4f';
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

/* PWA */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
/* ===== NAVIGATION CONTROL - REQUIRED AFTER CLEAN INDEX ===== */

window.showSection = function(sectionId, buttonEl) {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active-section');
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active-section');
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (buttonEl) {
    buttonEl.classList.add('active');
  } else {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const onclickValue = btn.getAttribute('onclick') || '';
      if (onclickValue.includes(sectionId)) {
        btn.classList.add('active');
      }
    });
  }

  const moreMenu = document.getElementById('mobileMoreMenu');
  if (moreMenu) {
    moreMenu.classList.remove('show');
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

window.toggleMoreMenu = function() {
  const menu = document.getElementById('mobileMoreMenu');
  if (menu) {
    menu.classList.toggle('show');
  }
};
