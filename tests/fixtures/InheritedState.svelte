<script lang="python">
# State on a base class, read through an instance, a subclass, or an instance
# of the base itself, written on the base or shadowed by a class between.
kind: str = "instance"


class Base:
    count = 0
    rows = []


class Middle(Base):
    pass


class Derived(Middle):
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
    elif how == "masked":
        holder.count = 5
        Base.count += 1
    elif how == "shadowed":
        Middle.count = 9
    elif how == "shadowed rows":
        Middle.rows = [1, 2]
    elif how == "shadowed below":
        Derived.count = 9
    else:
        del Middle.count


@export
def held():
    return f"{holder.count}|{len(holder.rows)}"
</script>

<p>{holder.count}|{len(holder.rows)}</p>
