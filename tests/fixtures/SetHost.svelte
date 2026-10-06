<script lang="python">
    importjs SetChild from "./SetChild.svelte"

    picked = {"a"}

    @export
    def pick(name):
        picked.add(name)
</script>

<SetChild {picked} />
