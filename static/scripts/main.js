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
    applyAmrDivParams();
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
 * this is only called in dynamicOntoNotesPopup()
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

function dynamicOntoNotesPopup(concept, variable) {
    // concept = want-01 or buy, variable=w or b
    // console.log("dynamicOntoNotesPopup is called");
    // console.log('dynamicOntoNotesPopup ' + concept + ' ' + variable);
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


/**unclear ******************************************************/
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
 * when press enter, it equals to click on submit
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
            add_log('exec_command: ' + value + ' (top: ' + top + ')');
            reset_error();
            reset_guidance();
            reset_greeting();
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
                // cc == ["b", ":arg1", "car"]
                var key1 = cc[0]; //"b"
                var ne_concept;
                var cc2v;
                if ((key1 == 'top') || (key1 == 'bottom') || (key1 == 'new')) {
                    if ((cc.length >= 3) && (cc[1] == '*OR*') && validEntryConcept(cc[2])) {
                        addOr('top ' + value);
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
                                    add_error('Ill-formed command "' + key1 + ' <font color="red">' + arg + '</font>" &nbsp; Argument should be last_command concept.');
                                }
                            }
                        }
                        if (current_template != 'top') {
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
                    addOr(value);
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
                    if ((cc[0].match(/^[a-z]\d*$/)) && !getLocs(cc[0])) {
                        add_error('In <i>add</i> command, <font color="red">' + cc[0] + '</font> is not last_command defined variable.');
                    } else if (cc.length == 2) {
                        add_error('In <i>add</i> command, there must be at least 3 arguments.');
                    } else {
                        add_error('Unrecognized <i>add</i> command.');
                    }
                } else if (value.match(/^record /i)) { //TODO unclear what's it doing
                    record_value = value.replace(/^record\s*/, "");
                } else {
                    if (!value.match(/^(h|help)\b/i)) {
                        add_error('Unrecognized command: <font color="red">' + value + '</font>');
                    }
                    selectTemplate('help');
                    top = 0;
                }
            }

            if (top) {// the undo and redo up right corner
                record_value = record_value || value;
                // value: "b :arg1 car"
                last_command.innerHTML = record_value;
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

                    // if (undo_index == 1) {
                    //     enable_workset_save();
                    //     if ((s = document.getElementById('discard-and-next-button')) != null) {
                    //         s.style.color = '#990000';
                    //         if (next_special_action == 'close') {
                    //             s.value = 'Discard and close';
                    //             s.title = 'Close this window without saving any changes to this AMR';
                    //             s.setAttribute('onclick', 'self.close();');
                    //         } else {
                    //             s.value = 'Discard and load next';
                    //             s.title = 'Load next sentence without saving any changes to this AMR';
                    //         }
                    //     }
                    //     if ((s = document.getElementById('select-workset-snt-button')) != null) {
                    //         s.style.display = 'none';
                    //     }
                    // }
                }
            }
            command_input.value = '';
            // if (show_amr_obj['option-resize-command'])
            command_input.style.height = '1.4em';
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
    var date = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());
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

/** add ******************************************************/
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
 * generate a new amr head
 * @param concept "buy"
 * @returns {string} "b"
 */
function new_amr(concept) {
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

    if (v) {
        var alignInfo = document.getElementById('align');
        alignInfo.innerHTML = concept + ": " + amr[n + '.a'];
    }


    record_variable(v, n);
    record_concept(concept, n);
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
            && (arg_type != 'string') //I suspect this is the difference when arg is a concept or a string
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

        if (arg_variable) {
            var alignInfo = document.getElementById('align');
            alignInfo.innerHTML += htmlSpaceGuard('\n') + arg_concept + ": " + amr[new_loc + '.a'];
        }


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
            or_var = new_amr(key_or);
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

/**
 * TODO why is there top level dummy?
 */
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

/** unclear ******************************************************/
function renorm_ops(variable) {
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

function show_amr_new_line_p(loc) {
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
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this word" style="color:#0000FF;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (check_list['onvf.' + concept]
                    // && (! ((concept == 'name') && head_concept.match(/-ne$/i) && role.match(/^:op\d+$/i)))
                    && (!((concept == 'name') && role.match(/^:name$/i)))) {
                    // concept_m = '<a href="https://www.isi.edu/~ulf/amr/ontonotes-4.0-frames/' + concept + '-v.html" target="_BLANK" title="PropBank frame available">' + concept + '</a>';
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this verb" style="color:#0000FF;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                    // add_log('concept_m ' + htmlProtect(concept_m));
                } else if (check_list['onjf.' + concept]) {
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this adjective" style="color:#0000FF;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (check_list['onnf.' + concept]) {
                    concept_m = '<span title="Invoke PropBank frame file selection popup for this noun" style="color:#0000FF;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && (check_list['oncf.' + core_concept]
                    || check_list['onf.' + core_concept])) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this word';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && check_list['onvf.' + core_concept]) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this verb';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && check_list['onjf.' + core_concept]) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this adjective';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
                } else if (concept.match(/[-.]\d\d\d?$/) && check_list['onnf.' + core_concept]) {
                    if ((arg_descr = frame_arg_descr[concept]) == undefined) {
                        title = 'Invoke PropBank frames popup for this noun';
                    } else {
                        title = concept + '  ' + stringGuard(arg_descr);
                        title = title.replace(/  /g, "&xA;    ");
                    }
                    concept_m = '<span title="' + title + '" style="color:#007700;text-decoration:underline;" onclick="dynamicOntoNotesPopup(\'' + concept + '\', \'' + variable + '\');">' + concept + '</span>';
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


// functions below are about load and save and stuff, bring out the clear template
function check_amr() {
    console.log("check_amr is called");
    // add_log('check_amr');
    selectTemplate('clear');
    show_amr('show check'); //TODO unclear
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
function applyAmrDivParams() {
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
    if (value < 10) {
        return '0' + value;
    } else {
        return value;
    }
}

function pad3(value) {
    if (value < 10) {
        return '00' + value;
    } else if (value < 100) {
        return '0' + value;
    } else {
        return value;
    }
}

/**
 * @param format seems that it doens't need the param
 * @returns {string} "08/24/2020"
 */
function today(format) {
    var today = new Date();
    var day = today.getDate();
    var month = today.getMonth() + 1;
    var year = today.getFullYear();
    var date = pad2(month) + '\/' + pad2(day) + '\/' + year;
    // add_log('today is ' + date);
    return date;
}

function setToday() {
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
    // if selected tokens is a number or not
    let token = selection.anchorNode.nodeValue;
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
        fetch('/', {
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
            genLink.setAttribute("href", `javascript:submit_template_action('nothing', '${value.name}');`);
            genLink.setAttribute("title", value.desc);
            genDrop.appendChild(genLink);
        });
        genDrop.classList.toggle("show");
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


