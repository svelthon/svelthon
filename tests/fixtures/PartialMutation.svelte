<script lang="python">
# `extend` consumes what the generator yielded before it raised, so the list
# holds [1] even though the call did not finish. The notification used to run
# only after a normal return, so the author caught the exception, the data had
# changed, and the page had not.
xs = []
detached = []


def values():
    yield 1
    raise ValueError("stop")


def partial():
    try:
        xs.extend(values())
    except ValueError:
        pass


def partial_detached():
    # The same call with the method taken off the object first, which is the
    # other path into the mechanism.
    add = detached.extend
    try:
        add(values())
    except ValueError:
        pass
</script>

<p data-k="xs">{xs}</p>
<p data-k="detached">{detached}</p>
<button data-k="go" onclick={partial}>partial()</button>
<button data-k="go_detached" onclick={partial_detached}>partial_detached()</button>
