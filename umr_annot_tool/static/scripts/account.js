function rmDoc(doc_id){
    //to remove an unassigned document,1. all annotations in annotation table with the doc_id will be deleted
    //2. all sents in sent table with the doc_id will be deleted
    //3. all docs in doc table with the doc_id will be deleted
    if (confirm("Are you sure you want to delete the whole document? Removal cannot be reversed")) {
        document.getElementById("docIdInDb-"+doc_id).remove(); //remove from list
        fetch(`/account`, {
            method: 'POST',
            body: JSON.stringify({"delete_id": doc_id, "delete_project": 0, "new_project_name": "",})
        }).catch(function(error){
            console.log("Fetch error: "+ error);
        });
    } else {
        alert('canceled');
    }
    location.reload();
}

function addDocToProj(doc_id, project_id){
    // //move modified li element from unassigned documents list to documents in project list
    // let ul = document.getElementById("projectDocs");
    // let li = document.getElementById("unassignedDoc-"+doc_id);
    // li.children[1].remove(); //remove span "add to current project"
    //
    // let span1 = document.createElement('span');
    // span1.setAttribute('class','badge');
    // span1.innerText="checked out by: jin3";
    // li.append(span1);
    //
    // let span2 = document.createElement('span');
    // span2.setAttribute('class', 'badge');
    // span2.setAttribute('title', "checked out by following members");
    // let span3 = document.createElement('span');
    // span3.setAttribute('class', 'btn btn-xs btn-default');
    // span3.setAttribute('onclick', `addToMyAnnotation(${doc_id});`);
    // span3.innerText="add to My Annotations";
    // span2.append(span3);
    // li.append(span2);
    //
    // let span4 = document.createElement('span');
    // span4.setAttribute('class', 'badge');
    // let span5 = document.createElement('span');
    // span5.setAttribute('class', 'btn btn-xs btn-default');
    // span5.setAttribute('onclick', `removeDocFromProj(${doc_id}, ${project_id});`);
    // span5.innerText="remove from project";
    // span4.append(span5);
    // li.append(span4);
    //
    // ul.append(li);
    // li.setAttribute("id", "projectDoc-"+doc_id);

    //find the doc in doc table with the doc_id, and change the project_id in doc table with the project_id
    fetch(`/project/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"update_doc_id": doc_id,
            "update_doc_project_id": project_id,
            "new_member_name": "",
            "remove_member_id": 0,
            "edit_permission_member_id": 0,
            "edit_permission": "",
        "annotated_doc_id": 0,
        "delete_annot_doc_id": 0,
        "add_qc_doc_id": 0,
        "rm_qc_doc_id": 0})
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
    location.reload();
}

function removeDocFromProj(doc_id, project_id){
    // to remove doc from project: 1. change doc.project_id to 0
    //move modified li element from unassigned documents list to documents in project list
    if (confirm("Are you sure you want to remove this document from the current project? After removing, you can find this document in unassigned documents")) {
        // let ul = document.getElementById("unassignedDocs");
        // let li = document.getElementById("projectDoc-" + doc_id);
        // li.children[1].remove(); //remove span "checked out by member"
        // li.children[1].remove(); //remove button "add to My Annotations"
        // li.children[1].children[0].innerText = "add to current project";
        // li.children[1].children[0].setAttribute("onclick", `addDocToProj(${doc_id}, ${project_id});`)
        // ul.append(li);
        // li.setAttribute("id", "unassignedDoc-" + doc_id);


        fetch(`/project/${project_id}`, {
            method: 'POST',
            body: JSON.stringify({
                "update_doc_id": doc_id,
                "update_doc_project_id": 0,
                "new_member_name": "",
                "remove_member_id": 0,
                "edit_permission_member_id": 0,
                "edit_permission": "",
                "annotated_doc_id": 0,
                "delete_annot_doc_id": 0,
                "add_qc_doc_id": 0,
                "rm_qc_doc_id": 0
            })
        }).catch(function (error) {
            console.log("Fetch error: " + error);
        });
    }else{
        alert('canceled');
    }
    location.reload();
}

function addProj(){
    let project_name = document.getElementById("typed_project_name").value;

    fetch(`/account`, {
        method: 'POST',
        body: JSON.stringify({"new_project_name": project_name, "delete_project": 0, "delete_id": 0})
    }).then(function(response){
        return response.json()
    }).then(function(data){
        let adminProjectId = data['adminProjectId'];
        //add in project list
        let ul = document.getElementById("adminDocs");
        let li = document.createElement("li");
        li.setAttribute("class", "list-group-item d-flex justify-content-between align-items-center");
        li.setAttribute("id", `project-${adminProjectId}`);

        //project name (permission status)
        let a = document.createElement("a");
        a.setAttribute("href", `/project/${adminProjectId}`);
        a.innerText = project_name + "(admin)"; //because the user created this project default to have admin permission
        li.append(a);
        //public viewable toggle button
        let label = document.createElement('label');
        label.setAttribute("class", "switch");
        label.setAttribute('title', 'public viewable: if this button is switched on, not only members of this project, any registered users from other projects can see your annotation through search');
        let input = document.createElement('input');
        input.setAttribute('type', 'checkbox');
        let span3=document.createElement('span');
        span3.setAttribute('class', 'slider');
        label.append(input);
        label.append(span3);
        li.append(label);
        //delete project button
        let span1 = document.createElement('span');
        span1.setAttribute("class", "badge");
        let span2 = document.createElement('span');
        span2.setAttribute('class', "btn btn-xs btn-default");
        span2.setAttribute('onclick', `rmProj(${ adminProjectId }); event.stopPropagation();`)
        span2.innerText = "x";
        span1.append(span2);
        li.append(span1);

        ul.append(li);
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
}

function rmProj(project_id){
    //to remove a project: 1, remove all rows contains the project_id in projectuser table;
    // 2. remove the row with the project_id as id in project table
    // 3. remove all the docs under the project: that include rows in annotation, sent and doc tables
    if (confirm("Are you sure you want to delete the every document and annotation under this project? Removal cannot be reversed")) {
        document.getElementById("project-"+project_id).remove(); //remove project from list
        fetch(`/account`, {
            method: 'POST',
            body: JSON.stringify({"delete_project": project_id, "delete_id": 0, "new_project_name": ""})
        }).catch(function(error){
            console.log("Fetch error: "+ error);
        });
    } else {
        alert('canceled');
    }
}

function addNewMember(project_id){
    let member_name = document.getElementById("new_member_name").value;

    fetch(`/project/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"new_member_name": member_name,
            "update_doc_id": 0,
            "update_doc_project_id": 0,
            "remove_member_id":0,
            "edit_permission_member_id": 0,
            "edit_permission": "",
            "annotated_doc_id": 0,
            "delete_annot_doc_id": 0,
            "add_qc_doc_id": 0,
            "rm_qc_doc_id": 0})
    }).then(function(response){
        return response.json()
    }).then(function(data){
        // let newMemberUserId = data['new_member_user_id'];
        // //add in members list
        // let ul = document.getElementById("all-members");
        // let li = document.createElement("li");
        // li.setAttribute("class", "list-group-item d-flex justify-content-between align-items-center");
        // li.setAttribute("id", `projectMember-${newMemberUserId}`);
        //
        // let a = document.createElement("a");
        // a.setAttribute("href", `/search/${project_id}?member_id=${newMemberUserId}`);
        // a.setAttribute("title", "click on member to search their annotation");
        // a.innerText = member_name + "(member)";
        // li.append(a);
        //
        // let span1 = document.createElement('span');
        // span1.setAttribute("class", "badge");
        // let span2 = document.createElement('span');
        // span2.setAttribute('class', "btn btn-xs btn-default");
        // span2.setAttribute('onclick', `rmMember(${newMemberUserId}, ${project_id}); event.stopPropagation();`)
        // span2.innerText = "x";
        // span1.append(span2);
        // li.append(span1);
        // ul.append(li);
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
    location.reload();
}

function rmMember(member_id, project_id){
//    to remove member: 1. remove the row that contains current project and current user
    if (confirm("Are you sure you want to remove this user from this project?")) {
        document.getElementById("projectMember-"+member_id).remove(); //remove project from list
        fetch(`/project/${project_id}`, {
            method: 'POST',
            body: JSON.stringify({"remove_member_id": member_id,
                "new_member_name": "",
                "update_doc_id": 0,
                "update_doc_project_id": 0,
                "edit_permission_member_id": 0,
                "edit_permission": "",
                "annotated_doc_id": 0,
                "delete_annot_doc_id": 0,
                "add_qc_doc_id": 0,
                "rm_qc_doc_id": 0
            })
        }).catch(function(error){
            console.log("Fetch error: "+ error);
        });
    } else {
        alert('canceled');
    }
}

/**
 * use permission status from database as default value to show in the drop down menu in project page
 * @param permissions a list of permission status from database, aligned with the member_ids below
 * @param member_ids a list of member_ids of current project, aligned with the permissions above
 */
function display_permission(permissions, member_ids){
    for (let j in permissions){
        let optionList = document.getElementById(`permission-${member_ids[j]}`).children;
        for(let i=0; i<optionList.length; i++){
            if(optionList[i].value===permissions[j]){
                optionList[i].setAttribute('selected', 'selected');
            }
        }
    }
}

/**
 * add one event listener to each of all the member permission dropdown menus, if the permission changed, the new permission status will be returned to route to update database
 * @param project_id current project id
 */
function change_permission(project_id){
    let selectElements = document.querySelectorAll(`[id^="permission-"]`);
    for (let i=0; i <selectElements.length; i++){
        selectElements[i].addEventListener('change', (event) => {
            console.log(`You like ${event.target.value}`);
            fetch(`/project/${project_id}`, {
                method: 'POST',
                body: JSON.stringify({"remove_member_id": 0,
                "new_member_name": "",
                "update_doc_id": 0,
                "update_doc_project_id": 0,
                "edit_permission_member_id": parseInt(selectElements[i].id.replace('permission-', '')),
                "edit_permission": selectElements[i].value,
                "annotated_doc_id": 0,
                "delete_annot_doc_id": 0,
                "add_qc_doc_id": 0,
                "rm_qc_doc_id": 0})
            }).then(function (response) {
                return response.json();
            }).then(function (data) {
            }).catch(function(error){
                console.log("Fetch error: "+ error);
            });
        });
    }
}