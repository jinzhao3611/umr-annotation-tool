function fetchLatticeSetting(route, project_id){
    console.log("route: " + route);
    console.log("project_id: " + project_id);
    let dropDownMenuItems, index;
    let settings = {};

    dropDownMenuItems = document.getElementsByTagName('input');
    for (index = 0; index < dropDownMenuItems.length; ++index) {
        settings[dropDownMenuItems[index].id] = dropDownMenuItems[index].checked;
    }
    console.log("setting: " + JSON.stringify(settings));
    fetch(`/${route}/${project_id}`, {
        method: 'POST',
        body: JSON.stringify({"lattice_setting": settings}),
    }).catch(error => console.error('Modal Setting Error:', error));
}