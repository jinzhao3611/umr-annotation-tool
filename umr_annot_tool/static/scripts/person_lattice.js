console.log('person_lattice.js loaded');

function initPersonLattice() {
    console.log('Initializing person lattice...');
    
    // Define the data structure for the person lattice
    const data = {
        name: "Person",
        children: [
            {
                name: "Non-3rd",
                children: [
                    {
                        name: "1st",
                        children: [
                            { name: "Inclusive", children: [] },
                            { name: "Exclusive", children: [] }
                        ]
                    },
                    { name: "2nd", children: [] }
                ]
            },
            {
                name: "Non-1st",
                children: [
                    { name: "2nd", children: [] },
                    { name: "3rd", children: [] }
                ]
            }
        ]
    };

    // Get current settings from the template
    let currentSetting = {};
    try {
        const currentSettingElement = document.getElementById('current-setting');
        console.log('Current setting element:', currentSettingElement);
        if (currentSettingElement) {
            const currentSettingText = currentSettingElement.textContent.trim();
            console.log('Current setting text:', currentSettingText);
            if (currentSettingText) {
                currentSetting = JSON.parse(currentSettingText);
                console.log('Parsed current settings:', currentSetting);
            }
        }
    } catch (error) {
        console.error('Error parsing current settings:', error);
        // Keep default empty object
    }

    // Set up the dimensions and margins
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Remove any existing SVG
    d3.select("#lattice-container svg").remove();

    // Create the SVG container
    const svg = d3.select("#lattice-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create the tree layout
    const tree = d3.tree()
        .size([height, width]);

    // Convert the data to D3's hierarchical format
    const root = d3.hierarchy(data);

    // Assign the data to the tree layout
    const treeData = tree(root);

    // Create the links
    const links = svg.selectAll(".link")
        .data(treeData.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x));

    // Create the nodes
    const nodes = svg.selectAll(".node")
        .data(treeData.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    // Add circles for the nodes
    nodes.append("circle")
        .attr("r", 10)
        .style("fill", "#fff")
        .style("stroke", "steelblue")
        .style("stroke-width", "2px");

    // Add labels for the nodes
    nodes.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -15 : 15)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);

    // Function to save settings to the database
    function saveSettings(settings) {
        console.log('Saving settings:', settings);
        const projectId = window.location.pathname.split('/').pop();
        console.log('Project ID:', projectId);
        
        fetch(`/person/${projectId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lattice_setting: settings
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Save response:', data);
            if (data.msg_category === 'success') {
                console.log('Settings saved successfully');
                // Show success message
                const errorMsg = document.getElementById('error-msg');
                errorMsg.textContent = data.msg;
                errorMsg.className = 'success-msg';
            } else {
                console.error('Error saving settings:', data.msg);
                // Show error message
                const errorMsg = document.getElementById('error-msg');
                errorMsg.textContent = data.msg;
                errorMsg.className = '';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Show error message
            const errorMsg = document.getElementById('error-msg');
            errorMsg.textContent = 'Error saving settings';
            errorMsg.className = '';
        });
    }

    // Add toggle switches for all nodes except the root
    const toggles = nodes.filter(d => d.data.name !== "Person")
        .append("foreignObject")
        .attr("width", 30)
        .attr("height", 17)
        .attr("x", d => d.children ? -45 : 15)
        .attr("y", -25)
        .append("xhtml:label")
        .attr("class", "toggle-switch");

    toggles.append("xhtml:input")
        .attr("type", "checkbox")
        .attr("id", d => d.data.name.toLowerCase().replace(/[^a-z0-9]/g, '_'))
        .property("checked", d => {
            const nodeName = d.data.name;
            console.log('Setting initial state for node:', nodeName, 'value:', currentSetting[nodeName]);
            return currentSetting[nodeName] !== false; // Default to true if not set
        })
        .on("change", function(event, d) {
            const isChecked = this.checked;
            const nodeName = d.data.name;
            console.log('Toggle changed for node:', nodeName, 'new state:', isChecked);
            
            // Update settings object
            const newSettings = { ...currentSetting };
            newSettings[nodeName] = isChecked;
            
            // Save to database
            saveSettings(newSettings);
        });

    toggles.append("xhtml:span")
        .attr("class", "toggle-slider");
} 