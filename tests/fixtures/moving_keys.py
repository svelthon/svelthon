# A dict keyed by a tuple holding a JavaScript object whose name moves, two
# JavaScript keys one of which takes the other's name, a dict of 400
# JavaScript keys, and one of many strings beside a single JavaScript key.
__js__ = {"./moving_keys.js": ["inner", "first", "second", "many"]}
__all__ = ["by_tuple", "pair", "large", "mixed", "touch", "values_of_pair"]

by_tuple = {(inner,): 42}
pair = {first: 1, second: 2}
large = {key: i for i, key in enumerate(many)}
mixed = {"row" + str(i): i for i in range(400)}
mixed[inner] = 99


# A change of the keys of every dict here, which names them again.
def touch():
    by_tuple["other"] = 0
    pair["other"] = 0


def values_of_pair():
    return [pair[first], pair[second]]
