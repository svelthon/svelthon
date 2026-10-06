<script lang="python">
    importjs StateViewChild from "./StateViewChild.svelte"

    class Point:
        def __init__(self):
            self.x = 1

    record = {"count": 1}
    point = Point()

    def bump():
        record["count"] += 10
        point.x += 10
</script>

<StateViewChild given={record} {point} />
<button data-k="py" onclick={bump}>py</button>
<p data-k="python">{record["count"]}|{point.x}</p>
