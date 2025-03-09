// Global variable to store alignments
let currentAlignments = {};

// Initialize alignments from the server data
function initializeAlignments(alignments) {
    currentAlignments = alignments || {};
    renderAlignments();
}

// Make text editable in-place
function makeEditable(element, variable, alignment = null) {
    const originalText = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'form-control form-control-sm';
    input.style.width = '150px';
    input.style.display = 'inline-block';
    
    // Replace the span with the input
    element.parentNode.replaceChild(input, element);
    input.focus();
    
    function saveEdit() {
        const newValue = input.value.trim();
        if (newValue && newValue !== originalText) {
            if (alignment) {
                // Editing an alignment value
                const alignments = currentAlignments[variable];
                const index = alignments.indexOf(originalText);
                if (index !== -1) {
                    alignments[index] = newValue;
                }
            } else {
                // Editing a variable name
                if (currentAlignments[originalText]) {
                    currentAlignments[newValue] = currentAlignments[originalText];
                    delete currentAlignments[originalText];
                }
            }
            saveAlignments();
        }
        renderAlignments();
    }
    
    // Handle enter key and blur events
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        }
    });
    
    input.addEventListener('blur', saveEdit);
}

// Add a new alignment
function addAlignment() {
    const variableInput = document.getElementById('new-variable');
    const alignmentInput = document.getElementById('new-alignment');
    
    const variable = variableInput.value.trim();
    let alignment = alignmentInput.value.trim();
    
    if (!variable || !alignment) {
        alert('Both variable and alignment are required');
        return;
    }
    
    // Format alignment as range if it's a single number
    if (/^\d+$/.test(alignment)) {
        alignment = `${alignment}-${alignment}`;
        console.log(`Formatted alignment as range: ${alignment}`);
    }
    
    if (!currentAlignments[variable]) {
        currentAlignments[variable] = [];
    }
    
    if (!currentAlignments[variable].includes(alignment)) {
        currentAlignments[variable].push(alignment);
        saveAlignments();
        renderAlignments();
        
        // Show a success message
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success mt-2';
        successMsg.innerHTML = `Alignment added: ${variable} ↔ ${alignment}`;
        document.querySelector('.add-alignment').appendChild(successMsg);
        
        // Remove the message after 2 seconds
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 2000);
    }
    
    // Clear inputs
    variableInput.value = '';
    alignmentInput.value = '';
}

// Delete a specific alignment value
function deleteAlignmentValue(variable, alignment) {
    if (currentAlignments[variable]) {
        currentAlignments[variable] = currentAlignments[variable].filter(a => a !== alignment);
        if (currentAlignments[variable].length === 0) {
            delete currentAlignments[variable];
        }
        saveAlignments();
        renderAlignments();
    }
}

// Edit an alignment
function editAlignment(variable) {
    const alignments = currentAlignments[variable];
    if (!alignments) return;
    
    const newAlignment = prompt('Add a new alignment to this variable:', '');
    if (newAlignment && newAlignment.trim()) {
        if (!alignments.includes(newAlignment)) {
            alignments.push(newAlignment.trim());
            saveAlignments();
            renderAlignments();
        }
    }
}

// Save alignments to the server
function saveAlignments() {
    // Send alignments to server
    fetch('/save_alignments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            doc_version_id: document.getElementById('doc_version_id').value,
            sent_id: document.getElementById('snt_id').value,
            alignments: currentAlignments
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Alignments saved successfully');
        } else {
            console.error('Error saving alignments:', data.error);
        }
    })
    .catch(error => {
        console.error('Error saving alignments:', error);
    });
}

// Render alignments in the UI
function renderAlignments() {
    const container = document.querySelector('.alignments-display');
    if (!container) return;
    
    if (Object.keys(currentAlignments).length === 0) {
        container.innerHTML = '<div class="alert alert-info mb-0">No alignments available for this sentence.</div>';
        return;
    }
    
    let html = '';
    for (const [variable, alignments] of Object.entries(currentAlignments)) {
        html += `
            <div class="alignment-item" data-variable="${variable}">
                <div class="d-flex align-items-center mb-2">
                    <span class="variable badge bg-primary me-2">${variable}</span>
                    <div class="alignments-list d-flex flex-wrap">
                        ${alignments.map(alignment => `
                            <div class="alignment-item d-flex align-items-center me-3 mb-1" style="gap: 15px;">
                                <span class="alignment badge bg-secondary" onclick="makeEditable(this, '${variable}', '${alignment}')">${alignment}</span>
                                <button class="btn btn-sm btn-danger" onclick="deleteAlignmentValue('${variable}', '${alignment}')">×</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
} 