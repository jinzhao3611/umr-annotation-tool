/**
 * Text Editor Mode for UMR Annotation Tool
 * Allows annotators to directly edit UMR graphs as plain text
 */

(function() {
    'use strict';

    let currentMode = 'graph'; // 'graph' or 'text'

    /**
     * Initialize text editor mode functionality
     */
    function initializeTextEditorMode() {
        const toggleBtn = document.getElementById('view-mode-toggle');
        const graphViewContainer = document.getElementById('graph-view-container');
        const textEditorContainer = document.getElementById('text-editor-container');
        const textEditor = document.getElementById('umr-text-editor');

        if (!toggleBtn || !graphViewContainer || !textEditorContainer || !textEditor) {
            console.warn('Text editor mode elements not found. Mode switching disabled.');
            return;
        }

        // Toggle between graph and text editor view
        toggleBtn.addEventListener('click', function() {
            if (currentMode === 'graph') {
                // Switch to text editor mode
                syncGraphToTextEditor();

                // Update UI
                graphViewContainer.style.display = 'none';
                textEditorContainer.style.display = 'block';
                toggleBtn.innerHTML = '<i class="fas fa-project-diagram"></i> Graph';
                toggleBtn.title = 'Switch to Graph view';
                currentMode = 'text';

                // Hide graph-only controls
                hideGraphControls();

                // Focus the text editor
                textEditor.focus();
            } else {
                // Switch to graph mode
                syncTextEditorToGraph();

                // Update UI
                graphViewContainer.style.display = 'block';
                textEditorContainer.style.display = 'none';
                toggleBtn.innerHTML = '<i class="fas fa-edit"></i> Text Editor';
                toggleBtn.title = 'Switch to Text Editor';
                currentMode = 'graph';

                // Show graph-only controls
                showGraphControls();

                // Re-enable interactive editing features
                const annotationElement = document.querySelector('#amr pre');
                if (annotationElement) {
                    // Call all the functions that make the graph interactive
                    if (window.makeRelationsClickable) {
                        window.makeRelationsClickable(annotationElement);
                    }
                    if (window.makeValuesClickable) {
                        window.makeValuesClickable(annotationElement);
                    }
                    if (window.makeVariablesClickable) {
                        window.makeVariablesClickable(annotationElement);
                    }
                    if (window.addBranchOperations) {
                        window.addBranchOperations(annotationElement);
                    }
                }
            }
        });

        // Add tab key support for indentation
        textEditor.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                const value = this.value;

                // Insert 4 spaces at cursor position
                this.value = value.substring(0, start) + '    ' + value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
            }
        });

        // Auto-sync text editor changes to the annotation preview periodically
        textEditor.addEventListener('input', debounce(function() {
            // Mark that changes have been made
            if (window.undoRedoManager && window.undoRedoManager.hasChanges) {
                window.undoRedoManager.hasChanges = true;
            }
        }, 300));

        console.log('Text editor mode initialized successfully');
    }

    /**
     * Hide graph-only controls when in text editor mode
     */
    function hideGraphControls() {
        // Hide Branch toggle, Edit, Command buttons in edit-mode-toggle-placeholder
        const editModePlaceholder = document.getElementById('edit-mode-toggle-placeholder');
        if (editModePlaceholder) {
            editModePlaceholder.style.display = 'none';
        }

        // Hide Delete button (for deleting branches/nodes)
        const deleteBtn = document.getElementById('delete-annotation-btn');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }

        // Hide undo/redo buttons if they exist
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.style.display = 'none';
        if (redoBtn) redoBtn.style.display = 'none';
    }

    /**
     * Show graph-only controls when switching back to graph mode
     */
    function showGraphControls() {
        // Show Branch toggle, Edit, Command buttons
        const editModePlaceholder = document.getElementById('edit-mode-toggle-placeholder');
        if (editModePlaceholder) {
            editModePlaceholder.style.display = '';
        }

        // Show Delete button
        const deleteBtn = document.getElementById('delete-annotation-btn');
        if (deleteBtn) {
            deleteBtn.style.display = '';
        }

        // Show undo/redo buttons if they exist
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.style.display = '';
        if (redoBtn) redoBtn.style.display = '';
    }

    /**
     * Sync content from text editor to graph view
     */
    function syncTextEditorToGraph() {
        const textEditor = document.getElementById('umr-text-editor');
        const amrElement = document.getElementById('amr');

        if (!textEditor || !amrElement) return;

        const content = textEditor.value;

        // Update the pre element in graph view
        const preElement = amrElement.querySelector('pre');
        if (preElement) {
            preElement.textContent = content;
        } else {
            // Create new pre element if it doesn't exist
            amrElement.innerHTML = '<pre class="mb-0"></pre>';
            amrElement.querySelector('pre').textContent = content;
        }

        // Update line numbers
        if (window.updateLineNumbers) {
            window.updateLineNumbers();
        }
    }

    /**
     * Sync content from graph view to text editor
     */
    function syncGraphToTextEditor() {
        const amrElement = document.getElementById('amr');
        const textEditor = document.getElementById('umr-text-editor');

        if (!amrElement || !textEditor) return;

        const preElement = amrElement.querySelector('pre');
        if (preElement) {
            textEditor.value = preElement.textContent;
        }
    }

    /**
     * Get the current annotation text based on active mode
     */
    function getCurrentAnnotationText() {
        if (currentMode === 'text') {
            const textEditor = document.getElementById('umr-text-editor');
            return textEditor ? textEditor.value : '';
        } else {
            const amrElement = document.getElementById('amr');
            const preElement = amrElement ? amrElement.querySelector('pre') : null;
            return preElement ? preElement.textContent : '';
        }
    }

    /**
     * Update annotation text in both views
     */
    function updateAnnotationText(newText) {
        // Update graph view
        const amrElement = document.getElementById('amr');
        if (amrElement) {
            const preElement = amrElement.querySelector('pre');
            if (preElement) {
                preElement.textContent = newText;
            } else {
                amrElement.innerHTML = '<pre class="mb-0"></pre>';
                amrElement.querySelector('pre').textContent = newText;
            }
        }

        // Update text editor
        const textEditor = document.getElementById('umr-text-editor');
        if (textEditor) {
            textEditor.value = newText;
        }

        // Update line numbers
        if (window.updateLineNumbers) {
            window.updateLineNumbers();
        }
    }

    /**
     * Check if currently in text editor mode
     */
    function isTextEditorMode() {
        return currentMode === 'text';
    }

    /**
     * Debounce utility function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Export functions to global scope for use by other scripts
    window.textEditorMode = {
        initialize: initializeTextEditorMode,
        getCurrentText: getCurrentAnnotationText,
        updateText: updateAnnotationText,
        isTextMode: isTextEditorMode,
        syncToGraph: syncTextEditorToGraph,
        syncToEditor: syncGraphToTextEditor
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTextEditorMode);
    } else {
        initializeTextEditorMode();
    }
})();
