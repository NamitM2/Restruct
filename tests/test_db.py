import backend_code.app as app

# Test connection
try:
    # Try to query conversations table
    result = app.supabase.table("conversations").select("*").limit(1).execute()
    print("✓ Database connection successful!")
    print(f"Tables accessible: {result}")
except Exception as e:
    print(f"✗ Connection failed: {e}")