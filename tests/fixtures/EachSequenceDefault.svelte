<script lang="python">
# A name read off a sequence by a target with a default: the sequence refuses a
# string key, which says it holds no such name, a subclass's as much. A
# `__getitem__` of the author's that refuses says something else.
kind: str = "list"


class Rows(list):
    pass


class Pair(tuple):
    pass


class Text(str):
    pass


class Raw(bytes):
    pass


class Refusing(list):
    def __getitem__(self, key):
        raise TypeError("custom refusal")


def made():
    if kind == "list":
        return [1]
    if kind == "list subclass":
        return Rows([1])
    if kind == "tuple":
        return (1,)
    if kind == "tuple subclass":
        return Pair((1,))
    if kind == "str":
        return "a"
    if kind == "str subclass":
        return Text("a")
    if kind == "bytes":
        return b"a"
    if kind == "bytes subclass":
        return Raw(b"a")
    return Refusing([1])
</script>

{#each [made()] as {missing=7}}<output>{missing}</output>{/each}
