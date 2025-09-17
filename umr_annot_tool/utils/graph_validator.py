"""
Simplified graph validation module for UMR annotation tool.
This module provides validation for Penman graphs in the sentence-level annotation.
"""

import re
import io
import sys
from contextlib import redirect_stderr


def validate_penman_graph(graph_text, tokens=None):
    """
    Validate a Penman graph from the sentence-level annotation.

    Args:
        graph_text: The Penman graph as a string
        tokens: Optional list of tokens for alignment validation

    Returns:
        dict with 'valid' (bool), 'errors' (list), 'warnings' (list)
    """
    errors = []
    warnings = []

    if not graph_text or not graph_text.strip():
        return {'valid': False, 'errors': ['Graph is empty'], 'warnings': []}

    # Basic structure validation
    try:
        # Check for balanced parentheses
        open_count = graph_text.count('(')
        close_count = graph_text.count(')')

        if open_count != close_count:
            errors.append(f'Unbalanced parentheses: {open_count} opening, {close_count} closing')

        # Check for proper node structure
        lines = graph_text.strip().split('\n')
        indent_stack = []
        node_pattern = re.compile(r'^\s*\(([a-z0-9]+)\s*/\s*(.+?)(?:\s|$)')
        relation_pattern = re.compile(r'^\s*:([\w-]+)\s+(.+?)(?:\s|$)')

        current_nodes = set()
        referenced_nodes = set()

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue

            # Check for node definition
            node_match = node_pattern.match(stripped)
            if node_match:
                node_id = node_match.group(1)
                concept = node_match.group(2).strip()

                if node_id in current_nodes:
                    errors.append(f'Line {line_num}: Duplicate node ID "{node_id}"')
                else:
                    current_nodes.add(node_id)

                # Validate node ID format
                if not re.match(r'^s\d+[a-z0-9]*$', node_id):
                    warnings.append(f'Line {line_num}: Non-standard node ID "{node_id}" (expected format: s1x, s1a, etc.)')

            # Check for relation
            rel_match = relation_pattern.match(stripped)
            if rel_match:
                relation = rel_match.group(1)
                value = rel_match.group(2).strip()

                # Check if value references a node
                if not value.startswith('"') and not value.startswith('('):
                    # Could be a node reference
                    node_ref = value.split()[0] if value else ''
                    if re.match(r'^s\d+[a-z0-9]*$', node_ref):
                        referenced_nodes.add(node_ref)

                # Check for standard UMR relations
                standard_relations = [
                    'ARG0', 'ARG1', 'ARG2', 'ARG3', 'ARG4', 'ARG5', 'ARG6',
                    'ARG0-of', 'ARG1-of', 'ARG2-of', 'ARG3-of', 'ARG4-of', 'ARG5-of', 'ARG6-of',
                    'op1', 'op2', 'op3', 'op4', 'op5', 'op6', 'op7', 'op8', 'op9', 'op10',
                    'mod', 'polarity', 'quant', 'ref', 'manner', 'purpose',
                    'cause', 'concession', 'condition', 'part', 'subevent',
                    'name', 'wiki', 'time', 'location', 'direction', 'source',
                    'destination', 'path', 'beneficiary', 'accompanier', 'topic',
                    'duration', 'frequency', 'extent', 'instrument', 'medium',
                    'ord', 'range', 'scale', 'consist-of', 'example',
                    'place', 'temporal', 'year', 'month', 'day', 'aspect',
                    'Aspect', 'MODSTR', 'Degree'
                ]

                if relation not in standard_relations:
                    # Check if it's a frame-specific role or -of variant
                    if not re.match(r'^ARG\d+(-of)?$', relation):
                        warnings.append(f'Line {line_num}: Non-standard relation ":{relation}"')

        # Check for undefined node references
        undefined_refs = referenced_nodes - current_nodes
        if undefined_refs:
            for ref in undefined_refs:
                errors.append(f'Reference to undefined node "{ref}"')

        # Note: Full validation with umr_validator is disabled for now
        # as it requires spacy and other dependencies.
        # The basic validation above should catch most common errors.

    except Exception as e:
        errors.append(f'Validation error: {str(e)}')

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }


def validate_alignment(alignment_text, graph_text):
    """
    Validate alignment between graph nodes and tokens.

    Args:
        alignment_text: The alignment block as a string
        graph_text: The Penman graph to extract node IDs

    Returns:
        dict with 'valid' (bool), 'errors' (list), 'warnings' (list)
    """
    errors = []
    warnings = []

    if not alignment_text or not alignment_text.strip():
        warnings.append('No alignment provided')
        return {'valid': True, 'errors': errors, 'warnings': warnings}

    # Extract node IDs from graph
    node_pattern = re.compile(r'\(([a-z0-9]+)\s*/')
    graph_nodes = set(node_pattern.findall(graph_text))

    # Parse alignment
    alignment_pattern = re.compile(r'^([a-z0-9]+):\s*([\d-]+)$')
    aligned_nodes = set()

    for line in alignment_text.strip().split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        match = alignment_pattern.match(line)
        if match:
            node_id = match.group(1)
            alignment = match.group(2)

            aligned_nodes.add(node_id)

            # Check if node exists in graph
            if node_id not in graph_nodes:
                errors.append(f'Alignment for undefined node "{node_id}"')

            # Validate alignment format
            if not re.match(r'^(\d+)-(\d+)$|^-1--1$', alignment):
                errors.append(f'Invalid alignment format for {node_id}: "{alignment}"')
        else:
            errors.append(f'Invalid alignment line: "{line}"')

    # Check for unaligned nodes
    unaligned = graph_nodes - aligned_nodes
    if unaligned:
        for node in sorted(unaligned):
            warnings.append(f'Node "{node}" has no alignment')

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }