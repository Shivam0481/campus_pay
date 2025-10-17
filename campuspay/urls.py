from django.contrib import admin
from django.urls import path, re_path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health', views.health),
    path('api/chat', views.api_chat),
    # Serve web app and static files from /web
    re_path(r'^(?P<path>.*)$', views.serve_web, name='serve_web'),
]
