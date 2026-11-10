# An ordinary module that keeps a cache for itself, filled while the page
# renders. The witness is `plain_cache.js`.
seen = {}


def double(k):
    seen[k] = True
    return k * 2


def forget():
    seen.clear()
