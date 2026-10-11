import os
import subprocess
import sys

# Create the directory
dir_path = r"C:\Users\gaaya\blackbox-ai\frontend\app\journey\improvement"
try:
    os.makedirs(dir_path, exist_ok=True)
    print(f"✓ Directory created: {dir_path}")
except Exception as e:
    print(f"✗ Error creating directory: {e}")
    sys.exit(1)

# Verify by listing parent directory
parent_dir = r"C:\Users\gaaya\blackbox-ai\frontend\app\journey"
try:
    print(f"\n✓ Parent directory contents ({parent_dir}):")
    result = subprocess.run(['cmd', '/c', f'dir "{parent_dir}"'], capture_output=True, text=True)
    print(result.stdout)
except Exception as e:
    print(f"Error listing directory: {e}")
