/**
 * populate partial graph page with data from database
 * @param lexiJson
 * @param project_id
 */
function populateLexi(lexiJson, project_id){
    let lexi;
    try{
        lexi = JSON.parse(lexiJson);
        console.log("lexi: ", lexi);
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
            spanElement2.innerText = JSON.stringify(lexi[lemmaKey], null, 2);
            liElement.appendChild(spanElement2);

            let buttonElement = document.createElement("button");
            buttonElement.setAttribute("class", "btn btn-primary");
            buttonElement.setAttribute("type", "submit");
            buttonElement.setAttribute("onclick", "deleteLexi(\"" + lemmaKey + "\", " + project_id + ")");
            buttonElement.innerText = "X";
            liElement.appendChild(buttonElement);
            ulElement.appendChild(liElement);
        }
    }
}

/**
 * Delete a partial graph from the database through X button on partial graph page
 * @param lemmaKey: the key of the partial graph to delete (assigned by the user)
 * @param project_id: current project id
 */
function deleteLexi(lemmaKey, project_id){
    console.log("deletePartialGraph: " + lemmaKey);
    let partialGraphsElement = document.getElementById("lexi-" + lemmaKey);
    partialGraphsElement.remove();

    fetch(`/alllexicon/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"lemmaKey": lemmaKey}),
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        setInnerHTML("error_msg", data["msg"]);
        document.getElementById("error_msg").className = `alert alert-${data['msg_category']}`;
    }).catch(function(error){
        console.log("Fetch error from UMR2db: "+ error);
    });
}