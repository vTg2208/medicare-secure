$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/setup-b2-file-key.ps1') | Out-Null
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('b2-permission-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
 $privateDir=Join-Path $testRoot 'private'
 Initialize-BackupSecretDirectory $privateDir
 $acl=Get-Acl -LiteralPath $privateDir
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 if(-not $acl.AreAccessRulesProtected){throw 'Directory still inherits access permissions'}
 $rules=@($acl.Access)
 if($rules.Count -ne 1){throw 'Directory grants access to unexpected principals'}
 if($rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $sid -or $rules[0].AccessControlType -ne 'Allow' -or ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl){throw 'Current user lacks exclusive full access'}
 $file=Join-Path $privateDir 'synthetic.dpapi'
 $secret=ConvertTo-SecureString 'synthetic-test-only' -AsPlainText -Force
 $encoded=ConvertFrom-SecureString $secret
 [IO.File]::WriteAllText($file,$encoded)
 $decoded=ConvertTo-SecureString ([IO.File]::ReadAllText($file))
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($decoded)
 try {if([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) -ne 'synthetic-test-only'){throw 'DPAPI round trip failed'}}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
 # Repeat against an existing directory, matching the failed first setup attempt.
 Initialize-BackupSecretDirectory $privateDir
 if(-not (Test-Path -LiteralPath $file)){throw 'Existing protected content was changed'}
 Write-Output 'PASS: normal-user directory ACL, protected write, DPAPI round trip and safe retry'
} finally {
 if([IO.Path]::GetFullPath($testRoot).StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) -and (Split-Path $testRoot -Leaf) -like 'b2-permission-test-*'){Remove-Item -LiteralPath $testRoot -Recurse -Force}
}
