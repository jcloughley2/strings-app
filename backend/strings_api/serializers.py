from rest_framework import serializers
from .models import Project, String, Trait, Variable, VariableValue, Conditional

class VariableValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariableValue
        fields = ['id', 'value', 'trait', 'variable']

class VariableSerializer(serializers.ModelSerializer):
    values = VariableValueSerializer(many=True, read_only=True)
    
    class Meta:
        model = Variable
        fields = ['id', 'name', 'variable_type', 'referenced_string', 'content', 'is_conditional', 'values', 'created_at', 'updated_at']

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
    
    class Meta:
        model = String
        fields = ['id', 'content', 'project', 'variables', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

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

class ProjectSerializer(serializers.ModelSerializer):
    strings = StringSerializer(many=True, read_only=True)
    traits = TraitSerializer(many=True, read_only=True)
    variables = VariableSerializer(many=True, read_only=True)
    conditionals = ConditionalSerializer(many=True, read_only=True)
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'strings', 'traits', 'variables', 'conditionals', 'created_at', 'updated_at'] 