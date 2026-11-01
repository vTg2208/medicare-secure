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
 # Exercise the actual platform header parser without opening a connection.
 function Invoke-RestMethod {
  param($Uri,$Headers,$MaximumRedirection,$TimeoutSec,$Method,$ContentType,$Body,[switch]$SkipHeaderValidation)
  if($MaximumRedirection -ne 0){throw 'Provider redirects must stay disabled'}
  if($PSVersionTable.PSVersion.Major -ge 6){
   $message=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post,$Uri)
   try {
    if($SkipHeaderValidation){[void]$message.Headers.TryAddWithoutValidation('Authorization',$Headers.Authorization)}else{$message.Headers.Add('Authorization',$Headers.Authorization)}
    return @{authorization=($message.Headers.GetValues('Authorization') -join '');body=$Body}
   }finally{$message.Dispose()}
  }else{
   $web=[Net.WebRequest]::Create($Uri);$web.Headers['Authorization']=$Headers.Authorization
   return @{authorization=$web.Headers['Authorization'];body=$Body}
  }
 }
 $response=Invoke-B2Json -Uri 'https://api005.backblazeb2.com/b2api/v4/b2_create_key' -Headers @{Authorization='4_fixture+/=='} -Body '{"fixture":true}'
 if($response.authorization -ne '4_fixture+/==' -or $response.body -ne '{"fixture":true}'){throw 'Opaque authorization or JSON body was changed'}
 Write-Output 'PASS: opaque B2 authorization accepted with redirects disabled and body preserved'
} finally {
 if([IO.Path]::GetFullPath($testRoot).StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) -and (Split-Path $testRoot -Leaf) -like 'b2-permission-test-*'){Remove-Item -LiteralPath $testRoot -Recurse -Force}
}
