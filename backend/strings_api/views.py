from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.template.loader import render_to_string
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import Project, String, Trait, Variable, VariableValue
from .serializers import (
    ProjectSerializer,
    StringSerializer,
    TraitSerializer,
    VariableSerializer,
    VariableValueSerializer
)
from rest_framework import serializers
import logging

logger = logging.getLogger(__name__)

@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    
    if user:
        auth_login(request, user)  # This creates the session
        csrf_token = get_token(request)  # Get CSRF token
        logger.info(f'Generated CSRF token for user {username}. Token length: {len(csrf_token)}')
        response = Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'csrfToken': csrf_token,
        })
        
        # Set session cookie
        response.set_cookie(
            'sessionid',
            request.session.session_key,
            domain='localhost',
            samesite='Lax',
            secure=False,  # Set to True in production
            httponly=True
        )
        return response
    else:
        return Response(
            {'error': 'Invalid credentials'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    auth_logout(request)
    response = Response({"detail": "Successfully logged out."})
    
    # Clear session cookie
    response.delete_cookie('sessionid', domain='localhost')
    
    # Clear CSRF cookie
    response.delete_cookie('csrftoken', domain='localhost')
    
    return response

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    
    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = User.objects.create_user(username=username, email=email, password=password)
    
    # Send welcome email
    send_mail(
        'Welcome to Strings',
        'Thank you for registering with Strings. Start creating your string projects today!',
        'noreply@strings.app',
        [email],
        fail_silently=False,
    )
    
    return Response({
        'message': 'User registered successfully',
        'id': user.id,
        'username': user.username,
        'email': user.email
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def request_password_reset(request):
    email = request.data.get('email')
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # We return success even if the email doesn't exist for security
        return Response({'message': 'If an account exists with this email, you will receive password reset instructions.'})
    
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    
    reset_url = f"http://localhost:3000/reset-password/{uid}/{token}"
    
    # Send password reset email
    send_mail(
        'Reset your Strings password',
        f'Click the following link to reset your password: {reset_url}',
        'noreply@strings.app',
        [email],
        fail_silently=False,
    )
    
    return Response({'message': 'Password reset email sent successfully'})

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    uid = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    try:
        uid = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({'error': 'Invalid reset link'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not default_token_generator.check_token(user, token):
        return Response({'error': 'Invalid or expired reset link'}, status=status.HTTP_400_BAD_REQUEST)
    
    user.set_password(new_password)
    user.save()
    
    return Response({'message': 'Password reset successful'})

# Create your views here.

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class StringViewSet(viewsets.ModelViewSet):
    serializer_class = StringSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return String.objects.filter(project__user=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return context

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        project = Project.objects.filter(id=project_id, user=self.request.user).first()
        if not project:
            raise serializers.ValidationError({'project': 'Project not found or you do not have permission to add strings to it.'})
        serializer.save()

class TraitViewSet(viewsets.ModelViewSet):
    serializer_class = TraitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Trait.objects.filter(project__user=self.request.user)

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        project = Project.objects.filter(id=project_id, user=self.request.user).first()
        if not project:
            raise serializers.ValidationError({'project': 'Project not found or you do not have permission to add traits to it.'})
        serializer.save(project=project)

class VariableViewSet(viewsets.ModelViewSet):
    serializer_class = VariableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Variable.objects.filter(project__user=self.request.user)

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        project = Project.objects.filter(id=project_id, user=self.request.user).first()
        if not project:
            raise serializers.ValidationError({'project': 'Project not found or you do not have permission to add variables to it.'})
        serializer.save(project=project)

class VariableValueViewSet(viewsets.ModelViewSet):
    serializer_class = VariableValueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return VariableValue.objects.filter(variable__project__user=self.request.user)
