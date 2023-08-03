#ligatures, connectives
#vowel type imperfective form
#egyptian lemmas,regular lemmas
#typographical issue
#-i, -a, -u

import xml.etree.ElementTree as ET
import os, re
import json
from camel_tools.utils.charmap import CharMapper
frames_folder = "/Users/jinzhao/schoolwork/lab-work/umr_annot_tool_resources/ArabicPropbank/frames"
frames_dict = {}

bw2ar = CharMapper.builtin_mapper('bw2ar')
underspecified_vowels_pattern = '[aiuo~]'
for filename in os.listdir(frames_folder):
    if filename.endswith('.xml'):

        bw_lemma = re.sub('(-[a-z])*\.xml', '', filename)
        bw_lemma = re.sub(underspecified_vowels_pattern, '', bw_lemma)
        print(bw_lemma)
        ar_lemma = bw2ar(bw_lemma)
        print(ar_lemma)
        print('*************')

        tree = ET.parse(f'{frames_folder}/{filename}')
        root = tree.getroot()
        for child in root:
            role_id = ''
            args = {}
            if child.tag == "frameset":
                role_id = child.attrib.get('id', '')
                for role in child.findall('role'):
                    argnum = role.attrib.get('argnum', '')
                    argrole = role.attrib.get('argrole', '')
                    args[f'ARG{argnum}'] = argrole
                    # args['b_form'] = filename
                frames_dict[f'{ar_lemma}-{role_id}'] = args
with open('../frames_arabic.json', 'w') as f:
    f.write(json.dumps(frames_dict, indent=2))
