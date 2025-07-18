# Generated by Django 5.2 on 2025-07-11 07:14

from django.db import migrations
import secrets
import string


def generate_hashes_for_existing_strings(apps, schema_editor):
    """Generate hashes for all existing strings that don't have one"""
    String = apps.get_model('strings_api', 'String')
    
    # Get all strings without hashes
    strings_without_hashes = String.objects.filter(variable_hash__in=['', None])
    
    used_hashes = set()
    
    for string_obj in strings_without_hashes:
        # Generate unique hash
        while True:
            hash_chars = string.ascii_uppercase + string.digits
            new_hash = ''.join(secrets.choice(hash_chars) for _ in range(6))
            
            if new_hash not in used_hashes and not String.objects.filter(variable_hash=new_hash).exists():
                string_obj.variable_hash = new_hash
                string_obj.save(update_fields=['variable_hash'])
                used_hashes.add(new_hash)
                break


def reverse_generate_hashes(apps, schema_editor):
    """Reverse migration - clear all hashes"""
    String = apps.get_model('strings_api', 'String')
    String.objects.all().update(variable_hash='')


class Migration(migrations.Migration):

    dependencies = [
        ('strings_api', '0011_remove_string_is_variable_string_variable_hash'),
    ]

    operations = [
        migrations.RunPython(generate_hashes_for_existing_strings, reverse_generate_hashes),
    ]
