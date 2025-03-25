/**
 * Ancast Evaluation Module
 * This module handles the evaluation of UMR annotations using the Ancast evaluation system.
 */

/**
 * Run the Ancast Evaluation
 */
function runAncastEvaluation() {
    console.log('Running Ancast Evaluation');
    
    // Show a loading state
    const evaluateButton = document.getElementById('evaluate-btn');
    if (evaluateButton) {
        evaluateButton.disabled = true;
        evaluateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running Evaluation...';
    }
    
    // Get the contents of both annotations
    let content1, content2;
    
    if (window.state.comparisonLevel === 'sentence') {
        const doc1Elem = document.querySelector('#doc1-sent-annotation .annotation-content pre');
        const doc2Elem = document.querySelector('#doc2-sent-annotation .annotation-content pre');
        if (doc1Elem && doc2Elem) {
            content1 = doc1Elem.textContent || '';
            content2 = doc2Elem.textContent || '';
        }
    } else {
        const doc1Elem = document.querySelector('#doc1-doc-annotation .annotation-content pre');
        const doc2Elem = document.querySelector('#doc2-doc-annotation .annotation-content pre');
        if (doc1Elem && doc2Elem) {
            content1 = doc1Elem.textContent || '';
            content2 = doc2Elem.textContent || '';
        }
    }
    
    // Check if we have valid content
    if (!content1 || !content2) {
        alert('Could not retrieve annotation content for evaluation.');
        
        // Reset button
        if (evaluateButton) {
            evaluateButton.disabled = false;
            evaluateButton.innerHTML = '<i class="fas fa-chart-bar"></i> Run Ancast Evaluation';
        }
        return;
    }
    
    // Prepare data for API call
    const apiData = {
        doc_version_1_id: window.state.docVersion1Id,
        doc_version_2_id: window.state.docVersion2Id,
        sent_id: window.state.currentSentId,
        comparison_level: window.state.comparisonLevel,
        content1: content1,
        content2: content2
    };
    
    // Make API call to the backend
    fetch('/ancast_evaluation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken() // Ensure you have this function defined or use another CSRF method
        },
        body: JSON.stringify(apiData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Use the real evaluation scores from the API
            showAncastResults(data.scores);
        } else {
            // Handle API error
            console.error('API returned error:', data.error);
            alert(`Evaluation failed: ${data.error || 'Unknown error'}`);
        }
    })
    .catch(error => {
        console.error('Error running evaluation:', error);
        alert(`An error occurred during evaluation: ${error.message}`);
        
        // For development/demo, use mock results if API call fails
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Using mock results for local development');
            const mockResults = {
                sent: 0.85,
                temporal: 0.79,
                modal: 0.83,
                coref: 0.76,
                comp: 0.81
            };
            showAncastResults(mockResults);
        }
    })
    .finally(() => {
        // Reset button regardless of success or failure
        if (evaluateButton) {
            evaluateButton.disabled = false;
            evaluateButton.innerHTML = '<i class="fas fa-chart-bar"></i> Run Ancast Evaluation';
        }
    });
}

/**
 * Helper function to get CSRF token from cookies
 */
function getCSRFToken() {
    return document.cookie.split(';')
        .find(cookie => cookie.trim().startsWith('csrftoken='))
        ?.split('=')[1] || '';
}

/**
 * Display the Ancast evaluation results
 */
function showAncastResults(results) {
    console.log('Showing evaluation results:', results);
    
    const container = document.getElementById('ancast-scores-container');
    const overlay = document.getElementById('ancast-overlay');
    const scoresDiv = document.getElementById('ancast-scores');
    
    if (!container || !overlay || !scoresDiv) {
        console.error('Ancast results container, overlay, or scores div not found', {
            container: !!container,
            overlay: !!overlay,
            scoresDiv: !!scoresDiv
        });
        return;
    }
    
    // Update the results in the container
    const scoresHtml = `
        <div class="score-row" title="Measures the similarity of basic sentence elements, including predicate-argument structure">
            <div class="score-label">Sentence</div>
            <div class="score-value ${getScoreClass(results.sent)}">${formatScore(results.sent)}</div>
        </div>
        <div class="score-row" title="Evaluates the agreement on temporal relations and tense/aspect features">
            <div class="score-label">Temporal</div>
            <div class="score-value ${getScoreClass(results.temporal)}">${formatScore(results.temporal)}</div>
        </div>
        <div class="score-row" title="Compares the modal operators and attitude expressions between annotations">
            <div class="score-label">Modal</div>
            <div class="score-value ${getScoreClass(results.modal)}">${formatScore(results.modal)}</div>
        </div>
        <div class="score-row" title="Assesses the similarity in entity coreference chains across the annotations">
            <div class="score-label">Coreference</div>
            <div class="score-value ${getScoreClass(results.coref)}">${formatScore(results.coref)}</div>
        </div>
        <div class="score-row" title="Measures agreement on compositional semantic structures like coordination and scope">
            <div class="score-label">Compositional</div>
            <div class="score-value ${getScoreClass(results.comp)}">${formatScore(results.comp)}</div>
        </div>
    `;
    
    scoresDiv.innerHTML = scoresHtml;
    
    // Show the results
    container.classList.add('active');
    overlay.classList.add('active');
    
    // Close button event
    const closeButton = document.getElementById('close-ancast');
    if (closeButton) {
        // Remove existing listeners to prevent duplicates
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        
        newCloseButton.addEventListener('click', function() {
            container.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
    
    // Click outside to close
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    
    newOverlay.addEventListener('click', function() {
        container.classList.remove('active');
        newOverlay.classList.remove('active');
    });
}

/**
 * Get a CSS class based on the score value
 */
function getScoreClass(score) {
    if (score === undefined || score === null) return '';
    score = parseFloat(score);
    if (isNaN(score)) return '';
    
    if (score >= 0.8) return 'score-high';
    if (score >= 0.5) return 'score-medium';
    return 'score-low';
}

/**
 * Format a score value for display
 */
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

// Initialize Ancast evaluation features
function initializeAncastEvaluation() {
    // Set up the evaluation button
    const evaluateButton = document.getElementById('evaluate-btn');
    if (evaluateButton) {
        evaluateButton.addEventListener('click', function() {
            runAncastEvaluation();
        });
    }
}

// Export functions for use in other modules
window.ancastEvaluation = {
    initialize: initializeAncastEvaluation,
    run: runAncastEvaluation,
    showResults: showAncastResults
}; 