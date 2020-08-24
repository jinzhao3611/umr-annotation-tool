run app.py

so far, the following things works:
text command input box, following are command examples
    add head: top want-01
    add concept: w :arg1 buy-05
    add named entity: w :arg0 person John Luis
    delete by variable: delete w :quant b
    replace by varibale: replace concept at b with run
    move: move b to w
     
undo and redo button
find lemma used the external lemma library, can also convert number string to number for :quant attribute
alignment information 


dummy_token is the placeholder for abstract concept, for the purpose of alignment. 
    For example, in the following example, concept person correspond to the dummy_token
    (k / know-02    
        :ARG0 (i / i)      
        :ARG1 (p / person             
            :ARG1-of (s / see-01                         
            :ARG0 (y / you)))) 
    I know who you saw
    
    
    
    
the typing part works, the logic behind the clicking parts work, but the interaction is still buggy. 