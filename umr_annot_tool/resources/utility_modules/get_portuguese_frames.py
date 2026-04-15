"""Convert VerboBrasil PropBank-Br XML framefiles into frames_portuguese.json.

Source XML lives in resources/source_framefiles/portuguese/ (one *-v.xml file per
lemma, plus a frameset.dtd). Each file may contain multiple <predicate> blocks,
each with one or more <roleset id="lemma.NN"> entries.

Output schema (rich, language-extensible):

    {
      "<lemma>-NN": {
        "args":     {"ARG0": "...", "ARG1": "..."},
        "argm":     {"M-MED": "medium", "M-DIR": "..."},  # optional
        "vncls":    "51.2",                                # optional
        "framnet":  "abandon.01",                          # optional
        "examples": [                                      # optional
          {"text": "...", "args": {"ARG0": "...", "REL": "..."}}
        ]
      }
    }

Consumers should detect the schema by checking for an "args" key. Older
frames_*.json files (flat ARGn -> description) remain valid and are handled
via shape detection in the JS/Python consumers.

ArgM-style modifier roles (n="M"/"m"/"A") are mapped under "argm" using the
PropBank functional tag (role attribute @f) when present, falling back to
M-<n>. The empty n="" entries in the source are skipped (no semantic role).
"""
import json
import os
import re
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
RESOURCES = os.path.dirname(HERE)
SRC_DIR = os.path.join(RESOURCES, "source_framefiles", "portuguese")
OUT_PATH = os.path.join(RESOURCES, "frames_portuguese.json")

WHITESPACE_RE = re.compile(r"\s+")


def clean(text):
    if not text:
        return ""
    return WHITESPACE_RE.sub(" ", text).strip()


def parse_example(example_el):
    text_el = example_el.find("text")
    text = clean(text_el.text) if text_el is not None else ""
    arg_map = {}
    for arg in example_el.findall("arg"):
        n = (arg.attrib.get("n") or "").strip()
        if not n:
            continue
        # n can be 0..9, "m" (modifier), "M", or letters; key as ARGn / ARGM-<f>
        if n.isdigit():
            key = f"ARG{n}"
        elif n.lower() == "m":
            f = (arg.attrib.get("f") or "").strip()
            key = f"ARGM-{f.upper()}" if f else "ARGM"
        else:
            key = f"ARG{n.upper()}"
        arg_map[key] = clean(arg.text)
    rel_el = example_el.find("rel")
    if rel_el is not None:
        arg_map["REL"] = clean(rel_el.text)
    return {"text": text, "args": arg_map}


def convert():
    frames = {}
    skipped_files = []

    for filename in sorted(os.listdir(SRC_DIR)):
        if not filename.endswith(".xml"):
            continue
        try:
            tree = ET.parse(os.path.join(SRC_DIR, filename))
        except ET.ParseError as e:
            skipped_files.append((filename, str(e)))
            continue

        for predicate in tree.getroot().findall("predicate"):
            lemma = (predicate.attrib.get("lemma") or "").strip()
            if not lemma:
                continue
            for roleset in predicate.findall("roleset"):
                rid = (roleset.attrib.get("id") or "").strip()
                if "." not in rid:
                    continue
                _, sense = rid.rsplit(".", 1)
                key = f"{lemma}-{sense}"

                args = {}
                argm = {}
                for role in roleset.findall("roles/role"):
                    n = (role.attrib.get("n") or "").strip()
                    descr = clean(role.attrib.get("descr"))
                    if not descr:
                        continue
                    if n.isdigit():
                        args[f"ARG{n}"] = descr
                    elif n.lower() in ("m", "a"):
                        # ArgM-style modifier; key by functional tag if present
                        f_tag = (role.attrib.get("f") or "").strip()
                        mkey = f"M-{f_tag.upper()}" if f_tag else f"M-{n.upper()}"
                        # disambiguate collisions by appending an index
                        base = mkey
                        i = 2
                        while mkey in argm:
                            mkey = f"{base}{i}"
                            i += 1
                        argm[mkey] = descr

                entry = {"args": args}
                if argm:
                    entry["argm"] = argm
                vncls = (roleset.attrib.get("vncls") or "").strip()
                if vncls:
                    entry["vncls"] = vncls
                framnet = (roleset.attrib.get("framnet") or "").strip()
                if framnet:
                    entry["framnet"] = framnet
                name = (roleset.attrib.get("name") or "").strip()
                if name:
                    entry["name"] = name

                examples = [parse_example(ex) for ex in roleset.findall("example")]
                examples = [e for e in examples if e["text"]]
                if examples:
                    entry["examples"] = examples

                frames[key] = entry

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(frames, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"Wrote {len(frames)} rolesets to {OUT_PATH}")
    if skipped_files:
        print(f"Skipped {len(skipped_files)} unparseable file(s):")
        for fn, err in skipped_files:
            print(f"  {fn}: {err}")


if __name__ == "__main__":
    convert()
