var current_parent;
var current_concept;
var current_relation;
var current_mode;

var selection;
var begOffset;
var endOffset;

var amr = {}; //{n: 1, 1.c: "obligate-01", 1.v: "o", 1.s: "", 1.n: 1, …}
var variables = {}; //{o: "1", r: "1.1", b: "1.1.1"}
var reserved_variables = {};
var concepts = {}; //{obligate-01: "1", resist-01: "1.1", boy: "1.1.1"}
var variable2concept = {}; // {o: "obligate-01", r: "resist-01", b: "boy", "": "", c: "car"}
var undo_list = []; // [{action:..., amr: ..., concept:..., variables:..., id: 1}, {...}, ...]
var check_list = {};
var undo_index = 0; //2
var last_state_id = 0; //3
var state_has_changed_p = 0; //0
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

var concept_to_title = {}; //3D: "3D No such concept. Replace by: (d / dimension :quant...
var concept_to_url = {}; //albeit: "https://www.isi.edu/~ulf/amr/lib/popup/concession.html"
var is_have_rel_role_91_role = {}; //ancestor: 1; aunt: 1; baby: 1
var is_standard_named_entity = {}; //"": 1; aircraft: 1; aircraft-type: 1

var logsid = ''; //"IQrVT4Dh6mkz93W1DCxpNws9Om6qKqk0EGwhFs0x"
var next_special_action = ''; //''

function initialize() {
    console.log("initialize is called");
    amr['n'] = 0;

    var s;
    //光标focus在输入command框
    // if ((s = document.getElementById('command')) != null) {
    //     s.focus();
    // }

    import_options('load-options'); //checked the options table based on the loaded information and apply the style of the "amr" html element and command box resizing
    processCheckLists(); //processed the long strings at the end of this file and populated 5 dicts
    initialize_frame_arg_descriptions(); // populate frame_arg_descr, but it seems that it shouldn't be empty though 可能这里什么都没有做
    // loadField2amr(); //如果load里面的Direct AMR entry里什么都没有输入的话，可能这里什么都没有做
    props2comment(); //如果props里面什么都没有输入的话，就什么都没有做
    undo_list.push(cloneCurrentState()); //populate undo_list
    // reset_load(''); //不按load button没有用

    //unclear what does this line do, probably has something to do with undo
    if ((s = document.getElementById('next-special-action')) != null) {
        next_special_action = s.value;
    }

    current_mode = 'top';
}

/**
 * populate following dicts:
 * var check_list //the super long one
 * var concept_to_title = {}; //3D: "3D No such concept. Replace by: (d / dimension :quant...
 * var concept_to_url = {}; //albeit: "https://www.isi.edu/~ulf/amr/lib/popup/concession.html"
 * var is_have_rel_role_91_role = {}; //ancestor: 1; aunt: 1; baby: 1
 * var is_standard_named_entity = {}; //"": 1; aircraft: 1; aircraft-type: 1
 */
function processCheckLists() {
    var core_role, explanation, role, line, matches, len, counter, counter2, n_roles, n_non_roles;
    var roleList = list_of_known_role_s.split(/   /); //"     // BEGIN ROLES       :ARG0       :ARG1       :ARG2       :ARG3       :ARG4       :ARG5       :ARG6       :ARG7       :ARG8       :ARG9       :accompanier       :age       :beneficiary       :calendar in dates       :card1       :card2       :card3
    len = roleList.length; //306
    n_roles = 0;
    counter2 = 0;
    for (var i = 0; i < len; i++) {
        line = strip(roleList[i]);
        if (matches = line.match(/^:\S+\s+\S/)) {
            matches = line.match(/^:\S+/);
            core_role = matches[0];
            explanation = line.replace(/^:\S+\s+/, "");
            counter2++;
        } else if (matches = line.match(/^(:\S+)/)) {
            core_role = matches[0];
            explanation = 'valid role';
        } else {
            core_role = '';
        }
        if (core_role) {
            n_roles++;
            check_list['role.' + core_role] = explanation;
            check_list['true-case.role.' + core_role.toLowerCase()] = core_role;
            role = core_role + '-of';
            check_list['role.' + role] = explanation + ' (inverse of ' + core_role + ')';
            check_list['true-case.role.' + role.toLowerCase()] = role;
        }
    }
    console.log('number of roles loaded: ' + n_roles + ' (incl. ' + counter2 + ' with explanations)');

    var nonRoleList = list_of_non_role_s.split(/   /); //"     // BEGIN NON-ROLES       :agent Use OntoNotes :ARGn roles       :be-located-at-91 be-located-at-91 is a verb frame, not a role.       :cause Use cause-01 (:cause is only a shortcut)       :compared-to Use have-degree-91 (reification of :degree)       :employed-by Use have-org-role-91       :experiencer Use OntoNotes :ARGn roles       :instance An instance is a special role, expressed as the slash ("/") between variable and concept.       :num Use quant       :patient Use OntoNotes :ARGn roles       :prep-except Use except-01       :prep-save Use except-01       :subset Use include-91       :theme Use OntoNotes :ARGn roles     // END NON-ROLES     "
    len = nonRoleList.length;
    n_non_roles = 0;
    for (var i = 0; i < len; i++) {
        line = strip(nonRoleList[i]);
        if (matches = line.match(/^:\S+\s+\S/)) {
            matches = line.match(/^:\S+/);
            core_role = matches[0];
            explanation = line.replace(/^:\S+\s+/, "");
            n_non_roles++;
            check_list['non-role.' + core_role.toLowerCase()] = explanation;
            role = core_role + '-of';
            check_list['non-role.' + role.toLowerCase()] = explanation;
        }
    }
    console.log('number of non-roles loaded: ' + n_non_roles);
    console.log('For role checking, loaded ' + n_roles + ' roles and ' + n_non_roles + ' non-roles.');

    var onFrameList, len, pos_char;
    counter = 0;
    for (var pos = 0; pos < 4; pos++) {
        if (pos == 0) {
            onFrameList = list_of_on_frame_unified_s.split(/   /); // // Note: * indicates more than 2 rolesets.     // BEGIN ONTONOTES UNIFIED FRAMES       abbreviation* abdication* abduction*       ablate ablation* ablaze* able* abolition* abominable* abomination* abortion*
            pos_char = '';
            len = onFrameList.length;
        } else if (pos == 1) {
            onFrameList = list_of_on_frame_verb_s.split(/   /);
            pos_char = 'v';
            len = onFrameList.length;
        } else if (pos == 2) {
            onFrameList = list_of_on_frame_adjective_s.split(/   /);
            pos_char = 'j';
            len = onFrameList.length;
        } else if (pos == 3) {
            onFrameList = list_of_on_frame_noun_s.split(/   /);
            pos_char = 'n';
            len = onFrameList.length;
        } else {
            len = 0;
        }
        for (var i = 0; i < len; i++) {
            line = strip(onFrameList[i]);
            if (line.match(/^([a-z]|FedEx)/)) {
                var tokens = line.split(/\s+/);
                var token_len = tokens.length;
                for (var j = 0; j < token_len; j++) {
                    var token = tokens[j];
                    var star = '';
                    if (token.match(/\*$/)) {
                        star = "*";
                        token = token.replace(/\*$/, "");
                    }
                    if (token.match(/^([a-z][-a-z]*|FedEx|UPS)$/)) {
                        // e.g. onvf
                        check_list['on' + pos_char + 'f.' + token] = 1;
                        if (star) {
                            check_list['on' + pos_char + 'fm.' + token] = 1;
                        }
                        // c: combination of multiple pos: v and f
                        if ((pos_char == 'j') && (check_list['onvf.' + token])) {
                            check_list['oncf.' + token] = 1;
                            if (star) {
                                check_list['oncfm.' + token] = 1;
                            }
                        }
                        counter++;
                    }
                }
            }
        }
    }

    var elemList = list_of_concept_to_title_s.split(/            /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var title = strip(elemList[i]);
        if (!title.match(/^\s*\/\//)) {
            var concept_l = title.match(/\S+/);
            if (concept_l && (concept_l.length == 1)) {
                var concept = concept_l[0];
                concept_to_title[concept] = title;
            }
        }
    }

    elemList = list_of_concept_to_url_s.split(/             /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var line = strip(elemList[i]);
        if (!line.match(/^\s*\/\//)) {
            var concept_url_l = line.match(/^\s*(\S+)\s+(\S+)/);
            if (concept_url_l && (concept_url_l.length == 3)) {
                var concept = concept_url_l[1];
                var url = concept_url_l[2];
                concept_to_url[concept] = url;
            }
        }
    }

    elemList = list_of_have_rel_role_91_roles.split(/   /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var line = strip(elemList[i]);
        if (!line.match(/^\s*\/\//)) {
            var roleList = line.split(/ +/);
            var len2 = roleList.length;
            for (var j = 0; j < len2; j++) {
                var role = strip(roleList[j]);
                is_have_rel_role_91_role[role] = 1;
            }
        }
    }

    elemList = list_of_standard_named_entities.split(/   /);
    len = elemList.length;
    for (var i = 0; i < len; i++) {
        var line = strip(elemList[i]);
        if (!line.match(/^\s*\/\//)) {
            var neList = line.split(/ +/);
            var len2 = neList.length;
            for (var j = 0; j < len2; j++) {
                var ne = strip(neList[j]);
                is_standard_named_entity[ne] = 1;
            }
        }
    }

    console.log('For OntoNotes frame availability check, loaded ' + counter + ' verbs.');
}

/**
 * this function takes in an argument variable, returns the location of the variable
 * @param variable, such as "b"
 * @returns {*} for example, the root variable returns 1, first child of root returns 1.1
 */
function getLocs(variable) { // b
    var value = variables[variable];
    if (value == undefined) {
        return undefined;
    } else if (typeof value == 'string') {
        return value; //usually it should goes in here
    } else if (typeof value == 'number') {
        return value + '';
    } else if (typeof value == 'function') {
        // add_log('getLocs[' + variable + '] function -> undefined');
        return undefined;
    } else {
        var type = typeof value;
        add_log('getLocs[' + variable + '] is of unknown type ' + type);
        return undefined;
    }
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

function undo(n) {
    console.log("undo is called");

    reset_error();
    reset_guidance();
    reset_greeting();
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
        if ((s = document.getElementById('undo-link')) != null) {
            if (undo_title == 'currently nothing to undo') {
                s.style.color = '#999999';
            } else {
                s.style.color = '#000000';
            }
        }
        if ((s = document.getElementById('undo-command')) != null) {
            if (undo_title == 'currently nothing to undo') {
                s.style.color = '#999999';
                s.style.fontStyle = 'italic';
                s.innerHTML = '&nbsp;' + undo_title;
            } else {
                s.style.color = '#000000';
                s.style.fontStyle = 'normal';
                s.innerHTML = '&nbsp;' + prev_action;
            }
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
        if ((s = document.getElementById('redo-link')) != null) {
            if (redo_title == 'currently nothing to redo') {
                s.style.color = '#999999';
            } else {
                s.style.color = '#000000';
            }
        }
        if ((s = document.getElementById('redo-command')) != null) {
            if (redo_title == 'currently nothing to redo') {
                s.style.color = '#999999';
                s.style.fontStyle = 'italic';
                s.innerHTML = '&nbsp;' + redo_title;
            } else {
                s.style.color = '#000000';
                s.style.fontStyle = 'normal';
                s.innerHTML = '&nbsp;' + prev_action;
            }
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
        if (undo_index == 0) {
            if ((s = document.getElementById('save-and-next-button')) != null) {
                s.style.display = 'none';
            }
            if ((s = document.getElementById('workset-snt-saved')) != null) {
                s.style.display = 'inline';
            }
            if ((s = document.getElementById('prev-snt-button')) != null) {
                s.style.display = 'block';
            }
            if ((s = document.getElementById('discard-and-next-button')) != null) {
                s.style.color = 'black';
                if ((s2 = document.getElementById('next-symbol')) != null) {
                    s.value = s2.value;
                } else {
                    s.value = "Load next"; // "&#x25b6;"
                }
                s.title = 'Load next sentence in workset.';
                s.setAttribute('onclick', '');
            }
            if ((s = document.getElementById('select-workset-snt-button')) != null) {
                s.style.display = 'block';
            }
        } else if (undo_index == 1) {
            enable_workset_save();
            if ((s = document.getElementById('discard-and-next-button')) != null) {
                s.style.color = '#990000';
                if (next_special_action == 'close') {
                    s.value = 'Discard and close';
                    s.title = 'Close this window without saving any changes to this AMR.';
                    s.setAttribute('onclick', 'self.close();');
                } else {
                    s.value = 'Discard and load next';
                    s.title = 'Load next sentence without saving any changes to this AMR.';
                }
            }
            if ((s = document.getElementById('select-workset-snt-button')) != null) {
                s.style.display = 'none';
            }
        }
    }
}

/** utils *******************************************************/
/**
 * this only strip off the quotes at the beginning and the end of the string
 * @param s
 * @returns {*}
 */
function stripQuotes(s) {
    if (s.match(/^"[^"]*"$/)) {
        return s.replace(/"/g, "");
    } else {
        return s;
    }
}

/**
 * strip any kind of whitespace character
 * @param s
 * @returns {*}
 */
function strip(s) {
    // console.log("strip is called");

    s = s.replace(/^\s*/, "");
    s = s.replace(/\s*$/, "");
    return s;
}

/**
 * So far I think this is just python split()
 * @param s "1.1 1.2.1.1 1.2.2.1 1.2.2.2.1"
 * @returns {Array} ["1.1", "1.2.1.1", "1.2.2.1", "1.2.2.2.1"]
 */
function argSplit(s) {
    // instead of: return s.split(" ");
    var rest = s;
    var split_args = [];
    var max_iter = 100;
    var iter = 1;
    while ((iter <= max_iter) && rest.match(/[^ ]/)) {
        iter++;
        rest = rest.replace(/^ */, "");
        // make sure to push items of type string!
        if (rest.match(/^".*"/)) {
            rest = rest.replace(/^"/, "");
            split_args.push('"' + rest.match(/^[^"]*/) + '"');
            rest = rest.replace(/^[^"]*"/, "");
        } else if (rest.match(/ /)) {
            split_args.push(rest.match(/^[^ ]+/) + '');
            rest = rest.replace(/^[^ ]+/, "");
        } else {
            split_args.push(rest);
            rest = '';
        }
    }
    // add_log('argSplit(' + s + '): ' + split_args.join(" :: "));
    return split_args;
}

/**
 * add escape for special characters: .?*+^$[\]\\(){}-
 * @param s "test??"
 * @returns {*} "test\?\?"
 */
function regexGuard(s) {
    return s.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
}

/**
 * add <br> to newline character, and change space to &nbsp
 * @param s
 * @returns {*}
 */
function htmlSpaceGuard(s) {
    var s2 = s;
    s2 = s2.replace(/(<br>)?\n/g, "<br>\n");
    s2 = s2.replace(/ /g, "&nbsp;");
    return s2;
}

/**
 * convert special characters to HTML in Javascript
 * @param string
 * @returns {*}
 */
function htmlProtect(string) {
    var s = string.replace(/&/g, "&amp;");
    s = s.replace(/</g, "&lt;");
    s = s.replace(/>/g, "&gt;");
    s = s.replace(/"/g, "&quot;");
    return s;
}

/**
 * change double quote to &quot;
 * @param s
 * @returns {*}
 */
function stringGuard(s) {
    return s.replace(/"/g, "&quot;");
}

/**
 * set the value to an existing element with specific id
 * @param id
 * @param value
 */
function set(id, value) {
    var s;
    if ((s = document.getElementById(id)) != null) {
        s.value = value;
    }
}

/**
 * set the innerHTML to an existing element with specific id
 * @param id
 * @param value
 */
function setInnerHTML(id, value) {
    var s;
    if ((s = document.getElementById(id)) != null) {
        s.innerHTML = value;
    }
}

/**
 * return true if any element in list contain capital letter
 * @param list
 * @returns {number}
 */
function listContainsCap(list) {
    var len = list.length;
    for (var i = 1; i < len; i++) {
        if (list[i].match(/[A-Z]/)) {
            return 1;
        }
    }
    return 0;
}

/**
 * return null when input is like "#", or "buy.01"
 * @param concept
 * @returns {*}
 */
function validEntryConcept(concept) {
    return concept.match(/^(?:[a-z]+(?:-[a-z]+)*(?:-\d+)?|(?:concept\.|\!):?[a-zA-Z0-9][-._a-zA-Z0-9']*|\*(?:OR)\*)$/);
}

/**
 * remove concept. or !
 * @param entry_concept
 * @returns {*}
 */
function trimConcept(entry_concept) {
    return entry_concept.replace(/^(concept\.|\!)/, "");
}

/**
 * so far I think it matches all non-white space character and as long as it's not double quote
 * @param string
 * @returns {*|boolean}
 */
function validString(string) {
    return string.match(/^(\S|\S.*\S)$/) && !string.match(/"/);
}

/**
 * change double quote " to slash double quote \"
 * @param string
 * @returns {*}
 */
function slashProtectQuote(string) {
    return string.replace(/"/g, "\\\"");
}

/**
 *
 * @param s penman html format string
 * @returns {*} penman format string
 */
function deHTML(s) {
    s = s.replace(/<\/?(a|span)\b[^<>]*>/g, "");
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/<br>/g, "");
    return s;
}

/**
 * this function returns the true case of the role
 * @param role :arg9/:ARG9
 * @returns {*} :ARG9
 */
function autoTrueCaseRole(role) {
    if (show_amr_obj['option-role-auto-case']) {
        return check_list['true-case.role.' + role.toLowerCase()] || role;
    } else {
        return role;
    }
}

/**popup windows ******************************************************/

/**
 * just as name suggests
 */
function closeCurrentOpenPopup() {
    if (current_onto_popup_window
        && current_onto_popup_window.opener
        && !current_onto_popup_window.opener.closed) {
        current_onto_popup_window.close();
        current_onto_popup_window = '';
    }
}

/**
 * this is only called in generate_dynamic_ontonotes_popup()
 */
function closedCurrentOpenPopup() {
    current_onto_popup_window = '';
}

/**
 * pop up a new window with plain penman format string in the window
 */
function popupWithAmr() {
    var s, s2;
    if ((s = document.getElementById('plain-amr')) != null) {
        closeCurrentOpenPopup();
        newwindow = window.open('', 'AMR', 'height=400,width=600,resizable=1,scrollbars=1,toolbar=1,statusbar=1,menubar=1');
        var tmp = newwindow.document;
        var html_amr = htmlSpaceGuard(s.value);
        if ((s2 = document.getElementById('comment')) != null) {
            var comment = s2.value;
            if (comment.match(/\S/)) {
                tmp.write(htmlSpaceGuard(comment));
                tmp.write('<p>\n');
            }
        }
        // add_log('popupWithAmr ' + html_amr);
        tmp.write(html_amr);
        tmp.close();
        current_onto_popup_window = newwindow;
    } else {
        add_log('Can\'t find plain-amr for popup');
    }
}

/**
 * pop up quick ref window: https://www.isi.edu/~ulf/amr/help/quickref.html
 */
function popupQuickRef() {
    closeCurrentOpenPopup();
    var x = screen.width - 480 - 13;
    var y = 0;
    var newWindow = window.open('https://www.isi.edu/~ulf/amr/help/quickref.html', 'QuickRef', 'height=530,width=480,resizable=1,scrollbars=1,toolbar=0,statusbar=0,menubar=0');
    var auto_moveto = show_amr_obj['option-auto-moveto'];
    auto_moveto = 1;
    if (auto_moveto && !browserUserAgent.match(/chrome/i)) {
        newWindow.moveTo(x, 0);
        newWindow.focus();
    }
    // current_onto_popup_window = newWindow;
}
function popupNETypes() {
    closeCurrentOpenPopup();
    var x = screen.width - 700 - 13;
    var y = 0;
    var newWindow = window.open('https://www.isi.edu/~ulf/amr/lib/ne-types.html', 'NE types', 'height=600,width=700,resizable=1,scrollbars=1,toolbar=0,statusbar=0,menubar=0');
    var auto_moveto = show_amr_obj['option-auto-moveto'];
    auto_moveto = 1;
    if (auto_moveto && !browserUserAgent.match(/chrome/i)) {
        newWindow.moveTo(x, 0);
        newWindow.focus();
    }
    current_onto_popup_window = newWindow;
}
function popupRoles() {
    closeCurrentOpenPopup();
    var x = screen.width - 750 - 13;
    var y = 0;
    var newWindow = window.open('https://www.isi.edu/~ulf/amr/lib/roles.html', 'AMR roles', 'height=600,width=750,resizable=1,scrollbars=1,toolbar=0,statusbar=0,menubar=0');
    var auto_moveto = show_amr_obj['option-auto-moveto'];
    auto_moveto = 1;
    if (auto_moveto && !browserUserAgent.match(/chrome/i)) {
        newWindow.moveTo(x, 0);
        newWindow.focus();
    }
    current_onto_popup_window = newWindow;
}
function popupAmrDict() {
    var newWindow = window.open('https://www.isi.edu/~ulf/amr/lib/amr-dict.html', '_WIKI');
    newWindow.focus();
}
function popupVideoPage() {
    var newWindow = window.open('https://www.isi.edu/~ulf/amr/lib/videos.html', '_VIDEO');
    newWindow.focus();
}
function popupGuidelines(version) {
    // closeCurrentOpenPopup();
    var x = 0;
    var y = 0;
    var url = 'https://www.isi.edu/~ulf/amr/help/amr-guidelines.pdf';
    if (version == 'github') url = 'https://github.com/amrisi/amr-guidelines/blob/master/amr.md';
    var newWindow = window.open(url, 'AMR guidelines', 'height=600,width=750,resizable=1,scrollbars=1,toolbar=1,statusbar=0,menubar=1');
    var auto_moveto = show_amr_obj['option-auto-moveto'];
    auto_moveto = 1;
    if (auto_moveto && !browserUserAgent.match(/chrome/i)) {
        newWindow.moveTo(x, 0);
        newWindow.focus();
    }
    // current_onto_popup_window = newWindow;
}



function select_ne_type(ne_type) {
    var s, t;
    if (((t = document.getElementById('add-ne-template-table')) != null)
        && (t.style.display == 'inline')
        && ((s = document.getElementById('add-ne-concept')) != null)) {
        s.value = ne_type;
    }
    if (((t = document.getElementById('replace-template-table')) != null)
        && (t.style.display == 'inline')
        && ((s = document.getElementById('replace-new')) != null)
        && ((s2 = document.getElementById('replace-type')) != null)
        && (s2.value == 'concept')) {
        s.value = ne_type;
    }
    if (((s = document.getElementById('command')) != null)
        && (s.value.match(/:\S+\s+\?\s*$/))) {
        s.value = s.value.replace(/\s+\?\s*$/, ' ' + ne_type + ' ');
    }
}

function select_role(role) {
    console.log("select_role is called");
    var s, s2, t;
    if (((t = document.getElementById('add-template-table')) != null)
        && (t.style.display == 'inline')
        && ((s = document.getElementById('add-role')) != null)) {
        s.value = role;
    }
    if (((t = document.getElementById('add-ne-template-table')) != null)
        && (t.style.display == 'inline')
        && ((s = document.getElementById('add-ne-role')) != null)) {
        s.value = role;
    }
    if (((t = document.getElementById('move-template-table')) != null)
        && (t.style.display == 'inline')
        && ((s = document.getElementById('move-role')) != null)) {
        s.value = role;
    }
    if (((t = document.getElementById('replace-template-table')) != null)
        && (t.style.display == 'inline')
        && ((s = document.getElementById('replace-new')) != null)
        && ((s2 = document.getElementById('replace-type')) != null)
        && (s2.value == 'role')) {
        s.value = role;
    }
    if ((s = document.getElementById('command')) != null) {
        if (s.value.match(/:\?\s*$/)) {
            s.value = s.value.replace(/:\?\s*$/, role + ' ');
        } else if (s.value.match(/\b(roles|show roles)\s*$/)) {
            s.value = s.value.replace(/(roles|show roles)\s*$/, role + ' ');
        } else if (s.value.match(/^\s*$/)) {
            s.value = role;
        }
    }
}


/**
 * this function takes in a template id (the name on the button) and return the form to fill out
 * @param id "top"
 */
function selectTemplate(id) {
    // add_edit_log('selectTemplate ' + id);
    current_template = '';
    var actions = ["top", "add", "add-ne", "replace", "delete", "move", "save", "load", "props", "options", "help"];
    var s;
    for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        if ((s = document.getElementById(action + '-template-table')) != null) {
            if (id == action) {
                s.style.display = 'inline';
                current_template = id;
                if ((action == 'replace') && !show_amr_status.match(/replace/)) {
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
    if (id == 'top') {
        focus_field = 'top-root-concept';
    } else if (id == 'add') {
        focus_field = 'add-head';
    } else if (id == 'add-ne') {
        focus_field = 'add-ne-head';
    } else if (id == 'move') {
        focus_field = 'move-object';
    } else if (id == 'load') {
        export_options();
        focus_field = 'load-username2';
    } else if (id == 'save') {
        export_options();
    } else if (id == 'props') {
        focus_field = 'props-id';
    } else if (id == 'clear') {
        reset_error();
        reset_guidance();
        focus_field = 'command';
    } else {
        focus_field = '';
    }
    reset_greeting();
    // provide guidance
    if (id == 'replace') {
        if (amr_is_empty()) {
            set_guidance('<p><font style="color:blue;font-weight:bold;">Sorry, cannot replace anything in empty AMR.</font>');
        } else {
            set_guidance('<p><font style="color:blue;font-weight:bold;">In AMR above, click on concept, string or role to be replaced.</font>');
        }
    } else if (id == 'delete') {
        if (amr_is_empty()) {
            set_guidance('<p><font style="color:red;font-weight:bold;">Sorry, cannot delete anything in empty AMR.</font>');
        } else {
            set_guidance('<p><font style="color:red;font-weight:bold;">In AMR above, click on element to be deleted.</font>');
        }
    } else {
        reset_guidance();
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
                reset_guidance();
                submit_template_action('delete');
                selectTemplate('clear');
            }
        }
    }
}

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

/**
 * this is probably keyboard shortcut
 * @param field "submit add", "submit replace" something like submit+id; or "show roles" can popup roles
 * @param event unclear what this is
 * @param s_id element id
 */
function action_on_enter(field, event, s_id) {
    var s;
    var keycode = -1;
    if (window.event) {
        keycode = window.event.keyCode;
    } else if (event) {
        keycode = event.which;
    }
    // Return/Enter key (13)
    if (keycode == 13) {
        // add_log('action_on_enter ' + field);
        // field == 'submit replace' etc.
        if (field.match(/^submit \S+$/)) {
            var id = field.replace(/^submit (\S+)$/, "$1");
            submit_template_action(id);
        }
    } else if ((keycode <= 31) && (keycode >= 127)) {
        // add_log('action_on_enter ' + keycode + ' ' + field);
    } else if (((s = document.getElementById(s_id)) != null)
        && s.value.match(/:\?$/)
        && (field == 'show roles')) {
        popupRoles();
    } else if (((s = document.getElementById(s_id)) != null)
        && s.value.match(/^(.*[^:]|)\?$/)
        && (field == 'show NE types')) {
        popupNETypes();
    }
}

function submit_template_action(id = "nothing", numbered_predicate = "") {
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
        if ((arg1 = document.getElementById('sec1')) != null) {
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
        // console.log(k);
        // console.log(new_k);
        // console.log(current_parent);

    } else if (id == 'add') {
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
        var arg = current_concept;
        console.log(arg);
        console.log('submit_template_action ' + current_parent + ' ' + role + ' ' + arg);

        exec_command(current_parent + ' ' + role + ' ' + arg, 1);
    }
    else if (id == 'add-polarity') {
        var head = 'b';
        // var role = ':' + document.getElementById('test-time').innerText;
        var role = ':polarity';
        var arg = '-';
        console.log('submit_template_action ' + current_parent + ' ' + role + ' ' + arg);

        exec_command(current_parent + ' ' + role + ' ' + arg, 1);
    }
    else if (id == 'add-ne') {
        // var role = ':' + document.getElementById('test-arg0').innerText;
        // var role = ':arg' + num;
        var role = current_relation;
        var concept = 'person';
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
    var a, c, s, s1, s2, s3, resize_command_p;
    var show_amr_args = '';
    var record_value = '';

    if ((c = document.getElementById('command')) != null) {
        // var clen = c.value.length; //0, this is the value that got typed in the box

        // if (clen > 50) {  // && show_amr_obj['option-resize-command']
        //     var n_lines = Math.floor(clen / 43) + 1;
        //     c.style.height = ((n_lines * 1.2) + 0.2) + 'em';
        // }
        // if (!value) {
        //     console.log("**************************************");
        //     console.log("0");
        //     if (c.value.match(/\n/)) {
        //         console.log("**************************************");
        //         console.log("1");
        //         value = c.value;
        //     } else if (c.value.match(/:\?\s*$/)) {
        //         console.log("**************************************");
        //         console.log("2");
        //         popupRoles();
        //     } else if (c.value.match(/:\S+\s+\?\s*$/)) {
        //         console.log("**************************************");
        //         console.log("3");
        //         popupNETypes();
        //     }
        // }
        if (value && ((a = document.getElementById('action')) != null)) {
            // add_edit_log('exec_command ' + top + ' ' + value);
            add_log('exec_command: ' + value + ' (top: ' + top + ')');
            reset_error();
            reset_guidance();
            reset_greeting();
            value = strip(value);
            value = value.replace(/^([a-z]\d*)\s+;([a-zA-Z].*)/, "$1 :$2"); //??? for Kevin: a ;arg0 boy -> a :arg0 boy
            // value == "b :arg1 car"


            var cc = argSplit(value);
            // if(cc[0] != 'top' && cc[0].length > 2){
            //     cc[0] = cc[0].slice(0, -4)
            // }
            console.log("cc is: " + cc);// ["b", ":arg1", "car"]

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
                delete_amr();
            } else if (value.match(/^(delete dummies|delete dummy|delete dummy-element|dd)$/i)) {
                delete_dummies();
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
            } else if (value.match(/^(check amr)$/i)) {
                check_amr();
            } else if (value.match(/^(o|opt)$/i)) {
                selectTemplate('options');
                top = 0;
            } else if (value.match(/^(c|cl)$/i)) {
                selectTemplate('clear');
                top = 0;
            } else if (value.match(/^export(|\s+workset)$/i)) {
                // export_workset();
            } else if (value.match(/^share(|\s+workset)$/i)) {
                // share_workset();
            } else if (value.match(/^atest/i)) {
                // authorization_test(cc[1], cc[2]);
            } else if (value.match(/^copy(|\s.*)$/i)) {
                // if ((cc.length >= 4) && cc[1].match(/^amr$/i) && cc[2].match(/^(from|to)$/)) {
                //     copy_amr(cc[2], cc[3]);
                // } else if ((cc.length == 3) && cc[1].match(/^(from|to)$/)) {
                //     copy_amr(cc[1], cc[2]);
                // } else if ((cc.length == 2) && cc[1].match(/^(from|to)$/)) {
                //     copy_amr(cc[1], '');
                // } else {
                //     copy_amr('', '');
                // }
            } else if (value.match(/^activity(|\s.*)$/i)) {
                // if (cc.length >= 2) {
                //     var control = value.replace(/^\s*\S+\s+\S+\s*(\S|\S.*\S|)\s*$/, "$1");
                //     activity_report(cc[1], control);
                // } else {
                //     activity_report('', '');
                // }
            } else if (value.match(/^(change|reset|new|forgot|forget|)\s*\bpassword(|\s.*)$/i)) {
                // change_password();
            } else if (value.match(/^create\s+workset(|\s.*)$/i)) {
                // create_free_amr_workset();
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
            } else if (value.match(/^\s*(consensus|\S+ search|search|cs|fs|ms|rs|ss|xs)\b/i)
                && !value.match(/^\s*(new|top) search\b/i)) {
                // corpus_search(value);
            } else if (value.match(/^\s*(create\s+\baccount\b)\s*/i)) {
                // create_account();
            } else if (value.match(/^\s*(wiki|wikify|wikification)\b/i)) {
                // wikification_editor();
            } else if (value.match(/^\s*dc\s*$/i)) {
                // amr_diff_viz('diff consensus');
            } else if (value.match(/^\s*diff\s+consensus\s*$/i)) {
                // amr_diff_viz('diff consensus');
                record_value = 'diff consensus &nbsp; &nbsp; &nbsp; [shortcut: dc]';
            } else if (value.match(/^\s*diff\s+\S/i)) {
                // amr_diff_viz(value);
            } else if (value.match(/^\s*(compare|dc|delta|diff)\b/i)) {
                // amr_diff_viz_form(value);
            } else if (value.match(/^\s*check\s+\S/i)) {
                // amr_check(value);
            } else if (value.match(/^\s*check\s*$/i)) {
                // amr_check_form(value);
            } else if (value.match(/^remember me(|\s.*)$/i)) {
                // export_ip_address();
            } else if (value.match(/^cookie$/i)) {
                // set_guidance('Cookie ID: ' + cookie_id);
            } else if (value.match(/^change\s+variable\s+[a-z]\d*\s+\S+$/i)) {
                change_var_name(cc[2], cc[3], top);
                show_amr_args = 'show';
            } else if (value.match(/^cv\s+[a-z]\d*\s+\S+\s*$/i)) {
                change_var_name(cc[1], cc[2], top);
                show_amr_args = 'show';
            } else if (value.match(/^reop\s+[a-z]\d*\s*$/i)) {
                renorm_ops(cc[1]);
                show_amr_args = 'show';
                // replace role (or secondary variable) shortcut
            } else if (value.match(/^r[rv]\b\s*(\S.*\S|\S|)\s+\S+\s*$/)) {
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
                    var parent_variable = get_parent_variable(loc);
                    var role = amr[loc + '.r'];
                    var variable = amr[loc + '.v'];
                    var target = role || variable;
                    var arg = amr[loc + '.v'] || amr[loc + '.c'] || amr[loc + '.s'];
                    add_log('expanding "' + user_descr + '/' + loc + '" to: replace ' + target_name + ' at ' + parent_variable + ' ' + target + ' ' + arg + ' with ' + new_value);
                    exec_command(('replace ' + target_name + ' at ' + parent_variable + ' ' + target + ' ' + arg + ' with ' + new_value), 0);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if (loc_list.length == 0) {
                    add_error('Could not find any ' + target_name + ' for locator <font color="red">' + user_descr + '</font>');
                } else {
                    add_error('Ambiguous ' + target_name + ' locator <font color="red">' + user_descr + '</font>');
                }
                // replace string shortcut
            } else if (value.match(/^rs\b\s*(\S.*\S|\S|)\s*$/)) {
                var user_descr = value.replace(/^rs\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$1");
                var new_value = value.replace(/^rs\b\s*(\S.*\S|\S|)\s+(\S+)\s*$/, "$2");
                var loc_list = user_descr2locs(user_descr, 'string');
                if ((loc_list.length == 1) && !(amr[loc_list[0] + '.s'] && amr[loc_list[0] + '.r'])) {
                    add_error('No string defined for <font color="red">' + user_descr + '</font>');
                } else if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = get_parent_variable(loc);
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
                // replace concept shortcut
            } else if (value.match(/^rc\b\s*(\S.*\S|\S|)\s+\S+\s*$/)) {
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
                //     // delete shortcut
            } else if (value.match(/^del\s+\S/)
                || value.match(/^delete\s+\S+(\s+\S+)?\s*$/)) {
                // add_log('delete shortcut: ' + value + '.');
                var user_descr = value.replace(/^(?:del|delete)\s+(\S.*\S|\S|)\s*$/, "$1");
                var loc_list = user_descr2locs(user_descr, 'delete');
                if (loc_list.length == 1) {
                    var loc = loc_list[0];
                    var parent_variable = get_parent_variable(loc);
                    var role = amr[loc + '.r'];
                    var variable = amr[loc + '.v'];
                    var arg = amr[loc + '.v'] || amr[loc + '.c'] || amr[loc + '.s'];
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
            } else if (value.match(/^(direct|direct entry)$/i)) {
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
            } else if (cc.length >= 1) {
                // cc == ["b", ":arg1", "car"]
                var key1 = cc[0]; //"b"
                var ne_concept;
                var cc2v;
                if ((key1 == 'top') || (key1 == 'bottom') || (key1 == 'new')) {
                    if ((cc.length >= 3) && (cc[1] == '*OR*') && validEntryConcept(cc[2])) {
                        add_or('top ' + value);
                        selectTemplate('');
                        show_amr_args = 'show';
                    }
                    else if ((cc.length >= 3) && (key1 == 'top') && (ne_concept = cc[1])
                        && validEntryConcept(ne_concept) && (!getLocs(ne_concept))
                        && (is_standard_named_entity[ne_concept] || listContainsCap(cc))) {
                        var ne_var = new_amr(trimConcept(ne_concept));
                        var name_var = add_triple(ne_var, ':name', 'name', 'concept');
                        for (var i = 2; i < cc.length; i++) {
                            var sub_role = ':op' + (i - 1);
                            add_triple(name_var, sub_role, cc[i], 'string');
                        }
                        if (current_template != 'top') {
                            selectTemplate('clear');
                        }
                        show_amr_args = 'show';
                    }
                    else if (cc.length >= 2) {
                        for (var i = 1; i < cc.length; i++) {
                            var arg = cc[i];
                            if ((key1 == 'top') && getLocs(arg)) {
                                move_var_elem(arg, 'top', '');
                            } else {
                                if (validEntryConcept(arg)) {
                                    new_amr(trimConcept(arg));
                                } else {
                                    add_error('Ill-formed command "' + key1 + ' <font color="red">' + arg + '</font>" &nbsp; Argument should be a concept.');
                                }
                            }
                        }
                        if (current_template != 'top') {
                            selectTemplate('clear');
                        }
                        show_amr_args = 'show';
                    }
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
                } else if ((cc.length == 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && getLocs(cc[2]) && (cc[3] == '-')) {
                    move_var_elem(cc[2], cc[0], cc[1]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])
                    && (cc[2].match(/\-$/))
                    && (cc2v = cc[2].replace(/^(.*)\-$/, "$1"))
                    && getLocs(cc2v)) {
                    move_var_elem(cc2v, cc[0], cc[1]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && getLocs(cc[2]) && (cc[3] == '+')) {
                    add_triple(cc[0], cc[1], cc[2]);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])
                    && (cc[2].match(/\+$/))
                    && (cc2v = cc[2].replace(/^(.*)\+$/, "$1"))
                    && getLocs(cc2v)) {
                    add_triple(cc[0], cc[1], cc2v);
                    selectTemplate('clear');
                    show_amr_args = 'show';
                } else if ((cc.length == 3) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0])) {
                    // this is the condition we go in 1
                    add_triple(cc[0], cc[1], cc[2], '');
                    if (current_template != 'add') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if ((cc.length >= 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && (cc[2] == '*OR*') && validEntryConcept(cc[3])) {
                    add_or(value);
                    selectTemplate('');
                    show_amr_args = 'show';
                } else if ((cc.length >= 4) && cc[1].match(/^:[a-z]/i) && getLocs(cc[0]) && validEntryConcept(cc[2]) && (!getLocs(cc[2]))) {
                    add_ne(value);
                    if (current_template != 'add-ne') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if ((cc.length >= 3) && (cc[1] == ':name') && getLocs(cc[0]) && (!getLocs(cc[2]))) {
                    add_ne(value);
                    if (current_template != 'add-ne') {
                        selectTemplate('clear');
                    }
                    show_amr_args = 'show';
                } else if (key1 == 'replace') {
                    if (cc.length == 1) {
                        add_error('Ill-formed replace command. Arguments missing. First argument should be the type of AMR element to be replaced: concept, string or role');
                    } else if (cc[1] == 'concept') {
                        if (cc.length == 6) {
                            replace_concept(cc[2], cc[3], cc[4], cc[5]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            add_error('Ill-formed replace concept command. Incorrect number of arguments. Usage: replace concept at &lt;var&gt; with &lt;new-value&gt;');
                        }
                    } else if (cc[1] == 'string') {
                        if (cc.length == 7) {
                            replace_string(cc[2], cc[3], cc[4], cc[5], stripQuotes(cc[6]));
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            add_error('Ill-formed replace string command. Incorrect number of arguments. Usage: replace string at &lt;var&gt; &lt;role&gt; with &lt;new-value&gt;');
                        }
                    } else if (cc[1] == 'role') {
                        if (cc.length == 8) {
                            replace_role(cc[2], cc[3], cc[4], cc[5], cc[6], cc[7]);
                            selectTemplate('clear');
                            show_amr_args = 'show';
                        } else {
                            add_error('Ill-formed replace role command. Incorrect number of arguments. Usage: replace role at &lt;var&gt; &lt;old-role&gt; &lt;arg&gt; with &lt;new-role&gt;');
                        }
                    } else if (cc[1] == 'variable') {
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
                } else if (key1 == 'sg') {
                    sg();
                    top = 0;
                } else if (key1 == 'sa') {
                    for (var i = 1; i < cc.length; i++) {
                        sa(cc[i]);
                    }
                    top = 0;
                } else if (key1 == 'sv') {
                    for (var i = 1; i < cc.length; i++) {
                        sv(cc[i]);
                    }
                    top = 0;
                } else if (key1 == 'sc') {
                    for (var i = 1; i < cc.length; i++) {
                        sc(cc[i]);
                    }
                    top = 0;
                } else if (key1 == 'cm') {
                    for (var i = 1; i < cc.length; i++) {
                        show_concept_mapping(cc[i]);
                    }
                    top = 0;
                } else if (key1 == 'sid') {
                    show_AMR_editor_login();
                    top = 0;
                } else if (key1.match(/^(logout|exit|quit)$/i)) {
                    logout(0);
                    top = 0;
                } else if (key1 == 'login') {
                    logout(1);
                    top = 0;
                } else if ((cc.length >= 2) && cc[1].match(/^:/)) {
                    if ((cc[0].match(/^[a-z]\d*$/)) && !getLocs(cc[0])) {
                        add_error('In <i>add</i> command, <font color="red">' + cc[0] + '</font> is not a defined variable.');
                    } else if (cc.length == 2) {
                        add_error('In <i>add</i> command, there must be at least 3 arguments.');
                    } else {
                        add_error('Unrecognized <i>add</i> command.');
                    }
                } else if (value.match(/^record /i)) {
                    record_value = value.replace(/^record\s*/, "");
                } else if (value.match(/\b(bugs?|feedback|suggest|suggestion|question|comment|problem|like|praise|report)\b/i)) {
                    // report_issue(value);
                } else {
                    if (!value.match(/^(h|help)\b/i)) {
                        add_error('Unrecognized command: <font color="red">' + value + '</font>');
                    }
                    selectTemplate('help');
                    top = 0;
                }
            }

            if (top) {
                record_value = record_value || value;
                // value: "b :arg1 car"
                // a.innerHTML = record_value;
                show_amr(show_amr_args);
                // show_amr_args:'show'
                if (state_has_changed_p) {
                    var old_state = undo_list[undo_index];
                    old_state['action'] = record_value;
                    undo_index++;
                    undo_list.length = undo_index;
                    undo_list[undo_index] = cloneCurrentState();
                    var s;
                    if ((s = document.getElementById('undo-button')) != null) {
                        s.title = 'undo ' + record_value;
                    }
                    if ((s = document.getElementById('undo-link')) != null) {
                        s.style.color = '#000000';
                    }
                    if ((s = document.getElementById('undo-command')) != null) {
                        s.style.color = '#000000';
                        s.style.fontStyle = 'normal';
                        s.innerHTML = '&nbsp' + record_value;
                    }
                    if ((s = document.getElementById('redo-button')) != null) {
                        s.title = 'currently nothing to redo';
                    }
                    if ((s = document.getElementById('redo-link')) != null) {
                        s.style.color = '#999999';
                    }
                    if ((s = document.getElementById('redo-command')) != null) {
                        s.style.color = '#999999';
                        s.style.fontStyle = 'italic';
                        s.innerHTML = '&nbsp;currently nothing to redo';
                    }
                    state_has_changed_p = 0;
                    var undo_list_size = undo_index + 1;
                    var redo_list_size = undo_list.length - undo_list_size;
                    // add_log('undo list increases to ' + undo_list.length + ' elements. Redo list size: ' + redo_list_size + ' Last action: ' + record_value);

                    if (undo_index == 1) {
                        enable_workset_save();
                        if ((s = document.getElementById('discard-and-next-button')) != null) {
                            s.style.color = '#990000';
                            if (next_special_action == 'close') {
                                s.value = 'Discard and close';
                                s.title = 'Close this window without saving any changes to this AMR';
                                s.setAttribute('onclick', 'self.close();');
                            } else {
                                s.value = 'Discard and load next';
                                s.title = 'Load next sentence without saving any changes to this AMR';
                            }
                        }
                        if ((s = document.getElementById('select-workset-snt-button')) != null) {
                            s.style.display = 'none';
                        }
                    }
                }
            }
            c.value = '';
            // if (show_amr_obj['option-resize-command'])
            c.style.height = '1.4em';
        }
    }
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
    reset_guidance();
    add_guidance(message);
}
function reset_guidance() {
    reset_message('guidance');
}
function add_guidance(message) {
    if (show_amr_obj['option-provide-guidance']) {
        add_message('guidance', message);
    }
}
function add_edit_log(message) {
    console.log("add_edit_log is called");
   var today = new Date();
   var date = today.getFullYear() + '-' + pad2(today.getMonth()+1) + '-' + pad2(today.getDate());
   var time = pad2(today.getHours()) + ':' + pad2(today.getMinutes()) + ':' + pad2(today.getSeconds());
   var timestamp = date + 'T' + time + '.' + pad3(today.getMilliseconds());
   add_message('edit-log', '\n:: ' + timestamp + ' ::\n' + htmlProtect(message));
}
function reset_message(type) {
    var s;
    if ((s = document.getElementById(type)) != null) {
        s.innerHTML = '';
    }
}
function reset_greeting() {
    // console.log("reset_greeting is called");
    reset_message('greeting');
}
function reset_error() {
    reset_message('error');
}

/********************************************************/

/**
 * add a new (or existing) key value pair variable: loc to the variables dictionary
 * @param v 'b'
 * @param loc "1.1.3"
 */
function record_variable(v, loc) {
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
 * add a new (or existing) key value pair concept: loc to the concepts dictionary
 * @param c 'boy'
 * @param loc "1.1.3"
 */
function record_concept(c, loc) {
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
 * @returns {string} variable
 */
function new_var(concept) {
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
    return v;
}

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
                var loc_parent_variable = get_parent_variable(loc + '');
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

function sloppy_match(sloppy_s, ref_s) {
    return ref_s.match(new RegExp('^' + sloppy_s));
}

/**
 * given loc of current variable, return the parent variable
 * @param loc
 * @returns {*}
 */
function get_parent_variable(loc) {
    if (loc.match(/\.\d+$/)) {
        var parent_loc = loc.replace(/\.\d+$/, "");
        return amr[parent_loc + '.v'] || '';
    } else {
        return '';
    }
}

function new_amr(concept) {
    console.log("new_amr is called");
    console.log(concept);
    var v = new_var(concept);
    console.log(amr);
    var n = amr['n']; // n is the variable number
    amr['n'] = ++n;
    amr[n + '.c'] = concept;
    amr[n + '.v'] = v;
    amr[n + '.n'] = 0;
    amr[n + '.s'] = '';
    amr[n + '.a'] = begOffset + "-" + endOffset;
    record_variable(v, n);
    record_concept(concept, n);
    variable2concept[v] = concept;
    state_has_changed_p = 1;
    console.log('new AMR: ' + concept + ' (' + n + ')' + ' var: ' + v);
    console.log(amr);
    return v;
}

/**
 * this function takes in head, role, argument, argument type , and output the argument variable
 * @param head
 * @param role
 * @param arg
 * @param arg_type
 * @returns {*} arg_variable
 */
function add_triple(head, role, arg, arg_type) {
    console.log("add_triple is called");
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
            arg_variable = arg;
            arg_concept = '';
            arg_string = '';
        } else if (validEntryConcept(arg)
            && (arg_type != 'string')
            && (!role_unquoted_string_arg(role, arg, ''))
            && (!role.match(/^:?(li|wiki)$/))) {
            arg_concept = trimConcept(arg);
            arg_variable = new_var(arg_concept);
            arg_string = '';
        } else if (validString(arg)) {
            arg_string = arg; // car
            arg_concept = '';
            arg_variable = '';
        } else if (validString(stripQuotes(arg))) {
            arg_string = stripQuotes(arg);
            arg_concept = '';
            arg_variable = '';
        } else {
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
        amr[new_loc + '.a'] = begOffset + "-" + endOffset; // alignment_index
        record_variable(arg_variable, new_loc);
        record_concept(arg_concept, new_loc);
        variable2concept[arg_variable] = arg_concept;
        state_has_changed_p = 1;
        if (role.match(/^:op(-\d|0|\d+\.\d)/)) {
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

function add_or(value) {
    console.log("add_or is called");
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
            or_var = new_amr(key_or);
        } else {
            or_var = add_triple(head_var, role, key_or, 'concept');
        }
        if (or_var) {
            for (var i = 3; i < cc.length; i++) {
                var sub_role = ':op' + (i - 2);
                add_triple(or_var, sub_role, cc[i], 'concept');
            }
        }
    }
}

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

function deleted_p(loc) {
    console.log("delete_p is called");
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
    // console.log("delete_elem is called");
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

function delete_rec(loc) {
    // console.log("delete_rec is called");
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
    console.log("delete_based_on_triple is called");
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

function delete_amr() {
    console.log("delete_amr is called");
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

function delete_dummies() {
    var n = amr['n'];
    var n_dummies_deleted = 0;
    for (var i = 1; i <= n; i++) {
        if (amr[i + '.c'] == 'dummy-element') {
            delete_elem(i);
            n_dummies_deleted++;
        }
    }
    if (n_dummies_deleted) {
        state_has_changed_p = 1;
        show_amr('show');
        exec_command('record delete dummies', 1);
    } else {
        add_error('Did not find any top-level dummy-element AMRs that could be deleted.');
    }
}

function amr_is_empty() {
    var n = amr['n'];
    for (var i = 1; i <= n; i++) {
        if (!amr[i + '.d']) {
            return 0;
        }
    }
    return 1;
}

function move_var_elem(variable, new_head_var, role) {
    console.log("move_var_elem is called");
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
            new_variable = new_var(target);
        }
        var loc_list = argSplit(locs);
        for (var i = 0; i < loc_list.length; i++) {
            loc = loc_list[i];
            amr[loc + '.v'] = new_variable;
            record_variable(new_variable, loc);
        }
        // add_log('  variable changed to ' + new_variable);
        state_has_changed_p = 1;
        exec_command('record change variable ' + variable + ' ' + target, top);
        return new_variable;
    }
    return 0;
}

function renorm_ops(variable) {
    console.log("renorm_ops is called");
    // add_log('renorm_ops ' + variable);
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
 * this function checked the options table based on the loaded information
 * @param html_import_name 'load_options'
 */
function import_options(html_import_name) {
    var s;
    var checkbox_options = ["string-args-with-head", "1-line-NEs", "1-line-ORs", "wrap", "fix-font", "role-auto-case", "variable-indentation", "auto-check", "auto-reification", "auto-moveto", "provide-guidance", "confirm-delete", "check-chinese", "resize-command"];
    var radio_options = new Array("amr-area-var-fix");
    var text_options = new Array("amr-area-height");
    if ((s = document.getElementById(html_import_name)) != null) {
        var option_string = s.value; // string-args-with-head:true;1-line-NEs:true;1-line-ORs:true;wrap:false;fix-font:false;role-auto-case:true;variable-indentation:false;auto-check:true;auto-reification:true;auto-moveto:false;provide-guidance:true;confirm-delete:false;check-chinese:false;resize-command:false;amr-area-var-fix:fix;amr-area-height:20
        var options = option_string.split(';');
        var option_ht = {};
        for (var i = 0; i < options.length; i++) { //i=0
            var option_slot_value = options[i]; //"string-args-with-head:true"
            var option_slot = option_slot_value.replace(/^([^:]+):(.*)$/, "$1"); // "string-args-with-head"
            var option_value = option_slot_value.replace(/^([^:]+):(.*)$/, "$2"); // "true"
            option_ht[option_slot] = option_value; //option_ht["string-args-with-head"] = "true";
        }

        // check everything (all the things in checkbox) in checkbox_options
        for (var i = 0; i < checkbox_options.length; i++) {
            var checkbox_option = checkbox_options[i]; // "string-args-with-head"
            if ((s = document.getElementById(checkbox_option)) != null) {
                if (option_ht[checkbox_option] != undefined) {
                    s.checked = (option_ht[checkbox_option] == 'true');
                    // add_log(' set ' + checkbox_option + ' to ' + option_ht[checkbox_option]);
                }
            }
        }
        for (var i = 0; i < radio_options.length; i++) { // i=0
            var radio_option = radio_options[i]; //"amr-area-var-fix"
            if ((s = document.getElementsByName(radio_option)) != null) {
                var len = s.length;
                if (len != undefined) {
                    for (var j = 0; j < len; j++) {
                        if ((option_ht[radio_option] != undefined)
                            && (option_ht[radio_option] == s[j].value)) {
                            s[j].checked = true;
                            // add_log(' set ' + radio_option + ' to ' + option_ht[radio_option]);
                        }
                    }
                }
            }
        }
        for (var i = 0; i < text_options.length; i++) { // i=0
            var text_option = text_options[i]; //"amr-area-height"
            if ((s = document.getElementById(text_option)) != null) {
                if (option_ht[text_option] != undefined) {
                    s.value = option_ht[text_option];
                    // add_log(' set ' + text_option + ' to ' + option_ht[text_option]);
                }
            }
        }
    }
    apply_amr_div_params();
}

function generate_dynamic_ontonotes_popup(concept, variable) {
    // concept = want-01 or buy, variable=w or b
    // console.log("generate_dynamic_ontonotes_popup is called");
    // console.log('generate_dynamic_ontonotes_popup ' + concept + ' ' + variable);
    var core_concept = concept.replace(/[-.](?:\d\d\d?|yy)$/, "");
    var sense_number = '';
    if (concept.match(/[-.](?:\d+|yy)$/)) {
        sense_number = concept.replace(/^.*[-.](\d+|yy)$/, "$1");
    }
    var url, url2;
    if (check_list['oncf.' + core_concept]) {
        url = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + core_concept + '-c.html';
        url2 = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames-var/' + core_concept + '-c-' + variable + '.html';
    } else if (check_list['onvf.' + core_concept]) {
        url = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + core_concept + '-v.html';
        url2 = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames-var/' + core_concept + '-v-' + variable + '.html';
    } else if (check_list['onjf.' + core_concept]) {
        url = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + core_concept + '-j.html';
        url2 = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames-var/' + core_concept + '-j-' + variable + '.html';
    } else if (check_list['onnf.' + core_concept]) {
        url = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + core_concept + '-n.html';
        url2 = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames-var/' + core_concept + '-n-' + variable + '.html';
    } else if (check_list['onf.' + core_concept]) {
        url = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + core_concept + '.html';
        url2 = 'https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames-var/' + core_concept + '-' + variable + '.html';
    }
    // url = "http://127.0.0.1:5000/buy"
    // url2 = "http://127.0.0.1:5000/buy"
    var snt = amr['props-snt'] || '';
    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
            // add_log('xmlhttp.readyState ' + xmlhttp.readyState);
            // add_log('xmlhttp.status ' + xmlhttp.status);
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                closeCurrentOpenPopup();
                var onload_fc = '';
                var ontoNotesFrameContent = xmlhttp.responseText + '';
                // add_log('Loaded ' + url + ' (' + ontoNotesFrameContent.length + ' bytes)');
                var ontoNotesFrameContentMod = ontoNotesFrameContent;
                ontoNotesFrameContentMod = ontoNotesFrameContentMod.replace(/(\bvar page_dynamically_created_p\s* =)\s*\S+?\s*;/, "$1 1;");
                if (variable) {
                    ontoNotesFrameContentMod = ontoNotesFrameContentMod.replace(new RegExp('<span title="([^"]*)">(' + core_concept + '[-.](?:\\d\\d\\d?|yy))<\/span>', 'g'), '<span id="' + "$2" + '" title="Select this sense in AMR Editor" style="color:#0000FF;text-decoration:underline;" onclick="window.opener.record_frame_arg_descr(\'' + "$2" + '\', \'' + "$1" + '\');window.opener.exec_command(\'replace concept at ' + variable + ' with ' + "$2" + '\', 1);window.opener.selectTemplate(\'clear\');self.close();closedCurrentOpenPopup();">' + "$2" + '</span>');
                }
                if (core_concept != concept) {
                    // onload_fc += 'redirect(\'' + url + '#' + core_concept + sense_number + '\');';
                    // add_log('Point A');
                    ontoNotesFrameContentMod = ontoNotesFrameContentMod.replace(new RegExp('(<h3>.*?' + core_concept + '[-.]' + sense_number + '.*?)(<\\/h3>)', 'g'), "$1" + ' &nbsp; <input type="checkbox" title="Currently selected sense" id="selected-sense" checked="checked">' + "$2");

                    var y = 600 - 30; // window.height - 30
                    onload_fc += 'goto_page_loc(\'\', \'selected-sense\', ' + y + ');';
                }
                if (((check_list['onvfm.' + core_concept])
                    || (check_list['onjfm.' + core_concept])
                    || (check_list['onnfm.' + core_concept])
                    || (check_list['onfm.' + core_concept]))
                    && (concept.substr(0, 1) == variable.substr(0, 1))
                    && (variable.match(/^[a-z](|[1-9]|1\d|20)$/))) {
                    if (sense_number) {
                        onload_fc = 'redirect(\'' + url2 + '#' + core_concept + sense_number + '\');';
                    } else {
                        onload_fc = 'redirect(\'' + url2 + '\');';
                    }
                }
                ontoNotesFrameContentMod = ontoNotesFrameContentMod.replace(/<link [^<>]*stylesheet[^<>]*>/g, "");
                var x = screen.width - 513 - 13;
                var y = 0;
                var newwindow_moveto_command = 'newWindow.moveTo(' + x + ', ' + y + '); newWindow.focus();';
                // add_log('newwindow_moveto_command: ' + newwindow_moveto_command);
                var newWindow = window.open('', 'Feedback', 'height=600,width=513,resizable=1,scrollbars=1,toolbar=0,statusbar=0,menubar=0');
                // add_log('Browser: ' + browserUserAgent);
                var auto_moveto = show_amr_obj['option-auto-moveto'];
                if (auto_moveto && !browserUserAgent.match(/chrome/i)) {
                    // add_log('onload moveTo');
                    onload_fc += 'window.moveTo(' + x + ',0);window.focus();';
                }
                if (onload_fc) {
                    ontoNotesFrameContentMod = ontoNotesFrameContentMod.replace(/(<body)( [^<>]*>)/, "$1 onload=\"" + onload_fc + "\"$2");
                }
                if (snt != '') {
                    ontoNotesFrameContentMod = ontoNotesFrameContentMod.replace(/(<body [^<>]*>)/, "$1\n<b>Current sentence:</b> &nbsp; <font color=\"red\">" + snt + "</font>\n<p>\n");
                }
                newWindow.document.write(ontoNotesFrameContentMod);
                newWindow.document.close();
                if (auto_moveto && browserUserAgent.match(/chrome/i)) {
                    // add_log('delayed moveTo');
                    setTimeout(newwindow_moveto_command, 2000);
                }
                newWindow.focus();
                current_onto_popup_window = newWindow;
            }
        }
        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    } else {
        add_error('This browser does not support window.XMLHttpRequest');
    }
}



/********************************************************/

function number_of_nodes(loc) {
    console.log("number_of_nodes is called");
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
    console.log("leafy_or_concept_p is called");
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

function show_amr_new_line_p(loc) {
    // console.log("show_amr_new_line_p is called");
    // add_log('show_amr_new_line_p: ' + loc);
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

function role_unquoted_string_arg(role, arg, loc) {
    // console.log("role_unquoted_string_arg is called");
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
    if (s.match(/^:[a-z]/i) && check_list['role.' + s]) {
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
            } else if (show_check) {
                var true_case_role;
                var explanation = check_list['role.' + role];
                var true_case = check_list['true-case.role.' + role.toLowerCase()];
                var non_role_explanation = check_list['non-role.' + role.toLowerCase()];
                if (non_role_explanation) {
                    role_m = '<span title="' + non_role_explanation + '" style="color:#CC0000">' + role_m + '</span>';
                } else if (explanation) {
                    role_m = '<span title="' + explanation + '" style="color:#007700">' + role_m + '</span>';
                } else if (true_case) {
                    role_m = '<span title="suggested capitalization: ' + true_case + '" style="color:#0000CC">' + role_m + '</span>';
                } else {
                    role_m = '<span title="role not recognized" style="color:#CC0000">' + role_m + '</span>';
                }
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
            } else if (show_check) {
                if (loc.match(/\.\d+$/)) {
                    head_loc = loc.replace(/\.\d+$/, "");
                    head_concept = amr[head_loc + '.c'] || '';
                } else {
                    head_concept = '';
                }
                core_concept = concept.replace(/[-.]\d\d\d?$/, "");
                // add_log('B: concept ' + concept);
                var special_title = concept_to_title[concept] || '';
                var special_url = concept_to_url[concept] || '';
                var special_color = '#007700';
                if (special_title.match(/\bNo such concept\b/)) special_color = '#CC0000';
                if (special_title) {
                    special_title = htmlProtect(special_title);
                    special_title = special_title.replace(/(\S)(\s\s+)(\S)/g, "$1&#xA;$2$2$3");
                    special_title = special_title.replace(/(No such concept)/, " &nbsp; $1");
                }
                if (special_title && special_url) {
                    concept_m = '<a href="' + special_url + '" title="' + special_title + '" style="color:' + special_color + ';text-decoration:underline;" target="_BLANK">' + concept + '</a>';
                } else if (special_url) {
                    concept_m = '<a href="' + special_url + '" style="color:' + special_color + ';text-decoration:underline;" target="_BLANK">' + concept + '</a>';
                } else if (concept == 'be-01') {
                    concept_m = '<a href="https://www.isi.edu/~ulf/amr/lib/popup/be.html" title="be-01 is banned. Click here for more info." style="color:#CC0000;" target="_BLANK">' + concept + '</a>';
                } else if (check_list['oncf.' + concept]
                    || check_list['onf.' + concept]) {
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this word" style="color:#0000FF;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (check_list['onvf.' + concept]
                    // && (! ((concept == 'name') && head_concept.match(/-ne$/i) && role.match(/^:op\d+$/i)))
                    && (!((concept == 'name') && role.match(/^:name$/i)))) {
                    // concept_m = '<a href="https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + concept + '-v.html" target="_BLANK" title="PropBank frame available">' + concept + '</a>';
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this verb" style="color:#0000FF;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                    // add_log('concept_m ' + htmlProtect(concept_m));
                } else if (check_list['onjf.' + concept]) {
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this adjective" style="color:#0000FF;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (check_list['onnf.' + concept]) {
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this noun" style="color:#0000FF;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && (check_list['oncf.' + core_concept]
                    || check_list['onf.' + core_concept])) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this word';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && check_list['onvf.' + core_concept]) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this verb';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && check_list['onjf.' + core_concept]) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this adjective';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && check_list['onnf.' + core_concept]) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this noun';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="generate_dynamic_ontonotes_popup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (special_title) {
                    concept_m = '<span title="' + special_title + '" style="color:' + special_color + ';border-bottom:1px dotted;" target="_BLANK">' + concept + '</span>';
                }
            }
            s += '(' + variable_m + '-' + alignment_index + ' / ' + concept_m;
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
                var show_amr_rec_result;
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
 * this is the function that print out the penman format output
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
    if (args) {
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
        // if ((s = document.getElementById('plain-amr')) != null) {
        //     s.value = deHTML(amr_s);
        // }
        // if ((s = document.getElementById('plain-amr2')) != null) {
        //     s.value = deHTML(amr_s);
        // }
        // if ((s = document.getElementById('plain-amr3')) != null) {
        //     s.value = deHTML(amr_s);
        // }
        if (amr_s == '') {
            html_amr_s = '<i>empty AMR</i>';
        } else {
            html_amr_s = amr_s;
        }
        html_amr_s = htmlSpaceGuard(html_amr_s);
        // html_amr_s = html_amr_s.replace(/\n/g, "<br>\n");
        // html_amr_s = html_amr_s.replace(/&xA;/g, "\n");

        setInnerHTML('amr', html_amr_s);
        show_amr_status = args;
        // add_log('show AMR end');
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


// functions below are about load and save and stuff
function check_amr() {
    console.log("check_amr is called");
    // add_log('check_amr');
    selectTemplate('clear');
    show_amr('show check');
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

/**
 * this function is used to apply the style of the "amr" html element and command box resizing
 */
function apply_amr_div_params() {
    var s, s2, len, wrap;
    var area_var_height = ''; // a number between 5 to 100
    var area_var_fix_value = ''; // "varible" or "fix"
    var area_var_fix_value_fix_default = 20;
    var area_var_fix_value_fix_minimum = 5;
    var area_var_fix_value_fix_maximum = 100;
    reset_error();
    reset_guidance();

    // populate var area_var_fix_value to "varible" or "fix"
    if (s = document.getElementsByName('amr-area-var-fix')) {
        len = s.length; //2
        if (len != undefined) {
            for (var i = 0; i < len; i++) { //i=0
                if (s[i].checked) {
                    area_var_fix_value = s[i].value;
                }
            }
        }
    }

    // populate var area_var_height to a number between 5 to 100
    if ((s = document.getElementById('amr-area-height')) != null) {
        area_var_height = s.value;
    }

    // prompt the user to type in a integer between 5 to 100
    if (area_var_fix_value == 'fix') {
        if (!area_var_height.match(/^\d+$/)) {
            add_error('Under options/Display options/AMR display area height/fix, the number of lines must be a positive integer, not <font color="red">' + area_var_height + '</font>. Setting parameter to default value of <font color="green">' + area_var_fix_value_fix_default + '</font> instead.');
            area_var_height = area_var_fix_value_fix_default;
            if ((s = document.getElementById('amr-area-height')) != null) {
                s.value = area_var_height;
            }
        } else if (area_var_height < area_var_fix_value_fix_minimum) {
            add_error('Under options/Display options/AMR display area height/fix, the number of lines must be at least ' + area_var_fix_value_fix_minimum + ', not <font color="red">' + area_var_height + '</font>. Setting parameter to minimum <font color="green">' + area_var_fix_value_fix_minimum + '</font> instead.');
            area_var_height = area_var_fix_value_fix_minimum;
            if ((s = document.getElementById('amr-area-height')) != null) {
                s.value = area_var_height;
            }
        } else if (area_var_height > area_var_fix_value_fix_maximum) {
            add_error('Under options/Display options/AMR display area height/fix, the number of lines must be at most ' + area_var_fix_value_fix_maximum + ', not <font color="red">' + area_var_height + '</font>. Setting parameter to maximum <font color="green">' + area_var_fix_value_fix_maximum + '</font> instead.');
            area_var_height = area_var_fix_value_fix_maximum;
            if ((s = document.getElementById('amr-area-height')) != null) {
                s.value = area_var_height;
            }
        }
    }

    // enable the style of the amr output box
    if (s = document.getElementById('amr')) {
        if (area_var_fix_value == 'fix') {
            s.style.height = ((area_var_height * 1.2) + 0.2) + 'em';
            s.style.overflow = 'auto';
            s.style.border = '1px solid #000033';
            s.style.padding = '8px';
            if (((wrap = document.getElementById('wrap')) != null) && wrap.checked) {
                s.style.whiteSpace = 'normal';
            } else {
                s.style.whiteSpace = 'nowrap';
            }
        } else if (area_var_fix_value == 'variable') {
            s.style.height = '';
            s.style.overflow = '';
            s.style.border = '0px solid #000000';
            s.style.padding.padding = '';
        }
        if ((s2 = document.getElementById('fix-font')) != null) {
            show_amr_obj['option-fix-font'] = s2.checked;
        }
        if (show_amr_obj['option-fix-font']) {
            s.style.fontFamily = 'Courier';
        } else {
            s.style.fontFamily = '';
        }
    }

    //enable resizing command box
    if (((s = document.getElementById('command')) != null)
        && ((s2 = document.getElementById('resize-command')) != null)) {
        if (s2.checked) {
            s.style.resize = 'both';
            s.style.overflow = 'auto';
            var n_lines = Math.floor(s.value.length / 43) + 1;
            s.style.height = ((n_lines * 1.2) + 0.2) + 'em';
            // s.style.height = '22px';
            // s.style.height = '1.4em';
        } else {
            s.style.resize = 'none';
            s.style.overflow = 'hidden';
            s.style.height = '';
        }
    }
    hideOptions();
}

function pad2(value) {
    console.log("pad2 is called");
    if (value < 10) {
        return '0' + value;
    } else {
        return value;
    }
}

function pad3(value) {
    console.log("pad3 is called");
    if (value < 10) {
        return '00' + value;
    } else if (value < 100) {
        return '0' + value;
    } else {
        return value;
    }
}

function today(format) {
    console.log("today is called");
    var today = new Date();
    var day = today.getDate();
    var month = today.getMonth() + 1;
    var year = today.getFullYear();
    var date = pad2(month) + '\/' + pad2(day) + '\/' + year;
    // add_log('today is ' + date);
    return date;
}

function setToday() {
    console.log("setToday is called");
    var s;
    if ((s = document.getElementById('props-date')) != null) {
        s.value = today('');
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

function saveAMR() {
    console.log("saveAMR is called");
    if (((s = document.getElementById('workset-template')) != null)
        && s.style.display.match(/inline/)
        && ((s1 = document.getElementById('save-snt-id2')) != null)
        && ((s2 = document.getElementById('next-workset-snt-id2')) != null)
        && ((s3 = document.getElementById('save-workset-snt')) != null)) {
        props2comment();
        s1.value = amr['props-id'] || '';
        s2.value = s1.value;
        s2.value = s2.value.replace(/^([a-z][a-z])_(.*)$/, "$1.$2");
        s2.value = s2.value.replace(/^(.*)_(\d+)$/, "$1.$2");
        // add_log('save workset sentence. save: ' + s1.value + ' next: ' + s2.value);
        s1.value = '';
        s3.submit();
    }
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

function load_local_amr_file() {
    console.log("load_local_amr_file is called");
    var s, scriptPath, fh;
    var load_method = '';
    if (window.File && window.FileReader && window.FileList && window.Blob) {
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
        add_unique_log('Browser supports ActiveXObject. Good.');
        load_method = 'ActiveXObject';
        try {
            var fso = new ActiveXObject("Scripting.FileSystemObject");
            // var filePath = document.getElementById('local_load_files').files[0];
            var filePath = document.getElementById('local_load_files').value;
            // add_log('Loading file ' + filePath + ' ...');
            var file = fso.OpenTextFile(filePath, 1);
            var fileString = file.ReadAll();
            // add_log('ActiveXObject5');
            file.Close();
            // add_log('Loaded AMR: ' + fileString);
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

function save_local_amr_file() {
    console.log("save_local_amr_file is called");
    var s, s2, s3, filename;
    var comment = '';
    var text = '';
    if (window.BlobBuilder && window.saveAs) {
        if (((s = document.getElementById('local_save_file')) != null)
            && ((s2 = document.getElementById('plain-amr')) != null)) {
            if ((s3 = document.getElementById('comment')) != null) {
                comment = s3.value;
            }
            filename = s.value;
            filename = filename.replace(/\.txt$/, "");
            filename = filename.replace(/[^-_a-zA-Z0-9]/g, "_");
            filename += '.txt';
            add_log('Saving file ' + filename + ' on your computer, typically in default download directory');
            if (comment.match(/\S/)) {
                text += comment + '\n';
            }
            text += s2.value;
            text = text.replace(/\n/g, "\r\n");

            var bb = new BlobBuilder();
            bb.append(text);
            saveAs(bb.getBlob(), filename);
        }
    } else {
        add_error('This browser does not support the BlobBuilder and saveAs. Unable to save file with this method.');
        if ((s = document.getElementById('alt-save-locally')) != null) {
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

function n_spaces(n) {
    // console.log("n_spaces is called");
    var result = '';
    for (var i = 0; i < n; i++) {
        result += ' ';
    }
    return result;
}

function indent_for_loc(loc, c, style, n) {
    // console.log("indent_for_loc is called");
    // add_log('start indent_for_loc ' + loc);
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
    console.log("string2amr_rec is called");
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
                record_concept(concept, loc);
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
                record_concept(new_concept, loc);
                variable2concept[variable] = new_concept;
            }
            if (getLocs(variable)) {
                new_variable = new_var(concept);
                amr[loc + '.v'] = new_variable;
                decorated_variable = '<span ' + change_var_style + '>' + new_variable + '</span>';
                record_variable(new_variable, loc);
                load_amr_feedback_alert = 1;
            } else if (reserved_variables[variable + '.conflict']) {
                amr[loc + '.v'] = variable;
                decorated_variable = '<span ' + accept_conflict_style + '>' + variable + '</span>';
                record_variable(variable, loc);
            } else if (!variable.match(/^[a-z]\d*$/)) {
                new_variable = new_var(concept);
                amr[loc + '.v'] = new_variable;
                decorated_variable = '<span ' + change_var2_style + '>' + new_variable + '</span>';
                record_variable(new_variable, loc);
                load_amr_feedback_alert = 1;
            } else {
                amr[loc + '.v'] = variable;
                decorated_variable = variable;
                record_variable(variable, loc);
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
                record_variable(variable_arg, loc);
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
                record_variable(ps, ps_loc);
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
            var html_rest = htmlSpaceGuard(rest);
            popup_with_html_text(load_amr_feedback, html_rest);
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

function popup_with_html_text(s, rest) {
    console.log("pop_up_with_html_text is called");

    closeCurrentOpenPopup();
    newwindow = window.open('', 'Feedback', 'height=400,width=600,resizable=1,scrollbars=1,toolbar=1,statusbar=1,menubar=1');
    var tmp = newwindow.document;
    // add_log('popup_with_html_text ' + s);
    tmp.write('<html><head><title>Feedback</title></head><body style="background-color:#FFFFEE;"><br>\n');
    tmp.write('<h3>Feedback on automatic AMR corrections made during loading</h3>');
    tmp.write('Tooltips provided for altered (non-green) sections of the AMR.<p>');
    tmp.write(s);
    if (rest != "") {
        tmp.write('<p><hr><p>Remaining text not processed:<br><font color="#999999">' + rest + '</font>');
    }
    tmp.write('</body></html>\n');
    tmp.close();
    current_onto_popup_window = newwindow;
}

/********************************************************/


function get_AMR_editor_login() {
    console.log("get_AMR_editor_login is called");
    // add_log('get_AMR_editor_login cookies ' + document.cookie);
    var cookies = document.cookie.split(";");
    for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i];
        if (cookie.match(/AMR_editor_login=/)) {
            return cookie.replace(/^\s*AMR_editor_login=(.*)$/, "\$1");
        }
    }
    return '';
}

function primary_variable_loc(variable) {
    console.log("primary_variable_loc is called");
    var var_locs = getLocs(variable);
    if (var_locs) {
        var loc_list = argSplit(var_locs);
        return loc_list[0];
    } else {
        return '';
    }
}



var list_of_known_role_s = " \
// BEGIN ROLES \
  :ARG0 \
  :ARG1 \
  :ARG2 \
  :ARG3 \
  :ARG4 \
  :ARG5 \
  :ARG6 \
  :ARG7 \
  :ARG8 \
  :ARG9 \
  :accompanier \
  :age \
  :beneficiary \
  :calendar in dates \
  :card1 \
  :card2 \
  :card3 \
  :card4 \
  :card5 \
  :card6 \
  :card7 \
  :card8 \
  :card9 \
  :card10 \
  :card11 \
  :card12 \
  :card13 \
  :card14 \
  :card15 \
  :card16 \
  :card17 \
  :card18 \
  :card19 \
  :card20 \
  :century in dates \
  :comparison \
  :concession \
  :condition \
  :conj-as-if \
  :consist-of \
  :day in dates \
  :dayperiod in dates \
  :decade in dates \
  :degree \
  :destination \
  :direction \
  :domain \
  :duration \
  :era in dates \
  :example \
  :extent \
  :frequency \
  :instrument \
  :li \
  :location \
  :manner \
  :medium \
  :mod \
  :mode \
  :month in dates \
  :name \
  :op1 \
  :op2 \
  :op3 \
  :op4 \
  :op5 \
  :op6 \
  :op7 \
  :op8 \
  :op9 \
  :op10 \
  :op11 \
  :op12 \
  :op13 \
  :op14 \
  :op15 \
  :op16 \
  :op17 \
  :op18 \
  :op19 \
  :op20 \
  :op21 \
  :op22 \
  :op23 \
  :op24 \
  :op25 \
  :OR special role for HyTER \
  :ord \
  :part \
  :path \
  :polarity used for negation: -\
  :polite used for imperatives: +\
  :poss \
  :prep-against \
  :prep-along-with \
  :prep-amid \
  :prep-among \
  :prep-as \
  :prep-at \
  :prep-by \
  :prep-for \
  :prep-from \
  :prep-in \
  :prep-in-addition-to \
  :prep-into \
  :prep-on \
  :prep-on-behalf-of \
  :prep-out-of \
  :prep-to \
  :prep-toward \
  :prep-under \
  :prep-with \
  :prep-without \
  :purpose \
  :quant \
  :quarter in dates \
  :range \
  :scale for certain quantities, e.g. Richter \
  :season in dates \
  :snt1 \
  :snt2 \
  :snt3 \
  :snt4 \
  :snt5 \
  :snt6 \
  :snt7 \
  :snt8 \
  :snt9 \
  :snt10 \
  :snt11 \
  :snt12 \
  :snt13 \
  :snt14 \
  :snt15 \
  :snt16 \
  :snt17 \
  :snt18 \
  :snt19 \
  :snt20 \
  :source \
  :subevent \
  :time \
  :timezone in dates (time) \
  :topic \
  :unit in quantities \
  :value \
  :weekday in dates \
  :wiki \
  :xref \
  :year in dates \
  :year2 in dates \
// END ROLES \
";

var list_of_non_role_s = " \
// BEGIN NON-ROLES \
  :agent Use OntoNotes :ARGn roles \
  :be-located-at-91 be-located-at-91 is a verb frame, not a role. \
  :cause Use cause-01 (:cause is only a shortcut) \
  :compared-to Use have-degree-91 (reification of :degree) \
  :employed-by Use have-org-role-91 \
  :experiencer Use OntoNotes :ARGn roles \
  :instance An instance is a special role, expressed as the slash (\"\/\") between variable and concept. \
  :num Use quant \
  :patient Use OntoNotes :ARGn roles \
  :prep-except Use except-01 \
  :prep-save Use except-01 \
  :subset Use include-91 \
  :theme Use OntoNotes :ARGn roles \
// END NON-ROLES \
";

var list_of_on_frame_unified_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES UNIFIED FRAMES \
  abbreviation* abdication* abduction* \
  ablate ablation* ablaze* able* abolition* abominable* abomination* abortion* aboutface* abrasion* abrogation* \
  absence* absolution* absorption* abstention* abstraction* abusive* acceleration* \
  acceptance* accommodation* accompaniment* accordance* according-to* \
  accounting* accumulation* accusation* accustomed* acetylation* achievement* aching* \
  achy* acknowledgment* acquisition* acquittal* act-out* act-up* \
  action* activating* activation* active* activeness* activity* actual* actually* actuation* \
  adaptation* adaption* add-on* add-up* addicted* addiction* addictive* \
  addition* adherent* adhesion* adjournment* adjudication* adjustment* \
  administration* admirable* admiration* admission* admitting* admonition* \
  adopted* adoption* adorable* advantage* advantageous* advanced* \
  advertise* advertisement* advertising* advertize* advertizement* advertizing* \
  advice* advisable* affair affectation* \
  affected* affiliation* affirmation* afire* afraid* aftermath* age-out* aged* \
  agglomeration* aggravating* aggregation* aging* agitated* agitation* \
  agreement* airlifting* alarming* alienation* aligned* alignment* alike* alive* alkylate alkylation* \
  allegation* alleviation* alliance* allocation* allotment* allowance* alteration* alternation* \
  amalgamation* amazed* amazing* amendment* amination* amplification* amplified* amputation* \
  amusement* amusing* analysis* anathema* angry* animation* anneal* annealing* annihilation* announcement* annoyed* annoying* \
  antagonistic* anticipation* anticoagulated* anticoagulation* apology* appalled* appalling* apparent* \
  appealing* appearance* appearing* application* appointment* appraisal* appreciated* \
  appreciation* appreciative* apprehension* apprehensive* approachable* appropriating* appropriation* approval* \
  apt* aptitude* arbitrary* arbitration* argument* arm-up* armored* arrangement* \
  arrival* articulation* as-opposed-to* ascending* ascension* ascent* ashame* ashamed* ask-out* asleep* \
  asphalt-over* asphyxiation* aspiration* assassination* assay assembly* assertion* assessment* \
  assignment* assimilation* assistance* associated* association* assumption* \
  assurance* assured* astonished* astonishing* astounding* at-once* atrophic* \
  attached* attachment* attacking* attainable* attainment* attending* attention* attentive* attenuated* attenuation* \
  attracted* attraction* attractive* attributable* auction-off* audible* augmentation* \
  authentic* authentication* authorization* automation* available* averaging* \
  avulsion* awakening* awesome* babysitting* back-off* back-up* backing* backlash \
  bad* bad-off* bail-out* balance-out* bandage-up* banding* bandy-about* bandy-around* bang-on* banging* bank-up* \
  banking* bankruptcy* banning* bargaining* bark-up-the-wrong-tree* based* \
  bashing* bat-in* bath* bathing* battering* batting* be-all* \
  be-destined* be-done* be-done-for* be-enough* be-it* be-like* be-located* be-more-like* \
  be-on-fire* be-temporally* be-with* bear-in-mind* bear-out* bear-up* bearing* \
  beat-out* beat-up* beating* beautiful* beauty* becoming* bed-down* bedding* beef-up* beginning* being* \
  belch-out* belching* belittling* belly-up* belonging* belt-out* bending* bendy* beneficial* bequest* \
  beside-the-point* best-off* betrayal* better-off* betting* biased* bickering* bidding* \
  bifurcation* biking* billing* bind-up* binding* binding-affinity biotinylate biotinylation* birthing* \
  black-out* blackened* blast-away* blast-off* blather blathering* bleed-off* bleed-out* bleeding* blessing* blinded* \
  blistering* bloated* bloating* block-up* blockage* blocking* \
  blogging* blood-on-hand* blood-on-hands* blooming* blot-out* blow-out* blow-over* blow-up* \
  blowing* blowing-out* blowing-up* blunting* blurring* blurry* \
  blurt-out* board-up* boarding* boating* bog-down* boil-down* \
  boil-over* bold* bombardment* bombing* bone-up* booing* book-up* booked* booking* boom-out* boot-up* \
  bored* boring* borrowing* boss-around* bossy* bothered* bothersome* bottle-up* bottom-out* bounce-back* bound-up* \
  bow-down* bow-out* bowl-over* bowling* box-in* boxing* \
  bracing* brainwashed* branch-out* bravery* brazen-out* breaded* \
  break-away* break-down* break-even* break-heart* break-in* break-off* \
  break-out* break-through* break-up* breakdown* breaking* breaking-off* breakup* \
  breastfeeding* breath* breathing* breeding* brick-over* bridging* briefing* bright* \
  bring-about* bring-along* bring-down* bring-on* bring-to-mind* bring-up* broad* broadening* broader* broke* \
  broke-ass* broken* brokenhearted* bruising* brush-off* brush-up* brushing* brutal* \
  brutality* buckle-down* buckle-up* budding* budgeting* buffalo build-up* \
  building* buildup-up* bulging* bulky* bullying* bump-off* bump-up* bunch-up* bundle-up* \
  buoy-up* burial* burn-out* burn-up* burning* burnout* burping* burst-out* \
  bust-out* bust-up* busting* bustling* busy butt-in* buy-into* buy-off* \
  buy-out* buy-up* buying* buying-off* buyout* buzz-off* by-election* \
  by-line* byelect* byelection* byline* calcification* calcified* calcifying* calculating* calculation* \
  call-in* call-into-question* call-off* call-on* call-out* call-up* \
  call-upon* calling* calm-down* camp-out* camping* cancellation* \
  canning* capitalization* capitulation* careful* caring* carry-off* carry-on* \
  carry-out* carry-over* cart-off* carve-out* cascading* case-in-point* cash-in* cast-light* \
  casting* castration* catch-on* catch-up* catching* \
  catching-on* catching-up* categorization* catheterization* causation* cautious* \
  cave-in* celebration* centered* centerist* centrism* centrist* \
  certification* certified* cessation* chalk-up* challenging* championing* championship* characterization* \
  charge-off* chart-out* chasing* chatter-away* chatting* cheap* cheaper* cheating* check-in* \
  check-into* check-out* check-up* checkin* checking* checkout* \
  cheer-on* cheer-up* cherry-pick* cherrypick chew-up* chewing* chicken-out* chilling* chilly* \
  chip-in* choice* choke-off* choke-up* choking* choosing* \
  chop-down* chop-up* christening* circulation* circumcision* circumscribed* citation* civilization* \
  civilized* clapping* clarification* classification* classy* clean-out* clean-up* cleaning* cleansing* \
  clear-out* clear-up* clearance* clearer* clearing* clearing-up* cleavage* clenching* \
  climbing* clingy* clip-off* clog-up* clogging* cloning* \
  close-down* close-in* close-off* close-over* close-up* closed* \
  closer* closing* clothing* clouding* cloudy* clown-around* clubbing* clumping* clunking* clutch-on* \
  co-administer* co-administration* co-culture* co-evolution* \
  co-evolve* co-existence* co-host* coactivate coactivation* coadminister* coadministration* coagulation* coating* \
  coblation* cochair* coculture* coding* coercion* coercive* \
  coexistence* coexpress coexpression* cofound* coherent* cohesion* cohost* coil-up* coimmunoprecipitate* \
  coimmunoprecipitation* cold* collaborating* collaboration* collecting* collection* \
  collision* collusion* collusive* colocalisation* colocalise* colocalization* \
  colocalize colonization* color-in* coloration* coloring* combination* \
  combustion* come-about* come-across* come-along* come-around* come-by* come-down* come-forward* \
  come-in* come-off* come-on* come-out* come-over* come-through* come-to* come-to-terms* come-to-mind* come-up* \
  come-upon* comeback comfortable* coming* coming-around* commemoration* commendable* commendation* \
  commercialization* commissioning* commitment* committed* \
  commoditization* communicating* communication* comparable* comparison* compensation* \
  competition* competitive* compilation* complaining* complaint* \
  complete* completely* completion* compliance* compliant* \
  complicated* complication* composition* comprehension* compression* compulsion* concealed* \
  concentrated* concentration* conception* concerned* concerning* concession* conclusion* \
  conclusive* concrete-over* concurrent* condensation* conditioned* conditioning* \
  conduction* conductive* confederation* conference* confession* configuration* \
  confirmation* confiscation* conflicted* conflictive* confrontation* confused* confusing* \
  confusion* congested* congestion* conglomeration* congratulation* congregation* conjugation* conjure-up* \
  connected* connecting* connection* connotation* conquering* conquest* consensual* conservation* consideration* \
  considered* consolation* consolidation* constipate constipated* constipating* constipation* constitution* construction* constructive* consultation* \
  consulting* consuming* consumption* contained* containment* contamination* contemplation* contention* continuation* \
  contract-out* contracting* contracting-out* contraction* contradiction* contraindicated* contraindication* contribution* contributive* contributory* \
  controlled* controlling* convening* convention* convergence* conversant* \
  conversation* conversion* conviction* convinced* convincing* convulsion* \
  cook-up* cooked* cooking* cool-down* cool-off* cooling* \
  coop-up* cooperation* cooperative* coopt* coordination* coping* coprecipitate coprecipitation* copy-out* \
  copying* core-out* cornification* cornify correction* correlation* correspondence* corrosion* corruption* \
  cosponsor* cotransfect* cotransfection* cough-up* coughing* could* counseling* counterfeiting* \
  counting* cover-over* cover-up* coverage* covering* \
  crack-down* crack-up* crackdown* cracking* cracking-down* cracking-up* crafty* cramping* crampy* \
  crank-out* crank-up* crap* crappy* crash-out* crazy* creation* creep-out* creep-up* creepy* crepitation* \
  crime* criminal* criminalization* crisp-up* critical* criticism* criticizing* crop-up* \
  cross-examination* cross-out* cross-pollination* cross-talk* crossexamination* crossexamine* crossing* \
  crossing-out* crosspollination* crosstalk* crowded* crushed* crushing* cry-down* \
  cry-out* crying* crying-down* crying-out* cuddling* cuddly* culpability* culpable cultivation* cupping* curable* \
  curative* curl-up* curled* curling* cut-anchor* cut-anchor-and-run* cut-and-run* \
  cut-bait* cut-bait-and-run* cut-back* cut-down* cut-it* \
  cut-loose* cut-mustard* cut-off* cut-out* cut-slack* cut-up* cutback* cutting* cycling* \
  damage* damaged* damages* damaging* \
  damning* dampened* dampening* dancing* dangerous* daring* dark* darker* \
  dash-off* date-line* dateline* dating* daunting* dazzling* \
  de-nuclearization* deacetylation* deaf* dealing* deaminate deamination* death* \
  debatable* debilitate debilitating* debilitation* \
  deceased* deceleration* deception* deceptive* decision* deck-out* \
  declaration* decomposition* decompressed* decompression* decoration* decreased* \
  decrypt* decrypted* decryption* dedicated* dedication* deduction* deep* deepest* \
  defamation* defarnesylate defarnesylation* defecation* defence* defense* defiance* \
  defined* definition* deflation* deflection* degeneration* deglycosylate deglycosylation* \
  degradation* dehydration* delayed* deleting* deletion* deliberation* \
  delineation* delivery* delocalization* delocalize delusion* demethylation* \
  demilitarization* demolition* demonstration* demoralization* demyelinating* demyelination* denaturation* denature denomination* denuclearization* denuclearize* \
  denunciation* depalmitoylate depalmitoylation* departure* dependent* dephosphorylation* depiction* depletion* deplorable* deployment* deportation* \
  deposition* depreciation* depressed* depressing* depression* deprivation* \
  depth* deregulation* derision* descended* descending* description* \
  desecration* desensitization* deserving* designation* desirable* desperate* desperation* destabilization* destruction* \
  destructive* detachment* detection* detention* deterioration* determination* determined* detestable* \
  devaluation* devastation* developed* development* deviated* deviation* devoid* devolution* \
  devotion* diagnosis* diagnostic* dialog* dialogue dictating* dictation* die-down* die-off* die-out* \
  difference* different* differentiated* differentiation* diffusely* diffusion* dig-out* \
  dig-up* digestion* digging* digress* digressing* digression* dilatation* dilated* dilation* \
  dimerization* dimerize diminished* din-out* dine-out* dining* directing* direction* disappointed* disappointing* \
  disappointment* disarmament* disarming* discernable* disclosure* discoloration* discolored* discontinuation* \
  discourse-connective* discovered* discovery* discrimination* discriminatory* discussion* disgraceful* disgruntled* disgusted* disgusting* dish-out* \
  dish-up* disheartened* disinform* disinformation* disintegration* dislocation* dismemberment* disobedience* disobediency* \
  disorganization* dispensation* dispiriting* displacement* disposal* disposition* disruption* \
  dissatisfaction* dissection* dissemination* dissention* dissociation* dissolution* distant* distended* \
  distension* distention* distinction* distorted* distortion* distracted* \
  distracting* distraction* distressed* distribution* disturbance* disturbing* ditch* divergence* \
  diversification* diversion* divide-up* divided* dividing* dividing-up* diving* division* \
  divisive* divorced* divvy-up* dizzying* do-away* do-in* docking* dockings* \
  documentation* dogsledding* doing* dole-out* doll-up* dominance* \
  dominant* dominated* domination* dominion* donation* done* done-for* doomed* \
  doped-up* dosing* doublewrap* doubling* doubtful* downing* downloading* downmodulate downmodulation* downregulation* \
  doze-off* drafting* drag-on* drained* draining* draw-down* draw-up* \
  drawing* dreadful* dream-on* dream-up* dreaming* dredge-up* dress-down* \
  dress-up* dressed* dressed-up* dressing* dribbling* drilling* drink-up* drinking* \
  drippy* drive-around* driven* driving* drooling* drooping* \
  drop-by* drop-in* drop-off* drop-out* dropping* dropping-by* \
  dropping-off* dropping-out* drown-out* drowsy* drug-up* drum-up* \
  dry-out* dry-up* drying* dubious* due* dueling* dumpy* duplication* dust-off* \
  dusting* dyed* dysregulation* ease-up* easier* easing* \
  easy* eat-away* eat-up* eating* eavesdropping* ec* ec50* ed* ed50* edge-out* edgy* \
  edification* editing* educated* educating* education* eff-up* effective* effective-concentration* effective-dose* effectiveness* \
  efficiency* effort effusion* ejaculation* ejection* elaboration* election* electoral* electrocoagulation* \
  electrocution* electrodesiccation* electronegative* elevated* elevation* elimination* elusive* elute \
  elution* emancipation* embarrassed* embarrassing* emission* emotional* emphasis* employed* \
  employment* emptying* emulation* enactment* encouragement* encouraging* encryption* \
  end-up* endangered* ending* endorsement* endowment* engaged* engagement* engineering* enhancing* \
  enlarged* enlightening* enrollment* entangled* entering* entertained* entry* enumeration* \
  equality* equation* equivocal* eradication* erection* erosion* \
  error* eruption* escalation* establishment* estimation* evacuation* evaluation* \
  evangelization* evangelize* evaporation* evasion* even-out* evening-out* evident* \
  evolution* exacerbation* exaction* exaggeration* exalted* examination* excavation* excellent* exception* excessive* \
  excision* excited* excitement* exciting* exclusion* exclusive* excommunication* excoriation* execution* exemption* \
  exertion* exfoliate exhausted* exhausting* exhaustion* exhibition* existent* existing* \
  expanded* expansion* expectation* expectative* experienced* experimentation* \
  expiration* expired* explanation* explicit* exploitation* exploiting* \
  exploration* explosion* exposure* expression* expulsion* extension* extensive* extermination* \
  extortion* extracting* extraction* extradition* extrusion* exudative* fabrication* face-off* facilitation* \
  failing* fainting* fair* fairly* fall-apart* fall-back* fall-into-hands* fall-off* fall-out* fall-over* fall-short* \
  fall-through* falling* falling-apart* falling-back* falling-off* falling-out* falling-over* \
  falling-through* familiar* famous* fantastic* farm-out* farming* farnesylate farnesylation* fart-around* \
  farting* fascinating* fascination* fashionable* fast fast-forward* faster* \
  fastforward fasting* fat* fatigued* fatten-up* faulty* \
  favorable* favour* favourable* fearful* federation* fedex* feed-up* feeding* feel-up* \
  feeling* fence-off* fencing* fend-off* fermentation* ferret-out* fess-up* feuding* fiery* fight-back* \
  fight-off* fight-on* fighting* figure-out* filing* fill-in* fill-out* \
  fill-up* filling* filling-in* filming* filtration* financing* find-out* \
  finding* fine-tuning* finetune* finetuning* finish-off* finish-out* \
  finish-up* finished* firing* firm-up* firmer* fishing* fissuring* fit-in* fitting* \
  fitting-in* fix-up* fixation* fixed* flake-out* flaking* flare-up* flash-back* \
  flashing* flat* flatten-out* flattening* flawed* fleeing* flesh-out* flexible* flexion* flickering* flip-out* \
  flipflop* flooding* flossing* fluctuant* fluctuation* fluoridate fluoridation* flush-out* flushing* \
  flustered* fluttering* fly-out* flying* foaming* focused* foggy* fold-up* \
  follow-suit* follow-through* follow-up* following* fool-around* forecasting* foreseeable* forgiving* fork-out* \
  fork-over* formation* forming* formulation* fort-up* fostering* \
  foundation* founding* fragmentation* freak-out* free-up* \
  freeze-over* freezing* fresh* freshen-up* fried* fright* frighten-away* frighten-off* \
  frightening* fritter-away* frogwalk* frustrated* frustrating* frustration* \
  fuck-around* fuck-off* fuck-up* fucked* fucked-up* fudge-over* fulfilled* fulfilling* fulfillment* \
  full* fun* functional* functioning* funding* fundraising* funnier* funny* furious* fusion* fussed* \
  fussing* fuzzy* gagworthy* gaiety* gambling* gardening* gas-up* \
  gastrulate* gastrulation* gathering* gay* gayness* gear-up* \
  general* generalization* generation* genocide geranylgeranylate geranylgeranylation* germination* gestate \
  gestation* get-along* get-around* get-away* get-back* get-by* get-down* \
  get-even* get-hand* get-hands* get-hands-on* get-off* get-on* get-out* get-through* \
  get-together* get-up* getting* \
  give-away* give-back* give-birth* give-in* give-off* give-out* give-over* \
  give-rise-to* give-up* give-vent* giving* glad* glass-over* glaze-over* \
  glistening* globalization* glorious* gloss-over* glossy* glycosylate \
  go-back* go-down* go-off* go-on* go-out* go-over* \
  go-through* gobble-up* going* golfing* gone* google \
  goosestep gossiping* governance* grabbing* gracious* grade-point-average* grading* \
  graduation* grafting* granulation* graying* greeting* grey* greying* grievance* grind-up* \
  grinding* groaning* grooming* grooving* groundbreaking grounded* grouping* grow-up* growing* \
  growing-up* grown* guarding* guidance* gulp-down* gum-up* \
  gun-down* gutting* hack-away* hacking* hacking-away* had-better* hail-down* half-life* hallucination* \
  ham-up* hammed* hammer-away* hammer-out* hammered* hammering* \
  hand-delivery* hand-out* hand-over* handcount* handdeliver* handdelivery* handling* handover* \
  handpaint* hang-on* hang-out* hang-up* hanging* hanging-on* \
  hanging-up* hankering* happening* happiness* happy harassment* hard* \
  hard-put* hardening* harder* harmful* harming* harsh* \
  hash-out* hassle hassly* hateful* haul-in* haul-out* \
  have-a-point* have-accompanier* have-age* have-an-eye* have-an-eye-on* have-beneficiary* \
  have-cause* have-comparison* have-cost* have-degree* have-degree-of-resemblance* \
  have-destination* have-downtoner* have-duration* have-eye* have-eye-on* have-example* have-extent* have-fun* \
  have-got-eye* have-half-life* have-hand* have-hands* have-in-hand* have-in-mind* \
  have-intensifier* have-li* have-list-item* have-location* have-look* have-mind* have-organization-role* \
  have-organizational-role* have-percentage-lethal-dose* \
  have-percentage-maximal-effective-concentration* have-percentage-maximal-effective-dose* \
  have-percentage-maximal-inhibitory-concentration* have-point-of-view* \
  have-policy* have-polite* have-politeness* have-property* have-relation-role* \
  have-relational-role* have-relevance* have-role* have-sex* have-source* \
  have-talking-point* have-time* have-to* \
  have-to-do* have-to-do-with* have-topic* have-viewpoint* hazardous* head-off* head-up* \
  healed* healing* hearing* heat-up* heated* heating* height* heightening* help-out* \
  helpful* hem-in* hemorrhagic* hemorrhaging* hesitant* hesitation* \
  heterodimerization* heterodimerize hide-out* hiding* high* higher* highfive* highlighting* hiking* \
  hiring* hissing* hit-on* hit-up* hitting* hoax hoaxing* hobnob-around* \
  hold-back* hold-off* hold-on* hold-out* hold-over* hold-up* holding* \
  holding-back* holding-off* holding-on* holding-out* holding-up* hole-up* hollow-out* home-schooling* homeschool* \
  homeschooling* homodimerization* homodimerize honest honesty* honorable* honored* hook-up* \
  hopeful* hopping* horriffic* hospitalization* hospitalized* hosting* hot* housing* hum-along* humid* humidification* \
  humiliated* humiliation* hungry* hunting* hurl-abuse* hurting* hybridization* hydrated* hydration* \
  hydrolysis* hydrolyzation* hype-up* hyperacetylate* hyperacetylation* hypermethylate hypermethylation* \
  hyperphosphorylate hyperphosphorylation* hyperproliferate hyperproliferation* \
  hypertrophic* hyperventilating* hyperventilation* hypophosphorylate* hypophosphorylation* hypothetical* \
  ic* ic25* ic50* idc* idealisation* idealise* idealised* idealization* idealize* idealized* identification* idk* \
  ignorant* illegal* illness* illumination* illustration* imagination* imaging* imitation* \
  immersion* immigration* immobilization* immortal* immortalization* immortalize* immortalized* \
  immortalizing* immune* immunization* immunoblot immunodetect immunodetection* immunofluoresce immunofluorescence* immunoprecipitate* \
  immunoprecipitation* immunoreact* immunoreaction* immunoreactive* immunoreactivity* immunostain immunostaining* \
  impaction* impaired* impediment* implantation* implementation* implication* implode implosion* \
  importance* important* imposition* impoverished* impressed* impression* impressive* improved* \
  improvement* in-a-light* in-a-X-light* in-advance* in-aftermath* in-consequence* \
  in-hand* in-hands* in-light* in-line* \
  in-ones-hands* in-practice* in-step* in-touch* in-trouble* inauguration* incarceration* incision* incitement* \
  inclination* inclined* including* inclusion* inclusive* incorporation* \
  incrimination* incubation* incumbency* incumbent* indemnity* indication* indicative* \
  indictment* individualistic* individualization* individualize* individualized* \
  indoctrination* induction* indurated* induration* industrialization* inept* ineptitude* ineptness* infected* \
  infection* inference* infestation* infested* infight* infighting* infiltration* inflamed* inflammation* \
  inflammatory* inflation* inflection* inflexion* influential* informative* \
  informed* infringement* infusion* ingestion* ingrained* inhalation* inheritance* \
  inhibition* inhibitory* inhibitory-concentration* initiation* injection* injured* injury* innovation* innovative* inoculate inoculation* \
  inquiry* inscription* insertion* insistence* inspected* inspection* \
  inspiration* inspirational* inspired* inspiring* installation* installment* \
  instead* instead-of* institution* instruction* insulated* insulation* \
  insulting* integration* intelligence* intense* intensely* intensification* intention* \
  intentional* intentioned* interaction* interactive* interception* interdict \
  interdiction* interested* interesting* intermixed* intern internal* \
  internment* internship* interposition* interpretation* interpreting* interrogation* \
  interruption* intersection* interspersed* interspersing* intervention* intimidating* intimidation* \
  into-hands* intonation* intoxication* intrigued* intriguing* introduction* intrusion* invaginate \
  invagination* invasion* invasive* invention* inversion* investigation* investment* invitation* invited* involved* \
  involvement* iron-out* irradiation* irregardless* irrigation* irritable* irritation* isn't-he* isolated* isolation* isomerization* \
  isomerize issuance* itching* itchy* jack-up* jammed* \
  jealous jealousy* jeering* jet-off* jk* jogging* \
  join-in* join-up* joining* joining-up* joke-around* jot-down* \
  judgement* judgment* jump-in* jump-start* jump-up* jumping* jumpstart* just* \
  justification* justified* jut-out* juxtaposition* kayaking* \
  keep-an-eye* keep-an-eye-out* keep-eye* keep-eye-open* keep-eye-out* keep-eyes-peeled* \
  keep-in-mind* keep-on* keep-up* keeping* keeping-on* keeping-up* \
  keg-stand* kegstand* ketchup* key-in* kick-in* kick-off* kick-out* kicking* \
  kidding* kill-off* kill-two-birds-with-one-stone* killing* kind-of* kissing* \
  kiyi* kneading* knifing* knitting* knock-back* knock-down* knock-in* \
  knock-off* knock-out* knock-over* knock-up* knockin* knockout* \
  knowledge* knowledgeable* known* labeling* laceration* lactation* lactate* laid-back* \
  lam-out* landing* landscaping* lash-back* lash-out* latch-on* late* laughable* laughing* laundering* \
  lay-off* lay-on* laying* layoff* ld* ld50* lead-off* \
  lead-up* leadership* leaking* leaping* learning* leasing* leave-behind* \
  leave-off* leave-out* leave-over* left* left-of-center* left-wing* legal* legality* \
  legalization* legalizing* legislation* legitimate* lending* length* let-down* let-know* let-on* \
  let-out* let-up* lethal-dose* level-off* levitation* liberal* liberalization* liberation* licensing* \
  lichenification* lick-up* lie-down* lie-in* lifting* ligation* light-up* \
  lighten-up* likely liking* limber-up* limitation* limited* line-drawing* line-pocket* line-up* linedraw* linedrawing* lining* \
  link-up* liquidation* listening* listing* litigation* livable* live-down* live-on* live-out* live-up* \
  lived* liven* liven-up* living* living-down* living-on* living-out* \
  living-up* load-up* loading* loan-out* local* localization* \
  lock-down* lock-in* lock-out* lock-up* locked* locked-out* \
  locking* lodged* lodging* log-on* logroll* look-after* \
  look-down* look-forward* look-into* look-out* look-over* look-up* looking* looking-into* loosen-up* \
  loosening* looser* looting* lose-out* losing* loss* louse-up* \
  lowering* lying* lynch lynching* lyse lysis* lytic* \
  maceration* mad* magnifying* maimed* maintenance* make-an-effort* \
  make-believe* make-do* make-it* make-mind-up* make-off* make-out* make-over* make-sense* \
  make-up* make-up-mind* making* malfunction malignant* malnourish* malnourished* malnourishment* malnutrition* \
  management* mandatory* manifestation* manipulation* manning* \
  manufacturing* mapping* marginal* marginalization* mark-down* mark-up* \
  marked* marketing* marking* marriage* married* marveling* mass-production* \
  massproduce* massproduction* match-up* matching* maturation* maturity* maximization* may* \
  meaning* meaningful* means* measurement* measuring* meddling* median-effective-dose* median-lethal-dose* mediation* medication* meditation* \
  meet-up* meeting* mellow-out* memorization* meowing* merger* merging* \
  mess-up* messaging* messed-up* metabolism* metastatic* methinks* methylation* \
  mic-up* microinject microinjection* might* migration* militarization* \
  militarize minimal* mining* minor misappropriation* miscalculation* misconduct* \
  misguided* misinform misinformation* misinformed* misinterpretation* misjudgment* \
  misperceive misperception* misrepresentation* miss-out* missed* missing* \
  misunderstanding* misunderstood* mix-up* mixing* moaning* mobile* \
  mobilization* mobilizing* moderation* modern* modernization* modification* moist* \
  moisturization* molten* monitoring* monkey-around* mooch* moocher* mooching* mopping* moral* \
  moralizing* more-like* more-like-x-than-y* mortified* motivated* motivation* mourning* movement* \
  moving* muck-up* muddle-up* muddled* muffled* muffling* mug* mugging* multi-tasking* multitask* \
  multitasking* murdered* muscling* must* mutation* muted* mutilated* muttering* nail-down* name-dropping* namedropping* \
  naming* narrow-down* narrowed* narrowing* nationalization* natural* nauseated* navigation* neaten-up* necrotic* necrotizing* \
  needed* needling* neg* negation* negative* negativity* negotiation* net-out* networking* neutral* \
  nice nicer* nitrosylate nitrosylation* no-matter* nod-off* nomination* normal* \
  normalization* normalized* nose-diving* nosediving* nosy* not-x-but-y* notable* \
  noted* notification* notifying* nourished* nuke null* nursing* \
  obedience* obedient* obfuscation* objection* objectionable* obligation* \
  obliteration* observation* obsessed* obsession* obsessional* obstructed* obstructing* \
  obstruction* occlude occlusion* occupation* of-mind* offended* offense* offensive* offering* \
  oil-up* oiled-up* oily* ok* omission* on on-fire* on-mind* on-ones-mind* on-point* on-to* \
  ongoing* onto* oozing* open-fire* open-up* opening* opening-up* operating* \
  operation* opinion* opposed* opposition* oppression* optimization* optimized* ordered* \
  ordering* orderly* ordinance* org-role* organization* organized* orientation* \
  oriented* origin* ossification* ossified* out-trade* outbreak* outfitting* outing* \
  output* outraged* outrageous* outsourcing* ovation over* overdosing* overeat overeating* overexpress overexpressed* \
  over-with* overexpression* overjoyed* overlapping* overly* overpayment* overpriced* overreaction* overriding* oversleep \
  overwhelmed* overwhelming* own-up* owned* ownership* oxidation* oxygenate oxygenation* p-value* \
  pacing* pack-away* pack-up* packaging* packing* packing-up* paid* pained* painful* painting* pair-up* \
  pairing* palm-off* palmitoylate palmitoylation* palpitation* pan-out* pandering* parcel-out* \
  pare-down* paring* paring-down* parking* parrot parse participation* pass-away* pass-by* pass-off* \
  pass-on* pass-out* pass-over* pass-up* passage* passed* \
  passing* passing-on* patch-up* patronage* pay-down* pay-off* pay-out* pay-up* payment* payoff* \
  payoff-off* peel-off* pen-up* pending* penetration* pepperspray* perception* perceptive* \
  perfection* perforation* performance* perished* perjure perjury* \
  perk-up* permission* permissive* persecution* persistent* personal* persuasion* persuasive* pervasive* perversion* pervert \
  phase-in* phase-out* philandering* phosphorylation* photo* phrase pick-away* pick-off* pick-on* \
  pick-out* pick-up* picking* piercing* pile-on* pile-up* pin-down* \
  pine-away* pioneering* pipe-down* pipe-up* piss-off* pissed* \
  pissed-off* pissy* pitch-in* pitching* pitiful* pitting* pivoting* placement* planning* \
  planting* plating* play-down* play-off* play-on* play-out* \
  play-to* play-up* playing* plea* pleased* pleasing* \
  plot-out* plug-in* plug-up* plugging* point-of-view* point-out* poised* poisoning* poisonous* poke-around* \
  poking* polarization* policing* policy polish-off* polish-up* politicized* \
  pollution* polyploidisation* polyploidise* polyploidization* polyploidize pontificating* \
  poohpooh* poopoo* poo-poo* pooling* pop-off* pop-to-mind* pop-up* popping* population* \
  portrayal* posing* positioning* possession* possessive* \
  possible posting* postponement* posturing* potentiate potentiation* pound-out* pounding* \
  pouring* powerful* pre-emptive* pre-exist* pre-existing* pre-negotiaton* pre-separation* \
  precedence* precipitation* precondition* preconditioning* \
  prediction* predisposition* predominant* preemptive* preexist preexisting* \
  preferable* preference* preferential* pregnant* preincubate preincubation* \
  prenegotiate* prenegotiaton* prenylate* prenylation* preoccupation* preparation* prepared* \
  prepayment* prescription* presentable* presentation* presenting* \
  preseparate* preseparation* preservation* preserved* preset* press-gang* pressed* pressgang pressing* \
  presumption* presumptive* presumptuous* pretreat pretreatment* prevention* \
  price-out* prick-up* print-out* printing* private* privatization* proceeding* processing* \
  procession* procurement* producing* production* productive* profession* \
  profitable* profiteering* programme* programming* progression* progressive* prohibition* prohibitive* \
  projection* proliferation* prolongation* promising* promotion* pronate* pronation* pronounced* \
  prop-up* propagation* proposal* proposition* propulsion* prosecution* prospering* \
  prosperous* prostitution* protection* protective* proteolysis* proteolytic* \
  proteolytical* proteolyzation* proteolyze* protesting* protrusion* \
  proven* provocation* provocative* provoking* public* publication* publicized* \
  publishing* pucker-up* puckering* puff-up* puke-up* pull-down* \
  pull-off* pull-out* pull-over* pull-through* pull-up* pulling* \
  pulling-off* pulling-out* pulling-over* pulling-through* pulsation* pump-out* pump-up* \
  pumping* pumping-up* punching* punishable* punishment* pure* pursuit* push-up* \
  put-down* put-in* put-off* put-on* put-out* put-up* \
  puzzled* puzzling* qualification* qualified* quantification* quantitate quantitation* quarreling* \
  questionable* questioning* queue-up* quick* quicker* quiet-down* quieten-down* quotation* \
  racing* rack-up* racketeer* racketeering* radiation* raising* \
  rake-in* rambling* ramification* ramp-up* rampage ranking* \
  rant ranting* rare* ratchet-up* rate-entity* rather-than* rating* \
  ration-out* rational* rationalization* rationalize* rationing* rattle-off* \
  rattle-on* re-election* re-emergence* re-emphasis* re-employment* re-enactment* \
  re-evaluation* re-unification* reaching* reaction* reactionary* reactivation* reactive* \
  read-off* read-up* readiness* reading* reading-up* readmission* real* \
  realistic* realization* really* reapplication* reapproximation* rear-end* reasonable* reasoning* reassessment* reassuring* rebellion* \
  rebuttal* recase* receding* received* reception* recession* reciprocate \
  reciprocation* reciprocity* recirculation* recital* reckoning* recognition* recollection* \
  recommendation* reconciliation* reconstituted* reconstitution* reconstruction* recording* recovery* \
  recreation* recruiting* recruitment* recurrence* recyclable* recycling* red* reddish* \
  redebate* redemption* redistribution* reduced* reduction* reel-off* reelection* reemerge* reemergence* \
  reemphasis* reemphasize* reemploy* reemployment* reenactment* reengage* reenter* \
  reevaluation* reexamination* reexport* referral* referring* refight* refilling* refinement* refining* refix* \
  reflection* refocusing* reformation* refueling* regardless* regeneration* \
  registration* regression* regretful* regrow regrowth* regular* \
  regulated* regulation* regurgitation* rehabilitation* rehydration* reimplantation* \
  rein-in* reinforcement* reinjection* reinsurance* rejection* rejuvenation* rel-role* \
  relandscape* related* relation* relationship* relative* relatively* relaxation* \
  relaxing* releasing* relevance* reliant* relief* relieved* relieving* \
  relocation* reluctance* remain-to-be-seen* remaining* remarkable* remarriage* remarried* \
  remaster remastering* remediation* remembering* remembrance* remission* \
  remortgage removal* remuneration* rendering* rendition* renewal* renomination* renovation* \
  renown* renowned* rent-out* rental* renting* renting-out* reopening* reoperation* \
  reorganization* reorientation* repatriation* repayment* repetition* replaced* replacement* replication* replied* reporting* repositioning* \
  representation* representative* repression* reproducible* reproduction* reprogram* reprogramming* \
  request-confirmation* request-response* requirement* \
  resentful* reservation* reserved* reship* residence* resignation* \
  resistance* resistant* resolution* resolved* resonance* resonant* \
  resorb resorption* respectful* respiration* respiratory* responding* \
  response* responsibility* responsibleness* responsive* resting* restitution* restoration* restrained* \
  restraint* restriction* restructuring* resultant* resummon* resumption* resurrection* \
  resuscitation* retaliation* retardation* retarded* retention* retentive* retesting* rethinking* retired* \
  retirement* retracting* retraction* retraining* retrieval* reunification* reunify* reunion* rev-up* revelation* \
  reversal* reversion* revictimize* revision* revitalization* revival* revocation* revolution* revolutionary* rewarding* \
  ride-out* ride-up* ridiculous* rig-up* right-of-center* right-wing* rightsize* ring-up* ringing* \
  rioting* rip-off* rip-out* rip-up* ripe* ripening* rise-up* risky* roasting* \
  rock-on* role-reification* roll-back* roll-out* roll-up* rollback* \
  romanization* romanize* romantic* root-out* rooted* rotation* rough-in* rough-up* roughed-up* round-out* \
  round-up* rounded* rout* routing* rowing* rubber-stamp* rubberstamp* rubbery* rubbing* rule-out* ruling* \
  run-down* run-in* run-off* run-out* run-over* run-up* runaround* \
  running* running-off* running-out* running-up* rushed* sacking* sad* \
  safer* safest* sailing* sale* salivation* salt-away* \
  salutation* sampled* sampling* sanitation* satiation* satisfaction* satisfactory* satisfied* saturation* \
  save-up* saving* saving-up* saw-up* scaling* scalloping* scam scanning* \
  scape* scared* scaring* scarring* scary* scattering* \
  scheduling* schmoozing* schooling* sclerosing* sclerotic* scolding* scoop-up* \
  score-entity* score-on-scale* scoring* scout-out* scrapping* scratch-out* scratching* \
  scrawl-out* screen-out* screening* screw-over* screw-up* screwed* \
  screwed-up* screwup* scrub-up* scrunch-up* scrupulous* seal-off* searching* seasoned* seasoning* secondguess* \
  secretion* sectioning* sedated* sedation* seeding* seek-out* seeking* segregation* seize-up* seizure* selection* \
  self-destruction* selfadjust* selfadjustment* selfdestruct* selfdestruction* selfefface* selfestablish* \
  sell-off* sell-out* selling* send-out* sensation* sensible* \
  sensing* sensitization* sentencing* separated* separation* sequence sequencing* sequestering* serrate serration* \
  serve-up* serving* serving-up* set-ablaze* set-about* set-afire* set-down* set-fire* set-off* set-on-fire* set-out* \
  set-up* set-upon* setting* setting-up* settle-down* settlement* \
  sew-up* sex* sexy* shack-up* shading* shadowing* shake-off* shake-up* \
  shaking* shameful* shaming* shape-up* shaped* share-out* sharing* sharp* shaving* \
  shell-out* shine-through* ship-out* shipping* shocked* shocking* \
  shoot-back* shoot-down* shoot-off* shoot-up* shooting* shootout* shopping* shore-up* \
  shorten* shortening* shorter* shot* should* shout-down* \
  shout-out* show-off* show-up* showing* showing-off* shrug-off* shuffle-off* shunting* \
  shut-down* shut-off* shut-out* shut-up* shutdown* shuttle-off* shy-away* sick* sickening* \
  sideline* siege* sightseeing* sign-in* sign-off* sign-on* sign-up* significant* signing* \
  signing-in* signing-off* signing-on* signing-up* silt-up* simple* simulation* singing* single-out* sinkex* siphon-off* \
  sit-down* sit-in* sit-out* sit-up* sitting* size-up* skateboarding* \
  sketch-out* skiing* skim-off* skimming* skip-off* slack-off* slaying* sleep-away* \
  sleep-off* sleep-over* sleep-walk* sleeping* sleepy* slice-up* slim-down* slip-in* \
  slow-down* slower* slowing* slug-out* sluice-down* smarten-up* smarter* smash-up* smashing* smashing-up* smoking* \
  smooth-out* smooth-over* smuggling* snacking* snap-off* snap-up* \
  snatch-away* sneaky* sneezing* sniff-out* snoring* snowy* snuff-out* soak-up* sobbing* \
  sober-up* social* socialization* socializing* sock-away* soft* softening* \
  soiling* solicitation* solid* solution* solving* sorrowful* \
  sort-out* sound-off* sounding* sparing* speak-out* speak-up* speaking* special* specific* specification* \
  speculating* speculation* speech* speed-up* speeding* speedy* spell-out* spelling* \
  spend-down* spending* spent* spike-out* spill-out* spill-over* spin-off* \
  spinning* spinning-off* spinoff* spite* spitting* splash-out* splaying* splinting* \
  split-up* splitting* spotting* spout-off* spread-out* spreadeagle* spreading* spring-up* \
  spruce-up* spying* square-off* squeeze-out* squeezing* squinting* \
  stabbing* stabilization* stack-up* stagflation* staging* stagnation* staining* stake-out* stalking* stall-off* stall-out* \
  stamp-out* stance* stanced* stand-by* stand-down* stand-out* \
  stand-up* standard* stare-down* staring* start-in* start-off* start-out* \
  start-over* start-up* starting* startling* starvation* starving* \
  stash-away* statement* statistical-test stave-off* stay-on* stay-over* steal-away* \
  steeped* steer-clear* steering* stenotic* stenting* step-aside* \
  step-down* step-in* step-up* stereotype* stereotypic* sterile* \
  sterilization* stick-around* stick-out* stick-up* stiff* stiff-arm* stiffening* stiffing* stifling* stigmatizing* \
  stimulation* stinging* stipulation* stir-up* stock-up* stocking* stoked* \
  stop-by* stop-off* stop-over* stop-up* stopover* stoppage* stopped* \
  storage* store-up* straight* straight-out* straighten-out* straighten-up* straining* \
  stranded* stranding* strappped* strategizing* stratification* streaming* \
  street-address* strength* strengthening* stress-out* stressed* stressed-out* stressful* stressing* \
  stretch-out* stretching* strike-down* strike-out* strike-up* strip-away* \
  stripping* striving* strong* stronger* strongly* struggling* study-up* \
  studying* stunned* stunning* stupefied* subclone subdivision* subjective* \
  submission* submissive* subscription* subset* subsidence* subsidy* substitution* success* successful* \
  succession* suck-up* suffering* sufficient* suffocation* suggestion* \
  suggestive* suit-up* suited* sum-up* summon-forth* superset* supinate* supination* \
  supervision* supplementation* supportive* \
  supposed* suppression* sure* surgery* surgical* surprised* surprising* surrounding* survival* \
  suspension* suspicion* swallow-up* swallowing* swamped* swear-in* swear-into* \
  swear-off* swearing* swearing-in* sweat-off* sweat-out* sweating* \
  sweaty* sweep-up* sweeping* sweet* sweetness* swelling* swimming* switch-over* switching* swollen* \
  swoop-up* sympathetic* synchronization* synchronous* syndication* synergise* synergistic* synergize synergy* table tabled* \
  tabling* tabulation* tack-down* tack-on* tag-along* tag-question* \
  take-aback* take-advantage* take-away* take-down* take-hold* take-in* \
  take-into-account* take-issue* take-look* take-off* take-on* take-out* take-over* \
  take-precaution* take-up* take-with-grain-of-salt* \
  takeover* taking* taking-aback* taking-away* taking-down* taking-hold* taking-in* taking-off* taking-on* \
  taking-out* taking-over* taking-up* talk-out* talking* tally-up* tamp-down* tampering* \
  tangle-up* tanned* tanning* tape-up* taper-off* tapering* tapering-off* targeted* tariff* tasting* tattooing* \
  tax-away* taxation* teaching* team-up* tear-down* tear-up* tearing* tearing-down* \
  tearing-up* teary* tease-out* teasing* tee-off* teething* \
  tell-on* telling* temptation* tempted* tempting* tension* \
  termination* terribly* terrified* terrifying* terror* terrorisation* \
  terrorise* terrorism* terrorization* test-score* testimony* testing* \
  tetramerisation* tetramerise* tetramerization* tetramerize text texting* thankful* \
  thanks* thaw-out* the-more-the-less* the-more-the-more* the-x-er-the-y-er* \
  thick* thickened* thickening* thin-out* think-over* \
  think-through* think-up* thinking* thinner* thinning* thinning-out* thirsty* \
  thought* thrash-out* threat* threatening* thrilled* thrilling* throw-away* throw-in* \
  throw-out* throw-under-bus* throw-up* throwing* tick-off* tickling* tidy-up* \
  tie-down* tie-in* tie-up* tight* tighten-up* tightening* tighter* \
  tiling* timely* timing* tinged* tingling* tip-off* \
  tip-over* tiptoeing* tire-out* tired* titration* to-boot* to-the-point* toilsome* tolerance* \
  tolerant* tolerated* tone-down* top-off* top-up* torn* \
  toss-in* toss-out* tossing* tot-up* total-up* tote-up* totter-around* touch-base* \
  touch-off* touch-on* touch-up* touch-upon* touching* touching-base* touching-off* \
  touching-on* touching-up* touching-upon* touchy* tough* tougher* towing* tracing* track-down* tracking* \
  tracking-down* trade-off* tradeoff* trading* trail-off* training* \
  transaction* transactivate transactivation* transcription* transduce transduct* transduction* transfect* transfection* transformation* \
  transfusion* transient* translation* transliteration* transliterate* translocate translocation* \
  transmigrate transmigration* transmission* transphosphorylate transphosphorylation* transplantation* \
  transportation* transposition* trapped* trapping* trauma* traveling* travelled* \
  travelling* treating* treatment* trending* trial* tricky* trigger-off* triggering* strip-down* \
  trot-out* troubled* truly* try-out* trypsinisation* trypsinise* trypsinize* trypsinization* tubulate \
  tubulation* tuck-away* tuck-in* tune-in* tune-out* tunneling* \
  turn-away* turn-down* turn-in* turn-off* turn-on* turn-out* \
  turn-over* turn-up* turning* tutoring* twisted* type-up* \
  typical* typing* typing-up* ubiquitination* ulcerated* ulceration* \
  under-go* underestimation* underfund* underfunding* undermining* underpinning* understanding* understatement* \
  undertaking* undoing* unfreeze unfrozen* unification* union* unique* uniqueness* \
  united* unlocked* unpacked* unsettled* unsettling* unveiling* \
  upbringing* upregulation* uprising* ups upsetting* urbanization* urination* use-up* \
  used* used-to* useful* usher-in* using* utilitarian* utilization* utter* utterly* \
  vaccinate vaccination* vacuuming* validation* valuable* \
  valuation* vamping* variable* variance* variant* variation* \
  varied* vascularisation* vascularise* vascularization* vascularize ventilated* ventilation* verification* vexation* vibration* \
  viewing* vigilance* vigilant* vile* violation* visible* visiting* visualization* vocalization* voiding* voluntary* \
  vomit-up* vomiting* vote-down* voting* vulnerability* vulnerable* wait-out* waiting* waiting-out* waiving* \
  wake-up* waking-up* walking* wall-off* ward-off* warfare* warm-over* warm-up* warmer* \
  warming* warning* warranted* wash-down* wash-up* washing* washing-down* washing-up* wasted* wasteful* wasting* \
  watch-out* watch-over* watching* water-down* watery* waxing* weakening* \
  weaker* weaning* wear-down* wear-off* wear-on* wear-out* \
  weasel-out* wedding* weeping* weigh-in* welcomed* well* well-off* \
  well-up* wellbeing* westernised* westernization* wetting* whack-off* \
  wheezing* whether-or-not* while-away* whining* whip-out* whip-up* white* whiter* whittle-down* whiz-away* whooping* \
  whooshing* wide* widening* wider* widowed* width* will-you* \
  willing* win-over* wind-down* wind-up* wine wining* \
  winning* wipe-off* wipe-out* wipe-up* withdrawal* withholding* \
  without-regard* wolf-down* womanizing* wonderful* wording* work-out* \
  work-up* working* working-out* works* worried* worrisome* worrying* \
  worse* worse-off* worsen* worsening* worst* worth worthy* would-like* would-love* wound-up* \
  wounded* wrap-up* wrestling* wring-out* wringing* write-down* \
  write-in* write-off* write-out* write-up* writing* xray* \
  yammer-away* yammer-on* yapping* yawning* yellowing* yield-up* zero-in* zero-out* zip-up* zone-out* \
// END ONTONOTES UNIFIED FRAMES \
";

var list_of_on_frame_verb_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES VERB FRAMES \
  FedEx* UPS* abandon* abase abash abate abbreviate abdicate abduct abet \
  abhor abide abnegate abolish abominate* abort abound about-face* abrade abridge \
  abrogate absent absolve absorb abstain abstract abuse* abut accede accelerate accent \
  accentuate accept access accessorize acclaim accommodate accompany accomplish accord* account* \
  accredit accrete accrue accumulate accurse accuse accustom ace acetify acetylate ache \
  achieve acidify acknowledge acquaint acquiesce acquire acquit act* activate actualize* \
  actuate adapt add* addict* addle address* adhere adjoin adjourn adjudicate \
  adjust administer administrate admire* admit admix admonish adopt adore* adorn \
  advance* advert advise advocate affect* affiliate affirm affix afflict \
  afford* affront africanize age* agglomerate aggravate aggregate aggrieve agitate agonize \
  agree* ah aid ail aim air airlift airmail alarm alcoholize \
  alert alienate align alkalify allay allege alleviate alligator allocate allot \
  allow* allude allure ally alter alternate amalgamate amass amaze amble \
  ambush ameliorate amend americanize aminate amortize amount amplify amputate amuse analyze \
  anchor anesthetize anger angle anglicize anguish animalize animate annex annihilate \
  annotate announce annoy annul anoint answer* antagonize anticipate anticoagulate antique \
  apologize apostatize appall appeal* appear appease append applaud applique apply* \
  appoint* apportion appraise appreciate* apprehend* apprentice apprise approach* appropriate approve \
  approximate arbitrage* arbitrate* arch archive argue* arise* arm* armor aromatize \
  arouse arraign arrange array arrest arrive arrogate arson* art articulate ascend \
  ascertain ascribe ask* asphalt* asphyxiate aspirate* aspire* assail assassinate assault \
  assemble assert* assess assign assimilate assist associate assuage assume assure \
  astonish astound at-hand* at-hands* atomize atone atrophy attach attack attain attempt attend \
  attenuate attest attire attract attribute attune auction* audit audition augment \
  augur authenticate* author authorize autograph automate autopsy avail* avenge aver \
  average* avert avoid avulse await awake* awaken* award awe* baa \
  babble babysit back* backbite backfire backpack backpedal backslap backtrack badger \
  badmouth baffle bag bail* bait* bake balance* balk balkanize ball \
  balloon ballyhoo bamboozle ban band bandage* bandwagon* bandy* bang* banish bank* \
  bankroll bankrupt banquet banter baptize bar barb barbecue barbeque bare \
  bargain barge bark* barnstorm barrack barrel barricade barter base bash \
  bask baste* bat* bathe batter battle bawl bay bayonet be* \
  be-destined-for* be-from* be-located-at* be-on-hand* be-polite* be-temporally-at* \
  beach bead* bead-up* beam bear* beard beat* beatify beautify* beckon become* \
  bed* bedeck bedevil bedew beef* beep beetle befall befit befriend \
  befuddle beg beget begin begrudge beguile* behave behead behold behoove \
  belay belch* beleaguer belie believe belittle bellow belly* belly-flop* bellyflop* \
  belong belt* bemoan bench bend* benefit bequeath berate bereave berry \
  berth beseech beset besiege besmirch best* bestow bestrew bestride bet \
  betray betroth better* bewail beware bewilder bewitch bias bicker bicycle \
  bid* bide biff bifurcate bike bilk bill billet billow bin \
  bind* biopsy birch birdnest birth* bisect bitch bite bivouac blab \
  blabber black* blackberry blacken* blacklist blackmail blame blanch* blanket blare \
  blaspheme blast* blat blaze bleach bleat* bleed* blemish blend bless \
  blight blind blindfold blindside* blink blister* blitz bloat block* blockade blog \
  blood* bloody bloom blossom blot* blow* blubber bludgeon bluff blunder \
  blunt blur blurt* blush bluster board* boast boat bob bobsled \
  bode bog* boggle boil* bolshevize bolster bolt bomb bombard bond \
  bone* bonk boo boogie book* boom* boost boot* bootleg booze \
  bop border bore borrow boss* botch bother bottle* bottlefeed bottleneck \
  bottom* bounce* bound* bow* bowl* box* boycott brace bracket brag \
  braid brain brainwash braise brake branch* brand brandish brave brawl \
  bray brazen* breach bread break* break-ground* breakfast breakthrough* breast breastfeed breathe \
  breed brew bribe brick* bridge bridle brief brighten* brim bring* \
  bring-to-light* bristle broach broadcast broaden* brocade broil broker bronze brood brook \
  browbeat brown browse bruise brunch brush* brutalize* bubble buck buckle* \
  bud budge budget buff buffer buffet bug build* bulge bulk* \
  bull bulldoze bullet bullock bullshit bully bumble bump* bunch* bundle* \
  bungle bunk bunt buoy* burble burden burgeon burglarize* burglary* burgle* burl \
  burn* burnish burp burr burrow burst* bury bus bushwhack bust* \
  bustle butcher butler butt* butter button buttonhole buttress buy* buzz* \
  by-elect* bypass cab cabbage cable cackle caddy cadge cage cajole \
  cake calcify calculate calibrate calk* call* calm* calumniate calve camouflage \
  camp* campaign can* cancan cancel candy cane canoe canonize \
  canter canvass cap capacitate capitalize capitulate capsize captain caption captivate \
  capture caramelize caravan carbonify carbonize care* careen caress caricature carjack \
  carol carom carouse carp carpet carry* cart* carve* cascade case* \
  cash* cast* castigate castle castrate* catalog* catalogue catalyze catapult catch* \
  catechize categorize cater catheterize catholicize catnap caulk* cause* cause-trouble* cauterize caution* \
  cave* cavort caw cease cede celebrate cellar cement censor censure \
  center centralize certify chafe chaff chagrin chain chair chalk* challenge \
  champion* chance change* change-hand* change-hands* channel chant chaperone char characterize* charbroil charcoal \
  charge* chariot charm chart* charter chase chasten chastise chat chatter* \
  chauffeur cheapen* cheat* check* cheep cheer* cheerlead cherish chew* chicken* \
  chide chill* chime chink chip* chir chirp chirrup chisel chitchat \
  chitter chlorinate choke* chomp choose chop* choreograph chortle christen christianize \
  chrome chronicle chuck chuckle chug* chunk churn cinch* circle circularize \
  circulate circumcise circumscribe circumvent cite civilize clack* clad claim clam \
  clamber clamor clamp clang clank clap clarify* clash clasp class* \
  classify clatter claw clay clean* cleanse clear* cleave clench clerk \
  click climax climb clinch cling clink clip* cloak clobber clock \
  clog* cloister clomp clone close* clothe cloud* clout clown* cloy \
  club* cluck clump* clunk cluster clutch* clutter co-author* co-chair* co-exist* \
  co-found* co-opt* co-sponsor* coach coagulate coal coalesce coarsen coast coat \
  coauthor* coax cobble cock coddle code* codify coerce coevolution* coevolve* coexist* \
  cohabit cohere coil* coin coincide coldcream collaborate collapse collar collate \
  collect collide collude colonize color* comb combat combine combust come* \
  comfort* command commandeer commemorate commence commend* comment commercialize commingle commiserate \
  commission commit commit-arson* commodify communicate commute compact compare* compel compensate compete \
  compile complain complement complicate compliment comply compose compost compound \
  comprehend compress comprise compromise compute computerize con* concatenate conceal concede* \
  conceive concentrate concern* conciliate conclude concoct concrete* concur* condemn condense \
  condescend condition condone conducive* conduct* cone* cone-down* confabulate confederate confer confess confide \
  configure confine confirm confiscate conflict conform confound confront confuse conga \
  congeal congest congratulate congregate conjecture conjoin conjugate conjure* conk connect \
  connote conquer consecrate* consent* consequence* consequential* \
  conserve consider consign consist consistency* console consolidate \
  consort conspire constellate constitute* constitutionalize* constrain constrict constringe construct* construe \
  consult consume consummate contact contain contaminate contemplate contemporize contend content \
  contest contextualize continue contort contract* contradict contraindicate contrast contravene contribute \
  contrive control convene converge converse* convert convey convict* convince convoke \
  convolute convulse coo cook* cool* coop* cooperate coordinate cop cope \
  copy* copyright cordon core* cork corner corral correct correlate correspond \
  corroborate corrode corrugate corrupt cosh cosset cost costume couch cough* \
  counsel count* countenance counter counteract counterattack counterbalance \
  counterchallenge counterfeit countersue \
  countervail coup* couple course* court cover* covet cow cower cowrite cox \
  cozen crab crack* crackle cradle craft* cram cramp crane crank* \
  crash* crate crave crawl crayon craze* creak cream crease create \
  credential credit creep* cremate crepitate crest crew criminalize* crimp crimson \
  cringe crinkle cripple crisp* crisscross criticize* critique croak crochet crook \
  croon crop* cross* cross-examine* cross-pollinate* crosspollinate* crouch crow crowd crown* \
  crucify cruise crumb* crumble crump crumple crunch crush cry* crystallize \
  cub cube cuckold cuckoo cuddle* cudgel cuff cull culminate cultivate \
  culture cum cup* curb curdle cure* curl* curry* curse curtail \
  curtain curtsey curve cushion customize cut* cycle dab dabble dally \
  dam damn damp* dampen* dance dandle dangle dapple dare \
  darken* darn dart* dash* date daub daunt dawdle dawn daze \
  dazzle de-nuclearize* deaccent deacetylate deactivate deaden deadlock deafen* deal* debark debate* \
  debauch debone debowel debug debunk deburr debut decamp decant decapitate \
  decay decease deceive decelerate decentralize decide decimate decipher deck* declaim \
  declare declassify declaw decline decoct decode decommission decompose decompress* decontaminate \
  decorate decouple decrease decree decry dedicate deduce deduct deem deemphasize \
  deep-fry* deepen* deepfry deescalate deface defame defang defat default defeat \
  defeather defecate defect defend defer* defile define* deflate deflea deflect \
  deflesh deflower defoam defog deforest deform defraud defray defrost defuse \
  defuzz defy degas degenerate degerm deglaze degrade degrease degrit degum \
  degut dehair dehead dehorn dehull dehumidify dehusk dehydrate deice deify \
  deign deink deject delay delegate delete deliberate delight* delimit delineate \
  delint delist deliver* delouse delude deluge deluster delve demagnetize demagogue \
  demand demarcate demast demean demethylate demilitarize demobilize democratize demolish demonize demonstrate \
  demoralize demote demur demyelinate denationalize denigrate denominate denote denounce dent \
  denude deny depart depend dephosphorylate depict deplete deplore* deploy \
  depolymerisation* depolymerise* depolymerization* depolymerize* depopulate deport \
  depose* deposit* deprecate depreciate depress depressurize deprive derail derange derat \
  deregulate derib deride derind derive desalinate desalt descale descend describe \
  descry desecrate desensitize desert deserve desex desiccate design designate desire* \
  desist despair* despise despoil desprout destabilize destarch destigmatize destine destress \
  destroy destruct detach detail detain detassel detect deter deteriorate determine* \
  detest* dethrone detonate detract detusk devalue devastate devein develop deviate \
  devise devolve devote devour dewater dewax deworm diagnose diagram dial \
  diaper dice dicker dictate die* differ differentiate diffract diffuse dig* \
  digest dignify dilate dilute dim dime diminish din* dine* ding \
  dip direct dirty disable disabuse disagree disallow disappear disappoint disapprove \
  disarm disassemble disassociate disavow disband disbelieve disburse discard discern discharge \
  discipline disclaim disclose discolor discombobulate discomfit discompose disconcert disconnect discontinue \
  discount discourage discourse discover discredit discriminate discuss disdain disembark disembowel \
  disenchant disencumber disenfranchise disengage disentangle disfigure disgorge disgrace disgruntle disguise \
  disgust dish* dishearten dishonor* dishonour* disillusion disincline disinherit disintegrate disinvite \
  dislike dislocate dislodge dismantle dismay dismember dismiss dismount disobey disorganize \
  disown disparage dispatch dispel dispense disperse dispirit displace display displease \
  dispose* dispossess disprove dispute disqualify disquiet disregard disrespect disrobe disrupt \
  dissatisfy dissect dissemble disseminate dissent dissimilate dissimulate dissipate dissociate dissolve \
  dissuade distance* distemper distend distil* distill distinguish distort distract distrain \
  distress distribute distribution-range distrust disturb dither dive diverge diversify divert divest \
  divide* divorce divulge divvy* dizzy do* do-long-jump* do-longjump* dock doctor document dodder \
  dodge doff dog dogsled dole* doll* dollarize domesticate dominate don \
  donate dong doodle doom dope* dope-up* dose dot double double-cross* double-wrap* \
  doublecross* doubt* douse dovetail down* downgrade downlink download downplay downregulate downsize \
  doze* draft drag* drain drape draw* draw-line* draw-line-in-sand* drawl dread* dream* dredge* \
  drench dress* dribble drift drill drink* drip drive* drizzle drone \
  drool droop drop* drown* drowse drug* drum* dry* drydock dub \
  duck duel dull* dumbfound dump* dunk dupe duplicate dust* dwarf \
  dwell dwindle dye dyke dysregulate earmark earn ease* eat* eavesdrop ebb \
  echo eclipse economize eddy edge* edify edit editorialize educate eek \
  efface* effect* effectuate effeminate effervesce effuse ejaculate eject elaborate elapse \
  elate elbow elect* electrify electrocute* electroplate elevate elicit eliminate elongate \
  elucidate elude emaciate email emanate emancipate emasculate embalm embargo embark \
  embarrass embattle embed embellish embezzle embitter emblazon embody embolden* emboss \
  embrace embrocate embroider embroil emcee emerge emigrate emit emote* empathize \
  emphasize emplace employ empower empty emulate emulsify enable enact enamel \
  encapsulate encase enchain enchant encircle enclose encode encompass encounter encourage \
  encroach encrust encrypt encumber end* endanger endear endeavor endorse endow \
  endure energize enervate enflame enforce engage* engender engineer engrave engross \
  engulf enhance enjoin enjoy enlarge enlighten enlist enliven* enquire enrage \
  enrapture enrich enroll ensconce enshrine enslave ensnare ensnarl ensue ensure* \
  entail entangle enter* entertain enthrall enthuse* entice entitle entomb entrance* \
  entrap entreat entrench entrust entwine enumerate enunciate envelop envisage envision \
  envy epitomize epoxy equal* equalize* equate equilibrate equip equivocate eradicate \
  erase erect erode err eruct erupt escalate escape eschew escort \
  espouse espy essay establish esteem estimate estrange etch eternalize etiolate \
  eulogize europeanize evacuate evade evaluate evaporate even* eventuate evict evidence \
  evince eviscerate evoke evolve exacerbate exact exaggerate exalt examine* exasperate \
  excavate exceed* excel* except excerpt exchange excise excite exclaim exclude* excommunicate \
  excoriate excruciate excuse execrate execute exemplify exempt exercise exert exhale \
  exhaust exhibit exhilarate exhort exhume exile exist exit exonerate exorcise \
  expand expect expectorate expedite expel expend experience experiment expiate expire \
  explain explicate* explode* exploit explore export expose expound express* expunge \
  expurgate extend* exterminate extinguish extirpate extol extort extract* extradite extrapolate \
  extricate extrude exude exult eye* eyeball fabricate face* facilitate factor \
  fade fail faint fake fall* falsify falter fame familiarize famish \
  fan fanaticize fancy fantasize* fare farm* fart* fascinate fashion* fasten \
  fate father fathom fatigue fatten* fault favor* fawn fax faze \
  fear feast feather feature federalize federate feed* feel* feign feint \
  felicitate fell feminize fence* fend* ferment ferret* ferry fertilize fess* \
  fester festoon fetch fetter feud fiddle fidget field fight* figure* \
  filch file* filibuster fill* fillet film filter finagle finalize finance* \
  find* fine* fine-tune* finesse finger* finish* fire* fireproof firm* fish \
  fissure fit* fix* fixate fizz fizzle flabbergast flag flagellate flail \
  flake* flame flank flap flare* flash* flatten* flatter flaunt flaw \
  flay fleck fledge flee* fleece flesh* flex* flick* flicker flight* \
  flinch fling flip* flip-flop* flirt flit float flock flog flood \
  floor flop floss flounce flounder flour flourish flout flow flower \
  fluctuate flunk fluoresce flush* fluster flutter flux* fly* foal foam \
  focalize focus fog* foil foist fold* foliate follow* foment fondle \
  fool* foot forage forbid force* ford forecast foreclose forego foreknow \
  foresee foreshadow forest forestall foretell forfeit forge forget forgive forgo \
  fork* form formalize formulate forsake fort* fortify forward fossilize foster \
  foul found founder fowl fox foxtrot fraction fracture fragment frame* \
  franchise fray freak* free* freeze* frequent freshen* fret frighten* frisk \
  fritter* frock frog-walk* frolic frost* frost-over* \
  frost-up* froth frown fructify frustrate fry* \
  fuck* fuddle fudge* fuel fulfill fumble fume function fund fundraise* \
  funnel furlough furnish furrow further fuse fuss fuzz gab gabble \
  gag* gain gall gallop galvanize* gamble gambol gape garage garb \
  garble garden garland garner garnish garrotte gas* gash gasify gasp \
  gate gather* gauge gawk gaze gear* gelatinize geminate generalize* generate \
  gentle genuflect germanize germinate gesticulate gesture get* ghost* gibber gibe \
  gift giggle gild gill gird give* give-hand* gladden* glamorize glance glare \
  glass* glaze* gleam glean glide glimmer glimpse glint glisten glitter \
  gloat globalize globetrot glom glorify glory gloss* glove glow glower \
  glue glut glutenize gnash gnaw go* go-to-trouble* goad gobble* goggle golf \
  gondola goof goose-step* gore gorge gossip gouge govern grab grace* \
  grade graduate graffiti graft grandstand grant granulate grapple grasp grass \
  grate gratify gravel gravitate gray graze grease green* greet grieve \
  grill grimace grin grind* grip gripe grit groan grok groom \
  groove grope gross* grouch ground group grouse grovel grow* growl \
  grudge grumble grunt guarantee guard guess guesstimate guffaw guide gull \
  gulp* gum* gun* gurgle gush gust gut gutter guzzle gyrate \
  hack* haggle hail* hallucinate halt halter halve ham* hammer* hamper \
  hamstring hand* hand-count* hand-deliver* hand-paint* handcuff handfeed handicap \
  handing-out* handing-over* handle handout* hands-on* hang* \
  hangar hanker happen* harangue harass harbor hardboil harden* harm* harmonize \
  harness harp harry harshen* harvest hash* hasten hat hatch hate \
  haul* haunt have* \
  have-concession* have-condition* have-frequency* have-hand-in* have-in-hands* have-in-pocket* \
  have-instrument* have-li* have-manner* have-meaning* have-mod* have-mode* have-name* \
  have-on-hand* have-ord* have-ordinality* have-org-role* \
  have-part* have-point* have-polarity* have-purpose* \
  have-quant* have-rel-role* have-subevent* have-trouble* \
  have-value* hawk hay hazard* head* headline headquarter* headquarters* heal \
  heap hear* heartbreak* heartbroken* hearten heat* heave* heckle hedge heed heel* heft \
  heighten* helicopter hellenize help* hem* hemorrhage henna herald herd hesitate \
  hew hew-line* hiccup hide* high-five* highjack* highlight hightail hijack hike hinder \
  hinge hint hire hiss hit* hitch hive hoard hobble hobnob* \
  hock hoe hoist hold* hole* holiday holler hollow* holster home-school* \
  homer hone honeycomb honeymoon honk honor* hoodwink hook* hoot hoover \
  hop hope* hopscotch horrify hose hospitalize host hound house hover \
  howl* huckster huddle hug hulk hull hum* humanize humble humidify* \
  humiliate humor hunch hunger hunker hunt hurl hurry hurt* hurtle \
  hush husk hustle hybridize hydrate hydrogenate \
  hydrolyze hype* hyperbolize hypercontrol hyperlink \
  hypertrophy hyperventilate hypnotize hypothesize* ice identify idle idolize ignite ignore* \
  illuminate illumine illustrate image imagine imbed imbibe imbue imitate immerse \
  immigrate immobilize immolate immunize* impact* impair impale impart impeach impede \
  impel impend imperil impersonate impinge implant implement implicate implore imply \
  import importune impose impound impoverish imprecate impregnate impress* imprint imprison \
  improve improvise impugn in-a-light*n-consequence* in-ones-pocket* in-pocket* \
  inaugurate incandesce incapacitate incarcerate incense incentivize inch \
  incinerate incise incite incline* include incorporate increase incriminate incubate incur \
  indemnify indent index indicate indict indispose indoctrinate induce* induct* indulge \
  indurate industrialize infect infer infest infiltrate inflame inflate inflect inflict \
  influence inform infringe infuriate* infuse ingest ingrain ingratiate inhabit inhale \
  inherit inhibit* initial initiate inject injure ink* inlay innovate inquire \
  inscribe insert insinuate insist inspect inspire inspissate install instigate instill \
  institute* institutionalize* instruct insulate insult insure integrate intend* intensify* interact \
  intercede intercept interchange interconnect interest interfere interject interlace interlard interleave \
  interlink interlope intermarry intermingle intermix internalize* interpolate interpose interpret interrelate \
  interrogate interrupt intersect intersperse intertwine intervene interview interweave intimate intimidate \
  into-hand* intone intoxicate intrigue introduce intrude inundate inure invade invalidate inveigle \
  invent invert invest investigate invigorate invite invoice invoke involve* iodize \
  ionize irk iron* irradiate irrigate irritate* irrupt isolate issue \
  itch itemize iterate jab jabber jack* jade jail jam* jangle \
  japan japanize jar jeep jeer jell jeopardize jerk jest jet* \
  jettison jibe jig jiggle jilt jingle jinx jitterbug jive jockey \
  jog joggle join* joke* jollify jolt jostle jot* journey joust \
  judge jug juggle jumble jump* jump-gun* jump-on-bandwagon* jump-shark* junk junket justify* jut* juxtapose \
  kayak kayo keen keep* kennel key* ki-yi* kick* kid kidnap \
  kill* kindle kiss kitten knead knee kneel knell knife knight \
  knit* knock* knot know* kowtow kvetch label labor* lace lacerate \
  lack lacquer ladder lade ladle lag lam* lamb lambaste lament \
  laminate lampoon lance land landfill landscape lane languish lap lapse \
  lard lash* lasso last* latch* lather laud laugh* launch launch-a-coup* launder \
  lave lavish lay* leach lead* leaf leak lean leap* leapfrog \
  learn lease leash leave* leaven lecture leer legalize* legislate legitimize* \
  lend lengthen* lessen* let* letter level* leverage levitate levy liaise \
  libel liberalize* liberate license lichenify lick* lie* lift ligate light* \
  lighten* lightening* lightening-up* lighting* lighting-up* lightning lignify \
  like* liken* lilt limber* limit limp \
  line* line-draw* line-in-sand* linger link* lint lionize lipstick liquefy* liquidate liquidize liquify* \
  lisp list* listen litigate litter live* load* loaf loan* \
  loathe lob lobby lobotomize localize* locate lock* lodge* loft \
  log* log-roll* loiter loll lollop long* long-jump* longjump* look* lookit* loom loop loose* \
  loosen* loot lop lope lord lose* lounge lour louse* love \
  low* lower* lubricate lug lull lumber lump lunch luncheon lunge \
  lurch lure lurk lust luteinize luxuriate macerate machinate madden* magnetize \
  magnify mail maim mainstream maintain major make* make-fun* make-light* make-point* make-trouble* \
  malign* malinger* malingering* man manacle \
  manage* mandate maneuver mangle manhandle manicure manifest manipulate manoeuvre* mantle \
  manufacture map mar march marginalize* marinate mark* market marry marshal \
  martyr marvel mash mask masquerade mass mass-produce* massacre massage master \
  mastermind masticate match* mate materialize matter maturate* mature* maul maunder \
  maximize mean* meander measure* mechanize meddle mediate medicate meditate meet* \
  meld mellow* melt memorialize memorize menace mend mention mentor meow \
  merchandise merge merit mesh mesmerize mess* message metabolize metamorphose metastasize methylate \
  mew mic* microfilm microwave miff migrate militate milk mill mime \
  mimeograph mimic mince mind* minding* mine mineralize mingle miniaturize minimise* minimize* \
  minister mint mire mirror misapprehend misappropriate misbehave miscalculate mischaracterize misconstrue \
  misdiagnose misdirect misfire misguide mishandle misinterpret misjudge mislay mislead mismanage \
  misplace misquote misread misrepresent miss* mission* misspell \
  misspend misstate mist* mist-over* mist-up* mistake \
  mistime mistreat mistrust misunderstand misuse mitigate mix* mizzle moan mob \
  mobilize* mock model modem moderate* modernize* modify modulate moil moisten* \
  moisturize mold molder molest mollify molt monetize money monitor monkey* \
  monogram monopolize moo moon moonlight moor moot mop mope moped \
  moralize* morph mortgage mortify mosey mother motion motivate motor motorbike \
  motorcycle motorize mottle moult mound mount* mourn mouth move* mow \
  muck* muddle* muddy muffle mulch mulct mull multi-task* multiply mumble \
  mummify munch murder murmur muscle muse mushroom muster mutate mute \
  mutilate mutter muzzle myristoylate* myristoylation* mystify nab nag nail* name* name-drop* namedrop* \
  nap narrate narrow* nasal* nasalize* nationalize natter naturalize* nauseate navigate \
  near neaten* necessitate neck necrotize need* needle negate* neglect negotiate \
  neigh neighbor nest nestle net* netmail nettle network neutralize* never-mind* nevermind* nibble \
  nick nickel nickname niggle nip* nitrify nobble nod* nominate normalize* nose* \
  nose-dive* nosedive* nosh notch note* notice* notify nourish \
  nudge nullify* numb number nurse nurture nut nuzzle oar obey \
  obfuscate object* objectify obligate* oblige obliterate obscure observe obsess obstruct \
  obtain obviate occasion occult occupy occur offend* offer officiate offload \
  offset ogle oil* oink okay* omit on-hand* ooh ooze open* operate* \
  opine oppose oppress opt optimize orbit orchestrate ordain order* organize \
  orient originate ornament orphan oscillate osculate* ossify ostracize oust out* \
  out-of-hand* out-of-hands* out-of-pocket* out-of-touch* \
  outbid outdistance outdo outface outfit outflank outgrow outlast outlaw outline \
  outlive outlying outmatch outnumber outpace outperform outrace outrage* outrank outrun \
  outsell outshine outsmart outsource outstrip outweigh outwit overarch overawe overbake \
  overbid overburden overcast overcharge overcome overcook overdo overdose overdraw overemphasize \
  overestimate overflow overgrow overhang overhaul overhear overheat overindulge overjoy overlap \
  overlay overleap overload overlook overnight overpay overpower overprice overrate overreach \
  overreact override overrule overrun oversee* oversell overshadow oversight* oversimplify overspread \
  overstate overstay overstep overstimulate overstock overstrain overstress overtake overtax overthink* \
  overthrow overturn overuse overvalue overwhelm overwork owe own* oxidize oyster \
  pace* pacify pack* package pad paddle paddywhack padlock page pain \
  paint* pair* palaver pale* pall palm* palpitate pamper pan* pander \
  panel panhandle panic pant paper parachute parade paragraph parallel paralyze \
  paraphrase parboil parcel* parch pardon pare* park parlay parody parole \
  parquet parry part* partake participate partition partner party pass* paste \
  pasteurize pasture pat patch* patent patrol patronize patter pattern pauper \
  pause pave paw pawn pay* pay-mind* peacemake peak peal pearl peck \
  pedal peddle pederastize pee peek peel* peep peer peeve peg \
  pelt pen* penalize pencil pend penetrate people pepper perambulate perceive* \
  perch percolate perfect perforate perform* perfume perish perk* perm permeate \
  permit* perpetrate perpetuate perplex persecute persevere persist personalize* personify perspire \
  persuade* pertain perturb peruse pervade pester pet petition petrify phase* \
  philander philosophize phone phosphoresce phosphorylate photocopy photograph pick* picket pickle pickpocket \
  picnic picture piece pierce pigeonhole piggyback pile* pilfer pillory pilot \
  pin* pinch* pine* ping pinion pink* pinpoint pioneer pip pipe* \
  pique pirate pirouette piss* pit* pitch* pith pity* pivot placate \
  place plagiarize plague plait plan plane plank plant plaster plate \
  play* play-into-hands* play-into-ones-hands* plead please* pledge plink plod plonk plop plot* plough* \
  plow pluck plug* plumb* plummet plump plunder plunge plunk ply* \
  poach pocket* pockmark pod point* point-finger* pointless* pointlessness* \
  poise poison* poke* poke-fun* polarize police \
  polish* politicize polka poll pollinate pollute polymerization* polymerize* pomade ponder pontificate \
  poo pooh-pooh* pool pop* popularize* populate pore port portend portion \
  portray pose posit position possess* post* postage* poster postmark postpone postulate \
  posture pot potter pounce pound* pour pout powder power* practical* practically* practice* practicing* \
  practise* practising* praise prance prattle prawn pray pre-empt* pre-negotiate* pre-separate* pre-set* \
  preach prearrange precautionary* precaution* precautious* precede precipitate \
  preclude predate* predetermine predicate predict predispose \
  predominate preempt* preen prefer* preform prejudice premeditate premiere premise preoccupy \
  prepare prepay prepossess presage prescribe present* preserve preside press* pressure \
  pressurize prestate presume* pretend prevail prevent preview prey price* prick* \
  prickle pride prime primp print* prioritize privatize* privilege prize probe \
  proceed* process proclaim procrastinate procure prod produce* profess proffer profile \
  profit* profiteer program progress* prohibit* project proliferate prolong promenade promise \
  promote prompt* promulgate pronounce* proof* proofread prop* propagandize propagate propel \
  prophesy proportion propose proscribe prosecute proselytize prospect prosper prostitute prostrate \
  protect protest protract protrude prove* provide* provision* provoke prowl prune \
  pry publicize* publish* pucker* puff* puke* pull* pulp pulsate pulse \
  pulverize pummel pump* punch punctuate puncture punish* punt* pup purchase \
  purge purify* purl purloin purple purport purpose purr purse pursue \
  push* put* putrefy putter putty puzzle pyramid quack quadruple quaff \
  quake qualify quantify quantize quarantine quarrel quarry quarter* quash quaver \
  quell quench query quest question* queue* quibble quicken* quickstep quiet* \
  quieten* quip quirk quit quiver quiz quote rabbit race rack* \
  racket radiate radical* radicalization* radicalize* radio raft rafter rag rage raid rail railroad \
  rain raise* rake* rally ram ramble ramify* ramp* ranch range \
  rank rankle ransack ransom* rap rape rarefy* rasp rat ratchet* rate* \
  ratify ration* rattle* ravage rave ravish raze re-case* re-create* \
  re-debate* re-elect* re-emerge* re-emphasize* re-employ* re-enact* re-engage* re-enter* re-evaluate* re-export* \
  re-fight* re-fix* re-landscape* re-ship* re-summon* re-unify* re-victimize* reach* react* reactivate \
  read* read-between-lines* readapt readjust readmit ready reaffirm realign realize* reallocate ream \
  reanimate reap reappear reapply reapportion reappraise rear rearm rearrange reason* \
  reassemble reassert* reassess reassign reassure reawaken rebear rebel rebound rebuff \
  rebuild rebuke rebut recalculate recalibrate recall recant recap recapitulate recapture \
  recast recede* receive recess recharge recirculate recite reckon reclaim reclassify \
  recline recode recognize recoil recollect recombine recommence recommend recommit recompense \
  reconcile reconsider reconstitute reconstruct reconvene record recount recoup recover* recreate* \
  recruit rectify recuperate recur recuse recycle redden* redecorate redeem redefine \
  redeploy redesign redevelop redirect rediscover redistribute redline redo redouble redound \
  redraw redress reduce reek reel* reelect* reenact* reestablish reevaluate* reeve \
  reexamine refashion refer* referee reference* refile refill refinance refine refit \
  reflate reflect refocus reform reformulate refrain refresh refuel refund refurbish \
  refuse refute regain regale regard* regenerate register regress regret regroup \
  regularize* regulate regurgitate rehabilitate rehash rehearse reheat rehire reign reignite \
  reimagine reimburse reimplant reimpose rein* reincarnate reinforce reinscribe reinstall reinstate \
  reinsure reintegrate reintroduce reinvent reinvigorate reiterate reject rejoice rejoin rejuvenate \
  rekindle relapse relate* relax relay release relegate relent relieve relinquish \
  relish relive reload relocate reluctant* rely remain* remake remand remark* remarry \
  remedy remember remind reminisce remit* remodel remonstrate remove remunerate rename \
  rend render* rendezvous renege renegotiate renew renounce renovate rent* reoccur \
  reopen reorganize reorient repackage repaint repair repatriate repay repeal repeat \
  repel repent rephrase replace replant replay replenish replicate reply repopulate \
  report repose reposition repossess repost represent* repress reprimand reprint reproach \
  reprobate reprocess reproduce reprove repudiate repulse repute request* require requisition \
  reread reroute rerun* reschedule rescind rescue research reseat resell resemble \
  resent reserve* reset resettle reshape reshuffle reside resign* resile resist \
  resolve* resonate resort resound respect respire respond* rest restart restate \
  restore restrain restrict restructure resubmit result resume resupply resurface resurge \
  resurrect resuscitate retail retain* retake retaliate retard retch retest rethink \
  reticulate retie retire retool retort retrace retract retrain retreat* retrench \
  retrial retribute* retribution* retrieve retrofit retrograde retrogress retry return* reunite reup reuse \
  rev* revalue revamp reveal revel reverberate revere reverse revert review* \
  revile revise revisit revitalize revive revoke revolt* revolutionize* revolve* reward \
  rework rewrite rhapsodize rhyme rickshaw rid ridden riddle ride* ridicule* \
  riff riffle rifle rift* rifting* rig* right* right-size* rile rim rind ring* \
  rinse riot rip* ripen* ripple rise* risk* rissole rival rive \
  rivet roam roar roast rob robe rock* rocket roil roll* \
  romance* romanticize* romp roof roost root* rope rosin rot rotate \
  rouge rough* roughen* round* rouse roust route* rove row rub \
  rubberize* rue ruffle ruin rule* rumba rumble ruminate rummage rumor \
  rumple run* rupture rush rust rusticate rustle rut sabotage sack \
  sacrifice sadden* saddle safeguard sag sail salaam salivate salt* salute \
  salvage salve samba sample sanctify sanction sand sandpaper sandwich sanitize \
  sap saponify sashay satellite satiate satirize satisfy* saturate sauce saunter \
  saute save* savor savvy saw* say scald scale* scallop scalp \
  scamper scan scandalize scant scapegoat scar scare* scarf scarify scatter \
  scavenge scent* scent-out* schedule scheme schlep schmooze school scintillate sclerose scoff \
  scold scollop scoop* scoot scope scorch score* scorn scotch scour \
  scout* scowl scrabble scram scramble* scrap scrape* scratch* scrawk scrawl* \
  scream screech* screen* screw* scribble scrimp script scriptwrite scroll scrounge \
  scrub* scrunch* scruple scrutinize scud scuff scuffle sculpt sculpture scurry \
  scutter scuttle seal* sear search season seat secede seclude \
  second second-guess* secrete section secularize secure sedate seduce see* seed* seek* \
  seem seep seesaw seethe segment segregate seize* select self-adjust* self-adjustment* self-destruct* \
  self-efface* self-establish* sell* semaphore send* sense* sensitize sentence sentimentalize separate \
  sequester sequin serenade serve* service* set* settle* sever sew* shack* \
  shackle shade shadow shag shake* shamble shame shampoo shanghai shape* \
  share* shark sharpen* shatter shave shawl shear sheathe shed* shed-light* shell* \
  shellac shelter shelve shepherd shield shift shimmer shimmy shine* shingle \
  ship* shipwreck shirk shirr shit shiver shock shoe shoehorn shoo \
  shoot* shop shoplift shore* short* short-circuit* shortage* shortcircuit* shoulder shout* \
  shove shovel show* showcase shower shred shriek shrill shrimp shrink \
  shrivel shroud shrug* shuck shudder shuffle* shun shunt shut* shutter \
  shuttle* shy* sibilate sicken* side sidestep sidetrack sidle sift sigh \
  sight sightsee sign* signal* signify* silence silhouette silicify silkscreen silt* \
  silver simmer simper simplify* simulate sin sing singe single* single-minded* singleminded* sink* \
  sip siphon* sire sit* site situate size* sizzle skate skateboard \
  skedaddle sketch* skew skewer ski skid skim* skimp skin skindive \
  skip* skipper skirmish skirt skitter skulk skyrocket slack* slacken slake \
  slam slander slant slap slash slate slather slaughter slaver slay \
  sled sledge sleep* sleepwalk sleet sleigh slice* slide slim* slime \
  sling slink slip* slipcover slit slither sliver slobber slog slop \
  slope slosh slouch slow* slug* sluice* slumber slump slurp smack* \
  smart* smarten* smash* smatter smear smell smile smirk smite smoke* \
  smolder smooth* smoothen* smother smudge smuggle smut* snack snag snail \
  snake snap* snare snarl snatch* sneak* sneer sneeze snicker sniff* \
  sniffle snigger snip snipe snitch snivel snoop snooze snore snort \
  snow* snowball snub snuff* snuffle* snuggle soak* soap soar sob \
  sober* socialize* sock* sockdologize sod softboil soften* soil sojourn solace \
  solarize solder sole solemnize solicit solidify* solve somersault soothe sop* \
  sorrow sort* soulsearch sound* sour source souse sovietize sow space* \
  span spank spar spare spark sparkle spat spatter spawn speak* \
  spear spearhead specialize* specify* speckle speculate speed* spell* spellbind spend* \
  spew spice spike* spill* spin* spindle spiral spirit spiritualize spit \
  splash* splatter splay splice splint splinter split* splotch splutter spoil \
  sponge sponsor spook spool spoon-feed* spoonfeed* sport spot spotlight spout* \
  sprain sprawl spray spraypaint spread* spread-eagle* spring* spring-to-mind* sprinkle spritz sprout \
  spruce* spur spurn spurt sputter spy squabble squall* squander square* \
  squaredance squash squat squawk squeak squeal squeegee squeeze* squelch squint \
  squirm squirt squish stab stabilize* stable* stack* staff stage stage-a-coup* \
  stagger* stagnate stain stake* stalk stall* stammer stamp* stampede stanch \
  stand* standardize* staple star starch stare* start* startle starve stash* \
  state station stave* stay* steady steal* steam* steamroller steel steep* \
  steepen* steer* stem* stemmer stencil stenose stent step* sterilize* stew \
  stick* stiffen* stifle stigmatize still stimulate sting stink stipple* stipulate \
  stir* stitch stock* stockpile stoke* stomach stomp stone* stonewall stooge \
  stoop stop* stopper store* storm stow straddle strafe straggle straighten* \
  strain* strand strangle strangulate strap* strategize stratify stray streak stream* \
  streamline strengthen* stress* stretch* strew stride stridulate strike* string strip* \
  strive stroke stroll strop structure struggle strut stub stucco stud \
  study* stuff stultify stumble stump stun stunt stupefy stutter style \
  stymie subcontract subdivide subduct* subduction* subdue subject* subjugate sublet sublimate submerge submit \
  subordinate suborn subpoena subscribe subside subsidize subsist substantiate substitute subsume \
  subtitle subtract subvert succeed* succor succumb suck* suckle suction* sue* \
  suffer suffice suffocate suffuse sugar sugarcoat suggest suit* sulfurize sully \
  sulphur sum* summarize summer summon* sunbathe sunburn sunder sup super \
  superimpose supersede supervene supervise supplant supplement supplicate supply support suppose \
  suppress suppurate surf surface surfeit surge surmise surmount surpass surprise \
  surrender surround surveil survey survive suspect suspend* suspicious* suspiciousness* sustain* swab swaddle \
  swag swagger swallow* swamp swap swarm swash swat swathe sway \
  swear* sweat* sweep* sweeten* swell swelter swerve swig swill swim \
  swindle swing* swipe swirl swish switch* swivel swoon swoop* swoosh \
  symbolize sympathize synchronize* syncopate syndicate synthesize systematize taboo tabulate tack* \
  tackle tag* tail tailgate tailor taint taiwanize take* take-the-trouble* talc talk* talking-point* \
  tally* tame tamp* tamper tan tangle* tango tank tantalize tap* \
  tapdance tape* taper* tar target tarmac tarnish tarry task tassel \
  taste tattoo taunt tauten tax* taxi teach team* tear* tease* \
  tee* teem teeter teethe telecast telegraph telephone televise telework telex \
  tell* temper tempt tend tender tense term terminate terrify terrorize* \
  test testify tether thank* thatch thaw* theorize thicken* thieve thin* \
  think* thirst thrash* thread threaten thrill thrive throb throng throttle \
  throw* thrum* thrust thud thumb thumbtack thump thunder thunk thwack \
  thwap thwart tick* ticket tickle tidy* tie* tighten* tile till \
  tilt time* tin tincture ting tinge tingle tinker tinkle tinsel \
  tint tip* tipple tiptoe tire* tisk tithe titillate title titrate titter \
  toast toboggan toddle toe toe-line* tog toggle toil* tolerate toll tomb \
  tone* tool* tool-up* toot tootle top* topple torch torment torpedo torture \
  toss* total* tote* totter* touch* toughen* tour tousle tout \
  tow towel tower toy trace track* trade* trademark traduce traffic trail* \
  train traipse tram trammel tramp trample tranquilize transact transcend transcribe \
  transfer transfix transform transfuse transgress transit* transition translate transmit transmogrify \
  transmute transpire transplant transport transpose trap trash traumatize travel traverse \
  trawl tread treasure treat* treble tree trek tremble trend trespass \
  trick* trickle trigger* trill strip* trip* triple triumph trivialize troll \
  trolley troop trot* trouble* trounce truck trudge trump trumpet truncate \
  truncheon trundle truss trust* try* tuck* tug* tumble tune* tunnel \
  turf turn* tussle tutor twang* tweak tweet tweeze twiddle twig \
  twin twine twinge twinkle twirl twist* twitch twitter twotime type* \
  typify* tyrannize ubiquitinate ulcerate ululate umpire unblock unbolt unbuckle unburden unbutton \
  uncap unchain unclamp unclasp unclip unclothe uncoil uncover underbid undercharge \
  undercut underestimate undergo* underinflate underlay underlie underline undermine underperform underpin \
  underprice underscore undersell understand understate understudy undertake underuse underutilize undervalue \
  underwrite undo undress undulate unearth unfasten unfix unfold unfurl unglue \
  unhinge unhitch unhook uniform unify unionize* unite unlace unlatch unleash \
  unload unlock unmask unnerve unpack unpeg unpin unplug unquote unravel \
  unreel unroll unscrew unseal unseat unsettle unshackle unstaple unstitch \
  unteach unthaw untie unveil unwind unzip up* upbraid update upgrade \
  uphold upholster uplift upload upregulate uproot upset urbanize urge urinate use* \
  usher* usurp utilize* vacate vacation vacillate vacuum valet validate* \
  value* vamp* vamp-up* vandalize vanish vanquish vaporize varnish vary* vaticinate vault \
  vaunt veer vegetate veil vein vend veneer venerate vent ventilate \
  venture verbalize verge verify verse vest vet veto vex vibrate \
  victimize videotape vie view* viewpoint* vilify* vindicate violate visit visualize vitiate \
  vitrify vocalize vociferate voice void* volatilize volley volunteer* vomit* vote* \
  vouch vow voyage vroom vulcanize vulgarize wad waddle wade waffle \
  waft wag wage wager waggle wail wait* waive wake* waken* \
  walk* wall* wallop wallow wallpaper waltz wander wane wangle want \
  war warble ward* warehouse warm* warmonger warn warp warrant wash* \
  waste* watch* water* wave* waver wax* weaken* wean weaponize wear* \
  weary weasel* weather weave wed wedge weed weekend weep weigh* \
  weight welcome weld welter westernize* wet whack* whale whang \
  wharf* wheedle wheel wheeze whelk whelp whiff* while* whimper whine \
  whinny whip* whipsaw whir* whirr* whish whisk whisper whistle \
  whiten* whitewash* whittle* whiz* wholesale whoop* whoosh whore whump wick \
  widen* widow wield wiggle will wilt win* wince wind* wing \
  wink winkle winnow winter wipe* wire wireless wish withdraw wither \
  withhold withstand witness wobble wolf* womanize wonder* woo woof woolgather \
  word work* worm worry* worship wound wow wrack \
  wrangle wrap* wreak wreathe wreck wrench* wrest wrestle* wriggle wring* \
  wrinkle write* writhe wrong* wrought x-ray* yacht yak yammer* yank \
  yap yaw yawn yearn yell yellow* yelp yield* yip yodel \
  yoke yowl zag zap zero* zest zig zigzag zing zip* \
  zipcode zone* zoom \
// END ONTONOTES VERB FRAMES \
";

var list_of_on_frame_adjective_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES ADJECTIVE FRAMES \
  accountable* agreeable* alien allergic answerable* bent* brilliant capable characteristic* \
  clever close* competent confident consistent contrary curious eager earnest efficient* enthusiastic* \
  expert fit* fortunate free* friendly generous good* guilty handy hopeless \
  identical ill indifferent indispensable inferior innocent intelligent* intent* intimate keen \
  kind* lax liable loyal mean* nervous* new notorious \
  obvious opposite partial* patient* peculiar pleasant* polite popular* proficient prone \
  proud* quiet* relevant* responsible* right* righteous* rude safe* same sensitive* \
  serious short* shy* skillful slow* sorry suitable* superior terrible* true* \
  uneasy valid* weak* wrong* zealous \
// END ONTONOTES ADJECTIVE FRAMES \
";

var list_of_on_frame_noun_s = " \
// Note: * indicates more than 2 rolesets. \
// BEGIN ONTONOTES NOUN FRAMES \
  \
// END ONTONOTES NOUN FRAMES \
";

var list_of_concept_to_title_s = " \
        // BEGIN CONCEPT-TO-TITLE \
        3D No such concept. Replace by: (d / dimension :quant 3) \
        CEO No such concept. Replace by: (officer :mod chief :mod executive) \
        I No such concept. Replace by: i (lower case i for the pronoun for first person singular) \
        IED No such concept. Replace by: (device :ARG1-of improvise-01 :ARG1-of (explode-01 :ARG1-of possible-01)) \
        TV No such concept. Replace by: television \
        WMD No such concept. Replace by: (weapon :ARG2-of (destroy-01 :degree mass)) \
        a-ha No such concept. Replace by: aha \
        a-lot No such concept. Replace by: lot \
        academic No such concept. Replace by: academia \
        activity No such concept. Select a sense. \
        advertize-00 No such concept. Replace by: advertise-01 \
        after  :op1 (reference event or time)  :quant (how much after reference event or time)  :duration (duration of time) \
        again-and-again No such concept. Replace by: time-and-again \
        age-quantity No such concept. Replace by: temporal-quantity \
        ago No such concept. Replace by: (b / before :op1 (n / now) :quant (t / temporal-quantity ...)) \
        ah-well No such concept. Replace by: oh-well \
        airstrike No such concept. Replace by: (strike-01 :via air) \
        albeit No such concept. Use :concession \
        alien No such concept. Select a sense. \
        allright No such concept. Replace by: all-right \
        alright No such concept. Replace by: all-right \
        although No such concept. Use :concession \
        amr-annotation-incomplete  No such concept. Annotation of this sentence is incomplete. \
        amr-unintelligible  Even in context and best efforts, meaning can't be determined for part of a sentence. \
        and-so-on No such concept. Replace by: et-cetera \
        annual No such concept. Replace by: (r / rate-entity-91 ...) \
        annually No such concept. Replace by: (r / rate-entity-91 ...) \
        any-longer No such concept. Replace by: no-longer \
        arch-rival No such concept. Replace by: archrival \
        as-well-as No such concept. Replace by: and \
        at-once No such concept. Select a sense: at-once-01 (immediately) or at-once-02 (simultaneously) \
        bacteria No such concept. Replace by: bacterium (singular form) \
        bad No such concept. Select a sense. \
        bd No such concept. Replace by: (disc :mod blu-ray) \
        be-01 No such concept in AMR. Click for help. \
        be-compared-to-91 No such concept. Replace by: have-degree-91 or have-quant-91 \
        before  :op1 (reference event or time)  :quant (how long before reference event or time)  :duration (duration of time)  (ago = before :op1 now :quant temporal-quantity) \
        best No such concept. Replace by: good :ARG2-of have-degree-91 :ARG3 most \
        better No such concept. Replace by: good :ARG2-of have-degree-91 :ARG3 more \
        bi-partisan No such concept. Replace by: bipartisan \
        biannual No such concept. Replace by: (r / rate-entity-91 ...) \
        biannually No such concept. Replace by: (r / rate-entity-91 ...) \
        bimonthly No such concept. Replace by: (r / rate-entity-91 ...) \
        birth-01 No such concept. Replace by: bear-02 \
        biweekly No such concept. Replace by: (r / rate-entity-91 ...) \
        bla-bla No such concept. Replace by: blah-blah-blah \
        bla-bla-bla No such concept. Replace by: blah-blah-blah \
        black No such concept. Select a sense. \
        blackmail No such concept. Select a sense. \
        blah-blah No such concept. Replace by: blah-blah-blah \
        blow-job No such concept. Replace by: blow-03 \
        blowjob No such concept. Replace by: blow-03 \
        burka No such concept. Replace by: burqa \
        burkha No such concept. Replace by: burqa \
        but No such concept. Replace by contrast-01 or :concession \
        by-itself No such concept. Replace by: by-oneself \
        cd No such concept. Replace by: (disc :mod compact) \
        centre No such concept. Replace by: center \
        centrist No such concept. Replace by: center-02 or (person :mod center-02) \
        ceo No such concept. Replace by: (officer :mod chief :mod executive) \
        characteristic No such concept. Select a sense. \
        children No such concept. Replace by child \
        city  Examples: Miami, Berlin, Hong Kong, Washington, D.C. \
        city-region No such concept. Replace by: city-district \
        close No such concept. Select a sense. \
        co-efficient No such concept. Replace by: coefficient \
        colour No such concept. Replace by: color \
        communist No such concept. Replace by: communism or (person :mod communism) \
        consistent No such concept. Select a sense. \
        continent incl. Africa, America, Antarctica, Asia, Australia, Europe  North/Central/South America are world-region. \
        continent-region No such concept. Replace by: world-region \
        continental-region No such concept. Replace by: world-region \
        counter-productive No such concept. Replace by: counterproductive \
        country  Examples: Saudi Arabia, England, European Union,    Kosovo, Palestine, Soviet Union, Taiwan \
        country-region across two or more states/provinces  Examples: Midwest, Holland, Siberia, Transylvania  Regions inside a state are: local-region \
        daily No such concept. Replace by: (r / rate-entity-91 ...) \
        date-entity  :year 1776  :month 7  :day 4  :weekday (t/ thursday)  :time \"16:00\"  :dayperiod (a / afternoon)  :season (s / summer)  :era \"AD\" \
        date-quantity No such concept. Replace by: date-entity \
        demand No such concept. Select a sense. \
        demi-god No such concept. Replace by: demigod \
        despite No such concept. Use :concession \
        distance-entity No such concept. Replace by: distance-quantity \
        dozen No such concept. Replace by: 12 (have a dozen = 6) \
        dummy-element No such concept.  For temporary annotator support only. \
        dvd No such concept. Replace by: (disc :mod digital :mod versatile) \
        e-mail No such concept. Replace by: email \
        earlier No such concept. See AMR Dict for examples. \
        earthquake-00 No such concept. Replace by: earthquake \
        easy No such concept. Select a sense. \
        effective No such concept. Select a sense. \
        email-address-quantity No such concept. Replace by: email-address-entity \
        enthusiastic No such concept. Select a sense. \
        er No such concept. It's probably a speech disfluency that should be dropped from AMR. \
        etc No such concept. Replace by: et-cetera \
        except No such concept. Select a sense. \
        exclamation No such concept.  Drop or consider :mode expressive \
        exclamatory No such concept.  Drop or consider :mode expressive \
        fascist No such concept. Replace by: fascism or (person :mod fascism) \
        feet No such concept. Replace by foot \
        fibre No such concept. Replace by: fiber \
        fight No such concept. Select a sense. \
        figure-head No such concept. Replace by: figurehead \
        financial-quantity No such concept. Replace by: monetary-quantity \
        fit No such concept. Select a sense. \
        flea-bag No such concept. Replace by: fleabag \
        flu No such concept. Replace by: (disease :name (name :op1 \"influenza\")) \
        fly No such concept. Select a sense. \
        foreign-minister No such concept. Decompose. \
        free No such concept. Select a sense. \
        gay No such concept. Replace by: gay-01 or other sense \
        general-secretary No such concept. Replace by: (secretary :mod general) \
        generous No such concept. Select a sense. \
        good No such concept. Select a sense. \
        government No such concept.  Replace by: (government-organization :ARG0-of govern-01) \
        government-entity No such concept.  Replace by: government-organization \
        government-organisation No such concept. Replace by: government-organization (with a \"z\") \
        government-organization executive, legislative, judicial  Excludes military and international organizations (UN) \
        governor-elect No such concept. Decompose. \
        grass-root No such concept. Replace by: grass-roots \
        grassroot No such concept. Replace by: grass-roots \
        grassroots No such concept. Replace by: grass-roots \
        greater-than No such concept. Replace by: more-than \
        grey No such concept. Replace by: gray \
        guilty No such concept. Select a sense. \
        gummint No such concept. Probably a variation of 'government'. \
        happen-01 No such concept. Eliminate \"to take place/happen/occur\" \
        hard-headed No such concept. Replace by: hardheaded \
        headquarter No such concept. Replace by: headquarters-yy (common) or headquarter-01 (rare). \
        her No such concept. Replace by: she \
        herself No such concept. Replace by: she \
        hi-tech No such concept. Replace by: high-technology \
        high-off-the-hog No such concept. Replace by: high-on-the-hog \
        high-tech No such concept. Replace by: high-technology \
        him No such concept. Replace by: he \
        himself No such concept. Replace by: he \
        his No such concept. Replace by: he \
        hoo-haa No such concept. Replace by: hoo-ha \
        hot-link No such concept. Replace by: hotlink \
        hot-spot No such concept. Replace by: hotspot \
        how No such concept. Subsumed by :manner (and other roles), thing and/or amr-unknown \
        however No such concept. Replace by :concession or contrast-01. Click for help. \
        ied No such concept. Replace by: (device :ARG1-of improvise-01 :ARG1-of (explode-01 :ARG1-of possible-01)) \
        if No such concept. Use :condition or :conj-as-if \
        ill No such concept. Select a sense. \
        importance No such concept. Replace by: important-01 \
        important No such concept. Replace by: important-01 \
        in No such concept. Replace by: (a / after :op1 (n / now) :quant (t / temporal-quantity ...)) for cases such as 'in 20 minutes'. \
        inevitable No such concept. Replace by: (possible-01 :polarity - :ARG1 (avoid-01 :ARG1 ...)) \
        influenza No such concept. Replace by: (disease :name (name :op1 \"influenza\")) \
        intelligent No such concept. Select a sense. \
        invisible No such concept. Replace by: visible :polarity - \
        itself No such concept. Replace by: it \
        kill No such concept. Select a sense. \
        kilo No such concept. Replace by: kilogram etc. \
        kilometre No such concept. Replace by: kilometer \
        kind No such concept. Select a sense. \
        kinda No such concept. Replace by: kind-of \
        labour No such concept. Replace by: labor \
        later No such concept. See AMR Dict for examples. \
        launch No such concept. Select a sense. \
        lead No such concept. Select a sense. \
        left-wing No such concept. Replace by: left-19 or (person :ARG1-of left-19) \
        leftist No such concept. Replace by: left-19 or (person :ARG1-of left-19) \
        leftwing No such concept. Replace by: left-19 \
        leftwing-00 No such concept. Replace by: left-19 \
        leftwinger No such concept. Replace by: person :ARG1-of left-19 \
        legal No such concept. Replace by: law \
        length-quantity No such concept. Replace by: distance-quantity \
        less-and-less No such concept. Replace by: decrease-01. See AMR Dict. \
        libtard No such concept. Replace by: (person :ARG1-of liberal-02 :ARG1-of retard-01) \
        licence No such concept. Replace by: license (U.S. spelling for both noun and verb) \
        licit No such concept. Replace by: law \
        lie No such concept. Select a sense. \
        likeable No such concept. Replace by: likable \
        litre No such concept. Replace by: liter \
        lol No such concept. Replace by: :ARG2-of (laugh-01 :ARG0 i :manner loud) \
        low-tech No such concept. Replace by: low-technology \
        math No such concept. Replace by: mathematics \
        maths No such concept. Replace by: mathematics \
        me No such concept. Replace by: i \
        mean No such concept. Select a sense. \
        men No such concept. Replace by man \
        metre No such concept. Replace by: meter \
        micro-organism No such concept. Replace by: microorganism \
        micron No such concept. Replace by: micrometer \
        mid-air No such concept. Replace by: midair \
        military  Examples: Royal Air Force, 101st Airborne Division \
        military-organization No such concept. Replace by: military \
        miss No such concept. Select a sense. \
        monetary-entity No such concept. Replace by: monetary-quantity \
        money-quantity No such concept. Replace by: monetary-quantity \
        monthly No such concept. Replace by: (r / rate-entity-91 ...) \
        more-and-more No such concept. Replace by: increase-01. See AMR Dict. \
        multi-nation No such concept. Replace by: multinational \
        my No such concept. Replace by: i \
        myself No such concept. Replace by: i \
        nazi No such concept. Replace by: nazism or (person :mod nazism) \
        necessary No such concept. Replace by: need-01 \
        neighbour No such concept. Replace by: neighbor \
        neo-conservative No such concept. Replace by: (person :mod neoconservative) or neoconservative \
        neo-nazi No such concept. Replace by: neo-nazism or (person :mod neo-nazism) \
        neocon No such concept. Replace by: (person :mod neoconservative) or neoconservative \
        neoconservatism No such concept. Replace by: neoconservative \
        nervous No such concept. Select a sense. \
        never No such concept. Replace by: :time ever :polarity - \
        nevertheless No such concept. Use :concession \
        new No such concept. Select a sense. \
        news-agency No such concept. Use publication \
        nice No such concept. Select a sense. \
        non-profit No such concept. Replace by: profit-01 :polarity - \
        nonetheless No such concept. Use :concession \
        nonprofit No such concept. Replace by: profit-01 :polarity - \
        not No such concept. Replace by: :polarity - (or in some tricky cases by: have-polarity-91 :ARG2 -) \
        nuclear No such concept. Replace by: nucleus \
        nucleic-acid includes DNA and RNA \
        number-quantity No such concept. Replace by: numerical-quantity \
        obligatory No such concept. Replace by: obligate-01 \
        occur-01 No such concept. Eliminate \"to take place/happen/occur\" \
        off-spring No such concept. Replace by: offspring \
        oh-oh No such concept. Replace by: uh-oh \
        on-line No such concept. Replace by: online \
        on-one-hand No such concept. Replace by: contrast-01 \
        on-other-hand No such concept. Replace by: contrast-01 \
        on-the-one-hand No such concept. Replace by: contrast-01 \
        on-the-other-hand No such concept. Replace by: contrast-01 \
        opinion No such concept. Verbalize using opine-01 \
        or-so No such concept. Replace by: (about :op1 ...) \
        ordinal-entity  :value 2  :range (t / temporal-quantity :quant 16 :unit (y / year))  Example for: \"second\" visit \"in 16 years\" \
        organisation No such concept. Replace by: organization (with a \"z\") \
        organization  includes international organizations (United Nations)  includes NGOs (American Red Cross) \
        otherwise No such concept. See AMR Dict for examples. \
        our No such concept. Replace by: we \
        ourselves No such concept. Replace by: we \
        out-right No such concept. Replace by: outright \
        over-night No such concept. Replace by: overnight \
        pair-wise No such concept. Replace by: pairwise \
        partial No such concept. Select a sense. \
        patient No such concept. Select a sense. \
        people (only in the sense of a racial or national group)  Example: The Kurds are a people without a country.  Example: the peoples of Europe  Otherwise, replace by: person \
        percentage-entity :value 100 \
        percentage-interval No such concept. Replace by: between \
        percentage-quantity No such concept. Replace by: percentage-entity \
        petro-chemical No such concept. Replace by: petrochemical \
        play No such concept. Select a sense. \
        poor-00 No such concept. Replace by: poor \
        possible  :domain ... \
        pre No such concept. Replace by: before \
        pre-empt No such concept. Replace by: preempt-01 or pre-empt-01 \
        pre-emptive No such concept. Replace by: preempt-01 \
        president-elect No such concept. Decompose. \
        prime-minister No such concept. Replace by: minister :mod prime \
        programme No such concept. Replace by: program \
        proliferate No such concept. Select a sense. \
        prostitute No such concept. Select a sense. \
        province  incl. Japanese prefectures  incl. French departments such as Seine Maritime  incl. Chinese autonommous regions such as Tibet \
        publication    incl. new media such as blogs, YouTube videos    incl. news agencies such as Xinhua News Agency  use type 'publication' for publishing companies    if there is at least some sense of publication \
        quarterly No such concept. Replace by: (r / rate-entity-91 ...) \
        quiet No such concept. Select a sense. \
        railway-line  Examples: Trans-Siberian Railway, Picadilly line, Orient Express \
        rain No such concept. Select a sense. \
        ratio-entity No such concept. \
        real No such concept. Replace by: :degree really or :ARG-01 real-04 etc. \
        relative No such concept. Select a sense. \
        relative-location No such concept. Replace by: relative-position \
        relative-position (e.g. 20km east of Rome)  :op1 location  :direction direction  :quant distance-quantity \
        respective No such concept. See AMR Dict for examples. \
        respectively No such concept. See AMR Dict for examples. \
        rich-00 No such concept. Replace by: rich \
        riffraff No such concept. Replace by: riff-raff \
        right No such concept. Select a sense. \
        right-wing No such concept. Replace by: right-08 \
        rightwing No such concept. Replace by: right-08 \
        rightwing-00 No such concept. Replace by: right-08 \
        rightwinger No such concept. Replace by: person :ARG1-of right-08 \
        same No such concept. Select a sense. \
        sci-fi No such concept. Replace by: science-fiction \
        score-quantity No such concept. Replace by: score-entity \
        screw No such concept. Select a sense. \
        secretary-general No such concept. Replace by: (secretary :mod general) \
        seismic-quantity  :quant 7.9  :scale (r / richter) \
        semiannual No such concept. Replace by: (r / rate-entity-91 ...) \
        semiannually No such concept. Replace by: (r / rate-entity-91 ...) \
        serious No such concept. Select a sense. \
        serve No such concept. Select a sense. \
        shoe-in No such concept. Replace by: shoo-in \
        short No such concept. Select a sense. \
        skin-head No such concept. Replace by: skinhead \
        slow No such concept. Select a sense. \
        so-forth No such concept. Replace by: et-cetera \
        so-on No such concept. Replace by: et-cetera \
        socialist No such concept. Replace by: socialism or (person :mod socialism) \
        sorry No such concept. Select a sense. \
        space-craft No such concept. Replace by: spacecraft \
        speaker No such concept. Replace by: (person :ARG0-of speak-01) or speaker-yy (for the position of 'speaker' in parliament etc.) \
        state (in a federal country)  Examples: California, Bavaria \
        state-region No such concept. Replace by: local-region \
        string-entity includes letters, words, phrases, symbols \
        super-power No such concept. Replace by: superpower \
        superior No such concept. Select a sense. \
        take-14 No such concept. Eliminate \"to take place/happen/occur\" \
        temporal-entity No such concept. Replace by: temporal-quantity \
        that-is-it-00 No such concept. For \"That's what it is,\", consider (have-mod-91 :ARG1 it :ARG2 that). \
        the No such concept. Drop articles. \
        their No such concept. Replace by: they \
        them No such concept. Replace by: they \
        themselves No such concept. Replace by: they \
        these No such concept. Replace by: this \
        those No such concept. Replace by: that \
        though No such concept. Use :concession \
        time-and-time-again No such concept. Replace by: time-and-again \
        time-entity No such concept. Replace by: date-entity \
        time-interval No such concept. Replace by: date-interval \
        time-quantity No such concept. Replace by: temporal-quantity \
        tiny-weeny No such concept. Replace by: teeny-weeny \
        to-all-intents-and-purposes No such concept. Replace by: for-all-intents-and-purposes \
        tongue-and-cheek No such concept. Replace by: tongue-in-cheek \
        tonne No such concept. Replace by: ton \
        too  in the sense of 'also', annotate as :mod too  in the sense of 'too much', annotate with have-degree-91 or have-quant-91 \
        true No such concept. Select a sense. \
        truth-value :polarity-of ... \
        tumorigenesis No such concept. Replace by: create-01 :ARG1 tumor \
        tumorigenic No such concept. Replace by: possible-01 :ARG1 (create-01 :ARG1 tumor) \
        tumour No such concept. Replace by: tumor \
        tut-tut-tut No such concept. Replace by: tut-tut \
        tv No such concept. Replace by: television \
        ultra-violet No such concept. Replace by: ultraviolet \
        undersecretary-general No such concept. Replace by: (undersecretary :mod general) \
        unfair No such concept. Replace by: fair :polarity - \
        unique No such concept. Replace by: unique-01 \
        url-entity :value http://www.isi.edu \
        url-quantity No such concept. Replace by: url-entity \
        us No such concept. Replace by: we \
        use No such concept. Select a sense. \
        vice-president No such concept. Replace by: president :mod vice \
        vicepresident No such concept. Replace by: president :mod vice \
        weak No such concept. Select a sense. \
        week-end No such concept. Replace by: weekend \
        weekly No such concept. Replace by: (r / rate-entity-91 ...) \
        weight-quantity No such concept. Replace by: mass-quantity \
        well-being No such concept. Replace by: well-09 \
        what No such concept. Subsumed by :ARGx and/or amr-unknown \
        what-not No such concept. Replace by: et-cetera \
        when No such concept. Subsumed by :time and/or amr-unknown \
        where No such concept. Subsumed by :location and/or amr-unknown \
        which No such concept. Subsumed by :ARGx (and other roles) and/or amr-unknown \
        white No such concept. Select a sense. \
        who No such concept. Subsumed by :ARGx and/or amr-unknown \
        whoop-t-do No such concept. Replace by: whoop-de-do \
        why No such concept. Subsumed by :cause/:purpose and/or amr-unknown \
        wmd No such concept. Replace by: (weapon :ARG2-of (destroy-01 :degree mass)) \
        women No such concept. Replace by woman \
        world-region includes regions across multiple countries.  Examples: Middle East, Balkans, North America \
        worse No such concept. Replace by: bad :ARG2-of have-degree-91 :ARG3 more \
        worst No such concept. Replace by: bad :ARG2-of have-degree-91 :ARG3 most \
        wrong No such concept. Select a sense. \
        y'all No such concept. Replace by: you-all \
        yearly No such concept. Replace by: (r / rate-entity-91 ...) \
        your No such concept. Replace by: you \
        yourself No such concept. Replace by: you \
        // END CONCEPT-TO-TITLE \
";

var list_of_concept_to_url_s = " \
        // BEGIN CONCEPT-TO-URL \
        albeit https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        although https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        amr-unintelligible https://www.isi.edu/~ulf/amr/lib/popup/amr-unintelligible.html \
        amr-unknown https://www.isi.edu/~ulf/amr/lib/popup/question.html \
        be-01 https://www.isi.edu/~ulf/amr/lib/popup/be.html \
        but https://www.isi.edu/~ulf/amr/lib/popup/contrast.html \
        date-entity https://www.isi.edu/~ulf/amr/lib/popup/date.html \
        despite https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        however https://www.isi.edu/~ulf/amr/lib/popup/concession.html#contrast \
        if https://www.isi.edu/~ulf/amr/lib/popup/condition.html \
        interrogative https://www.isi.edu/~ulf/amr/lib/popup/question.html \
        multi-sentence https://www.isi.edu/~ulf/amr/lib/popup/multi-sentence.html \
        nevertheless https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        nonetheless https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        though https://www.isi.edu/~ulf/amr/lib/popup/concession.html \
        // END CONCEPT-TO-URL \
";

var list_of_have_rel_role_91_roles = " \
// Note: to distinguish from have-org-role-91 roles. \
// BEGIN HAVE-REL-ROLE-91 ROLES \
  ancestor aunt baby boy boyfriend bro brother brother-in-law buddy \
  child client comrade cousin dad daddy daughter daughter-in-law descendant \
  enemy family father father-in-law friend \
  girl girlfriend godchild goddaughter godfather godmother godparent godson \
  grandchild granddaughter grandfather grandma grandmother grandpa grandparent grandson granny \
  housemate husband in-law kid landlady landlord \
  mate mom mommy mother mother-in-law mum nephew niece parent partner patient peer pop practitioner \
  relative roommate sibling significant-other sis sister sister-in-law son \
  son-in-law spouse stepbrother stepchild stepdaughter stepdaughter stepfather stepmother \
  stepsister stepson tenant therapist uncle wife \
// END HAVE-REL-ROLE-91 ROLES \
";

var list_of_standard_named_entities = " \
// BEGIN STANDARD-NAMED-ENTITIES \
  aircraft aircraft-type airport amino-acid amusement-park animal award \
  bay book bridge broadcast-program building \
  canal canyon car-make cell cell-line city city-district company conference constellation \
  continent country country-region county criminal-organization \
  desert disease dna-sequence earthquake enzyme ethnic-group \
  facility family festival food-dish forest game gene government-organization gulf \
  hotel incident island lake journal language law league local-region location \
  macro-molecular-complex magazine market military \
  molecular-physical-entity moon mountain museum music music-key \
  nationality natural-disaster natural-object newspaper ocean organism organization \
  palace park pathway peninsula person picture planet \
  political-party port protein protein-segment province product publication \
  railway-line regional-group religious-group research-institute river rna road \
  school sea ship show small-molecule spaceship sports-facility star state station strait \
  team territory theater thing treaty tunnel university \
  valley vehicle volcano war work-of-art world-region worship-place zoo \
// END STANDARD-NAMED-ENTITIES \
";


document.onselectionchange = function selectSpan() {
    selection = document.getSelection();
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
        "background-color: yellow;"
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

function conceptDropdown() {
    document.getElementById("concept_dropdown").classList.toggle("show");
    submit_concept();
}


function getSenses() {
    var token = selection.anchorNode.nodeValue;
    //TODO: make the javascript lemmatizer work
    if (token == 'wants' || token == 'desires') {
        document.getElementById("wantDropdown").classList.toggle("show");
    } else if (token == 'buy') {
        document.getElementById("buyDropdown").classList.toggle("show");
    } else if (token == 'charged') {
        document.getElementById("chargeDropdown").classList.toggle("show");
    } else if (token == 'intoxication') {
        document.getElementById("intoxicateDropdown").classList.toggle("show");
    } else if (token == 'resisting' || token == 'resist') {
        document.getElementById("resistDropdown").classList.toggle("show");
    } else if (token == 'arrest') {
        document.getElementById("arrestDropdown").classList.toggle("show");
    } else if (token == 'public') {
        document.getElementById("publicDropdown").classList.toggle("show");
    } else if (token == 'must') {
        document.getElementById("obligateDropdown").classList.toggle("show");
    } else {
        submit_mode('add');
    }

}

function neListDropdown() {
    if (document.getElementById('named_entities').innerText == 'named entities') {
        document.getElementById("entities_list").classList.toggle("show");
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

function submit_relation() {
    // current_relation = sel.options[sel.selectedIndex].text;
    current_relation = document.querySelector('#browser').value;
    if (current_relation) {
        submit_mode("add");
    }
    console.log("current_relation is: " + current_relation);
}

function submit_concept() {
    // current_concept = selection.anchorNode.nodeValue;
    current_concept = document.getElementById('selected_tokens').innerText;
    console.log("current_concept is: " + current_concept);
}

function submit_mode(mode) {
    current_mode = mode;
    console.log("current_mode is: " + current_mode);

}

function current_command(numbered_sense) {
    submit_template_action(numbered_sense);
}

function generate_penman() {
    console.log(current_mode);
    submit_template_action(current_mode, c = current_concept, r = current_relation)
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

//hide the clickable editting amr buttons like top, add...
function set_read_only_fields() {

    //  if ((s = document.getElementById('text-command')) != null) {
    // s.style.display = 'none';
    //  }
    if ((s = document.getElementById('text-command-text')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('read-only-text')) != null) {
        s.style.display = 'inline';
    }
    if ((s = document.getElementById('top-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('add-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('add-ne-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('replace-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('delete-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('move-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('undo-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('props-box')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('save-at-isi-form')) != null) {
        s.style.display = 'none';
    }
    if ((s = document.getElementById('load-direct-td')) != null) {
        s.style.display = 'none';
    }
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


function show_concept_mapping(concept) {
    // for inspection (testing and debugging)
    title = concept_to_title[concept] || '';
    url = concept_to_url[concept] || '';
    console.log('concept: ' + concept + ' title: ' + title + ' url: ' + url);
}

//unused function
function popUpRight(URL, width, height, id) {
    console.log("popUpRight is called");

    if (id == '') {
        var day = new Date();
        var id = day.getTime();
    }
    var x = screen.width - width - 13;
    var y = 0;
    eval("myWindow = window.open(URL, '" + id + "', 'toolbar=0,titlebar=0,scrollbars=1,location=0,status=0,menubar=0,resizable=1,width=" + width + ",height=" + height + "');");
    eval("myWindow.moveTo('" + x + "','" + y + "');");
    eval("if (window.focus) { myWindow.focus() };");
}

//unused function
function popup(url, title) {
    console.log("popup is called");

    var newWindow = window.open(url, title, 'height=600,width=700,resizable=1,scrollbars=1,toolbar=0,statusbar=0,menubar=0')
}

//unused function
function clear_undo_redo_box() {
    var s;
    if ((s = document.getElementById('undo-redo-box')) != null) {
        s.style.display = 'none';
    }
}

//unused function
/**
 * this function prints out the last command
 * @param action
 */
function record_as_last_action(action) {
    if ((a = document.getElementById('action')) != null) {
        a.innerHTML = action;
    }
}


//registered user functionality
function show_meetings() {
    /*
   var newWindow=window.open('https://www.isi.edu/~ulf/amr/lib/meetings.html','_MEETING');
   newWindow.focus();
   */
    show_page('meetings', 'MEETING');
}
//registered user functionality
function show_page(page_id, page_target) {
    console.log("show_page is called");
    var username = '';
    var logsid = '';
    if ((s = document.getElementById('load-username3')) != null) {
        username = s.value;
    }
    if ((s = document.getElementById('logsid-load3')) != null) {
        logsid = s.value;
    }
    var newWindow = window.open('', page_target);
    newWindow.focus();
    var tmp = newWindow.document;
    tmp.write('<html>\n  <head><title>display</title></head>\n');
    tmp.write('  <body style="background-color:#FFFFEE;" onload="document.getElementById(\'display-page\').submit();">\n');
    tmp.write('    <form name="display-page" id="display-page" enctype="multipart/form-data" action="https://www.isi.edu/cgi-bin/div3/mt/amr-editor/display-page.cgi" method="post">\n');
    tmp.write('      <input type="hidden" id="page-id" name="page-id" value="' + page_id + '">\n');
    tmp.write('      <input type="hidden" id="user"    name="user"    value="' + username + '">\n');
    tmp.write('      <input type="hidden" id="logsid"  name="logsid"  value="' + logsid + '">\n');
    tmp.write('    </form>\n');
    tmp.write('  </body>\n');
    tmp.write('</html>\n');
    tmp.close();
}

