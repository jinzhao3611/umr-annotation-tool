console.log('relation_editor.js loaded');

// These will be populated from the template
let umrRelations = [];
let umrRelationValues = {};

// Initialize the relation editor functionality
function initRelationEditor() {
    console.log('Initializing relation editor');
    
    // Load relations from the template
    try {
        const relationsElement = document.getElementById('umr-relations-data');
        if (relationsElement) {
            umrRelations = JSON.parse(relationsElement.textContent);
            console.log(`Loaded ${umrRelations.length} relations from server`);
        } else {
            console.warn('Relations data element not found, using default relations');
            // Fallback to a minimal set of common relations if server data isn't available
            umrRelations = [
                ':ARG0', ':ARG1', ':ARG2', ':ARG3', ':ARG4', ':ARG5',
                ':mod', ':time', ':location', ':manner', ':purpose', ':cause'
            ];
        }
        
        // Load relation values data
        const relationValuesElement = document.getElementById('umr-relation-values-data');
        if (relationValuesElement) {
            umrRelationValues = JSON.parse(relationValuesElement.textContent);
            console.log(`Loaded values for ${Object.keys(umrRelationValues).length} relations`);
        } else {
            console.warn('Relation values data element not found');
        }
    } catch (error) {
        console.error('Error loading relations data:', error);
        // Fallback to default relations
        umrRelations = [
            ':ARG0', ':ARG1', ':ARG2', ':ARG3', ':ARG4', ':ARG5',
            ':mod', ':time', ':location', ':manner', ':purpose', ':cause'
        ];
    }
    
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        console.log('No annotation found');
        return;
    }
    
    // Parse the annotation text to make relations clickable
    makeRelationsClickable(annotationElement);
    
    // Also make values clickable for relations with predefined values
    makeValuesClickable(annotationElement);
    
    // Add context menu for branch operations
    addBranchOperations(annotationElement);
    
    // Add event listener to document to close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target) && 
                !event.target.classList.contains('relation-span') && 
                !event.target.classList.contains('value-span')) {
                dropdown.remove();
            }
        });
    });
}

// Function to make relations in the annotation clickable
function makeRelationsClickable(annotationElement) {
    const text = annotationElement.textContent;
    const relationRegex = /(\s+)(:[A-Za-z0-9\-]+)/g;
    
    let html = text.replace(relationRegex, function(match, space, relation) {
        return `${space}<span class="relation-span" style="cursor:pointer; color:#0066cc;">${relation}</span>`;
    });
    
    annotationElement.innerHTML = html;
    
    // Add click event listeners to all relation spans
    const relationSpans = annotationElement.querySelectorAll('.relation-span');
    relationSpans.forEach(span => {
        span.addEventListener('click', function(event) {
            event.stopPropagation();
            showRelationDropdown(span);
        });
    });
}

// Function to make values clickable for relations with predefined values
function makeValuesClickable(annotationElement) {
    // We can only work with the existing HTML after relations are marked up
    const relationSpans = annotationElement.querySelectorAll('.relation-span');
    
    relationSpans.forEach(relationSpan => {
        const relationName = relationSpan.textContent;
        
        // Check if this relation has predefined values
        if (umrRelationValues[relationName]) {
            // Find the value node - it's the next node after this relation
            let nextNode = relationSpan.nextSibling;
            while (nextNode && (nextNode.nodeType !== Node.TEXT_NODE || !nextNode.textContent.trim())) {
                nextNode = nextNode.nextSibling;
            }
            
            if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
                // Extract the value - it should be the text after the relation until whitespace or closing paren
                const valueMatch = nextNode.textContent.match(/^\s+([^\s\)]+)/);
                if (valueMatch) {
                    const valueText = valueMatch[0];
                    const actualValue = valueMatch[1];
                    
                    // Replace the text node with a span for the value
                    const newHtml = nextNode.textContent.replace(
                        valueText, 
                        `${valueText.replace(actualValue, `<span class="value-span" data-relation="${relationName}" style="cursor:pointer; color:#009900;">${actualValue}</span>`)}`
                    );
                    
                    // Create a temporary element to hold the new HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newHtml;
                    
                    // Replace the text node with the new content
                    const fragment = document.createDocumentFragment();
                    while (tempDiv.firstChild) {
                        fragment.appendChild(tempDiv.firstChild);
                    }
                    
                    const parent = nextNode.parentNode;
                    parent.replaceChild(fragment, nextNode);
                }
            }
        }
    });
    
    // Add click event listeners to all value spans
    const valueSpans = annotationElement.querySelectorAll('.value-span');
    valueSpans.forEach(span => {
        span.addEventListener('click', function(event) {
            event.stopPropagation();
            const relationName = span.getAttribute('data-relation');
            showValueDropdown(span, relationName);
        });
    });
}

// Function to show the relation dropdown
function showRelationDropdown(relationSpan) {
    // Remove any existing dropdowns
    const existingDropdowns = document.querySelectorAll('.relation-dropdown');
    existingDropdowns.forEach(dropdown => dropdown.remove());
    
    const currentRelation = relationSpan.textContent;
    const spanRect = relationSpan.getBoundingClientRect();
    
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'relation-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.left = `${spanRect.left}px`;
    dropdown.style.top = `${spanRect.bottom + window.scrollY}px`;
    dropdown.style.zIndex = '1000';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '4px';
    dropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.minWidth = '150px';
    
    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search relations...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '8px';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.border = 'none';
    searchInput.style.borderBottom = '1px solid #eee';
    
    // Add search input to dropdown
    dropdown.appendChild(searchInput);
    
    // Create relation list container
    const relationList = document.createElement('div');
    relationList.className = 'relation-list';
    dropdown.appendChild(relationList);
    
    // Function to render filtered relations
    function renderRelations(filter = '') {
        // Clear existing items
        relationList.innerHTML = '';
        
        // Filter relations based on search input
        const filteredRelations = umrRelations.filter(rel => 
            rel.toLowerCase().includes(filter.toLowerCase())
        );
        
        // Add current relation at the top if not in the list
        if (!umrRelations.includes(currentRelation) && currentRelation.startsWith(':')) {
            const currentItem = document.createElement('div');
            currentItem.textContent = currentRelation + ' (current)';
            currentItem.style.padding = '8px 16px';
            currentItem.style.cursor = 'pointer';
            currentItem.style.backgroundColor = '#e6f7ff';
            currentItem.addEventListener('click', function() {
                replaceRelation(relationSpan, currentRelation);
            });
            relationList.appendChild(currentItem);
        }
        
        // Add filtered relations
        filteredRelations.forEach(relation => {
            const item = document.createElement('div');
            item.textContent = relation;
            item.style.padding = '8px 16px';
            item.style.cursor = 'pointer';
            
            // Highlight current relation
            if (relation === currentRelation) {
                item.style.backgroundColor = '#e6f7ff';
                item.textContent += ' (current)';
            }
            
            // Hover effect
            item.addEventListener('mouseover', function() {
                if (relation !== currentRelation) {
                    this.style.backgroundColor = '#f0f0f0';
                }
            });
            item.addEventListener('mouseout', function() {
                if (relation !== currentRelation) {
                    this.style.backgroundColor = '';
                }
            });
            
            // Click event
            item.addEventListener('click', function() {
                replaceRelation(relationSpan, relation);
            });
            
            relationList.appendChild(item);
        });
        
        // Show message if no relations found
        if (filteredRelations.length === 0 && (umrRelations.includes(currentRelation) || !currentRelation.startsWith(':'))) {
            const noResults = document.createElement('div');
            noResults.textContent = 'No relations found';
            noResults.style.padding = '8px 16px';
            noResults.style.color = '#999';
            relationList.appendChild(noResults);
        }
    }
    
    // Initial render of all relations
    renderRelations();
    
    // Add search functionality
    searchInput.addEventListener('input', function() {
        renderRelations(this.value);
    });
    
    // Add dropdown to document
    document.body.appendChild(dropdown);
    
    // Focus search input
    searchInput.focus();
}

// Function to show the value dropdown
function showValueDropdown(valueSpan, relationName) {
    // Remove any existing dropdowns
    const existingDropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
    existingDropdowns.forEach(dropdown => dropdown.remove());
    
    const currentValue = valueSpan.textContent;
    const spanRect = valueSpan.getBoundingClientRect();
    
    // Make sure the relation has values
    if (!umrRelationValues[relationName] || !umrRelationValues[relationName].values) {
        console.error(`No values defined for relation: ${relationName}`);
        return;
    }
    
    const availableValues = umrRelationValues[relationName].values;
    
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'value-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.left = `${spanRect.left}px`;
    dropdown.style.top = `${spanRect.bottom + window.scrollY}px`;
    dropdown.style.zIndex = '1000';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '4px';
    dropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.minWidth = '150px';
    
    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search values...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '8px';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.border = 'none';
    searchInput.style.borderBottom = '1px solid #eee';
    
    // Add search input to dropdown
    dropdown.appendChild(searchInput);
    
    // Create value list container
    const valueList = document.createElement('div');
    valueList.className = 'value-list';
    dropdown.appendChild(valueList);
    
    // Function to render filtered values
    function renderValues(filter = '') {
        // Clear existing items
        valueList.innerHTML = '';
        
        // Filter values based on search input
        const filteredValues = availableValues.filter(val => 
            val.toLowerCase().includes(filter.toLowerCase())
        );
        
        // Add filtered values
        filteredValues.forEach(value => {
            const item = document.createElement('div');
            item.textContent = value;
            item.style.padding = '8px 16px';
            item.style.cursor = 'pointer';
            
            // Highlight current value
            if (value === currentValue) {
                item.style.backgroundColor = '#e6f7ff';
                item.textContent += ' (current)';
            }
            
            // Hover effect
            item.addEventListener('mouseover', function() {
                if (value !== currentValue) {
                    this.style.backgroundColor = '#f0f0f0';
                }
            });
            item.addEventListener('mouseout', function() {
                if (value !== currentValue) {
                    this.style.backgroundColor = '';
                }
            });
            
            // Click event
            item.addEventListener('click', function() {
                replaceValue(valueSpan, value);
            });
            
            valueList.appendChild(item);
        });
        
        // Show message if no values found
        if (filteredValues.length === 0) {
            const noResults = document.createElement('div');
            noResults.textContent = 'No values found';
            noResults.style.padding = '8px 16px';
            noResults.style.color = '#999';
            valueList.appendChild(noResults);
        }
    }
    
    // Initial render of all values
    renderValues();
    
    // Add search functionality
    searchInput.addEventListener('input', function() {
        renderValues(this.value);
    });
    
    // Add dropdown to document
    document.body.appendChild(dropdown);
    
    // Focus search input
    searchInput.focus();
}

// Function to replace the relation
function replaceRelation(relationSpan, newRelation) {
    const oldRelation = relationSpan.textContent;
    
    // Update the relation text
    relationSpan.textContent = newRelation;
    
    // Get the updated annotation
    const annotationElement = document.querySelector('#amr pre');
    const updatedAnnotation = annotationElement.textContent;
    
    // Send the update to the server
    saveAnnotationUpdate(updatedAnnotation, oldRelation, newRelation);
    
    // Remove dropdown
    const dropdown = document.querySelector('.relation-dropdown');
    if (dropdown) {
        dropdown.remove();
    }
}

// Function to replace the value
function replaceValue(valueSpan, newValue) {
    const oldValue = valueSpan.textContent;
    const relationName = valueSpan.getAttribute('data-relation');
    
    // Update the value text
    valueSpan.textContent = newValue;
    
    // Get the updated annotation
    const annotationElement = document.querySelector('#amr pre');
    const updatedAnnotation = annotationElement.textContent;
    
    // Send the update to the server
    saveValueUpdate(updatedAnnotation, relationName, oldValue, newValue);
    
    // Remove dropdown
    const dropdown = document.querySelector('.value-dropdown');
    if (dropdown) {
        dropdown.remove();
    }
}

// Function to save the annotation update
function saveAnnotationUpdate(updatedAnnotation, oldRelation, newRelation) {
    // Get sentence ID and document ID from the URL
    const urlParts = window.location.pathname.split('/');
    const sent_id = urlParts[urlParts.length - 1];
    const doc_version_id = urlParts[urlParts.length - 2];
    
    console.log(`Replacing ${oldRelation} with ${newRelation}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_relation/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken() // Function to get CSRF token
        },
        body: JSON.stringify({
            annotation: updatedAnnotation,
            old_relation: oldRelation,
            new_relation: newRelation
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Update successful:', data);
        // Show success message
        showNotification('Relation updated successfully', 'success');
    })
    .catch(error => {
        console.error('Error updating relation:', error);
        // Show error message
        showNotification('Error updating relation: ' + error.message, 'error');
    });
}

// Function to save the value update
function saveValueUpdate(updatedAnnotation, relationName, oldValue, newValue) {
    // Get sentence ID and document ID from the URL
    const urlParts = window.location.pathname.split('/');
    const sent_id = urlParts[urlParts.length - 1];
    const doc_version_id = urlParts[urlParts.length - 2];
    
    console.log(`Replacing value for ${relationName} from ${oldValue} to ${newValue}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_value/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken() // Function to get CSRF token
        },
        body: JSON.stringify({
            annotation: updatedAnnotation,
            relation: relationName,
            old_value: oldValue,
            new_value: newValue
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Update successful:', data);
        // Show success message
        showNotification('Value updated successfully', 'success');
    })
    .catch(error => {
        console.error('Error updating value:', error);
        // Show error message
        showNotification('Error updating value: ' + error.message, 'error');
    });
}

// Function to get CSRF token from cookies
function getCsrfToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Function to show notification
function showNotification(message, type) {
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
    } else {
        notification.style.backgroundColor = '#2196f3';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Function to add branch operations to the annotation tree
function addBranchOperations(annotationElement) {
    // Get all the relation spans
    const relationSpans = annotationElement.querySelectorAll('.relation-span');
    
    // Add delete icons to each relation span
    relationSpans.forEach(span => {
        // Create delete icon
        const deleteIcon = document.createElement('span');
        deleteIcon.innerHTML = '🗑️';
        deleteIcon.className = 'delete-branch-icon';
        deleteIcon.title = 'Delete this branch';
        deleteIcon.style.cursor = 'pointer';
        deleteIcon.style.marginLeft = '4px';
        deleteIcon.style.fontSize = '12px';
        deleteIcon.style.opacity = '0.6';
        deleteIcon.style.display = 'none'; // Hidden by default
        
        // Show icon on hover
        span.addEventListener('mouseenter', () => {
            deleteIcon.style.display = 'inline';
        });
        
        span.addEventListener('mouseleave', () => {
            deleteIcon.style.display = 'none';
        });
        
        // Handle delete action
        deleteIcon.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent triggering parent click events
            confirmDeleteBranch(span);
        });
        
        // Insert the delete icon after the span
        span.insertAdjacentElement('afterend', deleteIcon);
    });
    
    // Also add right-click context menu
    annotationElement.addEventListener('contextmenu', (event) => {
        // Find if we right-clicked on a relation span
        let target = event.target;
        if (target.classList.contains('relation-span')) {
            event.preventDefault(); // Prevent default context menu
            showBranchContextMenu(target, event.clientX, event.clientY);
        }
    });
}

// Function to show branch context menu
function showBranchContextMenu(relationSpan, x, y) {
    // Remove any existing context menus
    const existingMenus = document.querySelectorAll('.branch-context-menu');
    existingMenus.forEach(menu => menu.remove());
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'branch-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.backgroundColor = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.borderRadius = '4px';
    menu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    menu.style.padding = '5px 0';
    menu.style.zIndex = '1000';
    
    // Add menu items
    const deleteItem = document.createElement('div');
    deleteItem.textContent = '🗑️ Delete Branch';
    deleteItem.style.padding = '8px 12px';
    deleteItem.style.cursor = 'pointer';
    deleteItem.style.hover = 'background-color: #f0f0f0';
    
    deleteItem.addEventListener('mouseover', () => {
        deleteItem.style.backgroundColor = '#f0f0f0';
    });
    
    deleteItem.addEventListener('mouseout', () => {
        deleteItem.style.backgroundColor = '';
    });
    
    deleteItem.addEventListener('click', () => {
        menu.remove();
        confirmDeleteBranch(relationSpan);
    });
    
    menu.appendChild(deleteItem);
    
    // Add the menu to the document
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    document.addEventListener('click', () => {
        menu.remove();
    }, { once: true });
}

// Function to confirm branch deletion
function confirmDeleteBranch(relationSpan) {
    // Create confirmation dialog
    const dialog = document.createElement('div');
    dialog.className = 'branch-delete-dialog';
    dialog.style.position = 'fixed';
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.backgroundColor = '#fff';
    dialog.style.border = '1px solid #ccc';
    dialog.style.borderRadius = '4px';
    dialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    dialog.style.padding = '20px';
    dialog.style.zIndex = '2000';
    dialog.style.minWidth = '300px';
    
    const relation = relationSpan.textContent;
    
    dialog.innerHTML = `
        <h4 style="margin-top: 0;">Delete Branch</h4>
        <p>Are you sure you want to delete the branch starting with <strong>${relation}</strong> and all its subbranches?</p>
        <div style="text-align: right; margin-top: 20px;">
            <button id="cancel-delete" style="margin-right: 10px; padding: 5px 10px;">Cancel</button>
            <button id="confirm-delete" style="padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 4px;">Delete</button>
        </div>
    `;
    
    // Add the dialog to the document
    document.body.appendChild(dialog);
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '1999';
    document.body.appendChild(backdrop);
    
    // Handle buttons
    const cancelButton = dialog.querySelector('#cancel-delete');
    const confirmButton = dialog.querySelector('#confirm-delete');
    
    cancelButton.addEventListener('click', () => {
        dialog.remove();
        backdrop.remove();
    });
    
    confirmButton.addEventListener('click', () => {
        dialog.remove();
        backdrop.remove();
        deleteBranch(relationSpan);
    });
}

// Function to delete a branch from the annotation
function deleteBranch(relationSpan) {
    const annotationElement = document.querySelector('#amr pre');
    const originalText = annotationElement.textContent;
    
    // Find the position of the relation in the original text
    const relationText = relationSpan.textContent;
    const spanIndex = Array.from(annotationElement.querySelectorAll('.relation-span')).indexOf(relationSpan);
    
    // Find the relation occurrence in the text (need to find the specific instance)
    let relationMatches = findAllMatches(originalText, relationText);
    
    if (relationMatches.length <= spanIndex) {
        console.error('Could not locate the relation in the text');
        showNotification('Error: Could not locate the branch to delete', 'error');
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
    
    const { start, end, parentIndent } = branchInfo;
    
    // Create updated text by removing the branch
    const updatedText = originalText.substring(0, start) + originalText.substring(end);
    
    // Update the annotation display
    annotationElement.textContent = updatedText;
    
    // Reinitialize the relation editor
    makeRelationsClickable(annotationElement);
    makeValuesClickable(annotationElement);
    addBranchOperations(annotationElement);
    
    // Save the updated annotation
    saveBranchDeletion(updatedText, relationText);
    
    showNotification(`Deleted branch: ${relationText}`, 'success');
}

// Function to find all matches of a substring in a string
function findAllMatches(str, substr) {
    const positions = [];
    let pos = str.indexOf(substr);
    
    while (pos !== -1) {
        positions.push(pos);
        pos = str.indexOf(substr, pos + 1);
    }
    
    return positions;
}

// Function to determine the boundaries of a branch in the annotation text
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

// Function to save the branch deletion
function saveBranchDeletion(updatedAnnotation, deletedRelation) {
    // Get sentence ID and document ID from the URL
    const urlParts = window.location.pathname.split('/');
    const sent_id = urlParts[urlParts.length - 1];
    const doc_version_id = urlParts[urlParts.length - 2];
    
    console.log(`Deleting branch with relation: ${deletedRelation}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_annotation/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
            annotation: updatedAnnotation,
            operation: 'delete_branch',
            relation: deletedRelation
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Update successful:', data);
    })
    .catch(error => {
        console.error('Error updating annotation:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
    });
}

// Initialize relation editor when DOM is loaded
document.addEventListener('DOMContentLoaded', initRelationEditor); 