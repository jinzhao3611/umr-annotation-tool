# this is used to check the format of Julia's lexicon file (Dictionary.txt)

def check_toolbox_lexicon_file(toolbox_lexicon_path):
    loaded_frames_dict = {}

    with open(toolbox_lexicon_path, "r") as f:
        toolbox_lexicon = f.read().split("\n\n")

    keys = set()
    for lx_block in toolbox_lexicon[1:]:
        lx_word = ""
        for line in lx_block.strip().split("\n"):
            try:
                k, v = line.strip().split(" ", 1)
            except ValueError:
                k = line.strip()
                v = ""

            try:
                if k == '\lx':
                    lx_word = v
                    loaded_frames_dict[lx_word] = {}
                else:
                    loaded_frames_dict[lx_word][k] = v

            except KeyError:
                print("KeyError from parsing toolbox lexicon file")
                print(lx_block)
                print("********")

    print(loaded_frames_dict)




