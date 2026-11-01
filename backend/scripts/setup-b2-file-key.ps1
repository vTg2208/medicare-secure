param([switch]$Create)
function Initialize-BackupSecretDirectory([string]$privateDir) {
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
# Load and persist only access rules. Set-Acl attempts other security sections
# in Windows PowerShell and can require the unrelated SeSecurityPrivilege.
$directory=[IO.DirectoryInfo]::new([IO.Path]::GetFullPath($privateDir))
if(($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Secret directory must not be a link or junction.'}
if($PSVersionTable.PSEdition -eq 'Desktop'){
 $acl=$directory.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
}else{
 $acl=[IO.FileSystemAclExtensions]::GetAccessControl($directory,[Security.AccessControl.AccessControlSections]::Access)
}
$acl.SetAccessRuleProtection($true,$false)
foreach($existing in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){$acl.RemoveAccessRuleSpecific($existing)}
$rule=[Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($rule)
if($PSVersionTable.PSEdition -eq 'Desktop'){$directory.SetAccessControl($acl)}else{[IO.FileSystemAclExtensions]::SetAccessControl($directory,$acl)}
}

$ErrorActionPreference='Stop'
$bucketId='6d54a6a4fa25936fa01d0e11'
$required=@('listBuckets','listFiles','readFiles','writeFiles','deleteFiles')
$request=@{capabilities=$required;keyName='medicare-backup-files-only';bucketIds=@($bucketId);namePrefix='medicare-backups/'}
if(-not $Create){$request | ConvertTo-Json -Depth 5; Write-Output 'Review only. Run with -Create to enter administrator credentials securely and create the scoped key.';return}
if($env:OS -ne 'Windows_NT'){throw 'This one-time helper requires Windows user-protected credential storage.'}
$privateDir=Join-Path $PSScriptRoot '../../.local/backup-secrets'
$target=Join-Path $privateDir 'b2-files-only.dpapi'
if(Test-Path -LiteralPath $target){throw 'Protected key file already exists; refusing to overwrite it.'}
Initialize-BackupSecretDirectory $privateDir
$masterId=Read-Host 'Administrator key ID (not the backup key ID)'
$masterSecret=Read-Host 'Administrator application key (hidden; never saved)' -AsSecureString
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($masterSecret)
try{
 $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
 $basic=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($masterId+':'+$plain))
 $auth=Invoke-RestMethod -Uri 'https://api.backblazeb2.com/b2api/v4/b2_authorize_account' -Headers @{Authorization='Basic '+$basic} -MaximumRedirection 0 -TimeoutSec 30
 $api=$auth.apiInfo.storageApi
 if('writeKeys' -notin $api.allowed.capabilities){throw 'Administrator principal cannot create scoped keys.'}
 $apiUri=[Uri]$api.apiUrl
 if($apiUri.Scheme -ne 'https' -or -not $apiUri.IsDefaultPort -or $apiUri.UserInfo -or $apiUri.Host -notmatch '(^|\.)backblazeb2\.com$'){throw 'Untrusted provider endpoint.'}
 $request.accountId=$auth.accountId
 $headers=@{Authorization=$auth.authorizationToken}
 $created=Invoke-RestMethod -Uri ($api.apiUrl+'/b2api/v4/b2_create_key') -Method Post -Headers $headers -ContentType 'application/json' -Body ($request|ConvertTo-Json -Depth 5) -MaximumRedirection 0 -TimeoutSec 30
 if($created.namePrefix -ne 'medicare-backups/' -or $created.bucketIds.Count -ne 1 -or $created.bucketIds[0] -ne $bucketId -or $created.capabilities.Count -ne 5 -or @($created.capabilities|Where-Object {$_ -notin $required}).Count -or -not $created.applicationKey){throw 'Created key scope did not match the approved request.'}
 $payload=@{B2_KEY_ID=$created.applicationKeyId;B2_APPLICATION_KEY=$created.applicationKey;B2_BUCKET_ID=$bucketId;B2_PREFIX='medicare-backups/'}|ConvertTo-Json -Compress
 $protected=ConvertFrom-SecureString (ConvertTo-SecureString $payload -AsPlainText -Force)
 $handle=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes($protected);$handle.Write($bytes,0,$bytes.Length)}finally{$handle.Dispose()}
 Write-Output 'Exact file-only key created and saved with Windows user protection. The administrator key was not saved.'
} catch {
 Write-Error 'Setup failed. No administrator credential or provider response is printed. Inspect the key list before retrying in case the provider created a key.'
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
 $plain=$null;$basic=$null;$payload=$null;$masterSecret.Dispose();$auth=$null;$created=$null
}
