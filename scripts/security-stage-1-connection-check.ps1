& {
    $mushavoPsql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
    if (-not (Test-Path -LiteralPath $mushavoPsql -PathType Leaf)) {
        throw "PostgreSQL psql.exe was not found at the verified path."
    }

    $mushavoCertInput = (Read-Host "Full path to the downloaded Supabase certificate").Trim().Trim('"')
    if (-not (Test-Path -LiteralPath $mushavoCertInput -PathType Leaf)) {
        throw "Certificate file was not found. Send the error and file path only."
    }
    $mushavoCertPath = (Resolve-Path -LiteralPath $mushavoCertInput -ErrorAction Stop).ProviderPath
    $mushavoCertValue = $mushavoCertPath.Replace('\', '/').Replace("'", "\'")

    $mushavoConnection = @(
        "host=aws-0-eu-central-1.pooler.supabase.com"
        "port=5432"
        "dbname=postgres"
        "user=postgres.kttkospkblwvguuwnhjj"
        "sslmode=verify-full"
        "sslrootcert='$mushavoCertValue'"
        "gssencmode=disable"
        "connect_timeout=15"
        "application_name=mushavo_stage_1_2_connection"
    ) -join " "

    & $mushavoPsql --no-psqlrc --password --set=ON_ERROR_STOP=1 `
        --dbname $mushavoConnection --command '\conninfo'
    if ($LASTEXITCODE -ne 0) {
        throw "Connection check failed. Send the error output without any password."
    }

    Write-Output "Connection check completed. Send the connection and TLS output."
}
