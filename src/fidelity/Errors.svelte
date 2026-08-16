<script lang="python">
count = 0

def deep():
    raise ValueError("cassé au fond")

def boom():
    deep()

def works():
    global count
    count += 1
</script>
<p data-k="count">{count}</p>
<button data-k="boom" onclick={boom}>boom</button>
<button data-k="works" onclick={works}>works</button>
