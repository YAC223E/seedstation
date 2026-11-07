from django.contrib import admin

from .models import AppSettings, AuditEvent, TelemetrySample


@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ("download_dir", "max_active_downloads", "updated_at")

    def has_add_permission(self, request):
        return not AppSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TelemetrySample)
class TelemetrySampleAdmin(admin.ModelAdmin):
    list_display = ("created_at", "engine_online", "download_speed", "upload_speed", "active_torrents")
    list_filter = ("engine_online",)
    date_hierarchy = "created_at"


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "event", "actor", "ip_address")
    list_filter = ("event",)
    search_fields = ("event", "ip_address")
    readonly_fields = ("created_at", "event", "actor", "ip_address", "metadata")

    def has_add_permission(self, request):
        return False
