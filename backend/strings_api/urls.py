from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'projects', views.ProjectViewSet, basename='project')
router.register(r'strings', views.StringViewSet, basename='string')
router.register(r'traits', views.TraitViewSet, basename='trait')
router.register(r'variables', views.VariableViewSet, basename='variable')
router.register(r'variable-values', views.VariableValueViewSet, basename='variable-value')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/register/', views.register, name='register'),
    path('auth/password/reset/', views.request_password_reset, name='password-reset-request'),
    path('auth/password/reset/confirm/', views.reset_password, name='password-reset-confirm'),
] 