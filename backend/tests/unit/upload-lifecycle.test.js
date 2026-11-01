const mockModule=(name,exports)=>{const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};};
const remove=vi.fn().mockResolvedValue(undefined);
const execute=vi.fn();
const transaction=vi.fn(callback=>callback({query:execute}));
const otp=vi.fn().mockResolvedValue(undefined);
mockModule('../../src/config/db',{query:execute,transaction});
mockModule('../../src/models/user.model',{userExists:vi.fn().mockResolvedValue(false)});
mockModule('../../src/models/role.model',{getRoleByName:vi.fn().mockResolvedValue({id:1})});
mockModule('../../src/services/otp.service',{generateAndSendOTP:otp});
mockModule('../../src/services/encryption.service',{hashPassword:vi.fn().mockResolvedValue('synthetic-password-hash')});
mockModule('../../src/services/audit.service',{createAuditLog:vi.fn().mockResolvedValue({id:'audit'})});
mockModule('../../src/services/encrypted-file-store',{removeEncrypted:remove});
const Auth=require('../../src/modules/auth/auth.controller');
const fileInfo={filePath:'/fixture/uploads/medical_files/patient/imaging/report.pdf',fileUrl:'/api/files/patient/imaging/report.pdf'};
mockModule('../../src/services/file.upload.service',{processUpload:vi.fn().mockResolvedValue(fileInfo),deleteFile:remove});
mockModule('../../src/services/credential-file.service',{secureCredential:vi.fn().mockResolvedValue(undefined)});
const Emr=require('../../src/modules/emr/emr.controller');
const Radiology=require('../../src/modules/radiology/radiology.controller');
const MedicalRecord=require('../../src/models/medical_record.model');
const LabResult=require('../../src/models/lab_result.model');
const RadiologyReport=require('../../src/models/radiology_report.model');
const VerificationDocument=require('../../src/models/verification_document.model');
const Verification=require('../../src/services/doctor.verification.service');
const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const request=()=>({body:{email:'organization@example.invalid',password:'SyntheticPassw0rd!2026',organizationName:'Synthetic clinic',organizationType:'clinic',licenseNumber:'SYNTHETIC-LICENSE'},file:{path:'/fixture/uploads/documents/license.pdf'},headers:{},method:'POST',path:'/api/auth/register/organization',ip:'127.0.0.1'});

beforeEach(()=>{
 remove.mockClear();otp.mockReset().mockResolvedValue(undefined);transaction.mockClear();execute.mockReset();
 execute.mockImplementation(async(sql,values)=>({rows:[sql.includes('INSERT INTO organizations')?{id:'organization',name:'Synthetic clinic',license_document_url:values.at(-1)}:{id:'user',email:'organization@example.invalid'}]}));
});
it('organization registration commits the uploaded license reference with its organization',async()=>{
 const req=request(),res=response();await Auth.registerOrganization(req,res);expect(res.code).toBe(201);
 const insertion=execute.mock.calls.find(([sql])=>sql.includes('INSERT INTO organizations'));
 expect(insertion[0]).toContain('license_document_url');expect(insertion[1]).toContain(req.file.path);expect(remove).not.toHaveBeenCalled();
});
it('organization validation failure reclaims the unpublished license',async()=>{
 const req=request();req.body={};const res=response();await Auth.registerOrganization(req,res);
 expect(res.code).toBe(400);expect(remove).toHaveBeenCalledWith(req.file.path);expect(transaction).not.toHaveBeenCalled();
});
it('a post-commit delivery failure keeps the referenced license',async()=>{
 otp.mockRejectedValueOnce(Error('synthetic email failure'));const req=request(),res=response();await Auth.registerOrganization(req,res);
 expect(res.code).toBe(500);expect(remove).not.toHaveBeenCalled();
});
it('malformed lab metadata reclaims its newly published file bytes',async()=>{
 vi.spyOn(MedicalRecord,'findById').mockResolvedValue({id:'record',patient_id:'patient'});
 const req={body:{recordId:'record',resultsData:'{invalid-json'},file:{},user:{id:'doctor'}};
 const res=response();await Emr.uploadLabResult(req,res);expect(res.code).toBe(500);expect(remove).toHaveBeenCalledWith(fileInfo.filePath);
});
it('a failed lab insert reclaims its unpublished file',async()=>{
 vi.spyOn(MedicalRecord,'findById').mockResolvedValue({id:'record',patient_id:'patient'});
 vi.spyOn(LabResult,'create').mockRejectedValue(Error('synthetic insert failure'));
 const res=response();await Emr.uploadLabResult({body:{recordId:'record'},file:{},user:{id:'doctor'}},res);
 expect(res.code).toBe(500);expect(remove).toHaveBeenCalledWith(fileInfo.filePath);
});
it('a failed radiology insert reclaims its unpublished file',async()=>{
 vi.spyOn(RadiologyReport,'createReport').mockRejectedValue(Error('synthetic report failure'));
 const res=response();await Radiology.uploadReport({body:{orderId:'order'},file:{},user:{id:'doctor'},clinicalContext:{patient_id:'patient'}},res);
 expect(res.code).toBe(500);expect(remove).toHaveBeenCalledWith(fileInfo.filePath);
});
it('a rejected credential document insert reclaims its unpublished file',async()=>{
 vi.spyOn(VerificationDocument,'create').mockRejectedValue(Error('synthetic credential failure'));
 await expect(Verification.uploadLicenseDocument('doctor',{path:'/fixture/uploads/documents/license.pdf',mimetype:'application/pdf'})).rejects.toThrow('synthetic credential failure');
 expect(remove).toHaveBeenCalledWith('/fixture/uploads/documents/license.pdf');
});
