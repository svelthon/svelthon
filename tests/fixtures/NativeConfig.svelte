<script lang="python">
# A component that hands a JavaScript library's configuration back to its
# consumer without touching its callbacks, which is what a thin wrapper around a
# library looks like.
__js__ = {"./native_config.js": ["config"]}


@export
def native():
    return config()


@export
def kept_config():
    # One dictionary, one function, handed back at every call: what a consumer
    # sees twice has to be the same function, or it cannot take back what it
    # registered.
    return HELD


@export
def python_config():
    # The witness beside it: the same shape, callbacks written in Python, which
    # must keep being adapted.
    return {"duration": 400, "easing": square}


def square(t):
    return t * t


HELD = {"easing": square, "duration": 400}
</script>

<p data-k="ready">ready</p>
