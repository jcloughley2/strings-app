from django.apps import AppConfig


class StringsApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'strings_api'
    
    def ready(self):
        # Import signals to ensure they are registered
        import strings_api.models
