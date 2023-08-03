/**
 * populate partial graph page with data from database
 * @param partialGraphsJson
 * @param project_id
 */
function populatePartialGraphs(partialGraphsJson, project_id){
    let partialGraphs;
    try{
        partialGraphs = JSON.parse(partialGraphsJson);
        console.log("partialGraphs: ", partialGraphs);
    }catch (e){
        console.log("Error parsing partialGraphsJson: " + e);
        return;
    }
    for (var key in partialGraphs) {
        if (partialGraphs.hasOwnProperty(key)) {
            let partialGraphUmr = partialGraphs[key];
            let partialGraphString = umrDict2penmanString(partialGraphUmr);
            console.log("partialGraphString: " + partialGraphString);
            console.log("partialGraphKey: " + key);
            let ulElement = document.getElementById("partialGraphs");
            let liElement = document.createElement("li");
            liElement.setAttribute("class", "list-group-item d-flex justify-content-between align-items-center");
            liElement.setAttribute("id", "partial-graph-" + key);
            let spanElement = document.createElement("span");
            spanElement.innerText = key;
            liElement.appendChild(spanElement);
            let spanElement2 = document.createElement("span");
            spanElement2.innerHTML = partialGraphString.replace(/\n/g, "<br>");
            liElement.appendChild(spanElement2);
            let buttonElement = document.createElement("button");
            buttonElement.setAttribute("class", "btn btn-primary");
            buttonElement.setAttribute("type", "submit");
            buttonElement.setAttribute("onclick", "deletePartialGraph(\"" + key + "\", " + project_id + ")");
            buttonElement.innerText = "X";
            liElement.appendChild(buttonElement);
            ulElement.appendChild(liElement);
        }
    }
}

/**
 * Delete a partial graph from the database through X button on partial graph page
 * @param partialGraphKey: the key of the partial graph to delete (assigned by the user)
 * @param project_id: current project id
 */
function deletePartialGraph(partialGraphKey, project_id){
    console.log("deletePartialGraph: " + partialGraphKey);
    let partialGraphsElement = document.getElementById("partial-graph-" + partialGraphKey);
    partialGraphsElement.remove();

    fetch(`/partialgraph/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"partialGraphKey": partialGraphKey}),
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data["msg"]);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
    }).catch(function(error){
        console.log("Fetch error from UMR2db: "+ error);
    });
}

/**
 * add a new partial graph to the database through button on sentlevel page
 */
function recordPartialGraph(){
    let graphDict = {'n': 1 };
    let graphName = document.getElementById("save-partial-graph").value.split(" ")[0];
    let graphHead = document.getElementById("save-partial-graph").value.split(" ")[1];
    console.log("selected variable to be partial graph: ", graphHead);
    console.log("partial graph name: ", graphName);
    let k = getKeyByValue(umr, graphHead);
    console.log("key: ", k);

    Object.keys(umr).forEach(function(key) {
        if(key.startsWith(k.replace('v', ''))){
           graphDict['1.' + key.substring(k.length-1, key.length)] = umr[key];
        }
    });

    console.log("partial_graph: ", graphDict);
    delete graphDict['1.r'];

    partial_graphs[graphName] = graphDict;
    let doc_id = document.getElementById('doc_id').innerText;
    let snt_id = document.getElementById('curr_shown_sent_id').innerText;
    let owner_id = document.getElementById('user_id').innerText;
    let doc_sent_id = doc_id + "_" + snt_id + "_" + owner_id;

    fetch(`/sentlevel/${doc_sent_id}`, {
        method: 'POST',
        body: JSON.stringify({"partial_graphs": partial_graphs})
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data['msg']);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
        populatePartialGraphOptionList();
    }).catch(function(error){
        console.log("Fetch error from recordPartialGraph: "+ error);
    });
}

/**
 * populate partial graphs dropdown menu on sentlevel page
 */
function populatePartialGraphOptionList(){
    let partialGraphDropdown = document.getElementById("partial-graph");
    while (partialGraphDropdown.options.length > 0) {
        partialGraphDropdown.options[0].remove();
    }
    for (let key in partial_graphs) {
        let option = document.createElement("option");
        option.value = key;
        document.getElementById("partial-graph").append(option);
    }
}

/**
 * add existing partial graph to the current umr graph
 */
function addPartialGraph(){
   let graphName= document.getElementById("partial-graphs").value;
   let graphDict = partial_graphs[graphName];
   let role = document.getElementById('roles').value;
   let sorted_keys = Object.keys(graphDict).sort().reverse();
   for(let i = 0; i < sorted_keys.length; i++){
       let key = sorted_keys[i];
       if(key.length <=3){//['n', '1.v', '1.s', '1.r', '1.n', '1.c'] root of partial graph
           if(key.endsWith('.c')){
               let headVar;
               if(graphDict[key] !== ""){
                   headVar = addTriple(current_parent, role, graphDict[key], 'concept');
               }else{
                   let stringField = graphDict[key.replace('.c', '.s')];
                   headVar = addTriple(current_parent, role, stringField, 'string');
               }
               graphDict[key.replace('.c', '.v')] = headVar;
           }
       }else{ //branches of partial graph
           if(key.endsWith('.c')){
               let headVar;
               let parentVar = graphDict[key.slice(0, key.length-4) + '.v'];
               let roleField = graphDict[key.replace('.c', '.r')];
               if(graphDict[key] !== ""){
                   headVar = addTriple(parentVar, roleField, graphDict[key], 'concept');
               }else{
                   let stringField = graphDict[key.replace('.c', '.s')];
                   headVar = addTriple(parentVar, roleField, stringField, 'string');
               }
               graphDict[key.replace('.c', '.v')] = headVar;
           }
       }

   }
   show_amr('show');
}