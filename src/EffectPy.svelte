<script lang="python">
# The same effect, twice: once written at the top of the component, once created
# by a function that the component calls while it initialises. Only one of them
# runs.
n = 0
top_ran = "never"
inner_ran = "never"
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


def register():
    # Identical body, one indentation level deeper. The decorator is an identity
    # at run time, so this silently produces a function nobody wired to anything.
    @effect
    def inner():
        global inner_ran
        inner_ran = "ran, n={}".format(n)


register()


def bump():
    global n
    n += 1
</script>

<p>at the top, decorated: <b data-k="top">{top_ran}</b></p>
<p>at the top, arrow: <b data-k="arrow">{arrow_ran}</b></p>
<p>in a function: <b data-k="inner">{inner_ran}</b></p>
<button onclick={bump}>n = {n} +1</button>
