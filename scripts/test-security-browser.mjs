// Headless UI fixtures. Every browser API call is intercepted; no live DB access.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';
const base=process.env.TEST_BASE_URL||'http://localhost:3101';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const context=await browser.newContext();
 const anon=await context.request.get(`${base}/api/classes/10000000-0000-4000-8000-000000000001/directory`);
 assert.equal(anon.status(),200);
 assert.deepEqual((await anon.json()).students,[]);
 const crossSite=await context.request.post(`${base}/api/student/login`,{headers:{origin:'https://hostile.invalid'},data:{}});
 assert.equal(crossSite.status(),403);
 const oversized=await context.request.post(`${base}/api/student/login`,{data:{padding:'x'.repeat(270000)}});
 assert.equal(oversized.status(),413);
 const token=await new SignJWT({studentId:'student',classId:'class-test',credentialVersion:'synthetic-browser-version', email: 'synthetic@example.invalid'}).setAudience('student-session').setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(new TextEncoder().encode('phase14-16-local-test-only'));
 const seen=[],errors=[];
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;seen.push(path);
  let data={};
  if(path==='/api/student/login') {
   assert.equal(req.postDataJSON().idNumber,'0001');
   await context.addCookies([{name:'student_token',value:token,url:base}]);data={ok:true,student:{id:'student',name:'Synthetic Student'}};
  } else if(path==='/api/classes/class-test/directory') {
   const query=new URL(req.url()).searchParams.get('q');
   data={students: query && ('synthetic student'.includes(query.toLowerCase()) || '0001'.includes(query)) ? [{name:'Synthetic Student',idNumber:'0001'}] : []};
  } else if(path==='/api/student/slots') data={slots:[]};
  else if(path==='/api/student/notifications') data={notifications:[]};
  else if(path==='/api/student/class-info') data={class:{name:'Test class',term:'Test term'}};
  else if(path==='/api/student/me') {
   if(req.method()==='PATCH') { assert.equal(req.postDataJSON().newPassword,'new-test-password');await context.clearCookies({name:'student_token'});data={ok:true}; }
   else data={id:'student',classId:'class-test',name:'Synthetic Student',idNumber:'0001',memberships:[]};
  } else { errors.push(path); await route.abort();return; }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/c/class-test/login`);
 const search=page.getByRole('combobox',{name:'Name or ID number'});
 await search.fill('s');
 await page.waitForTimeout(350);
 assert.ok(!seen.some(path=>path.includes('/directory')));
 await search.fill('sYnTh');
 await page.getByRole('option',{name:'Synthetic Student 0001'}).waitFor();
 await search.press('ArrowDown'); await search.press('Enter');
 assert.equal(await search.inputValue(),'Synthetic Student · 0001');
 await page.getByLabel('Password',{exact:true}).evaluate(input=>{if(document.activeElement!==input) throw new Error('Selection did not focus password');});
 await page.getByLabel('Password',{exact:true}).fill('old-test-password');
 assert.equal(await page.getByRole('combobox').count(),1);
 await page.getByRole('button',{name:'Log in',exact:true}).click();
 await page.waitForURL(`${base}/c/class-test`);
 await page.goto(`${base}/c/class-test/me`);
 await page.getByLabel('Current password',{exact:true}).fill('old-test-password');
 await page.getByLabel('New password',{exact:true}).fill('new-test-password');
 await page.getByLabel('Confirm new password',{exact:true}).fill('new-test-password');
 assert.equal(await page.getByLabel('New password',{exact:true}).getAttribute('minlength'),'12');
 await page.getByRole('button',{name:'Update password',exact:true}).click();
 await page.waitForURL(`${base}/c/class-test/login`);
 assert.ok(seen.some(path=>path.includes('/directory')));
 await search.fill('0001');
 await page.getByLabel('Password',{exact:true}).fill('new-test-password');
 await page.getByRole('button',{name:'Log in',exact:true}).click();
 await page.waitForURL(`${base}/c/class-test`);
 assert.deepEqual(errors,[]);
 console.log('PASS empty roster withheld; bounded name/ID search; keyboard selection focuses password; direct ID login; cross-site/oversized writes denied; password change returns to login; no browser errors');
 await context.close();
} finally {await browser.close();}
