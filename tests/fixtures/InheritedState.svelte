<script lang="python">
# State on a base class, read through an instance, a subclass, or an instance
# of the base itself, and written on the base.
kind: str = "instance"


class Base:
    count = 0
    rows = []


class Derived(Base):
    pass


holder = Derived() if kind == "instance" else Derived if kind == "subclass" else Base()


@export
def change(how):
    if how == "augmented":
        Base.count += 1
    elif how == "rebound":
        Base.rows = [1]
    elif how == "append":
        Base.rows.append(1)
    else:
        holder.count = 5
        Base.count += 1


@export
def held():
    return f"{holder.count}|{len(holder.rows)}"
</script>

<p>{holder.count}|{len(holder.rows)}</p>
