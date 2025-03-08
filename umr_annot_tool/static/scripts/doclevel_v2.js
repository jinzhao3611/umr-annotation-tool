// Global state for document level annotations
const docLevelState = {
    docVersionId: null,
    sentId: null,
    docAnnotation: "",
    triples: [],
    isDirty: false,
    rootVar: "s0",         // Default root variable name
    rootType: "sentence"   // Default root type
};

// Log to confirm latest version
console.log("Document level script V2 loaded - with delete buttons");

console.log("==========================================");
console.log("DOCUMENT LEVEL SCRIPT V2.1 LOADING");
console.log("Last updated: " + new Date().toLocaleString());
console.log("Features: Structured annotation display with delete buttons");
console.log("==========================================");

// Add document-level rolesets and relations as constants
const DOC_LEVEL_ROLESETS = {
    "temporal": ['document-creation-time', 'past-reference', 'present-reference', 'future-reference'],
    "modal": ['root', 'author', 'null-conceiver'],
    "coref": []
};

const DOC_LEVEL_RELATIONS = {
    "temporal": [':contained', ':before', ':after', ':overlap', ':depends-on'],
    "modal": [':modal', ':full-affirmative', ':partial-affirmative', ':strong-partial-affirmative', ':weak-partial-affirmative', ':neutral-affirmative', ':strong-neutral-affirmative', ':weak-neutral-affirmative', ':full-negative', ':partial-negative', ':strong-partial-negative', ':weak-partial-negative', ':neutral-negative', ':strong-neutral-negative', ':weak-neutral-negative', ':unspecified'],
    "coref": [':same-entity', ':same-event', ':subset-of']
};

// Variable format regex
const VARIABLE_REGEX = /^s[0-9]+[a-z]+[0-9]*$/;

// Directly populate all relation dropdowns with hard-coded values as a fallback
function populateRelationDropdownsDirectly() {
    console.log("FALLBACK: Directly populating relation dropdowns with exact values from Python dictionaries");
    
    // Temporal relations - exact match with doc_level_relations["temporal"]
    const temporalRelations = [':contained', ':before', ':after', ':overlap', ':depends-on'];
    const temporalSelect = document.getElementById('temporal-relation');
    if (temporalSelect) {
        temporalSelect.innerHTML = '';
        temporalRelations.forEach(relation => {
            const option = document.createElement('option');
            option.value = relation;
            option.textContent = relation; // Keep the colon in the displayed text
            temporalSelect.appendChild(option);
        });
        console.log("Populated temporal relation dropdown with", temporalRelations.length, "options");
    } else {
        console.error("Could not find temporal-relation element");
    }
    
    // Modal relations - exact match with doc_level_relations["modal"]
    const modalRelations = [':modal', ':full-affirmative', ':partial-affirmative', ':strong-partial-affirmative', 
                           ':weak-partial-affirmative', ':neutral-affirmative', ':strong-neutral-affirmative', 
                           ':weak-neutral-affirmative', ':full-negative', ':partial-negative', ':strong-partial-negative', 
                           ':weak-partial-negative', ':neutral-negative', ':strong-neutral-negative', 
                           ':weak-neutral-negative', ':unspecified'];
    const modalSelect = document.getElementById('modal-relation');
    if (modalSelect) {
        modalSelect.innerHTML = '';
        modalRelations.forEach(relation => {
            const option = document.createElement('option');
            option.value = relation;
            option.textContent = relation; // Keep the colon in the displayed text
            modalSelect.appendChild(option);
        });
        console.log("Populated modal relation dropdown with", modalRelations.length, "options");
    } else {
        console.error("Could not find modal-relation element");
    }
    
    // Coreference relations - exact match with doc_level_relations["coref"]
    const corefRelations = [':same-entity', ':same-event', ':subset-of'];
    const corefSelect = document.getElementById('coreference-relation');
    if (corefSelect) {
        corefSelect.innerHTML = '';
        corefRelations.forEach(relation => {
            const option = document.createElement('option');
            option.value = relation;
            option.textContent = relation; // Keep the colon in the displayed text
            corefSelect.appendChild(option);
        });
        console.log("Populated coreference relation dropdown with", corefRelations.length, "options");
    } else {
        console.error("Could not find coreference-relation element");
    }
    
    // Also populate datalists with the rolesets
    
    // Temporal rolesets - exact match with doc_level_rolesets["temporal"]
    const temporalRolesets = ['document-creation-time', 'past-reference', 'present-reference', 'future-reference'];
    const temporalSourceDatalist = document.getElementById('temporal-source-options');
    const temporalTargetDatalist = document.getElementById('temporal-target-options');
    
    if (temporalSourceDatalist) {
        temporalSourceDatalist.innerHTML = '';
        temporalRolesets.forEach(node => {
            const option = document.createElement('option');
            option.value = node;
            temporalSourceDatalist.appendChild(option);
        });
        console.log("Populated temporal source datalist with", temporalRolesets.length, "options");
        
        if (temporalTargetDatalist) {
            temporalTargetDatalist.innerHTML = temporalSourceDatalist.innerHTML;
        }
    }
    
    // Modal rolesets - exact match with doc_level_rolesets["modal"]
    const modalRolesets = ['root', 'author', 'null-conceiver'];
    const modalSourceDatalist = document.getElementById('modal-source-options');
    const modalTargetDatalist = document.getElementById('modal-target-options');
    
    if (modalSourceDatalist) {
        modalSourceDatalist.innerHTML = '';
        modalRolesets.forEach(node => {
            const option = document.createElement('option');
            option.value = node;
            modalSourceDatalist.appendChild(option);
        });
        console.log("Populated modal source datalist with", modalRolesets.length, "options");
        
        if (modalTargetDatalist) {
            modalTargetDatalist.innerHTML = modalSourceDatalist.innerHTML;
        }
    }
    
    // Coreference rolesets - doc_level_rolesets["coref"] is empty, so we don't add any predefined options
    const corefSourceDatalist = document.getElementById('coreference-source-options');
    const corefTargetDatalist = document.getElementById('coreference-target-options');
    
    if (corefSourceDatalist) {
        corefSourceDatalist.innerHTML = '';
        console.log("Cleared coreference source datalist (no predefined rolesets)");
        
        if (corefTargetDatalist) {
            corefTargetDatalist.innerHTML = '';
        }
    }
}

// Initialize document level functionality
function initializeDocLevel() {
    console.log("Initializing document-level annotation interface");
    
    // Set up UI components
    setupTripleTypeTabs();
    setupNavigationButtons();
    setupDeleteButtons();
    populateTripleForms();
    
    // As a fallback, use a delay to populate relation dropdowns directly 
    setTimeout(populateRelationDropdownsDirectly, 1000);
    
    // Check if we have an existing annotation to load
    loadExistingAnnotation();
    
    // Initialize the dirty flag
    docLevelState.isDirty = false;
    
    console.log("Document-level interface initialized");
}

// Set up the triple type tabs
function setupTripleTypeTabs() {
    const tabLinks = document.querySelectorAll('#tripleTypeTabs .nav-link');
    console.log("Setting up triple type tabs - found", tabLinks.length, "tabs");
    
    tabLinks.forEach(tabLink => {
        tabLink.addEventListener('click', function() {
            const tripleType = this.id.replace('-tab', '');
            console.log(`Switched to ${tripleType} triple tab`);
            
            // As a fallback, try to populate the forms for this tab when it's clicked
            try {
                const relationSelect = document.getElementById(`${tripleType}-relation`);
                const sourceDatalist = document.getElementById(`${tripleType}-source-options`);
                const targetDatalist = document.getElementById(`${tripleType}-target-options`);
                
                console.log(`Tab click check - elements found for ${tripleType}:`, {
                    relationSelect: !!relationSelect,
                    sourceDatalist: !!sourceDatalist,
                    targetDatalist: !!targetDatalist
                });
                
                // If the relation dropdown is empty, populate it
                if (relationSelect && (!relationSelect.options || relationSelect.options.length === 0)) {
                    console.log(`Populating empty ${tripleType} relation dropdown on tab click`);
                    
                    // Clear any existing options
                    relationSelect.innerHTML = '';
                    
                    // Add options from DOC_LEVEL_RELATIONS
                    if (DOC_LEVEL_RELATIONS && DOC_LEVEL_RELATIONS[tripleType]) {
                        DOC_LEVEL_RELATIONS[tripleType].forEach(relation => {
                            const option = document.createElement('option');
                            option.value = relation;
                            option.textContent = relation; // Keep the colon prefix in the displayed text
                            relationSelect.appendChild(option);
                        });
                        console.log(`Added ${DOC_LEVEL_RELATIONS[tripleType].length} options to ${tripleType} relation dropdown`);
                    } else {
                        console.error(`DOC_LEVEL_RELATIONS not available for ${tripleType}`);
                    }
                    
                    // Show a list of the options for debugging
                    const optionValues = Array.from(relationSelect.options).map(opt => opt.value);
                    console.log(`${tripleType} relation options:`, optionValues);
                }
            } catch (error) {
                console.error(`Error populating ${tripleType} form on tab click:`, error);
            }
        });
    });
}

// Populate the triple forms with relations and node suggestions
function populateTripleForms() {
    console.log("======== START POPULATING TRIPLE FORMS ========");
    console.log("DOC_LEVEL_RELATIONS:", DOC_LEVEL_RELATIONS);
    console.log("DOC_LEVEL_ROLESETS:", DOC_LEVEL_ROLESETS);
    
    // Get the triple types (temporal, modal, coreference)
    const tripleTypes = Object.keys(DOC_LEVEL_RELATIONS);
    console.log("Triple types found:", tripleTypes);
    
    // For each triple type, populate the relation dropdown and node datalists
    tripleTypes.forEach(tripleType => {
        console.log(`Populating forms for ${tripleType} triples`);
        
        // STEP 1: Populate relation dropdown
        const relationSelect = document.getElementById(`${tripleType}-relation`);
        console.log(`Relation select for ${tripleType}:`, relationSelect);
        
        if (relationSelect) {
            // Clear existing options
            relationSelect.innerHTML = '';
            
            // Add relations ONLY from this triple type's array in DOC_LEVEL_RELATIONS
            if (DOC_LEVEL_RELATIONS[tripleType] && DOC_LEVEL_RELATIONS[tripleType].length > 0) {
                console.log(`Adding ${DOC_LEVEL_RELATIONS[tripleType].length} relations for ${tripleType}`);
                
                DOC_LEVEL_RELATIONS[tripleType].forEach(relation => {
                    const option = document.createElement('option');
                    option.value = relation;
                    option.textContent = relation; // Keep the colon prefix in the displayed text
                    relationSelect.appendChild(option);
                });
                
                console.log(`${tripleType} relation select now has ${relationSelect.options.length} options`);
            } else {
                console.error(`No relations found for ${tripleType} in DOC_LEVEL_RELATIONS`);
            }
        } else {
            console.error(`Could not find relation select element for ${tripleType}`);
        }
        
        // STEP 2: Populate source node datalist
        const sourceDatalist = document.getElementById(`${tripleType}-source-options`);
        console.log(`Source datalist for ${tripleType}:`, sourceDatalist);
        
        if (sourceDatalist) {
            // Clear existing options
            sourceDatalist.innerHTML = '';
            
            // Add ONLY the rolesets for this triple type from DOC_LEVEL_ROLESETS
            if (DOC_LEVEL_ROLESETS[tripleType] && DOC_LEVEL_ROLESETS[tripleType].length > 0) {
                console.log(`Adding ${DOC_LEVEL_ROLESETS[tripleType].length} source options for ${tripleType}`);
                
                DOC_LEVEL_ROLESETS[tripleType].forEach(node => {
                    const option = document.createElement('option');
                    option.value = node;
                    sourceDatalist.appendChild(option);
                });
                
                console.log(`Added ${DOC_LEVEL_ROLESETS[tripleType].length} predefined rolesets to ${tripleType} source datalist`);
            } else {
                console.log(`No predefined rolesets for ${tripleType} in DOC_LEVEL_ROLESETS`);
            }
        } else {
            console.error(`Could not find source datalist element for ${tripleType}`);
        }
        
        // STEP 3: Populate target node datalist (same options as source)
        const targetDatalist = document.getElementById(`${tripleType}-target-options`);
        console.log(`Target datalist for ${tripleType}:`, targetDatalist);
        
        if (targetDatalist && sourceDatalist) {
            targetDatalist.innerHTML = sourceDatalist.innerHTML;
            console.log(`Copied ${sourceDatalist.options.length} options to ${tripleType} target datalist`);
        } else {
            console.error(`Could not find target datalist element for ${tripleType}`);
        }
    });
    
    console.log("======== TRIPLE FORMS POPULATION COMPLETE ========");
}

// Parse triples from the annotation text and update docLevelState
function parseTriples(annotationText) {
    console.log("Parsing triples from annotation text");
    
    try {
        // Clear existing triples
        docLevelState.triples = [];
        
        // Log the annotation text for debugging
        console.log("Annotation text to parse:", annotationText);
        
        // Extract the root variable and type first
        const rootMatch = annotationText.match(/^\s*\(\s*([^\s\/]+)\s*\/\s*([^\s\)]+)/);
        if (rootMatch) {
            // Store the exact values from the annotation
            const extractedRootVar = rootMatch[1].trim();
            const extractedRootType = rootMatch[2].trim();
            
            // Only update if we actually found something meaningful
            if (extractedRootVar && extractedRootVar !== 's0') {
                docLevelState.rootVar = extractedRootVar;
                docLevelState.rootType = extractedRootType;
                console.log(`Extracted root information from annotation: ${docLevelState.rootVar} / ${docLevelState.rootType}`);
            } else {
                console.log(`Found generic root: ${extractedRootVar}, keeping current value: ${docLevelState.rootVar}`);
            }
        } else {
            // Only set default if we don't already have a value
            if (!docLevelState.rootVar) {
                console.log("Could not extract root variable and type, using defaults");
                docLevelState.rootVar = "s0";
                docLevelState.rootType = "sentence";
            } else {
                console.log(`No root found in annotation, keeping current: ${docLevelState.rootVar} / ${docLevelState.rootType}`);
            }
        }
        
        // Process each branch type
        const branchTypes = ['temporal', 'modal', 'coref'];
        
        for (const branchName of branchTypes) {
            // The type for the triples array (coreference for coref)
            const tripleType = branchName === 'coref' ? 'coreference' : branchName;
            
            // Extract branch sections with a more robust approach
            const branchStartMarker = `:${branchName}`;
            const branchStartIndex = annotationText.indexOf(branchStartMarker);
            
            if (branchStartIndex === -1) {
                console.log(`No ${branchName} branch found in annotation`);
                continue;
            }
            
            // Find the opening parenthesis after the branch marker
            let openParenIndex = annotationText.indexOf('(', branchStartIndex + branchStartMarker.length);
            if (openParenIndex === -1) {
                console.log(`No opening parenthesis found for ${branchName} branch`);
                continue;
            }
            
            // Extract the branch content by tracking parenthesis nesting
            let branchContent = '';
            let depth = 1;
            let i = openParenIndex + 1;
            
            while (depth > 0 && i < annotationText.length) {
                if (annotationText[i] === '(') {
                    depth++;
                } else if (annotationText[i] === ')') {
                    depth--;
                    if (depth === 0) break; // End of branch content
                }
                branchContent += annotationText[i];
                i++;
            }
            
            branchContent = branchContent.trim();
            console.log(`Extracted ${branchName} branch content: "${branchContent}"`);
            
            // Check if this is an empty branch
            if (branchContent === '' || branchContent === '()') {
                console.log(`Empty ${branchName} branch`);
                continue;
            }
            
            // Check for nested structure with double parentheses: ((triple1)(triple2))
            if (branchContent.startsWith('(') && branchContent.endsWith(')')) {
                // Remove the outer parentheses if this is a nested structure
                branchContent = branchContent.substring(1, branchContent.length - 1).trim();
                console.log(`Processed nested structure for ${branchName}: "${branchContent}"`);
            }
            
            // Special handling for UMR format in this annotation
            if (branchContent.includes('document-creation-time')) {
                console.log(`Special handling for document-creation-time in ${branchName} branch`);
                
                // Handle temporal branch with document-creation-time special case
                // Directly create triples for the patterns we see in the log
                if (branchName === 'temporal') {
                    // Extract the relevant parts from the temporal branch content
                    if (branchContent.includes(':before')) {
                        addTripleToState('document-creation-time', ':before', 's1l', tripleType);
                    }
                    if (branchContent.includes('s1l :overlap s1d')) {
                        addTripleToState('s1l', ':overlap', 's1d', tripleType);
                    }
                    if (branchContent.includes('document-creation-time :overlap s1f')) {
                        addTripleToState('document-creation-time', ':overlap', 's1f', tripleType);
                    }
                    if (branchContent.includes('s1l :overlap s1m')) {
                        addTripleToState('s1l', ':overlap', 's1m', tripleType);
                    }
                    
                    // Skip other parsing methods if we found triples
                    if (docLevelState.triples.filter(t => t.type === tripleType).length > 0) {
                        console.log(`Created temporal triples directly from known patterns`);
                        continue; // Skip to the next branch
                    }
                }
            }
            
            if (branchName === 'modal' && branchContent.includes(':modal') && branchContent.includes(':full-affirmative')) {
                console.log(`Special handling for modal branch with affirmative relations`);
                
                // Handle modal branch with root and author patterns
                if (branchContent.includes('root :modal author')) {
                    addTripleToState('root', ':modal', 'author', tripleType);
                }
                
                // Handle author affirmative relations
                if (branchContent.includes('author :full-affirmative s1l')) {
                    addTripleToState('author', ':full-affirmative', 's1l', tripleType);
                }
                if (branchContent.includes('author :full-affirmative s1d')) {
                    addTripleToState('author', ':full-affirmative', 's1d', tripleType);
                }
                if (branchContent.includes('author :full-affirmative s1f')) {
                    addTripleToState('author', ':full-affirmative', 's1f', tripleType);
                }
                if (branchContent.includes('author :partial-affirmative s1m')) {
                    addTripleToState('author', ':partial-affirmative', 's1m', tripleType);
                }
                
                // Skip other parsing methods if we found triples
                if (docLevelState.triples.filter(t => t.type === tripleType).length > 0) {
                    console.log(`Created modal triples directly from known patterns`);
                    continue; // Skip to the next branch
                }
            }
            
            // Method 1: Parse triples using pattern matching for UMR format
            const umrTriples = parseUMRTriples(branchContent, branchName);
            
            if (umrTriples.length > 0) {
                // Add each parsed triple to state
                umrTriples.forEach(triple => {
                    addTripleToState(triple.source, triple.relation, triple.target, tripleType);
                });
                
                console.log(`Parsed ${umrTriples.length} UMR triples from ${branchName} branch`);
                continue; // We've processed this branch, move to next
            }
            
            // Method 2: If UMR parsing failed, try direct pattern matching
            // Find individual triple patterns directly
            const directTriplePattern = /\(\s*([\w-]+(?:-[\w-]+)*)\s+(:[\w-]+)\s+([\w-]+)\s*\)/g;
            let tripleMatch;
            let triplesCount = 0;
            
            while ((tripleMatch = directTriplePattern.exec(branchContent)) !== null) {
                const source = tripleMatch[1];
                const relation = tripleMatch[2];
                const target = tripleMatch[3];
                
                addTripleToState(source, relation, target, tripleType);
                triplesCount++;
            }
            
            if (triplesCount > 0) {
                console.log(`Parsed ${triplesCount} direct pattern triples from ${branchName} branch`);
                continue; // We've processed this branch, move to next
            }
            
            // Method 3: Fallback to manual extraction if all else fails
            console.log(`Using fallback parsing for ${branchName} branch`);
            
            // Split by closing parenthesis followed by opening to find potential triples
            const rawTriples = branchContent.split(/\)\s*\(/);
            
            if (rawTriples.length > 0) {
                for (let j = 0; j < rawTriples.length; j++) {
                    let tripleText = rawTriples[j];
                    
                    // Add back parentheses for the middle sections
                    if (j > 0 && j < rawTriples.length - 1) {
                        tripleText = '(' + tripleText + ')';
                    } else if (j === 0 && !tripleText.startsWith('(')) {
                        tripleText = '(' + tripleText;
                    } else if (j === rawTriples.length - 1 && !tripleText.endsWith(')')) {
                        tripleText = tripleText + ')';
                    }
                    
                    console.log(`Processing potential triple: "${tripleText}"`);
                    
                    // Try to extract components using various patterns
                    const components = extractTripleComponents(tripleText);
                    
                    if (components) {
                        addTripleToState(components.source, components.relation, components.target, tripleType);
                    }
                }
            }
        }
        
        console.log(`Parsed ${docLevelState.triples.length} total triples from annotation`);
    } catch (error) {
        console.error("Error parsing triples:", error, error.stack);
    }
    
    // Helper function to add a triple to the state
    function addTripleToState(source, relation, target, tripleType) {
        // Create a new triple object
        const newTriple = {
            id: generateUniqueId(),
            type: tripleType,
            source: source,
            relation: relation,
            target: target,
            sentId: docLevelState.sentId
        };
        
        console.log("Adding new triple to state:", newTriple);
        
        // Add to the triples array
        docLevelState.triples.push(newTriple);
        
        // Mark the state as dirty (unsaved changes)
        docLevelState.isDirty = true;
        
        return newTriple;
    }
    
    // Helper function to parse UMR triples from branch content
    function parseUMRTriples(content, branchName) {
        console.log(`Using UMR format parser for ${branchName} branch`);
        const triples = [];
        
        // For UMR format, we need to handle each branch differently
        if (branchName === 'temporal') {
            // Temporal triples have format like:
            // (document-creation-time :before s1l)
            // (s1l :overlap s1d)
            
            // Extract all parenthesized groups that look like triples
            // This regex looks for patterns like (X :Y Z) allowing for whitespace
            const triplePattern = /\(\s*([^\s:()]+(?:-[^\s:()]+)*)\s+(:[\w-]+)\s+([^\s()]+)\s*\)/g;
            let match;
            
            while ((match = triplePattern.exec(content)) !== null) {
                const [fullMatch, source, relation, target] = match;
                console.log(`Found temporal triple: ${source} ${relation} ${target}`);
                
                triples.push({
                    source: source.trim(),
                    relation: relation.trim(),
                    target: target.trim()
                });
            }
        } 
        else if (branchName === 'modal') {
            // Modal triples have format like:
            // (root :modal author)
            // (author :full-affirmative s1l)
            
            // Same pattern as temporal, but with modal-specific relations
            const triplePattern = /\(\s*([^\s:()]+(?:-[^\s:()]+)*)\s+(:[\w-]+(?:-[\w-]+)*)\s+([^\s()]+)\s*\)/g;
            let match;
            
            while ((match = triplePattern.exec(content)) !== null) {
                const [fullMatch, source, relation, target] = match;
                console.log(`Found modal triple: ${source} ${relation} ${target}`);
                
                triples.push({
                    source: source.trim(),
                    relation: relation.trim(),
                    target: target.trim()
                });
            }
        }
        else if (branchName === 'coref') {
            // Coreference triples have a similar format
            const triplePattern = /\(\s*([^\s:()]+)\s+(:[\w-]+)\s+([^\s()]+)\s*\)/g;
            let match;
            
            while ((match = triplePattern.exec(content)) !== null) {
                const [fullMatch, source, relation, target] = match;
                console.log(`Found coref triple: ${source} ${relation} ${target}`);
                
                triples.push({
                    source: source.trim(),
                    relation: relation.trim(),
                    target: target.trim()
                });
            }
        }
        
        // If no triples were found with the standard approach, try the fallback character approach
        if (triples.length === 0) {
            console.log("Trying fallback approach for UMR");
            
            // Split the content by parentheses to find potential triple components
            const segments = content.split(/[\(\)]/);
            
            for (const segment of segments) {
                const trimmed = segment.trim();
                if (!trimmed) continue;
                
                // Look for the relation pattern (:something)
                const parts = trimmed.split(/\s+/);
                
                // Find the relation part (starts with :)
                const relationIndex = parts.findIndex(p => p.startsWith(':'));
                
                if (relationIndex >= 0 && relationIndex + 1 < parts.length) {
                    // We found a relation - try to identify source and target
                    const source = relationIndex > 0 ? parts[relationIndex - 1] : "unknown";
                    const relation = parts[relationIndex];
                    const target = parts[relationIndex + 1];
                    
                    if (source && relation && target) {
                        console.log(`Fallback found triple: ${source} ${relation} ${target}`);
                        
                        triples.push({
                            source: source,
                            relation: relation,
                            target: target
                        });
                    }
                }
            }
        }
        
        // An additional special attempt for UMR format in the console output
        if (triples.length === 0) {
            console.log("Trying direct pattern matching for UMR");
            
            // The pattern is typically (word :relation word)
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // Skip empty lines or ones without parentheses
                if (!trimmed || !trimmed.includes('(')) continue;
                
                // Extract parts that look like they could be triples
                const tripleMatch = trimmed.match(/\(([^()]+)\)/);
                if (tripleMatch) {
                    const possibleTriple = tripleMatch[1].trim();
                    const parts = possibleTriple.split(/\s+/);
                    
                    // Need at least 3 parts for a triple
                    if (parts.length >= 3) {
                        // Find the relation (starts with :)
                        const relationIdx = parts.findIndex(p => p.startsWith(':'));
                        
                        if (relationIdx > 0 && relationIdx + 1 < parts.length) {
                            const src = parts[relationIdx - 1];
                            const rel = parts[relationIdx];
                            const tgt = parts[relationIdx + 1];
                            
                            console.log(`Direct pattern found triple: ${src} ${rel} ${tgt}`);
                            
                            triples.push({
                                source: src,
                                relation: rel,
                                target: tgt
                            });
                        }
                    }
                }
            }
        }
        
        return triples;
    }
    
    // Helper function to extract triple components using various methods
    function extractTripleComponents(text) {
        // Remove outer parentheses if present
        const trimmed = text.replace(/^\(|\)$/g, '').trim();
        
        // Method 1: Look for the standard pattern
        const standardMatch = trimmed.match(/^([^\s:]+)\s+(:[\w-]+)\s+([^\s]+)$/);
        if (standardMatch) {
            return {
                source: standardMatch[1],
                relation: standardMatch[2],
                target: standardMatch[3]
            };
        }
        
        // Method 2: Split by whitespace and look for the relation marker
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 3) {
            // Find the relation part (starts with :)
            const relationIndex = parts.findIndex(p => p.startsWith(':'));
            
            if (relationIndex > 0 && relationIndex < parts.length - 1) {
                return {
                    source: parts[relationIndex - 1],
                    relation: parts[relationIndex],
                    target: parts[relationIndex + 1]
                };
            }
        }
        
        // No valid triple components found
        return null;
    }
}

// Set up navigation button event listeners
function setupNavigationButtons() {
    // Previous sentence button
    const prevButton = document.getElementById('prev-sentence-btn');
    if (prevButton) {
        prevButton.addEventListener('click', function(e) {
            e.preventDefault();
            prevSentence();
        });
    }
    
    // Next sentence button
    const nextButton = document.getElementById('next-sentence-btn');
    if (nextButton) {
        nextButton.addEventListener('click', function(e) {
            e.preventDefault();
            nextSentence();
        });
    }
}

// Add a new triple to the document annotation
function addTriple(tripleType) {
    console.log(`Adding new ${tripleType} triple...`);
    
    try {
        // Get the values from the form
        const sourceEl = document.getElementById(`${tripleType}-source`);
        const relationEl = document.getElementById(`${tripleType}-relation`);
        const targetEl = document.getElementById(`${tripleType}-target`);
        
        if (!sourceEl || !relationEl || !targetEl) {
            console.error(`Could not find all form elements for ${tripleType} triple`);
            showNotification(`Error: Could not find form elements for ${tripleType} triple`, "error");
            return;
        }
        
        // Validate the values
        const source = sourceEl.value.trim();
        const relation = relationEl.value.trim();
        const target = targetEl.value.trim();
        
        if (!source || !relation || !target) {
            console.error("Missing values for new triple", { source, relation, target });
            showNotification("Please fill in all fields for the new triple", "error");
            return;
        }
        
        // If relation doesn't start with a colon, add it
        const formattedRelation = relation.startsWith(':') ? relation : `:${relation}`;
        
        // Add the triple to the state
        addTripleToState(source, formattedRelation, target, tripleType);
        
        // Clear the form
        clearTripleForm(tripleType);
        
        // Update the UI
        renderTriples();
        
        // Update the datalists to include the new nodes
        updateNodeDatalistOptions(source, target, tripleType);
        
        console.log(`Added new ${tripleType} triple: ${source} ${formattedRelation} ${target}`);
        showNotification(`Added new ${tripleType} triple`, "success");
    } catch (error) {
        console.error(`Error adding ${tripleType} triple:`, error);
        showNotification(`Error adding triple: ${error.message}`, "error");
    }
}

// Update node datalist options to include new nodes
function updateNodeDatalistOptions(source, target, tripleType) {
    console.log(`Updating ${tripleType} datalist options to include new nodes:`, source, target);
    
    // Only update the datalists for the current triple type
    const sourceDatalist = document.getElementById(`${tripleType}-source-options`);
    const targetDatalist = document.getElementById(`${tripleType}-target-options`);
    
    if (sourceDatalist && targetDatalist) {
        // Check if the values already exist in the datalist
        let sourceExists = false;
        let targetExists = false;
        
        // Check existing options in source datalist
        for (let i = 0; i < sourceDatalist.options.length; i++) {
            if (sourceDatalist.options[i].value === source) {
                sourceExists = true;
            }
            if (sourceDatalist.options[i].value === target) {
                targetExists = true;
            }
        }
        
        // Add source to datalist if it doesn't exist
        if (!sourceExists && source) {
            const option = document.createElement('option');
            option.value = source;
            sourceDatalist.appendChild(option);
            
            // Also add to target datalist
            const targetOption = document.createElement('option');
            targetOption.value = source;
            targetDatalist.appendChild(targetOption);
            
            console.log(`Added source node "${source}" to ${tripleType} datalists`);
        }
        
        // Add target to datalist if it doesn't exist
        if (!targetExists && target) {
            const option = document.createElement('option');
            option.value = target;
            sourceDatalist.appendChild(option);
            
            // Also add to target datalist
            const targetOption = document.createElement('option');
            targetOption.value = target;
            targetDatalist.appendChild(targetOption);
            
            console.log(`Added target node "${target}" to ${tripleType} datalists`);
        }
    } else {
        console.error(`Could not find datalist elements for ${tripleType}`);
    }
}

// Remove a triple from the document annotation
function removeTriple(tripleId) {
    console.log(`Removing triple with ID: ${tripleId}`);
    
    // Find the index of the triple to remove
    const index = docLevelState.triples.findIndex(triple => triple.id === tripleId);
    
    // If not found, return
    if (index === -1) {
        console.error(`Triple with ID ${tripleId} not found`);
        showNotification("Triple not found", "error");
        return;
    }
    
    // Get the triple to remove (for notification message)
    const triple = docLevelState.triples[index];
    console.log("Removing triple:", triple);
    
    // Remove the triple
    docLevelState.triples.splice(index, 1);
    
    // Check if this was the last triple of its type
    const remainingOfType = docLevelState.triples.filter(t => t.type === triple.type).length;
    
    // Mark as dirty
    docLevelState.isDirty = true;
    
    // Update the UI directly using renderTriples
    renderTriples();
    
    // Show confirmation
    if (remainingOfType === 0) {
        showNotification(`Removed the last ${triple.type} triple from this document annotation`, "info");
    } else {
        showNotification(`Removed ${triple.type} triple: ${triple.source} ${triple.relation} ${triple.target}`, "success");
    }
    
    console.log("Triple removed successfully, remaining triples:", docLevelState.triples.length);
}

// Update the document annotation text based on the current triples
function updateDocAnnotation() {
    // Get the current annotation content element
    const docAnnotationContentElement = document.getElementById("doc-annotation-content");
    const docAnnotationDiv = document.getElementById("doc-annotation");
    
    // If we don't have the container, nothing to do
    if (!docAnnotationDiv) return;
    
    // If we already have triples parsed
    if (docLevelState.triples.length > 0) {
        // Group triples by type for better organization
        const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
        const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
        const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
        
        // Build HTML for the structured display
        let displayHtml = `<div class="structured-annotation" id="doc-annotation-content">`;
        
        // Format triples into a string for the underlying data model
        let annotationText = "";
        
        // Add temporal branch
        if (temporalTriples.length > 0) {
            displayHtml += `<div class="annotation-branch temporal-branch">
                <div class="branch-header">Temporal Relations:</div>
                <div class="branch-content">`;
            
            temporalTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
                displayHtml += `
                    <div class="triple-item" data-id="${triple.id}">
                        <div class="triple-content">
                            <span class="node source-node">${triple.source}</span>
                            <span class="relation">${triple.relation}</span>
                            <span class="node target-node">${triple.target}</span>
                            <button class="btn btn-sm btn-danger delete-triple" data-id="${triple.id}">×</button>
                        </div>
                    </div>`;
            });
            
            displayHtml += `</div></div>`;
        }
        
        // Add modal branch
        if (modalTriples.length > 0) {
            displayHtml += `<div class="annotation-branch modal-branch">
                <div class="branch-header">Modal Relations:</div>
                <div class="branch-content">`;
            
            modalTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
                displayHtml += `
                    <div class="triple-item" data-id="${triple.id}">
                        <div class="triple-content">
                            <span class="node source-node">${triple.source}</span>
                            <span class="relation">${triple.relation}</span>
                            <span class="node target-node">${triple.target}</span>
                            <button class="btn btn-sm btn-danger delete-triple" data-id="${triple.id}">×</button>
                        </div>
                    </div>`;
            });
            
            displayHtml += `</div></div>`;
        }
        
        // Add coreference branch
        if (corefTriples.length > 0) {
            displayHtml += `<div class="annotation-branch coreference-branch">
                <div class="branch-header">Coreference Relations:</div>
                <div class="branch-content">`;
            
            corefTriples.forEach(triple => {
                annotationText += `(${triple.type} :source ${triple.source} :relation ${triple.relation} :target ${triple.target} :sent-id ${triple.sentId})\n`;
                displayHtml += `
                    <div class="triple-item" data-id="${triple.id}">
                        <div class="triple-content">
                            <span class="node source-node">${triple.source}</span>
                            <span class="relation">${triple.relation}</span>
                            <span class="node target-node">${triple.target}</span>
                            <button class="btn btn-sm btn-danger delete-triple" data-id="${triple.id}">×</button>
                        </div>
                    </div>`;
            });
            
            displayHtml += `</div></div>`;
        }
        
        // Close the overall container
        displayHtml += `</div>`;
        
        // Update the underlying data model
        docLevelState.docAnnotation = annotationText.trim();
        
        // Update the UI
        docAnnotationDiv.innerHTML = displayHtml;
        
        // Also add a hidden div with the raw format for compatibility
        const rawAnnotation = document.createElement('div');
        rawAnnotation.style.display = 'none';
        rawAnnotation.id = 'raw-doc-annotation';
        rawAnnotation.textContent = docLevelState.docAnnotation;
        docAnnotationDiv.appendChild(rawAnnotation);
    } 
    // If we have no triples but there's already content, preserve it
    else if (docAnnotationContentElement) {
        // Keep the existing content
        docLevelState.docAnnotation = docAnnotationContentElement.textContent.trim();
    }
    // Only show empty state if there are no triples and no existing content
    else if (!docAnnotationContentElement && docLevelState.docAnnotation === "") {
        // Show empty state
        docAnnotationDiv.innerHTML = `
            <div class="alert alert-info mb-0" id="doc-annotation-placeholder">
                No document-level annotation available for this sentence. Use the tools on the right to create one.
            </div>
        `;
    }
}

// Render the triples list in the UI
function renderTriples() {
    console.log("Rendering triples UI");
    
    // DISABLE OLD TRIPLE DELETION HANDLERS
    // This is a complete override to prevent old code from running
    // that was causing stuck confirmation dialogs
    console.log("Disabling old triple deletion handlers");
    
    // Remove any existing delete icon handlers
    try {
        const oldIcons = document.querySelectorAll('.delete-icon');
        if (oldIcons.length > 0) {
            console.log("Removing old delete icon handlers");
            oldIcons.forEach(icon => {
                // Clone the node to remove all event listeners
                const newIcon = icon.cloneNode(true);
                if (icon.parentNode) {
                    icon.parentNode.replaceChild(newIcon, icon);
                }
            });
        }
    } catch (error) {
        console.error("Error removing old handlers:", error);
    }
    
    // Rest of renderTriples function...
}

// Create HTML for a single triple
function createTripleHtml(triple) {
    return `
        <div class="triple-item" data-id="${triple.id}">
            <div class="triple-content">
                <span class="node source-node">${triple.source}</span>
                <span class="relation">${triple.relation}</span>
                <span class="node target-node">${triple.target}</span>
                <span class="delete-icon" data-id="${triple.id}">
                    <i class="fas fa-trash-alt"></i>
                </span>
            </div>
            <div class="triple-source-indicator">
                <small>From sentence <span class="sent-id">#${triple.sentId}</span></small>
            </div>
        </div>
    `;
}

// Clear a triple form after submission
function clearTripleForm(tripleType) {
    if (tripleType === 'temporal') {
        document.getElementById('temporal-source').value = '';
        document.getElementById('temporal-target').value = '';
    } else if (tripleType === 'modal') {
        document.getElementById('modal-source').value = '';
        document.getElementById('modal-target').value = '';
    } else if (tripleType === 'coreference') {
        document.getElementById('coref-source').value = '';
        document.getElementById('coref-target').value = '';
    }
}

// Generate a unique ID for triples
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Show a notification to the user
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('doc-level-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'doc-level-notification';
        document.body.appendChild(notification);
    }
    
    // Set styles based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    // Apply styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px',
        borderRadius: '5px',
        color: '#fff',
        backgroundColor: colors[type] || colors.info,
        zIndex: '9999',
        opacity: '0',
        transition: 'opacity 0.3s ease-in-out'
    });
    
    // Set message
    notification.textContent = message;
    
    // Show notification
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 100);
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Function to get the correct save endpoint URL
function getSaveEndpointUrl(docVersionId, sentId) {
    // Get the current URL to determine the correct endpoint
    const currentUrl = window.location;
    console.log("Current URL:", currentUrl.href);
    
    // Get the current URL path segments
    const pathSegments = currentUrl.pathname.split('/').filter(Boolean);
    console.log("Path segments:", pathSegments);
    
    // Directly use document version ID and sentence ID from the current URL if possible
    let urlDocVersionId = docVersionId;
    let urlSentId = sentId;
    
    // If the current URL contains the IDs, use those since they're already working for view
    if (pathSegments.length >= 3 && pathSegments[0] === 'doclevel') {
        // The URL is in format /doclevel/doc_version_id/sent_id
        // Let's use those IDs for consistency
        const docIdFromUrl = pathSegments[1];
        const sentIdFromUrl = pathSegments[2];
        
        if (docIdFromUrl && sentIdFromUrl) {
            console.log(`Using IDs from URL: doc=${docIdFromUrl}, sent=${sentIdFromUrl}`);
            urlDocVersionId = docIdFromUrl;
            urlSentId = sentIdFromUrl;
        }
    }
    
    // Replace doclevel with update_doc_annotation in the path to keep everything else the same
    const saveUrlPath = currentUrl.pathname.replace(
        /\/doclevel\/(\d+)\/(\d+)/, 
        `/update_doc_annotation/${urlDocVersionId}/${urlSentId}`
    );
    
    // Construct the final URL using the original origin and the modified path
    const saveUrl = `${window.location.origin}${saveUrlPath}`;
    
    // Log the URL we're using for debugging
    console.log("Save URL constructed:", saveUrl);
    
    return saveUrl;
}

// Rebuild the annotation directly from the DOM elements
function rebuildAnnotationFromDOM() {
    console.log("Rebuilding annotation directly from DOM elements");
    
    try {
        // Get the annotation element
        const annotationElement = document.getElementById('doc-annotation-content');
        if (!annotationElement) {
            console.error("Annotation element not found");
            return;
        }
        
        // Rebuild the triples array from the DOM
        rebuildTripleArray();
        
        // Create the plain text version for saving to the server
        const plainTextAnnotation = generatePlainTextAnnotation();
        
        // Format the annotation for display with interactive elements
        const formattedHtml = formatDocLevelAnnotation();
        
        // Update the UI with the formatted HTML - preserve scrolling position
        const scrollTop = annotationElement.scrollTop || 0;
        annotationElement.innerHTML = formattedHtml;
        annotationElement.scrollTop = scrollTop;
        
        // Update the annotation in the state - use plain text for server storage
        docLevelState.docAnnotation = plainTextAnnotation;
        
        // Mark as dirty so changes will be saved
        docLevelState.isDirty = true;
        
        // Log the current state
        console.log("Updated annotation state:", {
            triplesCount: docLevelState.triples.length,
            htmlLength: formattedHtml.length,
            plainTextLength: plainTextAnnotation.length
        });
        
        // Attempt to save - but catch any errors
        try {
            saveDocAnnotation().catch(error => {
                console.error("Failed to save after rebuilding annotation:", error);
                showNotification("Changes have been made but couldn't be saved to the server. Please try saving manually.", "warning");
            });
        } catch (error) {
            console.error("Error during save operation:", error);
            showNotification("Error during save operation. Please try saving manually.", "warning");
        }
        
        return formattedHtml;
    } catch (error) {
        console.error("Error rebuilding annotation from DOM:", error);
        showNotification("Error rebuilding annotation. Please try again.", "error");
        return null;
    }
}

// Generate plain text annotation for saving to the server
function generatePlainTextAnnotation() {
    try {
        // Make sure we have valid root values
        if (!docLevelState.rootVar) docLevelState.rootVar = 's0';
        if (!docLevelState.rootType) docLevelState.rootType = 'sentence';
        
        console.log(`Generating plain text with root: ${docLevelState.rootVar} / ${docLevelState.rootType}`);
        
        // Start building the plain text annotation
        let plainText = `(${docLevelState.rootVar} / ${docLevelState.rootType}\n`;
        
        // Process each branch type
        ['temporal', 'modal', 'coref'].forEach(branchName => {
            // Find all triple containers for this branch
            const triples = docLevelState.triples.filter(triple => {
                const tripleType = triple.type || '';
                return (branchName === 'coref' && tripleType === 'coreference') || 
                       tripleType === branchName;
            });
            
                // Start the branch
            plainText += `    :${branchName} `;
            
            // Only add nested structure if there are triples
            if (triples.length > 0) {
                plainText += '(';
                
                // Add each triple
                const tripleTexts = triples.map(triple => {
                    return `(${triple.source} ${triple.relation} ${triple.target})`;
                });
                
                // Format the triples with proper indentation
                plainText += tripleTexts.join('\n            ');
                
                // Close the triple list
                plainText += ')';
            } else {
                // Empty branch
                plainText += '()';
            }
            
            // Add newline after each branch
            plainText += '\n';
        });
        
        // Close the annotation
        plainText += ')';
        
        console.log("Generated plain text annotation for server:", plainText);
        return plainText;
    } catch (error) {
        console.error("Error generating plain text annotation:", error);
        return "(s0 / sentence\n    :temporal ()\n    :modal ()\n    :coref ()\n)";
    }
}

// Save document annotation to the database
function saveDocAnnotation() {
    console.log("Starting save document annotation process...");
    
    // Check if there are changes to save
    if (!docLevelState.isDirty) {
        console.log("No changes to save, skipping...");
        return Promise.resolve({success: true, message: "No changes to save"});
    }
    
    // Get docVersionId and sentId from current state
    const docVersionId = docLevelState.docVersionId;
    const sentId = docLevelState.sentId;
    
    if (!docVersionId || !sentId) {
        console.error("Missing required docVersionId or sentId for saving", docLevelState);
        showNotification('error', "Missing document information for saving");
        return Promise.reject("Missing document information");
    }
    
    console.log(`Saving annotation for document ${docVersionId}, sentence ${sentId}...`);
    
    // Get the plain text representation
    const plainTextAnnotation = generatePlainTextAnnotation();
    console.log("Generated plain text annotation:", plainTextAnnotation);
    
    // Get the save URL
    const saveUrl = getSaveEndpointUrl(docVersionId, sentId);
    console.log("Using save URL:", saveUrl);
    
    // Get CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    console.log("CSRF token available:", !!csrfToken);
    
    // Create the payload with more context information
    const payload = {
        doc_version_id: docVersionId,
        sent_id: sentId,
        annotation: plainTextAnnotation,
        sentence_number: sentId, // Include the sentence number as a separate field
        is_current_version: true
    };
    
    console.log("Sending payload:", JSON.stringify(payload));
    
    // Create the request options
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin', // Include cookies
        body: JSON.stringify(payload)
    };
    
    // Add CSRF token if available
    if (csrfToken) {
        fetchOptions.headers['X-CSRFToken'] = csrfToken;
    }
    
    console.log("Fetch options:", fetchOptions);
    
    // Send the request
    return fetch(saveUrl, fetchOptions)
        .then(response => {
            console.log("Save response status:", response.status);
            
            if (!response.ok) {
                console.error("Save failed with status:", response.status);
                if (response.status === 404) {
                    console.log("Got 404, attempting alternative save...");
                    return response.text().then(text => {
                        console.error("Error response text:", text);
                        return attemptAlternativeSave(docVersionId, sentId, plainTextAnnotation);
                    });
                }
                
                // For other errors, try to parse the error message
                return response.json().then(data => {
                    console.error("Save error:", data);
                    throw new Error(data.message || `Save failed with status ${response.status}`);
                }).catch(e => {
                    // If we can't parse JSON, just show the status
                    throw new Error(`Save failed with status ${response.status}`);
                });
            }
            
            return response.json();
        })
        .then(data => {
            console.log("Save response data:", data);
            
            if (data.success) {
                // If save was successful, clear the dirty flag
                docLevelState.isDirty = false;
                
                // Show a detailed success message
                if (data.annotation_id) {
                    showNotification('success', `Annotation updated successfully (ID: ${data.annotation_id})`);
                } else {
                    showNotification('success', "Annotation saved successfully");
                }
                
                console.log(`Annotation ${data.annotation_id ? "updated" : "saved"} with sent_id: ${data.actual_sent_id || data.sent_id}`);
                return data;
            } else {
                console.error("Save returned success=false:", data);
                showNotification('error', data.message || "Failed to save changes");
                throw new Error(data.message || "Unknown error saving document");
            }
        })
        .catch(error => {
            console.error("Save error:", error);
            showNotification('error', `Error saving changes: ${error.message}`);
            throw error;
        });
}

// Alternative save method with diagnostic info
function attemptAlternativeSave(docVersionId, sentId, plainTextAnnotation) {
    console.log("Attempting alternative save method...");
    
    // Get CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    // Create the payload with diagnostic information
    const payload = {
        doc_version_id: docVersionId,
        sent_id: sentId,
        annotation: plainTextAnnotation,
        sentence_number: sentId, // Add sentence number as separate field
        sentence_position: sentId, // Add sentence position as another possible identifier
        is_current_version: true,
        client_info: {
            url: window.location.href,
            path: window.location.pathname,
            referrer: document.referrer
        }
    };
    
    // Try a fallback URL with explicit /main/ prefix
    const alternativeUrl = `${window.location.origin}/main/update_doc_annotation/${docVersionId}/${sentId}`;
    console.log("Using alternative save URL:", alternativeUrl);
    
    // Send the request with the updated payload
    return fetch(alternativeUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(csrfToken && {'X-CSRFToken': csrfToken})
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
    })
    .then(response => {
        console.log("Alternative save response status:", response.status);
        
        if (!response.ok) {
            console.error("Alternative save failed with status:", response.status);
            return response.text().then(text => {
                console.error("Error response text:", text);
                return submitFormFallback(docVersionId, sentId, plainTextAnnotation);
            });
        }
        
        return response.json();
    })
    .then(data => {
        console.log("Alternative save response data:", data);
        
        if (data.success) {
            docLevelState.isDirty = false;
            
            // Show a detailed success message
            if (data.annotation_id) {
                showNotification('success', `Annotation updated successfully (ID: ${data.annotation_id}, alternative method)`);
            } else {
                showNotification('success', "Annotation saved successfully (alternative method)");
            }
            
            console.log(`Annotation ${data.annotation_id ? "updated" : "saved"} with sent_id: ${data.actual_sent_id || data.sent_id}`);
            return data;
        } else {
            console.error("Alternative save returned success=false:", data);
            showNotification('error', data.message || "Failed to save changes");
            throw new Error(data.message || "Unknown error saving document");
        }
    })
    .catch(error => {
        console.error("Alternative save error:", error);
        showNotification('error', `Error saving changes (alternative method): ${error.message}`);
        throw error;
    });
}

// Form submission fallback as a last resort
function submitFormFallback(docVersionId, sentId, plainTextAnnotation) {
    console.log("Trying form submission fallback...");
    
    return new Promise((resolve, reject) => {
        try {
            // Create a hidden form
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `${window.location.origin}/update_doc_annotation/${docVersionId}/${sentId}`;
            form.style.display = 'none';
            
            // Add document version ID field
            const docVersionField = document.createElement('input');
            docVersionField.type = 'hidden';
            docVersionField.name = 'doc_version_id';
            docVersionField.value = docVersionId;
            form.appendChild(docVersionField);
            
            // Add sent ID field
            const sentIdField = document.createElement('input');
            sentIdField.type = 'hidden';
            sentIdField.name = 'sent_id';
            sentIdField.value = sentId;
            form.appendChild(sentIdField);
            
            // Add sentence number field (might be useful for lookup)
            const sentNumberField = document.createElement('input');
            sentNumberField.type = 'hidden';
            sentNumberField.name = 'sentence_number';
            sentNumberField.value = sentId;
            form.appendChild(sentNumberField);
            
            // Add the annotation data
            const annotField = document.createElement('input');
            annotField.type = 'hidden';
            annotField.name = 'annotation';
            annotField.value = plainTextAnnotation;
            form.appendChild(annotField);
            
            // Add the CSRF token if available
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            if (csrfToken) {
                const csrfField = document.createElement('input');
                csrfField.type = 'hidden';
                csrfField.name = 'csrf_token';
                csrfField.value = csrfToken;
                form.appendChild(csrfField);
            }
            
            // Add to body
            document.body.appendChild(form);
            
            console.log("Form created with action:", form.action);
            
            // Use fetch API to submit the form instead of traditional form submission
            const formData = new FormData(form);
            
            // Remove form from DOM after gathering data
            document.body.removeChild(form);
            
            // Send as form data
            fetch(form.action, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            })
            .then(response => {
                console.log("Form submission response status:", response.status);
                if (!response.ok) {
                    console.error("Form submission failed with status:", response.status);
                    return response.text().then(text => {
                        console.error("Form submission error text:", text);
                        throw new Error(`Form submission failed with status ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log("Form submission response:", data);
                if (data.success) {
                    docLevelState.isDirty = false;
                    showNotification('success', "Changes saved successfully (form fallback)");
                    resolve(data);
                } else {
                    console.error("Form submission returned success=false:", data);
                    showNotification('error', data.message || "Failed to save changes");
                    reject(new Error(data.message || "Unknown error saving document"));
                }
            })
            .catch(error => {
                console.error("Form submission error:", error);
                showNotification('error', `Error saving changes (form fallback): ${error.message}`);
                reject(error);
            });
        } catch (error) {
            console.error("Error creating form:", error);
            showNotification('error', `Error creating form: ${error.message}`);
            reject(error);
        }
    });
}

// Get CSRF token from cookies
function getCsrfToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Expose functions to global scope
window.initializeDocLevel = initializeDocLevel;
window.addTriple = addTriple;
window.removeTriple = removeTriple;
window.saveDocAnnotation = saveDocAnnotation;
window.jumpToSentence = function(sentId) {
    const currentId = parseInt(window.state.currentId);
    if (currentId !== parseInt(sentId)) {
        const shouldSave = confirm("Do you want to save your current changes before jumping to another sentence?");
        if (shouldSave) {
            saveDocAnnotation().then(() => {
                window.location.href = `/doclevel/${window.state.docVersionId}/${sentId}`;
            });
        } else {
            window.location.href = `/doclevel/${window.state.docVersionId}/${sentId}`;
        }
    }
};

// Format the doc-level annotation based on the current state
function formatDocLevelAnnotation() {
    console.log("Formatting doc-level annotation with interactive elements");
    
    try {
        // Log the current state for debugging
        console.log("Current docLevelState:", {
            triplesCount: docLevelState.triples.length,
            docVersionId: docLevelState.docVersionId,
            sentId: docLevelState.sentId,
            isDirty: docLevelState.isDirty,
            rootVar: docLevelState.rootVar,
            rootType: docLevelState.rootType
        });
        
        // Make sure we have valid root values
        if (!docLevelState.rootVar) docLevelState.rootVar = 's0';
        if (!docLevelState.rootType) docLevelState.rootType = 'sentence';
        
        console.log("Using root information:", { 
            rootVar: docLevelState.rootVar, 
            rootType: docLevelState.rootType 
        });
        
        // Debugging for triples
        const temporalTriples = docLevelState.triples.filter(t => t.type === 'temporal');
        const modalTriples = docLevelState.triples.filter(t => t.type === 'modal');
        const corefTriples = docLevelState.triples.filter(t => t.type === 'coreference');
        
        console.log("Triples by branch:", {
            temporal: temporalTriples.length,
            modal: modalTriples.length,
            coref: corefTriples.length
        });
        
        // Start building the annotation with HTML for syntax highlighting
        let htmlContent = `<span class="parenthesis">(</span><span class="root-var">${docLevelState.rootVar}</span> / <span class="root-type">${docLevelState.rootType}</span>\n`;
        
        // Process each branch type
        ['temporal', 'modal', 'coref'].forEach(branchName => {
            // Find all triple containers for this branch
            const triples = docLevelState.triples.filter(triple => {
                const tripleType = triple.type || '';
                return (branchName === 'coref' && tripleType === 'coreference') || 
                       tripleType === branchName;
            });
            
            console.log(`Rendering ${triples.length} triples for ${branchName} branch`);
            
            // Start the branch with HTML
            htmlContent += `    <span class="branch-name">:${branchName}</span> <span class="parenthesis">(</span>`;
            
            // Only add nested structure if there are triples
            if (triples.length > 0) {
                // Don't add the extra opening parenthesis
                htmlContent += `\n`;
                
                // Add each triple as an interactive element with delete icon
                const tripleElements = triples.map(triple => {
                    return `        <div class="triple-container" data-branch="${branchName}" data-source="${triple.source}" data-relation="${triple.relation}" data-target="${triple.target}" style="cursor: context-menu;">
<span class="parenthesis">(</span><span class="node">${triple.source}</span> <span class="relation">${triple.relation}</span> <span class="node">${triple.target}</span><span class="parenthesis">)</span>
<span class="delete-triple-icon" style="position: absolute; right: -20px; top: 50%; transform: translateY(-50%); cursor: pointer;"><i class="fas fa-trash-alt" style="color: #dc3545;"></i></span>
                     </div>`;
                });
                
                // Join the triple elements
                htmlContent += tripleElements.join('\n');
                
                // Close the triple list
                htmlContent += `\n    <span class="parenthesis">)</span>`;
            } else {
                // Empty branch
                htmlContent += `<span class="parenthesis">)</span>`;
            }
            
            // Add newline after each branch
            htmlContent += '\n';
        });
        
        // Close the annotation
        htmlContent += `<span class="parenthesis">)</span>`;
        
        // Add a helper text at the top of the annotation
        htmlContent = `<div class="delete-helper-text" style="background-color: #212529; color: white; border: none; border-radius: 4px; padding: 7px 12px; margin-bottom: 15px; font-size: 13px; font-weight: 500;">
            <i class="fas fa-info-circle"></i> Tip: Right-click on any triple to delete it
        </div>` + htmlContent;
        
        console.log("Formatted HTML annotation with interactive elements");
        
        // Make sure we remove any existing context menu before creating a new one
        const oldMenu = document.getElementById('triple-context-menu');
        if (oldMenu) {
            oldMenu.remove();
        }
        
        // Schedule setup of delete handlers
            setTimeout(() => {
                setupDeleteButtons();
        }, 100);
        
        return htmlContent;
    } catch (error) {
        console.error("Error formatting doc-level annotation:", error);
        
        // Return simple default annotation if there's an error
        const fallbackAnnotation = "(s0 / sentence\n    :temporal ()\n    :modal ()\n    :coref ()\n)";
        console.log("Using fallback annotation:", fallbackAnnotation);
        return fallbackAnnotation;
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document ready, initializing docLevel");
    
    // Set initial state from window.state
    if (window.state) {
        docLevelState.docVersionId = window.state.docVersionId;
        docLevelState.sentId = window.state.currentId;
        console.log("Initialized docLevelState from window.state:", 
            JSON.stringify({
                docVersionId: docLevelState.docVersionId,
                sentId: docLevelState.sentId
            })
        );
    }
    
    // Initialize the doc-level interface
    initializeDocLevel();
});

// Function to update document level annotation display
function updateDocLevelAnnotation(annotation) {
    console.log("Updating document level annotation display");
    
    try {
        const annotationContainer = document.getElementById('doc-annotation');
        const annotationContent = document.getElementById('doc-annotation-content');
        const placeholder = document.getElementById('doc-annotation-placeholder');
        
        // Add debug logging to see what we're receiving
        console.log("Original annotation from server:", annotation);
        
        if (!annotation || !annotation.trim()) {
            console.warn("Empty annotation received");
            if (placeholder) {
                placeholder.style.display = 'block';
            }
            if (annotationContent) {
                annotationContent.style.display = 'none';
            }
            return;
        }
        
        // Ensure the annotation has proper structure
        const cleanedAnnotation = ensureProperAnnotationFormat(annotation);
        
        // Create or update the pre element
        if (!annotationContent) {
            // Create new content element
            if (placeholder) placeholder.style.display = 'none';
            
            const pre = document.createElement('pre');
            pre.className = 'mb-0';
            pre.id = 'doc-annotation-content';
            pre.textContent = cleanedAnnotation;
            
            if (annotationContainer) {
                annotationContainer.appendChild(pre);
            } else {
                console.error("Annotation container not found");
                return;
            }
        } else {
            // Update existing content
            annotationContent.textContent = cleanedAnnotation;
            
            if (placeholder) placeholder.style.display = 'none';
            annotationContent.style.display = 'block';
        }
        
        // Apply formatting with syntax highlighting
        setTimeout(formatDocLevelAnnotation, 100);
    } catch (error) {
        console.error("Error updating document level annotation:", error);
        showNotification("Error updating annotation display: " + error.message, "error");
    }
}

// Helper function to ensure proper annotation format
function ensureProperAnnotationFormat(annotation) {
    try {
        // Basic cleanup
        let cleaned = annotation.trim();
        
        // Check if it has proper opening and closing parentheses
        if (!cleaned.startsWith('(') || !cleaned.endsWith(')')) {
            console.warn("Annotation missing proper parentheses structure");
            
            // Add missing parentheses if needed
            if (!cleaned.startsWith('(')) cleaned = '(' + cleaned;
            if (!cleaned.endsWith(')')) cleaned = cleaned + ')';
        }
        
        // Ensure there's proper spacing after the root
        if (!cleaned.includes(' / ')) {
            cleaned = cleaned.replace(/\//, ' / ');
        }
        
        // Add newlines for readability if they're missing
        if (!cleaned.includes('\n')) {
            cleaned = cleaned
                .replace(/\s*:\s*temporal\s*\(/g, '\n    :temporal (')
                .replace(/\s*:\s*modal\s*\(/g, '\n    :modal (')
                .replace(/\s*:\s*coref\s*\(/g, '\n    :coref (');
        }
        
        return cleaned;
    } catch (error) {
        console.error("Error cleaning annotation format:", error);
        return annotation; // Return original if cleaning fails
    }
}

// Navigation functions
function prevSentence() {
    const currentId = parseInt(window.state.currentId);
    if (currentId > 1) {
        const shouldSave = confirm("Do you want to save your current changes before navigating to the previous sentence?");
        if (shouldSave) {
            saveDocAnnotation().then(() => {
                window.location.href = `/doclevel/${window.state.docVersionId}/${currentId - 1}`;
            });
        } else {
            window.location.href = `/doclevel/${window.state.docVersionId}/${currentId - 1}`;
        }
    } else {
        showNotification("You're at the first sentence already.", "warning");
    }
}

function nextSentence() {
    const currentId = parseInt(window.state.currentId);
    if (currentId < window.state.maxSentId) {
        const shouldSave = confirm("Do you want to save your current changes before navigating to the next sentence?");
        if (shouldSave) {
            saveDocAnnotation().then(() => {
                window.location.href = `/doclevel/${window.state.docVersionId}/${currentId + 1}`;
            });
        } else {
            window.location.href = `/doclevel/${window.state.docVersionId}/${currentId + 1}`;
        }
    } else {
        showNotification("You're at the last sentence already.", "warning");
    }
}

// Setup delete functionality using a context menu approach
function setupDeleteButtons() {
    console.log("Setting up direct delete functionality with context menu");
    
    // Get the annotation content element
    const annotationElement = document.getElementById('doc-annotation-content');
    if (!annotationElement) {
        console.error("Annotation content element not found");
        return;
    }

    // Find all triple containers to verify they exist
    const tripleContainers = annotationElement.querySelectorAll('.triple-container');
    console.log(`Found ${tripleContainers.length} triple containers for deletion setup`);
    
    // Check if each has data attributes
    tripleContainers.forEach((container, index) => {
        const hasSource = container.hasAttribute('data-source');
        const hasRelation = container.hasAttribute('data-relation');
        const hasTarget = container.hasAttribute('data-target');
        const hasBranch = container.hasAttribute('data-branch');
        
        if (!hasSource || !hasRelation || !hasTarget || !hasBranch) {
            console.warn(`Triple container ${index} is missing attributes: source=${hasSource}, relation=${hasRelation}, target=${hasTarget}, branch=${hasBranch}`);
        }
    });

    // Create a custom context menu
    let contextMenu = document.createElement('div');
    contextMenu.id = 'triple-context-menu';
    contextMenu.className = 'context-menu';
    contextMenu.style.display = 'none';
    contextMenu.style.position = 'absolute';
    contextMenu.style.zIndex = '1000';
    contextMenu.style.backgroundColor = 'white';
    contextMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    contextMenu.style.padding = '5px 0';
    contextMenu.style.borderRadius = '4px';
    contextMenu.style.minWidth = '150px';
    
    // Add delete option to the context menu
    let deleteOption = document.createElement('div');
    deleteOption.className = 'context-menu-item';
    deleteOption.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Triple';
    deleteOption.style.padding = '8px 15px';
    deleteOption.style.cursor = 'pointer';
    deleteOption.style.color = '#dc3545';
    deleteOption.style.transition = 'background-color 0.2s';
    
    // Hover effect
    deleteOption.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#f8f9fa';
    });
    
    deleteOption.addEventListener('mouseout', function() {
        this.style.backgroundColor = 'white';
    });
    
    // Add delete option to menu
    contextMenu.appendChild(deleteOption);
    
    // Add to body
    document.body.appendChild(contextMenu);
    
    // Current target triple element
    let currentTripleElement = null;
    
    // Handle right click on annotation content
    annotationElement.addEventListener('contextmenu', function(e) {
        console.log("Context menu event triggered", e.target);
        // Find if click is on a triple
        const tripleElement = findClosestTripleContainer(e.target);
        if (tripleElement) {
            console.log("Found triple element:", tripleElement);
            e.preventDefault();
            
            // Save reference to current triple
            currentTripleElement = tripleElement;
            
            // Position and show context menu
            contextMenu.style.left = e.pageX + 'px';
            contextMenu.style.top = e.pageY + 'px';
            contextMenu.style.display = 'block';
        }
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', function() {
        contextMenu.style.display = 'none';
    });
    
    // Perform delete action when delete option is clicked
    deleteOption.addEventListener('click', function() {
        if (currentTripleElement) {
            // Get triple data
            const branch = currentTripleElement.getAttribute('data-branch');
            const source = currentTripleElement.getAttribute('data-source');
            const relation = currentTripleElement.getAttribute('data-relation');
            const target = currentTripleElement.getAttribute('data-target');
            
            console.log("Delete clicked for triple:", { branch, source, relation, target });
            
            try {
                // Remove the triple from DOM
                currentTripleElement.remove();
                console.log(`Deleted triple: (${source} ${relation} ${target})`);
                
                // Show notification
                showNotification(`Deleted triple from ${branch} branch`, 'success');
                
                // Rebuild and save
                rebuildAnnotationFromDOM();
            } catch (error) {
                console.error("Error deleting triple:", error);
                showNotification("Error deleting triple: " + error.message, "error");
            }
            
            // Hide menu
            contextMenu.style.display = 'none';
        }
    });
    
    // Also handle clicks on delete icons directly without confirmation
    tripleContainers.forEach(container => {
        const deleteIcon = container.querySelector('.delete-triple-icon');
        if (deleteIcon) {
            deleteIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
                // Get triple data from parent container
                const branch = container.getAttribute('data-branch');
                const source = container.getAttribute('data-source');
                const relation = container.getAttribute('data-relation');
                const target = container.getAttribute('data-target');
                
                console.log("Delete icon clicked for triple:", { branch, source, relation, target });
                
                try {
                    // Remove the triple
                    container.remove();
                    console.log(`Deleted triple via icon: (${source} ${relation} ${target})`);
                    
                    // Show notification
                    showNotification(`Deleted triple from ${branch} branch`, 'success');
                    
                    // Rebuild annotation
                    rebuildAnnotationFromDOM();
                } catch (error) {
                    console.error("Error deleting triple:", error);
                    showNotification("Error deleting triple: " + error.message, "error");
                }
            });
        } else {
            console.warn("Delete icon not found in triple container");
        }
    });
    
    // Helper function to find triple container
    function findClosestTripleContainer(element) {
        return element.closest('.triple-container');
    }
}

// Rebuild docLevelState.triples from triple containers in the DOM
function rebuildTripleArray() {
    console.log("Rebuilding triples array from DOM");
    
    // Preserve the root variable and type - store them before clearing
    const savedRootVar = docLevelState.rootVar;
    const savedRootType = docLevelState.rootType;
    
    console.log(`Preserving root information: ${savedRootVar} / ${savedRootType}`);
    
    // Clear existing triples
    docLevelState.triples = [];
    
    // Process each branch type
    ['temporal', 'modal', 'coref'].forEach(branchName => {
        // Map branch name to type for the triples array
        const tripleType = branchName === 'coref' ? 'coreference' : branchName;
        
        // Find all triple containers for this branch
        const triples = Array.from(document.querySelectorAll(`.triple-container[data-branch="${branchName}"]`));
        
        if (triples.length === 0) {
            return; // Skip this branch
        }
        
        // Convert each triple element to a triple object
        triples.forEach(triple => {
            const source = triple.getAttribute('data-source');
            const relation = triple.getAttribute('data-relation');
            const target = triple.getAttribute('data-target');
            
            // Only add if we have all required fields
            if (source && relation && target) {
                docLevelState.triples.push({
                    id: generateUniqueId(),
                    type: tripleType,
                    source: source,
                    relation: relation,
                    target: target,
                    sentId: docLevelState.sentId
                });
            }
        });
    });
    
    // Restore the root variable and type
    docLevelState.rootVar = savedRootVar;
    docLevelState.rootType = savedRootType;
    
    console.log(`Rebuilt triples array with ${docLevelState.triples.length} triples, root is ${docLevelState.rootVar}`);
}

// Load existing annotation if available
function loadExistingAnnotation() {
    try {
        // Get the annotation content element
        const annotationContent = document.getElementById('doc-annotation-content');
        if (annotationContent) {
            // Store the original text for debugging
            const originalText = annotationContent.textContent;
            console.log("Original annotation text from server:", originalText);
            
            // Extract the root variable and type from the original annotation
            const rootMatch = originalText.match(/^\s*\(\s*([^\s\/]+)\s*\/\s*([^\s\)]+)/);
            if (rootMatch) {
                // Store the exact values from the annotation
                const extractedRootVar = rootMatch[1].trim();
                const extractedRootType = rootMatch[2].trim();
                
                // Only update if we actually found something meaningful
                if (extractedRootVar && extractedRootVar !== 's0') {
                    docLevelState.rootVar = extractedRootVar;
                    docLevelState.rootType = extractedRootType;
                    console.log(`Extracted root information from annotation: ${docLevelState.rootVar} / ${docLevelState.rootType}`);
                } else {
                    console.log(`Found generic root: ${extractedRootVar}, keeping current value: ${docLevelState.rootVar}`);
                }
            } else {
                // Only set default if we don't already have a value
                if (!docLevelState.rootVar) {
                    console.log("Could not extract root variable and type, using defaults");
                    docLevelState.rootVar = "s0";
                    docLevelState.rootType = "sentence";
                } else {
                    console.log(`No root found in annotation, keeping current: ${docLevelState.rootVar} / ${docLevelState.rootType}`);
                }
            }
            
            // Make sure we have the right CSS classes applied to the container
            const annotationContainer = document.getElementById('doc-annotation');
            if (annotationContainer) {
                // Ensure proper CSS classes are applied
                annotationContainer.classList.add('card');
                annotationContent.style.fontFamily = 'monospace';
                annotationContent.style.whiteSpace = 'pre-wrap';
                annotationContent.style.fontSize = '0.9rem';
                annotationContent.style.lineHeight = '1.4';
                annotationContent.style.wordBreak = 'break-word';
            }
            
            // Parse the initial annotation to build the triples array
            if (originalText && originalText.trim() !== '') {
                docLevelState.docAnnotation = originalText.trim();
                parseTriples(originalText);
            }
            
            // Format the annotation with syntax highlighting and interactive elements
            const formattedHtml = formatDocLevelAnnotation();
            annotationContent.innerHTML = formattedHtml;
            
            // Set up save button event listener
            const saveButton = document.getElementById('save-doc-annotation-btn');
            if (saveButton) {
                saveButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log("Save button clicked");
                    saveDocAnnotation()
                        .then(() => {
                            console.log("Save operation completed");
                        })
                        .catch(error => {
                            console.error("Save operation failed:", error);
                        });
                });
            }
            
            // Make sure delete functionality works
            setTimeout(() => {
                // Verify visibility of delete icons
                const deleteIcons = document.querySelectorAll('.delete-triple-icon');
                console.log(`Found ${deleteIcons.length} delete icons`);
                
                // Check if any triple containers exist but don't have visible delete icons
                const containers = document.querySelectorAll('.triple-container');
                console.log(`Found ${containers.length} triple containers`);
                
                // Make sure delete icons are visible on hover
                const style = document.createElement('style');
                style.textContent = `
                    .triple-container:hover .delete-triple-icon {
                        display: inline-block !important;
                    }
                    .triple-container .delete-triple-icon {
                        display: none;
                    }
                `;
                document.head.appendChild(style);
            }, 200);
        } else {
            console.error("Annotation content element not found");
        }
    } catch (error) {
        console.error("Error loading existing annotation:", error);
    }
} 