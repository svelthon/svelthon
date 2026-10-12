<script lang="python">
# An action is updated when the value it is handed changes. To a Python action
# a new instance of a scalar's subclass, the same amount with other fields, is
# a new value; and what its update writes to the component's own state does
# not update it again.
kind: str = "float"


class Money(float):
    pass


class Count(int):
    pass


class Word(str):
    pass


class Record:
    pass


def make(label):
    item = Money(1.0) if kind == "float" else Count(1) if kind == "int" else Word("same") if kind == "str" else Record()
    item.label = label
    return item


value = make("EUR")
log = []


def updated(next_value):
    log.append("update:" + next_value.label)


def action(node, initial):
    log.append("install:" + initial.label)
    return {"update": updated}


@export
def change():
    global value
    value = make("USD")
</script>

<div use:action={value}></div>
<p>{",".join(log)}</p>
