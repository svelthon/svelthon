# A JavaScript object published again by a Python module: it crosses as the
# object it is, and nothing of it is read on the way.
__js__ = {"./native_service.js": ["service", "config"]}
__all__ = ["direct", "settings"]
direct = service
settings = config
