__js__ = {"./returned_function.js": ["decimal", "factory", "objectFactory", "callbackFactory", "marked", "same", "checker"]}
__all__ = ["direct", "returned", "member", "called", "stable", "handed_back", "handed_to_member", "kept", "kept_marked"]


def direct():
    return decimal(0.25)


def returned():
    return factory()(0.25)


def member():
    return objectFactory().decimal(0.25)


def zero():
    return 7


def called():
    return callbackFactory()(zero)


def stable():
    return factory() is factory()


def handed_back():
    return same(factory())


def handed_to_member():
    return checker().same(factory())


kept = factory()
kept_marked = marked()
