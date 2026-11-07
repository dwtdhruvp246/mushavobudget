& {
    # Public dummy data/passwords only. Never use this password for real backups.
    $ErrorActionPreference = "Continue"
    $mushavo7Zip = "C:\Program Files\7-Zip\7z.exe"
    if (-not (Test-Path -LiteralPath $mushavo7Zip -PathType Leaf)) {
        throw "Verified 7-Zip executable was not found."
    }

    $mushavoTestParent = [Environment]::GetFolderPath("LocalApplicationData")
    if ([string]::IsNullOrWhiteSpace($mushavoTestParent)) {
        throw "Local application-data directory was not found."
    }
    $mushavoTestRoot = Join-Path $mushavoTestParent `
        ("MushavoBudget-Audit-Test-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoTestRoot -ErrorAction Stop | Out-Null
    $mushavoSource = Join-Path $mushavoTestRoot "dummy.txt"
    $mushavoArchive = Join-Path $mushavoTestRoot "dummy.7z"
    $mushavoRestored = Join-Path $mushavoTestRoot "restored"
    Set-Content -LiteralPath $mushavoSource -Encoding UTF8 -ErrorAction Stop `
        -Value "Mushavo Budget synthetic encryption test. No customer data."

    Push-Location -LiteralPath $mushavoTestRoot -ErrorAction Stop
    try {
        $mushavoOutput = & $mushavo7Zip a -t7z -mhe=on `
            -pMushavo-DUMMY-Only-1 $mushavoArchive "dummy.txt" 2>&1
        if ($LASTEXITCODE -ne 0) {
            $mushavoOutput | Write-Output
            throw "Dummy archive creation failed."
        }

        $mushavoListing = & $mushavo7Zip l -slt `
            -pMushavo-DUMMY-Only-1 $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Correct-password listing failed." }
        $mushavoListingText = $mushavoListing | Out-String
        if ($mushavoListingText -notmatch "7zAES" -or
            $mushavoListingText -notmatch "(?m)^Encrypted = \+\r?$") {
            throw "Expected encrypted payload metadata was not reported."
        }

        $mushavoWrongListing = & $mushavo7Zip l -slt `
            -pMushavo-DUMMY-Wrong-2 $mushavoArchive 2>&1
        $mushavoWrongListingExit = $LASTEXITCODE
        if ($mushavoWrongListingExit -ne 2 -or
            (($mushavoWrongListing | Out-String) -match "dummy\.txt")) {
            throw "Wrong-password filename-protection check failed."
        }

        $mushavoOutput = & $mushavo7Zip t `
            -pMushavo-DUMMY-Wrong-2 $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 2) { throw "Wrong-password rejection check failed." }

        $mushavoOutput = & $mushavo7Zip t `
            -pMushavo-DUMMY-Only-1 $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Correct-password integrity check failed." }

        $mushavoOutput = & $mushavo7Zip x `
            -pMushavo-DUMMY-Only-1 "-o$mushavoRestored" $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Dummy extraction failed." }
        $mushavoSourceHash = (Get-FileHash -LiteralPath $mushavoSource `
            -Algorithm SHA256 -ErrorAction Stop).Hash
        $mushavoRestoredHash = (Get-FileHash -LiteralPath `
            (Join-Path $mushavoRestored "dummy.txt") `
            -Algorithm SHA256 -ErrorAction Stop).Hash
        if ($mushavoSourceHash -ne $mushavoRestoredHash) {
            throw "Restored dummy file hash does not match."
        }

        Write-Output "PASS: Dummy archive created; payload reports 7zAES/encrypted."
        Write-Output "PASS: Wrong password cannot list dummy filename or test archive."
        Write-Output "PASS: Correct password tests archive; restored SHA-256 matches."
        Write-Output "Synthetic files retained at: $mushavoTestRoot"
    } finally {
        Pop-Location
    }
}
