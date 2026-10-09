<script lang="python">
# State kept on a function's attributes or a class's, or on an instance's, the
# witness: Python lets each hold it, and each mutation below is written in
# Python.
kind: str = "function"


def counter():
    pass


class Box:
    pass


class Tally:
    pass


holder = counter if kind == "function" else Tally if kind == "class" else Box()
holder.count = 0
holder.rows = []


@export
def change(how):
    if how == "augmented":
        holder.count += 1
    elif how == "append":
        holder.rows.append(1)
    elif how == "rebound":
        holder.rows = [1]
    elif how == "vars":
        vars(holder)["count"] = 1
    elif how == "dict":
        holder.__dict__["count"] = 1
    else:
        setattr(holder, "count", 1)


@export
def held():
    return f"{holder.count}|{len(holder.rows)}"


# A class watched is still the class: it makes its instances, and is a type.
@export
def still_a_class():
    return type(holder()) is holder and isinstance(holder, type)
</script>

<p>{holder.count}|{len(holder.rows)}</p>
