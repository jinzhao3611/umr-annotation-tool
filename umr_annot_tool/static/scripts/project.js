/**
 * use permission status from database as default value to show in the drop down menu in project page
 * @param permissions a list of permission status from database, aligned with the member_ids below
 * @param member_ids a list of member_ids of current project, aligned with the permissions above
 */
function display_permission(permissions, member_ids){
    for (let j in permissions){
        let optionList = document.getElementById(`permission-${member_ids[j]}`).children;
        if (permissions[j] ==='admin'){//if current is admin, cannot change the permission at all
            for(let i=0; i<optionList.length; i++){
                if(optionList[i].value===permissions[j]){
                    optionList[i].setAttribute('selected', 'selected');
                }else{
                    optionList[i].setAttribute('disabled', '');
                }
            }
        }else{//if current is not admin, grey out admin: can only change permission to option other than admin(edit, annotate, view)
            for(let i=0; i<optionList.length; i++){
                if(optionList[i].value===permissions[j]){
                    optionList[i].setAttribute('selected', 'selected');
                }else if(optionList[i].value==='admin'){
                    optionList[i].setAttribute('disabled', '');
                }
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
                "rm_qc_doc_id": 0,
                "add_da_doc_id": 0,
                "rm_da_doc_id": 0,})
            }).then(function (response) {
                return response.json();
            }).then(function (data) {
            }).catch(function(error){
                console.log("Fetch error: "+ error);
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Navigation handling
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const contentSections = document.querySelectorAll('.content-section');

    function showSection(sectionId) {
        // Hide all sections
        contentSections.forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update active state in navigation
        navLinks.forEach(link => {
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Store active section in localStorage
        localStorage.setItem('activeSection', sectionId);
    }

    // Add click handlers to navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            showSection(sectionId);
        });
    });

    // Show last active section or default to documents
    const lastActiveSection = localStorage.getItem('activeSection') || 'documents';
    showSection(lastActiveSection);

    // Handle collapsible sections
    const collapsibleButtons = document.querySelectorAll('[data-toggle="collapse"]');
    collapsibleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.classList.toggle('show');
                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            }
        });
    });

    // Export functions for external use
    window.display_permission = display_permission;
    window.change_permission = change_permission;
});
