& {
    $mushavo7ZipCommand = Get-Command -Name "7z.exe" `
        -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1

    $mushavo7ZipCandidates = @(
        "C:\Program Files\7-Zip\7z.exe"
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )
    if ($mushavo7ZipCommand) {
        $mushavo7ZipCandidates += $mushavo7ZipCommand.Source
    }

    $mushavo7ZipPath = $mushavo7ZipCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1

    if (-not $mushavo7ZipPath) {
        Write-Output "7-ZIP NOT FOUND at the checked paths or on PATH."
        return
    }

    Write-Output "Executable: $mushavo7ZipPath"
    $mushavo7ZipInfo = & $mushavo7ZipPath i 2>&1
    $mushavo7ZipExitCode = $LASTEXITCODE
    if ($mushavo7ZipExitCode -ne 0) {
        throw "7-Zip information check failed with exit code $mushavo7ZipExitCode."
    }
    $mushavo7ZipInfo | Select-Object -First 6
}
