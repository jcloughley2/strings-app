from django.middleware.csrf import get_token
import logging

logger = logging.getLogger(__name__)

class CSRFRefreshMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # For POST, PUT, PATCH requests, refresh the CSRF token
        if request.method in ('POST', 'PUT', 'PATCH') and request.path.startswith('/api/'):
            csrf_token = get_token(request)
            logger.info(f'Refreshing CSRF token. New token length: {len(csrf_token)}')
            
            # Set the CSRF token in the cookie
            response.set_cookie(
                'csrftoken',
                csrf_token,
                domain='localhost',
                samesite='Lax',
                secure=False,  # Set to True in production with HTTPS
                httponly=False  # CSRF token must be accessible to JavaScript
            )
            
        return response 