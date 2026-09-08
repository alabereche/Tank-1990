Add-Type -AssemblyName System.Drawing

$sourcePath = "tank_icon_original.png"
if (-not (Test-Path $sourcePath)) {
    $sourcePath = "tank_icon_512.png"
}
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source image not found: tank_icon_original.png"
    exit 1
}

Write-Host "Using transparent source icon: $sourcePath"

# Copy master image to build directory for permanence
Copy-Item $sourcePath "build\icon-master.png" -Force

$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

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
    Write-Host "Generated: $OutputPath ($TargetWidth x $TargetHeight)"
}

# Browser web assets (all with clean transparency)
Resize-Image -Image $srcImg -TargetWidth 16  -TargetHeight 16  -OutputPath "public\favicon-16.png"
Resize-Image -Image $srcImg -TargetWidth 32  -TargetHeight 32  -OutputPath "public\favicon-32.png"
Resize-Image -Image $srcImg -TargetWidth 32  -TargetHeight 32  -OutputPath "public\favicon.png"
Resize-Image -Image $srcImg -TargetWidth 180 -TargetHeight 180 -OutputPath "public\apple-touch-icon.png"
Resize-Image -Image $srcImg -TargetWidth 192 -TargetHeight 192 -OutputPath "public\icon-192.png"
Resize-Image -Image $srcImg -TargetWidth 256 -TargetHeight 256 -OutputPath "public\icon-256.png"
Resize-Image -Image $srcImg -TargetWidth 512 -TargetHeight 512 -OutputPath "public\icon-512.png"
Resize-Image -Image $srcImg -TargetWidth 512 -TargetHeight 512 -OutputPath "public\icon.png"

# Electron / Desktop assets
Resize-Image -Image $srcImg -TargetWidth 512 -TargetHeight 512 -OutputPath "build\icon.png"

# Temp files for multi-resolution Windows ICO (16, 32, 48, 64, 128, 256)
$icoSizes = @(16, 32, 48, 64, 128, 256)
$tempIcoDir = "build\temp_ico"
foreach ($s in $icoSizes) {
    Resize-Image -Image $srcImg -TargetWidth $s -TargetHeight $s -OutputPath (Join-Path $tempIcoDir "ico-$s.png")
}

# Android mipmap densities
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
    Resize-Image -Image $srcImg -TargetWidth $d.Icon -TargetHeight $d.Icon -OutputPath (Join-Path $dir "ic_launcher.png") -ContentRatio 1.0
    Resize-Image -Image $srcImg -TargetWidth $d.Icon -TargetHeight $d.Icon -OutputPath (Join-Path $dir "ic_launcher_round.png") -ContentRatio 1.0
    Resize-Image -Image $srcImg -TargetWidth $d.Fg -TargetHeight $d.Fg -OutputPath (Join-Path $dir "ic_launcher_foreground.png") -ContentRatio 0.78
}

$srcImg.Dispose()
Write-Host "All PNG icon resolutions generated successfully!"

