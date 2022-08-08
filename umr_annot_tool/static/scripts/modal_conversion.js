var quotingVerbs = ["say", "tell"];

function convert_with_modstr(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    Object.keys(umr).forEach(function(key) {
        if(umr[key] === ":MODSTR") {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let child = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, child]);
        }
    });
    return output
}

function convert_with_mod(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]]; // add this triple first
    Object.keys(umr).forEach(function(key) { //traverse all keys
        if(umr[key] === ":MODSTR") { // if :MODSTR appears
            let loc = key.substring(0, key.length - 2); // get the location of the :MODSTR
            let modstr_edge_value = ":" + umr[loc + ".s"]; // get the child node of :MODSTR and turn it into modstr_edge_value
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let modstr_child = umr[find_loc(k) + '.v']; //get child node of :ARGO and turn it into modstr_child
            output.push(["AUTH", modstr_edge_value, modstr_child]);
        }
        if(umr[key] === ":MODPRED") { // if :MODPRED appears
            let loc = key.substring(0, key.length - 2); //get the location of :MODPRED
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let mod_parent = umr[find_loc(k) + '.v']; // get the child node of :MODPRED and turn it into mod_parent
            let mod_child = umr[loc + ".v"] || check_reentrance(umr, loc); //re-entrance
            output.push([mod_parent, ":FullAff", mod_child]);

            let mod_parent2 = umr[loc + ".v"] || check_reentrance(umr, loc);
            let mod_child2 = umr[find_parent_loc(key) + ".v"];
            output.push([mod_parent2, ":Unsp", mod_child2]);
        }
    });
    return output
}

function convert_with_quot(umr){ //check with 6
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let quot_loc = find_loc(getKeyByValue(umr,':QUOT'));
    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" &&  !checkIfSibling(quot_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let child1 = umr[find_parent_loc(key) + '.v'];
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let child2 = umr[find_loc(k) + '.v']
            output.push(["AUTH", edge_value, child1]);
            output.push(["AUTH", edge_value, child2]);
        }
        if(umr[key] === ":MODSTR" &&  checkIfSibling(quot_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let child = umr[find_parent_loc(key) + '.v'];
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let parent = umr[find_loc(k) + '.v']
            output.push([parent, edge_value, child]);
        }
    });
    return output;
}

function convert_with_purp(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let purp_loc = find_loc(getKeyByValue(umr,':PURP'));
    let arg0k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
    let prtParent = umr[find_loc(arg0k) + '.v']
    output.push([prtParent, ":PRT", "PURPOSE"]);

    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" &&  checkIfSibling(purp_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            output.push(["PURPOSE", edge_value, umr[purp_loc + '.v']]);

            let child = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, child]);
        }
        if(umr[key] === ":MODSTR" &&  !checkIfSibling(purp_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let child = umr[find_loc(k) + '.v']
            output.push(["AUTH", edge_value, child]);
        }
    });
    return output;
}

function convert_with_cond(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    output.push(["AUTH", ":NEUT", "HAVECONDITION"]);

    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR") {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let child = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, child]);
        }
    });
    return output;
}

function mod_over_quot(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let quot_loc = find_loc(getKeyByValue(umr,':QUOT'));

    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODPRED") { // if :MODPRED appears
            let loc = key.substring(0, key.length - 2); //get the location of :MODPRED
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let conceiver1 = umr[find_loc(k) + '.v']; // get the child node of :MODPRED and turn it into mod_parent
            let modal_event = umr[loc + ".v"] || check_reentrance(umr, loc); //re-entrance
            let k2 = getKeyByValue(umr, ':actor')
            let conceiver2 = umr[find_loc(k2) + '.v'];
            output.push([conceiver1, ":FullAff", modal_event]);
            output.push([modal_event, ":Unsp", conceiver2]);

            let mod_child2 = umr[find_parent_loc(key) + ".v"];
            output.push([modal_event, ":Unsp", mod_child2]);
        }
        if(umr[key] === ":MODSTR" && checkIfSibling(quot_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k2 = getKeyByValue(umr, ':actor')
            let conceiver2 = umr[find_loc(k2) + '.v'];
            let child = umr[find_parent_loc(key) + '.v'];
            output.push([conceiver2, edge_value, child]);
        }
        if(umr[key] === ":MODSTR" && !checkIfSibling(quot_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let child = umr[find_loc(k) + '.v'];
            output.push(["AUTH", edge_value, child]);
        }
    });
    return output;
}

function mod_over_purp(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let purp_loc = find_loc(getKeyByValue(umr,':PURP'));

    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODPRED") { // if :MODPRED appears
            let loc = key.substring(0, key.length - 2); //get the location of :MODPRED
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let conceiver1 = umr[find_loc(k) + '.v']; // get the child node of :MODPRED and turn it into mod_parent
            let modal_event = umr[loc + ".v"] || check_reentrance(umr, loc); //re-entrance
            output.push([conceiver1, ":FullAff", modal_event]);
            let mod_child2 = umr[find_parent_loc(key) + ".v"];
            output.push([modal_event, ":Unsp", mod_child2]);
        }
        if(umr[key] === ":MODSTR" && checkIfChild(purp_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k2 = getKeyByValue(umr, ':actor')
            let conceiver2 = umr[find_loc(k2) + '.v'];
            let child = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, conceiver2]);
            output.push([conceiver2, ":PRT", "PURPOSE"]);
            output.push(["PURPOSE", ":FullAff", umr[purp_loc + '.v']]);
        }
        if(umr[key] === ":MODSTR" && !checkIfChild(purp_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let child = umr[find_loc(k) + '.v'];
            output.push(["AUTH", edge_value, child]);
        }
    });
    return output;
}


function mod_over_cond(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let cond_loc = find_loc(getKeyByValue(umr,':COND'));
    let mod_loc = find_loc(getKeyByValue(umr, ':MODPRED'));

    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" && checkIfChild(cond_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let cond_event = umr[find_parent_loc(key) + '.v'];
            let event = umr[find_parent_loc(cond_loc+"**") + '.v'];
            output.push(["HAVECONDITION", edge_value, cond_event]);
            output.push(["HAVECONDITION", ":Unsp", event]);
        }
        if(umr[key] === ":MODSTR" && !checkIfChild(cond_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let experiencer = umr[find_loc(k) + '.v'];
            output.push(["AUTH", edge_value, experiencer]);
            let modal_event = umr[mod_loc + '.v'];
            output.push([experiencer, ":FullAff", modal_event]);
            output.push([modal_event, ":Unsp", "HAVECONDITION"])
        }
    });
    return output;
}

function quot_over_mod(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let quot_loc = find_loc(getKeyByValue(umr,':QUOT'));
    let mod_loc = find_loc(getKeyByValue(umr, ':MODPRED'));
    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" && !checkIfSibling(quot_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let k = getKeyByValue(umr, ':actor')
            let actor = umr[find_loc(k) + '.v'];
            output.push(["AUTH", edge_value, actor]);
            let quot_event = umr[quot_loc + '.v'];
            output.push(["AUTH", ":FullAff", quot_event]);
        }
        if(umr[key] === ":MODSTR" && checkIfSibling(quot_loc, find_loc(key))) {
            let loc = find_loc(key);
            let edge_value = ":" + umr[loc + ".s"];
            let event = umr[mod_loc + '.v'];
            let k = getKeyByValue(umr, ':actor')
            let actor = umr[find_loc(k) + '.v'];
            let k2 = getKeyByValue(umr, ':experiencer') || getKeyByValue(umr, ':ARG0')
            let experiencer = umr[find_loc(k2) + '.v'];
            output.push([actor, edge_value, experiencer]);
            output.push([experiencer, ":FullAff", event]);
            output.push([event, ":Unsp", umr[find_parent_loc(mod_loc+"**") + '.v']]); //find_parent_loc takes in key
        }
    });
    return output;
}


function quot_over_purp_reporting(umr){ //this one should be complete
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let purp_loc = find_loc(getKeyByValue(umr,':PURP'));
    let purpose_event = umr[purp_loc + '.v'];
    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" && checkIfSibling(purp_loc, find_loc(key))) {
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let reporting_event = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, reporting_event]);
            let reporting_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', find_parent_loc(key))) + '.v'];
            output.push(["AUTH", edge_value, reporting_conceiver]);
        } else if(umr[key] === ":MODSTR" && checkIfChild(purp_loc, find_loc(key))){
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let purpose_event_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', find_loc(getKeyByValue(umr,':PURP')))) + '.v'];
            output.push(['AUTH', edge_value, purpose_event_conceiver]);
            output.push([purpose_event_conceiver, "PRT", "PURPOSE"]);
            output.push(['PURPOSE', edge_value, purpose_event]);
        } else if(umr[key] === ":MODSTR"){
            let parent_loc = find_parent_loc(find_parent_loc(key) + '**');
            let reporting_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', parent_loc)) + '.v'];
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let reported_event = umr[find_parent_loc(key) + '.v'];
            output.push([reporting_conceiver, edge_value, reported_event]);
        }
    });
    return output;
}

function quot_over_purp_reported(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let purp_loc = find_loc(getKeyByValue(umr,':PURP'));
    let purpose_event = umr[purp_loc + '.v'];
    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" && checkIfSibling(purp_loc, find_loc(key))) {
            let parent_loc = find_parent_loc(find_parent_loc(key) + '**');
            let reporting_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', parent_loc)) + '.v'];
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let reported_event = umr[find_parent_loc(key) + '.v'];
            output.push([reporting_conceiver, edge_value, reported_event]);
        } else if(umr[key] === ":MODSTR" && checkIfChild(purp_loc, find_loc(key))){
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let parent_loc = find_parent_loc(find_parent_loc(getKeyByValue(umr,':PURP')) + '**');
            let reporting_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', parent_loc)) + '.v'];
            let reported_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', find_parent_loc(getKeyByValue(umr,':PURP')))) + '.v'];
            output.push([reporting_conceiver, edge_value, reported_conceiver]);

            output.push([reported_conceiver, "PRT", "PURPOSE"]);
            output.push(['PURPOSE', edge_value, purpose_event]);
        } else if(umr[key] === ":MODSTR"){
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let reporting_event = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, reporting_event]);
            let reporting_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', find_parent_loc(key))) + '.v'];
            output.push(["AUTH", "AFF", reporting_conceiver]);
        }
    });
    return output;
}

function quot_over_cond(umr){
    let output = [["ROOT", ":MODAL", "AUTH"]];
    let cond_loc = find_loc(getKeyByValue(umr,':COND'));
    Object.keys(umr).forEach(function(key){
        if(umr[key] === ":MODSTR" && checkIfSibling(cond_loc, find_loc(key))) {
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let quoted_event = umr[find_parent_loc(key) + '.v'];
            output.push(["HAVECONDITION", edge_value, quoted_event]);
        } else if(umr[key] === ":MODSTR" && checkIfChild(cond_loc, find_loc(key))){
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let condition_event = umr[cond_loc + '.v'];
            output.push(["HAVECONDITION", edge_value, condition_event]);
        } else if(umr[key] === ":MODSTR"){
            let edge_value = ":" + umr[find_loc(key) + ".s"];
            let quoting_event = umr[find_parent_loc(key) + '.v'];
            output.push(["AUTH", edge_value, quoting_event]);
            let quoting_conceiver = umr[find_loc(getKeyByValueWzConstraint(umr, ':actor', find_parent_loc(key))) + '.v'];
            output.push(["AUTH", "AFF", quoting_conceiver]);
            output.push([quoting_conceiver, "NEUT", "HAVECONDITION"]);
        }
    });
    return output;
}


/*************** utility functions ****************/

function check_reentrance(umr, loc){
    return umr[find_loc(getKeyByValue(umr, umr[loc + ".v"])) + ".v"];
}

function find_parent_loc(key){
    return key.substring(0, key.length-4);
}

function find_loc(key){
    return key.substring(0, key.length-2);
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function getKeyByValueWzConstraint(object, value, parent_loc) {
    return Object.keys(object).find(key => object[key] === value && key.startsWith(parent_loc) && key.length === parent_loc.length + 4);
}

function checkIfSibling(loc1, loc2){
    return loc1.length === loc2.length
}
function checkIfChild(parent_loc, child_loc){
    return child_loc.startsWith(parent_loc);
}

function generateModalUmr(id){
    let triples = [];
    let html_string = document.getElementById(id).innerHTML;
    html_string = deHTML(html_string);
    umr = string2umr(html_string);

    let quotingVerbsFlag = false;
    Object.keys(umr).forEach(function(key){
        let lemma = umr[key].toString().replace(/^([A-z]+)(-\d+)/, "$1");
        if(quotingVerbs.includes(lemma)){
            quotingVerbsFlag = true;
        }
    });

    if (Object.values(umr).indexOf(':MODPRED') >-1){
        if (Object.values(umr).indexOf(':QUOT')>-1){
            triples = mod_over_quot(umr);
        }else if(Object.values(umr).indexOf(':PURP')>-1){
            triples = mod_over_purp(umr);
        }else if(Object.values(umr).indexOf(':COND')>-1){
            triples = mod_over_cond(umr);
        }else{
            if(quotingVerbsFlag){
                triples = quot_over_mod(umr);
            }else{
                triples = convert_with_mod(umr);
            }
        }
    } else if(Object.values(umr).indexOf(':QUOT')>-1){
        triples = convert_with_quot(umr);
    } else if(Object.values(umr).indexOf(':COND')>-1){
        if(quotingVerbsFlag){
            triples = quot_over_cond(umr);
        }else{
            triples = convert_with_cond(umr);
        }
    } else if(Object.values(umr).indexOf(':PURP')>-1){
        if(quotingVerbsFlag){
            let lemma = umr[find_parent_loc(getKeyByValue(umr, ':PURP')) + '.c'].toString().replace(/^([A-z]+)(-\d+)/, "$1"); //the concept of the parent node
            if(quotingVerbs.includes(lemma)){
                triples = quot_over_purp_reporting(umr);
            }else{
                triples = quot_over_purp_reported(umr);
            }
        }else{
            triples = convert_with_purp(umr);
        }
    }else if(Object.values(umr).indexOf(':MODSTR')>-1){
        triples = convert_with_modstr(umr);
    }
    return triples;
}

function getTriplesFromUmr(umr){
    let triples = [];
    Object.keys(umr).forEach(function(key){
        if(key.endsWith('v') && (key.length>3)){
            triples.push([umr[find_parent_loc(key) + '.c'], umr[key.replace('.v', '.r')], umr[key] || umr[key.replace('.v', '.s')]]);
        }
    });
    return triples;
}