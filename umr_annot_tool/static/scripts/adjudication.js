/**
 * Adjudication.js
 * Handles the comparison of UMR trees in adjudication view
 */

document.addEventListener('DOMContentLoaded', function() {
    // Debug information for document types
    console.log('Document state:', window.state);
    
    // Check document owner elements
    const doc1Owner = document.querySelector('#doc1-column .doc-owner');
    const doc2Owner = document.querySelector('#doc2-column .doc-owner');
    console.log('Doc1 owner text:', doc1Owner ? doc1Owner.textContent.trim() : 'Not found');
    console.log('Doc2 owner text:', doc2Owner ? doc2Owner.textContent.trim() : 'Not found');
    
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
            window.location.href = `/adjudication/${window.state.docVersion1Id}/${window.state.docVersion2Id}/${window.state.currentSentId - 1}`;
        }
    });
    
    nextBtn.addEventListener('click', function() {
        if (window.state.currentSentId < window.state.maxSentId) {
            window.location.href = `/adjudication/${window.state.docVersion1Id}/${window.state.docVersion2Id}/${window.state.currentSentId + 1}`;
        }
    });
    
    // Start the comparison process
    initializeComparison();
});

/**
 * Initialize the comparison of the two annotations
 */
function initializeComparison() {
    // Get the annotation containers
    const doc1SentElem = document.getElementById('doc1-sent-annotation').querySelector('pre');
    const doc2SentElem = document.getElementById('doc2-sent-annotation').querySelector('pre');
    const doc1DocElem = document.getElementById('doc1-doc-annotation').querySelector('pre');
    const doc2DocElem = document.getElementById('doc2-doc-annotation').querySelector('pre');
    
    // Highlight differences for sentence level annotations
    highlightDifferences(doc1SentElem, doc2SentElem, 'sent');
    
    // Highlight differences for document level annotations
    highlightDifferences(doc1DocElem, doc2DocElem, 'doc');
}

/**
 * Highlights differences between two annotation trees
 * @param {HTMLElement} elem1 - First annotation element
 * @param {HTMLElement} elem2 - Second annotation element
 * @param {string} type - Type of annotation ('sent' or 'doc')
 */
function highlightDifferences(elem1, elem2, type) {
    // Parse the text content into lines
    const lines1 = elem1.textContent.split('\n');
    const lines2 = elem2.textContent.split('\n');
    
    // Parse the UMR trees
    const tree1 = parseUmrTree(lines1);
    const tree2 = parseUmrTree(lines2);
    
    // Find differences between trees
    const diffs = findDifferences(tree1, tree2);
    
    // Apply highlighting to both trees
    elem1.innerHTML = applyHighlighting(lines1, diffs, 'left');
    elem2.innerHTML = applyHighlighting(lines2, diffs, 'right');
}

/**
 * Parse a UMR tree from text lines
 * @param {string[]} lines - Array of text lines representing the UMR
 * @returns {Object} Parsed tree structure
 */
function parseUmrTree(lines) {
    // This is a simplified parser - a production version would need to be more robust
    const tree = { nodes: [], edges: [], attributes: {} };
    const nodeStack = [];
    let currentNode = null;
    
    lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();
        
        // Track the original line number for highlighting
        const lineInfo = { text: line, lineNumber: lineIndex };
        
        if (trimmedLine.startsWith('(')) {
            // New node
            const nodeName = trimmedLine.match(/\(([^)]+)/)?.[1]?.trim();
            
            if (nodeName) {
                currentNode = { 
                    id: `node_${tree.nodes.length}`,
                    name: nodeName, 
                    attributes: {},
                    children: [],
                    lineInfo: lineInfo
                };
                
                tree.nodes.push(currentNode);
                
                if (nodeStack.length > 0) {
                    // Add edge from parent to this node
                    const parent = nodeStack[nodeStack.length - 1];
                    parent.children.push(currentNode.id);
                    
                    tree.edges.push({
                        from: parent.id,
                        to: currentNode.id,
                        type: 'child'
                    });
                }
                
                nodeStack.push(currentNode);
            }
        } else if (trimmedLine === ')') {
            // End of node
            if (nodeStack.length > 0) {
                nodeStack.pop();
                if (nodeStack.length > 0) {
                    currentNode = nodeStack[nodeStack.length - 1];
                } else {
                    currentNode = null;
                }
            }
        } else if (trimmedLine.includes(':')) {
            // Attribute
            const parts = trimmedLine.split(':');
            if (parts.length >= 2 && currentNode) {
                const attrName = parts[0].trim();
                const attrValue = parts.slice(1).join(':').trim();
                
                currentNode.attributes[attrName] = {
                    value: attrValue,
                    lineInfo: lineInfo
                };
            }
        }
    });
    
    return tree;
}

/**
 * Find differences between two parsed UMR trees
 * @param {Object} tree1 - First parsed tree
 * @param {Object} tree2 - Second parsed tree
 * @returns {Array} List of difference objects
 */
function findDifferences(tree1, tree2) {
    const diffs = [];
    
    // Compare nodes
    const nodeMap1 = tree1.nodes.reduce((map, node) => {
        map[node.name] = node;
        return map;
    }, {});
    
    const nodeMap2 = tree2.nodes.reduce((map, node) => {
        map[node.name] = node;
        return map;
    }, {});
    
    // Find nodes that exist in tree1 but not in tree2
    tree1.nodes.forEach(node => {
        if (!nodeMap2[node.name]) {
            diffs.push({
                type: 'remove',
                location: 'node',
                line1: node.lineInfo.lineNumber,
                line2: -1,
                content: `Node ${node.name} only in first tree`
            });
        }
    });
    
    // Find nodes that exist in tree2 but not in tree1
    tree2.nodes.forEach(node => {
        if (!nodeMap1[node.name]) {
            diffs.push({
                type: 'add',
                location: 'node',
                line1: -1, 
                line2: node.lineInfo.lineNumber,
                content: `Node ${node.name} only in second tree`
            });
        }
    });
    
    // Compare attributes of matching nodes
    Object.keys(nodeMap1).forEach(nodeName => {
        if (nodeMap2[nodeName]) {
            const node1 = nodeMap1[nodeName];
            const node2 = nodeMap2[nodeName];
            
            // Compare attributes
            Object.keys(node1.attributes).forEach(attrName => {
                const attr1 = node1.attributes[attrName];
                
                if (!node2.attributes[attrName]) {
                    // Attribute exists in node1 but not in node2
                    diffs.push({
                        type: 'remove',
                        location: 'attribute',
                        line1: attr1.lineInfo.lineNumber,
                        line2: -1,
                        content: `Attribute ${attrName} missing from second tree`
                    });
                } else if (node2.attributes[attrName].value !== attr1.value) {
                    // Attribute values differ
                    diffs.push({
                        type: 'change',
                        location: 'attribute',
                        line1: attr1.lineInfo.lineNumber,
                        line2: node2.attributes[attrName].lineInfo.lineNumber,
                        content: `Different values for attribute ${attrName}`
                    });
                }
            });
            
            // Check for attributes in node2 that aren't in node1
            Object.keys(node2.attributes).forEach(attrName => {
                if (!node1.attributes[attrName]) {
                    diffs.push({
                        type: 'add',
                        location: 'attribute',
                        line1: -1,
                        line2: node2.attributes[attrName].lineInfo.lineNumber,
                        content: `Attribute ${attrName} only in second tree`
                    });
                }
            });
        }
    });
    
    return diffs;
}

/**
 * Apply highlighting to the tree text based on found differences
 * @param {string[]} lines - Original lines of text
 * @param {Array} diffs - Array of found differences
 * @param {string} side - 'left' or 'right' indicating which tree we're highlighting
 * @returns {string} HTML with highlighting applied
 */
function applyHighlighting(lines, diffs, side) {
    const highlightedLines = [...lines];
    
    // Apply highlights based on diff type
    diffs.forEach(diff => {
        const lineIndex = side === 'left' ? diff.line1 : diff.line2;
        
        if (lineIndex >= 0) {
            const line = highlightedLines[lineIndex];
            
            let cssClass = '';
            if (diff.type === 'change') {
                cssClass = 'highlight-change';
            } else if (diff.type === 'add' && side === 'right') {
                cssClass = 'highlight-add';
            } else if (diff.type === 'remove' && side === 'left') {
                cssClass = 'highlight-remove';
            }
            
            if (cssClass) {
                highlightedLines[lineIndex] = `<span class="${cssClass}" title="${diff.content}">${line}</span>`;
            }
        }
    });
    
    return highlightedLines.join('\n');
}

/**
 * Creates a legend explaining the highlighting colors
 */
function createLegend() {
    const legend = document.createElement('div');
    legend.className = 'highlight-legend';
    legend.innerHTML = `
        <div class="legend-item">
            <span class="legend-color" style="background-color: #d4edda;"></span>
            <span class="legend-label">Added in right document</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #f8d7da;"></span>
            <span class="legend-label">Removed from left document</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #fff3cd;"></span>
            <span class="legend-label">Changed between documents</span>
        </div>
    `;
    
    // Insert legend into the document
    const container = document.querySelector('.navigation-bar');
    container.appendChild(legend);
} 