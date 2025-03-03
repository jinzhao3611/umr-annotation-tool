function docUmr2TripleDisplay(docUmr, showDocUmrStatus="show"){
    checkIllegalVariable();

    let temporalGroup = new Set();
    let modalGroup = new Set();
    let corefGroup = new Set()

    for (let key in docUmr) {
        if (key.split('.').length === 3) {
            let loc_key = key.split('.').slice(0, 2).join('.'); // Get parent key (e.g., 1.1, 1.2)

            let relationType = docUmr[loc_key + '.r']; // Get relation type (e.g., :temporal, :modal, :coref)
            let parent = docUmr[loc_key + '.v']; // Get parent value of triple (e.g., DCT, s1a, s1x18)
            let child = docUmr[loc_key + '.1.v']; // Get parent value of triple (e.g., s1a, s1x18)
            let subRelationType = docUmr[loc_key + '.1.r']; // Get parent value of triple (e.g., :before, :depends-on)
            let triple = `(${parent} ${subRelationType} ${child})`;
            if (relationType === ":temporal") {
                temporalGroup.add(triple);
            } else if (relationType=== ":modal") {
                modalGroup.add(triple);
            } else if (relationType=== ":coref"){
                corefGroup.add(triple);
            }
        }
    }

    let temporalGroupList = Array.from(temporalGroup)
    let modalGroupList = Array.from(modalGroup)
    let corefGroupList = Array.from(corefGroup)

    // Build the output with proper indentation
    let lines = [];
    lines.push(`(${docUmr["1.v"]} / ${docUmr["1.c"]}`);
    
    if (temporalGroupList.length > 0) {
        lines.push("  :temporal (");
        temporalGroupList.forEach(triple => {
            lines.push("    " + triple);
        });
        lines.push("  )");
    }
    
    if (modalGroupList.length > 0) {
        lines.push("  :modal (");
        modalGroupList.forEach(triple => {
            lines.push("    " + triple);
        });
        lines.push("  )");
    }
    
    if (corefGroupList.length > 0) {
        lines.push("  :coref (");
        corefGroupList.forEach(triple => {
            lines.push("    " + triple);
        });
        lines.push("  )");
    }
    
    lines.push(")");

    // Convert to HTML with preserved formatting
    let output = '<div class="umr-content">' + 
                 lines.map(line => {
                     // Escape HTML special characters
                     line = line.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');
                     // Convert spaces to non-breaking spaces for indentation
                     let indent = line.match(/^ */)[0];
                     return indent.replace(/ /g, '&nbsp;') + line.trimLeft();
                 }).join('<br>') +
                 '</div>';

    if(showDocUmrStatus === "show delete"){
        let pattern = /\([a-zA-Z0-9]+ (?::[a-zA-Z\-]+|undefined) (?:[a-zA-Z0-9]+|undefined)\)/g;
        return output.replace(pattern, function (match) {
            return `<span class="deletable">${match}</span>`;
        });
    } else {
        return output;
    }
}

function tripleDisplay2docUmr(tripleDisplay) {
    // Remove extra spaces and line breaks for easier parsing
    tripleDisplay = tripleDisplay.replace(/\s+/g, ' ').trim();

    // Initialize doc_umr
    let doc_umr = {};

    doc_umr['n'] = 1;
    doc_umr['1.v'] = tripleDisplay.match(/s\d+s0/g)[0] // "s1s0"
    doc_umr['1.c'] = "sentence"
    doc_umr['1.s'] = "";

    // Track index positions for nested structures
    let tripleIndex = 1;

    // Function to parse a nested block
    function parseTriple(triple, locKey) {
        let temporal_relations = [":before", ":after", ":depends-on", ":overlap", ":Contained"];
        let coref_relations = [":same-entity", ":same-event", ':subset-of']
        let modal_relations = [ ":MODAL", ":Non-NeutAff", ":Non-FullAff", ":Non-NeutNeg", ":Non-FullNeg", ":FullAff", ":PrtAff", ":NeutAff", ":FullNeg", ":PrtNeg", ":NeutNeg", ":Strong-PrtAff", ":Weak-PrtAff", ":Strong-NeutAff", ":Weak-NeutAff", ":Strong-PrtNeg", ":Weak-PrtNeg", ":Strong-NeutNeg", ":Weak-NeutNeg"]

        const tripleRegex = /\(([^ ]+) ([^ ]+) ([^\)]+)\)/;
        let match = triple.match(tripleRegex);
        if (match) {
            // Extract parent, relation, and child
            let parent = match[1];
            let subRelation = match[2];
            let child = match[3];
            console.log("locKey: ");
            console.log(locKey)

            // Parent structure
            doc_umr[locKey + '.c'] = parent;
            doc_umr[locKey + '.v'] = parent;
            doc_umr[locKey + '.s'] = '';
            doc_umr[locKey + '.n'] = 1;
            if(temporal_relations.includes(subRelation)){
                doc_umr[locKey + '.r'] = ":temporal";
            }else if(modal_relations.includes(subRelation)){
                doc_umr[locKey + '.r'] = ":modal";
            }else if(coref_relations.includes(subRelation)){
                doc_umr[locKey + '.r'] = ":coref";
            }

            // Child structure
            doc_umr[locKey + '.1.c'] = child;
            doc_umr[locKey + '.1.v'] = child;
            doc_umr[locKey + '.1.n'] = 0;
            doc_umr[locKey + '.1.r'] = subRelation;
            doc_umr[locKey + '.1.s'] = '';

            tripleIndex++

            // Log the extracted values or store them in an object
            console.log(`Parent: ${parent}, Relation: ${subRelation}, Child: ${child}`);
        } else {
            console.error(`Invalid triple format: ${triple}`);
        }
        doc_umr['1.n'] = tripleIndex;
    }
    // Extract triples: :temporal and :modal
    let triples = tripleDisplay.match(/\([a-zA-Z0-9]+ :[\w-]+ [a-zA-Z0-9]+\)/g);
    if (triples) {
        triples.forEach((triple) => { // block e.g., (DCT :before s1a) (s1x :depends-on s1x18)
            // Parse the inner block
            parseTriple(triple, '1.' + tripleIndex);
        });
    }
    checkIllegalVariable();
    return doc_umr;
}

function checkIllegalVariable(){
    for (let key in umr) {
        if (umr.hasOwnProperty(key)) {
            if(key.includes('.v') && key.length > 3){
                if (!(umr[key] in variable2conceptDictDoc) && /s\d+\w\d*/.test(umr[key])){
                    delete umr[key];
                    delete umr[key.replace('.v', '.c')];
                    delete umr[key.replace('.v', '.n')];
                    delete umr[key.replace('.v', '.r')];
                    delete umr[key.replace('.v', '.s')];
                }
            }
        }
    }
}

function umrDict2variableConceptDict(umr_dict) {
    const varible2conceptDict = {};
    for (const key in umr_dict) {
        if (key.endsWith(".v")) {
            const valueKey = umr_dict[key];  // The value of the `.v` key
            const contentKey = key.replace(".v", ".c");  // Corresponding `.c` key
            // Add the entry to v2c if the valueKey exists and umr_dict has the corresponding `.c` key
            if (valueKey && umr_dict.hasOwnProperty(contentKey)) {
                varible2conceptDict[valueKey] = umr_dict[contentKey];
            }
        }
    }
    return varible2conceptDict;
}

// // Input
// let input = `(s1s0 / sentence
//   :temporal (
//     (DCT :before s1a)
//     (s1x :depends-on s1x18)
//     (s1x :depends-on s1x2)
//     (s1x2 :depends-on s1x11)
//     (s1x18 :depends-on s1x6)
//   )
//   :modal (
//     (ROOT :MODAL AUTH)
//     (AUTH :FullAff s1x)
//     (AUTH :FullAff s1x2)
//     (AUTH :FullAff s1x6)
//   )
// )`;
// let result = tripleDisplay2docUmr(input);
// console.log(result);
// let result2 = docUmr2TripleDisplay(result);
// console.log(result2)
