<script lang="python">
count = 0
other = 0

seen = "-"
torn = "-"

@effect
def watch():
    # Reading `count` is enough to subscribe to it: nothing to declare.
    global seen
    seen = f"count={count}"

    def cleanup():
        # A plain assignment: it need not read back the name it writes.
        global torn
        torn = f"torn at {count}"

    return cleanup

def bump():
    global count
    count += 1

def bump_other():
    global other
    other += 1
</script>

<p data-k="seen">{seen}</p>
<p data-k="torn">{torn}</p>
<p data-k="other">{other}</p>
<button data-k="bump" onclick={bump}>bump</button>
<button data-k="other" onclick={bump_other}>other</button>
