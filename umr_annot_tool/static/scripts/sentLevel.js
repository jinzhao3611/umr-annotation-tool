let show_amr_obj = {"option-string-args-with-head": false, "option-1-line-NEs": false, "option-1-line-ORs": false,
    "option-fix-font":true, "option-role-auto-case":false,  "option-auto-moveto":true,
    "option-confirm-delete":false, "option-check-chinese":true, "option-resize-command":true, 'option-indentation-style': 'variable', 'option-auto-reification': true};
let abstractConcepts = ['ordinal-entity', 'temporal-quantity', 'amr-unknown', 'amr-choice', 'truth-value', 'name', 'accompany-01', 'age-01', 'benefit-01', 'have-concession-91', 'have-condition-91', 'have-degree-92', 'be-destined-for-91', 'last-01', 'exemplify-01', 'have-extent-91', 'have-frequency-91', 'have-instrument-91', 'have-li-91', 'be-located-at-91', 'have-manner-91', 'have-mod-91', 'have-name-91', 'have-ord-91', 'have-part-91', 'have-polarity-91', 'own-01', 'have-03', 'have-purpose-91', 'have-quant-91', 'be-from-91', 'have-subevent-91', 'be-temporally-at-91', 'concern-02', 'have-value-91', 'person']
//https://stackoverflow.com/questions/15861088/regex-to-match-only-language-chars-all-language
let table_id = 1;
let language;
let current_parent;
let current_concept;
let current_relation;
let current_mode;
let current_attribute;
let current_ne_concept;
let frame_dict = {};// key is lemma form, value is the frame (including all the inflected form)
let citation_dict = {}; //key is inflected form, value is lemma form
let similar_word_list ={};

let selection;
let begOffset;
let endOffset;

let umr = {}; //{n: 1, 1.c: "obligate-01", 1.v: "o", 1.s: "", 1.n: 1, …}
let variables = {}; //{o: "1", r: "1.1", b: "1.1.1"}
let concepts = {}; //{obligate-01: "1", resist-01: "1.1", boy: "1.1.1"}
let variable2concept = {}; // {o: "obligate-01", r: "resist-01", b: "boy", "": "", c: "car"}

let undo_list = []; // [{action:..., amr: ..., concept:..., variables:..., id: 1}, {...}, ...]
let undo_index = 0; //2

let default_langs = ['default', 'sanapana', "arapahoe", "navajo", "secoya", "kukama"]
let variablesInUse = {}; //variables that are already in use in the current umr graph

let last_state_id = 0; //for undo and redo
let state_has_changed_p = 0; // one state is one action got executed

let show_amr_status = 'show'; //'show'
let show_amr_mo_lock = ''; // '' affects coloring
let current_template = ''; //"top, add, options..."

let is_have_rel_role_91_role = {}; //ancestor: 1; aunt: 1; baby: 1
let is_standard_named_entity = {}; //"": 1; aircraft: 1; aircraft-type: 1

/**
 *
 * @param frame_json: frame json file from post
 * @param lang: language of this document
 */
function initialize(frame_json, lang) {
    language = lang; // assign language of the document
    umr['n'] = 0; //clear the current graph
    undo_list.push(cloneCurrentState()); //populate undo_list todo probably don't need this
    current_mode = 'top'; //reset the current mode to add root
    frame_dict = JSON.parse(frame_json);
    begOffset = -1;
    endOffset = -1;
    if(default_langs.includes(language)){ // if langauge is one of the default languages
        Object.keys(frame_dict).forEach(function(key) {
            frame_dict[key]['inflected_forms'].forEach(function(item){
                citation_dict[item] = key;
            });
        });
    }
    pass_citation_dict(JSON.stringify(citation_dict)); //put citation dict in local storage ready to pass to another page
}

/**
 * load the annotation for current sentence from database
 * @param curr_sent_annot: pennman annotation directly from database, with html encoding, but no html tags
 * @param curr_sent_align: text alignment info from database
 * @param curr_sent_umr
 */
function load_history(curr_sent_annot, curr_sent_align, curr_sent_umr){
    umr = JSON.parse(curr_sent_umr);
    if(Object.keys(umr).length === 0){ // if the parsed curr_sent_umr is empty
        umr['n'] = 0; //initialize umr here
    }
    populateUtilityDicts(); // based on current umr dict, populate 3 dicts: variables, concepts, and variable2concept
    // text2umr(deHTML(curr_sent_annot), curr_sent_align);
    show_amr('show');
    showAlign();
    state_has_changed_p = 1;
    exec_command('record load umr from database', 1); // add action:  "load umr from database" to states list
    if(language === "english" || language === "chinese"){
        showAnnotatedTokens();
    }
    // undo_list.push(cloneCurrentState()); //populate undo_list
}

/**
 * based on current umr dict, populate 3 dicts: variables, concepts, and variable2concept
 */
function populateUtilityDicts(){
        Object.keys(umr).forEach(function(key) { //traverse all the items in umr
        if(key.match(/\d+.v/) ) { //traverse all the .d items in umr that have a value of 1
            recordVariable(umr[key], key.replace(/\.v$/, "") + '');
            variable2concept[umr[key]]= umr[key.replace(/\.v$/, ".c") + ''];
        }else if(key.match(/\d+.c/)){
            recordConcept(umr[key], key.replace(/\.c$/, "") + '');
        }
    });
}

/**
 * not working yet
 * @param sentenceId
 */
function docAnnot(sentenceId) {
    exec_command("top sent ence", 1);
    submit_template_action('doc-annot');
}

/**
 * from currently selected word, get the lemma and generate the senses menu list
 */
function conceptDropdown(lang='english') {
    submit_concept(); //record the current concept from the selected tokens
    let token = current_concept;
    let numfied_token = text2num(token); //return the token itself if it's not a number
    if (!isNaN(numfied_token)) {// if numfied_token is a number, this is to cover :quant
        let number = {"res": [{"desc": "token is a number", "name": numfied_token}]};
        getSenses(number);
    } else { //if concept is not a number
        if (default_langs.includes(lang)){ // if lang is one of the default languages
            let submenu_items;
            if (lang === "navajo"){ //Lukas is having placeholder bug, therefore disable lexicon feature for navajo for now
                 submenu_items = {"res": [{"name": token, "desc": "not in citation dict"}]};
            }else{
                if (token in JSON.parse(localStorage["citation_dict"])){
                    let lemma = JSON.parse(localStorage["citation_dict"])[token];
                    submenu_items = {"res": [{"name": token, "desc": "not in frame files"},  {"name": lemma, "desc": "look up in lexicon"}]}
                }else{
                    submenu_items = {"res": [{"name": token, "desc": "not in citation dict"}]};
                }
            }
            getSenses(submenu_items);
        }else if(typeof getLemma(token) !== 'undefined' || lang === 'chinese'){
            let lemma;
            if(lang === 'arabic'){
                getLemmaFarasa(token).then( function(response) {
                    lemma = response['result'][0];
                    console.log(lemma);
                    let senses = [];
                    Object.keys(frame_dict).forEach(function(key) {
                        if(key.split("-")[0] === lemma){
                            senses.push({"name": key, "desc":JSON.stringify(frame_dict[key])})
                        }
                    });
                    let submenu_items;
                    if (senses.length === 0) {
                        submenu_items = {"res": [{"name": lemma, "desc": "not in frame files"}]};
                    }else{
                        submenu_items = {"res": senses};
                    }
                    getSenses(submenu_items);
                })
            } else if(lang === 'english'){
                lemma = getLemma(token);
                let senses = [];
                Object.keys(frame_dict).forEach(function(key) {
                    if(key.split("-")[0] === lemma){
                        senses.push({"name": key, "desc":JSON.stringify(frame_dict[key])})
                    }
                });
                let submenu_items;
                if (senses.length === 0) {
                    submenu_items = {"res": [{"name": lemma, "desc": "not in frame files"}]};
                }else{
                    submenu_items = {"res": senses};
                }
                getSenses(submenu_items);
            }else if (lang === 'chinese') {
                lemma = token;
                let senses = [];
                Object.keys(frame_dict).forEach(function(key) {
                    if(key.split("-")[0] === lemma){
                        senses.push({"name": key, "desc":JSON.stringify(frame_dict[key])})
                    }
                });
                let submenu_items;
                if (senses.length === 0) {
                    submenu_items = {"res": [{"name": lemma, "desc": "not in frame files"}]};
                }else{
                    submenu_items = {"res": senses};
                }
                getSenses(submenu_items);
            }
        }else {
            let letter = {"res": [{"desc": "token is a letter", "name": token}]};
            getSenses(letter);
        }
    }
}

/**
 * takes in different senses of a lemma and generate the secondary menu of find lemma
 * @param senses a dictionary looks like {"res": [{"name": lemma, "desc": different senses}]}
 */
function getSenses(senses) {
    submit_query(); // update the current mode if named Entity box has something filled in
    let genDrop = document.getElementById('genericDropdown');
    genDrop.innerHTML = "";
    senses.res.forEach(function (value, index, array) {
        let genLink = document.createElement("a");
        genLink.innerHTML = value.name;
        genLink.setAttribute("href", `javascript:submit_query(); submit_template_action('${current_mode}', "${value.name}");`);
        genLink.setAttribute("title", value.desc);
        genLink.setAttribute("id", "sense");
        genLink.setAttribute("class", "dropdown-item");
        let genLi = document.createElement("li");
        genLi.appendChild(genLink);
        genDrop.appendChild(genLi);
    });
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
    return Object.keys(object).filter(key => object[key] === value && !(key.replace(new RegExp('\..$', 'gm'), '.d') in object))[0];
}

/**
 * record the current concept from the selected tokens
 */
function submit_concept() {
    current_concept = document.getElementById('selected_tokens').innerText;
    current_concept = current_concept.replace("'", "\'");
}

/**
 * get the info from panel
 */
function submit_query(){
    let r = '';
    if(document.getElementById('simplified_modals').value){
        r = document.getElementById('simplified_modals').value;
    } else if(document.getElementById('roles1')){
        r = document.getElementById('roles1').value;
    }else if(document.getElementById('roles2')){
        r = document.getElementById('roles2').value;
    }

    let a = document.getElementById('attributes').value;
    let av = '';
    if(document.getElementById('attribute_values1').value){
        av = document.getElementById('attribute_values1').value;
    }else if (document.getElementById('attribute_values2').value){
        av = document.getElementById('attribute_values2').value;
    }else if (document.getElementById('attribute_values3').value){
        av = document.getElementById('attribute_values3').value;
    }else if (document.getElementById('attribute_values4').value){
        av = document.getElementById('attribute_values4').value;
    }else if (document.getElementById('attribute_values5').value){
        av = document.getElementById('attribute_values5').value;
    }else if (document.getElementById('attribute_values6').value){
        av = document.getElementById('attribute_values6').value;
    }

    if(r){
        current_relation = r;
        current_mode = "add";
        if(r===":MODSTR"){
            submit_template_action('add-constant', document.getElementById('modstr-values1').value);
            document.getElementById("modstr-vals").style.display = 'none'; //fold the modstr values box
            document.getElementById('simplified_modals').value = ""; //clear the modals box
        }
    }else if(a){
        current_relation = a;
        current_attribute = av;
        submit_template_action('add-constant', current_attribute);
        // fold attribute value box after submitted
        let eles = document.getElementsByClassName('attributes');
        let i;
        for (i = 0; i < eles.length; i++) {
            eles[i].style.display = 'none';
        }
    }

    let ct = document.getElementById('concept_types').value;
    if(ct){
        current_concept = ct;
        current_concept = current_concept.replace("'", "\'");
        submit_template_action(current_mode, current_concept);
    }

    let nt = document.getElementById('ne_types').value;
    if(nt){
        current_mode = 'add-ne';
        current_ne_concept = nt;
        console.log("current_mode is: " + current_mode);
    }
}

/**
 * fold unselected attribute value datalist, show the selected attribute datalist
 */
function show_attribute_values(){
    let option = document.querySelector('#attributes').value;
    if (option === ':Aspect') {
        document.getElementById("polarity-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'none';
        document.getElementById("aspect-attribute").style.display = 'block';
        document.getElementById("refer-person-attribute").style.display = 'none';
        document.getElementById("refer-number-attribute").style.display = 'none';
        document.getElementById("degree-attribute").style.display = 'none';
    } else if (option === ':polarity') {
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'block';
        document.getElementById("refer-person-attribute").style.display = 'none';
        document.getElementById("refer-number-attribute").style.display = 'none';
        document.getElementById("degree-attribute").style.display = 'none';
    } else if (option === ':mode'){
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'block';
        document.getElementById("refer-person-attribute").style.display = 'none';
        document.getElementById("refer-number-attribute").style.display = 'none';
        document.getElementById("degree-attribute").style.display = 'none';
    } else if (option === ':refer-person'){
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'none';
        document.getElementById("refer-person-attribute").style.display = 'block';
        document.getElementById("refer-number-attribute").style.display = 'none';
        document.getElementById("degree-attribute").style.display = 'none';
    } else if (option === ':refer-number'){
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'none';
        document.getElementById("refer-person-attribute").style.display = 'none';
        document.getElementById("refer-number-attribute").style.display = 'block';
        document.getElementById("degree-attribute").style.display = 'none';
    }else if (option === ':degree'){
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'none';
        document.getElementById("refer-person-attribute").style.display = 'none';
        document.getElementById("refer-number-attribute").style.display = 'none';
        document.getElementById("degree-attribute").style.display = 'block';
    }
}

/**
 * fold unselected modstr value datalist, show the selected attribute datalist
 */
function show_modal_values(){
    let option = document.querySelector('#simplified_modals').value;
    if (option === ':MODSTR') {
        document.getElementById("modstr-vals").style.display = 'block';
    } else {
        document.getElementById("modstr-vals").style.display = 'none';
    }
    document.getElementById('roles2').value = ''; // clear the roles box
}
/** undo *******************************************************/
/**
 *  copy a plain Object, Array, Date, String, Number, or Boolean
 *  code from https://stackoverflow.com/questions/728360/how-do-i-correctly-clone-a-javascript-object
 * @param obj
 * @returns {*}
 */
function clone(obj) {
    let copy;
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (let i = 0, len = obj.length; i < len; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    console.log(`clone error: cannot clone/copy object: ${obj}. Its type isn't supported.`);
    return obj;
}

/**
 * generate a current state with state id, umr, variable and concepts information
 * @returns {{}}
 */
function cloneCurrentState() {
    let current_state = {};
    current_state['umr'] = clone(umr);
    current_state['variables'] = clone(variables);
    current_state['concepts'] = clone(concepts);
    last_state_id++; //global variable keep count of state id
    current_state['id'] = last_state_id;
    return current_state;
}

/**
 * update umr, variables, concepts
 * @param previous_state
 */
function revert2PrevState(previous_state) {
    umr = previous_state['umr'];
    variables = previous_state['variables'];
    concepts = previous_state['concepts'];
    console.log('Reverted to state ' + previous_state['id']);
}

/**
 * undo and redo, also probably generate a window at the up right corner
 * @param n positive number (redo) or a negative number (undo)
 */
function undo(n) {
    let op_name, undo_title, redo_title, s, s2;
    let undo_list_size = undo_index + 1;
    let redo_list_size = undo_list.length - undo_list_size;
    if (n > 0) {
        op_name = 'redo';
    } else {
        op_name = 'undo';
    }
    if ((op_name === 'undo') && (undo_index === 0)) {
        console.log('Empty undo list. Cannot perform any further undo.');
    } else if ((op_name === 'redo') && (redo_list_size === 0)) {
        console.log('Empty redo list. Sorry, cannot perform any further redo.');
    } else {
        undo_index += n;
        let old_state = undo_list[undo_index];
        revert2PrevState(clone(old_state));
        show_amr('show');
        undo_list_size = undo_index + 1;
        redo_list_size = undo_list.length - undo_list_size;
        let prev_state, prev_action;
        if (undo_index) {
            prev_state = undo_list[undo_index - 1];
            prev_action = prev_state['action'];
            undo_title = 'undo ' + prev_action;
        } else {
            undo_title = 'currently nothing to undo';
        }
        if ((s = document.getElementById('undo-button')) != null) {
            s.title = undo_title;
        }
        if (redo_list_size) {
            prev_state = undo_list[undo_index];
            prev_action = prev_state['action'];
            redo_title = 'redo ' + prev_action;
        } else {
            redo_title = 'currently nothing to redo';
        }
        if ((s = document.getElementById('redo-button')) != null) {
            s.title = redo_title;
        }
        if (op_name === 'undo') {
            let undone_action = old_state['action'];
            console.log('Undid ' + undone_action + '. Active undo list decreases to ' + undo_list_size + ' elements (incl. empty state). Redo list size: ' + redo_list_size);
        } else {
            prev_state = undo_list[undo_index - 1];
            let redone_action = prev_state['action'];
            console.log('Redid ' + redone_action + '. Active undo list increases to ' + undo_list_size + ' elements (incl. empty state). Redo list size: ' + redo_list_size);
        }
    }
}


/**
 * this function takes in a template id (the name on the button) and return the form to fill out, potentially get rid of this entirely
 * @param id "top"
 */
function selectTemplate(id) {
    current_template = '';
    let actions = ["replace", "delete", "move", "save", "load"];
    let s;
    for (let i = 0; i < actions.length; i++) {
        let action = actions[i];
        if ((s = document.getElementById(action + '-template-table')) != null) {
            if (id === action) {
                s.style.display = 'none';
                current_template = id;
                if ((action === 'replace') && !show_amr_status.match(/replace/)) {
                    show_amr('show replace');
                } else if ((action === 'delete') && !show_amr_status.match(/delete/)) {
                    show_amr('show delete');
                }
            } else {
                s.style.display = 'none';
                if ((action === 'replace') && show_amr_status.match(/replace/)) {
                    show_amr('show');
                } else if ((action === 'delete') && show_amr_status.match(/delete/)) {
                    show_amr('show');
                }
            }
        }
    }
    let focus_field;
    if (id === 'move') {
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
    let s;
    if ((s = document.getElementById('replace-at')) != null) {
        if (type === 'concept') {
            s.title = 'type in the variable of the concept to be replaced, e.g. s';
        } else if (type === 'string') {
            s.title = 'type in the pair (head-variable :role) of the string or number to be replaced, e.g. n2 :value (without parentheses)';
        } else if (type === 'role') {
            s.title = 'type in the triple (head-variable :old-role arg) of the role to be replaced. arg can be a variable, concept, or string, e.g. s :ARG0 b (without parentheses or quotes)';
        }
    }
}

/**
 * @param type
 * @param at
 * @param old_value
 * @param mo_lock: element id of concept in amr? example: amr_elem_1
 */
function fillReplaceTemplate(type, at, old_value, mo_lock) {
    console.log('fillReplaceTemplate ' + type + ' ' + at + ' ' + old_value + ' <' + mo_lock + '> ');
    var s_type, s_at, s_new;
    if (((s_type = document.getElementById('replace-type')) != null)
        && ((s_at = document.getElementById('replace-at')) != null)
        && ((s_new = document.getElementById('replace-new')) != null)) {
        s_type.value = type;
        s_at.value = at;
        s_new.value = old_value;
    }
}

/**
 *
 * @param at "s1t :actor s1f"
 * @param mo_lock "amr_elem_6", this is also element id
 */
function fillDeleteTemplate(at, mo_lock) {
    console.log("fillDeleteTemplate: at: "+ at + ", mo_lock: " + mo_lock);
    var s;
    if ((s = document.getElementById('delete-at')) != null) {
        var same_mo_lock_p = (show_amr_mo_lock == mo_lock);
        // add_log('fillDeleteTemplate ' + at + ' ' + mo_lock + ' ' + show_amr_mo_lock + ' ' + same_mo_lock_p);
        if (show_amr_mo_lock) {
            s.value = '';
            color_all_under_amr_elem(show_amr_mo_lock, '#000000', '');
            show_amr_mo_lock = '';
            console.log('<p><font style="color:red;font-weight:bold;">In AMR above, click on element to be deleted.</font>');
        }
        if (!same_mo_lock_p) {
            s.value = at;
            show_amr_mo_lock = mo_lock;
            color_all_under_amr_elem(show_amr_mo_lock, '#FF0000', '');
            if (show_amr_obj['option-confirm-delete']) {
                console.log('<p><font style="color:red;font-weight:bold;">Confirm deletion in template below.</font>');
            } else {
                submit_template_action('delete');
                selectTemplate('clear');
            }
        }
    }
}

/** coloring umr ******************************************************/

/**
 *
 * @param variable
 * @param color
 */
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

/**
 *
 * @param id "amr_elem_6"
 * @param color "#FF0000"
 * @param event_type ""
 */
function color_all_under_amr_elem(id, color, event_type) {
    let list_s = show_amr_obj['elem-' + id];
    let list = list_s.split(" ");
    for (let i = 0; i < list.length; i++) {
        let sub_id = list[i];
        color_amr_elem(sub_id, color, event_type);
    }
}

/**
 * given element id and color, color the element
 * @param id "amr_elem_6"
 * @param color "#FF0000"
 * @param event_type ""
 */
function color_amr_elem(id, color, event_type) {
    let s;
    if ((!(show_amr_mo_lock && (event_type == 'mo'))) //either show_amr_mo_lock is empty, or event_type is not 'mo'
        && ((s = document.getElementById(id)) != null)) {
        s.style.color = color;
    }
}


/** entrance ******************************************************/
function submit_template_action(id, numbered_predicate = "") {
    // highlightSelection();
    if (numbered_predicate !== "") {
        if(numbered_predicate.indexOf(' ') >= 0 && id==='add'){
            numbered_predicate = numbered_predicate.replaceAll(" ", "-");
        }
        current_concept = numbered_predicate;
    }
    let arg1, arg2, arg3, arg4, s;
    if (id === 'top') {
        if ((document.getElementById('genericDropdown')) != null) {
            exec_command('top ' + current_concept, 1);
            let k = getKeyByValue(umr, current_concept.toLowerCase());
            if (k.includes("v")) { // 1.1.v, if current_concept is variable
                current_parent = current_concept;
                console.log("current_parent is " + current_parent);
            } else { //1.1.c, if current_concept is concept
                let new_k = k.replace('c', 'v');
                current_parent = umr[new_k];
                console.log("current_parent is " + current_parent);
            }
            showHead();
            current_mode = 'add';
        }
    } else if (id === 'set_parent') {
        let test_str = "";
        test_str += selection;
        console.log("selected variable to be set to head: ", test_str);

        test_str = test_str.trim();
        let k = getKeyByValue(umr, test_str);
        if (k.includes("v")) {
            current_parent = test_str;
            console.log("current_parent is: " + current_parent);
        } else {
            let new_k = k.replace('c', 'v');
            current_parent = umr[new_k];
            console.log("current_parent is: " + current_parent);
        }
        showHead();
    } else if (id === 'doc-annot') {
        // current_parent = 's';
    } else if (id === 'add') {
        exec_command(current_parent + ' ' + current_relation + ' ' + current_concept, 1);
    } else if (id === 'add-constant') {
        exec_command(current_parent + ' ' + current_relation + ' ' + current_concept, 1);
    } else if (id === 'add-ne') {
        exec_command(current_parent + ' ' + current_relation + ' ' + current_ne_concept + ' ' + current_concept, 1);
    } else if (id === 'replace') {
        if (((arg1 = document.getElementById('replace-type')) != null)
            && ((arg2 = document.getElementById('replace-at')) != null)
            && ((arg3 = document.getElementById('replace-new')) != null)) {
            let type = arg1.value;
            let at = arg2.value;
            let new_value = arg3.value;

            // changing role is not allowed
            // let at_list = at.split(/\s+/);
            // if ((type === 'role') && (at_list) && (at_list.length >= 4) && (!at_list[2].match(/^"/))) {
            //     at = at_list[0] + ' ' + at_list[1] + ' "';
            //     for (let i = 2; i < at_list.length; i++) {
            //         at += at_list[i] + ' ';
            //     }
            //     at = at.replace(/\s*$/, "\"");
            // }
            if ((type === 'string') && new_value.match(/ /)) {
                new_value = '"' + new_value + '"';
            }
            exec_command('replace ' + type + ' at ' + at + ' with ' + new_value, 1);
        }
    } else if (id === 'delete') {
        if ((arg1 = document.getElementById('delete-at')) != null) {
            let at = arg1.value;
            let at_list = at.split(/\s+/);
            if (at_list && (at_list.length >= 4) && (! at_list[2].match(/^"/))) {
                at = at_list[0] + ' ' + at_list[1] + ' "';
                for (let i=2; i<at_list.length; i++) {
                    at += at_list[i] + ' ';
                }
                at = at.replace(/\s*$/, "\"");
	     }
	     exec_command('delete ' + at, 1);
        }
    } else if (id === 'move') {
        // move will not be invoked because move is not allowed
        if (((arg1 = document.getElementById('move-object')) != null)
            && ((arg2 = document.getElementById('move-new-head')) != null)
            && ((arg3 = document.getElementById('move-role')) != null)) {
            var mv_object = arg1.value;
            var new_head = arg2.value;
            var role = arg3.value;
            exec_command('move ' + mv_object + ' to ' + new_head + ' ' + role, 1);
        }
    }
    // if ((s = document.getElementById('command')) != null) {
    //     s.focus();
    // }
}

function exec_command(value, top) { // value: "b :arg1 car" , top: 1
    let last_command, command_input;
    let show_amr_args = '';
    let record_value = '';

    if ((command_input = document.getElementById('command')) != null) {
        //resizing the command input box height
        let clen = command_input.value.length;
        if (clen > 50) {  // && show_amr_obj['option-resize-command'] // if the input is longer than a line, resize the height
            let n_lines = Math.floor(clen / 43) + 1;
            command_input.style.height = ((n_lines * 1.2) + 0.2) + 'em';
        }
        // if exec_command is called from command box instead of other place, value is empty at this point
        if (!value) {
            if (command_input.value.match(/\n/)) {//if enter key is pressed
                value = command_input.value;
            }
        }

        if (value) {
            value = strip(value);
            value = value.replace(/^([a-z]\d*)\s+;([a-zA-Z].*)/, "$1 :$2"); // b ;arg0 boy ->  b :arg0 boy
            let cc;
            if(value.includes("(")){
                //doc-level
                let pattern = /^(s\d*)\s(:temporal|:modal|:coref)\s(\(s\d*[a-z]\d*\s:.+\s.+\))$/;
                //example match: s1 :temporal (s1t2 :before DCT)
                //s1 :coref (s1h :same-entity s1p)
                //s1 :modal (s2c4 :NEG AUTH)
                let match = pattern.exec(value);
                cc = [match[1], match[2], match[3]]; //["s1", ":temporal", "(s1t2 :before DCT)"]
            }else{
                cc = argSplit(value);
            }

            /** below are shortcut command **********************************************************************************************************************/
            if (value.match(/^(replace|delete|move|save|load|clear)$/)) {
                selectTemplate(value);
                top = 0;
            } else if (value.match(/^(delete all|delete amr|del all|del amr)$/i)) {
                deleteAMR();
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
            } else if (value.match(/^(c|cl)$/i)) {
                selectTemplate('clear');
                top = 0;
            } else if (value.match(/^change\s+variable\s+[a-z]\d*\s+\S+$/i)) { // example match: change variable t t1
                //cc[2] is original variable, cc[3] is desired variable
                change_var_name(cc[2], cc[3], top);
                show_amr_args = 'show';
            } else if (value.match(/^cv\s+[a-z]\d*\s+\S+\s*$/i)) { // example match: cv t t1
                //cc[1] is original variable, cc[2] is desired variable
                change_var_name(cc[1], cc[2], top);
                show_amr_args = 'show';
            } else if (value.match(/^reop\s+[a-z]\d*\s*$/i)) { //example match: reop t1
                renorm_ops(cc[1]); //reorder the op children of cc[1], could be s1n/name
                show_amr_args = 'show';
            } else if (value.match(/^r[rv]\b\s*(\S.*\S|\S|)\s+\S+\s*$/)) {  // replace role (or secondary variable) shortcut
                var user_descr = value.replace(/^r[rv]\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$1"); // only keep the first capturing group
                var new_value = value.replace(/^r[rv]\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$2"); // only keep the second capturing group
                var target_name = '';
                if (value.match(/^rr/)) {
                    target_name = 'role';
                } else if (value.match(/^rv/)) {
                    target_name = 'variable';
                }
                var loc_list = user_descr2locs(user_descr, target_name);
                if ((target_name == 'role') && !new_value.match(/^:[a-z]/i)) {
                    console.log('Ill-formed new role <font color="red">' + new_value + '</font>');
                } else if ((target_name == 'variable') && !getLocs(new_value)) {
                    console.log('Ill-formed new variable <font color="red">' + new_value + '</font>');
                } else if ((loc_list.length == 1) && !umr[loc_list[0] + '.r']) {
                    console.log('No ' + target_name + ' defined for <font color="red">' + user_descr + '</font>');
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = getParentVariable(loc);
                    var role = umr[loc + '.r'];
                    var variable = umr[loc + '.v'];
                    var target = role || variable;
                    var arg = umr[loc + '.v'] || umr[loc + '.command_input'] || umr[loc + '.s'];
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
                if ((loc_list.length == 1) && !(umr[loc_list[0] + '.s'] && umr[loc_list[0] + '.r'])) {
                    add_error('No string defined for <font color="red">' + user_descr + '</font>');
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = getParentVariable(loc);
                    var role = umr[loc + '.r'];
                    // add_log('expanding "' + user_descr + '/' + loc + '" to: replace string at ' + parent_variable + ' ' + role + ' with ' + new_value);
                    exec_command(('replace string at ' + parent_variable + ' ' + role + ' with ' + new_value), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if (loc_list.length == 0) {
                    console.log('Could not find any string for locator: ' + user_descr);
                } else {
                    console.log('Ambiguous string locator: ' + user_descr );
                }
            } else if (value.match(/^rc\b\s*(\S.*\S|\S|)\s+\S+\s*$/)) { // replace concept shortcut
                var user_descr = value.replace(/^rc\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$1");
                var new_value = value.replace(/^rc\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$2");
                var loc_list = user_descr2locs(user_descr, 'concept');
                if (!validEntryConcept(new_value)) {
                    console.log('Ill-formed new concept: ' + new_value);
                } else if ((loc_list.length == 1) && !umr[loc_list[0] + '.v']) {
                    console.log('No concept defined for: ' + user_descr);
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var variable = umr[loc + '.v'];
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
            } else if (value.match(/^del\s+\S/) || value.match(/^delete\s+\S+(\s+\S+)?\s*$/)) { // delete shortcut
                // add_log('delete shortcut: ' + value + '.');
                var user_descr = value.replace(/^(?:del|delete)\s+(\S.*\S|\S|)\s*$/, "$1");
                var loc_list = user_descr2locs(user_descr, 'delete');
                if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = getParentVariable(loc);
                    var role = umr[loc + '.r'];
                    var variable = umr[loc + '.v'];
                    var arg = umr[loc + '.v'] || umr[loc + '.command_input'] || umr[loc + '.s'];
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
            } else if (cc.length >= 1) {
                /** when cc is longer than one (unlike above)**********************************************************************************************************************/
                // cc == ["b", ":arg1", "car"]
                let ne_concept;
                let cc2v;
                if ((cc[0] === 'top') || (cc[0] === 'bottom') || (cc[0] === 'new')) {
                    if ((cc.length >= 3) && (cc[0] === 'top') && (ne_concept = cc[1]) && validEntryConcept(ne_concept) && (!getLocs(ne_concept)) && (is_standard_named_entity[ne_concept] || listContainsCap(cc))) {
                        // top is named entity: top person Jin Zhao
                        let ne_var = newAMR(trimConcept(ne_concept));
                        let name_var = addTriple(ne_var, ':name', 'name', 'concept');
                        for (let i = 2; i < cc.length; i++) {
                            var sub_role = ':op' + (i - 1);
                            addTriple(name_var, sub_role, cc[i], 'string');
                        }
                        if (current_template !== 'top') {
                            selectTemplate('clear');
                        }
                        show_amr_args = 'show';
                    } else if (cc.length >= 2) {
                        // this is when cc only has two element (the first probably is top)
                        for (let i = 1; i < cc.length; i++) {
                            if ((cc[0] === 'top') && getLocs(cc[i])) {
                                //when the arg already exist in amr tree, take out the argument as a new top (a new tree)
                                move_var_elem(cc[i], 'top', '');
                            } else {
                                // when the arg is not already in tree yet
                                newAMR(cc[i].toLowerCase());
                            }
                        }
                        if (current_template !== 'top') {
                            selectTemplate('clear');
                        }
                        show_amr_args = 'show';
                    }
                    /** automatic reification **********************************************************************************************************************/
                } else if ((cc.length >= 3) && (cc[1] === ':domain-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    cc.splice(1, 1, ':mod');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':subset') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG2-of', 'include-91');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && ((cc[1] === ':subset-of') || (cc[1] === ':superset')) && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'include-91');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':cause') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'cause-01');
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':cause-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG0-of', 'cause-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':cite') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'cite-01');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':cost') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'cost-01');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':cost-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG2-of', 'cost-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && ((cc[1] === ':except') || (cc[1] === ':prep-except')) && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG2-of', 'except-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':instead-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'instead-of-91');
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':meaning') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG0-of', 'mean-01');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':meaning-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'mean-01');
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':role') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let role_candidate = cc[2];
                    let role_frame;
                    if (is_have_rel_role_91_role[role_candidate]) {
                        role_frame = 'have-rel-role-91';
                    } else {
                        role_frame = 'have-org-role-91';
                    }
                    let new_var = addTriple(cc[0], ':ARG0-of', role_frame);
                    cc.splice(0, 2, new_var, ':ARG2');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':role-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let role_candidate = cc[2]; // this line is added to original code
                    let role_frame;
                    if (is_have_rel_role_91_role[role_candidate]) {
                        role_frame = 'have-rel-role-91';
                    } else {
                        role_frame = 'have-org-role-91';
                    }
                    let new_var = addTriple(cc[0], ':ARG2-of', role_frame);
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':employed-by') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG0-of', 'have-org-role-91');
                    cc.splice(0, 2, new_var, ':ARG1');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] === ':employed-by-of') && getLocs(cc[0]) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ARG1-of', 'have-org-role-91');
                    cc.splice(0, 2, new_var, ':ARG0');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length === 3) && (cc[1] === ':ord') && getLocs(cc[0]) && cc[2].match(/^-?[1-9]\d*$/i) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':ord', 'ordinal-entity');
                    cc.splice(0, 2, new_var, ':value');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length === 3) && (cc[1] === ':xref') && getLocs(cc[0]) && cc[2].match(/^[A-Z]+:\S+/i) && show_amr_obj['option-auto-reification']) {
                    let new_var = addTriple(cc[0], ':xref', 'xref');
                    cc.splice(0, 2, new_var, ':value');
                    exec_command(cc.join(" "), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                    /** move and add **********************************************************************************************************************/
                } else if ((cc.length === 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && getLocs(cc[2]) && (cc[3] == '-')) {
                    
                    move_var_elem(cc[2], cc[0], cc[1]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if((cc.length === 3) && cc[0].match(/^s\d*/) && cc[1].match(/^:temporal|:modal|:coref/) && cc[2].match(/^\(s\d*[a-z]\d*\s:.+\s.+\)/)){
                    // doc_level
                    console.log("cc here: " + cc);
                    addTriple(cc[0], cc[1], cc[2], '');
                    if (current_template !== 'add') {
                        selectTemplate('clear');
                    }
                } else if ((cc.length === 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])
                    && (cc[2].match(/\-$/))
                    && (cc2v = cc[2].replace(/^(.*)\-$/, "$1"))
                    && getLocs(cc2v)) {
                    
                    move_var_elem(cc2v, cc[0], cc[1]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length === 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && getLocs(cc[2]) && (cc[3] == '+')) {
                    
                    addTriple(cc[0], cc[1], cc[2]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length === 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])
                    && (cc[2].match(/\+$/))
                    && (cc2v = cc[2].replace(/^(.*)\+$/, "$1"))
                    && getLocs(cc2v)) {
                    
                    addTriple(cc[0], cc[1], cc2v);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])) {
                    
                    // this is the condition we go in 1
                    addTriple(cc[0], cc[1], cc[2], '');
                    if (current_template != 'add') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if ((cc.length >= 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && (cc[2] == '*OR*') && validEntryConcept(cc[3])) {
                    
                    addOr(value);
                    selectTemplate('');
                    show_amr_args = 'show';
                } else if ((cc.length >= 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && validEntryConcept(cc[2]) && (!getLocs(cc[2]))) {
                    
                    addNE(value);
                    if (current_template != 'add-ne') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':name') && getLocs(cc[0]) && (!getLocs(cc[2]))) {
                    
                    addNE(value);
                    if (current_template != 'add-ne') {
                        
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if (cc[0] === 'replace') {
                    
                    if (cc.length == 1) {
                        
                        console.log('Ill-formed replace command. Arguments missing. First argument should be the type of AMR element to be replaced: concept, string or role');
                    } else if (cc[1] == 'concept') {
                        if (cc.length == 6) {
                            
                            replace_concept(cc[2], cc[3], cc[4], cc[5]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            
                            console.log('Ill-formed replace concept command. Incorrect number of arguments. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
                        }
                    } else if (cc[1] == 'string') {
                        
                        if (cc.length == 7) {
                            
                            replace_string(cc[2], cc[3], cc[4], cc[5], stripQuotes(cc[6]));
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            
                            console.log('Ill-formed replace string command. Incorrect number of arguments. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                        }
                    } else if (cc[1] == 'role') {
                        
                        if (cc.length == 8) {
                            replace_role(cc[2], cc[3], cc[4], cc[5], cc[6], cc[7]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            console.log('Ill-formed replace role command. Incorrect number of arguments. Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
                        }
                    } else if (cc[1] == 'variable') {
                        
                        if (cc.length == 8) {
                            replace_variable(cc[2], cc[3], cc[4], cc[5], cc[6], cc[7]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            console.log('Ill-formed replace role command. Incorrect number of arguments. Usage: replace variable at &lt;var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                        }
                    } else {
                        console.log('Ill-formed replace command. First argument should be the type of AMR element to be replaced: concept, string or role');
                    }
                } else if (cc[0] === 'delete') {
                    
                    if (cc.length === 4) {
                        if ((cc[1] === 'top') && (cc[2] === 'level')) {
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
                } else if ((cc[0] === 'move') || (cc[0] === 'mv')) {
                    
                    if (cc.length >= 4) {
                        if (cc[2] === 'to') {
                            if (cc.length === 4) {
                                move_var_elem(cc[1], cc[3], '');
                                show_amr_args = 'show';
                            } else if (cc.length === 5) {
                                move_var_elem(cc[1], cc[3], cc[4]);
                                show_amr_args = 'show';
                            } else {
                                console.log('Ill-formed move command. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
                            }
                        } else {
                            console.log('Ill-formed move command. Second argument should be <i>to</i>. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
                        }
                    } else {
                        console.log('Ill-formed move command. Not enough arguments. Usage: move &lt;var&gt; to &lt;new-head-var&gt; [&lt;role&gt;]');
                    }
                } else if ((cc.length >= 2) && cc[1].match(/^:/)) {
                    
                    if ((cc[0].match(/^[a-z]\d*$/)) && !getLocs(cc[0])) {
                        console.log('In <i>add</i> command, ' + cc[0] + ' is not last_command defined variable.');
                    } else if (cc.length == 2) {
                        console.log('In <i>add</i> command, there must be at least 3 arguments.');
                    } else {
                        console.log('Unrecognized <i>add</i> command.');
                    }
                } else if (value.match(/^record /i)) { //sample match: 'record reop s1n'
                    
                    record_value = value.replace(/^record\s*/, ""); // 'record reop s1n' -> 'reop s1n'
                } else {
                    
                    if (!value.match(/^(h|help)\b/i)) {
                        console.log('Unrecognized command: <font color="red">' + value + '</font>');
                    }
                    selectTemplate('help');
                    top = 0;
                }
            }

            if (top) {// the undo and redo up right corner
                
                record_value = record_value || value; //"record reop s1n"
                // value: "b :arg1 car"
                // last_command.innerHTML = record_value;
                show_amr(show_amr_args); // show_amr_args:'show'
                if (state_has_changed_p) {
                    
                    let old_state = undo_list[undo_index];
                    old_state['action'] = record_value;
                    undo_index++;
                    undo_list.length = undo_index;
                    undo_list[undo_index] = cloneCurrentState();
                    showEditHistory();
                    let s;
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
}


/**
 * find the correct alignment info for abstract concept like name
 */
function correctAlignments(){
    Object.keys(umr).forEach(function(key){
        if(key.match(/\d+.v/)){ // abstract concepts have "-1--1" alignment
            if((umr[key] === "" && umr[key.replace('.v', '.s')].match(/^(|1st|2nd|3rd|non-1st|non-3rd|Incl\.|Excl\.|Singular|Dual|Trial|Paucal|Plural|Intensifier|Downtoner|intensifier|downtoner|Habitual|habitual|Activity|activity|Endeavor|endeavor|Performance|performance|State|Imperfective|Perfective|Process|Atelic Process|expressive|interrogative|imperative|-|\+)$/))
            || abstractConcepts.indexOf(umr[key.replace('.v', '.c')]) > -1){ // arg-concept c
                umr[key.replace('.v', '.a')] = "-1--1";
            }
        }

        if(key.match(/\d+.v/) && umr[key] !== "" && getLocs(umr[key]) !== undefined){ // deal with coref
            let locs_list = getLocs(umr[key]).split(' ');
            if(locs_list.length > 1){
                let shared_align = "";
                for(let i = 0; i <locs_list.length; i++){
                    if(umr[locs_list[i] + '.c'] !==""){
                        shared_align = umr[locs_list[i] + '.a'];
                    }
                }
                 for(let i = 0; i <locs_list.length; i++){
                    if(umr[locs_list[i] + '.c'] ===""){
                        umr[locs_list[i] + '.a'] = shared_align;
                    }
                }
            }
            if((umr[key] === "" && umr[key.replace('.v', '.s')].match(/^(|1st|2nd|3rd|non-1st|non-3rd|Incl\.|Excl\.|Singular|Dual|Trial|Paucal|Plural|Intensifier|Downtoner|intensifier|downtoner|Habitual|habitual|Activity|activity|Endeavor|endeavor|Performance|performance|State|Imperfective|Perfective|Process|Atelic Process|expressive|interrogative|imperative|-|\+)$/))
            || abstractConcepts.indexOf(umr[key.replace('.v', '.c')]) > -1){ // arg-concept c
                umr[key.replace('.v', '.a')] = "-1--1";
            }
        }

        if(umr[key] === "name"){
            // console.log(umr[key]);
            let beg = 10000;
            let end = -1;
            let locs = key.replace('.c','');
            // console.log(locs);
            let pattern = new RegExp(`${locs}.\\d+.a`);
            for(let i=0; i<Object.keys(umr).length; i++){
                if(pattern.test(Object.keys(umr)[i])){
                    // console.log("match!"+ umr[Object.keys(umr)[i]]);
                    let s = parseInt(umr[Object.keys(umr)[i]].split('-')[0]);
                    let e = parseInt(umr[Object.keys(umr)[i]].split('-')[1]);
                    umr[Object.keys(umr)[i]] = s + '-' + e;
                    if(s < beg){
                        beg = s;
                    }
                    if(e > end){
                        end = e;
                    }
                }
            }
            if(beg !== 10000){
                umr[key.replace('.c','.a')] = beg + '-' + end;
            }
        }
    })

}

function showAnnotatedTokens(){
    Object.keys(umr).forEach(function (key) {
        if (/[\\d|\\.]+a/gm.test(key)) {
            if (!(key.replace('a', 'd') in umr)){
                let indice = umr[key].split("-");
                if ((parseInt(indice[0]) > 0) && (parseInt(indice[1]) > 0)){
                    for (let i = parseInt(indice[0]); i <= parseInt(indice[1]); i++) {
                        let cell2highlight = document.getElementById("sentence").childNodes[2].getElementsByTagName("td")[i];
                        let newNode = document.createElement("span");
                        // Make it highlight
                        newNode.setAttribute("class", "text-success");
                        //Make it deletable by click
                        newNode.onclick = function () {
                            // if (confirm("do you want to delete it?")) {
                            //     deleteNode(newNode);
                            // } else {
                            //     alert(cell2highlight);
                            // }
                            deleteNode(newNode);
                        };
                        let cellText = cell2highlight.innerText;
                        // remove unwanted highlighted Attribute Values span got generated, maybe there is a better way to do this
                        if (cellText !== "Attribute Values " && cellText !== "Attributes " && cellText !==""){
                            // console.log("I am here highlight1");
                            newNode.appendChild(document.createTextNode(cell2highlight.innerText));
                            cell2highlight.replaceChild(newNode, cell2highlight.firstChild)
                        }
                        // console.log("new cell: " + cell2highlight);
                    }
                }
            }
        }
    });

}
function showAlign(){
    correctAlignments();
    let alignInfo;
    if (( alignInfo = document.getElementById('align')) != null){
        let alignment_string = '';
        Object.keys(umr).forEach(function (key) {
            if (/[\\d|\\.]+c/gm.test(key)) {
                if (!(key.replace('c', 'd') in umr)){ // if the node is not deleted already
                    if (umr[key.replace('c', 'a')] !== "NaN-NaN"){ //NaN appears when the same variable is added in the second time
                        if(umr[key]){//empty c, has s
                        alignment_string += umr[key] + "(" + umr[key.replace('c', 'v')] + "): " + umr[key.replace('c', 'a')] + htmlSpaceGuard('\n');
                        }else{
                            alignment_string += umr[key.replace('c', 's')] + "(" + umr[key.replace('c', 'v')] + "): " + umr[key.replace('c', 'a')] + htmlSpaceGuard('\n');
                        }
                    }
                }
            }
        });
        alignInfo.innerHTML = htmlSpaceGuard('\n') + alignment_string;
    }
}
function showHead(){
    let existingHead = document.getElementById("amr").getElementsByClassName("text-success");
    while(existingHead.length){
        var parent = existingHead[0].parentNode;
        while(existingHead[0].firstChild){
            parent.insertBefore(existingHead[0].firstChild, existingHead[0]);
        }
        parent.removeChild(existingHead[0]);
    }
    highlight(document.getElementById("amr"), [current_parent + " "]);
}


/** add ******************************************************/
/**
 * add a new (or existing) key value pair (variable: loc) to the variables dictionary
 * @param v 'b'
 * @param loc "1.1.3"
 */
function recordVariable(v, loc) {
    if ((v !== undefined) && (v !== '')) {
        let old_value = getLocs(v);
        if (old_value) {
            variables[v] = old_value + ' ' + loc;
        } else {
            variables[v] = loc + '';
        }
    }
}

/**
 * add a new (or existing) key value pair (concept: loc) to the concepts dictionary (populate concepts)
 * @param c 'boy'
 * @param loc "1.1.3"
 */
function recordConcept(c, loc) {
    if ((c !== undefined) && (c !== '')) {
        if (concepts[c]) {
            concepts[c] = `${concepts[c]} ${loc}`;
        } else {
            concepts[c] = loc;
        }
    }
}

/**
 * given concept return variable, with sentence id but without variable counting index
 * @param concept
 * @returns {string} variable (initial)
 */
function newVar(concept) {
    let v;
    concept = concept.replace(/^[:*!]([a-z])/i, "$1"); //example: *s -> s
    let initial = concept.substring(0, 1).toLowerCase();
    if (!initial.match(/[a-z]/)) {
        initial = 'x';
    }

    // add the sentence number s1 to initial t -> s1t
    let sentenceId = document.getElementById('sentence_id').value;
    if(table_id===1){
        initial = "s"+ sentenceId + initial;
    }else{
        initial = "s"+ (parseInt(sentenceId)+1) + initial;
    }

    // increase index or reserve variable 'i' for concept 'i'
    if (getLocs(initial) || variablesInUse[initial] || concept.match(/^i./i)) {
        let index = 2;
        v = initial + index;
        while (getLocs(v) || variablesInUse[v]) {
            index++;
            v = initial + index;
        }
    } else {
        v = initial;
    }
    return v;
}

/**
 * @param s: rs Edmond with , rc taste with buy, rv t, rr , del t, delete performance
 * @param type could be "string", "variable", "concept", or "delete"
 * @returns {Array} 1, 1.1, 1.1.1, 1.2, 1.2.1, 1.3, 1.4, 1.4.2, 1.4.2.1, 1.5
 */
function user_descr2locs(s, type) {
    s = s.replace(/\s+with$/, ""); //example match:"  with"
    let cc = argSplit(s);
    let var_locs;
    let result_locs = [];
    let sloppy_locs = [];
    let error_p = 0;
    if ((cc.length === 1) && (var_locs = getLocs(cc[0]))) {
        let loc_list = argSplit(var_locs);
        result_locs.push(loc_list[0]);
    } else {
        let parent_variable = '';
        let role = '';
        let variable = '';
        let string_or_concept = '';
        for (let i = 0; i < cc.length; i++) {
            if (getLocs(cc[i]) && (parent_variable === '') && (role === '') && (variable === '') && (string_or_concept === '')) {
                parent_variable = cc[i];
            } else if (cc[i].match(/^:[a-z]/i) && (role === '') && (variable === '') && (string_or_concept === '')) {
                role = cc[i];
            } else if ((role || parent_variable) && (variable === '') && (string_or_concept === '') && getLocs(cc[i])) {
                variable = cc[i];
            } else if (string_or_concept === '') {
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
        for (let key in umr) {
            if (key.match(/\.v$/)) {
                let loc = key.replace(/\.v$/, "") + '';
                let loc_concept = umr[loc + '.c'] || '';
                let loc_role = umr[loc + '.r'] || '';
                let loc_string = umr[loc + '.s'] || '';
                let loc_variable = umr[loc + '.v'] || '';
                let loc_parent_variable = getParentVariable(loc + '');
                console.log('user_descr2locs - Point D loc: ' + loc + ' loc_concept: ' + loc_concept + ' string_or_concept: ' + string_or_concept);
                if (deleted_p(loc)
                    || ((type === 'role') && !loc_role)           // no role to be replaced (top level)
                    || ((type === 'string') && !loc_string)         // no string to be replaced
                    || ((type === 'concept') && !loc_concept)        // no concept to be replaced
                    || ((type === 'variable') && !loc_variable)) {    // no variable to be replaced
                    // no match -> do nothing
                } else if (((parent_variable === '') || (parent_variable === loc_parent_variable))
                    && ((role === '') || (role.toLowerCase() === loc_role.toLowerCase()))
                    && ((variable === '') || (variable === loc_variable))
                    && ((string_or_concept === '') || (string_or_concept === loc_string) || (string_or_concept === loc_concept))) {
                    result_locs.push(loc);
                } else if (((parent_variable === '') || (parent_variable === loc_parent_variable))
                    && ((role === '') || sloppy_match(role, loc_role))
                    && ((variable === '') || (variable === loc_variable))
                    && ((string_or_concept === '') || sloppy_match(string_or_concept, loc_string) || sloppy_match(string_or_concept, loc_concept))) {
                    sloppy_locs.push(loc);
                }
            }
        }
    }
    console.log('user_descr2locs(' + s + '): ' + result_locs.join(", "));
    if (result_locs.length === 0) {
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
    
    let v = newVar(concept); // string initial
    let n = umr['n']; // n is how many amr trees currently in amr
    umr['n'] = ++n;
    umr[n + '.c'] = concept;
    umr[n + '.v'] = v;
    umr[n + '.n'] = 0;
    umr[n + '.s'] = '';
    console.log("begOffset1: ", begOffset);
    console.log("endOffset1: ", endOffset);
    umr[n + '.a'] = begOffset + "-" + endOffset;
    begOffset = -1;
    endOffset = -1;
    recordVariable(v, n);
    recordConcept(concept, n);
    variable2concept[v] = concept;
    state_has_changed_p = 1;
    console.log('new AMR tree: '+ 'number' + n +' with head var: ' + v);
    return v;
}

/**
 * add a triple to umr, update variables and concepts, reorder ops
 * @param head b
 * @param role :arg1
 * @param arg car
 * @param arg_type concept, string
 * @returns {*} arg_variable
 */
function addTriple(head, role, arg, arg_type) {
    head = strip(head); // b
    role = strip(role); // :arg1
    arg = strip(arg); //car
    let head_var_locs = getLocs(head);
    let arg_var_locs;
    let arg_variable;
    let arg_concept;
    let arg_string;
    if (head && role && (arg !== undefined) && (arg !== '')  //all three parameters exist
        && head_var_locs) { //head already existed in variables dictionary
        arg_var_locs = getLocs(arg);
        if (arg_var_locs //argument already exist in variables dictionary
            && (arg_type !== 'concept')
            && (arg_type !== 'string') // arg_type is empty (is variable)
            && (!role.match(/^:?(li|wiki)$/))) {
            console.log("I am here40-1");
            arg_variable = arg;
            arg_concept = '';
            arg_string = '';
        } else if ((language === 'chinese' || language === 'english' || language === 'arabic' ) //English
            && validEntryConcept(arg) //不能有大写字母，单引号(以及其他符号)，或者数字（arapahoe里面有）
            && (arg_type !== 'string') // arg_type is "concept" or empty (is variable)
            && (!role_unquoted_string_arg(role, arg, '')) //should be quoted (not a number, polarity, mode or aspect)
            && (!role.match(/^:?(li|wiki)$/))) {
            console.log("I am here40-2");
            arg_concept = trimConcept(arg); //"concept.truffle" -> "truffle", or "!truffle" -> "truffle"
            arg_variable = newVar(arg_concept); // truffle -> s1t
            arg_string = '';
        } else if ((language === 'chinese' || language === 'english' || language === 'arabic' ) //English
            && validEntryConcept(arg.toLowerCase()) //可以有大写字母，不能有单引号(以及其他符号)，或者数字（arapahoe里面有）
            && (arg_type !== 'string')
            && (!role_unquoted_string_arg(role, arg, '')) //should be quoted (not a number, polarity, mode or aspect)
            && (!role.match(/^:?(li|wiki|name)$/))) {
            console.log("I am here40-3");
            arg_concept = trimConcept(arg.toLowerCase()); //"concept.truffle" -> "truffle", or "!truffle" -> "truffle"
            arg_variable = newVar(arg_concept); // truffle -> s1t
            arg_string = '';
        }else if((default_langs.includes(language) || language === 'chinese'|| language === 'arabic' )//not English
            && (arg_type !== 'string')
            && (!role_unquoted_string_arg(role, arg, '')) //should be quoted (not a number, polarity, mode or aspect)
            && (!role.match(/^:?(li|wiki)$/))){
            console.log("I am here40-4");
            arg_concept = trimConcept(arg.toLowerCase()); //"concept.truffle" -> "truffle", or "!truffle" -> "truffle"
            arg_variable = newVar(arg_concept); // truffle -> s1t
            arg_string = '';
        }else if (validString(arg) //matches all non-white space character (except ")
            && (umr[getKeyByValue(umr, head).replace('v', 'c')] === 'name' //head concept is 'name'
                ||role.match(/^(:Aspect|:mode|:polarity|:refer-number|:refer-person|:degree|:MODSTR)$/))){
            console.log("I am here40-5");
            arg_string = arg; // "Edmund", "Performance", "imperative", "-"
            arg_concept = '';
            arg_variable = '';
            // this has potential problem when multiple string appears in same sentence
            let len = document.getElementById('sentence').children[1].rows[0].cells.length
            for (let i=0; i<len; i++){
                if(document.getElementById('sentence').children[1].rows[0].cells[i].innerText===arg){
                    // find the beginning and ending index of string argument, to give head abstract concept alignment information
                    begOffset = i;
                    endOffset = i;
                }
            }
        } else if (validString(stripQuotes(arg))) { //matches all non-white space character (except ")
            console.log("I am here40-6");
            arg_string = stripQuotes(arg);
            arg_concept = '';
            arg_variable = '';
        } else {
            console.log('Ill-formed command "' + head + ' ' + role + '' + arg + '" &nbsp; Last argument should be a concept, string or previously defined variable.');
            return '';
        }
        head_var_locs += ''; //todo: just changed here, could have consequences
        let head_var_loc_list = argSplit(head_var_locs); // the head var could have multiple locs
        let head_var_loc = head_var_loc_list[0]; // use the first loc of head var
        let n_subs = umr[head_var_loc + '.n']; // how many children head var has
        umr[head_var_loc + '.n'] = ++n_subs; // add one more children
        // console.log('subs ' + head_var_loc + '.n: ' + n_subs);
        let new_loc = head_var_loc + '.' + n_subs;
        // console.log('adding ' + head + ' ' + role + ' ' + arg + ' ' + new_loc);
        umr[new_loc + '.v'] = arg_variable;
        umr[new_loc + '.r'] = role;
        umr[new_loc + '.n'] = 0;
        umr[new_loc + '.c'] = arg_concept;
        umr[new_loc + '.s'] = arg_string;

        console.log("begOffset2: ", begOffset);
        console.log("endOffset2: ", endOffset);
        // if(umr[new_loc + '.v'] === "" && umr[new_loc + '.r'].match(/op\d+/)){ // this is hardcoding to deal with the weird bug that name entity alignments always 1 less
        //     begOffset += 1;
        //     endOffset += 1;
        // }
        umr[new_loc + '.a'] = begOffset + "-" + endOffset;
        begOffset = -1;
        endOffset = -1;

        recordVariable(arg_variable, new_loc); // add to variables dictionary
        recordConcept(arg_concept, new_loc); // add to concepts dictionary
        variable2concept[arg_variable] = arg_concept; // add to variable2concept dictionary
        state_has_changed_p = 1; //it turns to 1 when a triple is added, it is set to 0 after execute commanded is finished todo:can be used to tell if command is executed completely
        if (role.match(/^:op(-\d|0|\d+\.\d)/)) {
            
            renorm_ops(head); //in umr, reorder :op5, :op8, :op6 to :op1, :op2, :op3
        }
        return arg_variable;
    } else {
        return '';
    }
}

/**
 * populate amr, update variables and concepts
 * @param value add person Edmond Pope
 */
function addNE(value) {
    console.log('add_ne: ' + value);
    let cc = argSplit(value);
    let head_var = cc[0];
    let role = cc[1];
    let ne_type = cc[2];
    let name_var = '';
    let name_start = 3;
    if (role === ':name') {
        name_var = addTriple(head_var, role, 'name', 'concept');
        if (ne_type !== 'name') {
            name_start = 2;
        }
    } else {
        let ne_arg_var = addTriple(head_var, role, ne_type, 'concept');
        if (ne_arg_var) {
            name_var = addTriple(ne_arg_var, ':name', 'name', 'concept');
        } else {
            console.log('Ill-formed add-ne command. Possibly a problem with argument ' + ne_type);
        }
    }
    if (name_var) {
        for (let i = name_start; i < cc.length; i++) {
            let sub_role = ':op' + (i - name_start + 1);
            addTriple(name_var, sub_role, cc[i], 'string');
        }
    }
}

/**
 * check if value is valid, add triple, if not, add error, :op appears here
 * @param value "b :mod pretty very much so"
 */
function addOr(value) {
    let cc = argSplit(value);
    let head_var = cc[0];
    let role = cc[1];
    let key_or = cc[2];
    let name_var = '';
    let ill_formed_concepts = [];
    let or_var;
    for (let i = 3; i < cc.length; i++) {
        if (!validEntryConcept(cc[i])) {
            ill_formed_concepts.push(cc[i]);
        }
    }
    if (ill_formed_concepts.length >= 2) {
        console.log('Ill-formed concepts following *OR*: ' + ill_formed_concepts.join(", "));
    } else if (ill_formed_concepts.length === 1) {
        console.log('Ill-formed concept following *OR*: ' + ill_formed_concepts[0]);
    } else {
        if (head_var === 'top') {
            or_var = newAMR(key_or);
        } else {
            or_var = addTriple(head_var, role, key_or, 'concept');
        }
        if (or_var) { // when cc is longer than 3, the rest elements are ops
            for (let i = 3; i < cc.length; i++) {
                let sub_role = ':op' + (i - 2);
                addTriple(or_var, sub_role, cc[i], 'concept');
            }
        }
    }
}

/** replace ******************************************************/
/**
 * @param key_at 'at'
 * @param head_var head variable s1t
 * @param key_with 'with'
 * @param new_concept 'noodle'
 */
function replace_concept(key_at, head_var, key_with, new_concept) {
    console.log('replace_concept ' + key_at + '::' + head_var + '::' + key_with + '::' + new_concept);
    new_concept = new_concept.replace(/\.(\d+)$/, "-$1");  // build.01 -> build-01
    if (key_at === 'at') {
        let head_var_locs = getLocs(head_var);
        if (head_var_locs) {
            if (key_with === 'with') {
                // if (validEntryConcept(new_concept) || language === "default") {
                if (new_concept) {
                    head_var_locs += '';
                    let loc_list = argSplit(head_var_locs);
                    let loc = loc_list[0];
                    let old_concept = umr[loc + '.c'];
                    umr[loc + '.c'] = trimConcept(new_concept);
                    change_var_name(head_var, new_concept, 0);
                    state_has_changed_p = 1;
                } else {
                    console.log('Ill-formed replace concept command. Last argument should be a valid concept. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
                }
            } else {
                console.log('Ill-formed replace concept command. Fourth argument should be "with". Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
            }
        } else {
            console.log('Ill-formed replace concept command. Third argument should be a defined variable. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
        }
    } else {
        console.log('Ill-formed replace concept command. Second argument should be "at". Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
    }
}

/**
 * @param key_at 'at'
 * @param head_var head variable n
 * @param role :op1
 * @param key_with 'with'
 * @param new_string 'Ed'
 */
function replace_string(key_at, head_var, role, key_with, new_string) {
    console.log('replace_string ' + key_at + '::' + head_var + '::' + role + '::' + key_with + '::' + new_string);
    if (key_at === 'at') {
        let head_var_locs = getLocs(head_var);
        if (head_var_locs) {
            if (role.match(/^:[a-z]/i)) {
                if (key_with === 'with') {
                    if (validString(new_string)) {
                        // add_log('replace_string: ' + head_var + ' ' + role + ' ' + new_string);
                        head_var_locs += '';
                        let head_var_loc_list = argSplit(head_var_locs);
                        let head_var_loc = head_var_loc_list[0];
                        let n_subs = umr[head_var_loc + '.n'];
                        let string_loc = '';
                        for (let i = 1; i <= n_subs; i++) {
                            if (string_loc === '') {
                                let sub_loc = head_var_loc + '.' + i;
                                let sub_role = umr[sub_loc + '.r'];
                                if (sub_role === role) {
                                    string_loc = sub_loc;
                                }
                            }
                        }
                        if (string_loc) {
                            let old_string = umr[string_loc + '.s'];
                            umr[string_loc + '.s'] = new_string;
                            state_has_changed_p = 1;
                            // add_log('replace string at ' + head_var + ' ' + role + ': ' + old_string + ' &rarr; ' + new_string);
                        } else {
                            console.log('In replace string command, could not find role <font color="red">' + role + '</font> under variable ' + head_var);
                        }
                    } else {
                        console.log('Ill-formed replace string command. Last argument (<font color="red">' + new_string + '</font>) should be a valid string. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                    }
                } else {
                    console.log('Ill-formed replace string command. Fifth argument should be "with". Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                }
            } else {
                console.log('Ill-formed replace string command. Fourth argument should be a role starting with a colon. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
            }
        } else {
            console.log('Ill-formed replace string command. Third argument should be a defined variable. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
        }
    } else {
        console.log('Ill-formed replace string command. Second argument should be "at". Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
    }
}

//not allowed
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
                            var n_subs = umr[head_var_loc + '.n'];
                            var role_arg_loc = '';
                            var arg2 = stripQuotes(arg);
                            var arg3 = trimConcept(arg);
                            for (var i = 1; i <= n_subs; i++) {
                                if (role_arg_loc == '') {
                                    var sub_loc = head_var_loc + '.' + i;
                                    var sub_role = umr[sub_loc + '.r'];
                                    if ((!umr[sub_loc + '.d'])
                                        && (sub_role == old_role)) {
                                        var arg_variable = umr[sub_loc + '.v'];
                                        var arg_concept = umr[sub_loc + '.c'];
                                        var arg_string = umr[sub_loc + '.s'];
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
                                var old_role = umr[role_arg_loc + '.r'];
                                umr[role_arg_loc + '.r'] = new_role;
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
//not allowed
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
                            var n_subs = umr[head_var_loc + '.n'];
                            var role_arg_loc = '';
                            for (var i = 1; i <= n_subs; i++) {
                                if (role_arg_loc == '') {
                                    var sub_loc = head_var_loc + '.' + i;
                                    var sub_role = umr[sub_loc + '.r'];
                                    if ((!umr[sub_loc + '.d'])
                                        && (sub_role == role)) {
                                        var sub_variable = umr[sub_loc + '.v'];
                                        if (sub_variable && (old_variable == sub_variable)) {
                                            role_arg_loc = sub_loc;
                                        }
                                    }
                                }
                            }
                            if (role_arg_loc) {
                                var sub_concept = umr[role_arg_loc + '.c'];
                                if (sub_concept) {
                                    add_error('Ill-formed replace variable command. Fifth argument should be a <span style="text-decoration:underline;">secondary</span> variable, i.e. a leaf argument without its own concept. Usage: replace variable at &lt;head-var&gt; &lt;role&gt; &lt;old-variable&gt; with &lt;new-variable&gt;');
                                } else {
                                    umr[role_arg_loc + '.v'] = new_variable;
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
 * check if the given loc has .d field
 * @param loc 1.4
 * @returns {number} true or false
 */
function deleted_p(loc) {
    while (1) {
        if (umr[loc + '.d']) {
            return 1;
        } else if (loc.match(/\d\.\d+$/)) { // example match: 1.4
            loc = loc.replace(/\.\d+$/, ""); // change 1.4 -> 1
        } else {
            return 0;
        }
    }
}

/**
 * update umr, variables and concepts (umr and display are not changed, show_amr('show') needs to be called subsequently)
 * @param loc 1.4
 */
function delete_elem(loc) {
    console.log('delete_elem ' + loc);
    let locs, concept, variable;
    umr[loc + '.d'] = 1;
    state_has_changed_p = 1;
    if ((variable = umr[loc + '.v']) && (locs = getLocs(variable))) {
        locs += '';
        let loc_list = argSplit(locs);
        let new_loc_list = [];
        for (let i = 0; i < loc_list.length; i++) {
            let loc_i = loc_list[i];
            if (loc_i !== loc) {
                new_loc_list.push(loc_i + '');
            }
        }
        if ((new_loc_list.length >= 1)
            && (!umr[new_loc_list[0] + '.c'])
            && (concept = umr[loc + '.c'])) {
            umr[new_loc_list[0] + '.c'] = concept;
        }
        variables[variable] = new_loc_list.join(" ");
    }

    if ((concept = umr[loc + '.c'])
        && (locs = concepts[concept])) {
        locs += '';
        let loc_list = argSplit(locs);
        let new_loc_list = [];
        for (let i = 0; i < loc_list.length; i++) {
            let loc_i = loc_list[i];
            if (loc_i !== loc) {
                new_loc_list.push(loc_i + '');
            }
        }
        concepts[concept] = new_loc_list.join(" ");
    }
}

/**
 * recursively deleting all the branches of the selected node
 * @param loc 1.4
 */
function delete_rec(loc) {
    console.log('delete_rec ' + loc);
    delete_elem(loc);
    let n_subs = umr[loc + '.n'];
    for (let i = 1; i <= n_subs; i++) {
        let sub_loc = loc + '.' + i;
        if (!umr[sub_loc + '.d']) {
            delete_rec(sub_loc);
        }
    }
}

/**
 * @param head_var s1t
 * @param role :arg1
 * @param arg freedom
 */
function delete_based_on_triple(head_var, role, arg) {
    console.log('delete ' + head_var + ' ' + role + ' ' + arg);
    let head_var_locs = getLocs(head_var);
    if (head_var_locs) {
        if (role.match(/^:[a-z]/i)) {
            if (getLocs(arg) || validEntryConcept(arg) || validString(stripQuotes(arg))) {
                // add_log('delete_based_on_triple: ' + head_var + ' ' + role + ' ' + arg);
                head_var_locs += '';
                let head_var_loc_list = argSplit(head_var_locs);
                let head_var_loc = head_var_loc_list[0];
                let n_subs = umr[head_var_loc + '.n'];
                let loc = '';
                let arg2 = stripQuotes(arg);
                let arg3 = trimConcept(arg);
                for (let i = 1; i <= n_subs; i++) {
                    if (loc === '') {
                        var sub_loc = head_var_loc + '.' + i;
                        var sub_role = umr[sub_loc + '.r'];
                        if ((!umr[sub_loc + '.d'])
                            && (sub_role === role)) {
                            let arg_variable = umr[sub_loc + '.v'];
                            let arg_concept = umr[sub_loc + '.c'];
                            let arg_string = umr[sub_loc + '.s'];
                            if ((arg_variable && (arg === arg_variable))
                                || (arg_concept && (arg === arg_concept))
                                || (arg_concept && (arg3 === arg_concept))
                                || ((arg_string !== undefined) && (arg2 === arg_string))) {
                                loc = sub_loc;
                            }
                        }
                    }
                }
                delete_rec(loc);
            } else {
                console.log('Ill-formed delete command. Last argument should be an arg (variable, concept, string, or number). Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
            }
        } else {
            console.log('Ill-formed delete command. Second argument should be a valid role (starting with a colon). Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
        }
    } else {
        console.log('Ill-formed delete command. First argument should be a defined variable. Usage: delete &lt;head-var&gt; &lt;role&gt; &lt;arg&gt; &nbsp; <i>or</i> &nbsp; top level &lt;var&gt;');
    }
}

/**
 * @param variable s1t
 */
function delete_top_level(variable) {
    console.log('delete_top_level ' + variable);
    let loc, locs, loc_list;
    if (locs = getLocs(variable)) {
        locs += '';
        let tmp_loc_list = argSplit(locs);
        if ((loc_list = argSplit(locs))
            && (loc_list.length >= 1)
            && (loc = loc_list[0])
            && loc.match(/^\d+$/)) {
            delete_rec(loc);
        } else {
            console.log('Could not find top level AMR with variable ' + variable);
        }
    } else {
        console.log('Ill-formed delete top level command. Third argument should be a defined variable. Usage: delete rtop level &lt;var&gt;');
    }
}

/**
 * delete the whole thing
 */
function deleteAMR() {
    let n = umr['n'];
    for (let i = 1; i <= n; i++) {
        delete_elem(i);
    }
    state_has_changed_p = 1;
    selectTemplate('clear');
    show_amr('show');
    exec_command('record delete amr', 1);
}

// not allowed
function move_var_elem(variable, new_head_var, role) {
    console.log('move variable: ' + variable + ' to new head: ' + new_head_var + ' with new role (if not empty): ' + role);
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
                    if (role || (new_head_var == 'top') || (role = umr[loc + '.r'])) {
                        if ((head_var_loc_list = argSplit(head_var_locs))
                            && (head_var_loc_list.length >= 1)
                            && (head_var_loc = head_var_loc_list[0])) {
                            var n_subs, new_loc;
                            if (head_var_loc == 'top') {
                                n_subs = umr['n'];
                                umr['n'] = ++n_subs;
                                new_loc = n_subs;
                            } else {
                                n_subs = umr[head_var_loc + '.n'];
                                umr[head_var_loc + '.n'] = ++n_subs;
                                new_loc = head_var_loc + '.' + n_subs;
                            }
                            // add_log('move core ' + loc + ' ' + head_var_loc + ' ' + new_loc);
                            for (var key in umr) {
                                var re1 = '^' + regexGuard(loc) + '(\\.(\\d+\\.)*[a-z]+)$';
                                var re2 = new_loc + '$1';
                                var new_key = key.replace(new RegExp('^' + regexGuard(loc) + '(\\.(\\d+\\.)*[a-z]+)$', ""), new_loc + '$1');
                                // add_log('   key: ' + key + ' re1: ' + re1 + ' re2: ' + re2 + ' new_key: ' + new_key);
                                if (new_key != key) {
                                    umr[new_key] = umr[key];
                                    // add_log('move amr update: ' + key + '&rarr; ' + new_key);
                                }
                            }
                            umr[new_loc + '.r'] = role;
                            umr[loc + '.d'] = 1;
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
 * this is used to directly change the variable to another one
 * in dictionary variables, the original key will be assigned empty value, the new key will be assigned original value
 {o: "1", r: "1.1", b: "1.1.1", c: "1.1.1.2"} -> {o: "1", r: "", b: "1.1.1", c: "1.1.1.2", r1: "1.1"}
 */
function change_var_name(variable, target, top) {
    console.log('change_var_name is called, variable: ' + variable + ', target: ' + target + ', top: ' + top);
    // For whole set. Target can be var or concept.
    let locs = getLocs(variable);
    let new_variable;
    let loc;
    if (locs) {
        variables[variable] = '';
        if ((target.match(/^(s\d)*[a-z]\d*$/)) && (!getLocs(target))) {
            new_variable = target;
        } else {
            new_variable = newVar(target);
        }
        let loc_list = argSplit(locs);
        for (let i = 0; i < loc_list.length; i++) {
            loc = loc_list[i];
            umr[loc + '.v'] = new_variable;
            recordVariable(new_variable, loc);
        }
        // add_log('  variable changed to ' + new_variable);
        state_has_changed_p = 1;
        exec_command('record change variable ' + variable + ' ' + target, top);
        return new_variable;
    }
    return 0;
}

/**
 * reorder the op children when ops are deleted or moved
 * @param variable a head variable that has op children
 */
function renorm_ops(variable) {
    let locs, loc_list, loc, n_subs, sub_loc, sub_role, op_numbers, op_ht, op_number;
    if ((locs = getLocs(variable))
        && (loc_list = argSplit(locs))
        && (loc = loc_list[0])) { // loc of head s1n/name
        n_subs = umr[loc + '.n']; //how many children s1n/name has
        op_numbers = [];
        op_ht = {};
        for (let i = 1; i <= n_subs; i++) { //traverse op children
            sub_loc = loc + '.' + i;
            if (!umr[sub_loc + '.d']) { //if not deleted already
                sub_role = umr[sub_loc + '.r'];
                if (sub_role.match(/^:op-?\d+(\.\d+)?$/)) { //example match :op1.6
                    op_number = sub_role.replace(/^:op(-?\d+(?:\.\d+)?)$/, "$1"); // ':op1.6' -> '1.6'
                    op_numbers.push(op_number); //['1.6']
                    op_ht[op_number] = sub_loc; //{'1.6': op child loc }
                    // console.log('set op_ht[' + op_number + '] = ' + sub_loc);
                }
            }
        }
        // console.log('renorm_ops ' + op_numbers.join(','));
        op_numbers.sort(function (a, b) {
            return a - b
        }); // sorting a list of number in ascending order, also works with string

        // console.log('renorm_ops (sorted) ' + op_numbers.join(','));
        //in umr, reorder :op5, :op8, :op6 to :op1, :op2, :op3
        for (let i = 0; i < op_numbers.length; i++) {
            op_number = op_numbers[i];
            sub_loc = op_ht[op_number];
            // console.log('get op_ht[' + op_number + '] = ' + sub_loc);
            umr[sub_loc + '.r'] = ':op' + (i + 1);
        }
        state_has_changed_p = 1;
        exec_command('record reop ' + variable, 1); //has to do with undo list
    }
}

/**
 * @param loc 1, 1.5
 * @returns {number} number of nodes including the current loc
 */
function number_of_nodes(loc) {
    let n_nodes = 0;
    if (!umr[loc + '.d']) {
        n_nodes++;
        let n = umr[loc + '.n'];
        for (let i = 1; i <= n; i++) {
            n_nodes += number_of_nodes(loc + '.' + i);
        }
    }
    return n_nodes;
}

// has something to do with OR op
function leafy_or_concept_p(loc) {
    var concept = umr[loc + '.c'];
    if (concept == '*OR*') {
        var n = umr[loc + '.n'];
        var leafy2_p = 1;
        for (var i = 1; i <= n; i++) {
            var sub_loc = loc + '.' + i;
            if (umr[sub_loc + '.r'].match(/^:op/)
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
    let variable = umr[loc + '.v'];
    let concept = umr[loc + '.c'];
    let string = umr[loc + '.s'];
    let role = umr[loc + '.r'] || '';
    let head_loc = '';
    let head_concept = '';
    let head_role = '';
    let n = '';
    let grand_head_loc = '';
    let grand_head_concept = '';
    if (loc.match(/\.\d+$/)) {
        head_loc = loc.replace(/\.\d+$/, "");
        head_concept = umr[head_loc + '.c'] || '';
        head_role = umr[head_loc + '.r'] || '';
        n = umr[head_loc + '.n'];
        if (head_loc.match(/\.\d+$/)) {
            grand_head_loc = head_loc.replace(/\.\d+$/, "");
            grand_head_concept = umr[grand_head_loc + '.c'] || '';
        }
    }
    if (role.match(/^:ARG\d+$/)) {
        return 1;
    } else if (show_amr_obj['option-string-args-with-head'] && (string !== '') && (variable === '')) {
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
 * decide if the string should be surrounded by quotation mark or not
 * @param role: :op
 * @param arg: something
 * @param loc: 1
 * @returns {number}
 */
function role_unquoted_string_arg(role, arg, loc) {
    let head_loc = '';
    let head_concept = '';
    let head_role = '';
    if (loc.match(/\.\d+$/)) { //example match: .999
        head_loc = loc.replace(/\.\d+$/, "");
        head_role = umr[head_loc + '.r'] || '';
    }
    if (role.match(/^:op/) && (head_role === ':name')) {
        return 0; //should be quoted
    }  else if(!arg.length){ // if arg is empty string
        return 1;
    }  else if (arg.match(/^\d+(?:\.\d+)?$/)     // a whole number or a floating number
        // || arg.match(/^(-|\+)$/)     // polarity
        || (role === ':MODSTR')
        || (role === ':polarity')
        || ((role === ':mode') && arg.match(/^(expressive|interrogative|imperative)$/)) //mode
        || (role ===':Aspect')
        || (role === ':refer-person')
        || (role === ':refer-number')
        || ((role === ':degree') && arg.match(/^(|Intensifier|Downtoner|intensifier|downtoner)$/))) {
        return 1; // should not be quoted
    } else {
        return 0;//should be quoted
    }
}

function tolerate_special_concepts(s) {
    if (s.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|I|\*OR\*)$/)) {
        return 1;
    }
    if (s.match(/^:[a-z]/i)) { //todo: when matching something like :l
        console.log(`from tolerate_special_concepts: ${s}`);
        return 1;
    }
    return 0;
}

/**
 * @param loc nth children in amr, most of the time only have 1 tree
 * @param args "show"
 * @param rec 0 or 1 , if rec, meaning there are ancestors, current is not top, if rec is false, current is top
 * @param ancestor_elem_id_list something like "amr_elem_1 amr_elem_2", it will be used to populate show_amr_obj[ele-amr_elem_1], which is used to generate html strings
 * @returns {string} returns a html string that represents the penman format
 */
function show_amr_rec(loc, args, rec, ancestor_elem_id_list) {
    loc += '';
    if (umr[loc + '.d']) { //if this node has already been deleted
        return '';
    } else {
        let concept = umr[loc + '.c']; // umr['1.c'] 1.c: "nenhlet"
        let alignment_index = umr[loc + '.a'] || ''; // umr['1.a'] 1.a: "2-2"
        let string = umr[loc + '.s'] || ''; // umr['1.s'] 1.s: ""
        let quoted_string = string; //umr['1.s'] 1.s: ""
        if (!string.match(/^".*"$/)) { // if there is no quotes around the string
            quoted_string = '"' + string + '"'; // quote the string
        }
        let protected_string = string; //unquoted string
        if (string.match(/ /)) { //match a space
            protected_string = quoted_string;
        }
        let protected_string2 = slashProtectQuote(protected_string); //"Edmund" -> \\\"Edmund\\\"
        var role = umr[loc + '.r'] || ''; //umr['1.r']
        let string_m = string;
        let string_is_number = string.match(/^\d+(?:\.\d+)?$/);
        if (!role_unquoted_string_arg(role, string, loc)) { //should quote
            string_m = quoted_string;
        }
        let variable = umr[loc + '.v']; //umr['1.v'] 1.v: "s1n"
        let arg = variable || concept || string;
        let s = '';
        var show_replace = args.match(/replace/);
        var show_delete = args.match(/delete/);
        var show_check = args.match(/check/) || ((!show_replace) && (!show_delete));
        var concept_m = concept; //concept string surrounded by html string
        var variable_m = variable; // variable string surrounded by html string
        var tree_span_args = ''; //something like 'id="amr_elem_1"' to be put in the html string on show delete mode
        var role_m = '';
        var elem_id = '';
        var onmouseover_fc = '';
        var onmouseout_fc = '';
        var onclick_fc = '';
        var head_loc, head_concept, head_variable, core_concept, var_locs;

        if (rec) { //if recursive
            role = umr[loc + '.r']; //umr['1.v']
            role_m = role;
            if (show_replace) {
                var type = 'role';
                head_loc = loc.replace(/\.\d+$/, "");
                head_variable = umr[head_loc + '.v'];
                var at = head_variable + ' ' + role + ' ' + arg;
                var old_value = role;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                role_m = '<span contenteditable="true" id="' + elem_id + '" title="click to change me" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + role + '</span>';
            }
        }
        if (show_delete) {
            elem_id = 'amr_elem_' + ++n_elems_w_id;
            onmouseover_fc = 'color_all_under_amr_elem(\'' + elem_id + '\',\'#FF0000\',\'mo\')';
            onmouseout_fc = 'color_all_under_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
            if (rec) {
                head_loc = loc.replace(/\.\d+$/, "");
                head_variable = umr[head_loc + '.v'];
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
            // let n = var_locs.split(" ").length;
            // //this is the place that the reentrance of the variable got the same color with the one it co-referenced
            // if (n >= 2) {
            //     elem_id = 'elem_var_id_' + loc;
            //     onmouseover_fc = 'color_all_var_occurrences(\'' + variable + '\',\'#FF0000\')';
            //     onmouseout_fc = 'color_all_var_occurrences(\'' + variable + '\',\'#000000\')';
            //     var title = 'variable ' + variable + ' occurs ' + n + ' times in this AMR';
            //     variable_m = '<span title="' + title + '" id="' + elem_id + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable + '</span>';
            // }
        }
        if (rec) {
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
                concept_m = '<span contenteditable="true" id="' + elem_id + '" title="click to change" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + concept + '</span>';
            } else if (show_delete) {
                variable_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable + '</span>';
                concept_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + concept_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            }
            s += '(' + variable_m + ' / ' + concept_m;

            var n = umr[loc + '.n'];
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
                var sub_string = umr[sub_loc + '.s'];
                var sub_role = umr[sub_loc + '.r'];
                if (umr[sub_loc + '.d']) {
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
            // console.log('ordered_indexes(' + concept + ') Point D: ' + ordered_indexes.join(', '));
            for (let i = 0; i < ordered_indexes.length; i++) {
                let index = ordered_indexes[i];
                let sub_loc = loc + '.' + index;
                let show_amr_rec_result = show_amr_rec(sub_loc, args, 1, ancestor_elem_id_list + elem_id + ' '); // this stores one amr line
                if (show_amr_rec_result) {
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
                var head_variable = umr[head_loc + '.v'];
                var role = umr[loc + '.r'];
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
                let role = umr[loc + '.r'];
                if ((role == ':wiki') && !string.match(/^\s*(|-)\s*$/i)) {
                    let wiki_url = 'https://en.wikipedia.org/wiki/' + htmlProtect(string);
                    string_m = '"<a href="' + wiki_url + '" title="' + wiki_url + '" target="_WIKI" style="color:#000080;">' + string + '</a>"';
                }
            }
            s += string_m;
        } else { // variable is not empty
            if (show_replace) {  // without concept, i.e. secondary variable
                var type = 'variable';
                var head_loc = loc.replace(/\.\d+$/, "");
                var head_variable = umr[head_loc + '.v'];
                var role = umr[loc + '.r'];
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
        // console.log("s: "+ s);
        return s;
    }
}

/**
 * this is the function populate the show_amr_obj with the options table content, and print out the penman format output to webpage
 * @param args "show" or "show replace" or "show delete", if args is empty string, nothing will be shown
 */
function show_amr(args) {
    let s; //DOM element that contains umr
    let html_amr_s; //html string of the umr penman graph
    n_elems_w_id = 0; //todo
    show_amr_mo_lock = ''; //todo
    let origScrollHeight = '';
    let origScrollTop = '';
    if ((s = document.getElementById('amr')) != null) { // the div that contains the umr penman graph
        origScrollHeight = s.scrollHeight;
        origScrollTop = s.scrollTop;
    }

    //generate the pennman string
    if (args) { //args can be "show", "replace", "delete" or "check"
        let amr_s = ''; // html string of the umr penman graph
        let n = umr['n']; // how many children currently in the tree
        for (let i = 1; i <= n; i++) { //traverse children
            let show_amr_rec_result = show_amr_rec(i, args, 0, ' '); //returns a html string that represents the penman format of this recursion
            if (show_amr_rec_result){
                amr_s += show_amr_rec_result + '\n';
            }
        }

        html_amr_s = amr_s;
        //todo: should I change the order of the two lines?
        html_amr_s = html_amr_s.replace(/\n/g, "<br>\n");
        html_amr_s = html_amr_s.replace(/&xA;/g, "\n"); //&xA;, It is the equivalent to \n -> LF (Line Feed).https://stackoverflow.com/questions/5541222/what-is-the-xa-character
        // this is the actual output part
        setInnerHTML('amr', html_amr_s);
        show_amr_status = args;
    }
    if ((s = document.getElementById('amr')) != null) {
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
    showAlign();
    if(language === 'chinese' || language === 'english'){
        showAnnotatedTokens();
    }
    showHead();
}

function showEditHistory(){
    let s = "";
    if(undo_list.length > 1){
        for(let i=0; i<undo_list.length; i++){
            Object.keys(undo_list[i]).forEach(function(key) {
                if(key.match('action')){
                    s += "show edit history" + i + ": " + undo_list[i]['action'] + " -" + document.getElementById("username").textContent + "<br>";
                }
            });
        }
    }
    document.getElementById('eh').innerHTML = s;
}

//todo: put this in hyper link later, instead of clicking on button
function goToEdit(number_string){
   let n = parseInt(number_string);
   undo(n - undo_index+1);
   showEditHistory();
}

/**
 * handles the indentation
 * @param loc
 * @param c
 * @param style : example: variable
 * @param n: indentation space
 * @returns {string}
 */
function indent_for_loc(loc, c, style, n) {
    let indentation, rem_loc, role;
    if (loc.match(/^\d+$/)) { //if loc is an integer (first level)
        indentation = '';
    } else {
        rem_loc = loc.replace(/\.\d+$/, ""); //get the first level number
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
                indentation += ' '.repeat(n);
            } else if (rem_loc.match(/\./)) {
                if (role = umr[rem_loc + '.r']) {
                    indentation += ' '.repeat(role.length + 1 + n);
                } else {
                    indentation += ' '.repeat(5 + n);
                }
            } else {
                indentation += ' '.repeat(n);
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
        let value = s.replace(new RegExp('^.*::' + key + ' '), "");
        value = value.replace(/^(.*?)::.*$/, "$1");
        return strip(value);
    } else {
        return '';
    }
}

function selectEvent(){
    document.onselectionchange = function selectSpan() {
        selection = document.getSelection();
        document.getElementById('selected_tokens').innerHTML = ""; //lexicalized concept button
        document.getElementById('selected_tokens').innerHTML += selection;

        if (selection.anchorNode.parentNode.parentNode.parentNode.parentNode.parentNode.id==='table2'){
            table_id = 2;
        }
        if(selection.anchorNode.parentNode.tagName === "TD"){// in sentence table
            // if(language==='default'){
            //     begOffset = selection.anchorNode.parentElement.cellIndex;
            //     endOffset = selection.focusNode.parentElement.cellIndex;
            // }else{
            //     begOffset = selection.anchorNode.parentElement.cellIndex + 1;
            //     endOffset = selection.focusNode.parentElement.cellIndex + 1;
            // }

            // console.log("beg cell index: ",selection.anchorNode.parentElement.cellIndex);
            // console.log("end cell index: ",selection.focusNode.parentElement.cellIndex);
            begOffset = selection.anchorNode.parentElement.cellIndex;
            endOffset = selection.focusNode.parentElement.cellIndex;
        }
    };
}
function get_selected_word(){
    localStorage["selected_word"] = document.getElementById('selected_tokens').innerHTML;
    localStorage.setItem('umr', JSON.stringify(umr));
}

function pass_citation_dict(citation_dict){
    localStorage.setItem('citation_dict', citation_dict);
}
function highlightSelection() {
    console.log("highlightSelection is called.");

    var userSelection = document.getSelection();

    //Attempting to highlight multiple selections (for multiple nodes only + Currently removes the formatting)
    //Copy the selection onto a new element and highlight it
    // var node = highlightRange(userSelection.getRangeAt(0)/*.toString()*/);
    // Make the range into a variable so we can replace it

    var range = userSelection.getRangeAt(0);
    var startIdx = range.startContainer.parentNode.cellIndex;
    var endIdx = range.endContainer.parentNode.cellIndex;

    var tableRow = range.endContainer.parentNode.parentNode;
    for (let i = startIdx; i <= endIdx; i++) {
        var newNode = document.createElement("span");

        // Make it highlight
        newNode.setAttribute("class", "text-success");
        //Make it "Clickable"
        newNode.onclick = function () {
            if (confirm("do you want to delete it?")) {
                deleteNode(newNode);
            } else {
                alert(tableRow.cells[i]);
            }
        };
        let cellText = tableRow.cells[i].innerText;
        // remove unwanted highlighted Attribute Values span got generated, maybe there is a better way to do this
        if (cellText !== "Attribute Values " && cellText !== "Attributes " && cellText !== "Abstract Concept "){
            newNode.appendChild(document.createTextNode(tableRow.cells[i].innerText));
            tableRow.cells[i].replaceChild(newNode, tableRow.cells[i].firstChild)
        }
    }
}

function highlight(elem, keywords, caseSensitive = true, cls = 'text-success') {
    if(keywords[0] !== undefined){
        const flags = caseSensitive ? 'gi' : 'g';
      // Sort longer matches first to avoid
      // highlighting keywords within keywords.
      keywords.sort((a, b) => b.length - a.length);
      Array.from(elem.childNodes).forEach(child => {
        const keywordRegex = RegExp(keywords.join('|'), flags);
        // console.log("console list is: ", keywords);
        // console.log("pattern is: ", keywords.join('|')+ "space?");
        // console.log("first keyword: ", keywords[0] === undefined );
        if (child.nodeType !== 3) { // not a text node
          highlight(child, keywords, caseSensitive, cls);
        } else if (keywordRegex.test(child.textContent)) {
          const frag = document.createDocumentFragment();
          let lastIdx = 0;
          child.textContent.replace(keywordRegex, (match, idx) => {
            const part = document.createTextNode(child.textContent.slice(lastIdx, idx));
            const highlighted = document.createElement('span');
            console.log("match: ", match);
            highlighted.textContent = match;
            highlighted.classList.add(cls);
            frag.appendChild(part);
            frag.appendChild(highlighted);
            lastIdx = idx + match.length;
          });
          const end = document.createTextNode(child.textContent.slice(lastIdx));
          frag.appendChild(end);
          child.parentNode.replaceChild(frag, child);
        }
      });
    }

}

function deleteNode(node) {
    let contents = document.createTextNode(node.innerText);
    node.parentNode.replaceChild(contents, node);
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

function changeButton(id) {
    var elem = document.getElementById(id);
    if (elem.innerText == "show more info") elem.innerText = "show less info";
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

/** load*************/

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

function loadErrorHandler(evt) {
    console.log("loadErrorHandler is called");
    if (evt.target.error.name === "NOT_READABLE_ERR") {
        console.log('loadErrorHandler: File could not be read.');
    } else {
        console.log('loadErrorHandler: Unspecified error');
    }
}

/** save*************/

function save_local_amr_file(sentence = "", temp = false) {
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

            if (temp) {
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
            } else {
                if (comment.match(/\S/)) {
                    text += comment + '\n';
                }
                text = s2.value;
                text = text.replace(/\n/g, "\r\n");

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
    console.log("reset_save is called");
    let s;
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
 * remove branch that contains .d
 */
function removeDeletedFromUmr(){
    let locs_to_delete = []
    Object.keys(umr).forEach(function(key) { //traverse all the items in umr
        if(key.match(/\d+.d/) && umr[key] === 1){ //traverse all the .d items in umr that have a value of 1
            locs_to_delete.push(key.replace("/.d/", ""));
        }
    });
    Object.keys(umr).forEach(function(key) { //traverse all the items in umr
        for (const loc of locs_to_delete){
            if(key.startsWith(loc)){
                delete umr.key;
            }
        }
    });
}

/**
 * pass all the information that need to be saved in database back to routes.py
 * @constructor
 */
function UMR2db() {
    let amrHtml = document.getElementById('amr').outerHTML; //"<div id="amr">(f&nbsp;/&nbsp;freedom)<br></div>"
    let align_info = document.getElementById('align').innerText;
    let doc_id = document.getElementById('doc_id').innerText;
    let snt_id = document.getElementById('curr_shown_sent_id').innerText;

    removeDeletedFromUmr();

    fetch(`/annotate/${doc_id}`, {
        method: 'POST',
        body: JSON.stringify({"amr": amrHtml, "align": align_info, "snt_id": snt_id, "umr": umr})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data["msg"]);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
}

function docUmrTransform(html_umr_s){
    let regex1 = /([a-zA-Z0-9]+) \/ (?=.*?\1)[a-zA-Z0-9]+ /g //match s1t / s1t (space at the end)
    let regex2 = /\(([a-zA-Z0-9]+) \/ (?=.*?\1)[a-zA-Z0-9]+\)/g //match (AUTH / AUTH)
    let html_umr_s1 = html_umr_s.replace(regex1, "$1"+ " ");
    html_umr_s1 = html_umr_s1.replace(regex2, "$1");

    let regexp = /&nbsp;&nbsp;:(temporal|modal|coref)\s(\(.+?\))/g;
    let array = [...html_umr_s1.matchAll(regexp)];

    let temporals = [];
    let modals = [];
    let corefs = [];
    for(let i=0; i<array.length; i++){
      if (array[i][1] === "temporal"){
        temporals.push(array[i][2]);
      }else if (array[i][1] === "modal"){
        modals.push(array[i][2]);
      }else if (array[i][1] === "coref"){
        corefs.push(array[i][2]);
      }
    }

    if (temporals.length ===0 && modals.length===0 && corefs.length ===0){
        return html_umr_s1;
    }

    let html_umr_list = html_umr_s1.split('<br>');
    let html_umr_s2 = html_umr_list[0] + "<br>\n";


    //add temporal lines
    if(temporals.length !== 0){
        html_umr_s2 = html_umr_s2 + '&nbsp;&nbsp;:temporal (';
        for(let i=0; i<temporals.length; i++){
            if(i===0){
                html_umr_s2 = html_umr_s2 + temporals[i];
            }else{
                html_umr_s2 = html_umr_s2 + '<br>\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +temporals[i];
            }
        }
        html_umr_s2 =html_umr_s2 + ')<br>\n';
    }

    //add modal lines
    if(modals.length !== 0){
        html_umr_s2 = html_umr_s2 + '&nbsp;&nbsp;:modal (';
        for(let i=0; i<modals.length; i++){
            if(i===0){
                html_umr_s2 = html_umr_s2 + modals[i];
            }else{
                html_umr_s2 = html_umr_s2 + '<br>\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +modals[i];
            }
        }
        html_umr_s2 =html_umr_s2 + ')<br>\n';
    }

    //add coref lines
    if(corefs.length !== 0){
        html_umr_s2 = html_umr_s2 + '&nbsp;&nbsp;:coref (';
        for(let i=0; i<corefs.length; i++){
            if(i===0){
                html_umr_s2 = html_umr_s2 + corefs[i];
            }else{
                html_umr_s2 = html_umr_s2 + '<br>\n&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + corefs[i];
            }
        }
        html_umr_s2 =html_umr_s2 + ')<br>\n';
    }
    html_umr_s2 =html_umr_s2 + ')<br>\n'

    html_umr_s2 = html_umr_s2.replace('\)<br>\n\)<br>' , '\)\)<br>')

    return html_umr_s2;


}

function deHTML2(s){
    s = s.replaceAll('<div id="amr">', '');
    s = s.replaceAll('\n', "");
    s = s.replaceAll('</div>', "");
    s = s.replaceAll('<br>', '\n');
    s = s.replaceAll('&nbsp;', ' ');
    s = s.replaceAll('<i>', '');
    s = s.replaceAll('</i>', '');

    return s;
}

function export_annot(exported_items, content_string) {
    console.log("exported_items: ", exported_items);
    console.log("content_string: ", content_string);
    content_string = content_string.replaceAll('<br>', '\n');
    let doc_name = document.getElementById('filename').innerText;
    exported_items.forEach(e => {
        e[1] = e[1].replace(/<\/?(a|span)\b[^<>]*>/g, "");
        e[1] = e[1].replace(/&nbsp;/g, " ");
        e[1] = e[1].replace(/<br>/g, "");
        e[1] = e[1].replace('<div id="amr">', '');
        e[1] = e[1].replace('</div>', '');
    })


    let output_str = exported_items.map((a, index) =>
        index + 1 + '\t' + a[0]
        + "\n# sentence level graph:\n"
        + a[1]
        + "\n# alignment:"
        + a[2]
        + "\n# document level annotation:\n"
        + deHTML2(docUmrTransform(a[3]))
        +"\n").join("\n\n# :: snt");
    console.log(output_str);

    let filename;
    let text = "user name: " + document.getElementById('username').innerText + '\n';
    text += "user id: " + document.getElementById('user_id').innerText + '\n';
    text += "file language: " + document.getElementById('lang').innerText + '\n';
    text += "file format: " + document.getElementById('file_format').innerText + '\n';
    text += "Doc ID in database: " + document.getElementById('doc_id').innerText + '\n';

    let curr_time = new Date();
    text += "export time: " + curr_time.toLocaleString() + '\n\n';
    text += '# :: snt';
    if (window.BlobBuilder && window.saveAs) {
        filename = 'exported_' + doc_name;
        text += output_str;
        text += '\n\n' + '# Source File: \n' + content_string;
        console.log('Saving file ' + filename + ' on your computer, typically in default download directory');
        var bb = new BlobBuilder();
        bb.append(text);
        saveAs(bb.getBlob(), filename);
    } else {
        console.log('This browser does not support the BlobBuilder and saveAs. Unable to save file with this method.');
    }
}

/**
 * Javascript equivalent of Python's get method for dictionaries: https://stackoverflow.com/questions/44184794/what-is-the-javascript-equivalent-of-pythons-get-method-for-dictionaries
 * @param object
 * @param key
 * @param default_value
 * @returns {*}
 */
function get(object, key, default_value) {
    let result = object[key];
    return (typeof result !== "undefined") ? result : default_value;
}

function suggestLemma(doc_id){
    fetch(`/lexiconupdate/${doc_id}`, {
        method: 'POST',
        body: JSON.stringify({"selected_word": localStorage["selected_word"]})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        // put data in display
        similar_word_list = data;
        const cont = document.getElementById('similar_word_list');
        document.getElementById('simWordList').remove(); //box suggesting similar forms on the right
        // create ul element and set its attributes.
        const ul = document.createElement('ul');
        ul.setAttribute ('class', 'list-group');
        ul.setAttribute ('id', 'simWordList');
        for (let i = 0; i <= data['similar_word_list'].length - 1; i++) {
            const li = document.createElement('li');	// create li element.
            li.innerHTML = `${data['similar_word_list'][i]} (${get(citation_dict, data['similar_word_list'][i], "no lemma added for this word yet")})`;	                        // assigning text to li using array value.
            li.setAttribute ('class', 'list-group-item py-0');	// remove the bullets.
            ul.appendChild(li);		// append li to ul.
        }
        cont.appendChild(ul);		// add ul to the container.
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
}


function initializeLexicon(frames, citations){
    frame_dict = JSON.parse(deHTML(frames));
    citation_dict = JSON.parse(deHTML(citations));
}


function listDict(id){
    let ul = document.createElement('ul');
    document.getElementById(id).appendChild(ul);
    Object.keys(citation_dict).forEach(function (item) {
        let li = document.createElement('li');
        ul.appendChild(li);
        li.innerHTML += item;
    });
}

function prettyPrintJson(id, dict_str){
    console.log("dict_str: ", deHTML(dict_str));
    document.getElementById(id).innerHTML = JSON.stringify(JSON.parse(deHTML(dict_str)), undefined, 2);
}


function recordPartialGraph(){
    let graphDict = {};
    let graphName = document.getElementById("save-partial-graph").value.split(" ")[0];
    let graphHead = document.getElementById("save-partial-graph").value.split(" ")[1];
    console.log("selected variable to be partial graph: ", graphHead);
    console.log("partial graph name: ", graphName);
    let k = getKeyByValue(umr, graphHead);
    console.log("key: ", k);

    Object.keys(umr).forEach(function(key) {
        if(key.startsWith(k.replace('v', ''))){
           graphDict[key.substring(k.length-1, key.length)] = umr[key];
        }
    });
    console.log("partial_graph: ", graphDict);
    let partial_graphs = {};
    partial_graphs[graphName] = graphDict;
    localStorage.setItem('partial_graphs', JSON.stringify(partial_graphs));
}

function addPartialGraph(){
   let graphName= document.getElementById("partial-graphs").value;
   let graphDict = JSON.parse(localStorage['partial_graphs'])[graphName];
   let current_parent_loc = getKeyByValue(umr, current_parent);
   let role;
   if(document.getElementById('roles2')){
       role = document.getElementById('roles2').value;
   }else if(document.getElementById('roles1')){
       role = document.getElementById('roles1').value;
   }
   graphDict['r'] = role;

   Object.keys(graphDict).forEach(function(key) {
       umr[current_parent_loc.substring(0, current_parent_loc.length-1)  + (umr[current_parent_loc.replace('v', 'n')] + 1) + '.'+ key] = graphDict[key];
   });
   umr[current_parent_loc.replace('v', 'n')] = umr[current_parent_loc.replace('v', 'n')] + 1;
   show_amr('show');
}