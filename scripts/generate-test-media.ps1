$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$mediaRoot = Join-Path $projectRoot 'tests\fixtures\media'
$hlsRoot = Join-Path $mediaRoot 'hls'
$mp4Path = Join-Path $mediaRoot 'sample.mp4'
$playlistPath = Join-Path $hlsRoot 'sample.m3u8'
$segmentPattern = Join-Path $hlsRoot 'segment-%03d.ts'

New-Item -ItemType Directory -Force -Path $hlsRoot | Out-Null
Get-ChildItem -Path $hlsRoot -Filter 'segment-*.ts' -File -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

& ffmpeg -y `
  -f lavfi -i 'color=c=black:s=160x90:r=24:d=2' `
  -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=2' `
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline `
  -g 24 -keyint_min 24 -sc_threshold 0 `
  -c:a aac -b:a 64k -movflags +faststart `
  $mp4Path
if ($LASTEXITCODE -ne 0) {
  throw "FFmpeg MP4 generation failed with exit code $LASTEXITCODE"
}

& ffmpeg -y -i $mp4Path -c copy -hls_time 1 -hls_list_size 0 `
  -hls_segment_filename $segmentPattern $playlistPath
if ($LASTEXITCODE -ne 0) {
  throw "FFmpeg HLS generation failed with exit code $LASTEXITCODE"
}

Get-ChildItem -Path $mediaRoot -File -Recurse |
  Sort-Object FullName |
  ForEach-Object {
    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName
    $relativePath = $_.FullName.Substring($projectRoot.Length + 1)
    Write-Output "$($hash.Hash.ToLowerInvariant())  $relativePath"
  }
