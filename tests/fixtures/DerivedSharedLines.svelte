<script lang="python">
# Declarations sharing their line with another statement, before or after
# them, and a read of the name between a `:=` and the binding: Python, as
# Python runs it.
base = 1
lined = derived(lambda: base * 2); other = 1
first = 1; overridden = derived(lambda: base * 3); overridden = 99


@derived
def between(ignored=(between := 5), seen=between):
    return base * 4 + seen


@export
def held():
    return f"{lined} {other} {first} {overridden} {between}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{lined} {other} {first} {overridden} {between}</p>
