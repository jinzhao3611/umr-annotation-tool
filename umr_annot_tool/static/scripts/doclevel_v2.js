// Global state for document level annotations
const docLevelState = {
    docVersionId: null,
    sentId: null,
    docAnnotation: "",
    triples: [],
    isDirty: false
};

// Log to confirm latest version
console.log("Document level script V2 loaded - with delete buttons");

console.log("==========================================");
console.log("DOCUMENT LEVEL SCRIPT V2.1 LOADING");
console.log("Last updated: " + new Date().toLocaleString());
console.log("Features: Structured annotation display with delete buttons");
console.log("==========================================");

// Add document-level rolesets and relations as constants
const DOC_LEVEL_ROLESETS = {
    "temporal": ['document-creation-time', 'past-reference', 'present-reference', 'future-reference'],
    "modal": ['root', 'author', 'null-conceiver'],
    "coref": []
};

const DOC_LEVEL_RELATIONS = {
    "temporal": [':contained', ':before', ':after', ':overlap', ':depends-on'],
    "modal": [':modal', ':full-affirmative', ':partial-affirmative', ':strong-partial-affirmative', ':weak-partial-affirmative', ':neutral-affirmative', ':strong-neutral-affirmative', ':weak-neutral-affirmative', ':full-negative', ':partial-negative', ':strong-partial-negative', ':weak-partial-negative', ':neutral-negative', ':strong-neutral-negative', ':weak-neutral-negative', ':unspecified'],
    "coref": [':same-entity', ':same-event', ':subset-of']
};

// Variable format regex
const VARIABLE_REGEX = /^s[0-9]+[a-z]+[0-9]*$/;

// Initialize document level functionality
function initializeDocLevel() {
    console.log("Initializing document level functionality");
    
    // Add event listeners to tab buttons
    setupFormEventListeners();
    
    // Check if we have an existing annotation to display
    const annotationContent = document.getElementById('doc-annotation-content');
    if (annotationContent) {
        console.log("Found existing annotation content:", annotationContent.textContent);
        // Format it with proper syntax highlighting
        setTimeout(() => {
            formatDocLevelAnnotation();
        }, 100);
    } else {
        console.log("No existing annotation content found");
    }
    
    // Set up delete button functionality for existing triples
    setupDeleteButtons();
}

// Set up event listeners for the triple input forms
function setupFormEventListeners() {
    // Add keypress event listeners to all input fields to enable Enter key
    const inputFields = document.querySelectorAll('.triple-form input');
    inputFields.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                // Find the parent tab and trigger the correct add triple button
                const tabPane = this.closest('.tab-pane');
                if (tabPane) {
                    const tripleType = tabPane.id;
                    addTriple(tripleType);
                }
            }
        });
    });
}

// Add a new triple to the document annotation
function addTriple(tripleType) {
    console.log(`Adding new ${tripleType} triple`);
    // Get input values based on the triple type
    let source, relation, target;
    
    if (tripleType === 'temporal') {
        source = document.getElementById('temporal-source').value.trim();
        relation = document.getElementById('temporal-relation').value.trim();
        target = document.getElementById('temporal-target').value.trim();
    } else if (tripleType === 'modal') {
        source = document.getElementById('modal-source').value.trim();
        relation = document.getElementById('modal-relation').value.trim();
        target = document.getElementById('modal-target').value.trim();
    } else if (tripleType === 'coreference') {
        source = document.getElementById('coref-source').value.trim();
        relation = document.getElementById('coref-relation').value.trim();
        target = document.getElementById('coref-target').value.trim();
    } else {
        console.error("Invalid triple type:", tripleType);
        showNotification("Invalid triple type", "error");
        return;
    }
    
    // Validate inputs
    if (!source || !relation || !target) {
        showNotification("Please fill in all fields for the triple", "error");
        return;
    }
    
    // Create a new triple object
    const newTriple = {
        id: generateUniqueId(),
        type: tripleType,
        source: source,
        relation: relation,
        target: target,
        sentId: docLevelState.sentId
    };
    
    console.log("Adding new triple:", newTriple);
    
    // Add to the triples array
    docLevelState.triples.push(newTriple);
    
    // Mark the state as dirty (unsaved changes)
    docLevelState.isDirty = true;
    
    // Update the UI directly using renderTriples which will handle the structured display
    renderTriples();
    
    // Show notification
    showNotification(`Added ${tripleType} triple: ${source} ${relation} ${target}`, "success");
    
    // Clear the form
    clearTripleForm(tripleType);
    
    console.log("Triple added successfully");
}

// Remove a triple from the document annotation
function removeTriple(tripleId) {
    console.log(`Removing triple with ID: ${tripleId}`);
    
    // Find the index of the triple to remove
    const index = docLevelState.triples.findIndex(triple => triple.id === tripleId);
    
    // If not found, return
    if (index === -1) {
        console.error(`Triple with ID ${tripleId} not found`);
        showNotification("Triple not found", "error");
        return;
    }
    
    // Get the triple to remove (for notification message)
    const triple = docLevelState.triples[index];
    console.log("Removing triple:", triple);
    
    // Remove the triple
    docLevelState.triples.splice(index, 1);
    
    // Check if this was the last triple of its type
    const remainingOfType = docLevelState.triples.filter(t => t.type === triple.type).length;
    
    // Mark as dirty
    docLevelState.isDirty = true;
    
    // Update the UI directly using renderTriples
    renderTriples();
    
    // Show confirmation
    if (remainingOfType === 0) {
        showNotification(`Removed the last ${triple.type} triple from this document annotation`, "info");
    } else {
        showNotification(`Removed ${triple.type} triple: ${triple.source} ${triple.relation} ${triple.target}`, "success");
    }
    
    console.log("Triple removed successfully, remaining triples:", docLevelState.triples.length);
}

// Parse triples from the document annotation text
function parseTriples(annotationText) {
    console.log("Parsing annotation text:", annotationText);
    
    // Clear existing triples
    docLevelState.triples = [];
    
    if (!annotationText || annotationText.trim() === "") {
        console.log("No annotation text to parse");
        return;
    }
    
    try {
        // Extract each section based on keywords
        const temporalMatch = annotationText.match(/:temporal\s+\(\((.*?)\)\)/s);
        const modalMatch = annotationText.match(/:modal\s+\(\((.*?)\)\)/s);
        const corefMatch = annotationText.match(/:coref\s+\(\((.*?)\)\)/s);
        
        console.log("Extracted sections:", {
            temporal: temporalMatch ? "found" : "not found",
            modal: modalMatch ? "found" : "not found",
            coref: corefMatch ? "found" : "not found"
        });
        
        // Process temporal triples
        if (temporalMatch && temporalMatch[1]) {
            const temporalContent = temporalMatch[1];
            // Find individual triple patterns: (source :relation target)
            const triples = temporalContent.match(/\([^()]+?\s+:[^()]+?\s+[^()]+?\)/g);
            
            if (triples) {
                triples.forEach(tripleText => {
                    // Parse (source :relation target)
                    const parts = tripleText.match(/\(([^:]+?)\s+:([^\s]+)\s+([^)]+)\)/);
                    if (parts) {
                        const [_, source, relation, target] = parts;
                        docLevelState.triples.push({
                            id: generateUniqueId(),
                            type: 'temporal',
                            source: source.trim(),
                            relation: relation.trim(),
                            target: target.trim(),
                            sentId: docLevelState.sentId
                        });
                    }
                });
            }
        }
        
        // Process modal triples
        if (modalMatch && modalMatch[1]) {
            const modalContent = modalMatch[1];
            // Find individual triple patterns: (source :relation target)
            const triples = modalContent.match(/\([^()]+?\s+:[^()]+?\s+[^()]+?\)/g);
            
            if (triples) {
                triples.forEach(tripleText => {
                    // Parse (source :relation target)
                    const parts = tripleText.match(/\(([^:]+?)\s+:([^\s]+)\s+([^)]+)\)/);
                    if (parts) {
                        const [_, source, relation, target] = parts;
                        docLevelState.triples.push({
                            id: generateUniqueId(),
                            type: 'modal',
                            source: source.trim(),
                            relation: relation.trim(),
                            target: target.trim(),
                            sentId: docLevelState.sentId
                        });
                    }
                });
            }
        }
        
        // Process coreference triples
        if (corefMatch && corefMatch[1]) {
            const corefContent = corefMatch[1];
            // Find individual triple patterns: (source :relation target)
            const triples = corefContent.match(/\([^()]+?\s+:[^()]+?\s+[^()]+?\)/g);
            
            if (triples) {
                triples.forEach(tripleText => {
                    // Parse (source :relation target)
                    const parts = tripleText.match(/\(([^:]+?)\s+:([^\s]+)\s+([^)]+)\)/);
                    if (parts) {
                        const [_, source, relation, target] = parts;
                        docLevelState.triples.push({
                            id: generateUniqueId(),
                            type: 'coreference',
                            source: source.trim(),
                            relation: relation.trim(),
                            target: target.trim(),
                            sentId: docLevelState.sentId
                        });
                    }
                });
            }
        }
        
        console.log("Parsed triples:", docLevelState.triples);
    } catch (error) {
        console.error("Error parsing annotation text:", error);
    }
}

// Update the document annotation text based on the current triples
function updateDocAnnotation() {
    // Get the current annotation content element
    const docAnnotationContentElement = document.getElementById("doc-annotation-content");
    const docAnnotationDiv = document.getElementById("doc-annotation");
    
    // If we don't have the container, nothing to do
    if (!docAnnotationDiv) return;
    
    // If we already have triples parsed
    if (docLevelState.triples.length > 0) {
        // Group triples by type for better organization
        const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
        const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
        const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
        
        // Build HTML for the structured display
        let displayHtml = `<div class="structured-annotation" id="doc-annotation-content">`;
        
        // Format triples into a string for the underlying data model
        let annotationText = "";
        
        // Add temporal branch
        if (temporalTriples.length > 0) {
            displayHtml += `<div class="annotation-branch temporal-branch">
                <div class="branch-header">Temporal Relations:</div>
                <div class="branch-content">`;
            
            temporalTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
                displayHtml += `
                    <div class="triple-item" data-id="${triple.id}">
                        <div class="triple-content">
                            <span class="node source-node">${triple.source}</span>
                            <span class="relation">${triple.relation}</span>
                            <span class="node target-node">${triple.target}</span>
                            <button class="btn btn-sm btn-danger delete-triple" data-id="${triple.id}">×</button>
                        </div>
                    </div>`;
            });
            
            displayHtml += `</div></div>`;
        }
        
        // Add modal branch
        if (modalTriples.length > 0) {
            displayHtml += `<div class="annotation-branch modal-branch">
                <div class="branch-header">Modal Relations:</div>
                <div class="branch-content">`;
            
            modalTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
                displayHtml += `
                    <div class="triple-item" data-id="${triple.id}">
                        <div class="triple-content">
                            <span class="node source-node">${triple.source}</span>
                            <span class="relation">${triple.relation}</span>
                            <span class="node target-node">${triple.target}</span>
                            <button class="btn btn-sm btn-danger delete-triple" data-id="${triple.id}">×</button>
                        </div>
                    </div>`;
            });
            
            displayHtml += `</div></div>`;
        }
        
        // Add coreference branch
        if (corefTriples.length > 0) {
            displayHtml += `<div class="annotation-branch coreference-branch">
                <div class="branch-header">Coreference Relations:</div>
                <div class="branch-content">`;
            
            corefTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
                displayHtml += `
                    <div class="triple-item" data-id="${triple.id}">
                        <div class="triple-content">
                            <span class="node source-node">${triple.source}</span>
                            <span class="relation">${triple.relation}</span>
                            <span class="node target-node">${triple.target}</span>
                            <button class="btn btn-sm btn-danger delete-triple" data-id="${triple.id}">×</button>
                        </div>
                    </div>`;
            });
            
            displayHtml += `</div></div>`;
        }
        
        // Close the overall container
        displayHtml += `</div>`;
        
        // Update the underlying data model
        docLevelState.docAnnotation = annotationText.trim();
        
        // Update the UI
        docAnnotationDiv.innerHTML = displayHtml;
        
        // Also add a hidden div with the raw format for compatibility
        const rawAnnotation = document.createElement('div');
        rawAnnotation.style.display = 'none';
        rawAnnotation.id = 'raw-doc-annotation';
        rawAnnotation.textContent = docLevelState.docAnnotation;
        docAnnotationDiv.appendChild(rawAnnotation);
    } 
    // If we have no triples but there's already content, preserve it
    else if (docAnnotationContentElement) {
        // Keep the existing content
        docLevelState.docAnnotation = docAnnotationContentElement.textContent.trim();
    }
    // Only show empty state if there are no triples and no existing content
    else if (!docAnnotationContentElement && docLevelState.docAnnotation === "") {
        // Show empty state
        docAnnotationDiv.innerHTML = `
            <div class="alert alert-info mb-0" id="doc-annotation-placeholder">
                No document-level annotation available for this sentence. Use the tools on the right to create one.
            </div>
        `;
    }
}

// Render the triples list in the UI
function renderTriples() {
    console.log("Rendering triples:", docLevelState.triples);
    
    // Get the document annotation container
    const docAnnotationDiv = document.getElementById("doc-annotation");
    if (!docAnnotationDiv) {
        console.error("Document annotation container not found");
        return;
    }
    
    // If the original annotation exists and has content
    if (docLevelState.docAnnotation && docLevelState.docAnnotation.trim() !== "") {
        // Create enhanced HTML for full annotation with interactive elements
        let displayHtml = `
        <div class="doc-annotation-container">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Document-Level Annotation</h6>
                    <small class="text-muted">Hover and right-click to delete triples</small>
                </div>
                <div class="card-body p-2">
                    <div class="interactive-annotation" id="doc-annotation-content">`;
        
        // Group triples by type
        const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
        const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
        const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
        
        // Start with the root identifier if it exists
        const rootMatch = docLevelState.docAnnotation.match(/\(([^\/]+)\s*\/\s*([^)]+)\)/);
        if (rootMatch) {
            displayHtml += `<div class="annotation-root">(<span class="variable">${rootMatch[1]}</span> / <span class="semantic-type">${rootMatch[2]}</span></div>`;
        }
        
        // Add temporal section with improved structure
        if (temporalTriples.length > 0) {
            displayHtml += `<div class="annotation-section temporal-section">
                <div class="section-header"><span class="relation">:temporal</span> (</div>
                <div class="section-content">`;
            
            temporalTriples.forEach(triple => {
                displayHtml += `
                <div class="triple-item interactive" data-id="${triple.id}">
                    <span class="triple-content">(
                        <span class="variable">${triple.source}</span> 
                        <span class="relation">:${triple.relation}</span> 
                        <span class="variable">${triple.target}</span>
                    )</span>
                    <span class="delete-icon" data-id="${triple.id}" title="Delete this triple">
                        <i class="fas fa-trash-alt"></i>
                    </span>
                </div>`;
            });
            
            displayHtml += `</div>
                <div class="section-close">)</div>
            </div>`;
        }
        
        // Add modal section with improved structure
        if (modalTriples.length > 0) {
            displayHtml += `<div class="annotation-section modal-section">
                <div class="section-header"><span class="relation">:modal</span> (</div>
                <div class="section-content">`;
            
            modalTriples.forEach(triple => {
                displayHtml += `
                <div class="triple-item interactive" data-id="${triple.id}">
                    <span class="triple-content">(
                        <span class="variable">${triple.source}</span> 
                        <span class="relation">:${triple.relation}</span> 
                        <span class="variable">${triple.target}</span>
                    )</span>
                    <span class="delete-icon" data-id="${triple.id}" title="Delete this triple">
                        <i class="fas fa-trash-alt"></i>
                    </span>
                </div>`;
            });
            
            displayHtml += `</div>
                <div class="section-close">)</div>
            </div>`;
        }
        
        // Add coreference section with improved structure
        if (corefTriples.length > 0) {
            displayHtml += `<div class="annotation-section coreference-section">
                <div class="section-header"><span class="relation">:coref</span> (</div>
                <div class="section-content">`;
            
            corefTriples.forEach(triple => {
                displayHtml += `
                <div class="triple-item interactive" data-id="${triple.id}">
                    <span class="triple-content">(
                        <span class="variable">${triple.source}</span> 
                        <span class="relation">:${triple.relation}</span> 
                        <span class="variable">${triple.target}</span>
                    )</span>
                    <span class="delete-icon" data-id="${triple.id}" title="Delete this triple">
                        <i class="fas fa-trash-alt"></i>
                    </span>
                </div>`;
            });
            
            displayHtml += `</div>
                <div class="section-close">)</div>
            </div>`;
        }
        
        // If we have the root node, close the whole annotation
        if (rootMatch) {
            displayHtml += `<div class="annotation-root-close">)</div>`;
        }
        
        // Close containers
        displayHtml += `
                    </div>
                </div>
            </div>
            
            <!-- Hidden original annotation for reference -->
            <div id="raw-doc-annotation" style="display: none;">${docLevelState.docAnnotation}</div>
        </div>`;
        
        // Update the UI
        docAnnotationDiv.innerHTML = displayHtml;
    }
    // If we have triples but no original annotation
    else if (docLevelState.triples.length > 0) {
        // Create a structured display with the triples we have
        let displayHtml = `
        <div class="doc-annotation-container">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Document-Level Annotation</h6>
                    <small class="text-muted">Hover and right-click to delete triples</small>
                </div>
                <div class="card-body p-2">
                    <div class="interactive-annotation" id="doc-annotation-content">`;
        
        // Group triples by type
        const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
        const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
        const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
        
        // Add temporal section with improved structure
        if (temporalTriples.length > 0) {
            displayHtml += `<div class="annotation-section temporal-section">
                <div class="section-header"><span class="relation">:temporal</span> (</div>
                <div class="section-content">`;
            
            temporalTriples.forEach(triple => {
                displayHtml += `
                <div class="triple-item interactive" data-id="${triple.id}">
                    <span class="triple-content">(
                        <span class="variable">${triple.source}</span> 
                        <span class="relation">:${triple.relation}</span> 
                        <span class="variable">${triple.target}</span>
                    )</span>
                    <span class="delete-icon" data-id="${triple.id}" title="Delete this triple">
                        <i class="fas fa-trash-alt"></i>
                    </span>
                </div>`;
            });
            
            displayHtml += `</div>
                <div class="section-close">)</div>
            </div>`;
        }
        
        // Add modal section with improved structure
        if (modalTriples.length > 0) {
            displayHtml += `<div class="annotation-section modal-section">
                <div class="section-header"><span class="relation">:modal</span> (</div>
                <div class="section-content">`;
            
            modalTriples.forEach(triple => {
                displayHtml += `
                <div class="triple-item interactive" data-id="${triple.id}">
                    <span class="triple-content">(
                        <span class="variable">${triple.source}</span> 
                        <span class="relation">:${triple.relation}</span> 
                        <span class="variable">${triple.target}</span>
                    )</span>
                    <span class="delete-icon" data-id="${triple.id}" title="Delete this triple">
                        <i class="fas fa-trash-alt"></i>
                    </span>
                </div>`;
            });
            
            displayHtml += `</div>
                <div class="section-close">)</div>
            </div>`;
        }
        
        // Add coreference section with improved structure
        if (corefTriples.length > 0) {
            displayHtml += `<div class="annotation-section coreference-section">
                <div class="section-header"><span class="relation">:coref</span> (</div>
                <div class="section-content">`;
            
            corefTriples.forEach(triple => {
                displayHtml += `
                <div class="triple-item interactive" data-id="${triple.id}">
                    <span class="triple-content">(
                        <span class="variable">${triple.source}</span> 
                        <span class="relation">:${triple.relation}</span> 
                        <span class="variable">${triple.target}</span>
                    )</span>
                    <span class="delete-icon" data-id="${triple.id}" title="Delete this triple">
                        <i class="fas fa-trash-alt"></i>
                    </span>
                </div>`;
            });
            
            displayHtml += `</div>
                <div class="section-close">)</div>
            </div>`;
        }
        
        // Close containers
        displayHtml += `
                    </div>
                </div>
            </div>
        </div>`;
        
        // Update the UI
        docAnnotationDiv.innerHTML = displayHtml;
    }
    // If no content at all
    else {
        docAnnotationDiv.innerHTML = `
            <div class="alert alert-info mb-0" id="doc-annotation-placeholder">
                No document-level annotation available for this sentence. Use the tools on the right to create one.
            </div>
        `;
    }
    
    // Ensure Font Awesome is loaded for the trash icons
    if (!document.getElementById('font-awesome-css')) {
        const link = document.createElement('link');
        link.id = 'font-awesome-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';
        document.head.appendChild(link);
    }
    
    // Add event listeners for the delete icons
    document.querySelectorAll('.delete-icon').forEach(icon => {
        // Add right-click event listener
        icon.addEventListener('contextmenu', function(e) {
            e.preventDefault(); // Prevent the browser context menu
            const tripleId = this.getAttribute('data-id');
            if (confirm("Are you sure you want to delete this triple?")) {
                removeTriple(tripleId);
            }
        });
        
        // Also add regular click option for convenience
        icon.addEventListener('click', function() {
            const tripleId = this.getAttribute('data-id');
            if (confirm("Are you sure you want to delete this triple?")) {
                removeTriple(tripleId);
            }
        });
    });
    
    console.log("Rendered triples UI updated with interactive full annotation");
}

// Create HTML for a single triple
function createTripleHtml(triple) {
    return `
        <div class="triple-item" data-id="${triple.id}">
            <div class="triple-content">
                <span class="node source-node">${triple.source}</span>
                <span class="relation">${triple.relation}</span>
                <span class="node target-node">${triple.target}</span>
                <span class="delete-icon" data-id="${triple.id}">
                    <i class="fas fa-trash-alt"></i>
                </span>
            </div>
            <div class="triple-source-indicator">
                <small>From sentence <span class="sent-id">#${triple.sentId}</span></small>
            </div>
        </div>
    `;
}

// Clear a triple form after submission
function clearTripleForm(tripleType) {
    if (tripleType === 'temporal') {
        document.getElementById('temporal-source').value = '';
        document.getElementById('temporal-target').value = '';
    } else if (tripleType === 'modal') {
        document.getElementById('modal-source').value = '';
        document.getElementById('modal-target').value = '';
    } else if (tripleType === 'coreference') {
        document.getElementById('coref-source').value = '';
        document.getElementById('coref-target').value = '';
    }
}

// Generate a unique ID for triples
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Function to show notifications to the user
function showNotification(message, type = 'info') {
    console.log(`Notification (${type}): ${message}`);
    
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '1000';
    notification.style.backgroundColor = type === 'success' ? '#d4edda' : 
                                      type === 'error' ? '#f8d7da' : 
                                      type === 'warning' ? '#fff3cd' : '#d1ecf1';
    notification.style.color = type === 'success' ? '#155724' : 
                            type === 'error' ? '#721c24' : 
                            type === 'warning' ? '#856404' : '#0c5460';
    notification.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : 
                                           type === 'error' ? '#f5c6cb' : 
                                           type === 'warning' ? '#ffeeba' : '#bee5eb'}`;
    notification.style.borderRadius = '4px';
    notification.style.padding = '10px 15px';
    notification.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    notification.style.maxWidth = '300px';
    
    // Add the notification to the DOM
    document.body.appendChild(notification);
    
    // Add event listener to close button
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(notification);
    });
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

// Save document annotation to the database
function saveDocAnnotation() {
    return new Promise((resolve, reject) => {
        if (!docLevelState.isDirty) {
            showNotification("No changes to save", "info");
            resolve(); // Resolve immediately if no changes
            return;
        }
        
        // Ensure we have the latest annotation text
        let annotationText = "";
        if (docLevelState.triples.length > 0) {
            // Organize by type to maintain structure
            const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
            const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
            const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
            
            // Generate annotation text with proper formatting and organization by branch
            // Temporal branch
            temporalTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
            });
            
            // Modal branch
            modalTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
            });
            
            // Coreference branch
            corefTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
            });
            
            // Update the state
            docLevelState.docAnnotation = annotationText.trim();
        }
        
        // Send the annotation to the server
        fetch(`/update_doc_annotation/${docLevelState.docVersionId}/${docLevelState.sentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                doc_annot: docLevelState.docAnnotation
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                docLevelState.isDirty = false;
                showNotification("Document annotation saved successfully", "success");
                resolve(data); // Resolve the promise
            } else {
                showNotification("Error saving document annotation: " + data.message, "error");
                reject(new Error(data.message));
            }
        })
        .catch(error => {
            console.error('Error saving document annotation:', error);
            showNotification("Error saving document annotation: " + error.message, "error");
            reject(error);
        });
    });
}

// Get CSRF token from cookies
function getCsrfToken() {
    const name = 'csrf_token=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i].trim();
        if (cookie.indexOf(name) === 0) {
            return cookie.substring(name.length, cookie.length);
        }
    }
    return '';
}

// Expose functions to global scope
window.initializeDocLevel = initializeDocLevel;
window.addTriple = addTriple;
window.removeTriple = removeTriple;
window.saveDocAnnotation = saveDocAnnotation;
window.jumpToSentence = function(sentId) {
    const currentId = parseInt(window.state.currentId);
    if (currentId !== parseInt(sentId)) {
        const shouldSave = confirm("Do you want to save your current changes before jumping to another sentence?");
        if (shouldSave) {
            saveDocAnnotation().then(() => {
                window.location.href = `/doclevel/${window.state.docVersionId}/${sentId}`;
            });
        } else {
            window.location.href = `/doclevel/${window.state.docVersionId}/${sentId}`;
        }
    }
};

// Function to format document level annotation with proper spacing and syntax highlighting
function formatDocLevelAnnotation() {
    const annotationContent = document.getElementById('doc-annotation-content');
    if (!annotationContent) return;
    
    // Get the original content as plain text
    let plainContent = annotationContent.textContent;
    
    // If no content, return
    if (!plainContent || plainContent.trim() === '') return;
    
    // Log for debugging
    console.log("Parsing annotation text:", plainContent);
    
    try {
        // Normalize whitespace but preserve structure
        plainContent = plainContent.replace(/[\t ]+/g, ' ').trim();
        
        // Extract the main components
        const rootMatch = plainContent.match(/\(([a-z0-9]+)\s*\/\s*([^)]+?)\s*(?=:|\))/i);
        if (!rootMatch) {
            console.error("Could not match root pattern in content:", plainContent);
            return;
        }
        
        const rootVar = rootMatch[1].trim();
        const rootType = rootMatch[2].trim();
        
        // Create formatted HTML content with syntax highlighting
        let htmlContent = `<span class="parenthesis">(</span><span class="root-var">${rootVar}</span> / <span class="root-type">${rootType}</span>\n`;
        
        // Function to check if a node is valid for a branch type
        function isValidNode(node, branchType) {
            // Check if it's a valid variable format
            if (VARIABLE_REGEX.test(node)) return true;
            
            // Check if it's in the predefined rolesets for this branch
            return DOC_LEVEL_ROLESETS[branchType].includes(node);
        }
        
        // Function to check if a relation is valid for a branch type
        function isValidRelation(relation, branchType) {
            return DOC_LEVEL_RELATIONS[branchType].includes(relation);
        }
        
        // Function to extract branch content with a more robust approach
        function extractBranchContent(branchName) {
            // Find the branch section start and end
            const startPattern = new RegExp(`:${branchName}\\s*\\(`, "i");
            const startMatch = plainContent.match(startPattern);
            if (!startMatch) return null;
            
            const startIndex = startMatch.index;
            let parenCount = 1; // Start with 1 for the opening paren
            let endIndex = startIndex + startMatch[0].length;
            
            // Find the matching closing parenthesis
            while (parenCount > 0 && endIndex < plainContent.length) {
                if (plainContent[endIndex] === '(') parenCount++;
                else if (plainContent[endIndex] === ')') parenCount--;
                endIndex++;
            }
            
            if (parenCount !== 0) {
                console.warn(`Unbalanced parentheses in ${branchName} branch`);
                return null;
            }
            
            // Extract the content between the parentheses
            const branchContent = plainContent.substring(startIndex + startMatch[0].length, endIndex - 1).trim();
            console.log(`Extracted raw ${branchName} branch content:`, branchContent);
            return branchContent;
        }
        
        // Function to extract triples from branch content
        function extractTriples(branchContent) {
            if (!branchContent) return [];
            
            // Special handling for database format with double parentheses
            // The format in the database is ":branch ((triple1) (triple2))" 
            const doubleParenPattern = /^\(\s*\(([^)]+)\)\s*\)/;
            const doubleParenMatch = branchContent.match(doubleParenPattern);
            
            if (doubleParenMatch) {
                // We have the database format with double parentheses
                console.log("Detected database format with double parentheses");
                
                // Extract content from double parentheses
                const innerContent = doubleParenMatch[1].trim();
                console.log("Inner content:", innerContent);
                
                // Look for additional triples after the first one
                const tripleParts = branchContent.split(/\)\s*\(/);
                console.log("Triple parts:", tripleParts);
                
                const triples = [];
                
                // Process each potential triple
                tripleParts.forEach(part => {
                    // Clean up the part to get just the triple content
                    let cleanPart = part.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
                    cleanPart = cleanPart.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
                    
                    if (!cleanPart) return;
                    
                    console.log("Cleaned triple part:", cleanPart);
                    
                    // Extract source, relation, target
                    const parts = cleanPart.split(/\s+/);
                    if (parts.length >= 3) {
                        // Find the relation part (starts with :)
                        const relationIndex = parts.findIndex(p => p.startsWith(':'));
                        
                        if (relationIndex > 0 && relationIndex < parts.length - 1) {
                            // We have a valid triple structure
                            const source = parts[0];
                            const relation = parts[relationIndex];
                            const target = parts[parts.length - 1];
                            
                            triples.push({ source, relation, target });
                        }
                    }
                });
                
                // If we found triples with this approach, return them
                if (triples.length > 0) {
                    console.log("Extracted database-format triples:", triples);
                    return triples;
                }
            }
            
            // Handle the ((triple1)(triple2)) format directly
            if (branchContent.startsWith('(') && branchContent.includes(')(')) {
                console.log("Detected direct multiple triple format");
                
                // Split at the boundaries between triples
                const tripleStrings = branchContent.replace(/^\(/, '').replace(/\)$/, '').split(')(');
                console.log("Triple strings:", tripleStrings);
                
                const triples = [];
                
                tripleStrings.forEach(tripleStr => {
                    const parts = tripleStr.trim().split(/\s+/);
                    if (parts.length >= 3) {
                        // Find the relation part (starts with :)
                        const relationIndex = parts.findIndex(p => p.startsWith(':'));
                        
                        if (relationIndex > 0 && relationIndex < parts.length - 1) {
                            // We have a valid triple structure
                            const source = parts[0];
                            const relation = parts[relationIndex];
                            const target = parts[parts.length - 1];
                            
                            triples.push({ source, relation, target });
                        }
                    }
                });
                
                if (triples.length > 0) {
                    console.log("Extracted direct format triples:", triples);
                    return triples;
                }
            }
            
            // Fall back to original triple extraction method if the above didn't work
            // Find all triple patterns (node :relation node)
            const triples = [];
            const triplePattern = /\(\s*([^\s\(\)]+)\s+(:[\w-]+)\s+([^\s\(\)]+)\s*\)/g;
            let match;
            
            while ((match = triplePattern.exec(branchContent)) !== null) {
                triples.push({
                    source: match[1],
                    relation: match[2],
                    target: match[3]
                });
            }
            
            console.log("Extracted fallback-format triples:", triples);
            return triples;
        }
        
        // Process each branch
        function processBranch(branchName) {
            const branchContent = extractBranchContent(branchName);
            console.log(`${branchName} branch content:`, branchContent);
            
            // Start the branch HTML with proper indentation
            let branchHtml = `    <span class="branch-name">:${branchName}</span> <span class="parenthesis">(</span>\n`;
            
            if (!branchContent || branchContent.trim() === '') {
                // Empty branch
                branchHtml += `     <span class="parenthesis">)</span>`;
                return branchHtml;
            }
            
            // Extract triples from the branch content
            const triples = extractTriples(branchContent);
            
            // Format each triple
            if (triples.length > 0) {
                const formattedTriples = triples.map((triple, index) => {
                    // Apply validation
                    const sourceClass = isValidNode(triple.source, branchName) ? "node" : "node invalid";
                    const relationClass = isValidRelation(triple.relation, branchName) ? "relation" : "relation invalid";
                    const targetClass = isValidNode(triple.target, branchName) ? "node" : "node invalid";
                    
                    // Create a unique ID for this triple for deletion purposes
                    const tripleId = `${branchName}-triple-${index}-${Date.now()}`;
                    
                    // Return formatted triple with highlighting and delete icon
                    return `                     <div class="triple-container" data-triple-id="${tripleId}" data-branch="${branchName}" data-source="${triple.source}" data-relation="${triple.relation}" data-target="${triple.target}" data-label="Right-click to delete this triple">
                        <span class="parenthesis">(</span><span class="${sourceClass}">${triple.source}</span> <span class="${relationClass}">${triple.relation}</span> <span class="${targetClass}">${triple.target}</span><span class="parenthesis">)</span>
                        <span class="delete-triple-icon" data-triple-id="${tripleId}"><i class="fas fa-trash-alt"></i></span>
                     </div>`;
                });
                
                // Join the triples with line breaks
                branchHtml += formattedTriples.join('\n');
            }
            
            // Close the branch
            branchHtml += `\n     <span class="parenthesis">)</span>`;
            
            return branchHtml;
        }
        
        // Process all branches
        const temporalSection = processBranch('temporal');
        const modalSection = processBranch('modal');
        const corefSection = processBranch('coref');
        
        // Add branches to the HTML
        htmlContent += temporalSection + '\n';
        htmlContent += modalSection + '\n';
        htmlContent += corefSection + '\n';
        
        // Close the root
        htmlContent += `<span class="parenthesis">)</span>`;
        
        // Set the HTML content
        annotationContent.innerHTML = htmlContent;
        
        // Add a "Right-click to delete triples" helper text at the top of the annotation
        const helperText = document.createElement('div');
        helperText.className = 'delete-helper-text';
        helperText.innerHTML = '<i class="fas fa-info-circle"></i> Right-click on any triple to delete it';
        helperText.style.backgroundColor = '#f8f9fa';
        helperText.style.border = '1px solid #dee2e6';
        helperText.style.borderRadius = '4px';
        helperText.style.padding = '5px 10px';
        helperText.style.marginBottom = '10px';
        helperText.style.fontSize = '12px';
        helperText.style.color = '#495057';
        
        // Insert at the top of the annotation
        annotationContent.insertBefore(helperText, annotationContent.firstChild);
        
        // Setup delete buttons after formatting
        console.log("Setting up delete functionality");
        setTimeout(setupDeleteButtons, 100);
    } catch (e) {
        console.error("Error formatting annotation with highlighting:", e);
        console.error("Stack trace:", e.stack);
        
        // Fallback to plain text
        annotationContent.textContent = plainContent;
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded - initializing document level annotation formatter");
    
    // Get the annotation content element
    const annotationContent = document.getElementById('doc-annotation-content');
    if (annotationContent) {
        // Store the original text for debugging
        const originalText = annotationContent.textContent;
        console.log("Original annotation text from server:", originalText);
        
        // Format the annotation with syntax highlighting
        setTimeout(formatDocLevelAnnotation, 100);
    }
});

// Function to update document level annotation display
function updateDocLevelAnnotation(annotation) {
    const annotationContainer = document.getElementById('doc-annotation');
    const annotationContent = document.getElementById('doc-annotation-content');
    const placeholder = document.getElementById('doc-annotation-placeholder');
    
    // Add debug logging to see what we're receiving
    console.log("Original annotation from server:", annotation);
    
    if (annotation && annotation.trim()) {
        // Create the pre element if it doesn't exist
        if (!annotationContent) {
            if (placeholder) placeholder.style.display = 'none';
            const pre = document.createElement('pre');
            pre.className = 'mb-0';
            pre.id = 'doc-annotation-content';
            pre.textContent = annotation;
            annotationContainer.appendChild(pre);
        } else {
            annotationContent.textContent = annotation;
            if (placeholder) placeholder.style.display = 'none';
            annotationContent.style.display = 'block';
        }
        
        // Apply formatting with syntax highlighting
        formatDocLevelAnnotation();
    } else {
        // Show placeholder if no annotation
        if (annotationContent) annotationContent.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    }
}

// Navigation functions
function prevSentence() {
    const currentId = parseInt(window.state.currentId);
    if (currentId > 1) {
        const shouldSave = confirm("Do you want to save your current changes before navigating to the previous sentence?");
        if (shouldSave) {
            saveDocAnnotation().then(() => {
                window.location.href = `/doclevel/${window.state.docVersionId}/${currentId - 1}`;
            });
        } else {
            window.location.href = `/doclevel/${window.state.docVersionId}/${currentId - 1}`;
        }
    } else {
        showNotification("You're at the first sentence already.", "warning");
    }
}

function nextSentence() {
    const currentId = parseInt(window.state.currentId);
    if (currentId < window.state.maxSentId) {
        const shouldSave = confirm("Do you want to save your current changes before navigating to the next sentence?");
        if (shouldSave) {
            saveDocAnnotation().then(() => {
                window.location.href = `/doclevel/${window.state.docVersionId}/${currentId + 1}`;
            });
        } else {
            window.location.href = `/doclevel/${window.state.docVersionId}/${currentId + 1}`;
        }
    } else {
        showNotification("You're at the last sentence already.", "warning");
    }
}

// Setup functionality for delete buttons on existing triples
function setupDeleteButtons() {
    console.log("Setting up delete buttons for existing triples");
    
    // Wait a moment for the DOM to be fully updated
    setTimeout(() => {
        // First, add a global right-click event handler to the annotation container
        const annotationContent = document.getElementById('doc-annotation-content');
        if (annotationContent) {
            // Prevent default browser context menu on the entire annotation area
            annotationContent.addEventListener('contextmenu', function(e) {
                // Check if the click is on or within a triple container
                const tripleContainer = e.target.closest('.triple-container');
                if (tripleContainer) {
                    e.preventDefault(); // Prevent default browser context menu
                    
                    // Get the triple data
                    const tripleId = tripleContainer.getAttribute('data-triple-id');
                    const branch = tripleContainer.getAttribute('data-branch');
                    const source = tripleContainer.getAttribute('data-source');
                    const relation = tripleContainer.getAttribute('data-relation');
                    const target = tripleContainer.getAttribute('data-target');
                    
                    // Show confirmation message
                    if (confirm(`Are you sure you want to delete the triple: (${source} ${relation} ${target})?`)) {
                        deleteTriple(tripleId, branch);
                    }
                    
                    return false; // Prevent default and stop propagation
                }
            });
            
            // Also add click event to the delete icons
            const deleteIcons = document.querySelectorAll('.delete-triple-icon');
            deleteIcons.forEach(icon => {
                icon.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const tripleId = this.getAttribute('data-triple-id');
                    const tripleContainer = document.querySelector(`.triple-container[data-triple-id="${tripleId}"]`);
                    
                    if (tripleContainer) {
                        // Get the triple data for confirmation
                        const branch = tripleContainer.getAttribute('data-branch');
                        const source = tripleContainer.getAttribute('data-source');
                        const relation = tripleContainer.getAttribute('data-relation');
                        const target = tripleContainer.getAttribute('data-target');
                        
                        // Confirm deletion
                        if (confirm(`Are you sure you want to delete the triple: (${source} ${relation} ${target})?`)) {
                            deleteTriple(tripleId, branch);
                        }
                    }
                });
            });
        }
    }, 300);
}

// Function to delete a triple and update the annotation
function deleteTriple(tripleId, branchName) {
    console.log(`Deleting triple ${tripleId} from branch ${branchName}`);
    
    // Find the triple container
    const tripleContainer = document.querySelector(`.triple-container[data-triple-id="${tripleId}"]`);
    if (!tripleContainer) {
        console.error(`Triple container with ID ${tripleId} not found`);
        return;
    }
    
    // Get the branch container (the parent elements up to the branch level)
    const branchContainer = tripleContainer.closest('.branch-name')?.parentElement;
    if (!branchContainer) {
        console.error(`Branch container for ${branchName} not found`);
        return;
    }
    
    // Remove the triple container
    tripleContainer.remove();
    
    // Check if there are any triples left in this branch
    const remainingTriples = branchContainer.querySelectorAll('.triple-container');
    
    // If no triples left, we should rebuild the entire annotation without this branch
    if (remainingTriples.length === 0) {
        console.log(`No triples left in branch ${branchName}, removing branch`);
        rebuildAnnotationWithoutBranch(branchName);
    } else {
        // Otherwise, we should save the updated annotation
        saveUpdatedAnnotation();
    }
}

// Function to rebuild the annotation without a specific branch
function rebuildAnnotationWithoutBranch(branchToRemove) {
    console.log(`Rebuilding annotation without branch ${branchToRemove}`);
    
    // Get the annotation content
    const annotationContent = document.getElementById('doc-annotation-content');
    if (!annotationContent) {
        console.error('Annotation content element not found');
        return;
    }
    
    // Parse the current annotation
    const content = annotationContent.textContent;
    
    // Extract the root variable and type
    const rootMatch = content.match(/\(([a-z0-9]+)\s*\/\s*([^)]+?)\s*(?=:|\))/i);
    if (!rootMatch) {
        console.error('Could not extract root from annotation');
        return;
    }
    
    const rootVar = rootMatch[1].trim();
    const rootType = rootMatch[2].trim();
    
    // Find all branches in the current annotation
    const branches = [];
    const branchPattern = /:(temporal|modal|coref)\s*\(([^)]*(?:\([^)]*\))*)\)/g;
    let branchMatch;
    
    while ((branchMatch = branchPattern.exec(content)) !== null) {
        const branchName = branchMatch[1];
        if (branchName !== branchToRemove) {
            branches.push({
                name: branchName,
                content: branchMatch[2]
            });
        }
    }
    
    // Build the new annotation
    let newAnnotation = `(${rootVar} / ${rootType}\n`;
    
    // Add each remaining branch
    branches.forEach(branch => {
        newAnnotation += `    :${branch.name} (${branch.content})\n`;
    });
    
    // Close the annotation
    newAnnotation += ')';
    
    // Update the annotation content
    updateDocLevelAnnotation(newAnnotation);
    
    // Save the updated annotation
    saveUpdatedAnnotation();
}

// Function to save the updated annotation to the server
function saveUpdatedAnnotation() {
    // Get the updated annotation text
    const annotationContent = document.getElementById('doc-annotation-content');
    if (!annotationContent) {
        console.error('Annotation content element not found');
        return;
    }
    
    const annotationText = annotationContent.textContent;
    console.log("Saving updated annotation:", annotationText);
    
    // Get the current doc version ID and sentence ID
    const docVersionId = document.getElementById('doc_version_id').value;
    const sentId = document.getElementById('snt_id').value;
    
    // Post the annotation to the server
    fetch(`/update_doc_annotation/${docVersionId}/${sentId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({
            doc_annot: annotationText
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showNotification("Document annotation updated successfully", "success");
        } else {
            showNotification("Error updating document annotation: " + data.message, "error");
        }
    })
    .catch(error => {
        console.error('Error updating document annotation:', error);
        showNotification("Error updating document annotation: " + error.message, "error");
    });
} 