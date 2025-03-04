from collections import defaultdict
from typing import List, Dict, Tuple

def parse_alignment_string(align_str: str) -> Dict[str, List[str]]:
    """
    Convert something like:
        s28k: 6-6
        s28c: 9-9
        s28p: 4-4, 6-6
    into a dict, e.g.:
        {
          's28k': ['6-6'],
          's28c': ['9-9'],
          's28p': ['4-4', '6-6']
        }
    """
    align_dict = defaultdict(list)
    
    # Strip leading/trailing whitespace and split lines
    lines = align_str.strip().splitlines()
    for line in lines:
        line = line.strip()
        # Skip blank lines (if any)
        if not line:
            continue
        
        # Split on the first ":", e.g. "s28k: 6-6"
        variable, token_alignment = line.split(":", 1)
        variable = variable.strip()
        token_alignment = token_alignment.strip()
        
        # Each variable can have multiple spans separated by commas, e.g. "4-4, 6-6"
        spans = token_alignment.split(",")
        for span_str in spans:
            span_str = span_str.strip()
            align_dict[variable].append(span_str)

    return dict(align_dict)

def parse_umr_file(content_string: str) -> Tuple[
    List[List[str]],  # sentences
    List[str],        # sent_annotations
    List[str],        # doc_annotations
    List[Dict[str, List[str]]]  # alignments
]:
    """
    Parse a UMR format file and extract sentences and annotations.
    
    Args:
        content_string (str): The content of the UMR file
        
    Returns:
        (sentences, sent_annotations, doc_annotations, alignments):
            - sentences: List of tokenized sentences (each sentence is a list of words)
            - sent_annotations: List of sentence-level annotations (raw text blocks)
            - doc_annotations: List of document-level annotations (raw text blocks)
            - alignments: List of alignment dicts (parsed from alignment strings)
    """
    sentences = []
    sent_annotations = []
    doc_annotations = []
    alignments = []
    
    # State tracking
    current_sent = None
    current_sent_annot = []
    current_doc_annot = []
    current_alignment = []
    in_sent_annot = False
    in_doc_annot = False
    in_alignment = False
    
    lines = content_string.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines and section separators
        if not line or line.startswith('####'):
            # Reset states and save current annotations when hitting section separators
            if current_sent_annot and not in_sent_annot:
                annot = '\n'.join(current_sent_annot).rstrip()
                if annot:  # Only add non-empty annotations
                    sent_annotations.append(annot)
                current_sent_annot = []
            if current_doc_annot and not in_doc_annot:
                annot = '\n'.join(current_doc_annot).rstrip()
                if annot:  # Only add non-empty annotations
                    doc_annotations.append(annot)
                current_doc_annot = []
            
            # ------------- MODIFIED BLOCK HERE -------------
            if current_alignment and not in_alignment:
                align = '\n'.join(current_alignment).rstrip()
                if align:
                    # Parse the alignment string into a dict
                    align_dict = parse_alignment_string(align)
                    alignments.append(align_dict)
                else:
                    alignments.append({})
                current_alignment = []
            # ----------------------------------------------
            
            i += 1
            continue
            
        # Parse sentence
        if line.startswith('# :: snt'):
            # Extract just the sentence text after the tab
            current_sent = line.split('\t', 1)[1].strip()
            # Split into words, handling punctuation
            words = []
            for word in current_sent.split():
                # If word ends with punctuation, split it
                if word and word[-1] in ',.!?:;':
                    if len(word) > 1:  # Don't split single-character punctuation
                        words.extend([word[:-1], word[-1]])
                    else:
                        words.append(word)
                else:
                    words.append(word)
            sentences.append(words)
            i += 1
            continue
            
        # Track sentence-level annotations
        if line.startswith('# sentence level graph:'):
            in_sent_annot = True
            in_doc_annot = False
            in_alignment = False
            current_sent_annot = []  # reset current annotation
            i += 1
            continue
            
        # Track alignments
        elif line.startswith('# alignment:'):
            in_alignment = True
            in_sent_annot = False
            in_doc_annot = False
            current_alignment = []  # reset current alignment
            i += 1
            continue
            
        # Track document-level annotations
        elif line.startswith('# document level annotation:'):
            in_doc_annot = True
            in_sent_annot = False
            in_alignment = False
            current_doc_annot = []  # reset current annotation
            i += 1
            continue
        elif in_doc_annot and (
            line.startswith('# meta-info') or
            line.startswith('Index:') or
            line.startswith('Words:')
        ):
            in_doc_annot = False
            if current_doc_annot:
                annot = '\n'.join(current_doc_annot).rstrip()
                if annot:
                    doc_annotations.append(annot)
                current_doc_annot = []
            i += 1
            continue
            
        # Collect annotation lines
        if in_sent_annot and not line.startswith('#'):
            if line:  # Only add non-empty lines
                current_sent_annot.append(lines[i])  # Use original line to preserve indentation
        elif in_doc_annot and not line.startswith('#'):
            if line:  # Only add non-empty lines
                current_doc_annot.append(lines[i])  # Use original line to preserve indentation
        elif in_alignment and not line.startswith('#'):
            if line:  # Only add non-empty lines
                current_alignment.append(lines[i])  # Use original line to preserve indentation
        
        i += 1
    
    # Handle any remaining annotations at the end of the file
    if current_sent_annot:
        annot = '\n'.join(current_sent_annot).rstrip()
        if annot:
            sent_annotations.append(annot)
        else:
            sent_annotations.append("")
    if current_doc_annot:
        annot = '\n'.join(current_doc_annot).rstrip()
        if annot:
            doc_annotations.append(annot)
        else:
            doc_annotations.append("")
    
    if current_alignment:
        align = '\n'.join(current_alignment).rstrip()
        if align:
            # parse alignment at end of file
            align_dict = parse_alignment_string(align)
            alignments.append(align_dict)
        else:
            alignments.append({})
        current_alignment = []
    
    # the lengths of sentences, sent_annotations, doc_annotations, alignments should be the same
    if (
        len(sentences) != len(sent_annotations) or
        len(sentences) != len(doc_annotations) or
        len(sentences) != len(alignments)
    ):
        raise ValueError(
            "The length of sentences, sent_annotations, doc_annotations, "
            "and alignments should all be the same."
        )
    
    return sentences, sent_annotations, doc_annotations, alignments
