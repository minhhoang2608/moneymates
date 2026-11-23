"""Entry point for Passenger on Hawk Host (cPanel Python App). Gunicorn-style hosts use config.wsgi directly."""

from config.wsgi import application

__all__ = ["application"]
