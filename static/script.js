// ProContacts - Fixed Syntax Error Version
// Line 45 fixed - null-safe DOM handling

const DOM = {
  sections: document.querySelectorAll('.page-section'),
  navItems: document.querySelectorAll('.nav-item'),
  modal: document.getElementById('contactModal'),
  deleteModal: document.getElementById('deleteModal'),
  toastShelf: document.getElementById('toastShelf'),
  recentList: document.getElementById('recentList'),
  recentCount: document.getElementById('recentCount'),
  contactsBody: document.getElementById('contactsBody'),
  emptyState: document.getElementById('emptyState'),
  form: document.getElementById('contactForm'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubmit: document.getElementById('modalSubmit'),
  editId: document.getElementById('editContactId'),
  searchInput: document.getElementById('searchInput'),
  openBtns: [],
  sortSelect: document.getElementById('sortSelect')
};

// Safe stat elements
DOM.statValues = {};
['sv-total', 'sv-verified', 'sv-today', 'sv-updated'].forEach(id => {
  const el = document.getElementById(id);
  if (el) DOM.statValues[id] = el;
});

// Safe open buttons
['dirAddBtn', 'emptyAddBtn'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) DOM.openBtns.push(btn);
});

let contacts = [];
let filteredContacts = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadContacts();
  } catch (e) {
    console.log('Initial load failed:', e);
  }
  initEventListeners();
  updateClock();
});

function initEventListeners() {
  DOM.navItems.forEach(item => {
    item.addEventListener('click', handleNavClick);
  });
  
  DOM.openBtns.forEach(btn => {
    btn.addEventListener('click', () => openModal());
  });
  
  const closeBtns = ['modalClose', 'modalCancel'];
  closeBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = closeModal;
  });
  
  const deleteCancel = document.getElementById('deleteCancelBtn');
  if (deleteCancel) deleteCancel.onclick = () => DOM.deleteModal.classList.remove('open');
  
  if (DOM.form) {
    DOM.form.onsubmit = handleFormSubmit;
    DOM.form.addEventListener('input', handleFormInput);
  }
  
  if (DOM.searchInput) DOM.searchInput.oninput = handleSearch;
  
  if (DOM.sortSelect) DOM.sortSelect.onchange = handleSort;
  
  const clearBtn = document.getElementById('clearSearch');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (DOM.searchInput) {
        DOM.searchInput.value = '';
        handleSearch();
      }
    };
  }
}

function handleNavClick(e) {
  e.preventDefault();
  DOM.navItems.forEach(i => i.classList.remove('active'));
  this.classList.add('active');
  
  const section = this.dataset.section;
  DOM.sections.forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + section);
  if (target) target.classList.add('active');
  
  if (section === 'dashboard') renderRecentList();
  else if (section === 'directory') renderTable();
}

async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch('/api' + endpoint, {
      headers: {'Content-Type': 'application/json'},
      ...options
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || 'Request failed');
    }
    
    return await res.json();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
    throw error;
  }
}

async function loadContacts() {
  try {
    contacts = await apiCall('/contacts');
    filteredContacts = [...contacts];
    renderTable();
    renderRecentList();
    loadStats();
  } catch (error) {
    console.error('Load contacts failed:', error);
  }
}

async function loadStats() {
  if (Object.keys(DOM.statValues).length === 0) return;
  
  try {
    const stats = await apiCall('/stats');
    DOM.statValues['sv-total'] && (DOM.statValues['sv-total'].textContent = stats.total);
    DOM.statValues['sv-verified'] && (DOM.statValues['sv-verified'].textContent = stats.verified_emails);
    DOM.statValues['sv-today'] && (DOM.statValues['sv-today'].textContent = stats.today_entries);
    DOM.statValues['sv-updated'] && (DOM.statValues['sv-updated'].textContent = stats.last_updated);
    
    Object.values(DOM.statValues).forEach(el => {
      if (el) el.classList.remove('shimmer-line');
    });
  } catch {
    Object.values(DOM.statValues).forEach(el => {
      if (el) el.textContent = '—';
    });
  }
}

function renderTable() {
  if (!DOM.contactsBody) return;
  
  DOM.contactsBody.innerHTML = '';
  
  if (filteredContacts.length === 0) {
    if (DOM.emptyState) DOM.emptyState.style.display = 'block';
    return;
  }
  
  if (DOM.emptyState) DOM.emptyState.style.display = 'none';
  
  filteredContacts.forEach(contact => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(contact.contact_id)}</td>
      <td>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</td>
      <td>${escapeHtml(contact.email)}</td>
      <td>${escapeHtml(contact.phone)}</td>
      <td>${escapeHtml(contact.address)}</td>
      <td>${contact.created_at_fmt}</td>
      <td>
        <button class="btn-sm" onclick="editContact('${contact.contact_id}')" style="background:#4dabf7;color:#000;padding:.25rem .5rem;border:none;border-radius:4px;margin-right:.25rem;cursor:pointer">Edit</button>
        <button class="btn-sm" onclick="deleteContact('${contact.contact_id}', '${contact.first_name} ${contact.last_name}')" style="background:#ef4444;color:white;padding:.25rem .5rem;border:none;border-radius:4px;cursor:pointer">Delete</button>
      </td>`;
    DOM.contactsBody.appendChild(row);
  });
}

function renderRecentList() {
  if (!DOM.recentList) return;
  
  DOM.recentList.innerHTML = '';
  
  if (contacts.length === 0) {
    DOM.recentList.innerHTML = '<div style="padding:2rem;text-align:center;color:#b3b3b3;font-style:italic">No contacts yet</div>';
    if (DOM.recentCount) DOM.recentCount.textContent = '0';
    return;
  }
  
  contacts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5).forEach(contact => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:1rem 0;border-bottom:1px solid #333;';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</strong>
            <br><small style="color:#b3b3b3">${escapeHtml(contact.email)}</small>
          </div>
          <small>${contact.created_at_fmt}</small>
        </div>`;
      DOM.recentList.appendChild(div);
    });
  
  if (DOM.recentCount) DOM.recentCount.textContent = Math.min(5, contacts.length);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function handleSearch() {
  const term = DOM.searchInput.value.toLowerCase();
  filteredContacts = contacts.filter(c => 
    (c.first_name + ' ' + c.last_name + ' ' + c.email + ' ' + c.phone).toLowerCase().includes(term)
  );
  renderTable();
}

function handleSort() {
  renderTable();
}

function openModal(contact) {
  DOM.modal.classList.add('open');
  DOM.form.reset();
  
  DOM.modalTitle.textContent = contact ? 'Edit Contact' : 'Add Contact';
  DOM.editId.value = contact ? contact.contact_id : '';
  
  if (contact) {
    document.getElementById('fieldFirstName').value = contact.first_name;
    document.getElementById('fieldLastName').value = contact.last_name;
    document.getElementById('fieldEmail').value = contact.email;
    document.getElementById('fieldPhone').value = contact.phone;
    document.getElementById('fieldAddress').value = contact.address;
    DOM.modalSubmit.disabled = false;
  }
}

function closeModal() {
  DOM.modal.classList.remove('open');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const data = {
    first_name: document.getElementById('fieldFirstName').value.trim(),
    last_name: document.getElementById('fieldLastName').value.trim(),
    email: document.getElementById('fieldEmail').value.trim().toLowerCase(),
    phone: document.getElementById('fieldPhone').value.trim(),
    address: document.getElementById('fieldAddress').value.trim()
  };
  
  const isEdit = DOM.editId.value;
  const endpoint = isEdit ? '/contacts/' + DOM.editId.value : '/contacts';
  
  try {
    await apiCall(endpoint, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    
    showToast('Contact ' + (isEdit ? 'updated' : 'added') + '!');
    closeModal();
    await loadContacts();
  } catch (e) {
    showToast('Try again', 'error');
  }
}

function handleFormInput() {
  const f1 = document.getElementById('fieldFirstName').value.trim();
  const f2 = document.getElementById('fieldLastName').value.trim();
  const email = document.getElementById('fieldEmail').value.trim();
  DOM.modalSubmit.disabled = !(f1 && f2 && email);
}

window.editContact = id => {
  const contact = contacts.find(c => c.contact_id === id);
  openModal(contact);
};

window.deleteContact = async (id, name) => {
  document.getElementById('deleteContactName').textContent = name;
  DOM.deleteModal.classList.add('open');
  
  document.getElementById('deleteConfirmBtn').onclick = async () => {
    try {
      await apiCall('/contacts/' + id, { method: 'DELETE' });
      showToast('Deleted!');
      DOM.deleteModal.classList.remove('open');
      await loadContacts();
    } catch {
      showToast('Delete failed', 'error');
    }
  };
};

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  DOM.toastShelf.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function updateClock() {
  const dateEl = document.getElementById('clockDate');
  const timeEl = document.getElementById('clockTime');
  if (!dateEl || !timeEl) return;
  
  const now = new Date();
  dateEl.textContent = now.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'});
  timeEl.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

setInterval(updateClock, 1000);
