// Lists the SharePoint macro folder via Microsoft Graph. Secrets stay server-side.
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    const g=(k:string)=>Deno.env.get(k)!;
    const t=await(await fetch(`https://login.microsoftonline.com/${g("MS_TENANT_ID")}/oauth2/v2.0/token`,{method:"POST",
      body:new URLSearchParams({client_id:g("MS_CLIENT_ID"),client_secret:g("MS_CLIENT_SECRET"),scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials"})})).json();
    if(!t.access_token)throw new Error("Graph auth failed");
    const folder=g("SP_FOLDER_PATH").split("/").map(encodeURIComponent).join("/");
    const url=`https://graph.microsoft.com/v1.0/sites/${g("SP_SITE_ID")}/drives/${g("SP_DRIVE_ID")}/root:/${folder}:/children?$top=999`;
    const r=await fetch(url,{headers:{Authorization:`Bearer ${t.access_token}`}});
    if(!r.ok)throw new Error("Graph list failed "+r.status);
    const j=await r.json();
    const files=(j.value||[]).filter((i:any)=>i.file&&/\.(xlsm|xlsb|xlsx|xls|bas)$/i.test(i.name)).map((i:any)=>({
      name:i.name,size:i.size,modified:i.lastModifiedDateTime,modifiedBy:i.lastModifiedBy?.user?.displayName,downloadUrl:i["@microsoft.graph.downloadUrl"]}));
    return new Response(JSON.stringify({files}),{headers:H});
  }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:500,headers:H})}
});
