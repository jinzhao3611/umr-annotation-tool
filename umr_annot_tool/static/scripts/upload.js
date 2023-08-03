function parseUmrDicts(sentAnnotStrList, docAnnotStrList, doc_id){
    let sentAnnotStrListParsed = JSON.parse(JSON.stringify(sentAnnotStrList));
    let docAnnotStrListParsed = JSON.parse(JSON.stringify(docAnnotStrList));
    console.log(sentAnnotStrListParsed);
    console.log(docAnnotStrListParsed);
    let sentUmrDicts = [];
    let docUmrDicts = [];
    for(let i=0; i<sentAnnotStrList.length; i++){
        console.log(i);
        if(sentAnnotStrListParsed[i]){
           let sentUmrI = string2umr(sentAnnotStrListParsed[i]);
           sentUmrDicts.push(sentUmrI);
        }else{
            sentUmrDicts.push({});
        }
        if (docAnnotStrListParsed[i]){
            let docUmrI = string2umr(docAnnotStrListParsed[i]);
            console.log(docUmrI);
            docUmrDicts.push(docUmrI);
        }else{
            docUmrDicts.push({});
        }
    }
    console.log(sentUmrDicts);
    console.log(docUmrDicts);
    fetch(`/upload`, {
        method: 'POST',
        body: JSON.stringify({'sentUmrDicts': JSON.stringify(sentUmrDicts), 'docUmrDicts': JSON.stringify(docUmrDicts), 'doc_id': doc_id})
    }).catch(function(error){
        console.log("Fetch error: "+ error);
    });
}