<script lang="python">
count = 7

def increment():
    global count
    count += 1
</script>

<button onclick={increment}>compté {count} fois</button>
