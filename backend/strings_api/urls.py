from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'projects', views.ProjectViewSet, basename='project')
router.register(r'strings', views.StringViewSet, basename='string')
router.register(r'dimensions', views.DimensionViewSet, basename='dimension')
router.register(r'dimension-values', views.DimensionValueViewSet, basename='dimension-value')
router.register(r'string-dimension-values', views.StringDimensionValueViewSet, basename='string-dimension-value')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/register/', views.register, name='register'),
    path('auth/password/reset/', views.request_password_reset, name='password-reset-request'),
    path('auth/password/reset/confirm/', views.reset_password, name='password-reset-confirm'),
    path('auth/me/', views.me, name='me'),
    path('registry/', views.registry, name='registry'),
    path('settings/openai/', views.openai_settings, name='openai-settings'),
    path('settings/openai/test/', views.test_openai_connection, name='test-openai-connection'),
    path('settings/openai/check/', views.check_openai_configured, name='check-openai-configured'),
    path('ai/extract-text/', views.extract_text_from_image, name='extract-text-from-image'),
    path('ai/style-guide/', views.generate_style_guide, name='generate-style-guide'),
] 