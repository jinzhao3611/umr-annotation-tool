// Global state for document level annotations
const docLevelState = {
    docVersionId: null,
    sentId: null,
    docAnnotation: "",
    triples: [],
    isDirty: false
};

// Initialize document level functionality
function initializeDocLevel() {
    console.log("Initializing document level functionality");
    
    // Get values from the page
    docLevelState.docVersionId = document.getElementById("doc_version_id").value;
    docLevelState.sentId = document.getElementById("snt_id").value;
    
    // Check if we have a current document annotation
    const docAnnotationContent = document.getElementById("doc-annotation-content");
    if (docAnnotationContent) {
        docLevelState.docAnnotation = docAnnotationContent.textContent.trim();
        // Parse existing triples from the annotation
        parseTriples(docLevelState.docAnnotation);
    }
    
    // Render existing triples
    renderTriples();
    
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
    
    // Update the document annotation text
    updateDocAnnotation();
    
    // Render the updated triples list
    renderTriples();
    
    // Clear the form
    clearTripleForm(tripleType);
    
    // Show confirmation
    showNotification(`Added ${tripleType} triple: ${source} ${relation} ${target}`, 'success');
}

// Remove a triple from the document annotation
function removeTriple(tripleId) {
    const index = docLevelState.triples.findIndex(t => t.id === tripleId);
    if (index !== -1) {
        const removed = docLevelState.triples.splice(index, 1)[0];
        docLevelState.isDirty = true;
        
        // Update the document annotation text
        updateDocAnnotation();
        
        // Render the updated triples list
        renderTriples();
        
        // Show confirmation
        showNotification(`Removed triple: ${removed.source} ${removed.relation} ${removed.target}`, 'info');
    }
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
        const triple = {
            id: generateUniqueId(),
            type: match[1],                 // temporal, modal, or coreference
            source: match[2],               // source node
            relation: match[3],             // relation type 
            target: match[4],               // target node
            sentId: match[5] || docLevelState.sentId  // sentence ID or current if not specified
        };
        
        docLevelState.triples.push(triple);
    }
}

// Update the document annotation text based on the current triples
function updateDocAnnotation() {
    if (docLevelState.triples.length === 0) {
        docLevelState.docAnnotation = "";
        
        // Update the UI to show empty state
        const docAnnotationDiv = document.getElementById("doc-annotation");
        docAnnotationDiv.innerHTML = `
            <div class="alert alert-info mb-0" id="doc-annotation-placeholder">
                No document-level annotation available for this document. Use the tools on the right to create one.
            </div>
        `;
        return;
    }
    
    // Format triples into a string
    let annotationText = "";
    
    docLevelState.triples.forEach(triple => {
        annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
    });
    
    docLevelState.docAnnotation = annotationText.trim();
    
    // Update the UI
    const docAnnotationDiv = document.getElementById("doc-annotation");
    docAnnotationDiv.innerHTML = `<pre class="mb-0" id="doc-annotation-content">${docLevelState.docAnnotation}</pre>`;
}

// Render the triples list in the UI
function renderTriples() {
    const container = document.getElementById("existing-triples");
    
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
    
    container.innerHTML = html;
    
    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-triple-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tripleId = this.getAttribute('data-id');
            removeTriple(tripleId);
        });
    });
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