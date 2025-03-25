/**
 * Initialize the comparison of the two annotations
 */
function initializeComparison() {
    // Get the annotation containers based on comparison level
    if (window.state.comparisonLevel === 'sentence') {
        const doc1Elem = document.querySelector('#doc1-sent-annotation .annotation-content pre');
        const doc2Elem = document.querySelector('#doc2-sent-annotation .annotation-content pre');
        if (doc1Elem && doc2Elem) {
            compareAnnotations(doc1Elem, doc2Elem, 'sentence');
        } else {
            console.error('Could not find sentence annotation elements:', {
                doc1ElemSelector: '#doc1-sent-annotation .annotation-content pre',
                doc2ElemSelector: '#doc2-sent-annotation .annotation-content pre'
            });
        }
    } else {
        const doc1Elem = document.querySelector('#doc1-doc-annotation .annotation-content pre');
        const doc2Elem = document.querySelector('#doc2-doc-annotation .annotation-content pre');
        if (doc1Elem && doc2Elem) {
            compareAnnotations(doc1Elem, doc2Elem, 'document');
        } else {
            console.error('Could not find document annotation elements:', {
                doc1ElemSelector: '#doc1-doc-annotation .annotation-content pre',
                doc2ElemSelector: '#doc2-doc-annotation .annotation-content pre'
            });
        }
    }
    
    // Create the legend for the different types of changes
    createLegend();
    
    // Set up the navigation buttons
    setupNavigationButtons();
    
    // Initialize Ancast evaluation
    if (window.ancastEvaluation && typeof window.ancastEvaluation.initialize === 'function') {
        window.ancastEvaluation.initialize();
    }
}

/**
 * Set up event listeners for the navigation buttons
 */
function setupNavigationButtons() {
    // Previous button
    const prevButton = document.getElementById('prev-btn');
    if (prevButton) {
        prevButton.addEventListener('click', function() {
            navigateToPreviousSentence();
        });
    }
    
    // Next button
    const nextButton = document.getElementById('next-btn');
    if (nextButton) {
        nextButton.addEventListener('click', function() {
            navigateToNextSentence();
        });
    }
    
    // Ancast Evaluation button is now handled in ancast-evaluation.js
}

/**
 * Navigate to the previous sentence
 */
function navigateToPreviousSentence() {
    if (window.state.currentSentId > 1) {
        window.location.href = `/adjudication/${window.state.docVersion1Id}/${window.state.docVersion2Id}/${window.state.currentSentId - 1}/${window.state.comparisonLevel}`;
    }
}

/**
 * Navigate to the next sentence
 */
function navigateToNextSentence() {
    if (window.state.currentSentId < window.state.maxSentId) {
        window.location.href = `/adjudication/${window.state.docVersion1Id}/${window.state.docVersion2Id}/${window.state.currentSentId + 1}/${window.state.comparisonLevel}`;
    }
}

/**
 * Compare the annotations using jsdiff and apply highlighting
 */
function compareAnnotations(elem1, elem2, type) {
    // Make sure elements exist before proceeding
    if (!elem1 || !elem2) {
        console.error('Missing elements for comparison', { elem1, elem2 });
        return;
    }

    // Get the content of both annotations
    const content1 = elem1.textContent || '';
    const content2 = elem2.textContent || '';
    
    console.log('Comparing annotations:', {
        type: type,
        content1Length: content1.length,
        content2Length: content2.length
    });
    
    // If either content is empty, don't try to compare
    if (!content1.trim() || !content2.trim()) {
        console.warn('One or both annotation contents are empty');
        return;
    }
    
    // Detect if we're dealing with UMR annotations
    const isUmrFormat = content1.includes(':ARG') || content2.includes(':ARG') || 
                        content1.match(/\([a-z0-9]+ \/ [a-z0-9-]+/) || 
                        content2.match(/\([a-z0-9]+ \/ [a-z0-9-]+/);
    
    console.log('UMR format detected:', isUmrFormat);

    try {
        // For UMR format, try to work with the hierarchical structure
        if (isUmrFormat) {
            // Split content into lines for better visualization
            const lines1 = content1.split('\n');
            const lines2 = content2.split('\n');

            // Apply diff to each line individually to preserve structure
            applyLineDiffHighlighting(elem1, elem2, lines1, lines2);
        } else {
            // For non-UMR format, use word diff on the whole content
            applyWordDiffHighlighting(elem1, elem2, content1, content2);
        }
    } catch (error) {
        console.error('Error comparing annotations:', error);
        // Fallback to basic comparison
        applyWordDiffHighlighting(elem1, elem2, content1, content2);
    }
}

/**
 * Apply diff highlighting for lines of text (especially for UMR format)
 */
function applyLineDiffHighlighting(elem1, elem2, lines1, lines2) {
    let html1 = '';
    let html2 = '';
    
    // Process each line pair
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
        const line1 = i < lines1.length ? lines1[i] : '';
        const line2 = i < lines2.length ? lines2[i] : '';
        
        if (line1 === '' && line2 !== '') {
            // Line only exists in the second document (added)
            html2 += `<div class="diff-line added">${formatLineWithIndentation(line2)}</div>`;
        } else if (line1 !== '' && line2 === '') {
            // Line only exists in the first document (removed)
            html1 += `<div class="diff-line removed">${formatLineWithIndentation(line1)}</div>`;
        } else if (line1 === line2) {
            // Lines are identical
            html1 += `<div class="diff-line">${formatLineWithIndentation(line1)}</div>`;
            html2 += `<div class="diff-line">${formatLineWithIndentation(line2)}</div>`;
        } else {
            // Lines differ - use jsdiff to show the differences within the line
            const diff = Diff.diffWords(line1, line2);
            
            // Format the first document line
            let lineHtml1 = formatLineWithDiff(diff, true);
            html1 += `<div class="diff-line">${lineHtml1}</div>`;
            
            // Format the second document line
            let lineHtml2 = formatLineWithDiff(diff, false);
            html2 += `<div class="diff-line">${lineHtml2}</div>`;
        }
    }
    
    // Update the content of the elements
    elem1.innerHTML = html1;
    elem2.innerHTML = html2;
}

/**
 * Format a line with indentation preserved
 */
function formatLineWithIndentation(line) {
    // Extract leading whitespace
    const leadingWhitespace = line.match(/^(\s*)/)[0];
    const contentWithoutLeadingWhitespace = line.substring(leadingWhitespace.length);
    
    // Create a span for indentation with the exact number of spaces
    let indentHtml = '';
    if (leadingWhitespace.length > 0) {
        indentHtml = `<span class="umr-indentation">${'&nbsp;'.repeat(leadingWhitespace.length)}</span>`;
    }
    
    return `${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}`;
}

/**
 * Format a line with diff highlighting
 */
function formatLineWithDiff(diff, isFirstDocument) {
    let html = '';
    
    diff.forEach(part => {
        if (part.added && !isFirstDocument) {
            // Addition in the second document
            html += `<span class="diff-added">${escapeHtml(part.value)}</span>`;
        } else if (part.removed && isFirstDocument) {
            // Removal in the first document
            html += `<span class="diff-removed">${escapeHtml(part.value)}</span>`;
        } else if (!part.added && !part.removed) {
            // Unchanged part
            html += escapeHtml(part.value);
        }
        // Skip parts that don't apply to the current document
    });
    
    return html;
}

/**
 * Apply word diff highlighting for the entire content
 */
function applyWordDiffHighlighting(elem1, elem2, content1, content2) {
    // Use jsdiff to compute the differences
    const diff = Diff.diffWords(content1, content2);
    
    // Generate HTML for the first document
    let html1 = '';
    diff.forEach(part => {
        if (part.removed) {
            // Text was removed
            html1 += `<span class="diff-removed">${escapeHtml(part.value)}</span>`;
        } else if (!part.added) {
            // Text is unchanged
            html1 += escapeHtml(part.value);
        }
        // Skip additions as they don't apply to the first document
    });
    
    // Generate HTML for the second document
    let html2 = '';
    diff.forEach(part => {
        if (part.added) {
            // Text was added
            html2 += `<span class="diff-added">${escapeHtml(part.value)}</span>`;
        } else if (!part.removed) {
            // Text is unchanged
            html2 += escapeHtml(part.value);
        }
        // Skip removals as they don't apply to the second document
    });
    
    // Update the content of the elements
    elem1.innerHTML = html1;
    elem2.innerHTML = html2;
}

/**
 * Create the legend for the different types of changes
 */
function createLegend() {
    // The legend is already created in HTML, but let's ensure it has the right classes
    const legend = document.querySelector('.highlight-legend');
    if (!legend) {
        console.warn('Legend container not found');
        return;
    }
    
    // Check if the legend already has content
    if (!legend.querySelector('.legend-item') || legend.children.length < 3) {
        console.log('Legend needs to be created or updated');
        
        // Clear and recreate the legend
        legend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color add"></div>
                <span>Addition</span>
            </div>
            <div class="legend-item">
                <div class="legend-color remove"></div>
                <span>Removal</span>
            </div>
            <div class="legend-item">
                <div class="legend-color change"></div>
                <span>Change</span>
            </div>
        `;
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatScore(value) {
    if (value === undefined || value === null) return "N/A";
    // Convert to number if it's a string
    value = Number(value);
    // Show more decimal places for small values
    if (isNaN(value)) return "N/A";
    if (value === 0) return "0.00";
    if (value < 0.01) return value.toFixed(4);
    if (value < 0.1) return value.toFixed(3);
    return value.toFixed(2);
}

// Initialize the page when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing adjudication page...');
    
    try {
        // Initialize the comparison
        initializeComparison();
        
        console.log('Adjudication page initialized successfully.');
    } catch (error) {
        console.error('Error initializing adjudication page:', error);
    }
});
