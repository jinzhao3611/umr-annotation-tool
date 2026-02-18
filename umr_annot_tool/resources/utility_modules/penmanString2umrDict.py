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
                if re.search("^s\\d+[a-z\u00e0-\u00f6\u00f8-\u00ff\u0100-\u024f\u0259](\\d+)?$", branch[1]): #match something like s1p, (case of reentrance)
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

def triple_display_to_doc_umr(triple_display):
    # Remove extra spaces and line breaks for easier parsing
    triple_display = re.sub(r'\s+', ' ', triple_display).strip()

    # Initialize doc_umr
    doc_umr = {
        'n': 1,
        '1.v': re.search(r's\d+s0', triple_display)[0],  # Matches "s1s0"
        '1.c': "sentence",
        '1.s': ""
    }

    # Track index positions for nested structures
    triple_index = 1

    # Define relation categories
    temporal_relations = [":before", ":after", ":depends-on", ":overlap", ":Contained"]
    coref_relations = [":same-entity", ":same-event", ':subset-of']
    modal_relations = [":MODAL", ":Non-NeutAff", ":Non-FullAff", ":Non-NeutNeg", ":Non-FullNeg",
                       ":FullAff", ":PrtAff", ":NeutAff", ":FullNeg", ":PrtNeg", ":NeutNeg",
                       ":Strong-PrtAff", ":Weak-PrtAff", ":Strong-NeutAff", ":Weak-NeutAff",
                       ":Strong-PrtNeg", ":Weak-PrtNeg", ":Strong-NeutNeg", ":Weak-NeutNeg"]

    # Function to parse a nested block
    def parse_triple(triple, loc_key):
        nonlocal triple_index

        # Regex to match the format (parent relation child)
        triple_regex = re.compile(r'\(([^ ]+) ([^ ]+) ([^\)]+)\)')
        match = triple_regex.search(triple)

        if match:
            # Extract parent, relation, and child
            parent = match[1]
            sub_relation = match[2]
            child = match[3]
            print("locKey:", loc_key)

            # Populate parent structure
            doc_umr[f'{loc_key}.c'] = parent
            doc_umr[f'{loc_key}.v'] = parent
            doc_umr[f'{loc_key}.s'] = ''
            doc_umr[f'{loc_key}.n'] = 1

            if sub_relation in temporal_relations:
                doc_umr[f'{loc_key}.r'] = ":temporal"
            elif sub_relation in modal_relations:
                doc_umr[f'{loc_key}.r'] = ":modal"
            elif sub_relation in coref_relations:
                doc_umr[f'{loc_key}.r'] = ":coref"

            # Populate child structure
            doc_umr[f'{loc_key}.1.c'] = child
            doc_umr[f'{loc_key}.1.v'] = child
            doc_umr[f'{loc_key}.1.n'] = 0
            doc_umr[f'{loc_key}.1.r'] = sub_relation
            doc_umr[f'{loc_key}.1.s'] = ''

            # Log the extracted values or store them in an object
            print(f"Parent: {parent}, Relation: {sub_relation}, Child: {child}")
            triple_index += 1

        else:
            print(f"Invalid triple format: {triple}")

        doc_umr['1.n'] = triple_index

    # Extract triples, e.g., (DCT :before s1a) (s1x :depends-on s1x18)
    triples = re.findall(r'\([a-zA-Z0-9]+ :[\w-]+ [a-zA-Z0-9]+\)', triple_display)
    if triples:
        for triple in triples:
            parse_triple(triple, f'1.{triple_index}')

    return doc_umr

# if __name__ == '__main__':
#     from bs4 import BeautifulSoup
#
#     raw_triple = """<div id="amr">(s1s0 / sentence<br>
# :temporal ((DCT :before s1a)<br>
# (s1x :depends-on s1x18)<br>
# (s1x :depends-on s1x2)<br>
# (s1x2 :depends-on s1x11)<br>
# (s1x18 :depends-on s1x6)<br>
# (DCT :before s1x18))<br>
# :modal ((ROOT :MODAL AUTH)<br>
# (AUTH :FullAff s1x)<br>
# (AUTH :FullAff s1x2)<br>
# (AUTH :FullAff s1x6))<br>
# )<br>
# </div>"""
#     triple_display = BeautifulSoup(raw_triple).get_text()
#     print(triple_display)
#     doc_umr = triple_display_to_doc_umr(triple_display)
#     print(doc_umr)



