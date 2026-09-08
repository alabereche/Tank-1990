Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\dhirar\.gemini\antigravity-ide\brain\1464923d-fa20-45ba-b778-e3bc976635b5\tank_emblem_app_icon_1788906732543.jpg"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source image not found: $sourcePath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-Image {
    param(
        [System.Drawing.Image]$Image,
        [int]$TargetWidth,
        [int]$TargetHeight,
        [string]$OutputPath,
        [float]$ContentRatio = 1.0
    )

    $destBmp = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $drawW = [int]($TargetWidth * $ContentRatio)
    $drawH = [int]($TargetHeight * $ContentRatio)
    $drawX = [int](($TargetWidth - $drawW) / 2)
    $drawY = [int](($TargetHeight - $drawH) / 2)

    $destRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
    $g.DrawImage($Image, $destRect, 0, 0, $Image.Width, $Image.Height, [System.Drawing.GraphicsUnit]::Pixel)

    $g.Dispose()

    $parent = Split-Path -Parent $OutputPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $destBmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Saved: $OutputPath ($TargetWidth x $TargetHeight)"
}

$resDir = "android\app\src\main\res"

$densities = @(
    @{ Name = "mipmap-mdpi";    Icon = 48;  Fg = 108 },
    @{ Name = "mipmap-hdpi";    Icon = 72;  Fg = 162 },
    @{ Name = "mipmap-xhdpi";   Icon = 96;  Fg = 216 },
    @{ Name = "mipmap-xxhdpi";  Icon = 144; Fg = 324 },
    @{ Name = "mipmap-xxxhdpi"; Icon = 192; Fg = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $resDir $d.Name
    # Full square icon
    Resize-Image -Image $srcImg -TargetWidth $d.Icon -TargetHeight $d.Icon -OutputPath (Join-Path $dir "ic_launcher.png") -ContentRatio 1.0
    # Round icon
    Resize-Image -Image $srcImg -TargetWidth $d.Icon -TargetHeight $d.Icon -OutputPath (Join-Path $dir "ic_launcher_round.png") -ContentRatio 1.0
    # Adaptive Foreground (centered in safe zone, ratio 0.78 so outer 22% is margin for circle/squircle masking)
    Resize-Image -Image $srcImg -TargetWidth $d.Fg -TargetHeight $d.Fg -OutputPath (Join-Path $dir "ic_launcher_foreground.png") -ContentRatio 0.78
}

# Web and desktop icons
Resize-Image -Image $srcImg -TargetWidth 512 -TargetHeight 512 -OutputPath "public\icon.png"
Resize-Image -Image $srcImg -TargetWidth 512 -TargetHeight 512 -OutputPath "public\icon-512.png"
Resize-Image -Image $srcImg -TargetWidth 256 -TargetHeight 256 -OutputPath "public\icon-256.png"
Resize-Image -Image $srcImg -TargetWidth 192 -TargetHeight 192 -OutputPath "public\icon-192.png"
Resize-Image -Image $srcImg -TargetWidth 180 -TargetHeight 180 -OutputPath "public\apple-touch-icon.png"
Resize-Image -Image $srcImg -TargetWidth 64  -TargetHeight 64  -OutputPath "public\favicon.png"
Resize-Image -Image $srcImg -TargetWidth 512 -TargetHeight 512 -OutputPath "build\icon.png"

$srcImg.Dispose()

# Update background colors to match icon palette
$bgValXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0b0c10</color>
</resources>
"@
Set-Content -Path "android\app\src\main\res\values\ic_launcher_background.xml" -Value $bgValXml -Encoding UTF8

$bgDrawXml = @"
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#0b0c10"
        android:pathData="M0,0h108v108h-108z" />
</vector>
"@
Set-Content -Path "android\app\src\main\res\drawable\ic_launcher_background.xml" -Value $bgDrawXml -Encoding UTF8

Write-Host "All icons and Android configurations updated successfully!"
