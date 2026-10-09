import subprocess
import sys

result = subprocess.run(
    ['node', r'C:\Users\gaaya\blackbox-ai\setup_improvement_page.js'],
    capture_output=True,
    text=True
)

print(result.stdout)
if result.stderr:
    print(result.stderr, file=sys.stderr)
sys.exit(result.returncode)
