# this is used to split Lukas's file
import xml.etree.ElementTree as ET
from xml.etree.cElementTree import iterparse

def split_flex1_xml(input_path, output_path):
    # get an iterable and turn it into an iterator
    context = iter(iterparse(input_path, events=("start", "end")))
    # get the root element
    event, root = next(context)
    assert event == "start"
    paragraph_elem_list = []
    count = 0
    for event, elem in context:
        if event == "end" and elem.tag == "paragraph":
            paragraph_elem_list.append(elem)
            root.clear()

    with open(input_path, 'r') as f:
        content_string = f.read()
    root2 = ET.fromstring(content_string)
    paragraphs_ele = root2.findall('interlinear-text')[0].findall('paragraphs')[0]

    for paragraph in paragraphs_ele.findall('paragraph'):
        paragraphs_ele.remove(paragraph)
    for elem in paragraph_elem_list[36:72]:
        paragraphs_ele.append(elem)

    with open(output_path, 'w') as f:
        f.write(ET.tostring(root2).decode('utf-8'))
