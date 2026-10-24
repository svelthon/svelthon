<script lang="python">
# A declaration whose decorator raises: the derived is never written.
def decorate(fn):
    raise ValueError("rejected")


@decorate
@derived
def broken():
    return 7
</script>

<p>{broken}</p>
