var current_parent;
var current_concept;
var current_relation;
var current_mode;
var current_attribute;

var temp_umrs = {};

var selection;
var begOffset;
var endOffset;

var amr = {}; //{n: 1, 1.c: "obligate-01", 1.v: "o", 1.s: "", 1.n: 1, …}
var variables = {}; //{o: "1", r: "1.1", b: "1.1.1"}
var reserved_variables = {};
var concepts = {}; //{obligate-01: "1", resist-01: "1.1", boy: "1.1.1"}
var variable2concept = {}; // {o: "obligate-01", r: "resist-01", b: "boy", "": "", c: "car"}
var undo_list = []; // [{action:..., amr: ..., concept:..., variables:..., id: 1}, {...}, ...]
var undo_index = 0; //2
var last_state_id = 0; //3
var state_has_changed_p = 0; //it turns to 1 when a triple is added, it is set to 0 after execute commanded is finished
var load_amr_feedback = ''; //绿色的pennman html string
var load_amr_feedback_alert = 0; //0
var show_amr_obj = {}; // options table {option-1-line-NEs: true, option-1-line-ORs: true, option-auto-check: true, option-auto-moveto: false}
var show_amr_status = 'show'; //'show'
var show_amr_mo_lock = ''; // ''
var current_template = ''; //"options"
var max_show_amr_ops = 5000; // 5000
var max_string2amr_ops = 5000; //4992
var current_onto_popup_window = ''; //this is a Window object, not a string?
var sentence_props = ["props-id", "props-date", "props-authors", "props-snt", "props-note"]; // ["props-id", "props-date", "props-authors", "props-snt", "props-note"]
var saved_sentence_prop_values = ["", "", "", "", ""]; //["", "", "", "", ""]
var previous_log_messages = {}; // {}
var ceo_ht; // {1: 1, open.1: 0, open.1.1: 0, open.1.1.1: 0, 1.1.1: 1, 1.1: 1}
var browserUserAgent = navigator.userAgent || '';
var frame_arg_descr = {}; //{"": ""}

var is_have_rel_role_91_role = {}; //ancestor: 1; aunt: 1; baby: 1
var is_standard_named_entity = {}; //"": 1; aircraft: 1; aircraft-type: 1

var logsid = ''; //"IQrVT4Dh6mkz93W1DCxpNws9Om6qKqk0EGwhFs0x"
var next_special_action = ''; //''




function initialize() {
    console.log("initialize is called16");
    amr['n'] = 0;
    var s;

    // loadField2amr(); //如果load里面的Direct AMR entry里什么都没有输入的话，可能这里什么都没有做
    undo_list.push(cloneCurrentState()); //populate undo_list
    // reset_load(''); //不按load button没有用

    //unclear what does this line do, probably has something to do with undo
    if ((s = document.getElementById('next-special-action')) != null) {
        next_special_action = s.value;
    }
    current_mode = 'top';
}


function conceptDropdown() {
    document.getElementById("concept_dropdown").classList.toggle("show");
    submit_concept();
    // if selected tokens is a number or not
    // let token = selection.anchorNode.nodeValue;
    let token = current_concept;
    let numfied_token = text2num(token);
    // this is to cover :quant
    if (!isNaN(numfied_token)) {// if numfied_token is a number
        let number = {"res": [{"desc": "token is a number", "name": numfied_token}]};
        console.log(number);
        const lemmaBar = document.getElementById("find_lemma");
        lemmaBar.onmouseenter = function () {
            getSenses(number);
        }
    } else { // if numfied_token is still a string, meaning the token is not a number
        // pass the token to server to get the framefile
        try{
            fetch('/annotate', {
                method: 'POST',
                body: JSON.stringify({"selected": getLemma(token)})
            }).then(function (response) {
                return response.json();
            }).then(function (data) {
                console.log(data); //senses got returned from server
                const lemmaBar = document.getElementById("find_lemma");
                lemmaBar.onmouseenter = function () {
                    getSenses(data);
                }
            })
        }catch (e){
            let letter = {"res": [{"desc": "token is a letter", "name": token}]};
            getSenses(letter);
        }

    }


}

function getSenses(senses) {
    let genDrop = document.getElementById('genericDropdown');
    genDrop.innerHTML = "";
    if (genDrop.childElementCount > 0) {
        genDrop.classList.toggle("show");
    } else {
        senses.res.forEach(function (value, index, array) {
            let genLink = document.createElement("a");
            genLink.innerHTML = value.name;
            genLink.setAttribute("href", `javascript:submit_template_action('nothing', "${value.name}");`);
            genLink.setAttribute("title", value.desc);
            genDrop.appendChild(genLink);
        });
        genDrop.classList.toggle("show");
    }
}


// Close the dropdown if the user clicks outside of it
window.onclick = function (event) {
    if (!event.target.matches('.dropbtn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        var i;
        for (i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
};

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function docAnnot(sentenceId){
    exec_command("top sentence", 1);
    submit_template_action('doc-annot');

}

function submit_relation() {
    // current_relation = sel.options[sel.selectedIndex].text;
    current_relation = document.querySelector('#browser').value;
    if (current_relation){
    }else{
        current_relation = document.querySelector('#browser4').value;
    }
    if (current_relation) {
        submit_mode("add");
    }
    let eles = document.getElementsByClassName('attributes');
    var i;
    for (i=0; i<eles.length; i++){
        eles[i].style.display ='none';
    }
    if(current_relation == ':Aspect'){
        document.getElementById("aspect-attribute").style.display = 'block';
    } else if(current_relation == ':polarity'){
        document.getElementById("polarity-attribute").style.display = 'block';
    }
    console.log("current_relation is: " + current_relation);
}

function submit_attribute(n){
    current_attribute = document.querySelector('#browser' + n).value;
    // submit_template_action(current_mode, current_attribute);
    submit_template_action('add-constant', current_attribute);
    console.log("current_attribute is: " + current_attribute);
}

function submit_concept() {
    // current_concept = selection.anchorNode.nodeValue;
    current_concept = document.getElementById('selected_tokens').innerText;
    current_concept = current_concept.replace("'", "\'");
    console.log("current_concept is: " + current_concept);
}

function submit_abstract_concept() {
    current_concept = document.querySelector('#browser2').value;
    current_concept = current_concept.replace("'", "\'");
    console.log("current_concept is: " + current_concept);
    submit_template_action(current_mode, current_concept);

}

function submit_mode(mode) {
    current_mode = mode;
    console.log("current_mode is: " + current_mode);
}

function generate_penman(){
    submit_template_action(current_mode, c = current_concept, r = current_relation)
}

function multipleWords(){
    var c = current_concept.replace(" ", "-");
    submit_template_action("add", c)
}

/** undo *******************************************************/
/**
 * Handle the 3 simple types, and null or undefined
 * @param obj
 * @returns {*}
 */
function clone(obj) {
    // copied from Web
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        var len = obj.length;
        for (var i = 0; i < len; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    // throw new Error("Unable to copy obj! Its type isn't supported.");
    add_log('clone error: cannot clone object ' + obj);
    return obj;
}

function cloneCurrentState() {
    var current_state = {};
    current_state['amr'] = clone(amr);
    current_state['variables'] = clone(variables);
    current_state['concepts'] = clone(concepts);
    last_state_id++;
    current_state['id'] = last_state_id;
    add_log('Created state ' + last_state_id);
    return current_state;
}

function revert2PrevState(previous_state) {
    amr = previous_state['amr'];
    variables = previous_state['variables'];
    concepts = previous_state['concepts'];
    // props2template();
    // props2screen();
    // add_log('Reverted to state ' + previous_state['id']);
}
/**
 * undo and redo, also probably generate a window at the up right corner
 * @param n positive number or a negative number
 */
function undo(n) {
    var op_name, undo_title, redo_title, s, s2;
    var undo_list_size = undo_index + 1;
    var redo_list_size = undo_list.length - undo_list_size;
    if (n > 0) {
        op_name = 'redo';
    } else {
        op_name = 'undo';
    }
    if ((op_name == 'undo') && (undo_index == 0)) {
        add_error('Empty undo list. Sorry, cannot perform any further undo.');
        if (redo_list_size && ((s = document.getElementById('undo-redo-box')) != null)) {
            s.style.display = 'block';
        }
    } else if ((op_name == 'redo') && (redo_list_size == 0)) {
        add_error('Empty redo list. Sorry, cannot perform any further redo.');
    } else {
        undo_index += n;
        var old_state = undo_list[undo_index];
        revert2PrevState(clone(old_state));
        show_amr('show');
        undo_list_size = undo_index + 1;
        redo_list_size = undo_list.length - undo_list_size;
        if (undo_index) {
            var prev_state = undo_list[undo_index - 1];
            var prev_action = prev_state['action'];
            undo_title = 'undo ' + prev_action;
        } else {
            undo_title = 'currently nothing to undo';
        }
        if ((s = document.getElementById('undo-button')) != null) {
            s.title = undo_title;
        }
        if (redo_list_size) {
            var prev_state = undo_list[undo_index];
            var prev_action = prev_state['action'];
            redo_title = 'redo ' + prev_action;
        } else {
            redo_title = 'currently nothing to redo';
        }
        if ((s = document.getElementById('redo-button')) != null) {
            s.title = redo_title;
        }
        if (op_name == 'undo') {
            var undone_action = old_state['action'];
            // add_log('Undid ' + undone_action + '. Active undo list decreases to ' + undo_list_size + ' elements (incl. empty state). Redo list size: ' + redo_list_size);
        } else {
            var prev_state = undo_list[undo_index - 1];
            var redone_action = prev_state['action'];
            // add_log('Redid ' + redone_action + '. Active undo list increases to ' + undo_list_size + ' elements (incl. empty state). Redo list size: ' + redo_list_size);
        }
        if ((s = document.getElementById('undo-redo-box')) != null) {
            s.style.display = 'block';
        }
    }
}


/**
 * this function takes in a template id (the name on the button) and return the form to fill out
 * @param id "top"
 */
function selectTemplate(id) {
    console.log("I am here 902");
    current_template = '';
    var actions = ["replace", "delete", "move", "save", "load"];
    var s;
    for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        if ((s = document.getElementById(action + '-template-table')) != null) {
            if (id == action) {
                s.style.display = 'inline';
                current_template = id;
                if ((action == 'replace') && !show_amr_status.match(/replace/)) {
                        console.log("I am here 903");
                    // if clicked on replace from other button
                    show_amr('show replace');
                } else if ((action == 'delete') && !show_amr_status.match(/delete/)) {
                    show_amr('show delete');
                }
            } else {
                s.style.display = 'none';
                if ((action == 'replace') && show_amr_status.match(/replace/)) {
                    show_amr('show');
                } else if ((action == 'delete') && show_amr_status.match(/delete/)) {
                    show_amr('show');
                }
            }
        }
    }
    var focus_field;
    if (id == 'move') {
        focus_field = 'move-object';
    } else {
        focus_field = '';
    }
    if (focus_field && ((s = document.getElementById(focus_field)) != null)) {
        s.focus();
    }
}

/**
 * this is the title of the input of replace form
 * @param type
 */
function selectReplaceType(type) {
    // add_log('selectReplaceType ' + type);
    var s;
    if ((s = document.getElementById('replace-at')) != null) {
        if (type == 'concept') {
            s.title = 'type in the variable of the concept to be replaced, e.g. s';
        } else if (type == 'string') {
            s.title = 'type in the pair (head-variable :role) of the string or number to be replaced, e.g. n2 :value (without parentheses)';
        } else if (type == 'role') {
            s.title = 'type in the triple (head-variable :old-role arg) of the role to be replaced. arg can be a variable, concept, or string, e.g. s :ARG0 b (without parentheses or quotes)';
        }
    }
}

/**
 * this has something to do with the onclick function
 * @param type
 * @param at
 * @param old_value
 * @param mo_lock
 */
function fillReplaceTemplate(type, at, old_value, mo_lock) {
    // add_log('fillReplaceTemplate ' + type + ' ' + at + ' ' + old_value + ' &lt;' + mo_lock + '&gt; ' + show_amr_mo_lock);
    var s_type, s_at, s_new;
    if (((s_type = document.getElementById('replace-type')) != null)
        && ((s_at = document.getElementById('replace-at')) != null)
        && ((s_new = document.getElementById('replace-new')) != null)) {
        var same_mo_lock_p = (show_amr_mo_lock == mo_lock);
        if (show_amr_mo_lock) {
            s_type.value = '';
            s_at.value = '';
            s_new.value = '';
            color_amr_elem(show_amr_mo_lock, '#000000', '');
            show_amr_mo_lock = '';
            set_guidance('<p><font style="color:blue;font-weight:bold;">In AMR above, click on concept, string or role to be replaced.</font>');
        }
        if (!same_mo_lock_p) {
            s_type.value = type;
            s_at.value = at;
            s_new.value = old_value;
            s_new.focus();
            show_amr_mo_lock = mo_lock;
            color_amr_elem(show_amr_mo_lock, '#0000FF', '');
            set_guidance('<p><font style="color:blue;font-weight:bold;">In template below, enter new value and submit.</font>');
        }
    }
}

function fillDeleteTemplate(at, mo_lock) {
    var s;
    if ((s = document.getElementById('delete-at')) != null) {
        var same_mo_lock_p = (show_amr_mo_lock == mo_lock);
        // add_log('fillDeleteTemplate ' + at + ' ' + mo_lock + ' ' + show_amr_mo_lock + ' ' + same_mo_lock_p);
        if (show_amr_mo_lock) {
            s.value = '';
            color_all_under_amr_elem(show_amr_mo_lock, '#000000', '');
            show_amr_mo_lock = '';
            set_guidance('<p><font style="color:red;font-weight:bold;">In AMR above, click on element to be deleted.</font>');
        }
        if (!same_mo_lock_p) {
            s.value = at;
            show_amr_mo_lock = mo_lock;
            color_all_under_amr_elem(show_amr_mo_lock, '#FF0000', '');
            if (show_amr_obj['option-confirm-delete']) {
                set_guidance('<p><font style="color:red;font-weight:bold;">Confirm deletion in template below.</font>');
            } else {
                submit_template_action('delete');
                selectTemplate('clear');
            }
        }
    }
}

/** coloring umr ******************************************************/

function color_all_var_occurrences(variable, color) {
    var var_locs = getLocs(variable);
    if (var_locs) {
        var list = var_locs.split(" ");
        for (var i = 0; i < list.length; i++) {
            var sub_id = 'elem_var_id_' + list[i];
            color_amr_elem(sub_id, color, '');
        }
    }
}

function color_all_under_amr_elem(id, color, event_type) {
    console.log("color_all_under_amr_elem is called");
    var list_s = show_amr_obj['elem-' + id];
    var list = list_s.split(" ");
    for (var i = 0; i < list.length; i++) {
        var sub_id = list[i];
        color_amr_elem(sub_id, color, event_type);
    }
}

function color_amr_elem(id, color, event_type) {
    var s;
    if ((!(show_amr_mo_lock && (event_type == 'mo')))
        && ((s = document.getElementById(id)) != null)) {
        s.style.color = color;
    }
}


/** entrance ******************************************************/
// see the original one
function submit_template_action(id = "nothing", numbered_predicate = "") {

    console.log("submit_template_action: id: " + id + ", numbered_predicate: " + numbered_predicate);
    highlightSelection();
    if (id == "nothing") {
        id = current_mode;
    }
    console.log("mode is: " + id);

    if (numbered_predicate !== "") {
        current_concept = numbered_predicate;
    }

    // add_edit_log('submit_template_action ' + id);
    var arg1, arg2, arg3, arg4, s;
    if (id == 'top') {
        // if ((arg1 = document.getElementById('test-predicate')) != null) {
        //     // var concept = arg1.innerHTML;
        //     console.log('submit_template_action ' + id + ' ' + concept);
        //     exec_command('top ' + 'buy', 1);
        // }
        if ((arg1 = document.getElementById('genericDropdown')) != null) {
            // var concept = arg1.innerHTML;
            console.log('submit_template_action ' + id + ' ' + current_concept);
            exec_command('top ' + current_concept, 1);

            var k = getKeyByValue(amr, current_concept);
            if (k.includes("v")) {
                current_parent = current_concept;
                console.log("current_parent is " + current_parent);
            } else {
                var new_k = k.replace('c', 'v');
                current_parent = amr[new_k];
                console.log("current_parent is " + current_parent);
            }

            current_mode = 'add';
        }
    } else if (id == 'set_parent') {
        // console.log("********************");
        // console.log(current_parent);
        let test_str = "";
        test_str += selection;
        var k = getKeyByValue(amr, test_str);

        if (k.includes("v")) {
            current_parent = test_str;
            console.log("current_parent is " + current_parent);

        } else {
            var new_k = k.replace('c', 'v');
            current_parent = amr[new_k];
            console.log("current_parent is " + current_parent);

        }


    } else if(id == 'doc-annot'){
        current_parent = 's';
    }
    else if (id == 'add') {
        // if (((arg1 = document.getElementById('add-head')) != null)
        //  && ((arg2 = document.getElementById('add-role')) != null)
        //  && ((arg3 = document.getElementById('add-arg')) != null)) {
        //    var head = arg1.value;
        //    var role = arg2.value;
        //    var arg  = arg3.value;
        //    exec_command(head + ' ' + role + ' ' + arg, 1);
        // }

        // var role = ':' + document.getElementById('test-arg1').innerText;

        console.log("********************");
        // var role = ':arg' + num;
        var role = current_relation;
        console.log(role);
        // var arg = document.getElementById('selected_tokens').innerText;
        var arg = current_concept.toLowerCase();
        console.log(arg);
        console.log('submit_template_action ' + current_parent + ' ' + role + ' ' + arg);

        exec_command(current_parent + ' ' + role + ' ' + arg, 1);
    }
     else if (id == 'add-constant') {
        var role = current_relation;
        var arg = current_concept;
        console.log(arg);
        console.log('submit_template_action ' + current_parent + ' ' + role + ' ' + arg);
        exec_command(current_parent + ' ' + role + ' ' + arg, 1);
    }
    else if (id == 'add-ne') {
        // var role = ':' + document.getElementById('test-arg0').innerText;
        // var role = ':arg' + num;
        var role = current_relation;
        var concept = document.querySelector('#browser6').value;

        // var name = document.getElementById('selected_tokens').innerText;
        var name = current_concept;
        console.log(current_parent + ' ' + role + ' ' + concept + ' ' + name);
        exec_command(current_parent + ' ' + role + ' ' + concept + ' ' + name, 1);


    } else if (id == 'replace') {
        if (((arg1 = document.getElementById('replace-type')) != null)
            && ((arg2 = document.getElementById('replace-at')) != null)
            && ((arg3 = document.getElementById('replace-new')) != null)) {
            var type = arg1.value;
            var at = arg2.value;
            var new_value = arg3.value;
            if ((type == 'role') && (at_list = at.split(/\s+/))
                && (at_list.length >= 4) && (!at_list[2].match(/^"/))) {
                at = at_list[0] + ' ' + at_list[1] + ' "';
                for (var i = 2; i < at_list.length; i++) {
                    at += at_list[i] + ' ';
                }
                at = at.replace(/\s*$/, "\"");
            }
            if ((type == 'string') && new_value.match(/ /)) {
                new_value = '"' + new_value + '"';
            }
            exec_command('replace ' + type + ' at ' + at + ' with ' + new_value, 1);
        }
    } else if (id == 'delete') {
        if ((arg1 = document.getElementById('delete-at')) != null) {
            // var at = arg1.value;
            // var at = "w :manner beautiful";

            var curr_variable_key = getKeyByValue(amr, current_concept);

            if (curr_variable_key.includes("v")) {
                var pare_variable_key = curr_variable_key.slice(0, -3) + 'v';
                var curr_rel_key = curr_variable_key.replace('v', 'r');
                console.log("current_parent is " + current_parent);
            } else {
                //TODO: if the selected words is concept, not variable
            }

            var at = amr[pare_variable_key] + " " + amr[curr_rel_key] + " " + current_concept;
            if ((at_list = at.split(/\s+/))
                && (at_list.length >= 4) && (!at_list[2].match(/^"/))) {
                at = at_list[0] + ' ' + at_list[1] + ' "';
                for (var i = 2; i < at_list.length; i++) {
                    at += at_list[i] + ' ';
                }
                at = at.replace(/\s*$/, "\"");
            }
            console.log('delete ' + at);
            exec_command('delete ' + at, 1);
        }
    } else if (id == 'move') {
        if (((arg1 = document.getElementById('move-object')) != null)
            && ((arg2 = document.getElementById('move-new-head')) != null)
            && ((arg3 = document.getElementById('move-role')) != null)) {
            var mv_object = arg1.value;
            var new_head = arg2.value;
            var role = arg3.value;
            exec_command('move ' + mv_object + ' to ' + new_head + ' ' + role, 1);
        }
    }
    if ((s = document.getElementById('command')) != null) {
        s.focus();
    }
}

function exec_command(value, top) { // value: "b :arg1 car" , top: 1
    console.log("exec_command is called");
    var last_command, command_input, s, s1, s2, s3, resize_command_p;
    var show_amr_args = '';
    var record_value = '';

    if ((command_input = document.getElementById('command')) != null) {
        //resizing the command input box height
        var clen = command_input.value.length;
        if (clen > 50) {  // && show_amr_obj['option-resize-command'] // if the input is longer than a line, resize the height
            var n_lines = Math.floor(clen / 43) + 1;
            command_input.style.height = ((n_lines * 1.2) + 0.2) + 'em';
        }
        if (!value) {
            if (command_input.value.match(/\n/)) {//if enter key is pressed
                value = command_input.value;
            }
        }
        if (value && ((last_command = document.getElementById('action')) != null)) {
            // add_edit_log('exec_command ' + top + ' ' + value);
            // add_log('exec_command: ' + value + ' (top: ' + top + ')');
            value = strip(value);
            value = value.replace(/^([a-z]\d*)\s+;([a-zA-Z].*)/, "$1 :$2"); //??? for Kevin: last_command ;arg0 boy -> last_command :arg0 boy
            // value == "b :arg1 car"


            var cc = argSplit(value);
            // if(cc[0] != 'top' && cc[0].length > 2){
            //     cc[0] = cc[0].slice(0, -4)
            // }
            console.log("cc is: " + cc);// ["b", ":arg1", "car"]


            /** below are shortcut command **********************************************************************************************************************/
            if (value == '') {
                // empty
            } else if ((value == 'save')
                && ((s = document.getElementById('workset-template')) != null)
                && s.style.display.match(/inline/)) {
                if (((s1 = document.getElementById('save-snt-id2')) != null)
                    && ((s2 = document.getElementById('next-workset-snt-id2')) != null)
                    && ((s3 = document.getElementById('save-workset-snt')) != null)) {
                    props2comment();
                    s1.value = amr['props-id'] || '';
                    s2.value = s1.value;
                    s2.value = s2.value.replace(/^([a-z][a-z])_(.*)$/, "$1.$2");
                    s2.value = s2.value.replace(/^(.*)_(\d+)$/, "$1.$2");
                    add_log('save workset sentence. save: ' + s1.value + ' next: ' + s2.value);
                    s1.value = '';
                    s3.submit();
                }
            } else if (value.match(/^(reload|refresh)$/)
                && ((s = document.getElementById('workset-template')) != null)
                && s.style.display.match(/inline/)) {
                reload_current_workset_snt();
            } else if (value.match(/^(top|add|add-ne|replace|delete|move|save|load|options|clear|help)$/)) {
                selectTemplate(value);
                top = 0;
            } else if (value.match(/^(delete all|delete amr|del all|del amr)$/i)) {
                deleteAMR();
            } else if (value.match(/^(ne|[a-z]+(-[a-z]+)*-ne)$/i)) {
                selectTemplate('add-ne');
                top = 0;
            } else if (value.match(/^(r|repl|ch|change)$/i)) {
                selectTemplate('replace');
                top = 0;
            } else if (value.match(/^(d|de|del|rm|remove)$/i)) {
                selectTemplate('delete');
                top = 0;
            } else if (value.match(/^(m|mv)$/i)) {
                selectTemplate('move');
                top = 0;
            } else if (value.match(/^(u|undo)$/i)) {
                undo(-1);
            } else if (value.match(/^(redo)$/i)) {
                undo(1);
            } else if (value.match(/^(o|opt)$/i)) {
                selectTemplate('options');
                top = 0;
            } else if (value.match(/^(c|cl)$/i)) {
                selectTemplate('clear');
                top = 0;
            } else if (value.match(/^\s*([a-z]\d*\s+)?(show\s+roles|roles)\s*$/i)) {
                popupRoles();
            } else if (value.match(/^\s*([a-z]\d*\s+)?(show\s+dict|dict)\s*$/i)) {
                popupAmrDict();
            } else if (value.match(/^\s*([a-z]\d*\s+)?(show\s+videos?|videos?)\s*$/i)) {
                popupVideoPage();
            } else if (value.match(/^\s*([a-z]\d*\s+)?(show\s+)?(entity|entities|NE|NEs|NE\s+types?|types?|category|categories|class|classes)\s*$/i)) {
                popupNETypes();
            } else if (value.match(/^\s*([a-z]\d*\s+)?(show\s+)?(AMR\s+)?(guidelines)\s*$/i)) {
                popupGuidelines('');
            } else if (value.match(/^change\s+variable\s+[a-z]\d*\s+\S+$/i)) { //TODO unclear how to change variable name
                change_var_name(cc[2], cc[3], top);
                show_amr_args = 'show';
            } else if (value.match(/^cv\s+[a-z]\d*\s+\S+\s*$/i)) { //TODO unclear how to change variable name
                change_var_name(cc[1], cc[2], top);
                show_amr_args = 'show';
            } else if (value.match(/^reop\s+[a-z]\d*\s*$/i)) { //TODO unclear
                renorm_ops(cc[1]);
                show_amr_args = 'show';
            } else if (value.match(/^r[rv]\b\s*(\S.*\S|\S|)\s+\S+\s*$/)) {  // replace role (or secondary variable) shortcut

                var user_descr = value.replace(/^r[rv]\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$1");
                var new_value = value.replace(/^r[rv]\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$2");
                var target_name = '';
                if (value.match(/^rr/)) {
                    target_name = 'role';
                } else if (value.match(/^rv/)) {
                    target_name = 'variable';
                }
                var loc_list = user_descr2locs(user_descr, target_name);
                if ((target_name == 'role') && !new_value.match(/^:[a-z]/i)) {
                    add_error('Ill-formed new role <font color="red">' + new_value + '</font>');
                } else if ((target_name == 'variable') && !getLocs(new_value)) {
                    add_error('Ill-formed new variable <font color="red">' + new_value + '</font>');
                } else if ((loc_list.length == 1) && !amr[loc_list[0] + '.r']) {
                    add_error('No ' + target_name + ' defined for <font color="red">' + user_descr + '</font>');
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = getParentVariable(loc);
                    var role = amr[loc + '.r'];
                    var variable = amr[loc + '.v'];
                    var target = role || variable;
                    var arg = amr[loc + '.v'] || amr[loc + '.command_input'] || amr[loc + '.s'];
                    add_log('expanding "' + user_descr + '/' + loc + '" to: replace ' + target_name + ' at ' + parent_variable + ' ' + target + ' ' + arg + ' with ' + new_value);
                    exec_command(('replace ' + target_name + ' at ' + parent_variable + ' ' + target + ' ' + arg + ' with ' + new_value), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if (loc_list.length == 0) {
                    add_error('Could not find any ' + target_name + ' for locator <font color="red">' + user_descr + '</font>');
                } else {
                    add_error('Ambiguous ' + target_name + ' locator <font color="red">' + user_descr + '</font>');
                }
            } else if (value.match(/^rs\b\s*(\S.*\S|\S|)\s*$/)) { // replace string shortcut
                var user_descr = value.replace(/^rs\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$1");
                var new_value = value.replace(/^rs\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$2");
                var loc_list = user_descr2locs(user_descr, 'string');
                if ((loc_list.length == 1) && !(amr[loc_list[0] + '.s'] && amr[loc_list[0] + '.r'])) {
                    add_error('No string defined for <font color="red">' + user_descr + '</font>');
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = getParentVariable(loc);
                    var role = amr[loc + '.r'];
                    // add_log('expanding "' + user_descr + '/' + loc + '" to: replace string at ' + parent_variable + ' ' + role + ' with ' + new_value);
                    exec_command(('replace string at ' + parent_variable + ' ' + role + ' with ' + new_value), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if (loc_list.length == 0) {
                    add_error('Could not find any string for locator <font color="red">' + user_descr + '</font>');
                } else {
                    add_error('Ambiguous string locator <font color="red">' + user_descr + '</font>');
                }
            } else if (value.match(/^rc\b\s*(\S.*\S|\S|)\s+\S+\s*$/)) { // replace concept shortcut
                var user_descr = value.replace(/^rc\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$1");
                var new_value = value.replace(/^rc\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$2");
                var loc_list = user_descr2locs(user_descr, 'concept');
                if (!validEntryConcept(new_value)) {
                    add_error('Ill-formed new concept <font color="red">' + new_value + '</font>');
                } else if ((loc_list.length == 1) && !amr[loc_list[0] + '.v']) {
                    add_error('No concept defined for <font color="red">' + user_descr + '</font>');
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var variable = amr[loc + '.v'];
                    // add_log('expanding "' + user_descr + '/' + loc + '" to: replace concept at ' + variable + ' with ' + new_value);
                    exec_command(('replace concept at ' + variable + ' with ' + new_value), 0);
                    state_has_changed_p = 1;
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if (loc_list.length == 0) {
                    add_error('Could not find any concept for locator <font color="red">' + user_descr + '</font>');
                } else {
                    add_error('Ambiguous concept locator <font color="red">' + user_descr + '</font>');
                }
            } else if (value.match(/^del\s+\S/)
                || value.match(/^delete\s+\S+(\s+\S+)?\s*$/)) { // delete shortcut
                // add_log('delete shortcut: ' + value + '.');
                var user_descr = value.replace(/^(?:del|delete)\s+(\S.*\S|\S|)\s*$/, "$1");
                var loc_list = user_descr2locs(user_descr, 'delete');
                if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = getParentVariable(loc);
                    var role = amr[loc + '.r'];
                    var variable = amr[loc + '.v'];
                    var arg = amr[loc + '.v'] || amr[loc + '.command_input'] || amr[loc + '.s'];
                    if (parent_variable) {
                        // add_log('expanding "' + user_descr + '/' + loc + '" to: delete ' + parent_variable + ' ' + role + ' ' + arg);
                        exec_command(('delete ' + parent_variable + ' ' + role + ' ' + arg), 0);
                    } else {
                        // add_log('expanding "' + user_descr + '/' + loc + '" to: delete top level ' + variable);
                        exec_command(('delete top level ' + variable), 0);
                    }
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if (loc_list.length == 0) {
                    add_error('Could not find anything to delete for locator <font color="red">' + user_descr + '</font>');
                } else {
                    add_error('Ambiguous deletion locator <font color="red">' + user_descr + '</font>');
                }
            } else if (value.match(/^(direct|direct entry)$/i)) { // bring out the direct AMR entry template
                var s, s1, s2, s3;
                if (((s1 = document.getElementById('comment')) != null)
                    && ((s2 = document.getElementById('plain-amr')) != null)
                    && ((s3 = document.getElementById('load-plain')) != null)) {
                    props2comment();
                    s3.value = s1.value + '\n' + s2.value;
                    if ((s = document.getElementById('load-template-table')) != null) {
                        s.style.display = 'inline';
                    }
                    if ((s = document.getElementById('load-local')) != null) {
                        s.style.display = 'none';
                    }
                    if ((s = document.getElementById('load-onto-snt')) != null) {
                        s.style.display = 'none';
                    }
                    if ((s = document.getElementById('load-cgi')) != null) {
                        s.style.display = 'none';
                    }
                    if ((s = document.getElementById('load-cgi2')) != null) {
                        s.style.display = 'none';
                    }
                }
                top = 0;
                /** TODO not completely clear**********************************************************************************************************************/
            } else if (cc.length >= 1) {
                console.log("I am here1");
                // cc == ["b", ":arg1", "car"]
                var key1 = cc[0]; //"b"
                var ne_concept;
                var cc2v;
                if ((key1 == 'top') || (key1 == 'bottom') || (key1 == 'new')) {
                    console.log("I am here2");
                    if ((cc.length >= 3) && (cc[1] == '*OR*') && validEntryConcept(cc[2])) {
                        console.log("I am here3");
                        addOr('top ' + value);
                        selectTemplate('');
                        show_amr_args = 'show';
                    }
                    else if ((cc.length >= 3) && (key1 == 'top') && (ne_concept = cc[1])
                        && validEntryConcept(ne_concept) && (!getLocs(ne_concept))
                        && (is_standard_named_entity[ne_concept] || listContainsCap(cc))) {
                        console.log("I am here4");
                        var ne_var = newAMR(trimConcept(ne_concept));
                        var name_var = add_triple(ne_var, ':name', 'name', 'concept');
                        for (var i = 2; i < cc.length; i++) {
                            var sub_role = ':op' + (i - 1);
                            add_triple(name_var, sub_role, cc[i], 'string');
                        }
                        if (current_template != 'top') {
                            console.log("I am here5");
                            selectTemplate('clear');
                        }
                        show_amr_args = 'show';
                    }
                    else if (cc.length >= 2) {
                        console.log("I am here6");
                        for (var i = 1; i < cc.length; i++) {
                            var arg = cc[i];
                            if ((key1 == 'top') && getLocs(arg)) {
                                //when the arg already exist in amr tree
                                console.log("I am here7");
                                move_var_elem(arg, 'top', '');
                            } else {
                                console.log("I am here8");
                                if (validEntryConcept(arg)) {
                                    console.log("I am here9");
                                    newAMR(trimConcept(arg));
                                } else {
                                    console.log("I am here10");
                                    add_error('Ill-formed command "' + key1 + ' <font color="red">' + arg + '</font>" &nbsp; Argument should be last_command concept.');
                                }
                            }
                        }
                        if (current_template != 'top') {
                            console.log("I am here11");
                            selectTemplate('clear');
                        }
                        show_amr_args = 'show';
                    }
                    /** automatic reification **********************************************************************************************************************/

                } else if ((cc.length >= 3) && (cc[1] == ':domain-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    cc.splice(1, 1, ':mod');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':subset') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG2-of', 'include-91');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && ((cc[1] == ':subset-of') || (cc[1] == ':superset')) && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'include-91');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':cause') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'cause-01');
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':cause-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG0-of', 'cause-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':cite') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'cite-01');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':cost') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'cost-01');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':cost-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG2-of', 'cost-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && ((cc[1] == ':except') || (cc[1] == ':prep-except')) && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG2-of', 'except-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':instead-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'instead-of-91');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':meaning') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG0-of', 'mean-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':meaning-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'mean-01');
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':role') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var role_candidate = cc[2];
                    var role_frame;
                    if (is_have_rel_role_91_role[role_candidate]) {
                        role_frame = 'have-rel-role-91';
                    } else {
                        role_frame = 'have-org-role-91';
                    }
                    var new_var = add_triple(cc[0], ':ARG0-of', role_frame);
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':role-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var role_candidate_var = cc[0];
                    var role_frame = variable2concept[role_candidate_var] || '';
                    if (is_have_rel_role_91_role[role_candidate]) {
                        role_frame = 'have-rel-role-91';
                    } else {
                        role_frame = 'have-org-role-91';
                    }
                    var new_var = add_triple(cc[0], ':ARG2-of', role_frame);
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':employed-by') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG0-of', 'have-org-role-91');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':employed-by-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ARG1-of', 'have-org-role-91');
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && (cc[1] == ':ord') && getLocs(cc[0]) && cc[2].match(/^-?[1-9]\d*$/i) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':ord', 'ordinal-entity');
                    cc.splice(0, 2, new_var, ':value');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && (cc[1] == ':xref') && getLocs(cc[0]) && cc[2].match(/^[A-Z]+:\S+/i) && show_amr_obj['option-auto-reification']) {
                    var new_var = add_triple(cc[0], ':xref', 'xref');
                    cc.splice(0, 2, new_var, ':value');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                    /** move and add **********************************************************************************************************************/
                } else if ((cc.length == 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && getLocs(cc[2]) && (cc[3] == '-')) {
                    console.log("I am here12");
                    move_var_elem(cc[2], cc[0], cc[1]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])
                    && (cc[2].match(/\-$/))
                    && (cc2v = cc[2].replace(/^(.*)\-$/, "$1"))
                    && getLocs(cc2v)) {
                    console.log("I am here13");
                    move_var_elem(cc2v, cc[0], cc[1]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && getLocs(cc[2]) && (cc[3] == '+')) {
                    console.log("I am here14");
                    add_triple(cc[0], cc[1], cc[2]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])
                    && (cc[2].match(/\+$/))
                    && (cc2v = cc[2].replace(/^(.*)\+$/, "$1"))
                    && getLocs(cc2v)) {
                    console.log("I am here15");
                    add_triple(cc[0], cc[1], cc2v);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])) {
                    console.log("I am here38");
                    // this is the condition we go in 1
                    add_triple(cc[0], cc[1], cc[2], '');
                    if (current_template != 'add') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if ((cc.length >= 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && (cc[2] == '*OR*') && validEntryConcept(cc[3])) {
                    console.log("I am here16");
                    addOr(value);
                    selectTemplate('');
                    show_amr_args = 'show';
                } else if ((cc.length >= 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && validEntryConcept(cc[2]) && (!getLocs(cc[2]))) {
                    console.log("I am here17");
                    add_ne(value);
                    if (current_template != 'add-ne') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':name') && getLocs(cc[0]) && (!getLocs(cc[2]))) {
                    console.log("I am here18");
                    add_ne(value);
                    if (current_template != 'add-ne') {
                        console.log("I am here19");
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if (key1 == 'replace') {
                    console.log("I am here20");
                    if (cc.length == 1) {
                        console.log("I am here21");
                        add_error('Ill-formed replace command. Arguments missing. First argument should be the type of AMR element to be replaced: concept, string or role');
                    } else if (cc[1] == 'concept') {
                        console.log("I am here22");
                        if (cc.length == 6) {
                            console.log("I am here23");
                            replace_concept(cc[2], cc[3], cc[4], cc[5]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            console.log("I am here24");
                            add_error('Ill-formed replace concept command. Incorrect number of arguments. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
                        }
                    } else if (cc[1] == 'string') {
                        console.log("I am here25");
                        if (cc.length == 7) {
                            console.log("I am here26");
                            replace_string(cc[2], cc[3], cc[4], cc[5], stripQuotes(cc[6]));
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            console.log("I am here27");
                            add_error('Ill-formed replace string command. Incorrect number of arguments. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                        }
                    } else if (cc[1] == 'role') {
                        console.log("I am here28");
                        if (cc.length == 8) {
                            replace_role(cc[2], cc[3], cc[4], cc[5], cc[6], cc[7]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            add_error('Ill-formed replace role command. Incorrect number of arguments. Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
                        }
                    } else if (cc[1] == 'variable') {
                        console.log("I am here29");
                        if (cc.length == 8) {
                            replace_variable(cc[2], cc[3], cc[4], cc[5], cc[6], cc[7]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            add_error('Ill-formed replace role command. Incorrect number of arguments. Usage: replace variable at &lt;var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                        }
                    } else {
                        add_error('Ill-formed replace command. First argument should be the type of AMR element to be replaced: concept, string or role');
                    }
                } else if (key1 == 'delete') {
                    console.log("I am here30");
                    if (cc.length == 4) {
                        if ((cc[1] == 'top') && (cc[2] == 'level')) {
                            delete_top_level(cc[3]);
                        } else {
                            delete_based_on_triple(cc[1], cc[2], cc[3]);
                        }
                        if (amr_is_empty()) {
                            selectTemplate('clear');
                        } else {
                            selectTemplate('delete');
                        }
                        show_amr_args = 'show delete';
                    } else {
                        add_error('Ill-formed delete command. Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
                    }
                } else if ((key1 == 'move') || (key1 == 'mv')) {
                    console.log("I am here31");
                    if (cc.length >= 4) {
                        if (cc[2] == 'to') {
                            if (cc.length == 4) {
                                move_var_elem(cc[1], cc[3], '');
                                show_amr_args = 'show';
                            } else if (cc.length == 5) {
                                move_var_elem(cc[1], cc[3], cc[4]);
                                show_amr_args = 'show';
                            } else {
                                add_error('Ill-formed move command. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
                            }
                        } else {
                            add_error('Ill-formed move command. Second argument should be <i>to</i>. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
                        }
                    } else {
                        add_error('Ill-formed move command. Not enough arguments. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
                    }
                    /** maybe can delete? **********************************************************************************************************************/
                    // } else if (key1 == 'sg') {
                    //     sg();
                    //     top = 0;
                    // } else if (key1 == 'sa') {
                    //     for (var i = 1; i < cc.length; i++) {
                    //         sa(cc[i]);
                    //     }
                    //     top = 0;
                    // } else if (key1 == 'sv') {
                    //     for (var i = 1; i < cc.length; i++) {
                    //         sv(cc[i]);
                    //     }
                    //     top = 0;
                    // } else if (key1 == 'sc') {
                    //     for (var i = 1; i < cc.length; i++) {
                    //         sc(cc[i]);
                    //     }
                    //     top = 0;
                    // } else if (key1 == 'cm') {
                    //     for (var i = 1; i < cc.length; i++) {
                    //         show_concept_mapping(cc[i]); // originially for inspection (testing and debugging)
                    //     }
                    //     top = 0;
                    // } else if (key1 == 'sid') {
                    //     show_AMR_editor_login();
                    //     top = 0;
                    // } else if (key1.match(/^(logout|exit|quit)$/i)) {
                    //     logout(0);
                    //     top = 0;
                    // } else if (key1 == 'login') {
                    //     logout(1);
                    //     top = 0;
                } else if ((cc.length >= 2) && cc[1].match(/^:/)) {
                    console.log("I am here32");
                    if ((cc[0].match(/^[a-z]\d*$/)) && !getLocs(cc[0])) {
                        add_error('In <i>add</i> command, <font color="red">' + cc[0] + '</font> is not last_command defined variable.');
                    } else if (cc.length == 2) {
                        add_error('In <i>add</i> command, there must be at least 3 arguments.');
                    } else {
                        add_error('Unrecognized <i>add</i> command.');
                    }
                } else if (value.match(/^record /i)) { //TODO unclear
                    console.log("I am here33");
                    record_value = value.replace(/^record\s*/, "");
                } else {
                    console.log("I am here34");
                    if (!value.match(/^(h|help)\b/i)) {
                        add_error('Unrecognized command: <font color="red">' + value + '</font>');
                    }
                    selectTemplate('help');
                    top = 0;
                }
            }

            if (top) {// the undo and redo up right corner
                console.log("I am here35");
                record_value = record_value || value;
                // value: "b :arg1 car"
                // last_command.innerHTML = record_value;
                show_amr(show_amr_args);
                // show_amr_args:'show'
                if (state_has_changed_p) {
                    console.log("I am here36");
                    var old_state = undo_list[undo_index];
                    old_state['action'] = record_value;
                    undo_index++;
                    undo_list.length = undo_index;
                    undo_list[undo_index] = cloneCurrentState();
                    var s;
                    if ((s = document.getElementById('undo-button')) != null) {
                        s.title = 'undo ' + record_value;
                    }
                    if ((s = document.getElementById('redo-button')) != null) {
                        s.title = 'currently nothing to redo';
                    }
                    state_has_changed_p = 0;
                }
            }
            command_input.value = '';
            // if (show_amr_obj['option-resize-command'])
            command_input.style.height = '1.4em';
        }
    }
    //traverse amr to print the alignment info, and change doc level annotation variables
    // amr['2.v'] = 's2';
    var alignInfo = document.getElementById('align');
    var alignment_string = '';
    Object.keys(amr).forEach(function(key) {
        if(/[\\d|\\.]+c/gm.test(key) && amr[key]){
            // alignment_string += amr[key] + ": " + amr[key.replace('c', 'a')] + htmlSpaceGuard('\n');
            alignment_string += (amr[key] + ": " + amr[key.replace('c', 'a')] + htmlSpaceGuard('\n')).replace(/undefined/g, 'inferred');
        }

        // if(String(amr[key]).charAt(0)=='2'){
        //     if(/[\\d|\\.]+v/gm.test(key)){
        //         if(amr[key]!=='s2'){
        //             amr[key] = 's2' + amr[key];
        //         }
        //     }
        // }
    });
    alignInfo.innerHTML = htmlSpaceGuard('\n') + alignment_string;
}

/** log ******************************************************/
function add_message(type, message) {
    var s, old_value, new_value;
    if ((s = document.getElementById(type)) != null) {
        if (type == 'edit-log') {
            old_value = s.value;
        } else {
            old_value = s.innerHTML;
        }

        if (old_value) {
            new_value = old_value + '<br>\n' + message;
        } else {
            new_value = message;
        }

        if (type == 'edit-log') {
            s.value = new_value;
        } else {
            s.innerHTML = new_value;
        }
    }
}

function add_log(message) {
    // console.log("add_log is called");
    add_message('log', message);
}

function add_error(message) {
    add_log('error', '<font color="red">Error:</font> &nbsp; ' + message);
}

function add_unique_log(message) {
    // don't show message if it has been shown before
    if (!previous_log_messages[message]) {
        add_log(message);
        previous_log_messages[message] = 1;
    }
}

function set_guidance(message) {
    add_guidance(message);
}


function add_guidance(message) {
    if (show_amr_obj['option-provide-guidance']) {
        add_message('guidance', message);
    }
}


/** add ******************************************************/
/**
 * add a new (or existing) key value pair (variable: loc) to the variables dictionary
 * @param v 'b'
 * @param loc "1.1.3"
 */
function recordVariable(v, loc) {
    if ((v != undefined) && (v != '')) {
        var old_value = getLocs(v);
        if (old_value) {
            variables[v] = old_value + ' ' + loc;
        } else {
            variables[v] = loc + '';
        }
        // var new_value = getLocs(v);
        // add_log('variable locs for ' + v + ': ' + new_value);
    }
}

/**
 * add a new (or existing) key value pair (concept: loc) to the concepts dictionary
 * @param c 'boy'
 * @param loc "1.1.3"
 */
function recordConcept(c, loc) {
    if ((c != undefined) && (c != '')) {
        var old_value = concepts[c];
        if (old_value) {
            concepts[c] = old_value + ' ' + loc;
        } else {
            concepts[c] = loc;
        }
        var new_value = concepts[c];
        // add_log('concept locs for ' + c + ': ' + new_value);
    }
}

/**
 * given concept return variable
 * @param concept
 * @returns {string} variable (initial)
 */
function newVar(concept) {
    var v;
    concept = concept.replace(/^[:*!]([a-z])/i, "$1"); //why is this?
    var initial = concept.substring(0, 1).toLowerCase();
    if (!initial.match(/[a-z]/)) {
        initial = 'x';
    }
    // reserve variable 'i' for concept 'i'
    if (getLocs(initial) || reserved_variables[initial] || concept.match(/^i./i)) {
        var index = 2;
        v = initial + index;
        while (getLocs(v) || reserved_variables[v]) {
            index++;
            v = initial + index;
        }
    } else {
        v = initial;
    }

    if(amr['n']>1){
        v = 'S2' + v;
    }
    return v;
}

/**
 * this might related to the shortcut user typed in, only called in exec_command
 * @param s unclear
 * @param type could be "string", "concept", or "delete"
 * @returns {Array} user typed locs
 */
function user_descr2locs(s, type) {
    s = s.replace(/\s+with$/, "");
    var cc = argSplit(s);
    var var_locs;
    var result_locs = [];
    var sloppy_locs = [];
    var error_p = 0;
    if ((cc.length == 1) && (var_locs = getLocs(cc[0]))) {
        var loc_list = argSplit(var_locs);
        result_locs.push(loc_list[0]);
    } else {
        var parent_variable = '';
        var role = '';
        var variable = '';
        var string_or_concept = '';
        for (var i = 0; i < cc.length; i++) {
            if (getLocs(cc[i]) && (parent_variable == '') && (role == '') && (variable == '') && (string_or_concept == '')) {
                parent_variable = cc[i];
            } else if (cc[i].match(/^:[a-z]/i) && (role == '') && (variable == '') && (string_or_concept == '')) {
                role = cc[i];
            } else if ((role || parent_variable) && (variable == '') && (string_or_concept == '') && getLocs(cc[i])) {
                variable = cc[i];
            } else if (string_or_concept == '') {
                string_or_concept = cc[i];
                string_or_concept = string_or_concept.replace(/^!/, "");
                string_or_concept = string_or_concept.replace(/^"(.*)"$/, "$1");
            } else {
                error_p = 1;
            }
        }
        if (parent_variable && !(role || variable || string_or_concept)) {
            variable = parent_variable;
            parent_variable = '';
        }
        console.log('user_descr2locs parent_variable: ' + parent_variable + ' role: ' + role + ' variable: ' + variable + ' string_or_concept: ' + string_or_concept);
        for (var key in amr) {
            if (key.match(/\.v$/)) {
                var loc = key.replace(/\.v$/, "") + '';
                var loc_concept = amr[loc + '.c'] || '';
                var loc_role = amr[loc + '.r'] || '';
                var loc_string = amr[loc + '.s'] || '';
                var loc_variable = amr[loc + '.v'] || '';
                var loc_parent_variable = getParentVariable(loc + '');
                console.log('user_descr2locs - Point D loc: ' + loc + ' loc_concept: ' + loc_concept + ' string_or_concept: ' + string_or_concept);
                if (deleted_p(loc)
                    || ((type == 'role') && !loc_role)           // no role to be replaced (top level)
                    || ((type == 'string') && !loc_string)         // no string to be replaced
                    || ((type == 'concept') && !loc_concept)        // no concept to be replaced
                    || ((type == 'variable') && !loc_variable)) {    // no variable to be replaced
                    // no match -> do nothing
                } else if (((parent_variable == '') || (parent_variable == loc_parent_variable))
                    && ((role == '') || (role.toLowerCase() == loc_role.toLowerCase()))
                    && ((variable == '') || (variable == loc_variable))
                    && ((string_or_concept == '') || (string_or_concept == loc_string) || (string_or_concept == loc_concept))) {
                    result_locs.push(loc);
                } else if (((parent_variable == '') || (parent_variable == loc_parent_variable))
                    && ((role == '') || sloppy_match(role, loc_role))
                    && ((variable == '') || (variable == loc_variable))
                    && ((string_or_concept == '') || sloppy_match(string_or_concept, loc_string) || sloppy_match(string_or_concept, loc_concept))) {
                    sloppy_locs.push(loc);
                }
            }
        }
    }
    console.log('user_descr2locs(' + s + '): ' + result_locs.join(", "));
    if (result_locs.length == 0) {
        return sloppy_locs;
    } else {
        return result_locs;
    }
}

/**
 * populate variables, concepts, variable2concept, and amr
 * @param concept "buy"
 * @returns {string} return a new amr head, "b"
 */
function newAMR(concept) {
    console.log("I am here37");
    var v = newVar(concept);
    console.log(amr);
    var n = amr['n']; // n is the variable number
    amr['n'] = ++n;
    amr[n + '.c'] = concept;
    amr[n + '.v'] = v;
    amr[n + '.n'] = 0;
    amr[n + '.s'] = '';
    amr[n + '.a'] = begOffset + "-" + endOffset;


    recordVariable(v, n);
    recordConcept(concept, n);
    variable2concept[v] = concept;
    state_has_changed_p = 1;
    console.log('new AMR: ' + concept + ' (' + n + ')' + ' var: ' + v);
    // console.log(amr);
    return v;
}

/**
 * takes in head, role, argument, argument type , and output the argument variable, and populate amr
 * @param head
 * @param role
 * @param arg
 * @param arg_type
 * @returns {*} arg_variable
 */
function add_triple(head, role, arg, arg_type) {
    head = strip(head); // b
    role = strip(role); // :arg1
    arg = strip(arg); //car
    // add_log('  add_triple ' + head + ' ' + role + ' ' + arg);
    var head_var_locs = getLocs(head); // buy-01
    var arg_var_locs;
    var arg_variable;
    var arg_concept;
    var arg_string;
    if (head && role && (arg != undefined) && (arg != '') && head_var_locs) {
        arg_var_locs = getLocs(arg);
        if (arg_var_locs && (arg_type != 'concept') && (arg_type != 'string')
            && (!role.match(/^:?(li|wiki)$/))) {
            console.log("I am here39");
            arg_variable = arg;
            arg_concept = '';
            arg_string = '';
        } else if (validEntryConcept(arg)
            && (arg_type != 'string') //I suspect this is the difference when arg is a concept or a string
            && (!role_unquoted_string_arg(role, arg, ''))
            && (!role.match(/^:?(li|wiki)$/))) {
            console.log("I am here40");
            arg_concept = trimConcept(arg);
            arg_variable = newVar(arg_concept);
            arg_string = '';
        } else if (validString(arg)) {
            console.log("I am here41");
            arg_string = arg; // car
            arg_concept = '';
            arg_variable = '';
        } else if (validString(stripQuotes(arg))) {
            console.log("I am here42");
            arg_string = stripQuotes(arg);
            arg_concept = '';
            arg_variable = '';
        } else {
            console.log("I am here43");
            add_error('Ill-formed command "' + head + ' ' + role + ' <font color="red">' + arg + '</font>" &nbsp; Last argument should be a concept, string or previously defined variable.');
            return '';
        }
        // head_var_locs += '';
        var head_var_loc_list = argSplit(head_var_locs);
        var head_var_loc = head_var_loc_list[0];
        var n_subs = amr[head_var_loc + '.n'];
        amr[head_var_loc + '.n'] = ++n_subs;
        // add_log('subs ' + head_var_loc + '.n: ' + n_subs);
        var new_loc = head_var_loc + '.' + n_subs;
        // add_log('adding ' + head + ' ' + role + ' ' + arg + ' ' + new_loc);
        role = autoTrueCaseRole(role);
        amr[new_loc + '.v'] = arg_variable;
        amr[new_loc + '.r'] = role;
        amr[new_loc + '.n'] = 0;
        amr[new_loc + '.c'] = arg_concept;
        amr[new_loc + '.s'] = arg_string;
        amr[new_loc + '.a'] = begOffset-1 + "-" + endOffset-1; // alignment_index


        recordVariable(arg_variable, new_loc);
        recordConcept(arg_concept, new_loc);
        variable2concept[arg_variable] = arg_concept;
        state_has_changed_p = 1;
        if (role.match(/^:op(-\d|0|\d+\.\d)/)) {
            console.log("I am here44");
            renorm_ops(head);
        }
        return arg_variable;
    } else {
        return '';
    }
}

function add_ne(value) {
    console.log("add_ne is called");
    // add_log('add_ne: ' + value);
    var cc = argSplit(value);
    var head_var = cc[0];
    var role = cc[1];
    var ne_type = cc[2];
    var name_var = '';
    var name_start = 3;
    if (role == ':name') {
        name_var = add_triple(head_var, role, 'name', 'concept');
        if (ne_type != 'name') {
            name_start = 2;
        }
    } else {
        var ne_arg_var = add_triple(head_var, role, ne_type, 'concept');
        if (ne_arg_var) {
            name_var = add_triple(ne_arg_var, ':name', 'name', 'concept');
        } else {
            add_error('Ill-formed add-ne command. Possibly a problem with argument ' + ne_type);
        }
    }
    if (name_var) {
        for (var i = name_start; i < cc.length; i++) {
            var sub_role = ':op' + (i - name_start + 1);
            add_triple(name_var, sub_role, cc[i], 'string');
        }
    }
}

/**
 * check if value is valid, add triple, if not, add error, :op appears here
 * @param value "b :mod pretty very much so"
 */
function addOr(value) {
    var cc = argSplit(value);
    var head_var = cc[0];
    var role = cc[1];
    var key_or = cc[2];
    var name_var = '';
    var ill_formed_concepts = [];
    var or_var;
    for (var i = 3; i < cc.length; i++) {
        if (!validEntryConcept(cc[i])) {
            ill_formed_concepts.push(cc[i]);
        }
    }
    if (ill_formed_concepts.length >= 2) {
        add_error('Ill-formed concepts following *OR*: ' + ill_formed_concepts.join(", "));
    } else if (ill_formed_concepts.length == 1) {
        add_error('Ill-formed concept following *OR*: ' + ill_formed_concepts[0]);
    } else {

        if (head_var == 'top') {
            or_var = newAMR(key_or);
        } else {
            or_var = add_triple(head_var, role, key_or, 'concept');
        }
        if (or_var) { // when cc is longer than 3, the rest elements are ops
            for (var i = 3; i < cc.length; i++) {
                var sub_role = ':op' + (i - 2);
                add_triple(or_var, sub_role, cc[i], 'concept');
            }
        }
    }
}

/** replace ******************************************************/
function replace_concept(key_at, head_var, key_with, new_concept) {
    // add_edit_log('replace_concept ' + key_at + '::' + head_var + '::' + key_with + '::' + new_concept);
    new_concept = new_concept.replace(/\.(\d+)$/, "-$1");  // build.01 -> build-01
    if (key_at == 'at') {
        var head_var_locs = getLocs(head_var);
        if (head_var_locs) {
            if (key_with == 'with') {
                if (validEntryConcept(new_concept)) {
                    head_var_locs += '';
                    var loc_list = argSplit(head_var_locs);
                    var loc = loc_list[0];
                    var old_concept = amr[loc + '.c'];
                    amr[loc + '.c'] = trimConcept(new_concept);
                    change_var_name(head_var, new_concept, 0);
                    state_has_changed_p = 1;
                    // add_log('replace concept at ' + head_var + ': ' + old_concept + ' &rarr; ' + new_concept);
                } else {
                    add_error('Ill-formed replace concept command. Last argument should be a valid concept. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
                }
            } else {
                add_error('Ill-formed replace concept command. Fourth argument should be "with". Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
            }
        } else {
            add_error('Ill-formed replace concept command. Third argument should be a defined variable. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
        }
    } else {
        add_error('Ill-formed replace concept command. Second argument should be "at". Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
    }
}

function replace_string(key_at, head_var, role, key_with, new_string) {
    console.log("replace_string is called");
    // add_edit_log('replace_string ' + key_at + '::' + head_var + '::' + role + '::' + key_with + '::' + new_string);
    if (key_at == 'at') {
        var head_var_locs = getLocs(head_var);
        if (head_var_locs) {
            if (role.match(/^:[a-z]/i)) {
                if (key_with == 'with') {
                    if (validString(new_string)) {
                        // add_log('replace_string: ' + head_var + ' ' + role + ' ' + new_string);
                        head_var_locs += '';
                        var head_var_loc_list = argSplit(head_var_locs);
                        var head_var_loc = head_var_loc_list[0];
                        var n_subs = amr[head_var_loc + '.n'];
                        var string_loc = '';
                        for (var i = 1; i <= n_subs; i++) {
                            if (string_loc == '') {
                                var sub_loc = head_var_loc + '.' + i;
                                var sub_role = amr[sub_loc + '.r'];
                                if (sub_role == role) {
                                    string_loc = sub_loc;
                                }
                            }
                        }
                        if (string_loc) {
                            var old_string = amr[string_loc + '.s'];
                            amr[string_loc + '.s'] = new_string;
                            state_has_changed_p = 1;
                            // add_log('replace string at ' + head_var + ' ' + role + ': ' + old_string + ' &rarr; ' + new_string);
                        } else {
                            add_error('In replace string command, could not find role <font color="red">' + role + '</font> under variable ' + head_var);
                        }
                    } else {
                        add_error('Ill-formed replace string command. Last argument (<font color="red">' + new_string + '</font>) should be a valid string. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                    }
                } else {
                    add_error('Ill-formed replace string command. Fifth argument should be "with". Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                }
            } else {
                add_error('Ill-formed replace string command. Fourth argument should be a role starting with a colon. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
            }
        } else {
            add_error('Ill-formed replace string command. Third argument should be a defined variable. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
        }
    } else {
        add_error('Ill-formed replace string command. Second argument should be "at". Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
    }
}

function replace_role(key_at, head_var, old_role, arg, key_with, new_role) {
    console.log("replace_role is called");
    // add_edit_log('replace_role ' + key_at + '::' + head_var + '::' + old_role + '::' + arg + '::' + key_with + '::' + new_role);
    new_role = strip(new_role);
    if (key_at == 'at') {
        var head_var_locs = getLocs(head_var);
        if (head_var_locs) {
            if (old_role.match(/^:[a-z]/i)) {
                if (getLocs(arg) || validEntryConcept(arg) || validString(stripQuotes(arg))) {
                    if (key_with == 'with') {
                        if (new_role.match(/^:[a-z]/i)) {
                            // add_log('replace_role: ' + head_var + ' ' + old_role + ' ' + arg + ' ' + new_role);
                            head_var_locs += '';
                            var head_var_loc_list = argSplit(head_var_locs);
                            var head_var_loc = head_var_loc_list[0];
                            var n_subs = amr[head_var_loc + '.n'];
                            var role_arg_loc = '';
                            var arg2 = stripQuotes(arg);
                            var arg3 = trimConcept(arg);
                            for (var i = 1; i <= n_subs; i++) {
                                if (role_arg_loc == '') {
                                    var sub_loc = head_var_loc + '.' + i;
                                    var sub_role = amr[sub_loc + '.r'];
                                    if ((!amr[sub_loc + '.d'])
                                        && (sub_role == old_role)) {
                                        var arg_variable = amr[sub_loc + '.v'];
                                        var arg_concept = amr[sub_loc + '.c'];
                                        var arg_string = amr[sub_loc + '.s'];
                                        if ((arg_variable && (arg == arg_variable))
                                            || (arg_concept && (arg == arg_concept))
                                            || (arg_concept && (arg3 == arg_concept))
                                            || ((arg_string != undefined) && (arg2 == arg_string))) {
                                            role_arg_loc = sub_loc;
                                        }
                                    }
                                }
                            }
                            if (role_arg_loc) {
                                var old_role = amr[role_arg_loc + '.r'];
                                new_role = autoTrueCaseRole(new_role);
                                amr[role_arg_loc + '.r'] = new_role;
                                if (new_role.match(/^:op(-\d|0|\d+\.\d)/)) {
                                    renorm_ops(head_var);
                                }
                                state_has_changed_p = 1;
                                // add_log('replace role at ' + head_var + ' ' + old_role + ' ' + arg + ': ' + old_role + ' &rarr; ' + new_role);
                            } else {
                                add_error('In replace role command, could not find role/arg <font color="red">' + old_role + ' ' + arg + '</font> under variable ' + head_var);
                            }
                        } else {
                            add_error('Ill-formed replace role command. Last argument should be a valid role (starting with a colon). Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
                        }
                    } else {
                        add_error('Ill-formed replace role command. Sixth argument should be "with". Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
                    }
                } else {
                    add_error('Ill-formed replace role command. Fifth argument should be an arg (variable, concept, string, or number). Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
                }
            } else {
                add_error('Ill-formed replace role command. Fourth argument should be a role starting with a colon. Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
            }
        } else {
            add_error('Ill-formed replace role command. Third argument should be a defined variable. Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
        }
    } else {
        add_error('Ill-formed replace role command. Second argument should be "at". Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
    }
}

function replace_variable(key_at, head_var, role, old_variable, key_with, new_variable) {
    console.log("replace_variable is called");

    // add_edit_log('replace_variable ' + key_at + '::' + head_var + '::' + role + '::' + old_variable + '::' + key_with + '::' + new_variable);
    if (key_at == 'at') {
        var head_var_locs = getLocs(head_var);
        if (head_var_locs) {
            if (role.match(/^:[a-z]/i)) {
                if (getLocs(old_variable)) {
                    if (key_with == 'with') {
                        if (getLocs(new_variable)) {
                            // add_log('replace_variable: ' + head_var + ' ' + role + ' ' + old_variable + ' ' + new_variable);
                            head_var_locs += '';
                            var head_var_loc_list = argSplit(head_var_locs);
                            var head_var_loc = head_var_loc_list[0];
                            var n_subs = amr[head_var_loc + '.n'];
                            var role_arg_loc = '';
                            for (var i = 1; i <= n_subs; i++) {
                                if (role_arg_loc == '') {
                                    var sub_loc = head_var_loc + '.' + i;
                                    var sub_role = amr[sub_loc + '.r'];
                                    if ((!amr[sub_loc + '.d'])
                                        && (sub_role == role)) {
                                        var sub_variable = amr[sub_loc + '.v'];
                                        if (sub_variable && (old_variable == sub_variable)) {
                                            role_arg_loc = sub_loc;
                                        }
                                    }
                                }
                            }
                            if (role_arg_loc) {
                                var sub_concept = amr[role_arg_loc + '.c'];
                                if (sub_concept) {
                                    add_error('Ill-formed replace variable command. Fifth argument should be a <span style="text-decoration:underline;">secondary</span> variable, i.e. a leaf argument without its own concept. Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                                } else {
                                    amr[role_arg_loc + '.v'] = new_variable;
                                    state_has_changed_p = 1;
                                    // add_log('replace variable at ' + head_var + ' ' + role + ' ' + old_variable + ': ' + old_variable + ' &rarr; ' + new_variable);
                                }
                            } else {
                                add_error('In replace variable command, could not find role/variable <font color="red">' + role + ' ' + old_variable + '</font> under variable ' + head_var);
                            }
                        } else {
                            add_error('Ill-formed replace variable command. Last argument should be a defined variable. Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                        }
                    } else {
                        add_error('Ill-formed replace variable command. Sixth argument should be "with". Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                    }
                } else {
                    add_error('Ill-formed replace variable command. Fifth argument should be a variable. Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                }
            } else {
                add_error('Ill-formed replace variable command. Fourth argument should be a role starting with a colon. Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
            }
        } else {
            add_error('Ill-formed replace variable command. Third argument should be a defined variable. Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
        }
    } else {
        add_error('Ill-formed replace variable command. Second argument should be "at". Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
    }
}

/** delete ******************************************************/
/**
 * TODO unclear
 * @param loc
 * @returns {number}
 */
function deleted_p(loc) {
    while (1) {
        if (amr[loc + '.d']) {
            return 1;
        } else if (loc.match(/\d\.\d+$/)) {
            loc = loc.replace(/\.\d+$/, "");
        } else {
            return 0;
        }
    }
}

function delete_elem(loc) {
    // add_log('delete_elem ' + loc);
    var locs, concept, variable;
    amr[loc + '.d'] = 1;
    state_has_changed_p = 1;
    if ((variable = amr[loc + '.v'])
        && (locs = getLocs(variable))) {
        locs += '';
        var loc_list = argSplit(locs);
        var new_loc_list = [];
        for (var i = 0; i < loc_list.length; i++) {
            var loc_i = loc_list[i];
            if (loc_i != loc) {
                new_loc_list.push(loc_i + '');
            }
        }
        if ((new_loc_list.length >= 1)
            && (!amr[new_loc_list[0] + '.c'])
            && (concept = amr[loc + '.c'])) {
            amr[new_loc_list[0] + '.c'] = concept;
        }
        variables[variable] = new_loc_list.join(" ");
    }

    if ((concept = amr[loc + '.c'])
        && (locs = concepts[concept])) {
        locs += '';
        var loc_list = argSplit(locs);
        var new_loc_list = [];
        for (var i = 0; i < loc_list.length; i++) {
            var loc_i = loc_list[i];
            if (loc_i != loc) {
                new_loc_list.push(loc_i + '');
            }
        }
        concepts[concept] = new_loc_list.join(" ");
    }
}

/**
 * TODO unclear
 * @param loc
 */
function delete_rec(loc) {
    // add_log('delete_rec ' + loc);
    delete_elem(loc);
    var n_subs = amr[loc + '.n'];
    for (var i = 1; i <= n_subs; i++) {
        var sub_loc = loc + '.' + i;
        if (!amr[sub_loc + '.d']) {
            delete_rec(sub_loc);
        }
    }
}

function delete_based_on_triple(head_var, role, arg) {
    // add_log('delete ' + head_var + ' ' + role + ' ' + arg);
    var head_var_locs = getLocs(head_var);
    if (head_var_locs) {
        if (role.match(/^:[a-z]/i)) {
            if (getLocs(arg) || validEntryConcept(arg) || validString(stripQuotes(arg))) {
                // add_log('delete_based_on_triple: ' + head_var + ' ' + role + ' ' + arg);
                head_var_locs += '';
                var head_var_loc_list = argSplit(head_var_locs);
                var head_var_loc = head_var_loc_list[0];
                var n_subs = amr[head_var_loc + '.n'];
                var loc = '';
                var arg2 = stripQuotes(arg);
                var arg3 = trimConcept(arg);
                for (var i = 1; i <= n_subs; i++) {
                    if (loc == '') {
                        var sub_loc = head_var_loc + '.' + i;
                        var sub_role = amr[sub_loc + '.r'];
                        if ((!amr[sub_loc + '.d'])
                            && (sub_role == role)) {
                            var arg_variable = amr[sub_loc + '.v'];
                            var arg_concept = amr[sub_loc + '.c'];
                            var arg_string = amr[sub_loc + '.s'];
                            if ((arg_variable && (arg == arg_variable))
                                || (arg_concept && (arg == arg_concept))
                                || (arg_concept && (arg3 == arg_concept))
                                || ((arg_string != undefined) && (arg2 == arg_string))) {
                                loc = sub_loc;
                            }
                        }
                    }
                }
                delete_rec(loc);
            } else {
                add_error('Ill-formed delete command. Last argument should be an arg (variable, concept, string, or number). Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
            }
        } else {
            add_error('Ill-formed delete command. Second argument should be a valid role (starting with a colon). Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
        }
    } else {
        add_error('Ill-formed delete command. First argument should be a defined variable. Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
    }
}

function delete_top_level(variable) {
    console.log("delete_top_level is called");
    // add_log('delete_top_level ' + variable);
    var loc, locs, loc_list;
    if (locs = getLocs(variable)) {
        locs += '';
        var tmp_loc_list = argSplit(locs);
        if ((loc_list = argSplit(locs))
            && (loc_list.length >= 1)
            && (loc = loc_list[0])
            && loc.match(/^\d+$/)) {
            delete_rec(loc);
        } else {
            add_error('Could not find top level AMR with variable ' + variable);
        }
    } else {
        add_error('Ill-formed delete top level command. Third argument should be a defined variable. Usage: delete rtop level &lt;var&gt;');
    }
}

/**
 * delete the whole thing
 */
function deleteAMR() {
    var n = amr['n'];
    for (var i = 1; i <= n; i++) {
        delete_elem(i);
    }
    resetProps();
    applyProps();
    state_has_changed_p = 1;
    selectTemplate('clear');
    show_amr('show');
    exec_command('record delete amr', 1);
}


/** move ******************************************************/
function move_var_elem(variable, new_head_var, role) {
    // add_log('move ' + variable + ' ' + new_head_var + ' ' + role);
    var loc, locs, loc_list, head_var_loc, head_var_locs, head_var_loc_list;
    if (locs = getLocs(variable)) {
        locs += '';
        if ((head_var_locs = getLocs(new_head_var))
            || ((new_head_var == 'top') && (head_var_locs = 'top'))) {
            head_var_locs += '';
            if ((role == '') || role.match(/^:[a-z]/i)) {
                if ((loc_list = argSplit(locs))
                    && (loc_list.length >= 1)
                    && (loc = loc_list[0])) {
                    if (role || (new_head_var == 'top') || (role = amr[loc + '.r'])) {
                        if ((head_var_loc_list = argSplit(head_var_locs))
                            && (head_var_loc_list.length >= 1)
                            && (head_var_loc = head_var_loc_list[0])) {
                            var n_subs, new_loc;
                            if (head_var_loc == 'top') {
                                n_subs = amr['n'];
                                amr['n'] = ++n_subs;
                                new_loc = n_subs;
                            } else {
                                n_subs = amr[head_var_loc + '.n'];
                                amr[head_var_loc + '.n'] = ++n_subs;
                                new_loc = head_var_loc + '.' + n_subs;
                            }
                            // add_log('move core ' + loc + ' ' + head_var_loc + ' ' + new_loc);
                            for (var key in amr) {
                                var re1 = '^' + regexGuard(loc) + '(\\.(\\d+\\.)*[a-z]+)$';
                                var re2 = new_loc + '$1';
                                var new_key = key.replace(new RegExp('^' + regexGuard(loc) + '(\\.(\\d+\\.)*[a-z]+)$', ""), new_loc + '$1');
                                // add_log('   key: ' + key + ' re1: ' + re1 + ' re2: ' + re2 + ' new_key: ' + new_key);
                                if (new_key != key) {
                                    amr[new_key] = amr[key];
                                    // add_log('move amr update: ' + key + '&rarr; ' + new_key);
                                }
                            }
                            amr[new_loc + '.r'] = autoTrueCaseRole(role);
                            amr[loc + '.d'] = 1;
                            state_has_changed_p = 1;
                            for (var key in variables) {
                                var old_value = getLocs(key);
                                var old_value2 = ' ' + old_value + ' ';
                                var new_value = strip(old_value2.replace(new RegExp(' ' + regexGuard(loc) + '((\\.\\d+)*)' + ' ', ""), ' ' + new_loc + '$1 '));
                                if (old_value != new_value) {
                                    variables[key] = new_value;
                                    // add_log('move variable update for ' + key + ': ' + old_value + ' &rarr; ' + new_value);
                                }
                            }
                            for (var key in concepts) {
                                var old_value = concepts[key];
                                var old_value2 = ' ' + old_value + ' ';
                                var new_value = strip(old_value2.replace(new RegExp(' ' + regexGuard(loc) + '((\\.\\d+)*)' + ' ', ""), ' ' + new_loc + '$1 '));
                                if (old_value != new_value) {
                                    concepts[key] = new_value;
                                    // add_log('move concept update for ' + key + ': ' + old_value + ' &rarr; ' + new_value);
                                }
                            }
                        } else {
                            add_error('Could not find AMR with variable ' + new_head_var);
                        }
                    } else {
                        add_error('Ill-formed move command. To move the tree of variable ' + variable + ', a fourth argument is neccessary to provide a proper role, starting with a colon. Usage: move &lt;var&gt; to &lt;new-head-var&gt; &lt;role&gt;');
                    }
                } else {
                    add_error('Could not find AMR with variable ' + variable);
                }
            } else {
                add_error('Ill-formed move command. Fourth argument should be a role starting with a colon. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
            }
        } else {
            add_error('Ill-formed move command. Third argument should be a defined variable. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
        }
    } else {
        add_error('Ill-formed move command. First argument should be a defined variable. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
    }
}

/**
 * in dictionary variables, the original key will be assigned empty value, the new key will be assigned original value
 {o: "1", r: "1.1", b: "1.1.1", c: "1.1.1.2"} -> {o: "1", r: "", b: "1.1.1", c: "1.1.1.2", r1: "1.1"}
 */
function change_var_name(variable, target, top) {
    console.log("change_var_name is called");
    // For whole set. Target can be var or concept.
    // add_log('change_var_name ' + variable + ' ' + target);
    var locs, new_variable;
    if (locs = getLocs(variable)) {
        variables[variable] = '';
        if ((target.match(/^[a-z]\d*$/))
            && (!getLocs(target))) {
            new_variable = target;
        } else {
            new_variable = newVar(target);
        }
        var loc_list = argSplit(locs);
        for (var i = 0; i < loc_list.length; i++) {
            loc = loc_list[i];
            amr[loc + '.v'] = new_variable;
            recordVariable(new_variable, loc);
        }
        // add_log('  variable changed to ' + new_variable);
        state_has_changed_p = 1;
        exec_command('record change variable ' + variable + ' ' + target, top);
        return new_variable;
    }
    return 0;
}

/** unclear ******************************************************/
function renorm_ops(variable) {
    var locs, loc_list, loc, n_subs, sub_loc, sub_role, op_numbers, op_ht, op_number;
    if ((locs = getLocs(variable))
        && (loc_list = argSplit(locs))
        && (loc = loc_list[0])) {
        n_subs = amr[loc + '.n'];
        op_numbers = [];
        op_ht = {};
        for (var i = 1; i <= n_subs; i++) {
            sub_loc = loc + '.' + i;
            if (!amr[sub_loc + '.d']) {
                sub_role = amr[sub_loc + '.r'];
                if (sub_role.match(/^:op-?\d+(\.\d+)?$/)) {
                    op_number = sub_role.replace(/^:op(-?\d+(?:\.\d+)?)$/, "$1");
                    op_numbers.push(op_number);
                    op_ht[op_number] = sub_loc;
                    // add_log('set op_ht[' + op_number + '] = ' + sub_loc);
                }
            }
        }
        // add_log('renorm_ops ' + op_numbers.join(','));
        op_numbers.sort(function (a, b) {
            return a - b
        });
        // add_log('renorm_ops (sorted) ' + op_numbers.join(','));
        for (var i = 0; i < op_numbers.length; i++) {
            op_number = op_numbers[i];
            sub_loc = op_ht[op_number];
            // add_log('get op_ht[' + op_number + '] = ' + sub_loc);
            amr[sub_loc + '.r'] = ':op' + (i + 1);
        }
        state_has_changed_p = 1;
        exec_command('record reop ' + variable, 1);
    }
}

/**
 *
 * @param loc
 * @returns {number} number of nodes including the current loc
 */
function number_of_nodes(loc) {
    var n_nodes = 0;
    if (!amr[loc + '.d']) {
        n_nodes++;
        var n = amr[loc + '.n'];
        for (var i = 1; i <= n; i++) {
            n_nodes += number_of_nodes(loc + '.' + i);
        }
    }
    return n_nodes;
}

function leafy_or_concept_p(loc) {
    var concept = amr[loc + '.c'];
    if (concept == '*OR*') {
        var n = amr[loc + '.n'];
        var leafy2_p = 1;
        for (var i = 1; i <= n; i++) {
            var sub_loc = loc + '.' + i;
            if (amr[sub_loc + '.r'].match(/^:op/)
                && (number_of_nodes(sub_loc) > 2)) {
                leafy2_p = 0;
            }
        }
        return leafy2_p;
    } else {
        return 0;
    }
}

/**
 * decide if this new concept amr should be on the same line with parent and grandparent or not
 * @param loc: 1.1
 * @returns {number}
 */
function show_amr_new_line_p(loc) {
    var variable = amr[loc + '.v'];
    var concept = amr[loc + '.c'];
    var string = amr[loc + '.s'];
    var role = amr[loc + '.r'] || '';
    var head_loc = '';
    var head_concept = '';
    var head_role = '';
    var n = '';
    var grand_head_loc = '';
    var grand_head_concept = '';
    if (loc.match(/\.\d+$/)) {
        head_loc = loc.replace(/\.\d+$/, "");
        head_concept = amr[head_loc + '.c'] || '';
        head_role = amr[head_loc + '.r'] || '';
        n = amr[head_loc + '.n'];
        if (head_loc.match(/\.\d+$/)) {
            grand_head_loc = head_loc.replace(/\.\d+$/, "");
            grand_head_concept = amr[grand_head_loc + '.c'] || '';
        }
    }
    if (role.match(/^:ARG\d+$/)) {
        return 1;
    } else if (show_amr_obj['option-string-args-with-head'] && (string != '') && (variable == '')) {
        return 0;
    } else if (show_amr_obj['option-1-line-NEs']
        && ((head_concept.match(/-ne$/i) && role.match(/^:op\d+$/i))
            || (grand_head_concept.match(/-ne$/i) && head_role.match(/^:op\d+$/i)))) {
        return 0;
    } else if (show_amr_obj['option-1-line-NEs']
        && (role.match(/^:name$/i) || head_role.match(/^:name$/i))) {
        return 0;
    } else if (show_amr_obj['option-1-line-ORs']
        && ((role.match(/^:op\d+$/i) && leafy_or_concept_p(head_loc))
            || (head_role.match(/^:op\d+$/i) && leafy_or_concept_p(grand_head_loc)))) {
        return 0;
    } else {
        return 1;
    }
}

/**
 *
 * @param role: :op
 * @param arg: something
 * @param loc: 1
 * @returns {number}
 */
function role_unquoted_string_arg(role, arg, loc) {
    var head_loc = '';
    var head_concept = '';
    var head_role = '';
    if (loc.match(/\.\d+$/)) {
        head_loc = loc.replace(/\.\d+$/, "");
        head_concept = amr[head_loc + '.c'] || '';
        head_role = amr[head_loc + '.r'] || '';
    }
    if (role.match(/^:op/) && (head_role == ':name')) {
        return 0;
    } else if (arg.match(/^\d+(?:\.\d+)?$/)       // number
        || arg.match(/^(-|\+)$/)     // polarity/unknown
        || ((role == ':mode') && arg.match(/^(expressive|interrogative|imperative)$/))) {
        return 1;
    } else {
        return 0;
    }
}

function tolerate_special_concepts(s) {
    console.log("tolerate_special_concepts is called");
    if (s.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|I|\*OR\*)$/)) {
        return 1;
    }
    if (s.match(/^:[a-z]/i)) {
        return 1;
    }
    return 0;
}

/**
 * @param loc nth root in amr
 * @param args "show"
 * @param rec 0
 * @param ancestor_elem_id_list " "
 * @returns {string} returns a html string that represents the penman format
 */
function show_amr_rec(loc, args, rec, ancestor_elem_id_list) {
    // loc=1, args="show", rec=0, ancestor_elem_id_list=' '
    // add_log('show AMR rec: ' + loc);

    loc += '';
    if (amr[loc + '.d']) {
        // add_log('show AMR rec deleted: ' + loc);
        return '';
    } else {
        var concept = amr[loc + '.c'];
        var alignment_index = amr[loc + '.a'];
        var string = amr[loc + '.s'] || '';
        var quoted_string = string;
        if (!string.match(/^".*"$/)) {
            quoted_string = '"' + string + '"';
        }
        var protected_string = string;
        if (string.match(/ /)) {
            protected_string = quoted_string;
        }
        var protected_string2 = slashProtectQuote(protected_string);
        var role = amr[loc + '.r'] || '';
        var string_m = string;
        var string_is_number = string.match(/^\d+(?:\.\d+)?$/);
        if (!role_unquoted_string_arg(role, string, loc)) {
            string_m = quoted_string;
        }
        var variable = amr[loc + '.v'];
        var arg = variable || concept || string;
        var s = '';
        var show_replace = args.match(/replace/);
        var show_delete = args.match(/delete/);
        var show_check = args.match(/check/)
            || (show_amr_obj['option-auto-check'] && (!show_replace) && (!show_delete));
        var concept_m = concept;
        var variable_m = variable;
        var tree_span_args = '';
        var role_m = '';
        var elem_id = '';
        var onmouseover_fc = '';
        var onmouseout_fc = '';
        var onclick_fc = '';
        var head_loc, head_concept, head_variable, core_concept, var_locs;

        if (max_show_amr_ops-- <= 0) {
            return 'MAXXED OUT';
        }
        if (rec) {
            role = amr[loc + '.r'];
            role_m = role;
            if (show_replace) {
                var type = 'role';
                head_loc = loc.replace(/\.\d+$/, "");
                head_variable = amr[head_loc + '.v'];
                var at = head_variable + ' ' + role + ' ' + arg;
                var old_value = role;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                role_m = '<span id="' + elem_id + '" title="click to change me" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + role + '</span>';
            }
        }
        if (show_delete) {
            var n_elems_w_id = 0;

            elem_id = 'amr_elem_' + ++n_elems_w_id;
            onmouseover_fc = 'color_all_under_amr_elem(\'' + elem_id + '\',\'#FF0000\',\'mo\')';
            onmouseout_fc = 'color_all_under_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
            if (rec) {
                head_loc = loc.replace(/\.\d+$/, "");
                head_variable = amr[head_loc + '.v'];
                onclick_fc = 'fillDeleteTemplate(\'' + head_variable + ' ' + role + ' ' + arg + '\',\'' + elem_id + '\')';
            } else {
                onclick_fc = 'fillDeleteTemplate(\'top level ' + variable + '\',\'' + elem_id + '\')';
            }
            show_amr_obj['elem-' + elem_id] = elem_id;
            var list = ancestor_elem_id_list.split(" ");
            for (var i = 0; i < list.length; i++) {
                var ancestor_elem_id = list[i];
                if (ancestor_elem_id.match(/\S/)) {
                    show_amr_obj['elem-' + ancestor_elem_id] += ' ' + elem_id;
                }
            }
            if (role_m) {
                role_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + role_m + '</span>';
            }
        } else if (show_check && (var_locs = getLocs(variable))) {
            var n = var_locs.split(" ").length;
            if (n >= 2) {
                elem_id = 'elem_var_id_' + loc;
                onmouseover_fc = 'color_all_var_occurrences(\'' + variable + '\',\'#FF0000\')';
                onmouseout_fc = 'color_all_var_occurrences(\'' + variable + '\',\'#000000\')';
                var title = 'variable ' + variable + ' occurs ' + n + ' times in this AMR';
                variable_m = '<span title="' + title + '" id="' + elem_id + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable + '</span>';
            }
        }
        if (rec) {
            // add_log('show_amr_rec role ' + htmlProtect(role_m));
            s += role_m + ' ';
        }
        if (concept) {
            if (show_replace) {
                var type = 'concept';
                var at = variable;
                var old_value = concept;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                var onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                var onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                var onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                concept_m = '<span id="' + elem_id + '" title="click to change" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + concept + '</span>';
            } else if (show_delete) {
                variable_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable + '</span>';
                concept_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + concept_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            }
            // s += '(' + variable_m + '-' + alignment_index + ' / ' + concept_m;
            s += '(' + variable_m  + ' / ' + concept_m;

            var n = amr[loc + '.n'];
            var index;
            var opx_all_simple_p = 1;
            var argx_all_simple_p = 1;
            var opx_order = new Array();
            var argx_order = new Array();
            var opx_indexes = new Array();
            var argx_indexes = new Array();
            var name_indexes = new Array();
            var other_indexes = new Array();
            var other_string_indexes = new Array();
            var other_non_string_indexes = new Array();
            var ordered_indexes = new Array();
            for (var i = 1; i <= n; i++) {
                var sub_loc = loc + '.' + i;
                var sub_string = amr[sub_loc + '.s'];
                var sub_role = amr[sub_loc + '.r'];
                if (amr[sub_loc + '.d']) {
                    // skip deleted elem
                } else if ((sub_role.match(/^:op([1-9]\d*)$/i))
                    && (index = sub_role.replace(/^:op([1-9]\d*)$/i, "$1"))
                    && (!opx_order[index])) {
                    opx_order[index] = i;
                    if (show_amr_new_line_p(sub_loc)) {
                        opx_all_simple_p = 0;
                    }
                } else if ((sub_role.match(/^:arg(\d+)$/i))
                    && (index = sub_role.replace(/^:arg(\d+)$/i, "$1"))
                    && (!argx_order[index])) {
                    argx_order[index] = i;
                    if (show_amr_new_line_p(sub_loc)) {
                        argx_all_simple_p = 0;
                    }
                } else if (sub_role == ':name') {
                    name_indexes.push(i);
                } else if (sub_string != '') {
                    other_string_indexes.push(i);
                    other_indexes.push(i);
                } else {
                    other_non_string_indexes.push(i);
                    other_indexes.push(i);
                }
            }
            for (var i = 0; i < opx_order.length; i++) {
                if ((index = opx_order[i]) != undefined) {
                    opx_indexes.push(index);
                }
            }
            for (var i = 0; i < argx_order.length; i++) {
                if ((index = argx_order[i]) != undefined) {
                    argx_indexes.push(index);
                }
            }
            if (show_amr_obj['option-string-args-with-head']) {
                if (opx_all_simple_p) {
                    ordered_indexes
                        = ordered_indexes.concat(opx_indexes, other_string_indexes, name_indexes, argx_indexes, other_non_string_indexes);
                } else {
                    ordered_indexes
                        = ordered_indexes.concat(other_string_indexes, name_indexes, opx_indexes, argx_indexes, other_non_string_indexes);
                }
            } else {
                ordered_indexes
                    = ordered_indexes.concat(name_indexes, opx_indexes, argx_indexes, other_indexes);
            }
            // add_log('ordered_indexes(' + concept + ') Point D: ' + ordered_indexes.join(', '));
            for (var i = 0; i < ordered_indexes.length; i++) {
                var index = ordered_indexes[i];
                var show_amr_rec_result; // this stores one amr line
                var sub_loc = loc + '.' + index;
                if (show_amr_rec_result = show_amr_rec(sub_loc, args, 1, ancestor_elem_id_list + elem_id + ' ')) {
                    // add_log('Point D: ' + sub_loc + ' ' + show_amr_rec_result);
                    if (show_amr_new_line_p(sub_loc)) {
                        s += '\n' + indent_for_loc(sub_loc, '&nbsp;') + show_amr_rec_result;
                    } else {
                        s += ' ' + show_amr_rec_result;
                    }
                }
            }
            s += ')';
        } else if (string) {
            if (show_replace) {
                var type = 'string';
                var head_loc = loc.replace(/\.\d+$/, "");
                var head_variable = amr[head_loc + '.v'];
                var role = amr[loc + '.r'];
                var at = head_variable + ' ' + role;
                var old_value = string;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                var onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                var onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                var onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                string_m = '<span id="' + elem_id + '" title="click to change me" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + string_m + '</span>';
            } else if (show_delete) {
                string_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + string_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            } else if (show_check) {
                var role = amr[loc + '.r'];
                if ((role == ':wiki') && !string.match(/^\s*(|-)\s*$/i)) {
                    var wiki_url = 'https://en.wikipedia.org/wiki/' + htmlProtect(string);
                    string_m = '"<a href="' + wiki_url + '" title="' + wiki_url + '" target="_WIKI" style="color:#000080;">' + string + '</a>"';
                }
            }
            s += string_m;
        } else {
            if (show_replace) {  // without concept, i.e. secondary variable
                var type = 'variable';
                var head_loc = loc.replace(/\.\d+$/, "");
                var head_variable = amr[head_loc + '.v'];
                var role = amr[loc + '.r'];
                var at = head_variable + ' ' + role + ' ' + variable;
                var old_value = variable;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                var onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                var onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                var onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                variable_m = '<span id="' + elem_id + '" title="click to change me" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable_m + '</span>';
            } else if (show_delete) {
                variable_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            }
            s += variable_m;
        }
        if (tree_span_args) {
            s = '<span ' + tree_span_args + '>' + s + '</span>';
        }
        return s;
    }
}

/**
 * this is the function populate the show_amr_obj with the options table content, and print out the penman format output to webpage
 * @param args "show" or "show replace" or "show delete"
 */
function show_amr(args) {
    //comply with the loaded options
    var s, checked, html_amr_s;
    var n_elems_w_id = 0;
    show_amr_obj = new Object();
    max_show_amr_ops = 5000;
    show_amr_mo_lock = '';
    var origScrollHeight = '';
    var origScrollTop = '';
    if ((s = document.getElementById('amr')) != null) {
        origScrollHeight = s.scrollHeight;
        origScrollTop = s.scrollTop;
    }
    var display_options = new Array("string-args-with-head", "1-line-NEs", "1-line-ORs", "fix-font", "role-auto-case", "auto-check", "auto-reification", "auto-moveto", "provide-guidance", "confirm-delete", "check-chinese", "resize-command");
    for (var i = 0; i < display_options.length; i++) {
        var display_option = display_options[i];
        if ((s = document.getElementById(display_option)) != null) {
            checked = s.checked;
            show_amr_obj['option-' + display_option] = checked;
            // console.log('set show_amr_obj for ' + display_option + ' to ' + checked);
        }
    }
    if ((s = document.getElementById('variable-indentation')) != null) {
        if (s.checked) {
            show_amr_obj['option-indentation-style'] = 'variable';
        } else {
            show_amr_obj['option-indentation-style'] = 'fix';
        }
    }

    //generate the pennman string
    if (args) { //args can be "show", "replace", "delete" or "check"
        var amr_s = '';
        var n = amr['n'];
        console.log(amr);
        for (var i = 1; i <= n; i++) {
            var show_amr_rec_result;
            if (show_amr_rec_result = show_amr_rec(i, args, 0, ' ')) {
                amr_s += show_amr_rec_result + '\n';
            }
        }
        //should only affect save
        if ((s = document.getElementById('plain-amr')) != null) {
            s.value = deHTML(amr_s);
        }
        if ((s = document.getElementById('plain-amr2')) != null) {
            s.value = deHTML(amr_s);
        }
        if ((s = document.getElementById('plain-amr3')) != null) {
            s.value = deHTML(amr_s);
        }
        if (amr_s == '') {
            html_amr_s = '<i>empty umr</i>';
        } else {
            html_amr_s = amr_s;
        }
        html_amr_s = htmlSpaceGuard(html_amr_s);
        // html_amr_s = html_amr_s.replace(/\n/g, "<br>\n");
        // html_amr_s = html_amr_s.replace(/&xA;/g, "\n");

        setInnerHTML('amr', html_amr_s);
        show_amr_status = args;
    }
    if ((s = document.getElementById('amr')) != null) {
        // this is the actual output part
        var height = s.style.height;
        var intScrollTop = 0;
        var newScrollTop = 0;
        // add_log ('reset scroll bottom ' + height);
        if ((height != undefined) && height.match(/^\d+/)) {
            if (origScrollTop != 0) {
                newScrollTop = origScrollTop + s.scrollHeight - origScrollHeight;
                if (newScrollTop < 0) {
                    newScrollTop = 0;
                } else if (newScrollTop > s.scrollHeight) {
                    newScrollTop = s.scrollHeight;
                }
                intScrollTop = s.scrollTop;
                s.scrollTop = newScrollTop;
            }
            // add_log ('re-scroll ' + origScrollTop + '/' + origScrollHeight + ' ' + s.scrollTop + ' ' + s.scrollTop + ' ' + intScrollTop);
        }
    }
}

function update_amr_area_fix_color(color, var_fix_value) {
    console.log("update_amr_area_fix_color is called");
    var s;
    if ((s = document.getElementById('amr-area-fix')) != null) {
        s.style.color = color;
    }
    if ((s = document.getElementById('amr-area-height')) != null) {
        s.style.color = color;
        // add_log('update_amr_area_fix_color ' + color + ' ' + var_fix_value);
        if (var_fix_value == 'fix') {
            s.focus();
        }
    }
}

function props2screen() {
    // console.log("props2screen is called");
    var s, s2, f, url, duplicate_snt_ids, duplicate_already_reannotated_p;
    var prop_line = '';
    var guided_snt = '';
    if ((s = document.getElementById('foreign-snt')) != null) {
        f = s.value;
    }
    if ((s = document.getElementById('duplicate-of')) != null) {
        duplicate_snt_ids = s.value;
    }
    if ((s = document.getElementById('duplicate-already-reannotated')) != null) {
        duplicate_already_reannotated_p = s.value;
    }
    if ((s = document.getElementById('ontonotes-snt-info-url')) != null) {
        url = s.value;
    }
    if ((s = document.getElementById('guided-snt')) != null) {
        guided_snt = s.innerHTML;
    }
    if ((s = document.getElementById('screen-props')) != null) {
        var snt = guided_snt || amr['props-snt'] || '';
        var id = amr['props-id'] || '';
        var active_workset_p = ((s2 = document.getElementById('workset-template')) != null)
            && (s2.style.display.match(/inline/));
        var workset = '';
        if (s1 = document.getElementById('workset-name3')) {
            workset = s1.value;
        }
        if (snt.match(/\S/)) {
            prop_line = '<span style="font-weight:bold">Sentence:</span> ' + snt;
            if ((!active_workset_p) && id.match(/\S/)) { // ID already displayed in workset line.
                prop_line += ' &nbsp; <span title="sentence ID" style="color:#999999;">(' + id + ')</span>';
            }
            if (f.match(/\S/)) {
                prop_line += ' &nbsp; &nbsp; <span title="foreign sentence" style="color:#999999;">' + f + '</span>';
            }
            if (url.match(/\S/)) {
                prop_line += '</td><td width="3"></td><td><table border="1" cellpadding="1" cellspacing="0"><tr style="background-color:#BBCCFF;"><td><nobr>&nbsp;<a style="text-decoration:none" title="View OntoNotes annotations for this sentence" target="_ONTONOTES" href="' + url + '"><font color="black">ON</font></a>&nbsp;</nobr></td></tr></table>';
            }
            if (workset && workset.match(/^dfb-\d\d\d\d$/)) {
                var post_id = id.replace(/^.*_(\d\d\d\d)[._]\d+$/, "$1");
                post_id = post_id.replace(/^0*/, "p");
                thread_url = 'https://www.isi.edu/~ulf/amr/thread-viz/' + workset + '.html#' + post_id;
                prop_line += '</td><td width="3"></td><td><table border="1" cellpadding="1" cellspacing="0"><tr style="background-color:#BBCCFF;"><td><nobr>&nbsp;<a style="text-decoration:none" title="Visualize the Thread that this sentence is part of (in new tab)" target="_THREAD_VIZ" href="' + thread_url + '"><font color="black">VT</font></a>&nbsp;</nobr></td></tr></table>';
            }
            if (duplicate_snt_ids) {
                reannotation_clause = "&#xA;Do not start a new annotation on this sentence.";
                prop_line += '</td><td width="3"></td><td><table border="1" cellpadding="1" cellspacing="0"><tr style="background-color:#FFDDDD;"><td><nobr>&nbsp;<span title="This sentence has previously been annotated as ' + duplicate_snt_ids + ' in another workset.' + reannotation_clause + '" style="color:#FF0000;font-weight:bold;border-bottom:1px dotted;">DUPLICATE</span>&nbsp;</nobr></td></tr></table>';
            }
        } else if (id.match(/\S/)) {
            prop_line = '<span style="color:#999999;font-weight:bold">Sentence ID:</span> ' + id;
        }
        if (prop_line.match(/\S/)) {
            prop_line = '<table width="100%" cellpadding="3" style="background-color:#E8EEFF;"><tr><td><table><tr><td>' + prop_line + '</td></tr></table></td></tr></table>';
            prop_line += '\n<p>';
            s.innerHTML = prop_line;
        } else {
            s.innerHTML = '';
        }
    }
}

function defaultFilename() {
    // console.log("defaultFilename is called");
    var snt_id = amr['props-id'] || '';
    snt_id = snt_id.replace(/[^-_a-zA-Z0-9]/g, "_");
    var authors = amr['props-authors'] || '';
    var first_author = authors.replace(/^\s*([a-z]*).*$/i, "$1").toLowerCase();
    if (snt_id) {
        if (first_author) {
            return snt_id + '-' + first_author;
        } else {
            return snt_id;
        }
    } else {
        return '';
    }
}

function UMR2db(){
    console.log("I am here521");
    // sent = document.getElementById('sentence').innerText;
    var amrHtml = document.getElementById('amr').outerHTML; //"<div id="amr">(f&nbsp;/&nbsp;freedom)<br></div>"
    var sentenceAndIndice = document.getElementById('sentence').innerText;
    var sentence = firstHalfString(sentenceAndIndice); //He denied any wrongdoing .
    // var documentName = document.getElementById('filename').innerText; //"sample_snts_english.txt" doesn't need this

    console.log(amrHtml);
    fetch('/annotate', {
        method: 'POST',
        body: JSON.stringify({"amr": amrHtml, "db_sentence": sentence})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
                console.log(data); //amr got returned from server
            });
}

function firstHalfString(str) {
    var a = str.split(/\s/);
    var middle = Math.ceil(a.length / 2);
    var s1 = a.slice(0, middle).join(" ");
    return s1;
}

function load_history(){
    console.log("I am here524");
    var sentenceAndIndice = document.getElementById('sentence').innerText;
    var sentence = firstHalfString(sentenceAndIndice); //He denied any wrongdoing .
    var documentName = document.getElementById('filename').innerText; //"sample_snts_english.txt" doesn't need this

    fetch('/annotate', {
        method: 'POST',
        body: JSON.stringify({"documentName": documentName, "sentence": sentence})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        console.log(data);
        setInnerHTML('load-plain', deHTML(data["history_annot"]))//returned from server
        loadField2amr();
    });
}

function export_annot(){
    console.log("export_annot is called");
    var doc_name = document.getElementById('filename').innerText
    console.log(doc_name);
    fetch('/annotate', {
        method: 'POST',
        body: JSON.stringify({"doc_name": doc_name})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        let output_array = data["annotations"];

        output_array.forEach(e => {
            console.log(e[1]);
            e[1] = e[1].replace(/<\/?(a|span)\b[^<>]*>/g, "");
            e[1] = e[1].replace(/&nbsp;/g, " ");
            e[1] = e[1].replace(/<br>/g, "");
            e[1] = e[1].replace('<div id="amr">', '');
            e[1] = e[1].replace('</div>', '');

            console.log(e[1]);
        })

        console.log(output_array);
        // let output_str = data["annotations"].map(a => a.join("\n")).join("\n\n ");
        let output_str = data["annotations"].map(a => a.join("\n")).join("\n\n # :: snt \t");

        console.log(output_str);

    var filename;
    var text = '# :: snt \t';
    if (window.BlobBuilder && window.saveAs) {
        console.log('I am here1-1');

        filename = doc_name;
        filename += '.txt';
        text += output_str
        console.log('Saving file ' + filename + ' on your computer, typically in default download directory');
        var bb = new BlobBuilder();
        bb.append(text);
        saveAs(bb.getBlob(), filename);
    } else {
        console.log('I am here1-4');
        console.log('This browser does not support the BlobBuilder and saveAs. Unable to save file with this method.');
    }

    });
}

function applyProps(caller) {
    // add_edit_log('applyProps ' + caller);
    var s, value;
    var old_default_filename = defaultFilename();
    for (var i = 0; i < sentence_props.length; i++) {
        if ((s = document.getElementById(sentence_props[i])) != null) {
            value = strip(s.value);
            if (sentence_props[i] == 'props-snt') {
                value = value.replace(/\n/, " ");
                value = value.replace(/\s+/, " ");
            }
            amr[sentence_props[i]] = value;
        }
    }
    var new_default_filename = defaultFilename();
    var save_ids = new Array("save-filename", "local_save_file");
    for (var i = 0; i < save_ids.length; i++) {
        if ((s = document.getElementById(save_ids[i])) != null) {
            if ((s.value == '') || (s.value == old_default_filename)) {
                s.value = new_default_filename;
            } else {
                // add_log('default for ' + save_ids[i] + ': did not want to overwrite old value ' + s.value);
            }
        } else {
            // add_log('default for ' + save_ids[i] + ': could not find element by ID');
        }
    }
    props2screen();
    props2comment();
    hideProps();
    if (caller == 'user') {
        state_has_changed_p = 1;
        exec_command('record edit props', 1);
    }
}

function props2template() {
    var s;
    for (var i = 0; i < sentence_props.length; i++) {
        if ((s = document.getElementById(sentence_props[i])) != null) {
            s.value = amr[sentence_props[i]] || '';
        }
    }
}

/**
 * populate the comment element with the props input
 */
function props2comment() {
    var s, prop_name, short_name, value;
    var comment = '#';
    for (var i = 0; i < sentence_props.length; i++) {
        prop_name = sentence_props[i];
        short_name = prop_name.replace(/^props-/, "");
        if ((s = document.getElementById(prop_name)) != null) {
            value = amr[sentence_props[i]] || '';
            if (value.match(/\S/)) {
                if (prop_name == 'props-note') {
                    value = value.replace(/\n/g, "\n# ::note ");
                }
                if (short_name.match(/^(snt|note)$/) && !comment.match(/^(.*\n)?\#\s*$/)) {
                    comment += '\n#';
                }
                comment += ' ::' + short_name + ' ' + value;
            }
        }
    }
    comment += '\n';
    comment = comment.replace(/\#\n$/g, "");
    if ((s = document.getElementById('comment')) != null) {
        s.value = comment;
    }
    if ((s = document.getElementById('comment2')) != null) {
        s.value = comment;
    }
}

function resetProps() {
    // console.log("resetProps is called");
    var s;
    for (var i = 0; i < sentence_props.length; i++) {
        if ((s = document.getElementById(sentence_props[i])) != null) {
            s.value = '';
        }
    }
}

function saveProps() {
    var snt = '';
    if (amr['props-snt'] != '') {
        for (var i = 0; i < sentence_props.length; i++) {
            saved_sentence_prop_values[i] = amr[sentence_props[i]] || '';
            if (sentence_props[i] == 'props-snt') {
                snt = saved_sentence_prop_values[i];
            }
        }
    }
    return snt;
}

function restoreProps() {
    // console.log("restoreProps is called");
    for (var i = 0; i < sentence_props.length; i++) {
        // amr[sentence_props[i]] = saved_sentence_prop_values[i] || '';
        if ((s = document.getElementById(sentence_props[i])) != null) {
            s.value = saved_sentence_prop_values[i] || '';
        }
    }
}

function hideProps() {
    // console.log("hideProps is called");
    var s;
    if ((s = document.getElementById('props-template-table')) != null) {
        s.style.display = 'none';
    }
}

function hideOptions() {
    var s;
    if ((s = document.getElementById('options-template-table')) != null) {
        s.style.display = 'none';
    }
}

function hideLoadTemplate() {
    console.log("hideLoadTemplate is called");
    var s;
    if ((s = document.getElementById('load-template-table')) != null) {
        s.style.display = 'none';
    }
}

function localLoadUpdateProgress(evt) {
    console.log("localLoadUpdateProgress is called");
    if (evt.lengthComputable) {
        var loaded = (evt.loaded / evt.total);
        if (loaded < 1) {
            loaded *= 100;
            loaded = loaded.replace(/\..*$/, "");
            if ((s = document.getElementById('info-locally-loaded')) != null) {
                s.innerHTML = loadloaded + '% loaded';
            }
        }
    }
}

function localLoaded(evt) {
    console.log("localLoaded is called");
    var fileString = evt.target.result;
    if ((s = document.getElementById('info-locally-loaded')) != null) {
        s.innerHTML = 'Loading complete (' + fileString.length + ' bytes)';
    }
    if ((s = document.getElementById('load-plain')) != null) {
        s.value = fileString;
    }
    // add_log('Loaded AMR: ' + fileString);
    loadField2amr();
    state_has_changed_p = 1;
    exec_command('record load AMR locally', 1);
    hideLoadTemplate();
}

function recordDirectEntryLoad() {
    console.log("recordDirectEntryLoad is called");
    state_has_changed_p = 1;
    exec_command('record load AMR by direct entry', 1);
    hideLoadTemplate();
}

function loadErrorHandler(evt) {
    console.log("loadErrorHandler is called");
    if (evt.target.error.name == "NOT_READABLE_ERR") {
        add_log('loadErrorHandler: File could not be read.');
    } else {
        add_log('loadErrorHandler: Unspecified error');
    }
}

function load_local_amr_file(sentence_id) {
    console.log("load_local_amr_file is called");
    var s, scriptPath, fh;
    var load_method = '';
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        console.log("I am here 2-1");
        add_unique_log('Browser supports File API. Great.');
        var file = document.getElementById('local_load_files').files[0];
        if (file) {
            var reader = new FileReader();
            reader.readAsText(file, "UTF-8");
            reader.onprogress = localLoadUpdateProgress;
            reader.onload = localLoaded;
            reader.onerror = loadErrorHandler;
        } else {
            add_error('Unable to find local file to be loaded. Did you choose a file?');
        }
        load_method = 'File API';
        return;
    }
    add_log('This browser does not support the File API.');

    if (window.ActiveXObject) {
        console.log("I am here 2-2");
        add_unique_log('Browser supports ActiveXObject. Good.');
        load_method = 'ActiveXObject';
        try {
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            // var filePath = document.getElementById('local_load_files').files[0];
            var filePath = document.getElementById('local_load_files').value;
            // var filePath = `C:\\fakepath\\${sentence_id}.txt`;
            // add_log('Loading file ' + filePath + ' ...');
            var file = fso.OpenTextFile(filePath, 1);
            var fileString = file.ReadAll();
            // add_log('ActiveXObject5');
            file.Close();
            // add_log('Loaded AMR: ' + fileString);

            document.getElementById('load-plain').value = ''
            if ((s = document.getElementById('load-plain')) != null) {
                s.value = fileString;
                loadField2amr();
                state_has_changed_p = 1;
                exec_command('record load AMR locally', 1);
            }
        } catch (e) {
            if (e.number == -2146827859) {
                add_error('Unable to access local files due to browser security settings. '
                    + 'To overcome this, go to Tools->Internet Options->Security->Custom Level. '
                    + 'Find the setting for "Initialize and script ActiveX controls not marked as safe" '
                    + 'and change it to "Enable" or "Prompt"');
            } else {
                add_error('Unspecified ActiveXObject load error');
            }
        }
        return;
    }
    add_log('This browser does not support the ActiveXObject.');

    /*
   if (typeof getScriptPath == 'function') {
  if (typeof fopen  == 'function') {
     add_unique_log('Browser supports getScriptPath/fopen. Good.');
     load_method = 'getScriptPath/fopen';
         if (scriptPath = getScriptPath()) {
    fh = fopen(scriptPath, 0);
    if (fh != -1) {
           var length = flength(fh);
           var fileString = fread(fh, length);
           fclose(fh);
           // add_log('Loaded AMR: ' + fileString);
    } else {
       add_error('Unable to open file ' + scriptPath);
    }
     } else {
        add_error('Unable to select file with getScriptPath.');
     }
  } else {
     add_log('This browser does not support fopen.');
  }
   } else {
  add_log('This browser does not support getScriptPath');
   }
   */

    if (load_method == '') {
        add_error('This browser does not support any of the file reading methods tried. Unable to load file.');
    }
}

function localSaved(evt) {
    console.log("localSaved is called");
    var fileString = evt.target.result;
    /*
   if ((s = document.getElementById('info-locally-loaded')) != null) {
      s.innerHTML = 'Loading complete (' + fileString.length + ' bytes)';
   }
   if ((s = document.getElementById('load-plain')) != null) {
      s.value = fileString;
   }
   */
    add_log('Saved AMR: ' + evt.target.result);
}

function enable_workset_save() {
    // console.log("enable_workset_save is called");
    var s;
    // show button
    if ((s = document.getElementById('prev-snt-button')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('save-and-next-button')) != null) {
        s.style.display = 'block';
    }
    if ((s = document.getElementById('workset-snt-saved')) != null) {
        s.style.display = 'none';
    }
    // fill hidden form inputs
    if ((s = document.getElementById('save-browser2')) != null) {
        s.value = browserUserAgent;
    }
    if ((s = document.getElementById('save-snt-id2')) != null) {
        s.value = amr['props-id'] || '';
    }
}

function load_prev_workset_snt() {
    console.log("load_prev_workset_snt is called");
    var s1, s2, s3;
    if (((s1 = document.getElementById('prev-workset-snt-id3')) != null)
        && ((s2 = document.getElementById('current-workset-snt-id3')) != null)
        && ((s3 = document.getElementById('next-workset-snt')) != null)) {
        // add_log('load_prev_workset_snt prev: ' + s1.value + ' curr: ' + s2.value);
        s2.value = s1.value;
        s3.submit();
    }
}

function reload_current_workset_snt() {
    console.log("reload_current_workset_snt is called");
    var s1, s2, s3;
    if (((s1 = document.getElementById('current-workset-snt-id')) != null)
        && ((s2 = document.getElementById('current-workset-snt-id3')) != null)
        && ((s3 = document.getElementById('next-workset-snt')) != null)) {
        // add_log('load_prev_workset_snt prev: ' + s1.value + ' curr: ' + s2.value);
        s2.value = s1.innerHTML;
        s3.submit();
    }
}

function save_local_amr_file(sentence="", temp=false) {
    console.log(sentence);
    if ((s = document.getElementById('local_save_file')) != null) {
        s.focus();
    }
    var s, s2, s3, filename;
    var comment = '';
    var text = '# :: snt \t';
    if (window.BlobBuilder && window.saveAs) {
        console.log('I am here1-1');
        if ((s2 = document.getElementById('plain-amr')) != null) {
            console.log('I am here1-2');
            if ((s3 = document.getElementById('comment')) != null) {
                console.log('I am here1-3');
                comment = s3.value;
            }
            filename = document.getElementById('local_save_file').value;

            // filename = filename.replace(/\.txt$/, "");
            // filename = filename.replace(/[^-_a-zA-Z0-9]/g, "_");
            filename += '.txt';

            if(temp){
                // text += document.getElementById('current-words').innerText.replace("Words\t", "")
                text += sentence;
                text += '\n';

                add_log('Saving file ' + filename + ' on your computer, typically in default download directory');
                if (comment.match(/\S/)) {
                    text += comment + '\n';
                }
                text += s2.value;
                text = text.replace(/\n/g, "\r\n");
                var bb = new BlobBuilder();
                bb.append(text);
                saveAs(bb.getBlob(), filename);
            }else{
                if (comment.match(/\S/)) {
                    text += comment + '\n';
                }
                text = s2.value;
                text = text.replace(/\n/g, "\r\n");
                //TODO: add to temporary dictionary using POST
                // temp_umrs[sentence_id] = text;
                // console.log(temp_umrs);
                var bb = new BlobBuilder();
                bb.append(text);
                saveAs(bb.getBlob(), filename);
            }

        }
    } else {
        console.log('I am here1-4');
        add_error('This browser does not support the BlobBuilder and saveAs. Unable to save file with this method.');
        if ((s = document.getElementById('alt-save-locally')) != null) {
            console.log('I am here1-5');
            s.style.display = 'inline';
        }
    }
}

function reset_save(control) {
    // console.log("reset_save is called");
    var s;
    if (!(window.BlobBuilder && window.saveAs)) {
        if ((s = document.getElementById('alt-save-locally')) != null) {
            s.style.display = 'none';
        }
        if ((s = document.getElementById('save-local-title')) != null) {
            s.style.color = '#999999';
        }
        if ((s = document.getElementById('save-local-filename')) != null) {
            s.style.color = '#999999';
        }
        if ((s = document.getElementById('save-local-tooltip')) != null) {
            s.title = 'This browser does not support the API required for this method. (BlobBuilder and saveAs)';
        }
    }
}

/**
 * used to add space for indentation purpose
 * @param n the number of the space
 * @returns {string} n spaces
 */
function n_spaces(n) {
    var result = '';
    for (var i = 0; i < n; i++) {
        result += ' ';
    }
    return result;
}


/**
 * handles the indentation
 * @param loc
 * @param c
 * @param style
 * @param n
 * @returns {string}
 */
function indent_for_loc(loc, c, style, n) {
    var indentation, rem_loc, role;
    if (loc.match(/^\d+$/)) {
        indentation = '';
    } else {
        rem_loc = loc.replace(/\.\d+$/, "");
        if (c == undefined) {
            c = ' ';
        }
        style = style || show_amr_obj['option-indentation-style'] || 'fix';
        if (n == undefined) {
            if (style == 'fix') {
                n = 6;
            } else {
                n = 2;
            }
        }
        indentation = '';
        while (rem_loc) {
            if (style == 'fix') {
                indentation += n_spaces(n);
            } else if (rem_loc.match(/\./)) {
                if (role = amr[rem_loc + '.r']) {
                    role_length = role.length;
                    indentation += n_spaces(role_length + 1 + n);
                } else {
                    indentation += n_spaces(5 + n);
                }
            } else {
                indentation += n_spaces(n);
            }
            rem_loc = rem_loc.replace(/\.?\d+$/, "");
        }
        if (c != undefined) {
            indentation = indentation.replace(/ /g, c);
        }
    }
    return indentation;
}

function extractValueFrom2ColonExpr(s, key) {
    console.log("extractValueFrom2ColonExpr is called");
    // add_log('extractValueFrom2ColonExpr ' + key + ' ' + s);
    if (s.match(new RegExp('::' + key + ' '))) {
        var value = s.replace(new RegExp('^.*::' + key + ' '), "");
        value = value.replace(/^(.*?)::.*$/, "$1");
        return strip(value);
    } else {
        return '';
    }
}

function string2amr_rec(s, loc, state, ht) {
    // add_log('string2amr_rec ' + s + ' ' + loc + ' ' + state + ' ' + load_amr_feedback);
    if (max_string2amr_ops-- <= 0) {
        add_log('string2amr_rec MAXXED out');
        return s;
    }
    var ignore_style = 'style="color:#8888FF;font-weight:bold" title="ignored"';
    var insert_style = 'style="color:#FF7700;font-weight:bold" title="inserted"';
    var insert_space_style = 'style="color:#FF7700;font-weight:bold" title="inserted space"';
    var change_style = 'style="color:#FF0000;font-weight:bold"';
    var change_var_style = 'style="color:#FF0000;font-weight:bold" title="changed variable to avoid conflict with earlier definition"';
    var change_var2_style = 'style="color:#FF0000;font-weight:bold" title="changed variable to conform with variable format"';
    var change_concept_style = 'style="color:#FF0000;font-weight:bold" title="changed concept to conform with concept format"';
    var accept_style = 'style="color:#007700"';
    var accept_conflict_style = 'style="color:#007700;font-weight:bold" title="conflict with later variable redefinition"';
    s = s.replace(/^\xEF\xBB\xBF/, ""); // remove any UTF-8 marker at beginning
    s = s.replace(/\n\s*\n/g, "\n"); //  remove any empty lines
    s = s.replace(/^\n/, "");
    // skip comments (even though they might contain sentence, id etc.)
    if ((state == 'pre-open-para') && !loc.match(/\./)) {
        while (s.match(/^#/)) {
            var comment_line, id, date, authors, snt, note;
            comment_line = s.replace(/^(#.*)(\n.*)*$/, "$1");
            if (comment_line.match(/\S/)) {
                // add_log('load comment: ' + comment_line);
                id = extractValueFrom2ColonExpr(comment_line, 'id');
                // add_log('id comment: ' + id);
                date = extractValueFrom2ColonExpr(comment_line, 'date');
                authors = extractValueFrom2ColonExpr(comment_line, 'authors');
                snt = extractValueFrom2ColonExpr(comment_line, 'snt');
                note = extractValueFrom2ColonExpr(comment_line, 'note');
                if (id.match(/\S/)) {
                    amr['props-id'] = id;
                    amr['props-date'] = '';
                    amr['props-authors'] = '';
                    amr['props-snt'] = '';
                    amr['props-note'] = '';
                }
                if (date.match(/\S/)) {
                    amr['props-date'] = date;
                }
                if (authors.match(/\S/)) {
                    amr['props-authors'] = authors;
                }
                if (snt.match(/\S/)) {
                    amr['props-snt'] = snt;
                }
                if (note.match(/\S/)) {
                    if (amr['props-note'].match(/\S/)) {
                        amr['props-note'] += '\n' + note;
                    } else {
                        amr['props-note'] = note;
                    }
                }
            }
            s = s.replace(/^#.*/, "");
            s = s.replace(/^\n/, "");
        }
    }
    if (state == 'pre-open-para') {
        var pre_open_para_l = s.match(/^[^(]*/);   // )
        s = s.replace(/^[^(]*/, "");            // )
        load_amr_feedback += '<span ' + ignore_style + '>' + htmlSpaceGuard(pre_open_para_l[0]) + '</span>'; // (
        if (pre_open_para_l[0].match(/\S/)) {
            load_amr_feedback_alert = 1;
        }
        if (s.match(/^\(\s*[a-zA-Z0-9][-_a-zA-Z0-9']*(\s*\/\s*|\s+)[:*]?[a-zA-Z0-9][-_a-zA-Z0-9']*[*]?[\s)]/)) {
            var decorated_slash;
            s = s.replace(/^\(\s*/, "");
            var variable_l = s.match(/^[a-zA-Z0-9][-_a-zA-Z0-9']*/);
            s = s.replace(/^[a-zA-Z0-9][-_a-zA-Z0-9']*\s*/, "");
            if (s.match(/^\//)) {
                s = s.replace(/^\/\s*/, "");
                decorated_slash = '<span ' + accept_style + '>\/</span>';
            } else {
                decorated_slash = '<span ' + insert_style + '>\/</span>';
                load_amr_feedback_alert = 1;
            }
            var concept_l = s.match(/^[:*]?[a-zA-Z0-9][-_a-zA-Z0-9']*[*]?/);
            s = s.replace(/^[:*]?[a-zA-Z0-9][-_a-zA-Z0-9']*[*]?/, "");
            var variable = variable_l[0];
            var concept = concept_l[0];
            var new_variable, decorated_variable, new_concept, decorated_concept;
            if (concept.match(/^[a-zA-Z0-9][-_a-zA-Z0-9']*(?:-\d+)?$/)
                || tolerate_special_concepts(concept)) {
                decorated_concept = concept;
                amr[loc + '.c'] = concept;
                recordConcept(concept, loc);
                variable2concept[variable] = concept;
            } else {
                new_concept = concept.toLowerCase();
                new_concept = new_concept.replace(/_/g, "-");
                new_concept = new_concept.replace(/-+/g, "-");
                new_concept = new_concept.replace(/-$/, "");
                if (new_concept.match(/^\d/)) {
                    new_concept = 'x-' + new_concept;
                }
                new_concept = new_concept.replace(/(\d)\D+$/, "$1");
                new_concept = new_concept.replace(/([a-z])(\d)/, "$1-$2");
                decorated_concept = '<span ' + change_concept_style + '>' + new_concept + '</span>';
                load_amr_feedback_alert = 1;
                amr[loc + '.c'] = new_concept;
                recordConcept(new_concept, loc);
                variable2concept[variable] = new_concept;
            }
            if (getLocs(variable)) {
                new_variable = newVar(concept);
                amr[loc + '.v'] = new_variable;
                decorated_variable = '<span ' + change_var_style + '>' + new_variable + '</span>';
                recordVariable(new_variable, loc);
                load_amr_feedback_alert = 1;
            } else if (reserved_variables[variable + '.conflict']) {
                amr[loc + '.v'] = variable;
                decorated_variable = '<span ' + accept_conflict_style + '>' + variable + '</span>';
                recordVariable(variable, loc);
            } else if (!variable.match(/^[a-z]\d*$/)) {
                new_variable = newVar(concept);
                amr[loc + '.v'] = new_variable;
                decorated_variable = '<span ' + change_var2_style + '>' + new_variable + '</span>';
                recordVariable(new_variable, loc);
                load_amr_feedback_alert = 1;
            } else {
                amr[loc + '.v'] = variable;
                decorated_variable = variable;
                recordVariable(variable, loc);
            }
            amr[loc + '.s'] = '';
            amr[loc + '.n'] = 0;
            load_amr_feedback += '<span ' + accept_style + '>(' + decorated_variable + ' ' + decorated_slash + ' ' + decorated_concept + '</span>';
            s = string2amr_rec(s, loc, 'post-concept', ht); // (
            var pre_close_para_l = s.match(/^[^)]*/); // (
            s = s.replace(/^[^)]*/, "");
            if (pre_close_para_l[0] != '') {
                load_amr_feedback += ' <span ' + ignore_style + '>' + htmlSpaceGuard(pre_close_para_l[0]) + '</span>'; // (
                if (pre_close_para_l[0].match(/\S/)) {
                    load_amr_feedback_alert = 1;
                }
            }
            if (s.match(/^\)/)) { // (
                s = s.replace(/^\)/, ""); // (
                load_amr_feedback += '<span ' + accept_style + '>)</span>';
            } else { // (
                load_amr_feedback += '<span ' + insert_style + '>)</span>';
                load_amr_feedback_alert = 1;
            }
        } else {
            if (amr[loc + '.r']) {
                var string_arg = 'MISSING-VALUE';
                amr[loc + '.s'] = string_arg;
                amr[loc + '.c'] = '';
                amr[loc + '.v'] = '';
                amr[loc + '.n'] = 0;
                load_amr_feedback += '<span ' + insert_style + '>' + string_arg + '</span>';
                load_amr_feedback_alert = 1;
            } else {
                amr[loc + '.d'] = 1;
            }
            if (s.match(/^\(/)) { // )
                s = s.replace(/^\(/, ""); // )
                load_amr_feedback += ' <span ' + ignore_style + '>(</span>'; // )
                load_amr_feedback_alert = 1;
                if (amr[loc + '.r']) {
                    s = string2amr_rec(s, loc, 'post-concept', ht);
                } else {
                    s = string2amr_rec(s, loc, 'pre-open-para', ht);
                }
            }
        }
    } else if (state == 'post-concept') {
        var ignore_l = s.match(/^[^:()]*/);
        s = s.replace(/^[^:()]*/, "");
        if (ignore_l) {
            var ignore = strip(ignore_l[0]);
            if (ignore != '') {
                load_amr_feedback += ' <span ' + ignore_style + '>' + htmlSpaceGuard(ignore) + '</span>';
                if (ignore.match(/\S/)) {
                    load_amr_feedback_alert = 1;
                }
            }
        }
        var role_follows_p = s.match(/^:[a-z]/i);
        var open_para_follows_p = s.match(/^\(/); //)
        var role;
        if (role_follows_p || open_para_follows_p) {
            var n_subs = amr[loc + '.n'];
            n_subs++;
            amr[loc + '.n'] = n_subs;
            var new_loc = loc + '.' + n_subs;
            // add_log('Point C ' + new_loc + ' ' + s + ' F: ' + load_amr_feedback);
            load_amr_feedback += '<br>' + indent_for_loc(new_loc, '&nbsp;');
            if (role_follows_p) {
                var role_l = s.match(/^:[a-z][-_a-z0-9]*/i);
                s = s.replace(/^:[a-z][-_a-z0-9]*/i, "");
                role = role_l[0];
                load_amr_feedback += ' <span ' + accept_style + '>' + role + '</span>';
            } else {
                role = ':mod'; // default
                load_amr_feedback += ' <span ' + insert_style + '>' + role + '</span> ';
                load_amr_feedback_alert = 1;
            }
            amr[new_loc + '.r'] = autoTrueCaseRole(role);
            if (s.match(/^\s*\(/)) { // )
                s = string2amr_rec(s, new_loc, 'pre-open-para', ht);
            } else {
                s = string2amr_rec(s, new_loc, 'post-role', ht);
            }
            s = string2amr_rec(s, loc, 'post-concept', ht);
        }
    } else if (state == 'post-role') { // expecting string, number, or variable
        if (s.match(/^\s/)) {
            s = s.replace(/^\s*/, "");
            load_amr_feedback += ' ';
        } else {
            load_amr_feedback += '<span ' + insert_space_style + '> &bullet; </span>'; // caret (U+2038)
            load_amr_feedback_alert = 1;
        }
        var s_comp;
        var string_arg = '';
        var variable_arg = '';
        if (s.match(/^"/)) {
            s = s.replace(/^"/, "");
            var q_max_iter = 10;
            while ((q_max_iter >= 1) && !((s == '') || (s.match(/^"/)))) {
                if (s_comp = s.match(/^[^"\\]+/)) {
                    string_arg += s_comp[0];
                    s = s.replace(/^[^"\\]+/, "");
                }
                if (s_comp = s.match(/^\\./)) {
                    string_arg += s_comp[0];
                    s = s.replace(/^\\./, "");
                }
                q_max_iter--;
            }
            if (s.match(/^"/)) {
                s = s.replace(/^"/, "");
                load_amr_feedback += '<span ' + accept_style + '>"' + string_arg + '"</span>';
            } else {
                load_amr_feedback += '<span ' + accept_style + '>"' + string_arg + '</span>';
                load_amr_feedback += '<span ' + insert_style + '>"</span>';
                load_amr_feedback_alert = 1;
            }
        } else if (s_comp = s.match(/^:/)) {
            string_arg = 'MISSING-VALUE';
            load_amr_feedback += '<span ' + insert_style + '>' + string_arg + '</span>';
            load_amr_feedback_alert = 1;
        } else if (s_comp = s.match(/^[^ ()]+/)) {
            string_arg = s_comp[0].replace(/\s*$/, "");
            s = s.replace(/^[^ ()]+/, "");
            load_amr_feedback += '<span ' + accept_style + '>' + string_arg + '</span>';
            if (getLocs(string_arg)) {
                variable_arg = string_arg;
                recordVariable(variable_arg, loc);
                string_arg = '';
            } else if (string_arg.match(/^[a-z]\d*$/)) {
                ht['provisional-string.' + loc] = string_arg;
            }
        } else {
            string_arg = 'MISSING-VALUE';
            load_amr_feedback += '<span ' + insert_style + '>' + string_arg + '</span>';
            load_amr_feedback_alert = 1;
        }
        amr[loc + '.s'] = string_arg;
        amr[loc + '.c'] = '';
        amr[loc + '.v'] = variable_arg;
        var head_loc = loc.replace(/\.\d+$/, "");
        s = string2amr_rec(s, head_loc, 'post-concept', ht);
    }
    return s;
}

function string2amr(s) {
    // old amr will be destroyed (so clone before if needed)
    // add_edit_log('string2amr ' + s);
    var loc, ps, ps_loc;
    var s_wo_comment = s.replace(/^\s*\#.*\n$/, "");
    var ht = new Object();
    amr = new Object();
    variables = new Object();
    concepts = new Object();
    reserved_variables = new Object();
    var res_vars = s_wo_comment.match(/\(\s*[a-z]\d*[ \/]/g); // )
    max_string2amr_ops = 5000;
    if (res_vars) {
        for (var i = 0; i < res_vars.length; i++) {
            var variable = res_vars[i];
            variable = variable.replace(/^\(\s*/, ""); // )
            variable = variable.replace(/[ \/]$/, "");
            if (reserved_variables[variable]) {
                reserved_variables[variable + '.conflict'] = 1;
                // add_log('reserve variable: ' + variable + ' (conflict)');
            } else {
                reserved_variables[variable] = 1;
                // add_log('reserve variable: ' + variable);
            }
        }
    }
    amr['n'] = 0;
    if (s.match(/\(/) // )
        || s.match(/^# ::id /)) {
        var prev_s_length = s.length;
        var index = 1;
        loc = index + '';
        amr['n'] = 1;
        load_amr_feedback = '';
        load_amr_feedback_alert = 0;
        s = string2amr_rec(s + ' ', loc, 'pre-open-para', ht);
        while (s.match(/^\s*[()]/) && (s.length < prev_s_length)) { //
            index++;
            loc = index + '';
            prev_s_length = s.length;
            if ((s.match(/^\s*\(/)) && (!load_amr_feedback.match(/<br>\s*$/))) { // )
                load_amr_feedback += '<br>\n';
            }
            s = string2amr_rec(s + ' ', loc, 'pre-open-para', ht);
            if (s.length < prev_s_length) {
                amr['n'] = amr['n'] + 1;
            }
        }
        for (var key in ht) {
            // add_log ('investigating provisional-string ' + key + ' ' + ht[key]);
            if ((ps_loc = key.replace(/^provisional-string\.(\d+(?:\.\d+)*)$/, "$1"))
                && (ps = amr[ps_loc + '.s'])
                && getLocs(ps)
                && (ps == ht[key])) {
                // add_log('reframing provisional-string as variable ' + ps_loc + ' ' + ps + ' ' + ht[key]);
                amr[ps_loc + '.s'] = '';
                amr[ps_loc + '.v'] = ps;
                recordVariable(ps, ps_loc);
            }
        }
    } else if (s.match(/\S/)) {
        amr['n'] = 0;
        load_amr_feedback = '<span style="color:#999999">' + s + '</span>';
        load_amr_feedback_alert = 1;
    } else {
        amr['n'] = 0;
        load_amr_feedback = '';
        load_amr_feedback_alert = 0;
    }
    reserved_variables = new Object();
    return strip(s);
}

/* load *******************************************************/
/**
 * this is used to load the penman string
 */
function loadField2amr() {
    var s, s2, s3, value;
    var saved_snt = '';
    if ((s = document.getElementById('load-plain')) != null) {
        saved_snt = saveProps();
        resetProps();
        applyProps('load');
        var rest = string2amr(s.value);
        if ((!amr['props-snt']) && (saved_snt != '')) {
            restoreProps();
            applyProps('load');
        }
        if (!rest.match(/\S/)) {
            rest = '';
        }
        if (load_amr_feedback_alert) {
            // add_log(load_amr_feedback);
            // var html_rest = htmlSpaceGuard(rest);
            // popup_with_html_text(load_amr_feedback, html_rest);
        }
        if (rest.match(/\S/)) {
            add_log('Remaining text: ' + rest);
        }
        props2template();
        props2screen();
        if (((s2 = document.getElementById('props-id')) != null)
            && ((s3 = document.getElementById('save-filename')) != null)
            && (s3.value == '')
            && (s2.value != '')
            && ((value = s2.value.replace(/^([a-z][a-z]).(.*)$/, "$2")) != '')) {
            s3.value = value;
        }
    }
    show_amr('show');
}

/********************************************************/
// $('table').mousedown(function (event) {
//     if (event.ctrlKey) {
//         event.preventDefault();
//     }
// });

document.onselectionchange = function selectSpan() {
    let selection = document.getSelection();
    selected_tokens.innerHTML = "";
    selected_tokens.innerHTML += selection;
    begOffset = selection.anchorNode.parentElement.cellIndex;
    endOffset = selection.focusNode.parentElement.cellIndex;
};

function highlightSelection() {
    var userSelection = document.getSelection();

    //Attempting to highlight multiple selections (for multiple nodes only + Currently removes the formatting)
    for (var i = 0; i < userSelection.rangeCount; i++) {
        //Copy the selection onto a new element and highlight it
        var node = highlightRange(userSelection.getRangeAt(i)/*.toString()*/);
        // Make the range into a variable so we can replace it
        var range = userSelection.getRangeAt(i);
        //Delete the current selection
        range.deleteContents();
        //Insert the copy
        range.insertNode(node);
    }

    //highlights 1 selection (for individual nodes only + Need to uncomment on the bootom)
    //highlightRange(userSelection.getRangeAt(0));

    //Save the text to a string to be used if yoiu want to
    /*var string1 = (userSelection.getRangeAt(0));
    alert(string1);*/

}

//Function that highlights a selection and makes it clickable
function highlightRange(range) {
    //Create the new Node
    var newNode = document.createElement("span");

    // Make it highlight
    newNode.setAttribute(
        "style",
        // "background-color: yellow;"
        "color: blue;"
    );

    //Make it "Clickable"
    newNode.onclick = function () {
        if (confirm("do you want to delete it?")) {
            deletenode(newNode);
        } else {
            alert(range);
        }
    };


    //Add Text for replacement (for multiple nodes only)
    //newNode.innerHTML += range;
    newNode.appendChild(range.cloneContents());

    //Apply Node around selection (used for individual nodes only)
    //range.surroundContents(newNode);

    return newNode;
}

function deletenode(node) {
    var contents = document.createTextNode(node.innerText);
    node.parentNode.replaceChild(contents, node);
}




// click on load button
function reset_load(control) {
    var s;
    if ((s = document.getElementById('load-local')) != null) {
        s.style.display = 'inline';
    }
    if ((s = document.getElementById('load-onto-snt')) != null) {
        s.style.display = 'inline';
    }
    if ((s = document.getElementById('load-direct')) != null) {
        s.style.display = 'inline';
    }
    if ((s = document.getElementById('load-cgi')) != null) {
        s.style.display = 'inline';
    }
    if ((s = document.getElementById('load-cgi2')) != null) {
        s.style.display = 'inline';
    }
    if ((s = document.getElementById('load-plain')) != null) {
        s.innerHTML = '';
    }
    if ((s = document.getElementById('info-locally-loaded')) != null) {
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            // Great;
            s.innerHTML = '<font color="#999999">Browser supports File API.</font>';
        } else if (window.ActiveXObject) {
            s.innerHTML = '<font color="#999999">Will use ActiveXObject.</font> &nbsp; <a href="javascript:toggleInfo(\'alt-locally-loaded\');"><font color="#999999">Alternatives</font></a>';
        } else {
            s.innerHTML = 'This load method not supported by this browser. &nbsp; <a href="javascript:toggleInfo(\'alt-locally-loaded\');">Alternatives</a><br>';
            if ((s = document.getElementById('load-local-title')) != null) {
                s.style.color = '#999999';
            }
        }
    }
}

function toggleInfo(j) {
    if ((s = document.getElementById(j)) != null) {
        if (s.style.display == 'inline') {
            // s.style.display = 'none';
        } else {
            s.style.display = 'inline';
        }
    }
}

function toggleRow(id) {
    var rows = document.getElementsByClassName(id)
    // var row = document.getElementById(id);
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].style.display == '') {
            rows[i].style.display = 'none';
        } else {
            rows[i].style.display = '';
        }
    }
}

function changeButton(id){
    var elem = document.getElementById(id);
    if (elem.innerText=="show more info") elem.innerText = "show less info";
    else elem.innerText = "show more info";
}



/**
 * populate frame_arg_descr, but it's empty
 */
function initialize_frame_arg_descriptions() {
    if ((s = document.getElementById('frame-arg-descriptions')) != null) {
        var frame_arg_description_s = s.value;
        var frame_arg_descriptions = frame_arg_description_s.split(" :: ");
        var len = frame_arg_descriptions.length;
        for (var i = 0; i < len; i++) {
            var frame_entry = strip(frame_arg_descriptions[i]);
            var frame_concept = strip(frame_entry.replace(/^(\S+)(?:\s.*|)$/, "$1"));
            var frame_arg_descr = strip(frame_entry.replace(/^\S+\s+(\S|\S.*\S)\s*$/, "$1"));
            var norm_frame = frame_concept.replace(/\.(\d+)$/, "-$1");  // build.01 -> build-01
            frame_arg_descr[norm_frame] = frame_arg_descr;
            // add_log('record_frame_arg_descriptions ' + norm_frame + ' has_frame: ' + frame_arg_descr);
        }
    }
}




