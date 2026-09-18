# Eight classes, all subclasses of list, and in every one of them the storage
# and the sequence are different things — or the class is wrong about what it
# hands back and the script says so.
#
# A Brython list *is* a JavaScript array, so a loop can walk the storage
# directly. These say when it may not.
__all__ = ["rows", "walked", "serialised", "crossed", "nested", "CASES"]


class Real(list):
    # The ordinary way: `__iter__` hands back a real iterator.
    def __iter__(self):
        return iter([3, 2, 1])


class Generated(list):
    # A generator function is an `__iter__` too.
    def __iter__(self):
        yield 3
        yield 2
        yield 1


class Itself(list):
    # Its own iterator, so `iter()` gives back the very array it was asked
    # about: the road that copies an array's storage answers with the storage.
    def __iter__(self):
        self.at = 0
        return self

    def __next__(self):
        self.at += 1
        if self.at > 3:
            raise StopIteration
        return 4 - self.at


class Tagged(list):
    # Adds a name and leaves iteration alone, so its storage *is* its sequence
    # and the fast path is still the right road for it.
    tag = "tagged"


class Plain(list):
    # A list is iterable, and it is not an iterator. `iter()` refuses this.
    def __iter__(self):
        return [3, 2, 1]


class Foreign(list):
    def __iter__(self):
        return 7


class Refuses(list):
    def __iter__(self):
        raise ValueError("not today")


def halting():
    yield 3
    raise ValueError("half way")


class Halts(list):
    # Valid until the second step, which is where a loop already renders.
    def __iter__(self):
        return halting()


CASES = {
    "real": Real,
    "generated": Generated,
    "itself": Itself,
    "tagged": Tagged,
    "plain": Plain,
    "foreign": Foreign,
    "refuses": Refuses,
    "halts": Halts,
}


def rows(name):
    return CASES[name]([1, 2, 3])


def walked(name):
    # What Python itself does with the same object, which is the reference the
    # template has to match, the refusals included.
    try:
        return str([x for x in rows(name)])
    except Exception as error:
        return type(error).__name__


def serialised(name):
    return tojson(rows(name))


# What a module publishes, which JavaScript imports by name: the same object
# again, on the crossing rather than in the loop, and one level down.
crossed = Real([1, 2, 3])
nested = [crossed]
