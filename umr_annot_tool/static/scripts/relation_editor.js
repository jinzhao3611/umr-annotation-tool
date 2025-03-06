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

// Initialize relation editor when DOM is loaded
document.addEventListener('DOMContentLoaded', initRelationEditor); 