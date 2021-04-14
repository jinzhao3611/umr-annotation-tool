$(document).ready(function(){

    $("#amr").dblclick(function(){ // when double click on element #amr
        selection = document.getSelection(); //get selection of text
        submit_template_action('set_parent'); //set text to parent
    });


});

