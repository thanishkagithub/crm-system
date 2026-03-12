// Template Management Functions
// Add these functions to app.js

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

    const itemRows = form.querySelectorAll('.template-item-row');
    const items = [];
    itemRows.forEach(row => {
        const desc = row.querySelector('input[name="itemDescription"]').value.trim();
        if (!desc) return;
        items.push({
            description: desc,
            quantity: parseFloat(row.querySelector('input[name="quantity"]').value) || 1,
            rate: parseFloat(row.querySelector('input[name="rate"]').value) || 0,
            discount: parseFloat(row.querySelector('input[name="discount"]').value) || 0,
            tax: parseFloat(row.querySelector('input[name="tax"]').value) || 0
        });
    });

    const templateData = {
        template_name: formData.get('templateName'),
        category: formData.get('category'),
        description: formData.get('description'),
        base_duration: parseInt(formData.get('baseDuration')),
        base_rate: parseFloat(formData.get('baseRate')),
        currency: formData.get('currency'),
        discount: parseFloat(formData.get('discount') || 0),
        tax: parseFloat(formData.get('tax') || 0),
        is_active: formData.get('isActive') === 'true',
        items: items
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

    // Handle items
    const container = document.getElementById('template-items-container');
    container.innerHTML = '';
    const items = template.items || [];

    if (items.length === 0) {
        handleAddTemplateItem(); // Add one empty row
    } else {
        items.forEach(item => {
            handleAddTemplateItem(item);
        });
    }

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

    // Clear existing rows (keep first one)
    const itemsGrid = form.querySelectorAll('.estimate-items-grid');
    itemsGrid.forEach((grid, index) => {
        if (index > 0) grid.remove();
    });

    const items = template.items || [];
    if (items.length === 0) {
        // Fallback for old templates without items
        form.elements['itemDescription'].value = template.template_name || template.templateName;
        form.elements['quantity'].value = template.base_duration || template.baseDuration || 1;
        form.elements['rate'].value = template.base_rate || template.baseRate || 0;
        form.elements['discount'].value = template.discount || 0;
        form.elements['tax'].value = template.tax || 0;
    } else {
        items.forEach((item, index) => {
            if (index === 0) {
                // Populate first row
                form.elements['itemDescription'].value = item.description;
                form.elements['quantity'].value = item.quantity;
                form.elements['rate'].value = item.rate;
                form.elements['discount'].value = item.discount;
                form.elements['tax'].value = item.tax;
            } else {
                // Add new rows for others
                handleAddEstimateRowWithData(item);
            }
        });
    }

    // Calculate and update subtotal
    updateEstimateSubtotal();
    alert('Template applied successfully!');
}

// Helper to add estimate row with data
function handleAddEstimateRowWithData(item) {
    const form = document.getElementById('form-sales-estimate');
    const itemsGrid = form.querySelector('.estimate-items-grid');
    if (!itemsGrid) return;

    const newRow = document.createElement('div');
    newRow.className = 'estimate-items-grid sales-row-separator';

    newRow.innerHTML = `
    <label class="sales-label">
      Item Details
      <input type="text" name="itemDescription" class="sales-input" value="${item.description}" />
    </label>
    <label class="sales-label">
      Quantity
      <input type="number" name="quantity" class="sales-input" value="${item.quantity}" />
    </label>
    <label class="sales-label">
      Rate
      <input type="number" name="rate" class="sales-input" value="${item.rate}" />
    </label>
    <label class="sales-label">
      Discount (%)
      <input type="number" name="discount" class="sales-input" value="${item.discount}" />
    </label>
    <label class="sales-label">
      Tax (%)
      <input type="number" name="tax" class="sales-input" value="${item.tax}" />
    </label>
    <label class="sales-label" style="display: flex; align-items: flex-end;">
      <button type="button" class="btn-sales-secondary btn-remove-row">
        Remove Row
      </button>
    </label>
  `;
    itemsGrid.parentNode.insertBefore(newRow, itemsGrid.nextSibling);
}

// Helper to add template item row
function handleAddTemplateItem(item = null) {
    const container = document.getElementById('template-items-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'estimate-items-grid template-item-row sales-row-separator';

    div.innerHTML = `
        <label class="sales-label">
            Item Description
            <input type="text" name="itemDescription" class="sales-input" value="${item ? item.description : ''}" placeholder="Description of service item" />
        </label>
        <label class="sales-label">
            Quantity
            <input type="number" name="quantity" class="sales-input" min="1" step="1" value="${item ? item.quantity : 1}" />
        </label>
        <label class="sales-label">
            Rate
            <input type="number" name="rate" class="sales-input" min="0" step="0.01" value="${item ? item.rate : 0}" />
        </label>
        <label class="sales-label">
            Discount (%)
            <input type="number" name="discount" class="sales-input" min="0" max="100" step="0.01" value="${item ? item.discount : 0}" />
        </label>
        <label class="sales-label">
            Tax (%)
            <input type="number" name="tax" class="sales-input" min="0" max="100" step="0.01" value="${item ? item.tax : 0}" />
        </label>
        <label class="sales-label" style="display: flex; align-items: flex-end;">
            <button type="button" class="btn-sales-secondary btn-remove-row">
                Remove
            </button>
        </label>
    `;
    container.appendChild(div);
}

// Update Estimate Subtotal (helper function)
function updateEstimateSubtotal() {
    const form = document.getElementById('form-sales-estimate');
    const quantity = parseFloat(form.elements['quantity'].value) || 0;
    const rate = parseFloat(form.elements['rate'].value) || 0;
    const discount = parseFloat(form.elements['discount'].value) || 0;
    const tax = parseFloat(form.elements['tax'].value) || 0;

    const subtotal = quantity * rate;
    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * tax) / 100;
    const total = taxableAmount + taxAmount;

    const subtotalDisplay = document.getElementById('estimate-subtotal-display');
    if (subtotalDisplay) {
        subtotalDisplay.textContent = total.toFixed(2);
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

    // Add template item button
    const addTemplateItemBtn = document.getElementById('btn-add-template-item');
    if (addTemplateItemBtn) {
        addTemplateItemBtn.addEventListener('click', () => handleAddTemplateItem());
    }

    // Template item removal
    const templateContainer = document.getElementById('template-items-container');
    if (templateContainer) {
        templateContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove-row')) {
                e.target.closest('.template-item-row').remove();
            }
        });
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

    // Auto-calculate estimate subtotal on input changes (delegate to form)
    const estimateForm = document.getElementById('form-sales-estimate');
    if (estimateForm) {
        estimateForm.addEventListener('input', (e) => {
            if (['quantity', 'rate', 'discount', 'tax'].includes(e.target.name)) {
                updateEstimateSubtotal();
            }
        });
    }
}
