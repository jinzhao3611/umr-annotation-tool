"""
Routes for UMR graph validation
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required
from umr_annot_tool.utils.comprehensive_validator_wrapper import (
    validate_comprehensive,
    validate_with_alignment
)

validation = Blueprint('validation', __name__)


@validation.route('/api/validate/graph', methods=['POST'])
@login_required
def validate_graph():
    """
    Validate a Penman graph from the sentence-level annotation using comprehensive validator.

    Runs the following validations:
    - validate_sentence_graph
    - validate_abstract_concept_NEs
    - validate_relations
    - validate_name
    - detect_events
    - validate_events

    Expected JSON payload:
    {
        "graph": "...",  # The Penman graph text
        "tokens": [...]  # Optional list of tokens
    }

    Returns:
    {
        "valid": bool,
        "errors": [...],
        "warnings": [...]
    }
    """
    try:
        data = request.get_json()

        if not data or 'graph' not in data:
            return jsonify({'error': 'No graph provided'}), 400

        graph_text = data.get('graph', '')
        tokens = data.get('tokens', None)

        result = validate_comprehensive(graph_text, tokens)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@validation.route('/api/validate/alignment', methods=['POST'])
@login_required
def validate_align():
    """
    Validate alignment between graph nodes and tokens using comprehensive validator.

    Expected JSON payload:
    {
        "alignment": "...",  # The alignment text
        "graph": "..."       # The Penman graph text
    }

    Returns:
    {
        "valid": bool,
        "errors": [...],
        "warnings": [...]
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        alignment_text = data.get('alignment', '')
        graph_text = data.get('graph', '')

        if not graph_text:
            return jsonify({'error': 'Graph is required for alignment validation'}), 400

        result = validate_with_alignment(graph_text, alignment_text)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@validation.route('/api/validate/full', methods=['POST'])
@login_required
def validate_full():
    """
    Validate both graph and alignment together using comprehensive validator.

    Expected JSON payload:
    {
        "graph": "...",      # The Penman graph text
        "alignment": "...",  # The alignment text
        "tokens": [...]      # Optional list of tokens
    }

    Returns:
    {
        "valid": bool,
        "errors": [...],
        "warnings": [...]
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        graph_text = data.get('graph', '')
        alignment_text = data.get('alignment', '')
        tokens = data.get('tokens', None)

        # Validate with alignment if provided, otherwise just validate graph
        if alignment_text and alignment_text.strip():
            result = validate_with_alignment(graph_text, alignment_text)
        else:
            result = validate_comprehensive(graph_text, tokens)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500