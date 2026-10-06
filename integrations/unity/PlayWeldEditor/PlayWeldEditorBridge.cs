// SPDX-License-Identifier: Apache-2.0
// Installed under Assets/Editor; never compiled into a player.
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
public static class PlayWeldEditorBridge {
    [Serializable] class Request { public string method; public Parameters @params; }
    [Serializable] class Parameters { public string name; public Arguments @arguments; }
    [Serializable] class Arguments { public string action, objectId, name; public float[] location; }
    [Serializable] class Text { public string value; }
    [Serializable] class Identity { public string projectPath, engineVersion, scene; public Item[] objects; }
    [Serializable] class Item { public string objectId, name; public bool owned; public float[] location; }
    [Serializable] class Session { public string bridge="PlayWeldEditor", projectPath, url; public int pid; }
    class Pending { public Request request; public string result; public Exception error; public long deadline=DateTime.UtcNow.AddSeconds(10).Ticks; public volatile bool cancelled; public ManualResetEventSlim done=new ManualResetEventSlim(); }
    static readonly ConcurrentQueue<Pending> queue=new ConcurrentQueue<Pending>();
    static readonly SemaphoreSlim slots=new SemaphoreSlim(8);
    static readonly System.Collections.Generic.HashSet<GameObject> ownedObjects=new System.Collections.Generic.HashSet<GameObject>();
    [StructLayout(LayoutKind.Sequential)] struct Blob { public int count; public IntPtr data; }
    [DllImport("crypt32.dll", SetLastError=true)] static extern bool CryptUnprotectData(ref Blob input,IntPtr description,IntPtr entropy,IntPtr reserved,IntPtr prompt,uint flags,out Blob output);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr value);
    static byte[] Decrypt(byte[] encrypted) {
        var input=new Blob { count=encrypted.Length,data=Marshal.AllocHGlobal(encrypted.Length) }; Blob output=new Blob();
        try { Marshal.Copy(encrypted,0,input.data,encrypted.Length); if(!CryptUnprotectData(ref input,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,1,out output)) throw new Exception("Credential decryption failed"); var result=new byte[output.count]; Marshal.Copy(output.data,result,0,result.Length); return result; }
        finally { Marshal.FreeHGlobal(input.data); if(output.data!=IntPtr.Zero) LocalFree(output.data); }
    }
    static TcpListener listener;
    static string token, sessionFile, root;
    static volatile bool stopped;
    static string Quote(string text) { var json=JsonUtility.ToJson(new Text { value=text }); return json.Substring(9,json.Length-10); }
    static PlayWeldEditorBridge() {
        if(AssetDatabase.IsAssetImportWorkerProcess()) return;
        Start();
        AssemblyReloadEvents.beforeAssemblyReload+=Stop;
        EditorApplication.quitting+=Stop;
        EditorApplication.update+=Update;
    }
    static void Start() {
        root=Path.GetFullPath(Path.Combine(Application.dataPath,".."));
        var saved=Path.Combine(root,"Library","PlayWeldEditor");
        var credential=Path.Combine(saved,"session-token.dpapi");
        if(!File.Exists(credential) || Application.platform!=RuntimePlatform.WindowsEditor) return;
        try {
            var bytes=Decrypt(File.ReadAllBytes(credential));
            token=Encoding.UTF8.GetString(bytes); Array.Clear(bytes,0,bytes.Length);
            if(!Regex.IsMatch(token,"^[0-9a-f]{64}$")) throw new Exception("Invalid pairing credential");
            listener=new TcpListener(IPAddress.Loopback,0); listener.Start(8);
            sessionFile=Path.Combine(saved,"session.json");
            File.WriteAllText(sessionFile,JsonUtility.ToJson(new Session { projectPath=root, pid=System.Diagnostics.Process.GetCurrentProcess().Id, url="http://127.0.0.1:"+((IPEndPoint)listener.LocalEndpoint).Port+"/mcp" }));
            new Thread(Accept) { IsBackground=true }.Start();
        } catch(Exception) { Debug.LogError("PlayWeld editor bridge could not start. Reinstall its protected pairing credential from PlayWeld."); Stop(); }
    }
    static void Stop() {
        stopped=true; listener?.Stop(); token=null;
        if(sessionFile!=null && File.Exists(sessionFile)) File.Delete(sessionFile);
        while(queue.TryDequeue(out var request)) { request.error=new Exception("Editor bridge stopped"); request.done.Set(); }
    }
    static void Accept() {
        while(!stopped) {
            try { var client=listener.AcceptTcpClient(); if(!slots.Wait(0)) { client.Dispose(); continue; } ThreadPool.QueueUserWorkItem(_=> { try { Handle(client); } finally { slots.Release(); } }); }
            catch(SocketException) { if(!stopped) Thread.Sleep(10); }
            catch(ObjectDisposedException) { break; }
        }
    }
    static bool Authorized(string supplied) {
        var expected="Bearer "+token;
        if(token==null || supplied==null || supplied.Length!=expected.Length) return false;
        int difference=0; for(int i=0;i<expected.Length;i++) difference|=supplied[i]^expected[i]; return difference==0;
    }
    static void Reply(NetworkStream stream,int status,string json) {
        var bytes=Encoding.UTF8.GetBytes(json);
        var header=Encoding.ASCII.GetBytes("HTTP/1.1 "+status+" Response\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: "+bytes.Length+"\r\n\r\n");
        stream.Write(header,0,header.Length); stream.Write(bytes,0,bytes.Length);
    }
    static void Handle(TcpClient client) {
        using(client) {
            client.ReceiveTimeout=3000; client.SendTimeout=3000;
            using(var stream=client.GetStream()) try {
                var header=new MemoryStream(); int next;
                while((next=stream.ReadByte())!=-1) { header.WriteByte((byte)next); if(header.Length>8192) throw new Exception("Header too large"); var b=header.GetBuffer(); int n=(int)header.Length; if(n>=4 && b[n-4]==13 && b[n-3]==10 && b[n-2]==13 && b[n-1]==10) break; }
                var lines=Encoding.ASCII.GetString(header.ToArray()).Split(new[]{"\r\n"},StringSplitOptions.None);
                if(lines[0]!="POST /mcp HTTP/1.1") { Reply(stream,405,"{}"); return; }
                string authorization=null; int length=-1;
                foreach(var line in lines) {
                    int colon=line.IndexOf(':'); if(colon<0) continue; var key=line.Substring(0,colon).ToLowerInvariant(); var value=line.Substring(colon+1).Trim();
                    if(key=="origin" || key=="transfer-encoding") throw new Exception("Unsupported request");
                    if(key=="authorization") { if(authorization!=null) throw new Exception("Duplicate header"); authorization=value; }
                    if(key=="content-length") { if(length!=-1 || !int.TryParse(value,out length)) throw new Exception("Invalid length"); }
                }
                if(!Authorized(authorization)) { Reply(stream,401,"{}"); return; }
                if(length<0 || length>1048576) throw new Exception("Invalid body length");
                var body=new byte[length]; int read=0; while(read<length) { int count=stream.Read(body,read,length-read); if(count==0) throw new Exception("Incomplete request"); read+=count; }
                var json=Encoding.UTF8.GetString(body); var id=Regex.Match(json,"\"id\"\\s*:\\s*(\"(?:[^\"\\\\]|\\\\.)*\"|-?[0-9]+)");
                if(!id.Success) { Reply(stream,202,""); return; }
                if(queue.Count>=8) throw new Exception("Editor is busy");
                var pending=new Pending { request=JsonUtility.FromJson<Request>(json) }; queue.Enqueue(pending);
                if(!pending.done.Wait(10000)) { pending.cancelled=true; throw new Exception("Editor is busy"); }
                var result=pending.error==null ? "\"result\":"+pending.result : "\"error\":{\"code\":-32602,\"message\":\"Editor operation rejected\"}";
                Reply(stream,200,"{\"jsonrpc\":\"2.0\",\"id\":"+id.Groups[1].Value+","+result+"}");
            } catch(Exception) { try { Reply(stream,400,"{\"error\":\"Request rejected\"}"); } catch(IOException) {} }
        }
    }
    static void Update() { for(int i=0;i<8 && queue.TryDequeue(out var pending);i++) { try { if(pending.cancelled || DateTime.UtcNow.Ticks>=pending.deadline) throw new Exception("Editor request expired"); pending.result=Execute(pending.request); } catch(Exception error) { pending.error=error; } finally { pending.done.Set(); } } }
    static string IdentityJson() {
        var scene=SceneManager.GetActiveScene(); var items=new System.Collections.Generic.List<Item>();
        foreach(var gameObject in scene.GetRootGameObjects()) { if(items.Count>=2000) break; var p=gameObject.transform.position; items.Add(new Item { objectId=GlobalObjectId.GetGlobalObjectIdSlow(gameObject).ToString(), name=gameObject.name, owned=ownedObjects.Contains(gameObject), location=new[]{p.x,p.y,p.z} }); }
        return JsonUtility.ToJson(new Identity { projectPath=root, engineVersion=Application.unityVersion, scene=scene.path, objects=items.ToArray() });
    }
    static string Execute(Request request) {
        if(request.method=="initialize") return "{\"protocolVersion\":\"2025-11-25\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"playweld-unity-editor\",\"version\":\"0.1.0\"}}";
        if(request.method=="ping") return "{}";
        if(request.method=="tools/list") return Tools;
        if(request.method!="tools/call" || request.@params==null) throw new Exception("Unknown method");
        var name=request.@params.name; string data;
        if(name=="edit_scene") {
            if(EditorApplication.isPlayingOrWillChangePlaymode) throw new Exception("Exit Play Mode before editing");
            var args=request.@params.@arguments; if(args==null) throw new Exception("Arguments required");
            var position=Vector3.zero;
            if(args.location!=null) { if(args.location.Length!=3) throw new Exception("Vector required"); foreach(var value in args.location) if(float.IsNaN(value)||float.IsInfinity(value)||Math.Abs(value)>10000000) throw new Exception("Invalid position"); position=new Vector3(args.location[0],args.location[1],args.location[2]); }
            GameObject obj=null;
            if(args.action=="spawn") { obj=new GameObject("PlayWeld_"+Guid.NewGuid().ToString("N")); SceneManager.MoveGameObjectToScene(obj,SceneManager.GetActiveScene()); Undo.RegisterCreatedObjectUndo(obj,"PlayWeld create object"); obj.transform.position=position; ownedObjects.Add(obj); }
            else { if(!GlobalObjectId.TryParse(args.objectId,out var instance)) throw new Exception("Object required"); obj=GlobalObjectId.GlobalObjectIdentifierToObjectSlow(instance) as GameObject; if(obj==null || obj.scene!=SceneManager.GetActiveScene() || !ownedObjects.Contains(obj)) throw new Exception("Only objects created by this bridge session can be changed"); if(args.action=="set-location") { Undo.RecordObject(obj.transform,"PlayWeld move object"); obj.transform.position=position; } else if(args.action=="delete") Undo.DestroyObjectImmediate(obj); else throw new Exception("Unknown action"); }
            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene()); data=IdentityJson();
        } else if(name=="screenshot") {
            var view=SceneView.lastActiveSceneView; if(view==null || view.camera==null) throw new Exception("Open a Scene viewport");
            var target=RenderTexture.GetTemporary(1280,720,24); var prior=view.camera.targetTexture; var active=RenderTexture.active;
            var image=new Texture2D(1280,720,TextureFormat.RGB24,false);
            try { view.camera.targetTexture=target; view.camera.Render(); RenderTexture.active=target; image.ReadPixels(new Rect(0,0,1280,720),0,0); image.Apply(); var file=Path.Combine(root,"Library/PlayWeldEditor/viewport-"+Guid.NewGuid().ToString("N")+".png"); File.WriteAllBytes(file,image.EncodeToPNG()); data="{\"projectPath\":"+Quote(root)+",\"screenshot\":"+Quote(file)+"}"; }
            finally { view.camera.targetTexture=prior; RenderTexture.active=active; RenderTexture.ReleaseTemporary(target); UnityEngine.Object.DestroyImmediate(image); }
        } else if(name=="get_project_context" || name=="inspect") data=IdentityJson(); else throw new Exception("Unknown tool");
        return "{\"content\":[{\"type\":\"text\",\"text\":"+Quote(data)+"}],\"structuredContent\":"+data+",\"isError\":false}";
    }
    const string Tools="{\"tools\":[{\"name\":\"get_project_context\",\"description\":\"Identify this Unity editor and inspect root scene objects.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false},\"annotations\":{\"readOnlyHint\":true}},{\"name\":\"inspect\",\"description\":\"Inspect root scene objects.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false},\"annotations\":{\"readOnlyHint\":true}},{\"name\":\"edit_scene\",\"description\":\"Create, move or delete PlayWeld owned scene objects with Undo.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"action\":{\"type\":\"string\",\"enum\":[\"spawn\",\"set-location\",\"delete\"]},\"objectId\":{\"type\":\"string\"},\"location\":{\"type\":\"array\",\"items\":{\"type\":\"number\"},\"minItems\":3,\"maxItems\":3}},\"required\":[\"action\"],\"additionalProperties\":false},\"annotations\":{\"readOnlyHint\":false,\"destructiveHint\":false}},{\"name\":\"screenshot\",\"description\":\"Capture the active Scene viewport to Library/PlayWeldEditor.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false},\"annotations\":{\"readOnlyHint\":false,\"destructiveHint\":false}}]}";
}
