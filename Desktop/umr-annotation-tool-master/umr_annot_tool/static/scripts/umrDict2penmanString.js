function umrDict2penmanString(umr_dict) {
    let amr_s = '';
    let n = umr_dict['n']; // how many children currently in the tree
    for (let i = 1; i <= n; i++) { //traverse children
        let umrDict2penmanString_rec_result = umrDict2penmanString_rec(i, 0,  umr_dict); //returns a html string that represents the penman format of this recursion
        if (umrDict2penmanString_rec_result){
            amr_s += umrDict2penmanString_rec_result + '\n';
        }
    }
    return amr_s;
}
function umrDict2penmanString_rec(loc, rec, umr_dict) {
    loc += '';
    if (umr_dict[loc + '.d']) { //if this node has already been deleted
        return '';
    } else {
        let concept = umr_dict[loc + '.c'];
        let string = umr_dict[loc + '.s'] || '';
        let quoted_string = string; //umr['1.s'] 1.s: ""
        if (!string.match(/^".*"$/)) { // if there is no quotes around the string
            quoted_string = '"' + string + '"'; // quote the string
        }
        let role = umr_dict[loc + '.r'] || ''; //umr['1.r']
        let string_m = string;
        if (!role_unquoted_string_arg(role, string, loc)) { //should quote
            string_m = quoted_string;
        }
        let variable = umr_dict[loc + '.v']; //umr['1.v'] 1.v: "s1n"
        let s = '';

        if (rec) { // if not graph root
            role = umr_dict[loc + '.r']; //umr['1.v']
            s += role + ' ';
        }

        if (concept) {
            s += '(' + variable + ' / ' + concept; //'(s1t / taste-01'
            let n = umr_dict[loc + '.n']; //check how many children current loc has
            let index;
            var opx_all_simple_p = 1;
            var argx_all_simple_p = 1;
            let opx_order = [];
            let argx_order = [];
            let opx_indexes = [];
            let argx_indexes = []; //argx_indexes is the same with argx_order, except argx_order could have undefined element, but argx_indexes don't
            var name_indexes = [];
            var other_indexes = [];
            var other_string_indexes = [];
            var other_non_string_indexes = [];
            var ordered_indexes = [];
            for (let i = 1; i <= n; i++) {//traverse children of current loc
                let sub_loc = loc + '.' + i;
                let sub_string = umr_dict[sub_loc + '.s'];
                let sub_role = umr_dict[sub_loc + '.r'];
                if (umr_dict[sub_loc + '.d']) {
                    // skip deleted elem
                } else if ((sub_role.match(/^:op([1-9]\d*)$/i))
                    && (index = sub_role.replace(/^:op([1-9]\d*)$/i, "$1")) //get "1" of :op1
                    && (!opx_order[index])) {
                    opx_order[index] = i;
                    if (show_amr_new_line_sent(sub_loc, umr_dict)) {
                        opx_all_simple_p = 0;
                    }
                } else if ((sub_role.match(/^:arg(\d+)$/i))
                    && (index = sub_role.replace(/^:arg(\d+)$/i, "$1"))
                    && (!argx_order[index])) {
                    argx_order[index] = i; //argindex is the ith children (arg0 is 2nd children)
                    if (show_amr_new_line_sent(sub_loc, umr_dict)) {
                        argx_all_simple_p = 0;
                    }
                } else if (sub_role === ':name') {
                    name_indexes.push(i);
                } else if (sub_string !== '') {
                    other_string_indexes.push(i);
                    other_indexes.push(i);
                } else {
                    other_non_string_indexes.push(i);
                    other_indexes.push(i);
                }
            }
            for (let i = 0; i < opx_order.length; i++) {
                if ((index = opx_order[i]) !== undefined) {
                    opx_indexes.push(index);
                }
            }
            for (let i = 0; i < argx_order.length; i++) {
                if ((index = argx_order[i]) !== undefined) {
                    argx_indexes.push(index);
                }
            }

            ordered_indexes
                = ordered_indexes.concat(name_indexes, opx_indexes, argx_indexes, other_indexes);


            for (let i = 0; i < ordered_indexes.length; i++) {
                let index = ordered_indexes[i];
                let sub_loc = loc + '.' + index;
                let umrDict2penmanString_rec_result = umrDict2penmanString_rec(sub_loc, 1, umr_dict); // this stores one amr line
                if (umrDict2penmanString_rec_result) {
                    if (show_amr_new_line_sent(sub_loc, umr_dict)) {
                        s += '\n' + indent_for_loc(sub_loc, '&nbsp;') + umrDict2penmanString_rec_result;
                    } else {
                        s += ' ' + umrDict2penmanString_rec_result;
                    }
                }
            }
            s += ')';
        } else if (string) {
            s += string_m;
        } else { // variable is not empty
            s += variable;
        }
        return s;
    }
}