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

function applyCurrentSettings(currentSetting){
    console.log("currentSetting: " + JSON.stringify(currentSetting));
    for (let key in currentSetting) {
        if (currentSetting.hasOwnProperty(key)) {
            console.log(key + " -> " + currentSetting[key]);
            if (currentSetting[key] === true) {
                document.getElementById(key).checked = true;
            }else{
                document.getElementById(key).checked = false;
            }
        }
    }
}

function waitForElm(selector) {https://stackoverflow.com/questions/5525071/how-to-wait-until-an-element-exists
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}