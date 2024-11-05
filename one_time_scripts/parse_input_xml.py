# run instructions:
# python parse_input_xml.py [--textonly] input_path, output_path, source['toolbox' or 'flex']

# for example:
# python parse_input_xml.py Arapahoe/text\ sample\ xml.xml arapahoe_with_morph.txt toolbox
# python parse_input_xml.py Arapahoe/text\ sample\ xml.xml arapahoe_text_only.txt toolbox  —textonly
# python parse_input_xml.py Sanapana/Text\ Sample_Sanapana.xml sanapana_with_morph.txt flex
# python parse_input_xml.py Sanapana/Text\ Sample_Sanapana.xml sanapana_text_only.txt flex  —textonly
# python parse_input_xml.py Secoya/Seywt01-102006_VerifiableGeneric.xml secoya_with_morph.txt flex
# python parse_input_xml.py Secoya/Seywt01-102006_VerifiableGeneric.xml secoya_text_only.txt flex  —textonly

# 'Arapahoe/text\ sample\ xml.xml', 'Sanapana/Text\ Sample_Sanapana.xml', 'Secoya/Seywt01-102006_VerifiableGeneric.xml' are the input files sent to me
#     (the space in the file path name needs to be escaped)
#     (the tabulate package is used, the tables in output txt file cannot adjust to the window resize, please open it in full screen when necessary)

import xml.etree.ElementTree as ET
from typing import Tuple, List, Dict
import pandas as pd
from itertools import accumulate
import operator
from bs4 import BeautifulSoup
import re, regex
from typing import NamedTuple, List
from umr_annot_tool.models import Sent, Doc, Annotation, User, Lexicon
from sqlalchemy.orm.attributes import flag_modified
from umr_annot_tool import db
from flask import flash
from umr_annot_tool.resources.utility_modules.penmanString2umrDict import string2umr, triple_display_to_doc_umr


class InfoToDisplay(NamedTuple):
    sents: List[List[str]]
    sents_html: str
    sent_htmls: List[str]
    df_htmls: List[str]
    gls: List[List[str]]
    notes: List[str]

class ExtractedXMLInfo(NamedTuple):
    sents: List[List[str]]
    dfs: List[pd.DataFrame]
    sents_gls: List[List[str]]
    conv_turns: List[str]
    paragraph_groups: List[int]

def amr_text2html(plain_text: str) -> str:
    html_string = re.sub('\n', '<br>\n', plain_text)
    html_string = '<div id="amr">' + html_string + '</div>\n'
    return html_string

def process_exported_file_isi_editor(content_string: str) -> Tuple[str, List[List[str]], List[str], List[str]]:
    """
    example file: /Users/jinzhao/schoolwork/lab-work/umr_annot_tool_resources/people/kristin/events37.xml
    /Users/jinzhao/schoolwork/lab-work/umr_annot_tool_resources/people/sijia/events37_wzdoc.xml
    """
    doc_content_string = ""
    sents = []
    sent_annots = []
    doc_annots = []
    print(content_string,'parsed_text')
    # parser = ET.XMLParser(encoding="utf-8")

    root = ET.fromstring(content_string)
    for child in root:
        if child.tag =='sntamr':
            for child2 in child:
                if child2.tag == 'amr':
                    amr = regex.sub(r'(\()([a-z][0-9]? /)', rf'\1s{str(len(sent_annots)+1)}\2', child2.text) #add sentence number to each variable
                    sent_annots.append(amr)
                elif child2.tag == 'doc-amr':
                    if child2.text:
                        doc_annots.append(child2.text) #assuming the input file looks like events37.xml sent by Sijia
                    else:
                        doc_annots.append("") #otherwise NoneType object will be added in
                elif child2.tag == 'sentence':
                    doc_content_string += '\n'+child2.text
                    sents.append(child2.text.split())
    return doc_content_string.strip(), sents, sent_annots, doc_annots

def parse_exported_file(content_string: str) -> Tuple[str, List[List[str]], List[str], List[str], List[Dict[str, str]]]:
    """
    :param content_string: Edmund Pope tasted freedom today for the first time in more than eight months .\nHe denied any wrongdoing .
    :return: doc_content_string: Edmund Pope tasted freedom today for the first time in more than eight months .\nHe denied any wrongdoing .
             sents: [['Edmund', 'Pope', 'tasted', 'freedom', 'today', 'for', 'the', 'first', 'time', 'in', 'more', 'than', 'eight', 'months', '.'], ['He', 'denied', 'any', 'wrongdoing', '.']]
             sent_annots: ['<div id="amr">(s1t&nbsp;/&nbsp;taste-01)<br>\n<div>\n', '<div id="amr">(s2d&nbsp;/&nbsp;deny-01)<br>\n<div>\n']
             doc_annots: ['<div id="amr">(s1&nbsp;/&nbsp;sentence<br>\n&nbsp;&nbsp;:modal&nbsp;((s1t&nbsp;:AFF&nbsp;s2d)))<br>\n<div>\n', '<div id="amr">(s2&nbsp;/&nbsp;sentence<br>\n&nbsp;&nbsp;:temporal&nbsp;((s2t&nbsp;:after&nbsp;s2d)))<br>\n<div>\n']
             aligns: ['s1t: '3-3', 's2d': 2-2', 'State': -1--1]
    """
    items = content_string.split("#")[:-1] #last item in list is original source file
    doc_content_string = content_string.split("#")[-1].replace(' Source File: \n', '').strip() #remove first line

    sent_indice = list(range(1, len(items), 4))
    sent_annot_indice = list(range(2, len(items), 4))
    align_indice = list(range(3, len(items), 4))
    doc_annot_indice = list(range(4, len(items), 4))
    sent_list = [items[i] for i in sent_indice]
    sent_annot_list = [items[i] for i in sent_annot_indice]
    align_list = [items[i] for i in align_indice]
    doc_annot_list = [items[i] for i in doc_annot_indice]

    sents = []
    for sent_content in sent_list:
        sent_content = re.sub(' :: snt\d+\tSentence: ', '', sent_content).strip()
        sent_content = re.sub(':: snt\d+', '', sent_content).strip()
        sent_content = re.sub('Sentence:', '', sent_content).strip()
        sents.append(sent_content.split())

    aligns = []
    for align_string in align_list:
        align_dict = {}
        align_items = re.sub('alignment:', '', align_string).strip().split('\n')
        for align_item in align_items:
            if align_item == '':
                continue
            key_str, value_str = align_item.split(':')
            if '(' in key_str:
                pattern = "^(.*)\((.*)\)"
                concept_or_string = re.match(pattern, key_str).group(1)
                variable = re.match(pattern, key_str).group(2)
                key = variable if variable else concept_or_string
                align_dict[key] = value_str.strip()
            else:
                align_dict[key_str.strip()] = value_str.strip()
        aligns.append(align_dict)

    sent_annots = [amr_text2html(re.sub(' sentence level graph:', '', sent_annot).strip() + '\n') for sent_annot in
                   sent_annot_list]
    doc_annots = [amr_text2html(re.sub(' document level annotation:', '', doc_annot).strip() + '\n') for doc_annot in
                  doc_annot_list]
    return doc_content_string, sents, sent_annots, doc_annots, aligns

def html(content_string: str, file_format: str, lang:str) -> 'InfoToDisplay':
    """
    :param file_format:
    :param content_string: raw string got read in from file, could be either flex or toolbox xml string, or a txt string
    :return: sents: [['aphleamkehlta', 'nenhlet', 'mahla', "apkehlpa'vayam", "aptenyay'a", 'yavhan'], ...]
            sents_html: html string of all sentences of one document, it's the html of sentences preview table in annotation page
            sent_htmls: a list of html strings of a single sentence ( linguistic information NOT included)
            df_htmls: a list of html strings of a single sentence ( linguistic information included)
            gls: [['', 'Viajó un hombre, parece cazando o buscando miel'], ...]
            notes: ['RA', ...]
    """
    if lang == 'arabic':
        justify = 'right'
    else:
        justify = 'center'

    gls = []
    notes = []
    df_htmls = []
    sents = []
    sents_html = ''
    if file_format == 'plain_text' or file_format == 'exported_file' or file_format== 'isi_editor': # split content string into List[List[str]]
        sents = [(['Sentence:'] + sent.split()) for sent in content_string.strip().split('\n')]
        sents_df = pd.DataFrame(content_string.strip().split('\n'))
        sents_df.index = sents_df.index + 1
        sents_html = sents_df.to_html(header=False, classes="table table-striped table-sm", justify=justify)

    elif file_format in ['flex1', 'flex2', 'flex3', 'toolbox1', 'toolbox2', 'toolbox3', 'toolbox4']:
        try:
            # ET.fromstring(content_string)
            sents, dfs, sents_gls, conv_turns, paragraph_groups = parse_xml(content_string, file_format)
            sents_df = pd.DataFrame([' '.join(sent) for sent in sents])
            sents_df.index = sents_df.index + 1
            sents_html = ''
            if paragraph_groups:
                paragraph_slice_indice = list(accumulate(paragraph_groups, operator.add))
                print('paragraph_slice_indice', paragraph_slice_indice)

                for i, slice_index in enumerate(paragraph_slice_indice):
                    sents_html += 'Paragraph: ' + str(i+1)
                    if i == 0:
                        sents_html += sents_df[:slice_index].to_html(header=False, classes="table table-striped table-sm", justify=justify)
                    else:
                        sents_html += sents_df[paragraph_slice_indice[i-1]:slice_index].to_html(header=False, classes="table table-striped table-sm", justify=justify)
            else:
                sents_html = sents_df.to_html(header=False, classes="table table-striped table-sm", justify=justify)
            for df in dfs:
                df.columns = range(1, len(df.columns) + 1)
                df_html = df.to_html(header=False, classes="table table-striped table-sm", justify=justify).replace(
                    'border="1"',
                    'border="0"')
                soup = BeautifulSoup(df_html, "html.parser")
                words_row = soup.findAll('tr')[0]
                words_row['id'] = 'current-words'
                gram_row = soup.findAll('tr')[3]
                gram_row['class'] = 'optional-rows'
                df_htmls.append(str(soup))
            for translation in sents_gls:
                gls.append(translation)
            for conv_turn in conv_turns:
                notes.append(conv_turn)
        except ET.ParseError:
            print('not xml format')

    sent_htmls = []  # a list of single sentence htmls
    for sent in sents:
        target_sent_html = pd.DataFrame([sent], columns=range(1, len(sent) + 1)).to_html(header=False, index=False,
                                                                                        classes="table table-striped table-sm",
                                                                                        justify=justify)
        if lang == 'arabic':
            target_sent_html = re.sub(
                r'class="dataframe table table-striped table-sm">',
                r'class="dataframe table table-striped table-sm" dir="rtl" style="text-align:right">',
                target_sent_html
            )
        sent_htmls.append(target_sent_html)

    # https: // stackoverflow.com / questions / 43312995 / pandas - to - html - add - attributes - to - table - tag
    if lang == 'arabic':
        sents_html = re.sub(
            r'class="dataframe table table-striped table-sm">',
            r'class="dataframe table table-striped table-sm" dir="rtl" style="text-align:right">',
            sents_html
        )
        # html string for all sentences
    #manually add id to each sentence td in order to color them
    sentid_p = re.compile(r"(<th>)(\d+)(<\/th>\s+<td)(>)")
    sents_html = sentid_p.sub(r'\1\2\3 id="sentid-\2"\4', sents_html)
    return InfoToDisplay(sents, sents_html, sent_htmls, df_htmls, gls, notes)

def parse_xml(xml_string, file_format) -> 'ExtractedXMLInfo':
    if file_format == 'flex1' or file_format == 'flex2':
        return parse_flex12(xml_string, file_format)
    elif file_format =='flex3':
        return parse_flex3(xml_string)
    elif file_format == 'toolbox1':
        return parse_toolbox1(xml_string)
    elif file_format == 'toolbox2':
        return parse_toolbox2(xml_string)
    elif file_format == 'toolbox3':
        return parse_toolbox3(xml_string)
    elif file_format == 'toolbox4':
        return parse_toolbox4(xml_string)

def parse_flex12(content_string: str, file_format: str) -> 'ExtractedXMLInfo':
    """
    example file: flex1: /Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/jens_van_gysel/Original_Verifiable generic_Paragraphs.xml
                flex2:  /Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/jens_van_gysel/Original_Verifiable generic.xml
    :param file_format: what exactly does the xml file look like
    :param content_string: input content string
    :return: txt: [["ahltama seyana'", "avanhe'", 'sanga'], ...]
            dfs : [ Dataframe(Words                             ahltama seyana'  avanhe'   sanga
                                Morphemes                         ahltama seyana'  avanhe'   sanga
                                Morpheme Gloss(en)
                                Morpheme Gloss(es)  anciano lugar de los sanapaná   grande  laguna
                                Morpheme Cat                                  sus      adj     sus
                                Word Gloss          anciano lugar de los sanapaná   grande  laguna), ...]
            sent_gls:  [['', "En ahltama seyana' había una laguna grande"],...] # first element of inner list is engish translation, second element is spanish translation
            conversation_turns:  ['', '', '', 'EG', '', '', '', 'EG', '', '', '', 'EG ', ...] # this is relevant to notes
            paragraph_groups:  []
    """
    try:
        root = ET.fromstring(content_string)
    except ET.ParseError:
        tree = ET.parse(content_string)
        root = tree.getroot()

    txt = list()
    word_gls = list()
    cf = list()
    gls = list()
    msa = list()
    sent_gls = list()
    conversation_turns = list()
    paragraph_groups = list()

    for paragraph in root.iter('paragraph'): # each sentence
        for phrases in paragraph.findall('phrases'): # should only have one phrases under each paragraph
            text_id_group = list()
            for i, word in enumerate(phrases.findall('word')): #only have one word when not grouped by paragraphs
                txt_per_sentence = list()
                word_gls_per_sentence = list()
                cf_per_sentence = list()
                gls_per_sentence = list()
                msa_per_sentence = list()
                for words in word.findall('words'):
                    for word2 in words.findall('word'): # each word
                        for child in word2:
                            if child.tag == 'item':
                                if child.attrib.get('type', '') == 'txt': # words row
                                    txt_per_sentence.append(child.text)
                                if child.attrib.get('type', '') == 'gls': # word gloss row
                                    word_gls_per_sentence.append(child.text)
                            elif child.tag == 'morphemes':
                                cf_per_word = list()
                                gls_per_word = list()
                                msa_per_word = list()
                                for morph in child:
                                    morpheme_gloss = ['', '']
                                    for item in morph:
                                        if item.attrib.get('type', '') == 'txt': #morphemes row
                                            # take the text field (unlemmatized version)
                                            if item.text is not None:
                                                cf_per_word.append(item.text)
                                            else:
                                                cf_per_word.append('')
                                        elif item.attrib.get('type', '') == 'gls': # morpheme gloss row
                                            if item.attrib.get('lang') == 'en':
                                                if item.text:
                                                    morpheme_gloss[0] = item.text
                                            elif item.attrib.get('lang') == 'es':
                                                if item.text:
                                                    morpheme_gloss[1] = item.text
                                            else:
                                                print(f"unidentified language: {item.attrib.get('lang')}")
                                        elif item.attrib.get('type', '') == 'msa': # morpheme cat row
                                            msa_per_word.append(item.text)
                                    gls_per_word.append(morpheme_gloss)
                                cf_per_sentence.append(cf_per_word)
                                gls_per_sentence.append(gls_per_word)
                                msa_per_sentence.append(msa_per_word)

                gls_list = ['', '']
                for item in word.findall('item'):
                    if item.attrib.get('type') == 'gls':
                        if item.attrib.get('lang') == 'en':
                            if item.text:
                                gls_list[0] = item.text
                        elif item.attrib.get('lang') == 'es':
                            if item.text:
                                gls_list[1] = item.text
                        else:
                            print(f"unidentified language: {item.attrib.get('lang')}")
                    conv_turn_string = ''
                    if item.attrib.get('type') == 'note':
                        conv_turn_string = item.text
                    conversation_turns.append(conv_turn_string)
                sent_gls.append(gls_list)

                text_id_group.append(i)
                txt.append(txt_per_sentence) # words row
                word_gls.append(word_gls_per_sentence) # word gloss row
                cf.append(cf_per_sentence) # morphemes row
                gls.append(gls_per_sentence) # morpheme gloss row
                msa.append(msa_per_sentence) # morpheme cat row
            if file_format == 'flex1':
                paragraph_groups.append(len(text_id_group))

    dfs = list()
    rowIDs = ['Morphemes', 'Morpheme Gloss(en)', 'Morpheme Gloss(es)', 'Morpheme Cat', 'Word Gloss']
    gls_en = []
    gls_es = []
    for sent_level_gls in gls:
        gls_en_word_level = []
        gls_es_word_level = []
        for word_level_gls in sent_level_gls:
            gls_en_morph_level = []
            gls_es_morph_level = []
            for morph_level_gls in word_level_gls:
                gls_en_morph_level.append(morph_level_gls[0])
                gls_es_morph_level.append(morph_level_gls[1])
            gls_en_word_level.append(gls_en_morph_level)
            gls_es_word_level.append(gls_es_morph_level)
        gls_en.append(gls_en_word_level)
        gls_es.append(gls_es_word_level)
    for i in range(len(txt)):
        df = pd.DataFrame([txt[i], [" ".join(e) for e in cf[i]], [" ".join(e) for e in gls_en[i]], [" ".join(e) for e in gls_es[i]], [" ".join(e) for e in msa[i]], word_gls[i]])
        df.index = ['Words'] + rowIDs
        dfs.append(df)
    return ExtractedXMLInfo(txt, dfs, sent_gls, conversation_turns, paragraph_groups)

def parse_flex3(xml_string:str) -> 'ExtractedXMLInfo':
    """
    example file: /Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/jens_van_gysel/Original_XLingPaper, align morphemes.xml
    :param xml_string:
    :return: txt: [['aphleamkehlta', 'nenhlet', 'mahla', "apkehlpa'vayam", "aptenyay'a", 'yavhan'], ...]
            dfs:[[                                                  0  ...                  5
                    Words                                 aphleamkehlta  ...             yavhan
                    Morphemes                     ap- hle -am -ke =hlta  ...             yavhan
                    Morpheme Gloss  2/3M.I viajar PST/HAB V1.NFUT =PHOD  ...  miel del "yavhan"
                    Morpheme Cat                v:Any v v:Any v:Any prt  ...                sus
                    Word Gloss                                    viajó  ...               miel], ...]
            sent_gls: ['Viajó un hombre, parece cazando o buscando miel', ...]
            conversation_turns: ['RA', ...]
            paragraph_groups: [] because this format of file is not separated by paragraphs
    """
    try:
        root = ET.fromstring(xml_string) # actually xml string here
    except ET.ParseError:
        tree = ET.parse(xml_string)
        root = tree.getroot()

    txt = list()
    sent_gls = list()
    word_gls = list()

    cf = list()
    gls = list()
    msa = list()

    conversation_turns = list()
    paragraph_groups = list()

    for sentence in root.iter('phrase'):
        txt_per_sentence = list()
        word_gls_per_sentence = list()
        cf_per_sentence = list()
        gls_per_sentence = list()
        msa_per_sentence = list()
        for iword in sentence.iter('iword'):
            cf_per_word = list()
            gls_per_word = list()
            msa_per_word = list()
            for item in iword.findall('item'):
                if item.attrib.get('type', '') == 'gls':
                    word_gls_per_sentence.append(item.text)
                if item.attrib.get('type', '') == 'txt':
                    txt_per_sentence.append(iword.find('item').text)
            for morph in iword.iter('morph'):
                for item in morph.findall('item'):
                    if item.attrib.get('type', '') == 'txt':
                        cf_per_word.append(item.text)
                    if item.attrib.get('type', '') == 'gls':
                        gls_per_word.append(item.text)
                    if item.attrib.get('type', '') == 'msa':
                        msa_per_word.append(item.text)
            cf_per_sentence.append(cf_per_word)
            gls_per_sentence.append(gls_per_word)
            msa_per_sentence.append(msa_per_word)

        for item in sentence.findall('item'):
            gls_list = ['', '']
            conv_turn_string = ''
            if item.attrib.get('type', '') == 'gls':
                if item.attrib.get('lang', '') == 'en-free':
                    gls_list[0] = item.text
                if item.attrib.get('lang', '') == 'es-free':
                    gls_list[1] = item.text
            if item.attrib.get('type', '') == 'note':
                conv_turn_string = item.text
            sent_gls.append(gls_list)
            conversation_turns.append(conv_turn_string)

        txt.append(txt_per_sentence)  # words row
        word_gls.append(word_gls_per_sentence)  # word gloss row
        cf.append(cf_per_sentence)  # morphemes row
        gls.append(gls_per_sentence)  # morpheme gloss row
        msa.append(msa_per_sentence)  # morpheme cat row

    dfs = list()
    rowIDs = ['Morphemes', 'Morpheme Gloss', 'Morpheme Cat', 'Word Gloss']
    for i in range(len(txt)):
        df = pd.DataFrame([txt[i], [" ".join(e) for e in cf[i]], [" ".join(e) for e in gls[i]], [" ".join(e) for e in msa[i]], word_gls[i]])
        df.index = ['Words'] + rowIDs
        dfs.append(df)
    return ExtractedXMLInfo(txt, dfs, sent_gls, conversation_turns, paragraph_groups)

def parse_toolbox1(xml_string: str) -> 'ExtractedXMLInfo':
    """
    parse the Arapahoe toolbox xml file
    :param xml_string: input toolbox xml file path
    :param output_path: output txt file path
    :param textonly: set to true if the output txt file only contains the tx line (raw text), false if all info needs to be included
    :return:
    """

    try:
        root = ET.fromstring(xml_string) # actually xml string here
    except ET.ParseError:
        tree = ET.parse(xml_string)
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
                sents_gls.append([txGroup.text, ''])
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
    return ExtractedXMLInfo(tx, tbls, sents_gls, [""], [])

def parse_toolbox2(xml_string: str) -> 'ExtractedXMLInfo':
    """
    parse the Arapahoe toolbox xml file
    :param xml_string: input toolbox xml file path
    :return:
    """
    sents_of_words = list()
    sents_of_morphs = list()
    sents_of_ges = list()
    sents_of_gss = list()
    sents_gls = list()
    notes = list()
    dfs = list()

    chunks = [chunk.split('\n') for chunk in re.split('<ref>[\d\.]+</ref>', xml_string)][1:]
    for c in chunks:
        words = list()
        morphs = list()
        morph_gloss_english = list()
        morph_gloss_spanish = list()
        ori_morph = list()
        ori_ge = list()
        ori_gs = list()
        nt_flag = True
        f_flag = True
        temp_notes = ""

        for item in c:
            item = item.strip()
            if item.startswith('<trs>'):
                words.extend(item[5:-6].split())
            elif item.startswith('<m>'):
                ori_morph.append(item[3:-4])
            elif item.startswith('<ge>'):
                ori_ge.append(item[4: -5])
            elif item.startswith('<gs>'):
                ori_gs.append(item[4: -5])
            elif item.startswith('<f>'):
                sents_gls.append(['', item[3: -4]])
                f_flag = False
            elif item.startswith('<nt>'):
                temp_notes += '\n' + item[4: -5]
                nt_flag = False
        notes.append(temp_notes)
        if nt_flag:
            notes.append("")
        if f_flag:
            sents_gls.append(["", ''])

        for mor, ge, gs in zip(ori_morph, ori_ge, ori_gs):
            aligned_mor, aligned_ge, aligned_gs = align(mor, ge, gs)
            morphs.extend(aligned_mor)
            morph_gloss_english.extend(aligned_ge)
            morph_gloss_spanish.extend(aligned_gs)

        sents_of_words.append(words)
        sents_of_morphs.append(morphs)
        sents_of_ges.append(morph_gloss_english)
        sents_of_gss.append(morph_gloss_spanish)

    rowIDs = ['Morphemes', 'Morpheme Gloss(English)', 'Morpheme Gloss(Spanish)']

    print('first sent morph: ', sents_of_morphs[0])
    for i in range(len(sents_of_words)):
        df = pd.DataFrame(
            [sents_of_words[i],  sents_of_morphs[i], sents_of_ges[i], sents_of_gss[i]])
        df.index = ['Words'] + rowIDs
        dfs.append(df)
    return ExtractedXMLInfo(sents_of_words, dfs, sents_gls, notes, [])

def parse_toolbox3(xml_string: str) -> 'ExtractedXMLInfo':
    """
    parse the Arapahoe toolbox xml file
    :param xml_string: input toolbox xml file path
    :return:
    """
    sents_of_words = list()
    sents_of_morphs = list()
    sents_of_ges = list()
    sents_of_gss = list()
    sents_gls = list()
    notes = list()
    dfs = list()

    print('chunks: ', re.split('\\ref \d+\.\d+', xml_string))
    chunks = [chunk.split('\n') for chunk in re.split('\\\\ref \d+\.\d+', xml_string)][1:]
    for c in chunks:
        print('chunk from parse_toolbox3: ', c)
        words = list()
        morphs = list()
        morph_gloss_english = list()
        morph_gloss_spanish = list()
        ori_morph = list()
        ori_ge = list()
        ori_gs = list()
        nt_flag = True
        f_flag = True
        temp_notes = ""

        for item in c:
            item = item.strip()
            print('item from parse_toolbox3: ', item)
            if item.startswith('\\trs'):
                words.extend(item[5:].split())
                print('words from parse_toolbox3: ',words)
            elif item.startswith('\\m'):
                ori_morph.append(item[3:])
            elif item.startswith('\\ge'):
                ori_ge.append(item[4:])
            elif item.startswith('\\gs'):
                ori_gs.append(item[4:])
            elif item.startswith('\\f'):
                sents_gls.append(['', item[3:]])
                f_flag = False
            elif item.startswith('\\nt'):
                temp_notes += '\n' + item[4:]
                nt_flag = False
        notes.append(temp_notes)
        if nt_flag:
            notes.append("")
        if f_flag:
            sents_gls.append(["", ''])

        for mor, ge, gs in zip(ori_morph, ori_ge, ori_gs):
            aligned_mor, aligned_ge, aligned_gs = align(mor, ge, gs)
            morphs.extend(aligned_mor)
            morph_gloss_english.extend(aligned_ge)
            morph_gloss_spanish.extend(aligned_gs)

        sents_of_words.append(words)
        sents_of_morphs.append(morphs)
        sents_of_ges.append(morph_gloss_english)
        sents_of_gss.append(morph_gloss_spanish)

    print('sents from parse_toolbox3: ', sents_of_words)
    rowIDs = ['Morphemes', 'Morpheme Gloss(English)', 'Morpheme Gloss(Spanish)']

    for i in range(len(sents_of_words)):
        df = pd.DataFrame(
            [sents_of_words[i],  sents_of_morphs[i], sents_of_ges[i], sents_of_gss[i]])
        df.index = ['Words'] + rowIDs
        dfs.append(df)
    return ExtractedXMLInfo(sents_of_words, dfs, sents_gls, notes, [])

def align(morph_string: str, ge_string: str, gs_string: str) -> Tuple[List[str], List[str], List[str]]:
    toks = morph_string.strip().split()
    ge_list = ge_string.strip().split()
    gs_list = gs_string.strip().split()

    morphs = []
    ges = []
    gss = []
    temp_morphs = []
    temp_ges = []
    temp_gss = []

    for i, tok in enumerate(toks):
        if not tok.startswith("-") and temp_morphs:
            if not temp_morphs[-1].endswith("-"):
                morphs.append(" ".join(temp_morphs))
                ges.append(" ".join(temp_ges))
                gss.append(" ".join(temp_gss))
                temp_morphs = []
                temp_ges = []
                temp_gss = []
        temp_morphs.append(tok)
        temp_ges.append(ge_list[i])
        temp_gss.append(gs_list[i])
    if temp_morphs:
        morphs.append(" ".join(temp_morphs))
        ges.append(" ".join(temp_ges))
        gss.append(" ".join(temp_gss))

    return morphs, ges, gss

def parse_toolbox4(xml_string: str) -> 'ExtractedXMLInfo':
    """
    parse the Arapahoe toolbox xml file
    :param xml_string: input toolbox xml file path
    :return:
    """
    sents_of_words = list()
    sents_of_morphs = list()
    sents_of_ges = list()
    sents_of_gss = list()
    sents_gls = list()
    notes = list()
    dfs = list()

    chunks = [chunk.split('\n') for chunk in re.split('\\\\ref .+-.+ \d+', xml_string)][1:]
    for c in chunks:
        words = list()
        morphs = list()
        morph_gloss_english = list()
        morph_gloss_spanish = list()
        ori_morph = list()
        ori_ge = list()
        ori_gs = list()
        nt_flag = True
        f_flag = True
        temp_notes = ""
        en_es_gloss = ['', '']
        for item in c:
            item = item.strip()
            if item.startswith('\\trs'):
                words.extend(item[5:].split())
            elif item.startswith('\\m'):
                ori_morph.append(item[3:])
            elif item.startswith('\\ge'):
                ori_ge.append(item[4:])
            elif item.startswith('\\gs'):
                ori_gs.append(item[4:])
            elif item.startswith('\\fs'):
                en_es_gloss[1] = item[4:]
            elif item.startswith('\\fe'):
                en_es_gloss[0] = item[4:]
            elif item.startswith('\\nt'):
                temp_notes += '\n' + item[4:]
                nt_flag = False
        notes.append(temp_notes)
        if nt_flag:
            notes.append("")
        sents_gls.append(en_es_gloss)

        for mor, ge, gs in zip(ori_morph, ori_ge, ori_gs):
            aligned_mor, aligned_ge, aligned_gs = align(mor, ge, gs)
            morphs.extend(aligned_mor)
            morph_gloss_english.extend(aligned_ge)
            morph_gloss_spanish.extend(aligned_gs)

        sents_of_words.append(words)
        sents_of_morphs.append(morphs)
        sents_of_ges.append(morph_gloss_english)
        sents_of_gss.append(morph_gloss_spanish)

    print('sents from parse_toolbox4: ', sents_of_words)
    rowIDs = ['Morphemes', 'Morpheme Gloss(English)', 'Morpheme Gloss(Spanish)']

    for i in range(len(sents_of_words)):
        df = pd.DataFrame(
            [sents_of_words[i],  sents_of_morphs[i], sents_of_ges[i], sents_of_gss[i]])
        df.index = ['Words'] + rowIDs
        dfs.append(df)
    return ExtractedXMLInfo(sents_of_words, dfs, sents_gls, notes, [])

def lexicon2db(project_id:int, lexicon_dict: dict):
    existing_lexicon = Lexicon.query.filter(Lexicon.project_id==project_id).first()
    existing_lexicon.lexi = lexicon_dict
    flag_modified(existing_lexicon, 'lexi')
    db.session.commit()
    flash('your lexicon has been saved to db', 'success')

def file2db(filename: str, file_format: str, content_string: str, lang: str, sents: List[List[str]], has_annot: bool, current_project_id:int, current_user_id:int,
            sent_annots=None, doc_annots=None, aligns=None) -> int:
    existing_doc = Doc.query.filter_by(filename=filename, user_id=current_user_id, project_id=current_project_id).first()
    if existing_doc:
        doc_id = existing_doc.id
        flash('Upload failed: A document with the same name is already in current project.', 'success')
    else:
        doc = Doc(lang=lang, filename=filename, content=content_string, user_id=current_user_id,
                  file_format=file_format, project_id=current_project_id)
        db.session.add(doc)
        db.session.commit()
        doc_id = doc.id
        flash('Your doc has been created!', 'success')
        for sent_of_tokens in sents:
            sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id)
            db.session.add(sent)
            db.session.commit()
        flash('Your sents has been created.', 'success')

    if file_format == 'isi_editor' or has_annot:
        for i in range(len(sents)):
            dummy_user_id = User.query.filter(User.username=="dummy_user").first().id
            if sent_annots:
                dehtml_sent_annot = BeautifulSoup(sent_annots[i]).get_text()
            else:
                dehtml_sent_annot = ""
            if doc_annots:
                dehtml_doc_annot = doc_annots[i] #assuming doc_annots contains clean doc_annots, do not need Beautiful soup to parse
            else:
                dehtml_doc_annot = ""
            if aligns:
                pass_aligns = aligns[i]
            else:
                pass_aligns = {}
            sent_umr = string2umr(dehtml_sent_annot)
            annotation = Annotation(sent_annot=dehtml_sent_annot, doc_annot=dehtml_doc_annot, alignment=pass_aligns,
                                    user_id=dummy_user_id, # pre-existing annotations are assigned to dummy user, waiting for annotators to check out
                                    sent_id=i + 1, #sentence id counts from 1
                                    doc_id=doc_id,
                                    sent_umr=sent_umr, doc_umr={}, actions=[])
            db.session.add(annotation)
        db.session.commit()
        flash('Your annotations has been created.', 'success')
    return doc_id

def file2db_override(doc_id:int, filename: str, file_format: str, content_string: str, lang: str, sents: List[List[str]], has_annot: bool, current_project_id:int, current_user_id:int,
            sent_annots=None, doc_annots=None, aligns=None) -> int:
    print("file2db_override is called")
    if file_format == 'isi_editor' or has_annot:
        for i in range(len(sents)):
            if sent_annots:
                dehtml_sent_annot = BeautifulSoup(sent_annots[i]).get_text()
            else:
                dehtml_sent_annot = ""
            if doc_annots:
                dehtml_doc_annot = BeautifulSoup(doc_annots[i]).get_text()
            else:
                dehtml_doc_annot = ""
            if aligns:
                pass_aligns = aligns[i]
            else:
                pass_aligns = {}
            sent_umr = string2umr(dehtml_sent_annot)
            doc_umr = triple_display_to_doc_umr(correct_doc_graph_string_format(dehtml_doc_annot))
            annotation = Annotation.query.filter_by(doc_id=doc_id, sent_id=i + 1, user_id=current_user_id).first()

            if annotation:
                annotation.sent_annot = dehtml_sent_annot
                annotation.doc_annot = dehtml_doc_annot
                annotation.alignment = pass_aligns
                annotation.sent_umr = sent_umr
                annotation.doc_umr = doc_umr
                annotation.actions = []
                db.session.commit()
                flash('Your annotations has been overriden.', 'success')
            else:
                flash("Error: Annotation with the specified doc_id and sent_id does not exist.", "Error")
    return doc_id

def parse_file_info(file_content):
    print("parse_file_info is called")
    # Define a dictionary to store parsed values
    parsed_data = {
        "user_name": None,
        "user_id": None,
        "file_language": None,
        "file_format": None,
        "doc_id": None
    }

    # Define regex patterns to extract the needed information
    patterns = {
        "user_name": r"user name:\s*(\S+)",
        "user_id": r"user id:\s*(\d+)",
        "file_language": r"file language:\s*(\S+)",
        "file_format": r"file format:\s*(\S+)",
        "doc_id": r"Doc ID in database:\s*(\d+)"
    }

    # Extract data using regex patterns
    for key, pattern in patterns.items():
        match = re.search(pattern, file_content)
        if match:
            parsed_data[key] = match.group(1)

    # Check if all required fields were extracted successfully
    is_legit = all(value is not None for value in parsed_data.values())
    print(parsed_data)

    return is_legit, parsed_data


def correct_doc_graph_string_format(wrong_graph):
    # Step 1: Remove excessive whitespace
    wrong_graph = re.sub(r'\s+', ' ', wrong_graph).strip()
    # Define a regular expression pattern to find the extra parentheses
    pattern = re.compile(r"\s?(\([^\s()]+\s+:[^\s()]+\s+)\(([^\s()]+)(\)+)")

    # Use a loop to ensure all occurrences are replaced
    while True:
        # Replace the pattern with the corrected format
        new_graph = pattern.sub(r'\1\2\3', wrong_graph)
        # Break the loop if no more replacements are made
        if new_graph == wrong_graph:
            break
        wrong_graph = new_graph
    return new_graph

# if __name__ == '__main__':
#     graph = """(s7s0 / sentence :temporal ((DCT :overlap (s7b) (s7b :depends-on (s7x9) (s7b :depends-on (s7x14) (s7b :depends-on (s7x6) (s7b :depends-on s7x) :modal ((ROOT :MODAL (AUTH) (AUTH :FullAff (s7x14) (AUTH :FullAff (s7x9) (AUTH :FullNeg (s7x6) (AUTH :FullAff s7x) :coref ((s6a :same-event s7i2))"""
#
#     correct_graph = correct_doc_graph_string_format(graph)
#     curr_umr = triple_display_to_doc_umr(correct_graph)
#     print(correct_graph)