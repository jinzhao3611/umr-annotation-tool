/**
 * Temporary Branch Storage functionality
 * Allows storing tree branches temporarily across sentences in a document
 */

// Function to show notification
function showNotification(message, type, duration = 3000) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.color = '#fff';
    notification.style.zIndex = '2000';
    
    if (type === 'success') {
        notification.style.backgroundColor = '#4caf50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else if (type === 'info') {
        notification.style.backgroundColor = '#2196f3';
    } else {
        notification.style.backgroundColor = '#2196f3';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after specified duration
    setTimeout(() => {
        notification.remove();
    }, duration);
}


// Key for storing branches in localStorage, will be combined with docVersionId
const STORAGE_KEY_PREFIX = 'umr_temp_branches_';

// Initialize temporary branch storage
function initTempBranchStorage() {
    console.log('Initializing temporary branch storage');
    
    // Load existing branches
    loadTempBranches();
    
    // Add event listener to the UMR area for right-click to store branch
    const amrElement = document.querySelector('#amr pre');
    if (amrElement) {
        setupTempStorageContextMenu(amrElement);
    }
}

// Get the storage key for the current document
function getTempBranchStorageKey() {
    const docVersionId = document.getElementById('doc_version_id').value;
    return `${STORAGE_KEY_PREFIX}${docVersionId}`;
}

// Load temporary branches from localStorage
function loadTempBranches() {
    const storageKey = getTempBranchStorageKey();
    const storedBranches = localStorage.getItem(storageKey);
    
    if (storedBranches) {
        try {
            const branches = JSON.parse(storedBranches);
            renderTempBranches(branches);
        } catch (e) {
            console.error('Error loading temporary branches:', e);
            localStorage.removeItem(storageKey); // Clear invalid data
        }
    }
}

// Save branches to localStorage
function saveTempBranches(branches) {
    const storageKey = getTempBranchStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(branches));
}

// Render temporary branches in the UI
function renderTempBranches(branches) {
    const container = document.getElementById('temp-branches-container');
    if (!container) return;
    
    // Clear current content
    container.innerHTML = '';
    
    if (!branches || branches.length === 0) {
        container.innerHTML = `
            <div class="empty-state text-center text-muted p-3">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>No branches stored yet</p>
            </div>
        `;
        return;
    }
    
    // Create branch items
    branches.forEach((branch, index) => {
        const branchItem = document.createElement('div');
        branchItem.className = 'temp-branch-item mb-3 p-2 border rounded';
        
        // Branch content with syntax highlighting
        const branchContent = document.createElement('pre');
        branchContent.className = 'mb-1 p-2 bg-light';
        branchContent.style.maxHeight = '150px';
        branchContent.style.overflow = 'auto';
        branchContent.style.fontSize = '0.85rem';
        branchContent.style.whiteSpace = 'pre-wrap';
        branchContent.style.wordBreak = 'break-all';
        branchContent.textContent = branch.content;
        
        // Branch description (if provided)
        let descriptionHtml = '';
        if (branch.description) {
            descriptionHtml = `
                <div class="branch-description mb-2 small text-muted">
                    ${branch.description}
                </div>
            `;
        }
        
        // Branch metadata
        const metadata = document.createElement('div');
        metadata.className = 'branch-metadata d-flex justify-content-between align-items-center small text-muted mb-2';
        metadata.innerHTML = `
            <span>From sentence #${branch.sentenceId}</span>
            <span>${new Date(branch.timestamp).toLocaleString()}</span>
        `;
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'branch-actions d-flex justify-content-end';
                
        // Create Copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'btn btn-sm btn-outline-primary me-2';
        copyButton.onclick = function() { copyTempBranch(index); };
        copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
        actions.appendChild(copyButton);
        
        // Create Use button
        const useButton = document.createElement('button');
        useButton.className = 'btn btn-sm btn-outline-success me-2';
        useButton.onclick = function() { useTempBranch(index); };
        useButton.innerHTML = '<i class="fas fa-paste"></i> Use';
        actions.appendChild(useButton);
        
        // Create Edit button
        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-outline-info me-2';
        editButton.onclick = function() { editTempBranchDescription(index); };
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        actions.appendChild(editButton);
        
        // Create Remove button (without trash icon)
        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn-sm btn-outline-secondary';
        removeButton.onclick = function() { deleteTempBranch(index); };
        removeButton.textContent = 'Remove'; // No icon, just text
        actions.appendChild(removeButton);
        
        // Assemble the branch item
        branchItem.innerHTML = descriptionHtml;
        branchItem.appendChild(metadata);
        branchItem.appendChild(branchContent);
        branchItem.appendChild(actions);
        
        container.appendChild(branchItem);
    });
}

// Get all temporary branches
function getTempBranches() {
    const storageKey = getTempBranchStorageKey();
    const storedBranches = localStorage.getItem(storageKey);
    
    if (storedBranches) {
        try {
            return JSON.parse(storedBranches);
        } catch (e) {
            console.error('Error parsing temporary branches:', e);
            return [];
        }
    }
    
    return [];
}

// Add a branch to temporary storage
function addTempBranch(content, description = '') {
    const branches = getTempBranches();
    
    // Create new branch object
    const newBranch = {
        content: content,
        description: description,
        timestamp: Date.now(),
        sentenceId: document.getElementById('snt_id').value
    };
    
    // Add to list
    branches.push(newBranch);
    
    // Save and refresh UI
    saveTempBranches(branches);
    renderTempBranches(branches);
    
    // Show notification
    showNotification('Branch added to temporary storage', 'success');
}

// Copy a temporary branch to clipboard
function copyTempBranch(index) {
    const branches = getTempBranches();
    if (index >= 0 && index < branches.length) {
        const content = branches[index].content;
        
        // Copy to clipboard
        navigator.clipboard.writeText(content)
            .then(() => {
                showNotification('Branch copied to clipboard', 'success');
            })
            .catch(err => {
                console.error('Error copying to clipboard:', err);
                showNotification('Failed to copy branch', 'error');
            });
    }
}

// Use a temporary branch (adds it to the current annotation)
function useTempBranch(index) {
    const branches = getTempBranches();
    if (index >= 0 && index < branches.length) {
        const content = branches[index].content;
        
        // Show dialog to select where to add this branch
        showAddTempBranchDialog(content);
    }
}

// Edit a temporary branch description
function editTempBranchDescription(index) {
    const branches = getTempBranches();
    if (index >= 0 && index < branches.length) {
        const currentDescription = branches[index].description || '';
        
        // Create prompt dialog
        const description = prompt('Enter a description for this branch:', currentDescription);
        
        if (description !== null) {  // Not cancelled
            branches[index].description = description;
            saveTempBranches(branches);
            renderTempBranches(branches);
        }
    }
}

// Delete a temporary branch
function deleteTempBranch(index) {
    const branches = getTempBranches();
    if (index >= 0 && index < branches.length) {
        if (confirm('Are you sure you want to delete this temporary branch?')) {
            branches.splice(index, 1);
            saveTempBranches(branches);
            renderTempBranches(branches);
            showNotification('Branch deleted from temporary storage', 'success');
        }
    }
}

// Setup context menu for right-clicking on relation spans
function setupTempStorageContextMenu(annotationElement) {
    console.log('Setup temporary storage context menu - no action needed');
    // We no longer need to modify the context menu here
    // The "Store Temporarily" option is now added directly in the relation_editor.js file

}

// Store a branch temporarily
function storeBranchTemporarily(relationSpan) {
    const annotationElement = document.querySelector('#amr pre');
    const originalText = annotationElement.textContent;
    
    // Find the position of the relation in the original text
    const relationText = relationSpan.textContent;
    const spanIndex = Array.from(annotationElement.querySelectorAll('.relation-span')).indexOf(relationSpan);
    
    // Find the relation occurrence in the text
    let relationMatches = findAllMatches(originalText, relationText);
    
    if (relationMatches.length <= spanIndex) {
        console.error('Could not locate the relation in the text');
        showNotification('Error: Could not locate the branch to store', 'error');
        return;
    }
    
    const relationPos = relationMatches[spanIndex];
    
    // Determine the branch boundaries
    const branchInfo = getBranchBoundaries(originalText, relationPos);
    
    if (!branchInfo) {
        console.error('Could not determine branch boundaries');
        showNotification('Error: Could not determine branch boundaries', 'error');
        return;
    }
    
    // Extract the branch text
    const branchText = branchInfo.branchText;
    
    // Prompt for optional description
    const description = prompt('Add a description for this branch (optional):');
    
    // Add to temporary storage
    addTempBranch(branchText, description);
}

// Show dialog to add a temporary branch to the annotation
function showAddTempBranchDialog(branchContent) {
    // Create dialog container
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'add-temp-branch-dialog-container';
    dialogContainer.style.position = 'fixed';
    dialogContainer.style.top = '0';
    dialogContainer.style.left = '0';
    dialogContainer.style.width = '100%';
    dialogContainer.style.height = '100%';
    dialogContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dialogContainer.style.display = 'flex';
    dialogContainer.style.justifyContent = 'center';
    dialogContainer.style.alignItems = 'center';
    dialogContainer.style.zIndex = '2000';
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'add-temp-branch-dialog';
    dialog.style.width = '500px';
    dialog.style.backgroundColor = 'white';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    // Dialog header
    dialog.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 20px;">Add Temporary Branch</h3>
        <form id="add-temp-branch-form">
            <div style="margin-bottom: 16px;">
                <label for="variable-select" style="display: block; margin-bottom: 8px; font-weight: bold;">Select target variable:</label>
                <select id="variable-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="">Select a variable...</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label for="branch-preview" style="display: block; margin-bottom: 8px; font-weight: bold;">Branch to add:</label>
                <pre id="branch-preview" style="max-height: 200px; overflow: auto; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; font-size: 0.85rem;"></pre>
            </div>
            
            <div style="text-align: right; margin-top: 20px;">
                <button type="button" id="cancel-add-temp-branch" style="padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; background-color: #f5f5f5; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button type="submit" id="confirm-add-temp-branch" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Add Branch</button>
            </div>
        </form>
    `;
    
    dialogContainer.appendChild(dialog);
    document.body.appendChild(dialogContainer);
    
    // Set branch preview
    document.getElementById('branch-preview').textContent = branchContent;
    
    // Populate variables dropdown
    const variableSelect = document.getElementById('variable-select');
    const annotationElement = document.querySelector('#amr pre');
    
    if (annotationElement) {
        const variables = extractVariables(annotationElement.textContent);
        variables.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable;
            option.textContent = variable;
            variableSelect.appendChild(option);
        });
    }
    
    // Handle cancel button
    const cancelButton = document.getElementById('cancel-add-temp-branch');
    cancelButton.addEventListener('click', () => {
        dialogContainer.remove();
    });
    
    // Handle form submission
    const form = document.getElementById('add-temp-branch-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const targetVariable = variableSelect.value;
        
        if (!targetVariable) {
            showNotification('Please select a target variable', 'error');
            return;
        }
        
        // Add the branch to the selected variable
        addBranchToVariable(targetVariable, branchContent);
        
        // Close the dialog
        dialogContainer.remove();
    });
}

// Extract variables from the annotation
function extractVariables(annotationText) {
    const variables = [];
    const variableRegex = /\b(s[0-9]+[a-z]*[0-9]*)\b/g;
    let match;
    
    while ((match = variableRegex.exec(annotationText)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }
    
    return variables;
}

// Add a branch to a specific variable
function addBranchToVariable(variable, branchContent) {
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) return;
    
    const originalText = annotationElement.textContent;
    
    // Find all occurrences of the variable in the text
    const variableRegex = new RegExp(`\\b${variable}\\b`, 'g');
    let match;
    let insertPosition = -1;
    
    while ((match = variableRegex.exec(originalText)) !== null) {
        // Check if this is the variable definition (followed by / and concept)
        const afterMatch = originalText.substring(match.index + match[0].length).trim();
        if (afterMatch.startsWith('/')) {
            insertPosition = match.index + match[0].length;
            break;
        }
    }
    
    if (insertPosition === -1) {
        showNotification('Could not find a suitable position to add the branch', 'error');
        return;
    }
    
    // Clean up branch content if needed (remove leading/trailing whitespace, etc.)
    let cleanedBranchContent = branchContent.trim();
    if (cleanedBranchContent.startsWith('(')) {
        cleanedBranchContent = cleanedBranchContent.substring(1);
    }
    if (cleanedBranchContent.endsWith(')')) {
        cleanedBranchContent = cleanedBranchContent.substring(0, cleanedBranchContent.length - 1);
    }
    
    // Insert the branch into the annotation
    const updatedText = 
        originalText.substring(0, insertPosition) + 
        ' (' + cleanedBranchContent + ')' + 
        originalText.substring(insertPosition);
    
    // Update the annotation display
    annotationElement.textContent = updatedText;
    
    // Reinitialize the relation editor
    if (typeof makeRelationsClickable === 'function') {
        makeRelationsClickable(annotationElement);
    }
    
    if (typeof makeValuesClickable === 'function') {
        makeValuesClickable(annotationElement);
    }
    
    if (typeof addBranchOperations === 'function') {
        addBranchOperations(annotationElement);
    }
    
    showNotification(`Branch added to ${variable}`, 'success');
}

// Helper function: Find all matches of a substring in a string
function findAllMatches(str, substr) {
    const positions = [];
    let pos = str.indexOf(substr);
    
    while (pos !== -1) {
        positions.push(pos);
        pos = str.indexOf(substr, pos + 1);
    }
    
    return positions;
}

// Helper function: Determine the boundaries of a branch in the annotation text
function getBranchBoundaries(text, relationPosition) {
    // Find the line with the relation
    let lineStart = text.lastIndexOf('\n', relationPosition) + 1;
    let lineEnd = text.indexOf('\n', relationPosition);
    if (lineEnd === -1) lineEnd = text.length;
    
    const line = text.substring(lineStart, lineEnd);
    
    // Determine the indentation level of this relation
    const indent = line.search(/\S/);
    
    // Find where this branch ends (the next line with the same or less indentation)
    let currentPos = lineEnd + 1;
    let branchEnd = lineEnd;
    
    while (currentPos < text.length) {
        const nextLineStart = currentPos;
        const nextLineEnd = text.indexOf('\n', nextLineStart);
        const endPos = nextLineEnd === -1 ? text.length : nextLineEnd;
        const nextLine = text.substring(nextLineStart, endPos);
        
        // Skip empty lines
        if (nextLine.trim() === '') {
            currentPos = endPos + 1;
            continue;
        }
        
        const nextIndent = nextLine.search(/\S/);
        
        // If we find a line with same or less indentation, we've reached the end of the branch
        if (nextIndent <= indent) {
            break;
        }
        
        branchEnd = endPos;
        currentPos = endPos + 1;
    }
    
    return {
        start: lineStart,
        end: branchEnd + 1, // Include the newline at the end
        branchText: text.substring(lineStart, branchEnd + 1),
        parentIndent: indent
    };
}