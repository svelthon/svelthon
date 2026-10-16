<script lang="python">
# A Python child of the mounted crossing matrix: what it received as a prop,
# and through the context.
importjs { seen } from "./door_matrix_log.js"

value: object = "absent"

SHOWN = ("NoneType", "bool", "int", "float", "str", "Text", "bytes", "list", "tuple", "dict", "set", "frozenset")


def described(got):
    name = type(got).__name__
    return f"{name}:{got!r}" if name in SHOWN else name


seen.append(["python", described(value)])
seen.append(["python-context", described(get_context("crossing"))])
</script>
