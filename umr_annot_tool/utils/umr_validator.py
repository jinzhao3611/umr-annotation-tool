#! /usr/bin/env python3
# Copyright © 2023, 2024 Dan Zeman <zeman@ufal.mff.cuni.cz>
import sys
import io
import os.path
import argparse
import traceback
# According to https://stackoverflow.com/questions/1832893/python-regex-matching-unicode-properties,
# the regex module has the same API as re but it can check Unicode character properties using \p{}
# as in Perl.
#import re
import regex as re
import unicodedata
from functools import cmp_to_key # for custom partial sorting
# Optionally we can access Wikidata API through the requests library.
# Install the library with pip3 install requests (or python3 -m pip install requests).
# If the library is not installed, this script should still work, just skipping any dereferences of Wikidata codes.
try:
    import requests
    requests_installed = True
except ImportError:
    requests_installed = False


THISDIR=os.path.dirname(os.path.realpath(os.path.abspath(__file__))) # The folder where this script resides.

# Global variables:
curr_fname = None # Current input file
curr_line = 0 # Current line in the input file
sentence_line = 0 # The line in the input file on which the current sentence starts
sentence_id = None # The most recently read sentence id
error_counter = {} # key: error type value: error count
warn_on_missing_files = set() # langspec files which you should warn about in case they are missing (can be deprel, edeprel, feat_val, tokens_w_space)

# Lemmatization using lemminflect (lighter alternative to spacy)
try:
    import lemminflect
    LEMMINFLECT_AVAILABLE = True
except ImportError:
    LEMMINFLECT_AVAILABLE = False

# Uzbek lemmatization using UzbekLemmatizer
try:
    import UzbekLemmatizer as uzb_ltr
    UZBEK_LEMMATIZER_AVAILABLE = True
except ImportError:
    UZBEK_LEMMATIZER_AVAILABLE = False

def simple_lemmatize(tokens, language=None):
    """
    Simple lemmatization using lemminflect (no heavy model downloads needed).
    Returns a list of lemmas for the given tokens.
    If lemminflect is not available, returns the original tokens.

    For Uzbek, uses UzbekLemmatizer if available.
    """
    # Handle Uzbek language
    if language and language.lower() == 'uzbek':
        return uzbek_lemmatize(tokens)

    if not LEMMINFLECT_AVAILABLE:
        return tokens

    lemmas = []
    for token in tokens:
        # getAllLemmas returns a dict like {'VERB': ('run',), 'NOUN': ('run',)}
        # We take the first lemma from any POS tag
        all_lemmas = lemminflect.getAllLemmas(token)
        if all_lemmas:
            # Get the first lemma from the first POS tag
            lemma = list(all_lemmas.values())[0][0]
            lemmas.append(lemma)
        else:
            # If no lemma found, use the original token
            lemmas.append(token.lower())
    return lemmas

def uzbek_lemmatize(tokens):
    """
    Lemmatization for Uzbek using UzbekLemmatizer.
    Returns a list of lemmas for the given tokens.
    If UzbekLemmatizer is not available, returns the original tokens.
    """
    if not UZBEK_LEMMATIZER_AVAILABLE:
        return tokens

    lemmas = []
    for token in tokens:
        try:
            lemma = uzb_ltr.Lemma(token)
            lemmas.append(lemma if lemma else token.lower())
        except Exception:
            # If lemmatization fails, use the original token
            lemmas.append(token.lower())
    return lemmas

def warn(msg, testclass, testlevel, testid, lineno=0, explanation=None):
    """
    Print the error/warning message.
    If lineno is 0, print the number of the current line (most recently read from input).
    If lineno is < 0, print the number of the first line of the current sentence.
    If lineno is > 0, print lineno (probably pointing somewhere in the current sentence).
    If explanation contains a string and this is the first time we are reporting
    an error of this type, the string will be appended to the main message. It
    can be used as an extended explanation of the situation.
    """
    error_counter[testclass] = error_counter.get(testclass, 0)+1
    if args.max_err > 0 and error_counter[testclass] > args.max_err:
        if error_counter[testclass] == args.max_err + 1:
            print(('...suppressing further errors regarding ' + testclass), file=sys.stderr)
        pass # supressed
    elif not args.quiet:
        if explanation and error_counter[testclass] == 1:
            msg += ' ' + explanation
        if len(args.input) > 1: # several files, should report which one
            if curr_fname=='-':
                fn = '(in STDIN) '
            else:
                fn = '(in '+os.path.basename(curr_fname)+') '
        else:
            fn = ''
        sent = ''
        node = ''
        # Global variable (last read sentence id): sentence_id
        if sentence_id:
            sent = ' Sent ' + sentence_id
        if lineno > 0:
            print("[%sLine %d%s%s]: [L%d %s %s] %s" % (fn, lineno, sent, node, testlevel, testclass, testid, msg), file=sys.stderr)
        elif lineno < 0:
            print("[%sLine %d%s%s]: [L%d %s %s] %s" % (fn, sentence_line, sent, node, testlevel, testclass, testid, msg), file=sys.stderr)
        else:
            print("[%sLine %d%s%s]: [L%d %s %s] %s" % (fn, curr_line, sent, node, testlevel, testclass, testid, msg), file=sys.stderr)

def debugnode(nid, node_dict):
    """
    Takes node id (variable). Returns a string that also contains node concept
    and aligned words if available.
    """
    result = nid
    if nid in node_dict:
        concept = 'UNKNOWN CONCEPT'
        alignment = 'UNALIGNED'
        if 'concept' in node_dict[nid]:
            concept = node_dict[nid]['concept']
        if 'alignment' in node_dict[nid] and node_dict[nid]['alignment']['tokstr'] != '':
            alignment = node_dict[nid]['alignment']['tokstr']
        result = "%s (%s '%s')" % (nid, concept, alignment)
    return result

#------------------------------------------------------------------------------
# Support functions.
#------------------------------------------------------------------------------

ws_re = re.compile(r"^\s+$")
def is_whitespace(line):
    return ws_re.match(line)

tws_re = re.compile(r"\s+$")
def has_trailing_whitespace(line):
    return tws_re.search(line)
def remove_trailing_whitespace(line):
    return tws_re.sub('', line)

lws_re = re.compile(r"^\s+")
def remove_leading_whitespace(line):
    return lws_re.sub('', line)

comment_re = re.compile(r"(.)\#.*")
def remove_inline_comment(line):
    return remove_trailing_whitespace(comment_re.sub(r"\1", line))

# For some languages (Arapaho, Navajo, Sanapana, Kukama), the initial block
# contains multiple lines with inter-linear glossing. Each of these lines should
# start with a header but these headers are different in Arapaho vs. the others.
# For our standard, see https://github.com/ufal/UMR/issues/9.
ilg_re = re.compile(r"^(Index|Words|Word Gloss \([a-z]{2,3}\)|Morphemes|Morpheme Gloss \([a-z]{2,3}\)|Sentence|Sentence Gloss \([a-z]{2,3}\)):\s*(.+)")
ilg_old_re = re.compile(r"^(Words|tx|Morphemes|mb|Morpheme Gloss\((?:English|Spanish)\)|ge|Morpheme Cat|ps|Word Gloss|(?:English|Spanish) Sent Gloss:|tr)\s+(.+)")
def is_ilg(line):
    return ilg_re.match(line) or ilg_old_re.match(line)

root_re = re.compile(r"^\(")
def is_root(line):
    return root_re.match(line)

attr_re = re.compile(r"^:[A-Za-z][-A-Za-z0-9]+")
def is_attribute(line):
    return attr_re.match(line)

align_re = re.compile(r"^s[0-9]+[a-z0-9]+:")
def is_alignment(line):
    return align_re.match(line)

def shorten(string):
    return string if len(string) < 25 else string[:20]+'[...]'

wikidata_cache = {}

def get_wikidata_label(id):
    if requests_installed:
        if id in wikidata_cache:
            return wikidata_cache[id]
        # Create parameters.
        params = {
            'action': 'wbgetentities',
            'ids': id,
            'format': 'json',
            'languages': 'en'
        }
        # Fetch the API.
        data = fetch_wikidata(params)
        if data:
            # Extract the label.
            data = data.json()
            label = str(data['entities'][id]['labels']['en']['value'])
            wikidata_cache[id] = label
            return label
        else:
            return ''
    else:
        return ''

def fetch_wikidata(params):
    url = 'https://www.wikidata.org/w/api.php'
    try:
        return requests.get(url, params=params)
    except:
        return '' # error



#==============================================================================
# Level 1 tests. Only technical format backbone.
#==============================================================================

sentid_re = re.compile(r"^#\s*::\s*(snt[0-9]+)(?:\s|$)")
sentid_tokens_re = re.compile(r"^#\s*::\s*(snt[0-9]+)\s+(.+)$")

def sentences(inp, args):
    """
    `inp` a file-like object yielding lines as unicode
    `args` are needed for choosing the tests

    This function does elementary checking of the input and yields one
    sentence at a time from the input stream.

    This function is a generator. The caller can call it in a 'for x in ...'
    loop. In each iteration of the caller's loop, the generator will generate
    the next sentence, that is, it will read the next sentence from the input
    stream. (Technically, the function returns an object, and the object will
    then read the sentences within the caller's loop.)

    A sentence in a UMR file consists of:
    - Comment lines. Their first character is '#'. Some of them may contain
      machine-readable metadata. Others can be ignored.
      (Note: With the option --allow-inline-comments, comments can occur also
      on other lines. Everything from the # character to the end of the line
      will then be ignored, the part before the # character is a line of
      another type.)
    - Empty lines. An empty line separates two annotation blocks of the same
      sentence (e.g., document level graph from sentence level graph). Two empty
      lines separate sentences. Empty lines must not occur inside annotation
      blocks, e.g., inside the sentence level graph.
    - Interlinear glossing lines. The line starts with a header that specifies
      type of the contents on the line, then there are space-separated words
      or morphs or their glosses (possible in multiple languages).
    - Graph lines (either sentence level graph, or document level annotation).
      They may start with whitespace (' ', "\t") and they typically do, except
      for the first line of the graph. Whitespace can be ignored (but we may
      want to report trailing whitespace, just to tidy up). After whitespace,
      there must be either the opening bracket ('(') or a colon (':'). One or
      more closing brackets may occur at the end of the line; they are never
      put on a line of their own.
    - Every opening bracket must be immediately followed by a variable id (e.g.,
      's1p'), a slash ('/'), and a concept string.
    - Every colon must be immediately followed by a relation/attribute label,
      then whitespace and either an atomic value, or a string in double quotes,
      or the opening bracket of a child node.
    - The alignment block has its own type of lines. It starts with a variable
      id of a concept node in the sentence graph, followed by a colon and
      a space, followed by an integer range (e.g. '2-2'). These are 1-based
      indices of tokens that represent the concept node on the surface. '0-0'
      means that the concept is not overtly represented on the surface.
    """
    # global curr_line ... holds the 1-based number of the last read line; used in error messages
    # global sentence_line ... holds the 1-based number of the first line of the current sentence; used in error messages
    # global sentence_id ... holds the id of the current sentence (or better: the most recently seen sentence id); used in error messages
    global curr_line, sentence_line, sentence_id
    blocks = [] # List of the annotation blocks (sentence annotation, document level annotation) of the current sentence.
    bline0 = None # Number of the line where the current block starts.
    comments = [] # List of the comment lines at the beginning of the current block.
    lines = [] # List of the non-comment lines of the current block.
    corrupt = False # In case of spurious line check the remaining lines of the sentence but do not yield the sentence for further processing.
    testlevel = 1
    testclass = 'Format'
    for line_counter, line in enumerate(inp):
        curr_line = line_counter + 1
        if not sentence_line:
            sentence_line = curr_line
        if not bline0:
            bline0 = curr_line
        line = line.rstrip("\n")
        if args.inline_comments:
            line = remove_inline_comment(line)
        if has_trailing_whitespace(line):
            if args.check_trailing_whitespace:
                testid = 'trailing-whitespace'
                testmessage = 'Trailing whitespace should be removed.'
                warn(testmessage, testclass, testlevel, testid)
            line = remove_trailing_whitespace(line)
        validate_unicode_normalization(line)
        # Unlike trailing whitespace, leading whitespace is legitimate (indentation) but we ignore it anyway.
        line = remove_leading_whitespace(line)
        if not line: # empty line means end of block (and possibly end of sentence)
            if comments or lines: # end of an annotation block
                blocks.append({'line0': bline0, 'comments': comments, 'lines': lines})
                bline0 = None
                comments = []
                lines = []
                ###!!! Sentences typically have 4 annotation blocks: 1. intro; 2. sentence level; 3. alignment; 4. document level.
                ###!!! If we see more blocks, maybe someone forgot to add a second empty line between sentences.
                if len(blocks) > 4:
                    testid = 'too-many-blocks'
                    testmessage = 'Too many annotation blocks within one sentence. There should be two empty lines after each sentence.'
                    warn(testmessage, testclass, testlevel, testid)
                    corrupt = True
            else: # two consecutive empty lines = end of sentence
                if blocks:
                    if len(blocks) < 4:
                        testid = 'too-few-blocks'
                        testmessage = 'Too few annotation blocks in the sentence. Expected introduction, sentence level graph, alignment, and document level annotation.'
                        warn(testmessage, testclass, testlevel, testid)
                        corrupt = True
                    if not corrupt:
                        yield blocks
                    blocks = []
                    bline0 = None
                    comments = []
                    lines = []
                    corrupt = False
                else:
                    if args.check_extra_empty_line:
                        testid = 'extra-empty-line'
                        testmessage = 'Spurious empty line. One empty line is expected after every annotation block and two after every sentence.'
                        warn(testmessage, testclass, testlevel=testlevel, testid=testid)
        elif line[0] == '#':
            # We will really validate sentence ids later. But now we want to remember
            # everything that looks like a sentence id and use it in the error messages.
            # Line numbers themselves may not be sufficient if we are reading multiple
            # files from a pipe.
            match = sentid_re.match(line)
            if match:
                sentence_id = match.group(1)
            if not lines: # before sentence
                comments.append(line)
            else:
                testid = 'misplaced-comment'
                testmessage = 'Spurious comment line. Comments are only allowed before a sentence.'
                warn(testmessage, testclass, testlevel, testid)
                corrupt = True
        elif is_root(line) or is_attribute(line) or is_alignment(line):
            lines.append(line)
        elif is_ilg(line):
            lines.append(line)
        else: # A line which is neither a comment nor a token/word, nor empty. That's bad!
            testid = 'invalid-line'
            testmessage = "Spurious line: '%s'. All non-empty lines should start with the '#' character, opening bracket, colon, or node variable id. Leading whitespace is permitted." % (line)
            warn(testmessage, testclass, testlevel, testid)
            corrupt = True
    else: # end of file
        if blocks: # These should have been yielded on an empty line!
            testid = 'missing-empty-line'
            testmessage = 'Missing empty line after the last sentence.'
            warn(testmessage, testclass, testlevel, testid)
            if len(blocks) < 4:
                testid = 'too-few-blocks'
                testmessage = 'Too few annotation blocks in the sentence. Expected introduction, sentence level graph, alignment, and document level annotation.'
                warn(testmessage, testclass, testlevel, testid)
                corrupt = True
            if not corrupt:
                yield blocks

#------------------------------------------------------------------------------
# Low-level tests: character encoding, line break format etc.
#------------------------------------------------------------------------------

def validate_unicode_normalization(text):
    """
    Tests that letters composed of multiple Unicode characters (such as a base
    letter plus combining diacritics) conform to NFC normalization (canonical
    decomposition followed by canonical composition).
    """
    normalized_text = unicodedata.normalize('NFC', text)
    if text != normalized_text:
        # Find the first unmatched character and include it in the report.
        firsti = -1
        inpfirst = ''
        nfcfirst = ''
        for i in range(len(text)):
            if text[i] != normalized_text[i]:
                firsti = i
                inpfirst = unicodedata.name(text[i])
                nfcfirst = unicodedata.name(normalized_text[i])
                break
        testlevel = 1
        testclass = 'Unicode'
        testid = 'unicode-normalization'
        testmessage = "Unicode not normalized: character[%d] is %s, should be %s." % (firsti, inpfirst, nfcfirst)
        warn(testmessage, testclass, testlevel, testid)

def validate_newlines(inp):
    """
    To be called after the input has been read. If the input uses '\r\n' as
    line breaks, inp.newlines will have been set to '\r\n'. For Unix-style
    line breaks, it should be empty. (Not sure what happens if the file is
    inconsistent and line breaks are mixed.)
    """
    if inp.newlines and inp.newlines != '\n':
        testlevel = 1
        testclass = 'Format'
        testid = 'non-unix-newline'
        testmessage = 'Only the unix-style LF line terminator is allowed.'
        warn(testmessage, testclass, testlevel, testid)



#==============================================================================
# Level 2 tests. General structure, known and/or unique labels, but not rules
# for concept-relation or attribute-value compatibility.
#==============================================================================

# Unicode-aware lowercase letter range covering basic Latin, Latin-1 Supplement,
# Latin Extended-A/B, and IPA Extensions (for ə). This supports languages with
# extended Latin characters such as Uzbek (ö, ğ, ş, ü, ı, ç, ə).
_lc = r'a-z\u00e0-\u00f6\u00f8-\u00ff\u0100-\u024f\u0259'

variable_re = re.compile(rf"^s[0-9]+[{_lc}]+[0-9]*")
concept_re = re.compile(r"^[^\s\(\):]+")
relation_re = re.compile(r"^:[-A-Za-z0-9]+")
string_re = re.compile(r'^"([^"\s]+)"')
number_re = re.compile(r"^([0-9]+(?:\.[0-9]+)?)(\s|\)|$)") # we need to recognize following closing bracket but we must not consume it
atom_re = re.compile(rf"^([-+{_lc}0-9]+)(\s|\)|$)") # enumerated values of some attributes, including integers (but also '3rd'), polarity values ('+', '-'), or node references ('s5p')

tokrng_re = re.compile(r"^0-0|([1-9][0-9]*)-([1-9][0-9]*)$")
tokrngs_re = re.compile(r"^(?:0-0|([1-9][0-9]*)-([1-9][0-9]*)(,\s*[1-9][0-9]*-[1-9][0-9]*)*)$")
tokrng_neg_re = re.compile(r"^-1--1|0-0|([1-9][0-9]*)-([1-9][0-9]*)$")
tokrngs_neg_re = re.compile(r"^(?:-1--1|0-0|([1-9][0-9]*)-([1-9][0-9]*)(,\s*[1-9][0-9]*-[1-9][0-9]*)*)$")

svariable_re = re.compile(r"^s[0-9]+s0")
dvariable_re = re.compile(rf"^([{_lc}]+(?:-[{_lc}]+)*|s[0-9]+[{_lc}]+[0-9]*)(\s|\)|$)") # constant or concept node id; we need to recognize following closing bracket but we must not consume it

def validate_sentence_metadata(sentence, known_ids, args):
    """
    Verifies the first annotation block of a sentence. There must be a comment
    line with the sentence id, and the list of tokens. Various datasets use
    various formats and there is no specification, so we try to standardize it
    (see https://github.com/ufal/UMR/issues/9). The validator should be able to
    digest the other formats, too, but it should issue a warning.
    """
    testlevel = 2
    testclass = 'Metadata'
    matched=[]
    tokens_included = False
    iline = sentence[0]['line0']
    # Thanks to previous tests, we can be sure that there is at least one
    # annotation block. However, we cannot be sure that it has comments.
    if 'comments' in sentence[0]:
        comments = sentence[0]['comments']
        for c in comments:
            # The first block either contains one comment line with both the
            # sentence id and the sequence of tokens (English, Chinese), or it
            # contains multiple lines, the first one is a comment with sentence id
            # only, the following ones are not comments and they contain inter-
            # linear glosses, starting with the actual token sequence.
            match = sentid_re.match(c)
            if match:
                # So the comment starts with a sentence id. Does it also contain the
                # sequence of tokens?
                match2 = sentid_tokens_re.match(c)
                if match2:
                    matched.append(match2)
                    tokens_included = True
                    testid = 'tokens-in-sent-id-comment'
                    testmessage = 'The comment line with the sentence id seems to also contain the tokens, which is deprecated.'
                    warn(testmessage, 'Warning', testlevel, testid, lineno=-1)
                else:
                    matched.append(match)
        iline += len(sentence[0]['comments'])
    if not matched:
        testid = 'missing-sent-id'
        testmessage = 'Missing sentence id.'
        warn(testmessage, testclass, testlevel, testid, lineno=-1)
    elif len(matched)>1:
        testid = 'multiple-sent-id'
        testmessage = 'Multiple sentence ids.'
        warn(testmessage, testclass, testlevel, testid, lineno=-1)
    else:
        # Uniqueness of sentence ids should be tested treebank-wide, not just file-wide.
        # For that to happen, all three files should be tested at once.
        sid = matched[0].group(1)
        if sid in known_ids:
            testid = 'non-unique-sent-id'
            testmessage = "Non-unique sentence id '%s'." % sid
            warn(testmessage, testclass, testlevel, testid, lineno=-1)
        known_ids.add(sid)
        # Save the tokens so we can access them later.
        if tokens_included:
            if args.check_wide_space:
                tokens = matched[0].group(2).split(' ')
                empty_tokens = [x for x in tokens if x == '' or ws_re.match(x)]
                if empty_tokens:
                    testid = 'empty-token'
                    testmessage = "Empty token (i.e., two consecutive whitespace characters) in '%s'" % matched[0].group(2)
                    warn(testmessage, testclass, testlevel, testid, lineno=-1)
            else:
                tokens = re.split(r"\s+", matched[0].group(2))
            sentence[0]['tokens'] = tokens
            if sentence[0]['lines']:
                testid = 'tokens-vs-ilg'
                testmessage = "No interlinear glosses are expected because tokens were already introduced on the sentence id line."
                warn(testmessage, testclass, testlevel, testid, lineno=sentence[0]['line0']+len(sentence[0]['comments']))
    # If we did not find the sentence id line or it did not contain the tokens,
    # look for the interlinear glosses (including the tokens).
    if not tokens_included:
        if not 'lines' in sentence[0]:
            testid = 'missing-ilg'
            testmessage = "Expecting list of tokens/words (optionally followed by interlinear glosses)."
            warn(testmessage, testclass, testlevel, testid, lineno=iline)
            sentence[0]['tokens'] = []
            return
        # Following the proposal in https://github.com/ufal/UMR/issues/9,
        # we expect the following lines in any order (header is capitalized
        # and terminated by a colon, ':'; glosses can be in any language,
        # with the ISO 639 language code given in parentheses):
        # Index:           1         2         3          4
        # Words:           Estonci   volili    parlament  .
        # Word Gloss (en): Estonians elected   parliament .
        # Word Gloss (es): Estonios  eligieron parlamento .
        # Morphemes:           Eston   -c    -i     vol   -il       -i            parlament  -0     .
        # Morpheme Gloss (en): Estonia DERIV PL.NOM elect  PAST.PART PL.MASC.ANIM parliament SG.ACC .
        # Morpheme Gloss (es): Estonia DERIV PL.NOM elegir PAST.PART PL.MASC.ANIM parlamento SG.ACC .
        # Sentence: Estonci volili parlament.
        # Sentence Gloss (en): Estonians elected the parliament.
        # Sentence Gloss (es): Los estonios eligieron el parlamento.
        lines = sentence[0]['lines']
        ilg = {}
        for l in lines:
            match = ilg_re.match(l)
            match_old = ilg_old_re.match(l)
            if match:
                header = match.group(1)
                items = re.split(r"\s+", match.group(2))
                if header in ilg:
                    testid = 'duplicate-ilg'
                    testmessage = "Duplicate interlinear glossing line '%s' (first occurred on line %d)." % (header, ilg[header]['line0'])
                    warn(testmessage, 'Warning', testlevel, testid, lineno=iline)
                ilg[header] = {'items': items, 'line0': iline}
                if header == 'Words':
                    sentence[0]['tokens'] = items
            elif match_old:
                header = match_old.group(1)
                testid = 'obsolete-ilg'
                testmessage = "Obsolete interlinear glossing line (obsolete line header '%s'; see https://github.com/ufal/UMR/issues/9)." % header
                warn(testmessage, 'Warning', testlevel, testid, lineno=iline)
                if header == 'Words' or header == 'tx':
                    tokens = re.split(r"\s+", match_old.group(2))
                    sentence[0]['tokens'] = tokens
            else:
                testid = 'invalid-ilg'
                testmessage = "Spurious interlinear glossing line (unknown line header; see https://github.com/ufal/UMR/issues/9)."
                warn(testmessage, testclass, testlevel, testid, lineno=iline)
            iline += 1
        # Check whether the interlinear glosses make sense.
        if not 'Words' in ilg:
            testid = 'missing-words'
            testmessage = "Missing the Words line in the first annotation block."
            warn(testmessage, testclass, testlevel, testid, lineno=iline)
            sentence[0]['tokens'] = []
        else:
            m = len(ilg['Words']['items'])
            for header in ilg:
                if re.match(r"^(Index|Word Gloss \([a-z]{2,3}\))$", header):
                    n = len(ilg[header]['items'])
                    if n != m:
                        testid = 'word-gloss-mismatch'
                        testmessage = "Words have %d items while %s have %d items." % (m, header, n)
                        warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])
                    elif header == 'Index':
                        expected_items = str([str(x) for x in range(len(ilg[header]['items'])+1)[1:]])
                        observed_items = str(ilg[header]['items'])
                        if observed_items != expected_items:
                            testid = 'spurious-index'
                            testmessage = "Incorrect index sequence.\n  Expected: %s\n  Observed: %s" % (expected_items, observed_items)
                            warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])
                elif header == 'Morphemes':
                    n = len(ilg[header]['items'])
                    if n < m:
                        testid = 'morpheme-word-mismatch'
                        testmessage = "Words have %d items while Morphemes have only %d items." % (m, n)
                        warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])
                elif re.match(r"^Morpheme Gloss \([a-z]{2,3}\)$", header):
                    n = len(ilg[header]['items'])
                    if 'Morphemes' in ilg:
                        o = len(ilg['Morphemes']['items'])
                        if n != o:
                            testid = 'morpheme-gloss-mismatch'
                            testmessage = "Morphemes have %d items while %s have %d items." % (o, header, n)
                            warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])
                    else:
                        testid = 'missing-morphemes'
                        testmessage = "There are morpheme glosses but the Morphemes line is missing."
                        warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])
                elif header == 'Sentence':
                    n = len(ilg[header]['items'])
                    if n > m:
                        testid = 'sentence-word-mismatch'
                        testmessage = "Words have only %d items while the (untokenized) Sentence has %d items." % (m, n)
                        warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])
                elif re.match(r"^Sentence Gloss \([a-z]{2,3}\)$", header):
                    n = len(ilg[header]['items'])
                    if not 'Sentence' in ilg:
                        testid = 'missing-sentence'
                        testmessage = "There is a sentence gloss but the (original) Sentence line is missing."
                        warn(testmessage, testclass, testlevel, testid, lineno=ilg[header]['line0'])

def validate_sentence_graph(sentence, node_dict, args):
    """
    Verifies the second annotation block of a sentence: the sentence level graph.
    """
    testlevel = 2
    testclass = 'Sentence'
    # Does the comment confirm that we are processing the sentence level graph?
    if args.check_block_headers:
        heading_found = False
        if 'comments' in sentence[1]:
            for c in sentence[1]['comments']:
                if c == '# sentence level graph:':
                    heading_found = True
                    break
        if not heading_found:
            testid = 'missing-heading-sentence-level'
            testmessage = "Missing heading comment '# sentence level graph:'."
            warn(testmessage, testclass, testlevel, testid, lineno=sentence[1]['line0'])
    # Besides the global node dictionary, we also need a temporary one for the
    # current sentence because node references in the sentence level graph
    # cannot lead to other sentences.
    sentence[1]['nodes'] = set()
    node_references = []
    stack = []
    # expecting_node_definition means we either just read ':something', which is
    # a relation or an attribute, and we did not see a value (atom / number /
    # string / node reference), or it is the beginning of the sentence. In both
    # cases we are expecting a full node definition.
    expecting_node_definition = True
    iline = sentence[1]['line0'] + len(sentence[1]['comments']) - 1
    for l in sentence[1]['lines']:
        iline += 1
        pline = l # processed line: we will remove stuff from pline but not from l
        while pline:
            # Remove leading whitespace.
            pline = remove_leading_whitespace(pline)
            if pline.startswith('('):
                if not expecting_node_definition:
                    testid = 'extra-opening-bracket'
                    testmessage = "Not expecting full node definition (opening bracket), found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                pline = remove_leading_whitespace(pline[1:])
                # Now expecting variable identifier, e.g., 's15p'.
                if variable_re.match(pline):
                    match = variable_re.match(pline)
                    variable = match.group(0)
                    # If this is not the root node (i.e., there is something on
                    # the stack), store this node as the child of the most recently
                    # added relation of the parent node. (There must be at least
                    # one relation and its type must be 'node'. Should we verify
                    # it?)
                    if stack:
                        node_dict[stack[-1]]['relations'][-1]['value'] = variable
                    pline = remove_leading_whitespace(variable_re.sub('', pline, 1))
                    # The variable serves as node id. It must be unique.
                    if variable in node_dict:
                        testid = 'non-unique-node-id'
                        testmessage = "The node id (variable) '%s' is not unique. It was previously used on line %d." % (variable, node_dict[variable]['line0'])
                        warn(testmessage, testclass, testlevel, testid, lineno=iline)
                    else:
                        # We have read the beginning of a node, including its
                        # variable. Now store it both globally and locally.
                        node_dict[variable] = {'variable': variable, 'line0': iline}
                        sentence[1]['nodes'].add(variable)
                        stack.append(variable)
                    # Now expecting the slash ('/').
                    if pline.startswith('/'):
                        pline = remove_leading_whitespace(pline[1:])
                        # Now expecting the concept string, e.g., 'have-quant-91'.
                        if concept_re.match(pline):
                            match = concept_re.match(pline)
                            concept = match.group(0)
                            node_dict[variable]['concept'] = concept
                            pline = remove_leading_whitespace(concept_re.sub('', pline, 1))
                        else:
                            testid = 'missing-concept-string'
                            testmessage = "Expected concept string, found '%s'." % pline
                            warn(testmessage, testclass, testlevel, testid, lineno=iline)
                    else:
                        testid = 'missing-slash'
                        testmessage = "Expected slash and concept string, found '%s'." % pline
                        warn(testmessage, testclass, testlevel, testid, lineno=iline)
                else:
                    testid = 'missing-variable'
                    testmessage = "Expected node variable id, found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                expecting_node_definition = False
            elif relation_re.match(pline):
                if expecting_node_definition:
                    testid = 'missing-node-definition'
                    testmessage = "Expecting full node definition (opening bracket), found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                match = relation_re.match(pline)
                relation = match.group(0)
                # Save the outgoing relation at the parent node.
                # The topmost node on the stack is the parent node for this relation.
                # But beware that the stack may be empty if the relation occurred unexpectedly!
                parent = {'relations': []}
                if stack:
                    parent_id = stack[-1]
                    parent = node_dict[parent_id]
                    if not 'relations' in parent:
                        parent['relations'] = []
                # Some relations, like ':ARG0', should occur at most once per parent node,
                # but others, like ':mod', can occur multiple times, so we assume that
                # multiple same relations are allowed in general and we will rule out
                # specific cases at level 3.
                parent['relations'].append({'relation': relation, 'dir': 'out', 'line0': iline})
                pline = remove_leading_whitespace(relation_re.sub('', pline, 1))
                # Besides a child node, there may be a numeric or string value.
                expecting_node_definition = False
                if string_re.match(pline):
                    match = string_re.match(pline)
                    string = match.group(1) # without the quotation marks
                    parent['relations'][-1]['type'] = 'string'
                    parent['relations'][-1]['value'] = string
                    pline = remove_leading_whitespace(string_re.sub('', pline, 1))
                elif variable_re.match(pline):
                    match = variable_re.match(pline)
                    variable = match.group(0)
                    node_references.append({'variable': variable, 'line0': iline})
                    if args.check_forward_references and not variable in sentence[1]['nodes']:
                        if variable in node_dict:
                            testid = 'cross-sentence-reference'
                            testmessage = "Sentence level graph cannot contain nodes from other sentences: '%s' was defined on line %d." % (variable, node_dict[variable]['line0'])
                            warn(testmessage, testclass, testlevel, testid, lineno=iline)
                        else:
                            testid = 'unknown-node-id'
                            testmessage = "The node id (variable) '%s' is unknown. No such node has been defined so far." % variable
                            warn(testmessage, testclass, testlevel, testid, lineno=iline)
                    parent['relations'][-1]['type'] = 'node'
                    parent['relations'][-1]['value'] = variable
                    pline = remove_leading_whitespace(variable_re.sub('', pline, 1))
                elif atom_re.match(pline):
                    match = atom_re.match(pline)
                    atom = match.group(1)
                    parent['relations'][-1]['type'] = 'atom'
                    parent['relations'][-1]['value'] = atom
                    pline = remove_leading_whitespace(match.group(2)+atom_re.sub('', pline, 1))
                # Integer numbers would be consumed as atoms. This is here because of decimal numbers.
                elif number_re.match(pline):
                    match = number_re.match(pline)
                    number = match.group(1)
                    parent['relations'][-1]['type'] = 'atom'
                    parent['relations'][-1]['value'] = number
                    pline = remove_leading_whitespace(match.group(2)+number_re.sub('', pline, 1))
                else:
                    parent['relations'][-1]['type'] = 'node'
                    expecting_node_definition = True
            elif pline.startswith(')'):
                if expecting_node_definition:
                    testid = 'missing-node-definition'
                    testmessage = "Expecting full node definition (opening bracket), found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                # Check for the matching opening bracket and remove it from the stack.
                if not stack:
                    testid = 'extra-closing-bracket'
                    testmessage = "Found closing bracket but there was no matching opening bracket: '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                else:
                    stack.pop()
                pline = remove_leading_whitespace(pline[1:])
                expecting_node_definition = False
            else:
                if expecting_node_definition:
                    testid = 'missing-node-definition'
                    testmessage = "Expecting full node definition (opening bracket), found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                else:
                    testid = 'invalid-sentence-level'
                    testmessage = "Expecting colon or closing bracket, found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                pline = ''
    # If checking forward references is on, we know that all node references
    # either lead to defined nodes or have been reported as errors. But if it is
    # off, we must check for undefined nodes now.
    if not args.check_forward_references:
        for r in node_references:
            # If the node exists elsewhere in the
            if not r['variable'] in sentence[1]['nodes']:
                if r['variable'] in node_dict:
                    testid = 'cross-sentence-reference'
                    testmessage = "Sentence level graph cannot contain nodes from other sentences: '%s' was defined on line %d." % (r['variable'], node_dict[r['variable']]['line0'])
                    warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                else:
                    testid = 'unknown-node-id'
                    testmessage = "The node id (variable) '%s' is unknown. No such node is defined in this sentence." % r['variable']
                    warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
    # Make sure that every node has the relation list, even if empty.
    for nid in sentence[1]['nodes']:
        node = node_dict[nid]
        if not 'concept' in node:
            node['concept'] = ''
        if not 'relations' in node:
            node['relations'] = []
        # Make sure that every relation has the information we expect, even if empty.
        for r in node['relations']:
            if not 'value' in r:
                r['value'] = ''
    # So far we know for each node its outgoing relations.
    # Store also the incoming relations at each node.
    for nid in sentence[1]['nodes']:
        node = node_dict[nid]
        outrel = [r for r in node['relations'] if r['dir'] == 'out' and r['type'] == 'node']
        for r in outrel:
            if r['value'] in node_dict:
                node_dict[r['value']]['relations'].append({'dir': 'in', 'type': 'node', 'value': nid, 'relation': r['relation'], 'line0': r['line0']})

def validate_alignment(sentence, node_dict, args):
    """
    Verifies the third annotation block of a sentence: the alignment of the
    concept nodes from the sentence level graph in the second block to the
    tokens listed in the first block.
    """
    testlevel = 2
    testclass = 'Alignment'
    global tokrng_re
    global tokrngs_re
    if not args.check_nonnegative_alignment:
        tokrng_re = tokrng_neg_re
        tokrngs_re = tokrngs_neg_re
    # Does the comment confirm that we are processing the concept-token alignment?
    if args.check_block_headers:
        heading_found = False
        if 'comments' in sentence[2]:
            for c in sentence[2]['comments']:
                if c == '# alignment:':
                    heading_found = True
                    break
        if not heading_found:
            testid = 'missing-heading-alignment'
            testmessage = "Missing heading comment '# alignment:'."
            warn(testmessage, testclass, testlevel, testid, lineno=sentence[2]['line0'])
    iline = sentence[2]['line0'] + len(sentence[2]['comments']) - 1
    for l in sentence[2]['lines']:
        iline += 1
        pline = l # processed line: we will remove stuff from pline but not from l
        if variable_re.match(pline):
            match = variable_re.match(pline)
            variable = match.group(0)
            if not variable in sentence[1]['nodes']:
                testid = 'unknown-node-id'
                testmessage = "The node id (variable) '%s' is unknown. No such node is defined in this sentence." % variable
                warn(testmessage, testclass, testlevel, testid, lineno=iline)
            pline = remove_leading_whitespace(variable_re.sub('', pline, 1))
            if pline.startswith(':'):
                pline = remove_leading_whitespace(pline[1:])
                if tokrngs_re.match(pline):
                    match = tokrngs_re.match(pline)
                    if match.group(3):
                        # The span is discontiguous and group(3) contains the tail.
                        spans = re.split(r",\s*", pline)
                    else:
                        spans = [pline]
                    t1 = -1
                    for s in spans:
                        # If we previously matched tokrngs_re, we must now match tokrng_re.
                        match = tokrng_re.match(s)
                        if match.group(0) == '0-0' or match.group(0) == '-1--1':
                            # The regular expression tokrngs_re excludes '0-0' combined with anything else,
                            # so we do not have to check it here.
                            t0 = 0
                            t1 = 0
                        else:
                            old_t1 = t1
                            t0 = int(match.group(1))
                            t1 = int(match.group(2))
                            if t0 <= old_t1 + 1:
                                testid = 'invalid-token-range'
                                testmessage = "Index of the first token of segment '%s' must be at least %d because the previous segment ended at %d." % (s, old_t1+2, old_t1)
                                warn(testmessage, testclass, testlevel, testid, lineno=iline)
                            if t1 < t0:
                                testid = 'invalid-token-range'
                                testmessage = "Index of the first token '%d' is greater than the index of the second token '%d'." % (t0, t1)
                                warn(testmessage, testclass, testlevel, testid, lineno=iline)
                            tmax = len(sentence[0]['tokens'])
                            if t0 > tmax:
                                testid = 'invalid-token-index'
                                testmessage = "Index of the first token '%d' is out of range: there are %d tokens." % (t0, tmax)
                                warn(testmessage, testclass, testlevel, testid, lineno=iline)
                            if t1 > tmax:
                                testid = 'invalid-token-index'
                                testmessage = "Index of the second token '%d' is out of range: there are %d tokens." % (t1, tmax)
                                warn(testmessage, testclass, testlevel, testid, lineno=iline)
                        # The variable should be in node_dict. If it is not there,
                        # it has been already reported as error; but we must survive it here.
                        if variable in node_dict and t1 > t0:
                            # There must not be multiple lines aligning the same node.
                            # However, there may be multiple alignment segments on one alignment line of the node.
                            if 'alignment' in node_dict[variable]:
                                if node_dict[variable]['alignment']['line0'] != iline:
                                    testid = 'duplicate-alignment'
                                    testmessage = "Repeated alignment of node '%s'. It was already specified as %s on line %d." % (variable, str(node_dict[variable]['alignment']['tokids']), node_dict[variable]['alignment']['line0'])
                                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                                else:
                                    tokids = node_dict[variable]['alignment']['tokids']
                                    tokids.extend(range(t0, t1+1))
                                    tokens = [sentence[0]['tokens'][tokid-1] for tokid in tokids] if len(tokids) > 1 or tokids[0] != 0 else []
                                    node_dict[variable]['alignment']['tokids'] = tokids
                                    node_dict[variable]['alignment']['tokstr'] = ' '.join(tokens)
                            else:
                                tokids = []
                                tokids.extend(range(t0, t1+1))
                                tokens = [sentence[0]['tokens'][tokid-1] for tokid in tokids] if len(tokids) > 1 or tokids[0] != 0 else []
                                node_dict[variable]['alignment'] = {'tokids': tokids, 'tokstr': ' '.join(tokens), 'line0': iline}
                else:
                    testid = 'invalid-token-range'
                    testmessage = "Expecting 1-based token index range, or multiple comma-separated ranges, or '0-0', found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
            else:
                testid = 'invalid-alignment'
                testmessage = "Expecting colon, found '%s'." % pline
                warn(testmessage, testclass, testlevel, testid, lineno=iline)
        else:
            testid = 'missing-variable'
            testmessage = "Expected node variable id, found '%s'." % pline
            warn(testmessage, testclass, testlevel, testid, lineno=iline)
    # Check that all nodes in this sentence have an alignment.
    # Even unaligned nodes should have alignment 0-0.
    tokal = [False for x in sentence[0]['tokens']]
    for n in sorted(sentence[1]['nodes']):
        if not 'alignment' in node_dict[n]:
            if args.check_complete_alignment:
                testid = 'missing-alignment'
                testmessage = "Missing alignment of node '%s'. Even unaligned nodes should be explicitly marked with '0-0'." % n
                warn(testmessage, testclass, testlevel, testid, lineno=iline+1) # iline is now at the end of the alignment block
            # We will later want to access the alignment, so set the default, i.e., unaligned.
            node_dict[n]['alignment'] = {'tokids': [0], 'tokstr': ''}
        elif node_dict[n]['alignment']['tokids'] != [0]:
            # Check that two nodes are not aligned to the same surface token.
            # It is not clear that this should be required but it seems to be
            # typically the case, so we are tentatively going to report any
            # deviations.
            for tokid in node_dict[n]['alignment']['tokids']:
                if tokal[tokid-1]:
                    if args.check_overlapping_alignment:
                        testid = 'overlapping-alignment'
                        testmessage = "Multiple nodes aligned to token '%s'." % tokid
                        warn(testmessage, 'Warning', testlevel, testid, lineno=iline+1) # iline is now at the end of the alignment block
                else:
                    tokal[tokid-1] = True
    # Check that every non-punctuation token is aligned to a node. This is
    # not required but let's tentatively report it to see the deviations.
    if args.check_unaligned_token:
        for i in range(len(sentence[0]['tokens'])):
            if not tokal[i] and not re.match(r"^[-.,;:\?\!\(\)]$", sentence[0]['tokens'][i]):
                testid = 'unaligned-token'
                testmessage = "Non-punctuation token %d ('%s') is not aligned to any node in the sentence level graph." % (i+1, sentence[0]['tokens'][i])
                warn(testmessage, 'Warning', testlevel, testid, lineno=iline+1) # iline is now at the end of the alignment block

def validate_document_level(sentence, node_dict, args):
    """
    Verifies the fourth annotation block of a sentence: the document level graph.
    Saves the document-level relations in the list sentence[3]['relations']. It
    means that if we later want to see all document-level relations in the
    document, we will have to collect them from the sentences; such collection
    is not created now.
    """
    testlevel = 2
    testclass = 'Document'
    # Does the comment confirm that we are processing the document level annotation?
    if args.check_block_headers:
        heading_found = False
        if 'comments' in sentence[3]:
            for c in sentence[3]['comments']:
                if c == '# document level annotation:':
                    heading_found = True
                    break
        if not heading_found:
            testid = 'missing-heading-alignment'
            testmessage = "Missing heading comment '# document level annotation:'."
            warn(testmessage, testclass, testlevel, testid, lineno=sentence[3]['line0'])
    expecting = 'initial opening bracket'
    iline = sentence[3]['line0'] + len(sentence[3]['comments']) - 1
    current_relation_group = ''
    current_relation = ''
    current_first_node = ''
    current_line0 = iline
    sentence[3]['relations'] = []
    for l in sentence[3]['lines']:
        iline += 1
        pline = l # processed line: we will remove stuff from pline but not from l
        while pline:
            # Remove leading whitespace.
            pline = remove_leading_whitespace(pline)
            if pline.startswith('('):
                if expecting == 'initial opening bracket':
                    expecting = 'sentence variable id'
                elif expecting == 'group opening bracket':
                    expecting = 'relation opening bracket'
                elif expecting == 'relation opening bracket' or expecting == 'relation opening bracket or group closing bracket':
                    expecting = 'the first node of a relation'
                else:
                    testid = 'invalid-document-level'
                    testmessage = "Expecting %s, found '%s'." % (expecting, pline)
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                pline = remove_leading_whitespace(pline[1:])
            elif svariable_re.match(pline):
                match = svariable_re.match(pline)
                variable = match.group(0)
                if expecting != 'sentence variable id':
                    testid = 'invalid-document-level'
                    testmessage = "Expecting %s, found '%s'." % (expecting, pline)
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                    pline = ''
                    break
                pline = remove_leading_whitespace(svariable_re.sub('', pline, 1))
                # The variable serves as node id. It must be unique.
                if variable in node_dict:
                    testid = 'non-unique-node-id'
                    testmessage = "The node id (variable) '%s' is not unique. It was previously used on line %d." % (variable, node_dict[variable]['line0'])
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                else:
                    node_dict[variable] = {'line0': iline}
                # Now expecting the slash ('/') and the concept 'sentence'.
                if pline.startswith('/ sentence'):
                    pline = remove_leading_whitespace(pline[10:])
                else:
                    testid = 'missing-sentence-concept'
                    testmessage = "Expected '/ sentence', found '%s'." % pline
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                expecting = 'relation group or final closing bracket'
            elif dvariable_re.match(pline):
                match = dvariable_re.match(pline)
                variable = match.group(1)
                if expecting == 'the first node of a relation':
                    current_first_node = variable
                    current_line0 = iline
                    expecting = 'relation'
                elif expecting == 'the second node of the relation':
                    sentence[3]['relations'].append({'group': current_relation_group, 'relation': current_relation, 'node0': current_first_node, 'node1': variable, 'line0': current_line0})
                    expecting = 'relation closing bracket'
                else:
                    testid = 'invalid-document-level'
                    testmessage = "Expecting %s, found '%s'." % (expecting, pline)
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                    pline = ''
                    break
                pline = remove_leading_whitespace(match.group(2) + dvariable_re.sub('', pline, 1))
            elif relation_re.match(pline):
                match = relation_re.match(pline)
                relation = match.group(0)
                if expecting == 'relation group' or expecting == 'relation group or final closing bracket':
                    current_relation_group = relation
                    expecting = 'group opening bracket'
                elif expecting == 'relation':
                    current_relation = relation
                    expecting = 'the second node of the relation'
                else:
                    testid = 'invalid-document-level'
                    testmessage = "Expecting %s, found '%s'." % (expecting, pline)
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                pline = remove_leading_whitespace(relation_re.sub('', pline, 1))
            elif pline.startswith(')'):
                if expecting == 'relation closing bracket':
                    expecting = 'relation opening bracket or group closing bracket'
                elif expecting == 'relation opening bracket or group closing bracket':
                    expecting = 'relation group or final closing bracket'
                elif expecting == 'relation group or final closing bracket':
                    expecting = 'end of document level annotation'
                else:
                    testid = 'invalid-document-level'
                    testmessage = "Expecting %s, found '%s'." % (expecting, pline)
                    warn(testmessage, testclass, testlevel, testid, lineno=iline)
                pline = remove_leading_whitespace(pline[1:])
            else:
                testid = 'invalid-document-level'
                testmessage = "Not expecting this: '%s'." % pline
                warn(testmessage, testclass, testlevel, testid, lineno=iline)
                pline = ''



#==============================================================================
# Level 3 tests. Concept-relation compatibility, attribute-value compatibility,
# required relations etc. Language-neutral.
#==============================================================================

# Known relations / attributes / roles.
# https://github.com/ufal/UMR/blob/main/doc/relations-attributes.md
# Types:
# - participant ... either :ARG0 to :ARG6, or descriptive semantic roles for
#   arguments in languages that do not have frame files.
# - modifier ... any relation that is not participant.
# - attribute ... atomic / numerical / string value; not a child node.
# Repeat=True: One node is allowed to have multiple such relations/attributes.
known_relations = {
    # :accompanier from AMR, maybe replaced by :companion in UMR?
    ':actor': {'type': 'participant', 'repeat': False},
    ':affectee': {'type': 'participant', 'repeat': False},
    ':age': {'type': 'modifier', 'repeat': False},
    ':apprehensive': {'type': 'modifier', 'repeat': False},
    ':ARG0': {'type': 'participant', 'repeat': False},
    ':ARG1': {'type': 'participant', 'repeat': False},
    ':ARG2': {'type': 'participant', 'repeat': False},
    ':ARG3': {'type': 'participant', 'repeat': False},
    ':ARG4': {'type': 'participant', 'repeat': False},
    ':ARG5': {'type': 'participant', 'repeat': False},
    ':ARG6': {'type': 'participant', 'repeat': False},
    ':aspect': {'type': 'attribute', 'repeat': False, 'values': ['habitual', 'generic', 'iterative', 'inceptive', 'imperfective', 'process', 'atelic-process', 'perfective', 'state', 'reversible-state', 'irreversible-state', 'inherent-state', 'point-state', 'activity', 'undirected-activity', 'directed-activity', 'endeavor', 'semelfactive', 'undirected-endeavor', 'directed-endeavor', 'performance', 'incremental-accomplishment', 'nonincremental-accomplishment', 'directed-achievement', 'reversible-directed-achievement', 'irreversible-directed-achievement']},
    ':beneficiary': {'type': 'participant', 'repeat': False}, #todo: affecttee
    ':calendar': {'type': 'modifier', 'repeat': False},
    ':cause': {'type': 'modifier', 'repeat': True},
    ':causer': {'type': 'participant', 'repeat': False},
    ':century': {'type': 'modifier', 'repeat': False},
    ':companion': {'type': 'participant', 'repeat': False},
    ':concession': {'type': 'modifier', 'repeat': True},
    ':condition': {'type': 'modifier', 'repeat': True},
    ':consist-of': {'type': 'modifier', 'repeat': False}, #todo:? split into other roles(have-group-91, have-material-91)
    ':day': {'type': 'attribute', 'repeat': False},
    ':dayperiod': {'type': 'attribute', 'repeat': False},
    ':decade': {'type': 'modifier', 'repeat': False},
    ':degree': {'type': 'attribute', 'repeat': False, 'value': ['intensifier', 'downtoner', 'equal']},
    ':destination': {'type': 'modifier', 'repeat': True}, #todo? :goal
    ':direction': {'type': 'modifier', 'repeat': True},
    ':domain': {'type': 'modifier', 'repeat': False}, #todo:? replaced with have-mode, have rel role, exist 91
    ':duration': {'type': 'modifier', 'repeat': True},
    ':era': {'type': 'modifier', 'repeat': False},
    ':example': {'type': 'modifier', 'repeat': True},
    ':experiencer': {'type': 'participant', 'repeat': False},
    ':extent': {'type': 'modifier', 'repeat': False},
    ':force': {'type': 'participant', 'repeat': False},
    ':frequency': {'type': 'modifier', 'repeat': False},
    ':goal': {'type': 'participant', 'repeat': False},
    ':group': {'type': 'modifier', 'repeat': False},
    ':instrument': {'type': 'participant', 'repeat': False},
    ':li': {'type': 'modifier', 'repeat': False}, #todo: is this replaced by :list-item
    #':location': {'type': 'modifier', 'repeat': True}, # obsolete; use :place instead
    ':manner': {'type': 'modifier', 'repeat': True},
    ':material': {'type': 'participant', 'repeat': False},
    ':medium': {'type': 'modifier', 'repeat': False},
    ':mod': {'type': 'modifier', 'repeat': True},
    ':modal-predicate': {'type': 'modifier', 'repeat': False}, # Note: The guidelines and the spreadsheet originally defined ':modpred' but it was changed to ':modal-predicate' in UMR 1.0 to make the annotation more human-readable.
    ':modal-strength': {'type': 'attribute', 'repeat': False, 'values': ['full-affirmative', 'partial-affirmative', 'neutral-affirmative', 'neutral-negative', 'partial-negative', 'full-negative']}, # Note: The guidelines and the spreadsheet originally defined ':modstr' but it was changed to ':modal-strength' in UMR 1.0 to make the annotation more human-readable.
    ':mode': {'type': 'attribute', 'repeat': False, 'values':['imperative', 'interrogative', 'expressive']},
    ':month': {'type': 'attribute', 'repeat': False},
    ':name': {'type': 'modifier', 'repeat': False},
    ':op1': {'type': 'attribute', 'repeat': False}, # There is no theoretical limit on the number after ':op'. When ':op2' or higher occurs, we will clone ':op1' on the fly.
    ':ord': {'type': 'modifier', 'repeat': False},
    ':other-role': {'type': 'modifier', 'repeat': True},
    ':part': {'type': 'modifier', 'repeat': True},
    ':path': {'type': 'modifier', 'repeat': True},
    ':place': {'type': 'participant', 'repeat': False},
    ':polarity': {'type': 'attribute', 'repeat': False, 'value':['-', 'umr-unknown', 'truth-value']},
    ':polite': {'type': 'attribute', 'repeat': False, 'values':['+']}, #todo:?
    ':possessor': {'type': 'modifier', 'repeat': True}, # Note: The guidelines originally defined ':poss' but it was changed to ':possessor' (the dependent node is the possessor of the parent). See also the spreadsheet.
    ':purpose': {'type': 'modifier', 'repeat': True},
    ':quant': {'type': 'attribute', 'repeat': False},
    ':quarter': {'type': 'modifier', 'repeat': False},
    ':quote': {'type': 'modifier', 'repeat': True}, # Note: The guidelines and the spreadsheet originally defined ':quot' but it was changed to ':quote' in UMR 1.0 to make the annotation more human-readable.
    ':reason': {'type': 'modifier', 'repeat': True},
    ':recipient': {'type': 'participant', 'repeat': False},
    ':refer-number': {'type': 'attribute', 'repeat': False, 'values': ['singular', 'non-singular', 'dual', 'paucal', 'plural', 'non-dual-paucal', 'greater-plural', 'trial', 'non-trial-paucal']}, # Note: The guidelines and the spreadsheet originally defined ':ref-number' but it was changed to ':refer-number' in UMR 1.0 to make the annotation more human-readable.
    ':refer-person': {'type': 'attribute', 'repeat': False, 'values': ['1st', '2nd', '3rd', '4th', 'non-3rd', 'non-1st', 'excl','incl']}, # Note: The guidelines and the spreadsheet originally defined ':ref-person' but it was changed to ':refer-person' in UMR 1.0 to make the annotation more human-readable.
    ':refer-definiteness':{'type':'attribute', 'repeat': False, 'values': ['class']}, #todo: for cases pronouns that are generic. "you don't do this"
    ':scale': {'type': 'modifier', 'repeat': False},
    ':source': {'type': 'participant', 'repeat': False},
    ':start': {'type': 'participant', 'repeat': False},
    ':stimulus': {'type': 'participant', 'repeat': False},
    ':subevent': {'type': 'modifier', 'repeat': False},
    ':substitute': {'type': 'modifier', 'repeat': False},
    ':subtraction': {'type': 'modifier', 'repeat': False},
    ':temporal': {'type': 'modifier', 'repeat': True},
    ':theme': {'type': 'participant', 'repeat': False},
    ':time': {'type': 'attribute', 'repeat': True},
    ':timezone': {'type': 'modifier', 'repeat': False},
    ':topic': {'type': 'modifier', 'repeat': False},
    ':undergoer': {'type': 'participant', 'repeat': False},
    ':unit': {'type': 'attribute', 'repeat': False},
    ':value': {'type': 'attribute', 'repeat': False},
    ':vocative': {'type': 'modifier', 'repeat': False},
    ':weekday': {'type': 'modifier', 'repeat': False},
    ':wiki': {'type': 'attribute', 'repeat': False},
    ':year': {'type': 'attribute', 'repeat': False},
    ':year2': {'type': 'attribute', 'repeat': False},
    # We added the following relations that are not in the guidelines:
    ':according-to': {'type': 'modifier', 'repeat': False}, # child node is the source of the information #todo:? say-91
    ':axis-relative-polarities': {'type': 'attribute', 'repeat': False, 'values':['left-handed', 'right-handed']},
    ':framework-type':{'type':'attribute', 'repeat':False, 'values':['absolute', 'intrinsic','relative']},
    ':anchor-framework-translation': {'type': 'attribute', 'repeat': False, 'values': ['rotated', 'reflected']},
    ':co-actor': {'type': 'modifier', 'repeat': False},
    ':axis': {'type': 'modifier', 'repeat': False},
    ':anchor': {'type': 'modifier', 'repeat': False},
    ':color': {'type': 'modifier', 'repeat': False},
    ':concessive-condition': {'type': 'modifier', 'repeat': False},
    ':role': {'type': 'modifier', 'repeat': False},
    ':identity': {'type': 'modifier', 'repeat': False},
    ':orientation': {'type': 'modifier', 'repeat': False},
    ':result': {'type': 'modifier', 'repeat': False},
    ':size': {'type': 'modifier', 'repeat': False},
    ':list-item': {'type': 'modifier', 'repeat': False},
    ':configuration': {'type': 'modifier', 'repeat': False},
    ':pure-addition': {'type': 'modifier', 'repeat': False}
}
op_re = re.compile(r"^:op([1-9][0-9]*)$")

# Abstract concepts for discourse relations. Some of them have just :opN
# children. Others have :ARGN children and thus look like events, but they
# should not be considered events. They should not be required to contain
# :aspect and :modal-strength.
discourse_concepts = [
    # This have :sntN children
    'multi-sentence',
    # These have :opN children:
    'and', 'or', 'inclusive-disjunction', 'exclusive-disjunction', 'and-but', 'consecutive', 'additive', 'and-unexpected', 'and-contrast',
    # These are rolesets and have :ARGN children:
    'but-91', 'unexpected-co-occurrence-91', 'contrast-91',
    # These are reifications, thus rolesets, and have :ARGN children:
    'have-apprehensive-91', 'have-condition-91', 'have-pure-addition-91', 'have-substitution-91', 'have-concession-91', 'have-concessive-condition-91', 'have-subtraction-91'
]
discourse_concept_re = re.compile(r"^(" + '|'.join(discourse_concepts) + r")$")

# minus discourse_concepts
abstract_concepts = {
    'person': {'type': 'basic', 'sub-roles': [':ref-person', ':ref-number']},
    'individual-person': {'type': 'basic', 'sub-roles': [':ref-person', ':ref-number']}, #todo: bert says replacing 'person'? just the named entities
    'place': {'type': 'basic', 'sub-roles': [':ref-person', ':ref-number']}, #todo: what does ref menu mean?
    'event': {'type': 'basic', 'sub-roles': [':ref-person', ':ref-number']}, #todo: what does ref menu mean?
    'name': {'type': 'basic', 'sub-roles': ':opN'},
    'umr-choice': {'type': 'basic', 'sub-roles': ':opN'},
    'manner': {'type': 'basic', 'sub-roles': []},# [] means these have no suggested sub-roles
    'umr-unknown': {'type': 'basic', 'sub-roles': []},  # [] means these have no suggested sub-roles
    'umr-unintelligible': {'type': 'basic', 'sub-roles': []},  # [] means these have no suggested sub-roles
    'umr-empty': {'type': 'basic', 'sub-roles': []},  # [] means these have no suggested sub-roles

    'date-entity':{'type': 'entities', 'sub-roles':[':calendar', ':century', ':day', ':dayperiod', ':decade',':era',':month',':quarter', ':season',':time', ':timezone', ':weekday', ':year', ':year2']},
    'string-entity':{'type':'entities', 'sub-roles':[':value']},
    'ordinal-entity': {'type': 'entities', 'sub-roles': [':value', ':range',':range-start', 'range-trajectory']},
    'url-entity': {'type': 'entities', 'sub-roles': [':value']},
    'percentage-entity': {'type': 'entities', 'sub-roles': [':value']},
    'phone-number-entity': {'type': 'entities', 'sub-roles': [':value']},
    'email-address-entity': {'type': 'entities', 'sub-roles': [':value']},
    'score-entity': {'type': 'entities', 'sub-roles': ':opN'},

    'date-interval': {'type': 'other', 'sub-roles': [':op1',':op2']},
    'value-interval': {'type': 'other', 'sub-roles': [':op1', ':op2']},
    'between': {'type': 'other', 'sub-roles': [':op1', ':op2', ':op3']},
    'slash': {'type': 'other', 'sub-roles': [':op1', ':op2']},
    'emoticon': {'type': 'other', 'sub-roles': [':value']},
    'relative-position': {'type': 'other', 'sub-roles': [':op1', ':quant', ':direction']},

    'less-than': {'type': 'math', 'sub-roles': [':op1']},
    'more-than': {'type': 'math', 'sub-roles': [':op1']},
    'at-least': {'type': 'math', 'sub-roles': [':op1']},
    'at-most': {'type': 'math', 'sub-roles': [':op1']},
    'sum-of': {'type': 'math', 'sub-roles': ':opN'},
    'product-of': {'type': 'math', 'sub-roles': ':opN'},
    'ratio-of': {'type': 'math', 'sub-roles': ':opN'},
    'difference-of': {'type': 'math', 'sub-roles': ':opN'},
    'quotient-of': {'type': 'math', 'sub-roles': ':opN'},
    'power-of': {'type': 'math', 'sub-roles': [':op1', ':op2']},
    'root-of': {'type': 'math', 'sub-roles': [':op1', ':op2']},
    'logarithm-of': {'type': 'math', 'sub-roles': [':op1', ':op2']},

    'monetary-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'distance-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'area-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'volume-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'temporal-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'frequency-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'speed-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'acceleration-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'mass-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'force-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'pressure-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'energy-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'power-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'charge-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'potential-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'resistance-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'inductance-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'magnetic-field-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'magnetic-flux-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'radiation-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'fuel-consumption-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'numerical-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'information-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'concentration-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'catalytic-activity-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'acidity-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'seismic-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'temperature-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},
    'angle-quantity': {'type': 'quantities', 'sub-roles': [':quant', ':unit']},

    'armiture': {'type': 'spatial-abstract-concepts', 'sub-roles': [':axis-relative-polarities', ':framework-type', ':anchor-framework-translation']},
    'relative-orientation': {'type': 'spatial-abstract-concepts',
                 'sub-roles': [':orientation-of', ':op1', ':quant', ':orientation', ':axis']},
    'cartesian-coordinate-entity': {'type': 'spatial-abstract-concepts',
                 'sub-roles': [':x', ':y', ':z',':framework']},
    'dimension-entity': {'type': 'spatial-abstract-concepts',
                 'sub-roles': [':value', ':unit']},
    'slope-quantity': {'type': 'spatial-abstract-concepts',
                 'sub-roles': [':quant', ':rise-axis', ':run-axis']},
    'composite-entity': {'type': 'spatial-abstract-concepts',
                 'sub-roles': []},
    'space': {'type': 'spatial-abstract-concepts',
                         'sub-roles': []},
    'trajectory': {'type': 'spatial-abstract-concepts',
                         'sub-roles': []}
}

ne_types = ['academic-organization',
 'aircraft',
 'aircraft-type',
 'airport',
 'amino-acid',
 'animal',
 'animal-nest',
 'armed-organization',
 'assembly',
 'association',
 'automobile',
 'automobile-type',
 'autonomous-region / nation?',
 'avalanche',
 'bay',
 'behavior',
 'biomedical-entity',
 'body-of-literature',
 'book',
 'breed',
 'bridge',
 'broadcast-network',
 'broadcast-program',
 'building',
 'business',
 'canal',
 'canyon',
 'category',
 'celestial-entity',
 'cell',
 'cell-line',
 'ceremony',
 'chemical-compound',
 'chemical-element',
 'city-square',
 'clan',
 'coastland',
 'color',
 'company',
 'computer-program',
 'conceptualization',
 'constellation',
 'continent',
 'country',
 'country-partition',
 'country-region',
 'court-decision',
 'criminal-organization',
 'cultural-activity',
 'cultural-artifact',
 'cultural-facility',
 'culturally-protected-area',
 'currency-system',
 'cyber-entity',
 'cyberattack',
 'cyclone',
 'dam',
 'dance',
 'degree',
 'desert',
 'diet',
 'disease',
 'dna-sequence',
 'duststorm',
 'earthquake',
 'ecosystem',
 'enzyme',
 'ethnic-group',
 'event',
 'facility',
 'family',
 'festival',
 'financial-entity',
 'fire',
 'flood',
 'food-dish',
 'forest',
 'galaxy',
 'game',
 'gene',
 'geo-political-entity',
 'geographical-entity',
 'glaciological-entity',
 'government-organization',
 'government-output',
 'grassland',
 'gulf',
 'historical-period',
 'honor',
 'hotel',
 'human-settlement',
 'identification-number',
 'incident',
 'international-organization',
 'island',
 'journal',
 'lake',
 'land-entity',
 'landslide',
 'language',
 'legislation',
 'local-region',
 'macro-molecular-complex',
 'magazine',
 'market',
 'market-sector',
 'measurement-system',
 'medical-condition',
 'medicinal-substance',
 'mission',
 'molecular-physical-entity',
 'moon',
 'mountain',
 'mountain-range',
 'movement',
 'museum',
 'music',
 'music-key',
 'musical-note',
 'name',
 'nationality',
 'natural-disaster',
 'natural-object',
 'natural-reserve',
 'news-media',
 'notational-system',
 'nucleic-acid',
 'ocean',
 'organization',
 'palace',
 'park',
 'pass',
 'pathogen',
 'pathway',
 'peninsula',
 'performance',
 'performing-group',
 'person',
 'place',
 'planet',
 'plant',
 'policy',
 'political-ideology',
 'political-organization',
 'port',
 'principle',
 'product',
 'protected-area',
 'protein',
 'protein-family',
 'protein-segment',
 'publication',
 'qualification',
 'railway-line',
 'region',
 'regional-group',
 'religion',
 'religious-group',
 'religious-organization',
 'river',
 'road',
 'rock',
 'room',
 'sea',
 'ship',
 'ship-type',
 'small-celestial-body',
 'small-molecule',
 'social-group',
 'social-media',
 'social-program',
 'solar-system',
 'spacecraft',
 'spacecraft-type',
 'spaceport',
 'species',
 'sports-facility',
 'sports-organization',
 'star',
 'station',
 'strait',
 'system',
 'tax',
 'taxon',
 'test',
 'theater',
 'therapy',
 'thing',
 'thoroughfare',
 'treaty',
 'tunnel',
 'unit',
 'utility-structure',
 'valley',
 'variable',
 'vehicle',
 'vehicle-type',
 'volcanic-disaster',
 'volcano',
 'war',
 'water-entity',
 'weapon',
 'weapon-type',
 'website',
 'wetland',
 'work-of-art',
 'world-region',
 'worship-place',
 'writing-script']

# These reification rolesets (minus discourse_concepts) have :ARGN children
# Abstract concepts for things that are neither events nor discourse connectives
# but they are rolesets and thus resemble events superficially. Most of them
# are structured data or metadata records. They should not be required to contain
# annotations that are mandatory for events.
non_event_rolesets = [
    'have-actor-91', 'have-co-actor-91', 'have-undergoer-91', 'have-theme-91', 'have-force-91', 'have-causer-91',
    'have-companion-91', 'have-affectee-91', 'have-recipient-91', 'have-temporal-91', 'have-instrument-91',
    'have-manner-91', 'have-place-91', 'have-direction-91', 'have-path-91', 'have-goal-91', 'have-start-91',
    'have-source-91', 'have-extent-91', 'have-quant-91', 'have-degree-92', 'have-frequency-91', 'have-duration-91',
    'have-purpose-91', 'have-cause-91', 'have-reason-91', 'have-part-91', 'have-group-91', 'have-material-91',
    'have-topic-91', 'have-vocative-91', 'have-medium-91', 'have-age-91', 'have-example-91', 'have-mod-91',
    'have-other-role-91', 'have-ord-91', 'have-name-91', 'have-value-91', 'have-unit-91', 'have-polarity-91',
    'have-modal-strength-91', 'have-list-item-91', 'have-mode-91', 'be-polite-91', 'have-91', 'have-experience-91',
    'have-result-91', 'have-configuration-91', 'have-orientation-91',

    'have-size-91', 'have-color-91', 'have-configuration-91', 'have-orientation-91', 'cartesian-framework-91',
    'spatial-sequence-91', 'have-anchor-91', 'have-axis-91',

    'have-91', 'belong-91', 'exist-91', 'have-place-91', 'have-mod-91', 'have-role-91', 'have-rel-role-92', 'have-org-role-92',
    'identity-91',

    'byline-91', 'cite-91', 'correlate-91', 'course-91', 'distribution-range-91', 'have-degree-91',
    'hyperlink-91', 'include-91', 'infer-91', 'publication-91', 'reference-illustration-91', 'resemble-91',
    'rate-entity-91', 'score-on-scale-91', 'statistical-test-91',
    'street-address-91', 'mean-91', 'have-experience-91', 'weather-91', 'range-91', 'gesture-91',
    'emit-sound-91', 'proverb-91', 'say-91'
] # todo: don't validating those

non_event_roleset_re = re.compile(r"^(" + '|'.join(non_event_rolesets) + r")$")

def validate_abstract_concept_NEs(sentence, node_dict, args):
    """
    checks whether the abstract concepts and named entities are legal
    """
    testlevel = 3
    testclass = 'Sentence'
    current_nodes = list(sentence[1]['nodes'])
    # Create a mapping from concept to node to get the correct line number
    concept_to_node = {}
    for n in current_nodes:
        if "concept" in node_dict[n]:
            concept = node_dict[n].get("concept")
            # Store the first occurrence of each concept with its node
            if concept not in concept_to_node:
                concept_to_node[concept] = node_dict[n]

    concepts = [node_dict[n].get("concept") for n in current_nodes if "concept" in node_dict[n]]
    filtered_concepts = [
        concept for concept in concepts
        if not re.search(r'-\d+$', concept) or re.search(r'-91$|-92$', concept)
    ] # remove verb predicates
    tokens = sentence[0]['tokens']
    language = getattr(args, 'lang', None)
    token_lemmas = simple_lemmatize(tokens, language=language)
    attribute_value_items = [
        value for entry in known_relations.values()
        for value in entry.get('value', [])
    ]

    possible_cocepts = list(abstract_concepts.keys()) + ne_types + discourse_concepts + non_event_rolesets + attribute_value_items
    for item in filtered_concepts:
        is_present = any(item in s for s in tokens + token_lemmas + possible_cocepts)
        if not is_present:
            testid = 'unknown-abstract-concept-ne'
            testmessage = "Unknown abstract concept or NE: '%s'." % item
            # Use the specific node's line number instead of the sentence block's line number
            node = concept_to_node.get(item)
            lineno = node['line0'] if node and 'line0' in node else sentence[1]['line0']
            warn(testmessage, testclass, testlevel, testid, lineno=lineno)


def validate_relations(sentence, node_dict, args):
    """
    Checks every sentence level relation whether we know it.
    """
    # import json
    # print("here: ")
    # print(json.dumps(node_dict, indent=4))
    testlevel = 3
    testclass = 'Sentence'
    # Sort the nodes by their first line so that the validation report is stable and can be diffed.
    nodes = sorted([node_dict[nid] for nid in sentence[1]['nodes']], key=lambda x: x['line0'])
    for node in nodes:
        nid = node['variable']
        if 'relations' in node:
            relations = sorted([r for r in node['relations'] if r['dir'] == 'out'], key=lambda x: x['line0'])
            for r in relations:
                ###!!! For now assume that every relation can be inverted using the '-of' suffix.
                ###!!! Later this should be banned at least for pure attributes.
                relation = re.sub(r"-of$", '', r['relation'])
                # Make sure that ':opN' is known for any N.
                if not relation in known_relations and op_re.match(relation):
                    known_relations[relation] = known_relations[':op1']
                if not relation in known_relations:
                    testid = 'unknown-relation'
                    testmessage = "Unknown relation '%s'." % r['relation']
                    warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                else:
                    type = known_relations[relation]['type']
                    values = known_relations[relation]['values'] if 'values' in known_relations[relation] else []
                    # Non-attributes should have child nodes rather than scalar values, but there are exceptions.
                    # :ARG2 of have-polarity-91 has values '+' and '-'.
                    if r['relation'] == ':ARG2' and node['concept'] == 'have-polarity-91':
                        type = 'attribute'
                        values = ['+', '-']
                    if type != 'attribute':
                        if r['type'] != 'node':
                            testid = 'unexpected-value'
                            testmessage = "Expected child node because '%s' is relation, not attribute; found %s with value '%s'." % (r['relation'], r['type'], r['value'])
                            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                    else: # type == attribute
                        if values and not r['value'] in values:
                            testid = 'unexpected-value'
                            testmessage = "Unexpected value '%s' of attribute '%s'." % (r['value'], r['relation'])
                            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
            # Check repeated same-name relations. Include incoming inverted relations.
            relations = sorted(node['relations'], key=lambda x: x['line0'])
            relcount = {}
            relfirst = {}
            rellast = {}
            for r in relations:
                uninvert = re.sub(r"-of$", '', r['relation'])
                if r['dir'] == 'out' and uninvert == r['relation'] or r['dir'] == 'in' and uninvert != r['relation']:
                    if uninvert in relfirst:
                        relcount[uninvert] += 1
                        rellast[uninvert] = r['line0']
                    else:
                        relfirst[uninvert] = r['line0']
                        relcount[uninvert] = 1
                        rellast[uninvert] = r['line0']
            # Now relations will hold just the names, not the full records.
            relations = sorted(list(relcount), key=lambda x: rellast[x])
            for r in relations:
                if relcount[r] > 1 and r in known_relations and not known_relations[r]['repeat']:
                    testid = 'repeated-relation'
                    testmessage = "Node '%s' is not supposed to have more than one relation '%s' but it has %d: first on line %d." % (nid, r, relcount[r], relfirst[r])
                    warn(testmessage, testclass, testlevel, testid, lineno=rellast[r])
            # For :op1, :op2 etc., check that higher numbers occur only if lower numbers do.
            relations = [r for r in node['relations'] if r['dir'] == 'out' and op_re.match(r['relation'])]
            if relations:
                for r in relations:
                    match = op_re.match(r['relation'])
                    r['opnumber'] = int(match.group(1))
                relations = sorted(relations, key=lambda x: x['opnumber'])
                for i in range(len(relations)):
                    opnumber = relations[i]['opnumber']
                    if opnumber > i + 1:
                        testid = 'skipped-op-relation'
                        testmessage = "Missing relation ':op%d' while there is relation ':op%d'." % (opnumber-1, opnumber)
                        warn(testmessage, testclass, testlevel, testid, lineno=relations[i]['line0'])
                        break

def validate_name(sentence, node_dict, args):
    """
    Checks the relations of a name node.
    """
    testlevel = 3
    testclass = 'Sentence'
    # Sort the nodes by their first line so that the validation report is stable and can be diffed.
    nodes = sorted([node_dict[nid] for nid in sentence[1]['nodes']], key=lambda x: x['line0'])
    for node in nodes:
        if node['concept'] == 'name':
            relations = sorted(node['relations'], key=lambda x: x['line0'])
            in_name_found = False
            out_op1_found = False
            for r in relations:
                if r['dir'] == 'in':
                    if r['relation'] == ':name':
                        in_name_found = True
                    else:
                        testid = 'wrong-incoming-name'
                        testmessage = "Incoming relation to a 'name' concept should not be '%s'." % r['relation']
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                else:
                    if op_re.match(r['relation']):
                        if r['relation'] == ':op1':
                            out_op1_found = True
                        # In general ':opN' can be relation (leading to a child node) or attribute (with string or numeric value).
                        # However, ':opN' of a 'name' concept should always be strings.
                        if r['type'] != 'string':
                            testid = 'unexpected-value'
                            testmessage = "Expected string attribute of '%s', found '%s'." % (r['relation'], r['type'])
                            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                    else:
                        testid = 'wrong-outgoing-name'
                        testmessage = "Outgoing relation from a 'name' concept should not be '%s'." % r['relation']
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
            if not in_name_found:
                testid = 'missing-incoming-name'
                testmessage = "Missing incoming ':name' relation to the 'name' concept %s." % (node['variable'])
                warn(testmessage, testclass, testlevel, testid, lineno=node['line0'])
            if not out_op1_found:
                testid = 'missing-outgoing-name'
                testmessage = "Missing outgoing ':op1' relation from the 'name' concept %s." % (node['variable'])
                warn(testmessage, testclass, testlevel, testid, lineno=node['line0'])
            # The name node is usually unaligned (either 0-0 or -1--1).
            # The alignment goes to its parent node instead.
            ###!!! However, there are exceptions, so we cannot require this.
            #if 'alignment' in node and node['alignment']['tokids'] != [0]:
            #    testid = 'invalid-name-alignment'
            #    testmessage = "Name nodes should stay unaligned (unlike their parents), but %s is aligned to %s (%s)." % (node['variable'], str(node['alignment']['tokids']), node['alignment']['tokstr'])
            #    warn(testmessage, testclass, testlevel, testid, lineno=node['alignment']['line0'])

def validate_wiki(sentence, node_dict, args):
    """
    Checks the relations of a name node.
    """
    testlevel = 3
    testclass = 'Sentence'
    # Sort the nodes by their first line so that the validation report is stable and can be diffed.
    nodes = sorted([node_dict[nid] for nid in sentence[1]['nodes']], key=lambda x: x['line0'])
    for node in nodes:
        relations = sorted(node['relations'], key=lambda x: x['line0'])
        for r in relations:
            if r['relation'] == ':wiki':
                if args.check_string_wiki and r['type'] != 'string':
                    testid = 'unexpected-value'
                    testmessage = "Expected string attribute of '%s', found '%s'." % (r['relation'], r['type'])
                    warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                else:
                    # At ÚFAL we require the :wiki value to be a Wikidata identifier (from URL after stripping https://wikidata.org/wiki/).
                    # The US UMR team allow article title from English Wikipedia instead, so this test is not universally applicable.
                    if args.check_non_q_wiki and not re.match(r"^Q[1-9][0-9]*$", r['value']):
                        testid = 'unexpected-value'
                        testmessage = "Expected Wikidata id (Q+number), found '%s'." % (r['value'])
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])

def detect_events(sentence, node_dict, args):
    """
    Tries to figure out which concept nodes in the current sentence are events.
    Possible clues:
    * If it is a discourse connective concept, it is not an event (regardless of the other cluse below).
    * If it is one of the predefined *-91 concepts, it is an event.
    * If it has an ":ARG?" child, it is an event.
    * If it has an ":ARG?-of" parent, it is an event.
    * If it has ":modal-strength" or ":aspect", it is an event (perhaps these two should be obligatory for all events).
    * If in document annotation it participates in a relation from the ":temporal" or ":modal" group, it is likely an event,
      however, this condition is not sufficient. Entities such as persons can participate in modal relations ("Rob thinks that...")
      and temporal entities ("yesterday", "December 21") participate in temporal relations.
    * If in document annotation it participates in the ":same-event" relation from the ":coref" group, it is an event
      (otherwise the coreference relation would be ":same-entity").
    """
    for nid in sorted(sentence[1]['nodes']):
        node = node_dict[nid]
        if args.print_relations:
            print("Node %s, concept=%s, line=%d, tokens=%s %s" % (nid, node['concept'], node['line0'], str(node['alignment']['tokids']), node['alignment']['tokstr']))
        # If it is a discourse connective, stop here.
        if re.match(discourse_concept_re, node['concept']):
            continue
        # If it is document metadata such as publication-91, stop here.
        if re.match(non_event_roleset_re, node['concept']):
            continue
        if not 'event_reason' in node and re.match(r"^.+-91$", node['concept']):
            node['event_reason'] = "its concept is %s on line %d" % (node['concept'], node['line0'])
        relations = node['relations']
        for r in relations:
            if args.print_relations:
                print("  Relation %s %s, type=%s, value=%s, line=%d" % (r['dir'], r['relation'], r['type'], r['value'], r['line0']))
            if not 'event_reason' in node:
                if r['dir'] == 'out' and re.match(r"^:(ARG[0-6]|aspect|modstr)$", r['relation']):
                    node['event_reason'] = "it has outgoing relation %s on line %d" % (r['relation'], r['line0'])
                elif r['dir'] == 'in' and re.match(r"^:ARG[0-6]-of$", r['relation']):
                    node['event_reason'] = "it has incoming relation %s on line %d" % (r['relation'], r['line0'])
        if args.print_relations:
            if 'event_reason' in node:
                print("  This node is an event because %s." % node['event_reason'])
            print('')
    # Check document-level annotation.
    testlevel = 3
    testclass = 'Document'
    testid = 'coref-entity-event-mismatch'
    for r in sentence[3]['relations']:
        if r['group'] == ':coref':
            # Same event coreference means that both nodes are events.
            if r['relation'] == ':same-event':
                if r['node0'] in node_dict:
                    node = node_dict[r['node0']]
                    if 'entity_reason' in node:
                        testmessage = "Node '%s' cannot participate in :same-event relation; it is an entity because %s." % (r['node0'], node['entity_reason'])
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                    if not 'event_reason' in node:
                        node['event_reason'] = "it participates in a :same-event relation on line %d" % (r['line0'])
                if r['node1'] in node_dict:
                    node = node_dict[r['node1']]
                    if 'entity_reason' in node:
                        testmessage = "Node '%s' cannot participate in :same-event relation; it is an entity because %s." % (r['node0'], node['entity_reason'])
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                    if not 'event_reason' in node:
                        node['event_reason'] = "it participates in a :same-event relation on line %d" % (r['line0'])
            # Same entity coreference means that none of the nodes is event;
            # remember it so that we can later report errors if it is included
            # in event coreference.
            elif r['relation'] == ':same-entity':
                if r['node0'] in node_dict:
                    node = node_dict[r['node0']]
                    if 'event_reason' in node:
                        testmessage = "Node '%s' cannot participate in :same-entity relation; it is an event because %s." % (r['node0'], node['event_reason'])
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                    if not 'entity_reason' in node:
                        node['entity_reason'] = "it participates in a :same-entity relation on line %d" % (r['line0'])
                if r['node1'] in node_dict:
                    node = node_dict[r['node1']]
                    if 'event_reason' in node:
                        testmessage = "Node '%s' cannot participate in :same-entity relation; it is an event because %s." % (r['node1'], node['event_reason'])
                        warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
                    if not 'entity_reason' in node:
                        node['entity_reason'] = "it participates in a :same-entity relation on line %d" % (r['line0'])

def validate_events(sentence, node_dict, args):
    """
    Revisits concepts that have been identified as events and checks that they
    have the relations that are required for events.
    """
    testlevel = 3
    testclass = 'Sentence'
    # Sort the nodes by their first line so that the validation report is stable and can be diffed.
    nodes = sorted([node_dict[nid] for nid in sentence[1]['nodes']], key=lambda x: x['line0'])
    for node in nodes:
        nid = node['variable']
        relations = {}
        relations[':aspect'] = sorted([r for r in node['relations'] if r['dir'] == 'out' and r['relation'] == ':aspect'], key=lambda x: x['line0'])
        relations[':modal-strength/predicate'] = sorted([r for r in node['relations'] if r['dir'] == 'out' and r['relation'] in [':modal-strength', ':modal-predicate']], key=lambda x: x['line0'])
        if 'event_reason' in node:
            # :ARG relations imply that it is an event but they are not required.
            # On the other hand, :aspect and :modal-strength seem to be required according to the guidelines.
            # :modal-strength can be replaced by :modal-predicate. Only one of them is expected (guidelines 4-3-1-2).
            for rtype in [':aspect', ':modal-strength/predicate']: #modal annotations are in document level
                if len(relations[rtype]) < 1:
                    testid = 'missing-attribute'
                    testmessage = "Missing attribute %s. Node %s is an event because %s." % (rtype, nid, node['event_reason'])
                    warn(testmessage, testclass, testlevel, testid, lineno=node['line0'])
                # :modal-strength must be atom but :modal-predicate is a node.
                elif relations[rtype][0]['relation'] == ':modal-strength' and relations[rtype][0]['type'] != 'atom':
                    testid = 'invalid-attribute'
                    testmessage = "Expected atomic value of attribute %s, found type=%s, value=%s." % (':modal-strength', relations[rtype][0]['type'], relations[rtype][0]['value'])
                    warn(testmessage, testclass, testlevel, testid, lineno=relations[rtype][0]['line0'])
            # Check also document level relations. Every event must have at least
            # :temporal against document-creation-time.
            found = False
            for r in sentence[3]['relations']:
                if r['group'] == ':temporal':
                    if r['node0'] == nid or r['node1'] == nid:
                        found = True
                        break
            if not found:
                event = "%s / %s" % (nid, node['concept'])
                if node['alignment']['tokstr'] != '':
                    event += " '%s'" % node['alignment']['tokstr']
                testid = 'missing-temporal'
                testmessage = "Missing temporal relation (at least with document-creation-time) for event %s." % event
                warn(testmessage, 'Document', testlevel, testid, lineno=sentence[3]['line0'])
        # On the other hand, some concepts look like events but they are not events and should not have :aspect and :modal-strength.
        elif re.match(non_event_roleset_re, node['concept']) or re.match(discourse_concept_re, node['concept']):
            for rtype in [':aspect', ':modal-strength/predicate']:
                if len(relations[rtype]) > 0:
                    testid = 'unexpected-attribute'
                    testmessage = "Attribute %s not expected because %s is not an event." % (relations[rtype][0]['relation'], node['concept'])
                    warn(testmessage, testclass, testlevel, testid, lineno=relations[rtype][0]['line0'])

def validate_document_relations(sentence, node_dict, args):
    """
    Checks for every document level relation whether we know it.
    """
    testlevel = 3
    testclass = 'Document'
    for r in sentence[3]['relations']:
        if r['group'] == ':temporal':
            if not r['relation'] in [':contained', ':before', ':after', ':overlap', ':depends-on']:
                testid = 'unknown-document-relation'
                testmessage = "Unknown document-level %s relation '%s'." % (r['group'], r['relation'])
                warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
        elif r['group'] == ':modal':
            # The relation ':modal' is used between 'root' and 'author'.
            # It can be also used between 'root' and a node from the sentence graph, if that node represents an entity (typically a person) who says something.
            if not r['relation'] in [':modal', ':full-affirmative', ':partial-affirmative', ':strong-partial-affirmative', ':weak-partial-affirmative', ':neutral-affirmative', ':strong-neutral-affirmative', ':weak-neutral-affirmative', ':full-negative', ':partial-negative', ':strong-partial-negative', ':weak-partial-negative', ':neutral-negative', ':strong-neutral-negative', ':weak-neutral-negative', ':unspecified']:
                testid = 'unknown-document-relation'
                testmessage = "Unknown document-level %s relation '%s'." % (r['group'], r['relation'])
                warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
        elif r['group'] == ':coref':
            if not r['relation'] in [':same-entity', ':same-event', ':subset-of']:
                testid = 'unknown-document-relation'
                testmessage = "Unknown document-level %s relation '%s'." % (r['group'], r['relation'])
                warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
        else:
            testid = 'unknown-document-relation-group'
            testmessage = "Unknown document-level relation group '%s'." % r['group']
            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
        # Participants in document-level relations must be either known concept nodes
        # or one of the constants: root, author, null-conceiver, document-creation-time.
        if not r['node0'] in node_dict and not r['node0'] in ['root', 'author', 'null-conceiver', 'document-creation-time', 'past-reference', 'present-reference', 'future-reference']:
            testid = 'unknown-node-id'
            testmessage = "The node id (variable) '%s' is unknown. No such node has been defined so far." % r['node0']
            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
            # Add the variable to node_dict so that we do not get KeyError later.
            node_dict[r['node0']] = {'concept': 'UNKNOWN', 'relations': [], 'alignment': {'tokids': [], 'tokstr': ''}, 'line0': r['line0']}
        if not r['node1'] in node_dict and not r['node1'] in ['root', 'author', 'null-conceiver', 'document-creation-time', 'past-reference', 'present-reference', 'future-reference']:
            testid = 'unknown-node-id'
            testmessage = "The node id (variable) '%s' is unknown. No such node has been defined so far." % r['node1']
            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
            # Add the variable to node_dict so that we do not get KeyError later.
            node_dict[r['node1']] = {'concept': 'UNKNOWN', 'relations': [], 'alignment': {'tokids': [], 'tokstr': ''}, 'line0': r['line0']}
        # At least one of the participants must be a concept node from the current
        # sentence. For example, it is not allowed to annotate coreference between
        # nodes s2p (from sentence 2) and s3p (from sentence 3) in the document-
        # level graph of sentence 4. We have a global dictionary of nodes, which
        # does not tell us the sentence to which the node belongs. We can use
        # either the node variable (so far we require that variables start with
        # 's' and the sentence number) or the line where the node is defined
        # (and compare it with the first line of the current sentence).
        current_sentence_line = sentence[0]['line0']
        node0_line = node_dict[r['node0']]['line0'] if r['node0'] in node_dict else -1
        node1_line = node_dict[r['node1']]['line0'] if r['node1'] in node_dict else -1
        if node0_line < current_sentence_line and node1_line < current_sentence_line and not (r['node0'] == 'root' and r['node1'] == 'author'):
            testid = 'misplaced-document-relation'
            testmessage = "At least one of the nodes must be from the current sentence but neither '%s' nor '%s' is." % (r['node0'], r['node1'])
            warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])
        # By convention, node0 of a document-level relation is from the same
        # sentence as node1 or from an earlier one. We could probably extend this
        # convention so that node0 is the one defined before node1 (line-wise).
        # We only cannot extend it to the ':contained' relations because there
        # is no way of inverting them following the guidelines.
        # EDIT 2024-05-06: Markéta says that this rule cannot stand because she
        # wants to order the relations in the temporal annotation as they were
        # added. And sometimes we must (according to the guidelines) first add
        # a node that occurs later in the sentence graph. For example, we must
        # wait with adding events until all temporal expressions have been
        # added, even if a temporal expression occurs later in the sentence.
        #if r['relation'] != ':contained' and node0_line > node1_line:
        #    testid = 'wrong-node-order'
        #    testmessage = "Document-level relation should not go from a newer node ('%s' defined on line %d) to an older node ('%s' defined on line %d)." % (r['node0'], node0_line, r['node1'], node1_line)
        #    warn(testmessage, testclass, testlevel, testid, lineno=r['line0'])

def collect_coreference_clusters(document, node_dict, args):
    """
    Once all sentences of the document have been read, this function should be
    called. It re-visits the document-level graphs of all sentences, traces
    the coreference relations and constructs clusters of nodes that refer to
    the same entity.
    """
    # Collect coreference clusters.
    document['clusters'] = {}
    for s in document['sentences']:
        for r in s[3]['relations']:
            if r['group'] == ':coref' and r['relation'] in [':same-entity', ':same-event']:
                n0 = r['node0']
                n1 = r['node1']
                reason = "\n  Line %s: %s %s %s" % (r['line0'], debugnode(r['node0'], node_dict), r['relation'], debugnode(r['node1'], node_dict))
                # The cluster will be represented by the id of its first node (the one first mentioned).
                cid = get_coref_cluster_id(n0, n1, node_dict)
                if not cid in document['clusters']:
                    document['clusters'][cid] = set()
                # If the node was already member of this cluster, do nothing.
                # If it was in a cluster but the cluster id was different, move its members to the new cluster.
                # If it was not in any cluster, add it to this one.
                if 'cluster' in node_dict[n0]:
                    if node_dict[n0]['cluster'] != cid:
                        oldcid = node_dict[n0]['cluster']
                        for cm in document['clusters'][oldcid]:
                            document['clusters'][oldcid].remove(cm)
                            document['clusters'][cid].add(cm)
                            node_dict[cm]['cluster'] = cid
                else:
                    node_dict[n0]['cluster'] = cid
                    document['clusters'][cid].add(n0)
                if 'cluster' in node_dict[n1]:
                    if node_dict[n1]['cluster'] != cid:
                        oldcid = node_dict[n1]['cluster']
                        for cm in document['clusters'][oldcid]:
                            document['clusters'][oldcid].remove(cm)
                            document['clusters'][cid].add(cm)
                            node_dict[cm]['cluster'] = cid
                else:
                    node_dict[n1]['cluster'] = cid
                    document['clusters'][cid].add(n1)
                if not 'cluster_reason' in node_dict[n0]:
                    node_dict[n0]['cluster_reason'] = reason
                else:
                    node_dict[n0]['cluster_reason'] += ' and' + reason
                if not 'cluster_reason' in node_dict[n1]:
                    node_dict[n1]['cluster_reason'] = reason
                else:
                    node_dict[n1]['cluster_reason'] += ' and' + reason
                if not 'cluster_line0' in node_dict[n0]:
                    node_dict[n0]['cluster_line0'] = r['line0']
                if not 'cluster_line0' in node_dict[n1]:
                    node_dict[n1]['cluster_line0'] = r['line0']
    # Check that nodes in the same cluster do not have conflicting wiki links.
    for c in document['clusters']:
        cwiki = ''
        cwikinode = ''
        members = sorted(list(document['clusters'][c]))
        for cm in members:
            wiki = ''
            wikidatalist = [x['value'] for x in node_dict[cm]['relations'] if x['relation'] == ':wiki']
            if len(wikidatalist) > 0:
                wiki = wikidatalist[0]
            if wiki != '':
                if cwiki != '':
                    if wiki != cwiki:
                        wikilabel = wiki
                        label = get_wikidata_label(wiki)
                        if label:
                            wikilabel = wiki + ' (' + label + ')'
                        cwikilabel = cwiki
                        label = get_wikidata_label(cwiki)
                        if label:
                            cwikilabel = cwiki + ' (' + label + ')'
                        testlevel = 3
                        testclass = 'Document'
                        testid = 'coref-wiki-mismatch'
                        testmessage = "The node '%s' has wikidata link %s but it is coreferential with node '%s' whose wikidata is %s." % (cm, wikilabel, cwikinode, cwikilabel)
                        warn(testmessage, testclass, testlevel, testid, lineno=node_dict[cm]['line0'])
                else:
                    cwiki = wiki
                    cwikinode = cm
    if args.print_clusters:
        for c in document['clusters']:
            print("Coreference cluster '%s': " % c)
            members = sorted(list(document['clusters'][c]))
            for cm in members:
                wiki = ''
                wikidatalist = [x['value'] for x in node_dict[cm]['relations'] if x['relation'] == ':wiki']
                if len(wikidatalist) > 0:
                    wiki = wikidatalist[0]
                    label = get_wikidata_label(wiki)
                    if label:
                        wiki += ' (' + label + ')'
                print("  %s (%s / %s) wiki '%s' line %d" % (cm, node_dict[cm]['alignment']['tokstr'], node_dict[cm]['concept'], wiki, node_dict[cm]['line0']))

def get_coref_cluster_id(n0, n1, node_dict):
    """
    Takes ids of two nodes from the same coreference cluster. Decides which of
    the two ids should serve as the id of the cluster.
    """
    # If one of the nodes already is member of a cluster, replace it with its current cluster id.
    if 'cluster' in node_dict[n0]:
        n0 = node_dict[n0]['cluster']
    if 'cluster' in node_dict[n1]:
        n1 = node_dict[n1]['cluster']
    # The node mentioned earlier (line-wise) wins.
    l0 = node_dict[n0]['line0']
    l1 = node_dict[n1]['line0']
    if l0 < l1:
        return n0
    if l1 < l0:
        return n1
    # If both nodes were introduced on the same line, we don't know which one was first.
    # So we order them alphabetically by their ids.
    if n0 < n1:
        return n0
    else:
        return n1

def build_temporal_graph(document, node_dict, args):
    """
    Once all sentences of the document have been read and coreference clusters
    have been collected, this function should be called. It re-visits the
    document-level graphs of all sentences, traces the temporal relations and
    infers additional temporal relations where possible.
    """
    # Add identity relations to the temporal graph for coreferential entities and events.
    # (We need entities because of temporal expressions. Other entities will be added but not used.)
    document['temporal'] = temporal = Temporal(document, node_dict);
    for c in document['clusters']:
        members = list(document['clusters'][c])
        #print("\n", 'temporal.add_relation for cluster %s members: ' % c, members)
        for cmi in members:
            for cmj in members:
                if cmj != cmi:
                    temporal.add_relation(cmi, ':identity', cmj, node_dict[cmi]['cluster_line0'], node_dict[cmi]['cluster_reason'])
    # Collect and infer temporal relations.
    for s in document['sentences']:
        for r in s[3]['relations']:
            if r['group'] == ':temporal':
                # Save the current relation in the graph. Report error in case of conflict.
                reason = "\n  Line %s: %s %s %s" % (r['line0'], debugnode(r['node0'], node_dict), r['relation'], debugnode(r['node1'], node_dict))
                temporal.add_relation(r['node0'], r['relation'], r['node1'], r['line0'], reason)
                # Save the opposite relation in the graph. Then look for transitively inferred relations.
                if r['relation'] == ':before':
                    temporal.add_relation(r['node1'], ':after', r['node0'], r['line0'], reason)
                    # Identity and transitive :before between n0, n1, and their neighbors.
                    # (n0 :before n1) and (n1 :before n) => (n0 :before n)
                    # No need for recursion, as shortcuts to distant layers already exist in the graph.
                    for n in temporal.nodes():
                        if n == r['node0'] or n == r['node1']:
                            continue
                        if temporal.is_relation(n, r['node1'], [':after', ':identity']):
                            # We already know that n1 is before n0. Now n is before n1 or they are coreferential.
                            # Therefore, n is before n0.
                            reason1 = reason + ' and' + temporal.reason(n, r['node1'])
                            temporal.add_relation(r['node0'], ':before', n, r['line0'], reason1)
                            temporal.add_relation(n, ':after', r['node0'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node0'], [':before', ':identity']):
                            # We already know that n0 is after n1. Now n is after n0 or they are coreferential.
                            # Therefore, n is after n1.
                            reason1 = reason + ' and' + temporal.reason(n, r['node0'])
                            temporal.add_relation(r['node1'], ':after', n, r['line0'], reason1)
                            temporal.add_relation(n, ':before', r['node1'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node0'], [':contains']):
                            # We already know that n1 is before n0. Now n0 contains n, so n1 is also before n.
                            reason1 = reason + ' and' + temporal.reason(n, r['node0'])
                            temporal.add_relation(r['node1'], ':after', n, r['line0'], reason1)
                            temporal.add_relation(n, ':before', r['node1'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node1'], [':contains']):
                            # We already know that n1 is before n0. Now n1 contains n, so n is also before n0.
                            reason1 = reason + ' and' + temporal.reason(n, r['node1'])
                            temporal.add_relation(r['node0'], ':before', n, r['line0'], reason1)
                            temporal.add_relation(n, ':after', r['node0'], r['line0'], reason1)
                elif r['relation'] == ':after':
                    temporal.add_relation(r['node1'], ':before', r['node0'], r['line0'], reason)
                    # Identity and transitive :after between n0, n1, and their neighbors.
                    # (n0 :after n1) and (n1 :after n) => (n0 :after n)
                    # No need for recursion, as shortcuts to distant layers already exist in the graph.
                    for n in temporal.nodes():
                        if n == r['node0'] or n == r['node1']:
                            continue
                        if temporal.is_relation(n, r['node1'], [':before', ':identity']):
                            # We already know that n1 is after n0. Now n is after n1 or they are coreferential.
                            # Therefore, n is after n0.
                            reason1 = reason + ' and' + temporal.reason(n, r['node1'])
                            temporal.add_relation(r['node0'], ':after', n, r['line0'], reason1)
                            temporal.add_relation(n, ':before', r['node0'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node0'], [':after', ':identity']):
                            # We already know that n0 is before n1. Now n is before n0 or they are coreferential.
                            # Therefore, n is before n1.
                            reason1 = reason + ' and' + temporal.reason(n, r['node0'])
                            temporal.add_relation(r['node1'], ':before', n, r['line0'], reason1)
                            temporal.add_relation(n, ':after', r['node1'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node0'], [':contains']):
                            # We already know that n1 is after n0. Now n0 contains n, so n1 is also after n.
                            reason1 = reason + ' and' + temporal.reason(n, r['node0'])
                            temporal.add_relation(r['node1'], ':before', n, r['line0'], reason1)
                            temporal.add_relation(n, ':after', r['node1'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node1'], [':contains']):
                            # We already know that n1 is after n0. Now n1 contains n, so n is also after n0.
                            reason1 = reason + ' and' + temporal.reason(n, r['node1'])
                            temporal.add_relation(r['node0'], ':after', n, r['line0'], reason1)
                            temporal.add_relation(n, ':before', r['node0'], r['line0'], reason1)
                elif r['relation'] == ':contained':
                    # The guidelines do not define any inverse relation to ':contained'
                    # but we need it to block the slot and not allow other relations here
                    # (and also to see the relation from both sides).
                    temporal.add_relation(r['node1'], ':contains', r['node0'], r['line0'], reason)
                    # Identity and transitive :contained between n0, n1, and their neighbors.
                    # (n0 :contained n1) and (n1 :contained n) => (n0 :contained n)
                    for n in temporal.nodes():
                        if n == r['node0'] or n == r['node1']:
                            continue
                        if temporal.is_relation(n, r['node1'], [':contains', ':identity']):
                            # We already know that n1 is contained in n0. Now n is contained in n1 or they are coreferential.
                            # Therefore, n is contained in n0.
                            reason1 = reason + ' and' + temporal.reason(n, r['node1'])
                            temporal.add_relation(r['node0'], ':contained', n, r['line0'], reason1)
                            temporal.add_relation(n, ':contains', r['node0'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node0'], [':contained', ':identity']):
                            # We already know that n0 contains n1. Now n contains n0 or they are coreferential.
                            # Therefore, n contains n1.
                            reason1 = reason + ' and' + temporal.reason(n, r['node0'])
                            temporal.add_relation(r['node1'], ':contains', n, r['line0'], reason1)
                            temporal.add_relation(n, ':contained', r['node1'], r['line0'], reason1)
                        if temporal.is_relation(n, r['node0'], [':before', ':after']):
                            # We already know that n0 contains n1. Now n0 is before/after n.
                            # Therefore, n1 is also before/after n.
                            reason1 = reason + ' and' + temporal.reason(n, r['node0'])
                            relation_n_n1 = temporal.relation(n, r['node0'])
                            relation_n1_n = ':before' if relation_n_n1 == ':after' else ':after'
                            temporal.add_relation(n, relation_n_n1, r['node1'], r['line0'], reason1)
                            temporal.add_relation(r['node1'], relation_n1_n, n, r['line0'], reason1)
                elif r['relation'] == ':overlap':
                    temporal.add_relation(r['node1'], ':overlap', r['node0'], r['line0'], reason)
                # Markéta maintains that the guidelines require :depends-on in certain situations.
                #elif r['relation'] == ':depends-on':
                #    testlevel = 3
                #    testclass = 'Document'
                #    testid = 'temporal-depends-on'
                #    testmessage = "The temporal relation ':depends-on' could probably be replaced by more specific ':before', ':after', ':contained' or ':overlap'."
                #    warn(testmessage, testclass, testlevel, testid, r['line0'])
    # We are not interested in nodes that have only identity relations to other nodes.
    # They are probably neither time expressions nor events; they just got here from the coreference graph.
    temporal.remove_identity_only_nodes()
    # We may want to see the time line with the temporal relations.
    if args.print_temporal:
        temporal.print_timeline()

#==============================================================================
class Temporal:
    def __init__(self, document, node_dict):
        self.document = document
        self.node_dict = node_dict
        self.graph = {}

    def __str__(self):
        result = ''
        for i in self.nodes():
            result += "%s -->\n" % debugnode(i, self.node_dict)
            childrelations = []
            for j in self.children(i):
                childrelations.append("    %s --> %s\n" % (self.relation(i, j), debugnode(j, self.node_dict)))
            childrelations.sort()
            result += ''.join(childrelations)
        return result

    def nodes(self):
        return sorted(list(self.graph))

    def children(self, node):
        if node in self.graph:
            return sorted(list(self.graph[node]))
        else:
            return []

    def add_relation(self, n0, r, n1, line0, reason):
        """
        Adds a temporal relation to the graph. Reports an error if there already
        is a conflicting relation between the same nodes.
        """
        if n0 in self.graph and n1 in self.graph[n0]:
            # If the relation matches, do nothing. Keep the previous line0 of the temporal relation.
            if self.graph[n0][n1]['relation'] != r:
                testlevel = 3
                testclass = 'Document'
                testid = 'temporal-mismatch'
                testmessage = "Older temporal relation '%s %s %s' collides with newly inferred '%s'. Reason for older: %s" % (n0, self.graph[n0][n1]['relation'], n1, r, self.graph[n0][n1]['reason'])
                warn(testmessage, testclass, testlevel, testid, line0)
        else:
            if not n0 in self.graph:
                self.graph[n0] = {}
            if not n1 in self.graph[n0]:
                self.graph[n0][n1] = {}
            self.graph[n0][n1]['relation'] = r
            self.graph[n0][n1]['reason'] = reason

    def relation(self, n0, n1):
        if n0 in self.graph and n1 in self.graph[n0]:
            return self.graph[n0][n1]['relation']
        else:
            return None

    def reason(self, n0, n1):
        if n0 in self.graph and n1 in self.graph[n0]:
            return self.graph[n0][n1]['reason']
        else:
            return None

    def is_relation(self, n0, n1, relation_list):
        """
        Finds out whether there is relation between nodes n0 and n1 of a type in
        the given list.
        """
        return n0 in self.graph and n1 in self.graph[n0] and self.graph[n0][n1]['relation'] in relation_list

    def remove_identity_only_nodes(self):
        """
        The document's temporal graph may contain nodes that are neither temporal
        expressions nor events. They are inherited from the coreference graph and
        they have only :identity relations, nothing else. This function will remove
        them.
        """
        nodes = list(self.graph)
        ionly = [x for x in nodes if not any([True for y in self.graph[x] if self.graph[x][y]['relation'] != ':identity'])]
        for node in ionly:
            del self.graph[node]

    def print_timeline(self):
        """
        Partially orders the temporal nodes following their before-after relations.
        Prints them together with debugging information.
        """
        print("Document temporal graph:\n")
        print(self)
        print("Document time line:")
        nodes = sorted(list(self.graph))
        self.already_printed = []
        for node in nodes:
            if not node in self.already_printed:
                component = self.component(node)
                if component:
                    #print("\nNode %s => component" % node, component)
                    while True:
                        # Find next node to print.
                        # It must be one of those that have not been printed yet.
                        # We should also be able to find one that has a relation to one of the already printed nodes.
                        candidates = [x for x in component if not x in self.already_printed and self.find_relation_to_already_printed(x)]
                        if not candidates:
                            candidates = [x for x in component if not x in self.already_printed]
                            if not candidates:
                                break
                        self.print_identity_cluster(self.minimal_node(candidates))

    def component(self, node):
        """
        For a given node, gets a component of the temporal graph where nodes are
        reachable from the initial node via a sequence of 'interesting' relations
        (before, after, identity, contained, contains). Note that this does not
        necessarily mean that all have a direct relation to the initial node, as
        the :contains relation carries over before/after from larger to smaller
        but not from smaller to larger.
        """
        queue = [node]
        component = {}
        while queue:
            x = queue.pop(0)
            if not x in component:
                component[x] = True
                for y in self.children(x):
                    if not y in component and self.graph[x][y]['relation'] in [':before', ':after', ':identity', ':contained', ':contains']:
                        queue.append(y)
        return sorted_temporal(self, list(component))

    def minimal_node(self, nodes):
        """
        Takes a list of nodes (a subset of the nodes in the graph).
        Finds the node that is after as little nodes as possible (in the whole
        graph, not just in this list; if the list contains all nodes of the
        graph, we can find at least one node that is not after any other node)
        and is before as many nodes as possible. For the purpose of ordering,
        :contained counts as :after and :contains counts as :before.
        As the nodes are only partially ordered, there may be multiple minimal
        nodes; in such a case it returns the one whose id is alphabetically
        minimal.
        """
        info = []
        for node in nodes:
            naft = len([x for x in self.graph if self.is_relation(x, node, [':after', ':contained'])])
            nbef = len([x for x in self.graph if self.is_relation(x, node, [':before', ':contains'])])
            info.append((naft, -nbef, node))
        info.sort()
        # The input list should be non-empty. Otherwise an exception will be thrown now.
        return info[0][2]

    def print_identity_cluster(self, node):
        nodes = sorted([node] + [x for x in self.graph if self.is_relation(node, x, [':identity'])])
        for node in nodes:
            self.print_node(node)

    def print_node(self, node):
        if not node in self.already_printed:
            relation_parent = self.already_printed[-1] if self.already_printed else None
            relation = ':norel'
            rpr = self.find_relation_to_already_printed(node)
            if rpr:
                relation_parent = rpr[0]
                relation = rpr[1]
            if relation == ':norel':
                print()
                rpr = self.find_relation_to_already_printed(node, allow_overlap=True)
                if rpr:
                    relation_parent = rpr[0]
                    relation = rpr[1]
            print("%s %s %s" % (debugnode(relation_parent, self.node_dict), relation, debugnode(node, self.node_dict)))
            self.already_printed.append(node)

    def find_relation_to_already_printed(self, node, allow_overlap=False):
        previous_nodes = self.already_printed.copy()
        while previous_nodes:
            pnode = previous_nodes.pop()
            if pnode and pnode in self.graph and node in self.graph[pnode] and (self.graph[pnode][node]['relation'] != ':overlap' or allow_overlap):
                relation_parent = pnode
                relation = self.graph[pnode][node]['relation']
                return (relation_parent, relation)
        return None

def sorted_temporal(temporal, nodes):
    """
    Takes the list of nodes from the document's temporal graph and tries to
    order them according to the temporal relations where they exist.
    (The output is only partially predictable because relations between some
    nodes may be missing.)
    """
    nodes_with_graph = [(x, temporal) for x in nodes]
    compare_key = cmp_to_key(compare_temporal)
    return [x[0] for x in sorted(nodes_with_graph, key=compare_key)]

def compare_temporal(node1, node2):
    temporal = node1[1]
    if temporal.is_relation(node1[0], node2[0], [':before', ':contains']):
        # node2 is before node 1
        # node2 contains node1
        # node1 > node2
        return 1
    elif temporal.is_relation(node1[0], node2[0], [':after', ':contained']):
        # node2 is after node 1
        # node2 is contained in node 1
        # node1 < node2
        return -1
    else:
        # It could be identity.
        # But it could be also incomparable situations: overlap or no relation at all.
        return 0



#==============================================================================
# Main part.
#==============================================================================

def validate(inp, out, args, known_sent_ids):
    global sentence_line, sentence_id
    # Dictionary of all concept nodes in the document.
    node_dict = {}
    # Collected data of the whole document.
    document = {'sentences': []}
    for sentence in sentences(inp, args):
        # If fundamental errors were found already in sentences(), the function
        # will skip the current sentence and go to the next one. So if we are
        # here, we have a sentence with the expected set of annotation blocks
        # and with lines that at least superficially look acceptable.
        # But let's do a sanity check anyway:
        if len(sentence)<4:
            testlevel = 0
            testclass = 'Internal'
            testid = 'invalid-sentence'
            testmessage = "Skipping further tests of sentence with less than 4 annotation blocks."
            warn(testmessage, testclass, testlevel, testid)
            continue
        if args.level > 1:
            validate_sentence_metadata(sentence, known_sent_ids, args) # level 2?
            validate_sentence_graph(sentence, node_dict, args)
            validate_alignment(sentence, node_dict, args)
            validate_document_level(sentence, node_dict, args)
        if args.level > 2:
            validate_abstract_concept_NEs(sentence, node_dict, args)
            validate_relations(sentence, node_dict, args)
            validate_name(sentence, node_dict, args)
            validate_wiki(sentence, node_dict, args)
            detect_events(sentence, node_dict, args)
            if args.check_aspect_modstr:
                validate_events(sentence, node_dict, args)
            validate_document_relations(sentence, node_dict, args)
        # Remember the sentence for further document-level tests.
        document['sentences'].append(sentence)
        # Before we read the next sentence, clear the current sentence variables
        # so that sentences() knows they should be reset to new values.
        sentence_line = None
        sentence_id = None
    # After we have read the input, we can ask about the line breaks observed.
    validate_newlines(inp) # level 1
    # Document-level tests.
    collect_coreference_clusters(document, node_dict, args)
    build_temporal_graph(document, node_dict, args)

if __name__=="__main__":
    opt_parser = argparse.ArgumentParser(description="UMR validation script. Python 3 is needed to run it! Optionally, if the 'requests' library is installed (try 'pip install requests'), some functions can show Wikidata labels together with Q-codes.")

    io_group = opt_parser.add_argument_group('Input / output options')
    io_group.add_argument('--quiet', dest="quiet", action="store_true", default=False, help='Do not print any error messages. Exit with 0 on pass, non-zero on fail.')
    io_group.add_argument('--max-err', action="store", type=int, default=1000, help='How many errors to output before exiting? 0 for all. Default: %(default)d.')
    io_group.add_argument('input', nargs='*', help='Input file name(s), or "-" or nothing for standard input.')

    list_group = opt_parser.add_argument_group('Label sets', 'Options relevant to checking label sets.')
    list_group.add_argument('--lang', action="store", default=None, help="Which langauge are we checking? If you specify this (as a two-letter code), the validator will use language-specific guidelines.")
    list_group.add_argument('--level', action="store", type=int, default=5, dest="level", help="Level 1: Test only the technical format backbone. Level 2: UMR format. Level 3: UMR contents. Level 4: Language-specific labels. Level 5: Language-specific contents.")

    strict_group = opt_parser.add_argument_group('Strictness', 'Options for relaxing selected tests.')
    strict_group.add_argument('--allow-inline-comments', dest='inline_comments', action='store_true', default=False, help='Allow comments anywhere, not just at the beginning of a block. Everything from # to end of line will be ignored. This option also implies --allow-trailing-whitespace.')
    strict_group.add_argument('--allow-trailing-whitespace', dest='check_trailing_whitespace', action='store_false', default=True, help='Do not report trailing whitespace.')
    strict_group.add_argument('--allow-wide-space', dest='check_wide_space', action='store_false', default=True, help='Do not report multiple spaces between tokens, treat them as a single space.')
    strict_group.add_argument('--allow-forward-references', dest='check_forward_references', action='store_false', default=True, help='Do not report forward node references within a sentence level graph.')
    strict_group.add_argument('--allow--1', dest='check_nonnegative_alignment', action='store_false', default=True, help='Do not report alignment -1--1. Unaligned nodes normally get the pseudo-alignment 0-0 but in UMR 1.0 some of them have -1--1.')
    strict_group.add_argument('--optional-block-headers', dest='check_block_headers', action='store_false', default=True, help='Do not report missing or unknown header comments for annotation blocks.')
    strict_group.add_argument('--optional-alignments', dest='check_complete_alignment', action='store_false', default=True, help='Do not require that every node has its alignment specified.')
    strict_group.add_argument('--warn-overlapping-alignment', dest='check_overlapping_alignment', action='store_true', default=False, help='Report words that are aligned to more than one node. This is a warning only, and it is turned off by default.')
    strict_group.add_argument('--no-warn-unaligned-token', dest='check_unaligned_token', action='store_false', default=True, help='Report words that are not aligned to any node. This is a warning only, and it is turned on by default.')
    strict_group.add_argument('--optional-aspect-modstr', dest='check_aspect_modstr', action='store_false', default=True, help='Do not require that every eventive concept has :aspect and :modstr.')
    strict_group.add_argument('--allow-non-q-wiki', dest='check_non_q_wiki',
                              action='store_false', default=True,
                              help='Do not require that :wiki be a Q-number.')
    strict_group.add_argument('--allow-non-string-wiki',
                              dest='check_string_wiki',
                              action='store_false',
                              default=True,
                              help='Do not require that :wiki be a string attribute.')
    strict_group.add_argument(
        '--allow-extra-empty-lines',
        dest='check_extra_empty_line',
        action='store_false',
        default=True,
        help='Do not report extra/spurious empty lines.'
    )

    report_group = opt_parser.add_argument_group('Reports', 'Options for printing additional reports about the data.')
    report_group.add_argument('--print-relations', dest='print_relations', action='store_true', default=False, help='Print detailed info about all nodes and relations.')
    report_group.add_argument('--print-clusters', dest='print_clusters', action='store_true', default=False, help='Print detailed info about coreference clusters (entities).')
    report_group.add_argument('--print-temporal', dest='print_temporal', action='store_true', default=False, help='Print detailed info about temporal relations.')

    args = opt_parser.parse_args() # Parsed command-line arguments
    error_counter={} # Incremented by warn()  {key: error type value: its count}

    # Level of validation
    if args.level < 1:
        print('Option --level must not be less than 1; changing from %d to 1' % args.level, file=sys.stderr)
        args.level = 1

    out = sys.stdout # Does this ever need to be anything else?

    try:
        known_sent_ids = set()
        open_files = []
        if args.input == []:
            args.input.append('-')
        for fname in args.input:
            if fname == '-':
                # Set PYTHONIOENCODING=utf-8 before starting Python. See https://docs.python.org/3/using/cmdline.html#envvar-PYTHONIOENCODING
                # Otherwise ANSI will be read in Windows and locale-dependent encoding will be used elsewhere.
                open_files.append(sys.stdin)
            else:
                open_files.append(io.open(fname, 'r', encoding='utf-8'))
        for curr_fname, inp in zip(args.input, open_files):
            validate(inp, out, args, known_sent_ids)
    except:
        warn('Exception caught!', 'Internal', 0, 'internal-error')
        # If the output is used in an HTML page, it must be properly escaped
        # because the traceback can contain e.g. "<module>". However, escaping
        # is beyond the goal of validation, which can be also run in a console.
        traceback.print_exc()
    # Summarize the warnings and errors.
    passed = True
    nerror = 0
    if error_counter:
        for k, v in sorted(error_counter.items()):
            if k == 'Warning':
                errors = 'Warnings'
            else:
                errors = k+' errors'
                nerror += v
                passed = False
            if not args.quiet:
                print('%s: %d' % (errors, v), file=sys.stderr)
    # Print the final verdict and exit.
    if passed:
        if not args.quiet:
            print('*** PASSED ***', file=sys.stderr)
        sys.exit(0)
    else:
        if not args.quiet:
            print('*** FAILED *** with %d errors' % nerror, file=sys.stderr)
        for f_name in sorted(warn_on_missing_files):
            filepath = os.path.join(THISDIR, 'data', f_name+'.'+args.lang)
            if not os.path.exists(filepath):
                print('The language-specific file %s does not exist.' % filepath, file=sys.stderr)
        sys.exit(1)
