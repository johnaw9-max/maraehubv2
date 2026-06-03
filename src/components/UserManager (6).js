import React,{useState,useEffect}from'react';
import{supabase}from'../lib/supabase';
const RC={trustee:{bg:'#e8f4ef',color:'#1a4a3a'},community:{bg:'#e8eef8',color:'#1a4a8a'}};
export default function UserManager(){
const[users,setUsers]=useState([]);
const[loading,setLoading]=useState(true);
const[showForm,setShowForm]=useState(false);
const[editId,setEditId]=useState(null);
const[form,setForm]=useState({full_name:'',email:'',password:'',role:'community'});
const[saving,setSaving]=useState(false);
const[error,setError]=useState('');
const[success,setSuccess]=useState('');
useEffect(()=>{fetchUsers();},[]);// eslint-disable-line react-hooks/exhaustive-deps
async function fetchUsers(){
setLoading(true);
const{data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false});
setUsers(data||[]);
setLoading(false);
}
function openAdd(){setForm({full_name:'',email:'',password:'',role:'community'});setEditId(null);setError('');setSuccess('');setShowForm(true);}
function openEdit(u){setForm({full_name:u.full_name||'',email:u.email||'',password:'',role:u.role});setEditId(u.id);setError('');setSuccess('');setShowForm(true);}
async function handleSave(){
if(!form.full_name.trim()){setError('Full name is required');return;}
setSaving(true);setError('');setSuccess('');
if(editId){
const{error}=await supabase.from('profiles').update({full_name:form.full_name.trim(),role:form.role}).eq('id',editId);
if(error){setError(error.message);setSaving(false);return;}
setSuccess('Details updated.');
}else{
if(!form.email.trim()){setError('Email required');setSaving(false);return;}
if(!form.password||form.password.length<6){setError('Password min 6 chars');setSaving(false);return;}
const{data:sd,error:se}=await supabase.auth.signUp({email:form.email.trim(),password:form.password});
if(se){setError(se.message);setSaving(false);return;}
if(sd&&sd.user){await supabase.from('profiles').insert({id:sd.user.id,full_name:form.full_name.trim(),email:form.email.trim(),role:form.role});}
setSuccess(form.full_name+' added.');
}
setShowForm(false);setEditId(null);setSaving(false);fetchUsers();
}
async function handleUpdateRole(id,r){await supabase.from('profiles').update({role:r}).eq('id',id);fetchUsers();}
async function handleDelete(id,name){if(!window.confirm('Remove '+name+'?'))return;await supabase.from('profiles').delete().eq('id',id);fetchUsers();}
function setField(k,v){setForm(f=>({...f,[k]:v}));}
function fmt(d){if(!d)return'';return new Date(d).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});}
const trustees=users.filter(u=>u.role==='trustee');
const community=users.filter(u=>u.role==='community');
function Card({u,isTrustee}){
const ini=u.full_name?u.full_name.split(' ').map(n=>n[0]).join('').toUpperCase():'?';
const rs=isTrustee?RC.trustee:RC.community;
return(
<div className="panel" style={{display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
<div style={{width:40,height:40,borderRadius:'50%',background:isTrustee?'var(--brand)':'var(--info)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:14,color:'#fff',flexShrink:0}}>{ini}</div>
<div style={{flex:1}}>
<div style={{fontSize:14,fontWeight:600}}>{u.full_name||'—'}</div>
<div style={{fontSize:12,color:'var(--text3)'}}>{u.email} · Added {fmt(u.created_at)}</div>
</div>
<span style={{fontSize:10,borderRadius:20,padding:'2px 10px',fontWeight:600,background:rs.bg,color:rs.color}}>{isTrustee?'Trustee':'Community'}</span>
<div style={{display:'flex',gap:6}}>
<button onClick={()=>openEdit(u)} style={{fontSize:11,color:'var(--brand)',background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',cursor:'pointer'}}>Edit</button>
<button onClick={()=>handleUpdateRole(u.id,isTrustee?'community':'trustee')} style={{fontSize:11,color:'var(--text2)',background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',cursor:'pointer'}}>{isTrustee?'Make Community':'Make Trustee'}</button>
<button onClick={()=>handleDelete(u.id,u.full_name)} style={{fontSize:11,color:'var(--danger)',background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',cursor:'pointer'}}>Remove</button>
</div>
</div>
);}
return(
<div>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
<div><h2 style={{fontSize:22}}>User Management</h2><p style={{fontSize:12,color:'var(--text3)',marginTop:4}}>Add and manage trustees and community members</p></div>
<button className="btn-primary" onClick={openAdd}>+ Add User</button>
</div>
{error&&<div className="alert alert-error">{error}</div>}
{success&&<div className="alert alert-success">{success}</div>}
{showForm&&(
<div className="panel" style={{marginBottom:20}}>
<div style={{fontFamily:'Playfair Display, serif',fontSize:16,fontWeight:600,marginBottom:16}}>{editId?'Edit User':'Add New User'}</div>
<div className="grid-2">
<div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.full_name} onChange={e=>setField('full_name',e.target.value)} placeholder="e.g. Hemi Walker"/></div>
<div className="form-group"><label className="form-label">Role</label><select className="form-input" value={form.role} onChange={e=>setField('role',e.target.value)}><option value="community">Community Member</option><option value="trustee">Trustee</option></select></div>
</div>
{!editId&&(<>
<div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email} onChange={e=>setField('email',e.target.value)} placeholder="e.g. hemi@email.com"/></div>
<div className="form-group"><label className="form-label">Temporary Password *</label><input type="password" className="form-input" value={form.password} onChange={e=>setField('password',e.target.value)} placeholder="Min 6 characters"/><div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Share this with the user</div></div>
</>)}
<div className="modal-actions">
<button className="btn-secondary" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancel</button>
<button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving...':editId?'Save Changes':'Add User'}</button>
</div>
</div>
)}
{loading?<div className="loading">Loading users...</div>:(
<>
<div style={{marginBottom:24}}>
<div style={{fontSize:12,fontWeight:600,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Trustees ({trustees.length})</div>
{trustees.length===0?<div style={{fontSize:13,color:'var(--text3)',padding:'12px 0'}}>No trustees yet</div>:trustees.map(u=><Card key={u.id} u={u} isTrustee={true}/>)}
</div>
<div>
<div style={{fontSize:12,fontWeight:600,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Community Members ({community.length})</div>
{community.length===0?<div style={{fontSize:13,color:'var(--text3)',padding:'12px 0'}}>No community members yet</div>:community.map(u=><Card key={u.id} u={u} isTrustee={false}/>)}
</div>
</>
)}
</div>
);}
