param([Parameter(Mandatory=$true)][string]$SnapshotRoot)
$ErrorActionPreference = 'Stop'
$Passed = 0
$Failed = New-Object 'System.Collections.Generic.List[string]'
$TemporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ('mushavo-batch-m-public-fixture-' + [guid]::NewGuid().ToString('N'))
$Answers = New-Object 'System.Collections.Generic.Queue[string]'
$Prompts = 0
function Write-Host { param([object]$Object) } # Never print fixture paths or inboxes.
function Read-Host { param([string]$Prompt) $script:Prompts++; if ($script:Answers.Count -eq 0) { throw 'UNEXPECTED_PROMPT' }; return $script:Answers.Dequeue() }
function Check([bool]$Condition) { if (-not $Condition) { throw 'ASSERTION_REQUIRED' } }
function Case([string]$Name, [scriptblock]$Body) {
    try { & $Body; $script:Passed++ } catch { $script:Failed.Add($Name) }
}
function Refused([scriptblock]$Body, [string]$ExpectedPhase, [string]$ExpectedProblem) {
    $Rejected = $false
    try { $null = & $Body } catch { $Rejected = $true }
    Check $Rejected
    Check ($script:Phase -ceq $ExpectedPhase)
    Check ($script:Problem -ceq $ExpectedProblem)
}
function Packet {
    return [pscustomobject]@{
        schema_version=1;purpose='MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY';project='dczlddwbtgvfdujgcitb';
        origin='https://mushavo-budget-staging.pages.dev';expected_modern_Pages_Worker_SHA256='a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651';
        env=[pscustomobject]@{EMAIL_GATE_MODE='STAGING_CONTROLLED_ONLY';EMAIL_GATE_PROJECT='dczlddwbtgvfdujgcitb';EMAIL_GATE_ORIGIN='https://mushavo-budget-staging.pages.dev';
            SUPABASE_PUBLISHABLE_KEY='sb_publishable_SYNTHETIC';ZOHO_TEST_RECIPIENTS_JSON='["one@example.invalid","two@example.invalid"]';
            SUPABASE_SERVICE_ROLE_KEY='SYNTHETIC_BACKEND_NEVER_PASS';ZOHO_CLIENT_SECRET='SYNTHETIC_ZOHO_NEVER_PASS';EMAIL_GATE_RATE_PEPPER='SYNTHETIC_PEPPER_NEVER_PASS'}
    }
}
try {
    $Tokens = $null; $ParseErrors = $null
    $Ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $SnapshotRoot 'scripts/run-fr-2-email-batch-m.ps1'), [ref]$Tokens, [ref]$ParseErrors)
    Case 'Actual runner parses' { Check (@($ParseErrors).Count -eq 0) }
    foreach ($Name in @('Assert-Unlinked','Select-RetainedGatewayPacket','Get-RetainedGatewayPublicInputs')) {
        $Definitions = @($Ast.FindAll({param($Node) $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -ceq $Name}, $true))
        if ($Definitions.Count -ne 1) { throw 'RUNNER_HELPER_REQUIRED' }
        . ([scriptblock]::Create($Definitions[0].Extent.Text))
    }
    # This proxy models the documented 5.1 top-level-array pipeline behavior.
    # It is not an execution of Windows PowerShell or Windows DPAPI.
    function ConvertFrom-Json {
        param([Parameter(ValueFromPipeline=$true)][string]$InputObject)
        process {
            $Value = Microsoft.PowerShell.Utility\ConvertFrom-Json -InputObject $InputObject
            if ($InputObject.TrimStart().StartsWith('[')) { Write-Output -NoEnumerate $Value } else { $Value }
        }
    }
    Case 'Original array capture reproduces 5.1 nested-array refusal' {
        $Original = @('["one@example.invalid","two@example.invalid"]' | ConvertFrom-Json)
        Check ($Original.Count -eq 1 -and $Original[0] -is [Array] -and $Original[0] -isnot [string])
    }
    Case 'Actual helper accepts two inboxes under modeled 5.1 behavior' {
        $Output = Get-RetainedGatewayPublicInputs (Packet)
        Check ($Output.recipients.Count -eq 2 -and $Output.recipients[0] -is [string])
    }
    Remove-Item Function:\ConvertFrom-Json
    Case 'Actual helper accepts two inboxes under native JSON behavior' {
        $Output = Get-RetainedGatewayPublicInputs (Packet)
        Check ($Output.recipients.Count -eq 2 -and $Output.recipients[1] -ceq 'two@example.invalid')
        Check (@($Output.PSObject.Properties).Count -eq 2)
        Check (($Output | ConvertTo-Json -Depth 5) -notmatch 'SYNTHETIC_(BACKEND|ZOHO|PEPPER)')
    }
    Case 'Single-inbox array remains an array' {
        $P = Packet; $P.env.ZOHO_TEST_RECIPIENTS_JSON='["one@example.invalid"]'
        $Output = Get-RetainedGatewayPublicInputs $P
        Check ($Output.recipients -is [Array] -and $Output.recipients.Count -eq 1)
    }
    foreach ($Field in @('project','origin','purpose','expected_modern_Pages_Worker_SHA256')) {
        $CaseField = $Field
        Case ('Scope rejects changed ' + $Field) {
            $P = Packet; $P.$CaseField='FOREIGN_SYNTHETIC'
            Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_PACKET_SCOPE_VALIDATION' 'PRIVATE_PACKET_SCOPE_REQUIRED'
        }
    }
    Case 'Missing environment is refused at scope checkpoint' {
        $P=Packet; $P.env=$null
        Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_PACKET_SCOPE_VALIDATION' 'PRIVATE_PACKET_SCOPE_REQUIRED'
    }
    foreach ($Field in @('EMAIL_GATE_MODE','EMAIL_GATE_PROJECT','EMAIL_GATE_ORIGIN','SUPABASE_PUBLISHABLE_KEY')) {
        $CaseField = $Field
        Case ('Environment rejects changed ' + $Field) {
            $P=Packet; $P.env.$CaseField='FOREIGN_SYNTHETIC'
            Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_PACKET_SCOPE_VALIDATION' 'PRIVATE_PACKET_SCOPE_REQUIRED'
        }
    }
    Case 'Malformed recipient JSON has a separate safe checkpoint' {
        $P=Packet; $P.env.ZOHO_TEST_RECIPIENTS_JSON='[PRIVATE_MALFORMED'
        Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_RECIPIENT_JSON' 'PRIVATE_RECIPIENT_JSON_REQUIRED'
    }
    foreach ($Json in @('[]','null','"one@example.invalid"','{}','[["one@example.invalid"]]','[null]','[12]','["one@example.invalid","ONE@example.invalid"]','["bad@example.invalid\r\nBcc:other@example.invalid"]','["one@example.invalid"],"extra":1')) {
        $CaseJson = $Json
        Case ('Invalid recipient structure ' + $Passed) {
            $P=Packet; $P.env.ZOHO_TEST_RECIPIENTS_JSON=$CaseJson
            Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_RECIPIENT_VALIDATION' 'PRIVATE_RECIPIENT_LIST_REQUIRED'
        }
    }
    Case 'More than ten inboxes is refused' {
        $P=Packet; $P.env.ZOHO_TEST_RECIPIENTS_JSON=(@(1..11 | ForEach-Object { 'a'+$_+'@example.invalid' }) | ConvertTo-Json -Compress)
        Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_RECIPIENT_VALIDATION' 'PRIVATE_RECIPIENT_LIST_REQUIRED'
    }
    Case 'Oversized recipient JSON is refused before parsing' {
        $P=Packet; $P.env.ZOHO_TEST_RECIPIENTS_JSON=(' ' * 8193)
        Refused { Get-RetainedGatewayPublicInputs $P } 'RETAINED_GATEWAY_RECIPIENT_JSON' 'PRIVATE_RECIPIENT_JSON_REQUIRED'
    }
    [IO.Directory]::CreateDirectory($TemporaryRoot) | Out-Null
    $ExistingRoot = Join-Path $TemporaryRoot 'existing'; [IO.Directory]::CreateDirectory($ExistingRoot) | Out-Null
    $First = Join-Path $ExistingRoot 'email-gateway-a.dpapi'; [IO.File]::WriteAllText($First,'PUBLIC_SYNTHETIC_CIPHERTEXT_PLACEHOLDER')
    Case 'Single packet is discovered without a prompt' {
        $Before=$script:Prompts; Check ((Select-RetainedGatewayPacket $ExistingRoot '') -ceq $First); Check ($script:Prompts -eq $Before)
    }
    Case 'Missing default directory reaches existing-file prompt' {
        $script:Answers.Enqueue($First); $Before=$script:Prompts
        Check ((Select-RetainedGatewayPacket (Join-Path $TemporaryRoot 'missing') '') -ceq $First)
        Check ($script:Prompts -eq ($Before+1))
    }
    $EmptyRoot=Join-Path $TemporaryRoot 'empty'; [IO.Directory]::CreateDirectory($EmptyRoot) | Out-Null
    Case 'Empty directory reaches existing-file prompt' {
        $script:Answers.Enqueue($First); Check ((Select-RetainedGatewayPacket $EmptyRoot '') -ceq $First)
    }
    Case 'Explicit existing packet bypasses discovery and accepts quoted path' {
        $Before=$script:Prompts; Check ((Select-RetainedGatewayPacket $EmptyRoot ('"'+$First+'"')) -ceq $First); Check ($script:Prompts -eq $Before)
    }
    $Second=Join-Path $ExistingRoot 'email-gateway-b.dpapi'; [IO.File]::WriteAllText($Second,'PUBLIC_SYNTHETIC_CIPHERTEXT_PLACEHOLDER')
    Case 'Multiple packets use stable numbered selection' {
        $script:Answers.Enqueue('2'); Check ((Select-RetainedGatewayPacket $ExistingRoot '') -ceq $Second)
    }
    foreach ($Answer in @('0','3','9999999999999999999999999999','invalid')) {
        $CaseAnswer=$Answer
        Case ('Invalid packet choice ' + $Passed) {
            $script:Answers.Enqueue($CaseAnswer)
            Refused { Select-RetainedGatewayPacket $ExistingRoot '' } 'RETAINED_GATEWAY_PACKET_CHOICE' 'PRIVATE_PACKET_SELECTION_REQUIRED'
        }
    }
    Case 'Relative packet path is refused' {
        Refused { Select-RetainedGatewayPacket $EmptyRoot 'relative.dpapi' } 'RETAINED_GATEWAY_PACKET_PATH_VALIDATION' 'PRIVATE_PACKET_PATH_REVIEW_REQUIRED'
    }
    Case 'Default directory that is a file is refused' {
        Refused { Select-RetainedGatewayPacket $First '' } 'RETAINED_GATEWAY_PACKET_DISCOVERY' 'PRIVATE_PACKET_DISCOVERY_REVIEW_REQUIRED'
    }
    Case 'Selection tests did not alter retained fixture bytes' {
        Check ([IO.File]::ReadAllText($First) -ceq 'PUBLIC_SYNTHETIC_CIPHERTEXT_PLACEHOLDER')
        Check ([IO.File]::ReadAllText($Second) -ceq 'PUBLIC_SYNTHETIC_CIPHERTEXT_PLACEHOLDER')
        Check ($script:Answers.Count -eq 0)
    }
} catch { $Failed.Add('RUNNER_TEST_HARNESS_REQUIRED') }
finally { if ([IO.Directory]::Exists($TemporaryRoot)) { [IO.Directory]::Delete($TemporaryRoot,$true) } }
$Ok = $Failed.Count -eq 0
[pscustomobject]@{result=$(if ($Ok) {'LOCAL_PACKET_HELPERS_PASS'} else {'LOCAL_PACKET_HELPERS_REVIEW_REQUIRED'});powershell_version=$PSVersionTable.PSVersion.ToString();
    tests=$Passed+$Failed.Count;pass=$Passed;fail=$Failed.Count;failed_cases=@($Failed.ToArray());
    actual_runner_AST_and_helpers_executed=$true;legacy_JSON_pipeline_behavior_modeled=$true;
    Windows_DPAPI_or_owner_packet_exercised=$false;actual_hosted_requests=0;exit_code=$(if ($Ok) {0} else {1})} | ConvertTo-Json -Depth 5
if (-not $Ok) { exit 1 }
