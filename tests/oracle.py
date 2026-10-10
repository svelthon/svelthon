"""The CPython half of the differential oracle.

Runs the Python script of the component named on the command line once per
case of its `CASES`, `kind` set to the case, as a mount does: the model read,
then `change(1)` and `change(2)`, each followed by the model read again. Prints
`{case: [read, read, read]}` as JSON. A case whose write CPython refuses is
none: no page has a right answer for it.
"""

import json
import re
import sys

STEPS = 2

path = sys.argv[1]
with open(path, encoding="utf-8") as source:
    script = re.search(r'<script lang="python">\n(.*?)</script>', source.read(), re.S).group(1)

code = compile(script, path, "exec")


def namespace(kind):
    space = {"__name__": "oracle", "kind": kind, "export": lambda function: function}
    exec(code, space)
    return space


def run(kind):
    space = namespace(kind)
    seen = [space["model"]()]

    for step in range(1, STEPS + 1):
        space["change"](step)
        seen.append(space["model"]())

    return seen


results = {}

for kind in namespace("")["CASES"]:
    try:
        results[kind] = run(kind)
    except Exception:
        continue

print(json.dumps(results))
