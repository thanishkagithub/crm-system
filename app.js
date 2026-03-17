// ─── Session & Auth ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'crmm_session';
const CRM_DATA_KEY = 'crmm_data';

function getSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.replace('login.html');
}

// Load current user from session
const _session = getSession();
const _currentUser = _session
  ? { role: _session.role || 'user', username: _session.username, name: _session.name }
  : { role: 'user', username: 'guest', name: 'Guest' };

// ─── Simple in-memory data model ───────────────────────────────────────────────
const state = {
  resources: [],
  projects: [],
  tasks: [],
  assignments: [],
  shares: [],
  activity: [],
  customers: [],
  estimates: [],
  salesOrders: [],
  deliveryChallans: [],
  invoices: [],
  payments: [],
  recurringInvoices: [],
  creditNotes: [],
  // Accounts module
  vendors: [],
  expenses: [],
  bills: [],
  purchaseOrders: [],
  accountsDocuments: [],
  // Templates
  estimateTemplates: [],
  // New Modules
  marketingCampaigns: [],
  employees: [],
  serviceTickets: [],
  // User (role-based access)
  currentUser: _currentUser
};

let idCounter = 1;
const nextId = () => String(idCounter++);

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api'; // Proxied via netlify.toml in production


// API Helper
async function apiRequest(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const { headers, ...otherOptions } = options;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...otherOptions
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `API Error: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    // specific check for 204 No Content
    if (response.status === 204) return null;

    return await response.json();
  } catch (error) {
    console.error(`API Request Failed (${endpoint}):`, error.message);
    // Don't alert for network errors (API down) so offline mode can kick in gracefully
    if (error.message !== 'Failed to fetch' && !error.message.includes('NetworkError')) {
      alert(`API Error: ${error.message}`);
    }
    throw error;
  }
}

// Data Loading
async function loadDataFromAPI() {
  try {
    console.log('🔄 Loading data from API...');

    // Parallel fetching for performance
    const [
      resources,
      projects,
      tasks,
      assignments,
      // Sales
      customers, estimates, orders, challans, invoices, payments, recurring, creditNotes,
      // Accounts
      vendors, expenses, bills, purchaseOrders, docs,
      // Templates
      templates
    ] = await Promise.all([
      apiRequest('/resources'),
      apiRequest('/projects'),
      apiRequest('/tasks'),
      apiRequest('/assignments'),
      // Sales
      apiRequest('/sales/customers'),
      apiRequest('/sales/estimates'),
      apiRequest('/sales/orders'),
      apiRequest('/sales/challans'),
      apiRequest('/sales/invoices'),
      apiRequest('/sales/payments'),
      apiRequest('/sales/recurring'),
      apiRequest('/sales/credit-notes'),
      // Accounts
      apiRequest('/accounts/vendors'),
      apiRequest('/accounts/expenses'),
      apiRequest('/accounts/bills'),
      apiRequest('/accounts/purchase-orders'),
      apiRequest('/accounts/documents'),
      // Templates
      apiRequest('/templates')
    ]);

    // Update State with Normalization (DB snake_case -> Frontend camelCase)
    state.resources = (resources || []).map(r => ({ ...r })); // Resources keys match mostly? name, role... Check db.sql: name, role, department, email. Matches.

    state.projects = (projects || []).map(p => ({
      ...p,
      startDate: p.start_date,
      endDate: p.end_date,
      projectOwnerId: p.project_owner_id
    }));

    state.tasks = (tasks || []).map(t => ({
      ...t,
      projectId: t.project_id,
      startDate: t.start_date,
      dueDate: t.due_date,
      taskOwnerId: t.task_owner_id
    }));

    state.assignments = (assignments || []).map(a => ({
      ...a,
      projectId: a.project_id,
      taskId: a.task_id,
      resourceId: a.resource_id,
      dueDate: a.due_date,
      completedAt: a.completed_at
    }));

    // Sales
    state.customers = (customers || []).map(c => ({
      ...c,
      name: c.customer_name,
      company: c.company_name
    }));

    state.estimates = (estimates || []).map(e => ({
      ...e,
      customerId: e.customer_id,
      estimateNumber: e.estimate_number,
      estimateDate: e.estimate_date,
      expiryDate: e.expiry_date,
      customerNotes: e.notes
    }));

    state.salesOrders = (orders || []).map(o => ({
      ...o,
      customerId: o.customer_id,
      orderNumber: o.order_number,
      orderDate: o.order_date,
      deliveryDate: o.delivery_date
    }));

    state.deliveryChallans = (challans || []).map(dc => ({
      ...dc,
      customerId: dc.customer_id,
      challanNumber: dc.challan_number,
      challanDate: dc.challan_date,
      orderReference: dc.order_reference
    }));

    state.invoices = (invoices || []).map(i => ({
      ...i,
      customerId: i.customer_id,
      invoiceNumber: i.invoice_number,
      invoiceDate: i.invoice_date,
      dueDate: i.due_date
    }));

    state.payments = (payments || []).map(p => ({
      ...p,
      customerId: p.customer_id,
      invoiceId: p.invoice_id,
      paymentNumber: p.payment_number,
      paymentDate: p.payment_date,
      paymentMode: p.payment_mode
    }));

    state.recurringInvoices = (recurring || []).map(r => ({
      ...r,
      customerId: r.customer_id,
      profileName: r.profile_name,
      startDate: r.start_date,
      endDate: r.end_date,
      isActive: r.is_active
    }));

    state.creditNotes = (creditNotes || []).map(cn => ({
      ...cn,
      customerId: cn.customer_id,
      invoiceId: cn.invoice_id,
      creditNoteNumber: cn.credit_note_number,
      creditNoteDate: cn.credit_note_date
    }));

    // Accounts
    state.vendors = (vendors || []).map(v => ({
      ...v,
      name: v.vendor_name,
      company: v.company_name,
      paymentTerms: v.payment_terms,
      taxId: v.tax_id,
      totalPayable: v.total_payable ? parseFloat(v.total_payable) : 0
    }));

    state.expenses = (expenses || []).map(e => ({
      ...e,
      expenseDate: e.expense_date,
      vendorId: e.vendor_id,
      paymentMethod: e.payment_mode,
      reference: e.reference_number
    }));

    state.bills = (bills || []).map(b => ({
      ...b,
      vendorId: b.vendor_id,
      billNumber: b.bill_number,
      billDate: b.bill_date,
      dueDate: b.due_date
    }));

    state.purchaseOrders = (purchaseOrders || []).map(po => ({
      ...po,
      vendorId: po.vendor_id,
      poNumber: po.po_number,
      orderDate: po.order_date,
      deliveryDate: po.delivery_date
    }));

    state.accountsDocuments = docs || [];

    // Templates
    state.estimateTemplates = (templates || []).map(t => ({
      ...t,
      templateName: t.template_name,
      baseDuration: t.base_duration,
      baseRate: t.base_rate,
      isActive: t.is_active,
      createdBy: t.created_by
    }));

    console.log('✅ Data loaded successfully from API:', {
      customers: state.customers.length,
      templates: state.estimateTemplates.length
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to load data from API:', error);
    return false;
  }
}

// Deprecated LocalStorage functions (kept empty to prevent breakage of existing calls before full refactor)
function saveToLocalStorage() {
  // Persist CRM data to localStorage for offline use
  if (typeof window._crmmAutoSave === 'function') window._crmmAutoSave();
}

function loadFromLocalStorage() {
  return false; // Force API load; offline cache handled by loadFromLocalStorageCache()
}

// Chart instances
let statusChart;
let departmentChart;


// Utils
function addActivity(message, meta) {
  const entry = {
    id: nextId(),
    message,
    meta,
    timestamp: new Date(),
  };
  state.activity.unshift(entry);
  renderActivity();
  saveToLocalStorage(); // auto-persists to localStorage for offline
}

// Video Template Task Definitions
function getVideoTemplateTasks() {
  return [
    // Pre-Production Phase
    { phase: "Pre-Production", title: "Client Inputs", order: 1, estimate: 4, description: "Gather and document all client requirements, expectations, and deliverables." },
    { phase: "Pre-Production", title: "Project Analysis", order: 2, estimate: 6, description: "Analyze project scope, resources needed, and potential challenges." },
    { phase: "Pre-Production", title: "Project Planning", order: 3, estimate: 8, description: "Create detailed project plan with milestones and resource allocation." },
    { phase: "Pre-Production", title: "Project Schedule", order: 4, estimate: 4, description: "Develop comprehensive timeline with deadlines for all phases." },
    { phase: "Pre-Production", title: "Script", order: 5, estimate: 12, description: "Write and finalize video script with dialogue, narration, and scene descriptions." },
    { phase: "Pre-Production", title: "Storyboard", order: 6, estimate: 16, description: "Create visual storyboard showing key scenes, shots, and transitions." },

    // Production Phase
    { phase: "Production", title: "Voiceover", order: 7, estimate: 8, description: "Record professional voiceover narration for the video." },
    { phase: "Production", title: "Editing", order: 8, estimate: 24, description: "Edit video footage, add transitions, effects, and synchronize audio." },
    { phase: "Production", title: "Text Synchronization", order: 9, estimate: 6, description: "Sync on-screen text, captions, and graphics with video timeline." },
    { phase: "Production", title: "Output", order: 10, estimate: 4, description: "Generate initial video output for review." },

    // Post-Production Phase
    { phase: "Post-Production", title: "Final Video", order: 11, estimate: 8, description: "Create final video version with all refinements." },
    { phase: "Post-Production", title: "Output", order: 12, estimate: 4, description: "Export final video in required format." },
    { phase: "Post-Production", title: "Compressed", order: 13, estimate: 2, description: "Create compressed version for web/streaming delivery." },
    { phase: "Post-Production", title: "Final Output", order: 14, estimate: 2, description: "Prepare final deliverables package." },
    { phase: "Post-Production", title: "Feedback", order: 15, estimate: 4, description: "Collect internal team feedback and review." },
    { phase: "Post-Production", title: "Client Feedback", order: 16, estimate: 6, description: "Present to client and gather feedback for final adjustments." },
    { phase: "Post-Production", title: "Final Video", order: 17, estimate: 4, description: "Deliver approved final video to client." },
  ];
}

// Create tasks from template
async function createTasksFromTemplate(projectId, templateName, startDate, endDate) {
  console.log("=== createTasksFromTemplate CALLED ===");
  console.log("Parameters:", { projectId, templateName, startDate, endDate });

  if (templateName !== "video") {
    console.log("Template name doesn't match 'video':", templateName);
    return 0;
  }

  if (!startDate || !endDate) {
    console.error("Missing dates for template creation:", { startDate, endDate });
    return 0;
  }

  const templateTasks = getVideoTemplateTasks();
  console.log("Template tasks loaded:", templateTasks.length);

  // Parse dates - handle both YYYY-MM-DD format and Date objects
  const start = startDate instanceof Date ? startDate : new Date(startDate + "T00:00:00");
  const end = endDate instanceof Date ? endDate : new Date(endDate + "T23:59:59");

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error("Invalid dates:", startDate, endDate);
    return 0;
  }

  const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

  // Phase distribution: Pre-Production (35%), Production (40%), Post-Production (25%)
  const phaseDistribution = {
    "Pre-Production": { startPercent: 0, endPercent: 0.35, taskCount: 6 },
    "Production": { startPercent: 0.35, endPercent: 0.75, taskCount: 4 },
    "Post-Production": { startPercent: 0.75, endPercent: 1.0, taskCount: 7 }
  };

  let createdCount = 0;

  for (const templateTask of templateTasks) {
    const phaseInfo = phaseDistribution[templateTask.phase];
    const phaseStartDays = Math.floor(totalDays * phaseInfo.startPercent);
    const phaseEndDays = Math.floor(totalDays * phaseInfo.endPercent);
    const phaseDuration = phaseEndDays - phaseStartDays;

    // Calculate task position within phase (0 to 1)
    // Find first task in this phase
    const phaseFirstOrder = templateTasks.find(t => t.phase === templateTask.phase)?.order || 1;
    const phaseOrder = templateTask.order - phaseFirstOrder;
    const taskPositionInPhase = phaseInfo.taskCount > 1 ? phaseOrder / (phaseInfo.taskCount - 1) : 0;

    // Calculate task dates
    const daysFromStart = phaseStartDays + Math.floor(phaseDuration * taskPositionInPhase);
    const taskStartDate = new Date(start);
    taskStartDate.setDate(start.getDate() + daysFromStart);

    // Task duration based on estimate (1 hour estimate = 0.5 days, minimum 1 day)
    const taskDuration = Math.max(1, Math.ceil((templateTask.estimate || 8) / 16));
    const taskDueDate = new Date(taskStartDate);
    taskDueDate.setDate(taskStartDate.getDate() + taskDuration);

    // Ensure dates don't exceed project boundaries
    if (taskStartDate < start) taskStartDate.setTime(start.getTime());
    if (taskDueDate > end) taskDueDate.setTime(end.getTime());
    if (taskStartDate >= taskDueDate) {
      taskDueDate.setTime(taskStartDate.getTime() + (24 * 60 * 60 * 1000)); // Add 1 day minimum
    }

    const taskData = {
      projectId: projectId,
      title: templateTask.title,
      description: templateTask.description || "",
      estimate: templateTask.estimate || "",
      priority: "none",
      taskOwnerId: "",
      startDate: taskStartDate.toISOString().slice(0, 10),
      dueDate: taskDueDate.toISOString().slice(0, 10),
      time: "",
      notifyUsers: [],
      phase: templateTask.phase,
      order: templateTask.order,
    };

    try {
      const savedTask = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });

      if (savedTask) {
        state.tasks.push(savedTask);
        createdCount++;
        console.log(`Task ${templateTask.order} created: ${templateTask.title} (ID: ${savedTask.id})`);
      }
    } catch (err) {
      console.error(`Failed to create template task ${templateTask.title}:`, err);
    }
  }

  console.log("=== ALL TASKS CREATED ===");
  console.log("Total tasks created:", createdCount);

  // Refresh all views
  renderTasks();
  renderDepartmentStats();
  renderAdminDashboard();
  addActivity(`Created ${createdCount} tasks from Video template`, "Template");

  return createdCount;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

function calculateOnTimePercentage(items) {
  if (!items.length) return 0;
  const completed = items.filter((a) => a.status === "completed");
  if (!completed.length) return 0;
  const now = new Date();
  const onTime = completed.filter((a) => {
    if (!a.dueDate) return true;
    const due = new Date(a.dueDate);
    return a.completedAt && new Date(a.completedAt) <= due && new Date(a.completedAt) <= now;
  });
  return Math.round((onTime.length / completed.length) * 100);
}

// Navigation
function setupMainNavigation() {
  const navButtons = document.querySelectorAll(".nav-item");
  const views = document.querySelectorAll(".view");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;

      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      views.forEach((v) => v.classList.remove("view-active"));
      const viewEl = document.getElementById(`view-${target}`);
      if (viewEl) viewEl.classList.add("view-active");
    });
  });
}

function setupOperationsSubnav() {
  const subnavButtons = document.querySelectorAll(".subnav-item");
  const subviews = document.querySelectorAll(".subview");

  subnavButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.subview;

      subnavButtons.forEach((b) => b.classList.remove("subnav-active"));
      btn.classList.add("subnav-active");

      subviews.forEach((v) => v.classList.remove("subview-active"));
      const viewEl = document.getElementById(target);
      if (viewEl) viewEl.classList.add("subview-active");
    });
  });
}

// Sales sub navigation
function setupSalesSubnav() {
  const salesSubnav = document.querySelector(".sales-subnav");
  if (!salesSubnav) return;

  const buttons = salesSubnav.querySelectorAll(".subnav-item");
  const views = document.querySelectorAll(".sales-subview");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.salesSubview;

      buttons.forEach((b) => b.classList.remove("subnav-active"));
      btn.classList.add("subnav-active");

      views.forEach((v) => v.classList.remove("sales-subview-active"));
      const viewEl = document.getElementById(target);
      if (viewEl) viewEl.classList.add("sales-subview-active");
    });
  });
}

// Rendering
function renderResources() {
  const tbody = document.querySelector("#table-resources tbody");
  const selectAssignResource = document.getElementById(
    "select-assign-resource"
  );
  const selectIndividualResource = document.getElementById(
    "select-individual-resource"
  );

  tbody.innerHTML = "";
  selectAssignResource.innerHTML =
    '<option value="">Select individual</option>';
  selectIndividualResource.innerHTML =
    '<option value="">Select individual</option>';

  state.resources.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.role}</td>
      <td>${r.department}</td>
      <td>${r.email}</td>
      <td>
        <button class="table-button" data-view-resource="${r.id}">View</button>
        <button class="table-button table-button--danger" data-delete-resource="${r.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);

    const opt1 = document.createElement("option");
    opt1.value = r.id;
    opt1.textContent = `${r.name} (${r.role})`;
    selectAssignResource.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = r.id;
    opt2.textContent = `${r.name} (${r.department})`;
    selectIndividualResource.appendChild(opt2);
  });

  document.getElementById("kpi-resources").textContent =
    state.resources.length;
}

function renderProjects() {
  const tbody = document.querySelector("#table-projects tbody");
  const selectTaskProject = document.getElementById("select-task-project");
  const selectAssignProject = document.getElementById("select-assign-project");
  const selectProjectOwner = document.getElementById("select-project-owner");

  tbody.innerHTML = "";
  selectTaskProject.innerHTML = '<option value="">Select project</option>';
  selectAssignProject.innerHTML = '<option value="">Select project</option>';

  // Populate owner dropdown
  if (selectProjectOwner) {
    selectProjectOwner.innerHTML = '<option value="">Select owner</option>';
    state.resources.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.role})`;
      selectProjectOwner.appendChild(opt);
    });
  }

  state.projects.forEach((p) => {
    const tr = document.createElement("tr");
    const duration = `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`;
    const priorityBadge = p.priority && p.priority !== "none"
      ? `<span class="status-pill status-pill--${p.priority}">${p.priority.toUpperCase()}</span>`
      : "-";
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.type || "-"}</td>
      <td>${p.department}</td>
      <td>${priorityBadge}</td>
      <td>${duration}</td>
      <td>
        <button class="table-action-btn table-action-btn--view" data-view-project="${p.id}" title="View">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3C4.5 3 1.73 5.11 0 8c1.73 2.89 4.5 5 8 5s6.27-2.11 8-5c-1.73-2.89-4.5-5-8-5zM8 11.5c-1.93 0-3.5-1.57-3.5-3.5S6.07 4.5 8 4.5s3.5 1.57 3.5 3.5S9.93 11.5 8 11.5zM8 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor"/>
          </svg>
        </button>
        <button class="table-action-btn table-action-btn--delete" data-delete-project="${p.id}" title="Delete">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4v9.33c0 .74-.6 1.34-1.33 1.34H5.33C4.6 14.67 4 14.07 4 13.33V4m1.33 0h5.34M6 4V2.67C6 1.93 6.6 1.33 7.33 1.33h1.34c.73 0 1.33.6 1.33 1.34V4M2 4h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    const opt1 = document.createElement("option");
    opt1.value = p.id;
    opt1.textContent = p.name;
    selectTaskProject.appendChild(opt1);

    const opt2 = opt1.cloneNode(true);
    selectAssignProject.appendChild(opt2);
  });

  document.getElementById("kpi-total-projects").textContent =
    state.projects.length;
  document.getElementById("admin-total-projects").textContent =
    state.projects.length;
}

function renderTasks() {
  const tbody = document.querySelector("#table-tasks tbody");
  const selectAssignTask = document.getElementById("select-assign-task");
  const selectTaskOwner = document.getElementById("select-task-owner");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (selectAssignTask) {
    selectAssignTask.innerHTML = '<option value="">Select task</option>';
  }

  if (selectTaskOwner) {
    selectTaskOwner.innerHTML = '<option value="">Select owner</option>';
    state.resources.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.role})`;
      selectTaskOwner.appendChild(opt);
    });
  }

  state.tasks.forEach((t) => {
    const project = state.projects.find((p) => p.id === t.projectId);
    const assignment = state.assignments.find((a) => a.taskId == t.id);
    const resource = assignment ? state.resources.find((r) => r.id == assignment.resourceId) : null;
    const taskOwner = t.taskOwnerId ? state.resources.find((r) => r.id == t.taskOwnerId) : null;

    const assignedTo = resource ? resource.name : (taskOwner ? taskOwner.name : "-");

    const priorityBadge = t.priority && t.priority !== "none"
      ? `<span class="status-pill status-pill--${t.priority}">${t.priority.toUpperCase()}</span>`
      : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${project ? project.name : "-"}</td>
      <td>${t.title}</td>
      <td>${priorityBadge || "-"}</td>
      <td><span class="status-pill status-pill--pending">Pending</span></td>
      <td>${assignedTo}</td>
      <td>${t.estimate || "-"}</td>
      <td>
        <button class="table-button" data-view-task="${t.id}">View</button>
        <button class="table-button table-button--danger" data-delete-task="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);

    if (selectAssignTask) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${project ? project.name + " - " : ""}${t.title}`;
      selectAssignTask.appendChild(opt);
    }
  });
}

function renderAssignments() {
  const tbody = document.querySelector("#table-assignments tbody");
  const selectShareAssignment = document.getElementById(
    "select-share-assignment"
  );

  if (tbody) {
    tbody.innerHTML = "";
  }
  if (selectShareAssignment) {
    selectShareAssignment.innerHTML = '<option value="">Select assignment</option>';
  }

  state.assignments.forEach((a) => {
    const project = state.projects.find((p) => p.id === a.projectId);
    const task = state.tasks.find((t) => t.id === a.taskId);
    const resource = state.resources.find((r) => r.id === a.resourceId);
    const statusClass =
      a.status === "completed"
        ? "status-pill--completed"
        : "status-pill--inprogress";

    if (tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${project ? project.name : "-"}</td>
        <td>${task ? task.title : "-"}</td>
        <td>${resource ? resource.name : "-"}</td>
        <td>${formatDate(a.dueDate)}</td>
        <td><span class="status-pill ${statusClass}">${a.status === "completed" ? "Completed" : "In Progress"
        }</span></td>
        <td>
          <button class="table-button" data-view-assignment="${a.id}">View</button>
          <button class="table-button table-button--danger" data-delete-assignment="${a.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${resource ? resource.name : "Unknown"} - ${task ? task.title : "Task"
      }`;
    selectShareAssignment.appendChild(opt);
  });
}

function renderShares() {
  const list = document.getElementById("share-log");
  list.innerHTML = "";
  state.shares
    .slice()
    .reverse()
    .forEach((s) => {
      const resource = state.resources.find((r) => r.id === s.resourceId);
      const task = state.tasks.find((t) => t.id === s.taskId);
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="activity-main">
          Shared <strong>${task ? task.title : "task"}</strong> with
          <strong>${resource ? resource.name : "resource"}</strong>
        </div>
        <div class="activity-meta">
          ${formatDate(s.sharedAt)} · ${resource ? resource.email : "no-email"
        }
        </div>
      `;
      list.appendChild(li);
    });
}

function renderActivity() {
  const list = document.getElementById("activity-log");
  list.innerHTML = "";
  state.activity.slice(0, 8).forEach((a) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="activity-main">${a.message}</div>
      <div class="activity-meta">${a.meta}</div>
    `;
    list.appendChild(li);
  });
}

function renderDepartmentStats() {
  const tbody = document.querySelector("#table-departments tbody");
  tbody.innerHTML = "";
  const departments = [
    "Marketing",
    "Sales",
    "Accounts",
    "Operations",
    "Human Resources",
    "Client Service",
  ];

  departments.forEach((dep) => {
    const depProjects = state.projects.filter((p) => p.department === dep);
    const depTasks = state.tasks.filter((t) =>
      depProjects.some((p) => p.id === t.projectId)
    );
    const depAssignments = state.assignments.filter((a) =>
      depTasks.some((t) => t.id === a.taskId)
    );
    const openTasks = depAssignments.filter((a) => a.status !== "completed")
      .length;
    const completedTasks = depAssignments.filter(
      (a) => a.status === "completed"
    ).length;
    const onTime = calculateOnTimePercentage(depAssignments);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dep}</td>
      <td>${openTasks}</td>
      <td>${completedTasks}</td>
      <td>${onTime}%</td>
    `;
    tbody.appendChild(tr);
  });

  renderCharts();
  renderDepartmentViews();
}

function getDepartmentProjectSummary(department) {
  const result = [];
  const depProjects = state.projects.filter((p) => p.department === department);
  depProjects.forEach((p) => {
    const projectTasks = state.tasks.filter((t) => t.projectId === p.id);
    const projectAssignments = state.assignments.filter(
      (a) => a.projectId === p.id
    );
    const open = projectAssignments.filter((a) => a.status !== "completed")
      .length;
    const completed = projectAssignments.filter(
      (a) => a.status === "completed"
    ).length;
    result.push({
      name: p.name,
      type: p.type,
      totalTasks: projectTasks.length,
      open,
      completed,
    });
  });
  return result;
}

function renderDepartmentViews() {
  const marketingBody = document.getElementById("marketing-body");
  const salesBody = document.getElementById("sales-body");
  const accountsBody = document.getElementById("accounts-body");
  const hrBody = document.getElementById("hr-body");
  const serviceBody = document.getElementById("service-body");

  if (marketingBody) {
    marketingBody.innerHTML = "";
    getDepartmentProjectSummary("Marketing").forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.name}</td>
        <td>${row.type}</td>
        <td>${row.totalTasks}</td>
        <td>${row.open}</td>
        <td>${row.completed}</td>
      `;
      marketingBody.appendChild(tr);
    });
  }

  if (salesBody) {
    salesBody.innerHTML = "";
    getDepartmentProjectSummary("Sales").forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.name}</td>
        <td>${row.type}</td>
        <td>${row.totalTasks}</td>
        <td>${row.open}</td>
        <td>${row.completed}</td>
      `;
      salesBody.appendChild(tr);
    });
  }

  if (accountsBody) {
    accountsBody.innerHTML = "";
    getDepartmentProjectSummary("Accounts").forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.name}</td>
        <td>${row.type}</td>
        <td>${row.totalTasks}</td>
        <td>${row.open}</td>
        <td>${row.completed}</td>
      `;
      accountsBody.appendChild(tr);
    });
  }

  if (hrBody) {
    hrBody.innerHTML = "";
    const totalEmployees = state.resources.length;
    const hrEmployees = state.resources.filter(
      (r) => r.department === "Human Resources"
    ).length;
    const totalAssignments = state.assignments.length;
    const completedAssignments = state.assignments.filter(
      (a) => a.status === "completed"
    ).length;

    const rows = [
      ["Total Employees", totalEmployees],
      ["HR Department Employees", hrEmployees],
      ["Assignments (All Departments)", totalAssignments],
      ["Completed Assignments", completedAssignments],
    ];

    rows.forEach(([metric, value]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${metric}</td>
        <td>${value}</td>
      `;
      hrBody.appendChild(tr);
    });
  }

  if (serviceBody) {
    serviceBody.innerHTML = "";
    getDepartmentProjectSummary("Client Service").forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.name}</td>
        <td>${row.totalTasks}</td>
        <td>${row.open}</td>
        <td>${row.completed}</td>
      `;
      serviceBody.appendChild(tr);
    });
  }
}

function renderAdminDashboard() {
  const totalProj = state.projects.length;
  const totalTasks = state.tasks.length;
  const completed = state.assignments.filter((a) => a.status === "completed").length;
  const onTime = calculateOnTimePercentage(state.assignments);

  // Operations Dashboard
  setIfDefined("admin-total-projects", totalProj);
  setIfDefined("admin-total-tasks", totalTasks);
  setIfDefined("admin-completed-tasks", completed);
  setIfDefined("admin-on-time", `${onTime}%`);

  // Global Dashboard
  setIfDefined("kpi-total-projects", totalProj);
  setIfDefined("kpi-active-tasks", state.tasks.length);
  setIfDefined("kpi-resources", state.resources.length);
  setIfDefined("kpi-on-time", `${onTime}%`);

  // Cross-Module KPIs for Dashboard
  const activeCampaigns = state.marketingCampaigns.filter(c => c.status === "Active").length;
  const openTickets = state.serviceTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
  const totalEmployees = state.employees.length;

  setIfDefined("admin-active-campaigns", activeCampaigns);
  setIfDefined("admin-open-tickets", openTickets);
  setIfDefined("admin-total-employees", totalEmployees);

  // Render project table in admin dashboard
  const tbody = document.querySelector("#table-admin-projects tbody");
  if (tbody) {
    tbody.innerHTML = "";
    state.projects.forEach((p) => {
      const pTasks = state.tasks.filter((t) => t.projectId === p.id);
      const pAssignments = state.assignments.filter((a) => pTasks.some((t) => t.id === a.taskId));
      const pCompleted = pAssignments.filter((a) => a.status === "completed").length;
      const pOnTime = calculateOnTimePercentage(pAssignments);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td>${p.department}</td>
        <td>${pTasks.length}</td>
        <td>${pCompleted}</td>
        <td>${pOnTime}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Render team overview table
  const teamBody = document.querySelector("#table-admin-team tbody");
  if (teamBody) {
    teamBody.innerHTML = "";
    state.resources.forEach((r) => {
      const rAssignments = state.assignments.filter((a) => a.resourceId == r.id);
      const rCompleted = rAssignments.filter((a) => a.status === "completed").length;
      const rOnTime = calculateOnTimePercentage(rAssignments);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${r.name}</strong></td>
        <td>${r.role}</td>
        <td>${r.department}</td>
        <td>${rAssignments.length}</td>
        <td>${rCompleted}</td>
        <td>${rOnTime}%</td>
      `;
      teamBody.appendChild(tr);
    });
  }
}

function setIfDefined(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function renderGlobalKPIs() {
  const activeTasks = state.assignments.filter(
    (a) => a.status !== "completed"
  ).length;
  const onTime = calculateOnTimePercentage(state.assignments);
  document.getElementById("kpi-active-tasks").textContent = activeTasks;
  document.getElementById("kpi-on-time").textContent = `${onTime}%`;
}

// Sales – Customers & Estimates
function renderSalesCustomers() {
  const table = document.querySelector("#table-sales-customers tbody");
  const selectEstimateCustomer = document.getElementById("select-estimate-customer");
  const selectOrderCustomer = document.getElementById("select-order-customer");
  const selectChallanCustomer = document.getElementById("select-challan-customer");
  const selectInvoiceCustomer = document.getElementById("select-invoice-customer");
  const selectPaymentCustomer = document.getElementById("select-payment-customer");
  const selectRecurringCustomer = document.getElementById("select-recurring-customer");
  const selectCreditNoteCustomer = document.getElementById("select-credit-note-customer");

  if (!table) return;
  table.innerHTML = "";

  if (selectEstimateCustomer) selectEstimateCustomer.innerHTML = '<option value="">Select customer</option>';
  if (selectOrderCustomer) selectOrderCustomer.innerHTML = '<option value="">Select customer</option>';
  if (selectChallanCustomer) selectChallanCustomer.innerHTML = '<option value="">Select customer</option>';
  if (selectInvoiceCustomer) selectInvoiceCustomer.innerHTML = '<option value="">Select customer</option>';
  if (selectPaymentCustomer) selectPaymentCustomer.innerHTML = '<option value="">Select customer</option>';
  if (selectRecurringCustomer) selectRecurringCustomer.innerHTML = '<option value="">Select customer</option>';
  if (selectCreditNoteCustomer) selectCreditNoteCustomer.innerHTML = '<option value="">Select customer</option>';

  state.customers.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.company || "-"}</td>
      <td>${c.email || "-"}</td>
      <td>${c.phone || "-"}</td>
      <td>${c.billing_address || c.billingAddress || "-"}</td>
      <td>${c.gst_number || c.gstNumber || "-"}</td>
      <td>₹${(c.receivables || 0).toFixed(2)}</td>
      <td>₹${(c.credits || 0).toFixed(2)}</td>
    `;
    table.appendChild(tr);

    // Populate all customer dropdowns
    if (selectEstimateCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectEstimateCustomer.appendChild(opt);
    }
    if (selectOrderCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectOrderCustomer.appendChild(opt);
    }
    if (selectChallanCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectChallanCustomer.appendChild(opt);
    }
    if (selectInvoiceCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectInvoiceCustomer.appendChild(opt);
    }
    if (selectPaymentCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectPaymentCustomer.appendChild(opt);
    }
    if (selectRecurringCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectRecurringCustomer.appendChild(opt);
    }
    if (selectCreditNoteCustomer) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selectCreditNoteCustomer.appendChild(opt);
    }
  });
}

function renderSalesEstimates() {
  const table = document.querySelector("#table-sales-estimates tbody");
  if (!table) return;

  table.innerHTML = "";
  state.estimates.forEach((e) => {
    const customer = state.customers.find((c) => c.id === e.customerId);
    const statusLabel = e.status || "Draft";
    const amount = e.amount || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(e.estimateDate)}</td>
      <td>${e.estimateNumber || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td>${statusLabel}</td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Sales - Sales Orders
function renderSalesOrders() {
  const table = document.querySelector("#table-sales-orders tbody");
  if (!table) return;

  table.innerHTML = "";
  state.salesOrders.forEach((order) => {
    const customer = state.customers.find((c) => c.id === order.customerId);
    const statusLabel = order.status || "Draft";
    const amount = order.amount || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(order.orderDate)}</td>
      <td>${order.orderNumber || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td><span class="status-pill status-pill--pending">${statusLabel}</span></td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Sales - Delivery Challans
function renderDeliveryChallans() {
  const table = document.querySelector("#table-delivery-challans tbody");
  if (!table) return;

  table.innerHTML = "";
  state.deliveryChallans.forEach((challan) => {
    const customer = state.customers.find((c) => c.id === challan.customerId);
    const statusLabel = challan.status || "Pending";
    const items = challan.items || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(challan.challanDate)}</td>
      <td>${challan.challanNumber || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td><span class="status-pill status-pill--pending">${statusLabel}</span></td>
      <td>${items}</td>
    `;
    table.appendChild(tr);
  });
}

// Sales - Invoices
function renderInvoices() {
  const table = document.querySelector("#table-invoices tbody");
  const selectPaymentInvoice = document.getElementById("select-payment-invoice");
  if (!table) return;

  table.innerHTML = "";
  if (selectPaymentInvoice) {
    selectPaymentInvoice.innerHTML = '<option value="">Select invoice</option>';
  }

  state.invoices.forEach((invoice) => {
    const customer = state.customers.find((c) => c.id === invoice.customerId);
    const statusLabel = invoice.status || "Draft";
    const amount = invoice.amount || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(invoice.invoiceDate)}</td>
      <td>${invoice.invoiceNumber || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td><span class="status-pill status-pill--pending">${statusLabel}</span></td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);

    if (selectPaymentInvoice) {
      const opt = document.createElement("option");
      opt.value = invoice.id;
      opt.textContent = `${invoice.invoiceNumber || invoice.id} - ${customer ? customer.name : "Unknown"}`;
      selectPaymentInvoice.appendChild(opt);
    }
  });
}

// Sales - Payments Received
function renderPayments() {
  const table = document.querySelector("#table-payments tbody");
  if (!table) return;

  table.innerHTML = "";
  state.payments.forEach((payment) => {
    const customer = state.customers.find((c) => c.id === payment.customerId);
    const invoice = state.invoices.find((i) => i.id === payment.invoiceId);
    const amount = payment.amount || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(payment.paymentDate)}</td>
      <td>${payment.paymentNumber || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td>${invoice ? invoice.invoiceNumber : "-"}</td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Sales - Recurring Invoices
function renderRecurringInvoices() {
  const table = document.querySelector("#table-recurring-invoices tbody");
  if (!table) return;

  table.innerHTML = "";
  state.recurringInvoices.forEach((recurring) => {
    const customer = state.customers.find((c) => c.id === recurring.customerId);
    const statusLabel = recurring.status || "Active";
    const amount = recurring.amount || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${recurring.profileName || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td>${recurring.frequency || "Monthly"}</td>
      <td><span class="status-pill status-pill--pending">${statusLabel}</span></td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Sales - Credit Notes
function renderCreditNotes() {
  const table = document.querySelector("#table-credit-notes tbody");
  if (!table) return;

  table.innerHTML = "";
  state.creditNotes.forEach((note) => {
    const customer = state.customers.find((c) => c.id === note.customerId);
    const statusLabel = note.status || "Open";
    const amount = note.amount || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(note.creditNoteDate)}</td>
      <td>${note.creditNoteNumber || "-"}</td>
      <td>${customer ? customer.name : "-"}</td>
      <td><span class="status-pill status-pill--pending">${statusLabel}</span></td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Accounts - Vendors
function renderAccountsVendors() {
  const table = document.querySelector("#table-accounts-vendors tbody");
  const selectExpenseVendor = document.getElementById("select-expense-vendor");
  const selectBillVendor = document.getElementById("select-bill-vendor");
  const selectPOVendor = document.getElementById("select-po-vendor");

  if (!table) return;

  table.innerHTML = "";

  // Reset all dropdowns
  if (selectExpenseVendor) {
    selectExpenseVendor.innerHTML = '<option value="">Select vendor</option>';
  }
  if (selectBillVendor) {
    selectBillVendor.innerHTML = '<option value="">Select vendor</option>';
  }
  if (selectPOVendor) {
    selectPOVendor.innerHTML = '<option value="">Select vendor</option>';
  }

  state.vendors.forEach((v) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${v.name}</td>
      <td>${v.company || "-"}</td>
      <td>${v.email || "-"}</td>
      <td>${v.phone || "-"}</td>
      <td>${v.paymentTerms || "-"}</td>
      <td>₹${(v.totalPayable || 0).toFixed(2)}</td>
    `;
    table.appendChild(tr);

    // Populate all vendor dropdowns
    if (selectExpenseVendor) {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      selectExpenseVendor.appendChild(opt);
    }
    if (selectBillVendor) {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      selectBillVendor.appendChild(opt);
    }
    if (selectPOVendor) {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      selectPOVendor.appendChild(opt);
    }
  });
}

// Accounts - Expenses
function renderAccountsExpenses() {
  const table = document.querySelector("#table-accounts-expenses tbody");
  if (!table) return;

  table.innerHTML = "";
  let totalExpenses = 0;

  state.expenses.forEach((e) => {
    const vendor = state.vendors.find((v) => v.id === e.vendorId);
    const amount = e.amount || 0;
    totalExpenses += amount;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(e.expenseDate)}</td>
      <td>${vendor ? vendor.name : "-"}</td>
      <td>${e.category || "-"}</td>
      <td>${e.paymentMethod || "-"}</td>
      <td>₹${amount.toFixed(2)}</td>
      <td>${e.reference || "-"}</td>
    `;
    table.appendChild(tr);
  });

  // Update total if element exists
  const totalElement = document.getElementById("total-expenses");
  if (totalElement) {
    totalElement.textContent = `₹${totalExpenses.toFixed(2)}`;
  }
}

// Accounts - Bills
function renderAccountsBills() {
  const table = document.querySelector("#table-accounts-bills tbody");
  if (!table) return;

  table.innerHTML = "";
  state.bills.forEach((bill) => {
    const vendor = state.vendors.find((v) => v.id === bill.vendorId);
    const statusLabel = bill.status || "Unpaid";
    const amount = bill.amount || 0;

    // Determine status pill color
    let statusClass = "status-pill--pending";
    if (statusLabel === "Paid") statusClass = "status-pill--completed";
    else if (statusLabel === "Overdue") statusClass = "status-pill--high";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(bill.billDate)}</td>
      <td>${bill.billNumber || "-"}</td>
      <td>${vendor ? vendor.name : "-"}</td>
      <td>${formatDate(bill.dueDate)}</td>
      <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Accounts - Purchase Orders
function renderAccountsPurchaseOrders() {
  const table = document.querySelector("#table-accounts-purchase-orders tbody");
  if (!table) return;

  table.innerHTML = "";
  state.purchaseOrders.forEach((po) => {
    const vendor = state.vendors.find((v) => v.id === po.vendorId);
    const statusLabel = po.status || "Draft";
    const amount = po.amount || 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(po.orderDate)}</td>
      <td>${po.poNumber || "-"}</td>
      <td>${vendor ? vendor.name : "-"}</td>
      <td>${formatDate(po.deliveryDate)}</td>
      <td><span class="status-pill status-pill--pending">${statusLabel}</span></td>
      <td>₹${amount.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  });
}

// Accounts - Activity History
function renderAccountsActivity() {
  const list = document.getElementById("accounts-activity-log");
  if (!list) return;

  list.innerHTML = "";

  // Get all accounts-related activities from main activity log
  const accountsActivities = state.activity.filter(a =>
    a.meta && (
      a.meta.includes("Accounts") ||
      a.meta.includes("Vendor") ||
      a.meta.includes("Expense") ||
      a.meta.includes("Bill") ||
      a.meta.includes("Purchase Order")
    )
  );

  accountsActivities.slice(0, 20).forEach((a) => {
    const li = document.createElement("li");
    const timestamp = a.timestamp ? new Date(a.timestamp).toLocaleString() : "-";
    li.innerHTML = `
      <div class="activity-main">${a.message}</div>
      <div class="activity-meta">${timestamp} · ${a.meta}</div>
    `;
    list.appendChild(li);
  });

  if (accountsActivities.length === 0) {
    list.innerHTML = '<li><div class="activity-main muted">No activity recorded yet.</div></li>';
  }
}

// ─── Marketing Module ────────────────────────────────────────────────────────
function renderMarketing() {
  const tbody = document.getElementById("marketing-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  let totalCampaigns = state.marketingCampaigns.length;
  let totalLeads = 0;
  let totalBudget = 0;
  let activeCampaigns = 0;

  state.marketingCampaigns.forEach((c) => {
    // Tally KPIs
    if (c.status === "Active") activeCampaigns++;
    totalLeads += Number(c.leads || 0);
    totalBudget += Number(c.budget || 0);

    // Render Row
    const tr = document.createElement("tr");
    const statusClass = c.status === "Active" ? "status-pill--success" : c.status === "Completed" ? "status-pill--info" : "status-pill--pending";
    
    tr.innerHTML = `
      <td><strong>${c.name}</strong></td>
      <td>${c.type}</td>
      <td><span class="status-pill ${statusClass}">${c.status}</span></td>
      <td>${c.leads || 0}</td>
      <td>₹${Number(c.budget || 0).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  // Update KPIs
  const kpiCampaigns = document.getElementById("kpi-marketing-campaigns");
  const kpiLeads     = document.getElementById("kpi-marketing-leads");
  const kpiConv      = document.getElementById("kpi-marketing-conversion");
  const kpiBudget    = document.getElementById("kpi-marketing-budget");

  if (kpiCampaigns) kpiCampaigns.textContent = activeCampaigns;
  if (kpiLeads)     kpiLeads.textContent     = totalLeads.toLocaleString();
  if (kpiConv)      kpiConv.textContent      = totalCampaigns > 0 ? "2.4%" : "0%"; // Mock conversion for now
  if (kpiBudget)    kpiBudget.textContent    = "₹" + totalBudget.toLocaleString();
}

// ─── Human Resources Module ──────────────────────────────────────────────────
function renderHR() {
  const tbody = document.getElementById("hr-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  let totalEmployees = state.employees.length;
  let depts = new Set();
  let newHires = 0;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  state.employees.forEach((emp) => {
    depts.add(emp.department);
    if (new Date(emp.joinDate) >= startOfMonth) newHires++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${emp.name}</strong></td>
      <td>${emp.role}</td>
      <td>${emp.department}</td>
      <td>${formatDate(emp.joinDate)}</td>
      <td><span class="status-pill status-pill--completed">${emp.status || "Active"}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Update KPIs
  const kpiEmployees = document.getElementById("kpi-hr-employees");
  const kpiNewHires  = document.getElementById("kpi-hr-new-hires");
  const kpiDepts     = document.getElementById("kpi-hr-departments");
  const kpiRetention = document.getElementById("kpi-hr-retention");

  if (kpiEmployees) kpiEmployees.textContent = totalEmployees;
  if (kpiNewHires)  kpiNewHires.textContent  = newHires;
  if (kpiDepts)     kpiDepts.textContent     = depts.size;
  if (kpiRetention) kpiRetention.textContent = totalEmployees > 0 ? "98%" : "0%";
}

// ─── Client Service Module ───────────────────────────────────────────────────
function renderService() {
  const tbody = document.getElementById("service-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  let openTickets = 0;
  let resolvedThisWeek = 0;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  state.serviceTickets.forEach((t) => {
    if (t.status === "Open" || t.status === "In Progress") openTickets++;
    if (t.status === "Resolved" && new Date(t.createdAt) >= sevenDaysAgo) resolvedThisWeek++;

    const customer = state.customers.find(c => c.id == t.customerId);
    const tr = document.createElement("tr");
    const statusClass = t.status === "Open" ? "status-pill--pending" : t.status === "Resolved" ? "status-pill--completed" : "status-pill--inprogress";
    
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td>${customer ? customer.name : "Unknown"}</td>
      <td>${t.title}</td>
      <td><span class="status-pill ${statusClass}">${t.status}</span></td>
      <td><span class="status-pill status-pill--${(t.priority || "Medium").toLowerCase()}">${t.priority}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Update KPIs
  const kpiOpen     = document.getElementById("kpi-service-open");
  const kpiRespon   = document.getElementById("kpi-service-response");
  const kpiResolved = document.getElementById("kpi-service-resolved");
  const kpiCsat     = document.getElementById("kpi-service-csat");

  if (kpiOpen)     kpiOpen.textContent     = openTickets;
  if (kpiRespon)   kpiRespon.textContent   = openTickets > 0 ? "2.5h" : "0h";
  if (kpiResolved) kpiResolved.textContent = resolvedThisWeek;
  if (kpiCsat)     kpiCsat.textContent     = "94%";

  populateServiceCustomerSelect();
}

function populateServiceCustomerSelect() {
  const select = document.getElementById("select-service-customer");
  if (!select) return;
  const val = select.value;
  select.innerHTML = '<option value="">Select customer</option>';
  state.customers.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  if (val) select.value = val;
}

function renderCharts() {
  const statusCanvas = document.getElementById("chart-status");
  const deptCanvas = document.getElementById("chart-departments");
  if (!statusCanvas || !deptCanvas || typeof Chart === "undefined") return;

  const unassignedTasks = state.tasks.filter(
    (t) => !state.assignments.some((a) => a.taskId === t.id)
  ).length;
  const inProgress = state.assignments.filter(
    (a) => a.status !== "completed"
  ).length;
  const completed = state.assignments.filter(
    (a) => a.status === "completed"
  ).length;

  const statusData = [unassignedTasks, inProgress, completed];

  if (!statusChart) {
    statusChart = new Chart(statusCanvas, {
      type: "doughnut",
      data: {
        labels: ["Unassigned", "In Progress", "Completed"],
        datasets: [
          {
            data: statusData,
            backgroundColor: ["#e5e7eb", "#3b82f6", "#4b3c86ff"],
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: { color: "#0f172a" },
          },
        },
      },
    });
  } else {
    statusChart.data.datasets[0].data = statusData;
    statusChart.update();
  }

  const departments = [
    "Marketing",
    "Sales",
    "Accounts",
    "Operations",
    "Human Resources",
    "Client Service",
  ];
  const deptOpenTasks = departments.map((dep) => {
    const depProjects = state.projects.filter((p) => p.department === dep);
    const depTasks = state.tasks.filter((t) =>
      depProjects.some((p) => p.id === t.projectId)
    );
    const depAssignments = state.assignments.filter((a) =>
      depTasks.some((t) => t.id === a.taskId)
    );
    const openTasks = depAssignments.filter((a) => a.status !== "completed")
      .length;
    return openTasks;
  });

  if (!departmentChart) {
    departmentChart = new Chart(deptCanvas, {
      type: "pie",
      data: {
        labels: departments,
        datasets: [
          {
            data: deptOpenTasks,
            backgroundColor: [
              "#6366f1",
              "#5f51b9ff",
              "#101aa5ff",
              "#665f72ff",
              "#253f4eff",
              "#06b6d4",
            ],
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: { color: "#0f172a" },
          },
        },
      },
    });
  } else {
    departmentChart.data.datasets[0].data = deptOpenTasks;
    departmentChart.update();
  }
}

function renderIndividualDashboard(resourceId) {
  const assignments = state.assignments.filter(
    (a) => a.resourceId === resourceId
  );
  const totalAssigned = assignments.length;
  const completed = assignments.filter((a) => a.status === "completed").length;
  const onTime = calculateOnTimePercentage(assignments);

  document.getElementById("individual-total-assigned").textContent =
    totalAssigned;
  document.getElementById("individual-total-completed").textContent =
    completed;
  document.getElementById("individual-on-time").textContent = `${onTime}%`;

  const tbody = document.querySelector("#table-individual-tasks tbody");
  const summaryList = document.getElementById("individual-summary");
  tbody.innerHTML = "";
  summaryList.innerHTML = "";

  assignments.forEach((a) => {
    const project = state.projects.find((p) => p.id === a.projectId);
    const task = state.tasks.find((t) => t.id === a.taskId);
    const tr = document.createElement("tr");
    const isCompleted = a.status === "completed";
    tr.innerHTML = `
      <td>${project ? project.name : "-"}</td>
      <td>${task ? task.title : "-"}</td>
      <td>${formatDate(a.dueDate)}</td>
      <td>
        <span class="status-pill ${isCompleted ? "status-pill--completed" : "status-pill--inprogress"
      }">
          ${isCompleted ? "Completed" : "In Progress"}
        </span>
      </td>
      <td>
        ${isCompleted
        ? "-"
        : `<button class="table-button" data-complete="${a.id}">Mark Complete</button>`
      }
      </td>
    `;
    tbody.appendChild(tr);
  });

  const byProject = {};
  assignments.forEach((a) => {
    const project = state.projects.find((p) => p.id === a.projectId);
    const key = project ? project.name : "Unknown project";
    if (!byProject[key]) byProject[key] = { total: 0, completed: 0 };
    byProject[key].total += 1;
    if (a.status === "completed") byProject[key].completed += 1;
  });

  Object.entries(byProject).forEach(([projectName, stats]) => {
    const li = document.createElement("li");
    const percent = stats.total
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;
    li.innerHTML = `
      <div class="activity-main">${projectName}</div>
      <div class="activity-meta">
        ${stats.completed}/${stats.total} tasks completed (${percent}%)
      </div>
    `;
    summaryList.appendChild(li);
  });
}

// Form handlers
function setupForms() {
  // New Module: Marketing
  const marketingForm = document.getElementById("form-marketing-campaign");
  if (marketingForm) {
    marketingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(marketingForm);
      const campaignData = {
        id: nextId(),
        name: data.get("name").trim(),
        type: data.get("type"),
        status: data.get("status") || "Planned",
        budget: parseFloat(data.get("budget") || "0"),
        leads: Math.floor(Math.random() * 50), // Random simulated leads
        createdAt: new Date().toISOString()
      };
      
      state.marketingCampaigns.push(campaignData);
      saveToLocalStorage();
      renderMarketing();
      renderAdminDashboard();
      addActivity(`Created marketing campaign: ${campaignData.name}`, "Marketing");
      marketingForm.reset();
      alert("Campaign created successfully!");
    });
  }

  // New Module: HR
  const hrForm = document.getElementById("form-hr-employee");
  if (hrForm) {
    hrForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(hrForm);
      const employeeData = {
        id: nextId(),
        name: data.get("name").trim(),
        role: data.get("role").trim(),
        department: data.get("department"),
        joinDate: data.get("joinDate") || new Date().toISOString().split('T')[0],
        status: "Active",
        createdAt: new Date().toISOString()
      };
      
      state.employees.push(employeeData);
      saveToLocalStorage();
      renderHR();
      renderAdminDashboard();
      addActivity(`Added employee: ${employeeData.name}`, "Human Resources");
      hrForm.reset();
      alert("Employee added successfully!");
    });
  }

  // New Module: Client Service
  const serviceForm = document.getElementById("form-service-ticket");
  if (serviceForm) {
    serviceForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(serviceForm);
      const ticketData = {
        id: "TKT-" + Math.floor(1000 + Math.random() * 9000),
        customerId: data.get("customerId"),
        title: data.get("title").trim(),
        priority: data.get("priority"),
        status: data.get("status") || "Open",
        createdAt: new Date().toISOString()
      };
      
      state.serviceTickets.push(ticketData);
      saveToLocalStorage();
      renderService();
      addActivity(`Logged ticket: ${ticketData.title}`, "Client Service");
      serviceForm.reset();
      alert("Ticket logged successfully!");
    });
  }

  const resourceForm = document.getElementById("form-resource");
  if (resourceForm) {
    resourceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(resourceForm);
      const resourceData = {
        name: data.get("name").trim(),
        role: data.get("role").trim(),
        department: data.get("department"),
        email: data.get("email").trim(),
      };

      try {
        const savedResource = await apiRequest('/resources', {
          method: 'POST',
          body: JSON.stringify(resourceData)
        });
        state.resources.push(savedResource);
        saveToLocalStorage();

        renderResources();
        renderDepartmentStats();
        renderAdminDashboard();
        addActivity(`Added resource ${savedResource.name}`, savedResource.department);
        resourceForm.reset();
      } catch (error) {
        console.error('Error adding resource:', error);
      }
    });
  }

  const projectForm = document.getElementById("form-project");
  if (projectForm) {
    projectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(projectForm);
      const projectData = {
        name: data.get("name").trim(),
        type: data.get("type")?.trim() || "",
        department: data.get("department"),
        start_date: data.get("startDate"),
        end_date: data.get("endDate"),
        project_owner_id: data.get("ownerId") || null,
        template: data.get("template") || "",
        priority: data.get("priority") || "none",
      };

      try {
        const savedProject = await apiRequest('/projects', {
          method: 'POST',
          body: JSON.stringify(projectData)
        });
        state.projects.push(savedProject);
        saveToLocalStorage();

        renderProjects();
        renderDepartmentStats();
        addActivity(`Created project ${savedProject.name}`, savedProject.department);

        if (savedProject.template === "video") {
          const taskCount = await createTasksFromTemplate(savedProject.id, savedProject.template, savedProject.start_date, savedProject.end_date);
          if (taskCount > 0) {
            alert(`Project "${savedProject.name}" created successfully!\n\n✅ ${taskCount} tasks created from Video template.`);
          } else {
            alert(`Project "${savedProject.name}" created successfully!\n\n⚠️ Template selected but no tasks were created.`);
          }
        } else {
          alert("Project created successfully!");
        }
        projectForm.reset();
      } catch (error) {
        console.error('Error adding project:', error);
        alert('Failed to create project');
      }
    });
  }

  const taskForm = document.getElementById("form-task");
  if (taskForm) {
    taskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(taskForm);
      const notifyUsers = data.getAll("notifyUsers");
      const taskData = {
        projectId: data.get("projectId"),
        title: data.get("title").trim(),
        description: data.get("description")?.trim() || "",
        estimate: data.get("estimate") || "",
        priority: data.get("priority") || "none",
        taskOwnerId: data.get("taskOwnerId") || null,
        startDate: data.get("startDate") || null,
        dueDate: data.get("dueDate") || null,
        time: data.get("time") || "",
        notifyUsers: notifyUsers,
      };

      if (!taskData.projectId) return;

      try {
        const savedTask = await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify(taskData)
        });
        state.tasks.push(savedTask);

        // Auto-create assignment if owner and due date provided
        if (taskData.taskOwnerId && data.get("dueDate")) {
          const assignmentData = {
            projectId: taskData.projectId,
            taskId: savedTask.id,
            resourceId: taskData.taskOwnerId,
            dueDate: data.get("dueDate"),
            status: "in-progress",
          };
          const savedAssignment = await apiRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
          });
          state.assignments.push(savedAssignment);
          renderAssignments();
        }

        saveToLocalStorage();

        renderTasks();
        renderDepartmentStats();
        addActivity(`Added task ${savedTask.title}`, "Task creation");

        if (notifyUsers.length > 0) {
          alert(`Task created! Notifying users.`);
        } else {
          alert("Task created successfully!");
        }
        taskForm.reset();
      } catch (error) {
        console.error('Error adding task:', error);
        alert('Failed to add task');
      }
    });
  }

  // Scroll down button functionality
  const scrollDownTaskBtn = document.getElementById("scroll-down-task");
  if (scrollDownTaskBtn) {
    scrollDownTaskBtn.addEventListener("click", () => {
      const formCard = scrollDownTaskBtn.closest(".task-form-card");
      if (formCard) {
        const formActions = formCard.querySelector(".task-form-actions");
        if (formActions) {
          formActions.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }
    });
  }

  const scrollDownProjectBtn = document.getElementById("scroll-down-project");
  if (scrollDownProjectBtn) {
    scrollDownProjectBtn.addEventListener("click", () => {
      const formCard = scrollDownProjectBtn.closest(".task-form-card");
      if (formCard) {
        const formActions = formCard.querySelector(".task-form-actions");
        if (formActions) {
          formActions.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }
    });
  }

  const assignmentForm = document.getElementById("form-assignment");
  if (assignmentForm) {
    assignmentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(assignmentForm);
      const assignmentData = {
        projectId: data.get("projectId"),
        taskId: data.get("taskId"),
        resourceId: data.get("resourceId"),
        dueDate: data.get("dueDate"),
        status: "in-progress",
      };

      if (!assignmentData.projectId || !assignmentData.taskId || !assignmentData.resourceId)
        return;

      try {
        const savedAssignment = await apiRequest('/assignments', {
          method: 'POST',
          body: JSON.stringify(assignmentData)
        });
        state.assignments.push(savedAssignment);
        saveToLocalStorage();

        renderAssignments();
        renderGlobalKPIs();
        renderDepartmentStats();
        renderAdminDashboard();
        addActivity("Assigned task to individual", "Task assignment");
        assignmentForm.reset();
      } catch (error) {
        console.error('Error creating assignment:', error);
        alert('Failed to assign task');
      }
    });
  }

  const shareForm = document.getElementById("form-share");
  if (shareForm) {
    shareForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(shareForm);
      const assignmentId = data.get("assignmentId");
      if (!assignmentId) return;
      const assignment = state.assignments.find((a) => a.id == assignmentId);
      if (!assignment) return;
      const task = state.tasks.find((t) => t.id == assignment.taskId);
      const resource = state.resources.find((r) => r.id == assignment.resourceId);
      const project = state.projects.find((p) => p.id == assignment.projectId);

      const share = {
        id: nextId(),
        assignmentId,
        taskId: assignment.taskId,
        resourceId: assignment.resourceId,
        message: data.get("message").trim(),
        sharedAt: new Date().toISOString(),
      };
      state.shares.push(share);
      saveToLocalStorage();
      renderShares();

      addActivity(
        `Shared task ${task ? task.title : ""} to ${resource ? resource.email : ""
        }`,
        "Email & dashboard share"
      );

      const recipientEmail = data.get("recipientEmail")?.trim() || (resource ? resource.email : "");

      if (recipientEmail) {
        const subject = `Task assigned: ${task ? task.title : "Task"}`;
        const bodyLines = [
          `Hi ${resource ? resource.name : "Team Member"},`,
          "",
          `You have been assigned the task: ${task ? task.title : "Task"}.`,
          `Project: ${project ? project.name : "-"}`,
          `Due Date: ${formatDate(assignment.dueDate)}`,
          "",
          share.message ? `Note from admin: ${share.message}` : "",
          "",
          "This link came from the CRMM dashboard.",
        ];
        const body = encodeURIComponent(bodyLines.join("\n"));
        const mailto = `mailto:${encodeURIComponent(
          recipientEmail
        )}?subject=${encodeURIComponent(subject)}&body=${body}`;
        window.location.href = mailto;
      }

      shareForm.reset();
    });
  }

  const individualFilterForm = document.getElementById(
    "form-individual-filter"
  );
  individualFilterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(individualFilterForm);
    const resourceId = data.get("resourceId");
    if (!resourceId) return;
    renderIndividualDashboard(resourceId);
  });

  const individualTasksTable = document.getElementById("table-individual-tasks");
  if (individualTasksTable) {
    individualTasksTable.addEventListener("click", (e) => {
      const target = e.target;
      if (target.matches("button[data-complete]")) {
        const assignmentId = target.getAttribute("data-complete");
        const assignment = state.assignments.find((a) => a.id === assignmentId);
        if (!assignment) return;
        assignment.status = "completed";
        assignment.completedAt = new Date().toISOString();
        saveToLocalStorage();
        renderAssignments();
        renderGlobalKPIs();
        renderAdminDashboard();
        const select = document.getElementById("select-individual-resource");
        if (select && select.value) {
          renderIndividualDashboard(select.value);
        }
        renderDepartmentStats();
        addActivity("Marked task as completed", "Individual dashboard");
      }
    });
  }

  const tableResources = document.getElementById("table-resources");
  if (tableResources) {
    tableResources.addEventListener("click", (e) => {
      const target = e.target;
      if (target.matches("button[data-view-resource]")) {
        const id = target.getAttribute("data-view-resource");
        const res = state.resources.find((r) => r.id === id);
        if (!res) return;
        alert(
          `Resource details:\n\nName: ${res.name}\nRole: ${res.role}\nDepartment: ${res.department}\nEmail: ${res.email}`
        );
      } else if (target.matches("button[data-delete-resource]")) {
        const id = target.getAttribute("data-delete-resource");
        const res = state.resources.find((r) => r.id == id);
        if (!res) return;

        if (!confirm(`Delete resource "${res.name}"?`)) return;

        apiRequest(`/resources/${id}`, { method: 'DELETE' })
          .then(() => {
            state.resources = state.resources.filter((r) => r.id != id);
            state.assignments = state.assignments.filter(a => a.resourceId != id);

            renderResources();
            renderAssignments();
            renderShares();
            renderGlobalKPIs();
            renderDepartmentStats();
            renderAdminDashboard();
            addActivity(`Deleted resource ${res.name}`, "Resource removed");
          })
          .catch(err => alert(`Failed to delete: ${err.message}`));
      }
    });
  }

  const tableProjects = document.getElementById("table-projects");
  if (tableProjects) {
    tableProjects.addEventListener("click", (e) => {
      const target = e.target;
      if (target.matches("button[data-view-project]")) {
        const id = target.getAttribute("data-view-project");
        const proj = state.projects.find((p) => p.id === id);
        if (!proj) return;
        const owner = proj.ownerId ? state.resources.find(r => r.id === proj.ownerId) : null;
        const details = [
          `Project: ${proj.name}`,
          `Type: ${proj.type || "-"}`,
          `Department: ${proj.department}`,
          `Owner: ${owner ? owner.name : "Not assigned"}`,
          `Priority: ${proj.priority || "None"}`,
          `Template: ${proj.template || "-"}`,
          `Business Hours: ${proj.businessHours || "Standard"}`,
          `Task Layout: ${proj.taskLayout || "Standard"}`,
          `Project Group: ${proj.projectGroup || "-"}`,
          `Tags: ${proj.tags && proj.tags.length > 0 ? proj.tags.join(", ") : "None"}`,
          `Start: ${formatDate(proj.startDate)}`,
          `End: ${formatDate(proj.endDate)}`,
          `Strict Project: ${proj.strictProject ? "Yes" : "No"}`,
          `Roll-up Enabled: ${proj.rollup ? "Yes" : "No"}`,
          `Description: ${proj.description || "None"}`,
        ].join("\n");
        alert(details);
      } else if (target.matches("button[data-delete-project]")) {
        const id = target.getAttribute("data-delete-project");
        const proj = state.projects.find((p) => p.id == id);
        if (!proj) return;
        if (!confirm(`Delete project "${proj.name}"?`)) return;

        apiRequest(`/projects/${id}`, { method: 'DELETE' })
          .then(() => {
            state.projects = state.projects.filter((p) => p.id != id);
            state.tasks = state.tasks.filter((t) => t.projectId != id);
            state.assignments = state.assignments.filter((a) => a.projectId != id);

            renderProjects();
            renderTasks();
            renderAssignments();
            renderShares();
            renderGlobalKPIs();
            renderDepartmentStats();
            renderAdminDashboard();
            addActivity(`Deleted project ${proj.name}`, "Project removed");
          })
          .catch(err => alert(`Failed to delete: ${err.message}`));
      }
    });
  }

  const tableTasks = document.getElementById("table-tasks");
  if (tableTasks) {
    tableTasks.addEventListener("click", (e) => {
      const target = e.target;
      if (target.matches("button[data-view-task]")) {
        const id = target.getAttribute("data-view-task");
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        const project = state.projects.find((p) => p.id === task.projectId);
        const owner = task.taskOwnerId ? state.resources.find(r => r.id === task.taskOwnerId) : null;
        const notifyLabels = {
          po: "Project Owner",
          to: "Task Owner",
          tc: "Task Created By",
          tf: "Task Followers"
        };
        const notified = task.notifyUsers && task.notifyUsers.length > 0
          ? task.notifyUsers.map(u => notifyLabels[u] || u).join(", ")
          : "None";
        const details = [
          `Task: ${task.title}`,
          `Project: ${project ? project.name : "-"}`,
          `Priority: ${task.priority || "None"}`,
          `Owner: ${owner ? owner.name : "Not assigned"}`,
          `Start Date: ${formatDate(task.startDate) || "-"}`,
          `Due Date: ${formatDate(task.dueDate) || "-"}`,
          `Time: ${task.time || "-"}`,
          `Estimated Hours: ${task.estimate || "-"}`,
          `Notify Users: ${notified}`,
          `Description: ${task.description || "-"}`,
        ].join("\n");
        alert(details);
      } else if (target.matches("button[data-delete-task]")) {
        const id = target.getAttribute("data-delete-task");
        const task = state.tasks.find((t) => t.id == id);
        if (!task) return;
        if (!confirm(`Delete task "${task.title}"?`)) return;

        apiRequest(`/tasks/${id}`, { method: 'DELETE' })
          .then(() => {
            state.tasks = state.tasks.filter((t) => t.id != id);
            state.assignments = state.assignments.filter((a) => a.taskId != id);
            state.shares = state.shares.filter((s) => s.assignmentId != id);

            renderTasks();
            renderAssignments();
            renderShares();
            renderGlobalKPIs();
            renderDepartmentStats();
            renderAdminDashboard();
            addActivity(`Deleted task ${task.title}`, "Task removed");
          })
          .catch(err => alert(`Failed to delete: ${err.message}`));
      }
    });
  }

  const tableAssignments = document.getElementById("table-assignments");
  if (tableAssignments) {
    tableAssignments.addEventListener("click", (e) => {
      const target = e.target;
      if (target.matches("button[data-view-assignment]")) {
        const id = target.getAttribute("data-view-assignment");
        const a = state.assignments.find((x) => x.id === id);
        if (!a) return;
        const project = state.projects.find((p) => p.id === a.projectId);
        const task = state.tasks.find((t) => t.id === a.taskId);
        const resource = state.resources.find((r) => r.id === a.resourceId);
        alert(
          `Assignment details:\n\nProject: ${project ? project.name : "-"
          }\nTask: ${task ? task.title : "-"}\nIndividual: ${resource ? resource.name : "-"
          }\nDue: ${formatDate(a.dueDate)}\nStatus: ${a.status}`
        );
      } else if (target.matches("button[data-delete-assignment]")) {
        const id = target.getAttribute("data-delete-assignment");
        const a = state.assignments.find((x) => x.id == id);
        if (!a) return;
        if (!confirm("Delete this assignment?")) return;

        apiRequest(`/assignments/${id}`, { method: 'DELETE' })
          .then(() => {
            state.assignments = state.assignments.filter((x) => x.id != id);
            state.shares = state.shares.filter((s) => s.assignmentId != id);

            renderAssignments();
            renderShares();
            renderGlobalKPIs();
            renderDepartmentStats();
            renderAdminDashboard();
            addActivity("Deleted assignment", "Assignment removed");
          })
          .catch(err => alert(`Failed to delete: ${err.message}`));
      }
    });
  }

  // Sales - Customers
  const salesCustomerForm = document.getElementById("form-sales-customer");
  if (salesCustomerForm) {
    salesCustomerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(salesCustomerForm);
      const customerData = {
        customer_name: data.get("name").trim(),
        company_name: data.get("company")?.trim() || "",
        email: data.get("email")?.trim() || "",
        phone: data.get("phone")?.trim() || "",
        billing_address: data.get("billingAddress")?.trim() || "",
        shipping_address: data.get("shippingAddress")?.trim() || "",
        gst_number: data.get("gstNumber")?.trim() || "",
      };

      try {
        const savedCustomer = await apiRequest('/sales/customers', {
          method: 'POST',
          body: JSON.stringify(customerData)
        });

        const frontendCustomer = {
          ...savedCustomer,
          name: savedCustomer.customer_name,
          company: savedCustomer.company_name,
          receivables: 0,
          credits: 0
        };

        state.customers.push(frontendCustomer);
        saveToLocalStorage();
        renderSalesCustomers();
        addActivity(`Added customer ${frontendCustomer.name}`, "Sales - Customers");
        salesCustomerForm.reset();
        alert("Customer created successfully!");
      } catch (error) {
        console.error('Error adding customer:', error);
        alert(`Failed to add customer: ${error.message || 'Unknown error'}`);
      }
    });
  }

  // Sales - Estimates
  const salesEstimateForm = document.getElementById("form-sales-estimate");
  if (salesEstimateForm) {
    salesEstimateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(salesEstimateForm);
      const customerId = data.get("customerId");
      if (!customerId) return;

      const itemGrids = salesEstimateForm.querySelectorAll('.estimate-items-grid');
      const items = [];
      let totalSubtotal = 0;
      let totalTax = 0;
      let totalAmount = 0;

      itemGrids.forEach(grid => {
        const description = grid.querySelector('input[name="itemDescription"]')?.value || "";
        if (!description) return;

        const quantity = parseFloat(grid.querySelector('input[name="quantity"]')?.value || "1");
        const rate = parseFloat(grid.querySelector('input[name="rate"]')?.value || "0");
        const discount = parseFloat(grid.querySelector('input[name="discount"]')?.value || "0");
        const tax = parseFloat(grid.querySelector('input[name="tax"]')?.value || "0");

        const subtotal = quantity * rate;
        const discountAmount = (subtotal * discount) / 100;
        const taxable = subtotal - discountAmount;
        const taxVal = (taxable * tax) / 100;
        const total = taxable + taxVal;

        totalSubtotal += subtotal;
        totalTax += taxVal;
        totalAmount += total;

        items.push({
          description,
          quantity,
          rate,
          discount,
          tax,
          subtotal,
          total
        });
      });

      if (items.length === 0) {
        alert("Please add at least one item details.");
        return;
      }

      const estimateData = {
        customer_id: customerId,
        estimate_number: data.get("estimateNumber") || "",
        estimate_date: data.get("estimateDate"),
        expiry_date: data.get("expiryDate") || null,
        status: "Draft",
        items: items,
        subtotal: totalSubtotal,
        tax: totalTax,
        total: totalAmount,
        notes: (data.get("customerNotes") || "") + (data.get("referenceNumber") ? `\nRef: ${data.get("referenceNumber")}` : ""),
      };

      try {
        const savedEstimate = await apiRequest('/sales/estimates', {
          method: 'POST',
          body: JSON.stringify(estimateData)
        });

        const frontendEstimate = {
          ...savedEstimate,
          customerId: savedEstimate.customer_id,
          estimateNumber: savedEstimate.estimate_number,
          estimateDate: savedEstimate.estimate_date,
          expiryDate: savedEstimate.expiry_date,
          items: (typeof savedEstimate.items === 'string') ? JSON.parse(savedEstimate.items) : savedEstimate.items,
          amount: parseFloat(savedEstimate.total),
          customerNotes: savedEstimate.notes
        };

        state.estimates.push(frontendEstimate);
        saveToLocalStorage();

        renderSalesEstimates();
        addActivity(
          `Created estimate ${frontendEstimate.estimateNumber || frontendEstimate.id}`,
          "Sales - Estimates"
        );

        const subtotalDisplay = document.getElementById(
          "estimate-subtotal-display"
        );
        if (subtotalDisplay) {
          subtotalDisplay.textContent = total.toFixed(2);
        }

        salesEstimateForm.reset();
        alert("Estimate created successfully!");
      } catch (error) {
        console.error('Error adding estimate:', error);
        alert('Failed to create estimate');
      }
    });
  }

  // Sales - Sales Orders
  const salesOrderForm = document.getElementById("form-sales-order");
  if (salesOrderForm) {
    salesOrderForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(salesOrderForm);
      const customerId = data.get("customerId");
      if (!customerId) return;

      const orderData = {
        customer_id: customerId,
        order_number: data.get("orderNumber") || "",
        // DB does NOT have reference_number. Append to notes.
        order_date: data.get("orderDate"),
        delivery_date: data.get("deliveryDate") || null,
        status: data.get("status") || "pending", // DB enum: pending, processing...
        amount: parseFloat(data.get("amount") || "0"), // DB has total, subtotal. We'll map amount to total.
        subtotal: parseFloat(data.get("amount") || "0"),
        total: parseFloat(data.get("amount") || "0"),
        tax: 0,
        items: [], // Form doesn't provide items details yet
        notes: (data.get("notes") || "") + (data.get("referenceNumber") ? `\nRef: ${data.get("referenceNumber")}` : ""),
      };

      try {
        const savedOrder = await apiRequest('/sales/orders', {
          method: 'POST',
          body: JSON.stringify(orderData)
        });

        // Adapt for frontend state
        const frontendOrder = {
          ...savedOrder,
          customerId: savedOrder.customer_id,
          orderNumber: savedOrder.order_number,
          orderDate: savedOrder.order_date,
          deliveryDate: savedOrder.delivery_date,
        };

        state.salesOrders.push(frontendOrder);
        saveToLocalStorage();

        renderSalesOrders();
        addActivity(
          `Created sales order ${frontendOrder.orderNumber || frontendOrder.id}`,
          "Sales - Orders"
        );
        salesOrderForm.reset();
        alert("Sales Order created successfully!");
      } catch (error) {
        console.error('Error adding sales order:', error);
        alert('Failed to create sales order');
      }
    });
  }

  // Sales - Delivery Challans
  const deliveryChallanForm = document.getElementById("form-delivery-challan");
  if (deliveryChallanForm) {
    deliveryChallanForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(deliveryChallanForm);
      const customerId = data.get("customerId");
      if (!customerId) return;

      const challanData = {
        customer_id: customerId,
        challan_number: data.get("challanNumber") || "",
        challan_date: data.get("challanDate"),
        order_reference: data.get("order_reference") || "",
        items: [{ quantity: parseInt(data.get("items") || "0"), description: "Bulk Items" }],
        notes: (data.get("notes") || "") + (data.get("deliveryDate") ? `\nDelivery Date: ${data.get("deliveryDate")}` : ""),
      };

      try {
        const savedChallan = await apiRequest('/sales/challans', {
          method: 'POST',
          body: JSON.stringify(challanData)
        });

        const frontendChallan = {
          ...savedChallan,
          customerId: savedChallan.customer_id,
          challanNumber: savedChallan.challan_number,
          challanDate: savedChallan.challan_date,
          items: 0,
        };

        state.deliveryChallans.push(frontendChallan);
        saveToLocalStorage();

        renderDeliveryChallans();
        addActivity(
          `Created delivery challan ${frontendChallan.challanNumber || frontendChallan.id}`,
          "Sales - Delivery Challans"
        );
        deliveryChallanForm.reset();
        alert("Delivery Challan created successfully!");
      } catch (error) {
        console.error('Error adding challan:', error);
        alert('Failed to create challan');
      }
    });
  }

  // Sales - Invoices
  const invoiceForm = document.getElementById("form-invoice");
  if (invoiceForm) {
    invoiceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(invoiceForm);
      const customerId = data.get("customerId");
      if (!customerId) return;

      const invoiceData = {
        customer_id: customerId,
        invoice_number: data.get("invoiceNumber") || "",
        invoice_date: data.get("invoiceDate"),
        due_date: data.get("dueDate") || null,
        status: data.get("status") || "draft",
        subtotal: parseFloat(data.get("amount") || "0"),
        total: parseFloat(data.get("amount") || "0"),
        tax: 0,
        items: [],
        notes: (data.get("notes") || "") + (data.get("referenceNumber") ? `\nRef: ${data.get("referenceNumber")}` : ""),
      };

      try {
        const savedInvoice = await apiRequest('/sales/invoices', {
          method: 'POST',
          body: JSON.stringify(invoiceData)
        });

        const frontendInvoice = {
          ...savedInvoice,
          customerId: savedInvoice.customer_id,
          invoiceNumber: savedInvoice.invoice_number,
          invoiceDate: savedInvoice.invoice_date,
        };

        state.invoices.push(frontendInvoice);
        saveToLocalStorage();

        renderInvoices();
        saveToLocalStorage();

        renderInvoices();
        addActivity(
          `Created invoice ${frontendInvoice.invoiceNumber || frontendInvoice.id}`,
          "Sales - Invoices"
        );
        invoiceForm.reset();
        alert("Invoice created successfully!");
      } catch (error) {
        console.error('Error adding invoice:', error);
        alert('Failed to create invoice');
      }
    });
  }

  // Sales - Payments Received
  const paymentForm = document.getElementById("form-payment");
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(paymentForm);
      const customerId = data.get("customerId");
      const invoiceId = data.get("invoiceId");
      if (!customerId) return;

      const paymentData = {
        customer_id: customerId,
        invoice_id: invoiceId || null,
        payment_number: data.get("paymentNumber") || "",
        payment_date: data.get("paymentDate"),
        amount: parseFloat(data.get("amount") || "0"),
        payment_mode: data.get("paymentMode") || "cash",
        notes: data.get("notes") || ""
      };

      try {
        const savedPayment = await apiRequest('/sales/payments', {
          method: 'POST',
          body: JSON.stringify(paymentData)
        });

        const frontendPayment = {
          ...savedPayment,
          customerId: savedPayment.customer_id,
          invoiceId: savedPayment.invoice_id,
          paymentNumber: savedPayment.payment_number,
          paymentDate: savedPayment.payment_date,
        };

        state.payments.push(frontendPayment);
        saveToLocalStorage();

        renderPayments();
        saveToLocalStorage();

        renderPayments();
        addActivity(
          `Received payment ${frontendPayment.paymentNumber || frontendPayment.id}`,
          "Sales - Payments"
        );
        paymentForm.reset();
        alert("Payment recorded successfully!");
      } catch (error) {
        console.error('Error adding payment:', error);
        alert('Failed to record payment');
      }
    });
  }

  // Sales - Recurring Invoices
  const recurringInvoiceForm = document.getElementById("form-recurring-invoice");
  if (recurringInvoiceForm) {
    recurringInvoiceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(recurringInvoiceForm);
      const customerId = data.get("customerId");
      if (!customerId) return;

      const recurringData = {
        customer_id: customerId,
        profile_name: data.get("profileName") || "",
        frequency: data.get("frequency") || "monthly",
        start_date: data.get("startDate"),
        end_date: data.get("endDate") || null,
        is_active: data.get("status") === "Active",
        subtotal: parseFloat(data.get("amount") || "0"),
        total: parseFloat(data.get("amount") || "0"),
        tax: 0,
        items: [],
        notes: data.get("notes") || "",
      };

      try {
        const savedRecurring = await apiRequest('/sales/recurring', {
          method: 'POST',
          body: JSON.stringify(recurringData)
        });

        const frontendRecurring = {
          ...savedRecurring,
          customerId: savedRecurring.customer_id,
          profileName: savedRecurring.profile_name,
          startDate: savedRecurring.start_date,
          endDate: savedRecurring.end_date,
          status: savedRecurring.is_active ? "Active" : "Inactive"
        };

        state.recurringInvoices.push(frontendRecurring);
        saveToLocalStorage();

        renderRecurringInvoices();
        addActivity(
          `Created recurring invoice ${frontendRecurring.profileName || frontendRecurring.id}`,
          "Sales - Recurring Invoices"
        );
        recurringInvoiceForm.reset();
        alert("Recurring Invoice created successfully!");
      } catch (error) {
        console.error('Error adding recurring invoice:', error);
        alert('Failed to create recurring invoice');
      }
    });
  }

  // Sales - Credit Notes
  const creditNoteForm = document.getElementById("form-credit-note");
  if (creditNoteForm) {
    creditNoteForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(creditNoteForm);
      const customerId = data.get("customerId");
      if (!customerId) return;

      const creditNoteData = {
        customer_id: customerId,
        credit_note_number: data.get("creditNoteNumber") || "",
        // reference_number not in schema, put in notes or reason
        credit_note_date: data.get("creditNoteDate"),
        // status not in schema? Checking db.sql... 
        // credit_notes: id, customer_id, invoice_id, credit_note_number, credit_note_date, reason, items, subtotal, tax, total, notes
        // No status column in credit_notes? 
        // Assuming no status for now.
        subtotal: parseFloat(data.get("amount") || "0"),
        total: parseFloat(data.get("amount") || "0"),
        tax: 0,
        items: [],
        reason: data.get("reason") || "",
        notes: (data.get("notes") || "") + (data.get("referenceNumber") ? `\nRef: ${data.get("referenceNumber")}` : ""),
      };

      try {
        const savedCN = await apiRequest('/sales/credit-notes', {
          method: 'POST',
          body: JSON.stringify(creditNoteData)
        });

        const frontendCN = {
          ...savedCN,
          customerId: savedCN.customer_id,
          creditNoteNumber: savedCN.credit_note_number,
          creditNoteDate: savedCN.credit_note_date,
          status: "Open" // Mock status or derive?
        };

        state.creditNotes.push(frontendCN);
        saveToLocalStorage();

        renderCreditNotes();
        addActivity(
          `Created credit note ${frontendCN.creditNoteNumber || frontendCN.id}`,
          "Sales - Credit Notes"
        );
        creditNoteForm.reset();
        alert("Credit Note created successfully!");
      } catch (error) {
        console.error('Error adding credit note:', error);
        alert('Failed to create credit note');
      }
    });
  }

  // Accounts subnav navigation
  const accountsSubnav = document.querySelector(".accounts-subnav");
  if (accountsSubnav) {
    const buttons = accountsSubnav.querySelectorAll(".subnav-item");
    const views = document.querySelectorAll(".accounts-subview");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.accountsSubview;

        buttons.forEach((b) => b.classList.remove("subnav-active"));
        btn.classList.add("subnav-active");

        views.forEach((v) => v.classList.remove("accounts-subview-active"));
        const viewEl = document.getElementById(target);
        if (viewEl) viewEl.classList.add("accounts-subview-active");
      });
    });
  }

  // Accounts - Vendors
  const vendorForm = document.getElementById("form-accounts-vendor");
  if (vendorForm) {
    vendorForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(vendorForm);
      const vendorData = {
        vendor_name: data.get("name").trim(),
        company_name: data.get("company")?.trim() || "",
        email: data.get("email")?.trim() || "",
        phone: data.get("phone")?.trim() || "",
        payment_terms: data.get("paymentTerms") || "Net 30",
        tax_id: data.get("taxId")?.trim() || "",
        address: data.get("address")?.trim() || "",
        // total_payable calculated by backend or 0 initially
      };

      try {
        const savedVendor = await apiRequest('/accounts/vendors', {
          method: 'POST',
          body: JSON.stringify(vendorData)
        });

        const frontendVendor = {
          ...savedVendor,
          name: savedVendor.vendor_name,
          company: savedVendor.company_name,
          paymentTerms: savedVendor.payment_terms,
          taxId: savedVendor.tax_id,
          totalPayable: 0
        };

        state.vendors.push(frontendVendor);
        saveToLocalStorage();

        renderAccountsVendors();
        addActivity(`Added vendor ${frontendVendor.company || frontendVendor.name}`, "Accounts - Vendors");
        vendorForm.reset();
        alert("Vendor created successfully!");
      } catch (error) {
        console.error('Error adding vendor:', error);
        alert('Failed to add vendor');
      }
    });
  }

  // Accounts - Expenses
  const expenseForm = document.getElementById("form-accounts-expense");
  if (expenseForm) {
    expenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(expenseForm);
      const expenseData = {
        expense_date: data.get("expenseDate"),
        vendor_id: data.get("vendorId") || null,
        category: data.get("category") || "",
        amount: parseFloat(data.get("amount") || "0"),
        payment_mode: (data.get("paymentMethod") || "cash").toLowerCase(), // Backend expects snake_case enum? Or string? DB says ENUM.
        reference_number: data.get("reference")?.trim() || "",
        notes: data.get("notes")?.trim() || "",
        description: "", // DB has description column
      };

      try {
        const savedExpense = await apiRequest('/accounts/expenses', {
          method: 'POST',
          body: JSON.stringify(expenseData)
        });

        const frontendExpense = {
          ...savedExpense,
          expenseDate: savedExpense.expense_date,
          vendorId: savedExpense.vendor_id,
          paymentMethod: savedExpense.payment_mode, // Adapt back if needed? Frontend uses "Cash" vs "cash"
          reference: savedExpense.reference_number
        };

        state.expenses.push(frontendExpense);
        saveToLocalStorage();

        renderAccountsExpenses();
        // Also update vendor total? Backend handles logic or we fetch fresh?
        // For local responsiveness we might need to fetch vendor again or update manually?
        // But expenses usually don't increase payable unless it's on credit? 
        // Logic says: state.expenses.push...

        addActivity(
          `Recorded expense: ${frontendExpense.category} - ₹${frontendExpense.amount.toFixed(2)}`,
          "Accounts - Expenses"
        );
        expenseForm.reset();
        alert("Expense recorded successfully!");
      } catch (error) {
        console.error('Error adding expense:', error);
        alert('Failed to record expense');
      }
    });
  }

  // Accounts - Bills
  const billForm = document.getElementById("form-accounts-bill");
  if (billForm) {
    billForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(billForm);
      const vendorId = data.get("vendorId");
      if (!vendorId) return;

      const billData = {
        vendor_id: vendorId,
        bill_number: data.get("billNumber")?.trim() || "",
        bill_date: data.get("billDate"),
        due_date: data.get("dueDate"),
        amount: parseFloat(data.get("amount") || "0"),
        subtotal: parseFloat(data.get("amount") || "0"),
        total: parseFloat(data.get("amount") || "0"),
        tax: 0,
        items: [],
        status: data.get("status") || "Unpaid",
        notes: data.get("notes")?.trim() || "",
      };

      try {
        const savedBill = await apiRequest('/accounts/bills', {
          method: 'POST',
          body: JSON.stringify(billData)
        });

        const frontendBill = {
          ...savedBill,
          vendorId: savedBill.vendor_id,
          billNumber: savedBill.bill_number,
          billDate: savedBill.bill_date,
          dueDate: savedBill.due_date,
        };

        state.bills.push(frontendBill);

        // Update vendor's total payable locally?
        const vendor = state.vendors.find(v => v.id == frontendBill.vendorId); // loose match for int/string
        if (vendor && frontendBill.status !== "Paid") {
          vendor.totalPayable = (vendor.totalPayable || 0) + frontendBill.amount;
        }

        saveToLocalStorage();
        renderAccountsBills();
        renderAccountsVendors();
        addActivity(
          `Created bill ${frontendBill.billNumber || frontendBill.id} - ₹${frontendBill.amount.toFixed(2)}`,
          "Accounts - Bills"
        );
        billForm.reset();
        alert("Bill created successfully!");
      } catch (error) {
        console.error('Error adding bill:', error);
        alert('Failed to create bill');
      }
    });
  }

  // Accounts - Purchase Orders
  const poForm = document.getElementById("form-accounts-purchase-order");
  if (poForm) {
    poForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(poForm);
      const vendorId = data.get("vendorId");
      if (!vendorId) return;

      const poData = {
        vendor_id: vendorId,
        po_number: data.get("poNumber")?.trim() || "",
        order_date: data.get("orderDate"),
        delivery_date: data.get("deliveryDate") || "",
        amount: parseFloat(data.get("amount") || "0"),
        status: data.get("status") || "Draft",
        notes: data.get("notes")?.trim() || "",
      };

      try {
        const savedPO = await apiRequest('/accounts/purchase-orders', {
          method: 'POST',
          body: JSON.stringify(poData)
        });

        const frontendPO = {
          ...savedPO,
          vendorId: savedPO.vendor_id,
          poNumber: savedPO.po_number,
          orderDate: savedPO.order_date,
          deliveryDate: savedPO.delivery_date,
        };

        state.purchaseOrders.push(frontendPO);
        saveToLocalStorage();
        renderAccountsPurchaseOrders();
        addActivity(
          `Created purchase order ${frontendPO.poNumber || frontendPO.id} - ₹${frontendPO.amount.toFixed(2)}`,
          "Accounts - Purchase Orders"
        );
        poForm.reset();
        alert("Purchase Order created successfully!");
      } catch (error) {
        console.error('Error adding purchase order:', error);
        alert('Failed to create purchase order');
      }
    });
  }
}

function seedSampleData() {
  const alice = {
    id: nextId(),
    name: "Alice Johnson",
    role: "Project Manager",
    department: "Operations",
    email: "alice@example.com",
  };
  const bob = {
    id: nextId(),
    name: "Bob Kumar",
    role: "Designer",
    department: "Marketing",
    email: "bob@example.com",
  };
  const carol = {
    id: nextId(),
    name: "Carol Singh",
    role: "Developer",
    department: "Client Service",
    email: "carol@example.com",
  };
  state.resources.push(alice, bob, carol);

  const proj1 = {
    id: nextId(),
    name: "Website Revamp 2025",
    type: "Client",
    department: "Marketing",
    priority: "high",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  };
  const proj2 = {
    id: nextId(),
    name: "CRM Rollout",
    type: "Internal",
    department: "Operations",
    priority: "medium",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };
  state.projects.push(proj1, proj2);

  const t1 = {
    id: nextId(),
    projectId: proj1.id,
    title: "Homepage redesign",
    description: "",
    estimate: 16,
  };
  const t2 = {
    id: nextId(),
    projectId: proj2.id,
    title: "User training",
    description: "",
    estimate: 24,
  };
  state.tasks.push(t1, t2);

  // Sample customers
  const cust1 = {
    id: nextId(),
    name: "John Smith Customer",
    company: "Summarize Labs",
    email: "john.smith@example.com",
    phone: "+1 202 555 0101",
    receivables: 504.0,
    credits: 0,
  };
  const cust2 = {
    id: nextId(),
    name: "Anya Enterprises",
    company: "Anya Enterprises",
    email: "accounts@anya.example",
    phone: "+1 202 555 0133",
    receivables: 487.0,
    credits: 0,
  };
  state.customers.push(cust1, cust2);

  const est1 = {
    id: nextId(),
    customerId: cust1.id,
    estimateNumber: "EST-62803",
    referenceNumber: "46096",
    estimateDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    currency: "INR",
    status: "Draft",
    items: [],
    amount: 504.0,
    customerNotes: "",
    terms: "",
  };
  const est2 = {
    id: nextId(),
    customerId: cust2.id,
    estimateNumber: "EST-26350",
    referenceNumber: "24171",
    estimateDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    currency: "INR",
    status: "Invoiced",
    items: [],
    amount: 487.0,
    customerNotes: "",
    terms: "",
  };
  state.estimates.push(est1, est2);

  const a1 = {
    id: nextId(),
    projectId: proj1.id,
    taskId: t1.id,
    resourceId: bob.id,
    dueDate: proj1.endDate,
    status: "in-progress",
  };
  const a2 = {
    id: nextId(),
    projectId: proj2.id,
    taskId: t2.id,
    resourceId: alice.id,
    dueDate: proj2.endDate,
    status: "completed",
    completedAt: new Date().toISOString(),
  };
  state.assignments.push(a1, a2);

  const share = {
    id: nextId(),
    assignmentId: a2.id,
    taskId: t2.id,
    resourceId: alice.id,
    message: "Initial CRM rollout schedule",
    sharedAt: new Date().toISOString(),
  };
  state.shares.push(share);

  // Accounts Module Sample Data
  // Vendors
  const vendor1 = { id: nextId(), name: "Sarah Miller", company: "Office Supplies Inc", email: "sales@officesuppliesinc.com", phone: "+1-555-0101", paymentTerms: "Net 30", taxId: "TAX12345678", address: "123 Business Park, Mumbai", totalPayable: 0 };
  const vendor2 = { id: nextId(), name: "Michael Chen", company: "Tech Solutions Ltd", email: "billing@techsolutions.com", phone: "+1-555-0102", paymentTerms: "Net 15", taxId: "TAX87654321", address: "456 Tech Plaza, Bangalore", totalPayable: 0 };
  const vendor3 = { id: nextId(), name: "Priya Sharma", company: "Cloud Services Pro", email: "accounts@cloudservices.pro", phone: "+1-555-0103", paymentTerms: "Net 30", taxId: "TAX11223344", address: "789 Cloud Tower, Hyderabad", totalPayable: 0 };
  const vendor4 = { id: nextId(), name: "David Wilson", company: "Marketing Masters", email: "invoices@marketingmasters.com", phone: "+1-555-0104", paymentTerms: "Net 45", taxId: "TAX44332211", address: "321 Creative Ave, Pune", totalPayable: 0 };
  const vendor5 = { id: nextId(), name: "Amit Patel", company: "Print & Design Co", email: "billing@printdesign.co", phone: "+1-555-0105", paymentTerms: "Due on receipt", taxId: "TAX55667788", address: "654 Art District, Delhi", totalPayable: 0 };
  const vendor6 = { id: nextId(), name: "Lisa Anderson", company: "Professional Consulting", email: "admin@profconsult.com", phone: "+1-555-0106", paymentTerms: "Net 30", taxId: "TAX99887766", address: "987 Consult Plaza, Chennai", totalPayable: 0 };
  const vendor7 = { id: nextId(), name: "Raj Kumar", company: "QuickTransport Services", email: "accounts@quicktransport.in", phone: "+1-555-0107", paymentTerms: "Net 15", taxId: "TAX33445566", address: "147 Logistics Hub, Kolkata", totalPayable: 0 };
  const vendor8 = { id: nextId(), name: "Emma Thompson", company: "Legal Advisory Group", email: "billing@legaladvisory.com", phone: "+1-555-0108", paymentTerms: "Net 60", taxId: "TAX77889900", address: "258 Law Towers, Mumbai", totalPayable: 0 };
  state.vendors.push(vendor1, vendor2, vendor3, vendor4, vendor5, vendor6, vendor7, vendor8);

  // Expenses (spanning last 3 months)
  const today = new Date();
  const exp1 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().slice(0, 10), vendorId: vendor1.id, category: "Office Supplies", amount: 4500.00, paymentMethod: "Credit Card", reference: "INV-OS-2024-001", notes: "Printer paper and stationery" };
  const exp2 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth(), 10).toISOString().slice(0, 10), vendorId: vendor2.id, category: "Software & Subscriptions", amount: 12000.00, paymentMethod: "Bank Transfer", reference: "SUB-2024-Q1", notes: "Annual software licenses" };
  const exp3 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().slice(0, 10), vendorId: vendor3.id, category: "Software & Subscriptions", amount: 8500.00, paymentMethod: "Credit Card", reference: "CLOUD-JAN-2024", notes: "Cloud hosting monthly fee" };
  const exp4 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 1, 28).toISOString().slice(0, 10), vendorId: vendor4.id, category: "Marketing", amount: 25000.00, paymentMethod: "Bank Transfer", reference: "CAMPAIGN-2024-001", notes: "Q1 digital marketing campaign" };
  const exp5 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().slice(0, 10), vendorId: vendor5.id, category: "Marketing", amount: 3200.00, paymentMethod: "UPI", reference: "PRINT-2024-002", notes: "Business cards and brochures" };
  const exp6 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 1, 12).toISOString().slice(0, 10), vendorId: vendor1.id, category: "Office Supplies", amount: 2100.00, paymentMethod: "Credit Card", reference: "INV-OS-2024-002", notes: "Office furniture accessories" };
  const exp7 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 2, 25).toISOString().slice(0, 10), vendorId: vendor6.id, category: "Professional Services", amount: 45000.00, paymentMethod: "Bank Transfer", reference: "CONSULT-2024-001", notes: "Business strategy consultation" };
  const exp8 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 2, 18).toISOString().slice(0, 10), vendorId: vendor7.id, category: "Travel", amount: 7800.00, paymentMethod: "Credit Card", reference: "TRANSPORT-2024-005", notes: "Client meeting transportation" };
  const exp9 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth(), 22).toISOString().slice(0, 10), vendorId: vendor3.id, category: "Software & Subscriptions", amount: 8500.00, paymentMethod: "Credit Card", reference: "CLOUD-FEB-2024", notes: "Cloud hosting monthly fee" };
  const exp10 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 1, 8).toISOString().slice(0, 10), vendorId: "", category: "Utilities", amount: 3500.00, paymentMethod: "Bank Transfer", reference: "ELECT-JAN-2024", notes: "Office electricity bill" };
  const exp11 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 2, 15).toISOString().slice(0, 10), vendorId: "", category: "Utilities", amount: 3200.00, paymentMethod: "Bank Transfer", reference: "ELECT-DEC-2023", notes: "Office electricity bill" };
  const exp12 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth(), 3).toISOString().slice(0, 10), vendorId: vendor8.id, category: "Professional Services", amount: 18000.00, paymentMethod: "Bank Transfer", reference: "LEGAL-2024-001", notes: "Legal compliance review" };
  const exp13 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().slice(0, 10), vendorId: "", category: "Meals & Entertainment", amount: 5200.00, paymentMethod: "Credit Card", reference: "TEAM-LUNCH-2024", notes: "Team lunch and client dinner" };
  const exp14 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth(), 18).toISOString().slice(0, 10), vendorId: vendor2.id, category: "Software & Subscriptions", amount: 6500.00, paymentMethod: "Credit Card", reference: "SOFTWARE-2024-003", notes: "Project management tools" };
  const exp15 = { id: nextId(), expenseDate: new Date(today.getFullYear(), today.getMonth() - 2, 5).toISOString().slice(0, 10), vendorId: vendor1.id, category: "Office Supplies", amount: 1800.00, paymentMethod: "Cash", reference: "MISC-2023-12", notes: "Miscellaneous supplies" };
  state.expenses.push(exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8, exp9, exp10, exp11, exp12, exp13, exp14, exp15);

  // Bills
  const bill1 = { id: nextId(), vendorId: vendor2.id, billNumber: "BILL-2024-001", billDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10), dueDate: new Date(today.getFullYear(), today.getMonth(), 16).toISOString().slice(0, 10), amount: 12000.00, status: "Paid", notes: "Software licenses - Paid on time" };
  const bill2 = { id: nextId(), vendorId: vendor3.id, billNumber: "BILL-2024-002", billDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10), dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10), amount: 8500.00, status: "Unpaid", notes: "Monthly hosting - February" };
  const bill3 = { id: nextId(), vendorId: vendor4.id, billNumber: "BILL-2024-003", billDate: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().slice(0, 10), dueDate: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().slice(0, 10), amount: 25000.00, status: "Partially Paid", notes: "Marketing campaign - 50% paid" };
  const bill4 = { id: nextId(), vendorId: vendor6.id, billNumber: "BILL-2024-004", billDate: new Date(today.getFullYear(), today.getMonth() - 2, 15).toISOString().slice(0, 10), dueDate: new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().slice(0, 10), amount: 45000.00, status: "Paid", notes: "Consultation services - Completed" };
  const bill5 = { id: nextId(), vendorId: vendor8.id, billNumber: "BILL-2024-005", billDate: new Date(today.getFullYear(), today.getMonth() - 1, 10).toISOString().slice(0, 10), dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 10).toISOString().slice(0, 10), amount: 18000.00, status: "Unpaid", notes: "Legal services - Due in 60 days" };
  const bill6 = { id: nextId(), vendorId: vendor1.id, billNumber: "BILL-2024-006", billDate: new Date(today.getFullYear(), today.getMonth() - 3, 28).toISOString().slice(0, 10), dueDate: new Date(today.getFullYear(), today.getMonth() - 2, 28).toISOString().slice(0, 10), amount: 4500.00, status: "Overdue", notes: "Office supplies - Payment pending" };
  state.bills.push(bill1, bill2, bill3, bill4, bill5, bill6);

  // Update vendor payables based on unpaid bills
  vendor3.totalPayable += bill2.amount;
  vendor4.totalPayable += bill3.amount * 0.5; // Partially paid
  vendor8.totalPayable += bill5.amount;
  vendor1.totalPayable += bill6.amount;

  // Purchase Orders
  const po1 = { id: nextId(), vendorId: vendor1.id, poNumber: "PO-2024-001", orderDate: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().slice(0, 10), deliveryDate: new Date(today.getFullYear(), today.getMonth(), 25).toISOString().slice(0, 10), amount: 8500.00, status: "Sent", notes: "Office furniture order" };
  const po2 = { id: nextId(), vendorId: vendor2.id, poNumber: "PO-2024-002", orderDate: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().slice(0, 10), deliveryDate: new Date(today.getFullYear(), today.getMonth() + 1, 15).toISOString().slice(0, 10), amount: 35000.00, status: "Draft", notes: "Hardware upgrade - Pending approval" };
  const po3 = { id: nextId(), vendorId: vendor5.id, poNumber: "PO-2024-003", orderDate: new Date(today.getFullYear(), today.getMonth() - 1, 8).toISOString().slice(0, 10), deliveryDate: new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString().slice(0, 10), amount: 6200.00, status: "Received", notes: "Marketing materials - Delivered" };
  const po4 = { id: nextId(), vendorId: vendor3.id, poNumber: "PO-2024-004", orderDate: new Date(today.getFullYear(), today.getMonth(), 18).toISOString().slice(0, 10), deliveryDate: "", amount: 15000.00, status: "Draft", notes: "Cloud infrastructure expansion" };
  const po5 = { id: nextId(), vendorId: vendor7.id, poNumber: "PO-2024-005", orderDate: new Date(today.getFullYear(), today.getMonth() - 2, 10).toISOString().slice(0, 10), deliveryDate: new Date(today.getFullYear(), today.getMonth() - 2, 12).toISOString().slice(0, 10), amount: 4200.00, status: "Cancelled", notes: "Transportation services - Cancelled due to schedule change" };
  state.purchaseOrders.push(po1, po2, po3, po4, po5);

  addActivity(
    "Sample data loaded (resources, projects, tasks, assignments).",
    "System seed"
  );
}

function initialRender() {
  renderResources();
  renderMarketing();
  renderHR();
  renderService();
  renderCharts();
  renderAssignments();
  renderShares();
  renderDepartmentStats();
  renderAdminDashboard();
  renderGlobalKPIs();
  renderSalesCustomers();
  renderSalesEstimates();
  renderSalesOrders();
  renderDeliveryChallans();
  renderInvoices();
  renderPayments();
  renderRecurringInvoices();
  renderCreditNotes();
  // New Modules
  renderMarketing();
  // Accounts renders
  renderAccountsVendors();
  renderAccountsExpenses();
  renderAccountsBills();
  renderAccountsPurchaseOrders();
  renderAccountsActivity();
  renderTemplates();
}

// ========== TEMPLATE MANAGEMENT FUNCTIONS ==========

// Render Templates
function renderTemplates() {
  const table = document.querySelector("#table-templates tbody");
  const selectTemplateForEstimate = document.getElementById("select-template-for-estimate");

  if (!table) return;

  table.innerHTML = "";

  if (selectTemplateForEstimate) {
    selectTemplateForEstimate.innerHTML = '<option value="">-- Select Template --</option>';
  }

  state.estimateTemplates.forEach((t) => {
    const tr = document.createElement("tr");
    const statusBadge = t.is_active || t.isActive
      ? '<span class="status-pill status-pill--completed">Active</span>'
      : '<span class="status-pill status-pill--pending">Inactive</span>';

    tr.innerHTML = `
      <td>${t.template_name || t.templateName}</td>
      <td>${t.category}</td>
      <td>${t.base_duration || t.baseDuration} min</td>
      <td>₹${parseFloat(t.base_rate || t.baseRate).toFixed(2)}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="table-button" data-edit-template="${t.id}">Edit</button>
        <button class="table-button table-button--danger" data-delete-template="${t.id}">Delete</button>
      </td>
    `;
    table.appendChild(tr);

    // Add to estimate template selector (only active templates)
    if ((t.is_active || t.isActive) && selectTemplateForEstimate) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.template_name || t.templateName} - ₹${parseFloat(t.base_rate || t.baseRate).toFixed(2)}/min`;
      opt.dataset.template = JSON.stringify(t);
      selectTemplateForEstimate.appendChild(opt);
    }
  });
}

// Handle Template Form Submission
async function handleTemplateFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const templateData = {
    template_name: formData.get('templateName'),
    category: formData.get('category'),
    description: formData.get('description'),
    base_duration: parseInt(formData.get('baseDuration')),
    base_rate: parseFloat(formData.get('baseRate')),
    currency: formData.get('currency'),
    discount: parseFloat(formData.get('discount') || 0),
    tax: parseFloat(formData.get('tax') || 0),
    is_active: formData.get('isActive') === 'true'
  };

  try {
    const templateId = form.dataset.editingId;

    if (templateId) {
      // Update existing template
      const updated = await apiRequest(`/templates/${templateId}?admin=true`, {
        method: 'PUT',
        body: JSON.stringify(templateData),
        headers: { 'x-user-role': 'admin' }
      });

      const index = state.estimateTemplates.findIndex(t => t.id == templateId);
      if (index !== -1) {
        state.estimateTemplates[index] = {
          ...updated,
          templateName: updated.template_name,
          baseDuration: updated.base_duration,
          baseRate: updated.base_rate,
          isActive: updated.is_active
        };
      }

      alert('Template updated successfully!');
    } else {
      // Create new template
      const created = await apiRequest('/templates?admin=true', {
        method: 'POST',
        body: JSON.stringify(templateData),
        headers: { 'x-user-role': 'admin' }
      });

      state.estimateTemplates.push({
        ...created,
        templateName: created.template_name,
        baseDuration: created.base_duration,
        baseRate: created.base_rate,
        isActive: created.is_active
      });

      alert('Template created successfully!');
    }

    form.reset();
    delete form.dataset.editingId;
    renderTemplates();
  } catch (error) {
    console.error('Error saving template:', error);
    alert('Failed to save template: ' + error.message);
  }
}

// Handle Template Edit
function handleTemplateEdit(templateId) {
  const template = state.estimateTemplates.find(t => t.id == templateId);
  if (!template) return;

  const form = document.getElementById('form-template');
  form.dataset.editingId = templateId;

  form.elements['templateName'].value = template.template_name || template.templateName;
  form.elements['category'].value = template.category;
  form.elements['description'].value = template.description || '';
  form.elements['baseDuration'].value = template.base_duration || template.baseDuration;
  form.elements['baseRate'].value = template.base_rate || template.baseRate;
  form.elements['currency'].value = template.currency || 'INR';
  form.elements['discount'].value = template.discount || 0;
  form.elements['tax'].value = template.tax || 0;
  form.elements['isActive'].value = (template.is_active || template.isActive) ? 'true' : 'false';

  form.scrollIntoView({ behavior: 'smooth' });
}

// Handle Template Delete
async function handleTemplateDelete(templateId) {
  if (!confirm('Are you sure you want to delete this template?')) return;

  try {
    await apiRequest(`/templates/${templateId}?admin=true`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'admin' }
    });

    state.estimateTemplates = state.estimateTemplates.filter(t => t.id != templateId);
    renderTemplates();
    alert('Template deleted successfully!');
  } catch (error) {
    console.error('Error deleting template:', error);
    alert('Failed to delete template: ' + error.message);
  }
}

// Use Template in Estimate
function handleUseTemplate() {
  const select = document.getElementById('select-template-for-estimate');
  const selectedOption = select.options[select.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    alert('Please select a template first');
    return;
  }

  const template = JSON.parse(selectedOption.dataset.template);
  const form = document.getElementById('form-sales-estimate');

  // Populate first row item details from template
  const descriptions = form.querySelectorAll('input[name="itemDescription"]');
  const quantities = form.querySelectorAll('input[name="quantity"]');
  const rates = form.querySelectorAll('input[name="rate"]');
  const discounts = form.querySelectorAll('input[name="discount"]');
  const taxes = form.querySelectorAll('input[name="tax"]');

  if (descriptions[0]) descriptions[0].value = template.template_name || template.templateName;
  if (quantities[0]) quantities[0].value = template.base_duration || template.baseDuration || 1;
  if (rates[0]) rates[0].value = template.base_rate || template.baseRate || 0;
  if (discounts[0]) discounts[0].value = template.discount || 0;
  if (taxes[0]) taxes[0].value = template.tax || 0;

  updateEstimateSubtotal();
  alert('Template applied successfully!');
}

// Update Estimate Subtotal
function updateEstimateSubtotal() {
  const form = document.getElementById('form-sales-estimate');
  if (!form) return;

  const quantities = form.querySelectorAll('input[name="quantity"]');
  const rates = form.querySelectorAll('input[name="rate"]');
  const discounts = form.querySelectorAll('input[name="discount"]');
  const taxes = form.querySelectorAll('input[name="tax"]');

  let totalEstimateAmount = 0;

  for (let i = 0; i < quantities.length; i++) {
    const qty = parseFloat(quantities[i].value) || 0;
    const rate = parseFloat(rates[i]?.value) || 0;
    const disc = parseFloat(discounts[i]?.value) || 0;
    const tax = parseFloat(taxes[i]?.value) || 0;

    const rowSubtotal = qty * rate;
    const rowDiscountAmount = (rowSubtotal * disc) / 100;
    const rowTaxableAmount = rowSubtotal - rowDiscountAmount;
    const rowTaxAmount = (rowTaxableAmount * tax) / 100;
    const rowTotal = rowTaxableAmount + rowTaxAmount;

    totalEstimateAmount += rowTotal;
  }

  const subtotalDisplay = document.getElementById('estimate-subtotal-display');
  if (subtotalDisplay) {
    subtotalDisplay.textContent = totalEstimateAmount.toFixed(2);
  }
}

// Setup Template Event Listeners
function setupTemplateEventListeners() {
  // Template form submission
  const templateForm = document.getElementById('form-template');
  if (templateForm) {
    templateForm.addEventListener('submit', handleTemplateFormSubmit);
  }

  // Use template button
  const useTemplateBtn = document.getElementById('btn-use-template');
  if (useTemplateBtn) {
    useTemplateBtn.addEventListener('click', handleUseTemplate);
  }

  // Template table actions (using event delegation)
  const templateTable = document.getElementById('table-templates');
  if (templateTable) {
    templateTable.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-template]');
      const deleteBtn = e.target.closest('[data-delete-template]');

      if (editBtn) {
        handleTemplateEdit(editBtn.dataset.editTemplate);
      } else if (deleteBtn) {
        handleTemplateDelete(deleteBtn.dataset.deleteTemplate);
      }
    });
  }
}

// Handle Add Row in Estimates
function handleAddEstimateRow() {
  const itemsGrid = document.querySelector('.estimate-items-grid');
  if (!itemsGrid) return;

  // Create a new row of item fields
  const newRow = document.createElement('div');
  newRow.className = 'estimate-items-grid sales-row-separator';

  newRow.innerHTML = `
    <label class="sales-label">
      Item Details
      <input type="text" name="itemDescription" class="sales-input" placeholder="Type or click to select an item" />
    </label>
    <label class="sales-label">
      Quantity
      <input type="number" name="quantity" class="sales-input" min="1" step="1" value="1" />
    </label>
    <label class="sales-label">
      Rate
      <input type="number" name="rate" class="sales-input" min="0" step="0.01" placeholder="0.00" />
    </label>
    <label class="sales-label">
      Discount (%)
      <input type="number" name="discount" class="sales-input" min="0" max="100" step="0.01" value="0" />
    </label>
    <label class="sales-label">
      Tax (%)
      <input type="number" name="tax" class="sales-input" min="0" max="100" step="0.01" value="0" />
    </label>
    <label class="sales-label" style="display: flex; align-items: flex-end;">
      <button type="button" class="btn-sales-secondary btn-remove-row">
        Remove Row
      </button>
    </label>
  `;

  // Insert after the existing items grid
  itemsGrid.parentNode.insertBefore(newRow, itemsGrid.nextSibling);

  // Add event listener to the new remove button
  newRow.querySelector('.btn-remove-row').addEventListener('click', () => {
    newRow.remove();
    updateEstimateSubtotal();
  });
}

// ========== END TEMPLATE MANAGEMENT FUNCTIONS ==========

window.addEventListener("DOMContentLoaded", async () => {
  // ── Topbar: show logged-in user ─────────────────────────────────────────
  const session = getSession();
  const avatarEl   = document.getElementById('user-avatar');
  const nameEl     = document.getElementById('topbar-username');
  const badgeEl    = document.getElementById('topbar-role-badge');

  if (session) {
    const displayName = session.name || session.username || 'User';
    const role        = session.role || 'user';
    if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();
    if (nameEl)   nameEl.textContent = displayName;
    if (badgeEl) {
      badgeEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      badgeEl.className = 'user-role-badge role-' + role;
    }
    state.currentUser = { role, username: session.username, name: displayName };
  }

  // ── Role-based nav restrictions ─────────────────────────────────────────
  // Admin: full access. Manager: no HR. User: only Sales, Service, Accounts views.
  const role = state.currentUser.role;
  if (role !== 'admin') {
    // Hide HR from non-admins
    const hrBtn = document.querySelector('[data-view="hr"]');
    if (hrBtn && role === 'user') hrBtn.style.display = 'none';
  }

  // ── Logout button ───────────────────────────────────────────────────────
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to logout?")) {
        logout();
      }
    });
  }

  // ── Navigation setup ────────────────────────────────────────────────────
  setupMainNavigation();
  setupOperationsSubnav();
  setupSalesSubnav();
  setupForms();
  setupTemplateEventListeners();

  // Additional event listeners for templates and estimates
  const addRowBtn = document.getElementById('btn-add-estimate-row');
  if (addRowBtn) {
    addRowBtn.addEventListener('click', () => {
      handleAddEstimateRow();
    });
  }

  // Use event delegation for estimate form calculations
  const estimateForm = document.getElementById('form-sales-estimate');
  if (estimateForm) {
    estimateForm.addEventListener('input', (e) => {
      if (['quantity', 'rate', 'discount', 'tax'].includes(e.target.name)) {
        updateEstimateSubtotal();
      }
    });
    estimateForm.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-row')) {
        e.target.closest('.estimate-items-grid').remove();
        updateEstimateSubtotal();
      }
    });
  }

  // ── Load data: API first, then localStorage offline fallback ─────────────
  let loaded = false;
  try {
    loaded = await loadDataFromAPI();
  } catch(e) {
    loaded = false;
  }

  if (!loaded) {
    // Offline: restore from localStorage CRM data snapshot
    console.info('[CRMM] API unavailable – loading from localStorage cache.');
    loadFromLocalStorageCache();
  }

  initialRender();

  // ── Save to localStorage whenever state changes (offline persistence) ───
  // We patch addActivity so every data change auto-saves
  const _origAddActivity = addActivity;
  window._crmmAutoSave = function() {
    try {
      const snapshot = {
        resources:        state.resources,
        projects:         state.projects,
        tasks:            state.tasks,
        assignments:      state.assignments,
        customers:        state.customers,
        estimates:        state.estimates,
        salesOrders:      state.salesOrders,
        deliveryChallans: state.deliveryChallans,
        invoices:         state.invoices,
        payments:         state.payments,
        recurringInvoices:state.recurringInvoices,
        creditNotes:      state.creditNotes,
        vendors:          state.vendors,
        expenses:         state.expenses,
        bills:            state.bills,
        purchaseOrders:   state.purchaseOrders,
        estimateTemplates:state.estimateTemplates,
        marketingCampaigns:state.marketingCampaigns,
        employees:        state.employees,
        serviceTickets:   state.serviceTickets,
        activity:         state.activity.slice(0, 50)
      };
      localStorage.setItem(CRM_DATA_KEY, JSON.stringify(snapshot));
    } catch(e) {
      console.warn('[CRMM] Could not save to localStorage (quota?):', e);
    }
  };

  // Set Operations view and Projects subview as active by default
  const operationsView = document.getElementById("view-operations");
  const operationsBtn = document.querySelector('[data-view="operations"]');
  if (operationsView && operationsBtn) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("view-active"));
    operationsView.classList.add("view-active");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    operationsBtn.classList.add("active");
  }
});

// ─── Offline: load CRM data from localStorage cache ────────────────────────────
function loadFromLocalStorageCache() {
  try {
    const raw = localStorage.getItem(CRM_DATA_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    if (snap.resources)         state.resources         = snap.resources;
    if (snap.projects)          state.projects          = snap.projects;
    if (snap.tasks)             state.tasks             = snap.tasks;
    if (snap.assignments)       state.assignments       = snap.assignments;
    if (snap.customers)         state.customers         = snap.customers;
    if (snap.estimates)         state.estimates         = snap.estimates;
    if (snap.salesOrders)       state.salesOrders       = snap.salesOrders;
    if (snap.deliveryChallans)  state.deliveryChallans  = snap.deliveryChallans;
    if (snap.invoices)          state.invoices          = snap.invoices;
    if (snap.payments)          state.payments          = snap.payments;
    if (snap.recurringInvoices) state.recurringInvoices = snap.recurringInvoices;
    if (snap.creditNotes)       state.creditNotes       = snap.creditNotes;
    if (snap.vendors)           state.vendors           = snap.vendors;
    if (snap.expenses)          state.expenses          = snap.expenses;
    if (snap.bills)             state.bills             = snap.bills;
    if (snap.purchaseOrders)    state.purchaseOrders    = snap.purchaseOrders;
    if (snap.estimateTemplates) state.estimateTemplates = snap.estimateTemplates;
    if (snap.marketingCampaigns) state.marketingCampaigns = snap.marketingCampaigns;
    if (snap.employees)         state.employees         = snap.employees;
    if (snap.serviceTickets)    state.serviceTickets    = snap.serviceTickets;
    if (snap.activity)          state.activity          = snap.activity;
    console.info('[CRMM] Loaded from localStorage cache:', Object.keys(snap));
  } catch(e) {
    console.warn('[CRMM] Could not parse localStorage cache:', e);
  }
}