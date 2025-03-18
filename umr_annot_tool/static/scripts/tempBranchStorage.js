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
    console.log('getBranchBoundaries called for relation at position:', relationPosition);
    
    // Bail out if the position is invalid
    if (relationPosition < 0 || relationPosition >= text.length) {
        console.error('Invalid relation position:', relationPosition);
        return null;
    }
    
    // Find the line with the relation
    let lineStart = text.lastIndexOf('\n', relationPosition) + 1;
    let lineEnd = text.indexOf('\n', relationPosition);
    if (lineEnd === -1) lineEnd = text.length;
    
    const line = text.substring(lineStart, lineEnd);
    console.log('Line with relation:', line);
    
    // Determine the indentation level of this relation
    const indent = line.search(/\S/);
    console.log('Detected indent level:', indent);
    
    // Check if the line actually contains a relation (should start with a colon after some spaces)
    const relationMatch = line.match(/\s+:[A-Za-z0-9\-]+/);
    if (!relationMatch) {
        console.error('Line does not contain a valid relation pattern');
        return null;
    }
    
    // Find the parent node start (the line before this with less indentation)
    let parentStart = lineStart;
    let currentPos = lineStart - 1;
    
    while (currentPos > 0) {
        const prevLineEnd = currentPos;
        const prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
        
        if (prevLineStart >= prevLineEnd) {
            // Special case for the first line
            prevLineStart = 0;
        }
        
        const prevLine = text.substring(prevLineStart, prevLineEnd);
        
        // Skip empty lines
        if (prevLine.trim() === '') {
            currentPos = prevLineStart - 1;
            continue;
        }
        
        const prevIndent = prevLine.search(/\S/);
        
        // If we find a line with less indentation, we've found the parent
        if (prevIndent < indent) {
            parentStart = prevLineStart;
            break;
        }
        
        currentPos = prevLineStart - 1;
    }
    
    // Find where this branch ends (the next line with the same or less indentation)
    currentPos = lineEnd + 1;
    let branchEnd = lineEnd;
    
    while (currentPos < text.length) {
        const nextLineStart = currentPos;
        const nextLineEnd = text.indexOf('\n', nextLineStart);
        const endPos = nextLineEnd === -1 ? text.length : nextLineEnd;
        const nextLine = text.substring(nextLineStart, endPos);
        
        // Skip empty lines
        if (nextLine.trim() === '') {
            currentPos = endPos + 1;
            branchEnd = endPos; // Update branch end to include empty lines
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
    
    // Extract the branch text - we want the branch to start at the relation line, not before it
    const branchText = text.substring(lineStart, branchEnd + 1);
    console.log('Extracted branch text:', branchText);
    
    // Make sure the branch text actually contains the relation
    if (!branchText.includes(text.substring(relationPosition, relationPosition + 10))) {
        console.error('Extracted branch does not contain the relation');
        return null;
    }
    
    return {
        start: lineStart,
        end: branchEnd + 1, // Include the newline at the end
        branchText: branchText,
        parentIndent: indent,
        parentStart: parentStart
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
    console.log('Looking for relation text to save temporarily:', relationText);

    // Get ALL relation spans in the document
    const allRelationSpans = Array.from(annotationElement.querySelectorAll('.relation-span'));
    
    // Find the exact index of the clicked span among all relation spans
    const spanIndex = allRelationSpans.indexOf(relationSpan);
    
    if (spanIndex === -1) {
        console.error('Could not determine relation span index among all spans');
        showNotification('Error: Could not identify the relation to save', 'error');
        return;
    }
    
    // Now count how many identical relations appear before this one in the DOM
    // This gives us the "occurrence index" of this specific relation span
    let occurrenceIndex = 0;
    for (let i = 0; i < spanIndex; i++) {
        if (allRelationSpans[i].textContent === relationText) {
            occurrenceIndex++;
        }
    }
    
    console.log(`This is span #${spanIndex} overall, and occurrence #${occurrenceIndex} of relation "${relationText}"`);
    
    // Get parent element to determine context
    let parentElement = relationSpan.parentElement;
    let context = parentElement ? parentElement.textContent.trim() : '';
    console.log(`Context for this span: "${context.substring(0, 50)}..."`);
    
    // Count total occurrences of this relation in the DOM
    const totalOccurrences = allRelationSpans.filter(span => span.textContent === relationText).length;
    console.log(`Total occurrences of "${relationText}" in the DOM: ${totalOccurrences}`);
    
    // Check if this relation is unique in the tree
    const isUnique = totalOccurrences === 1;
    console.log(`Is "${relationText}" unique in the tree? ${isUnique}`);
    
    // Split the text into lines for a more reliable approach
    const lines = originalText.split('\n');
    
    // Find all occurrences of this relation text in the original text
    const occurrences = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matchIndex = line.indexOf(relationText);
        
        if (matchIndex !== -1) {
            // Calculate position in the full text
            const position = calculatePositionInText(lines, i, relationText);
            
            // Get indentation and some context
            const indent = line.search(/\S/);
            const lineContext = line.trim();
            
            occurrences.push({
                lineNum: i,
                position: position,
                indent: indent,
                context: lineContext
            });
            
            console.log(`Found occurrence on line ${i}: "${lineContext.substring(0, 50)}..."`);
        }
    }
    
    // Determine which occurrence to use based on the specific case
    let selectedIndex;
    
    if (isUnique) {
        // If the relation is unique, just use the first (and only) occurrence
        selectedIndex = 0;
        console.log(`Relation is unique, using occurrence at line ${occurrences[0].lineNum}`);
    } else {
        // For non-unique relations, we need to be more careful
        
        // If we have exactly the right number of occurrences
        if (occurrences.length === totalOccurrences) {
            // Use the occurrence index we calculated from DOM position
            selectedIndex = occurrenceIndex;
            console.log(`Using DOM-based occurrence index: ${occurrenceIndex}`);
        } 
        // If we have more text occurrences than DOM occurrences, use a DOM-based approach
        else if (occurrences.length > totalOccurrences) {
            // Try to match based on context
            let bestMatch = -1;
            let bestScore = -1;
            
            for (let i = 0; i < occurrences.length; i++) {
                // Calculate how well this occurrence's context matches our span's context
                const occurrenceContext = occurrences[i].context;
                const matchScore = calculateContextMatch(context, occurrenceContext);
                
                console.log(`Occurrence ${i} context match score: ${matchScore}`);
                
                if (matchScore > bestScore) {
                    bestScore = matchScore;
                    bestMatch = i;
                }
            }
            
            if (bestMatch !== -1) {
                selectedIndex = bestMatch;
                console.log(`Using best context match: occurrence ${bestMatch} (score: ${bestScore})`);
            } else {
                // If all else fails, use the occurrence index, but ensure it's in bounds
                selectedIndex = Math.min(occurrenceIndex, occurrences.length - 1);
                console.log(`Using bounded occurrence index: ${selectedIndex}`);
            }
        } 
        // Otherwise use occurrence index, bounded by available occurrences
        else {
            selectedIndex = Math.min(occurrenceIndex, occurrences.length - 1);
            console.log(`Using bounded occurrence index: ${selectedIndex}`);
        }
    }
    
    // Ensure the selected index is valid
    if (selectedIndex < 0 || selectedIndex >= occurrences.length) {
        console.error(`Invalid occurrence index: ${selectedIndex} (out of ${occurrences.length})`);
        showNotification('Error: Could not determine which branch to save', 'error');
        return;
    }
    
    // Get the selected occurrence
    const selectedOccurrence = occurrences[selectedIndex];
    console.log(`Selected occurrence at line ${selectedOccurrence.lineNum}: "${selectedOccurrence.context.substring(0, 30)}..."`);
    
    // Get branch boundaries from this position
    const branchInfo = getBranchBoundaries(originalText, selectedOccurrence.position);
    
    if (!branchInfo) {
        console.error('Could not determine branch boundaries');
        showNotification('Error: Could not determine branch boundaries', 'error');
        return;
    }
    
    // Extract the branch text
    let branchText = branchInfo.branchText;
    
    // Debug: Show what we're about to save
    console.log(`Branch to save: 
${branchText}
------`);
    
    // Normalize the indentation before storage
    branchText = normalizeIndentation(branchText);
    
    // Prompt for optional description
    const description = prompt('Add a description for this branch (optional):');
    
    // Add to temporary storage
    addTempBranch(branchText, description);
};

// Helper function to calculate how well two context strings match
function calculateContextMatch(contextA, contextB) {
    if (!contextA || !contextB) return 0;
    
    // Split into words and filter out short words
    const wordsA = contextA.split(/\s+/).filter(w => w.length > 2);
    const wordsB = contextB.split(/\s+/).filter(w => w.length > 2);
    
    // Count matching words
    let matchCount = 0;
    for (const wordA of wordsA) {
        if (wordsB.some(wordB => wordB.includes(wordA) || wordA.includes(wordB))) {
            matchCount++;
        }
    }
    
    // Calculate a normalized score (0-100)
    const maxPossibleMatches = Math.min(wordsA.length, wordsB.length);
    return maxPossibleMatches > 0 ? (matchCount / maxPossibleMatches) * 100 : 0;
}

// Helper function to calculate position of text in a specific line
function calculatePositionInText(lines, lineIndex, textToFind) {
    let position = 0;
    
    // Add up lengths of all previous lines
    for (let i = 0; i < lineIndex; i++) {
        position += lines[i].length + 1; // +1 for newline
    }
    
    // Add position within the line
    position += lines[lineIndex].indexOf(textToFind);
    
    return position;
}

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

// Save to database after adding a temporary branch
function saveTemporaryBranchToDatabase(annotationText, branchContent, targetVariable) {
    // Get sentence ID and document ID from the hidden fields
    const sent_id = document.getElementById('snt_id').value;
    const doc_version_id = document.getElementById('doc_version_id').value;
    
    if (!sent_id || !doc_version_id) {
        console.error('Missing sentence ID or document version ID for saving');
        showNotification('Error: Could not find sentence ID or document ID', 'error');
        return;
    }
    
    console.log(`Saving temporary branch addition to ${targetVariable}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_annotation/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
            annotation: annotationText,
            operation: 'add_branch',
            relation: branchContent,
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
        console.log('Temporary branch addition saved successfully:', data);
        showNotification('Branch addition saved to database', 'success');
    })
    .catch(error => {
        console.error('Error saving branch addition:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
        
        // Fallback to the old approach if direct save fails
        tryFallbackSave(annotationText);
    });
}

// Extract nodes from the annotation
function extractNodes(annotationText) {
    console.log('Extracting nodes from annotation text');
    const nodes = [];
    const lines = annotationText.split('\n');
    
    // Multiple node patterns to try - from strict to permissive
    const patterns = [
        /^(\s*)(s\d+\w*)\s*\/\s*([^\s\(\):]+)/,  // Standard format with indentation - more permissive concept pattern
        /(s\d+\w*)\s*\/\s*([^\s\(\):]+)/         // More permissive format with permissive concept pattern
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
        
        // Save the changes to the database
        saveTemporaryBranchToDatabase(updatedText, processedBranchContent, variable);
    
    // Show alignment reminder after a short delay
    setTimeout(() => {
        showNotification(
            `⚠️ Remember to manually edit alignments for the new variables${variableList}`, 
            'info', 
            8000 // Show for 8 seconds
        );
    }, 1500); // Delay to show after the success message
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
    console.log('Starting extractBranchFromRelation with relation:', relationSpan.textContent);
    
    const originalText = annotationElement.textContent;
    console.log('Annotation content length:', originalText.length);
    
    // Get the relation text
    const relationText = relationSpan.textContent;
    console.log('Looking for relation text to move:', relationText);
    
    // Check if relation text is valid
    if (!relationText.startsWith(':')) {
        console.error('Invalid relation format, must start with ":"');
        showNotification('Error: Invalid relation format. Relations must start with ":"', 'error');
        return null;
    }
    
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
    
    console.log('Parent relation span found:', parentRelationSpan ? parentRelationSpan.textContent : 'None');
    
    // Get all relation spans with the same text
    const sameTextRelationSpans = Array.from(annotationElement.querySelectorAll('.relation-span'))
                                  .filter(span => span.textContent === relationText);
    
    console.log(`Found ${sameTextRelationSpans.length} relation spans with text "${relationText}"`);
    
    // Find the index of our span among those with the same text
    const relativeSpanIndex = sameTextRelationSpans.indexOf(relationSpan);
    
    if (relativeSpanIndex === -1) {
        console.error('Could not determine relation span index');
        showNotification('Error: Could not identify this relation. Please try again.', 'error');
        return null;
    }
    
    console.log(`This is occurrence ${relativeSpanIndex} of relation "${relationText}"`);
    
    // Split the annotation text into lines for line-based extraction
    const lines = originalText.split('\n');
    
    // Find all lines containing this relation
    const relationLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(relationText)) {
            relationLines.push({
                lineIndex: i,
                indent: lines[i].match(/^\s*/)[0].length
            });
        }
    }
    
    console.log(`Found ${relationLines.length} lines containing relation "${relationText}"`);
    
    if (relationLines.length === 0) {
        console.error('No lines found containing relation');
        showNotification('Error: Could not find relation in text. Please try again.', 'error');
        return null;
    }
    
    // Get the specific relation line based on index
    const targetLineInfo = relativeSpanIndex < relationLines.length ? 
                           relationLines[relativeSpanIndex] : 
                           relationLines[0];
    
    console.log('Target line info:', targetLineInfo);
    
    const relationLineIndex = targetLineInfo.lineIndex;
    const relationIndent = targetLineInfo.indent;
    
    // Find the end of this branch (the next line with same or less indentation)
    let branchEndLineIndex = relationLineIndex;
    
    for (let i = relationLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') {
            // Skip empty lines
            continue;
        }
        
        const lineIndent = lines[i].match(/^\s*/)[0].length;
        if (lineIndent <= relationIndent) {
            // Found a line with same or less indentation, we've reached the end
            break;
        }
        
        branchEndLineIndex = i;
    }
    
    console.log(`Branch spans from line ${relationLineIndex} to ${branchEndLineIndex}`);
    
    // Calculate text positions for the branch
    let branchStart = 0;
    for (let i = 0; i < relationLineIndex; i++) {
        branchStart += lines[i].length + 1; // +1 for newline
    }
    
    let branchEnd = branchStart;
    for (let i = relationLineIndex; i <= branchEndLineIndex; i++) {
        branchEnd += lines[i].length + 1; // +1 for newline
    }
    
    // Adjust branchEnd to not include the trailing newline
    branchEnd -= 1;
    
    console.log('Text positions - start:', branchStart, 'end:', branchEnd);
    
    // Extract the branch text
    const branchText = originalText.substring(branchStart, branchEnd);
    console.log('Extracted branch text:', branchText);
    
    // Ensure the branch text includes the relation
    if (!branchText.includes(relationText)) {
        console.error('Branch text does not contain the relation text');
        showNotification('Error: Branch extraction failed. Please try again.', 'error');
        return null;
    }
    
    // Use our utility function to ensure parentheses are balanced
    const balancedResult = balanceParentheses(branchText);
    
    // Adjust branch end position if the text was modified
    const adjustedBranchEnd = branchStart + balancedResult.text.length;
    
    console.log('Parenthesis balancing result:', balancedResult);
    console.log('Adjusted branch text:', balancedResult.text);
    
    return {
        branchText: balancedResult.text,
        relationText: relationText,
        parentIndent: relationIndent,
        branchStart: branchStart,
        branchEnd: adjustedBranchEnd,
        extraClosingParens: balancedResult.extraClosing,
        balancedParentheses: balancedResult.balanced
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

// Function to consolidate lines with only closing parentheses by moving them to the end of the previous line
function consolidateClosingParentheses(lines) {
    if (!lines || lines.length <= 1) return lines;
    
    const result = [];
    let i = 0;
    
    while (i < lines.length) {
        const currentLine = lines[i];
        
        // Add the current line to our result
        result.push(currentLine);
        
        // Check if the next line exists and contains only closing parentheses
        if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const trimmedNextLine = nextLine.trim();
            
            // If the next line contains only closing parentheses (possibly with whitespace)
            if (trimmedNextLine.match(/^\)+$/)) {
                // Remove the line we just added so we can modify it
                result.pop();
                
                // Append the closing parentheses to the end of the current line (without any whitespace in between)
                result.push(currentLine.trimEnd() + trimmedNextLine);
                
                // Skip the next line since we've incorporated it
                i += 2;
            } else {
                // Normal line, just move to the next one
                i += 1;
            }
        } else {
            // No more lines
            i += 1;
        }
    }
    
    return result;
}

// Move a branch from its current location to a new node
function moveBranchToNode(branchInfo, targetVariable) {
    console.log('Moving branch to node:', targetVariable);
    console.log('Branch info:', branchInfo);
    
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        showNotification('Annotation element not found', 'error');
        return;
    }
    
    const originalText = annotationElement.textContent;
    console.log('Original text length:', originalText.length);
    
    // Check that branch boundaries are defined
    if (branchInfo.branchStart === undefined || branchInfo.branchEnd === undefined) {
        console.error('Branch boundaries not defined:', branchInfo);
        showNotification('Error: Branch boundaries not defined', 'error');
        return;
    }
    
    console.log('Branch boundaries - start:', branchInfo.branchStart, 'end:', branchInfo.branchEnd);
    
    // First normalize the indentation of the branch
    const normalizedBranch = normalizeIndentation(branchInfo.branchText);
    console.log('Normalized branch to add:', normalizedBranch);
    
    // Step 1: Find the target node position
    const lines = originalText.split('\n');
    
    // Node pattern: variable / concept
    const nodePattern = new RegExp(`\\b${targetVariable}\\s*\\/\\s*[^\\s\\(\\):]+`);
    
    // Find the line with our target node
    let targetNodeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (nodePattern.test(lines[i])) {
            targetNodeLineIndex = i;
            break;
        }
    }
    
    if (targetNodeLineIndex === -1) {
        showNotification('Could not find the target node', 'error');
        return;
    }
    
    // Get the target node line
    const nodeLine = lines[targetNodeLineIndex];
    console.log('Target node line:', nodeLine);
    
    // Determine the indentation level of the node
    const nodeIndent = nodeLine.match(/^\s*/)[0].length;
    
    // Calculate the standard child indentation
    let childIndentSize = 4; // Default to 4 spaces
    
    // Try to detect the document's child indentation pattern
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
    
    console.log('Using child indent size:', childIndentSize);
    
    // Parse the branch content to handle indentation properly
    const branchLines = normalizedBranch.trim().split('\n');
    
    if (branchLines.length === 0 || branchLines[0].trim() === '') {
        showNotification('No content to add', 'error');
        return;
    }
    
    // Format the branch with proper indentation
    const formattedBranch = [];
    
    // Add the first line (relation and concept) with proper indentation
    formattedBranch.push(' '.repeat(nodeIndent + childIndentSize) + branchLines[0].trim());
    
    // Add all child nodes with consistent indentation based on their level
    for (let i = 1; i < branchLines.length; i++) {
        const line = branchLines[i];
        // Calculate the proper indent for this line - we need to preserve the relative indentation from the first line
        const lineIndent = line.match(/^\s*/)[0].length;
        const baseIndent = branchLines[0].match(/^\s*/)[0].length;
        const relativeIndent = Math.max(0, lineIndent - baseIndent);
        const newIndent = nodeIndent + childIndentSize + relativeIndent;
        
        formattedBranch.push(' '.repeat(newIndent) + line.trim());
    }
    
    console.log('Formatted branch to add:', formattedBranch);
    
    // Step 2: Mark the original branch lines for removal
    const branchStartLineIndex = originalText.substring(0, branchInfo.branchStart).split('\n').length - 1;
    const branchEndLineIndex = originalText.substring(0, branchInfo.branchEnd).split('\n').length - 1;
    
    console.log('Branch line indices - start:', branchStartLineIndex, 'end:', branchEndLineIndex);
    
    // Step 3: Create new lines array, skipping the branch lines but preserving structure
    let updatedLines = [];
    
    // Determine if we need to add closing parentheses after removing the branch
    const extraClosingParens = branchInfo.extraClosingParens || 0;
    const needToAddClosingParens = extraClosingParens > 0;
    
    if (needToAddClosingParens) {
        console.log(`Need to add ${extraClosingParens} closing parentheses after removing branch`);
    }
    
    // Find the line containing the original branch that we're moving
    const branchParentLine = lines[branchStartLineIndex];
    const branchParentLineContent = branchParentLine.trim();
    
    // First, process all lines before the branch
    for (let i = 0; i < branchStartLineIndex; i++) {
        updatedLines.push(lines[i]);
    }
    
    // Then, handle the parent line and any needed parentheses
    if (needToAddClosingParens) {
        // Check if this is the line that needs extra closing parentheses
        if (branchParentLineContent.includes(branchInfo.relationText)) {
            // This is the parent line with the relation
            // We need to find where to add the closing parentheses
            let parentLineWithoutBranch = branchParentLine;
            
            // If this line has just a reference to the branch, leave out the branch part
            const branchStartInLine = branchParentLine.indexOf(branchInfo.relationText);
            if (branchStartInLine > -1) {
                // Keep the part before the branch reference
                parentLineWithoutBranch = branchParentLine.substring(0, branchStartInLine).trimEnd();
                
                // Add the extra closing parentheses, ensuring no whitespace before them
                parentLineWithoutBranch += ')'.repeat(extraClosingParens);
                
                // Add the processed parent line
                updatedLines.push(parentLineWithoutBranch);
            } else {
                // If relation is not directly found (unusual), add parent line as is
                updatedLines.push(branchParentLine);
                // Add the extra parentheses on a new line without indentation
                updatedLines.push(')'.repeat(extraClosingParens));
            }
        } else {
            // This line doesn't contain the relation, but is still part of the parent structure
            updatedLines.push(branchParentLine);
            // Add closing parentheses at the same indentation as the branch parent
            const parentIndent = branchParentLine.match(/^\s*/)[0];
            updatedLines.push(parentIndent + ')'.repeat(extraClosingParens));
        }
    } else {
        // No extra parentheses needed, just add the parent line
        updatedLines.push(branchParentLine);
    }
    
    // Skip the branch lines (already handled)
    
    // Process all lines after the branch, skipping the branch lines
    for (let i = branchEndLineIndex + 1; i < lines.length; i++) {
        // If we already handled the extra parentheses, just add the remaining lines
        updatedLines.push(lines[i]);
    }
    
    // Step 4: Determine where to insert the branch in the target node
    // Find the current index of the target node in our updated lines
    const updatedTargetIndex = updatedLines.findIndex(line => nodePattern.test(line));
    
    if (updatedTargetIndex === -1) {
        showNotification('Error: Lost target node during editing', 'error');
        return;
    }
    
    const targetLine = updatedLines[updatedTargetIndex];
    
    // Check if the target node line has a closing parenthesis
    const hasClosingParen = targetLine.includes(')');
    
    if (hasClosingParen) {
        // Get the content of the node before the closing parenthesis
        const lastClosingParenPos = targetLine.lastIndexOf(')');
        const nodeContent = targetLine.substring(0, lastClosingParenPos);
        // Get any content after the last closing parenthesis
        const remainingContent = targetLine.substring(lastClosingParenPos);
        
        // Update the target node line
        updatedLines[updatedTargetIndex] = nodeContent;
        
        // Insert the formatted branch after the target node
        updatedLines.splice(updatedTargetIndex + 1, 0, ...formattedBranch);
        
        // Add the closing parenthesis back to the last branch line
        const lastInsertedIndex = updatedTargetIndex + formattedBranch.length;
        updatedLines[lastInsertedIndex] = updatedLines[lastInsertedIndex] + remainingContent;
    } else {
        // If no closing parenthesis, simply insert after the node line
        updatedLines.splice(updatedTargetIndex + 1, 0, ...formattedBranch);
    }
    
    // Consolidate lines with only closing parentheses
    updatedLines = consolidateClosingParentheses(updatedLines);
    
    // Create the updated text
    const updatedText = updatedLines.join('\n');
    
    // Log the result for validation
    console.log('Final text length:', updatedText.length);
    
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

// Extract variables from text for display in the reminder
function extractNewVariables(text) {
    const variableRegex = /\b(s\d+[a-z]+\d*)\s*\/\s*([^\s\(\):]+)/g;
    const variables = [];
    let match;
    
    while ((match = variableRegex.exec(text)) !== null) {
        variables.push(match[1]);
    }
    
    return variables;
}

// Function to remap variables in a branch to avoid conflicts
function remapVariables(branchContent, destinationText) {
    // Extract all variables from the branch content
    const variableRegex = /\b(s\d+[a-z]+\d*)\b/g;
    const branchVariables = new Set();
    let match;
    
    // Create a copy of branch content that we'll modify
    let remappedContent = branchContent;
    
    // First pass: identify all variables in the branch
    while ((match = variableRegex.exec(branchContent)) !== null) {
        branchVariables.add(match[1]);
    }
    
    console.log('Branch variables found:', Array.from(branchVariables));
    
    // Extract all variables from the destination text to avoid conflicts
    const existingVariables = new Set();
    while ((match = variableRegex.exec(destinationText)) !== null) {
        existingVariables.add(match[1]);
    }
    
    console.log('Existing variables found:', Array.from(existingVariables));
    
    // Determine the target sentence number from the destination text
    // Looking for any variable pattern like s5xxx to get the sentence number
    const sentenceMatch = destinationText.match(/\b(s(\d+))[a-z]+\d*\b/);
    let targetSentenceNum = 1; // Default
    
    if (sentenceMatch && sentenceMatch[2]) {
        targetSentenceNum = parseInt(sentenceMatch[2], 10);
        console.log(`Target sentence number: ${targetSentenceNum}`);
    }
    
    // Create a mapping from old variables to new variable names based on UMR convention
    const variableMap = {};
    
    // First, find all concept-to-variable mappings in the branch
    const conceptVariableMap = {};
    const conceptRegex = /\b(s\d+[a-z]+\d*)\s*\/\s*([^\s\(\):]+)/g;
    
    while ((match = conceptRegex.exec(branchContent)) !== null) {
        const variable = match[1];
        const concept = match[2];
        conceptVariableMap[variable] = concept;
    }
    
    console.log('Concept-variable mappings:', conceptVariableMap);
    
    // Now remap each variable based on its concept
    for (const oldVar of branchVariables) {
        // Extract the variable format: s + sentence number + concept initial + optional counter
        const varMatch = oldVar.match(/^s(\d+)([a-z]+)(\d*)$/);
        if (!varMatch) continue;
        
        const oldSentenceNum = varMatch[1];
        const conceptInitial = varMatch[2];
        const counter = varMatch[3] || '';
        
        // Create the new variable with the target sentence number
        const newVarBase = `s${targetSentenceNum}${conceptInitial}`;
        
        // Start with the same counter (or empty if none)
        let newVar = newVarBase + counter;
        let counterNum = counter === '' ? 1 : parseInt(counter, 10);
        
        // Ensure the new variable is unique
        while (existingVariables.has(newVar)) {
            counterNum++;
            newVar = newVarBase + counterNum;
        }
        
        // Add to our mapping
        variableMap[oldVar] = newVar;
        console.log(`Remapping ${oldVar} to ${newVar}`);
    }
    
    // Now replace all occurrences of old variables with new ones
    for (const [oldVar, newVar] of Object.entries(variableMap)) {
        // Use a regex with word boundaries to replace only whole variables
        const replaceRegex = new RegExp(`\\b${oldVar}\\b`, 'g');
        remappedContent = remappedContent.replace(replaceRegex, newVar);
    }
    
    return remappedContent;
}

// Function to ensure we extract only matched parentheses in a branch
function balanceParentheses(text) {
    // Count opening and closing parentheses
    const openCount = (text.match(/\(/g) || []).length;
    const closeCount = (text.match(/\)/g) || []).length;
    
    console.log(`Initial parenthesis balance - open: ${openCount}, close: ${closeCount}`);
    
    // If balanced, return original text
    if (openCount === closeCount) {
        return { 
            text: text, 
            balanced: true,
            extraClosing: 0
        };
    }
    
    // Case 1: Too many closing parentheses - common when extracting a branch
    if (closeCount > openCount) {
        let excess = closeCount - openCount;
        
        // First, try to identify where the extra closing parentheses are
        const lines = text.split('\n');
        let updatedLines = [];
        let hasProcessed = false;
        
        // Check if the last line has just closing parentheses
        if (lines.length > 0 && lines[lines.length - 1].trim().match(/^\)+$/)) {
            const lastLine = lines[lines.length - 1];
            const closingCount = (lastLine.match(/\)/g) || []).length;
            
            if (closingCount <= excess) {
                // We can just remove this entire line
                updatedLines = lines.slice(0, -1);
                excess -= closingCount;
                hasProcessed = true;
            } else {
                // We need to keep some of the closing parentheses
                const keepCount = closingCount - excess;
                const trimmedLine = lastLine.trim();
                const indentation = lastLine.match(/^\s*/)[0];
                updatedLines = lines.slice(0, -1);
                
                // Add the remaining closing parentheses to the end of the previous line
                if (updatedLines.length > 0) {
                    const lastUpdatedLine = updatedLines[updatedLines.length - 1];
                    updatedLines[updatedLines.length - 1] = lastUpdatedLine.trimEnd() + trimmedLine.substring(0, keepCount);
                } else {
                    // If there's no previous line, keep them as is
                    updatedLines.push(indentation + trimmedLine.substring(0, keepCount));
                }
                
                excess = 0;
                hasProcessed = true;
            }
        }
        
        // If we still have excess closing parentheses, look at the content more carefully
        if (!hasProcessed || excess > 0) {
            // Handle excess by finding trailing parentheses in each line
            updatedLines = [];
            
            for (let i = 0; i < lines.length && excess > 0; i++) {
                let line = lines[i];
                
                // If line ends with closing parentheses, check if they are excess
                if (line.trimRight().endsWith(')')) {
                    const trimmed = line.trimRight();
                    const trailingParens = trimmed.match(/\)+$/);
                    
                    if (trailingParens) {
                        const trailingCount = trailingParens[0].length;
                        const removeCount = Math.min(excess, trailingCount);
                        
                        if (removeCount > 0 && removeCount === trailingCount && trailingCount === trimmed.length) {
                            // The entire line is just closing parentheses, skip it
                            excess -= removeCount;
                            continue;
                        } else if (removeCount > 0) {
                            // Remove some closing parentheses from the end
                            line = line.substring(0, line.lastIndexOf(')') - (removeCount - 1));
                            excess -= removeCount;
                        }
                    }
                }
                
                updatedLines.push(line);
            }
            
            // Add any remaining lines
            if (updatedLines.length < lines.length) {
                updatedLines = updatedLines.concat(lines.slice(updatedLines.length));
            }
        }
        
        // Do one final pass to consolidate any lines with only closing parentheses
        updatedLines = consolidateClosingParentheses(updatedLines);
        
        const result = updatedLines.join('\n');
        
        // Final check - ensure we've removed the right number of closing parentheses
        const newCloseCount = (result.match(/\)/g) || []).length;
        console.log(`After balancing: open=${openCount}, close=${newCloseCount}`);
        
        return { 
            text: result, 
            balanced: true,
            extraClosing: closeCount - openCount
        };
    }
    
    // Case 2: Too many opening parentheses - rare but possible
    if (openCount > closeCount) {
        // This is a rare case and would require us to find matching closing parentheses
        // from the rest of the document, which is complex. For now, we leave it unbalanced.
        console.warn('Extracted branch has more opening parentheses than closing ones.');
        return { 
            text: text, 
            balanced: false,
            extraClosing: 0
        };
    }
    
    // Should never reach here, but just in case
    return { 
        text: text, 
        balanced: false,
        extraClosing: 0
    };
}