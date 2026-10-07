# A dict keyed by a tuple holding a JavaScript object whose name moves, two
# JavaScript keys one of which takes the other's name, a dict of 400
# JavaScript keys, and one of many strings beside a single JavaScript key.
__js__ = {"./moving_keys.js": ["inner", "first", "second", "third", "unseen", "seen", "late", "cleared", "many"]}
__all__ = [
    "by_tuple", "pair", "large", "mixed", "touch", "enter_third", "values_of_pair",
    "while_unseen", "while_seen", "first_read_late", "through_clear", "take_out", "put_in", "empty",
]

by_tuple = {(inner,): 42}
pair = {first: 1, second: 2}
large = {key: i for i, key in enumerate(many)}
mixed = {"row" + str(i): i for i in range(400)}
mixed[inner] = 99


# A change of the keys of every dict here, unrelated to the keys that moved.
def touch():
    by_tuple["other"] = 0
    pair["other"] = 3


# A key that enters under a name another key already has.
def enter_third():
    pair[third] = 4


def values_of_pair():
    return [pair[first], pair[second], pair["other"]]


# A key taken out and put back while the view is not looking, the same while it
# looks at the dict empty, and a key renamed before the view first looks.
while_unseen = {unseen: 42}
while_seen = {seen: 42}
first_read_late = {late: 42}
through_clear = {cleared: 42}


def take_out(mapping, key):
    del mapping[key]


def empty(mapping):
    mapping.clear()


def put_in(mapping, key):
    mapping[key] = 43
