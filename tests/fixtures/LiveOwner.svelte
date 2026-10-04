<script lang="python">
# Python data a JavaScript child reads, given as props and through a context,
# and changed in place on both sides.
importjs LiveReader from "./LiveReader.svelte"
importjs LiveReaderPython from "./LiveReaderPython.svelte"

state = {"count": 0, "rate": 0.5, "inner": {"n": 0}, "none": None}
rows = [1, 2]
shared = {"count": 0}
picked = "-"
set_context("shared", shared)
set_context("whole", state)


@export
def bump():
    state["count"] += 1
    shared["count"] += 1


@export
def add():
    rows.append(3)


@export
def nest():
    state["inner"]["n"] += 1


def pick(given):
    global picked
    picked = f"{type(given).__name__}:{given is state}"
</script>

<p data-k="owner">{state["count"]}|{state["rate"]}|{state["inner"]["n"]}|{",".join(str(one) for one in rows)}|{shared["count"]}</p>
<p data-k="picked">{picked}</p>
<LiveReader {state} {rows} onpick={pick} />
<LiveReaderPython {state} />
