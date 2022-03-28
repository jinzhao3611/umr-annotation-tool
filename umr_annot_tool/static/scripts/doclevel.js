let childArg = '';
let parentArg = '';
let selectedText;

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
    umr['n'] = 0;
    undo_list.push(cloneCurrentState()); //populate undo_list
    current_mode = 'top';
}

/**
 * change the unfocused doc level annotation
 * from:(s1 / sentence
  :temporal (s1t / s1t :before (DCT / DCT))
  :temporal (s1t / s1t :after (s2d / s2d)))
 * to: (s1 / sentence
:temporal ((s1t :before DCT)
(s1t :after s2d)))

 * @param docLen
 * @param current_sent_id
 */
function showDefaultUmr(docLen, current_sent_id){
    for(let i =1; i<=docLen; i++){
        if(i !== parseInt(current_sent_id)){
            let html_s_before = document.getElementById('amr_doc'+i).innerText;
            document.getElementById('amr_doc'+i).innerText = deHTML2(docUmrTransform(html_s_before, false));
        }
    }
}

/**
 * @param html_umr_s: <div id="amr">(s1 / sentence<br>&nbsp;&nbsp;:temporal (s1t / s1t :before (DCT / DCT))<br>&nbsp;&nbsp;:temporal (s1t / s1t :after (s2d / s2d)))<br></div>
 * @param nested: boolean, if nested form like in the paper "Developing Uniform Meaning Representation for Natural Language Processing"
 * @returns {string|any}: <div id="amr">(s1 / sentence<br>
 &nbsp;&nbsp;:temporal ((s1t :before DCT)<br>
 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(s1t :after s2d)))<br>
 */
function docUmrTransform(html_umr_s, nested){
    let regex1 = /([a-zA-Z0-9]+) \/ (?=.*?\1)[a-zA-Z0-9]+ /g //match s1t / s1t (space at the end)
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
 * @param penman_s: showing_penman_html: '(s1 / sentence<br>&nbsp;&nbsp;:temporal ((s1t :before DCT)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(s1t :after (s2e :before test)))<br>&nbsp;&nbsp;:modal ((s2d :AFF AUTH)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(s2e :NEG AUTH))<br>&nbsp;&nbsp;:coref ((s2e :same-entity s1t)))<br>';
 * @returns db_penman_text: "(s1 / sentence :temporal (s1t / s1t :before (DCT / DCT)) :temporal (s1t / s1t :after (s2e / s2e)) :temporal (s2e / s2e :before (test / test)) :modal (s2d / s2d :AFF (AUTH / AUTH)) :modal (s2e / s2e :NEG (AUTH / AUTH)) :coref (s2e / s2e :same-entity (s1t / s1t))"
 */
function inverseUmrTransform(penman_s){
  // let penman_s = '&lt;div id=&#34;amr&#34;&gt;(s1 / sentence&lt;br&gt;  :temporal ((s1t :before DCT)&lt;br&gt;                    (s1t :after s2d)))&lt;/div&gt;';

  penman_s = deHTML3(penman_s);

  // console.log(penman_s);

  lines = penman_s.split('split_here');

  // lines.forEach(myFunction);
  // function myFunction(value) {
  //   console.log('value: ', value);
  // }

  temporal_rels = [];
  modal_rels = [];
  coref_rels = [];

	console.log(lines.length)
  let flag = '';
  for(let i=0; i<lines.length; i++){
  	lines[i] = lines[i].trim();
  	console.log('here0: ', lines[i]);
    if (lines[i].startsWith(":temporal")){
      flag = ':temporal';
    }else if(lines[i].startsWith(":modal")){
      flag  = ':modal';
    }else if(lines[i].startsWith(":coref")){
      flag = ':coref';
    }

    if(flag ===':temporal'){
      console.log('line from here0: ', lines[i])
      item = lines[i].replace(':temporal','');
      item = item.replaceAll('\(', '');
      item = item.replaceAll('\)', '').trim();
      console.log('item from here0: ', item.split(' '));

      if (item.split(' ').length !== 3){
        rels = breakNestedRels(item);
        console.log('rels from here0: ', rels)
        temporal_rels.push(...rels);
      }else{
        temporal_rels.push(item);
      }
    }else if(flag ===':modal'){
    	console.log('line from here1: ', lines[i])
      item = lines[i].replace(':modal','');
      item = item.replaceAll('\(', '');
      item = item.replaceAll('\)', '').trim();
      console.log('item from here1: ', item.split(' '));
      if (item.split(' ').length !== 3){
        rels = breakNestedRels(item);
        console.log('rels from here1: ', rels)
        modal_rels.push(...rels);
      }else{
        modal_rels.push(item);
      }
    }else if(flag ===':coref'){
      item = lines[i].replace(':coref','');
      item = item.replaceAll('\(', '');
      item = item.replaceAll('\)', '').trim();
      if (item.split(' ').length !== 3){
        rels = breakNestedRels(item);
        coref_rels.push(...rels);
      }else{
        coref_rels.push(item);
      }
    }
  }
  // console.log('temporal rels: ', temporal_rels);
  // console.log('modal rels: ', modal_rels);
  // console.log('coref rels: ', coref_rels);

  let db_penman_text = lines[0];

  temporal_rels.forEach(myFunction2);
  function myFunction2(value) {
  	value = value.replace(/([a-zA-Z0-9]+) (:[a-zA-Z\-\s]+) ([a-zA-Z0-9]+)/gm, ":temporal ($1 / $1 $2 ($3 / $3))"); //'s1p :before s2d' -> :temporal (s1p / s1p :before (s2d / s2d))
    console.log(value);
    db_penman_text += ' ' + value;
  }

    modal_rels.forEach(myFunction3);
  function myFunction3(value) {
  	value = value.replace(/([a-zA-Z0-9]+) (:[a-zA-Z\-\s]+) ([a-zA-Z0-9]+)/gm, ":modal ($1 / $1 $2 ($3 / $3))");
    console.log(value);
    db_penman_text += ' ' + value;

  }

    coref_rels.forEach(myFunction4);
  function myFunction4(value) {
  	value = value.replace(/([a-zA-Z0-9]+) (:[a-zA-Z\-\s]+) ([a-zA-Z0-9]+)/gm, ":coref ($1 / $1 $2 ($3 / $3))");
    console.log(value);
    db_penman_text += ' ' + value;

  }
 	// console.log('db_penman_text ', db_penman_text);
  return db_penman_text;
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
 * load the annotation for current sentence from database
 * @param doc_annot: pennman doc annotation directly from database, with html encoding, but no html tags
 * @param curr_doc_umr: dictionary
 * @param curr_sent_id:
 */
function load_doc_history(doc_annot, curr_doc_umr, curr_sent_id){
    let modal_triples = generateModalUmr(`amr${curr_sent_id}`); //returns a list of triples, umr is changed to sentLevel umr
    let modal_triples_strings = modal_triples.map(t => t.join(" "));

    if(doc_annot === "" || doc_annot.includes('empty umr')){ //empty umr是历史遗留问题
        doc_annot = `&lt;div id=&#34;amr&#34;&gt;(s${curr_sent_id} / sentence)&lt;br&gt;&lt;/div&gt;`;
    }

    let transformed_doc_annot = inverseUmrTransform(doc_annot); //doc_annot is triples graph, tranformed_doc_annot is penman format graph
    setInnerHTML('load-plain', deHTML(transformed_doc_annot));
    umr = JSON.parse(curr_doc_umr);//umr is from database
    if (Object.keys(umr).length === 0 || Object.keys(umr).length === 1){
        umr['n'] = 1;
        umr['1.v'] = "s"+curr_sent_id; // number change with current sentence
        umr['1.s'] = "";
        umr['1.n'] = 0;
        umr['1.c'] = "sentence";
    }
    loadField2amr();//umr is not changed here, due to the change of code in loadField2amr()
    let current_triples = getTriplesFromUmr(umr);
    let current_triples_strings = current_triples.map(t => t.join(" "));

    modal_triples_strings = modal_triples_strings.filter(function(val) {
      return current_triples_strings.indexOf(val) === -1;
    });
    modal_triples = modal_triples_strings.map(s => s.split(" "));

    for (let i = 0; i < modal_triples.length; i++) {
        exec_command(`s${curr_sent_id} :modal ${modal_triples[i][0]}`, '1');
        exec_command(`${modal_triples[i][0]} ${modal_triples[i][1]} ${modal_triples[i][2]}`, '1');
        show_amr('show');
    }
    show_amr();
}

function docUMR2db() {
    console.log("docUMR2db is called");
    let doc_id = document.getElementById('doc_id').innerText;
    let snt_id = document.getElementById('curr_shown_sent_id').innerText;
    let umrHtml = document.getElementById('db-amr').outerHTML;
    umrHtml = umrHtml.replace('<div id="db-amr">', '<div id="amr">');

    // umrHtml = umrHtml.replace(/\n/g, "<br>\n");
    umrHtml = umrHtml.replace(/\n/g, "");
    umrHtml = umrHtml.replace(/&xA;/g, "\n");
    console.log('doc umr to save in db: ' + umrHtml);

    fetch(`/doclevel/${doc_id}_${snt_id}#amr`, {
        method: 'POST',
        body: JSON.stringify({"umr": umrHtml, "snt_id": snt_id, "umr_dict": umr})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        console.log(data); //amr got returned from server
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
}

/**
 * takes in different senses of a lemma and generate the secondary menu of find lemma
 * @param senses a dictionary looks like {"res": [{"name": lemma, "desc": different senses}]}
 */
function getSenses(senses) {
    submit_query(); // update the current mode if named Entity box has something filled in
    let genDrop = document.getElementById('genericDropdown');
    genDrop.innerHTML = "";
    if (genDrop.childElementCount > 0) {
        // genDrop.classList.toggle("show");
    } else {
        senses.res.forEach(function (value, index, array) {
            let genLink = document.createElement("a");
            genLink.innerHTML = value.name;
            genLink.setAttribute("href", `javascript:submit_query(); submit_template_action('${current_mode}', "${value.name}"); clearInput()`);
            genLink.setAttribute("title", value.desc);
            genLink.setAttribute("id", "xx");
            genLink.setAttribute("class", "dropdown-item");
            // genDrop.appendChild(genLink);
            let genLi = document.createElement("li");
            genLi.appendChild(genLink);
            genDrop.appendChild(genLi);
        });
        // genDrop.classList.toggle("show");
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

/**
 * record the current concept from the selected tokens
 */
function submit_concept() {
    current_concept = document.getElementById('selected_tokens').innerText;
    current_concept = current_concept.replace("'", "\'");
    console.log("current_concept is: " + current_concept);
}

/**
 * get the info from panel
 */
function submit_query(){
    let r = '';
    if(document.getElementById('roles1')){
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
    }else{
        av = document.getElementById('attribute_values3').value;
    }

    if(r){
        current_relation = r;
        current_mode = "add";
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

    clearInput();
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
    } else if (option === ':polarity') {
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'block';
    } else if (option === ':mode'){
        document.getElementById("aspect-attribute").style.display = 'none';
        document.getElementById("polarity-attribute").style.display = 'none';
        document.getElementById("mode-attribute").style.display = 'block';
    }
}

function multipleWords() {
    let c = current_concept.replace(" ", "-");
    submit_template_action("add", c)
}

/** undo *******************************************************/
/**
 * Handle the 3 simple types, and null or undefined
 * used to copy a dictionary
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

/**
 * generate a current state with umr variable and concepts information
 * @returns {{}}
 */
function cloneCurrentState() {
    let current_state = {};
    current_state['umr'] = clone(umr);
    current_state['variables'] = clone(variables);
    current_state['concepts'] = clone(concepts);
    last_state_id++;
    current_state['id'] = last_state_id;
    console.log('Created state ' + last_state_id + ' for undo and redo.');
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
    console.log("selectTemplate id is: "+ id);
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
                    console.log("I am here 903");
                    // if clicked on replace from other button
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
 * @param mo_lock
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
        // console.log('variable locs for ' + v + ': ' + getLocs(v));
    }
}

/**
 * add a new (or existing) key value pair (concept: loc) to the concepts dictionary
 * @param c 'boy'
 * @param loc "1.1.3"
 */
function recordConcept(c, loc) {
    if ((c !== undefined) && (c !== '')) {
        let old_value = concepts[c];
        if (old_value) {
            concepts[c] = old_value + ' ' + loc;
        } else {
            concepts[c] = loc;
        }
        // console.log('concept locs for ' + c + ': ' + concepts[c]);
    }
}

/**
 * given concept return variable, with sentence id but without variable counting index
 * @param concept
 * @returns {string} variable (initial)
 */
function newVar(concept) {
    return concept;
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
    console.log("I am here37");
    let v = newVar(concept); // string initial
    let n = umr['n']; // n is how many amr trees currently in amr
    umr['n'] = ++n;
    umr[n + '.c'] = concept;
    umr[n + '.v'] = v;
    umr[n + '.n'] = 0;
    umr[n + '.s'] = '';
    recordVariable(v, n);
    recordConcept(concept, n);
    variable2concept[v] = concept;
    state_has_changed_p = 1;
    console.log('new AMR tree: '+ 'number' + n +' with head var: ' + v);
    return v;
}

/**
 * populate amr, update variables and concepts
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
    console.log('addTriple: head: ' + head + ' role: ' + role + ' arg: ' + arg);
    let head_var_locs = getLocs(head); // buy-01
    let arg_var_locs;
    let arg_variable;
    let arg_concept;
    let arg_string;
    if (head && role && (arg !== undefined) && (arg !== '') && head_var_locs) {
        arg_var_locs = getLocs(arg);
        if (arg_var_locs && (arg_type !== 'concept') && (arg_type !== 'string') && (!role.match(/^:?(li|wiki)$/))) {
            console.log("I am here39");
            arg_variable = arg;
            arg_concept = arg;
            arg_string = arg;
        }else if(arg.includes("(")){
            //doc-level
            console.log("I am here40-1");
            arg_concept = '';
            arg_variable = '';
            arg_string = arg;
        } else if (validEntryConcept(arg) && (arg_type !== 'string') && (!role_unquoted_string_arg(role, arg, '')) && (!role.match(/^:?(li|wiki)$/))) {
            console.log("I am here40");
            arg_concept = trimConcept(arg);
            arg_variable = newVar(arg_concept);
            arg_string = '';
        } else if (validString(arg)) {
            console.log("I am here41");
            arg_string = arg; // car
            arg_concept = arg;
            arg_variable = arg;
        } else if (validString(stripQuotes(arg))) {
            console.log("I am here42");
            arg_string = stripQuotes(arg);
            arg_concept = '';
            arg_variable = '';
        } else {
            console.log('Ill-formed command "' + head + ' ' + role + ' <font color="red">' + arg + '</font>" &nbsp; Last argument should be a concept, string or previously defined variable.');
            return '';
        }
        // head_var_locs += '';
        let head_var_loc_list = argSplit(head_var_locs);
        //add to the last occurrence when the variable occurs multiple times
        let head_var_loc = head_var_loc_list[head_var_loc_list.length-1];
        console.log("head_var_loc: " + head_var_loc);
        // let head_var_loc = head_var_loc_list[0];
        let n_subs = umr[head_var_loc + '.n'];
        umr[head_var_loc + '.n'] = ++n_subs;
        // add_log('subs ' + head_var_loc + '.n: ' + n_subs);
        let new_loc = head_var_loc + '.' + n_subs;
        // add_log('adding ' + head + ' ' + role + ' ' + arg + ' ' + new_loc);
        umr[new_loc + '.v'] = arg_variable;
        umr[new_loc + '.r'] = role;
        umr[new_loc + '.n'] = 0;
        umr[new_loc + '.c'] = arg_concept;
        umr[new_loc + '.s'] = arg_string;

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
                if (validEntryConcept(new_concept)) {
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

// unclear
function renorm_ops(variable) {
    let locs, loc_list, loc, n_subs, sub_loc, sub_role, op_numbers, op_ht, op_number;
    if ((locs = getLocs(variable))
        && (loc_list = argSplit(locs))
        && (loc = loc_list[0])) {
        n_subs = umr[loc + '.n'];
        op_numbers = [];
        op_ht = {};
        for (let i = 1; i <= n_subs; i++) {
            sub_loc = loc + '.' + i;
            if (!umr[sub_loc + '.d']) {
                sub_role = umr[sub_loc + '.r'];
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
        for (let i = 0; i < op_numbers.length; i++) {
            op_number = op_numbers[i];
            sub_loc = op_ht[op_number];
            // add_log('get op_ht[' + op_number + '] = ' + sub_loc);
            umr[sub_loc + '.r'] = ':op' + (i + 1);
        }
        state_has_changed_p = 1;
        exec_command('record reop ' + variable, 1);
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
function show_amr_new_line_doc(loc) {
    let role = umr[loc + '.r'] || '';
    if(role.match(/^(:temporal|:modal|:coref)$/)){
        return 1;
    }else{
        return 0;
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
    return 1;
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

/* load *******************************************************/
/**
 * this is used to load the penman string
 */
function loadField2amr() {
    // console.log("loadField2amr is called: " + document.getElementById('load-plain').value);
    var s;
    if ((s = document.getElementById('load-plain')) != null) {
        var rest = string2amr(s.value);
        // console.log('umr after rest: ', umr);
        if (!rest.match(/\S/)) {
            rest = '';
        }
        if (rest.match(/\S/)) {
            console.log('Remaining text: ' + rest);
        }
    }

    // to be deleted if we can get the info from umr directly
    // var alignArray = document.getElementById('align').innerText.trim().split(/\n/);
    // var alignArrayLen = alignArray.length;
    // for (var i = 0; i < alignArrayLen; i++) {
    //     var splitted_align = alignArray[i].split(":");
    //     var loaded_concept = splitted_align[0].trim();
    //     var loaded_variable = splitted_align[1].trim();
    //     var loaded_align = splitted_align[2].trim();
    //     var loc = getLocs(loaded_variable);
    //     umr[loc + '.a'] = loaded_align;
    // }
    // console.log(umr);

    show_amr('show');
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

/** load*************/

function hideLoadTemplate() {
    console.log("hideLoadTemplate is called");
    let s;
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
    if (evt.target.error.name === "NOT_READABLE_ERR") {
        console.log('loadErrorHandler: File could not be read.');
    } else {
        console.log('loadErrorHandler: Unspecified error');
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

/** save*************/

function localSaved(evt) {
    console.log("localSaved is called");
    let fileString = evt.target.result;
    /*
   if ((s = document.getElementById('info-locally-loaded')) != null) {
      s.innerHTML = 'Loading complete (' + fileString.length + ' bytes)';
   }
   if ((s = document.getElementById('load-plain')) != null) {
      s.value = fileString;
   }
   */
    console.log('Saved AMR: ' + evt.target.result);
}

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

function export_annot(exported_items, content_string) {
    console.log("exported_items: ", exported_items);
    console.log("content_string: ", content_string);
    content_string = content_string.replaceAll('<br>', '\n');
    let doc_name = document.getElementById('filename').innerText
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
        + deHTML2(docUmrTransform(a[3]), false) //todo: change docUmrTransform, because we don't want nested anymore
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


function initialCommand(current_snt_id){
        let parentArg = document.getElementById('parentArg').value;
        let childArg = document.getElementById('childArg').value;
        let role_outter = document.getElementById('doc-level-relations').innerText.split(' ')[0];
        let role_inner = document.getElementById('doc-level-relations').innerText.split(' ')[1];

        let command1 = 's'+ current_snt_id + ' ' + role_outter + ' ' + parentArg;
        exec_command(command1, '1');

        let command2 = parentArg + ' ' + role_inner + ' ' + childArg;
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

function deleteBasedOnVariable(variable){
  let locs = getLocs(variable).split(' ');
  console.log('locs here: ', locs);
  locs.forEach(deleteFunc);
  function deleteFunc(loc){
    let command = 'delete' + ' ' + umr[loc.slice(0, -2)+'.v'] + ' ' + umr[loc + '.r'] + ' ' + variable;
    console.log('command: ', command);
    exec_command(command, '1');
    show_amr('show');
  }
}

function getVariableFromUmr(all_sent_umrs) {
    let sent_variables = [];
    let doc_variables = [];
    let difference_cleaned = [];

    all_sent_umrs.forEach(toVariableList);
    function toVariableList(sent_umr_dict){
        console.log('sent_umr_dict: ', sent_umr_dict);
        Object.keys(sent_umr_dict).forEach(function (key) {
            // console.log(key, sent_umr_dict[key]);
            if (key.match(/.+\.v/) ) {
                if (sent_umr_dict[key.replace(/.v/, '.d')] !== 1){
                    console.log('I am here88: ', key);
                    sent_variables.push(sent_umr_dict[key]);
                }
            }
        });
    }
    console.log('sent_variables: ', sent_variables); // ["s1t", "s2d"]

    Object.keys(umr).forEach(function (key) {
        // console.log(key, doc_umr_dict[key]);
        if (key.match(/.+\.v/)) {
            doc_variables.push(umr[key]);
        }
    });
    console.log('doc_variables: ', doc_variables); // ["s1", "s1t", "DCT", "s1t", "s2e", "s2e", "test", "s2d", "AUTH", "s2e", "AUTH", "s2e", "s1t"]
    let difference = doc_variables.filter(x => !sent_variables.includes(x));
    console.log('difference: ', difference);

    difference.forEach(matchRegularVariables);

    function matchRegularVariables(value) {
        if (value.match(/s[0-9][a-z][0-9]?/)) {
            difference_cleaned.push(value); //["s2e","s2d"]
        }
    }
    let difference_cleaned2 = [...new Set(difference_cleaned)];
    console.log('difference_cleaned2: ', difference_cleaned2);
    return difference_cleaned2; //["s2e"]

}


