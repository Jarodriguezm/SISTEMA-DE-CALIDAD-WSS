# ============================================================
# deploy.ps1 — Despliegue seguro. NO contiene credenciales.
#
# CONFIGURACION (una sola vez, en PowerShell):
#   [Environment]::SetEnvironmentVariable("WSS_GH_TOKEN","tu_token_nuevo","User")
#   Cerrar y reabrir PowerShell.
#
# USO:
#   .\deploy.ps1 src\pages\Personal.jsx "mensaje del commit"
#   .\deploy.ps1 -Todos "mensaje"      (sube todo lo modificado hoy)
# ============================================================
param(
    [Parameter(Position=0)][string]$Archivo,
    [Parameter(Position=1)][string]$Mensaje = "actualizacion",
    [switch]$Todos,
    [switch]$Staging
)

$token = $env:WSS_GH_TOKEN
if (-not $token) {
    Write-Host ""
    Write-Host "  FALTA EL TOKEN" -ForegroundColor Red
    Write-Host "  Configuralo una vez con:" -ForegroundColor Yellow
    Write-Host '    [Environment]::SetEnvironmentVariable("WSS_GH_TOKEN","tu_token","User")'
    Write-Host "  Luego cierra y reabre PowerShell."
    Write-Host ""
    exit 1
}

$repo   = "Jarodriguezm/SISTEMA-DE-CALIDAD-WSS"
$branch = if ($Staging) { "staging" } else { "main" }
$base   = $PSScriptRoot

$headers = @{ Authorization = "token $token"; "Content-Type" = "application/json" }

function SubirArchivo($rutaRepo, $mensaje) {
    $rutaLocal = Join-Path $base ($rutaRepo -replace '/', '\')
    if (-not (Test-Path $rutaLocal)) {
        Write-Host "  No existe: $rutaRepo" -ForegroundColor Red
        return
    }
    Write-Host "  $rutaRepo ..." -NoNewline
    $b64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($rutaLocal))
    $sha = $null
    try {
        $r = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$rutaRepo" `
             -Headers $headers -Method Get
        $sha = $r.sha
    } catch { }
    $body = @{ message = $mensaje; content = $b64; branch = $branch }
    if ($sha) { $body.sha = $sha }
    try {
        $r = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$rutaRepo" `
             -Headers $headers -Method Put -Body ($body | ConvertTo-Json -Depth 5)
        Write-Host " OK ($($r.commit.sha.Substring(0,7)))" -ForegroundColor Green
    } catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Despliegue WSS -> rama: $branch ===" -ForegroundColor Cyan
Write-Host ""

if ($Todos) {
    $hoy = (Get-Date).Date
    Get-ChildItem -Path "$base\src","$base\api" -Recurse -Include *.jsx,*.js -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $hoy } | ForEach-Object {
            $rel = $_.FullName.Substring($base.Length + 1) -replace '\\','/'
            SubirArchivo $rel $Mensaje
        }
} elseif ($Archivo) {
    SubirArchivo ($Archivo -replace '\\','/') $Mensaje
} else {
    Write-Host "  Uso: .\deploy.ps1 src\pages\Archivo.jsx `"mensaje`"" -ForegroundColor Yellow
    Write-Host "       .\deploy.ps1 -Todos `"mensaje`"" -ForegroundColor Yellow
}

Write-Host ""
