<script lang="python">
# State kept on a function's attributes, or on an instance's, the witness:
# Python lets either hold it, and each mutation below is written in Python.
kind: str = "function"


def counter():
    pass


class Box:
    pass


holder = counter if kind == "function" else Box()
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
</script>

<p>{holder.count}|{len(holder.rows)}</p>
