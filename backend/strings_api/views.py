
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
from django.db import models
from django.db.models.signals import post_save
from .models import Project, String, Dimension, DimensionValue, StringDimensionValue
from .serializers import (
    ProjectSerializer,
    StringSerializer,
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
                selected_dimension_values
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
    
    def _process_string_content(self, content, project, selected_dimension_values=None):
        """
        Process string content by replacing variable references with their values.
        """
        # Process string variables by replacing {{variableName}} with their content
        processed_content = content
        variable_pattern = re.compile(r'{{([^}]+)}}')
        variables_in_content = variable_pattern.findall(processed_content)
        
        for variable_name in variables_in_content:
            # Try string variable (match by name or hash)
            string_variable = project.strings.filter(
                models.Q(variable_name=variable_name) | models.Q(variable_hash=variable_name)
            ).first()
            
            if string_variable:
                # Recursively process string variable content
                replacement_value = self._process_string_content(
                    string_variable.content, 
                    project, 
                    selected_dimension_values
                )
                processed_content = processed_content.replace(f'{{{{{variable_name}}}}}', replacement_value)
        
        return processed_content
    


    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        """
        Duplicate a project with all its strings, dimensions, and relationships.
        Creates a new project with "Copy of " prepended to the name.
        """
        original_project = self.get_object()
        logger.info(f"Starting duplication of project {original_project.id}: {original_project.name}")
        
        # Create the new project
        new_project = Project.objects.create(
            name=f"Copy of {original_project.name}",
            description=original_project.description,
            user=self.request.user
        )
        logger.info(f"Created new project {new_project.id}: {new_project.name}")
        
        # Dictionary to map old dimension IDs to new dimension IDs
        dimension_mapping = {}
        # Dictionary to map old dimension value IDs to new dimension value IDs
        dimension_value_mapping = {}
        
        # Duplicate all dimensions
        dimensions_count = original_project.dimensions.count()
        logger.info(f"Duplicating {dimensions_count} dimensions")
        
        for dimension in original_project.dimensions.all():
            new_dimension = Dimension.objects.create(
                name=dimension.name,
                project=new_project
            )
            dimension_mapping[dimension.id] = new_dimension.id
            
            # Duplicate all dimension values for this dimension
            dim_values_count = dimension.values.count()
            for dim_value in dimension.values.all():
                new_dimension_value = DimensionValue.objects.create(
                    dimension=new_dimension,
                    value=dim_value.value
                )
                dimension_value_mapping[dim_value.id] = new_dimension_value.id
            logger.info(f"Duplicated dimension '{dimension.name}' with {dim_values_count} values")
        
        # Dictionary to map old string IDs to new string IDs
        string_mapping = {}
        
        # Duplicate all strings
        strings_count = original_project.strings.count()
        logger.info(f"Duplicating {strings_count} strings")
        
        # Temporarily disconnect post_save signal to prevent automatic dimension creation during duplication
        from .models import update_dependent_strings_when_string_variable_changes
        post_save.disconnect(update_dependent_strings_when_string_variable_changes, sender=String)
        
        try:
            for string in original_project.strings.all():
                try:
                    # Create new string preserving the original variable_hash to maintain familiar identifiers
                    try:
                        new_string = String.objects.create(
                            content=string.content,
                            project=new_project,
                            variable_name=string.variable_name,
                            variable_hash=string.variable_hash,  # Preserve original hash
                            is_conditional=string.is_conditional,
                            is_conditional_container=string.is_conditional_container
                        )
                    except Exception as e:
                        # If there's a hash conflict, let it auto-generate a new one
                        if "variable_hash" in str(e) or "unique" in str(e).lower():
                            logger.warning(f"Hash conflict for '{string.variable_hash}', generating new hash")
                            new_string = String.objects.create(
                                content=string.content,
                                project=new_project,
                                variable_name=string.variable_name,
                                # Don't set variable_hash, let it auto-generate
                                is_conditional=string.is_conditional,
                                is_conditional_container=string.is_conditional_container
                            )
                        else:
                            raise
                    
                    string_mapping[string.id] = new_string.id
                    logger.info(f"Duplicated string {string.id} -> {new_string.id} ('{string.effective_variable_name}')")
                    
                    # Duplicate string dimension values
                    sdv_count = string.dimension_values.count()
                    for sdv in string.dimension_values.all():
                        try:
                            # Find the corresponding new dimension value using the mapping
                            if sdv.dimension_value.id in dimension_value_mapping:
                                new_dimension_value_id = dimension_value_mapping[sdv.dimension_value.id]
                                new_dimension_value = DimensionValue.objects.get(id=new_dimension_value_id)
                                
                                # Create the string-dimension value relationship
                                StringDimensionValue.objects.create(
                                    string=new_string,
                                    dimension_value=new_dimension_value
                                )
                            else:
                                logger.warning(f"Could not find mapping for dimension value {sdv.dimension_value.id} ('{sdv.dimension_value.value}') for string {string.id}")
                        except Exception as e:
                            logger.error(f"Failed to duplicate string dimension value for string {string.id}, dimension value '{sdv.dimension_value.value}': {e}")
                            
                    logger.info(f"Duplicated {sdv_count} dimension values for string {new_string.effective_variable_name}")
                    
                except Exception as e:
                    logger.error(f"Failed to duplicate string {string.id}: {e}")
                    raise
        finally:
            # Reconnect the post_save signal
            post_save.connect(update_dependent_strings_when_string_variable_changes, sender=String)
        
        logger.info(f"Duplication completed. New project {new_project.id} has {new_project.strings.count()} strings")
        
        # Return the new project data
        serializer = self.get_serializer(new_project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
