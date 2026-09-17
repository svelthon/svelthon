<script lang="python">
# A component that hands a JavaScript library's configuration back to its
# consumer without touching its callbacks, which is what a thin wrapper around a
# library looks like.
__js__ = {"./native_config.js": ["config"]}


@export
def native():
    return config()


@export
def python_config():
    # The witness beside it: the same shape, callbacks written in Python, which
    # must keep being adapted.
    return {"duration": 400, "easing": square}


def square(t):
    return t * t
</script>

<p data-k="ready">ready</p>
