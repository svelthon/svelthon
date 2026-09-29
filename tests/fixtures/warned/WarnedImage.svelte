<script lang="python">
count = 0


def bump():
    global count
    count += 1
</script>

<button onclick={bump}>{count}</button>
<p>markup below a Python script</p>
<img src="x.png">
