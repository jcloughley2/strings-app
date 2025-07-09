from django.db import models
from django.contrib.auth.models import User

class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')

    def __str__(self):
        return self.name

class Trait(models.Model):
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='traits')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class Variable(models.Model):
    VARIABLE_TYPE_CHOICES = [
        ('trait', 'Trait Variable'),
        ('string', 'String Variable'),
    ]
    
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='variables')
    variable_type = models.CharField(max_length=10, choices=VARIABLE_TYPE_CHOICES, default='trait')
    referenced_string = models.ForeignKey('String', on_delete=models.CASCADE, null=True, blank=True, related_name='referenced_by_variables')
    content = models.TextField(blank=True, null=True)  # For string variables that have their own content
    is_conditional = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['name', 'project']

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class VariableValue(models.Model):
    variable = models.ForeignKey(Variable, on_delete=models.CASCADE, related_name='values')
    trait = models.ForeignKey(Trait, on_delete=models.CASCADE, related_name='variable_values')
    value = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['variable', 'trait']

    def __str__(self):
        return f"{self.variable.name}: {self.value} (when {self.trait.name})"

class String(models.Model):
    content = models.TextField()
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='strings')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    variables = models.ManyToManyField(Variable, related_name='strings', blank=True)

    def __str__(self):
        return f"{self.content[:50]}... ({self.project.name})"

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
