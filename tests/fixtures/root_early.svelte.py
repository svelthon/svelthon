# A root a module stops while its body runs, by its name and through another
# name: its destructor is the name's as soon as its `def` has run.
__js__ = {"./root_early_log.js": ["record"]}
count = 0


@effect.root
def stopped():
    record(count)


stopped()


@effect.root
def captured():
    record(count)


saved = captured
saved()
