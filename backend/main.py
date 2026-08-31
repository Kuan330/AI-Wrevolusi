from app.main import create_app


# Vercel preserves the public /api path when routing to this service.
app = create_app()
