
/**
 * consume content in one pair of parenthesis one time, return the remaining string
 * @param annotText
 * @param loc: how many siblings the current annotation root has(//todo: this could be wrong, should be the location of the node being processed now)
 * @param state
 * @param ht
 * @returns {*}
 */
function string2umr_recursive(annotText, loc, state, ht) {
    annotText = strip2(annotText);
    if (state === 'pre-open-parenthesis') {
        annotText = annotText.replace(/^[^(]*/, ""); // remove everything at the start point until the open parenthesis
        let pattern1 = `^\\(\\s*s[-_${allLanguageChars}0-9']*(\\s*\\/\\s*|\\s+)[${allLanguageChars}0-9][-_${allLanguageChars}0-9']*[\\s)]` // match something like (s1s / shadahast) or (s1s / shadahast with a newline at the end
        if (annotText.match(new RegExp(pattern1))) {
            annotText = annotText.replace(/^\(\s*/, ""); //remove left parenthesis
            let pattern2 = `^[${allLanguageChars}0-9][-_${allLanguageChars}0-9']*`
            let variableList = annotText.match(new RegExp(pattern2)); //match variable until the variable ends
            let pattern3 = `^[${allLanguageChars}0-9][-_${allLanguageChars}0-9']*\\s*`
            annotText = annotText.replace(new RegExp(pattern3), ""); //remove variable
            if (annotText.match(/^\//)) { // if annotText start with a forward slash /
                annotText = annotText.replace(/^\/\s*/, ""); //remove / and trailing space of /
            }
            let conceptList;
            let pattern4 = `^[:*]?[${allLanguageChars}0-9][-_${allLanguageChars}0-9']*[*]?`
            conceptList = annotText.match(new RegExp(pattern4)); //match the concept until the first concept ends
            annotText = annotText.replace(new RegExp(pattern4), ""); //remove the concept until the first concept ends

            let variable = variableList[0];
            let concept = conceptList[0];
            let new_variable;
            let new_concept;
            // THIS BLOCK ADD 1.c and RECORD CONCEPT
            let pattern5 = `^[${allLanguageChars}0-9][-_${allLanguageChars}0-9']*(?:-\\d+)?$`
            if (concept.match(new RegExp(pattern5)) //match something like quick-01
                || tolerate_special_concepts(concept)) { //todo
                umr[loc + '.c'] = concept;
                recordConcept(concept, loc);
                variable2concept[variable] = concept;
            } else { //todo
                new_concept = concept.toLowerCase();
                new_concept = new_concept.replace(/_/g, "-");
                new_concept = new_concept.replace(/-+/g, "-");
                new_concept = new_concept.replace(/-$/, "");
                if (new_concept.match(/^\d/)) {
                    new_concept = 'x-' + new_concept;
                }
                new_concept = new_concept.replace(/(\d)\D+$/, "$1");
                new_concept = new_concept.replace(/([a-z])(\d)/, "$1-$2");
                umr[loc + '.c'] = new_concept;
                recordConcept(new_concept, loc);
                variable2concept[variable] = new_concept;
            }
            // THIS BLOCK ADD 1.v AND RECORD VARIABLE
            if (getLocs(variable)) { // if variable already exists
                new_variable = newVar(concept);
                umr[loc + '.v'] = new_variable;
                recordVariable(new_variable, loc);
            } else if (variablesInUse[variable + '.conflict']) {
                umr[loc + '.v'] = variable;
                recordVariable(variable, loc);
            } else if (!variable.match(/^s\d*[a-z]\d*$/)) { // if variable doesn't match the shape of s1n1 (in the case of Chinese for example)
                new_variable = newVar(concept);
                umr[loc + '.v'] = new_variable;
                recordVariable(new_variable, loc);
            } else {
                umr[loc + '.v'] = variable;
                recordVariable(variable, loc);
            }
            umr[loc + '.s'] = '';
            umr[loc + '.n'] = 0;
            annotText = string2umr_recursive(annotText, loc, 'post-concept', ht);
            annotText = annotText.replace(/^[^)]*/, ""); // remove anything that is not ) at the start positions until ) appears
            annotText = annotText.replace(/^\)/, ""); // remove ) at the start position
        } else {
            if (umr[loc + '.r']) {
                var string_arg = 'MISSING-VALUE';
                umr[loc + '.s'] = string_arg;
                umr[loc + '.c'] = '';
                umr[loc + '.v'] = '';
                umr[loc + '.n'] = 0;
            } else {
                umr[loc + '.d'] = 1;
            }
            if (annotText.match(/^\(/)) { // )
                annotText = annotText.replace(/^\(/, ""); // )
                if (umr[loc + '.r']) {
                    annotText = string2umr_recursive(annotText, loc, 'post-concept', ht);
                } else {
                    annotText = string2umr_recursive(annotText, loc, 'pre-open-parenthesis', ht);
                }
            }
        }
    } else if (state === 'post-concept') {
        annotText = annotText.replace(/^[^:()]*/, ""); //remove anything that is not : ( ) until : ( ) appears
        let role_follows_p = annotText.match(/^:[a-z]/i);
        let open_para_follows_p = annotText.match(/^\(/);
        let role;
        if (role_follows_p || open_para_follows_p) {
            let n_children = umr[loc + '.n'];
            n_children++;
            umr[loc + '.n'] = n_children;
            let new_loc = loc + '.' + n_children;
            if (role_follows_p) {
                let roleList = annotText.match(/^:[a-z][-_a-z0-9]*/i); // match the role :actor
                annotText = annotText.replace(/^:[a-z][-_a-z0-9]*/i, ""); // remove the matched role from the rest of the annotText string
                role = roleList[0]; // :actor
            } else { //if there is no role follows parenthesis todo: don't allow to go here?
                role = ':mod'; // default
            }
            umr[new_loc + '.r'] = role;
            if (annotText.match(/^\s*\(/)) { // )
                annotText = string2umr_recursive(annotText, new_loc, 'pre-open-parenthesis', ht);
            } else {
                annotText = string2umr_recursive(annotText, new_loc, 'post-role', ht);
            }
            annotText = string2umr_recursive(annotText, loc, 'post-concept', ht);
        }
    } else if (state == 'post-role') { // expecting string, number, or variable
        if (annotText.match(/^\s/)) {
            annotText = annotText.replace(/^\s*/, "");
        } else {
            console.log("There is no space between role and post-role variable/string/concept");
        }
        let s_comp;
        let string_arg = '';
        let variable_arg = '';
        if (annotText.match(/^"/)) {
            annotText = annotText.replace(/^"/, "");
            var q_max_iter = 10;
            while ((q_max_iter >= 1) && !((annotText == '') || (annotText.match(/^"/)))) {
                if (s_comp = annotText.match(/^[^"\\]+/)) {
                    string_arg += s_comp[0];
                    annotText = annotText.replace(/^[^"\\]+/, "");
                }
                if (s_comp = annotText.match(/^\\./)) {
                    string_arg += s_comp[0];
                    annotText = annotText.replace(/^\\./, "");
                }
                q_max_iter--;
            }
            annotText = annotText.replace(/^"/, "");

        } else if (s_comp = annotText.match(/^:/)) {
            string_arg = 'MISSING-VALUE';
        } else if (s_comp = annotText.match(/^[^ ()]+/)) {
            string_arg = s_comp[0].replace(/\s*$/, "");
            annotText = annotText.replace(/^[^ ()]+/, "");
            if (getLocs(string_arg)) {
                variable_arg = string_arg;
                recordVariable(variable_arg, loc);
                string_arg = '';
            } else if (string_arg.match(/^[a-z]\d*$/)) {
                ht['provisional-string.' + loc] = string_arg;
            }
        } else {
            string_arg = 'MISSING-VALUE';
        }
        umr[loc + '.s'] = string_arg;
        umr[loc + '.c'] = '';
        umr[loc + '.v'] = variable_arg;
        var head_loc = loc.replace(/\.\d+$/, "");
        annotText = string2umr_recursive(annotText, head_loc, 'post-concept', ht);
    }
    return annotText;
}

/**
 * annotText got cut into pieces in this process, part of the annotText got cut off when it's got parsed successfully, and the leftover annotText string is the string to be parsed into umr
 * @param annotText : annotated string: (s1t / taste-01)
 * @returns {*}
 */
function string2umr(annotText) {
    let loc;
    let ps; //todo
    let ps_loc; //todo
    var ht = {}; //todo
    umr = {};
    umr['n'] = 0;
    variables = {};
    concepts = {};
    variablesInUse = {};
    let uncleanedRootVariables = annotText.match(/\(\s*s\d*[a-z]\d*[ \/]/g); // match each root vars (uncleaned): ["(s1t "]
    //populate variablesInUse
    uncleanedRootVariables.forEach(function(item, index){ // traverse each root
        let variable = item.replace(/^\(\s*/, ""); // get rid of the starting parenthesis: "s1t "
        variable = variable.replace(/[ \/]$/, ""); // get rid of the trailing space or /: "s1t"
        if (variablesInUse[variable]) {
            variablesInUse[variable + '.conflict'] = 1;
        } else {
            variablesInUse[variable] = 1;
        }
    });

    if (annotText.match(/\(/)) { //if there is an open parenthesis in annotText, e.g. annotText = "(s1t / taste-01)" meaning there is one node
        let prev_s_length = annotText.length; // 16
        let root_index = 1; // keep track of how many roots (how many graphs)
        loc = root_index + '';
        umr['n'] = 1;
        annotText = string2umr_recursive(annotText + ' ', loc, 'pre-open-parenthesis', ht);
        while (annotText.match(/^\s*[()]/) && (annotText.length < prev_s_length)) { // match ( ) regardless of space, and the annotText gets shorter
            root_index++;
            loc = root_index + '';
            prev_s_length = annotText.length;
            annotText = string2umr_recursive(annotText + ' ', loc, 'pre-open-parenthesis', ht);
            if (annotText.length < prev_s_length) {
                umr['n'] = umr['n'] + 1;
            }
        }
        for (var key in ht) { //todo: what is provisional-string
            console.log('investigating provisional-string ' + key + ' ' + ht[key]);
            if ((ps_loc = key.replace(/^provisional-string\.(\d+(?:\.\d+)*)$/, "$1"))
                && (ps = umr[ps_loc + '.s'])
                && getLocs(ps)
                && (ps == ht[key])) {
                // add_log('reframing provisional-string as variable ' + ps_loc + ' ' + ps + ' ' + ht[key]);
                umr[ps_loc + '.s'] = '';
                umr[ps_loc + '.v'] = ps;
                recordVariable(ps, ps_loc);
            }
        }
    } else {
        umr['n'] = 0;
    }
    variablesInUse = new Object();
    return strip(annotText);
}

/**
 * this is used to parse the penman string to umr
 * @param loaded_alignment
 * @param annotText
 */
function text2umr(annotText="", loaded_alignment='') {
    if (annotText && annotText!=="empty umr") { //annotText!=="empty umr" is because the older version saved <i>empty umr<i> in database sometimes
        string2umr(annotText); //populated umr

        //fill in the alignment information to umr
        if(loaded_alignment){
            let matches = loaded_alignment.match(/\((s\d*[a-z]\d*)\):\s((\d+-\d+)|undefined)/gm); //["(s1f): 4-4", "(s1t): 3-3"]
            if(matches){
                for(let i=0; i<matches.length; i++){
                    let variable = matches[i].replace(/\((s\d*[a-z]\d*)\):\s((\d+-\d+)|undefined)/gm, '$1');
                    let align_info = matches[i].replace(/\((s\d*[a-z]\d*)\):\s(\d+-\d+)/gm, '$2');
                    if(matches[i].includes("undefined")){
                        align_info = matches[i].replace(/\((s\d*[a-z]\d*)\):\sundefined/gm, '-1--1');
                    }
                    let loc = getLocs(variable);
                    umr[loc + '.a'] = align_info;
                }
            }
        }
    }
}