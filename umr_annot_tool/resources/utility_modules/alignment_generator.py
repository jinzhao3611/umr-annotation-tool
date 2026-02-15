"""Interactive alignment generation for the annotation tool.

Ports logic from generate_alignments.py with interactive modifications:
- Unambiguous matches (exactly 1 candidate) are auto-applied
- Ambiguous matches (multiple candidates) are returned for UI disambiguation
- Nodes with existing alignments are skipped
"""

import re
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Dict, List


# Known abstract concepts that don't directly correspond to a token
ABSTRACT_CONCEPTS = {
    'and', 'or', 'name', 'thing', 'person', 'sentence',
    'identity-91', 'percentage-entity', 'distance-quantity',
    'temporal-quantity', 'date-entity', 'ordinal-entity',
    'have-org-role-91', 'have-rel-role-91', 'publication-91',
    'rate-entity-91', 'include-91', 'resemble-91',
    'have-degree-91', 'have-quant-91', 'possible-01',
    'contrast-01', 'cause-01', 'multi-sentence',
    'truth-value', 'string-entity',
}

# Named entity type concepts that should align via their :name child
ENTITY_TYPE_CONCEPTS = {
    'country', 'country-region', 'city', 'state', 'province',
    'continent', 'world-region', 'ocean', 'sea', 'lake', 'river',
    'mountain', 'island', 'peninsula', 'desert', 'forest',
    'facility', 'building', 'airport', 'port', 'station',
    'organization', 'government-organization', 'political-party',
    'company', 'university', 'school', 'hospital', 'museum',
    'criminal-organization', 'military', 'team', 'league',
    'person', 'family', 'ethnic-group', 'nationality',
    'language', 'animal', 'plant',
    'publication', 'newspaper', 'magazine', 'book', 'show',
    'natural-disaster', 'earthquake', 'war', 'disease',
    'treaty', 'law', 'court-decision', 'festival',
    'product', 'vehicle', 'aircraft', 'ship', 'weapon',
    'food', 'drug', 'material',
    'program', 'software', 'website',
    'currency', 'award', 'event',
    'political-movement', 'religious-group',
    'human-settlement',
}


@dataclass
class AlignmentResult:
    confident: Dict[str, str] = field(default_factory=dict)
    ambiguous: Dict[str, List[int]] = field(default_factory=dict)
    no_match: List[str] = field(default_factory=list)
    skipped: List[str] = field(default_factory=list)
    concepts: Dict[str, str] = field(default_factory=dict)


def extract_nodes_from_graph(graph_text):
    """Extract all (variable, concept) pairs from PENMAN graph text.
    Returns OrderedDict preserving order of first appearance.
    """
    nodes = OrderedDict()
    for match in re.finditer(r'\((\w+)\s*/\s*([^\s()]+)', graph_text):
        var = match.group(1)
        concept = match.group(2).rstrip(')')
        if var not in nodes:
            nodes[var] = concept
    return nodes


def extract_parent_map(graph_text):
    """Parse PENMAN graph to extract parent-child relationships.
    Returns dict of child_var -> parent_var.
    """
    parent_map = {}
    stack = []

    i = 0
    while i < len(graph_text):
        ch = graph_text[i]

        if ch == '(':
            m = re.match(r'\((\w+)\s*/\s*\S+', graph_text[i:])
            if m:
                var = m.group(1)
                if stack:
                    parent_map[var] = stack[-1]
                stack.append(var)
                i += m.end()
                continue

        elif ch == ')':
            if stack:
                stack.pop()

        i += 1

    return parent_map


def extract_name_info(graph_text):
    """Extract named entity -> name string mappings.
    Returns:
        entity_names: dict of entity_var -> list of :op strings
        name_vars: set of name variables (which should get 0-0)
    """
    entity_names = {}
    name_vars = set()

    name_pattern = re.compile(
        r':name\s*\((\w+)\s*/\s*name\b([^)]*(?:\([^)]*\))*[^)]*)\)',
        re.DOTALL
    )

    for match in name_pattern.finditer(graph_text):
        name_var = match.group(1)
        name_vars.add(name_var)
        name_content = match.group(2)

        ops = []
        for op_match in re.finditer(r':op\d+\s+"([^"]*)"', name_content):
            ops.append(op_match.group(1))

        if not ops:
            continue

        prefix = graph_text[:match.start()]
        depth = 0
        parent_var = None
        for j in range(len(prefix) - 1, -1, -1):
            c = prefix[j]
            if c == ')':
                depth += 1
            elif c == '(':
                if depth == 0:
                    remaining = prefix[j:]
                    m2 = re.match(r'\((\w+)\s*/\s*\S+', remaining)
                    if m2:
                        parent_var = m2.group(1)
                    break
                depth -= 1

        if parent_var:
            entity_names[parent_var] = ops

    return entity_names, name_vars


def find_token_matches(word, tokens):
    """Find 1-based indices of tokens matching word."""
    return [i + 1 for i, tok in enumerate(tokens) if tok == word]


def find_substring_matches(word, tokens):
    """Find 1-based indices of tokens where word is substring or vice versa."""
    matches = []
    for i, tok in enumerate(tokens):
        if len(word) >= 1 and len(tok) >= 1 and word != tok:
            if word in tok or tok in word:
                matches.append(i + 1)
    return matches


def get_candidate_matches(var, concept, tokens, entity_names):
    """Get all possible token matches for a node."""
    stripped = re.sub(r'-\d+$', '', concept)

    # Try exact match
    matches = find_token_matches(stripped, tokens)

    # Try named entity alignment
    if not matches and var in entity_names:
        for op_str in entity_names[var]:
            op_matches = find_token_matches(op_str, tokens)
            if op_matches:
                matches = op_matches
                break
        if not matches:
            all_op = []
            for op_str in entity_names[var]:
                all_op.extend(find_token_matches(op_str, tokens))
            if all_op:
                matches = all_op

    # Try substring match
    if not matches:
        matches = find_substring_matches(stripped, tokens)

    return matches


def generate_alignments_interactive(tokens, graph_text, existing_alignments):
    """Generate alignments interactively for the annotation tool.

    Unlike the batch script, ambiguous matches (multiple candidates) are NOT
    auto-resolved. Instead they are returned for the annotator to disambiguate
    in the UI.

    Args:
        tokens: list of sentence tokens (strings)
        graph_text: PENMAN graph text
        existing_alignments: dict of var -> [alignment_strings] already saved

    Returns:
        AlignmentResult with confident, ambiguous, no_match, skipped, concepts
    """
    result = AlignmentResult()

    nodes = extract_nodes_from_graph(graph_text)
    entity_names, name_vars = extract_name_info(graph_text)

    # Store concepts for UI display
    result.concepts = dict(nodes)

    # Determine which variables already have alignments
    existing_vars = set()
    if existing_alignments:
        for var, alns in existing_alignments.items():
            if alns:  # non-empty alignment list
                existing_vars.add(var)

    # Compute candidates for each node
    for var, concept in nodes.items():
        # Skip already-aligned nodes
        if var in existing_vars:
            result.skipped.append(var)
            continue

        # Skip abstract concepts, name vars, entity types without names
        if var in name_vars or concept == 'name':
            result.no_match.append(var)
            continue
        if concept in ABSTRACT_CONCEPTS:
            result.no_match.append(var)
            continue
        if concept.lower() in ENTITY_TYPE_CONCEPTS and var not in entity_names:
            result.no_match.append(var)
            continue

        candidates = get_candidate_matches(var, concept, tokens, entity_names)

        if len(candidates) == 1:
            tok_idx = candidates[0]
            result.confident[var] = f'{tok_idx}-{tok_idx}'
        elif len(candidates) > 1:
            result.ambiguous[var] = candidates
        else:
            result.no_match.append(var)

    # Expand multi-token named entities in confident results
    for var in list(result.confident.keys()):
        if var in entity_names and len(entity_names[var]) > 1:
            op_strings = entity_names[var]
            first_idx = None
            last_idx = None
            for op_str in op_strings:
                idxs = find_token_matches(op_str, tokens)
                if idxs:
                    for idx in idxs:
                        if first_idx is None or idx < first_idx:
                            first_idx = idx
                        if last_idx is None or idx > last_idx:
                            last_idx = idx
            if first_idx is not None and last_idx is not None and first_idx != last_idx:
                result.confident[var] = f'{first_idx}-{last_idx}'

    return result
