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
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='variables')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
