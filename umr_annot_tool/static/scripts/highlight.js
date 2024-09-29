// Function to remove existing highlights
function removeHighlights() {
    document.querySelectorAll('.highlight').forEach(function(element) {
        element.classList.remove('highlight');
    });
}

// Function to toggle highlight on all matching elements
function toggleHighlight(key) {
    var elements = document.querySelectorAll('.highlightable[data-key="' + key + '"]');
    var isHighlighted = elements.length > 0 && elements[0].classList.contains('highlight');

    // If already highlighted, remove highlight
    if (isHighlighted) {
        elements.forEach(function(element) {
            element.classList.remove('highlight');
        });
    } else {
        // Otherwise, add highlight
        elements.forEach(function(element) {
            element.classList.add('highlight');
        });
    }
}

// Event delegation for dynamically loaded elements
document.getElementById('umrs').addEventListener('click', function(event) {
    // Check if the clicked element is a highlightable span
    if (event.target.classList.contains('highlightable')) {
        // Get the data-key attribute of the clicked span
        var key = event.target.getAttribute('data-key');

        // Toggle highlight for all spans with the same key
        if (key) {
            toggleHighlight(key);
        }
    }
});


function addHighlightListeners() {
    document.querySelectorAll('.highlightable').forEach(function(span) {
        span.addEventListener('click', handleClick);
    });
}

// Call this function after dynamic elements are added
addHighlightListeners();


// If you want to ensure that only one set of elements is highlighted at a time, you can maintain the state of the currently highlighted key:
var currentlyHighlightedKey = null;

function toggleHighlight(key) {
    if (currentlyHighlightedKey === key) {
        // If the same key is clicked, remove the highlight
        removeHighlights();
        currentlyHighlightedKey = null;
    } else {
        // Remove previous highlights and highlight new key
        removeHighlights();
        var elements = document.querySelectorAll('.highlightable[data-key="' + key + '"]');
        elements.forEach(function(element) {
            element.classList.add('highlight');
        });
        currentlyHighlightedKey = key;
    }
}