<script lang="python">
    importjs BytesChild from "./BytesChild.svelte"

    buf = bytearray(b"ab")

    @export
    def grow():
        buf.append(99)
</script>

<BytesChild given={buf} />
