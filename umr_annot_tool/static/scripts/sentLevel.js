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

    // Quick actions (Note: Most quick action buttons have been removed from the UI)
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

// Quick action handlers (simplified as most quick actions were removed)
function handleQuickAction(event) {
    const action = event.target.getAttribute('data-action');
    switch (action) {
        case 'save':
            saveAnnotation();
            break;
        // Other cases have been removed as they are no longer needed
        default:
            console.log('Action not implemented:', action);
            break;
    }
}

// Core annotation functions
function saveAnnotation() {
    // TODO: Implement save functionality
    console.log('Saving annotation...');
}

// Show a notification to the user
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
window.showNotification = showNotification;