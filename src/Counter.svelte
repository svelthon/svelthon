<script lang="python">
count = 0

def increment():
    global count
    count += 1
</script>

<button onclick={increment}>compté {count} fois</button>
