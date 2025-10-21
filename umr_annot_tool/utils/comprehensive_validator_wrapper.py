"""
Wrapper for the comprehensive UMR validator from utils/umr_validator.py
Provides a simplified interface for validating Penman graphs from the UI.
"""

import io
import sys
import re
from contextlib import redirect_stderr
from typing import Dict, List, Tuple
from argparse import Namespace


# Import the comprehensive validator functions and module
try:
    from umr_annot_tool.utils import umr_validator
    from umr_annot_tool.utils.umr_validator import (
        validate_sentence_graph,
        validate_abstract_concept_NEs,
        validate_relations,
        validate_name,
        detect_events,
        validate_events,
        sentences
    )
except ImportError:
    # Fallback for direct execution
    import umr_validator
    from umr_validator import (
        validate_sentence_graph,
        validate_abstract_concept_NEs,
        validate_relations,
        validate_name,
        detect_events,
        validate_events,
        sentences
    )


def create_default_args():
    """Create a default args object for the validator."""
    return Namespace(
        quiet=False,
        max_err=1000,
        input=['<from_ui>'],  # Required by warn() function
        lang=None,
        level=5,
        inline_comments=False,
        check_trailing_whitespace=True,
        check_wide_space=True,
        check_forward_references=True,
        check_nonnegative_alignment=True,
        check_block_headers=False,  # Don't require block headers from UI
        check_complete_alignment=False,  # Don't require alignments from UI
        check_overlapping_alignment=False,
        check_unaligned_token=False,
        check_aspect_modstr=True,
        check_non_q_wiki=True,
        check_string_wiki=True,
        check_extra_empty_line=False,
        print_relations=False,
        print_clusters=False,
        print_temporal=False
    )


def extract_graph_summary(node_dict: Dict) -> Dict:
    """
    Extract a summary of the graph structure for debugging.

    Args:
        node_dict: Dictionary of nodes from the validator

    Returns:
        Dictionary with graph statistics
    """
    summary = {
        'node_count': len(node_dict),
        'nodes': []
    }

    for nid, node in node_dict.items():
        node_info = {
            'id': nid,
            'concept': node.get('concept', 'unknown'),
            'line': node.get('line0', 'unknown'),
            'relation_count': len(node.get('relations', [])) if 'relations' in node else 0
        }
        summary['nodes'].append(node_info)

    return summary


def convert_graph_to_umr_format(graph_text: str, alignment_text: str = None) -> str:
    """
    Convert Penman graph text from UI to full UMR format expected by validator.

    Args:
        graph_text: Penman graph as string
        alignment_text: Optional alignment block as string

    Returns:
        Full UMR formatted text with all required blocks
    """
    lines = []

    # Block 0: Introduction/metadata
    lines.append("# ::id sentence-1")
    lines.append("# ::snt Example sentence")
    lines.append("")  # Empty line to separate blocks

    # Block 1: Sentence level graph
    lines.append("# sentence level graph:")
    lines.append(graph_text.strip())
    lines.append("")  # Empty line to separate blocks

    # Block 2: Alignment
    lines.append("# alignment:")
    if alignment_text and alignment_text.strip():
        lines.append(alignment_text.strip())
    else:
        # If no alignment provided, add a dummy one to satisfy format
        lines.append("# (no alignment provided)")
    lines.append("")  # Empty line to separate blocks

    # Block 3: Document level
    lines.append("# document level annotation:")
    lines.append("# (none)")
    lines.append("")  # Double empty line to end sentence
    lines.append("")

    return "\n".join(lines)


def parse_and_validate_graph(
    graph_text: str,
    alignment_text: str = None,
    validation_level: int = 3,
    verbose: bool = True
) -> Dict:
    """
    Validate a Penman graph using the comprehensive validator.

    Args:
        graph_text: The Penman graph as string
        alignment_text: Optional alignment block as string
        validation_level: 1=format, 2=UMR format, 3=UMR contents (default)
        verbose: If True, include detailed context in error messages (default True)

    Returns:
        Dictionary with 'valid' (bool), 'errors' (list), 'warnings' (list)
    """
    errors = []
    warnings = []

    if not graph_text or not graph_text.strip():
        return {'valid': False, 'errors': ['Graph is empty'], 'warnings': []}

    # Create the full UMR format
    umr_text = convert_graph_to_umr_format(graph_text, alignment_text)

    # Create args with appropriate level
    args = create_default_args()
    args.level = validation_level

    # Set global args in umr_validator module (required by warn() function)
    umr_validator.args = args
    # Initialize other global variables used by validator
    umr_validator.curr_fname = '<from_ui>'
    umr_validator.curr_line = 0
    umr_validator.sentence_line = 0
    umr_validator.sentence_id = None
    umr_validator.error_counter = {}

    # Capture stderr to collect validation messages
    error_buffer = io.StringIO()

    try:
        with redirect_stderr(error_buffer):
            # Create file-like object from text
            inp = io.StringIO(umr_text)

            # Dictionary to hold all nodes
            node_dict = {}
            graph_summary = None

            # Parse and validate
            for sentence in sentences(inp, args):
                # sentence is a list of blocks: [intro, sentence_graph, alignment, document]
                if len(sentence) < 4:
                    errors.append("Invalid sentence structure")
                    continue

                # Ensure tokens are initialized (needed by validate_abstract_concept_NEs)
                if 'tokens' not in sentence[0]:
                    sentence[0]['tokens'] = []

                # Call the specific validation functions requested
                # Wrap each in try-except to handle partial failures gracefully
                try:
                    if args.level > 1:
                        validate_sentence_graph(sentence, node_dict, args)
                except KeyError as e:
                    errors.append(f'Error in sentence graph validation: Missing required field {str(e)}. The graph structure may be incomplete or malformed.')
                except Exception as e:
                    errors.append(f'Error in sentence graph validation: {str(e)}')

                try:
                    if args.level > 2:
                        validate_abstract_concept_NEs(sentence, node_dict, args)
                except KeyError as e:
                    errors.append(f'Error in abstract concept validation: Missing required field {str(e)}. Check that all nodes have proper concepts defined.')
                except Exception as e:
                    errors.append(f'Error in abstract concept validation: {str(e)}')

                try:
                    if args.level > 2:
                        validate_relations(sentence, node_dict, args)
                except KeyError as e:
                    # Provide more context for missing 'relations' key
                    missing_key = str(e).strip("'\"")
                    if missing_key == 'relations':
                        # Find which node is missing relations
                        problematic_nodes = []
                        for nid in sentence[1].get('nodes', []):
                            if nid in node_dict and 'relations' not in node_dict[nid]:
                                concept = node_dict[nid].get('concept', 'unknown')
                                line = node_dict[nid].get('line0', 'unknown')
                                problematic_nodes.append(f"{nid} (concept: {concept}, line: {line})")
                        if problematic_nodes:
                            errors.append(f'Error in relations validation: Node(s) missing relations field: {", ".join(problematic_nodes)}. This is an internal parsing error.')
                        else:
                            errors.append(f'Error in relations validation: Missing "relations" field in a node. Check graph structure.')
                    else:
                        errors.append(f'Error in relations validation: Missing required field {str(e)}.')
                except Exception as e:
                    errors.append(f'Error in relations validation: {str(e)}')

                try:
                    if args.level > 2:
                        validate_name(sentence, node_dict, args)
                except KeyError as e:
                    errors.append(f'Error in name validation: Missing required field {str(e)}. Check that :name constructs are properly formed.')
                except Exception as e:
                    errors.append(f'Error in name validation: {str(e)}')

                # Event detection and validation are skipped for sentence-level graphs
                # These checks are more relevant for document-level annotation
                # try:
                #     if args.level > 2:
                #         detect_events(sentence, node_dict, args)
                # except Exception as e:
                #     errors.append(f'Error in event detection: {str(e)}')
                #
                # try:
                #     if args.level > 2 and args.check_aspect_modstr:
                #         validate_events(sentence, node_dict, args)
                # except Exception as e:
                #     errors.append(f'Error in event validation: {str(e)}')

                # Extract graph summary for debugging if verbose mode is enabled
                if verbose and not graph_summary:
                    try:
                        graph_summary = extract_graph_summary(node_dict)
                    except Exception:
                        pass  # Don't fail validation if summary extraction fails

        # Parse the captured error messages
        error_output = error_buffer.getvalue()
        if error_output:
            # Parse error messages - they follow format: [Line X]: [L<level> <class> <id>] message
            for line in error_output.strip().split('\n'):
                if not line:
                    continue

                # Try to extract line number from the beginning
                line_match = re.search(r'^\[Line\s+(\d+)\]', line)
                line_number = line_match.group(1) if line_match else None

                # Extract the message part after the last ]:
                match = re.search(r'\]:\s*\[L(\d+)\s+(\S+)\s+(\S+)\]\s*(.+)', line)
                if match:
                    level = int(match.group(1))
                    error_class = match.group(2)
                    error_id = match.group(3)
                    message = match.group(4)

                    # Build a more detailed message
                    detailed_message = message
                    if line_number:
                        detailed_message = f"{message} (line {line_number})"

                    # Add error ID for reference if it's useful
                    if error_id not in ['unknown-relation', 'unknown-concept', 'missing-attribute']:
                        detailed_message += f" [{error_id}]"

                    error_entry = {
                        'level': level,
                        'class': error_class,
                        'id': error_id,
                        'message': detailed_message,
                        'line': line_number
                    }

                    # Skip empty line checks for sentence-level graphs (not relevant for UI)
                    if error_id == 'missing-empty-line':
                        continue

                    # Level 1-2 are typically errors, 3+ can be warnings
                    if level <= 2:
                        errors.append(detailed_message)
                    else:
                        warnings.append(detailed_message)
                else:
                    # If we can't parse the format, add as warning with line number if available
                    if line_number:
                        warnings.append(f"{line} (line {line_number})")
                    else:
                        warnings.append(line)

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        # Show more helpful error message
        if isinstance(e, KeyError):
            errors.append(f'Internal validation error: Missing expected key {str(e)} in data structure.')
            errors.append('This may indicate the graph parser encountered an issue. Check that the graph is properly formatted.')
        elif isinstance(e, AttributeError):
            errors.append(f'Internal validation error: {str(e)}')
            errors.append('This may indicate a malformed graph structure or missing required attributes.')
        elif isinstance(e, IndexError):
            errors.append(f'Internal validation error: {str(e)}')
            errors.append('This may indicate an issue with the graph structure or an empty required field.')
        else:
            errors.append(f'Validation error: {str(e)}')

        # For development/debugging: include exception type
        errors.append(f'Error type: {type(e).__name__}')

    result = {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }

    # Include graph summary if verbose mode and available
    if verbose and graph_summary:
        result['graph_summary'] = graph_summary

    return result


def validate_comprehensive(graph_text: str, tokens: List[str] = None, verbose: bool = True) -> Dict:
    """
    Main validation function for use from validation routes.
    Runs all comprehensive validations requested by the user.

    Args:
        graph_text: Penman graph text
        tokens: Optional list of tokens (not used currently)
        verbose: If True, provide detailed error context (default True)

    Returns:
        Dictionary with validation results
    """
    return parse_and_validate_graph(graph_text, validation_level=3, verbose=verbose)


def validate_with_alignment(graph_text: str, alignment_text: str, verbose: bool = True) -> Dict:
    """
    Validate graph with alignment information.

    Args:
        graph_text: Penman graph text
        alignment_text: Alignment block text
        verbose: If True, provide detailed error context (default True)

    Returns:
        Dictionary with validation results
    """
    return parse_and_validate_graph(graph_text, alignment_text, validation_level=3, verbose=verbose)
