// UMR Command Line Interface for Branch Operations
(function() {
    'use strict';

    // Command Line UI State
    const commandState = {
        history: [],
        historyIndex: -1,
        isVisible: false,
        suggestions: []
    };

    // Available commands
    const commands = {
        help: {
            description: 'Show available commands',
            usage: 'help',
            execute: showHelp
        },
        add: {
            description: 'Add a branch to a node',
            usage: 'add <relation> <target> to <variable>',
            examples: [
                'add :ARG0 x_1 to s1b  # Add first token as ARG0',
                'add :ARG1 x_3 to s1b  # Add third token as ARG1',
                'add :ARG0 individual-person to s1b  # Add abstract concept',
                'add :polarity - to s1b  # Add predefined value',
                'add :op1 "hello" to s1b  # Add string value',
                'add :quant 5 to s1b  # Add numeric value'
            ],
            execute: executeAdd
        },
        delete: {
            description: 'Delete a branch',
            usage: 'delete <relation> from <variable>',
            example: 'delete :ARG1 from s1',
            execute: executeDelete
        },
        move: {
            description: 'Move a branch to another node',
            usage: 'move <relation> from <source> to <target>',
            example: 'move :ARG1 from s1 to s2',
            execute: executeMove
        },
        show: {
            description: 'Show branches of a node',
            usage: 'show <variable>',
            example: 'show s1',
            execute: executeShow
        },
        list: {
            description: 'List all variables/nodes',
            usage: 'list',
            execute: executeList
        },
        clear: {
            description: 'Clear command output',
            usage: 'clear',
            execute: executeClear
        }
    };

    // Initialize command line interface
    function initCommandLine() {
        // Create command line UI if it doesn't exist
        if (!document.getElementById('umr-command-line')) {
            createCommandLineUI();
        }

        // Set up event listeners
        setupEventListeners();

        // Make functions globally available
        window.umrCommandLine = {
            toggle: toggleCommandLine,
            execute: executeCommand,
            show: () => setCommandLineVisibility(true),
            hide: () => setCommandLineVisibility(false)
        };
    }

    // Create the command line UI elements
    function createCommandLineUI() {
        // Find the annotation preview card
        const annotationCard = document.querySelector('#amr').closest('.card');
        if (!annotationCard) {
            console.error('Could not find annotation card');
            return;
        }

        // Check if we need to create a wrapper for side-by-side layout
        let wrapperContainer = document.getElementById('umr-annotation-wrapper');

        if (!wrapperContainer) {
            // Create a wrapper div for the annotation and command line
            wrapperContainer = document.createElement('div');
            wrapperContainer.id = 'umr-annotation-wrapper';
            wrapperContainer.className = 'row';

            // Move the annotation card into the wrapper (left column)
            const annotationCol = document.createElement('div');
            annotationCol.id = 'umr-annotation-col';
            annotationCol.className = 'col-lg-7 col-md-12';

            // Insert wrapper where annotation card currently is
            annotationCard.parentNode.insertBefore(wrapperContainer, annotationCard);

            // Move annotation card into left column
            annotationCol.appendChild(annotationCard);
            wrapperContainer.appendChild(annotationCol);
        }

        // Create command line container (right column)
        const commandLineCol = document.createElement('div');
        commandLineCol.id = 'umr-command-line-col';
        commandLineCol.className = 'col-lg-5 col-md-12';
        commandLineCol.style.display = 'none';
        commandLineCol.style.paddingTop = '80px';  // Add padding to push content down

        const commandLineContainer = document.createElement('div');
        commandLineContainer.id = 'umr-command-line-container';
        commandLineContainer.className = 'card';
        commandLineContainer.style.height = 'calc(100% - 80px)';  // Adjust height for padding
        commandLineContainer.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">
                    <i class="fas fa-terminal"></i> Command Line Interface
                </h6>
                <button class="btn btn-sm btn-outline-danger" onclick="umrCommandLine.hide()" title="Close Command Line" style="padding: 2px 8px;">
                    <span style="font-weight: bold; font-size: 18px; line-height: 1;">×</span>
                </button>
            </div>
            <div class="card-body d-flex flex-column">
                <div class="command-output-container mb-3 flex-grow-1">
                    <div id="command-output" class="command-output"></div>
                </div>
                <div class="input-group">
                    <span class="input-group-text">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                    <input
                        type="text"
                        id="command-input"
                        class="form-control"
                        placeholder="Type a command (e.g., 'help' to see available commands)"
                        autocomplete="off"
                    >
                    <button class="btn btn-primary" id="command-submit">
                        Execute
                    </button>
                </div>
                <div id="command-suggestions" class="command-suggestions mt-2"></div>
            </div>
        `;

        commandLineCol.appendChild(commandLineContainer);
        wrapperContainer.appendChild(commandLineCol);

        // Add styles
        addCommandLineStyles();

        // Add toggle button to the annotation header
        const annotationHeader = annotationCard.querySelector('.card-header .btn-group');
        if (annotationHeader) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn btn-sm btn-outline-info me-2';
            toggleBtn.innerHTML = '<i class="fas fa-terminal"></i> Command';
            toggleBtn.title = 'Toggle command line interface';
            toggleBtn.onclick = toggleCommandLine;

            // Insert before the first button in the group
            const firstButton = annotationHeader.querySelector('button');
            if (firstButton) {
                annotationHeader.insertBefore(toggleBtn, firstButton);
            } else {
                annotationHeader.appendChild(toggleBtn);
            }
        }
    }

    // Add CSS styles for command line
    function addCommandLineStyles() {
        if (document.getElementById('umr-command-line-styles')) return;

        const style = document.createElement('style');
        style.id = 'umr-command-line-styles';
        style.textContent = `
            .command-output-container {
                background-color: #1e1e1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 10px;
                height: 400px;
                min-height: 300px;
                max-height: calc(100vh - 350px);
                overflow-y: auto;
            }

            #umr-command-line-container {
                display: flex;
                flex-direction: column;
                height: calc(100vh - 200px);
                max-height: 600px;
            }

            #umr-command-line-container .card-body {
                overflow: hidden;
            }

            .command-output {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                color: #d4d4d4;
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .command-output .command-line {
                color: #569cd6;
                margin-bottom: 5px;
            }

            .command-output .success {
                color: #4ec9b0;
            }

            .command-output .error {
                color: #f48771;
            }

            .command-output .warning {
                color: #dcdcaa;
            }

            .command-output .info {
                color: #9cdcfe;
            }

            .command-output .help-header {
                color: #c586c0;
                font-weight: bold;
                margin-top: 10px;
                margin-bottom: 5px;
            }

            .command-output .help-command {
                color: #569cd6;
                font-weight: bold;
            }

            .command-suggestions {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 5px;
                display: none;
            }

            .command-suggestions.show {
                display: block;
            }

            .command-suggestion {
                padding: 5px 10px;
                cursor: pointer;
                border-radius: 3px;
            }

            .command-suggestion:hover {
                background: #e9ecef;
            }

            .command-suggestion .cmd {
                font-family: monospace;
                font-weight: bold;
                color: #0066cc;
            }

            .command-suggestion .desc {
                font-size: 0.9em;
                color: #666;
                margin-left: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    // Set up event listeners
    function setupEventListeners() {
        const input = document.getElementById('command-input');
        const submitBtn = document.getElementById('command-submit');

        if (!input || !submitBtn) return;

        // Submit on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                executeCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateHistory(1);
            }
        });

        // Auto-suggest as user types
        input.addEventListener('input', showSuggestions);

        // Submit button click
        submitBtn.addEventListener('click', executeCommand);
    }

    // Toggle command line visibility
    function toggleCommandLine() {
        setCommandLineVisibility(!commandState.isVisible);
    }

    // Set command line visibility
    function setCommandLineVisibility(visible) {
        const commandLineCol = document.getElementById('umr-command-line-col');
        const annotationCol = document.getElementById('umr-annotation-col');

        if (commandLineCol) {
            commandLineCol.style.display = visible ? 'block' : 'none';
            commandState.isVisible = visible;

            // Adjust the annotation column width when toggling command line
            if (annotationCol) {
                if (visible) {
                    annotationCol.className = 'col-lg-7 col-md-12';
                } else {
                    annotationCol.className = 'col-lg-12';
                }
            }

            if (visible) {
                const input = document.getElementById('command-input');
                if (input) {
                    setTimeout(() => input.focus(), 100); // Small delay to ensure DOM is ready
                }
            }
        }
    }

    // Navigate command history
    function navigateHistory(direction) {
        const input = document.getElementById('command-input');
        if (!input || commandState.history.length === 0) return;

        commandState.historyIndex += direction;

        // Clamp to valid range
        commandState.historyIndex = Math.max(0,
            Math.min(commandState.history.length - 1, commandState.historyIndex));

        input.value = commandState.history[commandState.historyIndex] || '';
    }

    // Show command suggestions
    function showSuggestions() {
        const input = document.getElementById('command-input');
        const suggestionsDiv = document.getElementById('command-suggestions');

        if (!input || !suggestionsDiv) return;

        const value = input.value.trim().toLowerCase();

        if (!value) {
            suggestionsDiv.classList.remove('show');
            return;
        }

        // Find matching commands
        const matches = Object.entries(commands).filter(([cmd, info]) =>
            cmd.startsWith(value) || info.description.toLowerCase().includes(value)
        );

        if (matches.length === 0) {
            suggestionsDiv.classList.remove('show');
            return;
        }

        // Build suggestions HTML
        suggestionsDiv.innerHTML = matches.map(([cmd, info]) => `
            <div class="command-suggestion" onclick="document.getElementById('command-input').value='${cmd}'; document.getElementById('command-suggestions').classList.remove('show');">
                <span class="cmd">${cmd}</span>
                <span class="desc">${info.description}</span>
            </div>
        `).join('');

        suggestionsDiv.classList.add('show');
    }

    // Execute command
    function executeCommand() {
        const input = document.getElementById('command-input');
        if (!input) return;

        const commandLine = input.value.trim();
        if (!commandLine) return;

        // Add to history
        commandState.history.push(commandLine);
        commandState.historyIndex = commandState.history.length;

        // Clear suggestions
        const suggestionsDiv = document.getElementById('command-suggestions');
        if (suggestionsDiv) suggestionsDiv.classList.remove('show');

        // Display command in output
        addOutput(`> ${commandLine}`, 'command-line');

        // Parse and execute
        const parts = commandLine.split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (commands[cmd]) {
            try {
                commands[cmd].execute(parts.slice(1));
            } catch (error) {
                addOutput(`Error: ${error.message}`, 'error');
            }
        } else {
            addOutput(`Unknown command: ${cmd}. Type 'help' for available commands.`, 'error');
        }

        // Clear input
        input.value = '';
    }

    // Add output to command line display
    function addOutput(text, className = '') {
        const output = document.getElementById('command-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = className;
        line.textContent = text;
        output.appendChild(line);

        // Scroll to bottom
        output.parentElement.scrollTop = output.parentElement.scrollHeight;
    }

    // Command implementations
    function showHelp() {
        addOutput('Available Commands:', 'help-header');

        Object.entries(commands).forEach(([cmd, info]) => {
            addOutput(`  ${cmd}`, 'help-command');
            addOutput(`    ${info.description}`, 'info');
            addOutput(`    Usage: ${info.usage}`, 'info');

            // Handle both single example and multiple examples
            if (info.example) {
                addOutput(`    Example: ${info.example}`, 'info');
            }
            if (info.examples) {
                if (info.examples.length === 1) {
                    addOutput(`    Example: ${info.examples[0]}`, 'info');
                } else {
                    addOutput(`    Examples:`, 'info');
                    info.examples.forEach(ex => {
                        addOutput(`      ${ex}`, 'info');
                    });
                }
            }
        });

        // Add additional notes about the add command
        addOutput('\nNotes for add command:', 'help-header');
        addOutput('  • x_1, x_2, x_3... reference sentence tokens by position', 'info');
        addOutput('  • Abstract concepts create new variables automatically', 'info');
        addOutput('  • Use quotes for string values (e.g., "hello")', 'info');
        addOutput('  • Numbers and predefined values are used directly', 'info');
    }

    function executeAdd(args) {
        // Parse: add :relation target to variable
        const toIndex = args.indexOf('to');
        if (toIndex === -1 || toIndex < 2) {
            addOutput('Error: Invalid syntax. Use: add <relation> <target> to <variable>', 'error');
            return;
        }

        const relation = args[0];
        const target = args.slice(1, toIndex).join(' ');
        const variable = args.slice(toIndex + 1).join(' ');

        if (!relation || !target || !variable) {
            addOutput('Error: Missing required arguments', 'error');
            return;
        }

        try {
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            const annotationText = annotationElement.textContent;
            let branchContent = '';

            // Check if target is a token reference (x_1, x_2, etc.)
            const tokenPattern = /^x_(\d+)$/;
            const tokenMatch = target.match(tokenPattern);

            if (tokenMatch) {
                // Handle sentence token reference
                const tokenIndex = parseInt(tokenMatch[1]) - 1; // Convert to 0-based index

                // Extract sentence tokens
                const sentenceTokens = extractSentenceTokens();

                if (tokenIndex < 0 || tokenIndex >= sentenceTokens.length) {
                    addOutput(`Error: Token index ${tokenMatch[1]} is out of range. Available tokens: 1-${sentenceTokens.length}`, 'error');
                    return;
                }

                const selectedToken = sentenceTokens[tokenIndex];

                // Check if it's a number
                if (!isNaN(selectedToken)) {
                    // Numbers are used directly
                    branchContent = `${relation} ${selectedToken}`;
                } else {
                    // Generate variable for the token
                    const tokenVariable = generateUniqueVariable(selectedToken, annotationText);
                    branchContent = `${relation} (${tokenVariable} / ${selectedToken})`;
                }

                // Trigger alignment for the new variable if needed
                if (typeof addAlignmentIfNeeded === 'function' && tokenVariable) {
                    addAlignmentIfNeeded(tokenVariable, selectedToken);
                }
            } else {
                // Check if it's a predefined value (for relations like :polarity -, :aspect state, etc.)
                const relationsWithValues = {
                    ':aspect': ['habitual', 'generic', 'iterative', 'inceptive', 'imperfective', 'process', 'atelic-process', 'perfective', 'state', 'reversible-state', 'irreversible-state', 'inherent-state', 'point-state', 'activity', 'undirected-activity', 'directed-activity', 'endeavor', 'semelfactive', 'undirected-endeavor', 'directed-endeavor', 'performance', 'incremental-accomplishment', 'nonincremental-accomplishment', 'directed-achievement', 'reversible-directed-achievement', 'irreversible-directed-achievement'],
                    ':degree': ['intensifier', 'downtoner', 'equal'],
                    ':modal-strength': ['full-affirmative', 'partial-affirmative', 'neutral-affirmative', 'neutral-negative', 'partial-negative', 'full-negative'],
                    ':mode': ['imperative', 'interrogative', 'expressive'],
                    ':polarity': ['-', 'umr-unknown', 'truth-value'],
                    ':polite': ['+'],
                    ':refer-number': ['singular', 'non-singular', 'dual', 'paucal', 'plural', 'non-dual-paucal', 'greater-plural', 'trial', 'non-trial-paucal'],
                    ':refer-person': ['1st', '2nd', '3rd', '4th', 'non-3rd', 'non-1st', 'excl', 'incl'],
                    ':refer-definiteness': ['class'],
                    ':axis-relative-polarities': ['left-handed', 'right-handed'],
                    ':framework-type': ['absolute', 'intrinsic', 'relative'],
                    ':anchor-framework-translation': ['rotated', 'reflected']
                };

                // Check if this relation has predefined values and the target is one of them
                const predefinedValues = relationsWithValues[relation];

                if (predefinedValues && (predefinedValues.includes(target) || target === '-' || target === '+')) {
                    // It's a predefined value - use it directly
                    branchContent = `${relation} ${target}`;
                } else if (target.startsWith('"') && target.endsWith('"')) {
                    // It's already a quoted string - use as is
                    branchContent = `${relation} ${target}`;
                } else if (!isNaN(target)) {
                    // It's a number - use directly
                    branchContent = `${relation} ${target}`;
                } else {
                    // It's an abstract concept - create a new variable for it
                    const conceptVariable = generateUniqueVariable(target, annotationText);
                    branchContent = `${relation} (${conceptVariable} / ${target})`;
                }
            }

            // Call the existing addBranchToNode function
            if (typeof addBranchToNode === 'function') {
                addBranchToNode(variable, branchContent);
                addOutput(`Added branch "${branchContent}" to ${variable}`, 'success');

                // Trigger save if needed
                if (typeof saveBranchInsertion === 'function') {
                    saveBranchInsertion(annotationElement.textContent, branchContent);
                }
            } else {
                addOutput('Error: addBranchToNode function not available', 'error');
            }
        } catch (error) {
            addOutput(`Error adding branch: ${error.message}`, 'error');
        }
    }

    // Helper function to generate unique variable names
    function generateUniqueVariable(concept, annotationText) {
        // Extract the sentence number from existing variables (like s1b, s2, etc.)
        const sentenceVarPattern = /\bs(\d+)[a-z]*/g;
        const sentenceVars = annotationText.match(sentenceVarPattern) || [];

        // Find the sentence number (default to 1 if not found)
        let sentenceNum = 1;
        if (sentenceVars.length > 0) {
            // Extract the number from variables like s1b, s2a, etc.
            const numbers = sentenceVars.map(v => {
                const match = v.match(/s(\d+)/);
                return match ? parseInt(match[1]) : 1;
            });
            // Use the most common sentence number (or the first one)
            sentenceNum = numbers[0] || 1;
        }

        // Determine the suffix based on whether the concept starts with an alphabetic character
        let suffix;
        const firstChar = concept[0];

        if (/[a-zA-Z]/.test(firstChar)) {
            // For alphabetic concepts, use the first letter as suffix
            suffix = firstChar.toLowerCase();
        } else {
            // For non-alphabetic concepts (Chinese, numbers, etc.), use 'x'
            suffix = 'x';
        }

        // Find all existing variables with this sentence number and suffix pattern
        const variablePattern = new RegExp(`\\bs${sentenceNum}${suffix}\\d*\\b`, 'g');
        const existingVars = annotationText.match(variablePattern) || [];

        // Find the next available number for this pattern
        let num = 1;
        let newVar = `s${sentenceNum}${suffix}${num}`;

        // Keep incrementing the number until we find one that's not used
        while (existingVars.includes(newVar)) {
            num++;
            newVar = `s${sentenceNum}${suffix}${num}`;
        }

        // For alphabetic concepts starting with 's', avoid confusion with sentence variables
        if (suffix === 's') {
            // Use a different pattern to avoid conflicts
            newVar = `s${sentenceNum}s${num}`;
            while (existingVars.includes(newVar)) {
                num++;
                newVar = `s${sentenceNum}s${num}`;
            }
        }

        return newVar;
    }

    // Helper function to extract sentence tokens
    function extractSentenceTokens() {
        // Try to get tokens from the sentence display
        const sentenceElement = document.querySelector('.sentence-text') ||
                                document.querySelector('#sentence-display') ||
                                document.querySelector('.current-sentence');

        if (sentenceElement) {
            const text = sentenceElement.textContent || sentenceElement.innerText || '';
            // Split by whitespace and filter out empty strings
            return text.split(/\s+/).filter(token => token.length > 0);
        }

        // Fallback: try to extract from any visible sentence
        const fallbackElement = document.querySelector('[class*="sentence"]');
        if (fallbackElement) {
            const text = fallbackElement.textContent || '';
            return text.split(/\s+/).filter(token => token.length > 0);
        }

        return [];
    }

    function executeDelete(args) {
        // Parse: delete :relation from variable
        const fromIndex = args.indexOf('from');
        if (fromIndex === -1 || fromIndex < 1) {
            addOutput('Error: Invalid syntax. Use: delete <relation> from <variable>', 'error');
            return;
        }

        const relation = args.slice(0, fromIndex).join(' ');
        const variable = args.slice(fromIndex + 1).join(' ');

        if (!relation || !variable) {
            addOutput('Error: Missing required arguments', 'error');
            return;
        }

        try {
            // Find the annotation element
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            // First, ensure relations are clickable
            if (typeof makeRelationsClickable === 'function') {
                makeRelationsClickable(annotationElement);
            }

            // Find the specific relation span under the given variable
            let targetRelationSpan = null;
            const text = annotationElement.textContent;
            const lines = text.split('\n');

            // Find the variable first
            let inVariableScope = false;
            let variableIndent = -1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const currentIndent = line.search(/\S/);

                // Check if this line defines the variable
                const varPattern = new RegExp(`\\(${variable}\\s*/`);
                if (varPattern.test(line)) {
                    inVariableScope = true;
                    variableIndent = currentIndent;
                    continue;
                }

                // If we're in the variable's scope
                if (inVariableScope) {
                    // Check if we've left the variable's scope
                    if (currentIndent <= variableIndent && currentIndent !== -1 && line.trim().startsWith('(')) {
                        break; // We've moved to another variable
                    }

                    // Check if this line contains our relation
                    if (line.includes(relation)) {
                        // Find all relation spans in the annotation element
                        const allRelationSpans = annotationElement.querySelectorAll('.relation-span');

                        // Find the specific span that matches our relation text and is in the right context
                        for (let span of allRelationSpans) {
                            if (span.textContent === relation) {
                                // Check if this span is in the right part of the document
                                // by verifying its position relative to the variable
                                const spanOffset = getTextOffset(annotationElement, span);
                                const lineOffset = text.split('\n').slice(0, i).join('\n').length + i;

                                // If the span is near this line position, it's our target
                                if (Math.abs(spanOffset - lineOffset) < line.length + 10) {
                                    targetRelationSpan = span;
                                    break;
                                }
                            }
                        }

                        if (targetRelationSpan) break;
                    }
                }
            }

            if (!targetRelationSpan) {
                addOutput(`Branch "${relation}" not found for ${variable}`, 'warning');
                return;
            }

            // Use the existing deleteBranch function from relation_editor.js
            if (typeof deleteBranch === 'function') {
                deleteBranch(targetRelationSpan);
                addOutput(`Deleted branch "${relation}" from ${variable}`, 'success');
            } else {
                addOutput('Error: deleteBranch function not available', 'error');
            }
        } catch (error) {
            addOutput(`Error deleting branch: ${error.message}`, 'error');
        }
    }

    // Helper function to get text offset of a span element
    function getTextOffset(container, element) {
        const range = document.createRange();
        range.selectNodeContents(container);
        range.setEndBefore(element);
        return range.toString().length;
    }

    function executeMove(args) {
        // Parse: move :relation from source to target
        const fromIndex = args.indexOf('from');
        const toIndex = args.indexOf('to');

        if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
            addOutput('Error: Invalid syntax. Use: move <relation> from <source> to <target>', 'error');
            return;
        }

        const relation = args.slice(0, fromIndex).join(' ');
        const source = args.slice(fromIndex + 1, toIndex).join(' ');
        const target = args.slice(toIndex + 1).join(' ');

        if (!relation || !source || !target) {
            addOutput('Error: Missing required arguments', 'error');
            return;
        }

        try {
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            // First, ensure relations are clickable to find the right span
            if (typeof makeRelationsClickable === 'function') {
                makeRelationsClickable(annotationElement);
            }

            // Find the specific relation span under the source variable
            const allRelationSpans = annotationElement.querySelectorAll('.relation-span');

            // Find the relation span that belongs to the source variable
            const text = annotationElement.textContent;
            const lines = text.split('\n');
            let targetRelationSpan = null;

            // Try two approaches: first look for inline definition, then look for separate lines
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // First check: Variable definition on the same line as the relation
                // Pattern like: :op2 (s1i3 / individual-person ... ) :ARG0-of
                const inlinePattern = new RegExp(`\\(${source}\\s*/[^)]*\\)`);
                if (inlinePattern.test(line) && line.includes(relation)) {
                    // This line has both the variable definition and the relation
                    for (let span of allRelationSpans) {
                        if (span.textContent === relation) {
                            const spanOffset = getTextOffset(annotationElement, span);
                            const lineOffset = text.split('\n').slice(0, i).join('\n').length + i;

                            if (Math.abs(spanOffset - lineOffset) < line.length + 10) {
                                targetRelationSpan = span;
                                break;
                            }
                        }
                    }
                    if (targetRelationSpan) break;
                }
            }

            // If not found inline, try the original scope-based search
            if (!targetRelationSpan) {
                let inSourceScope = false;
                let sourceIndent = -1;
                let foundOnSameLine = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const currentIndent = line.search(/\S/);

                    // Check if this line defines the source variable
                    const varPattern = new RegExp(`\\(${source}\\s*/`);
                    if (varPattern.test(line)) {
                        inSourceScope = true;
                        sourceIndent = currentIndent;

                        // Also check if the relation is on the same line after the closing paren
                        if (line.includes(relation)) {
                            foundOnSameLine = true;
                            // Find the relation span on this line
                            for (let span of allRelationSpans) {
                                if (span.textContent === relation) {
                                    const spanOffset = getTextOffset(annotationElement, span);
                                    const lineOffset = text.split('\n').slice(0, i).join('\n').length + i;

                                    if (Math.abs(spanOffset - lineOffset) < line.length + 10) {
                                        targetRelationSpan = span;
                                        break;
                                    }
                                }
                            }
                            if (targetRelationSpan) break;
                        }
                        continue;
                    }

                    // If we're in the source's scope and haven't found it on the same line
                    if (inSourceScope && !foundOnSameLine) {
                        // Check if we've left the source's scope
                        if (currentIndent <= sourceIndent && currentIndent !== -1 && line.trim().startsWith('(')) {
                            break; // We've moved to another variable
                        }

                        // Check if this line contains our relation
                        if (line.includes(relation)) {
                            // Find the relation span that corresponds to this line
                            for (let span of allRelationSpans) {
                                if (span.textContent === relation) {
                                    // Verify this span is in the right context
                                    const spanOffset = getTextOffset(annotationElement, span);
                                    const lineOffset = text.split('\n').slice(0, i).join('\n').length + i;

                                    if (Math.abs(spanOffset - lineOffset) < line.length + 10) {
                                        targetRelationSpan = span;
                                        break;
                                    }
                                }
                            }
                            if (targetRelationSpan) break;
                        }
                    }
                }
            }

            if (!targetRelationSpan) {
                addOutput(`Branch "${relation}" not found for ${source}`, 'warning');
                return;
            }

            // Use the existing extractBranchFromRelation function if available
            if (typeof extractBranchFromRelation === 'function') {
                const branchInfo = extractBranchFromRelation(targetRelationSpan, annotationElement);

                if (!branchInfo) {
                    addOutput('Could not extract branch content', 'error');
                    return;
                }

                // Directly call moveBranchToNode without showing dialog
                if (typeof moveBranchToNode === 'function') {
                    moveBranchToNode(branchInfo, target);
                    addOutput(`Moved branch "${relation}" from ${source} to ${target}`, 'success');

                    // Trigger save if needed
                    if (typeof saveBranchMove === 'function') {
                        saveBranchMove(annotationElement.textContent, relation, target);
                    }
                } else {
                    addOutput('Error: moveBranchToNode function not available', 'error');
                }
            } else {
                // Fallback: create branchInfo manually
                const branchInfo = {
                    relation: relation,
                    content: `${relation} ${target}`,  // Simple content
                    sourceVariable: source
                };

                if (typeof moveBranchToNode === 'function') {
                    moveBranchToNode(branchInfo, target);
                    addOutput(`Moved branch "${relation}" from ${source} to ${target}`, 'success');
                } else {
                    addOutput('Error: moveBranchToNode function not available', 'error');
                }
            }
        } catch (error) {
            addOutput(`Error moving branch: ${error.message}`, 'error');
        }
    }

    function executeShow(args) {
        if (args.length === 0) {
            addOutput('Error: Please specify a variable to show', 'error');
            return;
        }

        const variable = args[0];

        try {
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            const text = annotationElement.textContent;
            const lines = text.split('\n');

            // Find lines containing the variable
            const relevantLines = lines.filter(line => {
                const varPattern = new RegExp(`\\b${variable}\\s*/`);
                return varPattern.test(line) || line.includes(`:${variable}`);
            });

            if (relevantLines.length === 0) {
                addOutput(`No branches found for ${variable}`, 'warning');
            } else {
                addOutput(`Branches for ${variable}:`, 'info');
                relevantLines.forEach(line => {
                    addOutput(`  ${line.trim()}`, 'success');
                });
            }
        } catch (error) {
            addOutput(`Error showing branches: ${error.message}`, 'error');
        }
    }

    function executeList() {
        try {
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            const text = annotationElement.textContent;

            // Extract all variables (pattern: variable / concept)
            const varPattern = /\b([a-z]\d*[a-z]?\d*)\s*\//g;
            const variables = new Set();
            let match;

            while ((match = varPattern.exec(text)) !== null) {
                variables.add(match[1]);
            }

            if (variables.size === 0) {
                addOutput('No variables found in the annotation', 'warning');
            } else {
                addOutput(`Variables in the annotation (${variables.size}):`, 'info');
                Array.from(variables).sort().forEach(v => {
                    addOutput(`  ${v}`, 'success');
                });
            }
        } catch (error) {
            addOutput(`Error listing variables: ${error.message}`, 'error');
        }
    }

    function executeClear() {
        const output = document.getElementById('command-output');
        if (output) {
            output.innerHTML = '';
            addOutput('Output cleared', 'success');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCommandLine);
    } else {
        initCommandLine();
    }

    // Export for global access
    window.UMRCommandLine = {
        init: initCommandLine,
        toggle: toggleCommandLine,
        execute: executeCommand
    };
})();