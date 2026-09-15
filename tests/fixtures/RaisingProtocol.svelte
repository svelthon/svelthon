<script lang="python">
# `__bool__` and `__str__` are the author's code, and the template calls both.
# When they raise, the template used to answer anyway: the condition took the
# true branch and the interpolation rendered `[object Object]`.
class Bad:
    def __bool__(self):
        raise ValueError("BOOL_ERROR")

    def __str__(self):
        raise ValueError("STR_ERROR")


class Fine:
    def __bool__(self):
        return False

    def __str__(self):
        return "ok"


bad = Bad()
fine = Fine()
shown: bool = False
</script>

<p data-k="fine">{fine}</p>
{#if fine}<p data-k="taken">yes</p>{/if}

{#if shown}
    {#if bad}<p data-k="bool">TRUE BRANCH</p>{/if}
    <p data-k="str">{bad}</p>
{/if}
