# run instructions:
# python utils.py [--textonly] input_path, output_path, source['toolbox' or 'flex']

# for example:
# python utils.py Arapahoe/text\ sample\ xml.xml arapahoe_with_morph.txt toolbox
# python utils.py Arapahoe/text\ sample\ xml.xml arapahoe_text_only.txt toolbox  —textonly
# python utils.py Sanapana/Text\ Sample_Sanapana.xml sanapana_with_morph.txt flex
# python utils.py Sanapana/Text\ Sample_Sanapana.xml sanapana_text_only.txt flex  —textonly
# python utils.py Secoya/Seywt01-102006_VerifiableGeneric.xml secoya_with_morph.txt flex
# python utils.py Secoya/Seywt01-102006_VerifiableGeneric.xml secoya_text_only.txt flex  —textonly

# 'Arapahoe/text\ sample\ xml.xml', 'Sanapana/Text\ Sample_Sanapana.xml', 'Secoya/Seywt01-102006_VerifiableGeneric.xml' are the input files sent to me
#     (the space in the file path name needs to be escaped)
#     (the tabulate package is used, the tables in output txt file cannot adjust to the window resize, please open it in full screen when necessary)

import xml.etree.ElementTree as ET
from typing import Tuple, List, Optional
import pandas as pd

def parse_xml(xml_path):
    try:
        root = ET.fromstring(xml_path) # actually xml string here
    except ET.ParseError:
        tree = ET.parse(xml_path)
        root = tree.getroot()

    if root.tag == 'document':
        return parse_flex_xml(xml_path)
    elif root.tag == 'database':
        return parse_toolbox_xml(xml_path)


def parse_toolbox_xml(xml_path: str) -> Tuple[List[List[str]], List[pd.DataFrame], List[str], str]:
    """
    parse the Arapahoe toolbox xml file
    :param xml_path: input toolbox xml file path
    :param output_path: output txt file path
    :param textonly: set to true if the output txt file only contains the tx line (raw text), false if all info needs to be included
    :return:
    """

    try:
        root = ET.fromstring(xml_path) # actually xml string here
    except ET.ParseError:
        tree = ET.parse(xml_path)
        root = tree.getroot()

    tx = list()
    mb = list()
    ge = list()
    ps = list()
    sents_gls = list()

    for refGroup in root.iter('refGroup'):
        tx_per_sentence = list()
        mb_per_sentence = list()
        ge_per_sentence = list()
        ps_per_sentence = list()
        for txGroup in refGroup:
            if txGroup.tag == 'txGroup':  # to exclude <ref>
                mb_per_word = list()
                ge_per_word = list()
                ps_per_word = list()
                for child in txGroup:
                    if child.tag == 'tx':
                        tx_per_sentence.append(child.text)
                    elif child.tag == 'mb':
                        mb_per_word.append(child.text)
                    elif child.tag == 'ge':
                        ge_per_word.append(child.text)
                    elif child.tag == 'ps':
                        ps_per_word.append(child.text)
                mb_per_sentence.append(mb_per_word)
                ge_per_sentence.append(ge_per_word)
                ps_per_sentence.append(ps_per_word)
            if txGroup.tag =='ft':
                sents_gls.append(txGroup.text)
        tx.append(tx_per_sentence)
        mb.append(mb_per_sentence)
        ge.append(ge_per_sentence)
        ps.append(ps_per_sentence)

    tbls = list()
    # rowIDs = ['mb', 'ge', 'ps']
    rowIDs = ['Morphemes', 'Morpheme Gloss', 'Morpheme Cat']

    for i in range(len(tx)):
        # tbl = tabulate([mb[i], ge[i], ps[i]], headers=tx[i], tablefmt='orgtbl', showindex=rowIDs)
        # tbls.append(tbl)
        df = pd.DataFrame([tx[i], [" ".join(e) for e in mb[i]], [" ".join(e) for e in ge[i]], [" ".join(e) for e in ps[i]]])
        df.index=['Words'] + rowIDs
        tbls.append(df)
    return tx, tbls, sents_gls, ""


def parse_flex_xml(xml_path: str) -> Tuple[List[List[str]], List[pd.DataFrame], List[str], List[Optional[str]]]:
    """
    parse the Secoya and Sanapana xml file
    :param xml_path: input toolbox xml file path
    :param output_path: output txt file path
    :param textonly: set to true if the output txt file only contains the tx line (raw text), false if all info needs to be included
    :return: None
    """
    try:
        root = ET.fromstring(xml_path) # actually xml string here
    except ET.ParseError:
        tree = ET.parse(xml_path)
        root = tree.getroot()

    txt = list()
    word_gls = list()
    cf = list()
    gls = list()
    msa = list()
    sent_gls = list()
    notes = list()

    for paragraph in root.iter('paragraph'): # each sentence
        txt_per_sentence = list()
        word_gls_per_sentence = list()
        cf_per_sentence = list()
        gls_per_sentence = list()
        msa_per_sentence = list()
        for words in paragraph.iter('words'):
            for word in words: # each word
                for child in word:
                    if child.tag == 'item':
                        if child.attrib['type'] == 'txt':
                            txt_per_sentence.append(child.text)
                        if child.attrib['type'] == 'gls':
                            word_gls_per_sentence.append(child.text)
                    elif child.tag == 'morphemes':
                        cf_per_word = list()
                        gls_per_word = list()
                        msa_per_word = list()
                        for morph in child:
                            for item in morph:
                                if item.attrib['type'] == 'txt':
                                    # take the text field (unlemmatized version)
                                    cf_per_word.append(item.text)
                                elif item.attrib['type'] == 'gls':
                                    gls_per_word.append(item.text)
                                elif item.attrib['type'] == 'msa':
                                    msa_per_word.append(item.text)
                        cf_per_sentence.append(cf_per_word)
                        gls_per_sentence.append(gls_per_word)
                        msa_per_sentence.append(msa_per_word)

        for phrases in paragraph.iter('phrases'):
            for word in phrases.findall('word'):
                for item in word.findall('item'):
                    if item.attrib['type'] == 'gls':
                        sent_gls.append(item.text)
                    if item.attrib['type'] == 'note':
                        notes.append(item.text)

        txt.append(txt_per_sentence)
        word_gls.append(word_gls_per_sentence)
        cf.append(cf_per_sentence)
        gls.append(gls_per_sentence)
        msa.append(msa_per_sentence)

    tbls = list()
    rowIDs = ['Morphemes', 'Morpheme Gloss', 'Morpheme Cat', 'Word Gloss']
    for i in range(len(txt)):
        # tbl = tabulate([cf[i], gls[i], msa[i], word_gls[i]], headers=txt[i], tablefmt='orgtbl', showindex=rowIDs)
        # tbls.append(tbl)
        df = pd.DataFrame([txt[i], [" ".join(e) for e in cf[i]], [" ".join(e) for e in gls[i]], [" ".join(e) for e in msa[i]], word_gls[i]])
        df.index = ['Words'] + rowIDs
        tbls.append(df)
    return txt, tbls, sent_gls, notes

def output_to_file(textonly:bool, output:str, result:Tuple) -> None:
    if textonly:
        with open(output, 'w') as outfile:
            for sentence in result[0]:
                outfile.write(" ".join(sentence) + '\n')
    else:
        with open(output, 'w') as outfile:
            for tbl in result[1]:
                outfile.write(tbl + '\n\n\n\n')

if __name__ == '__main__':

    toolbox_path = '/Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/sample_sentences/arapahoe.xml'
    flex_path = '/Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/sample_sentences/Sanapana_1.xml'

    with open(flex_path, 'r') as infile:
        content_string = infile.read()

    result = parse_xml(content_string)
    print(result)





