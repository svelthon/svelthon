<script lang="python">
# The names of `inherited_names.py`, in a component.
bound = 1

if not bound:
    class toString:
        pass

at_top = []
try:
    constructor
    at_top.append("constructor")
except NameError:
    pass
try:
    toString
    at_top.append("toString")
except NameError:
    pass
try:
    valueOf
    at_top.append("valueOf")
except NameError:
    pass
try:
    bound
    at_top.append("bound")
except NameError:
    pass


def inside():
    found = []
    reads = [
        ("constructor", lambda: constructor),
        ("toString", lambda: toString),
        ("hasOwnProperty", lambda: hasOwnProperty),
        ("valueOf", lambda: valueOf),
        ("bound", lambda: bound),
    ]
    for name, read in reads:
        try:
            read()
            found.append(name)
        except NameError:
            pass
    return found
</script>

<output>{" ".join(at_top)}|{" ".join(inside())}</output>
