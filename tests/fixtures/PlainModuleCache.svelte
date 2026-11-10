<script lang="python">
# An ordinary module's cache, filled from the template and from a derived, and
# emptied by a handler. The witness is `PlainModuleCacheNative.svelte`.
import plain_cache

n = 2
d => plain_cache.double(n)


def go():
    global n
    n += 1


def forget():
    plain_cache.forget()
</script>

<button data-k="go" onclick={go}>go</button>
<button data-k="forget" onclick={forget}>forget</button>
<p data-k="view">{plain_cache.double(n)}|{d}|{len(plain_cache.seen)}</p>
