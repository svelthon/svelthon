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


def attempt(read):
    try:
        return read()
    except NameError:
        return "NameError"


@derived
def summary():
    try:
        return f"total={total}"
    except NameError:
        return "no total"
</script>

<p data-k="direct">{total}</p>
<p data-k="lambda">{(lambda: total)()}</p>
<p data-k="genexp">{next(total for one in [1])}</p>
<p data-k="lambda-call">{(lambda: describe())()}</p>
<p data-k="fstring">{f"[{total}]"}</p>
<p data-k="str">{str(total)}</p>
<p data-k="is-none">{total is None}</p>
<p data-k="joined">{", ".join(f"{one}{total}" for one in ["a", "b"])}</p>
<p data-k="rendered">{attempt(lambda: total)}</p>
<p data-k="call">{describe()}</p>
<p data-k="deleted">{deleted()}</p>
<p data-k="derived">{summary}</p>
<button onclick={lambda: js.templateAbsenceLog.push(describe())}>click</button>
<button data-k="handler" onclick={lambda: js.templateAbsenceLog.push(attempt(lambda: total))}>handler</button>
