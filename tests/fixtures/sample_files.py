"""
Test fixtures containing sample UMR files and test data.
"""


def get_simple_english_umr():
    """Return a simple English UMR annotation for testing."""
    return '''################################################################################
# meta-info :: sent_id = english-test-s1
# :: snt1	The cat sat on the mat.
Index: 1   2   3   4  5   6
Words: The cat sat on the mat .

# sentence level graph:
(s1s / sit-01
    :ARG0 (s1c / cat)
    :ARG1 (s1m / mat))

# alignment:
s1s: 3-3
s1c: 2-2
s1m: 6-6

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1s)))
################################################################################'''


def get_multi_sentence_umr():
    """Return a multi-sentence UMR annotation for testing."""
    return '''################################################################################
# meta-info :: sent_id = multi-test-s1
# :: snt1	The dog barked loudly.
Index: 1   2   3      4
Words: The dog barked loudly .

# sentence level graph:
(s1b / bark-01
    :ARG0 (s1d / dog)
    :manner (s1l / loud))

# alignment:
s1b: 3-3
s1d: 2-2
s1l: 4-4

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1b)))
################################################################################

################################################################################
# meta-info :: sent_id = multi-test-s2
# :: snt2	The cat ran away.
Index: 1   2   3   4
Words: The cat ran away .

# sentence level graph:
(s2r / run-02
    :ARG0 (s2c / cat)
    :direction (s2a / away))

# alignment:
s2r: 3-3
s2c: 2-2
s2a: 4-4

# document level annotation:
(s2s0 / sentence
    :temporal ((s1b :before s2r)))
################################################################################'''


def get_chinese_umr():
    """Return a Chinese UMR annotation for testing."""
    return '''################################################################################
# meta-info :: sent_id = chinese-test-s1
# :: snt1	猫坐在垫子上。
Index: 1 2 3 4  5 6
Words: 猫 坐 在 垫 子 上 。

# sentence level graph:
(s1z / 坐-01
    :ARG0 (s1m / 猫)
    :ARG1 (s1d / 垫子))

# alignment:
s1z: 2-2
s1m: 1-1
s1d: 4-5

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1z)))
################################################################################'''


def get_arabic_umr():
    """Return an Arabic UMR annotation for testing."""
    return '''################################################################################
# meta-info :: sent_id = arabic-test-s1
# :: snt1	القطة جلست على الحصيرة.
Index: 1    2    3   4       5
Words: القطة جلست على الحصيرة .

# sentence level graph:
(s1j / جلس-01
    :ARG0 (s1q / قطة)
    :ARG1 (s1h / حصيرة))

# alignment:
s1j: 2-2
s1q: 1-1
s1h: 4-4

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1j)))
################################################################################'''


def get_complex_umr():
    """Return a complex UMR annotation with multiple concepts and relations."""
    return '''################################################################################
# meta-info :: sent_id = complex-test-s1
# :: snt1	John told Mary that he would visit her tomorrow.
Index: 1    2    3    4    5  6     7     8   9
Words: John told Mary that he would visit her tomorrow .

# sentence level graph:
(s1t / tell-01
    :ARG0 (s1j / person :name (s1n / name :op1 "John"))
    :ARG1 (s1m / person :name (s1n2 / name :op1 "Mary"))
    :ARG2 (s1v / visit-01
        :ARG0 s1j
        :ARG1 s1m
        :time (s1to / tomorrow)))

# alignment:
s1t: 2-2
s1j: 1-1
s1m: 3-3
s1v: 7-7
s1to: 9-9

# document level annotation:
(s1s0 / sentence
    :modal ((author :full-affirmative s1t))
    :temporal ((document-creation-time :before s1t)
               (s1t :before s1v)))
################################################################################'''


def get_malformed_umr():
    """Return a malformed UMR for testing error handling."""
    return '''################################################################################
# meta-info :: sent_id = malformed-test-s1
# :: snt1	This is a test sentence.
Index: 1    2  3 4    5
Words: This is a test sentence .

# sentence level graph:
(s1t / test-01
    :ARG0 (s1s / sentence
    # Missing closing parenthesis
    :ARG1 incomplete

# alignment:
s1t: 4-4
# Missing alignment for s1s

# document level annotation:
(s1s0 / sentence
    # Incomplete annotation
################################################################################'''


def get_empty_umr():
    """Return an empty UMR structure for testing."""
    return '''################################################################################
# meta-info :: sent_id = empty-test-s1
# :: snt1	Empty sentence.
Index: 1     2
Words: Empty sentence .

# sentence level graph:
()

# alignment:
s1e: 0-0

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1e)))
################################################################################'''


def get_large_umr():
    """Return a large UMR file for testing performance."""
    content = ""
    for i in range(1, 51):  # 50 sentences
        content += f'''################################################################################
# meta-info :: sent_id = large-test-s{i}
# :: snt{i}	This is sentence number {i}.
Index: 1    2  3        4      {i}
Words: This is sentence number {i} .

# sentence level graph:
(s{i}s / sentence
    :ARG0 (s{i}n / number :value {i}))

# alignment:
s{i}s: 3-3
s{i}n: 4-4

# document level annotation:
(s{i}s0 / sentence
    :temporal ((document-creation-time :before s{i}s)))
################################################################################

'''
    return content


def get_test_project_data():
    """Return test project data for database fixtures."""
    return {
        'title': 'Test UMR Project',
        'description': 'A test project for UMR annotation testing',
        'language': 'en',
        'guidelines': 'Test annotation guidelines'
    }


def get_test_user_data():
    """Return test user data for authentication fixtures."""
    return {
        'username': 'testannotator',
        'email': 'annotator@test.com',
        'password': 'testpass123',
        'is_admin': False,
        'confirmed': True
    }


def get_test_admin_data():
    """Return test admin data for authentication fixtures."""
    return {
        'username': 'testadmin',
        'email': 'admin@test.com',
        'password': 'adminpass123',
        'is_admin': True,
        'confirmed': True
    }


def get_expected_parsed_data():
    """Return expected parsed data structure for parser testing."""
    return {
        'sentences': [
            ['The', 'cat', 'sat', 'on', 'the', 'mat', '.']
        ],
        'sent_annotations': [
            '(s1s / sit-01\n    :ARG0 (s1c / cat)\n    :ARG1 (s1m / mat))'
        ],
        'doc_annotations': [
            '(s1s0 / sentence\n    :temporal ((document-creation-time :before s1s)))'
        ],
        'alignments': [
            {'s1s': ['3-3'], 's1c': ['2-2'], 's1m': ['6-6']}
        ]
    }


# File type test data
VALID_FILE_EXTENSIONS = ['.umr', '.UMR']
INVALID_FILE_EXTENSIONS = ['.txt', '.doc', '.pdf', '.json', '.xml']

# Test error messages
ERROR_MESSAGES = {
    'invalid_format': 'Invalid file format',
    'empty_file': 'File is empty',
    'upload_required': 'Please select a file',
    'login_required': 'Please log in',
    'access_denied': 'Access denied'
}

# Sample annotation templates
ANNOTATION_TEMPLATES = {
    'simple_event': '(s1e / {concept}-01\n    :ARG0 (s1a / {agent})\n    :ARG1 (s1p / {patient}))',
    'simple_entity': '(s1e / {concept}\n    :name (s1n / name :op1 "{name}"))',
    'temporal_relation': ':temporal (({event1} :before {event2}))',
    'modal_relation': ':modal ((author :full-affirmative {event}))'
} 