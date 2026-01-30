"""
UMR/AMR Annotation Validator and Repair Module

This module provides functions to validate and automatically fix common issues
in UMR/AMR annotations, particularly focusing on parenthesis balancing.
"""

import re
import logging
from typing import Tuple, List, Dict, Optional

logger = logging.getLogger(__name__)


class UMRValidationError(Exception):
    """Custom exception for UMR validation errors"""
    pass


def validate_parentheses(annotation: str) -> Tuple[bool, List[Dict]]:
    """
    Validate parenthesis balance in an UMR/AMR annotation.

    Args:
        annotation: The UMR/AMR annotation string

    Returns:
        Tuple of (is_valid, issues) where issues is a list of dictionaries
        describing any problems found
    """
    issues = []
    stack = []
    lines = annotation.split('\n')

    # Track position for better error reporting
    line_num = 0

    for line_idx, line in enumerate(lines):
        line_num = line_idx + 1
        char_pos = 0

        # Skip comment lines
        if line.strip().startswith('#'):
            continue

        for char_idx, char in enumerate(line):
            char_pos = char_idx + 1

            if char == '(':
                stack.append({
                    'char': '(',
                    'line': line_num,
                    'pos': char_pos,
                    'context': line[max(0, char_idx-10):min(len(line), char_idx+20)]
                })
            elif char == ')':
                if not stack:
                    issues.append({
                        'type': 'unmatched_close',
                        'line': line_num,
                        'pos': char_pos,
                        'message': f'Unmatched closing parenthesis at line {line_num}, position {char_pos}',
                        'context': line[max(0, char_idx-10):min(len(line), char_idx+20)]
                    })
                else:
                    stack.pop()

    # Check for unclosed parentheses
    for unclosed in stack:
        issues.append({
            'type': 'unmatched_open',
            'line': unclosed['line'],
            'pos': unclosed['pos'],
            'message': f'Unclosed opening parenthesis at line {unclosed["line"]}, position {unclosed["pos"]}',
            'context': unclosed['context']
        })

    return len(issues) == 0, issues


def fix_indentation_and_parentheses_old(annotation: str) -> Tuple[str, List[str]]:
    """
    Fix both indentation and parenthesis issues in UMR/AMR annotations.

    Core principle: Track absolute parenthesis depth. Each unclosed '(' increases depth,
    each ')' decreases it. Indentation = depth * 4 spaces.

    Special handling: Prevent depth from going below 1 if we're not at the end of the annotation,
    since everything should be inside the root node.

    Args:
        annotation: The UMR/AMR annotation string

    Returns:
        Tuple of (fixed_annotation, changes_made)
    """
    changes = []
    lines = annotation.split('\n')
    fixed_lines = []

    # Track absolute parenthesis depth
    current_depth = 0
    seen_root = False

    # First pass: identify if we have a root node
    for line in lines:
        if line.strip() and not line.strip().startswith('#'):
            # First non-comment line should be the root
            if '(' in line and '/' in line:
                seen_root = True
            break

    # Second pass: fix indentation
    for line_idx, line in enumerate(lines):
        # Preserve empty lines and comments as-is
        if not line.strip() or line.strip().startswith('#'):
            fixed_lines.append(line)
            continue

        current_indent = len(line) - len(line.lstrip())
        content = line.strip()

        # Count parentheses in this line
        open_parens = content.count('(')
        close_parens = content.count(')')

        # Determine the depth at the START of this line
        # If line has more closing than opening parens, we're moving back up
        temp_depth = current_depth

        # For lines that close more parens than they open
        if close_parens > open_parens:
            # Adjust depth for the closing parens
            net_closing = close_parens - open_parens
            temp_depth = max(0, current_depth - net_closing)

            # But if we still have content after this line and we've seen a root,
            # don't let depth go below 1 (we're still inside the root)
            if seen_root and temp_depth == 0:
                # Check if there are more content lines after this
                has_more_content = False
                for future_idx in range(line_idx + 1, len(lines)):
                    future_line = lines[future_idx].strip()
                    if future_line and not future_line.startswith('#'):
                        has_more_content = True
                        break

                if has_more_content:
                    # We're not at the end, so we must still be inside the root
                    temp_depth = 1

        # The line should be indented based on its depth
        expected_indent = temp_depth * 4

        # Apply the indentation fix if needed
        if current_indent != expected_indent:
            fixed_line = ' ' * expected_indent + content
            fixed_lines.append(fixed_line)
            changes.append(f'Line {line_idx + 1}: Fixed indentation from {current_indent} to {expected_indent} spaces')
        else:
            fixed_lines.append(line)

        # Update the depth for next line based on ALL parens in this line
        current_depth += open_parens - close_parens

        # Similar check: if we have a root and more content coming, don't go below 1
        if seen_root and current_depth <= 0:
            has_more_content = False
            for future_idx in range(line_idx + 1, len(lines)):
                future_line = lines[future_idx].strip()
                if future_line and not future_line.startswith('#'):
                    has_more_content = True
                    break

            if has_more_content:
                current_depth = max(1, current_depth)
        else:
            current_depth = max(0, current_depth)

    # Add missing closing parentheses if needed
    if current_depth > 0:
        # Find the last non-empty, non-comment line
        last_content_line = -1
        for i in range(len(fixed_lines) - 1, -1, -1):
            if fixed_lines[i].strip() and not fixed_lines[i].strip().startswith('#'):
                last_content_line = i
                break

        if last_content_line >= 0:
            # Add the missing closing parentheses
            fixed_lines[last_content_line] += ')' * current_depth
            changes.append(f'Added {current_depth} closing parenthesis(es) at the end')

    return '\n'.join(fixed_lines), changes


def fix_indentation_and_parentheses_with_removal(annotation: str) -> Tuple[str, List[str]]:
    """
    Fix indentation and parenthesis issues, including removing extra closing parentheses
    that prematurely close the root node.

    This version can remove parentheses that incorrectly close the root when more
    content follows.
    """
    changes = []
    lines = annotation.split('\n')
    fixed_lines = []

    # First pass: detect if we have premature root closure
    depth = 0
    has_premature_closure = False
    premature_closure_line = -1

    for idx, line in enumerate(lines):
        if not line.strip() or line.strip().startswith('#'):
            continue

        content = line.strip()
        opens = content.count('(')
        closes = content.count(')')

        depth += opens - closes

        if depth == 0 and idx < len(lines) - 1:
            # Check if there's more content after this
            for future_idx in range(idx + 1, len(lines)):
                future_line = lines[future_idx].strip()
                if future_line and not future_line.startswith('#'):
                    if future_line.startswith(':'):
                        # Found a relation after root closure - this is wrong!
                        has_premature_closure = True
                        premature_closure_line = idx
                        changes.append(f'Line {idx + 1}: DETECTED - Premature root closure with relations following')
                    break

        if has_premature_closure:
            break

    # Second pass: fix the graph
    current_depth = 0
    has_root = False
    root_is_open = False
    paren_stack = []

    for line_idx, line in enumerate(lines):
        # Preserve empty lines and comments as-is
        if not line.strip() or line.strip().startswith('#'):
            fixed_lines.append(line)
            continue

        content = line.strip()
        current_indent = len(line) - len(line.lstrip())

        # If this is the line with premature closure, remove one closing paren
        if has_premature_closure and line_idx == premature_closure_line:
            # Find the last closing paren and remove it
            last_close_pos = content.rfind(')')
            if last_close_pos != -1:
                content = content[:last_close_pos] + content[last_close_pos+1:]
                changes.append(f'Line {line_idx + 1}: Removed extra closing parenthesis that was closing root prematurely')

        # Rest of the logic continues as before...
        # Determine expected indentation BEFORE processing this line's parentheses
        if not has_root and '(' in content and '/' in content and not content.startswith(':'):
            # This is the root node - should have 0 indentation
            has_root = True
            root_is_open = True
            expected_indent = 0
            changes.append(f'Line {line_idx + 1}: Identified root node')
        else:
            # For all other lines, calculate based on depth
            # But we need to consider if line has net closing parentheses

            # If line starts with closing parens, calculate depth after those
            if content and content[0] == ')':
                # Count consecutive closing parens at start
                closing_count = 0
                for char in content:
                    if char == ')':
                        closing_count += 1
                    else:
                        break

                # These closing parens affect the indentation of THIS line
                temp_depth = max(0, current_depth - closing_count)

                # But make sure we don't go to depth 0 if root is still open
                if root_is_open and temp_depth == 0:
                    # Check if this line closes the root
                    # Count total parens in the annotation so far plus this line
                    total_open = 0
                    total_close = 0

                    # Count in previous lines
                    for prev_line in fixed_lines:
                        if not prev_line.strip().startswith('#'):
                            total_open += prev_line.count('(')
                            total_close += prev_line.count(')')

                    # Count in current line (modified content)
                    total_open += content.count('(')
                    total_close += content.count(')')

                    if total_open > total_close:
                        # Root is still open, maintain depth 1 minimum
                        temp_depth = 1

                expected_indent = temp_depth * 4
            else:
                # Normal line - use current depth
                expected_indent = current_depth * 4

                # Special check: if we're at depth 0 but root is open, we should be at depth 1
                if current_depth == 0 and root_is_open:
                    expected_indent = 4

        # Apply indentation fix
        if current_indent != expected_indent:
            fixed_line = ' ' * expected_indent + content
            fixed_lines.append(fixed_line)
            changes.append(f'Line {line_idx + 1}: Fixed indentation from {current_indent} to {expected_indent} spaces')
        else:
            fixed_lines.append(' ' * expected_indent + content if current_indent != expected_indent else line.rstrip())

        # Update depth for NEXT line based on this line's parentheses
        for char in content:
            if char == '(':
                current_depth += 1
                paren_stack.append(('open', line_idx + 1))
            elif char == ')':
                if paren_stack:
                    paren_stack.pop()
                current_depth = max(0, current_depth - 1)

        # After processing this line, check the state
        # In proper Penman format, we should only be at depth 0 at the very end
        if has_root:
            # Check if there are more content lines coming
            has_more_content = False
            next_line_is_relation = False
            for future_idx in range(line_idx + 1, len(lines)):
                future_line = lines[future_idx].strip()
                if future_line and not future_line.startswith('#'):
                    has_more_content = True
                    if future_line.startswith(':'):
                        next_line_is_relation = True
                    break

            if current_depth == 0:
                if has_more_content:
                    if next_line_is_relation:
                        # We're at depth 0 but more relations are coming
                        # This shouldn't happen if we removed the extra paren correctly
                        current_depth = 1
                    else:
                        # Might be starting a new root (error) or end of graph
                        if root_is_open:
                            root_is_open = False
                else:
                    # No more content, we're done
                    if root_is_open:
                        root_is_open = False

    # Check final balance
    total_open = 0
    total_close = 0
    for line in fixed_lines:
        if not line.strip().startswith('#'):
            total_open += line.count('(')
            total_close += line.count(')')

    if total_open > total_close:
        # Add missing closing parentheses
        missing = total_open - total_close
        last_content_idx = -1
        for i in range(len(fixed_lines) - 1, -1, -1):
            if fixed_lines[i].strip() and not fixed_lines[i].strip().startswith('#'):
                last_content_idx = i
                break

        if last_content_idx >= 0:
            fixed_lines[last_content_idx] += ')' * missing
            changes.append(f'Added {missing} closing parenthesis(es) at the end')
    elif total_close > total_open:
        changes.append(f'ERROR: {total_close - total_open} extra closing parenthesis(es) remain - manual fix needed')

    if total_open == total_close:
        changes.append('✓ Parentheses are now balanced')
    else:
        changes.append(f'⚠ Warning: Parentheses still unbalanced ({total_open} open, {total_close} close)')

    return '\n'.join(fixed_lines), changes


def fix_indentation_and_parentheses(annotation: str) -> Tuple[str, List[str]]:
    """
    Fix indentation and parenthesis issues in UMR/AMR annotations using Penman graph format rules.

    Core principle for Penman graphs:
    - The first opening parenthesis starts the root node and should match with the very last closing parenthesis
    - Only the root node (first line) should have 0 indentation
    - Each opening parenthesis increases nesting depth
    - Closing parentheses decrease depth
    - Indentation = current_depth * 4 spaces
    - Relations (starting with :) are properties of their parent node

    Args:
        annotation: The UMR/AMR annotation string

    Returns:
        Tuple of (fixed_annotation, changes_made)
    """
    changes = []
    lines = annotation.split('\n')
    fixed_lines = []

    # Track parenthesis depth (0 = outside any node, 1 = inside root, etc.)
    current_depth = 0

    # Track if we've seen the root and if it's still open
    has_root = False
    root_is_open = False

    # Stack to track which line each open paren came from
    paren_stack = []

    for line_idx, line in enumerate(lines):
        # Preserve empty lines and comments as-is
        if not line.strip() or line.strip().startswith('#'):
            fixed_lines.append(line)
            continue

        content = line.strip()
        current_indent = len(line) - len(line.lstrip())

        # Determine expected indentation BEFORE processing this line's parentheses
        if not has_root and '(' in content and '/' in content and not content.startswith(':'):
            # This is the root node - should have 0 indentation
            has_root = True
            root_is_open = True
            expected_indent = 0
            changes.append(f'Line {line_idx + 1}: Identified root node')
        else:
            # For all other lines, calculate based on depth
            # But we need to consider if line has net closing parentheses

            # Count parentheses to determine if we need to dedent
            temp_content = content
            temp_depth = current_depth

            # If line starts with closing parens, calculate depth after those
            if content and content[0] == ')':
                # Count consecutive closing parens at start
                closing_count = 0
                for char in content:
                    if char == ')':
                        closing_count += 1
                    else:
                        break

                # These closing parens affect the indentation of THIS line
                temp_depth = max(0, current_depth - closing_count)

                # But make sure we don't go to depth 0 if root is still open
                if root_is_open and temp_depth == 0:
                    # Check if this line closes the root
                    # Count total parens in the annotation so far plus this line
                    total_open = 0
                    total_close = 0

                    # Count in previous lines
                    for prev_line in fixed_lines:
                        if not prev_line.strip().startswith('#'):
                            total_open += prev_line.count('(')
                            total_close += prev_line.count(')')

                    # Count in current line
                    total_open += content.count('(')
                    total_close += content.count(')')

                    if total_open > total_close:
                        # Root is still open, maintain depth 1 minimum
                        temp_depth = 1

                expected_indent = temp_depth * 4
            else:
                # Normal line - use current depth
                expected_indent = current_depth * 4

                # Special check: if we're at depth 0 but root is open, we should be at depth 1
                if current_depth == 0 and root_is_open:
                    expected_indent = 4

        # Apply indentation fix
        if current_indent != expected_indent:
            fixed_line = ' ' * expected_indent + content
            fixed_lines.append(fixed_line)
            changes.append(f'Line {line_idx + 1}: Fixed indentation from {current_indent} to {expected_indent} spaces')
        else:
            fixed_lines.append(line)

        # Update depth for NEXT line based on this line's parentheses
        for char in content:
            if char == '(':
                current_depth += 1
                paren_stack.append(('open', line_idx + 1))
            elif char == ')':
                if paren_stack:
                    paren_stack.pop()
                current_depth = max(0, current_depth - 1)

        # After processing this line, check the state
        # In proper Penman format, we should only be at depth 0 at the very end
        if has_root:
            # Check if there are more content lines coming
            has_more_content = False
            next_line_is_relation = False
            for future_idx in range(line_idx + 1, len(lines)):
                future_line = lines[future_idx].strip()
                if future_line and not future_line.startswith('#'):
                    has_more_content = True
                    if future_line.startswith(':'):
                        next_line_is_relation = True
                    break

            if current_depth == 0:
                if has_more_content:
                    if next_line_is_relation:
                        # We're at depth 0 but more relations are coming
                        # This is a structural issue - relations should be children of root
                        current_depth = 1
                        changes.append(f'Line {line_idx + 1}: WARNING - Reached depth 0 but more relations follow. Adjusting to depth 1.')
                    else:
                        # Might be starting a new root (error) or end of graph
                        if root_is_open:
                            root_is_open = False
                            changes.append(f'Line {line_idx + 1}: Root appears to be closed')
                else:
                    # No more content, we're done
                    if root_is_open:
                        root_is_open = False

    # Check final balance
    total_open = 0
    total_close = 0
    for line in fixed_lines:
        if not line.strip().startswith('#'):
            total_open += line.count('(')
            total_close += line.count(')')

    if total_open > total_close:
        # Add missing closing parentheses
        missing = total_open - total_close
        last_content_idx = -1
        for i in range(len(fixed_lines) - 1, -1, -1):
            if fixed_lines[i].strip() and not fixed_lines[i].strip().startswith('#'):
                last_content_idx = i
                break

        if last_content_idx >= 0:
            fixed_lines[last_content_idx] += ')' * missing
            changes.append(f'Added {missing} closing parenthesis(es) at the end')
    elif total_close > total_open:
        changes.append(f'ERROR: {total_close - total_open} extra closing parenthesis(es) - manual fix needed')

    if total_open == total_close:
        changes.append('✓ Parentheses are now balanced')
    else:
        changes.append(f'⚠ Warning: Parentheses still unbalanced ({total_open} open, {total_close} close)')

    return '\n'.join(fixed_lines), changes


def auto_fix_parentheses(annotation: str) -> Tuple[str, List[str]]:
    """
    Attempt to automatically fix parenthesis imbalances in UMR/AMR annotations.

    This function tries to intelligently add missing closing parentheses based on
    indentation patterns and structure.

    Args:
        annotation: The UMR/AMR annotation string with potential parenthesis issues

    Returns:
        Tuple of (fixed_annotation, changes_made) where changes_made is a list
        of descriptions of what was fixed
    """
    changes = []
    lines = annotation.split('\n')

    # First pass: analyze structure and indentation
    stack = []
    indent_stack = []

    for line_idx, line in enumerate(lines):
        # Skip empty lines and comments
        if not line.strip() or line.strip().startswith('#'):
            continue

        # Calculate indentation
        indent = len(line) - len(line.lstrip())

        # Count parentheses in this line
        open_count = line.count('(')
        close_count = line.count(')')

        # Track net parentheses
        for _ in range(open_count):
            stack.append({
                'line': line_idx,
                'indent': indent,
                'content': line.strip()
            })

        for _ in range(close_count):
            if stack:
                stack.pop()

    # If we have unclosed parentheses, try to fix them
    if stack:
        # Determine where to add closing parentheses
        # Strategy: Add them at the end of the annotation or when indentation decreases

        # Simple approach: add missing closing parentheses at the end
        missing_count = len(stack)

        # Find the last non-empty, non-comment line
        last_content_line = -1
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip() and not lines[i].strip().startswith('#'):
                last_content_line = i
                break

        if last_content_line >= 0:
            # Add the missing closing parentheses to the last content line
            lines[last_content_line] += ')' * missing_count
            changes.append(f'Added {missing_count} closing parenthesis(es) at the end of the annotation')

    # Check for unmatched closing parentheses
    # This is harder to fix automatically, so we'll just report it
    balance = 0
    for line in lines:
        if not line.strip().startswith('#'):
            balance += line.count('(')
            balance -= line.count(')')
            if balance < 0:
                changes.append('Warning: Found unmatched closing parentheses (manual review recommended)')
                break

    return '\n'.join(lines), changes


def validate_umr_structure(annotation: str) -> Tuple[bool, List[Dict]]:
    """
    Validate overall UMR/AMR structure beyond just parentheses.

    Checks for:
    - Proper relation format (starting with :)
    - Variable naming conventions
    - Concept structure

    Args:
        annotation: The UMR/AMR annotation string

    Returns:
        Tuple of (is_valid, issues)
    """
    issues = []
    lines = annotation.split('\n')

    # Check for basic structure patterns
    has_root = False
    variable_pattern = re.compile(r'\b([a-z]\d*[a-z]*\d*)\s*/')
    relation_pattern = re.compile(r':[A-Za-z0-9\-]+')

    for line_num, line in enumerate(lines, 1):
        # Skip comments
        if line.strip().startswith('#'):
            continue

        # Check for root node (should be at the beginning)
        if line_num == 1 or (line_num <= 5 and not has_root):
            if '(' in line and '/' in line:
                has_root = True

        # Check for malformed relations (common issues)
        if ':' in line:
            # Check for relations without proper spacing
            if re.search(r':[A-Za-z0-9\-]+[^\s\)]', line):
                issues.append({
                    'type': 'malformed_relation',
                    'line': line_num,
                    'message': f'Possible malformed relation at line {line_num}',
                    'context': line.strip()
                })

        # Check for orphaned concepts (concepts without variables)
        if '/' in line and '(' not in line:
            # This might be a continuation, check indentation
            if len(line) - len(line.lstrip()) == 0:
                issues.append({
                    'type': 'orphaned_concept',
                    'line': line_num,
                    'message': f'Possible orphaned concept at line {line_num}',
                    'context': line.strip()
                })

    if not has_root:
        issues.append({
            'type': 'missing_root',
            'line': 0,
            'message': 'No root node found in annotation'
        })

    return len(issues) == 0, issues


def normalize_attribute_case(annotation: str) -> str:
    """
    Normalize attribute names and values to UMR-compliant forms.

    Converts:
    - :Aspect → :aspect
    - :MODSTR → :modal-strength
    - Performance → performance
    - FullAff → full-affirmative
    - etc.

    Args:
        annotation: The annotation string

    Returns:
        Normalized annotation string
    """
    result = annotation

    # Step 1: Convert abbreviated attribute names to full forms
    abbreviation_map = {
        r':MODSTR\b': ':modal-strength',
        r':modstr\b': ':modal-strength',
        r':Aspect\b': ':aspect',
    }

    for abbrev, full_form in abbreviation_map.items():
        result = re.sub(abbrev, full_form, result, flags=re.IGNORECASE)

    # Step 2: Convert abbreviated modal strength values
    # Process longer patterns first to avoid partial matches (e.g., FullAff before Aff)
    modstr_values = [
        (r'\bFullAff\b', 'full-affirmative'),
        (r'\bNeutAff\b', 'neutral-affirmative'),
        (r'\bNeutDisaff\b', 'neutral-negative'),
        (r'\bFullDisaff\b', 'full-negative'),
        (r'\bDisaff\b', 'partial-negative'),
        (r'\bAff\b', 'partial-affirmative'),  # Process this after FullAff/NeutAff to avoid partial match
        (r'\bNeutral\b(?!-)', 'neutral-affirmative'),  # Only match standalone "Neutral", not "neutral-affirmative"
    ]

    for abbrev, full_form in modstr_values:
        result = re.sub(abbrev, full_form, result, flags=re.IGNORECASE)

    # Step 3: Convert aspect values (Performance, Activity, State, etc.)
    aspect_values = {
        r'\bPerformance\b': 'performance',
        r'\bActivity\b': 'activity',
        r'\bActivities\b': 'activities',
        r'\bState\b': 'state',
        r'\bHabitual\b': 'habitual',
        r'\bEndeavor\b': 'endeavor',
        r'\bProcess\b': 'process',
        r'\bEnactment\b': 'enactment',
    }

    for abbrev, full_form in aspect_values.items():
        result = re.sub(abbrev, full_form, result, flags=re.IGNORECASE)

    # Step 4: Other capitalized attributes (generic catch-all)
    # :ARG0, :ARG1 are correct, but :Name, :Quant, etc. should be lowercase
    # Be careful not to change :ARG1, :ARG2, etc.
    result = re.sub(r':([A-Z][a-z]+)\b(?![0-9])', lambda m: f':{m.group(1).lower()}', result)

    return result


def validate_and_fix_annotation(annotation: str, auto_fix: bool = True) -> Tuple[str, bool, List[str]]:
    """
    Main function to validate and optionally fix UMR/AMR annotations.

    Args:
        annotation: The UMR/AMR annotation string
        auto_fix: Whether to attempt automatic fixes

    Returns:
        Tuple of (processed_annotation, is_valid, messages)
    """
    messages = []

    # Normalize attribute case first (always applied)
    processed = normalize_attribute_case(annotation)
    if processed != annotation:
        messages.append('✓ Normalized to UMR standard format (:MODSTR → :modal-strength, FullAff → full-affirmative, etc.)')

    is_valid = True

    # Check parenthesis balance on the normalized annotation
    paren_valid, paren_issues = validate_parentheses(processed)

    if not paren_valid:
        is_valid = False
        for issue in paren_issues:
            messages.append(issue['message'])

    # Always try to fix indentation and detect structural issues
    if auto_fix:
        # Use the enhanced version that can remove extra parentheses
        processed, fixes = fix_indentation_and_parentheses_with_removal(annotation)
        if fixes:
            # Separate structural warnings from fixes
            structural_warnings = [f for f in fixes if 'WARNING' in f or 'ERROR' in f or 'Extra closing' in f]
            indentation_fixes = [f for f in fixes if 'Fixed indentation' in f]
            other_messages = [f for f in fixes if f not in structural_warnings and f not in indentation_fixes]

            # Add messages in order of importance
            if structural_warnings:
                messages.append("⚠ STRUCTURAL ISSUES DETECTED:")
                for warning in structural_warnings:
                    messages.append(f"  {warning}")

            if indentation_fixes:
                messages.append(f"Fixed indentation on {len(indentation_fixes)} lines")

            messages.extend(other_messages)

        # Revalidate after fix
        paren_valid_after, _ = validate_parentheses(processed)
        if not paren_valid and paren_valid_after:
            messages.append('✓ Parentheses successfully balanced after auto-fix')
        elif not paren_valid_after:
            # Provide more specific guidance
            messages.append('⚠ PARENTHESIS IMBALANCE DETECTED')
            messages.append('  The graph has mismatched parentheses that need manual correction.')
            messages.append('  Common issues:')
            messages.append('  - Extra closing ) after a node that shouldn\'t close yet')
            messages.append('  - Missing closing ) at the end of branches')
            messages.append('  - The first ( should match with the very last )')
    else:
        paren_valid_after = paren_valid

    # Check overall structure
    struct_valid, struct_issues = validate_umr_structure(processed)

    if not struct_valid:
        for issue in struct_issues:
            messages.append(f"Structure issue: {issue['message']}")

    # Determine final validity
    final_valid = paren_valid_after and struct_valid

    return processed, final_valid, messages


def process_document_annotations(doc_content: str, auto_fix: bool = True) -> Tuple[str, List[Dict]]:
    """
    Process a document containing multiple sentence annotations.

    Args:
        doc_content: Full document content with sentence annotations
        auto_fix: Whether to attempt automatic fixes

    Returns:
        Tuple of (processed_content, sentence_reports)
    """
    # Split into sentences (this is a simplified version, you may need to adjust
    # based on your actual document format)
    sentences = []
    current_sent = []
    reports = []

    lines = doc_content.split('\n')
    sent_id = None

    for line in lines:
        # Check for sentence markers (adjust pattern as needed)
        if line.startswith('# ::snt'):
            if current_sent and sent_id:
                # Process previous sentence
                sent_annotation = '\n'.join(current_sent)
                fixed_annotation, is_valid, messages = validate_and_fix_annotation(sent_annotation, auto_fix)

                reports.append({
                    'sentence_id': sent_id,
                    'valid': is_valid,
                    'messages': messages,
                    'was_fixed': sent_annotation != fixed_annotation
                })

                sentences.append(fixed_annotation)

            # Start new sentence
            current_sent = [line]
            # Extract sentence ID from the line if present
            sent_id = line
        else:
            current_sent.append(line)

    # Process last sentence
    if current_sent and sent_id:
        sent_annotation = '\n'.join(current_sent)
        fixed_annotation, is_valid, messages = validate_and_fix_annotation(sent_annotation, auto_fix)

        reports.append({
            'sentence_id': sent_id,
            'valid': is_valid,
            'messages': messages,
            'was_fixed': sent_annotation != fixed_annotation
        })

        sentences.append(fixed_annotation)

    # Reconstruct document
    processed_content = '\n'.join(sentences) if sentences else doc_content

    return processed_content, reports


# Example usage for testing
if __name__ == "__main__":
    # Test with a sample annotation with unbalanced parentheses
    test_annotation = """(s1b / but-91
    :ARG0 (s1a / and
        :op1 (s112 / individual-person
            :name (s1n / name
                :op1 "阿程")
        :ARG2 (s1x5 / 者
    :ARG1 (s1x / 自杀-01
        :ARG0 (s1a / and
        :place (s1x8 / 酒店
            :quant 1
            :mod (s1c / city
                :name (s1n3 / name
                    :op1 "中山")
                :place (s1p / province
                    :name (s1n4 / name
                        :op1 "广东"))))
        :mod (s1x9 / 晚)
        :temporal (s1d / date-entity
        :aspect performance))"""

    fixed, is_valid, messages = validate_and_fix_annotation(test_annotation)

    print("Original valid:", is_valid)
    print("Messages:", messages)
    print("\nFixed annotation:")
    print(fixed)