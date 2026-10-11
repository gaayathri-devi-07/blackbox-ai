$dir = "C:\Users\gaaya\blackbox-ai\frontend\app\journey\improvement"
if (-not (Test-Path $dir)) {
    New-Item -Path $dir -ItemType Directory -Force | Out-Null
    Write-Host "Directory created: $dir"
} else {
    Write-Host "Directory already exists: $dir"
}
