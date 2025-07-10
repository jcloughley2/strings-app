from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
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
from .models import Project, String, Trait, Variable, VariableValue, Conditional, Dimension, DimensionValue, StringDimensionValue
from .serializers import (
    ProjectSerializer,
    StringSerializer,
    TraitSerializer,
    VariableSerializer,
    VariableValueSerializer,
    ConditionalSerializer,
    DimensionSerializer,
    DimensionValueSerializer,
    StringDimensionValueSerializer
)
from rest_framework import serializers
import logging
import csv
import io
from django.http import HttpResponse
import re

logger = logging.getLogger(__name__)

@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')

    # If email is provided, look up the username
    if email and not username:
        try:
            user_obj = User.objects.get(email=email)
            username = user_obj.username
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

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
    response.delete_cookie('sessionid')
    
    # Clear CSRF cookie
    response.delete_cookie('csrftoken')
    
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

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
    })

# Create your views here.

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='download-csv')
    def download_csv(self, request, pk=None):
        """
        Download CSV for filtered strings based on current filter state.
        Accepts filter parameters to determine which strings to include.
        """
        project = self.get_object()
        
        # Get filter parameters from request
        trait_id = request.data.get('trait_id', 'blank')
        selected_conditional_variables = request.data.get('selected_conditional_variables', [])
        selected_dimension_values = request.data.get('selected_dimension_values', {})
        
        # Get all strings for the project
        strings = project.strings.all()
        
        # Apply dimension filtering (same logic as frontend)
        if selected_dimension_values:
            filtered_strings = []
            for string in strings:
                # Check if string has dimension values
                if not string.dimension_values.exists():
                    continue  # String has no dimension values, skip it
                
                # Check if string matches ALL selected dimension filters
                matches_all_filters = True
                for dimension_id_str, selected_value in selected_dimension_values.items():
                    if selected_value is None:
                        continue
                    
                    dimension_id = int(dimension_id_str)
                    string_has_matching_value = string.dimension_values.filter(
                        dimension_value__dimension_id=dimension_id,
                        dimension_value__value=selected_value
                    ).exists()
                    
                    if not string_has_matching_value:
                        matches_all_filters = False
                        break
                
                if matches_all_filters:
                    filtered_strings.append(string)
            
            strings = filtered_strings
        
        # Process strings with current filters
        processed_strings = []
        for string in strings:
            processed_content = self._process_string_content(
                string.content, 
                project, 
                trait_id, 
                selected_conditional_variables
            )
            processed_strings.append({
                'id': string.id,
                'original_content': string.content,
                'processed_content': processed_content,
                'created_at': string.created_at
            })
        
        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        headers = ['String ID', 'Original Content', 'Processed Content', 'Created At']
        writer.writerow(headers)
        
        # Write data rows
        for string_data in processed_strings:
            writer.writerow([
                string_data['id'],
                string_data['original_content'],
                string_data['processed_content'],
                string_data['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        # Create HTTP response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{project.name}_filtered_strings.csv"'
        
        return response
    
    def _process_string_content(self, content, project, trait_id, selected_conditional_variables):
        """
        Process string content based on trait and conditional selections.
        Mirrors the frontend string processing logic.
        """
        # First, process conditional variables - remove unselected conditionals
        processed_content = self._process_conditional_variables(content, project, selected_conditional_variables)
        
        # Then process trait and string variables
        variable_pattern = re.compile(r'{{([^}]+)}}')
        variables_in_content = variable_pattern.findall(processed_content)
        
        for variable_name in variables_in_content:
            try:
                variable = project.variables.get(name=variable_name)
                replacement_value = self._get_variable_replacement(variable, trait_id, project)
                
                if replacement_value is not None:
                    processed_content = processed_content.replace(f'{{{{{variable_name}}}}}', replacement_value)
                
            except Variable.DoesNotExist:
                # Variable not found, leave as is
                continue
        
        return processed_content
    
    def _process_conditional_variables(self, content, project, selected_conditional_variables):
        """
        Remove conditional variables that are not selected.
        """
        variable_pattern = re.compile(r'{{([^}]+)}}')
        variables_in_content = variable_pattern.findall(content)
        processed_content = content
        
        for variable_name in variables_in_content:
            try:
                variable = project.variables.get(name=variable_name)
                if variable.is_conditional and str(variable.id) not in selected_conditional_variables:
                    # Remove this conditional variable from content
                    processed_content = processed_content.replace(f'{{{{{variable_name}}}}}', '')
                    
            except Variable.DoesNotExist:
                continue
        
        return processed_content
    
    def _get_variable_replacement(self, variable, trait_id, project):
        """
        Get the replacement value for a variable based on trait selection.
        """
        if variable.variable_type == 'string':
            # For string variables, get the referenced string content
            if variable.referenced_string:
                return variable.referenced_string.content
            elif variable.content:
                return variable.content
            else:
                return f'{{{{{variable.name}}}}}'  # Return original if no content
        
        elif variable.variable_type == 'trait':
            if trait_id == 'blank':
                # When blank trait is selected, show variable name
                return f'{{{{{variable.name}}}}}'
            else:
                # Get value for specific trait
                try:
                    trait = project.traits.get(id=trait_id)
                    variable_value = variable.values.get(trait=trait)
                    return variable_value.value
                except (Trait.DoesNotExist, VariableValue.DoesNotExist):
                    return f'{{{{{variable.name}}}}}'  # Return original if no value
        
        return f'{{{{{variable.name}}}}}'  # Default fallback

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

class ConditionalViewSet(viewsets.ModelViewSet):
    serializer_class = ConditionalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conditional.objects.filter(project__user=self.request.user)

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        project = Project.objects.filter(id=project_id, user=self.request.user).first()
        if not project:
            raise serializers.ValidationError({'project': 'Project not found or you do not have permission to add conditionals to it.'})
        serializer.save(project=project)

class DimensionViewSet(viewsets.ModelViewSet):
    serializer_class = DimensionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Dimension.objects.filter(project__user=self.request.user)

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        project = Project.objects.filter(id=project_id, user=self.request.user).first()
        if not project:
            raise serializers.ValidationError({'project': 'Project not found or you do not have permission to add dimensions to it.'})
        serializer.save(project=project)

class DimensionValueViewSet(viewsets.ModelViewSet):
    serializer_class = DimensionValueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DimensionValue.objects.filter(dimension__project__user=self.request.user)

    def perform_create(self, serializer):
        dimension_id = self.request.data.get('dimension')
        dimension = Dimension.objects.filter(id=dimension_id, project__user=self.request.user).first()
        if not dimension:
            raise serializers.ValidationError({'dimension': 'Dimension not found or you do not have permission to add values to it.'})
        serializer.save()

class StringDimensionValueViewSet(viewsets.ModelViewSet):
    serializer_class = StringDimensionValueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = StringDimensionValue.objects.filter(string__project__user=self.request.user)
        
        # Filter by string if provided
        string_id = self.request.query_params.get('string', None)
        if string_id is not None:
            queryset = queryset.filter(string=string_id)
            
        return queryset
