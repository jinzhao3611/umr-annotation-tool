/**
 * https://github.com/takafumir/javascript-lemmatizer#1-download-and-unzip-javascript-lemmatizer-and-then-put-it-in-your-project
 * the path of original javascript-lemmatizer/js.js code needs to be changed
 * @param inputWord
 * @returns {*} lemma
 */
function getLemma(inputWord){
    var lemmatizer = new Lemmatizer();
    var lemma = lemmatizer.only_lemmas(inputWord);
    return lemma[0];
}

/** words2number ******************************************************/

var Small = {
    'zero': 0,
    'one': 1,
    'first':1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
    'eleven': 11,
    'twelve': 12,
    'thirteen': 13,
    'fourteen': 14,
    'fifteen': 15,
    'sixteen': 16,
    'seventeen': 17,
    'eighteen': 18,
    'nineteen': 19,
    'twenty': 20,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
    'sixty': 60,
    'seventy': 70,
    'eighty': 80,
    'ninety': 90
};
var Magnitude = {
    'thousand':     1000,
    'million':      1000000,
    'billion':      1000000000,
    'trillion':     1000000000000,
    'quadrillion':  1000000000000000,
    'quintillion':  1000000000000000000,
    'sextillion':   1000000000000000000000,
    'septillion':   1000000000000000000000000,
    'octillion':    1000000000000000000000000000,
    'nonillion':    1000000000000000000000000000000,
    'decillion':    1000000000000000000000000000000000,
};
var a, n, g ;
function text2num(s){
    a = s.toString().split(/[\s-]+/);
        n = 0;
    g = 0;
    let i;
    for (i=0; i<a.length; i++) {
        let w = a[i];
        var x = Small[w];
    if (x != null) {
        g = g + x;
    }
    else if (w === "hundred") {
        g = g * 100;
    }
    else {
        x = Magnitude[w];
        if (x != null) {
            n = n + g * x;
            g = 0;
        }
        else {
            // alert("Unknown number: "+ w);
            return s;
        }
    }
    }
    return n + g;
}
/** others ******************************************************/

/**
 * this function takes in an argument variable, returns the location of the variable
 * @param variable, such as "b"
 * @returns {*} for example, the root variable returns 1, first child of root returns 1.1
 */
function getLocs(variable) { // b
    let value = variables[variable];
    if (value === undefined) {
        return undefined;
    } else if (typeof value == 'string') {
        return value; //usually it should goes in here
    } else if (typeof value == 'number') {
        return value + '';
    } else if (typeof value == 'function') {
        // add_log('getLocs[' + variable + '] function -> undefined');
        return undefined;
    } else {
        let type = typeof value;
        console.log('getLocs[' + variable + '] is of unknown type ' + type);
        return undefined;
    }
}

/**
 * given loc of current variable, return the parent variable
 * @param loc
 * @returns {*}
 */
function getParentVariable(loc) {
    if (loc.match(/\.\d+$/)) {
        var parent_loc = loc.replace(/\.\d+$/, "");
        return umr[parent_loc + '.v'] || '';
    } else {
        return '';
    }
}

/**
 * only strip off the quotes at the beginning and the end of the string
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
// function validEntryConcept(concept) {
//     return concept.match(/^(?:[a-z]+(?:-[a-z]+)*(?:-\d+)?|(?:concept\.|\!):?[a-zA-Z0-9][-._a-zA-Z0-9']*|\*(?:OR)\*)$/);
// }
function validEntryConcept(concept) {
    return concept.match(/^(?:.+(?:-[a-z]+)*(?:-\d+)?|(?:concept\.|\!):?[a-zA-Z0-9][-._a-zA-Z0-9']*|\*(?:OR)\*)$/);
}

/**
 * remove concept. or !
 * @param entry_concept
 * @returns {*}
 */
function trimConcept(entry_concept) {
    return entry_concept.replace(/^(concept\.|!)/, "");
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

    s = s.replace(/&amp;/g, '&');
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/&#39;/g, '"');
    s = s.replace(/&#34;/g, '"');

    s = s.replace(/&lt;/g, '<');
    s = s.replace(/&gt;/g, '>');

    s = s.replace(/<\/?(a|span|div)\b[^<>]*>/g, "");
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

/**
 * only called in user_descr2locs
 * @param sloppyString
 * @param referenceString
 * @returns {*}
 */
function sloppy_match(sloppyString, referenceString) {
    return referenceString.match(new RegExp('^' + sloppyString));
}

/**
 * check if amr is currently empty
 * @returns {number}
 */
function amr_is_empty() {
    var n = umr['n'];
    for (var i = 1; i <= n; i++) {
        if (!umr[i + '.d']) {
            return 0;
        }
    }
    return 1;
}

/**
 * return the loc of the first occurence of a variable
 * @param variable
 * @returns {*}
 */
function primary_variable_loc(variable) {
    var var_locs = getLocs(variable);
    if (var_locs) {
        var loc_list = argSplit(var_locs);
        return loc_list[0];
    } else {
        return '';
    }
}


function action_on_enter(field, e, s_id) {
   var s;
   var keycode = -1;
   if (window.event) {
  keycode = window.event.keyCode;
   } else if (e) {
  keycode = e.which;
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
  show_roles();
   } else if (((s = document.getElementById(s_id)) != null)
       && s.value.match(/^(.*[^:]|)\?$/)
       && (field == 'show NE types')) {
  show_ne_types();
   }
}


/**
 * used to add space for indentation purpose
 * @param n the number of the space
 * @returns {string} n spaces
 */
function n_spaces(n) {
    let result = '';
    for (let i = 0; i < n; i++) {
        result += ' ';
    }
    return result;
}