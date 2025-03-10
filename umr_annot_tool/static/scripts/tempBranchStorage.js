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

// Make sure the storeBranchTemporarily function is available globally
window.storeBranchTemporarily = function(relationSpan) {
    const annotationElement = document.querySelector('#amr pre');
    const originalText = annotationElement.textContent;
    
    // Find the position of the relation in the original text
    const relationText = relationSpan.textContent;
    console.log('Looking for relation text:', relationText);
    
    // Try to find the relation text in the original text
    let relationMatches = findAllMatches(originalText, relationText);
    
    // If no matches found, try with trimmed text
    if (relationMatches.length === 0) {
        const trimmedRelationText = relationText.trim();
        console.log('Trying with trimmed relation text:', trimmedRelationText);
        relationMatches = findAllMatches(originalText, trimmedRelationText);
    }
    
    // If still no matches, try to get parent element content
    if (relationMatches.length === 0) {
        console.log('No matches found for relation text, trying to get the parent branch');
        
        // Get the entire branch text from the DOM
        let currentNode = relationSpan;
        while (currentNode && currentNode.parentElement && currentNode.parentElement !== annotationElement) {
            currentNode = currentNode.parentElement;
        }
        
        if (currentNode && currentNode.textContent) {
            // Try to find a unique line in the text that contains our relation
            const lines = originalText.split('\n');
            let bestLine = null;
            let bestLineIndex = -1;
            
            // Find a line that contains our relation text
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(relationText)) {
                    bestLine = lines[i];
                    bestLineIndex = i;
                    break;
                }
            }
            
            if (bestLineIndex >= 0) {
                // Calculate position in original text
                const lineStartPos = originalText.indexOf(bestLine);
                if (lineStartPos >= 0) {
                    // Use the position of the line as our relation position
                    const relationPos = lineStartPos + bestLine.indexOf(relationText);
                    
                    // Get branch boundaries from this position
                    const branchInfo = getBranchBoundaries(originalText, relationPos);
                    
                    if (branchInfo) {
                        // Extract the branch text
                        let branchText = branchInfo.branchText;
                        
                        // Normalize the indentation before storage
                        branchText = normalizeIndentation(branchText);
                        
                        // Prompt for optional description
                        const description = prompt('Add a description for this branch (optional):');
                        
                        // Add to temporary storage
                        addTempBranch(branchText, description);
                        return;
                    }
                }
            }
        }
        
        // If we still haven't found it, show error and return
        console.error('Could not locate the relation in the text');
        showNotification('Error: Could not locate the branch to store', 'error');
        return;
    }
    
    // Get span index if there are multiple occurrences
    const spanIndex = Array.from(annotationElement.querySelectorAll('.relation-span')).indexOf(relationSpan);
    
    // Use the correct match based on span index or default to the first match
    const relationPos = (spanIndex >= 0 && spanIndex < relationMatches.length) 
        ? relationMatches[spanIndex] 
        : relationMatches[0];
    
    // Log the position found
    console.log('Relation position found:', relationPos);
    
    // Determine the branch boundaries
    const branchInfo = getBranchBoundaries(originalText, relationPos);
    
    if (!branchInfo) {
        console.error('Could not determine branch boundaries');
        showNotification('Error: Could not determine branch boundaries', 'error');
        return;
    }
    
    // Extract the branch text
    let branchText = branchInfo.branchText;
    
    // Normalize the indentation before storage
    branchText = normalizeIndentation(branchText);
    
    // Prompt for optional description
    const description = prompt('Add a description for this branch (optional):');
    
    // Add to temporary storage
    addTempBranch(branchText, description);
};

// Function to normalize indentation in a branch
function normalizeIndentation(branchText) {
    // Split into lines
    const lines = branchText.split('\n');
    if (lines.length <= 1) return branchText;
    
    // Skip empty lines
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return branchText;
    
    // Determine the structure
    const firstLine = nonEmptyLines[0].trim();
    const result = [];
    
    // First, let's understand if this is a relation with child nodes
    const isRelation = firstLine.startsWith(':');
    
    // If this isn't a relation branch, return as is
    if (!isRelation) return branchText;
    
    // Add the first line without indentation (this is the root of our branch)
    result.push(firstLine);
    
    // Handle all other lines with consistent indentation
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') {
            result.push('');
            continue;
        }
        
        // Check if this is a relation line like :ARG1, :mod, etc.
        const isChildRelation = line.startsWith(':');
        
        // All child relations get consistent indentation (4 spaces)
        if (isChildRelation) {
            result.push('    ' + line);
        } else {
            // Non-relation lines maintain their trimmed content
            result.push(line);
        }
    }
    
    return result.join('\n');
}

// Show dialog to add a temporary branch to the annotation
function showAddTempBranchDialog(branchContent) {
    console.log('Showing add temp branch dialog');
    
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
                <label for="node-select" style="display: block; margin-bottom: 8px; font-weight: bold;">Select target node:</label>
                <select id="node-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="">Select a node...</option>
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
    
    // Populate nodes dropdown
    const nodeSelect = document.getElementById('node-select');
    
    // Get the annotation text
    let annotationText = '';
    
    // Try multiple sources to get the annotation text
    if (window.umrAnnotationText) {
        console.log('Using globally stored UMR annotation text');
        annotationText = window.umrAnnotationText;
    } else {
        const annotationElement = document.querySelector('#amr pre');
        if (annotationElement && annotationElement.textContent) {
            console.log('Using #amr pre element text');
            annotationText = annotationElement.textContent;
        } else {
            // Try alternative selectors
            const alternatives = [
                document.querySelector('pre'),
                document.querySelector('.umr-text'),
                document.querySelector('.annotation-text'),
                document.querySelector('[data-annotation]')
            ];
            
            for (const el of alternatives) {
                if (el && el.textContent && el.textContent.includes('/')) {
                    console.log('Found UMR text in alternative element');
                    annotationText = el.textContent;
                    break;
                }
            }
        }
    }
    
    if (annotationText) {
        console.log('Annotation text length:', annotationText.length);
        console.log('Annotation text sample:', annotationText.substring(0, 100));
        
        // Extract nodes
        const nodes = extractNodes(annotationText);
        
        if (nodes.length === 0) {
            // If still no nodes found, try a very simple pattern match
            console.log('Trying direct regex match for node patterns');
            const matches = annotationText.match(/s\d+\w*\s*\/\s*\w+(-\d+)?/g) || [];
            console.log('Direct matches found:', matches.length);
            
            matches.forEach(match => {
                const parts = match.split('/').map(part => part.trim());
                if (parts.length === 2) {
                    const option = document.createElement('option');
                    option.value = parts[0];
                    option.textContent = `${parts[0]} / ${parts[1]}`;
                    nodeSelect.appendChild(option);
                }
            });
        } else {
            // Add found nodes to dropdown
            nodes.forEach(node => {
                const option = document.createElement('option');
                option.value = node.variable;
                option.textContent = `${node.variable} / ${node.concept}`;
                nodeSelect.appendChild(option);
            });
        }
    } else {
        console.error('Could not find UMR annotation text from any source');
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
        
        const targetVariable = nodeSelect.value;
        
        if (!targetVariable) {
            showNotification('Please select a target node', 'error');
            return;
        }
        
        // Add the branch to the selected node
        addBranchToNode(targetVariable, branchContent);
        
        // Close the dialog
        dialogContainer.remove();
    });
}

// Extract nodes from the annotation
function extractNodes(annotationText) {
    console.log('Extracting nodes from annotation text');
    const nodes = [];
    const lines = annotationText.split('\n');
    
    // Multiple node patterns to try - from strict to permissive
    const patterns = [
        /^(\s*)(s\d+\w*)\s*\/\s*(\w+(?:-\d+)?)/,  // Standard format with indentation
        /(s\d+\w*)\s*\/\s*(\w+(?:-\d+)?)/         // More permissive format
    ];
    
    console.log('Total lines to check:', lines.length);
    
    // Try each pattern in order
    for (const pattern of patterns) {
        for (const line of lines) {
            const match = line.match(pattern);
            if (match) {
                // Adapt based on which pattern matched (with or without indentation group)
                const node = {
                    variable: match[patterns.indexOf(pattern) === 0 ? 2 : 1],
                    concept: match[patterns.indexOf(pattern) === 0 ? 3 : 2],
                    line: line,
                    indentation: match[1] && patterns.indexOf(pattern) === 0 ? match[1].length : line.indexOf(match[0])
                };
                console.log('Found node:', node.variable, '/', node.concept);
                
                // Check if this node is already in our list (avoid duplicates)
                const isDuplicate = nodes.some(existing => existing.variable === node.variable);
                if (!isDuplicate) {
                    nodes.push(node);
                }
            }
        }
        
        // If we found nodes with this pattern, don't try more permissive patterns
        if (nodes.length > 0) {
            console.log(`Found ${nodes.length} nodes with pattern index ${patterns.indexOf(pattern)}`);
            break;
        }
    }
    
    console.log('Total nodes extracted:', nodes.length);
    return nodes;
}

// Add a branch to a specific node
function addBranchToNode(variable, branchContent, customElement) {
    const annotationElement = customElement || document.querySelector('#amr pre');
    if (!annotationElement) return;
    
    const originalText = annotationElement.textContent;
    const lines = originalText.split('\n');
    
    // Node pattern: variable / concept
    const nodePattern = new RegExp(`\\b${variable}\\s*\\/\\s*[^\\s\\(\\):]+`);
    
    // Find the line with our target node
    let nodeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (nodePattern.test(lines[i])) {
            nodeLineIndex = i;
            break;
        }
    }
    
    if (nodeLineIndex === -1) {
        showNotification('Could not find the selected node', 'error');
        return;
    }
    
    // Get the node line
    const nodeLine = lines[nodeLineIndex];
    
    // Determine the indentation level of the node
    const nodeIndent = nodeLine.match(/^\s*/)[0].length;
    
    // Calculate the standard child indentation
    let childIndentSize = 4; // Default to 4 spaces
    
    // Try to detect the document's child indentation pattern
    // Look at existing child nodes in the document
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
        // If this is a line with a relation
        if (line.startsWith(':')) {
            const lineIndent = lines[i].match(/^\s*/)[0].length;
            // Look at the previous line
            if (i > 0) {
                const prevLine = lines[i-1].trim();
                if (prevLine !== '' && !prevLine.startsWith(':')) {
                    // Found a parent-child relationship
                    const prevIndent = lines[i-1].match(/^\s*/)[0].length;
                    if (lineIndent > prevIndent) {
                        // This is the child indentation size
                        childIndentSize = lineIndent - prevIndent;
                        break;
                    }
                }
            }
        }
    }
    
    console.log('Detected child indent size:', childIndentSize);
    
    // Only remap variables if this is not an internal operation
    let processedBranchContent = branchContent;
    if (!customElement) {
        // First, remap variables in the branch to avoid conflicts
        processedBranchContent = remapVariables(branchContent, originalText);
    }
    
    // Parse the branch content to handle indentation properly
    const branchLines = processedBranchContent.trim().split('\n');
    
    if (branchLines.length === 0 || branchLines[0].trim() === '') {
        if (!customElement) {
            showNotification('No content to add', 'error');
        }
        return; // Silently return for internal operations
    }
    
    // Parse the branch structure to determine nesting levels
    const parsedBranch = parseBranchStructure(branchLines);
    
    // Format the branch with proper indentation
    const formattedBranch = [];
    
    // Add the first line (relation and concept) with proper indentation
    formattedBranch.push(' '.repeat(nodeIndent + childIndentSize) + parsedBranch.lines[0].content);
    
    // Add all child nodes with consistent indentation based on their level
    for (let i = 1; i < parsedBranch.lines.length; i++) {
        const line = parsedBranch.lines[i];
        const indent = nodeIndent + childIndentSize + (line.level * childIndentSize);
        formattedBranch.push(' '.repeat(indent) + line.content);
    }
    
    // Check if the target node line has a closing parenthesis
    const hasClosingParen = nodeLine.includes(')');
    
    // Prepare the lines array for updating
    let updatedLines = [...lines];
    
    if (hasClosingParen) {
        // Get the content of the node before the closing parenthesis
        const nodeContent = nodeLine.substring(0, nodeLine.lastIndexOf(')'));
        // Get any content after all closing parentheses
        const remainingContent = nodeLine.substring(nodeLine.lastIndexOf(')'));
        
        // Check if the node already has children (look for a colon)
        const hasExistingChildren = nodeContent.includes(':');
        
        if (!hasExistingChildren) {
            // For a simple node with no children, add the branch before the closing parenthesis
            // Format: (variable / concept
            //     :relation (child))
            updatedLines[nodeLineIndex] = nodeContent;
            updatedLines.splice(nodeLineIndex + 1, 0, ...formattedBranch);
            // Add the closing parenthesis at the end of the last branch line
            const lastBranchIndex = nodeLineIndex + formattedBranch.length;
            updatedLines[lastBranchIndex] = updatedLines[lastBranchIndex] + remainingContent;
        } else {
            // For a node that already has children, add the branch before the closing parenthesis
            // But keep the closing parenthesis on the same line as the last branch line
            updatedLines[nodeLineIndex] = nodeContent;
            updatedLines.splice(nodeLineIndex + 1, 0, ...formattedBranch);
            
            // Add the closing parenthesis to the last branch line instead of its own line
            const lastBranchIndex = nodeLineIndex + formattedBranch.length;
            updatedLines[lastBranchIndex] = updatedLines[lastBranchIndex] + remainingContent;
        }
    } else {
        // If no closing parenthesis, simply insert after the node line
        updatedLines.splice(nodeLineIndex + 1, 0, ...formattedBranch);
    }
    
    // Update the annotation display
    const updatedText = updatedLines.join('\n');
    annotationElement.textContent = updatedText;
    
    // Only perform additional operations if this is not an internal operation
    if (!customElement) {
        // Completely reinitialize the editor
        reinitializeEditor(annotationElement);
        
        // Find the new variables we've added to show in the reminder
        const newBranchText = formattedBranch.join('\n');
        const newVariables = extractNewVariables(newBranchText);
        const variableList = newVariables.length > 0 ? 
              ` (${newVariables.join(', ')})` : '';
        
        // Show success message
        showNotification(`Branch added to ${variable}`, 'success');
        
        // Show alignment reminder after a short delay
        setTimeout(() => {
            showNotification(
                `⚠️ Remember to manually edit alignments for the new variables${variableList}`, 
                'info', 
                8000 // Show for 8 seconds
            );
        }, 1500); // Delay to show after the success message
        
        // Use the standard form submission to save changes
        setTimeout(() => {
            // Try to find and call the appropriate save function
            if (typeof finalizeUmrString === 'function') {
                // This function from relation_editor.js prepares the UMR string for saving
                console.log('Finalizing UMR string...');
                finalizeUmrString();
            }
            
            // Find the save button or form submit button
            // Use standard DOM selectors only (no jQuery-style selectors)
            const saveSelectors = [
                '#save-btn', 
                '#save_button',
                '#save',
                '#submit-btn',
                '#submit_button',
                '#submit',
                'button[type="submit"]', 
                'input[type="submit"]'
            ];
            
            let saveButtonFound = false;
            
            // Try each selector
            for (const selector of saveSelectors) {
                const saveButton = document.querySelector(selector);
                if (saveButton) {
                    console.log(`Found save button with selector: ${selector}`);
                    saveButton.click();
                    saveButtonFound = true;
                    showNotification('Changes saved', 'success');
                    break;
                }
            }
            
            // ... rest of the save logic ...
        }, 2500); // Give time for the editor to reinitialize before saving
    }
}

// Function to properly reinitialize all editor components
function reinitializeEditor(annotationElement) {
    console.log('Reinitializing editor components...');
    
    // Make relations clickable
    if (typeof makeRelationsClickable === 'function') {
        console.log('- Reinitializing relations');
        makeRelationsClickable(annotationElement);
    } else {
        console.warn('makeRelationsClickable function not available');
    }
    
    // Make values clickable
    if (typeof makeValuesClickable === 'function') {
        console.log('- Reinitializing values');
        makeValuesClickable(annotationElement);
    } else {
        console.warn('makeValuesClickable function not available');
    }
    
    // Make variables clickable
    if (typeof makeVariablesClickable === 'function') {
        console.log('- Reinitializing variables');
        makeVariablesClickable(annotationElement);
    } else {
        console.warn('makeVariablesClickable function not available');
    }
    
    // Add branch operations
    if (typeof addBranchOperations === 'function') {
        console.log('- Reinitializing branch operations');
        addBranchOperations(annotationElement);
    } else {
        console.warn('addBranchOperations function not available');
    }
    
    // The skipAlignmentUpdate parameter is used to skip alignment updates when needed
    // (e.g., when moving branches where alignments should be preserved)
    console.log('Editor reinitialization complete');
}

// Parse a branch to determine the hierarchical structure
function parseBranchStructure(lines) {
    const result = {
        lines: []
    };
    
    // Skip empty lines at the beginning
    let startIndex = 0;
    while (startIndex < lines.length && lines[startIndex].trim() === '') {
        startIndex++;
    }
    
    if (startIndex >= lines.length) {
        return result;
    }
    
    // Get the indentation of the first line as our base
    const baseIndent = lines[startIndex].match(/^\s*/)[0].length;
    
    // Process each line
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '') continue;
        
        // Calculate the indentation level
        const indentSize = line.match(/^\s*/)[0].length;
        const relativeIndent = indentSize - baseIndent;
        
        // Determine the hierarchical level
        // Level 0 is the root relation, e.g. ":ARG2 (s6f2 / farmland"
        // Level 1 is direct child like ":mod (s6l / lush)"
        const level = relativeIndent <= 0 ? 0 : Math.round(relativeIndent / 4);
        
        result.lines.push({
            content: trimmed,
            level: level
        });
    }
    
    return result;
}

// For backward compatibility
function addBranchToVariable(variable, branchContent) {
    return addBranchToNode(variable, branchContent);
}

function extractVariables(annotationText) {
    return extractNodes(annotationText).map(node => node.variable);
}

// Make startBranchMove function globally available
window.startBranchMove = function(relationSpan) {
    console.log('Starting branch move operation');
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        console.error('Annotation element not found');
        return;
    }
    
    // Find the branch content to be moved
    const branchInfo = extractBranchFromRelation(relationSpan, annotationElement);
    if (!branchInfo) {
        showNotification('Could not extract branch to move', 'error');
        return;
    }
    
    console.log('Extracted branch to move:', branchInfo);
    
    // Show dialog to select the new parent node
    showMoveBranchDialog(branchInfo);
};

// Extract a branch based on a relation span
function extractBranchFromRelation(relationSpan, annotationElement) {
    const originalText = annotationElement.textContent;
    
    // Get the relation text
    const relationText = relationSpan.textContent;
    console.log('Looking for relation text to move:', relationText);
    
    // Find the parent node of this relation
    let currentNode = relationSpan;
    let parentRelationSpan = null;
    
    // Navigate up to find the parent relation span (the relation directly above this one)
    while (currentNode && currentNode !== annotationElement) {
        // If this is a relation span and not our starting span
        if (currentNode.classList.contains('relation-span') && currentNode !== relationSpan) {
            parentRelationSpan = currentNode;
            break;
        }
        currentNode = currentNode.parentElement;
    }
    
    // Get all relation spans with the same text
    const sameTextRelationSpans = Array.from(annotationElement.querySelectorAll('.relation-span'))
                                  .filter(span => span.textContent === relationText);
    
    // Find the index of our span among those with the same text
    const relativeSpanIndex = sameTextRelationSpans.indexOf(relationSpan);
    
    if (relativeSpanIndex === -1) {
        console.error('Could not determine relation span index');
        return null;
    }
    
    console.log(`This is occurrence ${relativeSpanIndex} of relation "${relationText}"`);
    
    // Using escapeRegExp to safely handle special characters in the relation text
    const escapedRelationText = escapeRegExp(relationText);
    const relationRegex = new RegExp(escapedRelationText, 'g');
    const relationMatches = [];
    
    let match;
    while ((match = relationRegex.exec(originalText)) !== null) {
        relationMatches.push(match.index);
    }
    
    console.log(`Found ${relationMatches.length} occurrences of ${relationText} in the text`);
    
    if (relationMatches.length <= relativeSpanIndex) {
        console.log(`Could not locate occurrence ${relativeSpanIndex} of relation "${relationText}" in the text. Found ${relationMatches.length} occurrences.`);
        
        // Fallback: Find the line containing the relation instead
        console.log('Attempting fallback method to locate relation');
        
        // Split the text into lines
        const lines = originalText.split('\n');
        
        // Find all lines containing this relation
        const matchingLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(relationText)) {
                matchingLines.push(i);
            }
        }
        
        if (matchingLines.length === 0) {
            console.error('Fallback failed: Could not find line containing relation');
            return null;
        }
        
        // Get the appropriate line based on relativeSpanIndex
        const lineIndex = relativeSpanIndex < matchingLines.length ? 
                        matchingLines[relativeSpanIndex] : 
                        matchingLines[matchingLines.length - 1];
        
        // Calculate the position of this relation in the text
        let relationPos = 0;
        for (let i = 0; i < lineIndex; i++) {
            relationPos += lines[i].length + 1; // +1 for newline
        }
        
        // Find the position of the relation within the line
        relationPos += lines[lineIndex].indexOf(relationText);
        
        // Get the branch boundaries
        const branchInfo = getBranchBoundaries(originalText, relationPos);
        
        if (!branchInfo) {
            console.error('Could not determine branch boundaries');
            return null;
        }
        
        // Extract parent node information if available
        let parentNodeInfo = null;
        if (parentRelationSpan) {
            const parentRelationText = parentRelationSpan.textContent;
            const parentRelationSpans = Array.from(annotationElement.querySelectorAll('.relation-span'))
                                       .filter(span => span.textContent === parentRelationText);
            const parentRelativeIndex = parentRelationSpans.indexOf(parentRelationSpan);
            
            if (parentRelativeIndex !== -1) {
                // Try to find the parent relation position
                const parentRegex = new RegExp(escapeRegExp(parentRelationText), 'g');
                const parentMatches = [];
                
                let parentMatch;
                while ((parentMatch = parentRegex.exec(originalText)) !== null) {
                    parentMatches.push(parentMatch.index);
                }
                
                if (parentMatches.length > parentRelativeIndex) {
                    const parentPos = parentMatches[parentRelativeIndex];
                    parentNodeInfo = {
                        text: parentRelationText,
                        position: parentPos
                    };
                }
            }
        }
        
        // Return all the necessary information
        return {
            relationText: relationText,
            branchText: branchInfo.branchText,
            branchStart: branchInfo.start,
            branchEnd: branchInfo.end,
            parentInfo: parentNodeInfo,
            relationSpan: relationSpan
        };
    }
    
    // Get the position of this occurrence of the relation
    const relationPos = relationMatches[relativeSpanIndex];
    
    // Get the branch boundaries
    const branchInfo = getBranchBoundaries(originalText, relationPos);
    
    if (!branchInfo) {
        console.error('Could not determine branch boundaries');
        return null;
    }
    
    // Extract parent node information if available
    let parentNodeInfo = null;
    if (parentRelationSpan) {
        const parentRelationText = parentRelationSpan.textContent;
        const parentRelationSpans = Array.from(annotationElement.querySelectorAll('.relation-span'))
                                   .filter(span => span.textContent === parentRelationText);
        const parentRelativeIndex = parentRelationSpans.indexOf(parentRelationSpan);
        
        if (parentRelativeIndex !== -1) {
            // Try to find the parent relation position
            const parentRegex = new RegExp(escapeRegExp(parentRelationText), 'g');
            const parentMatches = [];
            
            let parentMatch;
            while ((parentMatch = parentRegex.exec(originalText)) !== null) {
                parentMatches.push(parentMatch.index);
            }
            
            if (parentMatches.length > parentRelativeIndex) {
                const parentPos = parentMatches[parentRelativeIndex];
                parentNodeInfo = {
                    text: parentRelationText,
                    position: parentPos
                };
            }
        }
    }
    
    // Return all the necessary information
    return {
        relationText: relationText,
        branchText: branchInfo.branchText,
        branchStart: branchInfo.start,
        branchEnd: branchInfo.end,
        parentInfo: parentNodeInfo,
        relationSpan: relationSpan
    };
}

// Show dialog to select where to move the branch
function showMoveBranchDialog(branchInfo) {
    // Create dialog container
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'move-branch-dialog-container';
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
    dialog.className = 'move-branch-dialog';
    dialog.style.width = '500px';
    dialog.style.backgroundColor = 'white';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    // Dialog header
    dialog.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 20px;">Move Branch</h3>
        <form id="move-branch-form">
            <div style="margin-bottom: 16px;">
                <label for="target-node-select" style="display: block; margin-bottom: 8px; font-weight: bold;">Select target node:</label>
                <select id="target-node-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="">Select a node...</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label for="branch-preview" style="display: block; margin-bottom: 8px; font-weight: bold;">Branch to move:</label>
                <pre id="branch-preview" style="max-height: 200px; overflow: auto; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; font-size: 0.85rem;"></pre>
            </div>
            
            <div style="text-align: right; margin-top: 20px;">
                <button type="button" id="cancel-move-branch" style="padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; background-color: #f5f5f5; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button type="submit" id="confirm-move-branch" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Move Branch</button>
            </div>
        </form>
    `;
    
    dialogContainer.appendChild(dialog);
    document.body.appendChild(dialogContainer);
    
    // Set branch preview
    document.getElementById('branch-preview').textContent = branchInfo.branchText;
    
    // Populate nodes dropdown
    const nodeSelect = document.getElementById('target-node-select');
    const annotationElement = document.querySelector('#amr pre');
    
    // Get the annotation text
    let annotationText = '';
    if (annotationElement && annotationElement.textContent) {
        annotationText = annotationElement.textContent;
    }
    
    if (annotationText) {
        // Extract nodes
        const nodes = extractNodes(annotationText);
        
        // Add nodes to dropdown, excluding the current parent node
        nodes.forEach(node => {
            // Check if this node is in the branch being moved (to avoid creating cycles)
            if (!branchInfo.branchText.includes(`${node.variable} /`)) {
                const option = document.createElement('option');
                option.value = node.variable;
                option.textContent = `${node.variable} / ${node.concept}`;
                nodeSelect.appendChild(option);
            }
        });
    }
    
    // Handle cancel button
    const cancelButton = document.getElementById('cancel-move-branch');
    cancelButton.addEventListener('click', () => {
        dialogContainer.remove();
    });
    
    // Handle form submission
    const form = document.getElementById('move-branch-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const targetVariable = nodeSelect.value;
        
        if (!targetVariable) {
            showNotification('Please select a target node', 'error');
            return;
        }
        
        // Move the branch
        moveBranchToNode(branchInfo, targetVariable);
        
        // Close the dialog
        dialogContainer.remove();
    });
}

// Move a branch from its current location to a new node
function moveBranchToNode(branchInfo, targetVariable) {
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        showNotification('Annotation element not found', 'error');
        return;
    }
    
    const originalText = annotationElement.textContent;
    const lines = originalText.split('\n');
    
    // Step 1: Remove the branch from its current location
    // We'll split the text at the branch boundaries and remove that section
    const beforeBranch = originalText.substring(0, branchInfo.branchStart);
    const afterBranch = originalText.substring(branchInfo.branchEnd);
    
    // Create a version of text with the branch removed
    let textWithoutBranch = beforeBranch + afterBranch;
    
    // Step 2: Add the branch to the target node using our existing function
    // First normalize the indentation of the branch
    const normalizedBranch = normalizeIndentation(branchInfo.branchText);
    
    // Now add the branch to the target node
    // We'll use a temporary element to do this operation
    const tempElement = document.createElement('pre');
    tempElement.textContent = textWithoutBranch;
    
    // Now use our existing function to add the branch to the target node
    addBranchToNode(targetVariable, normalizedBranch, tempElement);
    
    // Get the updated text with the branch moved
    const updatedText = tempElement.textContent;
    
    // Update the actual annotation display
    annotationElement.textContent = updatedText;
    
    // Reinitialize the clickable elements of the editor
    // We need to make sure that all interactive elements work after the move
    if (typeof makeRelationsClickable === 'function') {
        makeRelationsClickable(annotationElement);
    }
    if (typeof makeValuesClickable === 'function') {
        makeValuesClickable(annotationElement);
    }
    if (typeof makeVariablesClickable === 'function') {
        makeVariablesClickable(annotationElement);
    }
    if (typeof addBranchOperations === 'function') {
        addBranchOperations(annotationElement);
    }
    
    // Show success message
    showNotification(`Branch moved to ${targetVariable}`, 'success');
    
    // Directly save changes to the database
    saveBranchMove(updatedText, branchInfo.relationText, targetVariable);
}

// Function to directly save branch move to the database
function saveBranchMove(updatedAnnotation, movedRelation, targetVariable) {
    // Get sentence ID and document ID from the hidden fields
    const sent_id = document.getElementById('snt_id').value;
    const doc_version_id = document.getElementById('doc_version_id').value;
    
    if (!sent_id || !doc_version_id) {
        console.error('Missing sentence ID or document version ID for saving');
        showNotification('Error: Could not find sentence ID or document ID', 'error');
        return;
    }
    
    console.log(`Saving branch move: ${movedRelation} to ${targetVariable}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_annotation/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
            annotation: updatedAnnotation,
            operation: 'move_branch',
            moved_relation: movedRelation,
            target_variable: targetVariable
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Branch move saved successfully:', data);
        showNotification('Branch move saved to database', 'success');
    })
    .catch(error => {
        console.error('Error saving branch move:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
        
        // Fallback to the old approach if direct save fails
        tryFallbackSave(updatedAnnotation);
    });
}

// Helper function to get CSRF token for API requests
function getCsrfToken() {
    // Try to get the token from a meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
        return metaToken.getAttribute('content');
    }
    
    // Try to get it from a hidden input (common in Django)
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"], input[name="_csrf_token"], input[name="csrf_token"]');
    if (csrfInput) {
        return csrfInput.value;
    }
    
    // Return empty string if not found
    console.warn('CSRF token not found');
    return '';
}

// Fallback save method using UI buttons
function tryFallbackSave(updatedAnnotation) {
    console.log('Attempting fallback save method...');
    
    // Try to update any hidden fields with the annotation content
    const annotationFields = document.querySelectorAll('input[name="annotation"], textarea[name="annotation"]');
    annotationFields.forEach(field => {
        field.value = updatedAnnotation;
    });
    
    // Try to find and click a save button
    const saveSelectors = [
        '#save-btn', 
        '#save_button',
        '#save',
        '#submit-btn',
        '#submit_button',
        '#submit',
        'button[type="submit"]', 
        'input[type="submit"]'
    ];
    
    let saveButtonFound = false;
    
    // Try each selector
    for (const selector of saveSelectors) {
        const saveButton = document.querySelector(selector);
        if (saveButton) {
            console.log(`Found save button with selector: ${selector}`);
            saveButton.click();
            saveButtonFound = true;
            showNotification('Changes saved via button click', 'success');
            break;
        }
    }
    
    // If no save button found, try to find buttons with "save" or "submit" text
    if (!saveButtonFound) {
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
            const buttonText = button.textContent.toLowerCase();
            if (buttonText.includes('save') || buttonText.includes('submit')) {
                console.log('Found button with save/submit text:', buttonText);
                button.click();
                saveButtonFound = true;
                showNotification('Changes saved via text-matched button', 'success');
                break;
            }
        }
    }
    
    if (!saveButtonFound) {
        console.warn('No save button found');
        showNotification('Please save your changes manually', 'warning', 8000);
    }
}

// Function to escape special characters in a regular expression
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}