// Global state for document level annotations
const docLevelState = {
    docVersionId: null,
    sentId: null,
    docAnnotation: "",
    triples: [],
    isDirty: false
};

// Log to confirm latest version
console.log("Document level script loaded - version with structured annotation and delete buttons");

// Initialize document level functionality
function initializeDocLevel() {
    console.log("Initializing document level functionality");
    
    // Get values from the page
    docLevelState.docVersionId = document.getElementById("doc_version_id").value;
    docLevelState.sentId = document.getElementById("snt_id").value;
    
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
    
    // Only update the UI if we need to display parsed triples
    if (docLevelState.triples.length > 0) {
        updateDocAnnotation();
    }
    
    // Setup event listeners for the forms
    setupFormEventListeners();
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
    let source, relation, target;
    
    // Get values based on triple type
    if (tripleType === 'temporal') {
        source = document.getElementById('temporal-source').value.trim();
        relation = document.getElementById('temporal-relation').value;
        target = document.getElementById('temporal-target').value.trim();
    } else if (tripleType === 'modal') {
        source = document.getElementById('modal-source').value.trim();
        relation = document.getElementById('modal-relation').value;
        target = document.getElementById('modal-target').value.trim();
    } else if (tripleType === 'coreference') {
        source = document.getElementById('coref-source').value.trim();
        relation = document.getElementById('coref-relation').value;
        target = document.getElementById('coref-target').value.trim();
    } else {
        console.error("Unknown triple type:", tripleType);
        return;
    }
    
    // Validate inputs
    if (!source || !target) {
        alert("Please enter both source and target nodes.");
        return;
    }
    
    // Create a new triple
    const triple = {
        id: generateUniqueId(),
        type: tripleType,
        source: source,
        relation: relation,
        target: target,
        sentId: docLevelState.sentId
    };
    
    // Add it to our state
    docLevelState.triples.push(triple);
    docLevelState.isDirty = true;
    
    // Update the document annotation text - this will also update the UI
    updateDocAnnotation();
    
    // Clear the form
    clearTripleForm(tripleType);
    
    // Show confirmation
    showNotification(`Added ${tripleType} triple: ${source} ${relation} ${target}`, 'success');
}

// Remove a triple from the document annotation
function removeTriple(tripleId) {
    // Find the triple to remove
    const index = docLevelState.triples.findIndex(t => t.id === tripleId);
    if (index === -1) return; // Triple not found
    
    // Get the triple to be removed
    const removedTriple = docLevelState.triples[index];
    const tripleType = removedTriple.type; // temporal, modal, or coreference
    
    // Remove the triple from the array
    docLevelState.triples.splice(index, 1);
    docLevelState.isDirty = true;
    
    // Check if this was the last triple of its type
    const remainingOfType = docLevelState.triples.filter(t => t.type === tripleType).length;
    
    let message;
    if (remainingOfType === 0) {
        message = `Removed last ${tripleType} triple. ${tripleType} branch removed.`;
    } else {
        message = `Removed triple: ${removedTriple.source} ${removedTriple.relation} ${removedTriple.target}`;
    }
    
    // Update the document annotation text - this will also update the UI
    updateDocAnnotation();
    
    // Show confirmation
    showNotification(message, 'info');
}

// Parse triples from the document annotation text
function parseTriples(annotationText) {
    // Clear existing triples
    docLevelState.triples = [];
    
    if (!annotationText) return;
    
    // Simple parser for triples in the format:
    // (type :source source-node :relation relation-type :target target-node :sent-id sent-id)
    const tripleRegex = /\((temporal|modal|coreference)\s+:source\s+(\S+)\s+:relation\s+(\S+)\s+:target\s+(\S+)(?:\s+:sent-id\s+(\d+))?\)/g;
    
    let match;
    while ((match = tripleRegex.exec(annotationText)) !== null) {
        // Create a triple object with unique ID
        const triple = {
            id: generateUniqueId(),
            type: match[1],                 // temporal, modal, or coreference
            source: match[2],               // source node
            relation: match[3],             // relation type 
            target: match[4],               // target node
            sentId: match[5] || docLevelState.sentId,  // sentence ID or current if not specified
            original: match[0]              // original string for exact replacement
        };
        
        docLevelState.triples.push(triple);
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
                            <button class="btn btn-sm btn-danger delete-triple" onclick="removeTriple('${triple.id}')">×</button>
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
                            <button class="btn btn-sm btn-danger delete-triple" onclick="removeTriple('${triple.id}')">×</button>
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
                            <button class="btn btn-sm btn-danger delete-triple" onclick="removeTriple('${triple.id}')">×</button>
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
    // Since we've removed the existing-triples section, we'll update the
    // document annotation display directly instead
    updateDocAnnotation();
    
    // The original implementation tried to render triples to a separate container
    // that no longer exists, so we'll just skip that part
    const container = document.getElementById("existing-triples");
    if (!container) {
        // Container doesn't exist anymore, just return
        return;
    }
    
    if (docLevelState.triples.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No triples added yet. Use the forms above to add document-level triples.</div>';
        return;
    }
    
    let html = '';
    
    // Group triples by type for better organization
    const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
    const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
    const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
    
    // Add temporal triples
    if (temporalTriples.length > 0) {
        html += '<h6 class="mt-3 mb-2">Temporal Relations</h6>';
        temporalTriples.forEach(triple => {
            html += createTripleHtml(triple);
        });
    }
    
    // Add modal triples
    if (modalTriples.length > 0) {
        html += '<h6 class="mt-3 mb-2">Modal Relations</h6>';
        modalTriples.forEach(triple => {
            html += createTripleHtml(triple);
        });
    }
    
    // Add coreference triples
    if (corefTriples.length > 0) {
        html += '<h6 class="mt-3 mb-2">Coreference Relations</h6>';
        corefTriples.forEach(triple => {
            html += createTripleHtml(triple);
        });
    }
    
    if (container) {
        container.innerHTML = html;
        
        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-triple-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tripleId = this.getAttribute('data-id');
                removeTriple(tripleId);
            });
        });
    }
}

// Create HTML for a single triple
function createTripleHtml(triple) {
    return `
        <div class="triple-item">
            <span class="triple-type ${triple.type}">${triple.type}</span>
            <button class="btn btn-sm btn-outline-danger remove-btn remove-triple-btn" data-id="${triple.id}">×</button>
            
            <div class="triple-source-indicator">
                From sentence <span class="sent-id">#${triple.sentId}</span>
            </div>
            
            <div class="triple-content">
                <span class="node source-node" title="${triple.source}">${triple.source}</span>
                <span class="relation">${triple.relation}</span>
                <span class="node target-node" title="${triple.target}">${triple.target}</span>
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

// Show notification to the user
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
        
        // Add styles if not already in CSS
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 15px;
                    border-radius: 4px;
                    color: white;
                    font-weight: 500;
                    z-index: 9999;
                    transition: opacity 0.3s;
                    max-width: 300px;
                }
                .notification.info { background-color: #17a2b8; }
                .notification.success { background-color: #28a745; }
                .notification.warning { background-color: #ffc107; color: #343a40; }
                .notification.error { background-color: #dc3545; }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.opacity = '1';
    
    // Fade out after a delay
    setTimeout(() => {
        notification.style.opacity = '0';
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