<script lang="python">
floor = -7 // 2
big = 2 ** 70
words = ", ".join(sorted({"apple", "apricot", "banana"}))

def descend():
    global floor
    floor -= 3
</script>

<p>{floor} · {big} · {words}</p>
<button onclick={descend}>descend</button>
