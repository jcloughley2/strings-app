from rest_framework import serializers
from .models import Project, String, Trait, Variable, VariableValue, Conditional, Dimension, DimensionValue, StringDimensionValue

class VariableValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariableValue
        fields = ['id', 'value', 'trait', 'variable']

class VariableSerializer(serializers.ModelSerializer):
    values = VariableValueSerializer(many=True, read_only=True)
    
    class Meta:
        model = Variable
        fields = ['id', 'name', 'variable_type', 'referenced_string', 'content', 'is_conditional', 'values', 'created_at', 'updated_at']
    
    def validate(self, data):
        # Check for duplicate variable names within the same project
        name = data.get('name')
        project = data.get('project')
        
        if name and project:
            # For updates, exclude the current instance
            queryset = Variable.objects.filter(name=name, project=project)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            
            if queryset.exists():
                raise serializers.ValidationError({
                    'name': f'A variable with the name "{name}" already exists in this project.'
                })
        
        return data

class TraitSerializer(serializers.ModelSerializer):
    variable_values = VariableValueSerializer(many=True, read_only=True)
    
    class Meta:
        model = Trait
        fields = ['id', 'name', 'project', 'variable_values', 'created_at', 'updated_at']
        extra_kwargs = {
            'project': {'write_only': True}
        }

class StringSerializer(serializers.ModelSerializer):
    variables = VariableSerializer(many=True, read_only=True)
    dimension_values = serializers.SerializerMethodField()
    
    class Meta:
        model = String
        fields = ['id', 'content', 'project', 'variables', 'dimension_values', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_dimension_values(self, obj):
        return StringDimensionValueSerializer(obj.dimension_values.all(), many=True).data

    def create(self, validated_data):
        variables = self.context['request'].data.get('variables', [])
        string = String.objects.create(**validated_data)
        if variables:
            string.variables.set(variables)
        return string

class ConditionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conditional
        fields = ['id', 'name', 'default_value', 'project', 'created_at', 'updated_at']
        extra_kwargs = {
            'project': {'write_only': True}
        }

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
        data = super().to_representation(instance)
        # For reading, include the full dimension value details
        data['dimension_value'] = DimensionValueSerializer(instance.dimension_value).data
        return data

class ProjectSerializer(serializers.ModelSerializer):
    strings = StringSerializer(many=True, read_only=True)
    traits = TraitSerializer(many=True, read_only=True)
    variables = VariableSerializer(many=True, read_only=True)
    conditionals = ConditionalSerializer(many=True, read_only=True)
    dimensions = DimensionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'strings', 'traits', 'variables', 'conditionals', 'dimensions', 'created_at', 'updated_at'] 