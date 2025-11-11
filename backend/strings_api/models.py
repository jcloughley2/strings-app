import re
import secrets
import string
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from slugify import slugify

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
    
    def cleanup_as_spawn_variable(self):
        """
        Clean up dimension values when this string variable is being deleted.
        This method can be called explicitly before deletion if needed.
        
        Returns:
            dict: Summary of cleanup actions taken
        """
        return cleanup_dimension_values_for_deleted_variable(
            self.effective_variable_name, 
            self.project
        )



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
@receiver(pre_save, sender=String)
def track_old_variable_name(sender, instance, **kwargs):
    """
    Track the old variable name and conditional state before save to handle changes.
    """
    if instance.pk:  # Only for existing instances (updates)
        try:
            old_instance = String.objects.get(pk=instance.pk)
            instance._old_effective_variable_name = old_instance.effective_variable_name
            instance._old_is_conditional_container = old_instance.is_conditional_container
        except String.DoesNotExist:
            instance._old_effective_variable_name = None
            instance._old_is_conditional_container = None
    else:
        instance._old_effective_variable_name = None
        instance._old_is_conditional_container = None

@receiver(post_save, sender=String)
def update_dependent_strings_when_string_variable_changes(sender, instance, **kwargs):
    """
    When a string variable changes, update all strings that reference it.
    Also manage automatic dimension creation for conditional variables.
    """
    # Handle automatic dimension creation/update for conditional containers
    if instance.is_conditional_container:
        sync_conditional_dimension(instance)
    
    # Handle conditional-to-string conversion - cleanup dimension when conditional becomes string
    old_is_conditional = getattr(instance, '_old_is_conditional_container', None)
    if old_is_conditional is True and instance.is_conditional_container is False:
        # Conditional variable was converted to string variable - delete its dimension
        cleanup_conditional_dimension(instance)
    
    # Handle spawn variable creation/update - sync parent conditional dimension
    string_name = instance.effective_variable_name
    spawn_pattern = re.compile(r'^(.+)_\d+$')
    match = spawn_pattern.match(string_name)
    
    if match:
        parent_name = match.group(1)
        # Find the parent conditional variable
        try:
            parent_conditional = String.objects.get(
                project=instance.project,
                variable_name=parent_name,
                is_conditional_container=True
            )
            # Resync the dimension
            sync_conditional_dimension(parent_conditional)
        except String.DoesNotExist:
            # Try with variable_hash if variable_name lookup fails
            try:
                parent_conditional = String.objects.get(
                    project=instance.project,
                    variable_hash=parent_name,
                    is_conditional_container=True
                )
                sync_conditional_dimension(parent_conditional)
            except String.DoesNotExist:
                pass  # Parent not found, might not exist yet
    
    # Handle variable renaming - update content references
    old_name = getattr(instance, '_old_effective_variable_name', None)
    new_name = instance.effective_variable_name
    
    if old_name and old_name != new_name:
        # Variable was renamed, update all content that references the old name
        variable_pattern = re.compile(r'{{([^}]+)}}')
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
                # Refresh the instance to reflect the change
                string.content = new_content
        
        # Check if this renamed variable is a spawn variable (has dimension values)
        # If so, update the corresponding dimension value to match the new name
        from .models import DimensionValue
        for sdv in instance.dimension_values.all():
            dimension_value = sdv.dimension_value
            if dimension_value.value == old_name:
                # Update the dimension value to match the new variable name
                dimension_value.value = new_name
                dimension_value.save()
                print(f"Updated dimension value from '{old_name}' to '{new_name}' in dimension '{dimension_value.dimension.name}'")
                
                # Find and resync the parent conditional variable for this dimension
                # Look for conditional variable whose effective_variable_name matches the dimension name
                parent_conditional = None
                for string in instance.project.strings.filter(is_conditional_container=True):
                    if string.effective_variable_name == dimension_value.dimension.name:
                        parent_conditional = string
                        break
                
                if parent_conditional:
                    sync_conditional_dimension(parent_conditional)
                    print(f"Resynced conditional dimension for '{parent_conditional.effective_variable_name}'")
                else:
                    print(f"Could not find parent conditional for dimension '{dimension_value.dimension.name}'")
    
    # All strings are now variables, so check if any string references this one
    variable_pattern = re.compile(r'{{([^}]+)}}')
    effective_name = instance.effective_variable_name
    
    for string in instance.project.strings.all():
        if string.id == instance.id:
            continue  # Skip self
        variable_names = variable_pattern.findall(string.content)
        if effective_name in variable_names:
            string.update_dimension_values_from_variables()

def sync_conditional_dimension(conditional_string):
    """
    Automatically create/update a dimension for a conditional variable and sync its spawn variables.
    """
    from .models import Dimension, DimensionValue
    
    conditional_name = conditional_string.effective_variable_name
    project = conditional_string.project
    
    # Check if there's an old name and find existing dimension
    old_name = getattr(conditional_string, '_old_effective_variable_name', None)
    dimension = None
    
    if old_name and old_name != conditional_name:
        # Variable was renamed - find the existing dimension by old name
        try:
            dimension = Dimension.objects.get(name=old_name, project=project)
            dimension.name = conditional_name
            dimension.save()
            print(f"Renamed dimension from '{old_name}' to '{conditional_name}'")
        except Dimension.DoesNotExist:
            # Old dimension doesn't exist, will create new one below
            pass
    
    # If we didn't find an existing dimension, get or create with current name
    if not dimension:
        dimension, created = Dimension.objects.get_or_create(
            name=conditional_name,
            project=project,
            defaults={'name': conditional_name}
        )
    
    # Note: We don't automatically rename spawn variables when conditional is renamed
    # Users should have control over their spawn variable names
    # Only the dimension name is updated to match the new conditional name
    
    # Find all spawn variables for this conditional by checking which strings have dimension values for this dimension
    spawn_strings = []
    
    # Get all strings that have dimension values for this conditional's dimension
    for string in project.strings.all():
        if string.is_conditional_container:
            continue  # Skip other conditional containers
        
        # Check if this string has a dimension value for our conditional's dimension
        for sdv in string.dimension_values.all():
            if sdv.dimension_value.dimension == dimension:
                spawn_strings.append(string)
                break  # Found a match, no need to check other dimension values for this string
    
    # Sort spawns by their effective variable name for consistent ordering
    spawn_strings.sort(key=lambda s: s.effective_variable_name)
    
    # Get existing dimension values
    existing_values = set(dimension.values.values_list('value', flat=True))
    
    # Create dimension values for each spawn using their actual effective variable names
    for spawn_string in spawn_strings:
        spawn_name = spawn_string.effective_variable_name
        if spawn_name not in existing_values:
            # Use get_or_create to avoid unique constraint errors
            dimension_value, created = DimensionValue.objects.get_or_create(
                dimension=dimension,
                value=spawn_name
            )
            if created:
                print(f"Created dimension value '{spawn_name}' for dimension '{dimension.name}'")
    
    # Remove dimension values that no longer have corresponding spawns
    current_spawn_names = {s.effective_variable_name for s in spawn_strings}
    old_values = dimension.values.exclude(value__in=current_spawn_names)
    if old_values.exists():
        print(f"Removing old dimension values: {list(old_values.values_list('value', flat=True))}")
        old_values.delete()
    
    return dimension

def cleanup_conditional_dimension(conditional_string):
    """
    Clean up the dimension and all its dimension values when a conditional variable 
    is deleted or converted to a string variable.
    """
    from .models import Dimension
    
    conditional_name = conditional_string.effective_variable_name
    project = conditional_string.project
    
    try:
        # Find the dimension associated with this conditional variable
        dimension = Dimension.objects.get(name=conditional_name, project=project)
        
        # Delete the dimension (this will cascade delete all dimension values and string-dimension-value relationships)
        dimension_name = dimension.name
        dimension.delete()
        print(f"Deleted dimension '{dimension_name}' and all its associated dimension values")
        
    except Dimension.DoesNotExist:
        # No dimension found - this is fine, maybe it was already cleaned up
        print(f"No dimension found for conditional '{conditional_name}' - skipping cleanup")

def cleanup_dimension_values_for_deleted_variable(variable_name, project):
    """
    Clean up all dimension values that reference a deleted variable.
    This handles cases where a single variable serves as spawn for multiple conditional variables.
    
    Args:
        variable_name (str): The effective variable name of the deleted variable
        project (Project): The project instance
    
    Returns:
        dict: Summary of cleanup actions taken
    """
    from .models import DimensionValue
    
    # Find all dimension values that reference this deleted variable by name
    dimension_values_to_delete = DimensionValue.objects.filter(
        dimension__project=project,
        value=variable_name
    )
    
    cleanup_summary = {
        'deleted_dimension_values': [],
        'affected_conditionals': [],
        'total_deleted': 0
    }
    
    # Keep track of parent conditionals that need dimension resyncing
    parent_conditionals_to_resync = set()
    
    for dim_value in dimension_values_to_delete:
        dimension = dim_value.dimension
        cleanup_summary['deleted_dimension_values'].append({
            'dimension_name': dimension.name,
            'value': dim_value.value
        })
        
        # Find the conditional variable that owns this dimension
        parent_conditional = None
        for string in project.strings.filter(is_conditional_container=True):
            if string.effective_variable_name == dimension.name:
                parent_conditional = string
                break
        
        if parent_conditional:
            parent_conditionals_to_resync.add(parent_conditional.id)
            if parent_conditional.effective_variable_name not in cleanup_summary['affected_conditionals']:
                cleanup_summary['affected_conditionals'].append(parent_conditional.effective_variable_name)
    
    # Delete all dimension values that reference the deleted variable
    deleted_count = dimension_values_to_delete.count()
    if deleted_count > 0:
        dimension_values_to_delete.delete()
        cleanup_summary['total_deleted'] = deleted_count
        print(f"Deleted {deleted_count} dimension values referencing deleted variable '{variable_name}'")
    
    # Resync all affected parent conditional dimensions
    for parent_id in parent_conditionals_to_resync:
        try:
            parent_conditional = String.objects.get(id=parent_id, is_conditional_container=True)
            sync_conditional_dimension(parent_conditional)
            print(f"Resynced conditional dimension for '{parent_conditional.effective_variable_name}' after variable deletion")
        except String.DoesNotExist:
            print(f"Parent conditional with ID {parent_id} no longer exists - skipping resync")
    
    return cleanup_summary

@receiver(post_delete, sender=String)
def handle_string_deletion(sender, instance, **kwargs):
    """
    When a string variable is deleted, handle cleanup based on its type.
    """
    deleted_variable_name = instance.effective_variable_name
    project = instance.project
    
    # Check if this was a conditional variable - if so, clean up its dimension
    if instance.is_conditional_container:
        cleanup_conditional_dimension(instance)
        return
    
    # For any deleted variable (spawn or regular), clean up ALL dimension values that reference it
    # This handles cases where a single variable serves as spawn for multiple conditional variables
    cleanup_summary = cleanup_dimension_values_for_deleted_variable(deleted_variable_name, project)
    
    if cleanup_summary['total_deleted'] > 0:
        print(f"Variable deletion cleanup summary for '{deleted_variable_name}':")
        print(f"  - Deleted {cleanup_summary['total_deleted']} dimension values")
        print(f"  - Affected conditionals: {', '.join(cleanup_summary['affected_conditionals'])}")
        for dv in cleanup_summary['deleted_dimension_values']:
            print(f"  - Removed '{dv['value']}' from dimension '{dv['dimension_name']}'")
    else:
        print(f"No dimension values found for deleted variable '{deleted_variable_name}' - no cleanup needed")

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
