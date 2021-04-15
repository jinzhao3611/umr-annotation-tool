$(document).ready(function(){

    $("#amr").dblclick(function(){ // when double click on element #amr
        selection = document.getSelection(); //get selection of text
        submit_template_action('set_parent'); //set text to parent
    });

    // https://stackoverflow.com/questions/6658752/click-event-doesnt-work-on-dynamically-generated-elements
    $('#genericDropdown').on("click", "#sense", function() {
        $('input[name=roles1]').val('');
        $('input[name=roles2]').val('');
        $('input[name=attributes]').val('');
        $('input[name=concept_types]').val('');
        $('input[name=ne_types]').val('');
        $('input[name=attribute_values1]').val('');
        $('input[name=attribute_values2]').val('');
        $('input[name=attribute_values3]').val('');
        $('input[name=attribute_values4]').val('');
        $('input[name=attribute_values5]').val('');
        $('input[name=attribute_values6]').val('');
    });
    $('#add-abs-concept').click(function() {
        $('input[name=roles1]').val('');
        $('input[name=roles2]').val('');
        $('input[name=attributes]').val('');
        $('input[name=concept_types]').val('');
        $('input[name=ne_types]').val('');
        $('input[name=attribute_values1]').val('');
        $('input[name=attribute_values2]').val('');
        $('input[name=attribute_values3]').val('');
        $('input[name=attribute_values4]').val('');
        $('input[name=attribute_values5]').val('');
        $('input[name=attribute_values6]').val('');
    });
    $('#add-attr').click(function() {
        $('input[name=roles1]').val('');
        $('input[name=roles2]').val('');
        $('input[name=attributes]').val('');
        $('input[name=concept_types]').val('');
        $('input[name=ne_types]').val('');
        $('input[name=attribute_values1]').val('');
        $('input[name=attribute_values2]').val('');
        $('input[name=attribute_values3]').val('');
        $('input[name=attribute_values4]').val('');
        $('input[name=attribute_values5]').val('');
        $('input[name=attribute_values6]').val('');
    });

    $('input[name=roles1]').focusin(function() {
        $('input[name=roles1]').val('');
    });
    $('input[name=roles2]').focusin(function() {
        $('input[name=roles2]').val('');
    });
    $('input[name=attributes]').focusin(function() {
        $('input[name=attributes]').val('');
    });
    $('input[name=concept_types]').focusin(function() {
        $('input[name=concept_types]').val('');
    });
    $('input[name=ne_types]').focusin(function() {
        $('input[name=ne_types]').val('');
    });
    $('input[name=attribute_values1]').focusin(function() {
        $('input[name=attribute_values1]').val('');
    });
    $('input[name=attribute_values2]').focusin(function() {
        $('input[name=attribute_values2]').val('');
    });
    $('input[name=attribute_values3]').focusin(function() {
        $('input[name=attribute_values3]').val('');
    });
    $('input[name=attribute_values4]').focusin(function() {
        $('input[name=attribute_values4]').val('');
    });
    $('input[name=attribute_values5]').focusin(function() {
        $('input[name=attribute_values5]').val('');
    });
    $('input[name=attribute_values6]').focusin(function() {
        $('input[name=attribute_values6]').val('');
    });

});

