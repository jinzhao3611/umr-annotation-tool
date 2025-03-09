// Unified Button Styling
document.addEventListener('DOMContentLoaded', function() {
    // Add delete-icon to all btn-danger buttons that don't already have it
    const dangerButtons = document.querySelectorAll('.btn-danger:not(.btn-icon)');
    
    dangerButtons.forEach(button => {
        // Skip buttons that already have a delete-icon
        if (button.querySelector('.delete-icon')) return;
        
        // Create the delete icon span
        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'delete-icon';
        deleteIcon.textContent = '×';
        deleteIcon.style.position = 'absolute';
        deleteIcon.style.fontSize = '24px';
        deleteIcon.style.lineHeight = '1';
        deleteIcon.style.opacity = '1';
        deleteIcon.style.transition = 'opacity 0.2s ease-in-out';
        
        // Add hover effect to icon
        const icon = button.querySelector('i');
        if (icon) {
            icon.style.opacity = '0';
            icon.style.transform = 'scale(0.8)';
            icon.style.transition = 'all 0.2s ease-in-out';
            
            // Add hover effects
            button.addEventListener('mouseenter', function() {
                deleteIcon.style.opacity = '0';
                icon.style.opacity = '1';
                icon.style.transform = 'scale(1)';
            });
            
            button.addEventListener('mouseleave', function() {
                deleteIcon.style.opacity = '1';
                icon.style.opacity = '0';
                icon.style.transform = 'scale(0.8)';
            });
        }
        
        // Add the delete icon to the button
        button.appendChild(deleteIcon);
        
        // Add the btn-icon class for consistency
        button.classList.add('btn-icon');
    });
}); 