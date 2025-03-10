from collections import defaultdict
from typing import List, Dict, Tuple, Optional
import logging
import re

logger = logging.getLogger(__name__)

def parse_alignment_string(align_str: str) -> Dict[str, List[str]]:
    """
    Parse the alignment section from UMR annotation.
    
    This converts an alignment string like:
        s64x1: 1-1
        s64x2: 2-2
        s64x20: 0-0
    into a dict, e.g.:
        {
          's64x1': ['1-1'],
          's64x2': ['2-2'],
          's64x20': ['0-0']
        }
    
    Args:
        align_str (str): The alignment section as a string
        
    Returns:
        Dict[str, List[str]]: A dictionary mapping variable IDs to their token alignments
    """
    align_dict = defaultdict(list)
    
    # Strip leading/trailing whitespace and split lines
    lines = align_str.strip().splitlines()
    for line in lines:
        line = line.strip()
        # Skip blank lines (if any)
        if not line:
            continue
        
        # Split on the first ":", e.g. "s64x1: 1-1"
        try:
            variable, token_alignment = line.split(":", 1)
            variable = variable.strip()
            token_alignment = token_alignment.strip()
            
            # Each variable can have multiple spans separated by commas, e.g. "4-4, 6-6"
            spans = token_alignment.split(",")
            for span_str in spans:
                span_str = span_str.strip()
                align_dict[variable].append(span_str)
        except ValueError:
            logger.warning(f"Malformed alignment line: {line}")
            continue

    return dict(align_dict)

def parse_umr_file(content_string: str) -> Tuple[
    str,               # original content
    List[List[str]],   # sentences (tokenized)
    List[str],         # sentence annotations
    List[str],         # document annotations
    List[Dict[str, List[str]]]  # alignments
]:
    """
    Parse a UMR format file and extract sentences and annotations.
    
    Args:
        content_string (str): The content of the UMR file
        
    Returns:
        Tuple containing:
            - original_content (str): The original file content
            - sentences (List[List[str]]): List of tokenized sentences
            - sent_annotations (List[str]): List of sentence-level annotations
            - doc_annotations (List[str]): List of document-level annotations
            - alignments (List[Dict[str, List[str]]]): List of alignment dictionaries
    """
    logger.info("Starting to parse UMR file")
    sentences = []
    sent_annotations = []
    doc_annotations = []
    alignments = []
    
    # State tracking variables
    current_sentence: Optional[List[str]] = None
    current_sent_annot: List[str] = []
    current_doc_annot: List[str] = []
    current_alignment: List[str] = []
    in_sent_annot = False
    in_doc_annot = False
    in_alignment = False
    
    lines = content_string.split('\n')
    logger.info(f"File has {len(lines)} lines")
    
    section_count = 0
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Section separator - marks the beginning of a new sentence section
        if line.startswith('####'):
            logger.info(f"Found section separator at line {i}")
            section_count += 1
            
            # Process collected annotations before moving to next section
            if current_sent_annot:
                annot = '\n'.join(current_sent_annot).rstrip()
                if annot:
                    sent_annotations.append(annot)
                current_sent_annot = []
                
            if current_doc_annot:
                annot = '\n'.join(current_doc_annot).rstrip()
                if annot:
                    doc_annotations.append(annot)
                current_doc_annot = []
            
            if current_alignment:
                align = '\n'.join(current_alignment).rstrip()
                if align:
                    align_dict = parse_alignment_string(align)
                    alignments.append(align_dict)
                else:
                    alignments.append({})
                current_alignment = []
            
            # Reset state for next section
            current_sentence = None
            in_sent_annot = False
            in_doc_annot = False
            in_alignment = False
            
            i += 1
            continue
        
        # Skip empty lines
        if not line:
            i += 1
            continue
        
        # Skip meta-info and Index lines
        if line.startswith('# meta-info') or line.startswith('Index:'):
            i += 1
            continue
        
        # Extract sentence from "# :: snt" lines - only if it has actual content
        if line.startswith('# :: snt'):
            try:
                # Extract the text after the prefix
                if '\t' in line:
                    sent_text = line.split('\t', 1)[1].strip()
                else:
                    sent_text = line[len('# :: snt'):].strip()
                
                # Check if the sentence is just a number (like "snt64") or actually contains text
                # Skip if it's just a sentence number or empty
                if not sent_text or sent_text.isdigit() or re.match(r'^\d+$', sent_text):
                    logger.debug(f"Skipping sentence identifier: {line}")
                else:
                    # Tokenize the sentence with punctuation handling
                    words = []
                    for word in sent_text.split():
                        if word and word[-1] in ',.!?:;':
                            if len(word) > 1:
                                words.extend([word[:-1], word[-1]])
                            else:
                                words.append(word)
                        else:
                            words.append(word)
                    
                    if words:
                        sentences.append(words)
                        current_sentence = words
                        logger.info(f"Extracted sentence: {' '.join(words[:10])}...")
            except Exception as e:
                logger.error(f"Error parsing # :: snt line: {str(e)}")
            
            i += 1
            continue
        
        # Extract words from "Words:" line - this is more reliable for our sample file
        if line.startswith('Words:'):
            try:
                # Extract text after "Words:" 
                if '\t' in line:
                    words_text = line.split('\t', 1)[1].strip()
                else:
                    words_text = line[len('Words:'):].strip()
                
                # Split by whitespace to get words
                word_list = re.findall(r'\S+', words_text)
                
                # Filter out pure digits (likely indices) and empty strings
                # For Chinese text, we want to keep numbers as they could be part of the content
                actual_words = [word for word in word_list if word and not word.isspace()]
                
                # Use these words as the sentence
                if actual_words:
                    sentences.append(actual_words)
                    current_sentence = actual_words
                    logger.info(f"Extracted {len(actual_words)} words from Words line")
            except Exception as e:
                logger.error(f"Error extracting words: {str(e)}")
            
            i += 1
            continue
        
        # Detect annotation sections
        if line.startswith('# sentence level graph:'):
            in_sent_annot = True
            in_doc_annot = False
            in_alignment = False
            current_sent_annot = []
            i += 1
            continue
        
        elif line.startswith('# alignment:'):
            in_alignment = True
            in_sent_annot = False
            in_doc_annot = False
            current_alignment = []
            i += 1
            continue
        
        elif line.startswith('# document level annotation:'):
            in_doc_annot = True
            in_sent_annot = False
            in_alignment = False
            current_doc_annot = []
            i += 1
            continue
        
        # Collect the actual annotation content
        if in_sent_annot and not line.startswith('#'):
            current_sent_annot.append(lines[i])  # Preserve original indentation
        elif in_doc_annot and not line.startswith('#'):
            current_doc_annot.append(lines[i])  # Preserve original indentation
        elif in_alignment and not line.startswith('#'):
            current_alignment.append(lines[i])  # Preserve original indentation
        
        i += 1
    
    # Process any remaining annotations at the end of the file
    if current_sent_annot:
        annot = '\n'.join(current_sent_annot).rstrip()
        if annot:
            sent_annotations.append(annot)
    
    if current_doc_annot:
        annot = '\n'.join(current_doc_annot).rstrip()
        if annot:
            doc_annotations.append(annot)
    
    if current_alignment:
        align = '\n'.join(current_alignment).rstrip()
        if align:
            align_dict = parse_alignment_string(align)
            alignments.append(align_dict)
        else:
            alignments.append({})
    
    # Ensure all lists have matching lengths
    max_length = max(len(sentences), len(sent_annotations), len(doc_annotations), len(alignments))
    
    # Pad lists with empty values if needed
    while len(sentences) < max_length:
        sentences.append([])
    while len(sent_annotations) < max_length:
        sent_annotations.append("")
    while len(doc_annotations) < max_length:
        doc_annotations.append("")
    while len(alignments) < max_length:
        alignments.append({})
    
    logger.info(f"Finished parsing UMR file:")
    logger.info(f"  - Found {len(sentences)} sentences")
    logger.info(f"  - Found {len(sent_annotations)} sentence annotations")
    logger.info(f"  - Found {len(doc_annotations)} document annotations")
    logger.info(f"  - Found {len(alignments)} alignments")
    
    return content_string, sentences, sent_annotations, doc_annotations, alignments
