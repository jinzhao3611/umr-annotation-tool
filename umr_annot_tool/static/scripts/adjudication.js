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
        // Log sample diff output to understand the structure
        const sampleDiff = Diff.diffWords(
            "This is a test sentence with some words", 
            "This is a modified test with some new words"
        );
        console.log('Sample diff output structure:', sampleDiff);
        
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
    
    // For UMR format, we need to be more careful about whitespace
    const isUmr = lines1.some(l => l.includes(':ARG') || l.match(/\([a-z0-9]+ \/ [a-z0-9-]+/)) || 
                 lines2.some(l => l.includes(':ARG') || l.match(/\([a-z0-9]+ \/ [a-z0-9-]+/));
    
    // Use special options for diffing UMR lines
    const diffOptions = isUmr ? { ignoreWhitespace: true } : {};
    
    // First, do a line-level diff to identify added/removed lines
    // For UMR, compare the trimmed lines to avoid indentation differences
    const trimmedLines1 = isUmr ? lines1.map(l => l.trim()) : lines1;
    const trimmedLines2 = isUmr ? lines2.map(l => l.trim()) : lines2;
    
    const linesDiff = Diff.diffArrays(trimmedLines1, trimmedLines2);
    console.log('Line level diff:', linesDiff);
    
    // Process the line-level differences
    let firstIdx = 0;
    let secondIdx = 0;
    
    linesDiff.forEach(part => {
        if (part.removed) {
            // Lines only in the first document
            part.value.forEach((line, i) => {
                // Use the original line with indentation
                const originalLine = lines1[firstIdx];
                html1 += `<div class="diff-line removed">${formatLineWithIndentation(originalLine)}</div>`;
                firstIdx++;
            });
        } else if (part.added) {
            // Lines only in the second document
            part.value.forEach((line, i) => {
                // Use the original line with indentation
                const originalLine = lines2[secondIdx];
                html2 += `<div class="diff-line added">${formatLineWithIndentation(originalLine)}</div>`;
                secondIdx++;
            });
        } else {
            // Lines in both documents - check for word differences
            part.value.forEach((line, i) => {
                // Get the corresponding lines from both documents
                const originalLine1 = lines1[firstIdx];
                const originalLine2 = lines2[secondIdx];
                
                // When comparing UMR format, we might need to be more flexible with whitespace
                // but still want to keep the original indentation for display
                const areIdentical = isUmr 
                    ? originalLine1.trim() === originalLine2.trim()
                    : originalLine1 === originalLine2;
                
                if (areIdentical) {
                    // Lines are identical (or differ only in whitespace in UMR)
                    html1 += `<div class="diff-line">${formatLineWithIndentation(originalLine1)}</div>`;
                    html2 += `<div class="diff-line">${formatLineWithIndentation(originalLine2)}</div>`;
                } else {
                    // Lines differ at word level
                    const lineDiff = Diff.diffWords(originalLine1, originalLine2, diffOptions);
                    
                    html1 += `<div class="diff-line">${formatLineWithDiff(lineDiff, true)}</div>`;
                    html2 += `<div class="diff-line">${formatLineWithDiff(lineDiff, false)}</div>`;
                }
                
                firstIdx++;
                secondIdx++;
            });
        }
    });
    
    // Update the content of the elements
    elem1.innerHTML = html1;
    elem2.innerHTML = html2;
    
    // Preserve pre formatting
    elem1.style.whiteSpace = 'pre-wrap';
    elem2.style.whiteSpace = 'pre-wrap';
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
    // Check if we're dealing with UMR format
    const isUmr = content1.includes(':ARG') || content2.includes(':ARG') || 
                  content1.match(/\([a-z0-9]+ \/ [a-z0-9-]+/) || 
                  content2.match(/\([a-z0-9]+ \/ [a-z0-9-]+/);
    
    // Use special options for UMR format
    const diffOptions = isUmr ? { ignoreWhitespace: true } : {};
    
    // Use jsdiff to compute the differences
    const diff = Diff.diffWords(content1, content2, diffOptions);
    
    console.log('Word diff results:', diff);
    
    // Generate HTML for the first document
    let html1 = '';
    diff.forEach(part => {
        if (part.removed) {
            // Text was removed from first document
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
            // Text was added to second document
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
    
    // Preserve pre formatting
    elem1.style.whiteSpace = 'pre-wrap';
    elem2.style.whiteSpace = 'pre-wrap';
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
