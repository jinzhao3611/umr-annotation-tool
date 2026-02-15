"""Modal Converter Module

Converts sentence-level modal annotations to document-level modal dependency structures.

Rules based on "UMR Simplified Modal Annotation to Modal Dependency Structure":
1. Bare :modal-strength -> (root :modal author), (author :<modstr> <event>)
2. :modal-predicate -> nested conceiver structure
3. :quote -> speech/quotation structure
4. :purpose -> purpose structure with partial-affirmative
5. :condition -> condition structure with neutral-affirmative
6. Scoping combos -> nested combinations of above
"""

import penman
import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


@dataclass
class ModalTriple:
    """A document-level modal triple."""
    source: str
    relation: str
    target: str
    auto_generated: bool = True


@dataclass
class SentenceModalInfo:
    """Extracted modal information from one sentence's annotation."""
    sent_index: int
    modal_strengths: Dict[str, str] = field(default_factory=dict)
    modal_predicates: Dict[str, str] = field(default_factory=dict)
    quotes: Dict[str, str] = field(default_factory=dict)
    purposes: Dict[str, str] = field(default_factory=dict)
    conditions: Dict[str, str] = field(default_factory=dict)
    participant_roles: Dict[str, List[Tuple[str, str]]] = field(default_factory=dict)
    concepts: Dict[str, str] = field(default_factory=dict)


def parse_sentence_annotation(penman_str, sent_index):
    """
    Parse a sentence-level Penman annotation to extract modal-relevant information.

    Args:
        penman_str: The Penman string for the sentence annotation
        sent_index: 1-based sentence index

    Returns:
        SentenceModalInfo with extracted modal data
    """
    info = SentenceModalInfo(sent_index=sent_index)

    if not penman_str or not penman_str.strip() or penman_str.strip() == '()':
        return info

    try:
        graph = penman.decode(penman_str)
    except Exception:
        return info

    # Extract concept instances
    for inst in graph.instances():
        info.concepts[inst.source] = inst.target

    # Extract all relevant triples
    for source, role, target in graph.triples:
        if role == ':instance':
            continue

        if role == ':modal-strength':
            info.modal_strengths[source] = target
        elif role == ':modal-predicate':
            info.modal_predicates[source] = target
        elif role == ':quote':
            info.quotes[source] = target
        elif role == ':purpose':
            info.purposes[source] = target
        elif role == ':condition':
            info.conditions[source] = target
        elif role in (':ARG0', ':actor', ':experiencer', ':causer'):
            if source not in info.participant_roles:
                info.participant_roles[source] = []
            info.participant_roles[source].append((role, target))

    return info


def find_conceiver(info, verb_var, role_preference=None):
    """
    Find the conceiver (agent/experiencer) of a verb.

    Looks for participant roles on the given verb variable,
    preferring :ARG0 > :actor > :experiencer > :causer.

    Args:
        info: SentenceModalInfo
        verb_var: The variable of the verb to find conceiver for
        role_preference: Optional custom role preference list

    Returns:
        The conceiver variable, or None if not found
    """
    if role_preference is None:
        role_preference = [':ARG0', ':actor', ':experiencer', ':causer']

    roles = info.participant_roles.get(verb_var, [])

    # Try preferred roles in order
    for pref_role in role_preference:
        for role, agent in roles:
            if role == pref_role:
                return agent

    # Fallback: return first available role
    if roles:
        return roles[0][1]

    return None


def convert_modstr_to_relation(value):
    """
    Map a modal-strength annotation value to a document-level relation name.

    Args:
        value: The modal-strength value (e.g., "full-affirmative", "Aff")

    Returns:
        The relation string with colon prefix (e.g., ":full-affirmative")
    """
    if not value:
        return ':unspecified'

    # Normalize: remove quotes, strip whitespace
    value = value.strip().strip('"').strip("'")

    # Direct match (case-insensitive)
    value_lower = value.lower().replace('_', '-')

    known_relations = {
        'full-affirmative', 'partial-affirmative', 'neutral-affirmative',
        'strong-partial-affirmative', 'weak-partial-affirmative',
        'strong-neutral-affirmative', 'weak-neutral-affirmative',
        'full-negative', 'partial-negative', 'neutral-negative',
        'strong-partial-negative', 'weak-partial-negative',
        'strong-neutral-negative', 'weak-neutral-negative',
        'unspecified'
    }

    if value_lower in known_relations:
        return f':{value_lower}'

    # Abbreviation mapping (from PDF)
    abbreviations = {
        'aff': ':full-affirmative',
        'fullaff': ':full-affirmative',
        'prt': ':partial-affirmative',
        'prtaff': ':partial-affirmative',
        'neut': ':neutral-affirmative',
        'neutaff': ':neutral-affirmative',
        'neg': ':full-negative',
        'fullneg': ':full-negative',
        'prtneg': ':partial-negative',
        'neutneg': ':neutral-negative',
        'unsp': ':unspecified',
        'strong-prtaff': ':strong-partial-affirmative',
        'weak-prtaff': ':weak-partial-affirmative',
        'strong-neutaff': ':strong-neutral-affirmative',
        'weak-neutaff': ':weak-neutral-affirmative',
        'strong-prtneg': ':strong-partial-negative',
        'weak-prtneg': ':weak-partial-negative',
        'strong-neutneg': ':strong-neutral-negative',
        'weak-neutneg': ':weak-neutral-negative',
    }

    if value_lower in abbreviations:
        return abbreviations[value_lower]

    # Try removing hyphens for looser matching
    no_hyphen = value_lower.replace('-', '')
    if no_hyphen in abbreviations:
        return abbreviations[no_hyphen]

    return ':unspecified'


def generate_modal_triples_for_sentence(info):
    """
    Generate document-level modal triples from one sentence's modal information.
    Applies conversion rules 1-6 from the UMR modal annotation guidelines.

    Args:
        info: SentenceModalInfo extracted from the sentence

    Returns:
        List of ModalTriple objects
    """
    triples = []
    handled_events = set()  # Track events handled by specific rules (2-5)

    # --- Rule 2: :modal-predicate ---
    # E has :modal-predicate M, where E is the modal verb and M is the embedded event
    # Conceiver is the ARG0/actor/experiencer of E
    for e_var, m_var in info.modal_predicates.items():
        handled_events.add(e_var)
        handled_events.add(m_var)

        conceiver = find_conceiver(info, e_var)
        e_modstr = convert_modstr_to_relation(info.modal_strengths.get(e_var))

        triples.append(ModalTriple('root', ':modal', 'author'))
        if conceiver:
            triples.append(ModalTriple('author', e_modstr, conceiver))
            triples.append(ModalTriple(conceiver, ':full-affirmative', m_var))
            triples.append(ModalTriple(m_var, ':unspecified', e_var))
        else:
            # No conceiver found, simpler structure
            triples.append(ModalTriple('author', e_modstr, e_var))
            m_modstr = convert_modstr_to_relation(info.modal_strengths.get(m_var))
            triples.append(ModalTriple('author', m_modstr, m_var))

    # --- Rule 3: :quote ---
    # E has :quote S, where E is the quoted content and S is the speech event
    # Conceiver is the ARG0/actor of the speech event S (the speaker)
    for e_var, s_var in info.quotes.items():
        handled_events.add(e_var)
        handled_events.add(s_var)

        conceiver = find_conceiver(info, s_var)
        s_modstr = convert_modstr_to_relation(info.modal_strengths.get(s_var))
        e_modstr = convert_modstr_to_relation(info.modal_strengths.get(e_var))

        triples.append(ModalTriple('root', ':modal', 'author'))
        triples.append(ModalTriple('author', s_modstr, s_var))
        if conceiver:
            triples.append(ModalTriple('author', s_modstr, conceiver))
            triples.append(ModalTriple(conceiver, e_modstr, e_var))
        else:
            triples.append(ModalTriple('author', e_modstr, e_var))

    # --- Rule 4: :purpose ---
    # M has :purpose E, where M is the main event and E is the purpose event
    for m_var, e_var in info.purposes.items():
        if m_var in handled_events and e_var in handled_events:
            continue
        handled_events.add(m_var)
        handled_events.add(e_var)

        conceiver = find_conceiver(info, m_var)
        m_modstr = convert_modstr_to_relation(info.modal_strengths.get(m_var))
        e_modstr = convert_modstr_to_relation(info.modal_strengths.get(e_var))

        triples.append(ModalTriple('root', ':modal', 'author'))
        triples.append(ModalTriple('author', m_modstr, m_var))
        if conceiver:
            triples.append(ModalTriple('author', e_modstr, conceiver))
            triples.append(ModalTriple(conceiver, ':partial-affirmative', 'purpose'))
            triples.append(ModalTriple('purpose', ':full-affirmative', e_var))
        else:
            triples.append(ModalTriple('author', ':partial-affirmative', 'purpose'))
            triples.append(ModalTriple('purpose', ':full-affirmative', e_var))

    # --- Rule 5: :condition ---
    # M has :condition C
    for m_var, c_var in info.conditions.items():
        if m_var in handled_events and c_var in handled_events:
            continue
        handled_events.add(m_var)
        handled_events.add(c_var)

        c_modstr = convert_modstr_to_relation(info.modal_strengths.get(c_var))
        m_modstr = convert_modstr_to_relation(info.modal_strengths.get(m_var))

        triples.append(ModalTriple('root', ':modal', 'author'))
        triples.append(ModalTriple('author', ':neutral-affirmative', 'have-condition'))
        triples.append(ModalTriple('have-condition', c_modstr, c_var))
        triples.append(ModalTriple('have-condition', m_modstr, m_var))

    # --- Rule 1: Bare :modal-strength ---
    # Events with :modal-strength that weren't handled by rules 2-5
    for var, modstr_val in info.modal_strengths.items():
        if var in handled_events:
            continue

        relation = convert_modstr_to_relation(modstr_val)
        triples.append(ModalTriple('root', ':modal', 'author'))
        triples.append(ModalTriple('author', relation, var))

    return triples


def generate_modal_triples_for_document(all_sent_annotations):
    """
    Generate modal triples for an entire document by processing all sentence annotations.

    Args:
        all_sent_annotations: Dict mapping sentence index strings to Penman annotation strings

    Returns:
        List of deduplicated ModalTriple objects
    """
    all_triples = []

    # Process each sentence in order
    for sent_idx_str, penman_str in sorted(all_sent_annotations.items(),
                                           key=lambda x: int(x[0])):
        sent_idx = int(sent_idx_str)
        info = parse_sentence_annotation(penman_str, sent_idx)
        sent_triples = generate_modal_triples_for_sentence(info)
        all_triples.extend(sent_triples)

    # Deduplicate by (source, relation, target)
    seen = set()
    unique_triples = []
    for triple in all_triples:
        key = (triple.source, triple.relation, triple.target)
        if key not in seen:
            seen.add(key)
            unique_triples.append(triple)

    return unique_triples


def triples_to_json_list(triples):
    """
    Convert a list of ModalTriple objects to a JSON-serializable list of dicts.

    Args:
        triples: List of ModalTriple objects

    Returns:
        List of dicts with source, relation, target, auto_generated keys
    """
    return [
        {
            'source': t.source,
            'relation': t.relation,
            'target': t.target,
            'auto_generated': t.auto_generated
        }
        for t in triples
    ]


def extract_existing_modal_triples(doc_annot_string):
    """
    Parse an existing document-level annotation string to extract modal triples.

    Args:
        doc_annot_string: The existing document annotation string

    Returns:
        List of ModalTriple objects (with auto_generated=False)
    """
    triples = []

    if not doc_annot_string or not doc_annot_string.strip():
        return triples

    # Find the :modal section by tracking parenthesis depth
    modal_start = doc_annot_string.find(':modal')
    if modal_start == -1:
        return triples

    paren_start = doc_annot_string.find('(', modal_start)
    if paren_start == -1:
        return triples

    depth = 0
    modal_content = ''
    for i in range(paren_start, len(doc_annot_string)):
        if doc_annot_string[i] == '(':
            depth += 1
        elif doc_annot_string[i] == ')':
            depth -= 1
            if depth == 0:
                modal_content = doc_annot_string[paren_start + 1:i]
                break

    if not modal_content:
        return triples

    # Extract individual triples: (source relation target)
    triple_pattern = re.compile(r'\((\S+)\s+(:\S+)\s+(\S+)\)')
    for match in triple_pattern.finditer(modal_content):
        source, relation, target = match.group(1), match.group(2), match.group(3)
        triples.append(ModalTriple(
            source=source,
            relation=relation,
            target=target,
            auto_generated=False
        ))

    return triples


def strip_modal_annotations_from_penman(penman_str):
    """
    Remove :modal-strength, :modal-predicate, and :quote annotations from a Penman string.
    Used for the 'doc_only' export mode.

    Args:
        penman_str: The sentence-level Penman string

    Returns:
        The Penman string with modal annotations stripped
    """
    if not penman_str or not penman_str.strip():
        return penman_str

    # Remove :modal-strength lines/values (use [\w-]+ to avoid eating closing parens)
    result = re.sub(r'\s*:modal-strength\s+[\w-]+', '', penman_str)
    # Remove :modal-predicate lines/values
    result = re.sub(r'\s*:modal-predicate\s+[\w]+', '', result)
    # Remove :quote references (only variable references like s1x, not quoted strings)
    result = re.sub(r'\s*:quote\s+s\d+\w+', '', result)

    # Clean up any resulting double newlines
    result = re.sub(r'\n\s*\n', '\n', result)

    return result
