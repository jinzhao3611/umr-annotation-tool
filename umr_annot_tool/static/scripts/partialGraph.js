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