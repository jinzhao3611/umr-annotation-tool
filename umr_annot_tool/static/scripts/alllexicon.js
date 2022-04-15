/**
 * when rendering the alllexicon.html, populate lexicon entries in the table with data from database
 * @param lexiJson - json object containing a dictionary of lexicon entries, key is lemma, value is frame
 * @param project_id - current project id
 */
function populateLexi(lexiJson, project_id){
    let lexi;
    try{
        lexi = JSON.parse(lexiJson);
    }catch (e){
        console.log("Error parsing lexiJson: " + e);
        return;
    }
    for (var lemmaKey in lexi) {
        if (lexi.hasOwnProperty(lemmaKey)) {
            let ulElement = document.getElementById("lexi");
            let liElement = document.createElement("li");
            liElement.setAttribute("class", "list-group-item d-flex justify-content-between align-items-center");
            liElement.setAttribute("id", "lexi-" + lemmaKey);
            let spanElement = document.createElement("span");
            spanElement.innerText = lemmaKey;
            liElement.appendChild(spanElement);
            console.log("lexi[lemmaKey]: ", lexi[lemmaKey]);

            let spanElement2 = document.createElement("span");
            spanElement2.setAttribute("contentEditable", "true");
            spanElement2.setAttribute("id", "lexi-entry-" + lemmaKey);
            spanElement2.innerText = JSON.stringify(lexi[lemmaKey], null, 2);
            liElement.appendChild(spanElement2);

            let buttonElement = document.createElement("button");
            buttonElement.setAttribute("class", "btn btn-primary");
            buttonElement.setAttribute("type", "submit");
            buttonElement.setAttribute("onclick", "deleteLexiEntry(\"" + lemmaKey + "\", " + project_id + ")");
            buttonElement.innerText = "Delete Entry";
            liElement.appendChild(buttonElement);
            ulElement.appendChild(liElement);

            let buttonElement2 = document.createElement("button");
            buttonElement2.setAttribute("class", "btn btn-secondary");
            buttonElement2.setAttribute("type", "submit");
            buttonElement2.setAttribute("onclick", "saveLexiEntry(\"" + lemmaKey + "\", " + project_id + ")");
            buttonElement2.innerText = "save Changes";
            liElement.appendChild(buttonElement2);
            ulElement.appendChild(liElement);
        }
    }
}

/**
 * when rendering the alllexicon.html, populate "share this lexicon with your other projects" dropdown menu with current user's project names
 * @param allProjects - json object containing a list of all project names of current user
 */
function populateAllProjects(allProjects){
    let allProjectsList = JSON.parse(allProjects);
    console.log("allProjectsList: ", allProjectsList);
    for(let i = 0; i < allProjectsList.length; i++){
        let projectName = allProjectsList[i];
        let optionElement = document.createElement("option");
        optionElement.setAttribute("value", projectName);
        optionElement.innerText = projectName;
        document.getElementById("all-project").appendChild(optionElement);
    }
}

/**
 * when click on "export lexicon" button on alllexicon.html, export lexicon entries to a json file
 * @param lexi - json object containing a dictionary of lexicon entries, key is lemma, value is frame
 * @param projectName - current project name as the file name as default
 */
function exportLexicon(lexi, projectName,){
    console.log("lexi from exportLexicon: ", lexi);
    let lexi_dict = JSON.parse(lexi);
    if (window.BlobBuilder && window.saveAs) {
        let filename = 'exported_lexicon_' + projectName + '.json';
        console.log('Saving file ' + filename + ' on your computer, typically in default download directory');
        var bb = new BlobBuilder();
        bb.append(JSON.stringify(lexi_dict, null, 2));
        saveAs(bb.getBlob(), filename);
    } else {
        console.log('This browser does not support the BlobBuilder and saveAs. Unable to save file with this method.');
    }
}

/**
 * when click on "delete whole lexicon" button on alllexicon.html, delete all lexicon entries
 * @param project_id - current project id
 */
function deleteLexicon(project_id){
    if(confirm('are you sure you want to delete the whole lexicon of this project? ')){
       fetch(`/alllexicon/${project_id}`, {
            method: 'POST',
            body: JSON.stringify({"changeLemmaKey": "", "entry":"",  "deleteLemmaKey": "", "share2projectName": "", "deleteLexicon": true}),
        }).then(function (response) {
            return response.json();
        }).then(function (data) {
            setInnerHTML("error_msg", data["msg"]);
            document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
        }).catch(function(error){
            console.log("Fetch error from deleteLexicon: "+ error);
        });
    }
}

/**
 * when click on "share " button on alllexicon.html, share this lexicon with other projects
 * @param project_id - current project id
 */
function shareWithProject(project_id){
    let share2projectName = document.getElementById('all-projects').value;

   fetch(`/alllexicon/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"changeLemmaKey":"", "entry":"",  "deleteLemmaKey": "", "share2projectName": share2projectName, "deleteLexicon": false}),
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data["msg"]);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
    }).catch(function(error){
        console.log("Fetch error from shareWithProject: "+ error);
    });
}

/**
 * when click on "save changes" button on alllexicon.html, save changes to lexicon entries
 * @param lemmaKey - lemma key of the lexicon entry
 * @param project_id - current project id
 */
function saveLexiEntry(lemmaKey, project_id){
    console.log("saveLexiEntry: ", lemmaKey, project_id);
    let lexiEntry;
    try{
        lexiEntry = JSON.parse(document.getElementById("lexi-entry-" + lemmaKey).innerText);
    }catch (e){
        console.log("Error parsing lexiEntry: " + e);
        setInnerHTML("error_msg", "new changes doesn't conform to JSON format, save entry failed");
        document.getElementById("error_msg").className = `alert alert-danger`;
        return;
    }
    fetch(`/alllexicon/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"changeLemmaKey": lemmaKey, "entry": JSON.stringify(lexiEntry), "deleteLemmaKey": "", "share2projectName": "", "deleteLexicon": false}),
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
 * when click on "delete" button on alllexicon.html, delete a lexicon entry
 * @param lemmaKey - lemma key of the lexicon entry
 * @param project_id - current project id
 */
function deleteLexiEntry(lemmaKey, project_id){
    console.log("deletePartialGraph: " + lemmaKey);
    let entry = document.getElementById("lexi-" + lemmaKey);
    entry.remove();

    fetch(`/alllexicon/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"changeLemmaKey": "", "entry": "", "deleteLemmaKey": lemmaKey, "share2projectName": "", "deleteLexicon": false}),
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data["msg"]);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
    }).catch(function(error){
        console.log("Fetch error from UMR2db: "+ error);
    });
}