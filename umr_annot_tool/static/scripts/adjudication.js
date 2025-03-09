/**
 * Adjudication.js
 * Handles the comparison of UMR trees in adjudication view
 */

document.addEventListener('DOMContentLoaded', function() {
    // Debug information for document types
    console.log('Document state:', window.state);
    
    // Initialize Split.js for resizable panels
    Split(['#doc1-column', '#doc2-column'], {
        sizes: [50, 50],
        minSize: 300,
        gutterSize: 10,
        cursor: 'col-resize'
    });
    
    // Setup navigation buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.addEventListener('click', function() {
        if (window.state.currentSentId > 1) {
            window.location.href = `/adjudication/${window.state.docVersion1Id}/${window.state.docVersion2Id}/${window.state.currentSentId - 1}?comparison_level=${window.state.comparisonLevel}`;
        }
    });
    
    nextBtn.addEventListener('click', function() {
        if (window.state.currentSentId < window.state.maxSentId) {
            window.location.href = `/adjudication/${window.state.docVersion1Id}/${window.state.docVersion2Id}/${window.state.currentSentId + 1}?comparison_level=${window.state.comparisonLevel}`;
        }
    });
    
    // Start the comparison process
    initializeComparison();
});

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
}

/**
 * Compare the annotations and apply git-style highlighting
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
    
    // Split into lines with original whitespace preserved
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    
    console.log('Original lines with indentation:', {
        lines1: lines1,
        lines2: lines2
    });
    
    // For UMR format - parse and reorder to maintain hierarchical structure
    if (isUmrFormat) {
        console.log('Processing UMR annotations');
        
        try {
            // Process UMR structure
            const reorderedLines1 = parseUmrStructure(content1);
            const reorderedLines2 = parseUmrStructure(content2);
            
            // Get differences using the parsed structure
            const diffs = findLineDifferences(
                reorderedLines1.map(l => l.trim()), 
                reorderedLines2.map(l => l.trim())
            );
            
            // Apply highlighting with original indentation
            applyGitStyleHighlighting(elem1, elem2, lines1, lines2, diffs, reorderedLines1, reorderedLines2);
            
            // Restore original size properties if needed
            elem1.style.whiteSpace = 'pre';
            elem2.style.whiteSpace = 'pre';
            
            return;
        } catch (error) {
            console.error('Error processing UMR annotations:', error);
            // Fall back to basic processing
        }
    }
    
    // For non-UMR or fallback case
    // Preserve the original order of lines
    const originalLines1 = [...lines1];
    const originalLines2 = [...lines2];
    
    // Get line-by-line differences
    const diffs = findLineDifferences(
        originalLines1.map(l => l.trim()), 
        originalLines2.map(l => l.trim())
    );
    
    // Apply git-style highlighting with original lines
    applyGitStyleHighlighting(elem1, elem2, originalLines1, originalLines2, diffs);
}

/**
 * Reorder UMR lines to maintain hierarchical structure
 * This helps with comparing UMR annotations that have the same meaning
 * but might have different line ordering
 */
function reorderUmrLines(lines) {
    // For nested UMR format, we need to parse the structure
    console.log('Original UMR lines:', lines);
    
    try {
        // First, join all lines to get a complete UMR string
        const umrString = lines.join('\n');
        
        // Parse the UMR string to extract the proper hierarchical structure
        const parsedStructure = parseUmrStructure(umrString);
        
        // If parsing succeeded, return the properly ordered lines
        if (parsedStructure && parsedStructure.length > 0) {
            console.log('Parsed UMR structure:', parsedStructure);
            // Return the parsed lines that respect the hierarchical structure
            return parsedStructure;
        }
    } catch (error) {
        console.error('Error parsing UMR structure:', error);
    }
    
    // Fallback to simpler approaches if parsing fails
    
    // First try to maintain top-level nodes and arguments
    const rootNodeLines = [];
    const argLines = [];
    const otherLines = [];
    
    // First collect all lines that match specific patterns
    for (const line of lines) {
        const trimmed = line.trim();
        // Root node pattern like "(s1p / publication-91"
        if (trimmed.match(/^\([a-z0-9]+ \/ [a-z0-9-]+/)) {
            rootNodeLines.push(trimmed);
        } 
        // ARG pattern like ":ARG1" or ":ARG2"
        else if (trimmed.match(/^:ARG\d+/)) {
            argLines.push(trimmed);
        }
        // Everything else
        else {
            otherLines.push(trimmed);
        }
    }
    
    // Combine them in a logical order
    return [...rootNodeLines, ...argLines, ...otherLines];
}

/**
 * Parse the UMR string into a properly ordered structure
 * This is a more sophisticated approach that handles nested structures
 */
function parseUmrStructure(umrString) {
    // First, properly split the UMR string into lines preserving indentation
    const lines = umrString.split('\n').map(line => line.trim() ? line : '');
    console.log('Original lines with indentation:', lines);
    
    // We'll preserve the original lines with their indentation
    const originalLinesWithIndent = [...lines];
    
    // Normalize lines for parsing (removing indentation but saving line references)
    const normalizedLines = lines.map((line, index) => ({
        originalIndex: index,
        content: line.trim(),
        indentLevel: line.match(/^(\s*)/)[0].length
    })).filter(line => line.content);
    
    // First, identify the root node
    const rootPattern = /^\(([a-z0-9]+)\s+\/\s+([a-z0-9-]+)/;
    const rootLineIndex = normalizedLines.findIndex(line => rootPattern.test(line.content));
    
    if (rootLineIndex === -1) {
        console.warn('Could not find root node in UMR string');
        return originalLinesWithIndent; // Return original lines if no root found
    }
    
    // Track the indices of processed lines
    const processedIndices = new Set();
    
    // Start with the root node
    const rootLine = normalizedLines[rootLineIndex];
    processedIndices.add(rootLineIndex);
    
    // Extract the root node ID
    const rootMatch = rootLine.content.match(rootPattern);
    if (!rootMatch) {
        console.warn('Root node match failed');
        return originalLinesWithIndent;
    }
    
    const rootNodeId = rootMatch[1];
    
    // Build node hierarchy - map node IDs to all associated lines
    const nodeToLinesMap = new Map();
    
    // Initialize with root node
    nodeToLinesMap.set(rootNodeId, [rootLine]);
    
    // Find all node definitions
    const nodeDefinitions = new Map(); // nodeId -> line object
    const nodeChildrenMap = new Map(); // nodeId -> [child nodeIds]
    const nodeParentMap = new Map(); // nodeId -> parent nodeId
    
    // First pass - identify all nodes
    for (let i = 0; i < normalizedLines.length; i++) {
        const line = normalizedLines[i];
        const nodeMatch = line.content.match(/\(([a-z0-9]+)\s+\/\s+([a-z0-9-]+)/);
        
        if (nodeMatch) {
            const nodeId = nodeMatch[1];
            const nodeType = nodeMatch[2];
            nodeDefinitions.set(nodeId, line);
            nodeChildrenMap.set(nodeId, []);
        }
    }
    
    // Second pass - build parent-child relationships
    for (let i = 0; i < normalizedLines.length; i++) {
        const line = normalizedLines[i];
        
        // Look for ARG or op references
        const argMatch = line.content.match(/:(?:ARG[0-9]+|op[0-9]+)\s+\(([a-z0-9]+)/);
        if (argMatch) {
            const childNodeId = argMatch[1];
            
            // Find the parent node by looking at previous lines
            for (let j = i - 1; j >= 0; j--) {
                const prevLine = normalizedLines[j];
                const nodeMatch = prevLine.content.match(/\(([a-z0-9]+)\s+\/\s+([a-z0-9-]+)/);
                
                if (nodeMatch) {
                    const parentNodeId = nodeMatch[1];
                    nodeChildrenMap.get(parentNodeId).push(childNodeId);
                    nodeParentMap.set(childNodeId, parentNodeId);
                    break;
                }
            }
        }
    }
    
    // Function to check if a line belongs to a node
    function linesBelongToNode(nodeId) {
        const result = [];
        const capturedIndices = new Set();
        
        // First, get the node definition itself
        if (nodeDefinitions.has(nodeId)) {
            const nodeLine = nodeDefinitions.get(nodeId);
            result.push(nodeLine);
            capturedIndices.add(normalizedLines.indexOf(nodeLine));
        }
        
        // Get ARG/op lines that reference this node
        for (let i = 0; i < normalizedLines.length; i++) {
            if (capturedIndices.has(i)) continue;
            
            const line = normalizedLines[i];
            const pattern = new RegExp(`:(?:ARG[0-9]+|op[0-9]+)\\s+\\(${nodeId}`);
            
            if (pattern.test(line.content)) {
                result.push(line);
                capturedIndices.add(i);
            }
        }
        
        // Get attribute lines that belong to this node (no parentheses, just property)
        let lastIndex = -1;
        for (const line of result) {
            lastIndex = Math.max(lastIndex, normalizedLines.indexOf(line));
        }
        
        // Attributes normally follow the node definition
        for (let i = lastIndex + 1; i < normalizedLines.length; i++) {
            if (capturedIndices.has(i)) continue;
            
            const line = normalizedLines[i];
            // Attribute lines start with : but don't contain node references
            if (/^:[a-z]/.test(line.content) && !line.content.includes('(')) {
                result.push(line);
                capturedIndices.add(i);
            } else {
                // Stop collecting attributes when we hit a line that's not an attribute
                break;
            }
        }
        
        return result;
    }
    
    // Build the final ordered array by traversing the tree
    const orderedLineObjects = [];
    const processedNodeIds = new Set();
    
    function processNode(nodeId, indentLevel) {
        if (processedNodeIds.has(nodeId)) return;
        processedNodeIds.add(nodeId);
        
        // Get lines for this node
        const nodeLines = linesBelongToNode(nodeId);
        
        // First, add the node definition with appropriate indentation
        const nodeDefIndex = nodeLines.findIndex(line => {
            const match = line.content.match(/\(([a-z0-9]+)\s+\/\s+([a-z0-9-]+)/);
            return match && match[1] === nodeId;
        });
        
        if (nodeDefIndex >= 0) {
            const nodeDef = nodeLines[nodeDefIndex];
            orderedLineObjects.push({
                ...nodeDef,
                calculatedIndent: indentLevel
            });
            
            // Remove node definition from the array
            nodeLines.splice(nodeDefIndex, 1);
        }
        
        // Then add ARG/op references with appropriate indentation
        const argLines = nodeLines.filter(line => 
            line.content.match(/:(?:ARG[0-9]+|op[0-9]+)\s+\(([a-z0-9]+)/)
        );
        
        for (const argLine of argLines) {
            orderedLineObjects.push({
                ...argLine,
                calculatedIndent: indentLevel + 4 // Indent ARG/op lines
            });
            
            // Get the referenced node and process it
            const argMatch = argLine.content.match(/:(?:ARG[0-9]+|op[0-9]+)\s+\(([a-z0-9]+)/);
            if (argMatch) {
                const childNodeId = argMatch[1];
                // Process the child node with increased indentation
                processNode(childNodeId, indentLevel + 8); // Child nodes get more indentation
            }
        }
        
        // Remove ARG/op lines from the array
        for (const argLine of argLines) {
            const index = nodeLines.indexOf(argLine);
            if (index >= 0) {
                nodeLines.splice(index, 1);
            }
        }
        
        // Finally, add any remaining attribute lines
        for (const attrLine of nodeLines) {
            orderedLineObjects.push({
                ...attrLine,
                calculatedIndent: indentLevel + 4 // Indent attribute lines
            });
        }
    }
    
    // Start building the hierarchy from the root
    processNode(rootNodeId, 0);
    
    // Convert back to strings with proper indentation
    const result = orderedLineObjects.map(line => {
        // Use the calculated indentation
        return ' '.repeat(line.calculatedIndent) + line.content;
    });
    
    // Add any lines that weren't processed
    for (let i = 0; i < normalizedLines.length; i++) {
        if (!processedIndices.has(i) && 
            !orderedLineObjects.some(ol => ol.originalIndex === normalizedLines[i].originalIndex)) {
            // Keep original indentation for unprocessed lines
            result.push(originalLinesWithIndent[normalizedLines[i].originalIndex]);
        }
    }
    
    console.log('Reordered UMR lines with indentation:', result);
    return result;
}

/**
 * Find line-by-line differences between two arrays of lines
 */
function findLineDifferences(lines1, lines2) {
    try {
        const diffs = {
            removed: new Set(),
            added: new Set(),
            changed: new Map()  // Maps original line index to changed line index
        };
        
        // Create line-to-index maps to help with matching
        const line1ToIndex = new Map(); // maps content to line index in first document
        const line2ToIndex = new Map(); // maps content to line index in second document
        
        // Populate the maps, keeping only the first occurrence of each line
        // to preserve the relative ordering
        for (let i = 0; i < lines1.length; i++) {
            if (!line1ToIndex.has(lines1[i])) {
                line1ToIndex.set(lines1[i], i);
            }
        }
        
        for (let j = 0; j < lines2.length; j++) {
            if (!line2ToIndex.has(lines2[j])) {
                line2ToIndex.set(lines2[j], j);
            }
        }
        
        // Find lines that are in one document but not the other
        for (let i = 0; i < lines1.length; i++) {
            if (!line2ToIndex.has(lines1[i])) {
                // Line exists in doc1 but not in doc2 - it's been removed
                diffs.removed.add(i);
            }
        }
        
        for (let j = 0; j < lines2.length; j++) {
            if (!line1ToIndex.has(lines2[j])) {
                // Line exists in doc2 but not in doc1 - it's been added
                diffs.added.add(j);
            }
        }
        
        // Find lines that have been changed (similar content but not identical)
        // This is a simplistic approach - would need more sophisticated algorithm for real diffs
        let remainingLines1 = [];
        let remainingLines2 = [];
        
        // Get lines that were neither added nor removed
        for (let i = 0; i < lines1.length; i++) {
            if (!diffs.removed.has(i) && line2ToIndex.has(lines1[i])) {
                remainingLines1.push({ index: i, content: lines1[i] });
            }
        }
        
        for (let j = 0; j < lines2.length; j++) {
            if (!diffs.added.has(j) && line1ToIndex.has(lines2[j])) {
                remainingLines2.push({ index: j, content: lines2[j] });
            }
        }
        
        // Match remaining lines in order
        // This preserves the relative position of matching lines
        let j = 0;
        for (let i = 0; i < remainingLines1.length && j < remainingLines2.length; i++) {
            if (remainingLines1[i].content === remainingLines2[j].content) {
                // Lines match exactly
                j++;
            } else {
                // Lines don't match - look for a match further ahead
                let matchFound = false;
                
                // Look ahead in second document
                for (let k = j + 1; k < remainingLines2.length; k++) {
                    if (remainingLines1[i].content === remainingLines2[k].content) {
                        // Found a match further ahead
                        // Mark lines in between as changed
                        for (let m = j; m < k; m++) {
                            diffs.changed.set(i, remainingLines2[m].index);
                        }
                        j = k + 1;
                        matchFound = true;
                        break;
                    }
                }
                
                if (!matchFound) {
                    // No match found - mark as changed
                    if (j < remainingLines2.length) {
                        diffs.changed.set(remainingLines1[i].index, remainingLines2[j].index);
                        j++;
                    }
                }
            }
        }
        
        console.log('Differences found:', {
            removed: diffs.removed.size,
            added: diffs.added.size,
            changed: diffs.changed.size
        });
        
        return diffs;
    } catch (error) {
        console.error('Error finding differences:', error);
        // Return empty diff set to prevent further errors
        return {
            removed: new Set(),
            added: new Set(),
            changed: new Map()
        };
    }
}

/**
 * Apply git-style highlighting to the elements
 */
function applyGitStyleHighlighting(elem1, elem2, lines1, lines2, diffs, reorderedLines1 = null, reorderedLines2 = null) {
    try {
        // Create new HTML content
        let html1 = '';
        let html2 = '';
        
        console.log('Applying highlights', {
            lines1Count: lines1.length,
            lines2Count: lines2.length,
            diffsRemoved: diffs.removed.size,
            diffsAdded: diffs.added.size,
            diffsChanged: diffs.changed.size,
            usingReordered: !!reorderedLines1
        });
        
        // If using reordered lines, we need to map diff indices back to original lines
        const mapIndex1 = reorderedLines1 ? createIndexMap(lines1, reorderedLines1) : null;
        const mapIndex2 = reorderedLines2 ? createIndexMap(lines2, reorderedLines2) : null;
        
        // Create a copy of lines2 to track processed lines
        const processedLines2 = new Array(lines2.length).fill(false);
        
        // Process UMR-specific formatting - preserve indentation
        const isUmrFormat = lines1.some(line => line.includes(':ARG')) || 
                           lines2.some(line => line.includes(':ARG'));
        
        // Generate HTML for the first document (keeping original order)
        for (let i = 0; i < lines1.length; i++) {
            // Get the original line text
            const originalLine = lines1[i];
            
            // Count leading spaces to preserve indentation
            const leadingWhitespace = originalLine.match(/^(\s*)/)[0];
            const contentWithoutLeadingWhitespace = originalLine.substring(leadingWhitespace.length);
            
            // Create a span for indentation with the exact number of spaces
            let indentHtml = '';
            if (leadingWhitespace.length > 0) {
                indentHtml = `<span class="umr-indentation">${'&nbsp;'.repeat(leadingWhitespace.length)}</span>`;
            }
            
            // If using reordered lines, map the index
            const diffIndex = mapIndex1 ? mapIndex1.get(i) ?? i : i;
            
            if (diffs.removed.has(diffIndex)) {
                // Line was removed
                html1 += `<div class="diff-line removed">${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}</div>`;
            } else if (diffs.changed.has(diffIndex)) {
                // Line was changed
                const j = diffs.changed.get(diffIndex);
                html1 += `<div class="diff-line changed">${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}</div>`;
                
                // Mark the corresponding line in document 2 as processed
                if (mapIndex2 && j !== undefined) {
                    const originalJ = mapIndex2.get(j) ?? j;
                    if (originalJ >= 0 && originalJ < lines2.length) {
                        processedLines2[originalJ] = true;
                    }
                } else if (j >= 0 && j < lines2.length) {
                    processedLines2[j] = true;
                }
            } else {
                // Line is unchanged
                html1 += `<div class="diff-line">${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}</div>`;
                
                // Find the corresponding line in document 2 if not using reordered indexes
                if (!mapIndex2) {
                    for (let j = 0; j < lines2.length; j++) {
                        if (!processedLines2[j] && lines1[i].trim() === lines2[j].trim()) {
                            processedLines2[j] = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // Generate HTML for the second document (keeping original order)
        for (let j = 0; j < lines2.length; j++) {
            // Get the original line text
            const originalLine = lines2[j];
            
            // Count leading spaces to preserve indentation
            const leadingWhitespace = originalLine.match(/^(\s*)/)[0];
            const contentWithoutLeadingWhitespace = originalLine.substring(leadingWhitespace.length);
            
            // Create a span for indentation with the exact number of spaces
            let indentHtml = '';
            if (leadingWhitespace.length > 0) {
                indentHtml = `<span class="umr-indentation">${'&nbsp;'.repeat(leadingWhitespace.length)}</span>`;
            }
            
            // If using reordered lines, map the index
            const diffIndex = mapIndex2 ? mapIndex2.get(j) ?? j : j;
            
            if (diffs.added.has(diffIndex)) {
                // Line was added
                html2 += `<div class="diff-line added">${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}</div>`;
            } else if (Array.from(diffs.changed.values()).includes(diffIndex)) {
                // Line was changed
                html2 += `<div class="diff-line changed">${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}</div>`;
            } else {
                // Line is unchanged
                html2 += `<div class="diff-line">${indentHtml}${escapeHtml(contentWithoutLeadingWhitespace)}</div>`;
            }
        }
        
        // Update the content of the elements
        if (html1) elem1.innerHTML = html1;
        if (html2) elem2.innerHTML = html2;
        
        console.log('Successfully applied highlighting');
    } catch (error) {
        console.error('Error applying git-style highlighting:', error);
    }
}

/**
 * Create a mapping between original line indices and reordered line indices
 */
function createIndexMap(originalLines, reorderedLines) {
    const map = new Map();
    
    // For each line in the original order, find its position in the reordered array
    for (let i = 0; i < originalLines.length; i++) {
        const line = originalLines[i];
        const reorderedIndex = reorderedLines.findIndex(l => l === line);
        if (reorderedIndex !== -1) {
            map.set(i, reorderedIndex);
        }
    }
    
    return map;
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