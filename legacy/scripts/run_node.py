import subprocess
import sys
import os

# Change to the blackbox-ai directory
os.chdir('C:\\Users\\gaaya\\blackbox-ai')

# Try running the Node script
try:
    result = subprocess.run(['node', 'create_improvement_final.js'], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print("Return code:", result.returncode)
except Exception as e:
    print(f"Error: {e}")
