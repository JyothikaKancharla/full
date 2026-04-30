/**
 * ConnectSphere Pro — script.js
 * Vanilla JS, event-driven, no framework.
 * Written to feel like a real product after multiple iterations.
 */

"use strict";

/* ── Module-level state ──────────────────────────────────────────── */
const State = {
  contacts: [],          // local mirror of what's in the DB
  filterText: "",
  sortMode: "newest",
  pendingDeleteId: null,
};

/* ── Cached DOM refs ─────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const DOM = {
  // sidebar
  navItems:      document.querySelectorAll(".nav-item"),
  menuToggle:    $("menuToggle"),
  sidebar:       document.querySelector(".sidebar"),

  // header
  topbarTitle:   document.querySelector(".topbar-title"),
  clockDate:     $("clockDate"),
  clockTime:     $("clockTime"),

  // stat cards
  svTotal:       $("sv-total"),
  svVerified:    $("sv-verified"),
  svToday:       $("sv-today"),
  svUpdated:     $("sv-updated"),
  recentList:    $("recentList"),
  recentCount:   $("recentCount"),

  // directory
  searchInput:   $("searchInput"),
  clearSearch:   $("clearSearch"),
  sortSelect:    $("sortSelect"),
  contactsBody:  $("contactsBody"),
  emptyState:    $("emptyState"),

  // modal (add/edit)
  contactModal:  $("contactModal"),
  modalTitle:    $("modalTitle"),
  modalClose:    $("modalClose"),
  modalCancel:   $("modalCancel"),
  modalSubmit:   $("modalSubmit"),
  contactForm:   $("contactForm"),
  editContactId: $("editContactId"),
  fFirstName:    $("fieldFirstName"),
  fLastName:     $("fieldLastName"),
  fEmail:        $("fieldEmail"),
  fPhone:        $("fieldPhone"),
  fAddress:      $("fieldAddress"),

  // delete confirm
  deleteModal:       $("deleteModal"),
  deleteContactName: $("deleteContactName"),
  deleteCancelBtn:   $("deleteCancelBtn"),
  deleteConfirmBtn:  $("deleteConfirmBtn"),

  // toast
  toastShelf: $("toastShelf"),
};

/* ── Clock ───────────────────────────────────────────────────────── */
function tickClock() {
  const now = new Date();
  DOM.clockDate.textContent = now.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  DOM.clockTime.textContent = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

/* ── Navigation ──────────────────────────────────────────────────── */
const sectionTitles = {
  dashboard:   "Dashboard",
  directory:   "Contact Directory",
};

function switchSection(key) {
  // update nav active state
  DOM.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === key);
  });

  // show/hide content panels
  document.querySelectorAll(".page-section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === `section-${key}`);
  });

  DOM.topbarTitle.textContent = sectionTitles[key] || "ConnectSphere Pro";

  // close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove("open");
  }
}

/* ── Stats fetcher ───────────────────────────────────────────────── */
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    // animate counts from 0
    animateCounter(DOM.svTotal,    data.total,          0);
    animateCounter(DOM.svVerified, data.verified_emails, 0);
    animateCounter(DOM.svToday,    data.today_entries,   0);

    DOM.svUpdated.classList.remove("shimmer-line");
    DOM.svUpdated.textContent = data.last_updated;

  } catch (e) {
    DOM.svTotal.textContent = "—";
    DOM.svVerified.textContent = "—";
    DOM.svToday.textContent = "—";
    DOM.svUpdated.textContent = "—";
  }
}

function animateCounter(el, target, start = 0) {
  el.classList.remove("shimmer-line");
  const duration  = 700;
  const step      = 16;
  const totalSteps = Math.ceil(duration / step);
  let   currentStep = 0;
  const increment = (target - start) / totalSteps;

  const run = () => {
    currentStep++;
    const current = Math.round(start + increment * currentStep);
    el.textContent = Math.min(current, target);
    if (currentStep < totalSteps) setTimeout(run, step);
    else el.textContent = target;
  };
  run();
}


/* ── Contacts loader ─────────────────────────────────────────────── */
function injectShimmerRows(count = 5) {
  DOM.contactsBody.innerHTML = Array.from({ length: count }, () => `
    <tr class="shimmer-row">
      ${Array.from({ length: 7 }, (_, i) => {
        const widths = [60, 100, 140, 90, 120, 90, 60];
        return `<td><div class="shimmer-cell" style="width:${widths[i]}px"></div></td>`;
      }).join("")}
    </tr>
  `).join("");
}

async function loadContacts() {
  injectShimmerRows(6);
  try {
    const res  = await fetch("/api/contacts");
    const data = await res.json();
    State.contacts = data;
    renderTable();
    renderRecentList();
  } catch (e) {
    DOM.contactsBody.innerHTML = `
      <tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">
        Failed to load contacts. Is the server running?
      </td></tr>
    `;
  }
}

/* ── Render helpers ──────────────────────────────────────────────── */
function getFilteredSorted() {
  let list = [...State.contacts];

  const q = State.filterText.toLowerCase().trim();
  if (q) {
    list = list.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email} ${c.phone}`.toLowerCase().includes(q)
    );
  }

  switch (State.sortMode) {
    case "oldest":  list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)); break;
    case "name-az": list.sort((a, b) => a.first_name.localeCompare(b.first_name)); break;
    case "name-za": list.sort((a, b) => b.first_name.localeCompare(a.first_name)); break;
    default:        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  return list;
}

function renderTable() {
  const list = getFilteredSorted();

  if (!list.length) {
    DOM.contactsBody.innerHTML = "";
    DOM.emptyState.style.display = "flex";
    return;
  }
  DOM.emptyState.style.display = "none";

  DOM.contactsBody.innerHTML = list.map((c, idx) => `
    <tr style="animation-delay:${idx * 0.04}s">
      <td class="td-id">${c.contact_id}</td>
      <td class="td-name">${escHtml(c.first_name)} ${escHtml(c.last_name)}</td>
      <td class="td-email" title="${escHtml(c.email)}">${escHtml(c.email)}</td>
      <td class="td-phone">${escHtml(c.phone)}</td>
      <td class="td-addr"  title="${escHtml(c.address)}">${escHtml(c.address)}</td>
      <td class="td-date">${c.created_at_fmt || "—"}</td>
      <td class="td-actions">
        <button class="action-btn action-btn-edit" data-id="${c.contact_id}" aria-label="Edit">
          ✎ Edit
          <span class="tooltip-hint">Edit contact</span>
        </button>
        <button class="action-btn action-btn-delete" data-id="${c.contact_id}" aria-label="Remove">
          Remove
          <span class="tooltip-hint">Remove contact</span>
        </button>
      </td>
    </tr>
  `).join("");
}

function renderRecentList() {
  const recent = [...State.contacts]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5);

  DOM.recentCount.textContent = State.contacts.length;

  if (!recent.length) {
    DOM.recentList.innerHTML = `<div class="empty-state-mini">No contacts yet.</div>`;
    return;
  }

  DOM.recentList.innerHTML = recent.map((c) => {
    const initials = `${c.first_name[0] || ""}${c.last_name[0] || ""}`.toUpperCase();
    return `
      <div class="recent-row">
        <div class="recent-avatar">${initials}</div>
        <div class="recent-info">
          <div class="recent-name">${escHtml(c.first_name)} ${escHtml(c.last_name)}</div>
          <div class="recent-email">${escHtml(c.email)}</div>
        </div>
        <span class="recent-id">${c.contact_id}</span>
      </div>
    `;
  }).join("");
}

/* ── Validation ──────────────────────────────────────────────────── */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

const fieldValidators = {
  first_name: (v) => v.trim() ? "" : "First name can't be empty.",
  last_name:  (v) => v.trim() ? "" : "Last name can't be empty.",
  email:      (v) => {
    if (!v.trim()) return "Email address is required.";
    return EMAIL_REGEX.test(v.trim()) ? "" : "That doesn't look like a valid email.";
  },
  phone: (v) => {
    const cleaned = v.trim().replace(/\s+/g, "");
    if (!cleaned) return "Phone number is required.";
    return PHONE_REGEX.test(cleaned) ? "" : "Enter a valid phone (7–15 digits, optional +).";
  },
  address: (v) => v.trim() ? "" : "Address can't be left empty.",
};

function showFieldError(fieldKey, message) {
  const errEl = $(`err-${fieldKey}`);
  if (!errEl) return;
  errEl.textContent = message;

  // highlight input
  const inputMap = {
    first_name: DOM.fFirstName,
    last_name:  DOM.fLastName,
    email:      DOM.fEmail,
    phone:      DOM.fPhone,
    address:    DOM.fAddress,
  };
  const input = inputMap[fieldKey];
  if (input) {
    input.classList.toggle("input-error", !!message);
    input.classList.toggle("input-ok",    !message && input.value.trim().length > 0);
  }
}

function clearFieldError(fieldKey) {
  showFieldError(fieldKey, "");
}

function validateAllFields() {
  const fields = [
    { key: "first_name", el: DOM.fFirstName },
    { key: "last_name",  el: DOM.fLastName  },
    { key: "email",      el: DOM.fEmail     },
    { key: "phone",      el: DOM.fPhone     },
    { key: "address",    el: DOM.fAddress   },
  ];

  let allOk = true;
  fields.forEach(({ key, el }) => {
    const err = fieldValidators[key](el.value);
    if (err) allOk = false;
    // don't show errors until the user has touched the field
  });
  DOM.modalSubmit.disabled = !allOk;
  return allOk;
}

/* live validation on each input */
function attachFormListeners() {
  const fieldMap = [
    { key: "first_name", el: DOM.fFirstName },
    { key: "last_name",  el: DOM.fLastName  },
    { key: "email",      el: DOM.fEmail     },
    { key: "phone",      el: DOM.fPhone     },
    { key: "address",    el: DOM.fAddress   },
  ];

  fieldMap.forEach(({ key, el }) => {
    el.addEventListener("input", () => {
      const err = fieldValidators[key](el.value);
      showFieldError(key, err);
      validateAllFields();
    });

    el.addEventListener("blur", () => {
      const err = fieldValidators[key](el.value);
      showFieldError(key, err);
    });
  });
}

/* ── Modal open / close ──────────────────────────────────────────── */
function openContactModal(contact = null) {
  clearAllErrors();
  DOM.contactForm.reset();
  DOM.editContactId.value = "";

  if (contact) {
    // populate for edit
    DOM.modalTitle.textContent    = "Edit Contact";
    DOM.editContactId.value       = contact.contact_id;
    DOM.fFirstName.value          = contact.first_name;
    DOM.fLastName.value           = contact.last_name;
    DOM.fEmail.value              = contact.email;
    DOM.fPhone.value              = contact.phone;
    DOM.fAddress.value            = contact.address;
    DOM.modalSubmit.textContent   = "Update Contact";
    validateAllFields();
  } else {
    DOM.modalTitle.textContent  = "Add Contact";
    DOM.modalSubmit.textContent = "Save Contact";
    DOM.modalSubmit.disabled    = true;
  }

  DOM.contactModal.classList.add("open");
  DOM.contactModal.setAttribute("aria-hidden", "false");
  setTimeout(() => DOM.fFirstName.focus(), 220);
}

function closeContactModal() {
  DOM.contactModal.classList.remove("open");
  DOM.contactModal.setAttribute("aria-hidden", "true");
}

function clearAllErrors() {
  ["first_name","last_name","email","phone","address"].forEach(clearFieldError);
  [DOM.fFirstName,DOM.fLastName,DOM.fEmail,DOM.fPhone,DOM.fAddress].forEach((el) => {
    el.classList.remove("input-error","input-ok");
  });
}

/* ── Contact form submit ─────────────────────────────────────────── */
DOM.contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateAllFields()) return;

  const isEdit    = !!DOM.editContactId.value;
  const contactId = DOM.editContactId.value;

  const payload = {
    first_name: DOM.fFirstName.value.trim(),
    last_name:  DOM.fLastName.value.trim(),
    email:      DOM.fEmail.value.trim().toLowerCase(),
    phone:      DOM.fPhone.value.trim().replace(/\s+/g, ""),
    address:    DOM.fAddress.value.trim(),
  };

  DOM.modalSubmit.disabled    = true;
  DOM.modalSubmit.textContent = isEdit ? "Updating…" : "Saving…";

  try {
    const url    = isEdit ? `/api/contacts/${contactId}` : "/api/contacts";
    const method = isEdit ? "PUT" : "POST";

    const res  = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.ok) {
      // server-side field errors
      if (data.errors) {
        Object.entries(data.errors).forEach(([key, msg]) => showFieldError(key, msg));
      } else {
        showToast(data.message || "Something went wrong.", "error");
      }
      DOM.modalSubmit.disabled    = false;
      DOM.modalSubmit.textContent = isEdit ? "Update Contact" : "Save Contact";
      return;
    }

    closeContactModal();
    showToast(
      isEdit ? `${payload.first_name}'s record updated.` : `${payload.first_name} added to directory.`,
      "success"
    );

    if (isEdit) {
      const idx = State.contacts.findIndex((c) => c.contact_id === contactId);
      if (idx !== -1) State.contacts[idx] = data.contact;
    } else {
      State.contacts.unshift(data.contact);
    }

    renderTable();
    renderRecentList();
    loadStats();

  } catch (err) {
    showToast("Network error — please try again.", "error");
    DOM.modalSubmit.disabled    = false;
    DOM.modalSubmit.textContent = isEdit ? "Update Contact" : "Save Contact";
  }
});

/* ── Delete flow ─────────────────────────────────────────────────── */
function openDeleteModal(contactId) {
  const contact = State.contacts.find((c) => c.contact_id === contactId);
  State.pendingDeleteId = contactId;

  const name = contact
    ? `${contact.first_name} ${contact.last_name} (${contactId})`
    : contactId;

  DOM.deleteContactName.textContent = `"${name}" will be permanently removed.`;
  DOM.deleteModal.classList.add("open");
  DOM.deleteModal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  DOM.deleteModal.classList.remove("open");
  DOM.deleteModal.setAttribute("aria-hidden", "true");
  State.pendingDeleteId = null;
}

DOM.deleteConfirmBtn.addEventListener("click", async () => {
  if (!State.pendingDeleteId) return;

  DOM.deleteConfirmBtn.textContent = "Deleting…";
  DOM.deleteConfirmBtn.disabled    = true;

  try {
    const res  = await fetch(`/api/contacts/${State.pendingDeleteId}`, { method: "DELETE" });
    const data = await res.json();

    if (!data.ok) {
      showToast(data.message || "Could not delete contact.", "error");
      return;
    }

    State.contacts = State.contacts.filter((c) => c.contact_id !== State.pendingDeleteId);
    showToast("Contact removed from directory.", "info");
    renderTable();
    renderRecentList();
    loadStats();

  } catch (err) {
    showToast("Delete failed — check connection.", "error");
  } finally {
    DOM.deleteConfirmBtn.textContent = "Yes, delete";
    DOM.deleteConfirmBtn.disabled    = false;
    closeDeleteModal();
  }
});

/* ── Table delegation for edit / delete buttons ──────────────────── */
DOM.contactsBody.addEventListener("click", (e) => {
  const editBtn   = e.target.closest(".action-btn-edit");
  const deleteBtn = e.target.closest(".action-btn-delete");

  if (editBtn) {
    const contact = State.contacts.find((c) => c.contact_id === editBtn.dataset.id);
    if (contact) openContactModal(contact);
  }

  if (deleteBtn) {
    openDeleteModal(deleteBtn.dataset.id);
  }
});

/* ── Search & sort ───────────────────────────────────────────────── */
DOM.searchInput.addEventListener("input", () => {
  State.filterText = DOM.searchInput.value;
  DOM.clearSearch.style.display = State.filterText ? "block" : "none";
  renderTable();
});

DOM.clearSearch.addEventListener("click", () => {
  DOM.searchInput.value = "";
  State.filterText = "";
  DOM.clearSearch.style.display = "none";
  renderTable();
});

DOM.sortSelect.addEventListener("change", () => {
  State.sortMode = DOM.sortSelect.value;
  renderTable();
});

/* ── Sidebar nav ─────────────────────────────────────────────────── */
DOM.navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    if (section === "new-contact") {
      openContactModal();
      return;
    }
    switchSection(section);
  });
});

DOM.menuToggle.addEventListener("click", () => {
  DOM.sidebar.classList.toggle("open");
});

// close sidebar when clicking outside on mobile
document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 768 &&
    DOM.sidebar.classList.contains("open") &&
    !DOM.sidebar.contains(e.target) &&
    !DOM.menuToggle.contains(e.target)
  ) {
    DOM.sidebar.classList.remove("open");
  }
});

/* ── Quick action buttons ─────────────────────────────────────────── */
$("quickAddBtn").addEventListener("click", () => openContactModal());
$("quickDirBtn").addEventListener("click", () => switchSection("directory"));
$("dirAddBtn").addEventListener("click",   () => openContactModal());
$("emptyAddBtn").addEventListener("click", () => openContactModal());

/* ── Modal close triggers ────────────────────────────────────────── */
DOM.modalClose.addEventListener("click",  closeContactModal);
DOM.modalCancel.addEventListener("click", closeContactModal);
DOM.deleteCancelBtn.addEventListener("click", closeDeleteModal);

// close on overlay click
DOM.contactModal.addEventListener("click", (e) => {
  if (e.target === DOM.contactModal) closeContactModal();
});
DOM.deleteModal.addEventListener("click", (e) => {
  if (e.target === DOM.deleteModal) closeDeleteModal();
});

// close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeContactModal();
    closeDeleteModal();
  }
});

/* ── Toast ───────────────────────────────────────────────────────── */
function showToast(message, type = "info") {
  const dot   = document.createElement("div");
  dot.className = `toast-dot toast-dot-${type}`;

  const msg = document.createElement("span");
  msg.className   = "toast-msg";
  msg.textContent = message;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.append(dot, msg);
  DOM.toastShelf.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  setTimeout(dismiss, 3800);
  toast.addEventListener("click", dismiss);
}

/* ── Utility ─────────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ── Bootstrap on DOM ready ──────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  tickClock();
  setInterval(tickClock, 1000);

  attachFormListeners();
  loadContacts();
  loadStats();
});
