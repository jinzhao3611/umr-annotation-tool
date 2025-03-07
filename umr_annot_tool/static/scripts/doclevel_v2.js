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

// Initialize document level functionality
function initializeDocLevel() {
    console.log("Initializing document level functionality - V2");
    
    // Get values from the page
    docLevelState.docVersionId = document.getElementById("doc_version_id").value;
    docLevelState.sentId = document.getElementById("snt_id").value;
    
    console.log("Initialized with docVersionId:", docLevelState.docVersionId, "and sentId:", docLevelState.sentId);
    
    // Check if we have a current document annotation
    const docAnnotationContent = document.getElementById("doc-annotation-content");
    if (docAnnotationContent) {
        console.log("Found existing document annotation content");
        docLevelState.docAnnotation = docAnnotationContent.textContent.trim();
        console.log("Annotation content:", docLevelState.docAnnotation);
        
        // Parse existing triples from the annotation
        parseTriples(docLevelState.docAnnotation);
        console.log("Parsed triples:", docLevelState.triples);
    } else {
        console.log("No existing document annotation content found");
        // Check if there's a placeholder message, which means there's no annotation yet
        const placeholder = document.getElementById("doc-annotation-placeholder");
        if (placeholder) {
            docLevelState.docAnnotation = "";
        }
    }
    
    // Always render the triples UI, even if there are no triples
    console.log("Calling renderTriples() to update the UI");
    renderTriples();
    
    // Setup event listeners for the forms
    setupFormEventListeners();
    
    console.log("Document level initialization complete");
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

// Display a notification message to the user
function showNotification(message, type = 'info') {
    // If there's already a notification, remove it
    const existingNotification = document.querySelector('.notification-message');
    if (existingNotification) {
        document.body.removeChild(existingNotification);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-message notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}
            </div>
            <div class="notification-text">${message}</div>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Add styles if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification-message {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 15px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transform: translateY(-20px);
                opacity: 0;
                transition: all 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .notification-message.show {
                transform: translateY(0);
                opacity: 1;
            }
            .notification-content {
                display: flex;
                align-items: center;
            }
            .notification-icon {
                margin-right: 10px;
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                color: white;
            }
            .notification-success {
                background-color: #f1f9f5;
                border-left: 4px solid #28a745;
            }
            .notification-success .notification-icon {
                background-color: #28a745;
            }
            .notification-error {
                background-color: #fbf1f0;
                border-left: 4px solid #dc3545;
            }
            .notification-error .notification-icon {
                background-color: #dc3545;
            }
            .notification-info {
                background-color: #f0f7fb;
                border-left: 4px solid #17a2b8;
            }
            .notification-info .notification-icon {
                background-color: #17a2b8;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            
            // Remove from DOM after transition completes
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }, 100);
    
    // Log the notification message in the console as well
    console.log(`Notification (${type}): ${message}`);
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
    if (sentId) {
        // Ask if the user wants to save before navigating
        const shouldSave = confirm("Do you want to save your current changes before navigating to another sentence?");
        
        if (shouldSave) {
            // Save current annotation first, then navigate
            saveDocAnnotation().then(() => {
                // Properly generate the URL with Flask's url_for
                window.location.href = "/doclevel/" + docLevelState.docVersionId + "/" + sentId;
            });
        } else {
            // Navigate without saving - properly generate URL
            window.location.href = "/doclevel/" + docLevelState.docVersionId + "/" + sentId;
        }
    }
}; 