// Attach a single event listener to the parent element (event delegation)
document.querySelector('#amr').addEventListener('click', function(event) {
  // Check if the clicked element has the class 'deletable'
  if (event.target.classList.contains('deletable')) {
    // Remove the clicked element
    event.target.remove();
  }
});

