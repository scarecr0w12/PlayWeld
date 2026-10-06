// SPDX-License-Identifier: Apache-2.0
// A small stdio relay: the worker is created suspended in an LPAC and assigned
// to a kill-on-close Job before any untrusted instruction executes.
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

class AppContainerHost {
    static void Trace(string stage) { if(Environment.GetEnvironmentVariable("PLAYWELD_ISOLATION_TRACE")=="1") Console.Error.WriteLine("Isolation stage: "+stage); }
    public class Spec {
        public string command { get; set; } public string cwd { get; set; } public string pluginDir { get; set; } public string scratchDir { get; set; } public string profileName { get; set; }
        public string[] args { get; set; } public string[] readOnlyPaths { get; set; } public string[] readWritePaths { get; set; }
        public Dictionary<string, string> env { get; set; }
        public bool network { get; set; } public bool cleanup { get; set; }
    }
    [StructLayout(LayoutKind.Sequential)] struct Caps { public IntPtr Sid, Capabilities; public uint Count, Reserved; }
    [StructLayout(LayoutKind.Sequential)] struct SidAttr { public IntPtr Sid; public uint Attributes; }
    [StructLayout(LayoutKind.Sequential)] struct SA { public int Length; public IntPtr Descriptor; public int Inherit; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct SI {
        public int cb; public string reserved, desktop, title; public uint x,y,w,h,xCount,yCount,fill,flags;
        public ushort show,reservedSize; public IntPtr reservedPointer, stdin, stdout, stderr;
    }
    [StructLayout(LayoutKind.Sequential)] struct SIX { public SI si; public IntPtr attributes; }
    [StructLayout(LayoutKind.Sequential)] struct PI { public IntPtr process, thread; public uint pid, tid; }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimit { public long processTime,jobTime; public uint flags; public UIntPtr minWorking,maxWorking; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
    [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)] struct Limits { public BasicLimit basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
    [DllImport("userenv.dll", CharSet=CharSet.Unicode)] static extern int CreateAppContainerProfile(string name,string display,string description,IntPtr caps,uint count,out IntPtr sid);
    [DllImport("userenv.dll", CharSet=CharSet.Unicode)] static extern int DeriveAppContainerSidFromAppContainerName(string name,out IntPtr sid);
    [DllImport("userenv.dll", CharSet=CharSet.Unicode)] static extern int DeleteAppContainerProfile(string name);
    [DllImport("advapi32.dll")] static extern IntPtr FreeSid(IntPtr sid);
    [DllImport("kernelbase.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool DeriveCapabilitySidsFromName(string name,out IntPtr groups,out uint groupCount,out IntPtr sids,out uint sidCount);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool CreateProcess(string exe,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SIX startup,out PI process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref SA attributes,uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int id);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,ref Limits info,uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
    [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int type,IntPtr data,int size,out int returned);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
    [DllImport("advapi32.dll")] static extern bool GetSecurityDescriptorSacl(IntPtr descriptor,out bool present,out IntPtr sacl,out bool defaulted);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode)] static extern uint SetNamedSecurityInfo(string name,int type,uint flags,IntPtr owner,IntPtr group,IntPtr dacl,IntPtr sacl);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr value);
    static void Check(bool ok) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    static string Quote(string value) {
        var text=new StringBuilder("\""); int slashes=0;
        foreach(char c in value) {
            if(c=='\\') { slashes++; continue; }
            if(c=='\"') text.Append('\\',slashes*2+1).Append(c);
            else text.Append('\\',slashes).Append(c);
            slashes=0;
        }
        return text.Append('\\',slashes*2).Append('"').ToString();
    }
    static void Acl(string filename,SecurityIdentifier sid,bool write,bool remove) {
        string key;
        using(var sha=SHA256.Create()) key=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(filename).ToLowerInvariant()))).Replace("-","");
        using(var mutex=new Mutex(false,"Local\\PlayWeldAcl"+key)) {
        bool acquired=false;
        try { try { acquired=mutex.WaitOne(15000); } catch(AbandonedMutexException) { acquired=true; }
        if(!acquired) throw new Exception("Permission update lock timed out");
        if(Directory.Exists(filename)) {
            var acl=Directory.GetAccessControl(filename);
            if(NoAclChangeRequired(acl,sid,write,remove)) return;
            if(remove) acl.PurgeAccessRules(sid);
            else acl.AddAccessRule(new FileSystemAccessRule(sid,write?FileSystemRights.Modify:FileSystemRights.ReadAndExecute,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
            Directory.SetAccessControl(filename,acl);
        } else {
            var acl=File.GetAccessControl(filename);
            if(NoAclChangeRequired(acl,sid,write,remove)) return;
            if(remove) acl.PurgeAccessRules(sid);
            else acl.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.ReadAndExecute,AccessControlType.Allow));
            File.SetAccessControl(filename,acl);
        }
        } finally { if(acquired) mutex.ReleaseMutex(); }
        }
    }
    static bool NoAclChangeRequired(FileSystemSecurity acl,SecurityIdentifier sid,bool write,bool remove) {
        var rules=acl.GetAccessRules(true,true,typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().ToArray();
        if(remove) return !rules.Any(rule=>rule.IdentityReference.Equals(sid));
        if(write) return false;
        // Program Files already grants LPAC read/execute to ARAP. Ordinary users cannot
        // rewrite its admin-owned ACL. Never treat the broader AAP group as sufficient.
        var restricted=new SecurityIdentifier("S-1-15-2-2");
        var required=FileSystemRights.ReadAndExecute;
        if(rules.Any(rule=>rule.IdentityReference.Equals(restricted) && rule.AccessControlType==AccessControlType.Deny && (rule.FileSystemRights&required)!=0)) return false;
        return rules.Any(rule=>rule.IdentityReference.Equals(restricted) && rule.AccessControlType==AccessControlType.Allow && (rule.PropagationFlags&PropagationFlags.InheritOnly)==0 && (rule.FileSystemRights&required)==required);
    }
    static void LowIntegrity(string filename) {
        IntPtr descriptor; uint length; bool present,defaulted; IntPtr sacl;
        Check(ConvertStringSecurityDescriptorToSecurityDescriptor("S:(ML;OICI;NW;;;LW)",1,out descriptor,out length));
        try { Check(GetSecurityDescriptorSacl(descriptor,out present,out sacl,out defaulted)); var code=SetNamedSecurityInfo(filename,1,0x10,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,sacl); if(code!=0) throw new Win32Exception((int)code); }
        finally { LocalFree(descriptor); }
    }
    static bool Flag(IntPtr token,int kind) {
        var value=Marshal.AllocHGlobal(4); int returned;
        try { Trace("query token "+kind); Check(GetTokenInformation(token,kind,value,4,out returned)); return Marshal.ReadInt32(value)==1; }
        finally { Marshal.FreeHGlobal(value); }
    }
    static void Cleanup(Spec spec) {
        IntPtr pointer;
        if(DeriveAppContainerSidFromAppContainerName(spec.profileName,out pointer)!=0) return;
        try {
            var sid=new SecurityIdentifier(pointer);
            foreach(string filename in spec.readOnlyPaths.Concat(spec.readWritePaths).Distinct(StringComparer.OrdinalIgnoreCase)) {
                try { Acl(filename,sid,false,true); } catch { /* Parent retries cleanup after abrupt termination. */ }
            }
            DeleteAppContainerProfile(spec.profileName);
        } finally { FreeSid(pointer); }
    }
    static int Main() {
        Spec spec=null; IntPtr appSid=IntPtr.Zero,job=IntPtr.Zero,childInput=IntPtr.Zero,parentInput=IntPtr.Zero; PI process=new PI();
        var allocations=new List<IntPtr>(); IntPtr attributes=IntPtr.Zero;
        try {
            var input=Console.OpenStandardInput(); var line=new MemoryStream(); int b;
            while((b=input.ReadByte())!=-1 && b!=10) { if(line.Length>=1024*1024) throw new Exception("Launch specification too large"); line.WriteByte((byte)b); }
            spec=new JavaScriptSerializer().Deserialize<Spec>(Encoding.UTF8.GetString(line.ToArray()));
            if(spec==null || !System.Text.RegularExpressions.Regex.IsMatch(spec.profileName??"","^PlayWeldPlugin[0-9a-f]{32}$")) throw new Exception("Invalid owned container name");
            if(spec.cleanup) { Cleanup(spec); return 0; }
            Trace("profile"); int hr=CreateAppContainerProfile(spec.profileName,"PlayWeld plugin","Owned isolated worker",IntPtr.Zero,0,out appSid);
            if(hr!=0) Marshal.ThrowExceptionForHR(hr);
            Trace("permissions"); var sid=new SecurityIdentifier(appSid);
            foreach(string filename in spec.readOnlyPaths) { Trace("read permission "+filename); Acl(filename,sid,false,false); }
            foreach(string filename in spec.readWritePaths) { Trace("write permission "+filename); Acl(filename,sid,true,false); LowIntegrity(filename); }
            Trace("attributes"); var caps=new Caps { Sid=appSid };
            IntPtr groups,sids; uint groupCount,sidCount;
            Check(DeriveCapabilitySidsFromName("registryRead",out groups,out groupCount,out sids,out sidCount));
            var registrySid=Marshal.ReadIntPtr(sids);
            var registryBytes=new byte[new SecurityIdentifier(registrySid).BinaryLength]; new SecurityIdentifier(registrySid).GetBinaryForm(registryBytes,0);
            var registryCopy=Marshal.AllocHGlobal(registryBytes.Length); allocations.Add(registryCopy); Marshal.Copy(registryBytes,0,registryCopy,registryBytes.Length);
            for(uint i=0;i<groupCount;i++) LocalFree(Marshal.ReadIntPtr(groups,(int)i*IntPtr.Size)); LocalFree(groups);
            for(uint i=0;i<sidCount;i++) LocalFree(Marshal.ReadIntPtr(sids,(int)i*IntPtr.Size)); LocalFree(sids);
            caps.Capabilities=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SidAttr))*2); allocations.Add(caps.Capabilities);
            Marshal.StructureToPtr(new SidAttr { Sid=registryCopy,Attributes=4 },caps.Capabilities,false); caps.Count=1;
            if(spec.network) {
                var bytes=new byte[new SecurityIdentifier("S-1-15-3-1").BinaryLength]; new SecurityIdentifier("S-1-15-3-1").GetBinaryForm(bytes,0);
                var capSid=Marshal.AllocHGlobal(bytes.Length); allocations.Add(capSid); Marshal.Copy(bytes,0,capSid,bytes.Length);
                Marshal.StructureToPtr(new SidAttr { Sid=capSid,Attributes=4 },IntPtr.Add(caps.Capabilities,Marshal.SizeOf(typeof(SidAttr))),false); caps.Count=2;
            }
            IntPtr size=IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero,3,0,ref size);
            attributes=Marshal.AllocHGlobal(size); Check(InitializeProcThreadAttributeList(attributes,3,0,ref size));
            var capData=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(Caps))); allocations.Add(capData); Marshal.StructureToPtr(caps,capData,false);
            Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x20009),capData,new IntPtr(Marshal.SizeOf(typeof(Caps))),IntPtr.Zero,IntPtr.Zero));
            var policy=Marshal.AllocHGlobal(4); allocations.Add(policy); Marshal.WriteInt32(policy,1);
            Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x2000f),policy,new IntPtr(4),IntPtr.Zero,IntPtr.Zero));
            var pipeAttributes=new SA { Length=Marshal.SizeOf(typeof(SA)),Inherit=1 };
            Check(CreatePipe(out childInput,out parentInput,ref pipeAttributes,0)); Check(SetHandleInformation(parentInput,1,0));
            IntPtr stdout=GetStdHandle(-11),stderr=GetStdHandle(-12);
            Check(SetHandleInformation(stdout,1,1)); Check(SetHandleInformation(stderr,1,1));
            var handles=Marshal.AllocHGlobal(IntPtr.Size*3); allocations.Add(handles);
            Marshal.WriteIntPtr(handles,0,childInput); Marshal.WriteIntPtr(handles,IntPtr.Size,stdout); Marshal.WriteIntPtr(handles,IntPtr.Size*2,stderr);
            Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x20002),handles,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero));
            var startup=new SIX { attributes=attributes,si=new SI { cb=Marshal.SizeOf(typeof(SIX)),flags=0x100,stdin=childInput,stdout=stdout,stderr=stderr } };
            var environment=Marshal.StringToHGlobalUni(String.Join("\0",spec.env.OrderBy(pair=>pair.Key,StringComparer.OrdinalIgnoreCase).Select(pair=>pair.Key+"="+pair.Value))+"\0\0"); allocations.Add(environment);
            var command=new StringBuilder(Quote(spec.command)+" "+String.Join(" ",spec.args.Select(Quote)));
            Trace("create"); Check(CreateProcess(spec.command,command,IntPtr.Zero,IntPtr.Zero,true,0x80000|0x08000000|0x4|0x400,environment,spec.cwd,ref startup,out process));
            CloseHandle(childInput); childInput=IntPtr.Zero;
            Trace("job"); job=CreateJobObject(IntPtr.Zero,null); Check(job!=IntPtr.Zero);
            var limits=new Limits { basic=new BasicLimit { flags=0x2000|0x8|0x200,active=16 },jobMemory=new UIntPtr(512UL*1024*1024) };
            Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits)))); Check(AssignProcessToJobObject(job,process.process));
            Trace("token"); IntPtr token; Check(OpenProcessToken(process.process,8,out token));
            // Win32 class 46 is not queryable on all supported Windows builds.
            // LPAC is requested by the checked ALL_APPLICATION_PACKAGES_OPT_OUT
            // attribute and verified by the host's AAP-only file probe.
            try { if(!Flag(token,29)) throw new Exception("Worker token is not an AppContainer"); }
            finally { CloseHandle(token); }
            Trace("resume"); if(ResumeThread(process.thread)==UInt32.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
            var stdin=new FileStream(new SafeFileHandle(parentInput,true),FileAccess.Write);
            parentInput=IntPtr.Zero;
            var relay=new Thread(()=> { try { var buffer=new byte[4096]; int count; while((count=input.Read(buffer,0,buffer.Length))>0) { stdin.Write(buffer,0,count); stdin.Flush(); } } catch {} finally { stdin.Dispose(); } }); relay.IsBackground=true; relay.Start();
            Trace("wait"); WaitForSingleObject(process.process,UInt32.MaxValue); uint exit; Check(GetExitCodeProcess(process.process,out exit)); return (int)exit;
        } catch(Exception error) { Console.Error.WriteLine("AppContainer launch failed: "+error.Message); return 125; }
        finally {
            if(process.process!=IntPtr.Zero) { TerminateProcess(process.process,125); CloseHandle(process.process); }
            if(process.thread!=IntPtr.Zero) CloseHandle(process.thread);
            if(job!=IntPtr.Zero) CloseHandle(job);
            if(childInput!=IntPtr.Zero) CloseHandle(childInput);
            if(parentInput!=IntPtr.Zero) CloseHandle(parentInput);
            if(attributes!=IntPtr.Zero) { DeleteProcThreadAttributeList(attributes); Marshal.FreeHGlobal(attributes); }
            foreach(var pointer in allocations) Marshal.FreeHGlobal(pointer);
            if(appSid!=IntPtr.Zero) FreeSid(appSid);
            if(spec!=null && !spec.cleanup) Cleanup(spec);
        }
    }
}
