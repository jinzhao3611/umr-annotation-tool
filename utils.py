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
from tabulate import tabulate
import argparse
from typing import Tuple
import pandas as pd

def parse_toolbox_xml(xml_path: str) -> Tuple:
    """
    parse the Arapahoe toolbox xml file
    :param xml_path: input toolbox xml file path
    :param output_path: output txt file path
    :param textonly: set to true if the output txt file only contains the tx line (raw text), false if all info needs to be included
    :return: None
    """

    tree = ET.parse(xml_path)
    root = tree.getroot()

    tx = list()
    mb = list()
    ge = list()
    ps = list()

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
        tx.append(tx_per_sentence)
        mb.append(mb_per_sentence)
        ge.append(ge_per_sentence)
        ps.append(ps_per_sentence)

    tbls = list()
    rowIDs = ['mb', 'ge', 'ps']
    for i in range(len(tx)):
        tbl = tabulate([mb[i], ge[i], ps[i]], headers=tx[i], tablefmt='orgtbl', showindex=rowIDs)
        tbls.append(tbl)

    return tx, tbls

def parse_flex_xml(xml_path: str) -> Tuple:
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
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help='the input xml file path')
    parser.add_argument("output", help='the output xml file path')
    parser.add_argument("source", help='either toolbox or flex')

    parser.add_argument("--textonly", help="the output txt file only shows the raw text of the tx line",
                        action="store_true")

    args = parser.parse_args()

    if args.source == 'toolbox':
        result = parse_toolbox_xml(args.input)
    else:
        #  args.source == 'flex'
        result = parse_flex_xml(args.input)

    output_to_file(args.textonly, args.output, result)


    # xml_path1 = '/Users/jinzhao/schoolwork/lab-work/language-samples/Arapahoe/text\ sample\ xml.xml out.txt'
    # xml_path2 = '/Users/jinzhao/schoolwork/lab-work/language-samples/Sanapana/Text\ Sample_Sanapana.xml'
    # xml_path3 = '/Users/jinzhao/schoolwork/lab-work/language-samples/Secoya/Seywt01-102006_VerifiableGeneric.xml'

    # parse_flex_xml(xml_path3, textonly=False)


