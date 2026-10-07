& {
    $ErrorActionPreference = "Stop"
    $mushavoSelectedPath = "C:\Users\HP\Downloads\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342-20261007T185032Z-1-001.7z"
    $mushavoExpectedBase = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database-component-8135efd7cfce4f89b01da7296e864731"
    $mushavoFile = Get-Item -LiteralPath $mushavoSelectedPath -Force
    if ($mushavoFile -isnot [IO.FileInfo] -or
        ($mushavoFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected an ordinary downloaded file at the supplied path."
    }
    $mushavoHeader = New-Object byte[] 6
    $mushavoStream = [IO.File]::OpenRead($mushavoFile.FullName)
    try {
        $mushavoRead = $mushavoStream.Read($mushavoHeader, 0, 6)
    } finally {
        $mushavoStream.Dispose()
    }
    $mushavoFormat = "Unrecognized prefix; format and integrity unverified"
    if ($mushavoRead -eq 6 -and
        [BitConverter]::ToString($mushavoHeader) -eq "37-7A-BC-AF-27-1C") {
        $mushavoFormat = "7z signature present; archive integrity not tested"
    } elseif ($mushavoRead -ge 4 -and
        [BitConverter]::ToString($mushavoHeader, 0, 4) -in @(
            "50-4B-03-04", "50-4B-05-06", "50-4B-07-08"
        )) {
        $mushavoFormat = "ZIP signature present; filename extension does not convert the format"
    }
    $mushavoCandidates = @(Get-ChildItem -LiteralPath $mushavoFile.DirectoryName `
        -File -Force -Filter "$mushavoExpectedBase*.7z")
    [pscustomobject]@{
        stage_step = "1.2"
        result = "READ_ONLY_DOWNLOAD_FORMAT_AND_SIZE_DIAGNOSTIC"
        selected_name = $mushavoFile.Name
        actual_bytes = $mushavoFile.Length
        expected_bytes = 566080
        size_matches_expected = ($mushavoFile.Length -eq 566080)
        format_hint = $mushavoFormat
        expected_named_download_candidates = $mushavoCandidates.Count
        files_modified_or_extracted = $false
        offsite_integrity_verified = $false
    } | Format-List
    if ($mushavoCandidates.Count -gt 0) {
        $mushavoCandidates | Select-Object Name, Length | Format-Table -Wrap -AutoSize
    } else {
        Write-Output "No download with the expected archive name was found in this Downloads directory."
    }
    Write-Output "Send only this metadata output. No password, hash or file contents are needed."
}
