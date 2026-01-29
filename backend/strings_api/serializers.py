from rest_framework import serializers
from .models import Project, String, Dimension, DimensionValue, StringDimensionValue
import re
from django.db import models

class StringSerializer(serializers.ModelSerializer):
    dimension_values = serializers.SerializerMethodField()
    effective_variable_name = serializers.ReadOnlyField()
    controlled_by_spawn_id = serializers.PrimaryKeyRelatedField(
        source='controlled_by_spawn',
        queryset=String.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = String
        fields = ['id', 'content', 'project', 'variable_name', 'variable_hash', 'display_name', 'effective_variable_name', 'is_conditional', 'is_conditional_container', 'controlled_by_spawn_id', 'is_published', 'dimension_values', 'created_at', 'updated_at']
        # variable_hash is now editable (but validated), display_name and variable_name are deprecated
        read_only_fields = ['id', 'variable_name', 'effective_variable_name', 'created_at', 'updated_at']
        # Disable automatic unique_together validation since variable_name is synced with variable_hash
        validators = []
    
    def get_dimension_values(self, obj):
        return StringDimensionValueSerializer(obj.dimension_values.all(), many=True).data

    def validate(self, data):
        # Validate variable_hash format if provided
        variable_hash = data.get('variable_hash')
        if variable_hash:
            # Must be alphanumeric with optional hyphens, no spaces, reasonable length
            if not re.match(r'^[A-Za-z0-9][A-Za-z0-9\-]*$', variable_hash):
                raise serializers.ValidationError({
                    'variable_hash': 'Hash must start with a letter or number and contain only letters, numbers, and hyphens (no spaces).'
                })
            if len(variable_hash) > 50:
                raise serializers.ValidationError({
                    'variable_hash': 'Hash must be 50 characters or less.'
                })
            # Check for uniqueness within the project
            project = data.get('project') or (self.instance.project if self.instance else None)
            if project:
                existing = String.objects.filter(
                    project=project,
                    variable_hash=variable_hash
                )
                if self.instance:
                    existing = existing.exclude(id=self.instance.id)
                if existing.exists():
                    raise serializers.ValidationError({
                        'variable_hash': f'A variable with hash "{variable_hash}" already exists in this project.'
                    })
        
        project = data.get('project')
        content = data.get('content', '')
        
        # Check for circular references in string variables
        if content and project:
            circular_error = self._detect_circular_references(content, project, self.instance.id if self.instance else None)
            if circular_error:
                raise serializers.ValidationError({
                    'content': circular_error
                })
        
        return data
    
    def _detect_circular_references(self, content, project, current_string_id=None, visited=None):
        """
        Detect circular references in string variables.
        Returns error message if circular reference found, None otherwise.
        """
        if visited is None:
            visited = set()
        
        # Extract variable names from content
        variable_pattern = re.compile(r'{{([^}]+)}}')
        variable_names = variable_pattern.findall(content)
        
        for variable_name in variable_names:
            # Find the string variable that matches this variable name
            string_variable = project.strings.filter(
                models.Q(variable_name=variable_name) | models.Q(variable_hash=variable_name)
            ).first()
            
            # Calculate effective variable name for comparison
            if string_variable:
                effective_name = string_variable.variable_name if string_variable.variable_name else string_variable.variable_hash
                if effective_name == variable_name:
                    # Check if this would create a self-reference
                    if current_string_id and string_variable.id == current_string_id:
                        return f'String cannot reference itself through variable "{{{{ {variable_name} }}}}"'
                    
                    # Check if we've already visited this string (circular reference)
                    if string_variable.id in visited:
                        return f'Circular reference detected involving variable "{{{{ {variable_name} }}}}"'
                    
                    # Add current string to visited set and recursively check
                    new_visited = visited.copy()
                    if current_string_id:
                        new_visited.add(current_string_id)
                    new_visited.add(string_variable.id)
                    
                    nested_error = self._detect_circular_references(
                        string_variable.content, project, string_variable.id, new_visited
                    )
                    if nested_error:
                        return nested_error
        
        return None

    def create(self, validated_data):
        string = String.objects.create(**validated_data)
        return string

    def update(self, instance, validated_data):
        # Update the string
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance



class DimensionValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = DimensionValue
        fields = ['id', 'value', 'dimension', 'created_at', 'updated_at']
    
    def validate(self, data):
        # Check for duplicate dimension values within the same dimension
        value = data.get('value')
        dimension = data.get('dimension')
        
        if value and dimension:
            # For updates, exclude the current instance
            queryset = DimensionValue.objects.filter(value=value, dimension=dimension)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            
            if queryset.exists():
                raise serializers.ValidationError({
                    'value': f'A dimension value "{value}" already exists for this dimension.'
                })
        
        return data

class DimensionSerializer(serializers.ModelSerializer):
    values = DimensionValueSerializer(many=True, read_only=True)
    
    class Meta:
        model = Dimension
        fields = ['id', 'name', 'project', 'values', 'created_at', 'updated_at']
        extra_kwargs = {
            'project': {'write_only': True}
        }
    
    def validate(self, data):
        # Check for duplicate dimension names within the same project
        name = data.get('name')
        project = data.get('project')
        
        if name and project:
            # For updates, exclude the current instance
            queryset = Dimension.objects.filter(name=name, project=project)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            
            if queryset.exists():
                raise serializers.ValidationError({
                    'name': f'A dimension with the name "{name}" already exists in this project.'
                })
        
        return data

class StringDimensionValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = StringDimensionValue
        fields = ['id', 'string', 'dimension_value', 'created_at']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Include dimension value details
        representation['dimension_value_detail'] = {
            'id': instance.dimension_value.id,
            'value': instance.dimension_value.value,
            'dimension': instance.dimension_value.dimension.id
        }
        return representation

class ProjectSerializer(serializers.ModelSerializer):
    strings = serializers.SerializerMethodField()
    dimensions = DimensionSerializer(many=True, read_only=True)
    
    def get_strings(self, obj):
        # Explicitly order strings by creation date (newest first)
        strings = obj.strings.order_by('-created_at')
        return StringSerializer(strings, many=True).data
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'strings', 'dimensions', 'created_at', 'updated_at'] 