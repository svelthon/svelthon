<script lang="python">
count = 0
message = "-"

def deep():
    raise ValueError("cassé au fond")

def boom():
    deep()

def caught():
    global message
    try:
        deep()
    except ValueError as e:
        message = f"{type(e).__name__}: {e}"

def works():
    global count
    count += 1
</script>
<p data-k="count">{count}</p>
<p data-k="message">{message}</p>
<button data-k="caught" onclick={caught}>caught</button>
<button data-k="boom" onclick={boom}>boom</button>
<button data-k="works" onclick={works}>works</button>
