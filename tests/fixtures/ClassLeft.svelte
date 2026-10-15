<script lang="python">
# An object that leaves a class, by new bases or by a new `__class__`, read by
# an effect that then writes the class it left, a few times at most; and a
# method its new class is given afterwards.
importjs { log, count } from "./class_runs.js"
how: str = "bases"


class First:
    def __len__(self):
        return 1


class Second:
    def __len__(self):
        return 2


class Holder(First):
    pass


one = Holder()

if how == "bases":
    Holder.__bases__ = (Second,)
else:
    one.__class__ = Second


def replacement(self):
    return 99


@effect
def observe():
    log(len(one))
    if count() < 4:
        First.__len__ = replacement


@export
def change():
    Second.__len__ = replacement
</script>

<output>{len(one)}</output>
