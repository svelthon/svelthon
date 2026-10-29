# A store whose root stops itself as it is made, and whose cleanup hands
# JavaScript a global, which JavaScript reads again off the store.
__js__ = {"./early_store_log.js": ["add"], "./early_store_reader.js": ["record"]}
value = 7


@effect.root
@effect.pre
def root():
    root()
    return lambda: record(value)
