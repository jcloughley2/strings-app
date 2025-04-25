from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
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
        
        # Ensure the session cookie is properly set
        response.set_cookie(
            'sessionid',
            request.session.session_key,
            domain='localhost',
            samesite='Lax',
            secure=False,  # Set to True in production with HTTPS
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
