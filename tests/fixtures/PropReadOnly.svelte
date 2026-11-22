<script lang="python">
# Props written through a door of the namespace no rule of the compiler names,
# `__getattribute__`: the door is read-only at run time.
ticket: str
count: int = 3


@export
def edit():
    edit.__getattribute__("__globals__")["ticket"] = "mine"


@export
def edit_default():
    edit.__getattribute__("__globals__")["count"] = 4
</script>

<p>{ticket}|{count}</p>
