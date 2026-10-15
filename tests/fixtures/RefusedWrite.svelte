<script lang="python">
# A write the template makes to the component's state, which Svelte refuses
# while it renders, caught by the author or not.
importjs { keep } from "./kept.js"
kind: str = "list"
catching: bool = False


class Box:
    def __init__(self):
        self.n = 0


rows = [] if kind == "list" else {"n": 0} if kind == "dict" else Box()
keep(rows)


def held():
    return len(rows) if kind == "list" else rows["n"] if kind == "dict" else rows.n


def write():
    try:
        if kind == "list":
            rows.append(1)
        elif kind == "dict":
            rows["n"] = 1
        else:
            rows.n = 1
    except Exception:
        if not catching:
            raise
        return held()
    return "written"
</script>

<p>{held()}</p>
<output>{write()}</output>
