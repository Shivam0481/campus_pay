#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv

if __name__ == "__main__":
    # Load .env so runserver can pick PORT etc.
    load_dotenv()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "campuspay.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
