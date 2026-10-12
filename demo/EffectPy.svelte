<script lang="python">
# The same effect in both of its spellings, the decorator and the arrow, each at
# the top of the component, where an effect is written. Both run.
n = 0
top_ran = "never"
arrow_ran = "never"


def note(value):
    global arrow_ran
    arrow_ran = "ran, n={}".format(value)


# The arrow is the other spelling of the same thing: an effect with no name. It
# holds an expression, so it calls rather than assigns — and it must not touch a
# name it reads, or it would depend on what it writes.
=> note(n)


@effect
def top():
    global top_ran
    top_ran = "ran, n={}".format(n)


# The third shape, an effect decorated inside a function, is refused at compile
# time, so it cannot be shown running: the page prints its message instead.


def bump():
    global n
    n += 1
</script>

<p>at the top, decorated: <b data-k="top">{top_ran}</b></p>
<p>at the top, arrow: <b data-k="arrow">{arrow_ran}</b></p>
<button onclick={bump}>n = {n} +1</button>
