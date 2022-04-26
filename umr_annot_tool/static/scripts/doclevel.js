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
 * @param curr_doc_umr: dictionary
 * @param curr_sent_id:
 */
function load_doc_history(curr_doc_umr, curr_sent_id){
    let modal_triples = generateModalUmr(`amr${curr_sent_id}`); //returns a list of triples, umr is changed to sentLevel umr
    let modal_triples_strings = modal_triples.map(t => t.join(" "));

    umr = JSON.parse(curr_doc_umr);//umr is from database
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


function initialCommand(current_snt_id){
        let parentArg = document.getElementById('parentArg').value;
        let childArg = document.getElementById('childArg').value;
        let role_outter = document.getElementById('doc-level-relations').innerText.split(' ')[0];
        let role_inner = document.getElementById('doc-level-relations').innerText.split(' ')[1];

        let command1 = 's'+ current_snt_id +'s0' + ' ' + role_outter + ' ' + parentArg;
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

function show_amr_new_line_doc(loc) {
    let role = umr[loc + '.r'] || '';
    if(role.match(/^(:temporal|:modal|:coref)$/)){
        return 1;
    }else{
        return 0;
    }
}