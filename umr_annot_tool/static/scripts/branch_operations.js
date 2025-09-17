/**
 * Clean implementation of branch operations for UMR/AMR annotations
 * Handles: Add, Delete, and Move operations on annotation branches
 *
 * Key principles:
 * 1. Each branch is identified by its visual position in the DOM, not just text matching
 * 2. Parenthesis matching uses strict depth counting
 * 3. Operations preserve the structure of surrounding branches
 */

(function() {
    'use strict';

    console.log('Loading clean branch operations implementation...');

    /**
     * Find the exact position of a clicked relation span in the annotation text
     */
    function findExactBranchPosition(relationSpan, annotationElement) {
        const fullText = annotationElement.textContent;
        const relationText = relationSpan.textContent;

        // Get the cumulative text position by walking through the DOM
        let position = 0;
        let found = false;

        // Walk through all text nodes to find our span's position
        const walker = document.createTreeWalker(
            annotationElement,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let textNode;
        while (textNode = walker.nextNode()) {
            // Check if this text node is within our target span
            if (relationSpan.contains(textNode)) {
                found = true;
                break;
            }
            position += textNode.textContent.length;
        }

        if (!found) {
            console.error('Could not find relation span position');
            return null;
        }

        console.log(`Found relation "${relationText}" at position ${position}`);
        return position;
    }

    /**
     * Extract a branch starting from a given position
     */
    function extractBranch(fullText, startPos, relationText) {
        console.log(`\n=== Extracting branch for relation: "${relationText}" ===`);

        // Find where the relation ends and the value begins
        let valueStart = startPos + relationText.length;

        // Skip whitespace
        while (valueStart < fullText.length && /\s/.test(fullText[valueStart])) {
            valueStart++;
        }

        if (valueStart >= fullText.length) {
            return null;
        }

        // Find the start including indentation to beginning of line
        let branchStart = startPos;
        while (branchStart > 0 && fullText[branchStart - 1] !== '\n') {
            branchStart--;
        }

        // Get the original line's indentation
        let origIndent = 0;
        let k = branchStart;
        while (k < fullText.length && fullText[k] === ' ') {
            origIndent++;
            k++;
        }
        console.log(`Original indentation: ${origIndent} spaces`);

        // For a branch with nested structure, we need to include ALL nested content
        // until we hit something at the same or lesser indentation level
        let branchEnd = valueStart;
        let depth = 0;

        // Check if the value starts with a parenthesis
        if (fullText[valueStart] === '(') {
            // This is a complex value - we need to track parentheses
            depth = 1;
            console.log('Complex branch detected (starts with parenthesis)');

            // Find the end by balancing parentheses and checking indentation
            for (let i = valueStart + 1; i < fullText.length; i++) {
                if (fullText[i] === '(') {
                    depth++;
                } else if (fullText[i] === ')') {
                    depth--;
                    if (depth === 0) {
                        branchEnd = i + 1;
                        console.log(`Found closing paren at position ${i}, depth now 0`);

                        // Check if there's content after the closing paren that belongs to this branch
                        // This handles cases like:
                        // :why (s3a / and
                        //     :aspect habitual)  <-- closing paren here but branch might continue

                        // Look for the next line
                        let nextLineStart = i + 1;
                        while (nextLineStart < fullText.length && fullText[nextLineStart] !== '\n') {
                            nextLineStart++;
                        }

                        if (nextLineStart < fullText.length) {
                            nextLineStart++; // Move past the newline

                            // Count indentation of next line
                            let nextIndent = 0;
                            let j = nextLineStart;
                            while (j < fullText.length && fullText[j] === ' ') {
                                nextIndent++;
                                j++;
                            }

                            // If the next line is more indented than our original line,
                            // it's still part of this branch
                            if (nextIndent > origIndent && j < fullText.length) {
                                console.log(`Next line at indent ${nextIndent} > ${origIndent}, continuing...`);
                                continue; // Keep scanning
                            } else {
                                // We're done - next line is at same or less indentation
                                console.log(`Next line at indent ${nextIndent} <= ${origIndent}, stopping`);
                                break;
                            }
                        }
                        break; // End of text
                    }
                } else if (fullText[i] === '\n' && depth > 0) {
                    // We're in the middle of a parenthetical structure
                    // Continue to include everything until parentheses are balanced
                    continue;
                }
            }

            // If we still have unbalanced parens, continue until we balance them
            if (depth > 0) {
                console.log(`Still ${depth} unclosed parens, continuing search...`);
                for (let i = branchEnd; i < fullText.length; i++) {
                    if (fullText[i] === ')') {
                        depth--;
                        if (depth === 0) {
                            branchEnd = i + 1;
                            console.log(`Finally balanced at position ${i}`);
                            break;
                        }
                    } else if (fullText[i] === '(') {
                        depth++;
                    }
                }
            }
        } else {
            // Simple value - find where it ends based on indentation
            console.log('Simple branch detected');
            branchEnd = findSimpleBranchEnd(fullText, valueStart);
        }

        const result = {
            start: branchStart,
            end: branchEnd,
            text: fullText.substring(branchStart, branchEnd)
        };

        console.log(`Branch extracted: start=${result.start}, end=${result.end}`);
        console.log(`Branch content: "${result.text}"`);

        return result;
    }

    /**
     * Find matching closing parenthesis using depth counting
     */
    function findMatchingParen(text, openPos) {
        let depth = 1;
        let pos = openPos + 1;

        while (pos < text.length && depth > 0) {
            if (text[pos] === '(') {
                depth++;
            } else if (text[pos] === ')') {
                depth--;
                if (depth === 0) {
                    return pos;
                }
            }
            pos++;
        }

        return -1; // No match found
    }

    /**
     * Find the end of a simple branch (no parentheses)
     */
    function findSimpleBranchEnd(text, valueStart) {
        let pos = valueStart;

        while (pos < text.length) {
            // Stop at next relation (: preceded by whitespace)
            if (text[pos] === ':' && pos > valueStart && /\s/.test(text[pos - 1])) {
                break;
            }

            // Stop at end of line if next non-whitespace is a relation
            if (text[pos] === '\n') {
                let nextNonWhite = pos + 1;
                while (nextNonWhite < text.length && /\s/.test(text[nextNonWhite])) {
                    nextNonWhite++;
                }
                if (nextNonWhite < text.length && text[nextNonWhite] === ':') {
                    break;
                }
            }

            pos++;
        }

        // Trim trailing whitespace
        while (pos > valueStart && /\s/.test(text[pos - 1])) {
            pos--;
        }

        return pos;
    }

    /**
     * Delete a branch
     */
    window.deleteBranch = function(relationSpan) {
        console.log('=== DELETE BRANCH ===');

        const annotationElement = document.querySelector('#amr pre');
        if (!annotationElement) {
            console.error('Annotation element not found');
            return;
        }

        const fullText = annotationElement.textContent;
        const relationText = relationSpan.textContent;

        // Find exact position of this branch
        const position = findExactBranchPosition(relationSpan, annotationElement);
        if (position === null) {
            showNotification('Error: Could not locate branch', 'error');
            return;
        }

        // Extract the branch
        const branch = extractBranch(fullText, position, relationText);
        if (!branch) {
            showNotification('Error: Could not extract branch', 'error');
            return;
        }

        console.log(`Deleting branch from ${branch.start} to ${branch.end}`);
        console.log(`Branch text: "${branch.text}"`);
        console.log(`Branch length: ${branch.text.length} characters`);

        // Check if we need to remove a trailing newline
        let deleteStart = branch.start;
        let deleteEnd = branch.end;

        // If the branch ends with a newline, include it in deletion
        if (deleteEnd < fullText.length && fullText[deleteEnd] === '\n') {
            deleteEnd++;
            console.log('Including trailing newline in deletion');
        }
        // Otherwise, if the branch starts at the beginning of a line and there's a newline before it, remove that
        else if (deleteStart > 0 && fullText[deleteStart - 1] === '\n') {
            deleteStart--;
            console.log('Including leading newline in deletion');
        }

        // Delete the branch
        const updatedText = fullText.substring(0, deleteStart) + fullText.substring(deleteEnd);

        // Update the annotation
        annotationElement.textContent = updatedText;

        // Re-initialize interactive elements
        if (typeof makeRelationsClickable === 'function') {
            makeRelationsClickable(annotationElement);
        }
        if (typeof makeValuesClickable === 'function') {
            makeValuesClickable(annotationElement);
        }
        if (typeof makeVariablesClickable === 'function') {
            makeVariablesClickable(annotationElement);
        }
        if (typeof addBranchOperations === 'function') {
            addBranchOperations(annotationElement);
        }

        // Save the deletion
        if (typeof saveBranchDeletion === 'function') {
            saveBranchDeletion(updatedText, relationText);
        }

        showNotification(`Deleted branch: ${relationText}`, 'success');
    };

    /**
     * Move a branch
     */
    window.moveBranch = function(relationSpan, targetVariable) {
        console.log('=== MOVE BRANCH ===');

        const annotationElement = document.querySelector('#amr pre');
        if (!annotationElement) {
            console.error('Annotation element not found');
            return;
        }

        const fullText = annotationElement.textContent;
        const relationText = relationSpan.textContent;

        // Find exact position of this branch
        const position = findExactBranchPosition(relationSpan, annotationElement);
        if (position === null) {
            showNotification('Error: Could not locate branch', 'error');
            return;
        }

        // Extract the branch
        const branch = extractBranch(fullText, position, relationText);
        if (!branch) {
            showNotification('Error: Could not extract branch', 'error');
            return;
        }

        console.log(`Moving branch from position ${branch.start} to ${branch.end}`);
        console.log(`Branch text to move: "${branch.text}"`);
        console.log(`Branch text length: ${branch.text.length}`);

        // Remove the branch from its current location
        let textAfterRemoval = fullText.substring(0, branch.start) + fullText.substring(branch.end);

        // Find the target variable position
        const targetPos = textAfterRemoval.indexOf(targetVariable);
        if (targetPos === -1) {
            showNotification('Error: Target variable not found', 'error');
            return;
        }

        // Find where to insert (after the variable and its concept)
        let insertPos = targetPos + targetVariable.length;

        // Skip past the concept (e.g., "/ concept-name")
        while (insertPos < textAfterRemoval.length && textAfterRemoval[insertPos] !== '\n') {
            if (textAfterRemoval[insertPos] === '(') {
                // Stop if we hit a nested structure
                break;
            }
            insertPos++;
        }

        // Prepare the branch text with proper indentation
        const targetLine = textAfterRemoval.lastIndexOf('\n', targetPos) + 1;
        const targetIndent = targetPos - targetLine;
        const branchIndent = '    '; // Standard 4-space indent for nested content

        // Add proper indentation to the branch
        const indentedBranch = '\n' + ' '.repeat(targetIndent + 4) + branch.text.trim();

        // Insert the branch at the new location
        const finalText = textAfterRemoval.substring(0, insertPos) +
                         indentedBranch +
                         textAfterRemoval.substring(insertPos);

        // Update the annotation
        annotationElement.textContent = finalText;

        // Re-initialize interactive elements
        if (typeof makeRelationsClickable === 'function') {
            makeRelationsClickable(annotationElement);
        }
        if (typeof makeValuesClickable === 'function') {
            makeValuesClickable(annotationElement);
        }
        if (typeof makeVariablesClickable === 'function') {
            makeVariablesClickable(annotationElement);
        }
        if (typeof addBranchOperations === 'function') {
            addBranchOperations(annotationElement);
        }

        // Save the move
        if (typeof saveBranchMove === 'function') {
            saveBranchMove(finalText, relationText, targetVariable);
        }

        showNotification(`Moved ${relationText} to ${targetVariable}`, 'success');
    };

    /**
     * Override the extractBranchFromRelation function used by move dialog
     */
    window.extractBranchFromRelation = function(relationSpan, annotationElement) {
        const fullText = annotationElement.textContent;
        const relationText = relationSpan.textContent;

        const position = findExactBranchPosition(relationSpan, annotationElement);
        if (position === null) return null;

        const branch = extractBranch(fullText, position, relationText);
        if (!branch) return null;

        // Return in the expected format
        return {
            branchText: branch.text,
            relationText: relationText,
            branchStart: branch.start,
            branchEnd: branch.end,
            parentIndent: 0,
            extraClosingParens: 0,
            balancedParentheses: true
        };
    };

    console.log('Clean branch operations loaded successfully');

})();