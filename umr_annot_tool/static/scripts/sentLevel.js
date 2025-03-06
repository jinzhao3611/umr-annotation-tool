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
function initialize(frameJson, lang, partialGraphsJson) {
    try {
        // Use the global state values if available
        if (window.state) {
            state.currentId = window.state.currentId;
            state.language = window.state.language;
            state.docVersionId = window.state.docVersionId;
            state.maxSentId = window.state.maxSentId;
        }

        // Parse frame dictionary
        state.frameDict = JSON.parse(frameJson);

        // Parse partial graphs
        state.partialGraphs = JSON.parse(partialGraphsJson);

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

// Export functions for use in HTML
window.initialize = initialize;
window.prevSentence = prevSentence;
window.nextSentence = nextSentence;
window.saveAnnotation = saveAnnotation;
window.resetAnnotation = resetAnnotation;
window.undo = undo;
window.redo = redo;