from app.main import create_app


# Vercel mounts this service at /api, so its internal routes omit that prefix.
app = create_app(api_root='')
