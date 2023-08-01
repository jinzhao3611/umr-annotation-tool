let childArg = '';
let parentArg = '';
let selectedText;
// console.log('4',umr)
// let umr={}
// show_amr_obj = {"option-string-args-with-head": false, "option-1-line-NEs": true, "option-1-line-ORs": false, "option-role-auto-case":false,
//     "option-check-chinese":true, "option-resize-command":true, 'option-indentation-style': 'variable', 'option-auto-reification': true};

/**
 * fill in all the sentence annotation penman strings using a list of umr dictionaries of all the sentence annotations
 * @param sentAnnotUmrs: a list of umr dictionaries of all the sentence annotations
 */
function fillInSentAnnots(sentAnnotUmrs){
    for(let i=0; i<sentAnnotUmrs.length; i++){
        let amr_s = umrDict2penmanString(sentAnnotUmrs[i]);
        document.getElementById('amr'+ (i+1)).innerHTML= amr_s.replace(/\n/g, "<br>\n");
    }
}

function initializeDoc() {
    docAnnot=true;
    umr['n'] = 0;
    undo_list.push(cloneCurrentState()); //populate undo_list
    current_mode = 'top';
}

/**
 * @param html_umr_s: <div id="amr">(s1 / sentence<br>&nbsp;&nbsp;:temporal (s1t / s1t :before (DCT / DCT))<br>&nbsp;&nbsp;:temporal (s1t / s1t :after (s2d / s2d)))<br></div>
 * @param nested: boolean, if nested form like in the paper "Developing Uniform Meaning Representation for Natural Language Processing"
 * @returns {string|any}: <div id="amr">(s1 / sentence<br>
 &nbsp;&nbsp;:temporal ((s1t :before DCT)<br>
 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(s1t :after s2d)))<br>
 */
function docUmrTransform(html_umr_s, nested){
  //this is a bandit solution, in early stages, the root variable is in the form of s1, now it's s1s0, this is for the purpose of being compatible with the early stage form(export new file with new form)

    let root_pattern = /(\(s\d+)( \/ sentence)/g
    html_umr_s = html_umr_s.replace(root_pattern, "$1" + "s0" + "$2")

    let regex1 = /([a-zA-Z0-9\-]+) \/ (?=.*?\1)[a-zA-Z0-9\-]+ /g //match s1t / s1t (space at the end)
    let regex2 = /\(([a-zA-Z0-9]+) \/ (?=.*?\1)[a-zA-Z0-9]+\)/g //match (AUTH / AUTH)
    let html_umr_s1 = html_umr_s.replace(regex1, "$1"+ " ");

    html_umr_s1 = html_umr_s1.replace(regex2, "$1");

    if (!html_umr_s1.includes('&nbsp;')){
        console.log("before html_fy: ", html_umr_s1);
        html_umr_s1 = html_umr_s1.replaceAll('  ', '&nbsp;&nbsp;');
        html_umr_s1 = html_umr_s1.replaceAll('\n', '<br>');
        console.log("after html_fy: ", html_umr_s1);
    }

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
        if(nested){
            temporals = chainUp(temporals);
        }
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
        if(nested){
            modals = chainUp(modals);
        }
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
        if(nested){
            corefs = chainUp(corefs);
        }
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

/**
 *
 * @param penman_s: showing_penman_html: '(s1 / sentence<br>&nbsp;&nbsp;:temporal ((s1t :before DCT)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(s1t :after (s2e :before test)))<br>&nbsp;&nbsp;:modal ((s2d :AFF AUTH)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(s2e :FullNeg AUTH))<br>&nbsp;&nbsp;:coref ((s2e :same-entity s1t)))<br>';
 * @returns inter_penman_text: "(s1 / sentence :temporal (s1t / s1t :before (DCT / DCT)) :temporal (s1t / s1t :after (s2e / s2e)) :temporal (s2e / s2e :before (test / test)) :modal (s2d / s2d :AFF (AUTH / AUTH)) :modal (s2e / s2e :FullNeg (AUTH / AUTH)) :coref (s2e / s2e :same-entity (s1t / s1t))"
 */
function inverseUmrTransform(penman_s){
    let lines = penman_s.trim().split('\n');

  let temporal_rels = [];
  let modal_rels = [];
  let coref_rels = [];

  let flag = '';
  for(let i=0; i<lines.length; i++){
  	lines[i] = lines[i].trim();
    if (lines[i].startsWith(":temporal")){
      flag = ':temporal';
    }else if(lines[i].startsWith(":modal")){
      flag  = ':modal';
    }else if(lines[i].startsWith(":coref")){
      flag = ':coref';
    }

    if(flag ===':temporal'){
      let item = lines[i].replace(':temporal','');
      item = item.replaceAll('\(', '');
      item = item.replaceAll('\)', '').trim();

      if (item.split(' ').length !== 3){
        let rels = breakNestedRels(item);
        temporal_rels.push(...rels);
      }else{
        temporal_rels.push(item);
      }
    }else if(flag ===':modal'){
      let item = lines[i].replace(':modal','');
      item = item.replaceAll('\(', '');
      item = item.replaceAll('\)', '').trim();
      if (item.split(' ').length !== 3){
        let rels = breakNestedRels(item);
        modal_rels.push(...rels);
      }else{
        modal_rels.push(item);
      }
    }else if(flag ===':coref'){
      let item = lines[i].replace(':coref','');
      item = item.replaceAll('\(', '');
      item = item.replaceAll('\)', '').trim();
      if (item.split(' ').length !== 3){
        let rels = breakNestedRels(item);
        coref_rels.push(...rels);
      }else{
        coref_rels.push(item);
      }
    }
  }
    console.log('182',temporal_rels)
  let inter_penman_text = lines[0];

  temporal_rels.forEach(myFunction2);
  function myFunction2(value) {
  	value = value.replace(/([a-zA-Z0-9]+) (:[a-zA-Z\-\s]+) ([a-zA-Z0-9]+)/gm, ":temporal ($1 / $1 $2 ($3 / $3))"); //'s1p :before s2d' -> :temporal (s1p / s1p :before (s2d / s2d))
    console.log(value);
    inter_penman_text += ' ' + value;
  }

    modal_rels.forEach(myFunction3);
  function myFunction3(value) {
  	value = value.replace(/([a-zA-Z0-9]+) (:[a-zA-Z\-\s]+) ([a-zA-Z0-9]+)/gm, ":modal ($1 / $1 $2 ($3 / $3))");
    console.log(value);
    inter_penman_text += ' ' + value;

  }

    coref_rels.forEach(myFunction4);
  function myFunction4(value) {
  	value = value.replace(/([a-zA-Z0-9]+) (:[a-zA-Z\-\s]+) ([a-zA-Z0-9]+)/gm, ":coref ($1 / $1 $2 ($3 / $3))");
    console.log(value);
    inter_penman_text += ' ' + value;

  }
  console.log('207',inter_penman_text)
  return inter_penman_text;
}
/**
 // * @param item: s1t :after s2e :before s3e :depends-on s4e
 // * @returns {[]}: ["s1t :before DCT", "s1t :after s2e", "s2e :before test"]
 * @param item: "s2d / s2d :after s1t / s1t"
 * @returns: ['s2d / s2d', 's2d :after s1t', 's1t / s1t']
 */
function breakNestedRels(item){
	let rels = [];
	let eles = item.split(' ');
  console.log("eles: ", eles);
  for(let i=0; i*2+3<=eles.length; i++){
  	console.log("i: ", i);
  	rels.push(eles.slice(i*2, i*2+3).join(' '));
  }
  return rels
}

/**
 * this function turns triples into nested chains
 * @param array
 * @returns {*[]}
 */
function chainUp(array){ //array = ["(s1t :before s2d)", "(s2d :before DCT)"]
    let array2 = array.map(function(ele){ //array2 = [["(s1t :before s2d)", "s1t", "s2d"], ["(s2d :before DCT)", "s2d", "DCT"]]
        let splitted_ele = ele.split(' ');
        let new_ele = [ele];
        new_ele[1] = splitted_ele[0].replace('(', '');
        new_ele[2] = splitted_ele[2].replace(')', '');
        return new_ele;
    });

    for(let i=0; i< array2.length; i++){//array2 = [["(s1t :before (s2d :before DCT))", "s1t", "DCT"], ["", "", ""]]
        for (let j = i+1; j<array2.length; j++){
            if(array2[i][1] === array2[j][2] && array2[i][1]!== ''){
              console.log(array2[i]);
              console.log(array2[j]);
                array2[j][0] = array2[j][0].replace(array2[j][2], array2[i][0]);
                array2[j][2] = array2[i][2];
                array2[i] = ['', '', ''];
            }else if(array2[i][2] === array2[j][1] && array2[i][2] !== ''){
            	console.log(array2[i]);
              console.log(array2[j]);
                array2[i][0] = array2[i][0].replace(array2[i][2], array2[j][0]);
               	array2[i][2] = array2[j][2];
                array2[j] = ['', '', ''];
            }
        }
    }

    let array3=[]; //["(s1t :before (s2d :before DCT))"]
    for (let i=0; i < array2.length; i++){
        if (array2[i][0]!==''){
            array3.push(array2[i][0]);
        }
    }
    return array3;
}

/**
 * load the annotation for current sentence from database, the doc_level_annotation is already loaded once in jinja, here it's loading the modal annotation from sentence-level
 * @param curr_doc_umr: dictionary
 * @param curr_doc_annot
 * @param curr_sent_id:
 */
function load_doc_history(curr_doc_umr, curr_doc_annot, curr_sent_id){
    console.log('275',curr_doc_umr)

    let modal_triples = [];
    let modal_triples_strings = [];
    try{
        modal_triples = generateModalUmr(`amr${curr_sent_id}`); //returns a list of triples, umr is changed to sentLevel umr
        modal_triples_strings = modal_triples.map(t => t.join(" "));
    }catch(e){
        setInnerHTML("error_msg", "do the sentence annotation first");
        document.getElementById("error_msg").className = `alert alert-danger`;
    }

    if(curr_doc_umr==='{}'){
        try{
            console.log('286',curr_doc_annot)
            umr = Object.assign(umr, string2umr(inverseUmrTransform(curr_doc_annot)))
            console.log('287',umr)
        }catch (e){
            console.log("both doc_umr and doc_annot from database is empty or doesn't not match penman string");
            umr = JSON.parse(curr_doc_umr); //{"n":0}
        }
    }else{
        umr = Object.assign(umr,JSON.parse(curr_doc_umr));//umr is from database
    }
    if (Object.keys(umr).length === 0 || Object.keys(umr).length === 1){
        umr['n'] = 1;
        umr['1.v'] = "s"+curr_sent_id+'s0'; // number change with current sentence
        umr['1.s'] = "";
        umr['1.n'] = 0;
        umr['1.c'] = "sentence";
        // sentence level data is still in the following three dicts
        variable2concept = {};
        variables = {};
        concepts = {};
        // populate with (s1 / sentence)
        recordVariable(`s${curr_sent_id}s0`, "1");
        recordConcept('sentence', "1");
        variable2concept[`s${curr_sent_id}s0`] = 'sentence';
        state_has_changed_p = 1;
    }else{
        variables = {};
        concepts = {};
        variable2concept = {};
        for (const[key, value] of Object.entries(umr)){
            if(key.endsWith('v') && value.startsWith('s')){
                variables[value] = key.replace(".v", '');
                variable2concept[value] = umr[key.replace(".v", ".c")];
                concepts[umr[key.replace(".v", ".c")]] = key.replace(".v", '');
            }
        }
    }

    let current_triples = getTriplesFromUmr(umr);
    let current_triples_strings = current_triples.map(t => t.join(" "));

    modal_triples_strings = modal_triples_strings.filter(function(val) { // deduplicate the modal triple strings that already in doc annotation
      return current_triples_strings.indexOf(val) === -1;
    });
    modal_triples = modal_triples_strings.map(s => s.split(" "));

    for (let i = 0; i < modal_triples.length; i++) {
        exec_command(`s${curr_sent_id}s0 :modal ${modal_triples[i][0]}`, '1');
        exec_command(`${modal_triples[i][0]} ${modal_triples[i][1]} ${modal_triples[i][2]}`, '1');
        show_amr('show');
    }
    show_amr('show');
}

function docUMR2db(owner_id) {
    show_amr('show'); //to prevent delete/replace mode html string got in database
    let doc_id = document.getElementById('doc_id').innerText;
    let snt_id = document.getElementById('curr_shown_sent_id').innerText;
    let doc_annot_str = document.getElementById('amr').innerHTML;

    //this purpose of these 3 lines is to remove .d items in dictionary before saving
    docAnnot=false;
    let penmanStr = show_amr('show'); //get the umr without .d items
    docAnnot=true;
    umr = string2umr(penmanStr);
    show_amr('show');//the above line displays penman string, we need to set it to triples string

    fetch(`/doclevel/${doc_id}_${snt_id}_${owner_id}#amr`, {
        method: 'POST',
        body: JSON.stringify({"snt_id": snt_id, "umr_dict": umr, "doc_annot_str": doc_annot_str})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data["msg"]);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
}

function clearInput(){
    console.log("clearInput is called");
    if(document.getElementById('roles1')){
        document.getElementById('roles1').value = '';
    }
    if(document.getElementById('roles2')){
        document.getElementById('roles2').value = '';
    }
    document.getElementById('concept_types').value = '';
    document.getElementById('ne_types').value = '';
    document.getElementById('attributes').value = '';
    document.getElementById('attribute_values1').value = '';
}

function deHTML3(s) {

    s = s.replace(/&amp;/g, '&');
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/&#39;/g, '"');
    s = s.replace(/&#34;/g, '"');

    s = s.replace(/&lt;/g, '<');
    s = s.replace(/&gt;/g, '>');

    s = s.replace(/<\/?(a|span|div)\b[^<>]*>/g, "");
    s = s.replace(/<br>/g, "split_here");
    return s;
}
function changeSetting() {
    show_amr_obj['option-1-line-NEs'] = !show_amr_obj['option-1-line-NEs'];
    // show_amr_obj['option-string-args-with-head'] = !show_amr_obj['option-string-args-with-head'];
    show_amr("show");
}
function show_amr_rec(loc, args, rec, ancestor_elem_id_list) {
    loc += '';
    if (umr[loc + '.d']) { //if this node has already been deleted
        return '';
    } else {
        let concept = umr[loc + '.c']; // umr['1.c'] 1.c: "nenhlet"
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
        let show_replace = args.match(/replace/);
        let show_delete = args.match(/delete/);
        let concept_m = concept; //concept string surrounded by html string
        let variable_m = variable; // variable string surrounded by html string
        console.log('1968',concept,variable)
        let tree_span_args = ''; //something like 'id="amr_elem_1"' to be put in the html string on show delete mode
        let role_m = ''; // role string surrounded by html string
        let elem_id = '';
        var onmouseover_fc = '';
        var onmouseout_fc = '';
        var onclick_fc = '';
        var head_loc, head_concept, head_variable, core_concept, var_locs;

        if (rec) { // if not graph root
            role = umr[loc + '.r']; //umr['1.v']
            role_m = role;
            if (show_replace) {
                let type = 'role';
                head_loc = loc.replace(/\.\d+$/, "");
                head_variable = umr[head_loc + '.v'];
                let at = head_variable + ' ' + role + ' ' + arg;
                let old_value = role;
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
            let list = ancestor_elem_id_list.split(" ");
            for (let i = 0; i < list.length; i++) {
                let ancestor_elem_id = list[i];
                if (ancestor_elem_id.match(/\S/)) {
                    show_amr_obj['elem-' + ancestor_elem_id] += ' ' + elem_id;
                }
            }
            if (role_m) {
                role_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + role_m + '</span>';
            }
        }
        if (rec) {
            s += role_m + ' ';
        }
        if (concept) {
            if (show_replace) {
                let type = 'concept';
                let at = variable;
                let old_value = concept;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                let onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                let onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                let onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                concept_m = '<span contenteditable="true" id="' + elem_id + '" title="click to change" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + concept + '</span>';
            } else if (show_delete) {
                variable_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable + '</span>';
                concept_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + concept_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            } else if (!docAnnot) { //this is used to show the frame file in penman graph, only needed in sentlevel annotation, in doclevel annotation, frame_dict shoule be empty, then won't go in this
                let frames = JSON.stringify(frame_dict[concept]);
                if (typeof frames !== 'undefined') {
                    let escaped_frames = escapeHtml(frames);
                    concept_m = `<span title=${escaped_frames}>` + concept_m + '</span>';
                } else {
                    concept_m = `<span title="">` + concept_m + '</span>';
                }
            }

            if (docAnnot) {
                console.log('2044',variable_m,concept_m)
                if(role === ''){ //when variable match the root of doclevel annotation, something like s1s0

                   s += '(' + variable_m + ' / ' + concept_m; //'(s1t / taste-01'
                }else{
                    s +='(' + concept_m; //in doc_annot, concept and the variable are the same
                }
            } else {
                s += '(' + `<span id="variable-${loc}">` + variable_m + '</span>' + ' / ' + concept_m; //'(s1t / taste-01'
            }

            let n = umr[loc + '.n']; //check how many children current loc has
            let index;
            let opx_all_simple_p = 1;
            let argx_all_simple_p = 1;
            let opx_order = [];
            let argx_order = [];
            let opx_indexes = [];
            let argx_indexes = []; //argx_indexes is the same with argx_order, except argx_order could have undefined element, but argx_indexes don't
            let name_indexes = [];
            let other_indexes = [];
            let other_string_indexes = [];
            let other_non_string_indexes = [];
            let ordered_indexes = [];
            for (let i = 1; i <= n; i++) {//traverse children of current loc
                let sub_loc = loc + '.' + i;
                let sub_string = umr[sub_loc + '.s'];
                let sub_role = umr[sub_loc + '.r'];
                if (umr[sub_loc + '.d']) {
                    // skip deleted elem
                } else if ((sub_role.match(/^:op([1-9]\d*)$/i))
                    && (index = sub_role.replace(/^:op([1-9]\d*)$/i, "$1")) //get "1" of :op1
                    && (!opx_order[index])) {
                    opx_order[index] = i;
                    if (show_amr_new_line_sent(sub_loc)) {
                        opx_all_simple_p = 0;
                    }
                } else if ((sub_role.match(/^:arg(\d+)$/i))
                    && (index = sub_role.replace(/^:arg(\d+)$/i, "$1"))
                    && (!argx_order[index])) {
                    argx_order[index] = i; //argindex is the ith children (arg0 is 2nd children)
                    if (show_amr_new_line_sent(sub_loc)) {
                        argx_all_simple_p = 0;
                    }
                } else if (sub_role === ':name') {
                    name_indexes.push(i);
                } else if (sub_string !== '') {
                    other_string_indexes.push(i);
                    other_indexes.push(i);
                } else {
                    other_non_string_indexes.push(i);
                    other_indexes.push(i);
                }
            }
            for (let i = 0; i < opx_order.length; i++) {
                if ((index = opx_order[i]) !== undefined) {
                    opx_indexes.push(index);
                }
            }
            for (let i = 0; i < argx_order.length; i++) {
                if ((index = argx_order[i]) !== undefined) {
                    argx_indexes.push(index);
                }
            }
            if (show_amr_obj['option-string-args-with-head']) { //keep string arguments on same line as head
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

            for (let i = 0; i < ordered_indexes.length; i++) {
                let index = ordered_indexes[i];
                let sub_loc = loc + '.' + index;
                let show_amr_rec_result = show_amr_rec(sub_loc, args, 1, ancestor_elem_id_list + elem_id + ' '); // this stores one amr line
                if (show_amr_rec_result) {
                    if (docAnnot) {
                        if (show_amr_new_line_doc(sub_loc)) {
                            s += '\n' + indent_for_loc(sub_loc, '&nbsp;') + show_amr_rec_result;
                        } else {
                            s += ' ' + show_amr_rec_result;
                        }
                    } else {
                        if (show_amr_new_line_sent(sub_loc)) {
                            s += '\n' + indent_for_loc(sub_loc, '&nbsp;') + show_amr_rec_result;
                        } else {
                            s += ' ' + show_amr_rec_result;
                        }
                    }
                }
            }
            s += ')';
        } else if (string) {
            if (show_replace) {
                let type = 'string';
                let head_loc = loc.replace(/\.\d+$/, "");
                let head_variable = umr[head_loc + '.v'];
                let role = umr[loc + '.r'];
                let at = head_variable + ' ' + role;
                let old_value = string;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                let onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                let onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                let onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                string_m = '<span contenteditable="true" id="' + elem_id + '" title="click to change me" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + string_m + '</span>';
            } else if (show_delete) {
                string_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + string_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            }
            s += string_m;
        } else { // variable is not empty
            if (show_replace) {  // without concept, i.e. secondary variable
                let type = 'variable';
                let head_loc = loc.replace(/\.\d+$/, "");
                let head_variable = umr[head_loc + '.v'];
                let role = umr[loc + '.r'];
                let at = head_variable + ' ' + role + ' ' + variable;
                let old_value = variable;
                elem_id = 'amr_elem_' + ++n_elems_w_id;
                let onclick_fc = 'fillReplaceTemplate(\'' + type + '\',\'' + at + '\',\'' + old_value + '\',\'' + elem_id + '\')';
                let onmouseover_fc = 'color_amr_elem(\'' + elem_id + '\',\'#0000FF\',\'mo\')';
                let onmouseout_fc = 'color_amr_elem(\'' + elem_id + '\',\'#000000\',\'mo\')';
                variable_m = '<span id="' + elem_id + '" title="click to change me" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable_m + '</span>';
            } else if (show_delete) {
                variable_m = '<span title="click to delete" onclick="' + onclick_fc + '" onmouseover="' + onmouseover_fc + '" onmouseout="' + onmouseout_fc + '">' + variable_m + '</span>';
                tree_span_args = 'id="' + elem_id + '"';
            }
            if (docAnnot) {
                s += variable_m;
            } else {
                s += `<span id="variable-${loc}">` + variable_m + '</span>';
            }
        }
        if (tree_span_args) {
            s = '<span ' + tree_span_args + '>' + s + '</span>';
        }
        console.log("s2183: "+ s);
        return s;
    }
}
function show_amr(args) {
    let s; //DOM element that contains umr
    let html_amr_s; //html string of the umr penman graph
    n_elems_w_id = 0; //keep counts of element (used in show delete)
    show_amr_mo_lock = ''; //relate to coloring, it's ele_id
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
            if (show_amr_rec_result) {
                amr_s += show_amr_rec_result + '\n';
            }
        }

        html_amr_s = amr_s;
        html_amr_s = html_amr_s.replace(/\n/g, "<br>\n");
        console.log('2217',html_amr_s)
        // this is the actual output part
        if (docAnnot && args==="show") {
            // html_amr_s =
            //(s2s0 / sentence
            // :temporal (s1t / s1t
            //     :before (s2i3 / s2i3)))
            html_amr_s = docUmrTransform(html_amr_s, false); //this is the function turns triples into nested form
        }
        setInnerHTML('amr', html_amr_s);
        show_umr_status = args;
    }
    if ((s = document.getElementById('amr')) != null) {
        var height = s.style.height;
        var newScrollTop = 0;
        if ((height != undefined) && height.match(/^\d+/)) {
            if (origScrollTop != 0) {
                newScrollTop = origScrollTop + s.scrollHeight - origScrollHeight;
                if (newScrollTop < 0) {
                    newScrollTop = 0;
                } else if (newScrollTop > s.scrollHeight) {
                    newScrollTop = s.scrollHeight;
                }
                s.scrollTop = newScrollTop;
            }
            // add_log ('re-scroll ' + origScrollTop + '/' + origScrollHeight + ' ' + s.scrollTop + ' ' + s.scrollTop + ' ' + intScrollTop);
        }
    }
    if (!docAnnot) {
        showAlign();
        if (language === 'chinese' || language === 'english') {
            // showAnnotatedTokens();
        }
    }
    return deHTML(html_amr_s);
}

function initialCommand(current_snt_id){
        console.log('718',variables)
        // populateUtilityDicts();
        let parentArg = document.getElementById('parentArg').value; //s2i2
        let childArg = document.getElementById('childArg').value; //s1d
        let role_outter = document.getElementById('doc-level-relations').innerText.split(' ')[0]; //:coref
        let role_inner = document.getElementById('doc-level-relations').innerText.split(' ')[1]; //:same-entity

        let command1 = 's'+ current_snt_id +'s0' + ' ' + role_outter + ' ' + parentArg; //s1s0 :coref s2i2
    console.log('test724',command1)
        exec_command(command1, '1');

        let command2 = parentArg + ' ' + role_inner + ' ' + childArg; //s2i2 :same-entity s1d
    console.log('test728',command2)
        exec_command(command2, '1');

}

function showBlueBox(){
    document.getElementById('amr').parentNode.setAttribute('style', 'overflow-x: scroll; border:1px solid blue;');
    document.getElementById('amr').focus();
}

function noteDocLevelRel(rel){
    document.getElementById('doc-level-relations').innerText = rel;
}

function fillInArgs(argId){
    selectedText = document.getSelection();
    document.onselectionchange = function selectSpan() {
        if(selectedText.toString() !== ''){
            document.getElementById(argId).value = selectedText;
            if(argId ==='childArg'){
                void($('#content').unhighlight({element: 'span', className:'text-primary'}));
                void($('#content').highlight(selectedText.toString(), {element: 'span', className:'text-primary'}));
            }else if(argId ==='parentArg'){
                void($('#content').unhighlight({element: 'span', className:'text-danger'}));
                void($('#content').highlight(selectedText.toString(), {element: 'span', className:'text-danger'}));
            }
        }
    };
}

function show_amr_new_line_doc(loc) {
    let role = umr[loc + '.r'] || '';
    if(role.match(/^(:temporal|:modal|:coref)$/)){
        return 1;
    }else{
        return 0;
    }
}

function open_sent(){
    window.open('display_sentence_annot.html','_blank')
}
function  test_focus(){
    console.log('i AM HERE 775'
    )}
            //     let parent_value = $('#parentArg').val()
            //     console.log('lost focus')
            //     if (parent_value.trim()!==''){
            //     if (/s\d+/.test(parent_value.trim())){
            //         let match_sent_id=parent_value.match(/s(\d+)/)
            //         console.log(match_sent_id,'484')
            //
            // }}}