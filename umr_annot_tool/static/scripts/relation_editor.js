console.log('relation_editor.js loaded');

// This will be populated from the template
let umrRelations = [];

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
    } catch (error) {
        console.error('Error loading relations:', error);
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
    
    // Add event listener to document to close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdowns = document.querySelectorAll('.relation-dropdown');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target) && !event.target.classList.contains('relation-span')) {
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