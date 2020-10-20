$('table').mousedown(function (event) {
    if (event.ctrlKey) {
        event.preventDefault();
    }
});
