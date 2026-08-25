<script lang="python">
    count = 1

    # `=>` is the derived, written the way the state above it is written: one
    # character apart, and that character is "recomputed when something changes".
    doubled => count * 2
    quadrupled => doubled * 2

    # A string is not code, and a comment is not either: neither is rewritten.
    NOTE = """x => y"""

    # The body form stays for anything that needs statements — Svelte's own
    # `$derived.by`, and Python's own `def` beside its `lambda`.
    @derived
    def described():
        if count > 3:
            return "many"
        return "few"

    def bump():
        global count
        count += 1
</script>

<button data-k="bump" onclick={bump}>+</button>
<p data-k="count">{count}</p>
<p data-k="doubled">{doubled}</p>
<p data-k="quadrupled">{quadrupled}</p>
<p data-k="described">{described}</p>
<p data-k="note">{NOTE}</p>
