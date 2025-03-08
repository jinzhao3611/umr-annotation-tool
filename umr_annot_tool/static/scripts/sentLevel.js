// Global state
const state = {
    currentId: window.state?.currentId || 1,
    language: window.state?.language || 'english',
    frameDict: {},
    partialGraphs: {},
    umr: { n: 0 },
    showAmrObj: {
        "option-string-args-with-head": false,
        "option-1-line-NEs": true,
        "option-1-line-ORs": false,
        "option-role-auto-case": false,
        "option-check-chinese": true,
        "option-resize-command": true,
        'option-indentation-style': 'variable',
        'option-auto-reification': true
    },
    variablesInUse: {},
    currentMode: 'top',
    currentParent: null,
    currentConcept: null,
    currentRelation: null,
    currentAttribute: null,
    currentNeConcept: null,
    begOffset: -1,
    endOffset: -1,
    docVersionId: window.state?.docVersionId,
    maxSentId: window.state?.maxSentId
};

// Initialize the application
function initialize(frameJson, partialGraphsJson) {
    try {
        // Use the global state values if available
        if (window.state) {
            state.currentId = window.state.currentId;
            state.language = window.state.language;
            state.docVersionId = window.state.docVersionId;
            state.maxSentId = window.state.maxSentId;
        }

        // Set frame dictionary and partial graphs
        state.frameDict = frameJson;
        state.partialGraphs = partialGraphsJson;

        // Initialize UMR
        state.umr = { n: 0 };

        // Set up event listeners
        setupEventListeners();

        // Initialize UI
        initializeUI();

        console.log('Initialization complete with state:', state);
    } catch (error) {
        console.error('Error during initialization:', error);
        throw error;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.navigation-controls button').forEach(button => {
        button.addEventListener('click', handleNavigation);
    });

    // Annotation tools
    document.querySelectorAll('.annotation-tools button').forEach(button => {
        button.addEventListener('click', handleAnnotationTool);
    });

    // Quick actions
    document.querySelectorAll('.quick-actions button').forEach(button => {
        button.addEventListener('click', handleQuickAction);
    });
}

// Initialize UI components
function initializeUI() {
    // Initialize split panels
    Split(['.left-panel', '.right-panel'], {
        sizes: [70, 30],
        minSize: [300, 200],
        gutterSize: 8,
        snapOffset: 0,
        dragInterval: 1,
        cursor: 'col-resize'
    });

    // Initialize collapsible elements
    const bsCollapse = new bootstrap.Collapse(document.getElementById('docInfo'), {
        toggle: false
    });
}

// Navigation handlers
function handleNavigation(event) {
    const action = event.target.getAttribute('data-action');
    if (action === 'prev') {
        prevSentence();
    } else if (action === 'next') {
        nextSentence();
    }
}

function prevSentence() {
    if (state.currentId > 1) {
        window.location.href = `/sentlevel/${state.docVersionId}/${state.currentId - 1}`;
    }
}

function nextSentence() {
    const maxId = parseInt(document.getElementById('maxSentId').value);
    if (state.currentId < maxId) {
        window.location.href = `/sentlevel/${state.docVersionId}/${state.currentId + 1}`;
    }
}

// Annotation tool handlers
function handleAnnotationTool(event) {
    const action = event.target.getAttribute('data-action');
    switch (action) {
        case 'setHead':
            setHead();
            break;
        case 'savePartialGraph':
            savePartialGraph();
            break;
        // Add more cases as needed
    }
}

// Quick action handlers
function handleQuickAction(event) {
    const action = event.target.getAttribute('data-action');
    switch (action) {
        case 'save':
            saveAnnotation();
            break;
        case 'reset':
            resetAnnotation();
            break;
        case 'undo':
            undo();
            break;
        case 'redo':
            redo();
            break;
        // Add more cases as needed
    }
}

// Core annotation functions
function saveAnnotation() {
    // TODO: Implement save functionality
    console.log('Saving annotation...');
}

function resetAnnotation() {
    // TODO: Implement reset functionality
    console.log('Resetting annotation...');
}

function undo() {
    // TODO: Implement undo functionality
    console.log('Undoing last action...');
}

function redo() {
    // TODO: Implement redo functionality
    console.log('Redoing last action...');
}

// Save UMR annotation to database
function UMR2db() {
    try {
        console.log('Saving UMR to database...');
        
        // Get the annotation element and extract the UMR string
        const annotationElement = document.querySelector('#amr pre');
        if (!annotationElement) {
            console.error('Annotation element not found');
            showNotification('Error: Annotation element not found', 'error');
            return;
        }
        
        const umrString = annotationElement.textContent.trim();
        if (!umrString) {
            console.error('Empty UMR annotation');
            showNotification('Error: Empty UMR annotation', 'error');
            return;
        }
        
        // Get document and sentence IDs
        const docVersionId = document.getElementById('doc_version_id').value;
        const sentId = document.getElementById('snt_id').value;
        
        // Get CSRF token if available
        const csrfToken = getCsrfTokenFromDocument();
        
        // Make the API call to save the UMR
        fetch('/save_umr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify({
                doc_version_id: docVersionId,
                sent_id: sentId,
                umr_string: umrString
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
        console.error('Exception in UMR2db:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Helper function to show notifications
function showNotification(message, type, duration = 3000) {
    // Check if notification container exists, create if not
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification`;
    notification.style.minWidth = '300px';
    notification.style.marginBottom = '10px';
    notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    notification.innerHTML = message;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.style.float = 'right';
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    notification.appendChild(closeBtn);
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        notification.remove();
    }, duration);
}

// Helper function to get CSRF token from the document
function getCsrfTokenFromDocument() {
    // Try to get from meta tag first
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    
    // Try to get from hidden input field
    const csrfInput = document.querySelector('input[name="csrf_token"]');
    if (csrfInput) {
        return csrfInput.value;
    }
    
    // Return null if not found
    return null;
}

// Export functions for use in HTML
window.initialize = initialize;
window.prevSentence = prevSentence;
window.nextSentence = nextSentence;
window.saveAnnotation = saveAnnotation;
window.resetAnnotation = resetAnnotation;
window.undo = undo;
window.redo = redo;
window.UMR2db = UMR2db;
window.showNotification = showNotification;