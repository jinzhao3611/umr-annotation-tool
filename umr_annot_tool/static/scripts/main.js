// Main JavaScript file for common functionality

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    $('[data-toggle="tooltip"]').tooltip();
    
    // Initialize popovers
    $('[data-toggle="popover"]').popover();
    
    // Handle mobile menu toggle
    $('.navbar-toggler').on('click', function() {
        $('.navbar-collapse').toggleClass('show');
    });
    
    // Close mobile menu when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.navbar').length) {
            $('.navbar-collapse').removeClass('show');
        }
    });
    
    // Handle flash messages auto-dismiss
    $('.alert').delay(5000).fadeOut(500);
});

// Common utility functions
function showNotification(message, type = 'info', duration = 5000) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    
    // Find the appropriate container - try content first, fallback to main-content
    const contentElement = document.getElementById('content');
    const mainContentElement = document.querySelector('.main-content');
    
    if (contentElement) {
        contentElement.insertBefore(alertDiv, contentElement.firstChild);
    } else if (mainContentElement) {
        mainContentElement.insertBefore(alertDiv, mainContentElement.firstChild);
    } else {
        // Final fallback to body if neither element exists
        document.body.insertBefore(alertDiv, document.body.firstChild);
    }
    
    setTimeout(() => alertDiv.remove(), duration);
}

// Handle form submissions
function handleFormSubmit(formId, successCallback) {
    $(formId).on('submit', function(e) {
        e.preventDefault();
        const form = $(this);
        const submitButton = form.find('button[type="submit"]');
        
        // Disable submit button and show loading state
        submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...');
        
        $.ajax({
            url: form.attr('action'),
            method: form.attr('method'),
            data: form.serialize(),
            success: function(response) {
                if (successCallback) successCallback(response);
                showNotification('Operation completed successfully', 'success');
            },
            error: function(xhr) {
                showNotification(xhr.responseText || 'An error occurred', 'danger');
            },
            complete: function() {
                // Re-enable submit button and restore original text
                submitButton.prop('disabled', false).html(submitButton.data('original-text') || 'Submit');
            }
        });
    });
} 