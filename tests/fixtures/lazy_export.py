# A JavaScript object with a getter, exported by a module.
__js__ = {"./lazy_config.js": ["make"]}
__all__ = ["config"]

config = make("counting")
