<script lang="python">
# A set filled by toggling one member at a time.
n: int = 10000
bag = set()


def fill():
    for i in range(n):
        bag.symmetric_difference_update({i})
</script>

<button onclick={fill}>fill</button>
<p>{len(bag)}</p>
