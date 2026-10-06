<script lang="python">
    importjs SyncedInstanceChild from "./SyncedInstanceChild.svelte"

    class Counter:
        def __init__(self):
            self.count = 0

    counter = Counter()

    @export
    def bump():
        counter.count += 1

    @export
    def count():
        return counter.count
</script>

<SyncedInstanceChild given={counter} />
