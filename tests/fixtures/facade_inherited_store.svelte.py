constructor: int
toString: int
note: int


def bind():
    global constructor, toString
    constructor = 1
    toString = 2


def unbind():
    global constructor, toString
    del constructor
    del toString
