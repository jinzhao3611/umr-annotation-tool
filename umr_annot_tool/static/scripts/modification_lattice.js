console.log('modification_lattice.js loaded');

function initModificationLattice() {
    console.log('Initializing modification lattice...');
    
    // Define the data structure for the modification lattice
    const modificationNodes = [
        { id: ':mod', level: 0 },
        { id: ':medium', level: 1, parents: [':mod'] },
        { id: ':topic', level: 1, parents: [':mod'] },
        { id: ':consist-of', level: 1, parents: [':mod'] },
        { id: ':age', level: 1, parents: [':mod'] }
    ];
    
    // Get current settings from the template
    let currentSetting = {};
    try {
        const currentSettingElement = document.getElementById('modification-current-setting');
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
    
    // Set up the dimensions and margins - increase top margin to move lattice down
    const margin = { top: 80, right: 250, bottom: 50, left: 150 };
    const width = 700 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Remove any existing SVG
    d3.select("#modification-lattice-container svg").remove();
    
    // Create the SVG container
    const svg = d3.select("#modification-lattice-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Draw the modification lattice
    // Level 0: :mod node
    svg.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 10)
        .style("fill", "#fff")
        .style("stroke", "steelblue")
        .style("stroke-width", "2px");
        
    svg.append("text")
        .attr("x", 15)
        .attr("y", 5)
        .text(":mod");
        
    // Level 1: child nodes
    const childNodes = modificationNodes.filter(node => node.level === 1);
    const ySpacing = 45; // Increase spacing between nodes
    
    childNodes.forEach((node, i) => {
        const yPos = (i * ySpacing) - ((childNodes.length - 1) * ySpacing / 2);
        
        // Draw node
        svg.append("circle")
            .attr("cx", 100)
            .attr("cy", yPos)
            .attr("r", 10)
            .style("fill", "#fff")
            .style("stroke", "steelblue")
            .style("stroke-width", "2px");
            
        // Calculate text width based on node ID length
        const textLength = node.id.length * 8; // Approximate width of text
        
        // Draw label
        svg.append("text")
            .attr("x", 115)
            .attr("y", yPos + 5)
            .text(node.id);
            
        // Draw link to parent
        svg.append("path")
            .attr("d", `M 10 0 L 90 ${yPos}`)
            .attr("stroke", "steelblue")
            .attr("stroke-width", 2)
            .attr("fill", "none");
            
        // Add toggle switch - position it after the text
        const toggleXPosition = 115 + textLength + 10; // Position after text with some margin
        
        const toggleGroup = svg.append("g")
            .attr("transform", `translate(${toggleXPosition}, ${yPos - 10})`);
            
        // Create a foreignObject to contain the HTML toggle switch
        const fo = toggleGroup.append("foreignObject")
            .attr("width", 30)
            .attr("height", 17);
            
        // Create the HTML elements for the toggle switch
        const toggleHtml = `
            <label class="toggle-switch" xmlns="http://www.w3.org/1999/xhtml">
                <input type="checkbox" id="${node.id.replace(':', '')}_toggle" ${currentSetting[node.id] !== false ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        `;
        
        fo.html(toggleHtml);
        
        // Set up event handler for toggle switch
        setTimeout(() => {
            const toggleElement = document.getElementById(`${node.id.replace(':', '')}_toggle`);
            if (toggleElement) {
                toggleElement.addEventListener('change', function() {
                    const isChecked = this.checked;
                    const nodeId = node.id;
                    console.log('Toggle changed for node:', nodeId, 'new state:', isChecked);
                    
                    // Update settings object
                    const newSettings = { ...currentSetting };
                    newSettings[nodeId] = isChecked;
                    
                    // Save to database
                    saveSettings(newSettings);
                });
            }
        }, 100);
    });
    
    // Function to save settings to the database
    function saveSettings(settings) {
        console.log('Saving settings:', settings);
        const projectId = window.location.pathname.split('/').pop();
        console.log('Project ID:', projectId);
        
        fetch(`/modification/${projectId}`, {
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
                const errorMsg = document.getElementById('modification-error-msg');
                errorMsg.textContent = data.msg;
                errorMsg.className = 'success-msg';
            } else {
                console.error('Error saving settings:', data.msg);
                // Show error message
                const errorMsg = document.getElementById('modification-error-msg');
                errorMsg.textContent = data.msg;
                errorMsg.className = '';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Show error message
            const errorMsg = document.getElementById('modification-error-msg');
            errorMsg.textContent = 'Error saving settings';
            errorMsg.className = '';
        });
    }
} 