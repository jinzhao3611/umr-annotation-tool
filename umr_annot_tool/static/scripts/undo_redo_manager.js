// UMR Annotation Undo/Redo Manager
// Manages history state for graph editing operations

class UndoRedoManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50; // Limit history to prevent memory issues
        this.isPerformingUndoRedo = false; // Flag to prevent recursive saves during undo/redo

        // Initialize with the current state
        this.initializeHistory();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    initializeHistory() {
        const currentState = this.getCurrentState();
        if (currentState) {
            this.history = [currentState];
            this.currentIndex = 0;
        }
    }

    getCurrentState() {
        const annotationElement = document.querySelector('#amr pre');
        const alignmentsElement = document.getElementById('alignments');

        if (!annotationElement) {
            return null;
        }

        return {
            annotation: annotationElement.textContent,
            alignments: this.getAlignmentsState(),
            timestamp: Date.now()
        };
    }

    getAlignmentsState() {
        // Get current alignments from the UI
        const alignments = {};
        const alignmentRows = document.querySelectorAll('.alignment-row');

        alignmentRows.forEach(row => {
            const variable = row.querySelector('.variable-name')?.textContent;
            if (variable) {
                alignments[variable] = [];
                const alignmentSpans = row.querySelectorAll('.alignment');
                alignmentSpans.forEach(span => {
                    const alignment = span.textContent.trim();
                    if (alignment) {
                        alignments[variable].push(alignment);
                    }
                });
            }
        });

        return alignments;
    }

    saveState(description = '') {
        // Don't save state if we're in the middle of undo/redo
        if (this.isPerformingUndoRedo) {
            return;
        }

        const newState = this.getCurrentState();
        if (!newState) {
            return;
        }

        // Don't save if the state hasn't changed
        if (this.currentIndex >= 0 &&
            this.history[this.currentIndex].annotation === newState.annotation) {
            return;
        }

        // Remove any states after the current index (for branching history)
        this.history = this.history.slice(0, this.currentIndex + 1);

        // Add the new state
        newState.description = description;
        this.history.push(newState);
        this.currentIndex++;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
        }

        // Update UI buttons
        this.updateButtons();
    }

    undo() {
        if (!this.canUndo()) {
            return false;
        }

        this.isPerformingUndoRedo = true;
        this.currentIndex--;
        this.restoreState(this.history[this.currentIndex]);
        this.isPerformingUndoRedo = false;

        this.updateButtons();
        return true;
    }

    redo() {
        if (!this.canRedo()) {
            return false;
        }

        this.isPerformingUndoRedo = true;
        this.currentIndex++;
        this.restoreState(this.history[this.currentIndex]);
        this.isPerformingUndoRedo = false;

        this.updateButtons();
        return true;
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    restoreState(state) {
        // Restore annotation
        const annotationElement = document.querySelector('#amr pre');
        if (annotationElement && state.annotation) {
            annotationElement.textContent = state.annotation;

            // Re-apply syntax highlighting and clickable elements
            if (typeof makeRelationsClickable === 'function') {
                makeRelationsClickable(annotationElement);
            }
            if (typeof makeVariablesClickable === 'function') {
                makeVariablesClickable(annotationElement);
            }
            if (typeof addBranchOperations === 'function') {
                addBranchOperations(annotationElement);
            }
        }

        // Restore alignments if they exist
        if (state.alignments) {
            this.restoreAlignments(state.alignments);
        }

        // Save to server
        this.saveToServer(state);
    }

    restoreAlignments(alignments) {
        // This would need to be implemented based on how alignments are displayed
        // For now, we'll just log them
        console.log('Restoring alignments:', alignments);

        // If there's an update alignments function, call it
        if (typeof updateAlignmentsDisplay === 'function') {
            updateAlignmentsDisplay(alignments);
        }
    }

    saveToServer(state) {
        // Get sentence ID and document ID from the hidden fields
        const sent_id = document.getElementById('snt_id')?.value;
        const doc_version_id = document.getElementById('doc_version_id')?.value;

        if (!sent_id || !doc_version_id) {
            console.error('Unable to save: missing sentence or document ID');
            return;
        }

        // Save annotation
        fetch(`/update_annotation/${doc_version_id}/${sent_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                annotation: state.annotation,
                operation: 'undo_redo',
                alignments: state.alignments
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Failed to save state to server:', data.error);
            }
        })
        .catch(error => {
            console.error('Error saving state to server:', error);
        });
    }

    updateButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');

        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
            undoBtn.title = this.canUndo() ?
                `Undo (${this.history[this.currentIndex - 1]?.description || 'previous action'})` :
                'Nothing to undo';
        }

        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
            redoBtn.title = this.canRedo() ?
                `Redo (${this.history[this.currentIndex + 1]?.description || 'next action'})` :
                'Nothing to redo';
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check if Ctrl/Cmd is pressed
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            if (isCtrlOrCmd) {
                if (e.key === 'z' && !e.shiftKey) {
                    // Ctrl/Cmd + Z for undo
                    e.preventDefault();
                    this.undo();
                } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
                    e.preventDefault();
                    this.redo();
                }
            }
        });
    }

    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.initializeHistory();
        this.updateButtons();
    }
}

// Global instance
let undoRedoManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Undo/Redo Manager');

    // Wait a bit for other scripts to initialize
    setTimeout(() => {
        undoRedoManager = new UndoRedoManager();

        // Hook into existing save functions to track changes
        hookIntoSaveFunctions();

        // Create UI buttons
        createUndoRedoButtons();

        // Try again after a longer delay if buttons weren't created
        setTimeout(() => {
            if (!document.getElementById('undo-btn')) {
                console.log('Retrying button creation...');
                createUndoRedoButtons();
            }

            // Also retry hooking functions in case they weren't ready
            hooksInstalled = false;  // Reset flag to allow re-hooking
            hookIntoSaveFunctions();
        }, 1500);
    }, 500);
});

// Hook into existing save functions to track changes
let hooksInstalled = false;
function hookIntoSaveFunctions() {
    // Prevent duplicate hooks
    if (hooksInstalled) {
        return;
    }

    // Hook into saveAnnotationUpdate if it exists
    if (typeof saveAnnotationUpdate === 'function' && !saveAnnotationUpdate._hooked) {
        const originalSaveAnnotationUpdate = saveAnnotationUpdate;
        window.saveAnnotationUpdate = function(...args) {
            const result = originalSaveAnnotationUpdate.apply(this, args);
            if (undoRedoManager && !undoRedoManager.isPerformingUndoRedo) {
                setTimeout(() => undoRedoManager.saveState('Edit relation'), 100);
            }
            return result;
        };
        saveAnnotationUpdate._hooked = true;
    }

    // Hook into saveValueUpdate if it exists
    if (typeof saveValueUpdate === 'function' && !saveValueUpdate._hooked) {
        const originalSaveValueUpdate = saveValueUpdate;
        window.saveValueUpdate = function(...args) {
            const result = originalSaveValueUpdate.apply(this, args);
            if (undoRedoManager && !undoRedoManager.isPerformingUndoRedo) {
                setTimeout(() => undoRedoManager.saveState('Edit value'), 100);
            }
            return result;
        };
        saveValueUpdate._hooked = true;
    }

    // Hook into saveBranchDeletion if it exists
    if (typeof saveBranchDeletion === 'function' && !saveBranchDeletion._hooked) {
        const originalSaveBranchDeletion = saveBranchDeletion;
        window.saveBranchDeletion = function(updatedAnnotation, deletedRelation) {
            // First save the state BEFORE the deletion for undo
            if (undoRedoManager && !undoRedoManager.isPerformingUndoRedo) {
                // Save current state before deletion
                const preDeleteState = undoRedoManager.getCurrentState();

                // Call the original function
                const result = originalSaveBranchDeletion.apply(this, arguments);

                // Then save the new state after deletion
                setTimeout(() => {
                    undoRedoManager.saveState(`Delete branch: ${deletedRelation}`);
                }, 100);

                return result;
            } else {
                // If we're in undo/redo, just call the original
                return originalSaveBranchDeletion.apply(this, arguments);
            }
        };
        saveBranchDeletion._hooked = true;
    }

    // Hook into saveBranchInsertion if it exists
    if (typeof saveBranchInsertion === 'function' && !saveBranchInsertion._hooked) {
        const originalSaveBranchInsertion = saveBranchInsertion;
        window.saveBranchInsertion = function(...args) {
            const result = originalSaveBranchInsertion.apply(this, args);
            if (undoRedoManager && !undoRedoManager.isPerformingUndoRedo) {
                setTimeout(() => undoRedoManager.saveState('Add branch'), 100);
            }
            return result;
        };
        saveBranchInsertion._hooked = true;
    }

    // Hook into saveBranchMove if it exists
    if (typeof saveBranchMove === 'function' && !saveBranchMove._hooked) {
        const originalSaveBranchMove = saveBranchMove;
        window.saveBranchMove = function(updatedAnnotation, movedRelation, targetVariable) {
            // Save state BEFORE the move for undo
            if (undoRedoManager && !undoRedoManager.isPerformingUndoRedo) {
                // Call the original function
                const result = originalSaveBranchMove.apply(this, arguments);

                // Then save the new state after move
                setTimeout(() => {
                    undoRedoManager.saveState(`Move branch: ${movedRelation} to ${targetVariable}`);
                }, 100);

                return result;
            } else {
                // If we're in undo/redo, just call the original
                return originalSaveBranchMove.apply(this, arguments);
            }
        };
        saveBranchMove._hooked = true;
    }

    // Mark that hooks have been installed
    hooksInstalled = true;

    // Log which hooks were successfully installed
    const installedHooks = [];
    if (saveAnnotationUpdate && saveAnnotationUpdate._hooked) installedHooks.push('saveAnnotationUpdate');
    if (saveValueUpdate && saveValueUpdate._hooked) installedHooks.push('saveValueUpdate');
    if (saveBranchDeletion && saveBranchDeletion._hooked) installedHooks.push('saveBranchDeletion');
    if (saveBranchInsertion && saveBranchInsertion._hooked) installedHooks.push('saveBranchInsertion');
    if (saveBranchMove && saveBranchMove._hooked) installedHooks.push('saveBranchMove');

    console.log('Undo/redo hooks installed:', installedHooks.join(', ') || 'none');
}

// Create undo/redo buttons in the UI
function createUndoRedoButtons() {
    // Check if buttons already exist
    if (document.getElementById('undo-btn')) {
        console.log('Undo/redo buttons already exist');
        return;
    }

    // Find a suitable place to add the buttons (near the save button)
    const saveButton = document.getElementById('save-annotation-btn');
    const addTopButton = document.getElementById('add-top-btn');

    // Use either save button or add-top button as reference
    const referenceButton = saveButton || addTopButton;

    if (!referenceButton) {
        console.warn('Could not find reference button to add undo/redo buttons');
        return;
    }

    const buttonContainer = referenceButton.parentElement;
    console.log('Found button container:', buttonContainer);

    // Create undo button
    const undoBtn = document.createElement('button');
    undoBtn.id = 'undo-btn';
    undoBtn.className = 'btn btn-sm btn-outline-secondary me-2';
    undoBtn.innerHTML = '<i class="fas fa-undo"></i> Undo';
    undoBtn.title = 'Undo last action (Ctrl/Cmd + Z)';
    undoBtn.type = 'button';
    undoBtn.onclick = () => {
        if (undoRedoManager) {
            undoRedoManager.undo();
        }
    };

    // Create redo button
    const redoBtn = document.createElement('button');
    redoBtn.id = 'redo-btn';
    redoBtn.className = 'btn btn-sm btn-outline-secondary me-2';
    redoBtn.innerHTML = '<i class="fas fa-redo"></i> Redo';
    redoBtn.title = 'Redo last action (Ctrl/Cmd + Y)';
    redoBtn.type = 'button';
    redoBtn.onclick = () => {
        if (undoRedoManager) {
            undoRedoManager.redo();
        }
    };

    // Insert buttons at the beginning of the button group
    buttonContainer.insertBefore(redoBtn, buttonContainer.firstChild);
    buttonContainer.insertBefore(undoBtn, buttonContainer.firstChild);

    // Initial button state
    if (undoRedoManager) {
        undoRedoManager.updateButtons();
    }
}

// Export for use in other scripts
window.undoRedoManager = undoRedoManager;