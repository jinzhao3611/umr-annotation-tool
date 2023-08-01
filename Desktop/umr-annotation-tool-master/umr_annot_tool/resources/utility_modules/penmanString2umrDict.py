import penman, re
def string2umr(penman_string):
    try:
        tree_object = penman.parse(penman_string)
    except Exception: #when penman_string is empty string
        return {}
    top_node_v = tree_object.node[0]
    umr = {"n": 1,
           "1.v": top_node_v}
    root_child_n = 0
    for path, branch in tree_object.walk():
        if len(path) == 1:
            root_child_n += 1

        if path == (0,):
            if branch[0] == '/':
                loc = 1
                umr[f"{loc}.c"] = branch[1]
                umr[f"{loc}.s"] = ""
            else:
                print("top concept branch should start with /")

        elif path[-1] != 0:
            loc = '1.' + '.'.join([str(i) for i in path])
            umr[f"{loc}.r"] = branch[0] #role
            if isinstance(branch[1], str):
                if re.search("^s\d+[a-z](\d+)?$", branch[1]): #match something like s1p, (case of reentrance)
                    umr[f"{loc}.s"] = ""
                    umr[f"{loc}.v"] = branch[1]
                else:
                    umr[f"{loc}.s"] = branch[1].replace('"', '')
                    umr[f"{loc}.v"] = ""
                umr[f"{loc}.c"] = ""
                umr[f"{loc}.n"] = 0
            else: #is type Penman Node(tuple[variable, Penman Branch])
                umr[f"{loc}.s"] = ""
                umr[f"{loc}.v"] = branch[1][0]
                umr[f"{loc}.c"] = branch[1][1][0][1]
                umr[f"{loc}.n"] = len(branch[1][1])-1
    umr["1.n"] = root_child_n - 1
    return umr


