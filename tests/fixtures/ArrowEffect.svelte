<script lang="python">
count = 0

doubled => count * 2

# An effect acts on something outside the component; the DOM attribute below is
# read back by the test the way a canvas or a console would be read by an eye.
=> js.document.body.setAttribute("data-seen", str(count))


def bump():
    global count
    count += 1
</script>

<p data-k="count">{count}</p>
<p data-k="doubled">{doubled}</p>
<button onclick={bump}>bump</button>
