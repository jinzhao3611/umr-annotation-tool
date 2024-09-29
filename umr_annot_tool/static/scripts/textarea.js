// Function to set the value of the parentArg textarea based on the selected option
function setParentArgValue() {
    var selectElement = document.getElementById('parentArgOptions');
    var selectedValue = selectElement.value;
    var textareaElement = document.getElementById('parentArg');
    textareaElement.value = selectedValue;
}

// Function to set the value of the childArg textarea based on the selected option
function setChildArgValue() {
    var selectElement = document.getElementById('childArgOptions');
    var selectedValue = selectElement.value;
    var textareaElement = document.getElementById('childArg');
    textareaElement.value = selectedValue;
}

