import re
import secrets
import string
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')

    def __str__(self):
        return self.name

class String(models.Model):
    content = models.TextField(blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='strings')
    # Every string is now automatically a variable with either a hash or custom name
    variable_name = models.CharField(max_length=100, blank=True, null=True)
    variable_hash = models.CharField(max_length=6, blank=True)
    is_conditional = models.BooleanField(default=False)
    # Add explicit field to identify conditionals (directory containers)
    is_conditional_container = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['variable_name', 'project']

    def save(self, *args, **kwargs):
        # Generate hash for new strings if not provided
        if not self.variable_hash:
            self.variable_hash = self.generate_unique_hash()
        super().save(*args, **kwargs)

    def generate_unique_hash(self):
        """Generate a unique 6-character hash for this string"""
        while True:
            # Generate 6-character hash using uppercase letters and numbers
            hash_chars = string.ascii_uppercase + string.digits
            new_hash = ''.join(secrets.choice(hash_chars) for _ in range(6))
            
            # Check if hash is unique
            if not String.objects.filter(variable_hash=new_hash).exists():
                return new_hash

    @property
    def effective_variable_name(self):
        """Return the variable name if set, otherwise return the hash"""
        return self.variable_name if self.variable_name else self.variable_hash

    def __str__(self):
        var_name = self.effective_variable_name
        return f"Variable: {var_name} ({self.project.name})"
    
    def update_dimension_values_from_variables(self):
        """
        Automatically assign dimension values to this string based on the 
        dimension values of string variables used in its content.
        This method only adds inherited dimension values - it doesn't remove manually added ones.
        """
        # Extract variable names from content
        variable_pattern = re.compile(r'{{([^}]+)}}')
        variable_names = variable_pattern.findall(self.content)
        
        if not variable_names:
            return
        
        # Get all dimension values that should be assigned to this string
        dimension_values_to_assign = set()
        
        for variable_name in variable_names:
            # Try to find as a string variable (using either name or hash)
            string_variable = self.project.strings.filter(
                models.Q(variable_name=variable_name) | models.Q(variable_hash=variable_name)
            ).first()
            
            if string_variable:
                # Recursively get dimension values from the string variable's content
                string_variable.update_dimension_values_from_variables()
                for str_dim_value in string_variable.dimension_values.all():
                    dimension_values_to_assign.add(str_dim_value.dimension_value)
        
        # Get current dimension values
        current_dimension_values = set(
            sdv.dimension_value for sdv in self.dimension_values.all()
        )
        
        # Only add new inherited dimension values - don't remove existing ones
        # (Manual removal is handled by the frontend/API calls)
        for dimension_value in dimension_values_to_assign - current_dimension_values:
            StringDimensionValue.objects.get_or_create(
                string=self,
                dimension_value=dimension_value
            )

class Conditional(models.Model):
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='conditionals')
    default_value = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class Dimension(models.Model):
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='dimensions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['name', 'project']

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class DimensionValue(models.Model):
    dimension = models.ForeignKey(Dimension, on_delete=models.CASCADE, related_name='values')
    value = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['dimension', 'value']

    def __str__(self):
        return f"{self.dimension.name}: {self.value}"

class StringDimensionValue(models.Model):
    string = models.ForeignKey(String, on_delete=models.CASCADE, related_name='dimension_values')
    dimension_value = models.ForeignKey(DimensionValue, on_delete=models.CASCADE, related_name='string_assignments')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['string', 'dimension_value']

    def __str__(self):
        return f"{self.string.content[:30]}... -> {self.dimension_value}"


# Signals to automatically update string dimension values
@receiver(post_save, sender=String)
def update_dependent_strings_when_string_variable_changes(sender, instance, **kwargs):
    """
    When a string variable changes, update all strings that reference it.
    """
    # All strings are now variables, so check if any string references this one
    variable_pattern = re.compile(r'{{([^}]+)}}')
    effective_name = instance.effective_variable_name
    
    for string in instance.project.strings.all():
        if string.id == instance.id:
            continue  # Skip self
        variable_names = variable_pattern.findall(string.content)
        if effective_name in variable_names:
            string.update_dimension_values_from_variables()

@receiver([post_save, post_delete], sender=StringDimensionValue)
def update_strings_when_string_dimension_value_changes(sender, instance, **kwargs):
    """
    When a string variable's dimension values change, update all strings that reference it.
    """
    string_variable = instance.string
    variable_pattern = re.compile(r'{{([^}]+)}}')
    effective_name = string_variable.effective_variable_name
    
    for string in string_variable.project.strings.all():
        if string.id == string_variable.id:
            continue  # Skip self
        variable_names = variable_pattern.findall(string.content)
        if effective_name in variable_names:
            string.update_dimension_values_from_variables()
