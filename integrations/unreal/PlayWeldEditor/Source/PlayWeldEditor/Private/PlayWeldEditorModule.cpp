// Copyright PlayWeld contributors. SPDX-License-Identifier: Apache-2.0
#include "Modules/ModuleManager.h"
#include "Editor.h"
#include "EngineUtils.h"
#include "GameFramework/Actor.h"
#include "HttpServerModule.h"
#include "HttpServerRequest.h"
#include "HttpServerResponse.h"
#include "IHttpRouter.h"
#include "IPAddress.h"
#include "Sockets.h"
#include "SocketSubsystem.h"
#include "Json.h"
#include "Misc/ConfigCacheIni.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/EngineVersion.h"
#include "Misc/StringOutputDevice.h"
#include "ScopedTransaction.h"
#include "UnrealClient.h"
#include "ImageUtils.h"
#include "HAL/PlatformProcess.h"
#include "HAL/FileManager.h"
#include "Misc/CoreDelegates.h"
#include "Windows/AllowWindowsPlatformTypes.h"
#include <dpapi.h>
#include "Windows/HideWindowsPlatformTypes.h"

namespace PlayWeld
{
    static FString Json(const TSharedRef<FJsonObject>& Object)
    {
        FString Text;
        FJsonSerializer::Serialize(Object, TJsonWriterFactory<>::Create(&Text));
        return Text;
    }

    static void Reply(const FHttpResultCallback& Done, const FString& Text, EHttpServerResponseCodes Code = EHttpServerResponseCodes::Ok)
    {
        auto Response = FHttpServerResponse::Create(Text, TEXT("application/json"));
        Response->Code = Code;
        Response->Headers.Add(TEXT("Cache-Control"), {TEXT("no-store")});
        Done(MoveTemp(Response));
    }

    static FString Header(const FHttpServerRequest& Request, const FString& Name)
    {
        for (const auto& Pair : Request.Headers)
        {
            if (Pair.Key.Equals(Name, ESearchCase::IgnoreCase) && Pair.Value.Num() == 1) return Pair.Value[0];
        }
        return FString();
    }
}

class FPlayWeldEditorModule final : public IModuleInterface
{
    TSharedPtr<IHttpRouter> Router;
    FHttpRouteHandle Route;
    FString Token;
    FString SessionFile;
    uint32 Port = 0;

    bool EditScene(const TSharedPtr<FJsonObject>& Args, TSharedRef<FJsonObject> Data)
    {
        auto World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
        if (!World || !Args.IsValid() || GEditor->PlayWorld) return false;
        FString Action;
        if (!Args->TryGetStringField(TEXT("action"), Action)) return false;
        AActor* Actor = nullptr;
        FString ActorPath;
        if (Args->TryGetStringField(TEXT("actorPath"), ActorPath))
            for (TActorIterator<AActor> It(World); It; ++It) if (It->GetPathName() == ActorPath) { Actor = *It; break; }
        FVector Location = FVector::ZeroVector;
        const TArray<TSharedPtr<FJsonValue>>* Values = nullptr;
        if (Args->TryGetArrayField(TEXT("location"), Values))
        {
            if (Values->Num() != 3) return false;
            double XYZ[3];
            for (int32 I = 0; I < 3; ++I)
                if (!(*Values)[I]->TryGetNumber(XYZ[I]) || !FMath::IsFinite(XYZ[I]) || FMath::Abs(XYZ[I]) > 10000000) return false;
            Location = FVector(XYZ[0], XYZ[1], XYZ[2]);
        }
        const FScopedTransaction Transaction(NSLOCTEXT("PlayWeldEditor", "EditScene", "PlayWeld scene edit"));
        if (Action == TEXT("spawn"))
        {
            FString ClassPath, Label;
            if (!Args->TryGetStringField(TEXT("classPath"), ClassPath) || !Args->TryGetStringField(TEXT("label"), Label) || Label.Len() > 128) return false;
            if (ClassPath != TEXT("/Script/Engine.StaticMeshActor") && ClassPath != TEXT("/Script/Engine.PointLight") && ClassPath != TEXT("/Script/Engine.CameraActor")) return false;
            UClass* Class = LoadObject<UClass>(nullptr, *ClassPath);
            if (!Class) return false;
            Actor = GEditor->AddActor(World->GetCurrentLevel(), Class, FTransform(Location));
            if (!Actor) return false;
            Actor->Tags.AddUnique(TEXT("PlayWeldOwned"));
            Actor->SetActorLabel(Label);
        }
        else
        {
            if (!Actor || !Actor->Tags.Contains(TEXT("PlayWeldOwned"))) return false;
            Actor->Modify();
            if (Action == TEXT("set-location")) Actor->SetActorLocation(Location);
            else if (Action == TEXT("delete"))
            {
                Data->SetStringField(TEXT("actorPath"), ActorPath);
                Data->SetBoolField(TEXT("success"), World->EditorDestroyActor(Actor, true));
                return Data->GetBoolField(TEXT("success"));
            }
            else return false;
        }
        Data->SetStringField(TEXT("actorPath"), Actor->GetPathName());
        Data->SetStringField(TEXT("label"), Actor->GetActorLabel());
        Data->SetArrayField(TEXT("location"), {MakeShared<FJsonValueNumber>(Actor->GetActorLocation().X), MakeShared<FJsonValueNumber>(Actor->GetActorLocation().Y), MakeShared<FJsonValueNumber>(Actor->GetActorLocation().Z)});
        Data->SetBoolField(TEXT("success"), true);
        return true;
    }

    bool Screenshot(TSharedRef<FJsonObject> Data)
    {
        FViewport* Viewport = GEditor ? GEditor->GetActiveViewport() : nullptr;
        if (!Viewport) return false;
        const FIntPoint Size = Viewport->GetSizeXY();
        if (Size.X < 1 || Size.Y < 1 || Size.X > 8192 || Size.Y > 8192) return false;
        TArray<FColor> Pixels;
        if (!Viewport->ReadPixels(Pixels)) return false;
        TArray64<uint8> PNG;
        FImageUtils::PNGCompressImageArray(Size.X, Size.Y, Pixels, PNG);
        const FString Path = FPaths::ConvertRelativePathToFull(FPaths::ProjectSavedDir() / TEXT("PlayWeldEditor") / (FGuid::NewGuid().ToString() + TEXT(".png")));
        if (PNG.Num() < 8 || PNG.Num() > 8 * 1024 * 1024 || !FFileHelper::SaveArrayToFile(PNG, *Path)) return false;
        Data->SetBoolField(TEXT("success"), true);
        Data->SetStringField(TEXT("path"), Path);
        Data->SetNumberField(TEXT("width"), Size.X);
        Data->SetNumberField(TEXT("height"), Size.Y);
        return true;
    }

    TSharedRef<FJsonObject> Identity() const
    {
        auto Result = MakeShared<FJsonObject>();
        Result->SetStringField(TEXT("projectPath"), FPaths::ConvertRelativePathToFull(FPaths::GetProjectFilePath()));
        Result->SetStringField(TEXT("engineVersion"), FEngineVersion::Current().ToString());
        Result->SetStringField(TEXT("bridge"), TEXT("PlayWeldEditor"));
        Result->SetBoolField(TEXT("editorOnly"), true);
        Result->SetNumberField(TEXT("pid"), FPlatformProcess::GetCurrentProcessId());
        TArray<TSharedPtr<FJsonValue>> Actors;
        auto World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
        if (World)
            for (TActorIterator<AActor> It(World); It && Actors.Num() < 2000; ++It)
            {
                auto Item = MakeShared<FJsonObject>();
                Item->SetStringField(TEXT("objectId"), It->GetPathName());
                Item->SetStringField(TEXT("name"), It->GetActorLabel());
                Item->SetBoolField(TEXT("owned"), It->Tags.Contains(TEXT("PlayWeldOwned")));
                const FVector Location = It->GetActorLocation();
                Item->SetArrayField(TEXT("location"), {MakeShared<FJsonValueNumber>(Location.X), MakeShared<FJsonValueNumber>(Location.Y), MakeShared<FJsonValueNumber>(Location.Z)});
                Actors.Add(MakeShared<FJsonValueObject>(Item));
            }
        Result->SetArrayField(TEXT("objects"), Actors);
        return Result;
    }

    bool Handle(const FHttpServerRequest& Request, const FHttpResultCallback& Done)
    {
        const FString ExpectedHost = FString::Printf(TEXT("127.0.0.1:%u"), Port);
        if (!Request.PeerAddress.IsValid() || Request.PeerAddress->ToString(false) != TEXT("127.0.0.1") ||
            PlayWeld::Header(Request, TEXT("Host")) != ExpectedHost || !PlayWeld::Header(Request, TEXT("Origin")).IsEmpty())
        {
            PlayWeld::Reply(Done, TEXT("{\"error\":\"Loopback client required\"}"), EHttpServerResponseCodes::Forbidden);
            return true;
        }
        if (Token.IsEmpty() || PlayWeld::Header(Request, TEXT("Authorization")) != TEXT("Bearer ") + Token)
        {
            PlayWeld::Reply(Done, TEXT("{\"error\":\"Authentication required\"}"), EHttpServerResponseCodes::Denied);
            return true;
        }
        if (Request.Body.Num() > 1024 * 1024 || !IsInGameThread())
        {
            PlayWeld::Reply(Done, TEXT("{\"error\":\"Request unavailable\"}"), EHttpServerResponseCodes::BadRequest);
            return true;
        }
        const FUTF8ToTCHAR Utf8(reinterpret_cast<const ANSICHAR*>(Request.Body.GetData()), Request.Body.Num());
        const FString Text(Utf8.Length(), Utf8.Get());
        TSharedPtr<FJsonObject> Message;
        if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Message) || !Message.IsValid())
        {
            PlayWeld::Reply(Done, TEXT("{\"error\":\"Invalid JSON\"}"), EHttpServerResponseCodes::BadRequest);
            return true;
        }
        FString Method;
        if (!Message->TryGetStringField(TEXT("method"), Method))
        {
            PlayWeld::Reply(Done, TEXT("{\"error\":\"Method required\"}"), EHttpServerResponseCodes::BadRequest);
            return true;
        }
        if (!Message->HasField(TEXT("id")))
        {
            PlayWeld::Reply(Done, TEXT(""), EHttpServerResponseCodes::Accepted);
            return true;
        }
        auto Envelope = MakeShared<FJsonObject>();
        Envelope->SetStringField(TEXT("jsonrpc"), TEXT("2.0"));
        Envelope->SetField(TEXT("id"), Message->Values[TEXT("id")]);
        auto Result = MakeShared<FJsonObject>();
        if (Method == TEXT("initialize"))
        {
            Result->SetStringField(TEXT("protocolVersion"), TEXT("2025-11-25"));
            auto Capabilities = MakeShared<FJsonObject>();
            Capabilities->SetObjectField(TEXT("tools"), MakeShared<FJsonObject>());
            Result->SetObjectField(TEXT("capabilities"), Capabilities);
            auto Server = MakeShared<FJsonObject>();
            Server->SetStringField(TEXT("name"), TEXT("playweld-unreal-editor"));
            Server->SetStringField(TEXT("version"), TEXT("0.1.0"));
            Result->SetObjectField(TEXT("serverInfo"), Server);
        }
        else if (Method == TEXT("tools/list"))
        {
            TArray<TSharedPtr<FJsonValue>> Tools;
            for (const FString& Name : {FString(TEXT("get_project_context")), FString(TEXT("inspect")), FString(TEXT("edit_scene")), FString(TEXT("screenshot")), FString(TEXT("console"))})
            {
                auto Tool = MakeShared<FJsonObject>();
                Tool->SetStringField(TEXT("name"), Name);
                Tool->SetStringField(TEXT("description"), TEXT("First-party PlayWeld editor operation. Scene edits support owned test actors; screenshot captures the active viewport; console requires destructive access."));
                auto Schema = MakeShared<FJsonObject>();
                Schema->SetStringField(TEXT("type"), TEXT("object"));
                auto Properties = MakeShared<FJsonObject>();
                if (Name == TEXT("edit_scene"))
                {
                    for (const FString& Key : {FString(TEXT("action")), FString(TEXT("actorPath")), FString(TEXT("classPath")), FString(TEXT("label"))})
                    { auto Property = MakeShared<FJsonObject>(); Property->SetStringField(TEXT("type"), TEXT("string")); Properties->SetObjectField(Key, Property); }
                    auto Vector = MakeShared<FJsonObject>(); Vector->SetStringField(TEXT("type"), TEXT("array"));
                    auto Number = MakeShared<FJsonObject>(); Number->SetStringField(TEXT("type"), TEXT("number")); Vector->SetObjectField(TEXT("items"), Number);
                    Vector->SetNumberField(TEXT("minItems"), 3); Vector->SetNumberField(TEXT("maxItems"), 3); Properties->SetObjectField(TEXT("location"), Vector);
                    Schema->SetArrayField(TEXT("required"), {MakeShared<FJsonValueString>(TEXT("action"))});
                }
                if (Name == TEXT("console"))
                { auto Command = MakeShared<FJsonObject>(); Command->SetStringField(TEXT("type"), TEXT("string")); Command->SetNumberField(TEXT("minLength"), 1); Command->SetNumberField(TEXT("maxLength"), 4096); Properties->SetObjectField(TEXT("command"), Command); Schema->SetArrayField(TEXT("required"), {MakeShared<FJsonValueString>(TEXT("command"))}); }
                Schema->SetObjectField(TEXT("properties"), Properties);
                Schema->SetBoolField(TEXT("additionalProperties"), false);
                Tool->SetObjectField(TEXT("inputSchema"), Schema);
                auto Annotations = MakeShared<FJsonObject>();
                Annotations->SetBoolField(TEXT("readOnlyHint"), Name == TEXT("get_project_context") || Name == TEXT("inspect"));
                Annotations->SetBoolField(TEXT("destructiveHint"), Name == TEXT("console"));
                Tool->SetObjectField(TEXT("annotations"), Annotations);
                Tools.Add(MakeShared<FJsonValueObject>(Tool));
            }
            Result->SetArrayField(TEXT("tools"), Tools);
        }
        else if (Method == TEXT("tools/call"))
        {
            const TSharedPtr<FJsonObject>* Params = nullptr;
            FString Name;
            const bool Valid = Message->TryGetObjectField(TEXT("params"), Params) && (*Params)->TryGetStringField(TEXT("name"), Name);
            auto Data = Identity();
            bool Known = Valid && (Name == TEXT("get_project_context") || Name == TEXT("inspect") || Name == TEXT("edit_scene") || Name == TEXT("screenshot") || Name == TEXT("console"));
            const TSharedPtr<FJsonObject>* Arguments = nullptr;
            if (Valid) (*Params)->TryGetObjectField(TEXT("arguments"), Arguments);
            if (Known && Name == TEXT("edit_scene")) Known = EditScene(Arguments ? *Arguments : nullptr, Data);
            if (Known && Name == TEXT("screenshot")) Known = Screenshot(Data);
            if (Known && Name == TEXT("console"))
            {
                FString Command; FStringOutputDevice Output;
                auto World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
                Known = Arguments && (*Arguments)->TryGetStringField(TEXT("command"), Command) && !Command.IsEmpty() && Command.Len() <= 4096 && GEditor && GEditor->Exec(World, *Command, Output);
                Data->SetBoolField(TEXT("success"), Known); Data->SetStringField(TEXT("output"), Output);
            }
            if (Known && Name == TEXT("inspect"))
            {
                auto World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
                TArray<TSharedPtr<FJsonValue>> Actors;
                if (World) for (TActorIterator<AActor> It(World); It && Actors.Num() < 1000; ++It)
                {
                    auto Actor = MakeShared<FJsonObject>();
                    Actor->SetStringField(TEXT("path"), It->GetPathName());
                    Actor->SetStringField(TEXT("label"), It->GetActorLabel());
                    Actor->SetStringField(TEXT("class"), It->GetClass()->GetPathName());
                    Actors.Add(MakeShared<FJsonValueObject>(Actor));
                }
                Data->SetArrayField(TEXT("actors"), Actors);
                Data->SetBoolField(TEXT("limited"), Actors.Num() == 1000);
            }
            auto Content = MakeShared<FJsonObject>();
            Content->SetStringField(TEXT("type"), TEXT("text"));
            Content->SetStringField(TEXT("text"), Known ? PlayWeld::Json(Data) : TEXT("Unknown tool or operation failed validation/execution"));
            Result->SetArrayField(TEXT("content"), {MakeShared<FJsonValueObject>(Content)});
            Result->SetBoolField(TEXT("isError"), !Known);
        }
        else if (Method != TEXT("ping"))
        {
            auto Error = MakeShared<FJsonObject>();
            Error->SetNumberField(TEXT("code"), -32601);
            Error->SetStringField(TEXT("message"), TEXT("Method not found"));
            Envelope->SetObjectField(TEXT("error"), Error);
            PlayWeld::Reply(Done, PlayWeld::Json(Envelope));
            return true;
        }
        Envelope->SetObjectField(TEXT("result"), Result);
        PlayWeld::Reply(Done, PlayWeld::Json(Envelope));
        return true;
    }

public:
    void StartupModule() override
    {
        if (IsRunningCommandlet() || !GIsEditor) return;
        // User-scoped DPAPI ciphertext only; never log or persist the decrypted token.
        TArray<uint8> Encrypted;
        const FString Credential = FPaths::ProjectSavedDir() / TEXT("PlayWeldEditor/session-token.dpapi");
        if (!FFileHelper::LoadFileToArray(Encrypted, *Credential) || Encrypted.Num() == 0) return;
        DATA_BLOB Input{static_cast<DWORD>(Encrypted.Num()), Encrypted.GetData()}, Output{};
        if (!CryptUnprotectData(&Input, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &Output)) return;
        const FUTF8ToTCHAR Decoded(reinterpret_cast<const ANSICHAR*>(Output.pbData), Output.cbData);
        Token = FString(Decoded.Length(), Decoded.Get());
        SecureZeroMemory(Output.pbData, Output.cbData);
        LocalFree(Output.pbData);
        if (Token.Len() < 32) { Token.Empty(); return; }
        // Explicitly bind this listener to IPv4 loopback, independently of other listeners.
        TArray<FString> Bindings;
        GConfig->GetArray(TEXT("HTTPServer.Listeners"), TEXT("ListenerOverrides"), Bindings, GEngineIni);
        FHttpServerModule::Get().StartAllListeners();
        // Let the OS avoid occupied/reserved ranges; retry the reservation-to-listener race.
        auto Sockets = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
        for (int32 Attempt = 0; Sockets && Attempt < 8 && !Router.IsValid(); ++Attempt)
        {
            FSocket* Reservation = Sockets->CreateSocket(NAME_Stream, TEXT("PlayWeld loopback reservation"), FNetworkProtocolTypes::IPv4);
            if (!Reservation) break;
            auto Address = Sockets->CreateInternetAddr();
            bool Valid = false;
            Address->SetIp(TEXT("127.0.0.1"), Valid);
            Address->SetPort(0);
            const bool Bound = Valid && Reservation->Bind(*Address);
            Port = Bound ? Reservation->GetPortNo() : 0;
            Reservation->Close(); Sockets->DestroySocket(Reservation);
            if (Port == 0) continue;
            auto AttemptBindings = Bindings;
            AttemptBindings.Insert(FString::Printf(TEXT("(Port=%u,BindAddress=127.0.0.1)"), Port), 0);
            GConfig->SetArray(TEXT("HTTPServer.Listeners"), TEXT("ListenerOverrides"), AttemptBindings, GEngineIni);
            FCoreDelegates::TSOnConfigSectionsChanged().Broadcast(GEngineIni, {FString(TEXT("HTTPServer.Listeners"))});
            Router = FHttpServerModule::Get().GetHttpRouter(Port, true);
        }
        if (!Router.IsValid()) { Token.Empty(); return; }
        Route = Router->BindRoute(FHttpPath(TEXT("/mcp")), EHttpServerRequestVerbs::VERB_POST,
            FHttpRequestHandler::CreateRaw(this, &FPlayWeldEditorModule::Handle));
        auto Session = Identity();
        Session->SetStringField(TEXT("url"), FString::Printf(TEXT("http://127.0.0.1:%u/mcp"), Port));
        SessionFile = FPaths::ProjectSavedDir() / TEXT("PlayWeldEditor/session.json");
        FFileHelper::SaveStringToFile(PlayWeld::Json(Session), *SessionFile);
    }

    void ShutdownModule() override
    {
        if (Router.IsValid() && Route.IsValid()) Router->UnbindRoute(Route);
        Router.Reset();
        Token.Empty();
        if (!SessionFile.IsEmpty()) IFileManager::Get().Delete(*SessionFile);
    }
};

IMPLEMENT_MODULE(FPlayWeldEditorModule, PlayWeldEditor)
