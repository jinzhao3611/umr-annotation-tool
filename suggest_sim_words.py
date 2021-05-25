# this file is used to suggest a word list that probably share the same lemma with selected word (in under-resource language that doesn't have frame files)
import editdistance #https://github.com/roy-ht/editdistance
import xml.etree.ElementTree as ET
import pandas as pd
from collections import defaultdict
import itertools
from typing import List,Tuple, Set, NamedTuple
import numpy as np
# import mlconjug3
from collections.abc import ValuesView
from parse_input_xml import parse_xml


class WordCandidates(NamedTuple):
    words_wz_same_roots: ValuesView
    words_wz_sim_gloss: ValuesView
    words_wz_sim_tok: ValuesView

#this is used to test sanapa data temporarily
def parse_flex2(content_string: str):
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
    roots = list()
    roots_gloss = list()

    for paragraph in root.iter('paragraph'): # each sentence
        for phrases in paragraph.findall('phrases'): # should only have one phrases under each paragraph
            for i, word in enumerate(phrases.findall('word')): #only have one word when not grouped by paragraphs
                txt_per_sentence = list()
                word_gls_per_sentence = list()
                cf_per_sentence = list()
                gls_per_sentence = list()
                msa_per_sentence = list()
                root_per_sentence = list()
                root_gloss_per_sentence = list()
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
                                root_of_word =''
                                root_gloss_of_word = ''
                                for morph in child:
                                    for item in morph:
                                        if (morph.attrib.get('type', '') == 'stem' or morph.attrib.get('type', '') =='root') and item.attrib.get('type', '') == 'txt':
                                            root_of_word = item.text
                                        if (morph.attrib.get('type', '') == 'stem' or morph.attrib.get('type', '') =='root') and item.attrib.get('type', '') == 'gls':
                                            root_gloss_of_word = item.text
                                        if item.attrib.get('type', '') == 'txt': #morphemes row
                                            # take the text field (unlemmatized version)
                                            if item.text is not None:
                                                cf_per_word.append(item.text)
                                            else:
                                                cf_per_word.append('')
                                        elif item.attrib.get('type', '') == 'gls': # morpheme gloss row
                                            if item.text is not None:
                                                gls_per_word.append(item.text)
                                            else:
                                                gls_per_word.append('')
                                        elif item.attrib.get('type', '') == 'msa': # morpheme cat row
                                            msa_per_word.append(item.text)
                                cf_per_sentence.append(cf_per_word)
                                gls_per_sentence.append(gls_per_word)
                                msa_per_sentence.append(msa_per_word)
                                root_per_sentence.append(root_of_word)
                                root_gloss_per_sentence.append(root_gloss_of_word)


                txt.append(txt_per_sentence) # words row
                word_gls.append(word_gls_per_sentence) # word gloss row
                cf.append(cf_per_sentence) # morphemes row
                gls.append(gls_per_sentence) # morpheme gloss row
                msa.append(msa_per_sentence) # morpheme cat row
                roots.append(root_per_sentence)
                roots_gloss.append(root_gloss_per_sentence)

    return txt, roots, roots_gloss, cf, gls, msa, word_gls

def get_edit_distances(sents: List[List[str]], threshold=2):
    edit_distances = list()
    for word1, word2 in itertools.combinations(set([item for sublist in sents for item in sublist]), 2):
        distance = editdistance.eval(word1, word2)
        if distance <= threshold and len(word1) >3 and len(word2)>3:
            edit_distances.append((word1, word2))
    return edit_distances

def get_words_wz_same_root(roots: List[List[str]], sents: List[List[str]]):
    words_wz_same_root = defaultdict(set)
    for i in range(len(sents)):
        for j in range(len(sents[i])):
            words_wz_same_root[roots[i][j]].add((sents[i][j]))
    return words_wz_same_root

def get_words_wz_same_root_gloss(roots_gloss: List[List[str]], sents: List[List[str]]):
    words_wz_same_root_gloss = defaultdict(set)
    for i in range(len(sents)):
        for j in range(len(sents[i])):
            words_wz_same_root_gloss[roots_gloss[i][j]].add((sents[i][j]))
    return words_wz_same_root_gloss
def get_words_wz_similar_translation(model, word_gloss: List[List[str]], sents: List[List[str]], threshold=0.8):
    gloss_indices = defaultdict()
    for i, sent_translation in enumerate(word_gloss):
        for j, word_translation in enumerate(sent_translation):
            gloss_indices[word_translation] = (i, j)

    cosine_similarities = list()
    for gloss1, gloss2 in itertools.combinations(set(itertools.chain.from_iterable(word_gloss)), 2):
        gloss1_emb = np.mean([model[tok] for tok in gloss1.split()], axis=0)
        gloss2_emb = np.mean([model[tok] for tok in gloss2.split()], axis=0)
        # cosine_similarities[np.dot(gloss1_emb, gloss2_emb) / (np.linalg.norm(gloss1_emb) * np.linalg.norm(gloss2_emb))].append((gloss1, gloss2))
        if(np.dot(gloss1_emb, gloss2_emb) / (np.linalg.norm(gloss1_emb) * np.linalg.norm(gloss2_emb)) > threshold):
            tok1 = sents[gloss_indices[gloss1][0]][gloss_indices[gloss1][1]]
            tok2 = sents[gloss_indices[gloss2][0]][gloss_indices[gloss2][1]]
            if tok1 != tok2:
                cosine_similarities.append((tok1, tok2))
    return cosine_similarities

# #todo: added this in get_words_wz_similar_translation function to replace congugations in gloss with its lemma
# def get_conjugations_from_verb(verb: str) -> Set[str]:
#     try:
#         default_conjugator = mlconjug3.Conjugator(language='es')
#         test_verb = default_conjugator.conjugate(verb)
#         all_conjugated_forms = test_verb.iterate()
#         return set([form[-1] for form in all_conjugated_forms])
#     except ValueError: #ValueError: The supplied word: subieseis is not a valid verb in Español.
#         return set()

def group_together_tuples(lst: List[Tuple[str, str]]):
    #https://stackoverflow.com/questions/42036188/merging-tuples-if-they-have-one-common-element
    #    edges = [('c', 'e'), ('c', 'd'), ('a', 'b'), ('d', 'e')]
    def dfs(adj_list, visited, vertex, result, key):
        visited.add(vertex)
        result[key].append(vertex)
        for neighbor in adj_list[vertex]:
            if neighbor not in visited:
                dfs(adj_list, visited, neighbor, result, key)

    adj_list = defaultdict(list)
    for x, y in lst:
        adj_list[x].append(y)
        adj_list[y].append(x)

    result = defaultdict(list)
    visited = set()
    for vertex in adj_list:
        if vertex not in visited:
            dfs(adj_list, visited, vertex, result, vertex)
    return result.values()  #dict_values([['c', 'e', 'd'], ['a', 'b']])

def find_suggested_words(word:str, word_candidates: 'WordCandidates'):
    suggestions = list()
    for group in word_candidates.words_wz_same_roots:
        if word in group:
            suggestions.extend(group)
    print('generated full similar word suggestions from root: ', suggestions)

    for group in word_candidates.words_wz_sim_gloss:
        if word in group:
            suggestions.extend(group)
    print('generated full similar word suggestions from glos: ', suggestions)

    for group in word_candidates.words_wz_sim_tok:
        if word in group:
            suggestions.extend(group)
    print('generated full similar word suggestions from toke: ', suggestions)
    suggestions = [x for x in suggestions if x != word]
    print('suggestions ', suggestions)
    return list(dict.fromkeys(suggestions))[:10]

def generate_candidate_list(content_string, format):
    sents=[]
    roots=[]
    roots_gloss=[]
    morphemes=[]
    morph_gloss=[]
    morph_cat=[]
    word_gloss=[]
    if format == 'flex2':
        sents, roots, roots_gloss, morphemes, morph_gloss, morph_cat, word_gloss = parse_flex2(content_string)
        words_wz_same_roots = get_words_wz_same_root(sents=sents, roots=roots).values()
        words_wz_same_roots_gloss = get_words_wz_same_root_gloss(sents=sents, roots_gloss=roots_gloss).values()
    else:
        try:
            sents, _,_,_,_ = parse_xml(content_string, format)
        except:
            sents = []
        words_wz_same_roots = []
        words_wz_same_roots_gloss = []
    # model = fasttext.load_model('/Users/jinzhao/Downloads/wiki.es/wiki.es.bin')
    # similar_translations = get_words_wz_similar_translation(model, word_gloss=word_gloss, sents=sents, threshold=0.5)
    # words_wz_sim_gloss = group_together_tuples(similar_translations)
    similar_words_edit_distances = get_edit_distances(sents, threshold=3)
    words_wz_sim_tok = group_together_tuples(lst=similar_words_edit_distances)
    word_candidates = WordCandidates(words_wz_same_roots, words_wz_same_roots_gloss, words_wz_sim_tok)
    return word_candidates


if __name__ == '__main__':
    # path = '/Users/jinzhao/schoolwork/lab-work/umr_annot_tool_resources/resources/sample_sentences/Sanapana_1.xml'
    # path = '/Users/jinzhao/schoolwork/lab-work/umr_annot_tool_resources/resources/sample_sentences/arapahoe.xml'
    path = '/Users/jinzhao/Desktop/The trouble at round rock.xml'
    with open(path, 'r', encoding='utf-8') as f:
        content_string = f.read()
    word_candidates = generate_candidate_list(content_string, 'flex2')
    # result = find_suggested_words(word='nenhletala', word_candidates=word_candidates)






