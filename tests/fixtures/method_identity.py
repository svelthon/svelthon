# A method read off its class is itself however many times it is read, under
# a name the runtime follows (`add`, `__setattr__`, `__getattribute__`) as
# under any other. `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Cart:
    def add(self, item):
        pass


class Box:
    pass


class Own:
    def __getattribute__(self, name):
        return object.__getattribute__(self, name)


def answers():
    box = Box()
    return [
        repr(Cart.add is Cart.add),
        repr(Cart.add == Cart.add),
        repr(len({Cart.add, Cart.add})),
        repr(Box.__setattr__ is object.__setattr__),
        repr(Box.__getattribute__ is object.__getattribute__),
        repr(Own.__getattribute__ is Own.__getattribute__),
        repr(list.append is list.append),
        repr(box.__setattr__ == box.__setattr__),
        repr(list.append is vars(list)["append"]),
        repr(object.__setattr__ is vars(object)["__setattr__"]),
        repr(Own.__getattribute__ is Own.__dict__["__getattribute__"]),
    ]
