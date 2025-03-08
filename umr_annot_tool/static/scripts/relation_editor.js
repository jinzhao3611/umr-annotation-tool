console.log('relation_editor.js loaded');

// Global variables to store UMR relations and their values
let umrRelations = [];
let umrRelationValues = {};
// Global variable to track in-place edit mode
let inPlaceEditMode = false;

// DOM ready check to initialize the editor
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing relation editor');
    // Initialize the editor with a small delay to ensure DOM is fully ready
    setTimeout(initRelationEditor, 300);
});

// Backup initialization - if the script loads after DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('Document already ready, initializing relation editor');
    setTimeout(initRelationEditor, 300);
}

// Initialize the relation editor functionality
function initRelationEditor() {
    console.log('Initializing relation editor...');
    
    // Load relations and values data
    try {
        const relationsElement = document.getElementById('umr-relations-data');
        if (relationsElement) {
            umrRelations = JSON.parse(relationsElement.textContent);
            console.log(`Loaded ${umrRelations.length} relations from server`);
        } else {
            console.warn('Relations data element not found, using default relations');
            // Fallback to a minimal set of common relations
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
    
    // Get the annotation element
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        console.error('Annotation element not found. Selector: #amr pre');
        // Try alternative selectors
        const alternativeElement = document.querySelector('pre') || document.querySelector('.annotation');
        if (alternativeElement) {
            console.log('Found alternative annotation element:', alternativeElement);
            // Continue with the alternative element
            setupEditor(alternativeElement);
        } else {
            console.error('No suitable annotation element found. Editor initialization failed.');
            // Add a small delay and try again in case DOM is still loading
            setTimeout(() => {
                const retryElement = document.querySelector('#amr pre');
                if (retryElement) {
                    console.log('Found annotation element on retry');
                    setupEditor(retryElement);
                } else {
                    console.error('Failed to find annotation element even after delay');
                }
            }, 1000);
        }
        return;
    }
    
    // Setup the editor with the found element
    setupEditor(annotationElement);
}

// Function to setup the editor once we have the annotation element
function setupEditor(annotationElement) {
    try {
        console.log('Setting up editor with inPlaceEditMode =', inPlaceEditMode);
        
        // Create and add the in-place edit toggle button
        addInPlaceEditToggle();
        
        // Make relations and values clickable
        makeRelationsClickable(annotationElement);
        makeValuesClickable(annotationElement);
        makeVariablesClickable(annotationElement);  // Make variables clickable for branch addition
        
        // Setup branch operations (delete, move) - this will only add trash bins if inPlaceEditMode is false
        addBranchOperations(annotationElement);
        
        // Extract sentence tokens for later use in concept suggestion
        extractSentenceTokens();
        
        // Add event listener to document to close dropdowns when clicking outside
        document.addEventListener('click', function(event) {
            const dropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
            if (dropdowns.length > 0) {
                const isClickInsideDropdown = Array.from(dropdowns).some(dropdown => 
                    dropdown.contains(event.target)
                );
                const isClickOnRelationSpan = event.target.classList.contains('relation-span');
                const isClickOnValueSpan = event.target.classList.contains('value-span');
                
                if (!isClickInsideDropdown && !isClickOnRelationSpan && !isClickOnValueSpan) {
                    dropdowns.forEach(dropdown => dropdown.remove());
                }
            }
        });
        
        console.log('Relation editor setup complete');
    } catch (error) {
        console.error('Error setting up relation editor:', error);
    }
}

// Function to add in-place edit toggle button
function addInPlaceEditToggle() {
    // Find a good place to add the toggle
    const container = document.querySelector('.annotation-container') || document.querySelector('#amr');
    if (!container) {
        console.error('Could not find container for edit toggle button');
        return;
    }
    
    // Create toggle button container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'edit-toggle-container';
    toggleContainer.style.marginBottom = '15px';
    toggleContainer.style.marginTop = '10px';
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.padding = '10px';
    toggleContainer.style.backgroundColor = '#f8f9fa';
    toggleContainer.style.borderRadius = '5px';
    toggleContainer.style.border = '1px solid #ddd';
    
    // Create the toggle switch
    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'switch';
    toggleSwitch.style.position = 'relative';
    toggleSwitch.style.display = 'inline-block';
    toggleSwitch.style.width = '60px';
    toggleSwitch.style.height = '30px';
    toggleSwitch.style.marginRight = '15px';
    
    // Create the checkbox input
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.id = 'edit-mode-toggle';
    toggleInput.style.opacity = '0';
    toggleInput.style.width = '0';
    toggleInput.style.height = '0';
    
    // Create the slider
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';
    toggleSlider.style.position = 'absolute';
    toggleSlider.style.cursor = 'pointer';
    toggleSlider.style.top = '0';
    toggleSlider.style.left = '0';
    toggleSlider.style.right = '0';
    toggleSlider.style.bottom = '0';
    toggleSlider.style.backgroundColor = '#ccc';
    toggleSlider.style.transition = '.4s';
    toggleSlider.style.borderRadius = '34px';
    
    // Create status indicator text that will change with toggle state
    const statusIndicator = document.createElement('span');
    statusIndicator.id = 'toggle-status';
    statusIndicator.textContent = 'OFF';
    statusIndicator.style.position = 'absolute';
    statusIndicator.style.right = '7px';
    statusIndicator.style.top = '6px';
    statusIndicator.style.fontWeight = 'bold';
    statusIndicator.style.fontSize = '12px';
    statusIndicator.style.color = '#666';
    statusIndicator.style.textShadow = '0 0 2px white';
    toggleSlider.appendChild(statusIndicator);
    
    // Add the slider before/after styles as inline CSS
    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = `
        .slider:before {
            position: absolute;
            content: "";
            height: 22px;
            width: 22px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        input:checked + .slider {
            background-color: #2196F3;
        }
        
        input:focus + .slider {
            box-shadow: 0 0 1px #2196F3;
        }
        
        input:checked + .slider:before {
            transform: translateX(30px);
        }
        
        input:checked + .slider #toggle-status {
            left: 8px;
            right: auto;
            color: white;
        }
    `;
    document.head.appendChild(sliderStyle);
    
    // Create the label text with mode icons
    const editModeIcon = document.createElement('span');
    editModeIcon.innerHTML = '🔽'; // Dropdown icon
    editModeIcon.style.marginRight = '5px';
    
    const toggleLabel = document.createElement('span');
    toggleLabel.innerHTML = '<b>In-place Edit Mode</b>';
    toggleLabel.style.fontSize = '1.1em';
    
    // Add mode description container
    const modeDescriptionContainer = document.createElement('div');
    modeDescriptionContainer.style.display = 'flex';
    modeDescriptionContainer.style.flexDirection = 'column';
    modeDescriptionContainer.style.marginLeft = '10px';
    
    // Current mode indicator that will update with toggle state
    const currentModeText = document.createElement('div');
    currentModeText.id = 'current-mode-text';
    currentModeText.style.fontWeight = 'bold';
    currentModeText.style.marginBottom = '3px';
    currentModeText.innerHTML = '<span style="color:#28a745">Branch Operation Mode</span> active (add/delete/move)';
    
    // Add description text
    const descriptionText = document.createElement('div');
    descriptionText.style.fontSize = '0.85em';
    descriptionText.style.color = '#666';
    descriptionText.innerHTML = 'Toggle to switch between dropdown editing and branch operations';
    
    // Build the toggle switch
    toggleSwitch.appendChild(toggleInput);
    toggleSwitch.appendChild(toggleSlider);
    
    // Add elements to mode description container
    modeDescriptionContainer.appendChild(currentModeText);
    modeDescriptionContainer.appendChild(descriptionText);
    
    // Add the toggle and label to the container
    toggleContainer.appendChild(toggleSwitch);
    toggleContainer.appendChild(editModeIcon);
    toggleContainer.appendChild(toggleLabel);
    toggleContainer.appendChild(modeDescriptionContainer);
    
    // Add the toggle container before the annotation
    container.insertBefore(toggleContainer, container.firstChild);
    
    // Add event listener for the toggle
    toggleInput.addEventListener('change', function() {
        // Update inPlaceEditMode state
        inPlaceEditMode = this.checked;
        
        // Update the toggle appearance
        updateToggleAppearance(this.checked, editModeIcon, currentModeText, statusIndicator);
        
        // If turning edit mode ON, immediately remove all delete icons
        if (inPlaceEditMode) {
            console.log('Turning edit mode ON, removing all trash bin icons');
            const deleteIcons = document.querySelectorAll('.delete-branch-icon');
            deleteIcons.forEach(icon => icon.remove());
        } else {
            console.log('Turning edit mode OFF, restoring branch operations');
            // For OFF mode, we need to ensure everything for branch operations is ready
            const annotationElement = document.querySelector('#amr pre');
            if (annotationElement) {
                // Re-add variable clickability for branch operations
                makeVariablesClickable(annotationElement);
            }
        }
        
        // Update edit mode status
        updateEditModeStatus();
        
        // Remove any open dropdowns when toggling
        const dropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
        dropdowns.forEach(dropdown => dropdown.remove());
    });
    
    // Initialize toggle appearance
    updateToggleAppearance(false, editModeIcon, currentModeText, statusIndicator);
}

// Function to update toggle button appearance
function updateToggleAppearance(isChecked, iconElement, modeTextElement, statusElement) {
    if (isChecked) {
        // ON state - Dropdown Edit Mode
        iconElement.innerHTML = '🔽'; // Dropdown icon
        modeTextElement.innerHTML = '<span style="color:#2196F3">Dropdown Edit Mode</span> active (edit relations/values)';
        statusElement.textContent = 'ON';
    } else {
        // OFF state - Branch Operation Mode
        iconElement.innerHTML = '🌿'; // Branch icon
        modeTextElement.innerHTML = '<span style="color:#28a745">Branch Operation Mode</span> active (add/delete/move)';
        statusElement.textContent = 'OFF';
    }
}

// Function to update UI based on current edit mode
function updateEditModeStatus() {
    console.log('Updating edit mode status. inPlaceEditMode =', inPlaceEditMode);
    
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        console.error('Cannot find annotation element (#amr pre) to update edit mode');
        return;
    }
    
    // We've removed the delete icons, so we don't need to remove them when switching modes
    
    // Visual indicator for edit mode
    if (inPlaceEditMode) {
        console.log('Enabling in-place edit mode UI');
        annotationElement.style.border = '2px solid #2196F3';
        annotationElement.style.borderRadius = '4px';
        annotationElement.style.padding = '8px';
        
        // Make sure event handlers are attached for edit mode
        makeRelationsClickable(annotationElement);
        makeValuesClickable(annotationElement);
        
        // Show notification
        try {
            showNotification('In-place Edit Mode is ON. Click on relations and values to edit. Branch operations disabled.', 'info', 3000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    } else {
        console.log('Disabling in-place edit mode UI');
        annotationElement.style.border = '2px solid #28a745';
        annotationElement.style.borderRadius = '4px';
        annotationElement.style.padding = '8px';
        
        // Re-add branch operations with trash bins when in-place edit is OFF
        addBranchOperations(annotationElement);
        
        // Re-add variable clickability for branch addition
        makeVariablesClickable(annotationElement);
        
        // Show notification
        try {
            showNotification('In-place Edit Mode is OFF. Branch operations enabled (add/delete/move). Dropdowns disabled.', 'info', 3000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
    
    // Remove any open dropdowns when toggling
    const dropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
    dropdowns.forEach(dropdown => dropdown.remove());
    
    console.log('Edit mode status updated');
}

// Function to make relations in the annotation clickable
function makeRelationsClickable(annotationElement) {
    if (!annotationElement) {
        console.error('makeRelationsClickable: annotationElement is null or undefined');
        return;
    }
    
    console.log('Making relations clickable...');
    const text = annotationElement.textContent;
    const relationRegex = /(\s+)(:[A-Za-z0-9\-]+)/g;
    
    let html = text.replace(relationRegex, function(match, space, relation) {
        return `${space}<span class="relation-span" style="cursor:pointer; color:#0066cc;">${relation}</span>`;
    });
    
    annotationElement.innerHTML = html;
    
    // Add click event listeners to all relation spans
    const relationSpans = annotationElement.querySelectorAll('.relation-span');
    console.log(`Found ${relationSpans.length} relation spans`);
    
    relationSpans.forEach((span, index) => {
        span.addEventListener('click', function(event) {
            console.log(`Relation span clicked: ${span.textContent}`);
            event.stopPropagation();
            // Only show dropdown if edit mode is enabled
            if (inPlaceEditMode) {
                console.log('Edit mode is enabled, showing dropdown');
                showRelationDropdown(span);
            } else {
                console.log('Edit mode is NOT enabled, dropdown not shown');
            }
        });
        
        // Add a data attribute to help identify spans
        span.setAttribute('data-relation-index', index);
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
            // Only show dropdown if edit mode is enabled
            if (inPlaceEditMode) {
                const relationName = span.getAttribute('data-relation');
                showValueDropdown(span, relationName);
            }
        });
    });
}

// Function to show the relation dropdown
function showRelationDropdown(relationSpan) {
    console.log('showRelationDropdown called with span:', relationSpan); 
    
    // Remove any existing dropdowns
    const existingDropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
    existingDropdowns.forEach(dropdown => dropdown.remove());
    
    const currentRelation = relationSpan.textContent;
    console.log('Current relation:', currentRelation);
    
    // Get position of the span
    const spanRect = relationSpan.getBoundingClientRect();
    console.log('Span position:', spanRect.left, spanRect.top, spanRect.bottom);
    
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'relation-dropdown';
    
    // Set fixed styling to make it more visible
    const dropdownStyle = {
        position: 'fixed',
        left: `${spanRect.left}px`,
        top: `${spanRect.bottom + 5}px`,
        zIndex: '9999',
        background: '#fff',
        border: '2px solid #0066cc',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxHeight: '300px',
        overflowY: 'auto',
        minWidth: '200px',
        padding: '5px'
    };
    
    // Apply styles
    Object.assign(dropdown.style, dropdownStyle);
    
    // Add visible debug information to help troubleshoot
    const debugInfo = document.createElement('div');
    debugInfo.textContent = `Current relation: ${currentRelation}`;
    debugInfo.style.padding = '5px';
    debugInfo.style.backgroundColor = '#f0f0f0';
    debugInfo.style.borderBottom = '1px solid #ccc';
    debugInfo.style.fontSize = '12px';
    dropdown.appendChild(debugInfo);
    
    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search relations...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '8px';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.border = '1px solid #ccc';
    searchInput.style.borderRadius = '4px';
    searchInput.style.margin = '5px 0';
    
    // Add search input to dropdown
    dropdown.appendChild(searchInput);
    
    // Create relation list container
    const relationList = document.createElement('div');
    relationList.className = 'relation-list';
    relationList.style.maxHeight = '250px';
    relationList.style.overflowY = 'auto';
    dropdown.appendChild(relationList);
    
    // Function to render filtered relations
    function renderRelations(filter = '') {
        // Clear existing items
        relationList.innerHTML = '';
        
        // Filter relations based on search input
        const filteredRelations = umrRelations.filter(rel => 
            rel.toLowerCase().includes(filter.toLowerCase())
        );
        console.log('Filtered relations:', filteredRelations.length);
        
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
        
        // Ensure we have some visible content even if relations array is empty
        if (filteredRelations.length === 0 && !currentRelation.startsWith(':')) {
            const placeholder = document.createElement('div');
            placeholder.textContent = 'Example relations: :ARG0, :ARG1, :time, :location';
            placeholder.style.padding = '8px 16px';
            placeholder.style.color = '#666';
            relationList.appendChild(placeholder);
            
            // Add some default relations if the list is empty
            [':ARG0', ':ARG1', ':ARG2', ':mod', ':time', ':location'].forEach(relation => {
                const item = document.createElement('div');
                item.textContent = relation;
                item.style.padding = '8px 16px';
                item.style.cursor = 'pointer';
                item.addEventListener('click', function() {
                    replaceRelation(relationSpan, relation);
                });
                relationList.appendChild(item);
            });
        } else {
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
    console.log('Dropdown added to the document body at position:', 
        dropdown.style.left, dropdown.style.top, 
        'Size:', dropdown.offsetWidth, dropdown.offsetHeight);
    
    // Focus search input
    searchInput.focus();
    
    // Close dropdown when clicking outside
    setTimeout(() => {
        const closeListener = function(event) {
            if (!dropdown.contains(event.target) && 
                event.target !== relationSpan && 
                !relationSpan.contains(event.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeListener);
            }
        };
        document.addEventListener('click', closeListener);
    }, 100);
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
    // Get sentence ID and document ID from the hidden fields
    const sent_id = document.getElementById('snt_id').value;
    const doc_version_id = document.getElementById('doc_version_id').value;
    
    console.log(`Replacing ${oldRelation} with ${newRelation}`);
    console.log(`Using sent_id=${sent_id}, doc_version_id=${doc_version_id}`);
    
    const url = `/update_relation/${doc_version_id}/${sent_id}`;
    console.log(`Making request to URL: ${url}`);
    console.log(`Request body:`, {
        annotation: updatedAnnotation,
        old_relation: oldRelation,
        new_relation: newRelation
    });
    
    // Use fetch API to send the update to the server
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
            annotation: updatedAnnotation,
            old_relation: oldRelation,
            new_relation: newRelation
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Relation updated successfully');
            showNotification('Relation updated successfully', 'success');
        } else {
            console.error('Error updating relation:', data.error);
            showNotification(`Error: ${data.error}`, 'error');
        }
    })
    .catch(error => {
        console.error('Error updating relation:', error);
        showNotification(`Error: ${error.message}`, 'error');
    });
}

// Function to save the value update
function saveValueUpdate(updatedAnnotation, relationName, oldValue, newValue) {
    // Get sentence ID and document ID from the hidden fields
    const sent_id = document.getElementById('snt_id').value;
    const doc_version_id = document.getElementById('doc_version_id').value;
    
    console.log(`Replacing value for ${relationName} from ${oldValue} to ${newValue}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_value/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
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

// Function to add branch operations to the annotation tree
function addBranchOperations(annotationElement) {
    // If in-place edit mode is on, do not add branch operations
    if (inPlaceEditMode) {
        console.log('In-place edit mode is ON, skipping branch operations');
        return;
    }

    console.log('Adding branch operations (right-click menu only)');
    
    // Get all the relation spans
    const relationSpans = annotationElement.querySelectorAll('.relation-span');
    
    // Remove code that adds delete icons to each relation span
    // We're keeping only the right-click context menu
    
    // Add right-click context menu
    annotationElement.addEventListener('contextmenu', (event) => {
        // Only enable context menu if edit mode is OFF (for branch operations)
        if (!inPlaceEditMode) {
            // Find if we right-clicked on a relation span
            let target = event.target;
            if (target.classList.contains('relation-span')) {
                event.preventDefault(); // Prevent default context menu
                showBranchContextMenu(target, event.clientX, event.clientY);
            } else if (target.classList.contains('variable-span')) {
                // Handle right click on variable for branch addition
                event.preventDefault();
                showVariableContextMenu(target, event.clientX, event.clientY);
            }
        }
    });
}

// Global variables to track branch move state
let moveSourceSpan = null;
let moveMode = false;

// Function to show branch context menu
function showBranchContextMenu(relationSpan, x, y) {
    // Only show context menu if edit mode is enabled
    if (inPlaceEditMode) return;
    
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
    
    // Add "Move Branch" item
    const moveItem = document.createElement('div');
    moveItem.textContent = '🔄 Move Branch';
    moveItem.style.padding = '8px 12px';
    moveItem.style.cursor = 'pointer';
    
    moveItem.addEventListener('mouseover', () => {
        moveItem.style.backgroundColor = '#f0f0f0';
    });
    
    moveItem.addEventListener('mouseout', () => {
        moveItem.style.backgroundColor = '';
    });
    
    moveItem.addEventListener('click', () => {
        menu.remove();
        startBranchMove(relationSpan);
    });
    
    menu.appendChild(moveItem);

    // Add "Store Temporarily" item
    const storeItem = document.createElement('div');
    storeItem.textContent = '📦 Store Temporarily';
    storeItem.className = 'store-temp-option';
    storeItem.style.padding = '8px 12px';
    storeItem.style.cursor = 'pointer';
    storeItem.style.color = '#0066cc';
    
    storeItem.addEventListener('mouseover', () => {
        storeItem.style.backgroundColor = '#f0f0f0';
    });
    
    storeItem.addEventListener('mouseout', () => {
        storeItem.style.backgroundColor = '';
    });
    
    storeItem.addEventListener('click', () => {
        menu.remove();
        // Call the storeBranchTemporarily function from tempBranchStorage.js
        if (typeof storeBranchTemporarily === 'function') {
            storeBranchTemporarily(relationSpan);
        } else {
            console.error('storeBranchTemporarily function not found');
        }
    });
    
    menu.appendChild(storeItem);
    
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
    // Get the annotation element and its text content
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        console.error('Cannot find annotation element');
        return;
    }
    
    // Get the relation text to delete
    const relationText = relationSpan.textContent;
    console.log(`Attempting to delete branch with relation: ${relationText}`);
    
    // Get the full text
    let fullText = annotationElement.textContent;
    
    // 1. Find the parent element of this relation span to get context
    let parentLine = relationSpan;
    let lineText = '';
    
    // Move up to find a parent that contains the entire line
    while (parentLine && parentLine.nodeName !== 'PRE') {
        // If we have text content with the relation in it, we may have found the line
        if (parentLine.textContent && parentLine.textContent.includes(relationText)) {
            lineText = parentLine.textContent.trim();
            // If it looks like a complete line, break
            if (lineText.length > relationText.length + 5) {
                break;
            }
        }
        parentLine = parentLine.parentNode;
    }
    
    // If we couldn't find a good context, use the relation itself
    if (!lineText) {
        // Find where in the text this relation appears
        const allLines = fullText.split('\n');
        for (let i = 0; i < allLines.length; i++) {
            if (allLines[i].includes(relationText)) {
                lineText = allLines[i].trim();
                break;
            }
        }
    }
    
    console.log(`Found relation ${relationText} in context: "${lineText}"`);
    
    // Find the correct instance of this relation in the text
    // We need to find the exact instance that was clicked
    let allRelationSpans = annotationElement.querySelectorAll('.relation-span');
    let matchingSpans = Array.from(allRelationSpans).filter(span => span.textContent === relationText);
    let spanIndex = matchingSpans.indexOf(relationSpan);
    
    // Find all occurrences of this relation in the text
    let relationIndices = [];
    let searchIndex = 0;
    while (true) {
        let foundIndex = fullText.indexOf(relationText, searchIndex);
        if (foundIndex === -1) break;
        relationIndices.push(foundIndex);
        searchIndex = foundIndex + relationText.length;
    }
    
    // Make sure we have the right index
    if (spanIndex >= relationIndices.length) {
        spanIndex = 0; // Fallback to first occurrence if something is wrong
    }
    
    // Get the index of the relation we want to delete
    let relationIndex = relationIndices[spanIndex];
    
    // Check if the next non-whitespace character after the relation is an opening parenthesis
    let afterRelationText = fullText.substring(relationIndex + relationText.length);
    let openParenIndex = -1;
    
    // Find the first non-whitespace character
    for (let i = 0; i < afterRelationText.length; i++) {
        if (afterRelationText[i].trim()) {
            if (afterRelationText[i] === '(') {
                // Found opening parenthesis - this is a complex branch
                openParenIndex = relationIndex + relationText.length + i;
                break;
            } else {
                // Found some other character - this is a simple relation
                break;
            }
        }
    }
    
    // Handle simple and complex branches differently
    if (openParenIndex === -1) {
        // Simple relation with direct value (no parentheses)
        console.log('Simple relation detected');
        
        // Find the end of this value (next whitespace, end of line, or next relation)
        let endOfLine = fullText.indexOf('\n', relationIndex);
        if (endOfLine === -1) endOfLine = fullText.length;
        
        let nextColon = fullText.indexOf(':', relationIndex + relationText.length);
        if (nextColon === -1 || nextColon > endOfLine) nextColon = endOfLine;
        
        // Find where to cut the text
        let cutStart = relationIndex;
        // Find start of the relation (include any whitespace before it)
        while (cutStart > 0 && /\s/.test(fullText[cutStart - 1])) {
            cutStart--;
        }
        
        let cutEnd = nextColon;
        
        // Get the text to be deleted
        const textToDelete = fullText.substring(cutStart, cutEnd);
        console.log(`Simple branch text to delete: "${textToDelete}"`);
        
        // Check if the simple branch contains any parentheses
        const unmatchedParentheses = extractUnmatchedParentheses(textToDelete);
        
        // For simple relations, just delete the whole thing as they don't typically have parentheses
        // But if there are unmatched parentheses, preserve them
        let updatedText;
        if (unmatchedParentheses.length > 0) {
            console.log(`Preserving unmatched parentheses in simple branch: "${unmatchedParentheses}"`);
            // Insert the unmatched parentheses at the cut point
            updatedText = fullText.substring(0, cutStart) + 
                          unmatchedParentheses + 
                          fullText.substring(cutEnd);
            
            // Display a special notification about preserved parentheses
            showNotification(`Deleted branch and preserved unmatched parentheses: ${unmatchedParentheses}`, 'info', 5000);
        } else {
            updatedText = fullText.substring(0, cutStart) + fullText.substring(cutEnd);
        }
        
        // Update the DOM
        annotationElement.textContent = updatedText;
        
        // Re-initialize interactive elements
        makeRelationsClickable(annotationElement);
        makeValuesClickable(annotationElement);
        makeVariablesClickable(annotationElement);
        addBranchOperations(annotationElement);
        
        // Save the updated annotation
        saveBranchDeletion(updatedText, relationText);
        
        showNotification(`Deleted simple branch: ${relationText}`, 'success');
        return;
    }
    
    // Complex branch with parentheses
    console.log('Complex relation with parentheses detected');
    
    // Find the matching closing parenthesis, considering nesting
    let depth = 1;
    let closeParenIndex = -1;
    
    for (let i = openParenIndex + 1; i < fullText.length; i++) {
        if (fullText[i] === '(') {
            depth++;
        } else if (fullText[i] === ')') {
            depth--;
            if (depth === 0) {
                closeParenIndex = i;
                break;
            }
        }
    }
    
    if (closeParenIndex === -1) {
        console.error('Could not find matching closing parenthesis');
        showNotification('Error: Unmatched parentheses in branch', 'error');
        return;
    }
    
    // Find the start of the entire branch - include the relation and any whitespace before it
    let branchStart = relationIndex;
    while (branchStart > 0 && /\s/.test(fullText[branchStart - 1])) {
        branchStart--;
    }
    
    // End of the branch is after the closing parenthesis
    let branchEnd = closeParenIndex + 1;
    
    // Get the branch content for analysis
    const branchContent = fullText.substring(branchStart, branchEnd);
    console.log(`Complex branch to delete: "${branchContent}"`);
    
    // Check if the branch content has balanced parentheses
    const hasBalancedParentheses = isBalancedParentheses(branchContent);
    console.log(`Branch has balanced parentheses: ${hasBalancedParentheses}`);
    
    let updatedText;
    
    if (hasBalancedParentheses) {
        // If parentheses are balanced, delete the entire branch
        updatedText = fullText.substring(0, branchStart) + fullText.substring(branchEnd);
        console.log('Deleting entire branch with balanced parentheses');
    } else {
        // If parentheses are unbalanced, preserve the unmatched ones
        const unmatchedParentheses = extractUnmatchedParentheses(branchContent);
        console.log(`Preserving unmatched parentheses: "${unmatchedParentheses}"`);
        
        if (unmatchedParentheses.length > 0) {
            // Add a debug line to ensure the content is really there
            console.log(`Unmatched parentheses: ${unmatchedParentheses.split('').map(c => c.charCodeAt(0)).join(',')}`);
            
            // Insert the preserved parentheses at the position where the branch was
            // and preserve indentation
            let indentation = '';
            let startPos = branchStart;
            // Find the start of the line containing the branch
            while (startPos > 0 && fullText[startPos - 1] !== '\n') {
                startPos--;
            }
            // Extract the indentation
            while (startPos < branchStart && /\s/.test(fullText[startPos])) {
                indentation += fullText[startPos];
                startPos++;
            }
            
            // Replace the branch with just the unmatched parentheses with proper indentation
            updatedText = fullText.substring(0, branchStart) + 
                         unmatchedParentheses + 
                         fullText.substring(branchEnd);
            
            // Display a special notification about preserved parentheses
            showNotification(`Preserved unmatched parentheses: ${unmatchedParentheses}`, 'info', 5000);
        } else {
            // No unmatched parentheses to preserve, just delete the branch
            updatedText = fullText.substring(0, branchStart) + fullText.substring(branchEnd);
        }
    }
    
    // Clean up formatting - remove any consecutive blank lines
    const cleanedLines = updatedText.split('\n').reduce((acc, line) => {
        if (acc.length === 0 || line.trim() || acc[acc.length - 1].trim()) {
            acc.push(line);
        }
        return acc;
    }, []);
    
    updatedText = cleanedLines.join('\n');
    
    // For debugging: verify the parentheses are still there
    if (updatedText.includes('(') || updatedText.includes(')')) {
        console.log('Final text contains parentheses');
        
        // Print a portion of the text around any parentheses for verification
        for (let i = 0; i < updatedText.length; i++) {
            if (updatedText[i] === '(' || updatedText[i] === ')') {
                const start = Math.max(0, i - 10);
                const end = Math.min(updatedText.length, i + 10);
                console.log(`Parenthesis at position ${i}: "${updatedText.substring(start, end)}"`);
            }
        }
    }
    
    // Check if anything actually changed
    if (updatedText === fullText) {
        console.error('Text did not change after deletion attempt');
        
        // Fallback: try line-by-line deletion with the same strategy
        const lines = fullText.split('\n');
        let startLine = 0;
        let charactersProcessed = 0;
        
        // Find which line contains our relation
        for (let i = 0; i < lines.length; i++) {
            charactersProcessed += lines[i].length + 1; // +1 for newline
            if (charactersProcessed > relationIndex) {
                startLine = i;
                break;
            }
        }
        
        // Find the indentation level of this line
        const indentMatch = lines[startLine].match(/^(\s*)/);
        const indentLevel = indentMatch ? indentMatch[1].length : 0;
        
        // Find the end of this branch by checking indentation
        let endLine = startLine;
        for (let i = startLine + 1; i < lines.length; i++) {
            const lineIndent = lines[i].match(/^(\s*)/)[0].length;
            if (lineIndent <= indentLevel && lines[i].trim() !== '') {
                break;
            }
            endLine = i;
        }
        
        // Extract the branch content from the lines
        const branchLines = lines.slice(startLine, endLine + 1);
        const branchText = branchLines.join('\n');
        
        console.log(`Fallback: Examining branch from line ${startLine} to ${endLine}`);
        console.log(`Branch text: "${branchText}"`);
        
        // Check if the branch content has balanced parentheses
        const hasBalancedParentheses = isBalancedParentheses(branchText);
        
        if (hasBalancedParentheses) {
            // If parentheses are balanced, remove the lines
            lines.splice(startLine, endLine - startLine + 1);
            console.log('Removing lines with balanced parentheses');
        } else {
            // If parentheses are unbalanced, extract the unmatched ones
            const unmatchedParentheses = extractUnmatchedParentheses(branchText);
            console.log(`Preserving unmatched parentheses: "${unmatchedParentheses}"`);
            
            if (unmatchedParentheses.length > 0) {
                // Replace the lines with just the unmatched parentheses (indented properly)
                lines.splice(startLine, endLine - startLine + 1, indentMatch[0] + unmatchedParentheses);
                console.log(`Inserted unmatched parentheses at line ${startLine}`);
            } else {
                // No unmatched parentheses, just remove the lines
                lines.splice(startLine, endLine - startLine + 1);
            }
        }
        
        const fallbackText = lines.join('\n');
        
        // Debug: verify the parentheses are still in the fallback text
        if (unmatchedParentheses.length > 0 && fallbackText.includes(unmatchedParentheses)) {
            console.log(`Verified: unmatched parentheses "${unmatchedParentheses}" are in the fallback text`);
        }
        
        // Update the DOM
        annotationElement.textContent = fallbackText;
        
        // Re-initialize interactive elements
        makeRelationsClickable(annotationElement);
        makeValuesClickable(annotationElement);
        makeVariablesClickable(annotationElement);
        addBranchOperations(annotationElement);
        
        // Save the updated annotation
        saveBranchDeletion(fallbackText, relationText);
        
        showNotification(`Deleted branch using fallback method: ${relationText}`, 'success');
        return;
    }
    
    // Update the DOM with the final text
    console.log('Setting annotation element text content');
    annotationElement.textContent = updatedText;
    
    // Re-initialize interactive elements
    makeRelationsClickable(annotationElement);
    makeValuesClickable(annotationElement);
    makeVariablesClickable(annotationElement);
    addBranchOperations(annotationElement);
    
    // Save the updated annotation
    saveBranchDeletion(updatedText, relationText);
    
    showNotification(`Deleted branch: ${relationText}`, 'success');
}

// Helper function to check if parentheses are balanced in a string
function isBalancedParentheses(text) {
    let stack = [];
    
    for (let char of text) {
        if (char === '(') {
            stack.push(char);
        } else if (char === ')') {
            if (stack.length === 0) {
                return false; // Closing parenthesis without matching opening
            }
            stack.pop();
        }
    }
    
    return stack.length === 0; // If stack is empty, all parentheses are matched
}

// Helper function to extract unmatched parentheses from a string
function extractUnmatchedParentheses(text) {
    let result = '';
    let stack = [];
    
    // First, identify all unmatched parentheses
    let unmatchedOpen = [];
    let unmatchedClose = [];
    
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') {
            stack.push(i);
        } else if (text[i] === ')') {
            if (stack.length === 0) {
                // Unmatched closing parenthesis
                unmatchedClose.push(i);
            } else {
                // This matches an opening parenthesis
                stack.pop();
            }
        }
    }
    
    // Any remaining items in the stack are unmatched opening parentheses
    unmatchedOpen = stack;
    
    // Log the unmatched parentheses for debugging
    if (unmatchedOpen.length > 0) {
        let openPositions = unmatchedOpen.map(pos => pos).join(', ');
        console.log(`Found ${unmatchedOpen.length} unmatched opening parentheses at positions: ${openPositions}`);
    }
    
    if (unmatchedClose.length > 0) {
        let closePositions = unmatchedClose.map(pos => pos).join(', ');
        console.log(`Found ${unmatchedClose.length} unmatched closing parentheses at positions: ${closePositions}`);
    }
    
    // Special handling for cases with multiple unmatched closing parentheses in a row
    // like ':aspect state))' - we want to preserve all of them
    if (unmatchedClose.length > 0) {
        // Check for consecutive unmatched closing parentheses
        let consecutiveCount = 0;
        for (let i = 0; i < unmatchedClose.length - 1; i++) {
            if (unmatchedClose[i + 1] - unmatchedClose[i] === 1) {
                consecutiveCount++;
            }
        }
        if (consecutiveCount > 0) {
            console.log(`Found ${consecutiveCount + 1} consecutive unmatched closing parentheses`);
        }
    }
    
    // Build a string with just the unmatched parentheses in their original order
    if (unmatchedOpen.length > 0 || unmatchedClose.length > 0) {
        // Create an array marking all positions that have unmatched parentheses
        let positions = new Array(text.length).fill(false);
        unmatchedOpen.forEach(i => positions[i] = true);
        unmatchedClose.forEach(i => positions[i] = true);
        
        // Extract just those characters
        for (let i = 0; i < text.length; i++) {
            if (positions[i]) {
                result += text[i];
            }
        }
        
        console.log(`Preserving unmatched parentheses: '${result}'`);
    }
    
    return result;
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to save the branch deletion
function saveBranchDeletion(updatedAnnotation, deletedRelation) {
    // Get sentence ID and document ID from the hidden fields
    const sent_id = document.getElementById('snt_id').value;
    const doc_version_id = document.getElementById('doc_version_id').value;
    
    console.log(`Saving deletion of branch with relation: ${deletedRelation}`);
    
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
            deleted_relation: deletedRelation
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
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

// Function to make variables in the annotation clickable
function makeVariablesClickable(annotationElement) {
    console.log('Making variables clickable for branch addition');
    
    if (!annotationElement) {
        console.error('makeVariablesClickable: annotationElement is null or undefined');
        return;
    }
    
    // First, get the raw text without any span wrappers
    let text = annotationElement.innerHTML;
    
    // Remove any existing variable-span elements to avoid duplication
    text = text.replace(/<span class="variable-span"[^>]*>(.*?)<\/span>/g, '$1');
    
    // This pattern matches variables like s1, s2a, s10b, etc.
    // Updated regex to more accurately capture variable patterns
    const variableRegex = /(\s|\(|\b)(s[0-9]+[a-z]*[0-9]*)\b(?![^<]*>)/g;
    
    let html = text.replace(variableRegex, function(match, prefix, variable) {
        // Don't replace if it's already inside a span
        if (prefix.includes('span')) return match;
        return `${prefix}<span class="variable-span" style="cursor:pointer; color:#9c27b0;">${variable}</span>`;
    });
    
    annotationElement.innerHTML = html;
    
    console.log('Adding context menu to variable spans');
    
    // Add context menu to variable spans
    const variableSpans = annotationElement.querySelectorAll('.variable-span');
    console.log(`Found ${variableSpans.length} variable spans`);
    
    variableSpans.forEach(span => {
        // Remove any existing event listeners
        const newSpan = span.cloneNode(true);
        span.parentNode.replaceChild(newSpan, span);
        
        // Add the context menu event listener
        newSpan.addEventListener('contextmenu', (event) => {
            console.log('Variable contextmenu event triggered');
            // Only show context menu if edit mode is OFF (for branch operations)
            if (!inPlaceEditMode) {
                event.preventDefault();
                showVariableContextMenu(newSpan, event.clientX, event.clientY);
            }
        });
        
        // Add a data attribute to help track variables
        newSpan.setAttribute('data-variable', newSpan.textContent);
    });
    
    // Also ensure relations and values are properly clickable after updating the HTML
    return variableSpans.length; // Return the count for diagnostic purposes
}

// Function to show context menu for variables
function showVariableContextMenu(variableSpan, x, y) {
    // Only show context menu if edit mode is enabled
    if (inPlaceEditMode) return;
    
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
    
    // Add "Add Branch" item
    const addItem = document.createElement('div');
    addItem.textContent = '➕ Add Branch';
    addItem.style.padding = '8px 12px';
    addItem.style.cursor = 'pointer';
    
    addItem.addEventListener('mouseover', () => {
        addItem.style.backgroundColor = '#f0f0f0';
    });
    
    addItem.addEventListener('mouseout', () => {
        addItem.style.backgroundColor = '';
    });
    
    addItem.addEventListener('click', () => {
        menu.remove();
        showAddBranchDialog(variableSpan);
    });
    
    menu.appendChild(addItem);
    
    // Add the menu to the document
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    document.addEventListener('click', () => {
        menu.remove();
    }, { once: true });
}

// Global state for token tracking
let sentenceTokens = [];

// Function to extract tokens from the current sentence section
function extractSentenceTokens() {
    // Get the current sentence element
    const currentSentence = document.querySelector('.current-sentence');
    if (!currentSentence) return [];
    
    // Extract all tokens (words) from the sentence
    const text = currentSentence.textContent;
    const tokens = text.split(/\s+/).filter(token => 
        token.length > 0 && 
        !token.match(/^[.,;:!?()[\]{}]$/) // Filter out solo punctuation
    );
    
    // Store in global for reuse
    sentenceTokens = [...new Set(tokens)]; // Remove duplicates
    return sentenceTokens;
}

// Function to get all available concepts
async function getAllConcepts() {
    // Extract tokens from the current sentence
    const sentenceTokens = extractSentenceTokens();
    
    try {
        // Fetch the predefined concepts from the server
        const response = await fetch('/get_concepts');
        const conceptsData = await response.json();
        
        // Combine tokens with predefined concepts
        const allConcepts = [
            ...sentenceTokens,
            ...conceptsData.discourse_concepts,
            ...conceptsData.ne_types,
            ...conceptsData.non_event_rolesets
        ];
        
        // Remove duplicates and sort
        return [...new Set(allConcepts)].sort();
    } catch (error) {
        console.error('Error fetching concepts:', error);
        // If fetch fails, just return sentence tokens
        return sentenceTokens;
    }
}

// Function to generate a unique variable for a concept
function generateUniqueVariable(conceptName, annotationText) {
    // Extract all existing variables from the annotation
    const existingVariables = [];
    const variableRegex = /\bs[0-9]+[a-z]+[0-9]*\b/g;
    let match;
    
    while ((match = variableRegex.exec(annotationText)) !== null) {
        existingVariables.push(match[0]);
    }
    
    // Get the sentence number from the URL
    const urlParts = window.location.pathname.split('/');
    const sentId = parseInt(urlParts[urlParts.length - 1]) || 1;
    
    // Get the first letter of the concept (or 'x' if not available)
    const conceptInitial = conceptName && conceptName.length > 0 
        ? conceptName[0].toLowerCase()
        : 'x';
    
    // Generate candidate variable name
    let baseVariable = `s${sentId}${conceptInitial}`;
    let counter = 1;
    let candidateVariable = `${baseVariable}`;
    
    // Keep incrementing counter until we find a unique variable
    while (existingVariables.includes(candidateVariable)) {
        candidateVariable = `${baseVariable}${counter}`;
        counter++;
    }
    
    return candidateVariable;
}

// Function to show dialog for adding a branch
async function showAddBranchDialog(parentVariableSpan) {
    const parentVariable = parentVariableSpan.textContent;
    const annotationElement = document.querySelector('#amr pre');
    const annotationText = annotationElement.textContent;
    
    // Find the full node (variable / concept) of the parent
    let parentFullNode = parentVariable;
    let parentConcept = '';
    
    // Search for the full node pattern in the annotation text
    const variableRegex = new RegExp(`\\(\\s*${parentVariable}\\s*/\\s*([^\\s\\(\\):]+)`, 'g');
    const match = variableRegex.exec(annotationText);
    if (match && match[1]) {
        parentConcept = match[1];
        parentFullNode = `${parentVariable} / ${parentConcept}`;
    }
    
    // Get sentence tokens for display
    const sentenceTokens = extractSentenceTokens();
    console.log('Sentence tokens:', sentenceTokens);
    
    // Create dialog container
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'add-branch-dialog-container';
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
    dialog.className = 'add-branch-dialog';
    dialog.style.width = '700px';
    dialog.style.maxWidth = '90vw';
    dialog.style.maxHeight = '90vh';
    dialog.style.overflow = 'auto';
    dialog.style.backgroundColor = 'white';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    // Dialog header
    dialog.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 20px;">Add Branch to ${parentFullNode}</h3>
        <form id="add-branch-form">
            <div style="margin-bottom: 16px;">
                <label for="relation" style="display: block; margin-bottom: 8px; font-weight: bold;">Relation:</label>
                <div style="position: relative; margin-bottom: 8px;">
                    <input type="text" id="relation-search" 
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                        placeholder="Type to search relations...">
                </div>
                <select id="relation" size="10" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; max-height: 250px;">
                    <option value="">Select a relation...</option>
                </select>
            </div>
            
            <!-- Child node selection will be dynamically loaded here based on the relation -->
            <div id="child-node-container"></div>
            
            <div id="name-tokens-container" style="display: none; margin-top: 16px; padding: 12px; background-color: #f9f9f9; border-radius: 4px; border: 1px solid #eee;">
                <h4 style="margin-top: 0; margin-bottom: 12px;">Select tokens for name:</h4>
                <div id="name-tokens-selection" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;"></div>
                <div id="selected-name-tokens" style="margin-top: 8px;">
                    <p style="font-weight: bold; margin-bottom: 8px;">Selected tokens: <span id="selected-tokens-text"></span></p>
                </div>
            </div>
            
            <div style="text-align: right; margin-top: 20px;">
                <button type="button" id="cancel-add-branch" style="padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; background-color: #f5f5f5; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button type="submit" id="confirm-add-branch" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Add Branch</button>
            </div>
        </form>
    `;
    
    dialogContainer.appendChild(dialog);
    document.body.appendChild(dialogContainer);
    
    // Fetch required data from the server
    try {
        // Get concept data from the server (only endpoint we need for now)
        const conceptsResponse = await fetch('/get_concepts');
        const conceptsData = await conceptsResponse.json();
        
        console.log('Concepts data:', conceptsData);
        
        // Hardcoded mapping for relations with predefined values
        // This is a subset of the most commonly used relations with fixed values from rolesets.py
        const relationsWithValues = {
            ':aspect': ['habitual', 'generic', 'iterative', 'inceptive', 'imperfective', 'process', 'atelic-process', 'perfective', 'state', 'reversible-state', 'irreversible-state', 'inherent-state', 'point-state', 'activity', 'undirected-activity', 'directed-activity', 'endeavor', 'semelfactive', 'undirected-endeavor', 'directed-endeavor', 'performance', 'incremental-accomplishment', 'nonincremental-accomplishment', 'directed-achievement', 'reversible-directed-achievement', 'irreversible-directed-achievement'],
            ':degree': ['intensifier', 'downtoner', 'equal'],
            ':modal-strength': ['full-affirmative', 'partial-affirmative', 'neutral-affirmative', 'neutral-negative', 'partial-negative', 'full-negative'],
            ':mode': ['imperative', 'interrogative', 'expressive'],
            ':polarity': ['-', 'umr-unknown', 'truth-value'],
            ':polite': ['+'],
            ':refer-number': ['singular', 'non-singular', 'dual', 'paucal', 'plural', 'non-dual-paucal', 'greater-plural', 'trial', 'non-trial-paucal'],
            ':refer-person': ['1st', '2nd', '3rd', '4th', 'non-3rd', 'non-1st', 'excl', 'incl'],
            ':refer-definiteness': ['class'],
            ':axis-relative-polarities': ['left-handed', 'right-handed'],
            ':framework-type': ['absolute', 'intrinsic', 'relative'],
            ':anchor-framework-translation': ['rotated', 'reflected']
        };
        
        // Extract needed concept categories
        const discourseConceptsList = conceptsData.discourse_concepts || [];
        const neTypesList = conceptsData.ne_types || [];
        const nonEventRolesetsList = conceptsData.non_event_rolesets || [];
        
        // Define abstract concepts list (simplified subset, as the full list is quite long)
        const abstractConceptsList = [
            'person', 'individual-person', 'place', 'event', 'name', 'umr-choice',
            'manner', 'umr-unknown', 'umr-unintelligible', 'umr-empty',
            'date-entity', 'string-entity', 'ordinal-entity', 'url-entity',
            'monetary-quantity', 'distance-quantity', 'temporal-quantity',
            'date-interval', 'value-interval', 'between', 'relative-position'
        ];
        
        // Populate relations dropdown
        const relationSelect = document.getElementById('relation');
        umrRelations.forEach(relation => {
            const option = document.createElement('option');
            option.value = relation;
            option.textContent = relation;
            relationSelect.appendChild(option);
        });
        
        // Set up search functionality for the relations dropdown
        setupDropdownFiltering(
            document.getElementById('relation-search'),
            relationSelect,
            umrRelations
        );
        
        // Function to update the child node container based on selected relation
        function updateChildNodeContainer() {
            const selectedRelation = relationSelect.value;
            const childNodeContainer = document.getElementById('child-node-container');
            
            if (!selectedRelation) {
                childNodeContainer.innerHTML = '';
                return;
            }
            
            console.log(`Selected relation: ${selectedRelation}`);
            
            // Check if the relation has predefined values in our mapping
            const predefinedValues = relationsWithValues[selectedRelation];
            
            if (predefinedValues && predefinedValues.length > 0) {
                // Relation has predefined values - only allow selection from these values
                console.log(`Relation ${selectedRelation} has predefined values:`, predefinedValues);
                
                childNodeContainer.innerHTML = `
                    <div style="margin-bottom: 16px;">
                        <label for="predefined-value" style="display: block; margin-bottom: 8px; font-weight: bold;">Value:</label>
                        <div style="position: relative; margin-bottom: 8px;">
                            <input type="text" id="predefined-value-search" 
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                                placeholder="Type to search values...">
                        </div>
                        <select id="predefined-value" size="10" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; max-height: 250px;">
                            <option value="">Select a value...</option>
                            ${predefinedValues.map(value => `<option value="${value}">${value}</option>`).join('')}
                        </select>
                    </div>
                `;
                
                // Set up filtering for predefined values dropdown
                const searchInput = document.getElementById('predefined-value-search');
                const selectElement = document.getElementById('predefined-value');
                setupDropdownFiltering(searchInput, selectElement, predefinedValues);
                
                // Hide name tokens container as it's not needed for predefined values
                document.getElementById('name-tokens-container').style.display = 'none';
            } else {
                // Relation doesn't have predefined values - show all the different options
                console.log(`Relation ${selectedRelation} doesn't have predefined values`);
                
                childNodeContainer.innerHTML = `
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Child Node Type:</label>
                        <select id="child-node-type" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                            <option value="">Select type...</option>
                            <option value="token">Sentence Token</option>
                            <option value="discourse">Discourse Concept</option>
                            <option value="abstract">Abstract Concept</option>
                            <option value="ne">Named Entity</option>
                            <option value="non-event">Non-Event Roleset</option>
                            <option value="string">String Value</option>
                            <option value="number">Number Value</option>
                        </select>
                    </div>
                    
                    <!-- Container for token selection -->
                    <div id="token-selection-container" style="display: none; margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Select a token:</label>
                        <div style="position: relative; margin-bottom: 8px;">
                            <input type="text" id="token-search" 
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                                placeholder="Type to search tokens...">
                        </div>
                        <div id="tokens-container" style="max-height: 250px; overflow-y: auto; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                            <div id="tokens-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">
                                ${sentenceTokens.map(token => `
                                    <div class="token-item" data-token="${token}" style="padding: 8px; background-color: #f0f8ff; border-radius: 4px; cursor: pointer; text-align: center;">
                                        ${token}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Container for discourse concept selection -->
                    <div id="discourse-selection-container" style="display: none; margin-bottom: 16px;">
                        <label for="discourse-concept" style="display: block; margin-bottom: 8px; font-weight: bold;">Select discourse concept:</label>
                        <div style="position: relative; margin-bottom: 8px;">
                            <input type="text" id="discourse-concept-search" 
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                                placeholder="Type to search discourse concepts...">
                        </div>
                        <select id="discourse-concept" size="10" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; max-height: 250px;">
                            <option value="">Select concept...</option>
                            ${discourseConceptsList.map(concept => `<option value="${concept}">${concept}</option>`).join('')}
                        </select>
                    </div>
                    
                    <!-- Container for abstract concept selection -->
                    <div id="abstract-selection-container" style="display: none; margin-bottom: 16px;">
                        <label for="abstract-concept" style="display: block; margin-bottom: 8px; font-weight: bold;">Select abstract concept:</label>
                        <div style="position: relative; margin-bottom: 8px;">
                            <input type="text" id="abstract-concept-search" 
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                                placeholder="Type to search abstract concepts...">
                        </div>
                        <select id="abstract-concept" size="10" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; max-height: 250px;">
                            <option value="">Select concept...</option>
                            ${abstractConceptsList.map(concept => `<option value="${concept}">${concept}</option>`).join('')}
                        </select>
                    </div>
                    
                    <!-- Container for named entity selection -->
                    <div id="ne-selection-container" style="display: none; margin-bottom: 16px;">
                        <label for="ne-type" style="display: block; margin-bottom: 8px; font-weight: bold;">Select named entity type:</label>
                        <div style="position: relative; margin-bottom: 8px;">
                            <input type="text" id="ne-type-search" 
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                                placeholder="Type to search named entity types...">
                        </div>
                        <select id="ne-type" size="10" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; max-height: 250px;">
                            <option value="">Select entity type...</option>
                            ${neTypesList.map(type => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                    </div>
                    
                    <!-- Container for non-event roleset selection -->
                    <div id="non-event-selection-container" style="display: none; margin-bottom: 16px;">
                        <label for="non-event-roleset" style="display: block; margin-bottom: 8px; font-weight: bold;">Select non-event roleset:</label>
                        <div style="position: relative; margin-bottom: 8px;">
                            <input type="text" id="non-event-roleset-search" 
                                style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" 
                                placeholder="Type to search non-event rolesets...">
                        </div>
                        <select id="non-event-roleset" size="10" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; max-height: 250px;">
                            <option value="">Select roleset...</option>
                            ${nonEventRolesetsList.map(roleset => `<option value="${roleset}">${roleset}</option>`).join('')}
                        </select>
                    </div>
                    
                    <!-- Container for string value input -->
                    <div id="string-input-container" style="display: none; margin-bottom: 16px;">
                        <label for="string-value" style="display: block; margin-bottom: 8px; font-weight: bold;">Enter string value:</label>
                        <input type="text" id="string-value" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Enter string value (without quotes)">
                    </div>
                    
                    <!-- Container for number value input -->
                    <div id="number-input-container" style="display: none; margin-bottom: 16px;">
                        <label for="number-value" style="display: block; margin-bottom: 8px; font-weight: bold;">Enter number value:</label>
                        <input type="number" id="number-value" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Enter numeric value">
                    </div>
                `;
                
                // Setup child node type selection
                const childNodeTypeSelect = document.getElementById('child-node-type');
                const tokenContainer = document.getElementById('token-selection-container');
                const discourseContainer = document.getElementById('discourse-selection-container');
                const abstractContainer = document.getElementById('abstract-selection-container');
                const neContainer = document.getElementById('ne-selection-container');
                const nonEventContainer = document.getElementById('non-event-selection-container');
                const stringContainer = document.getElementById('string-input-container');
                const numberContainer = document.getElementById('number-input-container');
                const nameTokensContainer = document.getElementById('name-tokens-container');
                
                // Set up filtering for each dropdown
                setupDropdownFiltering(
                    document.getElementById('discourse-concept-search'), 
                    document.getElementById('discourse-concept'), 
                    discourseConceptsList
                );
                
                setupDropdownFiltering(
                    document.getElementById('abstract-concept-search'), 
                    document.getElementById('abstract-concept'), 
                    abstractConceptsList
                );
                
                setupDropdownFiltering(
                    document.getElementById('ne-type-search'), 
                    document.getElementById('ne-type'), 
                    neTypesList
                );
                
                setupDropdownFiltering(
                    document.getElementById('non-event-roleset-search'), 
                    document.getElementById('non-event-roleset'), 
                    nonEventRolesetsList
                );
                
                // Setup token search
                const tokenSearchInput = document.getElementById('token-search');
                if (tokenSearchInput) {
                    tokenSearchInput.addEventListener('input', function() {
                        const searchTerm = this.value.toLowerCase();
                        const tokenItems = document.querySelectorAll('.token-item');
                        
                        tokenItems.forEach(item => {
                            const tokenText = item.getAttribute('data-token').toLowerCase();
                            if (tokenText.includes(searchTerm)) {
                                item.style.display = 'block';
                            } else {
                                item.style.display = 'none';
                            }
                        });
                    });
                }
                
                // Handle child node type selection change
                childNodeTypeSelect.addEventListener('change', () => {
                    const selectedType = childNodeTypeSelect.value;
                    
                    // Hide all containers first
                    tokenContainer.style.display = 'none';
                    discourseContainer.style.display = 'none';
                    abstractContainer.style.display = 'none';
                    neContainer.style.display = 'none';
                    nonEventContainer.style.display = 'none';
                    stringContainer.style.display = 'none';
                    numberContainer.style.display = 'none';
                    nameTokensContainer.style.display = 'none';
                    
                    // Show the appropriate container based on selection
                    if (selectedType === 'token') {
                        tokenContainer.style.display = 'block';
                    } else if (selectedType === 'discourse') {
                        discourseContainer.style.display = 'block';
                    } else if (selectedType === 'abstract') {
                        abstractContainer.style.display = 'block';
                    } else if (selectedType === 'ne') {
                        neContainer.style.display = 'block';
                        // For NE types, also show the name tokens container
                        nameTokensContainer.style.display = 'block';
                        populateNameTokensSelection();
                    } else if (selectedType === 'non-event') {
                        nonEventContainer.style.display = 'block';
                    } else if (selectedType === 'string') {
                        stringContainer.style.display = 'block';
                    } else if (selectedType === 'number') {
                        numberContainer.style.display = 'block';
                    }
                });
                
                // Handle token selection - simplified without lemmatization
                const tokenItems = document.querySelectorAll('.token-item');
                
                tokenItems.forEach(item => {
                    item.addEventListener('click', () => {
                        // Reset active state for all items
                        tokenItems.forEach(el => el.style.backgroundColor = '#f0f8ff');
                        
                        // Highlight the selected item
                        item.style.backgroundColor = '#d1e7ff';
                    });
                });
                
                // Set up named entity selection to show name tokens
                const neTypeSelect = document.getElementById('ne-type');
                neTypeSelect.addEventListener('change', () => {
                    if (neTypeSelect.value) {
                        // Show the name tokens selection when an NE type is selected
                        nameTokensContainer.style.display = 'block';
                        populateNameTokensSelection();
                    } else {
                        nameTokensContainer.style.display = 'none';
                    }
                });
            }
        }
        
        // Function to populate name tokens selection for named entities
        function populateNameTokensSelection() {
            const nameTokensSelection = document.getElementById('name-tokens-selection');
            const selectedTokensText = document.getElementById('selected-tokens-text');
            
            // Clear any existing content
            nameTokensSelection.innerHTML = '';
            selectedTokensText.textContent = '';
            
            // Add tokens from the sentence
            sentenceTokens.forEach(token => {
                const tokenChip = document.createElement('div');
                tokenChip.className = 'name-token-chip';
                tokenChip.setAttribute('data-token', token);
                tokenChip.textContent = token;
                tokenChip.style.padding = '6px 12px';
                tokenChip.style.backgroundColor = '#edf2fa';
                tokenChip.style.borderRadius = '16px';
                tokenChip.style.cursor = 'pointer';
                tokenChip.style.userSelect = 'none';
                tokenChip.style.display = 'inline-block';
                
                // Add click handler to toggle selection
                tokenChip.addEventListener('click', () => {
                    tokenChip.classList.toggle('selected');
                    if (tokenChip.classList.contains('selected')) {
                        tokenChip.style.backgroundColor = '#c2d8f9';
                    } else {
                        tokenChip.style.backgroundColor = '#edf2fa';
                    }
                    
                    // Update the selected tokens text
                    updateSelectedNameTokens();
                });
                
                nameTokensSelection.appendChild(tokenChip);
            });
        }
        
        // Function to update selected name tokens display
        function updateSelectedNameTokens() {
            const selectedChips = document.querySelectorAll('.name-token-chip.selected');
            const selectedTokensText = document.getElementById('selected-tokens-text');
            
            const selectedTokens = Array.from(selectedChips).map(chip => chip.getAttribute('data-token'));
            selectedTokensText.textContent = selectedTokens.join(' ');
        }
        
        // Set up relation change handler
        relationSelect.addEventListener('change', updateChildNodeContainer);
        
        // Handle form submission
        const form = document.getElementById('add-branch-form');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Get the selected relation
            const selectedRelation = relationSelect.value;
            if (!selectedRelation) {
                showNotification('Please select a relation', 'error');
                return;
            }
            
            // Initialize variables for the branch
            let childNode = '';
            let subBranches = '';
            
            // Handle different types of relations and child nodes
            const predefinedValues = relationsWithValues[selectedRelation];
            
            if (predefinedValues && predefinedValues.length > 0) {
                // For relations with predefined values
                const predefinedValue = document.getElementById('predefined-value').value;
                if (!predefinedValue) {
                    showNotification('Please select a value', 'error');
                    return;
                }
                
                childNode = predefinedValue;
            } else {
                // For relations without predefined values
                const childNodeType = document.getElementById('child-node-type')?.value;
                if (!childNodeType) {
                    showNotification('Please select a child node type', 'error');
                    return;
                }
                
                if (childNodeType === 'token') {
                    // For token selection
                    const selectedTokenItem = document.querySelector('.token-item[style*="background-color: rgb(209, 231, 255)"]');
                    if (!selectedTokenItem) {
                        showNotification('Please select a token', 'error');
                        return;
                    }
                    
                    const selectedToken = selectedTokenItem.getAttribute('data-token');
                    
                    // Check if it's a number
                    if (!isNaN(selectedToken)) {
                        // Numbers are used directly
                        childNode = selectedToken;
                    } else {
                        // For other tokens, generate a variable
                        const variable = generateUniqueVariable(selectedToken, annotationText);
                        childNode = `(${variable} / ${selectedToken})`;
                    }
                } else if (childNodeType === 'discourse') {
                    // For discourse concepts
                    const selectedConcept = document.getElementById('discourse-concept').value;
                    if (!selectedConcept) {
                        showNotification('Please select a discourse concept', 'error');
                        return;
                    }
                    
                    // Generate variable for the concept
                    const variable = generateUniqueVariable(selectedConcept, annotationText);
                    childNode = `(${variable} / ${selectedConcept})`;
                } else if (childNodeType === 'abstract') {
                    // For abstract concepts
                    const selectedConcept = document.getElementById('abstract-concept').value;
                    if (!selectedConcept) {
                        showNotification('Please select an abstract concept', 'error');
                        return;
                    }
                    
                    // Generate variable for the concept
                    const variable = generateUniqueVariable(selectedConcept, annotationText);
                    childNode = `(${variable} / ${selectedConcept})`;
                } else if (childNodeType === 'ne') {
                    // For named entities
                    const selectedNeType = document.getElementById('ne-type').value;
                    if (!selectedNeType) {
                        showNotification('Please select a named entity type', 'error');
                        return;
                    }
                    
                    // Generate variable for the NE
                    const variable = generateUniqueVariable(selectedNeType, annotationText);
                    
                    // Check if name tokens are selected
                    const selectedNameTokens = Array.from(document.querySelectorAll('.name-token-chip.selected'))
                        .map(chip => chip.getAttribute('data-token'));
                    
                    if (selectedNameTokens.length > 0) {
                        // Generate name variable
                        const nameVariable = generateUniqueVariable('name', annotationText);
                        
                        // Create op relations for each token
                        const opRelations = selectedNameTokens.map((token, index) => 
                            `:op${index + 1} "${token}"`).join(' ');
                        
                        // Create the sub-branch for name
                        subBranches = `:name (${nameVariable} / name ${opRelations})`;
                    }
                    
                    // Create the main node with optional sub-branches
                    childNode = `(${variable} / ${selectedNeType}${subBranches ? ' ' + subBranches : ''})`;
                } else if (childNodeType === 'non-event') {
                    // For non-event rolesets
                    const selectedRoleset = document.getElementById('non-event-roleset').value;
                    if (!selectedRoleset) {
                        showNotification('Please select a non-event roleset', 'error');
                        return;
                    }
                    
                    // Generate variable for the roleset
                    const variable = generateUniqueVariable(selectedRoleset, annotationText);
                    childNode = `(${variable} / ${selectedRoleset})`;
                } else if (childNodeType === 'string') {
                    // For string values
                    const stringValue = document.getElementById('string-value').value;
                    if (!stringValue) {
                        showNotification('Please enter a string value', 'error');
                        return;
                    }
                    
                    childNode = `"${stringValue}"`;
                } else if (childNodeType === 'number') {
                    // For number values
                    const numberValue = document.getElementById('number-value').value;
                    if (!numberValue) {
                        showNotification('Please enter a number value', 'error');
                        return;
                    }
                    
                    childNode = numberValue;
                }
            }
            
            // Construct the full branch
            const newBranch = `${selectedRelation} ${childNode}`;
            
            // Add the new branch to the annotation with proper positioning
            // We need to find the full node pattern and insert the branch after it
            const lines = annotationText.split('\n');
            let updatedLines = [...lines];
            let nodeFound = false;
            
            // Pattern to find the full node including the parenthesis
            // This pattern matches: (variable / concept, where variable is the exact variable
            const nodePattern = new RegExp(`\\(\\s*${parentVariable}\\s*/\\s*[^\\s\\(\\):]+`);
            
            for (let i = 0; i < lines.length; i++) {
                if (nodePattern.test(lines[i])) {
                    // Found the line containing our node
                    let currentLine = lines[i];
                    
                    // Find the indentation of the current line
                    const indentMatch = currentLine.match(/^(\s*)/);
                    const currentIndent = indentMatch ? indentMatch[1] : '';
                    const nextIndent = currentIndent + '    '; // Add one level of indentation (4 spaces)
                    
                    // Check if the line already has other relations
                    if (currentLine.includes(')')) {
                        // This line has a closing parenthesis, we need to insert before it
                        const closingParenIndex = currentLine.lastIndexOf(')');
                        if (closingParenIndex !== -1) {
                            // Insert the branch before the closing parenthesis
                            const beforeParen = currentLine.substring(0, closingParenIndex).trimRight();
                            const afterParen = currentLine.substring(closingParenIndex);
                            
                            // Update the current line and add a new line for our branch
                            updatedLines[i] = beforeParen;
                            updatedLines.splice(i+1, 0, `${nextIndent}${newBranch}`);
                            updatedLines.splice(i+2, 0, afterParen);
                            
                            nodeFound = true;
                            break;
                        }
                    } else {
                        // This line doesn't have a closing parenthesis, simpler case
                        // Add our branch on the next line with proper indentation
                        updatedLines.splice(i+1, 0, `${nextIndent}${newBranch}`);
                        nodeFound = true;
                        break;
                    }
                }
            }
            
            if (!nodeFound) {
                // Fallback: if we can't find the full node pattern, use the simple approach
                const variableIndices = [];
                let searchIndex = 0;
                while (true) {
                    const index = annotationText.indexOf(parentVariable, searchIndex);
                    if (index === -1) break;
                    variableIndices.push(index);
                    searchIndex = index + parentVariable.length;
                }
                
                let updatedAnnotation = annotationText;
                
                // Make sure we have the right index
                const spanIndex = Array.from(annotationElement.querySelectorAll('.variable-span'))
                    .filter(span => span.textContent === parentVariable)
                    .indexOf(parentVariableSpan);
                    
                if (spanIndex >= 0 && spanIndex < variableIndices.length) {
                    const targetIndex = variableIndices[spanIndex] + parentVariable.length;
                    // Simple insertion after the variable - this is the fallback approach
                    updatedAnnotation = annotationText.substring(0, targetIndex) + 
                                       ` ${newBranch}` + 
                                       annotationText.substring(targetIndex);
                } else {
                    // Fallback - add to the first occurrence
                    const targetIndex = variableIndices[0] + parentVariable.length;
                    updatedAnnotation = annotationText.substring(0, targetIndex) + 
                                       ` ${newBranch}` + 
                                       annotationText.substring(targetIndex);
                }
                
                // Update the annotation element with the fallback method
                annotationElement.textContent = updatedAnnotation;
            } else {
                // Update the annotation element with our properly formatted insertion
                annotationElement.textContent = updatedLines.join('\n');
            }
            
            // Reinitialize the relation editor
            makeRelationsClickable(annotationElement);
            makeValuesClickable(annotationElement);
            makeVariablesClickable(annotationElement);
            addBranchOperations(annotationElement);
            
            // Save the updated annotation
            saveBranchInsertion(annotationElement.textContent, newBranch);
            
            // Remove the dialog
            dialogContainer.remove();
            
            showNotification('Branch added successfully', 'success');
        });
        
        // Handle cancel button
        const cancelButton = document.getElementById('cancel-add-branch');
        cancelButton.addEventListener('click', () => {
            dialogContainer.remove();
        });
        
    } catch (error) {
        console.error('Error setting up dialog:', error);
        showNotification('Error setting up dialog: ' + error.message, 'error');
    }
}

// Function to save the branch insertion
function saveBranchInsertion(updatedAnnotation, newBranch) {
    // Get sentence ID and document ID from the hidden fields
    const sent_id = document.getElementById('snt_id').value;
    const doc_version_id = document.getElementById('doc_version_id').value;
    
    console.log(`Adding branch: ${newBranch}`);
    
    // Use fetch API to send the update to the server
    fetch(`/update_annotation/${doc_version_id}/${sent_id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
            annotation: updatedAnnotation,
            operation: 'add_branch',
            relation: newBranch
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

// Function to finalize and get the current UMR string
function finalizeUmrString() {
    console.log('Finalizing UMR string before saving to database...');
    
    // Get the annotation element
    const annotationElement = document.querySelector('#amr pre');
    if (!annotationElement) {
        console.error('Annotation element not found when finalizing UMR string');
        return null;
    }
    
    // Get the current UMR text including any in-progress edits
    const currentUmrString = annotationElement.textContent.trim();
    
    // Close any open edit dropdowns
    const dropdowns = document.querySelectorAll('.relation-dropdown, .value-dropdown');
    dropdowns.forEach(dropdown => dropdown.remove());
    
    // Remove any temporary UI elements
    const tempElements = document.querySelectorAll('.temp-edit-element, .edit-overlay');
    tempElements.forEach(element => element.remove());
    
    // If in edit mode, flush any pending edits
    if (inPlaceEditMode) {
        // This will depend on your edit mode implementation
        // For now, we'll just ensure the UMR text is correct
        console.log('In-place edit mode active, ensuring all edits are applied');
    }
    
    return currentUmrString;
}

// Hook into the UMR2db function to ensure relation edits are saved
const originalUmr2db = window.UMR2db;
window.UMR2db = function() {
    try {
        // Finalize the UMR string
        const finalUmrString = finalizeUmrString();
        if (!finalUmrString) {
            console.error('Failed to finalize UMR string');
            return originalUmr2db();
        }
        
        // Get document and sentence IDs
        const docVersionId = document.getElementById('doc_version_id').value;
        const sentId = document.getElementById('snt_id').value;
        
        // Get CSRF token if available
        const csrfToken = getCsrfToken();
        
        // Call the save API directly to ensure fresh content is saved
        fetch('/save_umr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify({
                doc_version_id: docVersionId,
                sent_id: sentId,
                umr_string: finalUmrString
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('UMR saved successfully');
                showNotification('UMR saved successfully', 'success');
            } else {
                console.error('Error saving UMR:', data.error);
                showNotification(`Error: ${data.error}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving UMR:', error);
            showNotification(`Error saving UMR: ${error.message}`, 'error');
        });
    } catch (error) {
        console.error('Exception in overridden UMR2db:', error);
        // Fall back to original implementation
        return originalUmr2db();
    }
};

// Let's add a unit test function to verify our extraction works as expected
function testUnmatchedParenthesesExtraction() {
    // Test cases
    const testCases = [
        { input: ':aspect state))', expected: '))', description: 'Multiple closing parentheses' },
        { input: ':aspect (state', expected: '(', description: 'Single opening parenthesis' },
        { input: ':aspect (state))', expected: ')', description: 'One extra closing parenthesis' },
        { input: ':aspect ((state)', expected: '(', description: 'One extra opening parenthesis' },
        { input: ':aspect (state', expected: '(', description: 'Unclosed parenthesis' },
        { input: ':aspect state)', expected: ')', description: 'Unopened parenthesis' },
        { input: ':aspect (state)', expected: '', description: 'Balanced parentheses' }
    ];
    
    console.log('Running unmatched parentheses extraction tests...');
    
    testCases.forEach(testCase => {
        const result = extractUnmatchedParentheses(testCase.input);
        const passed = result === testCase.expected;
        
        console.log(`Test case: ${testCase.description}`);
        console.log(`Input: "${testCase.input}"`);
        console.log(`Expected: "${testCase.expected}"`);
        console.log(`Result: "${result}"`);
        console.log(`Test ${passed ? 'PASSED' : 'FAILED'}`);
        console.log('---');
    });
}

// Automatically run tests when in development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Development environment detected, running tests...');
    setTimeout(testUnmatchedParenthesesExtraction, 2000);
}

// Helper function to set up filtering for dropdown menus
function setupDropdownFiltering(searchInput, selectElement, optionsList) {
    if (!searchInput || !selectElement) return;
    
    // Store original options (excluding the first "Select..." option)
    const originalOptions = Array.from(selectElement.options)
        .slice(1)
        .map(option => ({ value: option.value, text: option.text }));
    
    // Add search functionality
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        // Clear existing options (except first placeholder option)
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        // Get filtered options
        const filteredOptions = searchTerm.length > 0 
            ? originalOptions.filter(opt => opt.text.toLowerCase().includes(searchTerm))
            : originalOptions;
        
        // Add filtered options
        filteredOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.text = opt.text;
            selectElement.add(option);
        });
        
        // If there's a perfect match or only one option, select it
        if (filteredOptions.length === 1) {
            selectElement.selectedIndex = 1; // First option is the placeholder
        } else if (searchTerm.length > 0) {
            // Try to find an exact match
            const exactMatch = filteredOptions.findIndex(opt => 
                opt.text.toLowerCase() === searchTerm.toLowerCase());
            if (exactMatch !== -1) {
                selectElement.selectedIndex = exactMatch + 1; // +1 for placeholder
            }
        }
    });
    
    // Handle Enter key to select the first option
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && selectElement.options.length > 1) {
            e.preventDefault();
            selectElement.selectedIndex = 1; // Select first option after placeholder
            selectElement.focus();
        }
    });
}