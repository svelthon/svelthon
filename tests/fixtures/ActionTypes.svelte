<script lang="python">
# An action handed `1` then `1.0`, or `0.0` then `-0.0`: one number to
# JavaScript, two values to Python, which shows each by its type and its repr.
# `expected` notes each write that changes what Python shows.
value = 1
log = []


def shown(one):
    return type(one).__name__ + ":" + repr(one)


expected = [shown(value)]


def updated(next_value):
    log.append(shown(next_value))


def action(node, initial):
    log.append(shown(initial))
    return {"update": updated}


@export
def write(text):
    global value
    next_value = float(text) if "." in text else int(text)
    if shown(next_value) != shown(value):
        expected.append(shown(next_value))
    value = next_value


@export
def model():
    return [list(log), list(expected)]
</script>

<div use:action={value}></div>
