import re
import secrets
import string
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from slugify import slugify

class UserProfile(models.Model):
    """Extended user profile for storing user settings like API keys"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    openai_api_key = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


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
    # Human-readable display name (optional, separate from identifier)
    display_name = models.CharField(max_length=200, blank=True, null=True)
    is_conditional = models.BooleanField(default=False)
    # Add explicit field to identify conditionals (directory containers)
    is_conditional_container = models.BooleanField(default=False)
    # Controlling spawn: when this spawn is selected, the controlled spawn also shows
    controlled_by_spawn = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='controls_spawns')
    # Publishing: whether this string appears in the organization registry
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['variable_name', 'project']
        ordering = ['-created_at']  # Newest first by default

    def save(self, *args, **kwargs):
        # Auto-generate variable_name from display_name using slugify
        if self.display_name and self.display_name.strip():
            # Generate slug from display_name
            base_slug = slugify(self.display_name, max_length=50)
            self.variable_name = self.generate_unique_slug(base_slug)
        elif not self.variable_name:
            # No display_name provided, use random hash as variable_name
            self.variable_name = self.generate_unique_hash()
        
        # Always keep variable_hash as a fallback (for backward compatibility)
        if not self.variable_hash:
            self.variable_hash = self.generate_unique_hash()
            
        super().save(*args, **kwargs)

    def generate_unique_slug(self, base_slug):
        """Generate a unique slug from the base slug, adding numbers if needed"""
        slug = base_slug
        counter = 1
        
        # Check if slug is unique within the project
        while String.objects.filter(
            project=self.project,
            variable_name=slug
        ).exclude(id=self.id).exists():
            # Append counter to make it unique
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        return slug

    def generate_unique_hash(self):
        """Generate a unique 6-character random hash for this string"""
        while True:
            # Generate 6-character hash using uppercase letters and numbers
            hash_chars = string.ascii_uppercase + string.digits
            new_hash = ''.join(secrets.choice(hash_chars) for _ in range(6))
            
            # Check if hash is unique for both variable_hash (globally) 
            # AND variable_name within this project (since the hash may be used as variable_name)
            hash_unique = not String.objects.filter(variable_hash=new_hash).exists()
            name_unique = not String.objects.filter(project=self.project, variable_name=new_hash).exists()
            
            if hash_unique and name_unique:
                return new_hash

    @property
    def effective_variable_name(self):
        """Return the variable name if set, otherwise return the hash"""
        return self.variable_name if self.variable_name else self.variable_hash

    def __str__(self):
        var_name = self.effective_variable_name
        return f"Variable: {var_name} ({self.project.name})"


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


# Signal to track old variable name for rename handling
@receiver(pre_save, sender=String)
def track_old_variable_name(sender, instance, **kwargs):
    """
    Track the old variable name before save to handle renames.
    """
    if instance.pk:  # Only for existing instances (updates)
        try:
            old_instance = String.objects.get(pk=instance.pk)
            instance._old_effective_variable_name = old_instance.effective_variable_name
        except String.DoesNotExist:
            instance._old_effective_variable_name = None
    else:
        instance._old_effective_variable_name = None


@receiver(post_save, sender=String)
def update_variable_references_on_rename(sender, instance, **kwargs):
    """
    When a variable is renamed, update all content that references the old name.
    """
    old_name = getattr(instance, '_old_effective_variable_name', None)
    new_name = instance.effective_variable_name
    
    if old_name and old_name != new_name:
        # Variable was renamed, update all content that references the old name
        old_reference = f'{{{{{old_name}}}}}'
        new_reference = f'{{{{{new_name}}}}}'
        
        for string in instance.project.strings.all():
            if string.id == instance.id:
                continue  # Skip self
            
            if old_reference in string.content:
                # Update the content to use the new variable name
                new_content = string.content.replace(old_reference, new_reference)
                # Use update() to avoid triggering signals again
                String.objects.filter(id=string.id).update(content=new_content)
                print(f"Updated variable reference in string {string.id}: {old_name} -> {new_name}")
