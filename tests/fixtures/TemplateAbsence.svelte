<script lang="python">
ready = False
if ready:
    total = 10

gone = 1
del gone


def describe():
    try:
        return f"total={total}"
    except NameError:
        return "no total"


def deleted():
    try:
        return f"gone={gone}"
    except NameError:
        return "no gone"


@derived
def summary():
    try:
        return f"total={total}"
    except NameError:
        return "no total"
</script>

<p data-k="direct">{total}</p>
<p data-k="call">{describe()}</p>
<p data-k="deleted">{deleted()}</p>
<p data-k="derived">{summary}</p>
<button onclick={lambda: js.templateAbsenceLog.push(describe())}>click</button>
