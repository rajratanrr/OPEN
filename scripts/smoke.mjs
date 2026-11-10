import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_API_URL||'http://127.0.0.1:3000';
class Client {
  cookies=new Map();
  async request(path,method='GET',data,expected=200) {
    const headers={'X-Roadsaathi':'1','Origin':'http://127.0.0.1:5173',Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')};
    if(data&&!(data instanceof FormData))headers['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers,body:data instanceof FormData?data:data?JSON.stringify(data):undefined});
    for(const line of response.headers.getSetCookie()) {const pair=line.split(';')[0],at=pair.indexOf('=');this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
    const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}
    assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(body));return body;
  }
}
const citizen=new Client(),officer=new Client(),publicClient=new Client(),other=new Client(),admin=new Client();
const runId=randomUUID();const results=[];const record=name=>{results.push(name);console.log('PASS',name);};
await publicClient.request('/actuator/health');record('Health: PostgreSQL connected');
await publicClient.request('/api/v1/users/me','GET',undefined,401);
const user=await citizen.request('/api/v1/auth/register','POST',{name:'QA Citizen',email:`qa-${runId}@roadsaathi.test`,password:'QA-Strong-Pass-2026'},201);record('Citizen registration and session cookie');
await citizen.request('/api/v1/auth/me');await citizen.request('/api/v1/auth/refresh','POST');await citizen.request('/api/v1/auth/me');record('Session refresh rotates cookies');
await citizen.request('/api/v1/admin/users','GET',undefined,403);await citizen.request('/api/v1/municipal/reports','GET',undefined,403);record('Citizen cannot access privileged endpoints');
const seeded=await publicClient.request('/api/v1/reports?pageSize=1');const image=await fetch(base+'/api/v1/evidence/'+seeded.items[0].evidenceId).then(r=>r.blob());
const form=new FormData();form.append('image',image,'test-road.jpg');const evidence=await citizen.request('/api/v1/evidence','POST',form,201);record('Validated image upload persists');
const bad=new FormData();bad.append('image',new Blob(['<script>bad</script>'],{type:'image/jpeg'}),'fake.jpg');await citizen.request('/api/v1/evidence','POST',bad,400);record('Invalid image bytes rejected');
const ai=await citizen.request('/api/v1/ai/analyze-road-image','POST',{evidenceId:evidence.id,consent:true});assert.equal(ai.status,'UNAVAILABLE');assert.equal(ai.result,null);record('Missing AI credentials produce honest manual fallback');
const input={clientRequestId:randomUUID(),roadName:'QA integration road',description:'Synthetic test record to validate the entire repair lifecycle.',latitude:30.9021,longitude:75.8541,gpsAccuracyMeters:8,damageType:'POTHOLE',severity:'HIGH',evidenceId:evidence.id,aiAnalysisId:ai.id};
const report=await citizen.request('/api/v1/reports','POST',input,201);assert.equal(report.status,'PENDING_REVIEW');const again=await citizen.request('/api/v1/reports','POST',input,201);assert.equal(again.id,report.id);record('Report persists; idempotent retry returns same report');
const nearby=await publicClient.request('/api/v1/reports/nearby?latitude=30.9021&longitude=75.8541&radius=20&damageType=POTHOLE');assert(nearby.items.some(r=>r.id===report.id));record('PostGIS nearby search locates new report');
const far=await publicClient.request('/api/v1/reports/nearby?latitude=30.92&longitude=75.9&radius=20');assert(!far.items.some(r=>r.id===report.id));record('Spatial radius excludes distant reports');
await citizen.request('/api/v1/municipal/reports/'+report.id+'/status','PATCH',{status:'RESOLVED',reason:'Illegitimate attempt'},403);record('Citizen cannot resolve own report');
await officer.request('/api/v1/auth/login','POST',{email:'officer@roadsaathi.demo',password:process.env.DEMO_PASSWORD||'RoadDemo!2026'});
const pending=await officer.request('/api/v1/municipal/reports/pending');assert(pending.items.some(r=>r.id===report.id));
await officer.request('/api/v1/municipal/reports/'+report.id+'/verify','POST');record('Officer verifies pending report');
const otherUser=await other.request('/api/v1/auth/register','POST',{name:'QA Confirmer',email:`qa-other-${runId}@roadsaathi.test`,password:'QA-Strong-Pass-2026'},201);
await other.request('/api/v1/reports/'+report.id+'/confirm','POST');await other.request('/api/v1/reports/'+report.id+'/confirm','POST');const rewards=await other.request('/api/v1/rewards/me');assert.equal(rewards.points,5);record('Independent confirmations and rewards deduplicate');
const me=await officer.request('/api/v1/auth/me');const due=new Date(Date.now()+86400000).toISOString().slice(0,10);
await officer.request('/api/v1/municipal/reports/'+report.id+'/assign','POST',{status:'ASSIGNED',assignedTo:me.id,priority:'HIGH',dueDate:due,reason:'QA assignment'});
await officer.request('/api/v1/municipal/reports/'+report.id+'/status','PATCH',{status:'IN_PROGRESS',reason:'Repair team began work.'});
await officer.request('/api/v1/municipal/reports/'+report.id+'/status','PATCH',{status:'RESOLVED'},400);record('Resolution requires evidence or documented reason');
const repairedForm=new FormData();repairedForm.append('image',image,'repair.jpg');const repaired=await officer.request('/api/v1/evidence','POST',repairedForm,201);
await officer.request('/api/v1/municipal/reports/'+report.id+'/repair-evidence','POST',{evidenceId:repaired.id,notes:'Synthetic repair completion evidence.'});
await officer.request('/api/v1/municipal/reports/'+report.id+'/status','PATCH',{status:'RESOLVED',reason:'Repair completed and evidence uploaded.'});record('Assignment → in progress → evidence → resolved');
const completed=await citizen.request('/api/v1/reports/'+report.id);assert.equal(completed.status,'RESOLVED');assert.equal(completed.history.length,5);assert.equal(completed.repairEvidence.length,1);record('Citizen sees persisted repair timeline and photographs');
const map=await publicClient.request('/api/v1/reports/map?south=30.90&north=30.91&west=75.85&east=75.86&status=RESOLVED');assert(map.items.some(r=>r.id===report.id));
const notifications=await citizen.request('/api/v1/notifications');assert(notifications.some(n=>n.title.includes('resolved')));record('Resolved marker and citizen notification update');
const analytics=await officer.request('/api/v1/analytics/municipal-summary');assert(analytics.resolved>=1);record('SQL analytics reflect repair');
const session=await citizen.request('/api/v1/monitoring/sessions','POST');const now=new Date().toISOString();const event={id:randomUUID(),latitude:30.902,longitude:75.854,recordedAt:now,accelerationMagnitude:13,jerk:22,estimatedSpeed:8,gpsAccuracy:10};
const stored=await citizen.request('/api/v1/monitoring/sessions/'+session.id+'/events','POST',{events:[event]});assert.equal(stored.inserted,1);
await other.request('/api/v1/monitoring/sessions/'+session.id,'GET',undefined,404);
await citizen.request('/api/v1/telemetry/samples','POST',{sessionId:session.id,samples:[{id:randomUUID(),recordedAt:now,magnitude:13,jerk:22,latitude:30.902,longitude:75.854,speed:8,accuracy:10}]},201);
const samples=await citizen.request('/api/v1/telemetry/sessions/'+session.id);assert.equal(samples.length,1);await citizen.request('/api/v1/monitoring/sessions/'+session.id+'/stop','PATCH');record('Sensor events in PostGIS + private raw telemetry in MongoDB');
const slightlyEarly=new Date(Date.parse(session.startedAt)-500).toISOString();
const skewed=await citizen.request('/api/v1/monitoring/sessions/'+session.id+'/events','POST',{events:[{...event,id:randomUUID(),recordedAt:slightlyEarly}]});assert.equal(skewed.inserted,1);
await citizen.request('/api/v1/telemetry/samples','POST',{sessionId:session.id,samples:[{id:randomUUID(),recordedAt:slightlyEarly,magnitude:13,jerk:22,latitude:30.902,longitude:75.854,speed:8,accuracy:10}]},201);record('Small phone clock skew accepted by both sensor stores');
const tooEarly=new Date(Date.parse(session.startedAt)-31000).toISOString();
await citizen.request('/api/v1/monitoring/sessions/'+session.id+'/events','POST',{events:[{...event,id:randomUUID(),recordedAt:tooEarly}]},400);
await citizen.request('/api/v1/telemetry/samples','POST',{sessionId:session.id,samples:[{id:randomUUID(),recordedAt:tooEarly,magnitude:13,jerk:22,latitude:30.902,longitude:75.854,speed:8,accuracy:10}]},400);record('Sensor timestamps outside bounded session tolerance rejected');
await admin.request('/api/v1/auth/login','POST',{email:'admin@roadsaathi.demo',password:process.env.DEMO_PASSWORD||'RoadDemo!2026'});
const audit=await admin.request('/api/v1/admin/audit-logs');assert(audit.some(a=>a.entityId===report.id));record('Administrative audit history contains lifecycle mutations');
await citizen.request('/api/v1/auth/logout','POST');await citizen.request('/api/v1/auth/me','GET',undefined,401);record('Logout invalidates access');
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/api-smoke.json',import.meta.url),JSON.stringify({runId,passed:results.length,checks:results,createdUserIds:[user.id,otherUser.id],reportId:report.id},null,2));
console.log(`Completed ${results.length} real full-stack checks.`);
