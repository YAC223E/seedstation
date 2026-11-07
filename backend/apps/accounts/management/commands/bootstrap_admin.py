from __future__ import annotations

import secrets
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.core.models import AuditEvent


def _credentials_path() -> Path:
    return Path(settings.BASE_DIR) / "instance" / "initial-admin.txt"


class Command(BaseCommand):
    help = "Create the SeedStation administrator account if it does not exist."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reset an existing administrator's password from SEEDSTATION_ADMIN_PASSWORD.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        username = settings.SEEDSTATION_ADMIN_USERNAME
        password = settings.SEEDSTATION_ADMIN_PASSWORD
        email = settings.SEEDSTATION_ADMIN_EMAIL
        generated = False
        if not password:
            password = secrets.token_urlsafe(24)
            generated = True

        user = User.objects.filter(username=username).first()
        if user and not options["reset_password"]:
            self.stdout.write(f"Administrator '{username}' already exists; leaving it unchanged.")
            return
        if user:
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save(update_fields=["password", "is_staff", "is_superuser"])
            self.stdout.write(self.style.SUCCESS(f"Password reset for '{username}'."))
            AuditEvent.objects.create(event="auth.admin_password_reset", metadata={"username": username})
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        AuditEvent.objects.create(event="auth.admin_created", metadata={"username": username})
        self.stdout.write(self.style.SUCCESS(f"Created SeedStation administrator '{username}'."))
        if generated:
            credentials_file = _credentials_path()
            credentials_file.parent.mkdir(parents=True, exist_ok=True)
            credentials_file.write_text(
                f"SeedStation administrator\nusername: {username}\npassword: {password}\n",
                encoding="utf-8",
            )
            credentials_file.chmod(0o600)
            self.stdout.write(
                self.style.WARNING(
                    f"No administrator password was configured. A random one was written to {credentials_file}."
                )
            )
