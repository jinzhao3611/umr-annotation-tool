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
            example: 'add :ARG1 person-01 to s1',
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

        // Create command line container
        const commandLineContainer = document.createElement('div');
        commandLineContainer.id = 'umr-command-line-container';
        commandLineContainer.className = 'card mt-3';
        commandLineContainer.style.display = 'none';
        commandLineContainer.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">
                    <i class="fas fa-terminal"></i> Command Line Interface
                </h6>
                <button class="btn btn-sm btn-outline-secondary" onclick="umrCommandLine.hide()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="command-output-container mb-3">
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

        // Insert after the annotation card
        annotationCard.parentNode.insertBefore(commandLineContainer, annotationCard.nextSibling);

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
                max-height: 300px;
                overflow-y: auto;
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
        const container = document.getElementById('umr-command-line-container');
        if (container) {
            container.style.display = visible ? 'block' : 'none';
            commandState.isVisible = visible;

            if (visible) {
                const input = document.getElementById('command-input');
                if (input) input.focus();
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
            if (info.example) {
                addOutput(`    Example: ${info.example}`, 'info');
            }
        });
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

        // Create the branch content
        const branchContent = `${relation} ${target}`;

        try {
            // Call the existing addBranchToNode function
            if (typeof addBranchToNode === 'function') {
                addBranchToNode(variable, branchContent);
                addOutput(`Added branch "${branchContent}" to ${variable}`, 'success');

                // Trigger save if needed
                if (typeof saveBranchInsertion === 'function') {
                    const annotationElement = document.querySelector('#amr pre');
                    if (annotationElement) {
                        saveBranchInsertion(annotationElement.textContent, branchContent);
                    }
                }
            } else {
                addOutput('Error: addBranchToNode function not available', 'error');
            }
        } catch (error) {
            addOutput(`Error adding branch: ${error.message}`, 'error');
        }
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
            // Find the relation span to delete
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            // Get text content and find the branch
            const text = annotationElement.textContent;
            const lines = text.split('\n');

            // Find the line with the variable and relation
            let lineIndex = -1;
            let branchFound = false;

            for (let i = 0; i < lines.length; i++) {
                // Check if this line has the variable (as a node definition)
                const varPattern = new RegExp(`\\b${variable}\\s*/`);
                if (varPattern.test(lines[i]) || lines[i].includes(`:${variable}`)) {
                    // Check subsequent lines for the relation
                    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
                        if (lines[j].includes(relation)) {
                            lineIndex = j;
                            branchFound = true;
                            break;
                        }
                    }
                    if (branchFound) break;
                }
            }

            if (!branchFound) {
                addOutput(`Branch "${relation}" not found for ${variable}`, 'warning');
                return;
            }

            // Delete the branch by removing the line
            const updatedLines = [...lines];
            updatedLines.splice(lineIndex, 1);
            const updatedText = updatedLines.join('\n');

            // Update the annotation
            annotationElement.textContent = updatedText;

            // Trigger the save
            if (typeof saveBranchDeletion === 'function') {
                saveBranchDeletion(updatedText, relation);
            }

            // Re-apply formatting if needed
            if (typeof makeVariablesClickable === 'function') {
                makeVariablesClickable(annotationElement);
            }
            if (typeof addBranchOperations === 'function') {
                addBranchOperations(annotationElement);
            }

            addOutput(`Deleted branch "${relation}" from ${variable}`, 'success');
        } catch (error) {
            addOutput(`Error deleting branch: ${error.message}`, 'error');
        }
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
            // Find the branch to move
            const annotationElement = document.querySelector('#amr pre');
            if (!annotationElement) {
                addOutput('Error: Annotation element not found', 'error');
                return;
            }

            const text = annotationElement.textContent;
            const lines = text.split('\n');

            // Find the branch
            let branchInfo = null;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(source) && lines[i].includes(relation)) {
                    // Extract the full branch content
                    const match = lines[i].match(new RegExp(`(${relation}\\s+[^\\s\\)]+)`));
                    if (match) {
                        branchInfo = {
                            relation: relation,
                            content: match[0],
                            sourceVariable: source
                        };
                        break;
                    }
                }
            }

            if (!branchInfo) {
                addOutput(`Branch "${relation}" not found for ${source}`, 'warning');
                return;
            }

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